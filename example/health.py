"""Read health from your running Saman HTTP service."""
import json
from samanapi import Client

with Client() as client:
    print(json.dumps(client.health(), ensure_ascii=False, indent=2))
