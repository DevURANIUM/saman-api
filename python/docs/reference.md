# Python client reference

Version 0.1.0. Requires the Saman Mobillet HTTP service; it does not connect directly to the bank.

Every endpoint returns the complete JSON object as a dictionary, including unknown fields. A missing field is not synthesized. Identifiers and OTP codes must remain strings; amounts are integer IRR. Do not print private responses in public logs.

## Connection and session

`Client(base_url=None, api_key=None, timeout=120, max_response_bytes=20971520, transport=None, trust_env=False)` reads SAMAN_API_URL and SAMAN_API_KEY when omitted. Use a context manager to close connection pools. AsyncClient supports async with and await for the same methods. The service owns one shared bank session.

`sign_in()` collects username, hidden password and the server-requested SMS code. Supply otp_callback for automation; AsyncClient also accepts an async callback. Use login() and verify_otp() for separate web form steps. No credentials are persisted by the SDK.

## All endpoint methods

### account_categories

HTTP: `GET /v1/accounts/categories`. CLI: `saman-api account-categories`.

```python
account_categories() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### accounts

HTTP: `GET /v1/accounts`. CLI: `saman-api accounts`.

```python
accounts() -> 'JSONResponse'
```

Deposit list (alias of deposits).

### accounts_with_cards

HTTP: `GET /v1/accounts/with-cards`. CLI: `saman-api accounts-with-cards`.

```python
accounts_with_cards() -> 'JSONResponse'
```

Deposits with attached cards, as supplied by the bank.

### activate_digital_rial

HTTP: `POST /v1/digital-rial/wallets`. CLI: `saman-api activate-digital-rial`.

```python
activate_digital_rial(verification_code: 'str', *, wallet_type: 'str' = 'CUSTOMER') -> 'JSONResponse'
```

Activate a real CUSTOMER wallet using its separate activation SMS.

### all_cards

HTTP: `GET /v1/cards/all`. CLI: `saman-api all-cards`.

```python
all_cards() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### all_deposits

HTTP: `GET /v1/deposits/all`. CLI: `saman-api all-deposits`.

```python
all_deposits() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### balance

HTTP: `GET /v1/balance`. CLI: `saman-api balance`.

```python
balance() -> 'JSONResponse'
```

Reported card/deposit balances; missing balances remain null, not zero.

### balances

HTTP: `GET /v1/balances`. CLI: `saman-api balances`.

```python
balances() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### capabilities

HTTP: `GET /v1/capabilities`. CLI: `saman-api capabilities`.

```python
capabilities() -> 'JSONResponse'
```

List CLI-to-HTTP capabilities supported by the server.

### card_balances

HTTP: `GET /v1/balances/cards`. CLI: `saman-api card-balances`.

```python
card_balances() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### card_owner

HTTP: `POST /v1/transfers/card/owner`. CLI: `saman-api card-owner`.

```python
card_owner(source: 'str', destination: 'str') -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### cards

HTTP: `GET /v1/cards`. CLI: `saman-api cards`.

```python
cards() -> 'JSONResponse'
```

Complete card records, including unknown bank fields.

### cartable_count

HTTP: `GET /v1/cartable/count`. CLI: `saman-api cartable-count`.

```python
cartable_count() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### charge_digital_rial

HTTP: `POST /v1/digital-rial/wallets/{walletId}/charge`. CLI: `saman-api charge-digital-rial`.

```python
charge_digital_rial(wallet_id: 'str', deposit_number: 'str', amount: 'int', *, request_id: 'str | None' = None) -> 'JSONResponse'
```

Move real funds from deposit to wallet; encryption is handled by the server.

### check_session

HTTP: `POST /v1/auth/session/check`. CLI: `saman-api check-session`.

```python
check_session() -> 'JSONResponse'
```

Check the current session with the bank without starting a new login.

### close

```python
close() -> 'None'
```

Release connection pools; does not log out the bank session.

### configure

HTTP: `POST /v1/config`. CLI: `saman-api configure`.

```python
configure() -> 'JSONResponse'
```

Negotiate bank encryption keys; login normally handles this automatically.

### deactivate_digital_rial

HTTP: `POST /v1/digital-rial/wallets/{walletId}/deactivate`. CLI: `saman-api deactivate-digital-rial`.

```python
deactivate_digital_rial(wallet_id: 'str', *, deposit_number: 'str | None' = None, request_id: 'str | None' = None) -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### deposit_balances

HTTP: `GET /v1/balances/deposits`. CLI: `saman-api deposit-balances`.

```python
deposit_balances() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### deposit_categories

HTTP: `GET /v1/deposits/categories`. CLI: `saman-api deposit-categories`.

```python
deposit_categories() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### deposit_owner

