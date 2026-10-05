"""GET /_metrics: Prometheus text exposition on the admin listener, node-local series (spec 9.2; 2.4, 3.4, 4.8, 6.3)."""
import math
import urllib.error
import urllib.parse
import urllib.request

import pytest

import bvh
import bvm
from bvh import ADMIN_TOKEN, ADMIN_URL, KiB, MiB, rnd, s3error, uniq


@pytest.fixture(scope="module")
def node():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as n:
        yield n


def bucket(node, tag="m", **settings):
    name, ak, sk = node.fresh_bucket(tag, **settings)
    return name, node.client(ak, sk), ak, sk


# --------------------------------------------------------------------------------------------
# access and format

def test_metrics_need_the_admin_token():
    bk = bvh.fresh_bucket("metrics-auth")
    for token in (None, "", "x" * 40, bk.ak + "." + bk.sk, bk.sk):
        req = urllib.request.Request(ADMIN_URL + "/_metrics")
        if token is not None:
            req.add_header("Authorization", "Bearer " + token)
        with pytest.raises(urllib.error.HTTPError) as ei:
            urllib.request.urlopen(req, timeout=10)
        assert ei.value.code == 401, token
    status, headers, text = bvm.fetch(ADMIN_URL, ADMIN_TOKEN)
    assert status == 200 and text.strip()
    ctype = headers.get("Content-Type", "")
    assert ctype.startswith("text/plain") and "version=0.0.4" in ctype, "Prometheus text exposition 0.0.4, got %r" % ctype


def test_exposition_is_well_formed():
    s = bvm.scrape()
    assert s.samples
    seen = set()
    for name, labels, v in s.samples:
        fam = s.family(name)
        assert fam, "sample %s has no # TYPE line" % name
        key = (name, tuple(sorted(labels.items())))
        assert key not in seen, "series %s%r is exposed twice" % (name, labels)
        seen.add(key)
        if s.types[fam] == "counter":
            assert v >= 0 and not math.isnan(v), (name, labels, v)
    hist = {}
    for name, labels, v in s.samples:
        fam = s.family(name)
        if s.types.get(fam) != "histogram":
            continue
        base = tuple(sorted((k, x) for k, x in labels.items() if k != "le"))
        h = hist.setdefault((fam, base), {"buckets": [], "sum": None, "count": None})
        if name.endswith("_bucket"):
            assert "le" in labels, (name, labels)
            h["buckets"].append((float(labels["le"]), v))
        elif name.endswith("_sum"):
            h["sum"] = v
        elif name.endswith("_count"):
            h["count"] = v
    assert hist, "binvault_http_request_duration_seconds is a histogram"
    for (fam, base), h in hist.items():
        les = [le for le, _ in h["buckets"]]
        counts = [c for _, c in h["buckets"]]
        assert les == sorted(les) and les and math.isinf(les[-1]), "%s%r: bucket bounds must ascend and end with +Inf: %r" % (fam, base, les)
        assert counts == sorted(counts), "%s%r: bucket counts must be cumulative: %r" % (fam, base, counts)
        assert h["count"] == counts[-1], "%s%r: _count %r != the +Inf bucket %r" % (fam, base, h["count"], counts[-1])
        assert h["sum"] is not None and h["sum"] >= 0, (fam, base)


def test_go_runtime_and_process_series_exist():
    s = bvm.scrape()
    names = {n for n, _, _ in s.samples}
    assert any(n.startswith("go_") for n in names), "no Go runtime metrics"
    assert any(n.startswith("process_") for n in names), "no process metrics"


# --------------------------------------------------------------------------------------------
# traffic

def test_request_counters_follow_the_traffic(node):
    name, c, _, _ = bucket(node, "req")
    before = bvm.scrape_node(node)
    c.put_object(Bucket=name, Key="k", Body=b"x" * 1000)
    c.get_object(Bucket=name, Key="k")["Body"].read()
    c.head_object(Bucket=name, Key="k")
    c.list_objects_v2(Bucket=name)
    with s3error("NoSuchKey", 404):
        c.get_object(Bucket=name, Key="missing")
    c.delete_object(Bucket=name, Key="k")
    after = bvm.scrape_node(node)

    def delta(op, status):
        return after.total("binvault_http_requests_total", op=op, status=status) - before.total("binvault_http_requests_total", op=op, status=status)

    assert delta("PutObject", 200) == 1
    assert delta("GetObject", 200) == 1
    assert delta("HeadObject", 200) == 1
    assert delta("ListObjectsV2", 200) == 1
    assert delta("GetObject", 404) == 1
    assert delta("DeleteObject", 204) == 1


