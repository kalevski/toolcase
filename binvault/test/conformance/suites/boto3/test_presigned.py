"""Presigned URLs (SigV4 query form): spec 4.5, 5.9, 5.4.2 (response-*), 4.3 (token lifetime).

Every call goes through exact-wire HTTP (bvx_c.fetch), not through botocore, so only what is in the
URL and in the headers I add decides the outcome.
"""
import base64
import hashlib
import time
import urllib.parse

import pytest

import bvh
import bvx_c as X
from bvh import MiB, make_client, s3error, s3quote


def pre(bk, op, client=None, expires=300, **params):
    c = client or bk.s3
    params.setdefault("Bucket", bk.name)
    return c.generate_presigned_url(op, Params=params, ExpiresIn=expires)


def mangle(url, fn):
    """Apply fn(list of (k, v)) -> list to the query of a URL."""
    u = urllib.parse.urlsplit(url)
    q = fn(urllib.parse.parse_qsl(u.query, keep_blank_values=True))
    return urllib.parse.urlunsplit((u.scheme, u.netloc, u.path, urllib.parse.urlencode(q, quote_via=urllib.parse.quote), ""))


# --------------------------------------------------------------------------------------------
# the four verbs

def test_get(bk):
    body = bvh.rnd(5000)
    bk.put("g.bin", body, ContentType="application/x-thing")
    r = X.fetch(pre(bk, "get_object", Key="g.bin"))
    assert r.status == 200 and r.body == body, r
    assert r.header("content-type") == "application/x-thing"
    assert r.header("etag") == '"%s"' % bvh.md5hex(body)


def test_get_range_and_conditional_headers_are_not_part_of_the_signature(bk):
    bk.put("g.txt", b"0123456789")
    url = pre(bk, "get_object", Key="g.txt")
    r = X.fetch(url, headers={"Range": "bytes=2-4"})
    assert r.status == 206 and r.body == b"234", r
    etag = X.fetch(url).header("etag")
    r = X.fetch(url, headers={"If-None-Match": etag})
    assert r.status == 304, r


def test_head(bk):
    bk.put("h.txt", b"12345", Metadata={"m": "v"})
    r = X.fetch(pre(bk, "head_object", Key="h.txt"), method="HEAD")
    assert r.status == 200 and r.header("content-length") == "5" and r.header("x-amz-meta-m") == "v", r
    assert r.body == b""


def test_put(bk):
    body = bvh.rnd(20000)
    r = X.fetch(pre(bk, "put_object", Key="p.bin"), method="PUT", body=body)
    assert r.status == 200, r
    assert r.header("etag") == '"%s"' % bvh.md5hex(body)
    assert bk.read("p.bin") == body


def test_put_empty_body(bk):
    r = X.fetch(pre(bk, "put_object", Key="empty"), method="PUT", body=b"")
    assert r.status == 200, r
    assert bk.read("empty") == b""


def test_delete(bk):
    bk.put("d.txt", b"x")
    r = X.fetch(pre(bk, "delete_object", Key="d.txt"), method="DELETE")
    assert r.status == 204, r
    with s3error("NoSuchKey", 404):
        bk.get("d.txt")


def test_get_with_version_id(vbk):
    v1 = vbk.put("v.txt", b"one")["VersionId"]
    vbk.put("v.txt", b"two")
    r = X.fetch(pre(vbk, "get_object", Key="v.txt", VersionId=v1))
    assert r.status == 200 and r.body == b"one", r
    assert r.header("x-amz-version-id") == v1


def test_bucket_level_list(bk):
    for k in ("p/a", "p/b", "q/c"):
        bk.put(k, b"x")
    r = X.fetch(pre(bk, "list_objects_v2", Prefix="p/"))
    assert r.status == 200, r
    assert [e.text for e in r.xml().iter("Key")] == ["p/a", "p/b"]


def test_head_bucket(bk):
    r = X.fetch(pre(bk, "head_bucket"), method="HEAD")
    assert r.status == 200, r


