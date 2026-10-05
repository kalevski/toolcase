"""Range requests on GetObject/HeadObject (spec 5.4.2): one range, suffix, clamping, 416, ignored ranges."""
import pytest

import bvh
from bvh import MiB, md5hex, pattern, rnd, s3error, uniq
from bvx_a import raw_get, raw_head

N = 1000
DATA = pattern(N)


@pytest.fixture(scope="module")
def obj():
    bk = bvh.fresh_bucket("ranges")
    bk.put("obj", DATA, ContentType="application/x-pattern")
    bk.put("empty", b"")
    big = rnd(9 * MiB)
    bk.put("big", big)
    bk.big = big
    return bk


SATISFIABLE = [
    ("bytes=0-0", (0, 0)),
    ("bytes=0-99", (0, 99)),
    ("bytes=100-199", (100, 199)),
    ("bytes=999-999", (999, 999)),
    ("bytes=900-", (900, 999)),
    ("bytes=0-", (0, 999)),
    ("bytes=-1", (999, 999)),
    ("bytes=-100", (900, 999)),
    ("bytes=-1000", (0, 999)),
    ("bytes=-5000", (0, 999)),         # suffix longer than the object: all of it, still a 206
    ("bytes=990-5000", (990, 999)),    # end clamped to the last byte
    ("bytes=0-1000", (0, 999)),
    ("bytes=999-1500", (999, 999)),
]


@pytest.mark.parametrize("rng,span", SATISFIABLE, ids=[c[0] for c in SATISFIABLE])
def test_satisfiable_range_returns_206(obj, rng, span):
    start, end = span
    r = raw_get(obj, "obj", headers={"Range": rng})
    assert r.status == 206, "Range %s -> %s %r" % (rng, r.status, r.body[:100])
    assert r.header("content-range") == "bytes %d-%d/%d" % (start, end, N)
    assert r.header("content-length") == str(end - start + 1)
    assert r.body == DATA[start:end + 1]
    assert r.header("etag") == '"%s"' % md5hex(DATA)
    assert r.header("accept-ranges") == "bytes"
    assert r.header("content-type") == "application/x-pattern"
    assert r.header("last-modified")


@pytest.mark.parametrize("rng", ["bytes=1000-", "bytes=1000-1010", "bytes=5000-6000", "bytes=2000-", "bytes=-0"])
def test_unsatisfiable_range_is_416_invalidrange(obj, rng):
    r = raw_get(obj, "obj", headers={"Range": rng})
    assert r.status == 416, "Range %s -> %s %r" % (rng, r.status, r.body[:100])
    assert r.code == "InvalidRange", r.text
    x = r.xml()
    assert x.findtext("ActualObjectSize") == str(N)
    assert x.findtext("RangeRequested") == rng
    assert r.header("content-type", "").startswith("application/xml")
    cr = r.header("content-range")
    assert cr in (None, "bytes */%d" % N), "416 Content-Range, if sent, must be bytes */%d: %r" % (N, cr)


def test_invalidrange_through_boto3(obj):
    with s3error("InvalidRange", 416):
        obj.get("obj", Range="bytes=1000-")


@pytest.mark.parametrize("rng", [
    "bytes=500-400",          # last < first: invalid, ignored
    "bytes=0-9,20-29",        # several ranges: S3 sends the whole object (spec 5.4.2)
    "bytes=0-9,-5",
    "bytes=abc",
    "bytes=",
    "bytes=-",
    "bytes=a-5",
    "bytes=5-b",
    "bytes=1-2-3",
    "items=0-5",              # unknown unit
    "0-5",
    "garbage",
])
def test_unusable_range_header_is_ignored_full_body_200(obj, rng):
    r = raw_get(obj, "obj", headers={"Range": rng})
    assert r.status == 200, "Range %r -> %s %r" % (rng, r.status, r.body[:100])
    assert r.body == DATA
    assert r.header("content-length") == str(N)
    assert r.header("content-range") is None


