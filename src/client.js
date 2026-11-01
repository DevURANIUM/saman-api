'use strict';
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');

const { ApiError } = require('./errors');
const { transactionQuery } = require('./transactions');
const { cardPair, cardTransfer, depositNumber, ibanNumber, bankTransfer } = require('./transfer');
const { expiresAt } = require('./session-state');
const balanceViews = require('./balances');
const digitalRial = require('./digital-rial');

// Matches tools-vendor-BOk8DRjs.js: P-384 ECDH, RSA PKCS#1 v1.5
// over plaintext concatenated with the base64 shared secret.
function seal(value, publicKey, secret) {
  const key = crypto.createPublicKey({
    key: Buffer.from(publicKey, 'base64'), format: 'der', type: 'spki',
  });
  return crypto.publicEncrypt({ key, padding: crypto.constants.RSA_PKCS1_PADDING },
    Buffer.from(String(value) + secret, 'utf8')).toString('base64');
}

class MobilletClient {
  constructor({ fetchImpl = fetch, dataDir = process.env.SAMAN_DATA_DIR || path.join(__dirname, '..', 'data'),
    baseUrl = 'https://mobillet.sb24.com/' } = {}) {
    this.fetch = fetchImpl;
    this.baseUrl = baseUrl;
    this.file = path.join(dataDir, 'session.json');
    this.version = '5.8.2';
    this.cookies = new Map();
    try { this.session = JSON.parse(fs.readFileSync(this.file, 'utf8')); }
    catch (e) { if (e.code !== 'ENOENT') throw e; this.session = { deviceUid: crypto.randomUUID() }; }
    for (const [k, v] of Object.entries(this.session.cookies || {})) this.cookies.set(k, v);
    this.secret = this.session.encryption?.secret;
    this.rsaPublicKey = this.session.encryption?.publicKey;
  }

