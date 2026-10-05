"""SSE-S3 (spec 3.11, 5.2, 5.4.5): bucket default and per-request encryption, ranged reads across the
64 KiB chunk boundaries, multipart, copy semantics, unsupported KMS / SSE-C, admin-managed configuration."""
import base64
import re
import urllib.parse

import pytest

import bvh
import bvx_b as X
from bvh import s3error, uniq, fresh_bucket, ADMIN, MiB, KiB
from bvx_b import hhdr

CHUNK = 64 * KiB


def expected_slice(data, spec):
    m = re.fullmatch(r"bytes=(\d*)-(\d*)", spec)
    a, b = m.groups()
    n = len(data)
    if a == "":
        return data[max(0, n - int(b)):]
    start = int(a)
    end = n - 1 if b == "" else min(int(b), n - 1)
    return data[start:end + 1]


def content_range(data, spec):
    m = re.fullmatch(r"bytes=(\d*)-(\d*)", spec)
    a, b = m.groups()
    n = len(data)
    if a == "":
        start, end = max(0, n - int(b)), n - 1
    else:
        start, end = int(a), (n - 1 if b == "" else min(int(b), n - 1))
    return "bytes %d-%d/%d" % (start, end, n)


def is_encrypted(resp):
    return hhdr(resp).get("x-amz-server-side-encryption") == "AES256"


# ---------------------------------------------------------------------------------------------
# basics: header reporting

def test_bucket_default_encrypts_and_reports_aes256(ebk):
    body = bvh.rnd(1000)
    p = ebk.put("k", body)
    assert p.get("ServerSideEncryption") == "AES256", hhdr(p)
    for r in (ebk.head("k"), ebk.get("k")):
        assert r.get("ServerSideEncryption") == "AES256", hhdr(r)
        assert r["ContentLength"] == 1000, "Content-Length is the plaintext length"
        assert X.unquote_etag(r["ETag"]) == bvh.md5hex(body), "ETag is the MD5 of the plaintext"
    assert ebk.read("k") == body


def test_per_request_sse_on_a_plain_bucket(bk):
    body = bvh.rnd(5000)
    p = bk.put("enc", body, ServerSideEncryption="AES256")
    assert p.get("ServerSideEncryption") == "AES256"
    bk.put("plain", body)
    assert bk.head("enc").get("ServerSideEncryption") == "AES256"
    assert "x-amz-server-side-encryption" not in hhdr(bk.head("plain")), "objects written without SSE stay unencrypted"
    assert bk.read("enc") == body and bk.read("plain") == body


def test_plain_overwrite_of_an_encrypted_object_is_unencrypted(bk):
    bk.put("k", b"secret" * 100, ServerSideEncryption="AES256")
    bk.put("k", b"plain" * 100)
    assert "x-amz-server-side-encryption" not in hhdr(bk.head("k"))
    assert bk.read("k") == b"plain" * 100


def test_listing_shows_plaintext_size_and_etag(ebk):
    body = bvh.rnd(70000)
    ebk.put("k", body)
    o = ebk.s3.list_objects_v2(Bucket=ebk.name)["Contents"][0]
    assert o["Size"] == 70000, "list sizes are plaintext sizes (no GCM overhead): %r" % o["Size"]
    assert X.unquote_etag(o["ETag"]) == bvh.md5hex(body)


@pytest.mark.parametrize("size", [0, 1, 65535, 65536, 65537, 200000, 5 * MiB + 1])
def test_roundtrip_sizes(ebk, size):
    body = bvh.pattern(size, seed=size % 251)
    p = ebk.put("k", body)
    assert X.unquote_etag(p["ETag"]) == bvh.md5hex(body)
    g = ebk.get("k")
    assert g["ContentLength"] == size
    assert g["Body"].read() == body
    assert ebk.head("k")["ContentLength"] == size


# ---------------------------------------------------------------------------------------------
# ranged reads of encrypted objects

