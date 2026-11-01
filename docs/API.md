# Connecting a service

HTTP is the main interface. No CLI login, readline prompts or HAR file is needed
for normal service use. The CLI remains optional for existing users.

## Start

```powershell
cd saman-api
$env:SAMAN_API_KEY = 'replace-with-a-long-random-secret'
$env:SAMAN_HOST = '127.0.0.1'
$env:SAMAN_PORT = '8089'
npm start
```

Base URL: `http://127.0.0.1:8089/v1`. Send `x-api-key` on all requests except
`GET /health`. For a separate machine, set `SAMAN_HOST` to the intended listening
address and use HTTPS at your reverse proxy. A non-local binding requires an API
key. Run **one process per bank session/data directory**. Do not run CLI writes
or a second server against the same session directory concurrently.

OpenAPI: `GET /v1/openapi.json` with the API key. The old unprefixed paths still
work. Stop/restart gracefully through SIGINT or SIGTERM.

Import `saman-api.postman_collection.json` into Postman for every documented
operation, request fields, and sanitized response examples. Set `baseUrl` and
`apiKey` as collection variables. Enable optional query parameters as needed;
fill path variables and request bodies before sending. No login or payment is
automatically executed. `npm run docs:build` rebuilds the reference, OpenAPI and
collection together; `npm run postman:build` needs only the existing OpenAPI file.

Balance endpoints preserve all fields of each bank record, with the additional
`depositNumber` and `balanceAvailable` fields. Missing balances remain `null`;
zero is preserved. Transaction amount filters reject reversed ranges and retain
decimal precision. Other transaction and transfer endpoints retain bank JSON,
including nested receipts and counterparty fields when supplied by the bank.

## Interactive login

Open `/login` on this API server for the browser username/password/code flow, or run `node cli.js login`. All runtime prompts and the local sign-in page are in English: Username, Password, and SMS code. The CLI prompts for the code and resumes a pending login on the next run. See [API-REFERENCE.fa.md](API-REFERENCE.fa.md) for the request and response contract.

## Login through HTTP

1. `POST /auth/login` with JSON `{ "username": "...", "password": "..." }`.
2. Device SMS is requested automatically. If `otpRequired` and `otpSent` are true, collect the code in your application; do not request a second SMS.
3. Submit the received SMS code to `POST /auth/otp` with `{ "code": "..." }`.
4. Successful completed login returns `bankVerified: true`. If
   `shouldChangePassword` is true, complete that flow in the bank app.

`GET /auth/session` returns local `state`, `loggedIn`, `hasToken`, `expiresAt`
(Unix milliseconds), `expiresIn` (seconds), trust and password-change state.
It does not validate a token remotely. `POST /auth/session/check` contacts the
bank. Expired sessions report `state: "expired"`, not a successful login.
HTTP 401 from a bank operation requires login again. `POST /auth/logout` clears
the session locally. Passwords are not stored. Environment credentials enable renewal before data requests and one retry of a read after bank 401. Writes are never replayed.

### Check and renew session when needed

`POST /auth/session/ensure` with `{}` checks the token with the bank and, only
when missing/expired/revoked, logs in once using `SAMAN_USER` and `SAMAN_PASS`
from the server process environment. Alternatively pass `{username,password}`
in this request body. Credentials are not written to the session file.

The response includes `bankVerified`, `renewed`, and `nextAction`:

| Result | Meaning |
|---|---|
| `bankVerified:true, renewed:false, nextAction:null` | Existing token accepted |
| `bankVerified:true, renewed:true, nextAction:null` | Relogin completed and token verified |
| `credentialsRequired:true, nextAction:"login"` | Supply credentials; no relogin attempted |
| `bankVerified:false, nextAction:"verify_otp"` | SMS has been requested; submit the code |
| `bankVerified:false, nextAction:"otp_request"` | Request/resend SMS; inspect otpError if present |
| `nextAction:"change_password_in_bank_app"` | Complete the bank password-change flow |

Pending OTP sessions are retained, not replaced by another login. A new login
that requires OTP returns `reloginPerformed:true` but `renewed:false` until the
device flow is completed. Network errors and invalid credentials are propagated
without login loops. The endpoint does not retry or execute any payment.

