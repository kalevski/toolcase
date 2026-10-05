"""Conditional requests (spec 5.5): GET/HEAD preconditions, conditional writes, copy-source conditions, races."""
import datetime
import threading
import time

import pytest

import bvh
from bvh import md5hex, rnd, s3error, uniq
from bvx_a import http_date, parse_http_date, raw_get, raw_head, raw_put

SEC = datetime.timedelta(seconds=1)


@pytest.fixture(scope="module")
def cobj():
    """A bucket with one object whose Last-Modified is at least ~2 s in the past (dates stay in the past)."""
    bk = bvh.fresh_bucket("cond")
    body = b"conditional-body"
    bk.put("k", body)
    time.sleep(2.2)
    r = raw_head(bk, "k")
    bk.etag = '"%s"' % md5hex(body)
    bk.body = body
    bk.lm = parse_http_date(r.header("last-modified"))
    assert r.header("etag") == bk.etag
    return bk


METHODS = [raw_get, raw_head]
IDS = ["GET", "HEAD"]


def _do(fn, bk, headers):
    return fn(bk, "k", headers=headers)


# ---- If-Match -------------------------------------------------------------------------------

@pytest.mark.parametrize("fn", METHODS, ids=IDS)
def test_if_match_matching_etag_proceeds(cobj, fn):
    assert _do(fn, cobj, {"If-Match": cobj.etag}).status == 200


@pytest.mark.parametrize("fn", METHODS, ids=IDS)
def test_if_match_other_etag_is_412(cobj, fn):
    r = _do(fn, cobj, {"If-Match": '"deadbeef"'})
    assert r.status == 412
    if fn is raw_get:
        assert r.code == "PreconditionFailed"


@pytest.mark.parametrize("fn", METHODS, ids=IDS)
def test_if_match_star_proceeds_on_existing_object(cobj, fn):
    assert _do(fn, cobj, {"If-Match": "*"}).status == 200


@pytest.mark.parametrize("fn", METHODS, ids=IDS)
def test_if_match_list_containing_the_etag_proceeds(cobj, fn):
    assert _do(fn, cobj, {"If-Match": '"nope1", %s, "nope2"' % cobj.etag}).status == 200


@pytest.mark.parametrize("fn", METHODS, ids=IDS)
def test_if_match_unquoted_etag_is_accepted(cobj, fn):
    assert _do(fn, cobj, {"If-Match": cobj.etag.strip('"')}).status == 200


@pytest.mark.parametrize("fn", METHODS, ids=IDS)
def test_if_match_on_missing_key_is_404_not_412(cobj, fn):
    r = fn(cobj, uniq("missing"), headers={"If-Match": '"x"'})
    assert r.status == 404


# ---- If-None-Match --------------------------------------------------------------------------

@pytest.mark.parametrize("fn", METHODS, ids=IDS)
def test_if_none_match_matching_etag_is_304(cobj, fn):
    r = _do(fn, cobj, {"If-None-Match": cobj.etag})
    assert r.status == 304
    assert r.body == b""
    assert r.header("etag") == cobj.etag, "a 304 must repeat the ETag: %r" % r.raw_headers
    assert r.header("last-modified"), "a 304 should repeat Last-Modified: %r" % r.raw_headers
    assert r.header("x-amz-request-id")


@pytest.mark.parametrize("fn", METHODS, ids=IDS)
def test_if_none_match_other_etag_proceeds(cobj, fn):
    r = _do(fn, cobj, {"If-None-Match": '"deadbeef"'})
    assert r.status == 200
    if fn is raw_get:
        assert r.body == cobj.body


@pytest.mark.parametrize("fn", METHODS, ids=IDS)
def test_if_none_match_star_is_304_on_existing_object(cobj, fn):
    assert _do(fn, cobj, {"If-None-Match": "*"}).status == 304


@pytest.mark.parametrize("fn", METHODS, ids=IDS)
def test_if_none_match_list_with_the_etag_is_304(cobj, fn):
    assert _do(fn, cobj, {"If-None-Match": '"a", "b", %s' % cobj.etag}).status == 304


@pytest.mark.parametrize("fn", METHODS, ids=IDS)
def test_if_none_match_unquoted_etag_is_304(cobj, fn):
    assert _do(fn, cobj, {"If-None-Match": cobj.etag.strip('"')}).status == 304


def test_if_none_match_304_through_boto3(cobj):
    from botocore.exceptions import ClientError
    with pytest.raises(ClientError) as ei:
        cobj.get("k", IfNoneMatch=cobj.etag)
    assert ei.value.response["ResponseMetadata"]["HTTPStatusCode"] == 304


# ---- If-Modified-Since / If-Unmodified-Since ---------------------------------------------------

