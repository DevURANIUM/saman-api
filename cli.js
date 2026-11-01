#!/usr/bin/env node
'use strict';
const readline = require('node:readline/promises');
const { Writable } = require('node:stream');
const { MobilletClient } = require('./src/client');
const { transactionQuery } = require('./src/transactions');
const flow = require('./src/auth-flow');
const { cliHttpMap } = require('./src/cli-http-map');

const HELP = `Usage: node cli.js [--json-errors] <command>
  --json-errors                    Print failures as JSON to stderr (exit code 1)
  login [username] [password]      Sign in; asks for credentials, sends SMS, then asks for its code
                                   Running login again resumes a pending SMS step
  otp-request                      Send/resend device verification SMS
  otp [code]                       Verify device SMS code
  status                           Show local session state
  check-session                    Verify session with the bank (no personal data printed)
    --renew                         Relogin once on expiration using SAMAN_USER/SAMAN_PASS
  ensure-session                   Check and relogin once if needed (environment credentials)
  logout                           Forget local session
  config                           Test connection and key exchange
  import-har <file>                 Import your local browser session capture
  profile                          User profile
  accounts                         Deposits
  deposits                         Alias for accounts
  accounts-with-cards               Deposits with cards
  cards                            Raw card response
  cards-all                        All cards returned by the bank
  deposits-all                     All deposits returned by the bank
  balance                          Reported deposit and card balances
  balance-deposits                  Deposit balances only
  balance-cards                     Card balances only
  digital-rial-wallets [CUSTOMER|BUSINESS] [page] [size]
  digital-rial-validate              Validate CUSTOMER activation eligibility
  digital-rial-otp                   Request activation SMS
  digital-rial-activate              Prompt for activation code and confirmation
  digital-rial-balance <walletId>
  digital-rial-transactions <walletId> [page] [size]
  digital-rial-transaction <transactionId>
  digital-rial-deactivate <walletId> [destinationDeposit]
  digital-rial-charge <walletId> <depositNumber> <amount-IRR>
  digital-rial-discharge <walletId> <depositNumber> <amount-IRR>
  digital-rial-contacts [size]
  institutions [title] [offset] [length]
  home
  notifications-count
  cartable-count
  onboarding
  transactions [account] [page] [size]
    [--from SECONDS] [--to SECONDS] [--query TEXT]
    [--withdrawal true|false] [--min AMOUNT] [--max AMOUNT]
    [--summary]                     Skip extra detail requests
    Full bank details are included in each row's detail by default.
    Page starts at 0; default size is 10. Dates are Unix seconds.
  transaction <id>                  Transaction detail
  transactions-latest [account] [limit]
  transaction-find <code> [account]
    Prefer: transaction-find <tracking-or-reference> --account <deposit-number>
    [--pages N] [--max-transactions N] [--match-by any|tracking|reference]
    [--from SECONDS] [--to SECONDS] [--page N] [--size N]
  transaction-categories
  transaction-types
  iban <account>                    Deposit IBAN
  owner <iban>                      Destination IBAN owner
  transfers-latest
  deposits-favorites
  deposits-categories
  samanium
  merchant-terminals
  merchant-summary <terminalId> [fromDate-ms]
  card-owner <source> <destination>
  transfer-otp <source> <destination> <amount-IRR>
  transfer-card <source> <destination> <amount-IRR>
    Prompts for expiry, CVV2, PIN2 and confirmation before sending money.
  deposit-owner <account>
  transfer-reasons                   PAYA reason codes
  transfer-recent <deposit|iban|card> <amount-IRR>
  recent-deposit <amount-IRR>
  recent-card <amount-IRR>
  recent-iban <amount-IRR>
  transfer-deposit <source-account> <destination-account> <amount-IRR>
  transfer-iban <source-account> <destination-IBAN> <amount-IRR> <reasonCode>
    Resolves recipient and requires TRANSFER confirmation. Preserve account hyphens.
  help

No HTTP server required. Uses the same session as npm start.
Optional environment: SAMAN_USER, SAMAN_PASS, SAMAN_DATA_DIR.
`;