@pytest.mark.parametrize("key", ["ключ a+b.txt", "日本語/テスト.txt", "a b/c%d.txt", "x!y*z'(w).txt", "é.txt"])
def test_odd_keys(bk, key):
    bk.put(key, b"odd")
    r = X.fetch(pre(bk, "get_object", Key=key))
    assert r.status == 200 and r.body == b"odd", (key, r)
    r = X.fetch(pre(bk, "put_object", Key=key + ".new"), method="PUT", body=b"new")
    assert r.status == 200, (key, r)
    assert bk.read(key + ".new") == b"new"


# --------------------------------------------------------------------------------------------
# signed headers on presigned PUTs

def test_put_with_signed_content_type(bk):
    url = pre(bk, "put_object", Key="ct.txt", ContentType="text/x-signed")
    r = X.fetch(url, method="PUT", headers={"Content-Type": "text/x-signed"}, body=b"c")
    assert r.status == 200, r
    assert bk.head("ct.txt")["ContentType"] == "text/x-signed"


def test_put_with_signed_content_type_but_another_value_is_refused(bk):
    url = pre(bk, "put_object", Key="ct.txt", ContentType="text/x-signed")
    r = X.fetch(url, method="PUT", headers={"Content-Type": "text/other"}, body=b"c")
    X.check_error(r, 403, "SignatureDoesNotMatch")
    with s3error("NoSuchKey"):
        bk.get("ct.txt")


def test_put_with_signed_content_type_but_none_sent_is_refused(bk):
    url = pre(bk, "put_object", Key="ct.txt", ContentType="text/x-signed")
    r = X.fetch(url, method="PUT", body=b"c")
    X.check_error(r, 403, "SignatureDoesNotMatch")


def test_put_with_signed_user_metadata(bk):
    url = pre(bk, "put_object", Key="m.txt", Metadata={"owner": "alice"})
    r = X.fetch(url, method="PUT", headers={"x-amz-meta-owner": "alice"}, body=b"m")
    assert r.status == 200, r
    assert bk.head("m.txt")["Metadata"] == {"owner": "alice"}


def test_put_with_signed_user_metadata_altered_value_is_refused(bk):
    url = pre(bk, "put_object", Key="m.txt", Metadata={"owner": "alice"})
    r = X.fetch(url, method="PUT", headers={"x-amz-meta-owner": "mallory"}, body=b"m")
    X.check_error(r, 403, "SignatureDoesNotMatch")


def test_put_with_signed_user_metadata_omitted_is_refused(bk):
    url = pre(bk, "put_object", Key="m.txt", Metadata={"owner": "alice"})
    r = X.fetch(url, method="PUT", body=b"m")
    X.check_error(r, 403, "SignatureDoesNotMatch")


def test_put_with_signed_tagging(bk):
    url = pre(bk, "put_object", Key="t.txt", Tagging="env=prod&team=core")
    r = X.fetch(url, method="PUT", headers={"x-amz-tagging": "env=prod&team=core"}, body=b"t")
    assert r.status == 200, r
    tags = {t["Key"]: t["Value"] for t in bk.s3.get_object_tagging(Bucket=bk.name, Key="t.txt")["TagSet"]}
    assert tags == {"env": "prod", "team": "core"}


def test_put_with_signed_sse(bk):
    url = pre(bk, "put_object", Key="s.txt", ServerSideEncryption="AES256")
    r = X.fetch(url, method="PUT", headers={"x-amz-server-side-encryption": "AES256"}, body=b"secret")
    assert r.status == 200, r
    assert r.header("x-amz-server-side-encryption") == "AES256"
    assert bk.head("s.txt")["ServerSideEncryption"] == "AES256"
    assert bk.read("s.txt") == b"secret"


def test_unsigned_amz_header_on_a_presigned_put_is_refused(bk):
    # a URL holder must not be able to add x-amz-copy-source / x-amz-tagging / x-amz-meta-* of their own
    bk.put("src.txt", b"source")
    url = pre(bk, "put_object", Key="dst.txt")
    r = X.fetch(url, method="PUT", headers={"x-amz-copy-source": "/%s/src.txt" % bk.name}, body=b"")
    X.check_error(r, 403, "AccessDenied")
    with s3error("NoSuchKey"):
        bk.get("dst.txt")


