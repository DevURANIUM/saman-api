"""Stable local workflow fields; bank-specific response fields remain open JSON."""

from typing import Any, Callable, Literal, TypeVar, TypedDict

F = TypeVar("F", bound=Callable[..., Any])

JSONResponse = dict[str, Any]
MatchBy = Literal["any", "tracking", "reference"]
DestinationKind = Literal["card", "deposit", "iban"]
WalletType = Literal["CUSTOMER", "BUSINESS"]


class Session(TypedDict, total=False):
    ok: bool
    loggedIn: bool
    hasToken: bool
    state: str
    bankVerified: bool
    expiresAt: int | None
    expiresIn: int | None
    trustedDevice: bool | None
    shouldChangePassword: bool
    otpRequired: bool
    otpSent: bool
    nextAction: str | None
    renewed: bool
    credentialsRequired: bool
    otpError: dict[str, Any]
    otpRequest: dict[str, Any]


class TransactionSearchResult(TypedDict, total=False):
    found: bool
    trackingNumber: str
    depositNumber: str
    matchBy: str
    matchedField: str
    transaction: dict[str, Any]
    pagesScanned: int
    transactionsScanned: int
    searchComplete: bool
    stopReason: str


def endpoint(method: str, path: str) -> Callable[[F], F]:
    """Attach route metadata without changing the method signature."""

    def decorate(function: F) -> F:
        setattr(function, "__endpoint__", (method, path))
        return function

    return decorate
