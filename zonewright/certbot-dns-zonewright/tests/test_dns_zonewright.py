"""Tests for certbot_dns_zonewright.dns_zonewright."""

import json
import threading
import unittest
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest import mock
from urllib.parse import parse_qs, unquote, urlparse

from certbot import errors
from certbot.compat import os
from certbot.plugins import dns_test_common
from certbot.plugins.dns_test_common import DOMAIN
from certbot.tests import util as test_util

from certbot_dns_zonewright.dns_zonewright import Authenticator, _ZonewrightClient

TOKEN = "acme-token"


class FakeZonewright:
    """Just enough of zonewright's API: /lookup, add and delete TXT records,
    bearer auth, and the acme scope's record rule."""

    def __init__(self):
        self.zones = {"example.com": [], "sub.example.com": [], "static.org": []}
        self.local = {"static.org"}
        self.requests = []
        self.replicated = True
        fake = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args):
                pass

            def _send(self, code, body):
                raw = json.dumps(body).encode()
                self.send_response(code)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(raw)))
                self.end_headers()
                self.wfile.write(raw)

            def _handle(self, method):
                url = urlparse(self.path)
                query = {k: v[0] for k, v in parse_qs(url.query).items()}
                length = int(self.headers.get("Content-Length") or 0)
                body = json.loads(self.rfile.read(length)) if length else None
                fake.requests.append((method, url.path, query, body, dict(self.headers)))
                if self.headers.get("Authorization") != f"Bearer {TOKEN}":
                    return self._send(401, {"error": "unauthorized"})
                parts = [unquote(p) for p in url.path.strip("/").split("/")]
                if method == "GET" and parts == ["lookup"]:
                    return self._lookup(query.get("name", ""))
                if len(parts) >= 3 and parts[0] == "zones" and parts[2] == "records":
                    zone = parts[1]
                    if zone not in fake.zones:
                        return self._send(404, {"error": f"zone {zone} not found"})
                    if method == "POST" and len(parts) == 3:
                        return self._add(zone, body)
                    if method == "DELETE" and len(parts) == 5:
                        return self._delete(zone, parts[3], parts[4], query.get("value"))
                self._send(404, {"error": "no route"})

            def _lookup(self, name):
                best = None
                for zone in fake.zones:
                    if name == zone or name.endswith("." + zone):
                        if best is None or len(zone) > len(best):
                            best = zone
                if best is None:
                    return self._send(404, {"error": f"no zone holds {name}"})
                rel = "@" if name == best else name[: -len(best) - 1]
                local = best in fake.local
                self._send(200, {"zone": best, "name": rel, "source": "local" if local else "replicated", "writable": not local})

            def _add(self, zone, rec):
                if rec["type"] != "TXT" or not rec["name"].startswith("_acme-challenge"):
                    return self._send(403, {"error": "token acme may only write _acme-challenge TXT"})
                if any(r["name"] == rec["name"] and r["value"] == rec["value"] for r in fake.zones[zone]):
                    return self._send(409, {"error": "record already exists"})
                fake.zones[zone].append(rec)
                if not fake.replicated:
                    return self._send(202, {"status": "updated", "replicated": False, "pending_peers": ["n-2"]})
                self._send(201, {"status": "created", "replicated": True})

            def _delete(self, zone, name, typ, value):
                before = len(fake.zones[zone])
                fake.zones[zone] = [r for r in fake.zones[zone] if not (r["name"] == name and r["type"] == typ and (value is None or r["value"] == value))]
                if len(fake.zones[zone]) == before:
                    return self._send(404, {"error": "no record matched"})
                self._send(200, {"status": "updated"})

            def do_GET(self):
                self._handle("GET")

            def do_POST(self):
                self._handle("POST")

            def do_DELETE(self):
                self._handle("DELETE")

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.url = f"http://127.0.0.1:{self.server.server_address[1]}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)
        self.thread.start()

    def stop(self):
        self.server.shutdown()
        self.server.server_close()


