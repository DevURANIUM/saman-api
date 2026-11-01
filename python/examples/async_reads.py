"""Read-only async example; requires an authenticated API server session."""

import asyncio
from samanapi import AsyncClient


async def main():
    async with AsyncClient() as client:
        print(await client.check_session())
        print(await client.cards())
        print(await client.deposits())


if __name__ == "__main__":
    asyncio.run(main())
