"""Core object operations: put/get/head/delete round trips, stored headers, metadata, error shapes (spec 3.3, 5.4.1-5.4.3, 5.11)."""
import datetime
import threading
import time
import uuid

import pytest

import bvh
from bvh import KiB, MiB, hdr, md5hex, rnd, s3error, uniq
from bvx_a import (HTTP_DATE, ISO_MS, now_utc, parse_http_date, raw_get, raw_head, raw_list, raw_put, raw_req)


@pytest.fixture(scope="module")
def shared():
    return bvh.fresh_bucket("objs")


SIZES = [0, 1, 1023, 1024, 65535, 65536, 65537, MiB, 5 * MiB - 1, 5 * MiB + 1, 12 * MiB]


@pytest.mark.parametrize("size", SIZES, ids=lambda n: "%dB" % n)
def test_put_get_head_roundtrip(shared, size):
    key = uniq("rt")
    body = rnd(size)
    r = shared.put(key, body)
    assert r["ETag"] == '"%s"' % md5hex(body), "PutObject ETag must be the quoted MD5 of the body, got %r" % r["ETag"]
    g = shared.get(key)
    data = g["Body"].read()
    assert data == body, "GET returned different bytes (len %d vs %d)" % (len(data), len(body))
    assert g["ContentLength"] == size
    assert g["ETag"] == r["ETag"]
    h = shared.head(key)
    assert h["ContentLength"] == size
    assert h["ETag"] == r["ETag"]
    assert h["ResponseMetadata"]["HTTPStatusCode"] == 200


def test_default_content_type_is_binary_octet_stream(shared):
    key = uniq("ct")
    r = raw_put(shared, key, b"data")          # no Content-Type header at all
    assert r.status == 200, r
    assert raw_head(shared, key).header("content-type") == "binary/octet-stream"
    assert raw_get(shared, key).header("content-type") == "binary/octet-stream"
    assert shared.head(key)["ContentType"] == "binary/octet-stream"


def test_content_type_roundtrip(shared):
    key = uniq("ct2")
    shared.put(key, b"<a/>", ContentType="application/xml; charset=utf-8")
    assert shared.head(key)["ContentType"] == "application/xml; charset=utf-8"
    assert shared.get(key)["ContentType"] == "application/xml; charset=utf-8"


def test_stored_content_headers_roundtrip_raw(shared):
    key = uniq("hdrs")
    sent = {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Encoding": "gzip",
        "Content-Language": "en-US",
        "Content-Disposition": 'attachment; filename="a b.txt"',
        "Cache-Control": "max-age=60, public",
        "Expires": "Wed, 21 Oct 2026 07:28:00 GMT",
    }
    r = raw_put(shared, key, b"hello", headers=sent)
    assert r.status == 200, r
    for name, fn in (("HEAD", raw_head), ("GET", raw_get)):
        resp = fn(shared, key)
        assert resp.status == 200
        for k, v in sent.items():
            assert resp.header(k) == v, "%s %s: sent %r got %r" % (name, k, v, resp.header(k))


def test_stored_content_headers_roundtrip_boto3(shared):
    key = uniq("hdrs3")
    shared.put(key, b"hello", ContentType="text/plain", ContentEncoding="gzip", ContentLanguage="fr",
               ContentDisposition="inline", CacheControl="no-cache")
    for r in (shared.head(key), shared.get(key)):
        assert r["ContentType"] == "text/plain"
        assert r["ContentEncoding"] == "gzip"
        assert r["ContentLanguage"] == "fr"
        assert r["ContentDisposition"] == "inline"
        assert r["CacheControl"] == "no-cache"