@pytest.mark.parametrize("hdr", [("x-amz-meta-evil", "1"), ("x-amz-tagging", "a=b"), ("x-amz-acl", "private"), ("x-amz-server-side-encryption", "AES256")])
def test_unsigned_amz_header_on_a_presigned_get_is_refused(bk, hdr):
    bk.put("g.txt", b"g")
    r = X.fetch(pre(bk, "get_object", Key="g.txt"), headers={hdr[0]: hdr[1]})
    X.check_error(r, 403, "AccessDenied")


def test_presigned_put_verifies_content_md5(bk):
    url = pre(bk, "put_object", Key="md5.bin")
    good = base64.b64encode(hashlib.md5(b"abc").digest()).decode()
    bad = base64.b64encode(hashlib.md5(b"abd").digest()).decode()
    r = X.fetch(url, method="PUT", headers={"Content-MD5": bad}, body=b"abc")
    X.check_error(r, 400, "BadDigest")
    with s3error("NoSuchKey"):
        bk.get("md5.bin")
    r = X.fetch(url, method="PUT", headers={"Content-MD5": good}, body=b"abc")
    assert r.status == 200, r


# --------------------------------------------------------------------------------------------
# response-* overrides

@pytest.mark.parametrize("param,header,value", [
    ("ResponseContentType", "content-type", "text/x-custom"),
    ("ResponseContentDisposition", "content-disposition", 'attachment; filename="a b.txt"'),
    ("ResponseCacheControl", "cache-control", "no-store, max-age=0"),
    ("ResponseContentEncoding", "content-encoding", "gzip"),
    ("ResponseContentLanguage", "content-language", "de-CH"),
])
def test_response_header_overrides(bk, param, header, value):
    bk.put("r.txt", b"body", ContentType="text/plain", CacheControl="max-age=60", ContentLanguage="en")
    r = X.fetch(pre(bk, "get_object", Key="r.txt", **{param: value}))
    assert r.status == 200 and r.body == b"body", r
    assert r.header(header) == value, "%s: %r" % (header, r.headers)


def test_response_expires_override(bk):
    import datetime
    bk.put("r.txt", b"body")
    when = datetime.datetime(2030, 1, 2, 3, 4, 5, tzinfo=datetime.timezone.utc)
    r = X.fetch(pre(bk, "get_object", Key="r.txt", ResponseExpires=when))
    assert r.status == 200, r
    assert r.header("expires") == "Wed, 02 Jan 2030 03:04:05 GMT", r.headers


def test_response_overrides_apply_to_head_too(bk):
    bk.put("r.txt", b"body", ContentType="text/plain")
    r = X.fetch(pre(bk, "head_object", Key="r.txt", ResponseContentType="text/x-head"), method="HEAD")
    assert r.status == 200 and r.header("content-type") == "text/x-head", r


# --------------------------------------------------------------------------------------------
# multipart through presigned URLs

def test_multipart_flow_with_presigned_parts(bk):
    c = bk.s3
    p1, p2 = bvh.rnd(5 * MiB), bvh.rnd(1234)
    uid = c.create_multipart_upload(Bucket=bk.name, Key="mp.bin")["UploadId"]
    etags = []
    for n, part in ((1, p1), (2, p2)):
        url = pre(bk, "upload_part", Key="mp.bin", UploadId=uid, PartNumber=n)
        r = X.fetch(url, method="PUT", body=part)
        assert r.status == 200, (n, r)
        assert r.header("etag") == '"%s"' % bvh.md5hex(part)
        etags.append(r.header("etag"))
    c.complete_multipart_upload(Bucket=bk.name, Key="mp.bin", UploadId=uid,
                                MultipartUpload={"Parts": [{"ETag": e, "PartNumber": i + 1} for i, e in enumerate(etags)]})
    assert bk.read("mp.bin") == p1 + p2