BIG = 200000
RANGES = [
    "bytes=0-0", "bytes=0-65535", "bytes=0-65536", "bytes=65535-65536", "bytes=65536-65536", "bytes=65536-131071",
    "bytes=65537-131073", "bytes=131071-131073", "bytes=131072-131072", "bytes=131072-", "bytes=199999-199999",
    "bytes=65000-135000", "bytes=1-199998", "bytes=0-199999", "bytes=199990-", "bytes=-1", "bytes=-100",
    "bytes=-65536", "bytes=-70000", "bytes=-200000", "bytes=-300000", "bytes=0-99999999", "bytes=190000-99999999",
]


@pytest.fixture(scope="module")
def big_encrypted():
    b = fresh_bucket("sserange", encryption="sse-s3")
    data = bvh.pattern(BIG, seed=7)
    b.put("big", data)
    return b, data


@pytest.mark.parametrize("spec", RANGES)
def test_ranged_reads_across_chunk_boundaries(big_encrypted, spec):
    b, data = big_encrypted
    r = b.get("big", Range=spec)
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 206
    want = expected_slice(data, spec)
    got = r["Body"].read()
    assert got == want, "range %s returned %d bytes, expected %d (first mismatch at %s)" % (
        spec, len(got), len(want), next((i for i, (x, y) in enumerate(zip(got, want)) if x != y), "length"))
    assert r["ContentRange"] == content_range(data, spec)
    assert r["ContentLength"] == len(want)
    assert r.get("ServerSideEncryption") == "AES256"


def test_unsatisfiable_range_on_an_encrypted_object(big_encrypted):
    b, data = big_encrypted
    with s3error("InvalidRange", 416):
        b.get("big", Range="bytes=%d-" % BIG)
    with s3error("InvalidRange", 416):
        b.get("big", Range="bytes=%d-%d" % (BIG + 10, BIG + 20))


def test_range_on_an_empty_encrypted_object_is_unsatisfiable(ebk):
    ebk.put("empty", b"")
    with s3error("InvalidRange", 416):
        ebk.get("empty", Range="bytes=0-0")
    assert ebk.read("empty") == b""


@pytest.mark.parametrize("size", [1, 65535, 65536, 65537])
def test_edge_ranges_for_each_object_size(ebk, size):
    data = bvh.pattern(size, seed=3)
    ebk.put("k", data)
    specs = ["bytes=0-0", "bytes=%d-%d" % (size - 1, size - 1), "bytes=-1", "bytes=0-%d" % (size - 1)]
    if size > CHUNK:
        specs += ["bytes=%d-%d" % (CHUNK - 1, CHUNK), "bytes=%d-" % CHUNK, "bytes=%d-%d" % (CHUNK, CHUNK)]
    if size >= CHUNK:
        specs += ["bytes=%d-%d" % (CHUNK - 1, CHUNK - 1)]
    for spec in specs:
        assert ebk.read("k", Range=spec) == expected_slice(data, spec), "size %d range %s" % (size, spec)


def test_ranged_read_near_the_end_of_a_five_mib_object(ebk):
    data = bvh.pattern(5 * MiB + 1, seed=11)
    ebk.put("k", data)
    for spec in ("bytes=-10", "bytes=5242870-5242880", "bytes=%d-" % (5 * MiB - 3), "bytes=5177340-5177350"):
        assert ebk.read("k", Range=spec) == expected_slice(data, spec), spec


def test_conditional_get_on_an_encrypted_object(ebk):
    data = bvh.rnd(3000)
    p = ebk.put("k", data)
    etag = p["ETag"]
    with s3error(None, 304):
        ebk.get("k", IfNoneMatch=etag)
    assert ebk.get("k", IfMatch=etag)["Body"].read() == data
    with s3error("PreconditionFailed", 412):
        ebk.get("k", IfMatch='"0123456789abcdef0123456789abcdef"')


# ---------------------------------------------------------------------------------------------
# multipart

