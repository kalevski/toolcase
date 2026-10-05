"""Rate limits (spec 4.9) and brute-force protection (spec 4.8)."""
import re
import threading
import time
import urllib.request

import pytest
from botocore.config import Config

import bvh
from bvh import ADMIN, AdminError, KiB, MiB, http_get, md5hex, rnd, s3error, uniq
from bvx_a import raw_get, raw_head, raw_put


def burst_of(bk, n, key="k", fn=raw_head):
    """n back-to-back requests; returns the list of statuses."""
    return [fn(bk, key).status for _ in range(n)]


def metric(name, label_filter=""):
    req = urllib.request.Request(bvh.ADMIN_URL + "/_metrics", headers={"Authorization": "Bearer " + bvh.ADMIN_TOKEN})
    with urllib.request.urlopen(req, timeout=10) as r:
        text = r.read().decode()
    total = 0.0
    for line in text.splitlines():
        if line.startswith(name) and label_filter in line:
            total += float(line.rsplit(" ", 1)[1])
    return total


# --------------------------------------------------------------------------------------------
# request rate

def test_requests_over_the_bucket_limit_get_503_slowdown_with_retry_after():
    bk = bvh.fresh_bucket("rl1", limits={"requests_per_second": 5, "burst": 10})
    bk.put("k", b"x")
    statuses = burst_of(bk, 60)
    ok, slow = statuses.count(200), statuses.count(503)
    assert ok + slow == 60, "only 200 and 503 expected: %r" % sorted(set(statuses))
    assert 8 <= ok <= 25, "burst 10 + a trickle: %d of 60 went through" % ok
    r = None
    for _ in range(40):
        r = raw_get(bk, "k")
        if r.status == 503:
            break
    assert r.status == 503 and r.code == "SlowDown", r
    ra = r.header("retry-after")
    assert ra and re.fullmatch(r"\d+", ra) and int(ra) >= 1, "Retry-After must be a positive number of seconds: %r" % ra
    assert r.xml().findtext("Message") and r.header("x-amz-request-id")


def test_the_bucket_recovers_after_a_pause():
    bk = bvh.fresh_bucket("rl2", limits={"requests_per_second": 4, "burst": 4})
    bk.put("k", b"x")
    assert 503 in burst_of(bk, 30)
    time.sleep(2.2)
    assert burst_of(bk, 3) == [200, 200, 200]


def test_burst_defaults_to_twice_the_rate():
    bk = bvh.fresh_bucket("rl3", limits={"requests_per_second": 3})
    bk.put("k", b"x")
    time.sleep(1.2)
    statuses = burst_of(bk, 30)
    ok = statuses.count(200)
    assert 5 <= ok <= 12, "rate 3 should allow a burst of about 6, got %d OK of 30" % ok


def test_slowdown_is_retried_by_the_sdk_until_it_succeeds():
    bk = bvh.fresh_bucket("rl4", limits={"requests_per_second": 5, "burst": 5})
    bk.put("k", b"payload")
    c = bvh.make_client(bk.ak, bk.sk, retries={"max_attempts": 12, "mode": "standard"})
    t0 = time.time()
    for _ in range(20):
        assert c.get_object(Bucket=bk.name, Key="k")["Body"].read() == b"payload"
    elapsed = time.time() - t0
    assert elapsed >= 2.0, "20 requests at 5/s with burst 5 cannot finish in %.2fs" % elapsed


def test_token_limits_apply_to_that_token_only():
    bk = bvh.fresh_bucket("rl5")
    bk.put("k", b"x")
    t = bk.token_info([{"actions": ["read"]}], limits={"requests_per_second": 3, "burst": 3})
    limited = bk.raw()
    limited.ak, limited.sk = t["access_key_id"], t["secret_access_key"]
    st = [limited.request("HEAD", "/%s/k" % bk.name).status for _ in range(40)]
    assert st.count(503) > 20 and st.count(200) >= 3, st
    assert burst_of(bk, 40) == [200] * 40, "other tokens of the bucket are not throttled"


def test_token_and_bucket_limits_both_apply():
    bk = bvh.fresh_bucket("rl6", limits={"requests_per_second": 3, "burst": 3})
    bk.put("k", b"x")
    t = bk.token_info([{"actions": ["read"]}], limits={"requests_per_second": 1000, "burst": 1000})
    raw = bk.raw()
    raw.ak, raw.sk = t["access_key_id"], t["secret_access_key"]
    st = [raw.request("HEAD", "/%s/k" % bk.name).status for _ in range(40)]
    assert st.count(503) > 20, "the bucket's lower limit still governs: %r" % st


