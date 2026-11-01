import inspect
import json
from pathlib import Path
import unittest

import httpx
from saman_mobillet import Client, AsyncClient

SPEC = Path(__file__).resolve().parents[2] / "docs" / "openapi.json"
VALUES = {
    "username": "example",
    "password": "example-password",
    "code": "001234",
    "har": {"log": {"entries": []}},
    "transaction_id": "000001",
    "account_number": "12345",
    "iban": "IR000000000000000000000000",
    "deposit_number": "12345",
    "terminal_id": "12345",
    "kind": "card",
    "amount": 10000,
    "source": "0000000000000000",
    "destination": "1111111111111111",
    "reason_code": "GPAC",
    "cvv2": "123",
    "pin2": "123456",
    "expire_date": "140801",
    "verification_code": "123456",
    "wallet_id": "00000000-0000-4000-8000-000000000001",
}


class ContractTests(unittest.TestCase):
    @unittest.skipUnless(
        SPEC.exists(),
        "Repository API specification is not included in the standalone SDK sdist",
    )
    def test_every_api_operation_has_a_method_and_valid_parameter_names(self):
        spec = json.loads(SPEC.read_text(encoding="utf8"))
        routes = {
            (method.upper(), route)
            for route, methods in spec["paths"].items()
            for method in methods
        }
        methods = {
            name: method
            for name, method in inspect.getmembers(Client)
            if hasattr(method, "__endpoint__")
        }
        self.assertEqual(routes, {method.__endpoint__ for method in methods.values()})
        seen = []
        with Client(
            transport=httpx.MockTransport(
                lambda req: seen.append(req) or httpx.Response(200, json={})
            )
        ) as client:
            for name, function in methods.items():
                with self.subTest(method=name):
                    signature = inspect.signature(function)
                    arguments = {
                        key: VALUES[key]
                        for key, param in signature.parameters.items()
                        if key != "self" and param.default is param.empty
                    }
                    getattr(client, name)(**arguments)
                    request = seen[-1]
                    verb, route = function.__endpoint__
                    self.assertEqual(request.method, verb)
                    operation = spec["paths"][route][verb.lower()]
                    query_names = {
                        p["name"]
                        for p in operation.get("parameters", [])
                        if p["in"] == "query"
                    }
                    self.assertLessEqual(set(request.url.params.keys()), query_names)
                    if request.content:
                        body = json.loads(request.content)
                        schema = (
                            operation.get("requestBody", {})
                            .get("content", {})
                            .get("application/json", {})
                            .get("schema", {})
                        )
                        if schema.get("additionalProperties") is False:
                            self.assertLessEqual(
                                set(body), set(schema.get("properties", {}))
                            )
                            self.assertLessEqual(
                                set(schema.get("required", [])), set(body)
                            )

    def test_async_signatures_and_routes_match_sync(self):
        for name, method in inspect.getmembers(Client):
            if not hasattr(method, "__endpoint__"):
                continue
            other = getattr(AsyncClient, name)
            self.assertTrue(inspect.iscoroutinefunction(other), name)
            self.assertEqual(method.__endpoint__, other.__endpoint__)
            self.assertEqual(
                str(inspect.signature(method)), str(inspect.signature(other))
            )