def _unsigned_trailer_put(bk, key, data, content_encoding):
    """A hand-built aws-chunked PUT (STREAMING-UNSIGNED-PAYLOAD-TRAILER with a CRC32 trailer); botocore only
    produces this form over TLS, so the plain-HTTP suite builds it itself."""
    import struct
    import zlib
    crc = bvh.b64(struct.pack(">I", zlib.crc32(data) & 0xFFFFFFFF))
    body = b"%x\r\n" % len(data) + data + b"\r\n0\r\nx-amz-checksum-crc32:" + crc.encode() + b"\r\n\r\n"
    return raw_put(bk, key, body, headers={
        "Content-Encoding": content_encoding, "x-amz-decoded-content-length": str(len(data)),
        "x-amz-trailer": "x-amz-checksum-crc32", "x-amz-sdk-checksum-algorithm": "CRC32",
    }, payload="STREAMING-UNSIGNED-PAYLOAD-TRAILER")


@pytest.mark.parametrize("sent,stored", [("aws-chunked", None), ("gzip,aws-chunked", "gzip"), ("aws-chunked,gzip", "gzip")],
                         ids=["only", "gzip-first", "gzip-last"])
def test_aws_chunked_coding_is_not_stored(shared, sent, stored):
    # spec 5.8: SDKs add Content-Encoding: aws-chunked to streaming uploads; binvault must not store it
    key = uniq("awsc")
    data = rnd(10000)
    r = _unsigned_trailer_put(shared, key, data, sent)
    assert r.status == 200, "aws-chunked upload with trailer was refused: %r" % r
    h = raw_head(shared, key)
    assert h.status == 200 and h.header("content-length") == "10000", h.raw_headers
    assert h.header("content-encoding") == stored, "stored Content-Encoding: %r (sent %r)" % (h.header("content-encoding"), sent)
    assert shared.read(key) == data, "the decoded aws-chunked payload must be stored byte for byte"


def test_user_metadata_roundtrip_names_lowercased(shared):
    key = uniq("md")
    shared.put(key, b"x", Metadata={"Foo": "Bar", "multi-word": "a b c", "Num": "123", "UPPER": "VALUE"})
    expected = {"foo": "Bar", "multi-word": "a b c", "num": "123", "upper": "VALUE"}
    assert shared.head(key)["Metadata"] == expected
    assert shared.get(key)["Metadata"] == expected


def test_user_metadata_names_are_lowercase_on_the_wire(shared):
    key = uniq("mdw")
    raw_put(shared, key, b"x", headers={"x-amz-meta-MixedCase": "v"})
    r = raw_head(shared, key)
    names = [k for k, _ in r.raw_headers if k.lower().startswith("x-amz-meta-")]
    assert names == ["x-amz-meta-mixedcase"], "metadata header names must be sent lower-case (S3), got %r" % names


def test_botocore_rejects_non_ascii_metadata_client_side(shared):
    from botocore.exceptions import ParamValidationError
    with pytest.raises(ParamValidationError):
        shared.put(uniq("mdna"), b"x", Metadata={"k": "café"})


def test_raw_non_ascii_metadata_value_is_not_a_server_error(shared):
    # spec 3.8 says metadata values are US-ASCII; raw UTF-8 bytes must be refused cleanly or stored losslessly
    key = uniq("mdraw")
    val = "café".encode("utf-8").decode("latin-1")            # wire bytes: UTF-8
    r = raw_put(shared, key, b"x", headers={"x-amz-meta-n": val},
                signed_headers=["host", "x-amz-content-sha256", "x-amz-date"])
    assert r.status < 500, r
    if r.status == 200:
        h = raw_head(shared, key)
        assert h.status == 200
        got = h.header("x-amz-meta-n")
        assert got is not None, "metadata silently dropped"


def test_last_modified_format_and_resolution(shared):
    key = uniq("lm")
    before = now_utc().replace(microsecond=0)
    shared.put(key, b"x")
    after = now_utc()
    r = raw_head(shared, key)
    lm = r.header("last-modified")
    assert lm and HTTP_DATE.match(lm), "Last-Modified must be an IMF-fixdate, got %r" % lm
    dt = parse_http_date(lm)
    assert before - datetime.timedelta(seconds=2) <= dt <= after + datetime.timedelta(seconds=2), (lm, before, after)
    again = raw_head(shared, key).header("last-modified")
    assert again == lm, "Last-Modified must be stable between requests"
    # the listing agrees to the second
    lr = raw_list(shared, prefix=key)
    x = lr.xml()
    el = x.find("Contents/LastModified")
    assert el is not None and ISO_MS.match(el.text), el.text if el is not None else lr.text
    iso = datetime.datetime.strptime(el.text, "%Y-%m-%dT%H:%M:%S.%fZ").replace(tzinfo=datetime.timezone.utc)
    assert abs((iso - dt).total_seconds()) < 1, (el.text, lm)


