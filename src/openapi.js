'use strict';
const string = { type: 'string' };
const object = { type: 'object', additionalProperties: true };
const parameter = (name, schema = string, required = false, location = 'query') => ({ name, in: location, required, schema });
const body = (properties, required) => ({ required: true, content: { 'application/json': {
  schema: { type: 'object', properties, required, additionalProperties: false },
} } });
const secret = { type: 'string', writeOnly: true };
const transferProperties = { source: string, destination: string, amount: { type: 'integer', minimum: 1, description: 'IRR' },
  description: string, trackerId: { type: 'string', format: 'uuid' }, transactionPin: secret,
  isMostReferredDestination: { type: 'boolean' } };
const paths = {};
function add(path, method, summary, options = {}) {
  paths[path] ||= {};
  paths[path][method] = { summary, security: [{ ApiKey: [] }], responses: {
    200: { description: 'Complete bank JSON, or local session state', content: { 'application/json': { schema: object } } },
    400: { description: 'Invalid input or missing depositNumber' },
    401: { description: 'API key invalid or bank session missing/expired; inspect error/code' },
    403: { description: 'Bank requires device verification' },
    422: { description: 'Bank logical error; code and bankStatus are preserved' },
    502: { description: 'Bank connection/protocol/response-shape failure' },
  }, ...options };
}
add('/health', 'get', 'Liveness', { security: [] });
add('/capabilities', 'get', 'All CLI operations mapped to HTTP methods and paths');
add('/auth/session', 'get', 'Local session state; does not contact bank');
add('/auth/session/check', 'post', 'Verify session against bank');
add('/auth/session/ensure', 'post', 'Verify session; relogin once only if missing/expired or bank returns 401', {
  requestBody: body({ username: string, password: secret }, []),
});
add('/auth/login', 'post', 'Login and request device SMS automatically; inspect otpRequired and nextAction', {
  requestBody: body({ username: string, password: secret, loginType: { type: 'string', enum: ['STATIC', 'OTP1'], default: 'STATIC' },
    requestOtp: { type: 'boolean', default: true, description: 'false preserves the legacy separate SMS-request step' } }, ['username', 'password']),
});
add('/auth/otp/request', 'post', 'Request device verification SMS');
add('/auth/otp', 'post', 'Verify device SMS and check session', { requestBody: body({ code: secret }, ['code']) });
add('/auth/logout', 'post', 'Clear local bank session');
add('/auth/import-har', 'post', 'Import a browser HAR JSON body; never replay captured requests', {
  requestBody: { required: true, content: { 'application/json': { schema: {
    type: 'object', required: ['log'], properties: { log: { type: 'object', required: ['entries'],
      properties: { entries: { type: 'array', items: object } } } },
  } } } },
});
for (const [path, summary] of Object.entries({
  '/profile': 'User profile', '/deposits': 'Deposit list only', '/accounts': 'Alias for deposit list',
  '/accounts/with-cards': 'Deposits with cards', '/accounts/categories': 'Categorized deposits', '/deposits/categories': 'Alias for categorized deposits',
  '/cards': 'Card list only', '/cards/all': 'All card records returned by bank', '/deposits/all': 'All deposit records returned by bank',
  '/balance': 'Reported deposit and card balances, no combined sum', '/balances': 'Alias for balance',
  '/balances/deposits': 'Reported deposit balances', '/balances/cards': 'Reported card balances',
  '/deposits/favorites': 'Selected deposits', '/samanium': 'Samanium score and level',
  '/merchant/terminals': 'Merchant terminals', '/transactions/categories': 'Transaction categories',
  '/transactions/types': 'Transaction types', '/transfers/latest': 'Latest transfer source',
  '/transfers/reasons': 'PAYA reason codes', '/opening-account/terms': 'Opening-account terms',
  '/opening-account/customer': 'Opening-account state',
  '/home': 'Bank home contents', '/notifications/count': 'Notification counts', '/cartable/count': 'Cartable counts',
  '/onboarding/latest': 'Latest PWA onboarding',
})) add(path, 'get', summary);
add('/institutions', 'get', 'Institution list (read-only bank POST adapter)', {
  parameters: [parameter('length', { type: 'integer', minimum: 1, maximum: 100, default: 10 }),
    parameter('offset', { type: 'integer', minimum: 0, default: 0 }), parameter('title', { type: 'string', maxLength: 200, default: '' })],
});
const walletIdParameter = parameter('walletId', { type: 'string', format: 'uuid' }, true, 'path');
add('/digital-rial/wallets', 'get', 'Digital rial wallet list and activation flags', {
  parameters: [parameter('page', { type: 'integer', minimum: 0, default: 0 }), parameter('size', { type: 'integer', minimum: 1, maximum: 1000, default: 10 }),
    { ...parameter('walletStates', { type: 'array', items: { type: 'string', enum: ['NORMAL', 'BAN'] }, default: ['NORMAL', 'BAN'] }), style: 'form', explode: true },
    { ...parameter('walletTypes', { type: 'array', items: { type: 'string', enum: ['CUSTOMER', 'BUSINESS'] }, default: ['BUSINESS', 'CUSTOMER'] }), style: 'form', explode: true }],
});
add('/digital-rial/activation/validate', 'post', 'Validate eligibility (not activation)', {
  requestBody: body({ walletType: { type: 'string', enum: ['CUSTOMER'], default: 'CUSTOMER' } }, []),
});
add('/digital-rial/activation/otp', 'post', 'Send DIGITAL_RIAL activation SMS');
add('/digital-rial/wallets', 'post', 'CREATE WALLET: activate CUSTOMER digital rial wallet with SMS code', {
  requestBody: body({ verificationCode: secret, walletType: { type: 'string', enum: ['CUSTOMER'], default: 'CUSTOMER' } }, ['verificationCode']),
});
add('/digital-rial/wallets/{walletId}/balance', 'get', 'Wallet balance reported by bank', { parameters: [walletIdParameter] });
add('/digital-rial/wallets/{walletId}/transactions', 'get', 'Wallet-specific transaction history, separate from deposit history', {
  parameters: [walletIdParameter, parameter('page', { type: 'integer', minimum: 0, default: 0 }),
    parameter('size', { type: 'integer', minimum: 1, maximum: 100, default: 10 })],
});
add('/digital-rial/transactions/{id}', 'get', 'Wallet transaction detail from public PWA source; not captured/live-verified yet', {
  parameters: [parameter('id', { type: 'string', pattern: '^\\d{1,40}$', description: 'transactionId from wallet history, not a deposit-history id' }, true, 'path')],
});
add('/digital-rial/wallets/{walletId}/deactivate', 'post', 'DEACTIVATE WALLET: one bank request, no retry', {
  parameters: [walletIdParameter], requestBody: body({ requestId: { type: 'string', format: 'uuid' },
    depositNumber: { type: 'string', description: 'Optional destination deposit; encrypted like the PWA if supplied' } }, []),
});
for (const direction of ['charge', 'discharge']) add('/digital-rial/wallets/{walletId}/' + direction, 'post',
  direction === 'charge' ? 'MOVE MONEY: deposit to wallet, no retry' : 'MOVE MONEY: wallet to deposit, no retry', {
    parameters: [walletIdParameter], requestBody: body({ amount: { type: 'integer', minimum: 1, description: 'IRR' },
      depositNumber: string, requestId: { type: 'string', format: 'uuid' } }, ['amount', 'depositNumber']),
  });