@pytest.mark.parametrize("fn", METHODS, ids=IDS)
@pytest.mark.parametrize("delta,expect", [(1, 304), (0, 304), (-1, 200), (-3600, 200)], ids=["lm+1s", "lm", "lm-1s", "lm-1h"])
def test_if_modified_since(cobj, fn, delta, expect):
    d = http_date(cobj.lm + delta * SEC)
    r = _do(fn, cobj, {"If-Modified-Since": d})
    assert r.status == expect, "If-Modified-Since: %s (Last-Modified %s) -> %s" % (d, http_date(cobj.lm), r.status)


@pytest.mark.parametrize("fn", METHODS, ids=IDS)
@pytest.mark.parametrize("delta,expect", [(1, 200), (0, 200), (-1, 412), (-3600, 412)], ids=["lm+1s", "lm", "lm-1s", "lm-1h"])
def test_if_unmodified_since(cobj, fn, delta, expect):
    d = http_date(cobj.lm + delta * SEC)
    r = _do(fn, cobj, {"If-Unmodified-Since": d})
    assert r.status == expect, "If-Unmodified-Since: %s (Last-Modified %s) -> %s" % (d, http_date(cobj.lm), r.status)


@pytest.mark.parametrize("hname,expect", [("If-Modified-Since", 200), ("If-Unmodified-Since", 200)])
def test_garbage_date_is_ignored(cobj, hname, expect):
    assert _do(raw_get, cobj, {hname: "not a date"}).status == expect


def test_if_modified_since_accepts_all_three_http_date_formats(cobj):
    t = (cobj.lm + SEC).astimezone(datetime.timezone.utc)
    imf = http_date(t)
    rfc850 = t.strftime("%A, %d-%b-%y %H:%M:%S GMT")
    asctime = t.strftime("%a %b ") + ("%2d" % t.day) + t.strftime(" %H:%M:%S %Y")
    for name, val in (("IMF-fixdate", imf), ("RFC 850", rfc850), ("asctime", asctime)):
        r = _do(raw_get, cobj, {"If-Modified-Since": val})
        assert r.status == 304, "%s date %r -> %s (RFC 9110 5.6.7: recipients must accept all three)" % (name, val, r.status)


def test_boto3_if_modified_since_and_unmodified_since(cobj):
    from botocore.exceptions import ClientError
    with pytest.raises(ClientError) as ei:
        cobj.get("k", IfModifiedSince=cobj.lm + SEC)
    assert ei.value.response["ResponseMetadata"]["HTTPStatusCode"] == 304
    with pytest.raises(ClientError) as ei:
        cobj.get("k", IfUnmodifiedSince=cobj.lm - SEC)
    assert ei.value.response["ResponseMetadata"]["HTTPStatusCode"] == 412
    assert cobj.get("k", IfUnmodifiedSince=cobj.lm + SEC, IfModifiedSince=cobj.lm - SEC)["Body"].read() == cobj.body


# ---- combinations (RFC 9110 13.2.2; the first two are documented S3 behaviour) -------------------

def test_if_match_true_and_if_unmodified_since_false_is_200(cobj):
    r = _do(raw_get, cobj, {"If-Match": cobj.etag, "If-Unmodified-Since": http_date(cobj.lm - SEC)})
    assert r.status == 200, "S3 and RFC 9110: a true If-Match makes If-Unmodified-Since irrelevant, got %s" % r.status


def test_if_none_match_false_and_if_modified_since_true_is_304(cobj):
    r = _do(raw_get, cobj, {"If-None-Match": cobj.etag, "If-Modified-Since": http_date(cobj.lm - 3600 * SEC)})
    assert r.status == 304, "S3 and RFC 9110: a matching If-None-Match gives 304 whatever If-Modified-Since says, got %s" % r.status


def test_if_match_false_wins_over_if_none_match(cobj):
    r = _do(raw_get, cobj, {"If-Match": '"nope"', "If-None-Match": cobj.etag})
    assert r.status == 412


def test_if_match_false_and_if_unmodified_since_true_is_412(cobj):
    r = _do(raw_get, cobj, {"If-Match": '"nope"', "If-Unmodified-Since": http_date(cobj.lm + 3600 * SEC)})
    assert r.status == 412


def test_if_match_true_and_if_none_match_matching_is_304(cobj):
    r = _do(raw_get, cobj, {"If-Match": cobj.etag, "If-None-Match": cobj.etag})
    assert r.status == 304


def test_if_unmodified_since_false_with_if_none_match_other_is_412(cobj):
    r = _do(raw_get, cobj, {"If-Unmodified-Since": http_date(cobj.lm - SEC), "If-None-Match": '"other"'})
    assert r.status == 412


