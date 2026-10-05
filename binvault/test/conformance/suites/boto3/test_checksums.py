"""Checksums and payload framing: x-amz-checksum-*, trailers, aws-chunked, Content-MD5, multipart composites (spec 5.8, 5.6).

Three ways a checksum reaches the server, all exercised here:
  * a header (what botocore sends over plain http),
  * a trailer of an aws-chunked body (what every current SDK sends over https; a TLS-terminating proxy lets botocore do it),
  * hand-made aws-chunked bodies in all three STREAMING-* modes with valid and corrupted signatures.
"""
import base64
import hashlib

import pytest

import bvh
import bvx_b as X
from bvh import KiB, MiB, hdr, md5hex, multipart_etag, rnd, s3error, uniq
from bvx_a import raw_get, raw_head, raw_put
from bvx_b import ALGOS, checksum_b64, composite_b64, hname, need_crt, pname, wrong_checksum_b64

MIN = 5 * MiB
ALGO_IDS = ALGOS


@pytest.fixture(scope="module")
def tls():
    p = X.TlsProxy(bvh.PORT)
    yield p
    p.stop()


def other_algo(alg):
    return "SHA256" if alg != "SHA256" else "SHA1"


def stored_checksum(bk, key, alg, **kw):
    r = bk.s3.head_object(Bucket=bk.name, Key=key, ChecksumMode="ENABLED", **kw)
    return r.get(pname(alg)), r


# --------------------------------------------------------------------------------------------
# header form (plain http)

@pytest.mark.parametrize("alg", ALGO_IDS)
def test_put_with_a_checksum_header_is_verified_stored_and_returned(bk, alg):
    need_crt(alg)
    body = rnd(70 * KiB)
    r = bk.put("k", body, ChecksumAlgorithm=alg)
    want = checksum_b64(alg, body)
    assert r[pname(alg)] == want and hdr(r, hname(alg)) == want, "PutObject echoes the stored checksum"
    assert r["ETag"] == '"%s"' % md5hex(body)
    got, h = stored_checksum(bk, "k", alg)
    assert got == want, "HEAD with ChecksumMode=ENABLED returns the checksum"
    g = bk.s3.get_object(Bucket=bk.name, Key="k", ChecksumMode="ENABLED")
    assert g[pname(alg)] == want
    assert hdr(g, "x-amz-checksum-type") in (None, "FULL_OBJECT")
    assert g["Body"].read() == body


@pytest.mark.parametrize("alg", ALGO_IDS)
def test_the_stored_checksum_is_not_returned_unless_asked_for(bk, alg):
    need_crt(alg)
    bk.put("k", b"some data", ChecksumAlgorithm=alg)
    for fn in (raw_head, raw_get):
        r = fn(bk, "k")
        assert r.status == 200
        assert not [h for h in r.headers if h.startswith("x-amz-checksum")], "checksum headers need x-amz-checksum-mode: ENABLED: %r" % r.raw_headers
        r = fn(bk, "k", headers={"x-amz-checksum-mode": "ENABLED"})
        assert r.header(hname(alg)) == checksum_b64(alg, b"some data"), r.raw_headers


@pytest.mark.parametrize("alg", ALGO_IDS)
def test_a_wrong_checksum_header_is_baddigest_and_stores_nothing(bk, alg):
    need_crt(alg)
    bk.put("k", b"original")
    body = rnd(1000)
    bad = wrong_checksum_b64(alg, body)
    with s3error("BadDigest", 400):
        bk.s3.put_object(Bucket=bk.name, Key="k2", Body=body, **{pname(alg): bad})
    with s3error("BadDigest", 400):
        bk.s3.put_object(Bucket=bk.name, Key="k", Body=body, **{pname(alg): bad})
    assert bk.read("k") == b"original", "a failed overwrite must leave the old object"
    with s3error(None, 404):
        bk.head("k2")


