"""Anonymous read: unauthenticated GET/HEAD of objects in buckets that enable it (spec 4.6, 4.1, 5.4.2, 4.9)."""
import pytest

import bvh
from bvh import ADMIN, http_get, http_raw, md5hex, s3error, uniq
from bvx_a import vhost

BODY = b"<html><script>alert(1)</script></html>"


@pytest.fixture(scope="module")
def pub():
    bk = bvh.fresh_bucket("anon", anonymous_read="objects")
    bk.put("pub.html", BODY, ContentType="text/html", CacheControl="public, max-age=60", ContentDisposition='inline; filename="p.html"',
           Metadata={"owner": "me"}, Tagging="a=1")
    bk.put("dir/nested.txt", b"nested", ContentType="text/plain")
    bk.put("big.bin", bvh.pattern(300000))
    return bk


def anon(bk, key="", query="", method="GET", headers=None, **kw):
    return http_get(bk.url(key, query), headers=headers, method=method, **kw)


def denied(r):
    assert r.status == 403 and r.code == "AccessDenied", r


# --------------------------------------------------------------------------------------------
# what anonymous callers may do

def test_get_and_head_without_credentials(pub):
    r = anon(pub, "pub.html")
    assert r.status == 200 and r.body == BODY, r
    assert r.header("content-type") == "text/html" and r.header("etag") == '"%s"' % md5hex(BODY)
    assert r.header("last-modified") and r.header("accept-ranges") == "bytes"
    assert r.header("x-amz-meta-owner") == "me"
    h = anon(pub, "pub.html", method="HEAD")
    assert h.status == 200 and h.body == b"" and h.header("content-length") == str(len(BODY))


def test_anonymous_responses_carry_the_stored_cache_headers_and_the_safety_headers(pub):
    for method in ("GET", "HEAD"):
        r = anon(pub, "pub.html", method=method)
        assert r.header("cache-control") == "public, max-age=60"
        assert r.header("x-content-type-options") == "nosniff"
        assert r.header("content-security-policy") == "sandbox", "anonymous HTML must not run script in the bucket's origin"
        assert r.header("content-disposition") == 'inline; filename="p.html"'


def test_no_default_cache_control_is_invented(pub):
    r = anon(pub, "dir/nested.txt")
    assert r.status == 200 and r.header("cache-control") is None


def test_range_and_conditional_requests_work_anonymously(pub):
    data = bvh.pattern(300000)
    r = anon(pub, "big.bin", headers={"Range": "bytes=1000-1999"})
    assert r.status == 206 and r.body == data[1000:2000] and r.header("content-range") == "bytes 1000-1999/300000"
    etag = '"%s"' % md5hex(data)
    r = anon(pub, "big.bin", headers={"If-None-Match": etag})
    assert r.status == 304 and r.body == b""
    r = anon(pub, "big.bin", headers={"If-Match": '"nope"'})
    assert r.status == 412 and r.code == "PreconditionFailed", r


def test_missing_key_is_404(pub):
    r = anon(pub, "no/such/key")
    assert r.status == 404 and r.code == "NoSuchKey", r
    assert anon(pub, "no/such/key", method="HEAD").status == 404


def test_virtual_hosted_style_anonymous_read(pub):
    r = http_raw("GET", bvh.HOSTPORT, "/pub.html", headers={"Host": vhost(pub)})
    assert r.status == 200 and r.body == BODY, r


def test_the_harness_public_bucket_serves_anonymous_reads():
    b = bvh.suite_bucket("public")
    b.put("anon-check.txt", b"hi there")
    r = anon(b, "anon-check.txt")
    assert r.status == 200 and r.body == b"hi there"


# --------------------------------------------------------------------------------------------
# what they may not

@pytest.mark.parametrize("query", ["list-type=2", "", "list-type=2&prefix=dir/", "versions", "uploads", "location", "acl", "versioning", "cors", "lifecycle",
                                   "policy", "tagging"])
def test_anonymous_bucket_level_calls_are_denied(pub, query):
    r = anon(pub, "", query)
    denied(r)


def test_anonymous_head_bucket_is_denied(pub):
    r = http_raw("HEAD", bvh.HOSTPORT, "/" + pub.name)
    assert r.status == 403 and r.body == b""


@pytest.mark.parametrize("query", ["tagging", "acl", "attributes", "uploadId=abc", "versionId=null", "versionId=01JXXXXXXXXXXXXXXXXXXXXXXX"])
def test_anonymous_object_subresources_are_denied(pub, query):
    r = anon(pub, "pub.html", query)
    assert r.status in (403, 400) and r.code in ("AccessDenied", "InvalidRequest", "InvalidArgument"), (query, r)
    if query.startswith("versionId"):
        denied(r)


def test_anonymous_version_id_is_denied_even_for_the_null_version():
    bk = bvh.fresh_bucket("anonv", anonymous_read="objects", versioning="enabled")
    v1 = bk.put("k", b"first")["VersionId"]
    bk.put("k", b"second")
    r = anon(bk, "k")
    assert r.status == 200 and r.body == b"second", "anonymous sees only the latest version"
    denied(anon(bk, "k", "versionId=" + v1))
    denied(anon(bk, "k", "versionId=null"))
    bk.delete("k")
    r = anon(bk, "k")
    assert r.status == 404 and r.code == "NoSuchKey" and r.header("x-amz-delete-marker") == "true", r