def test_body_bytes_are_counted_in_and_out(node):
    name, c, _, _ = bucket(node, "bytes")
    n = 1 * MiB
    body = rnd(n)
    before = bvm.scrape_node(node)
    c.put_object(Bucket=name, Key="k", Body=body)
    mid = bvm.scrape_node(node)
    assert c.get_object(Bucket=name, Key="k")["Body"].read() == body
    after = bvm.scrape_node(node)
    put_in = mid.total("binvault_bytes_total", direction="in") - before.total("binvault_bytes_total", direction="in")
    # the response to the scrape in `mid` is itself counted, after the counters were read: it falls into the next interval
    get_out = after.total("binvault_bytes_total", direction="out") - mid.total("binvault_bytes_total", direction="out") - len(mid.text.encode())
    assert n <= put_in <= n + 8 * KiB, "uploaded %d body bytes, the counter moved by %d" % (n, put_in)
    assert n <= get_out <= n + 8 * KiB, "downloaded %d body bytes, the counter moved by %d (after subtracting the scrape's own %d)" % (n, get_out, len(mid.text))


def test_the_duration_histogram_observes_every_request(node):
    name, c, _, _ = bucket(node, "dur")
    before = bvm.scrape_node(node)
    for i in range(5):
        c.put_object(Bucket=name, Key="k%d" % i, Body=b"x")
    after = bvm.scrape_node(node)

    def moved(series):
        return after.total(series, op="PutObject") - before.total(series, op="PutObject")

    assert moved("binvault_http_request_duration_seconds_count") == 5
    assert moved("binvault_http_request_duration_seconds_sum") > 0
    inf = after.total("binvault_http_request_duration_seconds_bucket", op="PutObject", le="+Inf") - before.total("binvault_http_request_duration_seconds_bucket", op="PutObject", le="+Inf")
    assert inf == 5


def test_operation_labels_are_names_never_paths_or_keys(node):
    name, c, _, _ = bucket(node, "labels")
    key = "dir with space/%s&x=y+z" % uniq("secretkey")
    c.put_object(Bucket=name, Key=key, Body=b"x")
    c.get_object(Bucket=name, Key=key)
    s = bvm.scrape_node(node)
    ops = {l["op"] for n, l, _ in s.samples if "op" in l}
    assert ops, "no op labels"
    for op in ops:
        assert op.replace("_", "").isalnum() and op[0].isalpha(), "op label %r is not an operation name" % op
    unlabelled = "\n".join(line for line in s.text.splitlines() if 'bucket="' not in line)
    assert key not in s.text and "secretkey" not in s.text, "object keys must never become label values"
    assert name not in unlabelled, "bucket names appear only in the per-bucket series"
    assert "PutObject" in ops and "GetObject" in ops


def failure_schemes(a, b):
    sa = {l["scheme"]: v for l, v in a.series("binvault_auth_failures_total")}
    sb = {l["scheme"]: v for l, v in b.series("binvault_auth_failures_total")}
    return {k: sb[k] - sa.get(k, 0) for k in sb if sb[k] != sa.get(k, 0)}


def test_auth_failures_are_counted_per_scheme(node):
    name, c, ak, sk = bucket(node, "authm")
    steps = [bvm.scrape_node(node)]
    r = bvh.Raw(ak, "w" * 40, endpoint=node.endpoint).request("GET", "/%s/k" % name)                       # SigV4 in the header
    assert r.status == 403 and r.code == "SignatureDoesNotMatch", r
    steps.append(bvm.scrape_node(node))
    url = bvh.Raw(ak, sk, endpoint=node.endpoint).presign("GET", "/%s/k" % name)                            # SigV4 in the query
    r = bvh.http_get(url[:-4] + "0000")
    assert r.status == 403, r
    steps.append(bvm.scrape_node(node))
    r = bvh.Raw(ak, sk, endpoint=node.endpoint).request("GET", "/%s/k" % name, sign=False, headers={"Authorization": "Bearer not-a-token"})
    assert r.status == 403, r
    steps.append(bvm.scrape_node(node))
    moved = [failure_schemes(a, b) for a, b in zip(steps, steps[1:])]
    assert all(sum(m.values()) == 1 for m in moved), "each failed authentication counts exactly once: %r" % moved
    assert len({next(iter(m)) for m in moved}) == 3, "header-signed, presigned and bearer failures are three schemes: %r" % moved