def test_presigned_create_complete_and_abort(bk):
    c = bk.s3
    r = X.fetch(pre(bk, "create_multipart_upload", Key="mp2.bin"), method="POST", body=b"")
    assert r.status == 200, r
    uid = r.xml().findtext("UploadId")
    assert uid
    part = bvh.rnd(5 * MiB + 7)
    r = X.fetch(pre(bk, "upload_part", Key="mp2.bin", UploadId=uid, PartNumber=1), method="PUT", body=part)
    assert r.status == 200
    et = r.header("etag")
    xml = ('<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>%s</ETag></Part></CompleteMultipartUpload>' % et).encode()
    r = X.fetch(pre(bk, "complete_multipart_upload", Key="mp2.bin", UploadId=uid), method="POST", body=xml)
    assert r.status == 200, r
    assert bk.read("mp2.bin") == part
    # abort path
    uid2 = c.create_multipart_upload(Bucket=bk.name, Key="mp3.bin")["UploadId"]
    r = X.fetch(pre(bk, "abort_multipart_upload", Key="mp3.bin", UploadId=uid2), method="DELETE")
    assert r.status == 204, r
    with s3error("NoSuchUpload", 404):
        c.list_parts(Bucket=bk.name, Key="mp3.bin", UploadId=uid2)


# --------------------------------------------------------------------------------------------
# expiry

def test_expired_url(bk):
    bk.put("e.txt", b"e")
    url = pre(bk, "get_object", Key="e.txt", expires=1)
    assert X.fetch(url).status in (200, 403)     # may already be borderline; the next call is the point
    time.sleep(2.2)
    r = X.fetch(url)
    X.check_error(r, 403, "AccessDenied", message_contains="expired")


def test_max_expiry_is_accepted(bk):
    bk.put("e.txt", b"e")
    url = bk.raw().presign("GET", "/%s/e.txt" % bk.name, expires=604800)
    r = X.fetch(url)
    assert r.status == 200, r


@pytest.mark.parametrize("expires", ["604801", "999999999", "abc", "-5", "1.5", "0x10", " 5"])
def test_out_of_range_or_malformed_expires_is_a_query_parameters_error(bk, expires):
    bk.put("e.txt", b"e")
    url = bk.raw().presign("GET", "/%s/e.txt" % bk.name, expires=expires)
    r = X.fetch(url)
    X.check_error(r, 400, "AuthorizationQueryParametersError")


def test_zero_expires_is_refused(bk):
    # the spec allows 1..604800; real S3 answers an expired-request AccessDenied for 0
    bk.put("e.txt", b"e")
    r = X.fetch(bk.raw().presign("GET", "/%s/e.txt" % bk.name, expires=0))
    assert (r.status, r.code) in ((400, "AuthorizationQueryParametersError"), (403, "AccessDenied")), r


def test_old_signing_date_with_long_expiry_is_still_valid(bk):
    # spec 4.5 / 5.9: valid from its signing date until its own expiry, however long ago it was signed
    bk.put("e.txt", b"e")
    url = bk.raw().presign("GET", "/%s/e.txt" % bk.name, expires=604800, amzdate=X.amzdate(X.ago(days=2)))
    r = X.fetch(url)
    assert r.status == 200 and r.body == b"e", r


def test_old_signing_date_with_short_expiry_is_expired(bk):
    bk.put("e.txt", b"e")
    url = bk.raw().presign("GET", "/%s/e.txt" % bk.name, expires=60, amzdate=X.amzdate(X.ago(days=2)))
    r = X.fetch(url)
    X.check_error(r, 403, "AccessDenied", message_contains="expired")


def test_signing_date_in_the_future_beyond_the_skew_is_refused(bk):
    bk.put("e.txt", b"e")
    url = bk.raw().presign("GET", "/%s/e.txt" % bk.name, expires=3600, amzdate=X.amzdate(X.ahead(hours=1)))
    r = X.fetch(url)
    X.check_error(r, 403, "RequestTimeTooSkewed")


def test_signing_date_slightly_in_the_future_is_accepted(bk):
    bk.put("e.txt", b"e")
    url = bk.raw().presign("GET", "/%s/e.txt" % bk.name, expires=3600, amzdate=X.amzdate(X.ahead(minutes=5)))
    r = X.fetch(url)
    assert r.status == 200, r


# --------------------------------------------------------------------------------------------
# tampering

def _flip(sig):
    return sig[:-1] + ("0" if sig[-1] != "0" else "1")


