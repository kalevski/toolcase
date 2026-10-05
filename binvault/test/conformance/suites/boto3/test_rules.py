"""Bucket rules: quota_bytes, max_objects, max_object_bytes, allowed_content_types (spec 3.13, 6.3, 5.6, 3.5)."""
import socket
import time

import pytest

import bvh
import bvx_b as XB
import bvx_c as X
from bvh import ADMIN, AdminError, KiB, MiB, md5hex, rnd, s3error, uniq
from bvx_a import raw_put, raw_req
from bvx_c import GIF, HTML, JPEG, JSONTXT, PDF, PNG, TEXT, ZIP

MIN = 5 * MiB
WEBP = b"RIFF\x24\x00\x00\x00WEBPVP8 " + b"\x00" * 40


def quota_error(fn):
    with s3error("QuotaExceeded", 403):
        fn()


# --------------------------------------------------------------------------------------------
# quota_bytes

def test_quota_refuses_the_write_that_would_exceed_it():
    bk = bvh.fresh_bucket("q1", quota_bytes=1 * MiB)
    bk.put("a", rnd(600 * KiB))
    quota_error(lambda: bk.put("b", rnd(600 * KiB)))
    assert bk.keys() == ["a"], "a refused write stores nothing"
    bk.put("c", rnd(400 * KiB))                      # still fits
    assert sorted(bk.keys()) == ["a", "c"]


def test_the_error_document_and_status():
    bk = bvh.fresh_bucket("q2", quota_bytes=1000)
    r = raw_put(bk, "k", b"x" * 1001)
    assert r.status == 403 and r.code == "QuotaExceeded", r
    x = r.xml()
    assert x.findtext("Message") and x.findtext("RequestId") == r.header("x-amz-request-id")
    assert raw_put(bk, "k", b"x" * 1000).status == 200, "exactly the quota is allowed"
    assert raw_put(bk, "k2", b"y").status == 403


def test_deleting_releases_quota():
    bk = bvh.fresh_bucket("q3", quota_bytes=1 * MiB)
    bk.put("a", rnd(900 * KiB))
    quota_error(lambda: bk.put("b", rnd(900 * KiB)))
    bk.delete("a")
    bk.put("b", rnd(900 * KiB))


def test_overwriting_counts_the_new_size_only():
    bk = bvh.fresh_bucket("q4", quota_bytes=1 * MiB)
    bk.put("a", rnd(700 * KiB))
    bk.put("a", rnd(800 * KiB))                      # replaces: 800 KiB used, not 1.5 MiB
    bk.put("a", rnd(1 * MiB))
    quota_error(lambda: bk.put("a", rnd(1 * MiB + 1)))
    assert bk.head("a")["ContentLength"] == 1 * MiB, "a refused overwrite leaves the old object"


def test_copy_counts_as_new_logical_bytes():
    bk = bvh.fresh_bucket("q5", quota_bytes=1 * MiB)
    bk.put("a", rnd(700 * KiB))
    quota_error(lambda: bk.s3.copy_object(Bucket=bk.name, Key="b", CopySource={"Bucket": bk.name, "Key": "a"}))
    assert bk.keys() == ["a"]


def test_versions_count_but_delete_markers_do_not():
    bk = bvh.fresh_bucket("q6", quota_bytes=1 * MiB, versioning="enabled")
    bk.put("a", rnd(400 * KiB))
    bk.put("a", rnd(400 * KiB))
    quota_error(lambda: bk.put("a", rnd(400 * KiB)))
    bk.delete("a")                                    # a delete marker: adds no bytes and is never refused
    assert len(bk.s3.list_object_versions(Bucket=bk.name).get("DeleteMarkers", [])) == 1
    vid = bk.s3.list_object_versions(Bucket=bk.name)["Versions"][-1]["VersionId"]
    bk.s3.delete_object(Bucket=bk.name, Key="a", VersionId=vid)         # purge the oldest version: space is back
    bk.put("a", rnd(400 * KiB))


