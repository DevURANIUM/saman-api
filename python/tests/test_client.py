import asyncio
import json
import unittest

import httpx

from saman_mobillet import Client, AsyncClient
from saman_mobillet.errors import (
    ApiError,
    AuthenticationError,
    ProtocolError,
    TransportError,
)


class ClientTests(unittest.TestCase):
    def make(self, handler, **options):
        client = Client(
            api_key="private-api-key", transport=httpx.MockTransport(handler), **options
        )
        self.addCleanup(client.close)
        return client

    def test_query_types_and_identifiers_are_preserved(self):
        seen = []
        client = self.make(
            lambda req: (
                seen.append(req)
                or httpx.Response(
                    200, json={"elements": [{"extra": {"reference": "0001"}}]}
                )
            )
        )
        result = client.transactions(
            "001-234-0000001-2", details=False, is_withdrawal=False, page=0
        )
        self.assertEqual(seen[0].headers["x-api-key"], "private-api-key")
        self.assertEqual(seen[0].url.path, "/v1/transactions")
        self.assertEqual(seen[0].url.params["details"], "false")
        self.assertEqual(seen[0].url.params["isWithdrawal"], "false")
        self.assertEqual(seen[0].url.params["depositNumber"], "001-234-0000001-2")
        self.assertEqual(result["elements"][0]["extra"]["reference"], "0001")

    def test_opaque_id_is_one_encoded_segment(self):
        seen = []
        client = self.make(
            lambda req: seen.append(req.url.raw_path) or httpx.Response(200, json={})
        )
        client.transaction_detail("a/b+c?d#e")
        self.assertEqual(seen[0], b"/v1/transactions/a%2Fb%2Bc%3Fd%23e")

    def test_headers_cannot_escape_to_a_different_origin(self):
        client = self.make(lambda req: self.fail("must reject before I/O"))
        for route in [
            "https://evil.example/cards",
            "//evil.example/cards",
            "../cards",
            "%2e%2e/cards",
        ]:
            with self.assertRaises(ValueError):
                client.request("GET", route)

    def test_errors_preserve_payload_without_leaking_it_in_repr(self):
        client = self.make(
            lambda req: httpx.Response(
                401, json={"error": "secret echoed by server", "code": -401}
            )
        )
        with self.assertRaises(AuthenticationError) as cm:
            client.cards()
        self.assertEqual(cm.exception.code, -401)
        self.assertEqual(cm.exception.payload["error"], "secret echoed by server")
        self.assertNotIn("secret", str(cm.exception))
        self.assertNotIn("private-api-key", repr(client))

    def test_payments_are_never_retried_or_redirected(self):
        calls = []

        def handler(req):
            calls.append(req)
            raise httpx.ReadTimeout("timeout", request=req)

        client = self.make(handler)
        with self.assertRaises(TransportError):
            client.transfer_deposit("12345", "67890", 10000)
        self.assertEqual(len(calls), 1)
        redirect = self.make(
            lambda req: httpx.Response(
                307, headers={"location": "https://evil.example/"}
            )
        )
        with self.assertRaises(ApiError):
            redirect.cards()

    def test_bad_json_and_oversized_responses_are_explicit(self):
        for response in [
            httpx.Response(200, text="not JSON"),
            httpx.Response(200, json=None),
        ]:
            with self.assertRaises(ProtocolError):
                self.make(lambda req: response).cards()
        with self.assertRaises(ProtocolError):
            self.make(
                lambda req: httpx.Response(200, json={"data": "x" * 1000}),
                max_response_bytes=100,
            ).cards()

    def test_sign_in_collects_code_without_duplicate_sms(self):
        seen = []

        def handler(req):
            seen.append(
                (req.url.path, json.loads(req.content) if req.content else None)
            )
            if req.url.path.endswith("/auth/login"):
                return httpx.Response(
                    200,
                    json={"otpRequired": True, "otpSent": True, "bankVerified": False},
                )
            return httpx.Response(
                200, json={"loggedIn": True, "bankVerified": True, "otpRequired": False}
            )

        result = self.make(handler).sign_in(
            "example", "example-password", otp_callback=lambda: "001234"
        )
        self.assertTrue(result["bankVerified"])
        self.assertEqual([r[0] for r in seen], ["/v1/auth/login", "/v1/auth/otp"])
        self.assertEqual(seen[1][1], {"code": "001234"})


class AsyncTests(unittest.IsolatedAsyncioTestCase):
    async def test_async_client_uses_the_same_contract(self):
        seen = []

        async def handler(req):
            seen.append(req)
            return httpx.Response(200, json={"cards": [], "extra": True})

        async with AsyncClient(transport=httpx.MockTransport(handler)) as client:
            result = await client.cards()
        self.assertTrue(result["extra"])
        self.assertEqual(seen[0].url.path, "/v1/cards")


if __name__ == "__main__":
    unittest.main()
