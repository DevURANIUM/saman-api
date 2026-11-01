"""Log in through your HTTP service with interactive password and SMS prompts."""
import json
from saman_mobillet import Client

with Client() as client:
    print(json.dumps(client.sign_in(), ensure_ascii=False, indent=2))