def test_open_multipart_parts_count_until_completed_or_aborted():
    bk = bvh.fresh_bucket("q7", quota_bytes=6 * MiB)
    up = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp")["UploadId"]
    e1 = bk.s3.upload_part(Bucket=bk.name, Key="mp", UploadId=up, PartNumber=1, Body=rnd(MIN))["ETag"]
    quota_error(lambda: bk.put("other", rnd(2 * MiB)))                       # 5 MiB of parts + 2 MiB > 6 MiB
    quota_error(lambda: bk.s3.upload_part(Bucket=bk.name, Key="mp", UploadId=up, PartNumber=2, Body=rnd(2 * MiB)))
    e2 = bk.s3.upload_part(Bucket=bk.name, Key="mp", UploadId=up, PartNumber=2, Body=rnd(1 * MiB))["ETag"]
    # completing is net of the upload's own parts: 6 MiB of parts become a 6 MiB object, not 12
    bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=up,
                                    MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": e1}, {"PartNumber": 2, "ETag": e2}]})
    assert bk.head("mp")["ContentLength"] == 6 * MiB
    quota_error(lambda: bk.put("other", b"x"))
    bk.delete("mp")
    up = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp2")["UploadId"]
    bk.s3.upload_part(Bucket=bk.name, Key="mp2", UploadId=up, PartNumber=1, Body=rnd(MIN))
    quota_error(lambda: bk.put("other", rnd(2 * MiB)))
    bk.s3.abort_multipart_upload(Bucket=bk.name, Key="mp2", UploadId=up)
    bk.put("other", rnd(2 * MiB))                                            # aborting released the parts


def test_replaced_part_does_not_count_twice():
    bk = bvh.fresh_bucket("q8", quota_bytes=6 * MiB)
    up = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp")["UploadId"]
    for _ in range(4):
        bk.s3.upload_part(Bucket=bk.name, Key="mp", UploadId=up, PartNumber=1, Body=rnd(MIN))
    bk.put("fits", rnd(1 * MiB))


def test_complete_is_refused_when_the_object_would_not_fit():
    bk = bvh.fresh_bucket("q9", quota_bytes=11 * MiB)
    up = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp")["UploadId"]
    ets = [(i, bk.s3.upload_part(Bucket=bk.name, Key="mp", UploadId=up, PartNumber=i, Body=rnd(MIN))["ETag"]) for i in (1, 2)]
    bk.put("small", rnd(900 * KiB))                      # 10 MiB of parts + 0.9 MiB = 10.9 MiB <= 11 MiB
    ADMIN.patch_bucket(bk.name, quota_bytes=10 * MiB + 500 * KiB)
    quota_error(lambda: bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=up,
                                                        MultipartUpload={"Parts": [{"PartNumber": n, "ETag": e} for n, e in ets]}))


def test_quota_changes_apply_at_once():
    bk = bvh.fresh_bucket("q10", quota_bytes=1000)
    quota_error(lambda: bk.put("k", b"x" * 2000))
    ADMIN.patch_bucket(bk.name, quota_bytes=5000)
    bk.put("k", b"x" * 2000)
    ADMIN.patch_bucket(bk.name, quota_bytes=1500)         # lowering below the usage deletes nothing, it refuses new data
    assert bk.read("k") == b"x" * 2000
    quota_error(lambda: bk.put("k2", b"y"))
    ADMIN.patch_bucket(bk.name, quota_bytes=None)         # null = unlimited
    bk.put("k2", rnd(3 * MiB))


def test_post_object_counts_against_the_quota():
    from test_post_object import build, post
    bk = bvh.fresh_bucket("q11", quota_bytes=1000)
    assert post(bk, build(bk, "a"), ("x", b"1" * 900, None)).status == 204
    r = post(bk, build(bk, "b"), ("x", b"2" * 900, None))
    assert r.status == 403 and r.code == "QuotaExceeded", r


