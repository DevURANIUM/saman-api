'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { findTransaction } = require('../src/find-transaction');
const { ApiError } = require('../src/errors');
const { MobilletClient } = require('../src/client');

function bank(pages, details) {
  const calls = [];
  return { calls, resolveDepositNumber: async number => number || '12345',
    transactions: async q => { calls.push(['list', q]); return pages[q.page] || { elements: [], hasNext: false }; },
    transactionDetail: async id => { calls.push(['detail', id]); return details[id]; } };
}

test('find walks page zero onwards and returns complete first exact match', async () => {
  const detail = { paymentNumber: '000123', amount: 100, otherSideAccountInfo: { name: 'Example', number: '1111222233334444' }, futureField: 'retained' };
  const c = bank([{ elements: [{ id: 'one' }], hasNext: true }, { elements: [{ id: 'two' }], hasNext: false }],
    { one: { paymentNumber: '0001234', description: '000123 is a substring only' }, two: detail });
  const r = await findTransaction(c, '۰۰۰۱۲۳', { depositNumber: '12345', fromDate: 1700000000 });
  assert.equal(r.found, true); assert.equal(r.matchedField, 'paymentNumber');
  assert.equal(r.trackingNumber, '000123'); assert.equal(r.pagesScanned, 2);
  assert.equal(r.transactionsScanned, 2); assert.deepEqual(r.transaction, detail);
  assert.equal(c.calls[0][1].details, false); assert.equal(c.calls[0][1].fromDate, 1700000000);
});

test('reference matching is explicit and identifiers never lose leading zeros', async () => {
  const c = bank([{ elements: [{ id: 'row' }], hasNext: false }],
    { row: { referralNumber: '00123', paymentNumber: '456', newReceipt: { trackingCode: '00123' } } });
  assert.equal((await findTransaction(c, '123')).found, false);
  const r = await findTransaction(c, '00123', { matchBy: 'reference' });
  assert.equal(r.matchedField, 'referralNumber');
  assert.equal((await findTransaction(c, '456', { matchBy: 'reference' })).found, false);
});

test('not found distinguishes exhausted history from page/transaction budgets', async () => {
  const c = bank([{ elements: [{ id: 'a' }], hasNext: true }, { elements: [{ id: 'b' }], hasNext: false }],
    { a: { paymentNumber: '1' }, b: { paymentNumber: '2' } });
  const limited = await findTransaction(c, '9', { pages: 1 });
  assert.equal(limited.searchComplete, false); assert.equal(limited.stopReason, 'page_limit');
  const rowLimited = await findTransaction(c, '9', { maxTransactions: 1 });
  assert.equal(rowLimited.searchComplete, false); assert.equal(rowLimited.stopReason, 'transaction_limit');
  const complete = await findTransaction(c, '9');
  assert.equal(complete.searchComplete, true); assert.equal(complete.stopReason, 'end_of_history');
});

test('repeated pages are deduplicated and bank errors never become not-found', async () => {
  const c = bank([{ elements: [{ id: 'a' }], hasNext: true }, { elements: [{ id: 'a' }], hasNext: true }], { a: {} });
  assert.equal((await findTransaction(c, '1')).stopReason, 'repeated_page');
  assert.equal(c.calls.filter(x => x[0] === 'detail').length, 1);
  c.transactionDetail = async () => { throw new ApiError('expired', 401); };
  await assert.rejects(findTransaction(c, '1'), e => e.status === 401);
  await assert.rejects(findTransaction(c, 'invalid'), e => e.status === 400);
  await assert.rejects(findTransaction(c, '1', { pages: ['1'] }), e => e.status === 400);
});

test('search resolves canonical account format and rejects swapped inputs before requesting history', async () => {
  const c = Object.create(MobilletClient.prototype);
  c.accounts = async () => ({ deposits: [{ number: '123-456-0000001-2' }] });
  assert.equal(await c.resolveDepositNumber('12345600000012', { verify: true }), '123-456-0000001-2');
  c.transactions = async () => { throw new Error('history must not be requested for an invalid account'); };
  await assert.rejects(c.findTransaction('12345600000012', { depositNumber: '140508020000000000001' }),
    e => e.status === 400 && e.code === 'INVALID_DEPOSIT_NUMBER');
});