def test_anonymous_reads_count_against_the_bucket_limit():
    bk = bvh.fresh_bucket("rl7", limits={"requests_per_second": 3, "burst": 3}, anonymous_read="objects")
    bk.put("k", b"x")
    time.sleep(0.5)
    st = [http_get(bk.url("k")).status for _ in range(40)]
    assert st.count(503) > 20 and st.count(200) >= 3, st


def test_throttled_requests_are_counted_in_a_metric():
    bk = bvh.fresh_bucket("rl8", limits={"requests_per_second": 2, "burst": 2})
    bk.put("k", b"x")
    before = metric("binvault_throttled_total")
    st = burst_of(bk, 30)
    after = metric("binvault_throttled_total")
    assert st.count(503) > 10
    assert after - before >= st.count(503) - 1, (before, after, st.count(503))


def test_healthz_and_the_admin_api_are_exempt():
    bk = bvh.fresh_bucket("rl9", limits={"requests_per_second": 1, "burst": 1})
    bk.put("k", b"x")
    assert 503 in burst_of(bk, 10)
    for _ in range(25):
        assert bvh.http_raw("GET", bvh.HOSTPORT, "/_healthz").status == 200
        assert ADMIN.get_bucket(bk.name)["name"] == bk.name


def test_limit_changes_apply_to_the_next_request():
    bk = bvh.fresh_bucket("rl10")
    bk.put("k", b"x")
    assert burst_of(bk, 30) == [200] * 30
    ADMIN.patch_bucket(bk.name, limits={"requests_per_second": 1, "burst": 1})
    assert 503 in burst_of(bk, 20)
    ADMIN.patch_bucket(bk.name, limits={})                 # JSON merge-patch: an empty object changes nothing
    time.sleep(1.1)
    assert 503 in burst_of(bk, 20)
    ADMIN.patch_bucket(bk.name, limits=None)               # null removes the limits
    time.sleep(1.1)
    assert burst_of(bk, 30) == [200] * 30


@pytest.mark.parametrize("limits", [{"requests_per_second": -1}, {"burst": -5}, {"bytes_in_per_second": -1}, {"bytes_out_per_second": -1},
                                    {"requests_per_second": "fast"}, {"unknown_limit": 1}])
def test_invalid_limits_are_rejected(limits):
    bk = bvh.fresh_bucket("rlbad")
    with pytest.raises(AdminError) as ei:
        ADMIN.patch_bucket(bk.name, limits=limits)
    assert ei.value.status == 400, ei.value
    with pytest.raises(AdminError) as ei:
        ADMIN.create_token(bk.name, [{"actions": ["read"]}], limits=limits)
    assert ei.value.status == 400, ei.value


# --------------------------------------------------------------------------------------------
# bandwidth

def timed(fn):
    t0 = time.time()
    r = fn()
    return time.time() - t0, r


def test_download_bandwidth_is_paced_not_refused():
    bk = bvh.fresh_bucket("bw1", limits={"bytes_out_per_second": 256 * KiB})
    data = rnd(768 * KiB)
    bk.put("big", data)
    elapsed, got = timed(lambda: bk.read("big"))
    assert got == data, "a paced download is complete and correct"
    assert 1.2 <= elapsed <= 20, "768 KiB at 256 KiB/s should take about 2-3 s, took %.2f s" % elapsed


def test_upload_bandwidth_is_paced_not_refused():
    bk = bvh.fresh_bucket("bw2", limits={"bytes_in_per_second": 256 * KiB})
    data = rnd(768 * KiB)
    elapsed, _ = timed(lambda: bk.put("big", data))
    assert 1.2 <= elapsed <= 20, "took %.2f s" % elapsed
    assert bk.read("big") == data


def test_bandwidth_is_shared_by_concurrent_transfers():
    bk = bvh.fresh_bucket("bw3", limits={"bytes_out_per_second": 256 * KiB})
    data = rnd(512 * KiB)
    bk.put("a", data)
    bk.put("b", data)
    t0 = time.time()
    res = bvh.run_threads([lambda: bk.read("a"), lambda: bk.read("b")])
    elapsed = time.time() - t0
    assert res == [data, data]
    assert elapsed >= 2.2, "1 MiB through a shared 256 KiB/s limit cannot take %.2f s" % elapsed


