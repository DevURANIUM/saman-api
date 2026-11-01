import asyncio
import io
import json
import os
import unittest
from unittest.mock import patch

import httpx
from samanapi import (
    Client,
    AsyncClient,
    PaginationError,
    ProtocolError,
    SmsDeliveryError,
    TransportError,
)
from samanapi.cli import main


class WorkflowTests(unittest.TestCase):
    def test_query_arrays_are_repeated_and_unknown_fields_survive(self):
        requests = []
        with Client(
            transport=httpx.MockTransport(
                lambda req: (
                    requests.append(req)
                    or httpx.Response(
                        200, json={"wallets": {"elements": [], "extra": 1}}
                    )
                )
            )
        ) as client:
            result = client.digital_rial_wallets(
                wallet_states=["NORMAL", "BAN"], wallet_types=["CUSTOMER"]
            )
        self.assertEqual(
            requests[0].url.params.get_list("walletStates"), ["NORMAL", "BAN"]
        )
        self.assertEqual(result["wallets"]["extra"], 1)

    def test_iterator_stops_and_reports_a_budget_limit_or_repeated_page(self):
        for mode in ["complete", "budget", "repeat"]:
            count = 0

            def handler(req):
                nonlocal count
                count += 1
                row = {
                    "id": "1" if mode == "repeat" else str(count),
                    "extra": {"preserved": True},
                }
                return httpx.Response(
                    200,
                    json={
                        "elements": [row],
                        "hasNext": mode != "complete" or count < 2,
                    },
                )

            with Client(transport=httpx.MockTransport(handler)) as client:
                iterator = client.iter_transactions("12345", size=1, max_pages=2)
                self.assertTrue(next(iterator)["extra"]["preserved"])
                if mode == "repeat":
                    with self.assertRaises(PaginationError):
                        next(iterator)
                else:
                    self.assertTrue(next(iterator)["extra"]["preserved"])
                    if mode == "budget":
                        with self.assertRaises(PaginationError):
                            next(iterator)
                    else:
                        with self.assertRaises(StopIteration):
                            next(iterator)

    def test_sign_in_resumes_without_replacing_session_or_sending_sms(self):
        seen = []

        def handler(req):
            seen.append(req.url.path)
            result = (
                {"state": "otp_required"}
                if req.url.path.endswith("/session")
                else {"otpRequired": True, "otpSent": True}
                if req.url.path.endswith("/ensure")
                else {"loggedIn": True, "bankVerified": True}
            )
            return httpx.Response(200, json=result)

        with Client(transport=httpx.MockTransport(handler)) as client:
            self.assertTrue(
                client.sign_in(otp_callback=lambda: "000001")["bankVerified"]
            )
        self.assertEqual(
            seen, ["/v1/auth/session", "/v1/auth/session/ensure", "/v1/auth/otp"]
        )

    def test_sms_failure_does_not_request_another_sms(self):
        seen = []
        with Client(
            transport=httpx.MockTransport(
                lambda req: (
                    seen.append(req)
                    or httpx.Response(
                        200,
                        json={
                            "otpRequired": True,
                            "otpSent": False,
                            "nextAction": "otp_request",
                        },
                    )
                )
            )
        ) as client:
            with self.assertRaises(SmsDeliveryError):
                client.sign_in(
                    "example",
                    "secret",
                    otp_callback=lambda: self.fail("must not prompt"),
                )
        self.assertEqual(len(seen), 1)

    def test_sign_in_requires_explicit_verified_success(self):
        with Client(
            transport=httpx.MockTransport(lambda req: httpx.Response(200, json={}))
        ) as client:
            with self.assertRaises(ProtocolError):
                client.sign_in("example", "secret")

    def test_amount_and_base_url_validation_prevent_unsafe_requests(self):
        for base in [
            "https://user:secret@example.test",
            "https://example.test?key=secret",
            "ftp://example.test",
        ]:
            with self.assertRaises(ValueError):
                Client(base_url=base)
        with Client(
            transport=httpx.MockTransport(
                lambda req: self.fail("must validate before I/O")
            )
        ) as client:
            for amount in [True, 0, -1, 0.1, 9007199254740992]:
                with self.assertRaises(ValueError):
                    client.transfer_deposit("12345", "67890", amount)

    def test_cli_cancelled_payment_never_calls_the_service(self):
        from samanapi.cli import parser

        argument_parser = parser()
        with (
            patch("samanapi.cli.parser", return_value=argument_parser),
            patch("samanapi.cli.Client") as factory,
            patch("sys.stdout", new_callable=io.StringIO),
            patch("sys.stderr", new_callable=io.StringIO),
        ):
            code = main(
                ["transfer-deposit", "12345", "67890", "10000", "--confirm", "NO"]
            )
            self.assertEqual(code, 1)
            factory.return_value.__enter__.return_value.transfer_deposit.assert_not_called()

    def test_cli_covers_every_endpoint_method(self):
        from samanapi.cli import parser

        args = parser().parse_args(
            [
                "transactions",
                "--deposit-number",
                "00123",
                "--details",
                "false",
                "--page",
                "0",
            ]
        )
        self.assertEqual(args.deposit_number, "00123")
        self.assertFalse(args.details)
        self.assertEqual(args.page, 0)

    def test_cli_eof_cancels_before_login_request(self):
        with (
            patch.dict(
                "os.environ",
                {"SAMAN_API_URL": "http://127.0.0.1:8089", "SAMAN_API_KEY": ""},
            ),
            patch("samanapi.cli.prompt", side_effect=EOFError),
            patch("samanapi.cli.Client.request") as request,
            patch("sys.stderr", new_callable=io.StringIO),
        ):
            os.environ.pop("SAMAN_PASS", None)
            self.assertEqual(main(["login", "example"]), 130)
            request.assert_not_called()


class AsyncWorkflowTests(unittest.IsolatedAsyncioTestCase):
    async def test_sign_in_accepts_async_callback_and_keeps_code_zeros(self):
        requests = []

        async def handler(req):
            requests.append(req)
            return httpx.Response(
                200,
                json={"otpRequired": True, "otpSent": True}
                if req.url.path.endswith("/login")
                else {"loggedIn": True, "bankVerified": True},
            )

        async def code():
            await asyncio.sleep(0)
            return "000001"

        async with AsyncClient(transport=httpx.MockTransport(handler)) as client:
            result = await client.sign_in("example", "secret", otp_callback=code)
        self.assertTrue(result["bankVerified"])
        self.assertEqual(json.loads(requests[1].content)["code"], "000001")

    async def test_async_iterator_is_bounded_and_async_payment_is_not_retried(self):
        calls = []

        async def handler(req):
            calls.append(req)
            if req.method == "POST":
                raise httpx.ReadTimeout("timeout", request=req)
            return httpx.Response(
                200,
                json={"elements": [{"id": str(len(calls))}], "hasNext": len(calls) < 2},
            )

        async with AsyncClient(transport=httpx.MockTransport(handler)) as client:
            rows = [
                row
                async for row in client.iter_transactions("12345", size=1, max_pages=2)
            ]
            self.assertEqual(len(rows), 2)
            with self.assertRaises(TransportError):
                await client.transfer_deposit("12345", "67890", 10000)
        self.assertEqual(len(calls), 3)