def test_the_admission_check_uses_the_declared_size_before_the_body_is_sent():
    """spec 3.5: Expect: 100-continue is answered only for requests that will be accepted."""
    bk = bvh.fresh_bucket("q12", quota_bytes=1000)
    raw = bk.raw()
    p, q, h = XB.signed_headers(raw, "PUT", "/%s/big" % bk.name, None, {"Expect": "100-continue", "Content-Length": "5000"}, payload="UNSIGNED-PAYLOAD")
    host, _, port = bvh.HOSTPORT.partition(":")
    with socket.create_connection((host, int(port)), timeout=10) as s:
        s.sendall(XB.request_bytes("PUT", p, h))          # headers only, the 5000 body bytes are never sent
        s.settimeout(5)
        data = s.recv(4096)
    assert data.startswith(b"HTTP/1.1 403"), "a doomed upload must be refused without a 100 Continue: %r" % data[:80]
    assert b"QuotaExceeded" in data


def test_a_fitting_upload_gets_its_100_continue():
    bk = bvh.fresh_bucket("q12b", quota_bytes=100000)
    raw = bk.raw()
    p, q, h = XB.signed_headers(raw, "PUT", "/%s/ok" % bk.name, None, {"Expect": "100-continue", "Content-Length": "5000"}, payload="UNSIGNED-PAYLOAD")
    host, _, port = bvh.HOSTPORT.partition(":")
    with socket.create_connection((host, int(port)), timeout=10) as s:
        s.sendall(XB.request_bytes("PUT", p, h))
        s.settimeout(5)
        data = s.recv(4096)
    assert data.startswith(b"HTTP/1.1 100"), data[:80]


def test_bucket_stats_follow_the_counters():
    bk = bvh.fresh_bucket("q13", quota_bytes=10_000)
    bk.put("a", b"x" * 1234)
    stats = ADMIN.get_bucket(bk.name)["stats"]
    assert stats["objects"] == 1 and stats["bytes"] == 1234 and stats["versions"] == 1


# --------------------------------------------------------------------------------------------
# max_objects

def test_max_objects_counts_keys():
    bk = bvh.fresh_bucket("mo1", max_objects=3)
    for k in "abc":
        bk.put(k, b"x")
    quota_error(lambda: bk.put("d", b"x"))
    bk.put("a", b"replacing is not adding")
    bk.delete("b")
    bk.put("d", b"x")
    assert sorted(bk.keys()) == ["a", "c", "d"]


def test_max_objects_counts_every_version_but_not_delete_markers():
    bk = bvh.fresh_bucket("mo2", max_objects=3, versioning="enabled")
    bk.put("a", b"1")
    bk.put("a", b"2")
    bk.put("b", b"1")
    quota_error(lambda: bk.put("c", b"1"))
    quota_error(lambda: bk.put("a", b"3"))
    bk.delete("b")                                    # a marker: fine, and the version row still counts
    quota_error(lambda: bk.put("c", b"1"))