add('/digital-rial/contacts', 'get', 'Recent WALLET contacts', {
  parameters: [parameter('size', { type: 'integer', minimum: 1, maximum: 1000, default: 120 })],
});
add('/transactions', 'get', 'Transaction rows only; detail contains complete bank transaction information', {
  parameters: [parameter('depositNumber', { ...string, description: 'Required if more than one deposit exists. Preserve hyphens.' }),
    parameter('page', { type: 'integer', minimum: 0, default: 0 }), parameter('size', { type: 'integer', minimum: 1, maximum: 100, default: 10 }),
    parameter('details', { type: 'boolean', default: true }), parameter('fromDate', { type: 'integer', description: 'Unix seconds' }),
    parameter('toDate', { type: 'integer', description: 'Unix seconds' }), parameter('fromAmount'), parameter('toAmount'),
    parameter('query'), parameter('isWithdrawal', { type: 'boolean' })],
});
add('/transactions/latest', 'get', 'Latest transactions for a selected deposit; always bank page zero', {
  parameters: [parameter('depositNumber', { type: 'string', description: 'Required with multiple deposits; verified against deposit list' }),
    parameter('limit', { type: 'integer', minimum: 1, maximum: 100, default: 10 }),
    parameter('size', { type: 'integer', minimum: 1, maximum: 100, description: 'Alias for limit; both must match if supplied together' }),
    parameter('details', { type: 'boolean', default: true })],
});
for (const path of ['/transactions/{id}', '/transactions/detail/{id}'])
  add(path, 'get', 'Complete transaction detail; ID is opaque', { parameters: [parameter('id', string, true, 'path')] });