def test_if_none_match_present_means_if_modified_since_is_not_evaluated(cobj):
    # RFC 9110 13.2.2 step 5: If-Modified-Since is evaluated only when If-None-Match is absent
    r = _do(raw_get, cobj, {"If-None-Match": '"other"', "If-Modified-Since": http_date(cobj.lm + SEC)})
    assert r.status == 200, "got %s" % r.status


def test_conditional_on_missing_key_is_nosuchkey(cobj):
    r = raw_get(cobj, uniq("missing"), headers={"If-None-Match": "*"})
    assert r.status == 404 and r.code == "NoSuchKey"


# ---- conditional writes -----------------------------------------------------------------------

def test_put_if_none_match_star_creates_only_when_absent(bk):
    key = uniq("cw")
    r = bk.put(key, b"first", IfNoneMatch="*")
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200
    with s3error("PreconditionFailed", 412):
        bk.put(key, b"second", IfNoneMatch="*")
    assert bk.read(key) == b"first", "a refused conditional write must leave the object untouched"


def test_put_if_none_match_star_raw_wire(bk):
    key = uniq("cwr")
    assert raw_put(bk, key, b"one", headers={"If-None-Match": "*"}).status == 200
    r = raw_put(bk, key, b"two", headers={"If-None-Match": "*"})
    assert r.status == 412 and r.code == "PreconditionFailed", r
    assert bk.read(key) == b"one"


def test_put_if_none_match_star_succeeds_again_after_delete(bk):
    key = uniq("cwd")
    bk.put(key, b"a", IfNoneMatch="*")
    bk.delete(key)
    bk.put(key, b"b", IfNoneMatch="*")
    assert bk.read(key) == b"b"


def test_put_if_match_success_and_stale_etag_failure(bk):
    key = uniq("cwm")
    e1 = bk.put(key, b"v1")["ETag"]
    r2 = bk.put(key, b"v2", IfMatch=e1)
    e2 = r2["ETag"]
    assert e2 != e1 and bk.read(key) == b"v2"
    with s3error("PreconditionFailed", 412):
        bk.put(key, b"v3", IfMatch=e1)             # stale
    assert bk.read(key) == b"v2"
    bk.put(key, b"v3", IfMatch=e2)
    assert bk.read(key) == b"v3"


def test_put_if_match_on_missing_key_fails(bk):
    r = raw_put(bk, uniq("cwmiss"), b"x", headers={"If-Match": '"abc"'})
    # real S3 answers 404 NoSuchKey; "ETag equals" cannot hold for a missing object, so 412 is also defensible
    assert r.status in (404, 412), r
    assert r.code in ("NoSuchKey", "PreconditionFailed"), r


