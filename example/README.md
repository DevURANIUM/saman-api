# Usage examples

Install the Python HTTP client and start the Node service from the repository root:

```sh
npm ci
python -m pip install ./python
npm start
```

Provide the same `SAMAN_API_KEY` to both processes. Set `SAMAN_API_URL` for a
different service URL; the default is `http://127.0.0.1:8089/v1`.

Run examples in a second terminal from the repository root:

```sh
python example/health.py
python example/login.py
python example/deposits.py
python example/cards.py
python example/balance.py
python example/transactions.py YOUR_DEPOSIT_NUMBER --limit 10
python example/transaction_find.py YOUR_TRACKING_NUMBER YOUR_DEPOSIT_NUMBER --match-by reference
```

`login.py` asks for username, hidden password and the device SMS code when needed.
The other scripts read data from the API service. Identifiers are kept as strings.
Transaction examples require your own deposit number and never choose an account
silently. Responses are printed in full; keep terminal output private.

`responses/` contains synthetic examples copied from the sanitized OpenAPI
reference. They are documentation fixtures, not results from a live account.
See [the complete HTTP reference](../docs/API-REFERENCE.fa.md) and
[Python method reference](../python/docs/reference.md) for all 67 operations.