CLI: `node cli.js ensure-session` or `node cli.js check-session --renew`, using
the same environment credentials. Ordinary `check-session` remains read-only.

### Balances and complete lists

| Endpoint | CLI | Result |
|---|---|---|
| `GET /balance` or `/balances` | `npm run balance` | Separate `deposits` and `cards` balance arrays |
| `GET /balances/deposits` | `npm run balance-deposits` | Deposit balances |
| `GET /balances/cards` | `npm run balance-cards` | Reported card balances |
| `GET /cards/all` or `/cards` | `npm run cards-all` | Every complete card record returned by bank |
| `GET /deposits/all` or `/deposits` | `npm run deposits-all` | Every complete deposit record returned by bank |

Balance rows preserve bank amount and currency values. Missing balances return
`balance:null, balanceAvailable:false`; a reported zero remains zero with
`balanceAvailable:true`. Card values are what the bank includes in its list,
not a new PIN/CVV2 balance inquiry for external cards. A card and its attached
deposit may represent the same funds, so no combined total is fabricated.

## Data endpoints

| Request | Response collection |
|---|---|
| `GET /deposits` | `deposits` |
| `GET /cards` | `cards` |
| `GET /transactions?depositNumber=...&page=0&size=10` | `elements` |
| `GET /transactions/latest?depositNumber=...&limit=10` | Latest `elements`, plus `depositNumber`, `page:0`, `limit` |
| `GET /transactions/{id}` | Complete single transaction object |
| `GET /deposits/favorites` | `deposits`, filtered using bank selection flags |
| `GET /samanium` | Complete bank score/level object |
| `GET /merchant/terminals` | `terminals` |
| `GET /merchant/summary?terminalId=...&fromDate=...` | `summaries` |

History never returns a deposit list. If the user has multiple deposits,
`depositNumber` is **required**; select the account explicitly using `/deposits`.
With exactly one deposit, it is selected automatically. Page numbering starts
at 0. `fromDate`/`toDate` on history are Unix **seconds**; merchant `fromDate`
is Unix **milliseconds**. Account and transaction IDs stay strings; preserve
hyphens, leading zeros and punctuation. URL-encode query/path values.

`elements[].detail` contains the complete transaction detail by default; use
`details=false` for list-only requests. Detail fields can include sender or
recipient information in `otherSideAccountInfo`, reference in `referralNumber`,
payment number in `paymentNumber`, `details`, `receipt` and `newReceipt`.
For deposits/withdrawals the counterparty role differs: do not always label
`otherSideAccountInfo` as the sender. Fields absent from the bank remain absent.
Raw bank values (including currency labels) are not converted or fabricated.

## Full CLI coverage and latest transactions

`GET /v1/capabilities` returns every CLI command with its HTTP method and path.
All CLI operations have HTTP equivalents, including HAR session import, transfer
OTP, card/deposit/PAYA submission, latest history and tracking-number lookup.
No HTTP handler invokes the CLI or waits for terminal input.

```http
GET /v1/transactions/latest?depositNumber=123-456-0000001-2&limit=10&details=false HTTP/1.1
Host: 127.0.0.1:8089
x-api-key: demo-local-key
```

Latest history always requests bank page zero (newest first, as observed in the
bank capture). `limit` defaults to 10 and supports 1–100. `size` is an alias;
conflicting `limit` and `size` return 400. `details` defaults to true. The selected
deposit is verified against your own deposits. Multiple deposits require an
explicit `depositNumber`. `account` is an alias for that parameter. For date
filters or other pages use `/transactions`. `/transfers/latest` is a different
bank route and only describes the last transfer source.

`POST /v1/auth/import-har` accepts the **raw HAR JSON object** as its body, with
`Content-Type: application/json` and the API key. Max size is 20MB on this path;
other routes remain limited to 32KB. File paths are not accepted. Import retains
only selected session fields, never replays captured requests, does not store
the entire capture, and returns `liveVerified:false`. Verify the imported token
separately using `/auth/session/check`.

## Example integration (Node.js)

