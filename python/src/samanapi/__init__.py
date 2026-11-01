"""Saman Mobillet HTTP SDK. Requires a separately running API service."""

from .client import Client
from .async_client import AsyncClient
from . import errors
from .errors import (
    SamanError,
    ApiError,
    AuthenticationError,
    DeviceVerificationRequired,
    PasswordChangeRequired,
    ValidationError,
    BankError,
    SmsDeliveryError,
    ProtocolError,
    TransportError,
    PaginationError,
)

__version__ = "0.1.0"
__all__ = [
    "Client",
    "AsyncClient",
    "errors",
    "SamanError",
    "ApiError",
    "AuthenticationError",
    "DeviceVerificationRequired",
    "PasswordChangeRequired",
    "ValidationError",
    "BankError",
    "SmsDeliveryError",
    "ProtocolError",
    "TransportError",
    "PaginationError",
]
