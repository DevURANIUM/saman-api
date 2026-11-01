'use strict';
const express = require('express');
const crypto = require('node:crypto');
const path = require('node:path');
const { MobilletClient, ApiError } = require('./src/client');
const openapi = require('./docs/openapi.json');
const { importHarData } = require('./src/import-har');
const { cliHttpMap } = require('./src/cli-http-map');
const flow = require('./src/auth-flow');

function createApp(client = new MobilletClient(), key = process.env.SAMAN_API_KEY || '', { credentials = flow.credentialsFrom() } = {}) {
  const app = express();
  const router = express.Router();
  app.disable('x-powered-by');
  app.use((req, res, next) => {
    res.set('Cache-Control', 'no-store');
    if (['/health', '/v1/health'].includes(req.path) || !key
      || req.method === 'GET' && ['/login','/auth/ui','/auth-ui/app.js','/auth-ui/styles.css'].includes(req.path)) return next();
    const a = Buffer.from(req.get('x-api-key') || ''), b = Buffer.from(key);
    if (a.length === b.length && crypto.timingSafeEqual(a, b)) return next();
    res.status(401).json({ error: 'missing or invalid x-api-key' });
  });
  for (const [route, file] of Object.entries({ '/login':'index.html','/auth/ui':'index.html',
    '/auth-ui/app.js':'app.js','/auth-ui/styles.css':'styles.css' })) {
    app.get(route, (req, res) => {
      res.set('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'");
      res.set('X-Content-Type-Options','nosniff');
      res.sendFile(path.join(__dirname,'src','auth-ui',file));
    });
  }
  const normalJson = express.json({ limit: '32kb' });
  const harJson = express.json({ limit: '20mb' });
  app.use((req, res, next) => /^\/(?:v1\/)?auth\/import-har\/?$/.test(req.path)
    ? harJson(req, res, next) : normalJson(req, res, next));
  app.use((req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body !== undefined
      && (req.body === null || Array.isArray(req.body) || typeof req.body !== 'object'))
      return next(new ApiError('JSON body must be an object', 400));
    next();
  });
  // Serialize requests because cookies and authentication belong to one session.
  let queue = Promise.resolve();
  const handle = (fn, { authenticated = true } = {}) => (req, res, next) => {
    const task = queue.then(() => authenticated
      ? flow.withSession(client, () => fn(req), { credentials, readOnly: req.method === 'GET' }) : fn(req));
    queue = task.catch(() => {});
    task.then(data => res.json(data), next);
  };
  const authHandle = fn => handle(fn, { authenticated: false });
  router.get('/health', (req, res) => res.json({ ok: true }));
  router.get('/openapi.json', (req, res) => res.json(openapi));
  router.get('/capabilities', (req, res) => res.json({ basePath: '/v1', operations: cliHttpMap }));
  router.get(['/status', '/auth/session'], authHandle(() => flow.view(client.status())));
  router.post(['/auth/session/check', '/session/check'], authHandle(async () => flow.view(await client.checkSession())));
  router.post('/auth/session/ensure', authHandle(req => flow.ensureLogin(client, req.body || {})));
  router.post('/config', authHandle(() => client.configure()));
  router.post(['/login', '/auth/login'], authHandle(req => flow.beginLogin(client, req.body || {})));
  router.post(['/otp/request', '/auth/otp/request'], authHandle(() => client.requestOtp()));
  router.post(['/otp', '/auth/otp'], authHandle(req => flow.finishLogin(client, req.body?.code)));
  router.post(['/logout', '/auth/logout'], authHandle(() => client.logout()));
  router.post('/auth/import-har', authHandle(req => importHarData(client, req.body)));
  const reads = {
    '/profile': 'user/',
    '/accounts/with-cards': 'account/depositsWithCards',
    '/accounts/categories': 'account/deposits/categorize',
    '/deposits/categories': 'account/deposits/categorize',
    '/transactions/categories': 'transactions/categories',
    '/transactions/types': 'transactions/types', '/transfers/latest': 'transfer/latest',
    '/opening-account/terms': 'opening-account/terms',
    '/opening-account/customer': 'opening-account/customer',
    '/home': 'app/home', '/notifications/count': 'notification/count', '/cartable/count': 'cartable/count',
  };
  for (const [local, upstream] of Object.entries(reads))
    router.get(local, handle(() => client.request(upstream)));
  router.get(['/accounts', '/deposits', '/deposits/all'], handle(() => client.accounts()));
  router.get(['/cards', '/cards/all'], handle(() => client.cards()));
  router.get(['/balance', '/balances'], handle(() => client.balances()));
  router.get('/balances/deposits', handle(() => client.depositBalances()));
  router.get('/balances/cards', handle(() => client.cardBalances()));
  router.get('/deposits/favorites', handle(() => client.favoriteDeposits()));
  router.get('/samanium', handle(() => client.samanium()));
  router.get('/onboarding/latest', handle(() => client.request('onboarding/latest', { query: { platform: 'PWA' } })));
  router.get('/institutions', handle(req => client.institutions(req.query)));
  router.get('/digital-rial/wallets', handle(req => client.digitalRialWallets(req.query)));
  router.post('/digital-rial/activation/validate', handle(req => client.validateDigitalRial(req.body || {})));
  router.post('/digital-rial/activation/otp', handle(() => client.requestDigitalRialOtp()));
  router.post('/digital-rial/wallets', handle(req => client.activateDigitalRial(req.body || {})));
  router.get('/digital-rial/wallets/:walletId/balance', handle(req => client.digitalRialBalance(req.params.walletId)));
  router.get('/digital-rial/wallets/:walletId/transactions', handle(req => client.digitalRialTransactions(req.params.walletId, req.query)));
  router.get('/digital-rial/transactions/:id', handle(req => client.digitalRialTransactionDetail(req.params.id)));
  router.post('/digital-rial/wallets/:walletId/deactivate', handle(req => client.deactivateDigitalRial(req.params.walletId, req.body || {})));
  router.post('/digital-rial/wallets/:walletId/charge', handle(req => client.chargeDigitalRial(req.params.walletId, req.body || {})));
  router.post('/digital-rial/wallets/:walletId/discharge', handle(req => client.dischargeDigitalRial(req.params.walletId, req.body || {})));
  router.get('/digital-rial/contacts', handle(req => client.digitalRialContacts(req.query)));
  router.get('/merchant/terminals', handle(() => client.merchantTerminals()));
  router.get('/merchant/summary', handle(req => client.merchantSummary(req.query.terminalId, req.query.fromDate)));
  router.post('/transfers/card/owner', handle(req => client.cardOwner(req.body || {})));
  router.post('/transfers/card/otp', handle(req => client.requestTransferOtp(req.body || {})));
  router.post('/transfers/card', handle(req => client.transferCard(req.body || {})));
  router.get('/transfers/reasons', handle(() => client.transferReasons()));
  router.get('/transfers/recent/:kind', handle(req => client.recentTransferDestinations(req.params.kind, req.query.amount)));
  router.get('/deposits/recent', handle(req => client.recentTransferDestinations('deposit', req.query.amount)));
  router.get('/cards/recent', handle(req => client.recentTransferDestinations('card', req.query.amount)));
  router.get('/ibans/recent', handle(req => client.recentTransferDestinations('iban', req.query.amount)));
  router.get('/owner/deposit/:number', handle(req => client.depositOwner(req.params.number)));
  router.post('/transfers/deposit', handle(req => client.transferDeposit(req.body || {})));
  router.post('/transfers/iban', handle(req => client.transferIban(req.body || {})));
  router.get('/transactions', handle(req => client.transactions(req.query)));
  router.get('/transactions/latest', handle(req => client.latestTransactions(req.query)));
  router.get('/transactions/find/:code', handle(req => client.findTransaction(req.params.code, req.query)));
  router.get('/transactions/detail/:id', handle(req => client.transactionDetail(req.params.id)));
  router.get('/transactions/:id', handle(req => client.transactionDetail(req.params.id)));
  router.get('/accounts/:number/iban', handle(req => client.request('iban/deposit', { headers: { depositNumber: req.params.number } })));
  router.get('/owner/iban/:iban', handle(req => client.ibanOwner(req.params.iban)));
  app.use('/v1', router);
  app.use('/', router); // Existing integrations keep their original URLs.
  app.use((req, res) => res.status(404).json({ error: 'route not found' }));
  app.use((err, req, res, next) => {
    const status = err instanceof ApiError ? err.status : err.type === 'entity.parse.failed' ? 400 : err.type === 'entity.too.large' ? 413 : 500;
    res.status(status).json({ error: status === 500 ? 'internal error' : err.message,
      code: err.code, bankStatus: err.bankStatus, auth: err.auth, nextAction: err.nextAction });
  });
  return app;
}
if (require.main === module) {
  const port = Number(process.env.SAMAN_PORT || 8089);
  const host = process.env.SAMAN_HOST || '127.0.0.1';
  if (!['127.0.0.1', '::1', 'localhost'].includes(host) && !process.env.SAMAN_API_KEY)
    throw new Error('SAMAN_API_KEY is required when listening outside localhost');
  const server = createApp().listen(port, host, () => console.log(`Saman API: http://${host}:${port}/v1`));
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => server.close(() => process.exit(0)));
}
module.exports = { createApp };