async function ask(label, hidden = false) {
  if (!process.stdin.isTTY) throw new Error('Interactive terminal required; use SAMAN_USER/SAMAN_PASS or command arguments.');
  // readline owns terminal input; its echo goes through this muted output.
  const output = hidden ? new Writable({ write(chunk, encoding, done) { done(); } }) : process.stderr;
  const rl = readline.createInterface({ input: process.stdin, output, terminal: true });
  const controller = new AbortController();
  rl.once('SIGINT', () => controller.abort());
  try {
    if (hidden) process.stderr.write(label);
    return await rl.question(hidden ? '' : label, { signal: controller.signal });
  } finally {
    rl.close();
    if (hidden) { output.end(); process.stderr.write('\n'); }
  }
}

async function runCommand(argv, { client = new MobilletClient(), prompt = ask,
  out = value => console.log(JSON.stringify(value, null, 2)),
  note = value => console.error(value), env = process.env } = {}) {
  const [cmd = 'help', ...args] = argv;
  const required = (i, usage) => { if (!args[i]) throw new Error('Usage: ' + usage); return args[i]; };
  if (['help', '--help', '-h'].includes(cmd)) { note(HELP); return; }
  if (cmd === 'login') {
    if (args.length > 2) throw new Error('Usage: login [username] [password]');
    let result;
    if (!args.length && client.status?.().state === 'otp_required') result = await flow.resumeLogin(client);
    else {
      const username = args[0] || env.SAMAN_USER || (await prompt('Username: ')).trim();
      const password = args[1] || env.SAMAN_PASS || await prompt('Password: ', true);
      result = await flow.beginLogin(client, { username, password });
    }
    out(await completeInteractive(client, result, prompt, note)); return;
  }
  if (cmd === 'otp-request') { out(await client.requestOtp()); return; }
  if (cmd === 'otp') {
    out(await flow.finishLogin(client, args[0] || await prompt('SMS code: ', true))); return;
  }
  if (cmd === 'status') { out(flow.view(client.status())); return; }
  if (cmd === 'check-session' || cmd === 'ensure-session') {
    if (args.length && !(cmd === 'check-session' && args.length === 1 && args[0] === '--renew')) throw new Error('Usage: check-session [--renew] or ensure-session');
    if (cmd === 'ensure-session' || args[0] === '--renew') {
      const credentials = {};
      if (env.SAMAN_USER) credentials.username = env.SAMAN_USER;
      if (env.SAMAN_PASS) credentials.password = env.SAMAN_PASS;
      const result = await flow.ensureLogin(client, credentials);
      out(await completeInteractive(client, result, prompt, note));
    } else out(flow.view(await client.checkSession()));
    return;
  }
  if (cmd === 'logout') { out(client.logout()); return; }
  if (cmd === 'config') { out(await client.configure()); return; }
  if (cmd === 'import-har') {
    const { importHar } = require('./src/import-har');
    out(importHar(client, required(0, 'import-har <file>'))); return;
  }
  const routes = {
    profile: 'user/', 'accounts-with-cards': 'account/depositsWithCards',
    'transaction-categories': 'transactions/categories', 'deposits-categories': 'account/deposits/categorize',
    'transaction-types': 'transactions/types', 'transfers-latest': 'transfer/latest',
    home: 'app/home', 'notifications-count': 'notification/count', 'cartable-count': 'cartable/count',
  };
  if (Object.hasOwn(routes, cmd)) { out(await client.request(routes[cmd])); return; }
  if (cmd === 'onboarding') { out(await client.request('onboarding/latest', { query: { platform: 'PWA' } })); return; }
  if (cmd === 'institutions') { out(await client.institutions({ ...(args[0] !== undefined ? { title: args[0] } : {}),
    ...(args[1] !== undefined ? { offset: args[1] } : {}), ...(args[2] !== undefined ? { length: args[2] } : {}) })); return; }
  if (cmd === 'digital-rial-wallets') {
    out(await client.digitalRialWallets({ ...(args[0] ? { walletTypes: args[0] } : {}),
      ...(args[1] !== undefined ? { page: args[1] } : {}), ...(args[2] !== undefined ? { size: args[2] } : {}) })); return;
  }
  if (cmd === 'digital-rial-validate') { out(await client.validateDigitalRial()); return; }
  if (cmd === 'digital-rial-otp') { out(await client.requestDigitalRialOtp()); return; }
  if (cmd === 'digital-rial-activate') {
    if ((await prompt('Type ACTIVATE to create a CUSTOMER digital-rial wallet: ')).trim() !== 'ACTIVATE') throw new Error('Activation cancelled');
    const verificationCode = await prompt('Digital rial activation SMS code: ', true);
    out(await client.activateDigitalRial({ verificationCode, walletType: 'CUSTOMER' })); return;
  }
  if (cmd === 'digital-rial-contacts') { out(await client.digitalRialContacts(args[0] === undefined ? {} : { size: args[0] })); return; }
  if (cmd === 'digital-rial-balance') { out(await client.digitalRialBalance(required(0, cmd + ' <walletId>'))); return; }
  if (cmd === 'digital-rial-transaction') { out(await client.digitalRialTransactionDetail(required(0, cmd + ' <transactionId>'))); return; }
  if (cmd === 'digital-rial-transactions') {
    out(await client.digitalRialTransactions(required(0, cmd + ' <walletId> [page] [size]'), {
      ...(args[1] !== undefined ? { page: args[1] } : {}), ...(args[2] !== undefined ? { size: args[2] } : {}) })); return;
  }
  if (cmd === 'digital-rial-deactivate') {
    const walletId = required(0, cmd + ' <walletId> [destinationDeposit]');
    require('./src/digital-rial').uuid(walletId);
    const input = args[1] ? { depositNumber: require('./src/transfer').depositNumber(args[1]) } : {};
    note(JSON.stringify({ walletId, ...input }, null, 2));
    if ((await prompt('Type DEACTIVATE to deactivate this wallet: ')).trim() !== 'DEACTIVATE') throw new Error('Deactivation cancelled');
    out(await client.deactivateDigitalRial(walletId, input)); return;
  }
  if (cmd === 'digital-rial-charge' || cmd === 'digital-rial-discharge') {
    const walletId = required(0, cmd + ' <walletId> <depositNumber> <amount-IRR>');
    const input = { depositNumber: required(1, cmd + ' <walletId> <depositNumber> <amount-IRR>'),
      amount: required(2, cmd + ' <walletId> <depositNumber> <amount-IRR>') };
    const validated = require('./src/digital-rial').movement(walletId, input);
    note(JSON.stringify({ operation: cmd, walletId, depositNumber: validated.depositNumber, amount: validated.amount, currency: 'IRR' }, null, 2));
    if ((await prompt('Type TRANSFER to move these funds: ')).trim() !== 'TRANSFER') throw new Error('Wallet movement cancelled');
    input.requestId = validated.requestId;
    out(await (cmd === 'digital-rial-charge' ? client.chargeDigitalRial(walletId, input) : client.dischargeDigitalRial(walletId, input))); return;
  }
  if (['accounts', 'deposits', 'deposits-all'].includes(cmd)) { out(await client.accounts()); return; }
  if (cmd === 'cards' || cmd === 'cards-all') { out(await client.cards()); return; }
  if (cmd === 'balance') { out(await client.balances()); return; }
  if (cmd === 'balance-deposits') { out(await client.depositBalances()); return; }
  if (cmd === 'balance-cards') { out(await client.cardBalances()); return; }
  if (cmd === 'transactions-latest') {
    if (args.length > 2) throw new Error('Usage: transactions-latest [account] [limit]');
    out(await client.latestTransactions({ ...(args[0] ? { depositNumber: args[0] } : {}), ...(args[1] ? { limit: args[1] } : {}) })); return;
  }
  if (cmd === 'deposits-favorites') { out(await client.favoriteDeposits()); return; }
  if (cmd === 'samanium') { out(await client.samanium()); return; }
  if (cmd === 'merchant-terminals') { out(await client.merchantTerminals()); return; }
  if (cmd === 'merchant-summary') { out(await client.merchantSummary(required(0, 'merchant-summary <terminalId> [fromDate-ms]'), args[1])); return; }
  if (cmd === 'deposit-owner') { out(await client.depositOwner(required(0, 'deposit-owner <account>'))); return; }
  if (cmd === 'transfer-reasons') { out(await client.transferReasons()); return; }
  if (cmd === 'transfer-recent') { out(await client.recentTransferDestinations(required(0, 'transfer-recent <kind> <amount>'), required(1, 'transfer-recent <kind> <amount>'))); return; }
  if (['recent-deposit', 'recent-card', 'recent-iban'].includes(cmd)) {
    if (args.length !== 1) throw new Error('Usage: ' + cmd + ' <amount-IRR>');
    out(await client.recentTransferDestinations(cmd.slice('recent-'.length), args[0])); return;
  }
  if (cmd === 'transfer-deposit' || cmd === 'transfer-iban') {
    const isIban = cmd === 'transfer-iban';
    const input = { source: required(0, cmd + ' <source> <destination> <amount> [reasonCode]'),
      destination: required(1, cmd + ' <source> <destination> <amount> [reasonCode]'),
      amount: required(2, cmd + ' <source> <destination> <amount> [reasonCode]') };
    if (isIban) input.reasonCode = required(3, 'transfer-iban <source> <IBAN> <amount> <reasonCode>');
    const { bankTransfer } = require('./src/transfer');
    Object.assign(input, bankTransfer(input, isIban ? 'PAYA' : 'DEPOSIT'));
    const owner = isIban ? await client.ibanOwner(input.destination) : await client.depositOwner(input.destination);
    input.isMostReferredDestination = owner.user?.isMostReferred === true;
    let reason;
    if (isIban) {
      const reasons = await client.transferReasons();
      reason = reasons.reasons?.find(r => r.code === input.reasonCode);
      if (!reason) throw new Error('reasonCode is not offered by the bank');
    }
    note(JSON.stringify({ source: input.source, destination: input.destination, amount: input.amount,
      currency: 'IRR', method: isIban ? 'PAYA' : 'DEPOSIT', destinationOwner: owner.user,
      destinationBank: owner.bank, reason }, null, 2));
    input.description = await prompt('Description (optional): ');
    const pin = await prompt('Transaction PIN (blank if not required): ', true);
    if (pin) input.transactionPin = pin;
    if ((await prompt('Type TRANSFER to confirm this payment: ')).trim() !== 'TRANSFER') throw new Error('Transfer cancelled');
    out(await (isIban ? client.transferIban(input) : client.transferDeposit(input))); return;
  }
  if (cmd === 'card-owner' || cmd === 'transfer-otp' || cmd === 'transfer-card') {
    const input = { source: required(0, cmd + ' <source> <destination> <amount-IRR>'),
      destination: required(1, cmd + ' <source> <destination> <amount-IRR>') };
    if (cmd === 'card-owner') { out(await client.cardOwner(input)); return; }
    input.amount = required(2, cmd + ' <source> <destination> <amount-IRR>');
    if (cmd === 'transfer-otp') { out(await client.requestTransferOtp(input)); return; }
    const { cardTransfer } = require('./src/transfer');
    Object.assign(input, cardTransfer(input));
    const owner = await client.cardOwner(input);
    note(JSON.stringify({ source: input.source, destination: input.destination,
      amount: input.amount, currency: 'IRR', destinationOwner: owner.user, destinationBank: owner.bank }, null, 2));
    if ((await prompt('Type TRANSFER to confirm this payment: ')).trim() !== 'TRANSFER') throw new Error('Transfer cancelled');
    input.expireDate = await prompt('Expiry (Jalali YYYYMM, e.g. 140801): ');
    input.cvv2 = await prompt('CVV2: ', true);
    input.pin2 = await prompt('Second password / OTP: ', true);
    const transactionPin = await prompt('Transaction PIN (blank if not required): ', true);
    if (transactionPin) input.transactionPin = transactionPin;
    out(await client.transferCard(input)); return;
  }
  if (cmd === 'transactions') {
    const positional = [], input = {};
    const flags = { '--from': 'fromDate', '--to': 'toDate', '--query': 'query',
      '--withdrawal': 'isWithdrawal', '--min': 'fromAmount', '--max': 'toAmount' };
    for (let i = 0; i < args.length; i++) {
      if (args[i] === '--summary') input.details = false;
      else if (Object.hasOwn(flags, args[i])) {
        const key = flags[args[i]];
        if (args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new Error('Missing value for ' + args[i]);
        input[key] = args[++i];
      } else if (args[i].startsWith('--')) throw new Error('Unknown option: ' + args[i]);
      else positional.push(args[i]);
    }
    if (positional.length > 3) throw new Error('Usage: transactions [account] [page] [size] [options]');
    if (positional[0]) input.depositNumber = positional[0];
    if (positional[1] !== undefined) input.page = positional[1];
    if (positional[2] !== undefined) input.size = positional[2];
    const query = transactionQuery(input);
    out(await client.transactions(query)); return;
  }
  if (cmd === 'transaction-find') {
    const positional = [], options = {};
    const flags = { '--pages': 'pages', '--max-transactions': 'maxTransactions', '--match-by': 'matchBy',
      '--account': 'depositNumber',
      '--from': 'fromDate', '--to': 'toDate', '--page': 'page', '--size': 'size',
      '--withdrawal': 'isWithdrawal', '--min': 'fromAmount', '--max': 'toAmount', '--query': 'query' };
    for (let i = 0; i < args.length; i++) {
      if (Object.hasOwn(flags, args[i])) {
        const key = flags[args[i]];
        if (args[i + 1] === undefined || args[i + 1].startsWith('--')) throw new Error('Missing value for ' + args[i]);
        options[key] = args[++i];
      } else if (args[i].startsWith('--')) throw new Error('Unknown option: ' + args[i]);
      else positional.push(args[i]);
    }
    if (!positional[0] || positional.length > 2) throw new Error('Usage: transaction-find <code> [account] [options]');
    if (positional[1]) {
      if (options.depositNumber !== undefined && options.depositNumber !== positional[1]) throw new Error('Conflicting account arguments; use --account only');
      options.depositNumber = positional[1];
    }
    const result = await client.findTransaction(positional[0], options);
    if (!result.found && !result.searchComplete) note('Search stopped at its limit; the transaction may exist outside the searched range.');
    out(result); return;
  }
  if (cmd === 'transaction') { out(await client.transactionDetail(required(0, 'transaction <id>'))); return; }
  if (cmd === 'iban') { out(await client.request('iban/deposit', { headers: { depositNumber: required(0, 'iban <account>') } })); return; }
  if (cmd === 'owner') { out(await client.ibanOwner(required(0, 'owner <iban>'))); return; }
  throw new Error('Unknown command. Run: node cli.js help');
}

async function completeInteractive(client, result, prompt, note) {
  if (result.shouldChangePassword) {
    note('Complete the required password change in the bank app.'); return result;
  }
  if (!result.otpRequired) return result;
  if (!result.otpSent) {
    const error = new (require('./src/errors').ApiError)('SMS delivery failed. Your pending login was preserved. Run otp-request to try again.', result.otpError?.status || 403, result.otpError?.code);
    error.auth = result; throw error;
  }
  note('A device verification code has been requested. Enter the SMS code below.');
  while (true) {
    const code = await prompt('SMS code (type resend for a new code): ', true);
    if (['resend','/resend'].includes(code.trim().toLowerCase())) {
      await client.requestOtp(); note('A new verification code has been requested.'); continue;
    }
    return flow.finishLogin(client, code);
  }
}

async function run(argv, options = {}) {
  const client = options.client || new MobilletClient();
  const cmd = argv[0] || 'help';
  const operation = cliHttpMap.find(item => item.command === cmd);
  const authCommands = ['login','otp','otp-request','status','check-session','ensure-session','logout','config','import-har','help'];
  const execute = () => runCommand(argv, { ...options, client });
  if (!operation || authCommands.includes(cmd) || operation.method !== 'GET') return execute();
  return flow.withSession(client, execute, { credentials: flow.credentialsFrom(options.env || process.env),
    readOnly: operation.method === 'GET',
    onPending: result => completeInteractive(client, result, options.prompt || ask, options.note || (value => console.error(value))) });
}

if (require.main === module) {
  const argv = process.argv.slice(2);
  const jsonErrors = argv[0] === '--json-errors';
  if (jsonErrors) argv.shift();
  run(argv).catch(err => {
    const message = err.name === 'AbortError' ? 'Cancelled.' : err.message;
    if (jsonErrors) console.error(JSON.stringify({ error: message, status: err.status || 400,
      code: err.code, bankStatus: err.bankStatus, auth: err.auth, nextAction: err.nextAction }));
    else {
      console.error(message);
      if (err.code !== undefined && err.name !== 'AbortError') console.error('Code:', err.code);
    }
    process.exitCode = 1;
  });
}
module.exports = { run, HELP };