```js
const base = process.env.SAMAN_API_URL || 'http://127.0.0.1:8089/v1';
async function saman(path, body) {
  const response = await fetch(base + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'x-api-key': process.env.SAMAN_API_KEY,
      ...(body === undefined ? {} : { 'content-type': 'application/json' }) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const data = await response.json();
  if (!response.ok) throw Object.assign(new Error(data.error), { status: response.status, data });
  return data;
}
const { deposits } = await saman('/deposits');
// Choose the intended deposit in your service/user interface.
const selectedNumber = deposits[0].number;
const query = new URLSearchParams({ depositNumber: selectedNumber, page: '0', size: '10' });
const { elements } = await saman('/transactions?' + query);
```

## Find by tracking number

`GET /transactions/find/000123?depositNumber=123-456-0000001-2&pages=10`
searches history and returns `{found, trackingNumber, depositNumber, matchBy,
pagesScanned, transactionsScanned, searchComplete, stopReason}`. On a match,
`id`, `matchedField` and the entire `transaction` detail are also included.
`matchBy=any` (default) checks tracking/payment codes and reference numbers;
`tracking` excludes reference-only matches, and `reference` checks only
`referralNumber`. Matching is exact and preserves leading zeros.

Defaults: `page=0`, `size=20`, `pages=10` (max 50), `maxTransactions=200`
(max 2000). History date/amount/direction filters are supported. The account
must be explicit when multiple deposits exist.
Search also validates the account against your deposit list before querying
history. Unknown accounts return HTTP 400 with `code: INVALID_DEPOSIT_NUMBER`.
On `found:false`,
`searchComplete:false` means a budget or repeated-page guard stopped the search;
it does not prove that the transaction does not exist. Bank/session failures
return an HTTP error. Requests fetch details sequentially and can take time.

## Recent deposit/card/IBAN destinations

The `recent-deposit` capture confirms the existing bank recent-destination
routes. Direct aliases are now available, with an obligatory positive `amount`
in IRR used to compute bank restrictions:

| HTTP | CLI |
|---|---|
| `GET /deposits/recent?amount=10000` | `node cli.js recent-deposit 10000` |
| `GET /cards/recent?amount=10000` | `node cli.js recent-card 10000` |
| `GET /ibans/recent?amount=10000` | `node cli.js recent-iban 10000` |

These are aliases of `/transfers/recent/deposit`, `/transfers/recent/card`,
`/transfers/recent/iban`. They return transfer destinations, not the transaction
history or the complete own-account list. Raw fields are retained:
`mostReferredDeposits`/`mostReferredCards`/`mostReferredIbans`, `userSelfContact`,
`restrictions`, optional `restrictionMessages`, and `isOverLimit`. The presence
of SATNA restrictions does not mean this adapter submits SATNA payments.

## Digital rial and detals capture

The complete inventory of new operations and capture evidence is in
`DETALS-CHANGES.fa.md`. Wallet creation flow:

1. `POST /digital-rial/activation/validate` with `{"walletType":"CUSTOMER"}`.
2. `POST /digital-rial/activation/otp` with `{}` sends a DIGITAL_RIAL SMS.
3. `POST /digital-rial/wallets` with `{"walletType":"CUSTOMER","verificationCode":"123456"}`
   creates the wallet. The example SMS code is synthetic.

Wallet listing, balance, history, contacts, charge, discharge and deactivation
are documented in OpenAPI. Charge/discharge move real funds; deactivation and
creation change bank state. They are not executed during tests and never retry.
Send a plain `depositNumber` for charge/discharge; discharge encrypts that field
with RSA exactly as the public PWA does, while charge sends it plain. An
optional deactivation destination deposit is also encrypted.

Wallet history uses numeric `transactionId`. The separate
`GET /digital-rial/transactions/{id}` detail route was recovered from public
`useDigitalRial-DeMsFyrJ.js`, not a captured detail response; it is not live
verified yet. Deposit history detail still uses `/transactions/{id}` and
preserves all captured fields, including categories and receipts when present.

## Errors and payments

Errors are JSON `{error, code?, bankStatus?}`. Invalid input is 400, missing API
key/session is 401, device verification is 403, a bank logical rejection is 422,
and a bad bank response/connection is 502. Unknown routes return JSON 404.
Bank error status is retained without logging request bodies or credentials.

Transfer endpoints are documented in `/openapi.json` and README. They send real
money immediately when called by your service. They never automatically retry;
on a timeout, check history before considering a new payment. Offline contract
tests and earlier browser captures do not establish live transfer execution.