@pytest.mark.parametrize("alg", ALGO_IDS)
def test_a_malformed_checksum_value_is_a_client_error(bk, alg):
    for value in ("!!not-base64!!", "AAAA", base64.b64encode(b"x" * 3).decode(), ""):
        r = raw_put(bk, uniq("m"), b"data", headers={hname(alg): value, "x-amz-sdk-checksum-algorithm": alg})
        assert r.status == 400 and r.code in ("InvalidRequest", "InvalidDigest", "BadDigest", "InvalidArgument"), (value, r)


def test_two_different_checksum_headers_are_refused(bk):
    body = b"data for two checksums"
    r = raw_put(bk, "k", body, headers={hname("CRC32"): checksum_b64("CRC32", body), hname("SHA256"): checksum_b64("SHA256", body)})
    assert r.status == 400 and r.code == "InvalidRequest", r
    with s3error(None, 404):
        bk.head("k")


@pytest.mark.parametrize("algo", ["sha512", "md5", "xxhash64", "xxhash3", "xxhash128"])
def test_checksum_headers_of_unknown_algorithms_are_not_silently_ignored(bk, algo):
    """Newer S3 knows more algorithms than the spec lists (5.8). A client that sends x-amz-checksum-<algo> expects the
    body to be verified; accepting the header and storing the object unverified would be a silent integrity gap."""
    body = b"data for an algorithm binvault does not implement"
    key = uniq("unk")
    r = raw_put(bk, key, body, headers={"x-amz-checksum-" + algo: base64.b64encode(hashlib.sha512(body).digest()).decode(),
                                        "x-amz-sdk-checksum-algorithm": algo.upper()})
    assert r.status in (400, 501) and r.code in ("InvalidRequest", "NotImplemented", "InvalidArgument"), r
    with s3error(None, 404):
        bk.head(key)


def test_checksum_of_an_empty_body(bk):
    for alg in ("CRC32", "SHA256", "SHA1"):
        r = bk.put("empty-" + alg, b"", ChecksumAlgorithm=alg)
        assert r[pname(alg)] == checksum_b64(alg, b"")
        assert stored_checksum(bk, "empty-" + alg, alg)[0] == checksum_b64(alg, b"")


def test_overwrite_without_a_checksum_drops_the_old_one(bk):
    bk.put("k", b"first", ChecksumAlgorithm="SHA256")
    c = bvh.make_client(bk.ak, bk.sk, checksum_calculation="when_required")
    c.put_object(Bucket=bk.name, Key="k", Body=b"second")
    r = bk.s3.head_object(Bucket=bk.name, Key="k", ChecksumMode="ENABLED")
    assert not any(k.startswith("Checksum") and k != "ChecksumMode" for k in r), r
    r = raw_head(bk, "k", headers={"x-amz-checksum-mode": "ENABLED"})
    assert not [h for h in r.headers if h.startswith("x-amz-checksum")], r.raw_headers


def test_a_default_boto3_put_carries_a_crc32_the_server_stores(bk):
    with bvh.Capture(bk.s3) as cap:
        bk.put("k", b"hello")
    assert cap.header("x-amz-checksum-crc32") == checksum_b64("CRC32", b"hello"), "this botocore sends CRC32 by default"
    assert stored_checksum(bk, "k", "CRC32")[0] == checksum_b64("CRC32", b"hello")


def test_copy_keeps_the_source_checksum(bk):
    body = rnd(5000)
    bk.put("src", body, ChecksumAlgorithm="SHA256")
    bk.s3.copy_object(Bucket=bk.name, Key="dst", CopySource={"Bucket": bk.name, "Key": "src"})
    assert stored_checksum(bk, "dst", "SHA256")[0] == checksum_b64("SHA256", body)


