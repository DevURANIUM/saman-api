'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { MobilletClient, ApiError } = require('../src/client');
const D = require('../src/digital-rial');
const { run } = require('../cli');
const walletId = '00000000-0000-4000-8000-000000000001';
const requestId = '00000000-0000-4000-8000-000000000002';
function mock() {
  const c = Object.create(MobilletClient.prototype), calls = [];
  c.request = async (...args) => { calls.push(args); return { status: { code: 0 }, futureBankField: true }; };
  return { c, calls };
}
test('wallet list retains repeated state/type parameters and independent history paging', async () => {
  const { c, calls } = mock();
  await c.digitalRialWallets({ page: '0', size: '1000', walletStates: ['NORMAL', 'BAN'], walletTypes: 'CUSTOMER,BUSINESS' });
  assert.deepEqual(calls[0], ['digital-rial/wallet', { query: { page: 0, size: 1000, walletStates: ['NORMAL', 'BAN'], walletTypes: ['CUSTOMER', 'BUSINESS'] } }]);
  await c.digitalRialTransactions(walletId, { page: '0', size: '10' });
  assert.deepEqual(calls[1], ['digital-rial/wallet/transactions/' + walletId, { query: { page: 0, size: 10 } }]);
  await c.digitalRialBalance(walletId);
  assert.equal(calls[2][0], 'digital-rial/wallet/balance/' + walletId);
});
test('activation eligibility, SMS and wallet creation remain distinct operations', async () => {
  const { c, calls } = mock();
  await c.validateDigitalRial(); await c.requestDigitalRialOtp();
  const r = await c.activateDigitalRial({ verificationCode: '۱۲۳۴۵۶' });
  assert.equal(r.futureBankField, true);
  assert.deepEqual(calls, [
    ['digital-rial/wallet/validate', { method: 'POST', body: { walletType: 'CUSTOMER' } }],
    ['verification/generate-code', { method: 'POST', body: { reason: 'DIGITAL_RIAL' } }],
    ['digital-rial/wallet', { method: 'POST', body: { verificationCode: '123456', walletType: 'CUSTOMER' } }],
  ]);
  assert.throws(() => c.activateDigitalRial({ verificationCode: '123456', walletType: 'BUSINESS' }), /CUSTOMER/);
});
test('charge/discharge/deactivate use captured body keys once and do not retry errors', async () => {
  const { c, calls } = mock();
  const keys = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  c.session = { accessToken: 'test-token' }; c.secret = 'example-shared-secret';
  c.rsaPublicKey = keys.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  const input = { amount: '1000', depositNumber: '123-456-0000001-2', requestId };
  await c.chargeDigitalRial(walletId, input); await c.dischargeDigitalRial(walletId, input);
  await c.deactivateDigitalRial(walletId, { requestId });
  assert.deepEqual(calls[0], ['digital-rial/wallet/charge', { method: 'POST', body: { amount: 1000, depositNumber: input.depositNumber, walletId, requestId } }]);
  assert.equal(calls[1][0], 'digital-rial/wallet/discharge');
  const encrypted = Buffer.from(calls[1][1].body.depositNumber, 'base64');
  assert.equal(encrypted.length, 256);
  const opened = crypto.privateDecrypt({ key: keys.privateKey, padding: crypto.constants.RSA_NO_PADDING }, encrypted);
  assert.equal(opened.subarray(opened.indexOf(0, 2) + 1).toString(), input.depositNumber + c.secret);
  assert.deepEqual(calls[2][1].body, { walletId, requestId });
  let submitted = 0;
  c.request = async () => { submitted++; throw new ApiError('timeout: outcome unknown', 502); };
  await assert.rejects(c.chargeDigitalRial(walletId, input));
  assert.equal(submitted, 1);
  assert.throws(() => c.chargeDigitalRial(walletId, { ...input, amount: 0 }), /amount/);
});
test('contacts and institutions follow recorded query/body, not guessed detail endpoints', async () => {
  const { c, calls } = mock();
  await c.digitalRialContacts(); await c.institutions({ title: 'Example', offset: '10' });
  assert.deepEqual(calls[0], ['most-referreds', { query: { type: 'WALLET', size: 120 } }]);
  assert.deepEqual(calls[1], ['institution/list', { method: 'POST', body: { length: 10, offset: 10, title: 'Example' } }]);
  assert.throws(() => D.pagination({ page: -1 }));
  assert.throws(() => D.walletsQuery({ walletStates: 'UNKNOWN' }));
  assert.throws(() => c.digitalRialBalance('../other'));
  await c.digitalRialTransactionDetail('1234');
  assert.equal(calls[2][0], 'digital-rial/wallet/transaction-detail/1234');
  assert.throws(() => c.digitalRialTransactionDetail('deposit-history-id'));
});
test('CLI cancellation never creates or deactivates a wallet or moves funds', async () => {
  const client = new Proxy({}, { get() { return () => { throw new Error('unexpected bank action'); }; } });
  const deps = { client, prompt: async () => 'cancel', note() {}, out() {} };
  await assert.rejects(run(['digital-rial-activate'], deps), /cancelled/);
  await assert.rejects(run(['digital-rial-deactivate', walletId], deps), /cancelled/);
  await assert.rejects(run(['digital-rial-charge', walletId, '123-456-0000001-2', '1000'], deps), /cancelled/);
});