def test_delete_returns_204_and_is_idempotent(shared):
    key = uniq("del")
    shared.put(key, b"x")
    assert shared.delete(key)["ResponseMetadata"]["HTTPStatusCode"] == 204
    assert shared.delete(key)["ResponseMetadata"]["HTTPStatusCode"] == 204          # again
    assert shared.delete(uniq("never"))["ResponseMetadata"]["HTTPStatusCode"] == 204   # never existed
    with s3error(None, 404):
        shared.head(key)
    resp = raw_req(shared, "DELETE", uniq("never2"))
    assert resp.status == 204 and resp.body == b"", resp


def test_get_missing_key_error_document(shared):
    key = uniq("missing") + " sp/é"
    with s3error("NoSuchKey", 404):
        shared.get(key)
    r = raw_get(shared, key)
    assert r.status == 404, r
    x = r.xml()
    assert x.tag == "Error"
    assert x.findtext("Code") == "NoSuchKey"
    assert x.findtext("Message")
    assert x.findtext("Key") == key
    assert x.findtext("Resource") == "/%s/%s" % (shared.name, key)
    assert x.findtext("RequestId") and x.findtext("RequestId") == r.header("x-amz-request-id")
    assert r.header("content-type", "").startswith("application/xml")


def test_head_missing_key_is_status_only(shared):
    with s3error(None, 404):
        shared.head(uniq("m"))
    r = raw_head(shared, uniq("m2"))
    assert r.status == 404 and r.body == b""
    assert r.header("x-amz-request-id")


def test_get_missing_bucket_is_nosuchbucket(shared):
    name = "bvt-nosuch-%s" % uuid.uuid4().hex[:10]
    with s3error("NoSuchBucket", 404):
        shared.s3.get_object(Bucket=name, Key="k")
    with s3error(None, 404):
        shared.s3.head_object(Bucket=name, Key="k")
    r = shared.raw().request("GET", "/%s/k" % name)
    assert r.status == 404 and r.code == "NoSuchBucket", r
    assert r.xml().findtext("BucketName") == name


@pytest.mark.parametrize("cls", ["STANDARD", "REDUCED_REDUNDANCY"])
def test_storage_class_accepted_and_reported_standard(shared, cls):
    key = uniq("sc")
    shared.put(key, b"x", StorageClass=cls)
    assert shared.head(key).get("StorageClass") in (None, "STANDARD")
    assert shared.get(key).get("StorageClass") in (None, "STANDARD")
    lr = raw_list(shared, prefix=key)
    assert lr.xml().findtext("Contents/StorageClass") == "STANDARD", lr.text


@pytest.mark.parametrize("cls", ["GLACIER", "STANDARD_IA", "ONEZONE_IA", "DEEP_ARCHIVE", "GLACIER_IR",
                                 "INTELLIGENT_TIERING", "BOGUS"])
def test_storage_class_other_is_invalidstorageclass(shared, cls):
    key = uniq("sc")
    with s3error("InvalidStorageClass", 400):
        shared.put(key, b"x", StorageClass=cls)
    with s3error(None, 404):
        shared.head(key)          # nothing was stored


def test_empty_object(shared):
    key = uniq("empty")
    r = shared.put(key, b"")
    assert r["ETag"] == '"d41d8cd98f00b204e9800998ecf8427e"'
    g = shared.get(key)
    assert g["Body"].read() == b"" and g["ContentLength"] == 0
    assert shared.head(key)["ContentLength"] == 0
    lr = raw_list(shared, prefix=key)
    assert lr.xml().findtext("Contents/Size") == "0"


