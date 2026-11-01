"""Read-only example. Set SAMAN_API_URL and SAMAN_API_KEY for your API service."""

from samanapi import Client

with Client() as client:
    client.sign_in()
    print(client.deposits())
    print(client.balance())
    # Supply the deposit number from the response when multiple deposits exist.
    print(client.latest_transactions(deposit_number="123-456-0000001-2", limit=10))
