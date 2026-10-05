"""Client addresses behind a reverse proxy: BINVAULT_TRUSTED_PROXIES and X-Forwarded-For (spec 4.8, 2.3).

The brute-force counter works per client address. The address is the socket peer unless the peer is a trusted proxy,
in which case it is the right-most X-Forwarded-For entry that is not itself a trusted proxy. The tests run on private
nodes with a failure limit of 4 per minute; the harness client always connects from 127.0.0.1.
"""
import urllib.error
import urllib.request

import pytest

import bvh

LIMIT = "4"


def node_with(trusted=None):
    env = {"BINVAULT_AUTH_FAIL_LIMIT": LIMIT, "BINVAULT_FSYNC": "false"}
    if trusted is not None:
        env["BINVAULT_TRUSTED_PROXIES"] = trusted
    return bvh.Node(env=env)


def get(node, name, xff=None, creds=None):
    """One GET of a missing key; with creds=None the signature is wrong (an authentication failure)."""
    ak, sk = creds or ("BVKAAAAAAAAAAAAAAAAA", "s" * 40)
    headers = {"X-Forwarded-For": xff} if xff is not None else {}
    return bvh.Raw(ak, sk, endpoint=node.endpoint).request("GET", "/%s/k" % name, headers=headers).status


def failures(node, name, xff, n):
    return [get(node, name, xff) for _ in range(n)]


def test_forwarded_for_is_ignored_when_no_proxy_is_trusted():
    with node_with() as node:
        name, ak, sk = node.fresh_bucket("px0")
        codes = [get(node, name, "203.0.113.%d" % (10 + i)) for i in range(10)]
        assert codes[:4] == [403] * 4 and 503 in codes[4:], "rotating the header must not evade the limit: %r" % codes
        assert get(node, name, "198.18.0.1", (ak, sk)) == 503, "the socket peer is throttled whatever the header says"


def test_a_trusted_proxy_attributes_failures_to_the_forwarded_client():
    with node_with("127.0.0.0/8") as node:
        name, ak, sk = node.fresh_bucket("px1")
        codes = failures(node, name, "203.0.113.7", 8)
        assert codes[:4] == [403] * 4 and set(codes[4:]) == {503}, codes
        assert get(node, name, "203.0.113.7", (ak, sk)) == 503, "that client stays throttled, even with valid credentials, until the window clears"
        assert get(node, name, "203.0.113.8", (ak, sk)) == 404, "another client is not affected"
        assert get(node, name, None, (ak, sk)) == 404, "a request without the header counts against the proxy itself, which has no failures"
        assert [get(node, name, "198.18.0.%d" % i) for i in range(10)] == [403] * 10, "ten different clients, one failure each: nobody is throttled"


def test_the_right_most_entry_that_is_not_a_trusted_proxy_is_the_client():
    with node_with("127.0.0.0/8,198.51.100.0/24") as node:
        name, ak, sk = node.fresh_bucket("px2")
        # the proxy chain is ... client, 198.51.100.9 (a trusted proxy); everything to the left of the client is forged
        codes = [get(node, name, "10.0.0.%d, 203.0.113.7, 198.51.100.9" % i) for i in range(8)]
        assert codes[:4] == [403] * 4 and set(codes[4:]) == {503}, "client 203.0.113.7, whatever is forged in front of it: %r" % codes
        assert get(node, name, "1.1.1.1, 203.0.113.99, 198.51.100.9", (ak, sk)) == 404, "a different client behind the same proxy"
        assert get(node, name, "203.0.113.7, 198.51.100.9", (ak, sk)) == 503
        assert get(node, name, "203.0.113.7", (ak, sk)) == 503, "a single entry works too"


def test_forged_entries_to_the_right_of_an_untrusted_client_do_not_help():
    with node_with("127.0.0.0/8") as node:
        name, ak, sk = node.fresh_bucket("px3")
        # 198.51.100.9 is NOT a trusted proxy here, so it is the client; the forged left side is irrelevant
        codes = [get(node, name, "203.0.113.%d, 198.51.100.9" % (10 + i)) for i in range(8)]
        assert codes[:4] == [403] * 4 and set(codes[4:]) == {503}, codes


def test_ipv6_clients_are_tracked_by_their_own_address():
    with node_with("127.0.0.0/8,::1/128") as node:
        name, ak, sk = node.fresh_bucket("px6")
        codes = failures(node, name, "2001:db8::1", 8)
        assert codes[:4] == [403] * 4 and set(codes[4:]) == {503}, codes
        assert get(node, name, "2001:db8::2", (ak, sk)) == 404
        assert get(node, name, "203.0.113.1", (ak, sk)) == 404


@pytest.mark.parametrize("trusted", [None, "127.0.0.0/8"])
def test_odd_forwarded_for_values_never_break_a_request(trusted):
    with node_with(trusted) as node:
        name, ak, sk = node.fresh_bucket("pxodd")
        for xff in ("", ",", " , ", "garbage", "1.2.3.4:80", "[2001:db8::1]:80", "unknown", "a" * 5000, "::ffff:1.2.3.4", "1.2.3.4, , 5.6.7.8", "999.1.1.1"):
            assert get(node, name, xff, (ak, sk)) == 404, repr(xff[:40])


def test_the_admin_listener_never_trusts_forwarded_for():
    with node_with("127.0.0.0/8") as node:
        statuses = []
        for i in range(10):
            req = urllib.request.Request(node.admin.url + "/_admin/v1/status", headers={"Authorization": "Bearer " + "z" * 40, "X-Forwarded-For": "203.0.113.%d" % (10 + i)})
            try:
                with urllib.request.urlopen(req, timeout=10) as r:
                    statuses.append(r.status)
            except urllib.error.HTTPError as e:
                statuses.append(e.code)
        assert statuses[0] == 401 and 429 in statuses, "the header is trusted on the public listener only (spec 2.3): %r" % statuses