def _single_part_upload(bk, key, data, **complete_kw):
    c = bk.s3
    uid = c.create_multipart_upload(Bucket=bk.name, Key=key)["UploadId"]
    et = c.upload_part(Bucket=bk.name, Key=key, UploadId=uid, PartNumber=1, Body=data)["ETag"]
    return c.complete_multipart_upload(Bucket=bk.name, Key=key, UploadId=uid,
                                       MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": et}]}, **complete_kw)


def test_complete_multipart_if_none_match_star(bk):
    key = uniq("cmp")
    r = _single_part_upload(bk, key, b"mp-one", IfNoneMatch="*")
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200
    with s3error("PreconditionFailed", 412):
        _single_part_upload(bk, key, b"mp-two", IfNoneMatch="*")
    assert bk.read(key) == b"mp-one"


def test_complete_multipart_if_match(bk):
    key = uniq("cmm")
    e1 = bk.put(key, b"orig")["ETag"]
    with s3error("PreconditionFailed", 412):
        _single_part_upload(bk, key, b"mp-new", IfMatch='"0123456789abcdef0123456789abcdef"')
    assert bk.read(key) == b"orig"
    _single_part_upload(bk, key, b"mp-new", IfMatch=e1)
    assert bk.read(key) == b"mp-new"


# ---- copy-source conditions -----------------------------------------------------------------

@pytest.fixture(scope="module")
def csrc():
    bk = bvh.fresh_bucket("csrc")
    bk.put("src", b"copy-source-body")
    time.sleep(2.2)
    r = raw_head(bk, "src")
    bk.etag = r.header("etag")
    bk.lm = parse_http_date(r.header("last-modified"))
    return bk


def _copy(bk, **kw):
    return bk.s3.copy_object(Bucket=bk.name, Key=uniq("dst"), CopySource={"Bucket": bk.name, "Key": "src"}, **kw)


def test_copy_source_if_match(csrc):
    assert _copy(csrc, CopySourceIfMatch=csrc.etag)["ResponseMetadata"]["HTTPStatusCode"] == 200
    with s3error("PreconditionFailed", 412):
        _copy(csrc, CopySourceIfMatch='"nope"')


def test_copy_source_if_none_match(csrc):
    assert _copy(csrc, CopySourceIfNoneMatch='"nope"')["ResponseMetadata"]["HTTPStatusCode"] == 200
    with s3error("PreconditionFailed", 412):
        _copy(csrc, CopySourceIfNoneMatch=csrc.etag)


def test_copy_source_if_modified_since(csrc):
    assert _copy(csrc, CopySourceIfModifiedSince=csrc.lm - 3600 * SEC)["ResponseMetadata"]["HTTPStatusCode"] == 200
    with s3error("PreconditionFailed", 412):
        _copy(csrc, CopySourceIfModifiedSince=csrc.lm + SEC)


def test_copy_source_if_unmodified_since(csrc):
    assert _copy(csrc, CopySourceIfUnmodifiedSince=csrc.lm + SEC)["ResponseMetadata"]["HTTPStatusCode"] == 200
    with s3error("PreconditionFailed", 412):
        _copy(csrc, CopySourceIfUnmodifiedSince=csrc.lm - SEC)


def test_copy_source_if_match_true_overrides_if_unmodified_since_false(csrc):
    # documented S3 behaviour (CopyObject) and spec 5.5 ("as above": RFC 9110 order): copy proceeds
    r = _copy(csrc, CopySourceIfMatch=csrc.etag, CopySourceIfUnmodifiedSince=csrc.lm - SEC)
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200


def test_copy_source_if_none_match_false_with_if_modified_since_true_is_412(csrc):
    with s3error("PreconditionFailed", 412):
        _copy(csrc, CopySourceIfNoneMatch=csrc.etag, CopySourceIfModifiedSince=csrc.lm - 3600 * SEC)


def test_failed_copy_source_condition_creates_nothing(csrc):
    dst = uniq("nodst")
    with s3error("PreconditionFailed", 412):
        csrc.s3.copy_object(Bucket=csrc.name, Key=dst, CopySource={"Bucket": csrc.name, "Key": "src"}, CopySourceIfMatch='"nope"')
    with s3error(None, 404):
        csrc.head(dst)


# ---- races -------------------------------------------------------------------------------------

def test_if_none_match_star_race_exactly_one_winner(bk):
    key = uniq("race")
    n = 20
    bodies = [("body-%02d-" % i).encode() * 100 for i in range(n)]
    clients = [bvh.make_client(bk.ak, bk.sk) for _ in range(n)]
    barrier = threading.Barrier(n)

    def attempt(i):
        def run():
            barrier.wait()
            return clients[i].put_object(Bucket=bk.name, Key=key, Body=bodies[i], IfNoneMatch="*")
        return run

    results = bvh.run_threads([attempt(i) for i in range(n)])
    wins = [i for i, r in enumerate(results) if not isinstance(r, BaseException)]
    losses = [r for r in results if isinstance(r, BaseException)]
    assert len(wins) == 1, "expected exactly one 200, got %d: losers=%r" % (len(wins), [str(l)[:120] for l in losses][:3])
    for l in losses:
        resp = getattr(l, "response", None)
        assert resp and resp["ResponseMetadata"]["HTTPStatusCode"] == 412 and resp["Error"]["Code"] == "PreconditionFailed", l
    assert bk.read(key) == bodies[wins[0]], "the stored object must be the winner's"
    assert bk.head(key)["ETag"] == results[wins[0]]["ETag"]


def test_if_match_compare_and_swap_counter(bk):
    key = "counter"
    bk.put(key, b"0")
    workers, per = 6, 8
    conflicts = [0]
    lock = threading.Lock()

    def worker():
        c = bvh.make_client(bk.ak, bk.sk)
        for _ in range(per):
            for attempt in range(400):
                g = c.get_object(Bucket=bk.name, Key=key)
                val = int(g["Body"].read())
                try:
                    c.put_object(Bucket=bk.name, Key=key, Body=str(val + 1).encode(), IfMatch=g["ETag"])
                    break
                except Exception as e:      # noqa: BLE001
                    resp = getattr(e, "response", None)
                    if resp and resp["ResponseMetadata"]["HTTPStatusCode"] == 412:
                        with lock:
                            conflicts[0] += 1
                        continue
                    raise
            else:
                raise AssertionError("no progress after 400 attempts")

    res = bvh.run_threads([worker] * workers)
    for r in res:
        assert not isinstance(r, BaseException), r
    assert int(bk.read(key)) == workers * per, "lost updates: final counter %s, expected %d (conflicts seen: %d)" % (
        bk.read(key), workers * per, conflicts[0])