def test_get_validation_by_boto3_passes_for_single_and_multipart_objects(bk):
    c = bvh.make_client(bk.ak, bk.sk, checksum_validation="when_supported")
    body = rnd(MIN + 100)
    bk.put("single", body, ChecksumAlgorithm="CRC32")
    assert c.get_object(Bucket=bk.name, Key="single")["Body"].read() == body
    up = bk.s3.create_multipart_upload(Bucket=bk.name, Key="multi", ChecksumAlgorithm="CRC32")["UploadId"]
    parts = [rnd(MIN), rnd(10)]
    done = []
    for i, p in enumerate(parts, 1):
        r = bk.s3.upload_part(Bucket=bk.name, Key="multi", UploadId=up, PartNumber=i, Body=p, ChecksumAlgorithm="CRC32")
        done.append({"PartNumber": i, "ETag": r["ETag"], "ChecksumCRC32": r["ChecksumCRC32"]})
    bk.s3.complete_multipart_upload(Bucket=bk.name, Key="multi", UploadId=up, MultipartUpload={"Parts": done})
    assert c.get_object(Bucket=bk.name, Key="multi")["Body"].read() == b"".join(parts)


# --------------------------------------------------------------------------------------------
# Content-MD5

def test_content_md5_good_bad_and_malformed(bk):
    body = rnd(3000)
    good = base64.b64encode(hashlib.md5(body).digest()).decode()
    assert bk.put("k", body, ContentMD5=good)["ETag"] == '"%s"' % md5hex(body)
    bad = base64.b64encode(hashlib.md5(b"other").digest()).decode()
    with s3error("BadDigest", 400):
        bk.put("k2", body, ContentMD5=bad)
    for junk in ("@@@@", "AAAA", base64.b64encode(b"short").decode()):
        r = raw_put(bk, "k3", body, headers={"Content-MD5": junk})
        assert r.status == 400 and r.code == "InvalidDigest", (junk, r)
    for k in ("k2", "k3"):
        with s3error(None, 404):
            bk.head(k)


def test_content_md5_of_an_empty_body(bk):
    good = base64.b64encode(hashlib.md5(b"").digest()).decode()
    assert bk.put("e", b"", ContentMD5=good)["ETag"] == '"%s"' % md5hex(b"")
    with s3error("BadDigest", 400):
        bk.put("e2", b"", ContentMD5=base64.b64encode(hashlib.md5(b"x").digest()).decode())


def test_content_md5_and_a_checksum_header_together(bk):
    body = rnd(100)
    md5 = base64.b64encode(hashlib.md5(body).digest()).decode()
    r = raw_put(bk, "k", body, headers={"Content-MD5": md5, hname("CRC32"): checksum_b64("CRC32", body)})
    assert r.status == 200, r
    r = raw_put(bk, "k", body, headers={"Content-MD5": md5, hname("CRC32"): wrong_checksum_b64("CRC32", body)})
    assert r.status == 400 and r.code == "BadDigest", r


# --------------------------------------------------------------------------------------------
# trailers sent by a real SDK over https (via the TLS proxy)

@pytest.mark.parametrize("size", [0, 1, 1000, 64 * KiB, 64 * KiB + 1, 3 * MiB + 17])
def test_boto3_over_https_uses_an_unsigned_trailer_by_default(bk, tls, size):
    c = tls.client(bk.ak, bk.sk)
    body = rnd(size)
    with bvh.Capture(c) as cap:
        r = c.put_object(Bucket=bk.name, Key="t", Body=body)
    assert cap.header("x-amz-content-sha256") == "STREAMING-UNSIGNED-PAYLOAD-TRAILER", "this botocore must use the trailer form over https"
    assert cap.header("x-amz-trailer") == "x-amz-checksum-crc32"
    assert r["ETag"] == '"%s"' % md5hex(body)
    assert bk.read("t") == body
    got, h = stored_checksum(bk, "t", "CRC32")
    assert got == checksum_b64("CRC32", body)
    assert "aws-chunked" not in (h.get("ContentEncoding") or ""), "aws-chunked is framing, not a stored encoding"