def test_tampered_signature(bk):
    bk.put("t.txt", b"t")
    url = mangle(pre(bk, "get_object", Key="t.txt"), lambda q: [(k, _flip(v) if k == "X-Amz-Signature" else v) for k, v in q])
    X.check_error(X.fetch(url), 403, "SignatureDoesNotMatch")


def test_tampered_key(bk):
    bk.put("t.txt", b"t")
    bk.put("other.txt", b"other")
    url = pre(bk, "get_object", Key="t.txt").replace("/t.txt?", "/other.txt?")
    X.check_error(X.fetch(url), 403, "SignatureDoesNotMatch")


def test_tampered_bucket(bk):
    other = bvh.fresh_bucket("other")
    other.put("t.txt", b"other bucket")
    bk.put("t.txt", b"t")
    url = pre(bk, "get_object", Key="t.txt").replace("/%s/" % bk.name, "/%s/" % other.name)
    X.check_error(X.fetch(url), 403, "SignatureDoesNotMatch")


def test_tampered_method(bk):
    bk.put("t.txt", b"t")
    # a URL presigned for GET cannot be used to DELETE
    X.check_error(X.fetch(pre(bk, "get_object", Key="t.txt"), method="DELETE"), 403, "SignatureDoesNotMatch")
    assert bk.read("t.txt") == b"t"


def test_extra_query_parameter_breaks_the_signature(bk):
    bk.put("t.txt", b"t")
    url = pre(bk, "get_object", Key="t.txt") + "&response-content-type=text%2Fevil"
    X.check_error(X.fetch(url), 403, "SignatureDoesNotMatch")


def test_changed_query_parameter_breaks_the_signature(bk):
    bk.put("t.txt", b"t")
    url = pre(bk, "get_object", Key="t.txt", ResponseContentType="text/a")
    url = url.replace("response-content-type=text%2Fa", "response-content-type=text%2Fb")
    X.check_error(X.fetch(url), 403, "SignatureDoesNotMatch")


def test_wrong_secret(bk):
    bk.put("t.txt", b"t")
    c = make_client(bk.ak, "x" * 40)
    X.check_error(X.fetch(pre(bk, "get_object", client=c, Key="t.txt")), 403, "SignatureDoesNotMatch")


def test_unknown_access_key(bk):
    bk.put("t.txt", b"t")
    c = make_client("BVKAAAAAAAAAAAAAAAAA", "x" * 40)
    X.check_error(X.fetch(pre(bk, "get_object", client=c, Key="t.txt")), 403, "InvalidAccessKeyId")


@pytest.mark.parametrize("name", ["X-Amz-Algorithm", "X-Amz-Credential", "X-Amz-Date", "X-Amz-Expires", "X-Amz-SignedHeaders", "X-Amz-Signature"])
def test_missing_required_query_parameter(bk, name):
    bk.put("t.txt", b"t")
    url = mangle(pre(bk, "get_object", Key="t.txt"), lambda q: [(k, v) for k, v in q if k != name])
    X.check_error(X.fetch(url), 400, "AuthorizationQueryParametersError")


def test_duplicated_query_parameter(bk):
    bk.put("t.txt", b"t")
    url = pre(bk, "get_object", Key="t.txt")
    dup = mangle(url, lambda q: q + [(k, v) for k, v in q if k == "X-Amz-Expires"])
    r = X.fetch(dup)
    assert 400 <= r.status < 500 and r.code, r


def test_wrong_algorithm(bk):
    bk.put("t.txt", b"t")
    url = mangle(pre(bk, "get_object", Key="t.txt"), lambda q: [(k, "AWS4-HMAC-SHA512" if k == "X-Amz-Algorithm" else v) for k, v in q])
    X.check_error(X.fetch(url), 400, "AuthorizationQueryParametersError")


def test_malformed_x_amz_date(bk):
    bk.put("t.txt", b"t")
    url = mangle(pre(bk, "get_object", Key="t.txt"), lambda q: [(k, "2026-10-02" if k == "X-Amz-Date" else v) for k, v in q])
    X.check_error(X.fetch(url), 400, "AuthorizationQueryParametersError")


def test_credential_date_must_match_x_amz_date(bk):
    bk.put("t.txt", b"t")
    url = bk.raw().presign("GET", "/%s/t.txt" % bk.name, scope_date="20200101")
    X.check_error(X.fetch(url), 400, "AuthorizationQueryParametersError")


