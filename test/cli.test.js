'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { run } = require('../cli');

test('interactive login hides secrets and completes device OTP in order', async () => {
  const calls = [], output = [], prompts = [];
  const answers = ['user', 'password', '123456'];
  const client = {
    async login(body) { calls.push(['login', body]); return { deviceVerificationRequired: true }; },
    async requestOtp() { calls.push(['requestOtp']); },
    async verifyOtp(code) { calls.push(['verifyOtp', code]); },
    status() { return { loggedIn: true, trustedDevice: true }; },
    async checkSession() { return { loggedIn: true, trustedDevice: true, bankVerified: true }; },
  };
  await run(['login'], { client, env: {}, note() {}, out: v => output.push(v),
    prompt: async (label, hidden) => { prompts.push([label, hidden]); return answers.shift(); } });
  assert.deepEqual(calls, [['login', { username: 'user', password: 'password' }], ['requestOtp'], ['verifyOtp', '123456']]);
  assert.equal(prompts[1][1], true); assert.equal(prompts[2][1], true);
  assert.deepEqual(output, [{ loggedIn: true, trustedDevice: true, bankVerified: true, ok: true, otpRequired: false, nextAction: null }]);
});

test('trusted login from environment does not request an OTP or prompt', async () => {
  let body;
  await run(['login'], { client: { login: async v => { body = v; return { loggedIn: true }; },
    checkSession: async () => ({ loggedIn: true, bankVerified: true }) },
    env: { SAMAN_USER: 'user', SAMAN_PASS: 'secret' }, out() {}, note() {},
    prompt() { throw new Error('unexpected prompt'); } });
  assert.deepEqual(body, { username: 'user', password: 'secret' });
});

test('transactions maps positional account and pagination to upstream query', async () => {
  let call;
  const deps = { client: { transactions: async query => { call = ['transactions', { query }]; return {}; } }, out() {} };
  await run(['transactions', '12345', '2', '50'], deps);
  assert.deepEqual(call, ['transactions', { query: { page: 2, size: 50, depositNumber: '12345' } }]);
  await assert.rejects(run(['transactions', '12345', '2', '101'], deps), /invalid size/);
});

test('missing identifiers and unknown commands fail without a bank request', async () => {
  const deps = { client: { request() { throw new Error('unexpected bank request'); } } };
  await assert.rejects(run(['transaction'], deps), /Usage:/);
  await assert.rejects(run(['iban'], deps), /Usage:/);
  await assert.rejects(run(['invalid'], deps), /Unknown command/);
});

test('transaction-find keeps code as string and forwards account and search limits', async () => {
  let actual, output;
  await run(['transaction-find', '000123', '123-456-0000001-2', '--pages', '20', '--match-by', 'reference', '--from', '1790109000'], {
    client: { findTransaction: async (code, options) => { actual = { code, options }; return { found: true, transaction: { paymentNumber: '000123' } }; } },
    out: value => { output = value; },
  });
  assert.deepEqual(actual, { code: '000123', options: { depositNumber: '123-456-0000001-2', pages: '20', matchBy: 'reference', fromDate: '1790109000' } });
  assert.equal(output.transaction.paymentNumber, '000123');
});

test('transaction-find rejects malformed arguments before bank access and warns on incomplete search', async () => {
  const deps = { client: { findTransaction() { throw new Error('unexpected bank access'); } } };
  await assert.rejects(run(['transaction-find'], deps), /Usage/);
  await assert.rejects(run(['transaction-find', '123', '--pages'], deps), /Missing value/);
  await assert.rejects(run(['transaction-find', '123', '--unknown', '1'], deps), /Unknown option/);
  const notes = [];
  await run(['transaction-find', '000123'], { client: { findTransaction: async () => ({ found: false, searchComplete: false }) },
    note: text => notes.push(text), out() {} });
  assert.equal(notes.length, 1);
});

test('transaction-find accepts named --account without swapping code and deposit', async () => {
  let received;
  await run(['transaction-find', '000123', '--account', '123-456-0000001-2', '--match-by', 'reference'], {
    client: { findTransaction: async (code, options) => { received = { code, options }; return { found: true }; } }, out() {},
  });
  assert.deepEqual(received, { code: '000123', options: { depositNumber: '123-456-0000001-2', matchBy: 'reference' } });
});
