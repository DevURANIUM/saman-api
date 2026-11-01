# Saman Mobillet API and Python SDK

Python HTTP client and local Node.js adapter for Saman Mobillet, with 67 API operations.
This is an unofficial integration and is not endorsed by the bank.

## Layout

```text
saman-api/
  example/             Python usage examples and synthetic response examples
  python/              Installable saman-api Python HTTP client
  src/                 Bank client, authentication, validation and response logic
    auth-ui/           Browser login assets served by server.js
  docs/                HTTP guide, OpenAPI, Postman and workflow documentation
  scripts/             Documentation export tools
  test/                Offline Node.js regression tests
  .github/workflows/   CI and manually triggered PyPI publishing workflow
  .env.example         Environment variable reference
  .gitignore           Local data and credential exclusions
  cli.js               Node.js CLI entry point
  server.js            HTTP API entry point
  test-api.js          Offline test runner
  package.json
  package-lock.json
  CONTRIBUTORS.md
  LICENSE
  README.md
```

Run commands from this repository root after extraction. `data/` is created when
the service persists a session and is excluded from Git and release archives.

## Python package

See [the SDK guide](python/README.md), [complete method reference](python/docs/reference.md)
and [release guide](python/docs/publishing.md).

The Python package connects to the HTTP service below; it does not contact the bank directly.

```sh
python -m pip install ./python
```

```python
from samanapi import Client

with Client(api_key="YOUR_SERVICE_API_KEY") as client:
    session = client.sign_in()  # Username, hidden password, device SMS when needed
    print(session["bankVerified"])
    print(client.deposits())
```

## HTTP service

Requires Node.js 22+. Run from this repository root:

```sh
npm ci
npm start
```

Configure SAMAN_API_KEY in the server environment and provide the same key to Python
clients. The default listener is http://127.0.0.1:8089/v1. The login page is
http://127.0.0.1:8089/login. Use HTTPS across machines. Each separate account needs
a separate server and data directory. See [.env.example](.env.example); the service
does not load that file automatically.

Login requests the device SMS automatically. The next CLI prompt or web screen
accepts its code without restarting login. A pending session can be resumed.
All CLI/runtime prompts are English. Complete bank response fields are preserved.
Payments are submitted once, with no automatic replay after a connection failure.

```sh
node cli.js login
node cli.js status
node cli.js cards
```

## Features and documentation

Sync and async clients support login/SMS, session checks/renewal, all cards and
deposits, balances, paginated/latest transactions, full transaction details,
reference/tracking search, card/deposit/PAYA transfers, recent destinations,
merchant terminals, Samanium and digital-rial operations.

- [HTTP integration guide](docs/API.md)
- [Complete request and response reference](docs/API-REFERENCE.fa.md)
- [OpenAPI specification](docs/openapi.json)
- [Postman collection](docs/saman-api.postman_collection.json)
- [Runnable examples and synthetic responses](example/README.md)
- [Public documentation](https://apibank.heydari.workers.dev/saman/)

The public documentation site does not host banking operations or your session.
Only sanitized examples are included. Keep real session data outside version control.

## Verification

```sh
npm test
python -m pip install -e ./python
python -m unittest discover -s python/tests -v
```

Tests use fake bank clients and mock transports. They do not perform live banking.
GitHub CI checks Python versions, Node tests, packaging, lint/types and dependencies.
PyPI publication is a manual workflow requiring account-side Trusted Publisher setup.

MIT license. See [LICENSE](LICENSE).
