'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { MobilletClient } = require('../src/client');
const { ApiError } = require('../src/errors');
const { cardTransfer } = require('../src/transfer');
const { run } = require('../cli');
const sample = { source: '1111222233334444', destination: '5555666677778888', amount: 1000,
  expireDate: '140801', cvv2: '123', pin2: '123456' };

test('transfer validates source/destination and amount before any submission', () => {
  for (const data of [{ ...sample, amount: 0 }, { ...sample, amount: '1e6' },
    { ...sample, destination: sample.source }, { ...sample, cvv2: '' }, { ...sample, expireDate: '01' }])
    assert.throws(() => cardTransfer(data, true));
});

test('card transfer encrypts secrets and emits captured schema once without retry', async () => {
  const c = Object.create(MobilletClient.prototype);
  const rsa = crypto.generateKeyPairSync('rsa', { modulusLength: 2048 });
  c.session = { accessToken: 'test-token' }; c.secret = 'base64-secret';
  c.rsaPublicKey = rsa.publicKey.export({ type: 'spki', format: 'der' }).toString('base64');
  let calls = 0;
  const open = value => { const block = crypto.privateDecrypt({ key: rsa.privateKey,
    padding: crypto.constants.RSA_NO_PADDING }, Buffer.from(value, 'base64'));
    assert.equal(block[1], 2); return block.subarray(block.indexOf(0, 2) + 1).toString(); };
  c.request = async (route, opts) => {
    calls++; assert.equal(route, 'transfer/'); assert.equal(opts.method, 'POST');
    assert.deepEqual(opts.body.sourceAccount, { number: sample.source, type: 'CARD', transferType: 'CARD' });
    assert.equal(opts.body.currency, 'IRR');
    assert.equal(open(opts.body.cvv2), sample.cvv2 + c.secret);
    assert.equal(open(opts.body.pin2), sample.pin2 + c.secret);
    assert.match(opts.body.trackerId, /^[0-9a-f-]{36}$/);
    throw new ApiError('uncertain outcome', 502);
  };
  await assert.rejects(c.transferCard(sample), /uncertain outcome/);
  assert.equal(calls, 1);
});

test('SMS OTP and merchant summary use captured body and header contracts', async () => {
  const c = Object.create(MobilletClient.prototype), calls = [];
  c.request = async (...args) => { calls.push(args); return {}; };
  await c.requestTransferOtp(sample);
  assert.deepEqual(calls[0], ['account/card/generateOTP', { method: 'POST', body: {
    amount: 1000, channel: 'SMS', currency: 'ریال', destination: sample.destination,
    pan: sample.source, transferType: 'CARD',
  } }]);
  await c.merchantSummary('12345678', 1790109000000);
  assert.deepEqual(calls[1], ['merchant/summary', { headers: { terminalId: '12345678', fromDate: '1790109000000' } }]);
});

test('CLI cancellation never sends transfer or requests SMS', async () => {
  let submitted = false;
  await assert.rejects(run(['transfer-card', sample.source, sample.destination, '1000'], {
    client: { cardOwner: async () => ({ user: {}, bank: {} }), transferCard: async () => { submitted = true; } },
    prompt: async () => 'cancel', note() {}, out() {},
  }), /cancelled/);
  assert.equal(submitted, false);
});
