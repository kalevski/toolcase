"""Virtual-hosted-style addressing next to path-style (spec 2.4, 5.4.9, 3.7)."""
import pytest

import bvh
import bvx_c as X
from bvh import ADMIN, AdminError, MiB, http_raw, md5hex, multipart_etag, rnd, s3error, uniq
from bvx_a import vhost


@pytest.fixture(scope="module")
def vb():
    bk = bvh.fresh_bucket("vh")
    bk.put("hello.txt", b"hello vhost")
    return bk


def vreq(bk, method, path, *, host=None, query=None, headers=None, body=b"", **kw):
    """Signed request addressed to <bucket>.<domain> (connects to the loopback node)."""
    return bk.raw().request(method, path, query=query, headers=headers, body=body, host=host or vhost(bk), connect_host="127.0.0.1", **kw)


def test_boto3_virtual_hosted_client_covers_the_basic_operations(vb):
    c = vb.vs3
    c.put_object(Bucket=vb.name, Key="dir/a b.txt", Body=b"abc", ContentType="text/x-test", Metadata={"m": "1"})
    r = c.get_object(Bucket=vb.name, Key="dir/a b.txt")
    assert r["Body"].read() == b"abc" and r["ContentType"] == "text/x-test" and r["Metadata"] == {"m": "1"}
    assert c.head_object(Bucket=vb.name, Key="dir/a b.txt")["ContentLength"] == 3
    assert [o["Key"] for o in c.list_objects_v2(Bucket=vb.name, Prefix="dir/")["Contents"]] == ["dir/a b.txt"]
    c.copy_object(Bucket=vb.name, Key="dir/copy.txt", CopySource={"Bucket": vb.name, "Key": "dir/a b.txt"})
    assert vb.read("dir/copy.txt") == b"abc"
    c.delete_objects(Bucket=vb.name, Delete={"Objects": [{"Key": "dir/a b.txt"}, {"Key": "dir/copy.txt"}]})
    assert "dir/a b.txt" not in vb.keys()
    assert c.head_bucket(Bucket=vb.name)["ResponseMetadata"]["HTTPStatusCode"] == 200
    assert c.get_bucket_location(Bucket=vb.name)["ResponseMetadata"]["HTTPStatusCode"] == 200


def test_the_bucket_comes_from_the_host_and_the_whole_path_is_the_key(vb):
    r = vreq(vb, "GET", "/hello.txt")
    assert r.status == 200 and r.body == b"hello vhost", r
    r = vreq(vb, "PUT", "/a/b/c.txt", body=b"deep")
    assert r.status == 200, r
    assert vb.read("a/b/c.txt") == b"deep"
    r = vreq(vb, "GET", "/a/b/c.txt")
    assert r.body == b"deep"
    # the same key is NOT addressable as /<bucket>/<key> on the bucket host: the bucket name would be part of the key
    r = vreq(vb, "GET", "/%s/hello.txt" % vb.name)
    assert r.status == 404 and r.code == "NoSuchKey", r


def test_bucket_level_calls_on_the_bucket_host(vb):
    r = vreq(vb, "GET", "/", query={"list-type": "2"})
    assert r.status == 200 and b"hello.txt" in r.body, r
    r = vreq(vb, "GET", "/")                               # plain GET / on a bucket host is ListObjects (V1)
    assert r.status == 200 and r.xml().tag == "ListBucketResult" and r.xml().findtext("Name") == vb.name, r
    r = vreq(vb, "HEAD", "/")
    assert r.status == 200 and r.body == b""
    r = vreq(vb, "GET", "/", query={"location": ""})
    assert r.status == 200 and r.xml().tag == "LocationConstraint"
    r = vreq(vb, "GET", "/", query={"versioning": ""})
    assert r.status == 200


def test_keys_starting_with_an_underscore_are_ordinary_keys_on_the_bucket_host(vb):
    for key in ("_next/app.js", "_healthz", "_admin/v1/status", "_metrics", "_peer/v1/hello", "_version", "_"):
        r = vreq(vb, "PUT", "/" + key, body=key.encode())
        assert r.status == 200, (key, r)
    for key in ("_next/app.js", "_healthz", "_admin/v1/status", "_metrics", "_peer/v1/hello", "_version", "_"):
        r = vreq(vb, "GET", "/" + key)
        assert r.status == 200 and r.body == key.encode(), (key, r)
        assert vb.read(key) == key.encode(), "path-style reaches the same key through /<bucket>/<key>"
    assert vb.vs3.get_object(Bucket=vb.name, Key="_next/app.js")["Body"].read() == b"_next/app.js"