def test_boto3_ranged_get_fields(obj):
    r = obj.get("obj", Range="bytes=10-19")
    assert r["Body"].read() == DATA[10:20]
    assert r["ContentRange"] == "bytes 10-19/%d" % N
    assert r["ContentLength"] == 10
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 206
    assert r["ETag"] == '"%s"' % md5hex(DATA)


def test_head_with_range_reports_the_range(obj):
    r = raw_head(obj, "obj", headers={"Range": "bytes=10-19"})
    assert r.status == 206, r
    assert r.header("content-range") == "bytes 10-19/%d" % N
    assert r.header("content-length") == "10"
    assert r.body == b""
    r = raw_head(obj, "obj", headers={"Range": "bytes=5000-"})
    assert r.status == 416 and r.body == b""


def test_head_without_range_has_accept_ranges_and_full_length(obj):
    r = raw_head(obj, "obj")
    assert r.status == 200 and r.header("accept-ranges") == "bytes" and r.header("content-length") == str(N)


@pytest.mark.parametrize("rng", ["bytes=0-0", "bytes=0-", "bytes=-1", "bytes=0-100", "bytes=5-"])
def test_any_range_on_an_empty_object_is_416(obj, rng):
    r = raw_get(obj, "empty", headers={"Range": rng})
    assert r.status == 416, "Range %s on a zero-byte object -> %s" % (rng, r.status)
    assert r.code == "InvalidRange"
    assert r.xml().findtext("ActualObjectSize") == "0"


def test_empty_object_without_range_is_200(obj):
    r = raw_get(obj, "empty")
    assert r.status == 200 and r.body == b"" and r.header("content-length") == "0"


BIG_SPANS = [
    (4 * MiB - 5, 4 * MiB + 4),
    (0, 4 * MiB),
    (4 * MiB, 8 * MiB - 1),
    (8 * MiB - 1, 9 * MiB - 1),
    (1, 9 * MiB - 2),
    (65536 - 1, 65536 + 1),
    (3 * MiB + 17, 8 * MiB + 11),
]


@pytest.mark.parametrize("span", BIG_SPANS, ids=["%d-%d" % s for s in BIG_SPANS])
def test_large_ranges_across_internal_chunk_boundaries(obj, span):
    start, end = span
    r = raw_get(obj, "big", headers={"Range": "bytes=%d-%d" % (start, end)})
    assert r.status == 206
    assert r.header("content-range") == "bytes %d-%d/%d" % (start, end, 9 * MiB)
    assert len(r.body) == end - start + 1
    assert r.body == obj.big[start:end + 1]


def test_suffix_range_larger_than_internal_chunk(obj):
    r = raw_get(obj, "big", headers={"Range": "bytes=-%d" % (5 * MiB)})
    assert r.status == 206 and r.body == obj.big[-5 * MiB:]
    assert r.header("content-range") == "bytes %d-%d/%d" % (4 * MiB, 9 * MiB - 1, 9 * MiB)


def test_reassembling_a_download_from_ranges(obj):
    step = 1 * MiB + 123
    parts, pos = [], 0
    while pos < len(obj.big):
        end = min(pos + step, len(obj.big)) - 1
        parts.append(obj.get("big", Range="bytes=%d-%d" % (pos, end))["Body"].read())
        pos = end + 1
    assert b"".join(parts) == obj.big


def test_range_with_matching_if_match_is_206_and_mismatch_is_412(obj):
    etag = '"%s"' % md5hex(DATA)
    r = raw_get(obj, "obj", headers={"Range": "bytes=0-9", "If-Match": etag})
    assert r.status == 206 and r.body == DATA[:10]
    r = raw_get(obj, "obj", headers={"Range": "bytes=0-9", "If-Match": '"nope"'})
    assert r.status == 412 and r.code == "PreconditionFailed"


def test_conditional_304_beats_range(obj):
    etag = '"%s"' % md5hex(DATA)
    r = raw_get(obj, "obj", headers={"Range": "bytes=0-9", "If-None-Match": etag})
    assert r.status == 304 and r.body == b""


def test_range_request_on_missing_key_is_nosuchkey(obj):
    r = raw_get(obj, uniq("missing"), headers={"Range": "bytes=0-9"})
    assert r.status == 404 and r.code == "NoSuchKey"
