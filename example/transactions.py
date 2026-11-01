"""Read the latest transactions for an explicitly selected deposit."""
import argparse
import json
from samanapi import Client

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("deposit_number")
parser.add_argument("--limit", type=int, default=10)
args = parser.parse_args()
with Client() as client:
    result = client.latest_transactions(args.deposit_number, limit=args.limit)
    print(json.dumps(result, ensure_ascii=False, indent=2))
