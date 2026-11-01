"""Read deposits from your running Saman HTTP service."""
import json
from saman_mobillet import Client

with Client() as client:
    print(json.dumps(client.deposits(), ensure_ascii=False, indent=2))
