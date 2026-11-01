"""Search deposit history for an exact tracking or reference number."""
import argparse
import json
from samanapi import Client

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("code")
parser.add_argument("deposit_number")
parser.add_argument("--match-by", choices=["any", "tracking", "reference"], default="any")
args = parser.parse_args()
with Client() as client:
    result = client.find_transaction(args.code, args.deposit_number, match_by=args.match_by)
    print(json.dumps(result, ensure_ascii=False, indent=2))