def mp_upload(b, key, parts, **create):
    """Upload `parts` (list of bytes) and complete; returns (complete response, create response)."""
    c = b.s3.create_multipart_upload(Bucket=b.name, Key=key, **create)
    done = []
    for i, p in enumerate(parts, 1):
        r = b.s3.upload_part(Bucket=b.name, Key=key, UploadId=c["UploadId"], PartNumber=i, Body=p)
        done.append({"PartNumber": i, "ETag": r["ETag"]})
    return b.s3.complete_multipart_upload(Bucket=b.name, Key=key, UploadId=c["UploadId"], MultipartUpload={"Parts": done}), c


def test_multipart_into_an_sse_bucket(ebk):
    p1, p2 = bvh.pattern(5 * MiB, seed=1), bvh.pattern(123 * KiB + 5, seed=2)
    c = ebk.s3.create_multipart_upload(Bucket=ebk.name, Key="mp")
    assert c.get("ServerSideEncryption") == "AES256", "Create reports the bucket default: %r" % hhdr(c)
    up1 = ebk.s3.upload_part(Bucket=ebk.name, Key="mp", UploadId=c["UploadId"], PartNumber=1, Body=p1)
    up2 = ebk.s3.upload_part(Bucket=ebk.name, Key="mp", UploadId=c["UploadId"], PartNumber=2, Body=p2)
    assert up1.get("ServerSideEncryption") == "AES256"
    done = ebk.s3.complete_multipart_upload(Bucket=ebk.name, Key="mp", UploadId=c["UploadId"], MultipartUpload={
        "Parts": [{"PartNumber": 1, "ETag": up1["ETag"]}, {"PartNumber": 2, "ETag": up2["ETag"]}]})
    assert done.get("ServerSideEncryption") == "AES256", hhdr(done)
    assert X.unquote_etag(done["ETag"]) == bvh.multipart_etag([p1, p2]), "ETag is computed over plaintext parts"
    h = ebk.head("mp")
    assert h.get("ServerSideEncryption") == "AES256" and h["ContentLength"] == len(p1) + len(p2)
    assert ebk.read("mp") == p1 + p2
    whole = p1 + p2
    for spec in ("bytes=5242870-5242890", "bytes=%d-%d" % (5 * MiB - 1, 5 * MiB), "bytes=-5", "bytes=65530-65540", "bytes=1000000-1200000"):
        assert ebk.read("mp", Range=spec) == expected_slice(whole, spec), spec


def test_multipart_object_in_an_sse_bucket_serves_part_numbers_in_plaintext(ebk):
    p1, p2 = bvh.pattern(5 * MiB, seed=1), bvh.pattern(70000, seed=2)
    mp_upload(ebk, "mp", [p1, p2])
    g = ebk.get("mp", PartNumber=2)
    assert g["ResponseMetadata"]["HTTPStatusCode"] == 206
    assert g["Body"].read() == p2 and g["PartsCount"] == 2
    assert ebk.read("mp", PartNumber=1) == p1


def test_multipart_with_per_request_sse_on_a_plain_bucket(bk):
    p1, p2 = bvh.pattern(5 * MiB, seed=3), bvh.pattern(1000, seed=4)
    done, c = mp_upload(bk, "mp", [p1, p2], ServerSideEncryption="AES256")
    assert c.get("ServerSideEncryption") == "AES256"
    assert done.get("ServerSideEncryption") == "AES256"
    h = bk.head("mp")
    assert h.get("ServerSideEncryption") == "AES256"
    assert bk.read("mp") == p1 + p2
    assert bk.read("mp", Range="bytes=5242870-5242890") == (p1 + p2)[5242870:5242891]


def test_multipart_without_sse_on_a_plain_bucket_stays_plain(bk):
    done, c = mp_upload(bk, "mp", [bvh.rnd(5 * MiB), b"tail"])
    assert "x-amz-server-side-encryption" not in hhdr(c) and "x-amz-server-side-encryption" not in hhdr(done)
    assert "x-amz-server-side-encryption" not in hhdr(bk.head("mp"))


