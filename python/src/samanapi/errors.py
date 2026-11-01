"""Errors contain the original response in ``payload``, never in their repr."""

from typing import Any


class SamanError(Exception):
    """Base class for SDK failures."""


class ApiError(SamanError):
    """An HTTP or application error returned by the Saman API service."""

    def __init__(
        self, status_code: int, payload: Any, method: str = "", path: str = ""
    ):
        self.status_code = status_code
        self.payload = payload
        self.method = method
        self.path = path
        data = payload if isinstance(payload, dict) else {}
        self.code = data.get("code")
        self.bank_status = data.get("bankStatus")
        self.auth = data.get("auth")
        self.next_action = data.get("nextAction")
        super().__init__(
            f"API request failed (HTTP {status_code}). Inspect payload for details."
        )


class AuthenticationError(ApiError):
    """The service API key or bank session was rejected."""


class DeviceVerificationRequired(ApiError):
    """A device verification code must be requested or submitted."""


class PasswordChangeRequired(ApiError):
    """Complete the password-change flow in the bank app."""


class ValidationError(ApiError):
    """The service rejected request parameters."""


class BankError(ApiError):
    """The bank rejected the operation; inspect code and bank_status."""


class SmsDeliveryError(ApiError):
    """Credentials were accepted, but the device SMS was not requested."""


class TransportError(SamanError):
    """No reliable response was received. A write may have succeeded."""

    def __init__(self, method: str, path: str):
        self.method, self.path = method, path
        self.request_may_have_succeeded = method != "GET"
        super().__init__(
            "Could not receive a response from the API service. The request was not retried."
        )


class ProtocolError(SamanError):
    """The response was invalid JSON, unexpected, or too large."""


class PaginationError(SamanError):
    """Pagination repeated a page or exhausted its explicit page budget."""


def response_error(status: int, payload: Any, method: str, path: str) -> ApiError:
    data = payload if isinstance(payload, dict) else {}
    auth = data.get("auth") or {}
    action = data.get("nextAction") or (
        auth.get("nextAction") if isinstance(auth, dict) else None
    )
    if not isinstance(action, str):
        action = None
    cls: type[ApiError]
    if action == "change_password_in_bank_app":
        cls = PasswordChangeRequired
    elif action in {"verify_otp", "otp_request"} or data.get("code") == 1403:
        cls = DeviceVerificationRequired
    elif status == 401:
        cls = AuthenticationError
    elif status == 400:
        cls = ValidationError
    elif status == 422:
        cls = BankError
    else:
        cls = ApiError
    return cls(status, payload, method, path)
