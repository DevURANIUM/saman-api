"""Synchronous client for a running Saman Mobillet Node.js API service."""

from __future__ import annotations

import getpass
import hashlib
import json
import os
import math
from pathlib import Path
from typing import Any, Callable, Iterator, Mapping, Sequence

import httpx

from ._transport import (
    base_url as normalize_base_url,
    collect,
    compact,
    identifier,
    integer,
    params,
    route_path,
    send,
)
from .errors import (
    PaginationError,
    PasswordChangeRequired,
    SmsDeliveryError,
    ProtocolError,
)
from .types import JSONResponse, endpoint


class Client:
    """One HTTP client, not an isolated bank session. The API server owns the session.

    ``base_url`` defaults to SAMAN_API_URL or localhost:8089/v1.
    ``api_key`` defaults to SAMAN_API_KEY. No bank credentials are retained.
    TLS verification is enabled; redirects and automatic retries are disabled.
    """

    def __init__(
        self,
        base_url: str | None = None,
        api_key: str | None = None,
        *,
        timeout: float = 120.0,
        max_response_bytes: int = 20 * 1024 * 1024,
        transport: httpx.BaseTransport | None = None,
        trust_env: bool = False,
    ):
        self.base_url = normalize_base_url(
            base_url or os.environ.get("SAMAN_API_URL", "http://127.0.0.1:8089/v1")
        )
        self._api_key = (
            api_key if api_key is not None else os.environ.get("SAMAN_API_KEY", "")
        )
        if not isinstance(self._api_key, str) or any(
            ord(c) < 32 or ord(c) == 127 for c in self._api_key
        ):
            raise ValueError("api_key must be a string without control characters.")
        if (
            isinstance(timeout, bool)
            or not isinstance(timeout, (int, float))
            or not math.isfinite(timeout)
            or timeout <= 0
        ):
            raise ValueError("timeout must be positive.")
        self._limit = integer(max_response_bytes, "max_response_bytes", 1)
        self._http = httpx.Client(
            timeout=timeout,
            transport=transport,
            trust_env=trust_env,
            follow_redirects=False,
        )

    def __repr__(self) -> str:
        return f"{type(self).__name__}(base_url={self.base_url!r})"

    def __enter__(self) -> Client:
        return self

    def __exit__(self, *exc: Any) -> None:
        self.close()

    def close(self) -> None:
        """Release connection pools; does not log out the bank session."""
        self._http.close()

    def request(
        self,
        method: str,
        path: str,
        *,
        query: Mapping[str, Any] | None = None,
        body: Mapping[str, Any] | None = None,
    ) -> JSONResponse:
        """Call a relative API route once. Preserve every field of its JSON response."""
        if self._http.is_closed:
            raise RuntimeError("Client is closed.")
        method = method.upper()
        if method not in {"GET", "POST"}:
            raise ValueError("Only GET and POST are supported by this API client.")
        if method == "GET" and body is not None:
            raise ValueError("GET requests cannot have a JSON body.")
        if body is not None and not isinstance(body, Mapping):
            raise ValueError("body must be a JSON object.")
        headers = {"accept": "application/json", "user-agent": "saman-mobillet/0.1.0"}
        if self._api_key:
            headers["x-api-key"] = self._api_key
        return send(
            self._http,
            method,
            self.base_url + "/" + route_path(path),
            headers=headers,
            query=params(query),
            body=dict(body) if body is not None else ({} if method == "POST" else None),
            limit=self._limit,
        )

    @endpoint("GET", "/health")
    def health(self) -> JSONResponse:
        """Check service liveness, without contacting the bank."""
        return self.request("GET", "health")

    @endpoint("GET", "/capabilities")
    def capabilities(self) -> JSONResponse:
        """List CLI-to-HTTP capabilities supported by the server."""
        return self.request("GET", "capabilities")

    @endpoint("GET", "/auth/session")
    def status(self) -> JSONResponse:
        """Read local session state; bankVerified is not implied."""
        return self.request("GET", "auth/session")

    @endpoint("POST", "/auth/session/check")
    def check_session(self) -> JSONResponse:
        """Check the current session with the bank without starting a new login."""
        return self.request("POST", "auth/session/check")

    @endpoint("POST", "/auth/session/ensure")
    def ensure_session(
        self, username: str | None = None, password: str | None = None
    ) -> JSONResponse:
        """Check/renew using explicit or server-environment credentials; may require OTP."""
        return self.request(
            "POST",
            "auth/session/ensure",
            body=compact({"username": username, "password": password}),
        )

    @endpoint("POST", "/auth/login")
    def login(
        self,
        username: str,
        password: str,
        *,
        login_type: str = "STATIC",
        request_otp: bool = True,
    ) -> JSONResponse:
        """Start login. API >=0.3 requests device SMS automatically if needed."""
        if (
            not isinstance(username, str)
            or not username
            or not isinstance(password, str)
            or not password
        ):
            raise ValueError("username and password must be non-empty strings.")
        if login_type not in {"STATIC", "OTP1"} or not isinstance(request_otp, bool):
            raise ValueError("Invalid login_type or request_otp.")
        return self.request(
            "POST",
            "auth/login",
            body={
                "username": username,
                "password": password,
                "loginType": login_type,
                "requestOtp": request_otp,
            },
        )

    @endpoint("POST", "/auth/otp/request")
    def request_otp(self) -> JSONResponse:
        """Explicitly request/resend the device-verification SMS."""
        return self.request("POST", "auth/otp/request")

    @endpoint("POST", "/auth/otp")
    def verify_otp(self, code: str) -> JSONResponse:
        """Complete device verification with an SMS code string."""
        if not isinstance(code, str) or not code:
            raise ValueError("code must be a non-empty string.")
        return self.request("POST", "auth/otp", body={"code": code})

    @endpoint("POST", "/auth/logout")
    def logout(self) -> JSONResponse:
        """Clear the API server's local bank session, affecting all its consumers."""
        return self.request("POST", "auth/logout")

    @endpoint("POST", "/auth/import-har")
    def import_har(self, har: Mapping[str, Any]) -> JSONResponse:
        """Import a caller-supplied HAR object; the server never replays it."""
        return self.request("POST", "auth/import-har", body=har)

    def import_har_file(self, path: str | Path) -> JSONResponse:
        """Read a private HAR locally and send its JSON to your API server."""
        file = Path(path)
        if file.stat().st_size > 20 * 1024 * 1024:
            raise ValueError("HAR exceeds the service's 20 MiB import limit.")
        return self.import_har(json.loads(file.read_text(encoding="utf-8-sig")))

    @endpoint("POST", "/config")
    def configure(self) -> JSONResponse:
        """Negotiate bank encryption keys; login normally handles this automatically."""
        return self.request("POST", "config")

    def sign_in(
        self,
        username: str | None = None,
        password: str | None = None,
        *,
        otp_callback: Callable[[], str] | None = None,
        username_callback: Callable[[], str] | None = None,
        password_callback: Callable[[], str] | None = None,
    ) -> JSONResponse:
        """Interactive login/resume. Use login/verify_otp for a web-service state machine.

        Callback inputs are never logged or saved. ``resend`` at the OTP prompt
        requests another code without replacing the pending device session.
        """
        result = None
        if username is None and password is None:
            status = self.status()
            if status.get("state") == "otp_required":
                result = self.ensure_session()
        if result is None:
            user = (
                username
                if username is not None
                else collect(username_callback or (lambda: input("Username: ")))
            )
            secret = (
                password
                if password is not None
                else collect(
                    password_callback or (lambda: getpass.getpass("Password: "))
                )
            )
            result = self.login(user, secret)
        if result.get("shouldChangePassword"):
            raise PasswordChangeRequired(200, result)
        if result.get("otpRequired") or result.get("deviceVerificationRequired"):
            if (
                result.get("otpSent") is False
                or result.get("nextAction") == "otp_request"
            ):
                raise SmsDeliveryError(200, result)
            if result.get("otpSent") is not True:
                raise ProtocolError(
                    "Interactive sign-in requires API service 0.3 or newer with explicit OTP delivery state."
                )
            while True:
                code = collect(
                    otp_callback
                    or (
                        lambda: getpass.getpass(
                            "SMS code (type resend for a new code): "
                        )
                    )
                )
                if code.strip().lower() in {"resend", "/resend"}:
                    self.request_otp()
                    continue
                result = self.verify_otp(code)
                break
        if (
            result.get("loggedIn") is not True
            or result.get("bankVerified") is not True
            or result.get("otpRequired")
            or result.get("shouldChangePassword")
        ):
            raise ProtocolError(
                "Sign-in did not return an explicitly verified session. Inspect status before continuing."
            )
        return result

    @endpoint("GET", "/profile")
    def profile(self) -> JSONResponse:
        """Complete bank user-profile response."""
        return self.request("GET", "profile")

    @endpoint("GET", "/accounts")
    def accounts(self) -> JSONResponse:
        """Deposit list (alias of deposits)."""
        return self.request("GET", "accounts")

    @endpoint("GET", "/accounts/with-cards")
    def accounts_with_cards(self) -> JSONResponse:
        """Deposits with attached cards, as supplied by the bank."""
        return self.request("GET", "accounts/with-cards")

    @endpoint("GET", "/accounts/categories")
    def account_categories(self) -> JSONResponse:
        return self.request("GET", "accounts/categories")

    @endpoint("GET", "/deposits")
    def deposits(self) -> JSONResponse:
        """Complete deposit records; no card collection is mixed into the list."""
        return self.request("GET", "deposits")

    @endpoint("GET", "/deposits/all")
    def all_deposits(self) -> JSONResponse:
        return self.request("GET", "deposits/all")

    @endpoint("GET", "/deposits/categories")
    def deposit_categories(self) -> JSONResponse:
        return self.request("GET", "deposits/categories")

    @endpoint("GET", "/deposits/favorites")
    def favorite_deposits(self) -> JSONResponse:
        return self.request("GET", "deposits/favorites")

    @endpoint("GET", "/cards")
    def cards(self) -> JSONResponse:
        """Complete card records, including unknown bank fields."""
        return self.request("GET", "cards")

    @endpoint("GET", "/cards/all")
    def all_cards(self) -> JSONResponse:
        return self.request("GET", "cards/all")

    @endpoint("GET", "/balance")
    def balance(self) -> JSONResponse:
        """Reported card/deposit balances; missing balances remain null, not zero."""
        return self.request("GET", "balance")

    @endpoint("GET", "/balances")
    def balances(self) -> JSONResponse:
        return self.request("GET", "balances")

    @endpoint("GET", "/balances/deposits")
    def deposit_balances(self) -> JSONResponse:
        return self.request("GET", "balances/deposits")

    @endpoint("GET", "/balances/cards")
    def card_balances(self) -> JSONResponse:
        return self.request("GET", "balances/cards")

    @endpoint("GET", "/transactions")
    def transactions(
        self,
        deposit_number: str | None = None,
        *,
        page: int = 0,
        size: int = 10,
        details: bool = True,
        from_date: int | None = None,
        to_date: int | None = None,
        from_amount: str | int | None = None,
        to_amount: str | int | None = None,
        query: str | None = None,
        is_withdrawal: bool | None = None,
    ) -> JSONResponse:
        """Read one zero-based page. Dates are Unix seconds; detail enrichment defaults on."""
        return self.request(
            "GET",
            "transactions",
            query={
                "depositNumber": deposit_number,
                "page": integer(page, "page"),
                "size": integer(size, "size", 1, 100),
                "details": details,
                "fromDate": from_date,
                "toDate": to_date,
                "fromAmount": from_amount,
                "toAmount": to_amount,
                "query": query,
                "isWithdrawal": is_withdrawal,
            },
        )

    @endpoint("GET", "/transactions/latest")
    def latest_transactions(
        self,
        deposit_number: str | None = None,
        *,
        limit: int = 10,
        details: bool = True,
    ) -> JSONResponse:
        """Always page zero; the service verifies the selected deposit."""
        return self.request(
            "GET",
            "transactions/latest",
            query={
                "depositNumber": deposit_number,
                "limit": integer(limit, "limit", 1, 100),
                "details": details,
            },
        )

    @endpoint("GET", "/transactions/{id}")
    def transaction_detail(self, transaction_id: str) -> JSONResponse:
        """Full receipt/counterparty response. The ID is one opaque URL-encoded segment."""
        return self.request("GET", "transactions/" + identifier(transaction_id))

    @endpoint("GET", "/transactions/detail/{id}")
    def transaction(self, transaction_id: str) -> JSONResponse:
        """Legacy detail-route alias; same bank response as transaction_detail."""
        return self.request("GET", "transactions/detail/" + identifier(transaction_id))

    @endpoint("GET", "/transactions/find/{code}")
    def find_transaction(
        self,
        code: str,
        deposit_number: str | None = None,
        *,
        match_by: str = "any",
        pages: int = 10,
        max_transactions: int = 200,
        page: int = 0,
        size: int = 20,
        from_date: int | None = None,
        to_date: int | None = None,
        from_amount: str | int | None = None,
        to_amount: str | int | None = None,
        query: str | None = None,
        is_withdrawal: bool | None = None,
    ) -> JSONResponse:
        """Exact tracking/reference search. Inspect searchComplete and stopReason when not found."""
        if match_by not in {"any", "tracking", "reference"}:
            raise ValueError("match_by must be any, tracking, or reference.")
        return self.request(
            "GET",
            "transactions/find/" + identifier(code),
            query={
                "depositNumber": deposit_number,
                "matchBy": match_by,
                "pages": integer(pages, "pages", 1, 50),
                "maxTransactions": integer(
                    max_transactions, "max_transactions", 1, 2000
                ),
                "page": integer(page, "page"),
                "size": integer(size, "size", 1, 100),
                "fromDate": from_date,
                "toDate": to_date,
                "fromAmount": from_amount,
                "toAmount": to_amount,
                "query": query,
                "isWithdrawal": is_withdrawal,
            },
        )

    def iter_transactions(
        self,
        deposit_number: str | None = None,
        *,
        start_page: int = 0,
        size: int = 100,
        max_pages: int = 10,
        details: bool = False,
    ) -> Iterator[JSONResponse]:
        """Yield full row objects; raise PaginationError if a page repeats or the budget is exhausted."""
        integer(max_pages, "max_pages", 1, 10000)
        seen = set()
        for page in range(start_page, start_page + max_pages):
            result = self.transactions(
                deposit_number, page=page, size=size, details=details
            )
            rows = result.get("elements")
            if not isinstance(rows, list) or any(
                not isinstance(row, dict) for row in rows
            ):
                from .errors import ProtocolError

                raise ProtocolError(
                    "Transaction history must contain an elements array of objects."
                )
            if not rows:
                return
            fingerprint = hashlib.sha256(
                json.dumps(rows, sort_keys=True).encode()
            ).digest()
            if fingerprint in seen:
                raise PaginationError("The service repeated a transaction page.")
            seen.add(fingerprint)
            yield from rows
            if (
                result.get("hasNext") is False
                or result.get("hasNext") is not True
                and len(rows) < size
            ):
                return
        raise PaginationError("max_pages was reached before the end of history.")

    @endpoint("GET", "/transactions/categories")
    def transaction_categories(self) -> JSONResponse:
        return self.request("GET", "transactions/categories")

    @endpoint("GET", "/transactions/types")
    def transaction_types(self) -> JSONResponse:
        return self.request("GET", "transactions/types")

    @endpoint("GET", "/accounts/{number}/iban")
    def iban(self, account_number: str) -> JSONResponse:
        return self.request("GET", "accounts/" + identifier(account_number) + "/iban")

    @endpoint("GET", "/owner/iban/{iban}")
    def iban_owner(self, iban: str) -> JSONResponse:
        return self.request("GET", "owner/iban/" + identifier(iban))

    @endpoint("GET", "/owner/deposit/{number}")
    def deposit_owner(self, deposit_number: str) -> JSONResponse:
        return self.request("GET", "owner/deposit/" + identifier(deposit_number))

    @endpoint("GET", "/merchant/terminals")
    def merchant_terminals(self) -> JSONResponse:
        return self.request("GET", "merchant/terminals")

    @endpoint("GET", "/merchant/summary")
    def merchant_summary(
        self, terminal_id: str, *, from_date: int | None = None
    ) -> JSONResponse:
        """from_date is Unix milliseconds; omission selects the service's last-30-days default."""
        return self.request(
            "GET",
            "merchant/summary",
            query={"terminalId": terminal_id, "fromDate": from_date},
        )

    @endpoint("GET", "/transfers/latest")
    def latest_transfer(self) -> JSONResponse:
        """Latest transfer-source metadata, not latest transaction history."""
        return self.request("GET", "transfers/latest")

    @endpoint("GET", "/transfers/reasons")
    def transfer_reasons(self) -> JSONResponse:
        return self.request("GET", "transfers/reasons")

    @endpoint("GET", "/transfers/recent/{kind}")
    def recent_transfer_destinations(self, kind: str, amount: int) -> JSONResponse:
        if kind not in {"card", "deposit", "iban"}:
            raise ValueError("kind must be card, deposit, or iban.")
        return self.request(
            "GET",
            "transfers/recent/" + kind,
            query={"amount": integer(amount, "amount", 1)},
        )

    @endpoint("GET", "/deposits/recent")
    def recent_deposits(self, amount: int) -> JSONResponse:
        return self.request(
            "GET", "deposits/recent", query={"amount": integer(amount, "amount", 1)}
        )

    @endpoint("GET", "/cards/recent")
    def recent_cards(self, amount: int) -> JSONResponse:
        return self.request(
            "GET", "cards/recent", query={"amount": integer(amount, "amount", 1)}
        )

    @endpoint("GET", "/ibans/recent")
    def recent_ibans(self, amount: int) -> JSONResponse:
        return self.request(
            "GET", "ibans/recent", query={"amount": integer(amount, "amount", 1)}
        )

    @endpoint("POST", "/transfers/card/owner")
    def card_owner(self, source: str, destination: str) -> JSONResponse:
        return self.request(
            "POST",
            "transfers/card/owner",
            body={"source": source, "destination": destination},
        )

    @endpoint("POST", "/transfers/card/otp")
    def request_transfer_otp(
        self, source: str, destination: str, amount: int
    ) -> JSONResponse:
        """Request card-transfer PIN2 SMS; distinct from device verification."""
        return self.request(
            "POST",
            "transfers/card/otp",
            body={
                "source": source,
                "destination": destination,
                "amount": integer(amount, "amount", 1),
            },
        )

    @endpoint("POST", "/transfers/card")
    def transfer_card(
        self,
        source: str,
        destination: str,
        amount: int,
        *,
        cvv2: str,
        pin2: str,
        expire_date: str,
        transaction_pin: str | None = None,
        description: str | None = None,
        tracker_id: str | None = None,
        is_most_referred_destination: bool | None = None,
    ) -> JSONResponse:
        """Submit one real card transfer. amount is integer IRR; expiry is Jalali YYYYMM."""
        return self.request(
            "POST",
            "transfers/card",
            body=compact(
                {
                    "source": source,
                    "destination": destination,
                    "amount": integer(amount, "amount", 1),
                    "cvv2": cvv2,
                    "pin2": pin2,
                    "expireDate": expire_date,
                    "transactionPin": transaction_pin,
                    "description": description,
                    "trackerId": tracker_id,
                    "isMostReferredDestination": is_most_referred_destination,
                }
            ),
        )

    @endpoint("POST", "/transfers/deposit")
    def transfer_deposit(
        self,
        source: str,
        destination: str,
        amount: int,
        *,
        transaction_pin: str | None = None,
        description: str | None = None,
        tracker_id: str | None = None,
        is_most_referred_destination: bool | None = None,
    ) -> JSONResponse:
        """Submit one real account-to-account DEPOSIT transfer."""
        return self.request(
            "POST",
            "transfers/deposit",
            body=compact(
                {
                    "source": source,
                    "destination": destination,
                    "amount": integer(amount, "amount", 1),
                    "transactionPin": transaction_pin,
                    "description": description,
                    "trackerId": tracker_id,
                    "isMostReferredDestination": is_most_referred_destination,
                }
            ),
        )

    @endpoint("POST", "/transfers/iban")
    def transfer_iban(
        self,
        source: str,
        destination: str,
        amount: int,
        reason_code: str,
        *,
        transaction_pin: str | None = None,
        description: str | None = None,
        tracker_id: str | None = None,
        is_most_referred_destination: bool | None = None,
    ) -> JSONResponse:
        """Submit one real PAYA transfer. Source is a deposit, destination is an IBAN."""
        return self.request(
            "POST",
            "transfers/iban",
            body=compact(
                {
                    "source": source,
                    "destination": destination,
                    "amount": integer(amount, "amount", 1),
                    "reasonCode": reason_code,
                    "transactionPin": transaction_pin,
                    "description": description,
                    "trackerId": tracker_id,
                    "isMostReferredDestination": is_most_referred_destination,
                }
            ),
        )

    @endpoint("GET", "/digital-rial/wallets")
    def digital_rial_wallets(
        self,
        *,
        page: int = 0,
        size: int = 10,
        wallet_states: Sequence[str] | None = None,
        wallet_types: Sequence[str] | None = None,
    ) -> JSONResponse:
        return self.request(
            "GET",
            "digital-rial/wallets",
            query={
                "page": integer(page, "page"),
                "size": integer(size, "size", 1, 1000),
                "walletStates": wallet_states,
                "walletTypes": wallet_types,
            },
        )

    @endpoint("POST", "/digital-rial/activation/validate")
    def validate_digital_rial(self, *, wallet_type: str = "CUSTOMER") -> JSONResponse:
        return self.request(
            "POST", "digital-rial/activation/validate", body={"walletType": wallet_type}
        )

    @endpoint("POST", "/digital-rial/activation/otp")
    def request_digital_rial_otp(self) -> JSONResponse:
        return self.request("POST", "digital-rial/activation/otp")

    @endpoint("POST", "/digital-rial/wallets")
    def activate_digital_rial(
        self, verification_code: str, *, wallet_type: str = "CUSTOMER"
    ) -> JSONResponse:
        """Activate a real CUSTOMER wallet using its separate activation SMS."""
        return self.request(
            "POST",
            "digital-rial/wallets",
            body={"verificationCode": verification_code, "walletType": wallet_type},
        )

    @endpoint("GET", "/digital-rial/wallets/{walletId}/balance")
    def digital_rial_balance(self, wallet_id: str) -> JSONResponse:
        return self.request(
            "GET", "digital-rial/wallets/" + identifier(wallet_id) + "/balance"
        )

    @endpoint("GET", "/digital-rial/wallets/{walletId}/transactions")
    def digital_rial_transactions(
        self, wallet_id: str, *, page: int = 0, size: int = 10
    ) -> JSONResponse:
        return self.request(
            "GET",
            "digital-rial/wallets/" + identifier(wallet_id) + "/transactions",
            query={
                "page": integer(page, "page"),
                "size": integer(size, "size", 1, 100),
            },
        )

    @endpoint("GET", "/digital-rial/transactions/{id}")
    def digital_rial_transaction_detail(self, transaction_id: str) -> JSONResponse:
        """Wallet transaction ID; this is not a deposit-history transaction ID."""
        return self.request(
            "GET", "digital-rial/transactions/" + identifier(transaction_id)
        )

    @endpoint("POST", "/digital-rial/wallets/{walletId}/deactivate")
    def deactivate_digital_rial(
        self,
        wallet_id: str,
        *,
        deposit_number: str | None = None,
        request_id: str | None = None,
    ) -> JSONResponse:
        return self.request(
            "POST",
            "digital-rial/wallets/" + identifier(wallet_id) + "/deactivate",
            body=compact({"depositNumber": deposit_number, "requestId": request_id}),
        )

    @endpoint("POST", "/digital-rial/wallets/{walletId}/charge")
    def charge_digital_rial(
        self,
        wallet_id: str,
        deposit_number: str,
        amount: int,
        *,
        request_id: str | None = None,
    ) -> JSONResponse:
        """Move real funds from deposit to wallet; encryption is handled by the server."""
        return self.request(
            "POST",
            "digital-rial/wallets/" + identifier(wallet_id) + "/charge",
            body=compact(
                {
                    "depositNumber": deposit_number,
                    "amount": integer(amount, "amount", 1),
                    "requestId": request_id,
                }
            ),
        )

    @endpoint("POST", "/digital-rial/wallets/{walletId}/discharge")
    def discharge_digital_rial(
        self,
        wallet_id: str,
        deposit_number: str,
        amount: int,
        *,
        request_id: str | None = None,
    ) -> JSONResponse:
        """Move real funds from wallet to deposit; never retries a submission."""
        return self.request(
            "POST",
            "digital-rial/wallets/" + identifier(wallet_id) + "/discharge",
            body=compact(
                {
                    "depositNumber": deposit_number,
                    "amount": integer(amount, "amount", 1),
                    "requestId": request_id,
                }
            ),
        )

    @endpoint("GET", "/digital-rial/contacts")
    def digital_rial_contacts(self, *, size: int = 120) -> JSONResponse:
        return self.request(
            "GET",
            "digital-rial/contacts",
            query={"size": integer(size, "size", 1, 1000)},
        )

    @endpoint("GET", "/institutions")
    def institutions(
        self, *, title: str | None = None, offset: int = 0, length: int = 10
    ) -> JSONResponse:
        return self.request(
            "GET",
            "institutions",
            query={
                "title": title,
                "offset": integer(offset, "offset"),
                "length": integer(length, "length", 1, 100),
            },
        )

    @endpoint("GET", "/samanium")
    def samanium(self) -> JSONResponse:
        return self.request("GET", "samanium")

    @endpoint("GET", "/home")
    def home(self) -> JSONResponse:
        return self.request("GET", "home")

    @endpoint("GET", "/notifications/count")
    def notifications_count(self) -> JSONResponse:
        return self.request("GET", "notifications/count")

    @endpoint("GET", "/cartable/count")
    def cartable_count(self) -> JSONResponse:
        return self.request("GET", "cartable/count")

    @endpoint("GET", "/onboarding/latest")
    def onboarding(self) -> JSONResponse:
        return self.request("GET", "onboarding/latest")

    @endpoint("GET", "/opening-account/terms")
    def opening_account_terms(self) -> JSONResponse:
        return self.request("GET", "opening-account/terms")

    @endpoint("GET", "/opening-account/customer")
    def opening_account_customer(self) -> JSONResponse:
        return self.request("GET", "opening-account/customer")
