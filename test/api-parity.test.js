'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { HELP } = require('../cli');
const { cliHttpMap } = require('../src/cli-http-map');
const { createApp } = require('../server');
const { openapi } = require('../src/openapi');

test('every CLI command has a documented and reachable HTTP equivalent', async t => {
  const commands = [...HELP.matchAll(/^  ([a-z][a-z-]+)(?:\s|$)/gm)].map(m => m[1]);
  for (const command of commands) assert.ok(cliHttpMap.some(row => row.command === command), command + ' missing from API map');
  const client = { session: {}, save() {}, login: async () => ({ deviceVerificationRequired: true }) };
  for (const name of ['status', 'checkSession', 'logout', 'configure', 'requestOtp', 'verifyOtp', 'request', 'accounts', 'cards',
    'favoriteDeposits', 'samanium', 'merchantTerminals', 'merchantSummary', 'cardOwner', 'requestTransferOtp', 'transferCard',
    'transferReasons', 'recentTransferDestinations', 'depositOwner', 'transferDeposit', 'transferIban', 'transactions',
    'latestTransactions', 'findTransaction', 'transactionDetail', 'ibanOwner', 'ensureSession',
    'balances', 'depositBalances', 'cardBalances', 'digitalRialWallets', 'validateDigitalRial', 'requestDigitalRialOtp',
    'activateDigitalRial', 'digitalRialBalance', 'digitalRialTransactions', 'deactivateDigitalRial', 'chargeDigitalRial',
    'dischargeDigitalRial', 'digitalRialContacts', 'institutions', 'digitalRialTransactionDetail']) client[name] = async () => ({ method: name });
  const server = createApp(client, 'test').listen(0, '127.0.0.1');
  await new Promise(r => server.once('listening', r));
  t.after(() => new Promise(r => server.close(r)));
  const har = { log: { entries: [{ request: { url: 'https://mobillet.sb24.com/account/deposits', method: 'GET', headers: [
    { name: 'authorization', value: 'Bearer offline-test-token' }, { name: 'deviceUid', value: 'example' },
  ] }, response: { status: 200, content: { text: '{"status":{"code":0},"deposits":[]}' } } }] } };
  for (const operation of cliHttpMap) {
    const relative = operation.path.slice(3);
    if (operation.command !== 'help') assert.ok(openapi.paths[relative]?.[operation.method.toLowerCase()], operation.command + ' missing from OpenAPI');
    let route = operation.path.replace('{walletId}', '00000000-0000-4000-8000-000000000001').replace('{number}', '12345').replace('{id}', 'example-id').replace('{iban}', 'IR000000000000000000000000')
      .replace('{kind}', 'deposit').replace('{code}', '123');
    if (operation.command === 'merchant-summary') route += '?terminalId=12345678';
    if (['transfer-recent', 'recent-deposit', 'recent-card', 'recent-iban'].includes(operation.command)) route += '?amount=1000';
    const body = operation.command === 'import-har' ? har : {};
    const response = await fetch(`http://127.0.0.1:${server.address().port}${route}`, {
      method: operation.method, headers: { 'x-api-key': 'test', 'content-type': 'application/json' },
      body: operation.method === 'POST' ? JSON.stringify(body) : undefined,
    });
    assert.equal(response.status, 200, operation.command + ' has no working route');
  }
});
