'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MobilletClient } = require('../src/client');
const { bankTransfer, ibanNumber } = require('../src/transfer');
const { run } = require('../cli');
const bban = '0000000000000000000001';
const iban = 'IR' + String(98n - BigInt(bban + '182700') % 97n).padStart(2, '0') + bban;
const base = { source: '123-456-0000001-2', destination: '123-456-0000002-3', amount: 1000 };

test('bank identifiers preserve leading zeros and hyphens; IBAN checksum is checked', () => {
  assert.equal(bankTransfer(base, 'DEPOSIT').source, base.source);
  assert.equal(ibanNumber(' ' + iban.toLowerCase() + ' '), iban);
  assert.throws(() => ibanNumber('IR00' + bban), /checksum/);
  assert.throws(() => bankTransfer({ ...base, amount: '1e6' }, 'DEPOSIT'));
  assert.throws(() => bankTransfer({ ...base, destination: base.source }, 'DEPOSIT'));
});

test('deposit submission matches captured DEPOSIT schema and returns entire receipt', async () => {
  const client = Object.create(MobilletClient.prototype), calls = [];
  client.session = { accessToken: 'test' };
  const receipt = { receipt: { extraField: 'retained' }, transferDetail: { id: 1 }, status: { code: 0 } };
  client.request = async (...args) => { calls.push(args); return receipt; };
  assert.deepEqual(await client.transferDeposit(base), receipt);
  assert.equal(calls.length, 1);
  const [route, request] = calls[0];
  assert.equal(route, 'transfer/'); assert.equal(request.method, 'POST');
  assert.deepEqual(request.body.sourceAccount, { number: base.source, type: 'DEPOSIT', transferType: 'DEPOSIT' });
  assert.equal(request.body.destinationAccount.number, base.destination);
  assert.equal(Object.hasOwn(request.body, 'cvv2'), false);
});

test('PAYA reason description comes from the bank; no automatic transfer retries', async () => {
  const client = Object.create(MobilletClient.prototype), calls = [];
  client.session = { accessToken: 'test' };
  client.transferReasons = async () => ({ reasons: [{ code: 'GPAC', description: 'Bank supplied reason' }] });
  client.request = async (route, options) => {
    calls.push(options.body);
    assert.equal(options.body.sourceAccount.type, 'PAYA');
    assert.equal(options.body.destinationAccount.type, 'PAYA');
    assert.equal(options.body.ibanTransferReasonCode, 'GPAC');
    assert.equal(options.body.ibanTransferReasonDescription, 'Bank supplied reason');
    throw new Error('timeout');
  };
  await assert.rejects(client.transferIban({ ...base, destination: iban, reasonCode: 'GPAC' }), /timeout/);
  assert.equal(calls.length, 1);
  await assert.rejects(client.transferIban({ ...base, destination: iban, reasonCode: 'NONE' }), /not offered/);
  assert.equal(calls.length, 1);
});

test('CLI deposit transfer requires explicit confirmation before submission', async () => {
  let sent = false;
  const answers = ['', '', 'cancel'];
  await assert.rejects(run(['transfer-deposit', base.source, base.destination, '1000'], {
    client: { depositOwner: async () => ({ user: {} }), transferDeposit: async () => { sent = true; } },
    prompt: async () => answers.shift(), note() {}, out() {},
  }), /cancelled/);
  assert.equal(sent, false);
});