def test_admin_api_auth_failures_are_counted_too(node):
    before = bvm.scrape_node(node).total("binvault_auth_failures_total")
    req = urllib.request.Request(node.admin.url + "/_admin/v1/status", headers={"Authorization": "Bearer " + "z" * 40})
    with pytest.raises(urllib.error.HTTPError) as ei:
        urllib.request.urlopen(req, timeout=10)
    assert ei.value.code == 401
    assert bvm.scrape_node(node).total("binvault_auth_failures_total") == before + 1, "the admin token is the most valuable credential: its failures belong in binvault_auth_failures_total"


def test_successful_requests_are_not_auth_failures(node):
    name, c, _, _ = bucket(node, "authok")
    before = bvm.scrape_node(node).total("binvault_auth_failures_total")
    for i in range(10):
        c.put_object(Bucket=name, Key="k%d" % i, Body=b"x")
    c.list_objects_v2(Bucket=name)
    assert bvm.scrape_node(node).total("binvault_auth_failures_total") == before


def test_throttled_requests_by_address_are_counted_with_reason_auth():
    with bvh.Node(env={"BINVAULT_AUTH_FAIL_LIMIT": "3", "BINVAULT_FSYNC": "false"}) as n:
        name, ak, sk = n.fresh_bucket("thr")
        before = bvm.scrape_node(n).total("binvault_throttled_total", reason="auth")
        raw = bvh.Raw("BVKAAAAAAAAAAAAAAAAA", "s" * 40, endpoint=n.endpoint)
        codes = [raw.request("GET", "/%s/k" % name).status for _ in range(10)]
        slowed = codes.count(503)
        assert slowed >= 5, codes
        moved = bvm.scrape_node(n).total("binvault_throttled_total", reason="auth") - before
        assert moved == slowed, "%d responses were SlowDown, the counter moved by %d" % (slowed, moved)
        assert bvm.scrape_node(n).total("binvault_throttled_total", reason="rate") == 0


# --------------------------------------------------------------------------------------------
# state gauges

def test_bucket_gauges_match_the_admin_stats(node):
    name, c, _, _ = bucket(node, "gauge", versioning="enabled")
    c.put_object(Bucket=name, Key="k", Body=b"a" * 100)
    c.put_object(Bucket=name, Key="k", Body=b"b" * 200)
    c.put_object(Bucket=name, Key="j", Body=b"c" * 50)
    c.delete_object(Bucket=name, Key="j")
    up = c.create_multipart_upload(Bucket=name, Key="mp")["UploadId"]
    c.upload_part(Bucket=name, Key="mp", UploadId=up, PartNumber=1, Body=rnd(5 * MiB))
    st = node.admin.get_bucket(name)["stats"]
    s = bvm.scrape_node(node)
    assert st["objects"] == 1 and st["bytes"] == 350, st
    assert s.total("binvault_objects", bucket=name) == st["objects"], "visible objects"
    assert s.total("binvault_object_versions", bucket=name) == st["versions"] == 4, "version rows: 3 data versions and a delete marker"
    assert s.total("binvault_stored_bytes", bucket=name) == st["bytes"], "logical bytes of the data versions; open parts are upload_bytes"
    assert st["upload_bytes"] == 5 * MiB


def test_unversioned_overwrites_and_copies_are_counted_by_logical_size(node):
    name, c, _, _ = bucket(node, "gauge2")
    c.put_object(Bucket=name, Key="a", Body=b"1" * 10)
    c.put_object(Bucket=name, Key="a", Body=b"1" * 30)
    c.copy_object(Bucket=name, Key="c", CopySource={"Bucket": name, "Key": "a"})
    s = bvm.scrape_node(node)
    assert s.total("binvault_objects", bucket=name) == 2
    assert s.total("binvault_object_versions", bucket=name) == 2
    assert s.total("binvault_stored_bytes", bucket=name) == 60, "a copy shares the blob but counts its logical size (quota semantics)"


