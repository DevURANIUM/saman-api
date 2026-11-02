# saman-api

<img src="assets/saman.svg" alt="Saman Bank Mobillet" width="64">

**A local HTTP API, standalone CLI, and typed Python client for Saman Bank Mobillet.**

[English](README.md) · [فارسی](README.fa.md) · [Documentation](https://apibank.heydari.workers.dev/saman/) · [Python SDK guide](https://apibank.heydari.workers.dev/saman/#python-sdk)

[![CI](https://github.com/DevURANIUM/saman-api/actions/workflows/ci.yml/badge.svg)](https://github.com/DevURANIUM/saman-api/actions/workflows/ci.yml)
[![PyPI](https://img.shields.io/pypi/v/saman-api)](https://pypi.org/project/saman-api/)
[![Python](https://img.shields.io/pypi/pyversions/saman-api)](https://pypi.org/project/saman-api/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)

Connect your own application to account balances, cards, transaction history, receipts and transfers through **67 documented HTTP operations**. Use the Node.js CLI for a local workflow, or the synchronous and asynchronous Python clients for service integration.

This is an **unofficial integration**, independently maintained and not endorsed by Saman Bank.

## Contents

- [How it works](#how-it-works)
- [Features](#features)
- [Quick start](#quick-start)
- [Authentication and sessions](#authentication-and-sessions)
- [Python client](#python-client)
- [Command-line interfaces](#command-line-interfaces)
- [HTTP API](#http-api)
- [Configuration](#configuration)
- [Response conventions](#response-conventions)
- [Documentation and examples](#documentation-and-examples)
- [Repository layout](#repository-layout)
- [Development](#development)
- [Contributing and license](#contributing-and-license)

## How it works

```text
Your application / Python SDK / Python CLI
                    |
                    v
        Your Node.js HTTP service
                    |
                    v
            Saman Mobillet API
```

| Interface | Purpose | Requires the HTTP service? |
| --- | --- | --- |
| `node server.js` | Runs the bank adapter and exposes HTTP endpoints | Starts the service |
| `node cli.js` | Standalone bank client using the local session directory | No |
| `from samanapi import Client, AsyncClient` | Python integration with your HTTP service | Yes |
| `saman-api` | Python package's command-line interface | Yes |

The Node.js service handles the bank protocol, encryption, cookies and session persistence. The Python package sends HTTP requests to that service. The documentation website hosts public guides and examples; banking requests go to your own service.

**Names:** install `saman-api` from PyPI; import `samanapi` in Python. The service is version **0.3.0** and the Python package is version **0.1.0**; they have separate release versions.

## Features

| Area | Available capabilities |
| --- | --- |
| Authentication | Username/password login, automatic device SMS when needed, code verification, pending-login continuation and logout |
| Sessions | Local status, bank-side validation and credential-assisted renewal |
| Accounts and cards | Deposits, linked cards, complete lists, favorites and reported balances |
| Transactions | Pagination, latest history, date/amount filters, full details and exact tracking/reference search |
| Transfers | Card-to-card, account-to-account and IBAN/PAYA; owner lookup, transfer reasons and recent destinations |
| Digital rial | Eligibility, activation SMS, CUSTOMER wallet activation, balances, history, contacts, charge/discharge and deactivation |
| Other services | Samanium points, merchant terminals and summaries, institutions and supported dashboard information |
| Developer tools | Sync/async SDK, both CLIs, OpenAPI 3.1, Postman, complete JSON responses and structured errors |

Current bank transfer submission methods are **CARD, DEPOSIT and PAYA**. SATNA/POL submission is not implemented. Availability and limits of bank operations depend on the account and the bank's response.

## Quick start

Requirements: **Node.js 22+**, **npm**, and **Python 3.10+** when using the Python package.

### 1. Start the HTTP service

Run in Windows PowerShell:

```powershell
git clone https://github.com/DevURANIUM/saman-api.git
cd saman-api
npm ci

$env:SAMAN_HOST = "127.0.0.1"
$env:SAMAN_PORT = "8089"
$env:SAMAN_API_KEY = "REPLACE_WITH_YOUR_SERVICE_KEY"
npm start
```

Choose a long random service key and use the same value in every client. This key protects your HTTP service; bank login still uses your bank username, password and device verification.

<details>
<summary>Linux / macOS environment variables</summary>

After cloning the repository and running `npm ci`:

```sh
export SAMAN_HOST=127.0.0.1
export SAMAN_PORT=8089
export SAMAN_API_KEY='REPLACE_WITH_YOUR_SERVICE_KEY'
npm start
```

</details>

The default API base is `http://127.0.0.1:8089/v1`. The browser login page is `http://127.0.0.1:8089/login`.

### 2. Install the Python client

In a second terminal:

```powershell
python -m pip install saman-api
$env:SAMAN_API_URL = "http://127.0.0.1:8089/v1"
$env:SAMAN_API_KEY = "REPLACE_WITH_YOUR_SERVICE_KEY"
```

### 3. Sign in and read your accounts

```python
from samanapi import Client

with Client() as client:
    session = client.sign_in()
    print(session["bankVerified"])
    print(client.deposits())
    print(client.cards())
    print(client.balance())
```

`sign_in()` asks for a username, hidden password, and device SMS code when required. SDK and CLI prompts are English. All examples use placeholders or synthetic identifiers; select your real deposit from the response before requesting its history.

## Authentication and sessions

For a web application, use separate HTTP or SDK stages:

1. Call `login(username, password)` or `POST /v1/auth/login`.
2. When `otpRequired` and `otpSent` are true, collect the SMS code in your application and send it to `verify_otp(code)` or `POST /v1/auth/otp`.
3. A completed login has both `loggedIn=true` and `bankVerified=true`. `ok=true` alone may also describe a pending device challenge.

Device SMS is requested automatically when needed. Use `request_otp()` only for an explicit resend. A pending challenge can be resumed, without restarting login. A required password change must be completed in the bank app.

| Python method | Meaning |
| --- | --- |
| `status()` | Read locally known session state |
| `check_session()` | Check whether the bank accepts the session |
| `ensure_session()` | Check/renew the session; may return a pending SMS step |
| `logout()` | Clear the server's bank login |

The server owns **one shared bank session**. Multiple Python clients attached to the same server share that account. Use a separate server and data directory for each independent account. Closing a Python client releases HTTP connections; it does not log out the bank session.

See [the login workflow](docs/LOGIN-FLOW.fa.md) and [HTTP authentication guide](docs/API.md) for request and response details.

## Python client

### History and reference search

```python
from samanapi import Client

with Client() as client:
    deposit = "123-456-0000001-2"  # Replace with your selected deposit
    print(client.latest_transactions(deposit, limit=10))
    print(client.transactions(deposit, page=0, size=20, details=True))

    result = client.find_transaction(
        "000000000001", deposit,
        match_by="reference", pages=10, max_transactions=200,
    )
    print(result["found"], result["searchComplete"])
```

Search is exact and bounded. If `found` is false, inspect `searchComplete` and `stopReason` before concluding that no transaction exists. `iter_transactions(..., max_pages=10)` provides bounded iteration and raises `PaginationError` if it cannot finish within that budget.

### Async

```python
import asyncio
from samanapi import AsyncClient

async def main():
    async with AsyncClient() as client:
        print(await client.check_session())
        print(await client.cards())

asyncio.run(main())
```

Sync and async clients expose the same endpoint method names and parameters. Use `async for` with the async transaction iterator. Credentials and OTP input can be supplied through callbacks; `AsyncClient.sign_in()` also accepts async callbacks.

### Errors

```python
from samanapi import Client, ApiError, TransportError

try:
    with Client() as client:
        print(client.balance())
except ApiError as error:
    print(error.status_code, error.code, error.next_action)
    # error.payload contains the complete service response.
except TransportError as error:
    print(error.request_may_have_succeeded)
```

Responses preserve all fields. API errors retain their complete payload and authentication hints. The SDK does not automatically retry requests or follow redirects. After an uncertain payment result, reconcile its status before submitting another instruction.

Full installation, callback, transfer, wallet and error documentation: [Python SDK guide](python/README.md) · [method reference](python/docs/reference.md).

## Command-line interfaces

### Python CLI — through the running HTTP service

```powershell
saman-api login
saman-api status
saman-api check-session
saman-api deposits
saman-api cards
saman-api balance
saman-api latest-transactions --deposit-number "123-456-0000001-2" --limit 10
saman-api find-transaction "000000000001" --deposit-number "123-456-0000001-2" --match-by reference
saman-api --help
```

`python -m samanapi` is an alternative entry point. Each endpoint has a command; use `saman-api COMMAND --help` for arguments. Required card secrets are prompted without echo when omitted. Financial commands require `TRANSFER`; wallet activation and deactivation use `ACTIVATE` and `DEACTIVATE`.

### Node.js CLI — standalone

Run from the repository root:

```powershell
node cli.js login
node cli.js check-session
node cli.js deposits-all
node cli.js cards-all
node cli.js balance
node cli.js transactions-latest "123-456-0000001-2" 10
node cli.js transaction-find "000000000001" --account "123-456-0000001-2" --match-by reference
node cli.js help
```

The standalone CLI uses the same session directory as the server. Run one writer per data directory: stop the server before standalone commands that change its session, or configure a separate directory. The Python CLI goes through the running server and its request queue.

Both CLIs print successful JSON to stdout. Place `--json-errors` before the command for JSON errors on stderr and exit code 1.

## HTTP API

Send `x-api-key` on API calls when `SAMAN_API_KEY` is configured. Health is available without the key; the browser login page is also accessible so users can enter their service key. POST request bodies use `Content-Type: application/json`.

```powershell
curl.exe "http://127.0.0.1:8089/v1/health"
curl.exe "http://127.0.0.1:8089/v1/deposits" -H "x-api-key: YOUR_SERVICE_API_KEY"
curl.exe "http://127.0.0.1:8089/v1/transactions/latest?depositNumber=123-456-0000001-2&limit=10" -H "x-api-key: YOUR_SERVICE_API_KEY"
```

Selected routes; the [OpenAPI document](docs/openapi.json) describes all 67 operations:

| Method | Route | Purpose |
| --- | --- | --- |
| GET | `/v1/health` | Service liveness |
| GET | `/v1/capabilities` | CLI-to-HTTP capability map |
| POST | `/v1/auth/login` | Start login and device SMS when needed |
| POST | `/v1/auth/otp` | Verify the device code |
| POST | `/v1/auth/session/check` | Validate the session with the bank |
| POST | `/v1/auth/session/ensure` | Check/renew the session |
| GET | `/v1/deposits/all` | Complete deposit list |
| GET | `/v1/cards/all` | Complete card list |
| GET | `/v1/balance` | Reported deposit and card balances |
| GET | `/v1/transactions/latest` | Latest selected-deposit history |
| GET | `/v1/transactions/{id}` | Complete transaction detail |
| GET | `/v1/transactions/find/{code}` | Exact tracking/reference search |
| POST | `/v1/transfers/card` | Card-to-card submission |
| POST | `/v1/transfers/deposit` | Account-to-account submission |
| POST | `/v1/transfers/iban` | IBAN/PAYA submission |
| GET | `/v1/digital-rial/wallets` | Digital-rial wallet list |

## Configuration

| Variable | Used by | Default / meaning |
| --- | --- | --- |
| `SAMAN_HOST` | Node server | `127.0.0.1` |
| `SAMAN_PORT` | Node server | `8089` |
| `SAMAN_API_KEY` | Server and Python client | Shared service key; required for a non-local server binding |
| `SAMAN_DATA_DIR` | Node server / standalone CLI | Repository's `data/` directory; holds local session data |
| `SAMAN_USER`, `SAMAN_PASS` | Node renewal flow / Python CLI login | Optional credentials supplied through the process environment |
| `SAMAN_API_URL` | Python client / CLI | `http://127.0.0.1:8089/v1` |

[`.env.example`](.env.example) documents the supported variables. The application does **not** load `.env` automatically; configure the shell or process supervisor. Use HTTPS for connections across machines and keep session files, private captures and credentials out of Git.

Server-side renewal may retry a read once after an explicit bank 401 when credentials are available. Payments and other writes are never automatically replayed. The Python SDK itself performs no automatic retries.

## Response conventions

- Money is integer **IRR**, not toman. Amounts must fit JavaScript's safe integer range.
- Card, deposit, IBAN, transaction and tracking identifiers are **strings**; preserve leading zeros and opaque IDs.
- Deposit history starts at page **0**. History dates use Unix **seconds**; merchant summary `fromDate` uses **milliseconds**.
- Complete response fields are preserved. JSON null becomes Python `None`; absent fields remain absent.
- Missing balances are not converted to zero, and card/deposit balances are not added together.
- `details=True` enables history-detail enrichment; sender/counterparty fields are returned when provided by the bank. They are not inferred from free text.
- Bank-side rejections preserve their available error code and details; inspect the documented error response before retrying.

## Documentation and examples

| Resource | Link |
| --- | --- |
| Persian interactive documentation | [apibank.heydari.workers.dev/saman](https://apibank.heydari.workers.dev/saman/) |
| Interactive Python guide | [Installation, login, async and method mapping](https://apibank.heydari.workers.dev/saman/#python-sdk) |
| Python package | [PyPI: saman-api](https://pypi.org/project/saman-api/) |
| HTTP integration guide | [docs/API.md](docs/API.md) |
| Complete Persian request/response reference | [docs/API-REFERENCE.fa.md](docs/API-REFERENCE.fa.md) |
| OpenAPI 3.1 | [docs/openapi.json](docs/openapi.json) |
| Postman collection | [Import the collection](docs/saman-api.postman_collection.json) |
| Python methods | [python/docs/reference.md](python/docs/reference.md) |
| Runnable examples | [example/README.md](example/README.md) |
| Build and publishing | [python/docs/publishing.md](python/docs/publishing.md) |

Postman uses your own `baseUrl` and `apiKey` collection variables. Examples contain synthetic data and do not run automatically.

## Repository layout

```text
saman-api/
├── src/                  Bank client, auth, validation and response handling
│   └── auth-ui/          Browser login page assets
├── python/               Installable saman-api package; import samanapi
├── example/              Usage scripts and synthetic response examples
├── docs/                 HTTP reference, OpenAPI, Postman and workflow guides
├── test/                 Offline Node.js tests
├── scripts/              Documentation export tools
├── .github/workflows/    CI and manual PyPI publishing
├── .env.example          Environment variable reference
├── cli.js                Standalone CLI entry point
├── server.js             HTTP service entry point
└── test-api.js           Node test runner
```

## Development

```powershell
npm ci
npm test
python -m pip install -e ./python
python -m unittest discover -s python/tests -v
```

Node dependencies are required for the Python-to-server integration test. Tests use fake bank clients and mock transports; they do not perform live bank transfers. CI verifies the service and SDK on Windows and Linux with Python 3.10 and 3.14, including lint/type checks, dependency audits, package builds and wheel installation.

Regenerate the Postman collection with `npm run postman:build`. PyPI publication is manually triggered through `publish.yml`, after configuring the `pypi` environment and Trusted Publisher. See the [release guide](python/docs/publishing.md).

## Contributing and license

Bug reports should include the affected route/method, expected behavior and a redacted error. Contributions should include appropriate regression coverage and documentation updates. See [CONTRIBUTORS.md](CONTRIBUTORS.md).

Licensed under the [MIT License](LICENSE).