def test_list_parts_of_an_encrypted_upload_reports_plaintext_sizes(ebk):
    c = ebk.s3.create_multipart_upload(Bucket=ebk.name, Key="mp")
    ebk.s3.upload_part(Bucket=ebk.name, Key="mp", UploadId=c["UploadId"], PartNumber=1, Body=bvh.rnd(1000))
    ebk.s3.upload_part(Bucket=ebk.name, Key="mp", UploadId=c["UploadId"], PartNumber=2, Body=bvh.rnd(70000))
    r = ebk.s3.list_parts(Bucket=ebk.name, Key="mp", UploadId=c["UploadId"])
    assert [(p["PartNumber"], p["Size"]) for p in r["Parts"]] == [(1, 1000), (2, 70000)]
    ebk.s3.abort_multipart_upload(Bucket=ebk.name, Key="mp", UploadId=c["UploadId"])


def test_upload_part_copy_from_an_encrypted_source_makes_the_upload_encrypted(bk):
    """Spec 3.11: UploadPartCopy cannot decrypt, so the whole upload becomes encrypted."""
    src = bvh.pattern(6 * MiB, seed=5)
    bk.put("src", src, ServerSideEncryption="AES256")
    c = bk.s3.create_multipart_upload(Bucket=bk.name, Key="dst")                      # no SSE requested
    assert "x-amz-server-side-encryption" not in hhdr(c)
    r1 = bk.s3.upload_part_copy(Bucket=bk.name, Key="dst", UploadId=c["UploadId"], PartNumber=1,
                                CopySource={"Bucket": bk.name, "Key": "src"}, CopySourceRange="bytes=0-5242879")
    tail = b"tail-bytes"
    r2 = bk.s3.upload_part(Bucket=bk.name, Key="dst", UploadId=c["UploadId"], PartNumber=2, Body=tail)
    bk.s3.complete_multipart_upload(Bucket=bk.name, Key="dst", UploadId=c["UploadId"], MultipartUpload={
        "Parts": [{"PartNumber": 1, "ETag": r1["CopyPartResult"]["ETag"]}, {"PartNumber": 2, "ETag": r2["ETag"]}]})
    h = bk.head("dst")
    assert h.get("ServerSideEncryption") == "AES256", "a part copied from an encrypted source makes the object encrypted: %r" % hhdr(h)
    assert bk.read("dst") == src[:5242880] + tail


def test_upload_part_copy_from_a_plain_source_into_an_encrypted_upload(bk):
    src = bvh.pattern(6 * MiB, seed=6)
    bk.put("src", src)
    c = bk.s3.create_multipart_upload(Bucket=bk.name, Key="dst", ServerSideEncryption="AES256")
    r1 = bk.s3.upload_part_copy(Bucket=bk.name, Key="dst", UploadId=c["UploadId"], PartNumber=1,
                                CopySource={"Bucket": bk.name, "Key": "src"}, CopySourceRange="bytes=0-5242879")
    r2 = bk.s3.upload_part(Bucket=bk.name, Key="dst", UploadId=c["UploadId"], PartNumber=2, Body=b"end")
    bk.s3.complete_multipart_upload(Bucket=bk.name, Key="dst", UploadId=c["UploadId"], MultipartUpload={
        "Parts": [{"PartNumber": 1, "ETag": r1["CopyPartResult"]["ETag"]}, {"PartNumber": 2, "ETag": r2["ETag"]}]})
    assert bk.head("dst").get("ServerSideEncryption") == "AES256"
    assert bk.read("dst") == src[:5242880] + b"end"
    assert "x-amz-server-side-encryption" not in hhdr(bk.head("src")), "the source stays as it was"