def test_a_deleted_bucket_leaves_no_series_behind(node):
    name, c, _, _ = bucket(node, "gone")
    c.put_object(Bucket=name, Key="k", Body=b"x")
    s = bvm.scrape_node(node)
    assert s.series("binvault_objects", bucket=name)
    node.admin.delete_bucket(name, force=True)
    text = bvm.scrape_node(node).text
    assert name not in text, "series of a deleted bucket are still exposed"


def test_multipart_open_counts_open_uploads(node):
    name, c, _, _ = bucket(node, "mpo")

    def opened():
        return bvm.scrape_node(node).total("binvault_multipart_open")

    base = opened()
    u1 = c.create_multipart_upload(Bucket=name, Key="one")["UploadId"]
    u2 = c.create_multipart_upload(Bucket=name, Key="two")["UploadId"]
    assert opened() == base + 2
    c.upload_part(Bucket=name, Key="one", UploadId=u1, PartNumber=1, Body=b"p")
    c.abort_multipart_upload(Bucket=name, Key="one", UploadId=u1)
    assert opened() == base + 1
    p = c.upload_part(Bucket=name, Key="two", UploadId=u2, PartNumber=1, Body=b"p")
    c.complete_multipart_upload(Bucket=name, Key="two", UploadId=u2, MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": p["ETag"]}]})
    assert opened() == base


def test_gc_pending_counts_blobs_whose_last_reference_is_gone(node):
    name, c, _, _ = bucket(node, "gcm")

    def pending():
        return bvm.scrape_node(node).total("binvault_blob_gc_pending")

    base = pending()
    c.put_object(Bucket=name, Key="a", Body=rnd(4000))
    c.copy_object(Bucket=name, Key="b", CopySource={"Bucket": name, "Key": "a"})
    assert pending() == base
    c.delete_object(Bucket=name, Key="a")
    assert pending() == base, "the copy still references the blob"
    c.delete_object(Bucket=name, Key="b")
    assert pending() == base + 1, "the last reference is gone: one blob waits for the grace period"
    c.put_object(Bucket=name, Key="o", Body=rnd(100))
    c.put_object(Bucket=name, Key="o", Body=rnd(100))
    assert pending() == base + 2, "an overwrite drops the reference of the old blob (copy-on-write)"


def test_disk_free_matches_the_status_endpoint(node):
    free = bvm.scrape_node(node).total("binvault_disk_free_bytes")
    st_free = node.admin.call("GET", "/status")[1]["free_bytes"]
    assert free > 0 and abs(free - st_free) < max(256 * MiB, 0.05 * st_free), (free, st_free)


def test_gauges_are_right_after_a_restart_without_any_traffic():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as n:
        name, ak, sk = n.fresh_bucket("restart", versioning="enabled")
        c = n.client(ak, sk)
        c.put_object(Bucket=name, Key="a", Body=b"x" * 100)
        c.put_object(Bucket=name, Key="a", Body=b"y" * 20)
        c.put_object(Bucket=name, Key="b", Body=b"z" * 5)
        n.stop()
        n.start()
        s = bvm.scrape_node(n)
        assert s.total("binvault_objects", bucket=name) == 2
        assert s.total("binvault_object_versions", bucket=name) == 3
        assert s.total("binvault_stored_bytes", bucket=name) == 125
        assert s.total("binvault_http_requests_total", op="PutObject") == 0, "counters are per process"


def test_per_bucket_labels_can_be_switched_off():
    with bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_METRICS_PER_BUCKET": "false"}) as n:
        name, ak, sk = n.fresh_bucket("nolabel")
        c = n.client(ak, sk)
        c.put_object(Bucket=name, Key="k", Body=b"x")
        text = bvm.scrape_node(n).text
        assert 'bucket="' not in text and name not in text, "BINVAULT_METRICS_PER_BUCKET=false: no per-bucket labels"
        assert bvm.scrape_node(n).total("binvault_http_requests_total", op="PutObject") == 1, "the other series stay"