def test_max_objects_applies_to_copy_multipart_and_post():
    from test_post_object import build, post
    bk = bvh.fresh_bucket("mo3", max_objects=1)
    bk.put("a", b"x")
    quota_error(lambda: bk.s3.copy_object(Bucket=bk.name, Key="b", CopySource={"Bucket": bk.name, "Key": "a"}))
    up = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp")["UploadId"]
    et = bk.s3.upload_part(Bucket=bk.name, Key="mp", UploadId=up, PartNumber=1, Body=b"p")["ETag"]
    quota_error(lambda: bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=up, MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": et}]}))
    r = post(bk, build(bk, "p"), ("x", b"1", None))
    assert r.status == 403 and r.code == "QuotaExceeded", r
    assert bk.keys() == ["a"]


# --------------------------------------------------------------------------------------------
# max_object_bytes

def test_max_object_bytes_refuses_larger_single_puts():
    bk = bvh.fresh_bucket("mb1", max_object_bytes=1000)
    bk.put("ok", b"x" * 1000)
    with s3error("EntityTooLarge", 400):
        bk.put("big", b"x" * 1001)
    r = raw_put(bk, "big2", b"x" * 5000)
    assert r.status == 400 and r.code == "EntityTooLarge", r
    assert bk.keys() == ["ok"]
    bk.put("ok", b"y" * 1000)                          # the cap is per object, the bucket may hold many


def test_max_object_bytes_is_enforced_for_streaming_and_chunked_bodies():
    bk = bvh.fresh_bucket("mb2", max_object_bytes=1000)
    data = rnd(5000)
    r = XB.put_chunked(bk, "s", data, "unsigned-trailer")
    assert r.status == 400 and r.code == "EntityTooLarge", r
    r = XB.put_chunked(bk, "s", data[:900], "unsigned-trailer")
    assert r.status == 200, r
    # Transfer-Encoding: chunked with no declared size is checked while receiving
    raw = bk.raw()
    p, q, h = XB.signed_headers(raw, "PUT", "/%s/te" % bk.name, None, {}, payload="UNSIGNED-PAYLOAD")
    h["Transfer-Encoding"] = "chunked"
    body = b"".join(b"%x\r\n" % len(data[i:i + 1000]) + data[i:i + 1000] + b"\r\n" for i in range(0, 5000, 1000)) + b"0\r\n\r\n"
    r = XB.send(raw.hostport(), "PUT", p, h, body)
    assert r.status == 400 and r.code == "EntityTooLarge", r
    with s3error(None, 404):
        bk.head("te")


def test_max_object_bytes_applies_to_the_assembled_multipart_object():
    bk = bvh.fresh_bucket("mb3", max_object_bytes=8 * MiB)
    up = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp")["UploadId"]
    ets = [(i, bk.s3.upload_part(Bucket=bk.name, Key="mp", UploadId=up, PartNumber=i, Body=rnd(MIN))["ETag"]) for i in (1, 2)]
    with s3error("EntityTooLarge", 400):
        bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=up,
                                        MultipartUpload={"Parts": [{"PartNumber": n, "ETag": e} for n, e in ets]})
    done = bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=up, MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": ets[0][1]}]})
    assert bk.head("mp")["ContentLength"] == MIN and done["ETag"]


def test_max_object_bytes_applies_to_copy_of_a_bigger_existing_object():
    bk = bvh.fresh_bucket("mb4")
    bk.put("big", rnd(5000))
    ADMIN.patch_bucket(bk.name, max_object_bytes=1000)
    with s3error("EntityTooLarge", 400):
        bk.s3.copy_object(Bucket=bk.name, Key="copy", CopySource={"Bucket": bk.name, "Key": "big"})
    assert bk.read("big") is not None


def test_max_object_bytes_cannot_exceed_the_global_maximum():
    bk = bvh.fresh_bucket("mb5")
    with pytest.raises(AdminError) as ei:
        ADMIN.patch_bucket(bk.name, max_object_bytes=10 ** 18)
    assert ei.value.status == 400, ei.value
    with pytest.raises(AdminError) as ei:
        ADMIN.patch_bucket(bk.name, max_object_bytes=-1)
    assert ei.value.status == 400, ei.value