def test_parts_may_be_reuploaded_in_an_encrypted_upload(ebk):
    c = ebk.s3.create_multipart_upload(Bucket=ebk.name, Key="mp")
    a, b2 = bvh.rnd(5 * MiB), bvh.rnd(5 * MiB)
    ebk.s3.upload_part(Bucket=ebk.name, Key="mp", UploadId=c["UploadId"], PartNumber=1, Body=a)
    r = ebk.s3.upload_part(Bucket=ebk.name, Key="mp", UploadId=c["UploadId"], PartNumber=1, Body=b2)
    tail = b"z" * 10
    r2 = ebk.s3.upload_part(Bucket=ebk.name, Key="mp", UploadId=c["UploadId"], PartNumber=2, Body=tail)
    ebk.s3.complete_multipart_upload(Bucket=ebk.name, Key="mp", UploadId=c["UploadId"], MultipartUpload={
        "Parts": [{"PartNumber": 1, "ETag": r["ETag"]}, {"PartNumber": 2, "ETag": r2["ETag"]}]})
    assert ebk.read("mp") == b2 + tail


# ---------------------------------------------------------------------------------------------
# copy semantics

def test_copy_of_an_encrypted_object_stays_encrypted(bk):
    data = bvh.rnd(100000)
    bk.put("src", data, ServerSideEncryption="AES256")
    c = bk.s3.copy_object(Bucket=bk.name, Key="dst", CopySource={"Bucket": bk.name, "Key": "src"})
    assert c.get("ServerSideEncryption") == "AES256", "a copy never silently decrypts: %r" % hhdr(c)
    assert bk.head("dst").get("ServerSideEncryption") == "AES256"
    assert bk.read("dst") == data
    assert bk.read("dst", Range="bytes=65530-65545") == data[65530:65546]


def test_copy_with_the_sse_header_encrypts_a_plain_source(bk):
    data = bvh.rnd(100000)
    bk.put("src", data)
    c = bk.s3.copy_object(Bucket=bk.name, Key="dst", CopySource={"Bucket": bk.name, "Key": "src"}, ServerSideEncryption="AES256")
    assert c.get("ServerSideEncryption") == "AES256"
    assert bk.head("dst").get("ServerSideEncryption") == "AES256" and bk.read("dst") == data
    assert "x-amz-server-side-encryption" not in hhdr(bk.head("src"))
    assert X.unquote_etag(bk.head("dst")["ETag"]) == bvh.md5hex(data)


def test_copy_into_a_bucket_whose_default_became_sse_encrypts_the_copy(bk):
    data = bvh.rnd(40000)
    bk.put("src", data)
    ADMIN.patch_bucket(bk.name, encryption="sse-s3")
    bk.s3.copy_object(Bucket=bk.name, Key="dst", CopySource={"Bucket": bk.name, "Key": "src"})
    assert bk.head("dst").get("ServerSideEncryption") == "AES256"
    assert "x-amz-server-side-encryption" not in hhdr(bk.head("src")), "existing objects keep the state they were written in"
    assert bk.read("dst") == data and bk.read("src") == data


def test_self_copy_of_an_unencrypted_object_in_an_sse_default_bucket_encrypts_it(bk):
    """Spec 5.4.5: this is how existing objects get encrypted."""
    data = bvh.rnd(40000)
    bk.put("k", data)
    ADMIN.patch_bucket(bk.name, encryption="sse-s3")
    r = bk.s3.copy_object(Bucket=bk.name, Key="k", CopySource={"Bucket": bk.name, "Key": "k"})
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200
    assert bk.head("k").get("ServerSideEncryption") == "AES256"
    assert bk.read("k") == data


def test_self_copy_of_an_encrypted_object_without_changes_is_invalid(ebk):
    ebk.put("k", b"x" * 100)
    with s3error("InvalidRequest", 400):
        ebk.s3.copy_object(Bucket=ebk.name, Key="k", CopySource={"Bucket": ebk.name, "Key": "k"})
    # but with replaced metadata it is a legitimate copy
    ebk.s3.copy_object(Bucket=ebk.name, Key="k", CopySource={"Bucket": ebk.name, "Key": "k"}, MetadataDirective="REPLACE", Metadata={"a": "b"})
    assert ebk.head("k")["Metadata"] == {"a": "b"} and ebk.head("k").get("ServerSideEncryption") == "AES256"