HTTP: `GET /v1/owner/deposit/{number}`. CLI: `saman-api deposit-owner`.

```python
deposit_owner(deposit_number: 'str') -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### deposits

HTTP: `GET /v1/deposits`. CLI: `saman-api deposits`.

```python
deposits() -> 'JSONResponse'
```

Complete deposit records; no card collection is mixed into the list.

### digital_rial_balance

HTTP: `GET /v1/digital-rial/wallets/{walletId}/balance`. CLI: `saman-api digital-rial-balance`.

```python
digital_rial_balance(wallet_id: 'str') -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### digital_rial_contacts

HTTP: `GET /v1/digital-rial/contacts`. CLI: `saman-api digital-rial-contacts`.

```python
digital_rial_contacts(*, size: 'int' = 120) -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### digital_rial_transaction_detail

HTTP: `GET /v1/digital-rial/transactions/{id}`. CLI: `saman-api digital-rial-transaction-detail`.

```python
digital_rial_transaction_detail(transaction_id: 'str') -> 'JSONResponse'
```

Wallet transaction ID; this is not a deposit-history transaction ID.

### digital_rial_transactions

HTTP: `GET /v1/digital-rial/wallets/{walletId}/transactions`. CLI: `saman-api digital-rial-transactions`.

```python
digital_rial_transactions(wallet_id: 'str', *, page: 'int' = 0, size: 'int' = 10) -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### digital_rial_wallets

HTTP: `GET /v1/digital-rial/wallets`. CLI: `saman-api digital-rial-wallets`.

```python
digital_rial_wallets(*, page: 'int' = 0, size: 'int' = 10, wallet_states: 'Sequence[str] | None' = None, wallet_types: 'Sequence[str] | None' = None) -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### discharge_digital_rial

HTTP: `POST /v1/digital-rial/wallets/{walletId}/discharge`. CLI: `saman-api discharge-digital-rial`.

```python
discharge_digital_rial(wallet_id: 'str', deposit_number: 'str', amount: 'int', *, request_id: 'str | None' = None) -> 'JSONResponse'
```

Move real funds from wallet to deposit; never retries a submission.

### ensure_session

HTTP: `POST /v1/auth/session/ensure`. CLI: `saman-api ensure-session`.

```python
ensure_session(username: 'str | None' = None, password: 'str | None' = None) -> 'JSONResponse'
```

Check/renew using explicit or server-environment credentials; may require OTP.

### favorite_deposits

HTTP: `GET /v1/deposits/favorites`. CLI: `saman-api favorite-deposits`.

```python
favorite_deposits() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### find_transaction

HTTP: `GET /v1/transactions/find/{code}`. CLI: `saman-api find-transaction`.

```python
find_transaction(code: 'str', deposit_number: 'str | None' = None, *, match_by: 'str' = 'any', pages: 'int' = 10, max_transactions: 'int' = 200, page: 'int' = 0, size: 'int' = 20, from_date: 'int | None' = None, to_date: 'int | None' = None, from_amount: 'str | int | None' = None, to_amount: 'str | int | None' = None, query: 'str | None' = None, is_withdrawal: 'bool | None' = None) -> 'JSONResponse'
```

Exact tracking/reference search. Inspect searchComplete and stopReason when not found.

### health

HTTP: `GET /v1/health`. CLI: `saman-api health`.

```python
health() -> 'JSONResponse'
```

Check service liveness, without contacting the bank.

### home

HTTP: `GET /v1/home`. CLI: `saman-api home`.

```python
home() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### iban

HTTP: `GET /v1/accounts/{number}/iban`. CLI: `saman-api iban`.

```python
iban(account_number: 'str') -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### iban_owner

HTTP: `GET /v1/owner/iban/{iban}`. CLI: `saman-api iban-owner`.

```python
iban_owner(iban: 'str') -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### import_har

HTTP: `POST /v1/auth/import-har`. CLI: `saman-api import-har`.

```python
import_har(har: 'Mapping[str, Any]') -> 'JSONResponse'
```

Import a caller-supplied HAR object; the server never replays it.

### import_har_file

```python
import_har_file(path: 'str | Path') -> 'JSONResponse'
```

Read a private HAR locally and send its JSON to your API server.

### institutions

HTTP: `GET /v1/institutions`. CLI: `saman-api institutions`.

```python
institutions(*, title: 'str | None' = None, offset: 'int' = 0, length: 'int' = 10) -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### iter_transactions