def test_reserved_names_are_reserved_only_as_the_first_path_segment_in_path_style(vb):
    r = vb.raw().request("GET", "/_healthz")
    assert r.status == 200
    r = vb.raw().request("GET", "/_admin/v1/status")
    assert r.status == 404, "the admin API does not exist on the public listener"
    vb.put("_x/y", b"under-bucket")
    assert vb.raw().request("GET", "/%s/_x/y" % vb.name).body == b"under-bucket"


def test_service_paths_on_a_bucket_host_are_keys_not_endpoints():
    bk = bvh.fresh_bucket("vhsvc")
    for key in ("_healthz", "_version", "_metrics"):
        r = vreq(bk, "GET", "/" + key)
        assert r.status == 404 and r.code == "NoSuchKey", (key, r)


def test_the_bare_domain_is_path_style():
    node_host = "%s:%d" % (bvh.DOMAIN, bvh.PORT)
    bk = bvh.fresh_bucket("vhbare")
    bk.put("k", b"bare")
    r = bk.raw().request("GET", "/%s/k" % bk.name, host=node_host, connect_host="127.0.0.1")
    assert r.status == 200 and r.body == b"bare", r
    r = bk.raw().request("GET", "/", host=node_host, connect_host="127.0.0.1")
    assert r.status == 200 and r.xml().tag == "ListAllMyBucketsResult" and [b.text for b in r.xml().findall("Buckets/Bucket/Name")] == [bk.name], r


def test_an_unrelated_host_is_path_style():
    bk = bvh.fresh_bucket("vhother")
    bk.put("k", b"x")
    r = bk.raw().request("GET", "/%s/k" % bk.name, host="some.unrelated.example.com", connect_host="127.0.0.1")
    assert r.status == 200 and r.body == b"x", r
    r = bk.raw().request("GET", "/k", host="%s.some.unrelated.example.com" % bk.name, connect_host="127.0.0.1")
    assert r.status in (403, 404) and r.code in ("NoSuchBucket", "AccessDenied"), "the host is not under the configured domain: /k is a bucket named k: %r" % r


def test_host_matching_ignores_case_port_and_a_trailing_dot(vb):
    for host in (vhost(vb).upper(), vhost(vb).replace(":", ".:"), "%s.%s" % (vb.name, bvh.DOMAIN)):
        r = vreq(vb, "GET", "/hello.txt", host=host)
        assert r.status in (200, 403), (host, r)         # a host without the port still addresses the bucket (the signature covers the host used)
        if r.status == 403:
            assert r.code == "SignatureDoesNotMatch", (host, r)


def test_a_token_of_another_bucket_is_denied_on_this_bucket_host(vb):
    other = bvh.fresh_bucket("vhother2")
    r = other.raw().request("GET", "/hello.txt", host=vhost(vb), connect_host="127.0.0.1")
    assert r.status == 403 and r.code == "AccessDenied", r


def test_a_missing_bucket_host_is_nosuchbucket(vb):
    host = "bvt-nosuch-%s.%s:%d" % (uniq("x")[-8:], bvh.DOMAIN, bvh.PORT)
    r = vb.raw().request("GET", "/k", host=host, connect_host="127.0.0.1")
    assert r.status in (403, 404) and r.code in ("NoSuchBucket", "AccessDenied", "InvalidAccessKeyId"), r


def test_a_dotted_bucket_name_is_not_addressable_and_cannot_be_created_while_a_domain_is_set():
    with pytest.raises(AdminError) as ei:
        ADMIN.create_bucket("bvt-has.dots-%s" % uniq("x")[-6:])
    assert ei.value.status == 400, ei.value
    bk = bvh.fresh_bucket("vhdot")
    r = bk.raw().request("GET", "/k", host="a.%s.%s:%d" % (bk.name, bvh.DOMAIN, bvh.PORT), connect_host="127.0.0.1")
    assert r.status in (403, 404), r