def test_deleting_the_source_of_an_encrypted_copy_leaves_the_copy_readable(bk):
    data = bvh.rnd(70000)
    bk.put("src", data, ServerSideEncryption="AES256")
    bk.s3.copy_object(Bucket=bk.name, Key="dst", CopySource={"Bucket": bk.name, "Key": "src"})
    bk.delete("src")
    assert bk.read("dst") == data
    assert bk.read("dst", Range="bytes=-100") == data[-100:]


def test_copy_of_an_encrypted_multipart_object(ebk):
    p1, p2 = bvh.pattern(5 * MiB, seed=8), bvh.pattern(777, seed=9)
    mp_upload(ebk, "src", [p1, p2])
    ebk.s3.copy_object(Bucket=ebk.name, Key="dst", CopySource={"Bucket": ebk.name, "Key": "src"})
    assert ebk.read("dst") == p1 + p2
    assert ebk.head("dst").get("ServerSideEncryption") == "AES256"


def test_copy_with_replaced_metadata_keeps_encryption(bk):
    bk.put("src", b"data" * 1000, ServerSideEncryption="AES256", ContentType="text/plain")
    bk.s3.copy_object(Bucket=bk.name, Key="dst", CopySource={"Bucket": bk.name, "Key": "src"},
                      MetadataDirective="REPLACE", ContentType="application/json", Metadata={"x": "y"})
    h = bk.head("dst")
    assert h.get("ServerSideEncryption") == "AES256" and h["ContentType"] == "application/json" and h["Metadata"] == {"x": "y"}


# ---------------------------------------------------------------------------------------------
# unsupported flavours: KMS and customer keys

KMS = [("aws:kms", {}), ("aws:kms:dsse", {}), ("aws:kms", {"SSEKMSKeyId": "arn:aws:kms:us-east-1:111122223333:key/abc"}),
       ("AES256", {"SSEKMSKeyId": "alias/x"})]


@pytest.mark.parametrize("alg,extra", KMS, ids=["kms", "kms-dsse", "kms-with-key-id", "aes256-with-kms-key-id"])
def test_kms_on_put_is_not_implemented(bk, alg, extra):
    with s3error("NotImplemented", 501):
        bk.put("k", b"x", ServerSideEncryption=alg, **extra)
    with s3error(None, 404):
        bk.head("k")


def test_kms_on_create_multipart_and_copy_is_not_implemented(bk):
    with s3error("NotImplemented", 501):
        bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp", ServerSideEncryption="aws:kms")
    bk.put("src", b"x" * 10)
    with s3error("NotImplemented", 501):
        bk.s3.copy_object(Bucket=bk.name, Key="dst", CopySource={"Bucket": bk.name, "Key": "src"}, ServerSideEncryption="aws:kms")


def test_sse_c_on_put_is_not_implemented(bk):
    with s3error("NotImplemented", 501):
        bk.put("k", b"x", SSECustomerAlgorithm="AES256", SSECustomerKey=b"0123456789abcdef0123456789abcdef")
    with s3error(None, 404):
        bk.head("k")


def test_sse_c_on_multipart_and_copy_source_is_not_implemented(bk):
    key = b"0123456789abcdef0123456789abcdef"
    with s3error("NotImplemented", 501):
        bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp", SSECustomerAlgorithm="AES256", SSECustomerKey=key)
    bk.put("src", b"x" * 10)
    with s3error("NotImplemented", 501):
        bk.s3.copy_object(Bucket=bk.name, Key="dst", CopySource={"Bucket": bk.name, "Key": "src"},
                          CopySourceSSECustomerAlgorithm="AES256", CopySourceSSECustomerKey=key)


def test_sse_c_headers_on_a_read_are_not_silently_ignored(bk):
    """Spec 5.1: a recognised x-amz-* header that implies unsupported behaviour is rejected rather than ignored.
    A GET carrying SSE-C headers for an object that is not SSE-C encrypted must not quietly return the data
    (real S3 answers 400 InvalidRequest)."""
    bk.put("k", b"plain data")
    with pytest.raises(Exception) as ei:
        bk.get("k", SSECustomerAlgorithm="AES256", SSECustomerKey=b"0123456789abcdef0123456789abcdef")
    status = ei.value.response["ResponseMetadata"]["HTTPStatusCode"]
    assert status in (400, 501), "expected a 400/501 refusal, got HTTP %s" % status


