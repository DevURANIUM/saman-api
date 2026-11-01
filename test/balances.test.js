'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { MobilletClient } = require('../src/client');
test('balances keep reported currency and zero and do not fabricate missing card balances', async () => {
  const c = Object.create(MobilletClient.prototype);
  c.accounts = async () => ({ deposits: [{ id: 1, number: '123-456-0000001-2', balance: 0, currency: 'ریال', extra: { blocked: 10 } }] });
  c.cards = async () => ({ cards: [{ id: 2, pan: '1111222233334444', balance: '0', currency: 'IRR' },
    { id: 3, pan: '5555666677778888', currency: 'IRR', deposit: { number: '12345', extra: true }, extra: 'retained' }] });
  const data = await c.balances();
  assert.equal(data.deposits[0].balance, 0); assert.equal(data.deposits[0].balanceAvailable, true);
  assert.equal(data.deposits[0].currency, 'ریال');
  assert.equal(data.cards[0].balance, '0'); assert.equal(data.cards[0].balanceAvailable, true);
  assert.equal(data.cards[1].balance, null); assert.equal(data.cards[1].balanceAvailable, false);
  assert.deepEqual(data.deposits[0].extra, { blocked: 10 });
  assert.equal(data.deposits[0].number, '123-456-0000001-2');
  assert.deepEqual(data.cards[1].deposit, { number: '12345', extra: true });
  assert.equal(data.cards[1].extra, 'retained');
  assert.equal(Object.hasOwn(data, 'total'), false);
});