def test_any_region_in_a_presigned_scope_is_accepted(bk):
    bk.put("t.txt", b"t")
    for region in ("eu-central-1", "auto", "us-east-1"):
        r = X.fetch(bk.raw().presign("GET", "/%s/t.txt" % bk.name, region=region))
        assert r.status == 200, (region, r)


def test_wrong_service_in_a_presigned_scope(bk):
    bk.put("t.txt", b"t")
    r = X.fetch(bk.raw().presign("GET", "/%s/t.txt" % bk.name, service="ec2"))
    X.check_error(r, 400, "AuthorizationQueryParametersError")


def test_host_is_part_of_the_signature(bk):
    bk.put("t.txt", b"t")
    # signed for another host, sent to this one
    url = bk.raw().presign("GET", "/%s/t.txt" % bk.name, host="other.example.com:9999")
    target = url.split("://", 1)[1].split("/", 1)[1]
    r = bvh.http_raw("GET", bvh.HOSTPORT, "/" + target)
    X.check_error(r, 403, "SignatureDoesNotMatch")


def test_payload_hash_in_the_url_is_honoured_or_ignored_cleanly(bk):
    # a signer that hoists x-amz-content-sha256 into the query (some SDKs); must not crash or bypass
    bk.put("t.txt", b"t")
    url = bk.raw().presign("GET", "/%s/t.txt" % bk.name, query={"X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD"})
    r = X.fetch(url)
    assert r.status in (200, 400, 403), r
    assert r.status < 500


def test_presigned_plus_authorization_header_is_invalid_request(bk):
    bk.put("t.txt", b"t")
    url = pre(bk, "get_object", Key="t.txt")
    hdr = "AWS4-HMAC-SHA256 Credential=%s/20261002/us-east-1/s3/aws4_request, SignedHeaders=host, Signature=%s" % (bk.ak, "0" * 64)
    X.check_error(X.fetch(url, headers={"Authorization": hdr}), 400, "InvalidRequest")


# --------------------------------------------------------------------------------------------
# Signature V2 is refused by design (spec 4.5: "Not supported: Signature V2")

def test_sigv2_presigned_url_is_refused(bk):
    bk.put("t.txt", b"t")
    c = make_client(bk.ak, bk.sk, signature_version="s3")
    url = c.generate_presigned_url("get_object", Params={"Bucket": bk.name, "Key": "t.txt"}, ExpiresIn=300)
    assert "AWSAccessKeyId=" in url and "Signature=" in url, "botocore did not produce a V2 URL: " + url
    r = X.fetch(url)
    assert r.status in (400, 403), "a Signature V2 URL must be refused: %r" % r
    assert r.code in ("InvalidRequest", "AccessDenied", "SignatureDoesNotMatch", "AuthorizationQueryParametersError"), r
    assert r.body != b"t"


def test_hand_made_v2_query_auth_is_refused(bk):
    bk.put("t.txt", b"t")
    exp = int(time.time()) + 300
    url = "%s/%s/t.txt?AWSAccessKeyId=%s&Signature=abc%%3D&Expires=%d" % (bvh.ENDPOINT, bk.name, bk.ak, exp)
    r = X.fetch(url)
    assert r.status in (400, 403), r
    assert r.body != b"t"


# --------------------------------------------------------------------------------------------
# tokens and presigned URLs: "a presigned URL carries the token's permissions at the time of use"

def test_url_dies_when_the_token_is_revoked(bk):
    bk.put("t.txt", b"t")
    t = bk.token_info([{"actions": ["read"]}])
    c = make_client(t["access_key_id"], t["secret_access_key"])
    url = pre(bk, "get_object", client=c, Key="t.txt")
    assert X.fetch(url).status == 200
    bvh.ADMIN.delete_token(bk.name, t["access_key_id"])
    X.check_error(X.fetch(url), 403, "InvalidAccessKeyId")