```python
iter_transactions(deposit_number: 'str | None' = None, *, start_page: 'int' = 0, size: 'int' = 100, max_pages: 'int' = 10, details: 'bool' = False) -> 'Iterator[JSONResponse]'
```

Yield full row objects; raise PaginationError if a page repeats or the budget is exhausted.

### latest_transactions

HTTP: `GET /v1/transactions/latest`. CLI: `saman-api latest-transactions`.

```python
latest_transactions(deposit_number: 'str | None' = None, *, limit: 'int' = 10, details: 'bool' = True) -> 'JSONResponse'
```

Always page zero; the service verifies the selected deposit.

### latest_transfer

HTTP: `GET /v1/transfers/latest`. CLI: `saman-api latest-transfer`.

```python
latest_transfer() -> 'JSONResponse'
```

Latest transfer-source metadata, not latest transaction history.

### login

HTTP: `POST /v1/auth/login`. CLI: `saman-api login`.

```python
login(username: 'str', password: 'str', *, login_type: 'str' = 'STATIC', request_otp: 'bool' = True) -> 'JSONResponse'
```

Start login. API >=0.3 requests device SMS automatically if needed.

### logout

HTTP: `POST /v1/auth/logout`. CLI: `saman-api logout`.

```python
logout() -> 'JSONResponse'
```

Clear the API server's local bank session, affecting all its consumers.

### merchant_summary

HTTP: `GET /v1/merchant/summary`. CLI: `saman-api merchant-summary`.

```python
merchant_summary(terminal_id: 'str', *, from_date: 'int | None' = None) -> 'JSONResponse'
```

from_date is Unix milliseconds; omission selects the service's last-30-days default.

### merchant_terminals

HTTP: `GET /v1/merchant/terminals`. CLI: `saman-api merchant-terminals`.

```python
merchant_terminals() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### notifications_count

HTTP: `GET /v1/notifications/count`. CLI: `saman-api notifications-count`.

```python
notifications_count() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### onboarding

HTTP: `GET /v1/onboarding/latest`. CLI: `saman-api onboarding`.

```python
onboarding() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### opening_account_customer

HTTP: `GET /v1/opening-account/customer`. CLI: `saman-api opening-account-customer`.

```python
opening_account_customer() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### opening_account_terms

HTTP: `GET /v1/opening-account/terms`. CLI: `saman-api opening-account-terms`.

```python
opening_account_terms() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### profile

HTTP: `GET /v1/profile`. CLI: `saman-api profile`.

```python
profile() -> 'JSONResponse'
```

Complete bank user-profile response.

### recent_cards

HTTP: `GET /v1/cards/recent`. CLI: `saman-api recent-cards`.

```python
recent_cards(amount: 'int') -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### recent_deposits

HTTP: `GET /v1/deposits/recent`. CLI: `saman-api recent-deposits`.

```python
recent_deposits(amount: 'int') -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### recent_ibans

HTTP: `GET /v1/ibans/recent`. CLI: `saman-api recent-ibans`.

```python
recent_ibans(amount: 'int') -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### recent_transfer_destinations

HTTP: `GET /v1/transfers/recent/{kind}`. CLI: `saman-api recent-transfer-destinations`.

```python
recent_transfer_destinations(kind: 'str', amount: 'int') -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### request

```python
request(method: 'str', path: 'str', *, query: 'Mapping[str, Any] | None' = None, body: 'Mapping[str, Any] | None' = None) -> 'JSONResponse'
```

Call a relative API route once. Preserve every field of its JSON response.

### request_digital_rial_otp

HTTP: `POST /v1/digital-rial/activation/otp`. CLI: `saman-api request-digital-rial-otp`.

```python
request_digital_rial_otp() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### request_otp

HTTP: `POST /v1/auth/otp/request`. CLI: `saman-api request-otp`.

```python
request_otp() -> 'JSONResponse'
```

Explicitly request/resend the device-verification SMS.

### request_transfer_otp

HTTP: `POST /v1/transfers/card/otp`. CLI: `saman-api request-transfer-otp`.

```python
request_transfer_otp(source: 'str', destination: 'str', amount: 'int') -> 'JSONResponse'
```

Request card-transfer PIN2 SMS; distinct from device verification.

### samanium

HTTP: `GET /v1/samanium`. CLI: `saman-api samanium`.

