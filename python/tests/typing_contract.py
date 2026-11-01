"""Consumer type checks; these functions are checked by mypy, never executed."""

from typing import Any
from saman_mobillet import Client, AsyncClient


def sync_consumer(client: Client) -> dict[str, Any]:
    result: dict[str, Any] = client.cards()
    client.transfer_deposit("0001", "0002", "10000")  # type: ignore[arg-type]
    return result


async def async_consumer(client: AsyncClient) -> dict[str, Any]:
    result: dict[str, Any] = await client.cards()
    await client.transfer_deposit("0001", "0002", "10000")  # type: ignore[arg-type]
    return result