# ---------------------------------------------------------------------------------------------
# bucket-level API

def test_get_bucket_encryption_reports_the_default(ebk):
    r = ebk.s3.get_bucket_encryption(Bucket=ebk.name)
    rules = r["ServerSideEncryptionConfiguration"]["Rules"]
    assert len(rules) == 1
    assert rules[0]["ApplyServerSideEncryptionByDefault"]["SSEAlgorithm"] == "AES256"
    assert "KMSMasterKeyID" not in rules[0]["ApplyServerSideEncryptionByDefault"]


def test_get_bucket_encryption_without_a_default_is_not_found(bk):
    with s3error("ServerSideEncryptionConfigurationNotFoundError", 404):
        bk.s3.get_bucket_encryption(Bucket=bk.name)


def test_put_and_delete_bucket_encryption_are_access_denied(bk, ebk):
    for b in (bk, ebk):
        with s3error("AccessDenied", 403):
            b.s3.put_bucket_encryption(Bucket=b.name, ServerSideEncryptionConfiguration={
                "Rules": [{"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]})
        with s3error("AccessDenied", 403):
            b.s3.delete_bucket_encryption(Bucket=b.name)
    assert ebk.s3.get_bucket_encryption(Bucket=ebk.name), "the refused delete must not have removed the default"


def test_admin_enabling_sse_encrypts_only_new_writes(bk):
    old = bvh.rnd(1000)
    bk.put("old", old)
    with s3error("ServerSideEncryptionConfigurationNotFoundError", 404):
        bk.s3.get_bucket_encryption(Bucket=bk.name)
    ADMIN.patch_bucket(bk.name, encryption="sse-s3")
    new = bvh.rnd(1000)
    bk.put("new", new)
    assert "x-amz-server-side-encryption" not in hhdr(bk.head("old"))
    assert bk.head("new").get("ServerSideEncryption") == "AES256"
    assert bk.read("old") == old and bk.read("new") == new
    assert bk.s3.get_bucket_encryption(Bucket=bk.name)["ServerSideEncryptionConfiguration"]["Rules"][0]["ApplyServerSideEncryptionByDefault"]["SSEAlgorithm"] == "AES256"


def test_disabling_the_default_keeps_old_encrypted_objects_readable(ebk):
    old = bvh.pattern(150000, seed=12)
    ebk.put("old", old)
    ADMIN.patch_bucket(ebk.name, encryption="none")
    new = bvh.rnd(1000)
    ebk.put("new", new)
    assert "x-amz-server-side-encryption" not in hhdr(ebk.head("new"))
    assert ebk.head("old").get("ServerSideEncryption") == "AES256"
    assert ebk.read("old") == old, "existing objects keep the state they were written in and stay readable"
    assert ebk.read("old", Range="bytes=65530-70000") == old[65530:70001]
    with s3error("ServerSideEncryptionConfigurationNotFoundError", 404):
        ebk.s3.get_bucket_encryption(Bucket=ebk.name)


# ---------------------------------------------------------------------------------------------
# other read paths: presigned URLs, anonymous, checksums, versions

def test_presigned_get_of_an_encrypted_object_returns_plaintext(ebk):
    data = bvh.rnd(90000)
    ebk.put("k", data)
    url = ebk.s3.generate_presigned_url("get_object", Params={"Bucket": ebk.name, "Key": "k"}, ExpiresIn=300)
    r = bvh.http_get(url)
    assert r.status == 200 and r.body == data
    assert r.header("x-amz-server-side-encryption") == "AES256"
    r = bvh.http_get(url, headers={"Range": "bytes=65535-65540"})
    assert r.status == 206 and r.body == data[65535:65541]


def test_anonymous_read_of_an_encrypted_object_returns_plaintext():
    b = fresh_bucket("anonsse", encryption="sse-s3", anonymous_read="objects")
    data = bvh.pattern(150000, seed=2)
    b.put("pub", data)
    r = bvh.http_get(b.url("pub"))
    assert r.status == 200 and r.body == data
    assert r.header("x-amz-server-side-encryption") == "AES256"
    r = bvh.http_get(b.url("pub"), headers={"Range": "bytes=131071-131073"})
    assert r.status == 206 and r.body == data[131071:131074]


def test_checksums_of_an_encrypted_object_describe_the_plaintext(ebk):
    data = bvh.rnd(200000)
    p = ebk.put("k", data, ChecksumAlgorithm="SHA256")
    want = X.checksum_b64("SHA256", data)
    assert p["ChecksumSHA256"] == want
    h = ebk.head("k", ChecksumMode="ENABLED")
    assert h["ChecksumSHA256"] == want
    g = ebk.get("k", ChecksumMode="ENABLED")
    assert g["ChecksumSHA256"] == want and g["Body"].read() == data


def test_encrypted_objects_in_a_versioned_bucket_keep_every_version_readable():
    b = fresh_bucket("vsse", versioning="enabled", encryption="sse-s3")
    v1 = bvh.pattern(130000, seed=1)
    v2 = bvh.pattern(70000, seed=2)
    r1, r2 = b.put("k", v1), b.put("k", v2)
    assert r1["VersionId"] != r2["VersionId"] and r1.get("ServerSideEncryption") == "AES256"
    assert b.read("k", VersionId=r1["VersionId"]) == v1
    assert b.read("k") == v2
    assert b.read("k", VersionId=r1["VersionId"], Range="bytes=65535-65537") == v1[65535:65538]
    b.delete("k")
    assert b.read("k", VersionId=r2["VersionId"]) == v2


def test_suite_versioned_bucket_is_encrypted_and_versioned(versioned):
    key = uniq("sv")
    r1, r2 = versioned.put(key, b"one" * 5000), versioned.put(key, b"two" * 5000)
    assert r1["VersionId"] != r2["VersionId"]
    for r in (r1, r2):
        assert r.get("ServerSideEncryption") == "AES256"
    assert versioned.read(key, VersionId=r1["VersionId"]) == b"one" * 5000


def test_encrypted_object_with_metadata_and_tags(ebk):
    ebk.put("k", b"data" * 100, Metadata={"a": "b"}, ContentType="text/plain", Tagging="t=1")
    ebk.s3.put_object_tagging(Bucket=ebk.name, Key="k", Tagging={"TagSet": [{"Key": "t", "Value": "2"}]})
    h = ebk.head("k")
    assert h["Metadata"] == {"a": "b"} and h["ContentType"] == "text/plain" and h.get("ServerSideEncryption") == "AES256"
    assert ebk.s3.get_object_tagging(Bucket=ebk.name, Key="k")["TagSet"] == [{"Key": "t", "Value": "2"}]
    assert ebk.read("k") == b"data" * 100


def test_many_small_encrypted_objects_are_independent(ebk):
    data = {("k%02d" % i): bvh.rnd(i * 17 + 1) for i in range(30)}
    for k, v in data.items():
        ebk.put(k, v)
    for k, v in data.items():
        assert ebk.read(k) == v, k


def test_concurrent_encrypted_uploads_and_downloads(ebk):
    data = {("c%02d" % i): bvh.pattern(70000 + i * 1000, seed=i) for i in range(12)}

    def up(k):
        return lambda: ebk.put(k, data[k])

    res = bvh.run_threads([up(k) for k in data])
    assert not [r for r in res if isinstance(r, BaseException)], res

    def down(k):
        return lambda: ebk.read(k)

    res = bvh.run_threads([down(k) for k in data])
    for k, r in zip(data, res):
        assert not isinstance(r, BaseException), r
        assert r == data[k], k
