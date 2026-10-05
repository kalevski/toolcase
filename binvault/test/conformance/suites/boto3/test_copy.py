"""CopyObject (spec 5.4.5): directives, self-copies, key encoding, bucket scoping, independence of copies."""
import time
import urllib.parse

import pytest

import bvh
from bvh import MiB, hdr, md5hex, rnd, s3error, uniq
from bvx_a import ISO_MS, S3_NS, raw_get, raw_head, raw_put, raw_req


def copy(bk, src, dst, **kw):
    return bk.s3.copy_object(Bucket=bk.name, Key=dst, CopySource={"Bucket": bk.name, "Key": src}, **kw)


def tags_of(bk, key):
    return {t["Key"]: t["Value"] for t in bk.s3.get_object_tagging(Bucket=bk.name, Key=key)["TagSet"]}


def test_copy_default_copies_body_etag_and_all_stored_headers(bk):
    body = rnd(5000)
    bk.put("src", body, ContentType="text/plain", ContentEncoding="gzip", ContentLanguage="en",
           ContentDisposition="attachment", CacheControl="max-age=5", Metadata={"owner": "me", "Kind": "x"})
    r = copy(bk, "src", "dst")
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200
    assert r["CopyObjectResult"]["ETag"] == '"%s"' % md5hex(body)
    assert r["CopyObjectResult"]["LastModified"]
    g = bk.get("dst")
    assert g["Body"].read() == body
    assert g["ETag"] == '"%s"' % md5hex(body)
    for field, want in (("ContentType", "text/plain"), ("ContentEncoding", "gzip"), ("ContentLanguage", "en"),
                        ("ContentDisposition", "attachment"), ("CacheControl", "max-age=5")):
        assert g[field] == want, "%s: %r" % (field, g.get(field))
    assert g["Metadata"] == {"owner": "me", "kind": "x"}
    # the source is untouched
    assert bk.read("src") == body


def test_copy_result_document_shape(bk):
    bk.put("src", b"abc")
    r = raw_put(bk, "dst", b"", headers={"x-amz-copy-source": "/%s/src" % bk.name})
    assert r.status == 200, r
    assert r.header("content-type", "").startswith("application/xml")
    x = r.xml()
    assert x.tag == "CopyObjectResult"
    assert r.text.count(S3_NS) >= 1, "CopyObjectResult must carry the S3 namespace: %s" % r.text[:200]
    assert x.findtext("ETag") == '"%s"' % md5hex(b"abc")
    assert ISO_MS.match(x.findtext("LastModified") or ""), x.findtext("LastModified")


@pytest.mark.parametrize("form", ["bucket/key", "/bucket/key", "urlencoded"])
def test_copy_source_header_forms(bk, form):
    key = "dir with space/f+1.txt"
    bk.put(key, b"hello")
    quoted = urllib.parse.quote(key, safe="/")
    src = {"bucket/key": "%s/%s" % (bk.name, quoted), "/bucket/key": "/%s/%s" % (bk.name, quoted),
           "urlencoded": "%s/%s" % (bk.name, urllib.parse.quote(key, safe=""))}[form] if form != "urlencoded" else \
        "%s/%s" % (bk.name, quoted)
    r = raw_put(bk, "dst", b"", headers={"x-amz-copy-source": src})
    assert r.status == 200, r
    assert bk.read("dst") == b"hello"


ODD = ["a b/c d.txt", "ключ/файл.txt", "a+b+c.txt", "100%/x%.txt", "lit%2Fslash%20x",
       "emoji-\U0001F600.bin", "q?x#y&z=1.txt", "café/niño", "semi;colon,comma", "tab\there", "/leading", "trail/"]


@pytest.mark.parametrize("key", ODD, ids=lambda k: repr(k))
def test_copy_with_keys_that_need_url_encoding(bk, key):
    body = rnd(300)
    bk.put(key, body)
    dst = "copy of " + key
    r = copy(bk, key, dst)
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200
    assert bk.read(dst) == body
    assert bk.read(key) == body
    assert sorted(bk.keys()) == sorted([key, dst])


def test_copy_string_source_with_encoded_special_chars(bk):
    # botocore percent-encodes the key part of a string CopySource itself (it is NOT passed through)
    key = "x y+z%w/é.txt"
    bk.put(key, b"enc")
    with bvh.Capture(bk.s3) as cap:
        bk.s3.copy_object(Bucket=bk.name, Key="out", CopySource="%s/%s" % (bk.name, key))
    assert cap.header("x-amz-copy-source") == "%s/x%%20y%%2Bz%%25w/%%C3%%A9.txt" % bk.name
    assert bk.read("out") == b"enc"