add('/transactions/find/{code}', 'get', 'Find first exact tracking/reference match in bounded account history', {
  parameters: [parameter('code', { type: 'string', pattern: '^[0-9\u06f0-\u06f9\u0660-\u0669]{1,64}$' }, true, 'path'),
    parameter('depositNumber', { type: 'string', description: 'Required with multiple deposits' }),
    parameter('pages', { type: 'integer', minimum: 1, maximum: 50, default: 10 }),
    parameter('maxTransactions', { type: 'integer', minimum: 1, maximum: 2000, default: 200 }),
    parameter('page', { type: 'integer', minimum: 0, default: 0 }),
    parameter('size', { type: 'integer', minimum: 1, maximum: 100, default: 20 }),
    parameter('matchBy', { type: 'string', enum: ['any', 'tracking', 'reference'], default: 'any' }),
    parameter('fromDate', { type: 'integer', description: 'Unix seconds' }),
    parameter('toDate', { type: 'integer', description: 'Unix seconds' }),
    parameter('isWithdrawal', { type: 'boolean' }), parameter('fromAmount'), parameter('toAmount'), parameter('query')],
});
for (const path of ['/owner/deposit/{number}', '/owner/iban/{iban}', '/accounts/{number}/iban']) {
  const name = path.includes('{iban}') ? 'iban' : 'number';
  add(path, 'get', 'Account/IBAN lookup', { parameters: [parameter(name, string, true, 'path')] });
}
add('/merchant/summary', 'get', 'Merchant summary since supplied date or last 30 days', {
  parameters: [parameter('terminalId', string, true), parameter('fromDate', { type: 'integer', description: 'Unix milliseconds' })],
});
add('/transfers/recent/{kind}', 'get', 'Recent destinations and bank restrictions', {
  parameters: [parameter('kind', { type: 'string', enum: ['card', 'deposit', 'iban'] }, true, 'path'),
    parameter('amount', { type: 'integer', minimum: 1 }, true)],
});
for (const [path, kind] of [['/deposits/recent', 'deposit'], ['/cards/recent', 'card'], ['/ibans/recent', 'iban']])
  add(path, 'get', 'Alias for recent ' + kind + ' transfer destinations; complete bank response', {
    parameters: [parameter('amount', { type: 'integer', minimum: 1, description: 'Transfer amount in IRR; used for bank restrictions' }, true)],
  });
add('/transfers/card/owner', 'post', 'Resolve destination card owner', {
  requestBody: body({ source: string, destination: string }, ['source', 'destination']),
});
add('/transfers/card/otp', 'post', 'Request second-password SMS for a card transfer', {
  requestBody: body(transferProperties, ['source', 'destination', 'amount']),
});
add('/transfers/card', 'post', 'SEND MONEY: card transfer, no automatic retry', {
  requestBody: body({ ...transferProperties, cvv2: secret, pin2: secret, expireDate: { type: 'string', description: 'Jalali YYYYMM' } },
    ['source', 'destination', 'amount', 'cvv2', 'pin2', 'expireDate']),
});
add('/transfers/deposit', 'post', 'SEND MONEY: DEPOSIT transfer, no automatic retry', {
  requestBody: body(transferProperties, ['source', 'destination', 'amount']),
});
add('/transfers/iban', 'post', 'SEND MONEY: PAYA transfer, no automatic retry', {
  requestBody: body({ ...transferProperties, reasonCode: string }, ['source', 'destination', 'amount', 'reasonCode']),
});
add('/config', 'post', 'Negotiate transport keys (normally handled by login)');
const openapi = { openapi: '3.1.0', info: { title: 'Saman Mobillet HTTP API', version: '0.3.0',
  description: 'One bank account/session per server instance. All monetary amounts are IRR. Request secrets are not logged. Bank JSON is retained.' },
  servers: [{ url: '/v1' }], components: { securitySchemes: { ApiKey: { type: 'apiKey', in: 'header', name: 'x-api-key' } } }, paths };
const errorSchema = { type: 'object', required: ['error'], additionalProperties: true,
  properties: { error: { type: 'string' }, code: { type: ['number', 'string'] }, bankStatus: object } };
for (const operations of Object.values(paths)) for (const operation of Object.values(operations)) {
  for (const [code, response] of Object.entries(operation.responses || {})) {
    if (Number(code) >= 400) response.content = { 'application/json': { schema: errorSchema } };
  }
}
module.exports = { openapi };