```python
samanium() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### sign_in

```python
sign_in(username: 'str | None' = None, password: 'str | None' = None, *, otp_callback: 'Callable[[], str] | None' = None, username_callback: 'Callable[[], str] | None' = None, password_callback: 'Callable[[], str] | None' = None) -> 'JSONResponse'
```

Interactive login/resume. Use login/verify_otp for a web-service state machine.

Callback inputs are never logged or saved. ``resend`` at the OTP prompt
requests another code without replacing the pending device session.

### status

HTTP: `GET /v1/auth/session`. CLI: `saman-api status`.

```python
status() -> 'JSONResponse'
```

Read local session state; bankVerified is not implied.

### transaction

HTTP: `GET /v1/transactions/detail/{id}`. CLI: `saman-api transaction`.

```python
transaction(transaction_id: 'str') -> 'JSONResponse'
```

Legacy detail-route alias; same bank response as transaction_detail.

### transaction_categories

HTTP: `GET /v1/transactions/categories`. CLI: `saman-api transaction-categories`.

```python
transaction_categories() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### transaction_detail

HTTP: `GET /v1/transactions/{id}`. CLI: `saman-api transaction-detail`.

```python
transaction_detail(transaction_id: 'str') -> 'JSONResponse'
```

Full receipt/counterparty response. The ID is one opaque URL-encoded segment.

### transaction_types

HTTP: `GET /v1/transactions/types`. CLI: `saman-api transaction-types`.

```python
transaction_types() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### transactions

HTTP: `GET /v1/transactions`. CLI: `saman-api transactions`.

```python
transactions(deposit_number: 'str | None' = None, *, page: 'int' = 0, size: 'int' = 10, details: 'bool' = True, from_date: 'int | None' = None, to_date: 'int | None' = None, from_amount: 'str | int | None' = None, to_amount: 'str | int | None' = None, query: 'str | None' = None, is_withdrawal: 'bool | None' = None) -> 'JSONResponse'
```

Read one zero-based page. Dates are Unix seconds; detail enrichment defaults on.

### transfer_card

HTTP: `POST /v1/transfers/card`. CLI: `saman-api transfer-card`.

```python
transfer_card(source: 'str', destination: 'str', amount: 'int', *, cvv2: 'str', pin2: 'str', expire_date: 'str', transaction_pin: 'str | None' = None, description: 'str | None' = None, tracker_id: 'str | None' = None, is_most_referred_destination: 'bool | None' = None) -> 'JSONResponse'
```

Submit one real card transfer. amount is integer IRR; expiry is Jalali YYYYMM.

### transfer_deposit

HTTP: `POST /v1/transfers/deposit`. CLI: `saman-api transfer-deposit`.

```python
transfer_deposit(source: 'str', destination: 'str', amount: 'int', *, transaction_pin: 'str | None' = None, description: 'str | None' = None, tracker_id: 'str | None' = None, is_most_referred_destination: 'bool | None' = None) -> 'JSONResponse'
```

Submit one real account-to-account DEPOSIT transfer.

### transfer_iban

HTTP: `POST /v1/transfers/iban`. CLI: `saman-api transfer-iban`.

```python
transfer_iban(source: 'str', destination: 'str', amount: 'int', reason_code: 'str', *, transaction_pin: 'str | None' = None, description: 'str | None' = None, tracker_id: 'str | None' = None, is_most_referred_destination: 'bool | None' = None) -> 'JSONResponse'
```

Submit one real PAYA transfer. Source is a deposit, destination is an IBAN.

### transfer_reasons

HTTP: `GET /v1/transfers/reasons`. CLI: `saman-api transfer-reasons`.

```python
transfer_reasons() -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### validate_digital_rial

HTTP: `POST /v1/digital-rial/activation/validate`. CLI: `saman-api validate-digital-rial`.

```python
validate_digital_rial(*, wallet_type: 'str' = 'CUSTOMER') -> 'JSONResponse'
```

Return the complete JSON response from the corresponding HTTP endpoint.

### verify_otp

HTTP: `POST /v1/auth/otp`. CLI: `saman-api verify-otp`.

```python
verify_otp(code: 'str') -> 'JSONResponse'
```

Complete device verification with an SMS code string.

## Errors

All SDK exceptions derive from SamanError. ApiError preserves status_code, code, bank_status, auth, next_action and the entire payload. AuthenticationError, DeviceVerificationRequired, PasswordChangeRequired and SmsDeliveryError describe login steps. ValidationError and BankError describe HTTP and bank failures. ProtocolError means the server response cannot be used. TransportError indicates a connection failure; request_may_have_succeeded is true for writes, which must be reconciled before manually retrying. PaginationError means the requested bounded traversal could not be completed. Exception messages omit response payloads and credentials.

## Response and CLI documentation

The complete endpoint request and response schema is available in the service openapi.json and API.md. Run saman-api COMMAND --help for exact CLI arguments. All endpoint methods use hyphenated command names. Responses remain JSON; the CLI does not flatten lists, balance fields or transaction detail objects.