@pytest.mark.parametrize("alg", ALGO_IDS)
def test_boto3_over_https_with_each_trailer_algorithm(bk, tls, alg):
    need_crt(alg)
    c = tls.client(bk.ak, bk.sk)
    body = rnd(200 * KiB)
    c.put_object(Bucket=bk.name, Key="t", Body=body, ChecksumAlgorithm=alg)
    assert bk.read("t") == body
    assert stored_checksum(bk, "t", alg)[0] == checksum_b64(alg, body)


def test_boto3_over_https_with_signed_payload_trailer_setting(bk, tls):
    c = tls.client(bk.ak, bk.sk, payload_signing=True)
    body = rnd(100 * KiB)
    with bvh.Capture(c) as cap:
        c.put_object(Bucket=bk.name, Key="t", Body=body)
    assert cap.header("x-amz-content-sha256")
    assert bk.read("t") == body


def test_boto3_over_https_upload_part_and_complete(bk, tls):
    c = tls.client(bk.ak, bk.sk)
    parts = [rnd(MIN), rnd(50)]
    up = c.create_multipart_upload(Bucket=bk.name, Key="mp", ChecksumAlgorithm="CRC32")["UploadId"]
    done = []
    for i, p in enumerate(parts, 1):
        r = c.upload_part(Bucket=bk.name, Key="mp", UploadId=up, PartNumber=i, Body=p, ChecksumAlgorithm="CRC32")
        assert r["ChecksumCRC32"] == checksum_b64("CRC32", p)
        done.append({"PartNumber": i, "ETag": r["ETag"], "ChecksumCRC32": r["ChecksumCRC32"]})
    r = c.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=up, MultipartUpload={"Parts": done})
    assert r["ChecksumCRC32"] == composite_b64("CRC32", parts)
    assert bk.read("mp") == b"".join(parts)


# --------------------------------------------------------------------------------------------
# hand-made aws-chunked bodies

MODES = ["signed", "signed-trailer", "unsigned-trailer"]


def put_raw(bk, key, data, mode, **kw):
    alg = kw.pop("trailer_alg", "CRC32")
    return X.put_chunked(bk, key, data, mode, trailer_alg=alg, **kw)


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("size", [0, 1, 100, 64 * KiB, 64 * KiB + 1, 1 * MiB + 3])
def test_streaming_modes_deliver_the_exact_bytes(bk, mode, size):
    data = rnd(size)
    r = put_raw(bk, "s", data, mode)
    assert r.status == 200, r
    assert r.header("etag") == '"%s"' % md5hex(data)
    assert bk.read("s") == data


@pytest.mark.parametrize("mode", MODES)
@pytest.mark.parametrize("chunk", [1, 7, 4096, 1 * MiB, 8 * MiB])
def test_streaming_chunk_sizes(bk, mode, chunk):
    data = rnd(2000 if chunk < 100 else 300 * KiB)
    if chunk == 1:
        data = data[:300]
    r = put_raw(bk, "s", data, mode, chunk_size=chunk)
    assert r.status == 200, r
    assert bk.read("s") == data


@pytest.mark.parametrize("mode", ["signed-trailer", "unsigned-trailer"])
@pytest.mark.parametrize("alg", ALGO_IDS)
def test_trailer_algorithms(bk, mode, alg):
    need_crt(alg)
    data = rnd(150 * KiB)
    r = put_raw(bk, "s", data, mode, trailer_alg=alg)
    assert r.status == 200, r
    assert r.header(hname(alg)) == checksum_b64(alg, data), "the trailer checksum is echoed on the response"
    assert stored_checksum(bk, "s", alg)[0] == checksum_b64(alg, data)


@pytest.mark.parametrize("mode", ["signed-trailer", "unsigned-trailer"])
@pytest.mark.parametrize("alg", ALGO_IDS)
def test_a_wrong_trailer_checksum_is_baddigest_and_stores_nothing(bk, mode, alg):
    need_crt(alg)
    data = rnd(5000)
    bk.put("s", b"previous")
    r = put_raw(bk, "s", data, mode, trailer_alg=alg, trailer_value=wrong_checksum_b64(alg, data))
    assert r.status == 400 and r.code == "BadDigest", r
    assert bk.read("s") == b"previous"
    r = put_raw(bk, "s2", data, mode, trailer_alg=alg, trailer_value=wrong_checksum_b64(alg, data))
    assert r.status == 400 and r.code == "BadDigest", r
    with s3error(None, 404):
        bk.head("s2")


