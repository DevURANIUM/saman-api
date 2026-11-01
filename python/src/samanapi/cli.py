"""English CLI for every endpoint of the Saman HTTP client."""

from __future__ import annotations

import argparse
import getpass
import inspect
import json
import os
from pathlib import Path
import sys
from typing import Any

from .client import Client
from .errors import ApiError, SamanError

INTS = {
    "amount",
    "page",
    "size",
    "limit",
    "pages",
    "max_transactions",
    "from_date",
    "to_date",
    "offset",
    "length",
}
BOOLS = {"details", "is_withdrawal", "is_most_referred_destination", "request_otp"}
LISTS = {"wallet_states", "wallet_types"}
SECRETS = {"cvv2", "pin2", "transaction_pin"}
CONFIRM = {
    "transfer_card": "TRANSFER",
    "transfer_deposit": "TRANSFER",
    "transfer_iban": "TRANSFER",
    "charge_digital_rial": "TRANSFER",
    "discharge_digital_rial": "TRANSFER",
    "activate_digital_rial": "ACTIVATE",
    "deactivate_digital_rial": "DEACTIVATE",
}
ALIASES = {
    "otp": "verify_otp",
    "otp-request": "request_otp",
    "cards-all": "all_cards",
    "deposits-all": "all_deposits",
    "transactions-latest": "latest_transactions",
    "transaction-find": "find_transaction",
    "balance-deposits": "deposit_balances",
    "balance-cards": "card_balances",
    "check-session": "check_session",
}


def boolean(value: str) -> bool:
    if value.lower() not in {"true", "false"}:
        raise argparse.ArgumentTypeError("Use true or false.")
    return value.lower() == "true"


def prompt(label: str, secret: bool = False) -> str:
    if not sys.stdin.isatty():
        raise ValueError(
            "An interactive terminal is required for this prompt. Use the Python client with an OTP callback for automation."
        )
    return getpass.getpass(label) if secret else input(label)


def parser() -> argparse.ArgumentParser:
    root = argparse.ArgumentParser(
        prog="saman-api",
        description="Saman Mobillet HTTP API client. A running API service is required.",
    )
    root.add_argument(
        "--base-url",
        default=None,
        help="API URL, or SAMAN_API_URL; defaults to http://127.0.0.1:8089/v1",
    )
    root.add_argument(
        "--timeout",
        type=float,
        default=120.0,
        help="Request timeout in seconds (default: 120)",
    )
    root.add_argument(
        "--json-errors",
        action="store_true",
        help="Print structured English errors to stderr",
    )
    commands = root.add_subparsers(dest="command", required=True)
    login = commands.add_parser(
        "login", help="Ask for credentials, then the SMS code; resume a pending login"
    )
    login.add_argument("username", nargs="?")
    login.set_defaults(operation="sign_in")
    for name, function in inspect.getmembers(Client):
        if not hasattr(function, "__endpoint__") or name in {"login", "import_har"}:
            continue
        route = commands.add_parser(
            name.replace("_", "-"),
            aliases=[
                alias
                for alias, target in ALIASES.items()
                if target == name and alias != name.replace("_", "-")
            ],
            help=(
                inspect.getdoc(function)
                or f"{function.__endpoint__[0]} {function.__endpoint__[1]}"
            ).splitlines()[0],
        )
        route.set_defaults(operation=name)
        for key, parameter in inspect.signature(function).parameters.items():
            if key == "self":
                continue
            required = parameter.default is parameter.empty
            positional = required and parameter.kind is not parameter.KEYWORD_ONLY
            kind = (
                int
                if key in INTS
                else boolean
                if key in BOOLS
                else (lambda text: text.split(","))
                if key in LISTS
                else str
            )
            options: dict[str, Any] = {"type": kind}
            if not positional:
                options["dest"] = key
                options["default"] = None if required else parameter.default
                options["required"] = required and key not in SECRETS
            route.add_argument(
                key if positional else "--" + key.replace("_", "-"), **options
            )
        if name in CONFIRM:
            route.add_argument(
                "--confirm", help=f"Explicit confirmation: {CONFIRM[name]}"
            )
    har = commands.add_parser("import-har", help="Import a private local HAR file")
    har.add_argument("file", type=Path)
    har.set_defaults(operation="import_har_file")
    call = commands.add_parser("call", help="Call a relative API route")
    call.add_argument("method", choices=["GET", "POST"])
    call.add_argument("path")
    call.add_argument("--body-file", type=Path)
    call.add_argument("--query", type=json.loads, default=None)
    call.add_argument("--confirm", help="POST calls require SEND")
    call.set_defaults(operation="request")
    return root


def confirm(expected: str, supplied: str | None) -> None:
    actual = (
        supplied if supplied is not None else prompt(f"Type {expected} to confirm: ")
    )
    if actual.strip() != expected:
        raise ValueError("Operation cancelled.")


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        with Client(base_url=args.base_url, timeout=args.timeout) as client:
            if args.operation == "sign_in":
                result = client.sign_in(
                    args.username or os.environ.get("SAMAN_USER"),
                    os.environ.get("SAMAN_PASS"),
                    username_callback=lambda: prompt("Username: "),
                    password_callback=lambda: prompt("Password: ", True),
                    otp_callback=lambda: prompt(
                        "SMS code (type resend for a new code): ", True
                    ),
                )
            elif args.operation == "import_har_file":
                result = client.import_har_file(args.file)
            elif args.operation == "request":
                if args.method == "POST":
                    confirm("SEND", args.confirm)
                body = (
                    json.loads(args.body_file.read_text(encoding="utf-8-sig"))
                    if args.body_file
                    else None
                )
                result = client.request(
                    args.method, args.path, body=body, query=args.query
                )
            else:
                if args.operation in CONFIRM:
                    confirm(CONFIRM[args.operation], args.confirm)
                function = getattr(client, args.operation)
                values = {
                    key: getattr(args, key)
                    for key in inspect.signature(function).parameters
                }
                for key in SECRETS:
                    if (
                        key in values
                        and values[key] is None
                        and inspect.signature(function).parameters[key].default
                        is inspect.Parameter.empty
                    ):
                        values[key] = prompt(key.upper() + ": ", True)
                result = function(**values)
            print(json.dumps(result, ensure_ascii=False, indent=2))
        return 0
    except (KeyboardInterrupt, EOFError):
        print("Cancelled.", file=sys.stderr)
        return 130
    except (SamanError, ValueError, OSError) as error:
        if args.json_errors:
            print(
                json.dumps(
                    {
                        "error": str(error),
                        "status": getattr(error, "status_code", None),
                        "code": getattr(error, "code", None),
                    },
                    ensure_ascii=False,
                ),
                file=sys.stderr,
            )
        else:
            print(str(error), file=sys.stderr)
        return 1
