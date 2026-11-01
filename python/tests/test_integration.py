import shutil
import subprocess
import unittest
from pathlib import Path
from samanapi import Client, AsyncClient, AuthenticationError


class ServiceIntegrationTests(unittest.IsolatedAsyncioTestCase):
    async def test_real_http_server_login_session_and_full_responses(self):
        fixture = Path(__file__).with_name("fake_service.cjs")
        server = fixture.parents[2] / "server.js"
        if not shutil.which("node") or not server.exists():
            self.skipTest(
                "Node service is not included in the standalone SDK distribution"
            )
        probe = subprocess.run(
            ["node", "-e", "require('express')"],
            cwd=server.parent,
            capture_output=True,
            timeout=10,
        )
        if probe.returncode:
            self.skipTest("Install Node service dependencies to run integration tests")
        process = subprocess.Popen(
            ["node", str(fixture)],
            stdin=subprocess.PIPE,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
        )
        try:
            # A bounded background read prevents a broken fixture from hanging CI.
            import asyncio

            line = await asyncio.wait_for(
                asyncio.to_thread(process.stdout.readline), timeout=10
            )
            self.assertTrue(line.strip().isdigit(), "Fixture did not start")
            base = "http://127.0.0.1:" + line.strip()
            with Client(base, api_key="offline-test-key") as client:
                self.assertTrue(client.health()["ok"])
                pending = client.login("example", "offline-password")
                self.assertTrue(pending["otpSent"])
                ready = client.sign_in(otp_callback=lambda: "000001")
                self.assertTrue(ready["loggedIn"])
                self.assertTrue(ready["bankVerified"])
                self.assertTrue(
                    client.deposits()["elements"][0]["unknownBankField"]["kept"]
                )
                rows = client.transactions(deposit_number="000123")
                self.assertEqual(rows["depositNumber"], "000123")
                self.assertEqual(rows["elements"][0]["referenceNumber"], "000000002")
            async with AsyncClient(base, api_key="offline-test-key") as client:
                self.assertTrue((await client.check_session())["bankVerified"])
            with Client(base, api_key="wrong-key") as client:
                with self.assertRaises(AuthenticationError):
                    client.deposits()
        finally:
            process.terminate()
            try:
                process.communicate(timeout=5)
            except subprocess.TimeoutExpired:
                process.kill()
                process.communicate(timeout=5)
