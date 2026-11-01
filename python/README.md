# saman-api

A typed, synchronous and asynchronous Python client for the **Saman Mobillet HTTP API**.

This package talks to your running Saman API service. It **does not connect directly
to the bank**, replace the Node.js server, or execute requests through the documentation
website. The service manages bank encryption, cookies and the bank session.

Requires Python 3.10+ and API service 0.3+. All SDK prompts and messages are English.

## Installation

```sh
pip install saman-api
```

Until the first PyPI release, install from the source package directory:

```sh
pip install .
```

Start the accompanying Node.js API server with `npm install` and `npm start`.
Configure `SAMAN_API_KEY` on the server and provide the same key to this client.
The default API URL is `http://127.0.0.1:8089/v1`; a supplied URL without `/v1`
has that suffix appended. Production connections should use HTTPS.

```python
from samanapi import Client

with Client(base_url="http://127.0.0.1:8089/v1", api_key="YOUR_SERVICE_API_KEY") as client:
    result = client.sign_in()  # Username, hidden password, then hidden SMS code if needed
    print(result["bankVerified"])
    print(client.deposits())
    print(client.cards())
    print(client.balance())
```

The constructor also reads `SAMAN_API_URL` and `SAMAN_API_KEY`. Bank credentials
are not stored by this Python package. One API server owns one bank session:
creating another Python client does **not** create an independent bank login.
`close()` closes HTTP connections; `logout()` clears the shared server session.

## Login in a web application

Use explicit stages rather than an interactive prompt:

```python
from samanapi import Client

with Client() as client:
    result = client.login("YOUR_USERNAME", "YOUR_PASSWORD")
    if result.get("otpRequired"):
        if result.get("otpSent"):
            # Collect the code in your application's UI, then call:
            result = client.verify_otp("123456")  # synthetic example code
        else:
            print(result.get("otpError"))
```

The service requests the device SMS automatically. Do not call `request_otp()`
after every login: it is an explicit resend. `sign_in()` accepts `otp_callback`
for integration, and resumes a pending code step when called without credentials.
Return `resend` from the callback to request another code. Wrong codes leave the
pending server session available for another attempt. Use `login(..., request_otp=False)`
only when you deliberately want the service's legacy manual-SMS workflow.

`ok=True` can mean that the initial credential step succeeded. A completed login
has `loggedIn=True` and `bankVerified=True`. Password-change requirements must be
completed in the bank app. Device-verification, card PIN2 and digital-rial activation
codes belong to different workflows.

## Async client

```python
import asyncio
from samanapi import AsyncClient

async def main():
    async with AsyncClient() as client:
        print(await client.check_session())
        print(await client.latest_transactions("123-456-0000001-2", limit=10))

asyncio.run(main())
```

Every endpoint has the same name and parameters in `Client` and `AsyncClient`.
`AsyncClient.sign_in` accepts synchronous or asynchronous callbacks. Default
interactive callbacks run in a worker thread. Transaction iteration uses
`for row in client.iter_transactions(...)` or `async for` with the async client.

## History, details and exact search

```python
with Client() as client:
    history = client.transactions(
        "123-456-0000001-2", page=0, size=20,
        details=True, is_withdrawal=False,
        from_date=1700000000, to_date=1700086400,
    )
    result = client.find_transaction(
        "000000000001", "123-456-0000001-2",
        match_by="reference", pages=10, max_transactions=200,
    )
    if not result["found"]:
        print(result["searchComplete"], result["stopReason"])
```

Pages start at **0**. Transaction dates are Unix **seconds**; merchant summary
`from_date` is Unix **milliseconds**. Identifiers, tracking/reference numbers,
cards, deposit numbers and IBANs stay strings, preserving leading zeros.
Transaction IDs are encoded as one URL segment, including embedded slashes.

`details=True` lets the server include full bank detail/receipt objects in each
row's `detail`. Unknown fields are preserved. The SDK does not infer a sender's
name or card number from free text. JSON null balances remain `None`, and absent
fields remain absent; neither is converted to zero. Card and deposit balances
are not added together.