def test_the_node_wide_maximum_object_size():
    with bvh.Node(env={"BINVAULT_MAX_OBJECT_MB": "2", "BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("max")
        c = node.client(ak, sk)
        c.put_object(Bucket=name, Key="ok", Body=rnd(2 * MiB))
        with s3error("EntityTooLarge", 400):
            c.put_object(Bucket=name, Key="big", Body=rnd(2 * MiB + 1))
        with pytest.raises(AdminError) as ei:
            node.admin.patch_bucket(name, max_object_bytes=3 * MiB)
        assert ei.value.status == 400


# --------------------------------------------------------------------------------------------
# allowed_content_types

def ctype_bucket(*patterns, **kw):
    return bvh.fresh_bucket("ct", allowed_content_types=list(patterns), **kw)


def rejected(fn):
    with s3error("ContentTypeNotAllowed", 415):
        fn()


def test_sniffed_type_decides_not_the_declared_one():
    bk = ctype_bucket("image/png", "image/jpeg", "text/plain")
    bk.put("pic.png", PNG, ContentType="text/html")               # declared HTML, really a PNG: accepted
    bk.put("pic.jpg", JPEG, ContentType="application/pdf")
    bk.put("note.txt", TEXT, ContentType="image/png")             # declared PNG, really text: accepted as text/plain
    assert bk.head("pic.png")["ContentType"] == "text/html", "the declared type is stored as sent"
    rejected(lambda: bk.put("doc.pdf", PDF, ContentType="image/png"))     # declared PNG, really a PDF: refused
    rejected(lambda: bk.put("page.html", HTML, ContentType="text/plain"))
    rejected(lambda: bk.put("a.zip", ZIP, ContentType="image/jpeg"))
    rejected(lambda: bk.put("rand.bin", rnd(2000)))               # unrecognised binary sniffs as application/octet-stream
    assert sorted(bk.keys()) == ["note.txt", "pic.jpg", "pic.png"]


def test_the_error_is_415_with_a_stable_code():
    bk = ctype_bucket("image/png")
    r = raw_put(bk, "x.pdf", PDF)
    assert r.status == 415 and r.code == "ContentTypeNotAllowed", r
    assert r.xml().findtext("Message") and r.xml().findtext("RequestId")


def test_wildcards_case_and_parameters():
    bk = ctype_bucket("IMAGE/*", "Text/Plain")
    for k, b in (("a.png", PNG), ("a.jpg", JPEG), ("a.gif", GIF), ("a.webp", WEBP), ("a.txt", TEXT), ("a.json", JSONTXT)):
        bk.put(k, b)                                               # "text/plain; charset=utf-8" matches "Text/Plain": parameters are ignored
    rejected(lambda: bk.put("a.pdf", PDF))
    assert len(bk.keys()) == 6


def test_empty_pattern_list_accepts_anything():
    bk = bvh.fresh_bucket("ct0")
    for k, b in (("a.pdf", PDF), ("a.zip", ZIP), ("a.bin", rnd(500)), ("a.html", HTML), ("e", b"")):
        bk.put(k, b)
    assert len(bk.keys()) == 5


def test_octet_stream_must_be_listed_for_unrecognised_binary():
    bk = ctype_bucket("application/octet-stream")
    bk.put("blob.bin", bytes(range(256)) * 4)
    rejected(lambda: bk.put("pic.png", PNG))


def test_empty_object_sniffs_as_text():
    bk = ctype_bucket("text/plain")
    bk.put("empty", b"")
    bk2 = ctype_bucket("image/png")
    rejected(lambda: bk2.put("empty", b""))


def test_a_big_rejected_body_is_drained_so_the_client_sees_the_error():
    bk = ctype_bucket("image/png")
    body = PDF + rnd(8 * MiB)
    with s3error("ContentTypeNotAllowed", 415):
        bk.put("big.pdf", body)               # boto3 sends the whole body before reading the answer (spec 3.13)
    assert bk.keys() == []


def test_multipart_first_part_is_checked():
    bk = ctype_bucket("image/png")
    up = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp.pdf")["UploadId"]
    rejected(lambda: bk.s3.upload_part(Bucket=bk.name, Key="mp.pdf", UploadId=up, PartNumber=1, Body=PDF + rnd(MIN)))
    up2 = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp.png")["UploadId"]
    e1 = bk.s3.upload_part(Bucket=bk.name, Key="mp.png", UploadId=up2, PartNumber=1, Body=PNG + rnd(MIN))["ETag"]
    e2 = bk.s3.upload_part(Bucket=bk.name, Key="mp.png", UploadId=up2, PartNumber=2, Body=rnd(10))["ETag"]
    bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp.png", UploadId=up2, MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": e1}, {"PartNumber": 2, "ETag": e2}]})
    assert bk.head("mp.png")["ContentLength"] == len(PNG) + MIN + 10