def test_leading_slashes_in_the_key(vb):
    r = vreq(vb, "PUT", "//lead", body=b"slash key")
    assert r.status == 200, r
    assert vb.read("/lead") == b"slash key", "exactly one leading slash is syntax; the second one is key text"
    r = vreq(vb, "GET", "//lead")
    assert r.status == 200 and r.body == b"slash key"
    assert vreq(vb, "GET", "/lead").status == 404


def test_virtual_hosted_multipart(vb):
    c = vb.vs3
    parts = [rnd(5 * MiB), rnd(321)]
    up = c.create_multipart_upload(Bucket=vb.name, Key="mp/obj")["UploadId"]
    ets = [{"PartNumber": i, "ETag": c.upload_part(Bucket=vb.name, Key="mp/obj", UploadId=up, PartNumber=i, Body=p)["ETag"]} for i, p in enumerate(parts, 1)]
    assert [u["Key"] for u in c.list_multipart_uploads(Bucket=vb.name)["Uploads"]] == ["mp/obj"]
    assert c.list_parts(Bucket=vb.name, Key="mp/obj", UploadId=up)["Parts"][0]["PartNumber"] == 1
    done = c.complete_multipart_upload(Bucket=vb.name, Key="mp/obj", UploadId=up, MultipartUpload={"Parts": ets})
    assert done["ETag"] == '"%s"' % multipart_etag(parts)
    assert vb.read("mp/obj") == b"".join(parts)
    # part copy on the bucket host
    up = c.create_multipart_upload(Bucket=vb.name, Key="mp/copy")["UploadId"]
    r = c.upload_part_copy(Bucket=vb.name, Key="mp/copy", UploadId=up, PartNumber=1, CopySource={"Bucket": vb.name, "Key": "mp/obj"}, CopySourceRange="bytes=0-99")
    c.complete_multipart_upload(Bucket=vb.name, Key="mp/copy", UploadId=up, MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": r["CopyPartResult"]["ETag"]}]})
    assert vb.read("mp/copy") == parts[0][:100]


def test_virtual_hosted_presigned_urls(vb):
    url = vb.vs3.generate_presigned_url("get_object", Params={"Bucket": vb.name, "Key": "hello.txt"}, ExpiresIn=60)
    assert url.startswith("http://%s.%s" % (vb.name, bvh.DOMAIN)), url
    r = bvh.http_get(url)
    assert r.status == 200 and r.body == b"hello vhost", r
    url = vb.vs3.generate_presigned_url("put_object", Params={"Bucket": vb.name, "Key": "presigned-put"}, ExpiresIn=60)
    assert bvh.http_get(url, method="PUT", data=b"via vhost url").status == 200
    assert vb.read("presigned-put") == b"via vhost url"


def test_virtual_hosted_conditional_and_range_requests(vb):
    r = vreq(vb, "GET", "/hello.txt", headers={"Range": "bytes=0-4"})
    assert r.status == 206 and r.body == b"hello", r
    r = vreq(vb, "GET", "/hello.txt", headers={"If-None-Match": '"%s"' % md5hex(b"hello vhost")})
    assert r.status == 304, r


def test_virtual_hosted_error_documents_name_the_bucket(vb):
    r = vreq(vb, "GET", "/no/such/key")
    assert r.status == 404 and r.code == "NoSuchKey"
    x = r.xml()
    assert x.findtext("Key") == "no/such/key" and x.findtext("RequestId") == r.header("x-amz-request-id"), r.text


def test_cors_preflight_on_the_bucket_host():
    rules = [{"allowed_origins": ["https://app.example.com"], "allowed_methods": ["GET"]}]
    bk = bvh.fresh_bucket("vhcors", cors=rules)
    r = http_raw("OPTIONS", bvh.HOSTPORT, "/some/key", headers={"Host": vhost(bk), "Origin": "https://app.example.com", "Access-Control-Request-Method": "GET"})
    assert r.status == 200 and r.header("access-control-allow-origin") == "https://app.example.com", r
    r = http_raw("OPTIONS", bvh.HOSTPORT, "/", headers={"Host": vhost(bk), "Origin": "https://app.example.com", "Access-Control-Request-Method": "GET"})
    assert r.status == 200, r