def test_copy_metadata_directive_replace_replaces_everything(bk):
    bk.put("src", b"data", ContentType="text/plain", CacheControl="max-age=5", ContentDisposition="inline",
           Metadata={"old": "1"})
    copy(bk, "src", "dst", MetadataDirective="REPLACE", Metadata={"new": "2"}, ContentType="application/json")
    h = bk.head("dst")
    assert h["Metadata"] == {"new": "2"}
    assert h["ContentType"] == "application/json"
    assert "CacheControl" not in h and "ContentDisposition" not in h, "REPLACE takes all headers from the request: %r" % {
        k: v for k, v in h.items() if k != "ResponseMetadata"}
    assert bk.read("dst") == b"data"
    # source untouched
    s = bk.head("src")
    assert s["Metadata"] == {"old": "1"} and s["ContentType"] == "text/plain" and s["CacheControl"] == "max-age=5"


def test_copy_replace_without_content_type_resets_it_to_the_default(bk):
    bk.put("src", b"data", ContentType="text/plain")
    r = raw_put(bk, "dst", b"", headers={"x-amz-copy-source": "/%s/src" % bk.name, "x-amz-metadata-directive": "REPLACE",
                                         "x-amz-meta-k": "v"})
    assert r.status == 200, r
    h = raw_head(bk, "dst")
    assert h.header("content-type") == "binary/octet-stream", h.raw_headers
    assert h.header("x-amz-meta-k") == "v"


def test_copy_directive_copy_ignores_supplied_metadata_and_content_type(bk):
    bk.put("src", b"data", ContentType="text/plain", Metadata={"keep": "me"})
    copy(bk, "src", "dst", MetadataDirective="COPY", Metadata={"ignored": "x"}, ContentType="image/png")
    h = bk.head("dst")
    assert h["Metadata"] == {"keep": "me"} and h["ContentType"] == "text/plain"


def test_copy_preserves_expires_header(bk):
    bk.put("src", b"x")
    raw_put(bk, "src2", b"x", headers={"Expires": "Wed, 21 Oct 2026 07:28:00 GMT"})
    copy(bk, "src2", "dst2")
    assert raw_head(bk, "dst2").header("expires") == "Wed, 21 Oct 2026 07:28:00 GMT"


def test_copy_tagging_directive_copy_is_default(bk):
    bk.put("src", b"x", Tagging="a=1&b=2")
    copy(bk, "src", "dst")
    assert tags_of(bk, "dst") == {"a": "1", "b": "2"}
    assert hdr(bk.head("dst"), "x-amz-tagging-count") == "2"
    copy(bk, "src", "dst2", TaggingDirective="COPY")
    assert tags_of(bk, "dst2") == {"a": "1", "b": "2"}


def test_copy_tagging_directive_replace(bk):
    bk.put("src", b"x", Tagging="a=1&b=2")
    copy(bk, "src", "dst", TaggingDirective="REPLACE", Tagging="n=9")
    assert tags_of(bk, "dst") == {"n": "9"}
    assert tags_of(bk, "src") == {"a": "1", "b": "2"}


def test_copy_tagging_replace_without_tags_clears_them(bk):
    bk.put("src", b"x", Tagging="a=1")
    copy(bk, "src", "dst", TaggingDirective="REPLACE")
    assert tags_of(bk, "dst") == {}
    assert hdr(bk.head("dst"), "x-amz-tagging-count") is None


def test_copy_metadata_replace_keeps_tags_when_tagging_directive_is_copy(bk):
    bk.put("src", b"x", Tagging="a=1", Metadata={"m": "1"})
    copy(bk, "src", "dst", MetadataDirective="REPLACE", Metadata={"m": "2"})
    assert tags_of(bk, "dst") == {"a": "1"} and bk.head("dst")["Metadata"] == {"m": "2"}


def test_self_copy_with_nothing_changed_is_invalidrequest(bk):
    bk.put("a", b"x", Metadata={"k": "v"})
    with s3error("InvalidRequest", 400):
        copy(bk, "a", "a")
    with s3error("InvalidRequest", 400):
        copy(bk, "a", "a", MetadataDirective="COPY", TaggingDirective="COPY")
    assert bk.read("a") == b"x"


def test_self_copy_with_metadata_replace_is_allowed(bk):
    bk.put("a", b"payload", Metadata={"k": "v"}, ContentType="text/plain")
    etag = bk.head("a")["ETag"]
    r = copy(bk, "a", "a", MetadataDirective="REPLACE", Metadata={"k": "new"}, ContentType="text/plain")
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200
    h = bk.head("a")
    assert h["Metadata"] == {"k": "new"} and h["ETag"] == etag
    assert bk.read("a") == b"payload"
    assert bk.keys() == ["a"]


def test_self_copy_with_replace_and_identical_metadata_is_an_ordinary_copy(bk):
    # spec 5.4.5: "REPLACE of metadata or tags" makes a self-copy an ordinary copy
    bk.put("a", b"payload", Metadata={"k": "v"}, ContentType="text/plain")
    r = copy(bk, "a", "a", MetadataDirective="REPLACE", Metadata={"k": "v"}, ContentType="text/plain")
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200


def test_self_copy_with_tagging_replace_is_allowed(bk):
    bk.put("a", b"payload", Tagging="x=1")
    copy(bk, "a", "a", TaggingDirective="REPLACE", Tagging="y=2")
    assert tags_of(bk, "a") == {"y": "2"}
    assert bk.read("a") == b"payload"