def test_url_dies_when_the_token_expires(bk):
    bk.put("t.txt", b"t")
    t = bk.token_info([{"actions": ["read"]}], expires_at=X.rfc3339(X.ahead(seconds=4)))
    c = make_client(t["access_key_id"], t["secret_access_key"])
    url = pre(bk, "get_object", client=c, Key="t.txt", expires=3600)
    assert X.fetch(url).status == 200
    time.sleep(4.5)
    X.check_error(X.fetch(url), 403, "InvalidAccessKeyId")


def test_url_follows_the_token_grants_at_the_time_of_use(bk):
    bk.put("t.txt", b"t")
    t = bk.token_info([{"actions": ["read"]}])
    c = make_client(t["access_key_id"], t["secret_access_key"])
    url = pre(bk, "get_object", client=c, Key="t.txt", expires=3600)
    assert X.fetch(url).status == 200
    bvh.ADMIN.patch_token(bk.name, t["access_key_id"], grants=[{"actions": ["list"]}])
    X.check_error(X.fetch(url), 403, "AccessDenied")
    bvh.ADMIN.patch_token(bk.name, t["access_key_id"], grants=[{"actions": ["read"]}])
    assert X.fetch(url).status == 200


def test_presigned_put_needs_the_write_grant(bk):
    t = bk.token_info([{"actions": ["read"]}])
    c = make_client(t["access_key_id"], t["secret_access_key"])
    url = pre(bk, "put_object", client=c, Key="nope.txt")
    X.check_error(X.fetch(url, method="PUT", body=b"x"), 403, "AccessDenied")
    with s3error("NoSuchKey"):
        bk.get("nope.txt")


def test_presigned_delete_needs_the_delete_grant(bk):
    bk.put("keep.txt", b"keep")
    t = bk.token_info([{"actions": ["read", "write"]}])
    c = make_client(t["access_key_id"], t["secret_access_key"])
    X.check_error(X.fetch(pre(bk, "delete_object", client=c, Key="keep.txt"), method="DELETE"), 403, "AccessDenied")
    assert bk.read("keep.txt") == b"keep"


def test_presigned_url_for_a_key_outside_the_token_patterns(bk):
    bk.put("pub/a.txt", b"a")
    bk.put("priv/b.txt", b"b")
    t = bk.token_info([{"actions": ["read"], "keys": ["pub/*"]}])
    c = make_client(t["access_key_id"], t["secret_access_key"])
    assert X.fetch(pre(bk, "get_object", client=c, Key="pub/a.txt")).status == 200
    X.check_error(X.fetch(pre(bk, "get_object", client=c, Key="priv/b.txt")), 403, "AccessDenied")


def test_token_of_another_bucket_cannot_sign_for_this_one(bk):
    other = bvh.fresh_bucket("other")
    bk.put("t.txt", b"t")
    url = pre(bk, "get_object", client=other.s3, Key="t.txt")
    X.check_error(X.fetch(url), 403, "AccessDenied")


# --------------------------------------------------------------------------------------------
# virtual-hosted-style

def test_virtual_hosted_presigned_get_and_put(bk):
    c = bk.vs3
    bk.put("vh/a b.txt", b"vh")
    url = c.generate_presigned_url("get_object", Params={"Bucket": bk.name, "Key": "vh/a b.txt"}, ExpiresIn=300)
    assert urllib.parse.urlsplit(url).hostname == "%s.%s" % (bk.name, bvh.DOMAIN), url
    r = X.fetch(url)
    assert r.status == 200 and r.body == b"vh", r
    url = c.generate_presigned_url("put_object", Params={"Bucket": bk.name, "Key": "vh/new.txt"}, ExpiresIn=300)
    r = X.fetch(url, method="PUT", body=b"new")
    assert r.status == 200, r
    assert bk.read("vh/new.txt") == b"new"


def test_virtual_hosted_presigned_url_used_with_another_bucket_host_is_refused(bk):
    other = bvh.fresh_bucket("other")
    bk.put("t.txt", b"mine")
    other.put("t.txt", b"theirs")
    url = bk.vs3.generate_presigned_url("get_object", Params={"Bucket": bk.name, "Key": "t.txt"}, ExpiresIn=300)
    swapped = url.replace(bk.name + "." + bvh.DOMAIN, other.name + "." + bvh.DOMAIN)
    r = X.fetch(swapped)
    X.check_error(r, 403, "SignatureDoesNotMatch")