def test_overwrite_replaces_content_etag_and_length(shared):
    key = uniq("ow")
    a, b = rnd(1000), rnd(2000)
    ra = shared.put(key, a)
    rb = shared.put(key, b)
    assert ra["ETag"] != rb["ETag"]
    g = shared.get(key)
    assert g["Body"].read() == b and g["ETag"] == rb["ETag"] and g["ContentLength"] == 2000


def test_keys_are_case_sensitive(shared):
    base = uniq("case")
    shared.put(base + "A", b"upper")
    shared.put(base + "a", b"lower")
    assert shared.read(base + "A") == b"upper" and shared.read(base + "a") == b"lower"


def test_overwrite_never_exposes_mixed_content(shared):
    key = uniq("atomic")
    A, B = b"A" * (3 * MiB), b"B" * (3 * MiB + 17)
    shared.put(key, A)
    stop = threading.Event()
    seen = {"A": 0, "B": 0, "bad": []}

    def writer():
        try:
            for i in range(24):
                shared.put(key, B if i % 2 == 0 else A)
        finally:
            stop.set()

    def reader():
        s3 = bvh.make_client(shared.ak, shared.sk)
        while not stop.is_set():
            data = s3.get_object(Bucket=shared.name, Key=key)["Body"].read()
            if data == A:
                seen["A"] += 1
            elif data == B:
                seen["B"] += 1
            else:
                seen["bad"].append((len(data), data[:4], data[-4:]))

    res = bvh.run_threads([writer, reader, reader, reader])
    for r in res:
        assert not isinstance(r, BaseException), r
    assert not seen["bad"], "a reader saw a mix of old and new bytes: %r" % seen["bad"][:3]
    assert seen["A"] + seen["B"] > 0, "readers never ran"


def test_user_metadata_limit_2kib_boundary(shared):
    # spec 3.8: 2 KiB, the sum of names and values
    ok = uniq("mdok")
    shared.put(ok, b"x", Metadata={"k": "a" * 2047})                       # 1 + 2047 = 2048
    assert len(shared.head(ok)["Metadata"]["k"]) == 2047
    with s3error("MetadataTooLarge", 400):
        shared.put(uniq("mdbad"), b"x", Metadata={"k": "a" * 2048})        # 2049


def test_user_metadata_well_below_and_far_above_limit(shared):
    shared.put(uniq("mdsmall"), b"x", Metadata={"a": "1" * 500, "b": "2" * 500})
    with s3error("MetadataTooLarge", 400):
        shared.put(uniq("mdbig"), b"x", Metadata={"a": "1" * 3000})
    with s3error("MetadataTooLarge", 400):
        shared.put(uniq("mdmany"), b"x", Metadata={"key%03d" % i: "v" * 40 for i in range(60)})


def test_response_overrides_on_signed_get(shared):
    key = uniq("rov")
    shared.put(key, b"hello", ContentType="application/octet-stream")
    r = shared.get(key, ResponseContentType="text/csv", ResponseContentLanguage="de", ResponseCacheControl="no-store",
                   ResponseContentDisposition='attachment; filename="x.csv"', ResponseContentEncoding="identity")
    assert hdr(r, "content-type") == "text/csv"
    assert hdr(r, "content-language") == "de"
    assert hdr(r, "cache-control") == "no-store"
    assert hdr(r, "content-disposition") == 'attachment; filename="x.csv"'
    assert hdr(r, "content-encoding") == "identity"
    assert r["Body"].read() == b"hello"
    # the stored values are untouched
    assert shared.head(key)["ContentType"] == "application/octet-stream"


def test_response_expires_override_raw(shared):
    key = uniq("rovx")
    shared.put(key, b"hello")
    r = raw_get(shared, key, query={"response-expires": "Thu, 02 Jan 2031 03:04:05 GMT"})
    assert r.status == 200 and r.header("expires") == "Thu, 02 Jan 2031 03:04:05 GMT", r.raw_headers


STD_KINDS = ["GET-200", "HEAD-200", "GET-404", "HEAD-404", "PUT-200", "DELETE-204", "LIST-200", "GET-206", "GET-304",
             "GET-403-foreign-bucket", "LISTBUCKETS-200"]