def test_copy_from_another_bucket_is_accessdenied(bk):
    other = bvh.fresh_bucket("othersrc")
    other.put("theirs", b"secret")
    with s3error("AccessDenied", 403):
        bk.s3.copy_object(Bucket=bk.name, Key="stolen", CopySource={"Bucket": other.name, "Key": "theirs"})
    with s3error(None, 404):
        bk.head("stolen")


def test_copy_from_nonexistent_bucket_is_accessdenied(bk):
    with s3error("AccessDenied", 403):
        bk.s3.copy_object(Bucket=bk.name, Key="x", CopySource={"Bucket": "bvt-does-not-exist-%s" % uniq("b")[-8:], "Key": "k"})


def test_copy_missing_source_is_nosuchkey(bk):
    with s3error("NoSuchKey", 404):
        copy(bk, uniq("missing"), "dst")
    with s3error(None, 404):
        bk.head("dst")


@pytest.mark.parametrize("src", ["justbucket", "/", "%s/" , "//"], ids=["bucket-only", "slash", "empty-key", "slashes"])
def test_copy_malformed_source_header_is_invalidargument(bk, src):
    if "%s" in src:
        src = src % bk.name
    r = raw_put(bk, "dst", b"", headers={"x-amz-copy-source": src})
    assert r.status == 400 and r.code == "InvalidArgument", r


def test_copy_large_object_equals_source(bk):
    body = rnd(12 * MiB + 7)
    bk.put("big", body)
    t0 = time.time()
    r = copy(bk, "big", "big-copy")
    assert r["CopyObjectResult"]["ETag"] == '"%s"' % md5hex(body)
    assert bk.read("big-copy") == body
    assert bk.head("big-copy")["ContentLength"] == len(body)


def test_copies_are_independent_of_each_other_and_of_the_source(bk):
    body = rnd(70000)
    bk.put("a", body)
    copy(bk, "a", "b")
    copy(bk, "b", "c")
    bk.put("a", b"overwritten")
    bk.delete("b")
    assert bk.read("c") == body, "a copy must not change when its source is overwritten or removed"
    assert bk.read("a") == b"overwritten"
    copy(bk, "c", "d")
    bk.delete("c")
    assert bk.read("d") == body
    for k in ("a", "d"):
        bk.delete(k)
    assert bk.keys() == []


def test_copy_overwrites_an_existing_destination(bk):
    bk.put("src", b"new-content")
    bk.put("dst", b"old-and-longer-content")
    copy(bk, "src", "dst")
    assert bk.read("dst") == b"new-content"
    assert bk.head("dst")["ETag"] == bk.head("src")["ETag"]


def test_copy_gets_a_new_last_modified(bk):
    bk.put("src", b"x")
    t_src = bk.head("src")["LastModified"]
    time.sleep(1.2)
    copy(bk, "src", "dst")
    assert bk.head("dst")["LastModified"] > t_src, "a copy is a new object and carries its own Last-Modified"
    assert bk.head("src")["LastModified"] == t_src


def test_copy_zero_byte_object(bk):
    bk.put("empty", b"")
    r = copy(bk, "empty", "empty2")
    assert r["CopyObjectResult"]["ETag"] == '"d41d8cd98f00b204e9800998ecf8427e"'
    assert bk.read("empty2") == b""


def test_copy_directory_marker(bk):
    bk.put("dir/", b"")
    copy(bk, "dir/", "dir2/")
    assert bk.head("dir2/")["ContentLength"] == 0


@pytest.mark.parametrize("hname", ["x-amz-metadata-directive", "x-amz-tagging-directive"])
def test_copy_unknown_directive_is_invalidargument(bk, hname):
    bk.put("src", b"x")
    r = raw_put(bk, "dst", b"", headers={"x-amz-copy-source": "/%s/src" % bk.name, hname: "BOGUS"})
    assert r.status == 400 and r.code == "InvalidArgument", r


def test_copy_with_acl_header(bk):
    bk.put("src", b"x")
    r = raw_put(bk, "ok", b"", headers={"x-amz-copy-source": "/%s/src" % bk.name, "x-amz-acl": "private"})
    assert r.status == 200, r
    r = raw_put(bk, "bad", b"", headers={"x-amz-copy-source": "/%s/src" % bk.name, "x-amz-acl": "public-read"})
    assert r.status == 400 and r.code == "AccessControlListNotSupported", r


def test_copy_into_a_key_that_is_too_long(bk):
    from bvx_a import too_long_key
    bk.put("src", b"x")
    with s3error("KeyTooLongError", 400):
        copy(bk, "src", too_long_key())


def test_copy_object_is_listed_once_and_with_the_right_size(bk):
    bk.put("src", rnd(1234))
    copy(bk, "src", "dst")
    lr = bk.s3.list_objects_v2(Bucket=bk.name)
    assert {o["Key"]: o["Size"] for o in lr["Contents"]} == {"src": 1234, "dst": 1234}
