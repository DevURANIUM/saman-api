'use strict';
const { ApiError } = require('./errors');

// Application workflow only. Mobillet's bank protocol and low-level login stay unchanged.
function view(state) {
  const needsLogin = ['expired','logged_out'].includes(state.state);
  const otpRequired = !needsLogin && Boolean(state.deviceVerificationRequired || state.trustedDevice === false || state.state === 'otp_required');
  const nextAction = needsLogin ? 'login' : state.shouldChangePassword ? 'change_password_in_bank_app'
    : otpRequired ? state.nextAction || 'otp_request' : state.nextAction ?? null;
  return { ...state, ok: Boolean(state.loggedIn || otpRequired) && !state.shouldChangePassword && !needsLogin,
    otpRequired, nextAction };
}

async function deliverOtp(client, result, { requestOtp = true } = {}) {
  let state = view(result);
  if (state.shouldChangePassword || !state.otpRequired) return state;
  // Resume a pending login without generating another SMS or replacing its token.
  if (client.session?.loginOtp) return { ...state, otpSent: true, nextAction: 'verify_otp' };
  if (!requestOtp) return { ...state, otpSent: false, nextAction: 'otp_request' };
  try {
    const otpRequest = await client.requestOtp();
    return { ...state, otpSent: true, otpRequest, nextAction: 'verify_otp' };
  } catch (error) {
    if (!(error instanceof ApiError)) throw error;
    return { ...state, otpSent: false, nextAction: 'otp_request',
      otpError: { error: error.message, status: error.status, code: error.code } };
  }
}

async function beginLogin(client, input = {}) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new ApiError('login body must be an object', 400);
  for (const key of Object.keys(input)) if (!['username', 'password', 'loginType', 'requestOtp'].includes(key))
    throw new ApiError('unsupported login option: ' + key, 400);
  if (input.requestOtp !== undefined && typeof input.requestOtp !== 'boolean') throw new ApiError('requestOtp must be a boolean', 400);
  const { requestOtp = true, ...credentials } = input;
  const result = await client.login(credentials);
  if (result.deviceVerificationRequired || result.trustedDevice === false || result.state === 'otp_required' || result.shouldChangePassword)
    return deliverOtp(client, { ...result, bankVerified: false }, { requestOtp });
  return view(await client.checkSession());
}

async function finishLogin(client, code) {
  await client.verifyOtp(code);
  return view(await client.checkSession());
}

async function resumeLogin(client) {
  return deliverOtp(client, { ...client.status(), bankVerified: false });
}

async function ensureLogin(client, credentials = {}) {
  const result = await client.ensureSession(credentials);
  return deliverOtp(client, result);
}

function credentialsFrom(env = process.env) {
  return env.SAMAN_USER && env.SAMAN_PASS ? { username: env.SAMAN_USER, password: env.SAMAN_PASS } : null;
}

async function withSession(client, operation, { credentials = credentialsFrom(), readOnly = false, onPending } = {}) {
  // Test doubles and callers without status retain their previous behavior.
  if (typeof client.status !== 'function') return operation();
  const pending = async flow => {
    if (flow.otpRequired && !flow.shouldChangePassword && onPending) {
      const complete = await onPending(flow);
      if (complete?.bankVerified && complete.loggedIn && !complete.otpRequired && !complete.shouldChangePassword) return complete;
    }
    const error = new ApiError(flow.shouldChangePassword ? 'password change required in the bank app' : 'device verification required; submit the SMS code', 403, 'AUTH_ACTION_REQUIRED');
    error.auth = flow;
    error.nextAction = flow.nextAction;
    throw error;
  };
  let renewalAttempted = false;
  const renew = async () => {
    const knownUser = client.session?.username;
    const normalize = value => String(value).replace(/[\u06f0-\u06f9\u0660-\u0669]/g, d => String('\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.includes(d)
      ? '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.indexOf(d) : '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(d)));
    if (knownUser && normalize(credentials.username) !== normalize(knownUser)
      || client.session?.source && !knownUser) {
      throw new ApiError('automatic renewal cannot change the session account; use login explicitly', 401, 'SESSION_ACCOUNT_MISMATCH');
    }
    renewalAttempted = true;
    return ensureLogin(client, credentials);
  };
  const prepare = async () => {
    const status = client.status();
    if (status.shouldChangePassword && status.state !== 'expired') return pending(view(status));
    if (status.state === 'otp_required') return pending(await resumeLogin(client));
    if (credentials && ['expired','logged_out'].includes(status.state)) {
      const result = await renew();
      if (!result.bankVerified || result.otpRequired || result.shouldChangePassword) return pending(result);
    }
  };
  await prepare();
  try { return await operation(); }
  catch (error) {
    // Only replay a read after an explicit bank-authentication rejection.
    // Payments and all other writes are never resubmitted automatically.
    if (!(error instanceof ApiError) || error.status !== 401 || !readOnly || !credentials || renewalAttempted) throw error;
    const result = await renew();
    if (!result.bankVerified || result.otpRequired || result.shouldChangePassword) await pending(result);
    return operation();
  }
}

module.exports = { view, beginLogin, finishLogin, resumeLogin, ensureLogin, credentialsFrom, withSession };
