'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MobilletClient } = require('../src/client');
const { transactionQuery } = require('../src/transactions');
const { run } = require('../cli');

test('captured zero-based pagination and epoch-second dates are retained', () => {
  assert.deepEqual(transactionQuery(), { page: 0, size: 10 });
  assert.deepEqual(transactionQuery({ page: '0', size: '10', fromDate: '1790109000', toDate: '1793478599', isWithdrawal: 'false' }),
    { page: 0, size: 10, fromDate: 1790109000, toDate: 1793478599, isWithdrawal: false });
  for (const input of [{ page: -1 }, { size: 0 }, { size: 101 }, { page: ['0'] },
    { fromDate: 2, toDate: 1 }, { isWithdrawal: 'maybe' }]) assert.throws(() => transactionQuery(input));
});

test('transaction filters reject invalid objects and reversed amounts without losing precision', () => {
  for (const input of [null, [], 'query', { fromAmount: '9007199254740993', toAmount: '9007199254740992' },
    { fromAmount: '1.11', toAmount: '1.1' }]) {
    assert.throws(() => transactionQuery(input), error => error.status === 400);
  }
  const input = { fromAmount: '9007199254740992.10', toAmount: '9007199254740992.11' };
  assert.deepEqual(transactionQuery(input), { page: 0, size: 10, ...input });
});

test('CLI forwards capture-compatible date filters and page zero', async () => {
  let actual;
  await run(['transactions', '123-456-0000001-2', '0', '10', '--from', '1790109000', '--to', '1793478599', '--withdrawal', 'false'], {
    client: { transactions: async q => { actual = q; return {}; } }, out() {},
  });
  assert.deepEqual(actual, { page: 0, size: 10, depositNumber: '123-456-0000001-2', fromDate: 1790109000, toDate: 1793478599, isWithdrawal: false });
});

test('default history includes first page; detail IDs stay opaque and are URL-encoded', async () => {
  const client = Object.create(MobilletClient.prototype), calls = [];
  client.request = async (route, opts) => {
    calls.push([route, opts]);
    if (route === 'account/deposits') return { deposits: [{ number: 'example' }] };
    return route === 'transactions' ? { elements: [], status: { code: 0 } } : { amount: 1, isWithdrawal: false, description: '' };
  };
  await client.transactions();
  assert.deepEqual(calls[1], ['transactions', { query: { page: 0, size: 10, depositNumber: 'example' } }]);
  await client.transactionDetail('example-818-1-2.0--3.0/a+b');
  assert.equal(calls[2][0], 'transactions/example-818-1-2.0--3.0%2Fa%2Bb');
});

test('full history preserves every bank detail field and summary skips detail requests', async () => {
  const client = Object.create(MobilletClient.prototype), calls = [];
  const detail = { amount: 10, isWithdrawal: false, description: '', referralNumber: '000123', paymentNumber: '0012',
    otherSideAccountInfo: { name: 'Example sender', number: '0000111122223333', extraBankField: 'preserved' },
    receipt: { contents: [{ title: 'Example', value: 'value' }] }, futureBankField: { nested: true } };
  client.request = async (route, opts) => {
    calls.push([route, opts]);
    return route === 'transactions' ? { elements: [{ id: 'opaque-id', amount: 10 }], hasNext: true } : detail;
  };
  const full = await client.transactions({ depositNumber: '12345', size: 1 });
  assert.deepEqual(full, { elements: [{ id: 'opaque-id', amount: 10, detail }], hasNext: true });
  assert.equal(calls.length, 2);
  calls.length = 0;
  const summary = await client.transactions({ depositNumber: '12345', details: 'false' });
  assert.equal(calls.length, 1);
  assert.equal(Object.hasOwn(calls[0][1].query, 'details'), false);
  assert.equal(Object.hasOwn(summary.elements[0], 'detail'), false);
});