@pytest.mark.parametrize("mode,where", [("signed", 0), ("signed", 1), ("signed", "final"), ("signed-trailer", 0), ("signed-trailer", 1),
                                        ("signed-trailer", "final"), ("signed-trailer", "trailer")])
def test_a_corrupted_chunk_signature_is_signaturedoesnotmatch(bk, mode, where):
    data = rnd(200 * KiB)

    def tamper(i, sig):
        return ("0" if sig[0] != "0" else "1") + sig[1:] if i == where else sig

    r = put_raw(bk, "s", data, mode, tamper=tamper)
    assert r.status == 403 and r.code == "SignatureDoesNotMatch", r
    with s3error(None, 404):
        bk.head("s")


def test_a_chunk_signature_of_all_f_is_refused(bk):
    r = X.put_chunked(bk, "s", rnd(100 * KiB), "signed", chunk_size=64 * KiB, tamper=lambda i, sig: "f" * 64 if i == 0 else sig)
    assert r.status == 403 and r.code == "SignatureDoesNotMatch", r


@pytest.mark.parametrize("mode", MODES)
def test_decoded_length_larger_than_the_body_is_incompletebody(bk, mode):
    data = rnd(5000)
    r = put_raw(bk, "s", data, mode, decoded_len=len(data) + 10)
    assert r.status == 400 and r.code in ("IncompleteBody", "InvalidRequest", "BadDigest", "SignatureDoesNotMatch"), r
    with s3error(None, 404):
        bk.head("s")


@pytest.mark.parametrize("mode", MODES)
def test_decoded_length_smaller_than_the_body_is_an_error(bk, mode):
    data = rnd(5000)
    r = put_raw(bk, "s", data, mode, decoded_len=len(data) - 10)
    assert r.status == 400 and r.code in ("IncompleteBody", "InvalidRequest", "BadDigest", "SignatureDoesNotMatch", "InvalidArgument"), r
    with s3error(None, 404):
        bk.head("s")


@pytest.mark.parametrize("mode", ["signed-trailer", "unsigned-trailer"])
def test_a_missing_trailer_is_an_error(bk, mode):
    data = rnd(2000)
    body = b"%x\r\n" % len(data) + data + b"\r\n0\r\n\r\n"        # an unsigned-looking body without the announced trailer
    r = put_raw(bk, "s", data, mode, body_override=body)
    assert r.status in (400, 403), r
    with s3error(None, 404):
        bk.head("s")


@pytest.mark.parametrize("mode", MODES)
def test_garbage_framing_is_a_client_error_not_a_crash(bk, mode):
    data = rnd(3000)
    for body in (b"zz\r\nnotachunk", b"10\r\nshort\r\n", b"\r\n\r\n", b"ffffffffffffffff\r\n", b"3;chunk-signature=\r\nabc\r\n0\r\n\r\n"):
        r = put_raw(bk, "s", data, mode, body_override=body)
        assert 400 <= r.status < 500, (body, r)
    with s3error(None, 404):
        bk.head("s")
    assert bk.s3.list_buckets()["Buckets"]            # the server still answers


def test_aws_chunked_is_not_stored_as_a_content_encoding(bk):
    data = rnd(1000)
    r = put_raw(bk, "s", data, "unsigned-trailer", extra_headers={"Content-Type": "text/plain"})
    assert r.status == 200, r
    h = raw_head(bk, "s")
    assert "aws-chunked" not in (h.header("content-encoding") or "") and h.header("content-type") == "text/plain"
    r = put_raw(bk, "s2", data, "unsigned-trailer", content_encoding="gzip, aws-chunked")
    assert r.status == 200, r
    assert raw_head(bk, "s2").header("content-encoding") == "gzip"


