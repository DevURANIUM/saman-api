"""One request per call: no redirect following and no automatic retries."""

from __future__ import annotations

import asyncio
import inspect
import json
from typing import Any, Callable, Mapping
from urllib.parse import quote, unquote, urlsplit, urlunsplit

import httpx

from .errors import ProtocolError, TransportError, response_error


def base_url(value: str) -> str:
    parts = urlsplit(value)
    if (
        parts.scheme not in {"http", "https"}
        or not parts.hostname
        or parts.username
        or parts.password
        or parts.query
        or parts.fragment
    ):
        raise ValueError(
            "base_url must be an HTTP(S) URL without credentials, query, or fragment."
        )
    prefix = parts.path.rstrip("/")
    if not prefix.endswith("/v1"):
        prefix += "/v1"
    return urlunsplit((parts.scheme, parts.netloc, prefix, "", ""))


def identifier(value: str) -> str:
    if (
        not isinstance(value, str)
        or not value
        or value in {".", ".."}
        or any(ord(c) < 32 for c in value)
    ):
        raise ValueError(
            "Identifiers must be non-empty strings, preserving leading zeros."
        )
    return quote(value, safe="")


def integer(
    value: int, name: str, minimum: int = 0, maximum: int = 9007199254740991
) -> int:
    if (
        isinstance(value, bool)
        or not isinstance(value, int)
        or not minimum <= value <= maximum
    ):
        raise ValueError(f"{name} must be an integer between {minimum} and {maximum}.")
    return value


def params(values: Mapping[str, Any] | None) -> list[tuple[str, str]]:
    result = []
    for key, value in (values or {}).items():
        if value is None:
            continue
        for item in value if isinstance(value, (list, tuple)) else [value]:
            if not isinstance(item, (str, int, float, bool)):
                raise ValueError(f"Unsupported query value for {key}.")
            result.append(
                (key, str(item).lower() if isinstance(item, bool) else str(item))
            )
    return result


def route_path(route: str) -> str:
    parts = urlsplit(route)
    if parts.scheme or parts.netloc or parts.query or parts.fragment or "\\" in route:
        raise ValueError(
            "Request paths must be relative API routes without a query or fragment."
        )
    if any(segment in {".", ".."} for segment in unquote(parts.path).split("/")):
        raise ValueError("Path traversal is not allowed.")
    return route.lstrip("/")


def compact(values: Mapping[str, Any]) -> dict[str, Any]:
    return {key: value for key, value in values.items() if value is not None}


def decode(status: int, raw: bytes, method: str, path: str) -> dict[str, Any]:
    try:
        payload = json.loads(raw)
    except (ValueError, UnicodeError, RecursionError):
        if status >= 300:
            raise response_error(
                status, raw.decode("utf-8", "replace"), method, path
            ) from None
        raise ProtocolError("The API service returned invalid JSON.") from None
    if not 200 <= status < 300:
        raise response_error(status, payload, method, path)
    if not isinstance(payload, dict):
        raise ProtocolError("Expected a JSON object from the API service.")
    if isinstance(payload.get("error"), str):
        raise response_error(status, payload, method, path)
    return payload


def send(
    client: httpx.Client,
    method: str,
    url: str,
    *,
    headers: Mapping[str, str],
    query: Any,
    body: Any,
    limit: int,
) -> dict[str, Any]:
    try:
        with client.stream(
            method,
            url,
            headers=headers,
            params=query,
            json=body,
            follow_redirects=False,
        ) as response:
            chunks, size = [], 0
            for chunk in response.iter_bytes():
                size += len(chunk)
                if size > limit:
                    raise ProtocolError("The API response exceeded max_response_bytes.")
                chunks.append(chunk)
            return decode(
                response.status_code, b"".join(chunks), method, urlsplit(url).path
            )
    except httpx.RequestError:
        raise TransportError(method, urlsplit(url).path) from None


async def async_send(
    client: httpx.AsyncClient,
    method: str,
    url: str,
    *,
    headers: Mapping[str, str],
    query: Any,
    body: Any,
    limit: int,
) -> dict[str, Any]:
    try:
        async with client.stream(
            method,
            url,
            headers=headers,
            params=query,
            json=body,
            follow_redirects=False,
        ) as response:
            chunks, size = [], 0
            async for chunk in response.aiter_bytes():
                size += len(chunk)
                if size > limit:
                    raise ProtocolError("The API response exceeded max_response_bytes.")
                chunks.append(chunk)
            return decode(
                response.status_code, b"".join(chunks), method, urlsplit(url).path
            )
    except httpx.RequestError:
        raise TransportError(method, urlsplit(url).path) from None


def collect(callback: Callable[[], str]) -> str:
    result = callback()
    if not isinstance(result, str):
        raise ValueError("The input callback must return a string.")
    return result


async def async_collect(callback: Callable[..., Any]) -> str:
    result = (
        await callback()
        if inspect.iscoroutinefunction(callback)
        else await asyncio.to_thread(callback)
    )
    if inspect.isawaitable(result):
        result = await result
    if not isinstance(result, str):
        raise ValueError("The input callback must return a string.")
    return result
