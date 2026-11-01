'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MobilletClient, ApiError } = require('../src/client');
function client(state = 'authenticated') {
  const c = Object.create(MobilletClient.prototype);
  c.status = () => ({ state, hasToken: state !== 'logged_out', trustedDevice: state === 'otp_required' ? false : true });
  c.checkSession = async () => ({ loggedIn: true, bankVerified: true });
  return c;
}
test('ensure does not login when bank accepts existing session', async () => {
  const c = client();
  c.login = async () => { throw new Error('unnecessary login'); };
  const r = await c.ensureSession({ username: 'example', password: 'secret' });
  assert.equal(r.renewed, false); assert.equal(r.bankVerified, true);
});

test('expired session cannot renew as a different account', async () => {
  const c=client('expired');c.session={username:'first-account'};let logins=0;
  c.login=async()=>{logins++;return {loggedIn:true};};
  await assert.rejects(c.ensureSession({username:'second-account',password:'secret'}),error=>error.code==='SESSION_ACCOUNT_MISMATCH');
  assert.equal(logins,0);
});
test('expired session renews once; bank rejection does not trigger a loop', async () => {
  const c = client('expired'); let count = 0;
  c.login = async args => { count++; assert.equal(args.loginType, 'STATIC'); return { deviceVerificationRequired: false }; };
  const r = await c.ensureSession({ username: 'example', password: 'secret' });
  assert.equal(count, 1); assert.equal(r.renewed, true); assert.equal(r.bankVerified, true);
  c.login = async () => { count++; throw new ApiError('invalid credentials', 422, 1006); };
  await assert.rejects(c.ensureSession({ username: 'example', password: 'wrong' }), e => e.code === 1006);
  assert.equal(count, 2);
});
test('bank-revoked token reauthenticates once; transport failure does not login', async () => {
  const c = client(); let checks = 0, logins = 0;
  c.checkSession = async () => { if (++checks === 1) throw new ApiError('revoked', 401); return { bankVerified: true }; };
  c.login = async () => { logins++; return {}; };
  assert.equal((await c.ensureSession({ username: 'example', password: 'secret' })).renewed, true);
  assert.equal(logins, 1);
  c.checkSession = async () => { throw new ApiError('connection failed', 502); };
  await assert.rejects(c.ensureSession({ username: 'example', password: 'secret' }), e => e.status === 502);
  assert.equal(logins, 1);
});
test('OTP stays pending instead of relogging or sending another SMS', async () => {
  const c = client('otp_required');
  c.login = async () => { throw new Error('must not replace pending device session'); };
  const r = await c.ensureSession({ username: 'example', password: 'secret' });
  assert.equal(r.nextAction, 'otp_request'); assert.equal(r.bankVerified, false);
  const expired = client('expired');
  expired.login = async () => ({ deviceVerificationRequired: true });
  const pending = await expired.ensureSession({ username: 'example', password: 'secret' });
  assert.equal(pending.renewed, false); assert.equal(pending.reloginPerformed, true);
  assert.equal(pending.nextAction, 'otp_request');
});