def test_chunked_transfer_encoding_without_content_length_is_accepted(bk):
    """spec 5.1: Transfer-Encoding: chunked is accepted liberally for a plain unsigned PUT."""
    data = rnd(40 * KiB)
    raw = bk.raw()
    path = "/%s/te" % bk.name
    p, q, h = X.signed_headers(raw, "PUT", path, None, {}, payload="UNSIGNED-PAYLOAD")
    h["Transfer-Encoding"] = "chunked"
    body = b"".join(b"%x\r\n" % len(data[i:i + 8192]) + data[i:i + 8192] + b"\r\n" for i in range(0, len(data), 8192)) + b"0\r\n\r\n"
    r = X.send(raw.hostport(), "PUT", p, h, body)
    assert r.status == 200, r
    assert bk.read("te") == data


def test_put_without_content_length_or_chunking_is_411(bk):
    raw = bk.raw()
    path = "/%s/nolen" % bk.name
    p, q, h = X.signed_headers(raw, "PUT", path, None, {}, payload="UNSIGNED-PAYLOAD")
    h.pop("Content-Length", None)
    r = X.send(raw.hostport(), "PUT", p, h, b"")
    assert r.status == 411 and r.code == "MissingContentLength", r


# --------------------------------------------------------------------------------------------
# multipart checksums

def mpu(bk, key, parts, alg, *, ctype=None, send_part_checksums=True, **create_kw):
    kw = dict(Bucket=bk.name, Key=key, ChecksumAlgorithm=alg)
    if ctype:
        kw["ChecksumType"] = ctype
    kw.update(create_kw)
    uid = bk.s3.create_multipart_upload(**kw)["UploadId"]
    done = []
    for i, p in enumerate(parts, 1):
        extra = {"ChecksumAlgorithm": alg} if send_part_checksums else {}
        r = bk.s3.upload_part(Bucket=bk.name, Key=key, UploadId=uid, PartNumber=i, Body=p, **extra)
        entry = {"PartNumber": i, "ETag": r["ETag"]}
        if send_part_checksums:
            assert r[pname(alg)] == checksum_b64(alg, p), "UploadPart returns the part checksum"
            entry[pname(alg)] = r[pname(alg)]
        done.append(entry)
    return uid, done


@pytest.mark.parametrize("alg", ["CRC32", "CRC32C", "SHA1", "SHA256"])
def test_multipart_composite_checksum(bk, alg):
    need_crt(alg)
    parts = [rnd(MIN), rnd(MIN), rnd(1234)]
    uid, done = mpu(bk, "mp", parts, alg, ctype="COMPOSITE")
    r = bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=uid, MultipartUpload={"Parts": done})
    want = composite_b64(alg, parts)
    assert r[pname(alg)] == want and r.get("ChecksumType") in (None, "COMPOSITE"), r
    assert r["ETag"] == '"%s"' % multipart_etag(parts)
    got, h = stored_checksum(bk, "mp", alg)
    assert got == want and want.endswith("-3")
    assert bk.read("mp") == b"".join(parts)


@pytest.mark.parametrize("alg", ["CRC32", "CRC32C", "CRC64NVME"])
def test_multipart_full_object_checksum(bk, alg):
    need_crt(alg)
    parts = [rnd(MIN), rnd(321)]
    uid, done = mpu(bk, "mp", parts, alg, ctype="FULL_OBJECT")
    r = bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=uid, MultipartUpload={"Parts": done})
    want = checksum_b64(alg, b"".join(parts))
    assert r[pname(alg)] == want, "FULL_OBJECT: the checksum of the whole object, no -N suffix"
    assert stored_checksum(bk, "mp", alg)[0] == want


@pytest.mark.parametrize("alg", ["SHA1", "SHA256"])
def test_full_object_checksums_need_a_crc_algorithm(bk, alg):
    with s3error(None, 400):
        bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp", ChecksumAlgorithm=alg, ChecksumType="FULL_OBJECT")