`iter_transactions(..., size=100, max_pages=10, details=False)` is bounded. It raises
`PaginationError` when a page repeats or the budget runs out before the end of
history. It does not silently claim that a bounded search covered the whole account.

## Transfers and digital rial

```python
with Client() as client:
    reasons = client.transfer_reasons()
    owner = client.iban_owner("IR000000000000000000000000")  # synthetic, replace it
    # Programmatic money movement is explicit; no confirmation dialog is inserted:
    # receipt = client.transfer_iban(source, destination, amount_irr, reason_code)
```

Transfer amounts are positive integer **IRR**, capped at JavaScript's safe integer
range. Card expiry is Jalali `YYYYMM`. `transfer_card` needs `cvv2`, `pin2`, and
`expire_date`. The server encrypts these fields. PAYA takes a deposit as source
and an IBAN as destination. Select `reason_code` from `transfer_reasons()`.
The current service implements CARD, DEPOSIT and PAYA, not SATNA/POL submission.

Digital rial has separate eligibility, SMS, activation, balance, transaction,
charge, discharge, deactivation and contact methods. Wallet history IDs differ
from deposit-history IDs. Activation currently supports CUSTOMER wallets.

The SDK never retries or follows redirects automatically. On a timeout or a
cancelled payment request, the operation may already have succeeded: inspect
history before submitting another instruction. API-server renewal behavior is
separate from the SDK; the companion server never automatically replays transfers.

## Errors and response preservation

```python
from samanapi import Client, ApiError, TransportError

try:
    with Client() as client:
        print(client.cards())
except ApiError as exc:
    print(exc.status_code, exc.code, exc.next_action)
    # exc.payload contains the full response; inspect it only where appropriate.
except TransportError as exc:
    print(exc.request_may_have_succeeded)
```

Exception types include `AuthenticationError`, `DeviceVerificationRequired`,
`PasswordChangeRequired`, `ValidationError`, `BankError`, `SmsDeliveryError`,
`TransportError`, `ProtocolError` and `PaginationError`. HTTP errors preserve
`payload`, `bank_status`, `auth`, `next_action`, `method` and `path`. Error string
representations do not print server payloads or credentials. An HTTP 200 body
containing an application `error` is not silently accepted.

The default response limit is 20 MiB; larger responses raise `ProtocolError`
rather than being truncated. Configure `max_response_bytes` explicitly if needed.
`timeout` defaults to 120 seconds. Longer bounded searches may need a larger value.
Custom HTTPX transports are supported for tests and advanced use; their own retry
or security behavior is the caller's responsibility. `trust_env` defaults to false.

## CLI

```sh
saman-api login
saman-api status
saman-api deposits
saman-api balance
saman-api transactions --deposit-number 123-456-0000001-2 --page 0 --size 20 --details false
saman-api find-transaction 000000000001 --deposit-number 123-456-0000001-2 --match-by reference
saman-api --help
```

The API key is read from `SAMAN_API_KEY`. `SAMAN_USER` and `SAMAN_PASS` may supply
credentials to CLI login. All endpoint methods have hyphenated CLI commands;
`--help` lists their arguments. Boolean arguments take `true` or `false`.
Wallet filter lists are comma-separated. Use `python -m samanapi` as an
alternative entry point. The CLI writes JSON results to stdout and errors to
stderr; `--json-errors` gives structured errors and exit code 1. Cancellation
uses exit code 130. Financial commands require `TRANSFER`, wallet activation
`ACTIVATE`, and deactivation `DEACTIVATE`; noninteractive callers must pass the
matching `--confirm` value. Required card secrets are prompted without echo
when omitted. Use `import-har FILE` for a local private capture, never a public example.

## API reference and development

See [the complete method reference](docs/reference.md) and the
[HTTP service documentation](https://apibank.heydari.workers.dev/saman/).
`request("GET", "cards", query={...})` is available for future relative routes;
absolute/cross-origin paths and traversal are rejected before any I/O.

```sh
pip install -e .
python -m unittest discover -s tests -v
python tools/generate_async.py
python -m build
python -m twine check dist/*
```

Tests use mock transports and a fake bank behind the real Node server. They do
not send money or verify a current live bank session. The source distribution
and wheel use explicit include rules and contain no sessions, captures or API keys.