class ClientTest(unittest.TestCase):
    def setUp(self):
        self.fake = FakeZonewright()
        self.client = _ZonewrightClient(self.fake.url, TOKEN, wait_timeout=5)

    def tearDown(self):
        self.fake.stop()

    def test_add_and_delete_apex_and_wildcard_values(self):
        self.client.add_txt_record("_acme-challenge.example.com", "apex-token")
        self.client.add_txt_record("_acme-challenge.example.com", "wildcard-token")
        self.assertEqual(
            [r["value"] for r in self.fake.zones["example.com"]], ["apex-token", "wildcard-token"]
        )
        post = [r for r in self.fake.requests if r[0] == "POST"][0]
        self.assertEqual(post[1], "/zones/example.com/records")
        self.assertEqual(post[2], {"wait": "replicated", "timeout": "5s"})
        self.assertEqual(post[3], {"name": "_acme-challenge", "type": "TXT", "value": "apex-token", "ttl": 60})
        self.assertTrue(post[4]["User-Agent"].startswith("certbot-dns-zonewright/"))
        self.assertNotIn("Origin", post[4])

        self.client.del_txt_record("_acme-challenge.example.com", "apex-token")
        self.assertEqual([r["value"] for r in self.fake.zones["example.com"]], ["wildcard-token"])
        delete = [r for r in self.fake.requests if r[0] == "DELETE"][0]
        self.assertEqual(delete[1], "/zones/example.com/records/_acme-challenge/TXT")
        self.assertEqual(delete[2]["value"], "apex-token")

    def test_most_specific_zone_and_one_lookup_per_name(self):
        self.client.add_txt_record("_acme-challenge.www.sub.example.com.", "t")
        self.client.del_txt_record("_acme-challenge.www.sub.example.com.", "t")
        self.assertEqual(self.fake.zones["sub.example.com"], [])
        lookups = [r for r in self.fake.requests if r[1] == "/lookup"]
        self.assertEqual(len(lookups), 1)
        self.assertEqual(lookups[0][2]["name"], "_acme-challenge.www.sub.example.com")

    def test_duplicate_value_is_fine(self):
        self.client.add_txt_record("_acme-challenge.example.com", "same")
        self.client.add_txt_record("_acme-challenge.example.com", "same")
        self.assertEqual(len(self.fake.zones["example.com"]), 1)

    def test_not_replicated_in_time_warns_but_succeeds(self):
        self.fake.replicated = False
        with self.assertLogs("certbot_dns_zonewright.dns_zonewright", "WARNING") as logs:
            self.client.add_txt_record("_acme-challenge.example.com", "t")
        self.assertIn("n-2", logs.output[0])

    def test_unknown_zone(self):
        with self.assertRaisesRegex(errors.PluginError, "no zone for _acme-challenge.other.net"):
            self.client.add_txt_record("_acme-challenge.other.net", "t")

    def test_local_zone_refused(self):
        with self.assertRaisesRegex(errors.PluginError, "local"):
            self.client.add_txt_record("_acme-challenge.static.org", "t")

    def test_bad_token(self):
        client = _ZonewrightClient(self.fake.url, "wrong")
        with self.assertRaisesRegex(errors.PluginError, "rejected"):
            client.add_txt_record("_acme-challenge.example.com", "t")

    def test_scope_refusal_is_reported(self):
        client = _ZonewrightClient(self.fake.url, TOKEN)
        client._zones["www.example.com"] = ("example.com", "www")
        with self.assertRaisesRegex(errors.PluginError, "not allowed"):
            client.add_txt_record("www.example.com", "t")

    def test_cleanup_never_raises(self):
        self.client.del_txt_record("_acme-challenge.example.com", "never-added")
        self.client.del_txt_record("_acme-challenge.other.net", "t")
        unreachable = _ZonewrightClient("http://127.0.0.1:9", TOKEN, wait_timeout=1)
        with self.assertLogs("certbot_dns_zonewright.dns_zonewright", "WARNING"):
            unreachable.del_txt_record("_acme-challenge.example.com", "t")

    def test_unreachable_server_on_add(self):
        unreachable = _ZonewrightClient("http://127.0.0.1:9", TOKEN, wait_timeout=1)
        with self.assertRaisesRegex(errors.PluginError, "Error contacting zonewright"):
            unreachable.add_txt_record("_acme-challenge.example.com", "t")


class AuthenticatorTest(test_util.TempDirTestCase, dns_test_common.BaseAuthenticatorTest):
    def setUp(self):
        super().setUp()
        self.fake = FakeZonewright()
        self.fake.zones[DOMAIN] = []
        path = os.path.join(self.tempdir, "zonewright.ini")
        dns_test_common.write(
            {"zonewright_url": self.fake.url, "zonewright_token": TOKEN, "zonewright_wait_timeout": "5"}, path
        )
        self.config = mock.MagicMock(zonewright_credentials=path, zonewright_propagation_seconds=0)
        self.auth = Authenticator(self.config, "zonewright")

    def tearDown(self):
        self.fake.stop()
        super().tearDown()

    @test_util.patch_display_util()
    def test_perform_and_cleanup(self, _unused_mock_get_utility):
        self.auth.perform([self.achall])
        self.assertEqual(len(self.fake.zones[DOMAIN]), 1)
        self.assertEqual(self.fake.zones[DOMAIN][0]["name"], "_acme-challenge")
        self.auth.cleanup([self.achall])
        self.assertEqual(self.fake.zones[DOMAIN], [])

    def test_default_propagation_is_short(self):
        m = mock.MagicMock()
        Authenticator.add_parser_arguments(m)
        m.assert_any_call("propagation-seconds", type=int, default=10, help=mock.ANY)
        m.assert_any_call("credentials", help=mock.ANY)

    @test_util.patch_display_util()
    def test_rejects_url_without_scheme(self, _unused_mock_get_utility):
        dns_test_common.write(
            {"zonewright_url": "ns1.example.net:9053", "zonewright_token": TOKEN}, self.config.zonewright_credentials
        )
        with self.assertRaisesRegex(errors.PluginError, "must start with https://"):
            self.auth.perform([self.achall])

    @test_util.patch_display_util()
    def test_refuses_plain_http_to_a_remote_host(self, _unused_mock_get_utility):
        dns_test_common.write(
            {"zonewright_url": "http://ns1.example.net:9053", "zonewright_token": TOKEN},
            self.config.zonewright_credentials,
        )
        with self.assertRaisesRegex(errors.PluginError, "clear text"):
            self.auth.perform([self.achall])

    @test_util.patch_display_util()
    def test_plain_http_allowed_with_opt_in(self, _unused_mock_get_utility):
        dns_test_common.write(
            {
                "zonewright_url": "http://10.0.0.5:9053",
                "zonewright_token": TOKEN,
                "zonewright_allow_insecure_http": "true",
            },
            self.config.zonewright_credentials,
        )
        auth = Authenticator(self.config, "zonewright")
        auth._setup_credentials()

    @test_util.patch_display_util()
    def test_missing_token(self, _unused_mock_get_utility):
        dns_test_common.write({"zonewright_url": self.fake.url}, self.config.zonewright_credentials)
        with self.assertRaises(errors.PluginError):
            self.auth.perform([self.achall])


if __name__ == "__main__":
    unittest.main()