def test_crc64nvme_has_no_composite_form(bk):
    """S3: CRC64NVME supports FULL_OBJECT only; asking for COMPOSITE is refused (at create, or at the latest at complete)."""
    need_crt("CRC64NVME")
    parts = [rnd(MIN), rnd(55)]
    with pytest.raises(Exception) as ei:
        uid, done = mpu(bk, "mp", parts, "CRC64NVME", ctype="COMPOSITE")
        bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=uid, MultipartUpload={"Parts": done})
    assert getattr(ei.value, "response", {}).get("ResponseMetadata", {}).get("HTTPStatusCode") == 400, ei.value


def test_crc64nvme_multipart_defaults_to_a_full_object_checksum(bk):
    need_crt("CRC64NVME")
    parts = [rnd(MIN), rnd(55)]
    uid, done = mpu(bk, "mp", parts, "CRC64NVME")
    r = bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=uid, MultipartUpload={"Parts": done})
    assert r["ChecksumCRC64NVME"] == checksum_b64("CRC64NVME", b"".join(parts))


def test_multipart_part_with_a_wrong_checksum_is_baddigest(bk):
    uid = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp", ChecksumAlgorithm="CRC32")["UploadId"]
    body = rnd(1000)
    with s3error("BadDigest", 400):
        bk.s3.upload_part(Bucket=bk.name, Key="mp", UploadId=uid, PartNumber=1, Body=body, ChecksumCRC32=wrong_checksum_b64("CRC32", body))
    assert bk.s3.list_parts(Bucket=bk.name, Key="mp", UploadId=uid).get("Parts", []) == []


def test_multipart_complete_with_a_wrong_part_checksum_is_invalidpart(bk):
    parts = [rnd(MIN), rnd(10)]
    uid, done = mpu(bk, "mp", parts, "CRC32", ctype="COMPOSITE")
    done[0]["ChecksumCRC32"] = wrong_checksum_b64("CRC32", parts[0])
    with s3error("InvalidPart", 400):
        bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=uid, MultipartUpload={"Parts": done})


def test_list_parts_reports_part_checksums(bk):
    parts = [rnd(2000), rnd(3000)]
    uid, done = mpu(bk, "mp", parts, "SHA256")
    r = bk.s3.list_parts(Bucket=bk.name, Key="mp", UploadId=uid)
    assert [p["ChecksumSHA256"] for p in r["Parts"]] == [checksum_b64("SHA256", p) for p in parts]
    assert r.get("ChecksumAlgorithm") == "SHA256"


def test_multipart_without_a_declared_algorithm_has_no_object_checksum(bk):
    c = bvh.make_client(bk.ak, bk.sk, checksum_calculation="when_required")
    uid = c.create_multipart_upload(Bucket=bk.name, Key="mp")["UploadId"]
    et = c.upload_part(Bucket=bk.name, Key="mp", UploadId=uid, PartNumber=1, Body=b"abc")["ETag"]
    c.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=uid, MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": et}]})
    r = raw_head(bk, "mp", headers={"x-amz-checksum-mode": "ENABLED"})
    assert not [h for h in r.headers if h.startswith("x-amz-checksum-")], r.raw_headers
    assert bk.read("mp") == b"abc"


def test_default_boto3_upload_file_checksums_parts_and_the_object(bk, tmp_path):
    from boto3.s3.transfer import TransferConfig
    data = rnd(2 * MIN + 77)
    f = tmp_path / "f.bin"
    f.write_bytes(data)
    bk.s3.upload_file(str(f), bk.name, "managed", Config=TransferConfig(multipart_threshold=MIN, multipart_chunksize=MIN))
    h = bk.s3.head_object(Bucket=bk.name, Key="managed", ChecksumMode="ENABLED")
    chunks = [data[i:i + MIN] for i in range(0, len(data), MIN)]
    assert h["ChecksumCRC32"] == composite_b64("CRC32", chunks), h.get("ChecksumCRC32")