@pytest.mark.parametrize("kind", STD_KINDS)
def test_standard_response_headers_on_every_response(shared, kind):
    """x-amz-request-id, x-amz-id-2, Server: binvault and Date are on every response (spec 5.1)."""
    key = uniq("std")
    shared.put(key, b"hello world")
    etag = '"%s"' % md5hex(b"hello world")
    if kind == "GET-200":
        r = raw_get(shared, key)
    elif kind == "HEAD-200":
        r = raw_head(shared, key)
    elif kind == "GET-404":
        r = raw_get(shared, uniq("nokey"))
    elif kind == "HEAD-404":
        r = raw_head(shared, uniq("nokey"))
    elif kind == "PUT-200":
        r = raw_put(shared, uniq("p"), b"x")
    elif kind == "DELETE-204":
        r = raw_req(shared, "DELETE", key)
    elif kind == "LIST-200":
        r = raw_list(shared)
    elif kind == "GET-206":
        r = raw_get(shared, key, headers={"Range": "bytes=0-3"})
    elif kind == "GET-304":
        r = raw_get(shared, key, headers={"If-None-Match": etag})
    elif kind == "GET-403-foreign-bucket":
        other = bvh.fresh_bucket("foreign")
        r = shared.raw().request("GET", "/%s/%s" % (other.name, key))
    else:
        r = shared.raw().request("GET", "/")
    expect = {"GET-200": 200, "HEAD-200": 200, "GET-404": 404, "HEAD-404": 404, "PUT-200": 200, "DELETE-204": 204,
              "LIST-200": 200, "GET-206": 206, "GET-304": 304, "GET-403-foreign-bucket": 403, "LISTBUCKETS-200": 200}[kind]
    assert r.status == expect, r
    assert r.header("x-amz-request-id"), "missing x-amz-request-id: %r" % r.raw_headers
    assert r.header("x-amz-id-2"), "missing x-amz-id-2: %r" % r.raw_headers
    assert r.header("server") == "binvault", "Server header: %r" % r.header("server")
    d = r.header("date")
    assert d and HTTP_DATE.match(d), "Date header: %r" % d
    assert abs((now_utc() - parse_http_date(d)).total_seconds()) < 120


def test_request_ids_are_unique(shared):
    ids = set()
    for _ in range(25):
        ids.add(raw_head(shared, uniq("rid")).header("x-amz-request-id"))
    assert len(ids) == 25, "request ids repeated: %d distinct of 25" % len(ids)


@pytest.mark.parametrize("hdrs,expect", [({}, 200), ({"Range": "bytes=0-3"}, 206)])
def test_nosniff_on_object_responses(shared, hdrs, expect):
    key = uniq("nosniff")
    shared.put(key, b"<html></html>", ContentType="text/html")
    for fn in (raw_get, raw_head):
        r = fn(shared, key, headers=hdrs)
        assert r.status == expect, r
        assert r.header("x-content-type-options") == "nosniff", (fn.__name__, r.raw_headers)


def test_binvault_version_header_is_stable_and_changes_on_overwrite(shared):
    key = uniq("ver")
    p1 = shared.put(key, b"one")
    v1 = hdr(p1, "x-binvault-version")
    assert v1, "PutObject must return x-binvault-version (spec 5.1)"
    assert hdr(shared.head(key), "x-binvault-version") == v1
    assert hdr(shared.get(key), "x-binvault-version") == v1
    v2 = hdr(shared.put(key, b"two"), "x-binvault-version")
    assert v2 and v2 != v1


def test_put_response_etag_is_quoted_and_body_empty(shared):
    r = raw_put(shared, uniq("pe"), b"abc")
    assert r.status == 200 and r.body == b""
    assert r.header("etag") == '"%s"' % md5hex(b"abc")


def test_get_object_returns_content_length_and_etag_headers(shared):
    key = uniq("clen")
    body = rnd(4321)
    shared.put(key, body)
    r = raw_get(shared, key)
    assert r.header("content-length") == "4321" and len(r.body) == 4321
    assert r.header("etag") == '"%s"' % md5hex(body)
    assert r.header("accept-ranges") == "bytes"