def test_token_bandwidth_limit():
    bk = bvh.fresh_bucket("bw4")
    data = rnd(600 * KiB)
    bk.put("big", data)
    t = bk.token_info([{"actions": ["read"]}], limits={"bytes_out_per_second": 200 * KiB})
    c = bvh.make_client(t["access_key_id"], t["secret_access_key"])
    elapsed, got = timed(lambda: c.get_object(Bucket=bk.name, Key="big")["Body"].read())
    assert got == data and elapsed >= 1.2, elapsed
    fast, _ = timed(lambda: bk.read("big"))
    assert fast < elapsed, "the full-access token of the same bucket is not paced"


def test_unlimited_buckets_are_not_slowed():
    bk = bvh.fresh_bucket("bw5")
    data = rnd(6 * MiB)
    bk.put("big", data)
    elapsed, got = timed(lambda: bk.read("big"))
    assert got == data and elapsed < 5, elapsed


# --------------------------------------------------------------------------------------------
# brute-force protection (spec 4.8)

def test_repeated_authentication_failures_throttle_the_address():
    with bvh.Node(env={"BINVAULT_AUTH_FAIL_LIMIT": "5", "BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("bf")
        good = node.client(ak, sk)
        good.put_object(Bucket=name, Key="k", Body=b"x")
        raw = bvh.Raw("BVKAAAAAAAAAAAAAAAAA", "wrong-secret-" + "x" * 27, endpoint=node.endpoint)
        seen = []
        for _ in range(12):
            seen.append(raw.request("GET", "/%s/k" % name))
        codes = [(r.status, r.code) for r in seen]
        assert codes[0] == (403, "InvalidAccessKeyId"), codes
        assert any(c[0] == 503 and c[1] == "SlowDown" for c in codes), "more than 5 failures per minute must throttle: %r" % codes
        throttled = next(r for r in seen if r.status == 503)
        assert throttled.header("retry-after") and int(throttled.header("retry-after")) >= 1
        # even correct credentials from the throttled address are answered SlowDown until the window clears
        r = bvh.Raw(ak, sk, endpoint=node.endpoint).request("GET", "/%s/k" % name)
        assert r.status == 503 and r.code == "SlowDown", r
        # but the health check and the admin listener are separate
        assert bvh.http_raw("GET", node.endpoint.split("//")[1], "/_healthz").status == 200


def test_failures_with_a_known_key_throttle_the_address_but_never_block_the_key():
    with bvh.Node(env={"BINVAULT_AUTH_FAIL_LIMIT": "4", "BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("bf2")
        bad = bvh.Raw(ak, "not-the-secret-" + "y" * 26, endpoint=node.endpoint)
        codes = [bad.request("GET", "/%s/k" % name).code for _ in range(8)]
        assert "SignatureDoesNotMatch" in codes and "SlowDown" in codes, codes
        assert node.admin.call("GET", "/buckets/%s/tokens" % name)[1]["items"], "the token itself is not revoked or blocked"


def test_admin_api_failures_get_429():
    with bvh.Node(env={"BINVAULT_AUTH_FAIL_LIMIT": "4", "BINVAULT_FSYNC": "false"}) as node:
        statuses = []
        for _ in range(10):
            req = urllib.request.Request(node.admin.url + "/_admin/v1/status", headers={"Authorization": "Bearer " + "z" * 40})
            try:
                with urllib.request.urlopen(req, timeout=10) as r:
                    statuses.append(r.status)
            except urllib.error.HTTPError as e:
                statuses.append(e.code)
                if e.code == 429:
                    assert e.headers.get("Retry-After")
        assert statuses[0] == 401 and 429 in statuses, statuses


def test_pipeline_style_bearer_failures_are_not_counted():
    """spec 4.8: failures of pipeline-token keys (BVP...) never lock anybody out."""
    with bvh.Node(env={"BINVAULT_AUTH_FAIL_LIMIT": "3", "BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("bf3")
        raw = bvh.Raw(ak, sk, endpoint=node.endpoint)
        for _ in range(10):
            r = raw.request("GET", "/%s/k" % name, sign=False, headers={"Authorization": "Bearer BVPAAAAAAAAAAAAAAAAA.%s" % ("s" * 40)})
            assert r.status == 403 and r.code == "InvalidAccessKeyId", r
        assert raw.request("GET", "/%s/k" % name).status == 404, "a correct request still passes after ten BVP failures"