  save() {
    this.session.cookies = Object.fromEntries(this.cookies);
    fs.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 });
    const tmp = this.file + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(this.session, null, 2), { mode: 0o600 });
    fs.renameSync(tmp, this.file);
  }

  status() {
    const expiry = expiresAt(this.session);
    const expired = expiry !== null && expiry <= Date.now();
    const state = !this.session.accessToken ? 'logged_out' : expired ? 'expired'
      : this.session.trustedDevice === false ? 'otp_required'
      : this.session.shouldChangePassword ? 'password_change_required'
      : this.session.trustedDevice === true ? 'authenticated' : 'unverified';
    return { loggedIn: Boolean(this.session.accessToken) && !expired && this.session.trustedDevice !== false && !this.session.shouldChangePassword,
      hasToken: Boolean(this.session.accessToken), deviceUid: this.session.deviceUid,
      state, expiresAt: expiry, expiresIn: expiry === null ? null : Math.max(0, Math.floor((expiry - Date.now()) / 1000)),
      trustedDevice: this.session.trustedDevice ?? null,
      shouldChangePassword: this.session.shouldChangePassword ?? false };
  }

  async request(route, { method = 'GET', body, query, headers = {}, auth = true } = {}) {
    if (auth && (!this.session.accessToken || this.status().state === 'expired')) throw new ApiError('login required: session missing or expired', 401);
    const url = new URL(route, this.baseUrl);
    if (url.origin !== new URL(this.baseUrl).origin) throw new ApiError('invalid upstream route', 400);
    for (const [k, v] of Object.entries(query || {})) {
      if (v !== undefined && v !== null) for (const item of Array.isArray(v) ? v : [v]) url.searchParams.append(k, item);
    }
    const requestHeaders = { accept: 'application/json', 'accept-language': 'fa-IR',
      origin: 'https://app.sb24.com', referer: 'https://app.sb24.com/',
      appVersion: this.session.appVersion || '5080200000', platform: 'PWA', deviceUid: this.session.deviceUid, ...headers };
    if (body !== undefined) requestHeaders['content-type'] = 'application/json';
    if (auth) requestHeaders.authorization = 'Bearer ' + this.session.accessToken;
    if (this.cookies.size) requestHeaders.cookie = [...this.cookies].map(([k,v]) => `${k}=${v}`).join('; ');
    let res;
    try {
      res = await this.fetch(url, { method, headers: requestHeaders,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(30000), redirect: 'error' });
    } catch { throw new ApiError('bank connection failed or timed out', 502); }
    for (const cookie of res.headers.getSetCookie()) {
      const pair = cookie.split(';', 1)[0]; const at = pair.indexOf('=');
      if (at > 0) {
        const name = pair.slice(0, at), value = pair.slice(at + 1);
        if (!value || /(?:^|;)\s*max-age=0(?:;|$)/i.test(cookie)) this.cookies.delete(name);
        else this.cookies.set(name, value);
      }
    }
    this.save();
    let data;
    try { data = await res.json(); } catch { throw new ApiError('bank returned a non-JSON response', 502); }
    const code = data?.status?.code;
    if (typeof code !== 'number') throw new ApiError('bank response is missing numeric status.code', 502);
    if (code === 1403) {
      this.session.trustedDevice = false; this.save();
      throw new ApiError('device verification required: run otp-request, then otp', 403, code);
    }
    if ([-401, -412].includes(code) || res.status === 401) {
      delete this.session.accessToken; this.save();
      throw new ApiError('bank requires login or device verification', 401, code);
    }
    if (!res.ok || code !== 0) {
      const error = new ApiError(data?.status?.message || 'bank rejected request', res.ok ? 422 : 502, code);
      error.bankStatus = data?.status;
      throw error;
    }
    return data;
  }

  async configure() {
    const { privateKey, publicKey } = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
    const data = await this.request('config', { auth: false, headers: {
      ecPublicKey: publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
    } });
    if (!data.ecPublicKey || !data.publicKey) throw new ApiError('config is missing encryption keys');
    const peer = crypto.createPublicKey({ key: Buffer.from(data.ecPublicKey, 'base64'), format: 'der', type: 'spki' });
    this.secret = crypto.diffieHellman({ privateKey, publicKey: peer }).toString('base64');
    this.rsaPublicKey = data.publicKey;
    this.session.encryption = { secret: this.secret, publicKey: this.rsaPublicKey };
    this.save();
    return { configured: true, appVersion: this.version };
  }

  async login({ username, password, loginType = 'STATIC' }) {
    if (typeof username !== 'string' || typeof password !== 'string' || !username || !password)
      throw new ApiError('username and password are required', 400);
    if (!['STATIC', 'OTP1'].includes(loginType)) throw new ApiError('invalid loginType', 400);
    const normalize = value => value.replace(/[\u06f0-\u06f9\u0660-\u0669]/g, d => String('\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.includes(d)
      ? '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.indexOf(d) : '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(d)));
    // Clear any previous account before starting a new authentication flow.
    delete this.session.accessToken;
    delete this.session.trustedDevice;
    delete this.session.shouldChangePassword;
    delete this.session.expiresAt;
    delete this.session.loginOtp;
    this.session.username = normalize(username);
    this.save();
    await this.configure();
    const data = await this.request('user/login', { method: 'POST', auth: false, body: {
      username: normalize(username), password: seal(normalize(password), this.rsaPublicKey, this.secret),
      loginType, appVersion: this.version,
      deviceInfo: { brandModel: '', os: 'Windows', osVersion: '10', brand: '',
        ...this.session.deviceInfo, deviceUid: this.session.deviceUid,
        appVersion: this.version, platform: 'PWA' },
    } });
    if (typeof data.accessToken !== 'string' || !data.accessToken) throw new ApiError('login returned no access token');
    this.session.accessToken = data.accessToken;
    this.session.trustedDevice = data.trustedDevice;
    this.session.shouldChangePassword = data.shouldChangePassword;
    if (Number.isFinite(data.tokenExpiration)) this.session.expiresAt = data.tokenExpiration;
    this.session.source = 'direct-login';
    this.session.loggedInAt = new Date().toISOString();
    this.save();
    return { ...this.status(), deviceVerificationRequired: data.trustedDevice === false };
  }

  async transactions(query = {}) {
    const { details = true, ...params } = transactionQuery(query);
    params.depositNumber = await this.resolveDepositNumber(params.depositNumber);
    const data = await this.request('transactions', { query: params });
    if (!Array.isArray(data.elements)) throw new ApiError('unexpected bank transaction response: elements array is missing', 502);
    // The history endpoint must not return unrelated deposit/card collections.
    const { deposits: _deposits, cards: _cards, categorizeDeposits: _categories, ...history } = data;
    if (!details) return history;
    // Preserve both complete bank responses. Fetch sequentially to avoid a
    // burst of detail requests; never infer counterparty data from free text.
    const elements = [];
    for (const row of data.elements) {
      if (!row.id) {
        elements.push({ ...row, detail: null, detailError: { message: 'bank returned no transaction id' } });
        continue;
      }
      try {
        elements.push({ ...row, detail: await this.transactionDetail(String(row.id)) });
      } catch (e) {
        if (!(e instanceof ApiError) || e.status === 401 || e.status === 403) throw e;
        elements.push({ ...row, detail: null, detailError: { message: e.message, status: e.status, code: e.code } });
      }
    }
    return { ...history, elements };
  }

  async resolveDepositNumber(number, { verify = false } = {}) {
    if (number && !verify) return number;
    const data = await this.accounts();
    const deposits = data.deposits.filter(item => item.number);
    if (number) {
      const selected = deposits.find(item => item.number === number || item.number.replace(/-/g, '') === number.replace(/-/g, ''));
      if (!selected) throw new ApiError('depositNumber does not match your deposits. The tracking/reference number goes first; specify the deposit with --account in CLI.', 400, 'INVALID_DEPOSIT_NUMBER');
      return selected.number;
    }
    if (deposits.length > 1) throw new ApiError('depositNumber is required when multiple deposits exist; select one using GET /v1/deposits', 400);
    if (!deposits.length) throw new ApiError('no deposit found; specify depositNumber', 422);
    return deposits[0].number;
  }
  findTransaction(code, options) {
    return require('./find-transaction').findTransaction(this, code, options);
  }
  async latestTransactions(input = {}) {
    for (const key of Object.keys(input))
      if (!['depositNumber', 'account', 'limit', 'size', 'details'].includes(key)) throw new ApiError('unsupported latest transaction parameter: ' + key, 400);
    if (input.limit !== undefined && input.size !== undefined && String(input.limit) !== String(input.size))
      throw new ApiError('limit and size must match', 400);
    const { limit, ...filters } = input;
    const params = transactionQuery({ ...filters, size: limit ?? filters.size ?? 10, page: 0 });
    params.depositNumber = await this.resolveDepositNumber(params.depositNumber, { verify: true });
    const data = await this.transactions(params);
    return { ...data, depositNumber: params.depositNumber, page: 0, limit: params.size };
  }

  async accounts() {
    const data = await this.request('account/deposits');
    if (!Array.isArray(data.deposits)) throw new ApiError('unexpected bank deposits response', 502);
    return data;
  }
  async cards() {
    const data = await this.request('account/cards');
    if (!Array.isArray(data.cards)) throw new ApiError('unexpected bank cards response', 502);
    return data;
  }
  async depositBalances() { return balanceViews.deposits(await this.accounts()); }
  async cardBalances() { return balanceViews.cards(await this.cards()); }
  async balances() {
    const deposits = await this.depositBalances();
    const cards = await this.cardBalances();
    // A card may refer to an already-listed deposit. Do not sum both lists.
    return { deposits: deposits.deposits, cards: cards.cards };
  }
  async favoriteDeposits() {
    const data = await this.accounts();
    return { ...data, deposits: data.deposits.filter(d => typeof d.isFavorite === 'boolean' ? d.isFavorite : d.favorite === true) };
  }
  samanium() { return this.request('clubs'); }
  digitalRialWallets(query = {}) { return this.request('digital-rial/wallet', { query: digitalRial.walletsQuery(query) }); }
  validateDigitalRial(input = {}) {
    return this.request('digital-rial/wallet/validate', { method: 'POST', body: { walletType: digitalRial.customerType(input) } });
  }
  requestDigitalRialOtp() {
    return this.request('verification/generate-code', { method: 'POST', body: { reason: 'DIGITAL_RIAL' } });
  }
  activateDigitalRial(input = {}) {
    return this.request('digital-rial/wallet', { method: 'POST', body: digitalRial.activation(input) });
  }
  digitalRialBalance(walletId) { return this.request('digital-rial/wallet/balance/' + digitalRial.uuid(walletId)); }
  digitalRialTransactions(walletId, query = {}) {
    return this.request('digital-rial/wallet/transactions/' + digitalRial.uuid(walletId), { query: digitalRial.pagination(query) });
  }
  digitalRialTransactionDetail(id) {
    if (!['string', 'number'].includes(typeof id) || !/^\d{1,40}$/.test(String(id)) || (typeof id === 'number' && !Number.isSafeInteger(id)))
      throw new ApiError('invalid digital rial transactionId', 400);
    return this.request('digital-rial/wallet/transaction-detail/' + encodeURIComponent(String(id)));
  }
  async deactivateDigitalRial(walletId, input = {}) {
    digitalRial.allowed(input, ['requestId', 'depositNumber']);
    const body = { walletId: digitalRial.uuid(walletId), requestId: digitalRial.requestId(input) };
    if (input.depositNumber !== undefined) {
      const number = depositNumber(input.depositNumber);
      if (!this.session?.accessToken) throw new ApiError('login required', 401);
      if (!this.secret || !this.rsaPublicKey) await this.configure();
      body.depositNumber = seal(number, this.rsaPublicKey, this.secret);
    }
    return this.request('digital-rial/wallet/de-activate', { method: 'POST', body });
  }
  chargeDigitalRial(walletId, input = {}) {
    return this.request('digital-rial/wallet/charge', { method: 'POST', body: digitalRial.movement(walletId, input) });
  }
  async dischargeDigitalRial(walletId, input = {}) {
    const body = digitalRial.movement(walletId, input);
    if (!this.session?.accessToken) throw new ApiError('login required', 401);
    if (!this.secret || !this.rsaPublicKey) await this.configure();
    body.depositNumber = seal(body.depositNumber, this.rsaPublicKey, this.secret);
    return this.request('digital-rial/wallet/discharge', { method: 'POST', body });
  }
  digitalRialContacts(query = {}) {
    digitalRial.allowed(query, ['size']);
    return this.request('most-referreds', { query: { type: 'WALLET', size: digitalRial.integer(query.size, 120, 1, 1000, 'size') } });
  }
  institutions(query = {}) { return this.request('institution/list', { method: 'POST', body: digitalRial.institutions(query) }); }
  merchantTerminals() { return this.request('merchant/terminals'); }
  merchantSummary(terminalId, fromDate = Date.now() - 30 * 86400000) {
    if (!['string', 'number'].includes(typeof terminalId) || !/^[\w-]{1,100}$/.test(String(terminalId))) throw new ApiError('invalid terminalId', 400);
    if (!/^\d{13}$/.test(String(fromDate))) throw new ApiError('fromDate must be Unix milliseconds', 400);
    return this.request('merchant/summary', { headers: { terminalId: String(terminalId), fromDate: String(fromDate) } });
  }
  cardOwner(input) {
    const { source, destination } = cardPair(input);
    return this.request('cards/owner', { method: 'POST', body: { sourcePan: source, destinationPan: destination } });
  }
  depositOwner(number) {
    return this.request('transfer/destination/deposit', { headers: { number: depositNumber(number) } });
  }
  ibanOwner(iban) {
    return this.request('transfer/destination/iban', { headers: { iban: ibanNumber(iban) } });
  }
  transferReasons() { return this.request('paya/reasons/transfer'); }
  recentTransferDestinations(kind, amount) {
    if (!['deposit', 'iban', 'card'].includes(kind)) throw new ApiError('invalid destination kind', 400);
    if (!/^\d+$/.test(String(amount)) || !Number.isSafeInteger(Number(amount)) || Number(amount) <= 0) throw new ApiError('positive amount in IRR required', 400);
    return this.request('transfer/recent/' + kind, { headers: { amount: String(amount) } });
  }
  transferDeposit(input) { return this._transferBank(input, 'DEPOSIT'); }
  transferIban(input) { return this._transferBank(input, 'PAYA'); }
  async _transferBank(input, method) {
    const data = bankTransfer(input, method);
    if (!this.session.accessToken) throw new ApiError('login required', 401);
    const account = number => ({ number, type: method, transferType: method });
    const body = { amount: data.amount, currency: 'IRR',
      sourceAccount: account(data.source), destinationAccount: account(data.destination),
      isMostReferredDestination: input.isMostReferredDestination === true, trackerId: input.trackerId || crypto.randomUUID(),
      userDescription: input.description || '' };
    if (method === 'PAYA') {
      const reasons = await this.transferReasons();
      const reason = reasons.reasons?.find(r => r.code === input.reasonCode);
      if (!reason) throw new ApiError('reasonCode is not offered by the bank', 400);
      body.ibanTransferReasonCode = reason.code;
      body.ibanTransferReasonDescription = reason.description;
    }
    if (data.transactionPin) {
      if (!this.secret || !this.rsaPublicKey) await this.configure();
      body.transactionPin = seal(data.transactionPin, this.rsaPublicKey, this.secret);
    }
    return this.request('transfer/', { method: 'POST', body });
  }
  requestTransferOtp(input) {
    const { source, destination, amount } = cardTransfer(input);
    return this.request('account/card/generateOTP', { method: 'POST', body: {
      amount, channel: 'SMS', currency: '\u0631\u06cc\u0627\u0644', destination, pan: source, transferType: 'CARD',
    } });
  }
  async transferCard(input) {
    const data = cardTransfer(input, true);
    if (!this.session.accessToken) throw new ApiError('login required', 401);
    if (!this.secret || !this.rsaPublicKey) await this.configure();
    const account = number => ({ number, type: 'CARD', transferType: 'CARD' });
    const body = { amount: data.amount, currency: 'IRR',
      sourceAccount: account(data.source), destinationAccount: account(data.destination),
      isMostReferredDestination: input.isMostReferredDestination === true, trackerId: input.trackerId || crypto.randomUUID(),
      userDescription: input.description || '', expireDate: data.expireDate,
      cvv2: seal(data.cvv2, this.rsaPublicKey, this.secret),
      pin2: seal(data.pin2, this.rsaPublicKey, this.secret),
    };
    if (data.transactionPin) body.transactionPin = seal(data.transactionPin, this.rsaPublicKey, this.secret);
    // One submission only. A timeout may mean the bank completed the transfer.
    return this.request('transfer/', { method: 'POST', body });
  }
  async transactionDetail(id) {
    if (typeof id !== 'string' || !id.trim()) throw new ApiError('transaction id required', 400);
    const data = await this.request('transactions/' + encodeURIComponent(id));
    if (typeof data.isWithdrawal !== 'boolean' || !Object.hasOwn(data, 'amount'))
      throw new ApiError('unexpected bank transaction detail response', 502);
    return data;
  }

  async checkSession() {
    await this.request('user/');
    return { ...this.status(), bankVerified: true };
  }

  async ensureSession(input = {}) {
    if (input === null || typeof input !== 'object' || Array.isArray(input)) throw new ApiError('session options must be an object', 400);
    for (const key of Object.keys(input)) if (!['username', 'password'].includes(key)) throw new ApiError('unsupported session option: ' + key, 400);
    for (const key of ['username', 'password']) if (input[key] !== undefined && (typeof input[key] !== 'string' || !input[key])) throw new ApiError('invalid ' + key, 400);
    let state = this.status();
    if (state.hasToken && state.state !== 'expired') {
      if (state.trustedDevice === false) return { ...state, renewed: false, bankVerified: false, deviceVerificationRequired: true, nextAction: 'otp_request' };
      if (state.shouldChangePassword) return { ...state, renewed: false, bankVerified: false, nextAction: 'change_password_in_bank_app' };
      try { return { ...await this.checkSession(), renewed: false, nextAction: null }; }
      catch (error) {
        if (!(error instanceof ApiError)) throw error;
        if (error.status === 403 && error.code === 1403) return { ...this.status(), renewed: false, bankVerified: false, deviceVerificationRequired: true, nextAction: 'otp_request' };
        if (error.status !== 401) throw error;
      }
    }
    const username = input.username ?? process.env.SAMAN_USER;
    const password = input.password ?? process.env.SAMAN_PASS;
    if (!username || !password) return { ...this.status(), renewed: false, bankVerified: false,
      credentialsRequired: true, nextAction: 'login' };
    const normalizeUser = value => String(value).replace(/[\u06f0-\u06f9\u0660-\u0669]/g, d => String('\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.includes(d)
      ? '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.indexOf(d) : '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(d)));
    if (this.session?.username && normalizeUser(username) !== normalizeUser(this.session.username)
      || input.username === undefined && this.session?.source && !this.session.username) {
      throw new ApiError('session renewal cannot change the account; use login explicitly', 401, 'SESSION_ACCOUNT_MISMATCH');
    }
    const result = await this.login({ username, password, loginType: 'STATIC' });
    if (result.deviceVerificationRequired) return { ...result, renewed: false, reloginPerformed: true, bankVerified: false, nextAction: 'otp_request' };
    if (result.shouldChangePassword) return { ...result, renewed: false, reloginPerformed: true, bankVerified: false, nextAction: 'change_password_in_bank_app' };
    return { ...await this.checkSession(), renewed: true, nextAction: null };
  }

  async requestOtp() {
    const result = await this.request('verification/generate-code', {
      method: 'POST', body: { reason: 'VERIFY_MOBILE_NUMBER' },
    });
    this.session.loginOtp = { sentAt: Date.now() };
    this.save();
    return result;
  }

  async verifyOtp(code) {
    code = String(code || '').replace(/[\u06f0-\u06f9\u0660-\u0669]/g, d => String('\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.includes(d)
      ? '\u06f0\u06f1\u06f2\u06f3\u06f4\u06f5\u06f6\u06f7\u06f8\u06f9'.indexOf(d) : '\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669'.indexOf(d)));
    if (!/^\d{4,10}$/.test(code)) throw new ApiError('invalid code', 400);
    const data = await this.request('user/verify-mobile', { method: 'POST',
      body: { verificationCode: code, reason: 'VERIFY_MOBILE_NUMBER' } });
    this.session.trustedDevice = true;
    delete this.session.loginOtp;
    this.save();
    return data;
  }

  logout() {
    this.session = { deviceUid: this.session.deviceUid, deviceInfo: this.session.deviceInfo,
      appVersion: this.session.appVersion };
    this.cookies.clear(); this.secret = null; this.rsaPublicKey = null; this.save();
    return { ok: true, scope: 'local' };
  }
}

module.exports = { MobilletClient, ApiError, seal };