def test_multipart_is_checked_again_at_completion():
    bk = ctype_bucket("image/png", "application/pdf")
    up = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp")["UploadId"]
    e1 = bk.s3.upload_part(Bucket=bk.name, Key="mp", UploadId=up, PartNumber=1, Body=PDF + rnd(MIN))["ETag"]
    e2 = bk.s3.upload_part(Bucket=bk.name, Key="mp", UploadId=up, PartNumber=2, Body=rnd(10))["ETag"]
    ADMIN.patch_bucket(bk.name, allowed_content_types=["image/png"])           # the rule changed while the upload was open
    rejected(lambda: bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp", UploadId=up,
                                                     MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": e1}, {"PartNumber": 2, "ETag": e2}]}))
    assert bk.keys() == []


def test_copy_into_a_bucket_whose_rules_changed():
    bk = bvh.fresh_bucket("ctcopy")
    bk.put("old.pdf", PDF)
    ADMIN.patch_bucket(bk.name, allowed_content_types=["image/png"])
    rejected(lambda: bk.s3.copy_object(Bucket=bk.name, Key="new.pdf", CopySource={"Bucket": bk.name, "Key": "old.pdf"}))
    assert bk.read("old.pdf") == PDF, "existing objects are untouched by a rule change"
    bk.put("fine.png", PNG)
    bk.s3.copy_object(Bucket=bk.name, Key="fine2.png", CopySource={"Bucket": bk.name, "Key": "fine.png"})


def test_post_object_is_checked():
    from test_post_object import build, post
    bk = ctype_bucket("image/png")
    r = post(bk, build(bk, "p.pdf"), ("x", PDF, "image/png"))
    assert r.status == 415 and r.code == "ContentTypeNotAllowed", r
    assert post(bk, build(bk, "p.png"), ("x", PNG, "application/pdf")).status == 204


def test_presigned_put_is_checked():
    bk = ctype_bucket("image/png")
    url = bk.s3.generate_presigned_url("put_object", Params={"Bucket": bk.name, "Key": "u.pdf"}, ExpiresIn=60)
    r = bvh.http_get(url, method="PUT", data=PDF)
    assert r.status == 415 and r.code == "ContentTypeNotAllowed", r
    url = bk.s3.generate_presigned_url("put_object", Params={"Bucket": bk.name, "Key": "u.png"}, ExpiresIn=60)
    assert bvh.http_get(url, method="PUT", data=PNG).status == 200


def test_rule_changes_apply_to_the_next_write():
    bk = bvh.fresh_bucket("ctchg")
    bk.put("a.pdf", PDF)
    ADMIN.patch_bucket(bk.name, allowed_content_types=["image/png"])
    rejected(lambda: bk.put("b.pdf", PDF))
    ADMIN.patch_bucket(bk.name, allowed_content_types=[])
    bk.put("b.pdf", PDF)


def test_suite_ctype_bucket_from_the_harness():
    b = bvh.suite_bucket("ctype")
    b.put("ok.png", PNG)
    b.put("ok.jpg", JPEG)
    b.put("ok.txt", TEXT)
    rejected(lambda: b.put("no.pdf", PDF))


def test_pattern_count_is_limited_to_100():
    bk = bvh.fresh_bucket("ctmany")
    ADMIN.patch_bucket(bk.name, allowed_content_types=["x/y%d" % i for i in range(100)])
    with pytest.raises(AdminError) as ei:
        ADMIN.patch_bucket(bk.name, allowed_content_types=["x/y%d" % i for i in range(101)])
    assert ei.value.status == 400, ei.value


def test_rules_do_not_affect_reads_deletes_or_tag_changes():
    bk = bvh.fresh_bucket("ctread")
    bk.put("a.pdf", PDF, Tagging="a=1")
    ADMIN.patch_bucket(bk.name, allowed_content_types=["image/png"], quota_bytes=1, max_object_bytes=1)
    assert bk.read("a.pdf") == PDF
    bk.s3.put_object_tagging(Bucket=bk.name, Key="a.pdf", Tagging={"TagSet": [{"Key": "b", "Value": "2"}]})
    bk.delete("a.pdf")
