'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { MobilletClient } = require('../src/client');
const { createApp } = require('../server');

async function setup(t, transport) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'saman-http-'));
  const client = new MobilletClient({ dataDir: dir, fetchImpl: transport });
  const server = createApp(client, 'test-api-key').listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(async () => { await new Promise(resolve => server.close(resolve)); fs.rmSync(dir, { recursive: true, force: true }); });
  const call = async (route, body, extra = {}) => {
    const res = await fetch(`http://127.0.0.1:${server.address().port}${route}`, {
      method: body === undefined ? 'GET' : 'POST',
      headers: { 'x-api-key': 'test-api-key', ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
      body: body === undefined ? undefined : JSON.stringify(body), ...extra,
    });
    return { status: res.status, data: await res.json() };
  };
  return { client, call };
}
const ok = data => new Response(JSON.stringify({ status: { code: 0 }, ...data }));

test('service can complete login and device SMS entirely through HTTP', async t => {
  let smsRequests = 0;
  const peer = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  const { call } = await setup(t, async (url, opts) => {
    if (url.pathname === '/config') return ok({ ecPublicKey: peer.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
      publicKey: rsa.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') });
    if (url.pathname === '/user/login') return ok({ accessToken: 'test-token', trustedDevice: false,
      shouldChangePassword: false, tokenExpiration: Date.now() + 600000 });
    assert.equal(opts.headers.authorization, 'Bearer test-token');
    if (url.pathname === '/verification/generate-code') { smsRequests++; return ok({ expiration: 120 }); }
    if (url.pathname === '/user/verify-mobile') {
      assert.equal(JSON.parse(opts.body).verificationCode, '123456'); return ok({ mobileNumber: 'example' });
    }
    assert.equal(url.pathname, '/user/'); return ok({ userInfo: { fullName: 'Example' } });
  });
  const login = await call('/v1/auth/login', { username: 'example', password: 'example-pass' });
  assert.equal(login.status, 200); assert.equal(login.data.state, 'otp_required');
  assert.equal(login.data.bankVerified, false);
  assert.equal(login.data.otpRequired, true); assert.equal(login.data.otpSent, true);
  assert.equal(login.data.nextAction, 'verify_otp'); assert.equal(smsRequests, 1);
  assert.equal(Object.hasOwn(login.data, 'accessToken'), false);
  assert.equal((await call('/v1/auth/otp/request', {})).data.expiration, 120);
  assert.equal(smsRequests, 2); // Explicit resend remains supported for old consumers.
  const verified = await call('/v1/auth/otp', { code: '۱۲۳۴۵۶' });
  assert.equal(verified.data.bankVerified, true); assert.equal(verified.data.state, 'authenticated');
  assert.equal((await call('/v1/auth/logout', {})).status, 200);
  assert.equal((await call('/v1/auth/session')).data.state, 'logged_out');
});

test('transactions never returns deposit collection or silently selects another account', async t => {
  let badResponse = false;
  const { client, call } = await setup(t, async url => {
    if (url.pathname === '/account/deposits') return ok({ deposits: [{ number: '12345' }, { number: '67890' }] });
    assert.equal(url.pathname, '/transactions');
    assert.equal(url.searchParams.get('depositNumber'), '12345');
    return badResponse ? ok({ deposits: [{ number: 'wrong' }] }) : ok({ elements: [{ id: 'row', amount: 1 }], deposits: [{ number: 'wrong' }], hasNext: false });
  });
  client.session.accessToken = 'test-token';
  assert.equal((await call('/v1/transactions')).status, 400);
  const result = await call('/v1/transactions?depositNumber=12345&details=false');
  assert.equal(result.status, 200); assert.equal(result.data.elements.length, 1);
  assert.equal(Object.hasOwn(result.data, 'deposits'), false);
  badResponse = true;
  assert.equal((await call('/v1/transactions?depositNumber=12345')).status, 502);
  assert.equal((await call('/v1/transactions?account=12345&details=false&unknown=1')).status, 400);
});

test('expired sessions, favorite flags, malformed JSON and missing routes are accurate', async t => {
  const { client, call } = await setup(t, async () => ok({ deposits: [
    { number: '12345', isFavorite: false, favorite: true }, { number: '67890', isFavorite: true },
  ] }));
  client.session = { deviceUid: 'example', accessToken: 'test', expiresAt: Date.now() - 1000 };
  assert.equal((await call('/v1/auth/session')).data.loggedIn, false);
  assert.equal((await call('/v1/auth/session')).data.state, 'expired');
  assert.equal((await call('/v1/deposits')).status, 401);
  client.session.expiresAt = Date.now() + 60000;
  assert.deepEqual((await call('/v1/deposits/favorites')).data.deposits.map(d => d.number), ['67890']);
  assert.equal((await call('/v1/auth/login', [])).status, 400);
  assert.equal((await call('/v1/auth/login', {}, { body: '{' })).status, 400);
  assert.equal((await call('/v1/not-a-route')).status, 404);
  const spec = await call('/v1/openapi.json');
  assert.equal(spec.data.openapi, '3.1.0');
  assert.equal(spec.data.servers[0].url, '/v1');
  assert.ok(spec.data.paths['/transactions'].get.parameters.find(p => p.name === 'depositNumber'));
  assert.equal((await call('/cards', undefined, { headers: {} })).status, 401);
});

test('bank logical errors preserve the bank status instead of pretending success', async t => {
  const { client, call } = await setup(t, async () => new Response(JSON.stringify({ status: { code: -500, message: 'Example bank failure', name: 'FAILURE' } })));
  client.session.accessToken = 'test-token';
  const result = await call('/v1/deposits');
  assert.equal(result.status, 422);
  assert.equal(result.data.code, -500);
  assert.equal(result.data.bankStatus.name, 'FAILURE');
});

test('versioned find route resolves exact tracking number and returns bank detail', async t => {
  const { client, call } = await setup(t, async url => {
    if (url.pathname === '/account/deposits') return ok({ deposits: [{ number: '12345' }] });
    if (url.pathname === '/transactions') return ok({ elements: [{ id: 'example-row' }], hasNext: false });
    assert.equal(url.pathname, '/transactions/example-row');
    return ok({ amount: 1000, isWithdrawal: false, description: 'Example', paymentNumber: '000123',
      otherSideAccountInfo: { name: 'Example sender' } });
  });
  client.session.accessToken = 'test-token';
  const result = await call('/v1/transactions/find/000123?depositNumber=12345&pages=1');
  assert.equal(result.status, 200); assert.equal(result.data.found, true);
  assert.equal(result.data.matchedField, 'paymentNumber');
  assert.equal(result.data.transaction.otherSideAccountInfo.name, 'Example sender');
  const missing = await call('/v1/transactions/find/999?depositNumber=12345');
  assert.equal(missing.data.found, false); assert.equal(missing.data.searchComplete, true);
  const invalidDeposit = await call('/v1/transactions/find/000123?depositNumber=99999');
  assert.equal(invalidDeposit.status, 400);
  assert.equal(invalidDeposit.data.code, 'INVALID_DEPOSIT_NUMBER');
});

test('latest history uses page zero and never routes latest as a transaction id', async t => {
  const bankCalls = [];
  const { client, call } = await setup(t, async url => {
    bankCalls.push(url.pathname);
    if (url.pathname === '/account/deposits') return ok({ deposits: [{ number: '123-456-0000001-2' }] });
    assert.equal(url.pathname, '/transactions');
    assert.equal(url.searchParams.get('page'), '0');
    assert.equal(url.searchParams.get('size'), '2');
    assert.equal(url.searchParams.get('depositNumber'), '123-456-0000001-2');
    return ok({ elements: [{ id: 'newer', longDate: 200 }, { id: 'older', longDate: 100 }], hasNext: true });
  });
  client.session.accessToken = 'test-token';
  const r = await call('/v1/transactions/latest?depositNumber=12345600000012&limit=2&details=false');
  assert.equal(r.status, 200); assert.equal(r.data.page, 0); assert.equal(r.data.limit, 2);
  assert.deepEqual(r.data.elements.map(row => row.id), ['newer', 'older']);
  assert.equal(bankCalls.includes('/transactions/latest'), false);
  assert.equal((await call('/v1/transactions/latest?limit=0')).status, 400);
  assert.equal((await call('/v1/transactions/latest?limit=2&size=3')).status, 400);
  assert.equal((await call('/v1/transactions/latest?page=1')).status, 400);
});

test('HTTP HAR import accepts raw capture larger than 32KB without bank calls or file-path access', async t => {
  const { client, call } = await setup(t, async () => { throw new Error('import must not contact bank'); });
  const har = { log: { entries: [{ request: { method: 'GET', url: 'https://mobillet.sb24.com/account/deposits', headers: [
    { name: 'authorization', value: 'Bearer imported-test-token' }, { name: 'deviceUid', value: 'example-device' },
  ], postData: { text: 'secret-password-not-to-store' } }, response: { status: 200, content: {
    text: JSON.stringify({ status: { code: 0 }, deposits: [] }),
  } }, comment: 'x'.repeat(35000) }] } };
  const r = await call('/v1/auth/import-har', har);
  assert.equal(r.status, 200); assert.equal(r.data.imported, true); assert.equal(r.data.liveVerified, false);
  assert.equal(client.session.accessToken, 'imported-test-token');
  assert.equal(fs.readFileSync(client.file, 'utf8').includes('secret-password-not-to-store'), false);
  assert.equal(Object.hasOwn(r.data, 'accessToken'), false);
  assert.equal((await call('/v1/auth/import-har', { path: 'data/file.har' })).status, 400);
  assert.equal((await call('/v1/auth/login', { comment: 'x'.repeat(35000) })).status, 413);
});

test('HTTP session ensure renews an expired session once and exposes balance/full-list routes', async t => {
  const peer = crypto.generateKeyPairSync('ec', { namedCurve: 'secp384r1' });
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  let loginCount = 0;
  const { client, call } = await setup(t, async (url, opts) => {
    if (url.pathname === '/config') return ok({ ecPublicKey: peer.publicKey.export({ type: 'spki', format: 'der' }).toString('base64'),
      publicKey: rsa.publicKey.export({ type: 'spki', format: 'der' }).toString('base64') });
    if (url.pathname === '/user/login') {
      loginCount++; return ok({ accessToken: 'new-test-token', trustedDevice: true,
        shouldChangePassword: false, tokenExpiration: Date.now() + 600000 });
    }
    assert.equal(opts.headers.authorization, 'Bearer new-test-token');
    if (url.pathname === '/user/') return ok({ userInfo: {} });
    if (url.pathname === '/account/deposits') return ok({ deposits: [{ id: 1, number: '12345', balance: 0, currency: 'IRR', extraDepositField: true }] });
    assert.equal(url.pathname, '/account/cards');
    return ok({ cards: [{ id: 2, pan: '1111222233334444', currency: 'IRR', extraCardField: true }] });
  });
  client.session.accessToken = 'expired'; client.session.expiresAt = Date.now() - 1;
  const renewed = await call('/v1/auth/session/ensure', { username: 'example', password: 'secret-not-saved' });
  assert.equal(renewed.status, 200); assert.equal(renewed.data.renewed, true);
  assert.equal(renewed.data.bankVerified, true); assert.equal(loginCount, 1);
  assert.equal((await call('/v1/auth/session/ensure', {})).data.renewed, false);
  assert.equal(loginCount, 1);
  const balance = await call('/v1/balance');
  assert.equal(balance.data.deposits[0].balance, 0);
  assert.equal(balance.data.cards[0].balance, null);
  assert.equal(balance.data.cards[0].balanceAvailable, false);
  assert.equal((await call('/v1/cards/all')).data.cards[0].extraCardField, true);
  assert.equal((await call('/v1/deposits/all')).data.deposits[0].extraDepositField, true);
  assert.equal(fs.readFileSync(client.file, 'utf8').includes('secret-not-saved'), false);
});

test('digital rial HTTP forwards list filters and wallet history without deposit-detail routing', async t => {
  const walletId = '00000000-0000-4000-8000-000000000001';
  const { client, call } = await setup(t, async url => {
    if (url.pathname === '/digital-rial/wallet') {
      assert.deepEqual(url.searchParams.getAll('walletStates'), ['NORMAL', 'BAN']);
      assert.deepEqual(url.searchParams.getAll('walletTypes'), ['CUSTOMER', 'BUSINESS']);
      return ok({ wallets: { elements: [{ walletId, balance: 0 }], hasNext: false }, hasCustomerWallet: true });
    }
    assert.equal(url.pathname, '/digital-rial/wallet/transactions/' + walletId);
    return ok({ elements: [{ transactionId: 'wallet-tx', amount: 1000, title: 'Example', isWithdrawal: false }], hasNext: false });
  });
  client.session.accessToken = 'test-token';
  const list = await call('/v1/digital-rial/wallets?walletStates=NORMAL&walletStates=BAN&walletTypes=CUSTOMER&walletTypes=BUSINESS');
  assert.equal(list.status, 200); assert.equal(list.data.wallets.elements[0].balance, 0);
  const history = await call('/v1/digital-rial/wallets/' + walletId + '/transactions?page=0&size=10');
  assert.equal(history.status, 200); assert.equal(history.data.elements[0].transactionId, 'wallet-tx');
  assert.equal((await call('/v1/digital-rial/wallets', { verificationCode: 'bad' })).status, 400);
});

test('recent deposit/card/IBAN aliases retain every bank field and require an amount', async t => {
  const { client, call } = await setup(t, async (url, opts) => {
    assert.equal(opts.headers.amount, '1000');
    const kind = url.pathname.split('/').at(-1);
    assert.ok(['deposit', 'card', 'iban'].includes(kind));
    return ok({ kind, isOverLimit: false, userSelfContact: { deposits: [{ number: '12345' }] },
      restrictions: { DEPOSIT: { max: 1000000, minOtpTicketAmount: 100 } },
      mostReferredDeposits: [{ deposit: { number: '123-456-0000001-2', extraField: true }, user: { fullName: 'Example' } }] });
  });
  client.session.accessToken = 'test-token';
  for (const [route, kind] of [['deposits', 'deposit'], ['cards', 'card'], ['ibans', 'iban']]) {
    const r = await call('/v1/' + route + '/recent?amount=1000');
    assert.equal(r.status, 200); assert.equal(r.data.kind, kind);
    assert.equal(r.data.mostReferredDeposits[0].deposit.extraField, true);
    assert.equal(r.data.restrictions.DEPOSIT.minOtpTicketAmount, 100);
    assert.equal((await call('/v1/' + route + '/recent')).status, 400);
  }
});