@pytest.mark.parametrize("method", ["PUT", "DELETE", "POST"])
def test_anonymous_writes_are_denied(pub, method):
    r = anon(pub, "new-key", method=method, data=b"x" if method != "DELETE" else None)
    if method == "POST":
        assert r.status in (403, 405) and r.code in ("AccessDenied", "MethodNotAllowed"), r      # POST on an object key is not an S3 operation
    else:
        denied(r)
    assert anon(pub, "new-key").status == 404
    assert anon(pub, "pub.html").status == 200


def test_anonymous_multipart_and_delete_objects_are_denied(pub):
    denied(anon(pub, "mp", "uploads", method="POST", data=b""))
    denied(anon(pub, "", "delete", method="POST", data=b"<Delete><Object><Key>pub.html</Key></Object></Delete>"))
    assert anon(pub, "pub.html").status == 200


@pytest.mark.parametrize("q", ["response-content-type=text/plain", "response-content-disposition=attachment", "response-cache-control=no-store",
                               "response-expires=Thu, 01 Jan 2032 00:00:00 GMT"])
def test_response_overrides_are_refused_for_anonymous_callers(pub, q):
    r = anon(pub, "pub.html", q.replace(" ", "%20").replace(",", "%2C"))
    assert r.status == 400 and r.code == "InvalidRequest", r


def test_a_bucket_with_anonymous_read_off_is_private():
    bk = bvh.fresh_bucket("anonoff")
    bk.put("k", b"secret")
    denied(anon(bk, "k"))
    assert anon(bk, "k", method="HEAD").status == 403


def test_anonymous_never_reaches_other_buckets_objects():
    bk = bvh.fresh_bucket("anonother")
    bk.put("k", b"secret")
    denied(anon(bk, "k"))


def test_a_bad_signature_is_not_treated_as_anonymous(pub):
    r = pub.raw().request("GET", "/%s/pub.html" % pub.name, sign=False,
                          headers={"Authorization": "AWS4-HMAC-SHA256 Credential=%s/20260101/us-east-1/s3/aws4_request, SignedHeaders=host, Signature=%s" % (pub.ak, "0" * 64)})
    assert r.status == 403 and r.code in ("SignatureDoesNotMatch", "RequestTimeTooSkewed", "AccessDenied"), r
    r = pub.raw().request("GET", "/%s/pub.html" % pub.name, sign=False, headers={"Authorization": "Bearer not-a-token"})
    assert r.status == 403, r


# --------------------------------------------------------------------------------------------
# prefixes

def test_anonymous_prefixes_limit_what_is_public():
    bk = bvh.fresh_bucket("anonpfx", anonymous_read="objects", anonymous_prefixes=["public/", "img/logo"])
    for k in ("public/a.txt", "public/deep/b.txt", "private/c.txt", "img/logo.png", "img/logo2.png", "img/other.png", "publicity.txt", "public"):
        bk.put(k, k.encode())
    for k in ("public/a.txt", "public/deep/b.txt", "img/logo.png", "img/logo2.png"):
        r = anon(bk, k)
        assert r.status == 200 and r.body == k.encode(), (k, r)
    for k in ("private/c.txt", "img/other.png", "publicity.txt", "public"):
        denied(anon(bk, k))
    # a missing key outside the prefixes is also denied: nothing leaks about private key names
    denied(anon(bk, "private/does-not-exist"))
    assert anon(bk, "public/does-not-exist").status == 404


def test_changing_the_setting_applies_to_the_next_request():
    bk = bvh.fresh_bucket("anonchg")
    bk.put("k", b"v")
    denied(anon(bk, "k"))
    ADMIN.patch_bucket(bk.name, anonymous_read="objects")
    assert anon(bk, "k").status == 200
    ADMIN.patch_bucket(bk.name, anonymous_prefixes=["only/"])
    denied(anon(bk, "k"))
    ADMIN.patch_bucket(bk.name, anonymous_read="off", anonymous_prefixes=[])
    denied(anon(bk, "k"))


def test_invalid_anonymous_settings_are_rejected():
    bk = bvh.fresh_bucket("anonbad")
    for body in ({"anonymous_read": "list"}, {"anonymous_read": "everything"}, {"anonymous_prefixes": "x"}):
        with pytest.raises(bvh.AdminError) as ei:
            ADMIN.patch_bucket(bk.name, **body)
        assert ei.value.status == 400, (body, ei.value)


def test_anonymous_read_of_an_empty_object_and_a_directory_marker():
    bk = bvh.fresh_bucket("anonempty", anonymous_read="objects")
    bk.put("empty", b"")
    bk.put("dir/", b"")
    for k in ("empty", "dir/"):
        r = anon(bk, k)
        assert r.status == 200 and r.body == b"" and r.header("content-length") == "0", (k, r)
