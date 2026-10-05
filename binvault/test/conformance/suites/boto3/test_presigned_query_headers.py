"""x-amz-* request headers carried in the query string of a presigned URL.

SDKs other than botocore (aws-sdk-js-v3, aws-sdk-java, the Go presigner for some inputs) "hoist" x-amz-meta-*, x-amz-tagging,
x-amz-server-side-encryption, x-amz-storage-class ... into the query string, where they are covered by the signature. S3
treats them exactly like the header form; the spec is silent (spec 4.5 only says an UNSIGNED x-amz-* header is refused).
"""
import bvh
from bvh import md5hex, s3error, uniq
from bvx_a import raw_head


def presigned_put(bk, key, query, body=b"hoisted", headers=None, **kw):
    raw = bk.raw()
    path = "/%s/%s" % (bk.name, bvh.s3quote(key))
    url = raw.presign("PUT", path, query=query, expires=300, **kw)
    return bvh.http_get(url, method="PUT", data=body, headers=headers)


def test_user_metadata_in_the_query_is_stored(bk):
    r = presigned_put(bk, "m", {"x-amz-meta-who": "presign", "x-amz-meta-Other": "Two Words"})
    assert r.status == 200, r
    h = bk.head("m")
    assert h["Metadata"] == {"who": "presign", "other": "Two Words"}, "metadata given as query parameters is dropped: %r" % h["Metadata"]


def test_tags_in_the_query_are_stored(bk):
    r = presigned_put(bk, "t", {"x-amz-tagging": "env=prod&team=core"})
    assert r.status == 200, r
    tags = {t["Key"]: t["Value"] for t in bk.s3.get_object_tagging(Bucket=bk.name, Key="t")["TagSet"]}
    assert tags == {"env": "prod", "team": "core"}, "tags given as a query parameter are dropped: %r" % tags


def test_server_side_encryption_in_the_query_is_honoured(bk):
    r = presigned_put(bk, "e", {"x-amz-server-side-encryption": "AES256"})
    assert r.status == 200, r
    assert bk.head("e").get("ServerSideEncryption") == "AES256", "an object whose presigned URL asked for SSE-S3 was stored in clear text"


def test_unsupported_server_side_encryption_in_the_query_is_refused(bk):
    r = presigned_put(bk, "k", {"x-amz-server-side-encryption": "aws:kms"})
    assert r.status == 501 and r.code == "NotImplemented", "SSE-KMS in the query string must be refused like the header form: %r" % r


def test_invalid_storage_class_in_the_query_is_refused(bk):
    r = presigned_put(bk, "s", {"x-amz-storage-class": "GLACIER"})
    assert r.status == 400 and r.code == "InvalidStorageClass", r


def test_unsupported_acl_in_the_query_is_refused(bk):
    r = presigned_put(bk, "a", {"x-amz-acl": "public-read"})
    assert r.status == 400 and r.code == "AccessControlListNotSupported", r


def test_a_wrong_checksum_in_the_query_is_baddigest(bk):
    """The Go and JS presigners put x-amz-checksum-* in the query; S3 verifies it against the body."""
    import bvx_b as X
    body = b"checksummed through the query string"
    good = presigned_put(bk, "ok", {"x-amz-checksum-crc32": X.checksum_b64("CRC32", body), "x-amz-sdk-checksum-algorithm": "CRC32"}, body=body)
    assert good.status == 200, good
    r = presigned_put(bk, "bad", {"x-amz-checksum-crc32": X.wrong_checksum_b64("CRC32", body), "x-amz-sdk-checksum-algorithm": "CRC32"}, body=body)
    assert r.status == 400 and r.code == "BadDigest", "a wrong checksum in the query string was ignored: %r" % r


def test_the_unsigned_payload_marker_in_the_query_is_accepted(bk):
    r = presigned_put(bk, "u", {"X-Amz-Content-Sha256": "UNSIGNED-PAYLOAD"})
    assert r.status == 200, r


def test_content_type_and_cache_control_travel_as_signed_headers_only(bk):
    raw = bk.raw()
    path = "/%s/h" % bk.name
    url = raw.presign("PUT", path, expires=300, extra_signed={"content-type": "text/x-signed"})
    ok = bvh.http_get(url, method="PUT", data=b"x", headers={"Content-Type": "text/x-signed"})
    assert ok.status == 200, ok
    assert bk.head("h")["ContentType"] == "text/x-signed"
    bad = bvh.http_get(url, method="PUT", data=b"x", headers={"Content-Type": "text/x-other"})
    assert bad.status == 403, bad
