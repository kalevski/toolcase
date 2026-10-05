"""Bucket-level S3 operations, stubs and the 'No' rows of the compatibility matrix (spec 5.2, 5.3)."""
import pytest

import bvh
from bvh import ADMIN, s3error, uniq
from bvx_a import raw_req


def bucket_req(bk, method, query=None, body=b"", headers=None, **kw):
    return bk.raw().request(method, "/" + bk.name, query=query, body=body, headers=headers, **kw)


# --------------------------------------------------------------------------------------------
# HeadBucket, location, versioning

def test_head_bucket(bk):
    r = bk.s3.head_bucket(Bucket=bk.name)
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200
    raw = bucket_req(bk, "HEAD")
    assert raw.status == 200 and raw.body == b""
    assert raw.header("x-amz-request-id")


def test_head_bucket_of_a_missing_bucket_is_404_status_only(bk):
    r = bk.raw().request("HEAD", "/bvt-nosuch-%s" % uniq("b")[-8:])
    assert r.status == 404 and r.body == b""
    with s3error(None, 404):
        bk.s3.head_bucket(Bucket="bvt-nosuch-%s" % uniq("b")[-8:])


def test_head_bucket_of_another_tokens_bucket_is_403(bk):
    other = bvh.fresh_bucket("hb")
    r = bk.raw().request("HEAD", "/" + other.name)
    assert r.status == 403 and r.body == b""


def test_get_bucket_location_is_empty_for_us_east_1(bk):
    r = bk.s3.get_bucket_location(Bucket=bk.name)
    assert r["LocationConstraint"] in (None, "")
    raw = bucket_req(bk, "GET", query={"location": ""})
    assert raw.status == 200 and raw.xml().tag == "LocationConstraint" and not (raw.xml().text or "").strip(), raw.text


def test_get_bucket_versioning_document(bk, vbk):
    off = bucket_req(bk, "GET", query={"versioning": ""})
    assert off.status == 200 and off.xml().tag == "VersioningConfiguration" and off.xml().find("Status") is None, off.text
    on = bucket_req(vbk, "GET", query={"versioning": ""})
    assert on.xml().findtext("Status") == "Enabled", on.text
    assert vbk.s3.get_bucket_versioning(Bucket=vbk.name)["Status"] == "Enabled"
    assert "Status" not in bk.s3.get_bucket_versioning(Bucket=bk.name)


# --------------------------------------------------------------------------------------------
# lifecycle, encryption, cors: read-only views of the admin-managed settings

def test_lifecycle_configuration_is_not_found_until_rules_exist(bk):
    with s3error("NoSuchLifecycleConfiguration", 404):
        bk.s3.get_bucket_lifecycle_configuration(Bucket=bk.name)


def test_lifecycle_rules_show_up_as_s3_xml():
    rules = [
        {"id": "scratch", "filter": {"prefix": "tmp/"}, "expire_days": 2, "abort_multipart_days": 1},
        {"id": "history", "noncurrent_days": 30, "noncurrent_keep": 5, "expire_delete_markers": True},
        {"id": "big-tagged", "filter": {"prefix": "logs/", "tags": {"scan": "clean"}, "min_size": 100, "max_size": 5000}, "expire_days": 7},
        {"id": "off", "enabled": False, "expire_days": 1},
    ]
    bk = bvh.fresh_bucket("lc", versioning="enabled", lifecycle=rules)
    r = bk.s3.get_bucket_lifecycle_configuration(Bucket=bk.name)["Rules"]
    by = {x["ID"]: x for x in r}
    assert set(by) == {"scratch", "history", "big-tagged", "off"}
    assert by["scratch"]["Status"] == "Enabled" and by["scratch"]["Expiration"]["Days"] == 2
    assert by["scratch"]["Filter"].get("Prefix") == "tmp/"
    assert by["scratch"]["AbortIncompleteMultipartUpload"]["DaysAfterInitiation"] == 1
    assert by["history"]["NoncurrentVersionExpiration"]["NoncurrentDays"] == 30
    assert by["history"]["NoncurrentVersionExpiration"].get("NewerNoncurrentVersions") == 5
    assert by["history"]["Expiration"]["ExpiredObjectDeleteMarker"] is True
    assert by["off"]["Status"] == "Disabled"
    f = by["big-tagged"]["Filter"]["And"]
    assert f["Prefix"] == "logs/" and f["Tags"] == [{"Key": "scan", "Value": "clean"}]
    # S3's bounds are exclusive; binvault's min_size/max_size may be inclusive, so the XML may carry N-1 / N+1
    assert f["ObjectSizeGreaterThan"] in (99, 100) and f["ObjectSizeLessThan"] in (5000, 5001), f
    raw = bucket_req(bk, "GET", query={"lifecycle": ""})
    assert raw.status == 200 and raw.xml().tag == "LifecycleConfiguration"


def test_encryption_configuration():
    plain = bvh.fresh_bucket("encn")
    with s3error("ServerSideEncryptionConfigurationNotFoundError", 404):
        plain.s3.get_bucket_encryption(Bucket=plain.name)
    enc = bvh.fresh_bucket("encs", encryption="sse-s3")
    r = enc.s3.get_bucket_encryption(Bucket=enc.name)["ServerSideEncryptionConfiguration"]["Rules"]
    assert r[0]["ApplyServerSideEncryptionByDefault"]["SSEAlgorithm"] == "AES256"


def test_cors_configuration_is_a_read_only_view_of_the_admin_rules():
    plain = bvh.fresh_bucket("corsn")
    with s3error("NoSuchCORSConfiguration", 404):
        plain.s3.get_bucket_cors(Bucket=plain.name)
    rules = [{"allowed_origins": ["https://a.example.com"], "allowed_methods": ["GET", "HEAD"], "allowed_headers": ["x-custom"],
              "expose_headers": ["ETag"], "max_age_seconds": 600},
             {"allowed_origins": ["*"], "allowed_methods": ["GET"]}]
    bk = bvh.fresh_bucket("corsr", cors=rules)
    got = bk.s3.get_bucket_cors(Bucket=bk.name)["CORSRules"]
    assert len(got) == 2
    assert got[0]["AllowedOrigins"] == ["https://a.example.com"] and got[0]["AllowedMethods"] == ["GET", "HEAD"]
    assert got[0]["AllowedHeaders"] == ["x-custom"] and got[0]["ExposeHeaders"] == ["ETag"] and got[0]["MaxAgeSeconds"] == 600
    assert got[1]["AllowedOrigins"] == ["*"] and got[1]["AllowedMethods"] == ["GET"]


# --------------------------------------------------------------------------------------------
# ACL stubs

def test_get_bucket_acl_and_object_acl_are_a_fixed_owner_with_full_control(bk):
    bk.put("k", b"x")
    for r in (bk.s3.get_bucket_acl(Bucket=bk.name), bk.s3.get_object_acl(Bucket=bk.name, Key="k")):
        assert r["Owner"]["ID"] and r["Owner"]["DisplayName"]
        assert len(r["Grants"]) == 1 and r["Grants"][0]["Permission"] == "FULL_CONTROL"
        assert r["Grants"][0]["Grantee"]["Type"] == "CanonicalUser" and r["Grants"][0]["Grantee"]["ID"] == r["Owner"]["ID"]


def test_acl_writes_accept_private_and_bucket_owner_full_control_only(bk):
    bk.put("k", b"x")
    for acl in ("private", "bucket-owner-full-control"):
        assert bk.s3.put_bucket_acl(Bucket=bk.name, ACL=acl)["ResponseMetadata"]["HTTPStatusCode"] == 200
        assert bk.s3.put_object_acl(Bucket=bk.name, Key="k", ACL=acl)["ResponseMetadata"]["HTTPStatusCode"] == 200
        bk.put("with-acl-" + acl, b"x", ACL=acl)
    for acl in ("public-read", "public-read-write", "authenticated-read", "aws-exec-read", "bucket-owner-read"):
        with s3error("AccessControlListNotSupported", 400):
            bk.s3.put_bucket_acl(Bucket=bk.name, ACL=acl)
        with s3error("AccessControlListNotSupported", 400):
            bk.s3.put_object_acl(Bucket=bk.name, Key="k", ACL=acl)
        with s3error("AccessControlListNotSupported", 400):
            bk.put("bad-acl", b"x", ACL=acl)
    with s3error(None, 404):
        bk.head("bad-acl")


def test_grant_headers_are_refused(bk):
    for h in ("x-amz-grant-read", "x-amz-grant-write", "x-amz-grant-full-control", "x-amz-grant-read-acp"):
        r = raw_req(bk, "PUT", uniq("g"), body=b"x", headers={h: 'id="someone"'})
        assert r.status == 400 and r.code in ("AccessControlListNotSupported", "NotImplemented", "InvalidArgument"), (h, r)


def test_acl_xml_body_with_a_grant_is_refused(bk):
    bk.put("k", b"x")
    body = ('<AccessControlPolicy><Owner><ID>x</ID></Owner><AccessControlList><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Group">'
            '<URI>http://acs.amazonaws.com/groups/global/AllUsers</URI></Grantee><Permission>READ</Permission></Grant></AccessControlList></AccessControlPolicy>')
    r = raw_req(bk, "PUT", "k", query={"acl": ""}, body=body, headers={"Content-Type": "application/xml"})
    assert r.status in (400, 501), r


# --------------------------------------------------------------------------------------------
# sub-resources the matrix marks as 'No' or as stubs

NOT_CONFIGURED = [("policy", "NoSuchBucketPolicy"), ("tagging", "NoSuchTagSet"), ("website", "NoSuchWebsiteConfiguration"),
                  ("object-lock", "ObjectLockConfigurationNotFoundError"), ("replication", "ReplicationConfigurationNotFoundError"),
                  ("ownershipControls", "OwnershipControlsNotFoundError"), ("publicAccessBlock", "NoSuchPublicAccessBlockConfiguration")]


@pytest.mark.parametrize("sub,code", NOT_CONFIGURED, ids=[s for s, _ in NOT_CONFIGURED])
def test_unconfigured_subresource_get(bk, sub, code):
    r = bucket_req(bk, "GET", query={sub: ""})
    assert r.status == 404 and r.code == code, r


@pytest.mark.parametrize("sub,code", NOT_CONFIGURED, ids=[s for s, _ in NOT_CONFIGURED])
@pytest.mark.parametrize("method", ["PUT", "DELETE"])
def test_unconfigured_subresource_put_and_delete_are_not_implemented(bk, sub, code, method):
    body = b"<Config/>" if method == "PUT" else b""
    r = bucket_req(bk, method, query={sub: ""}, body=body)
    assert r.status == 501 and r.code == "NotImplemented", r


@pytest.mark.parametrize("sub,root", [("logging", "BucketLoggingStatus"), ("notification", "NotificationConfiguration"),
                                      ("requestPayment", "RequestPaymentConfiguration")])
def test_default_empty_documents(bk, sub, root):
    r = bucket_req(bk, "GET", query={sub: ""})
    assert r.status == 200 and r.xml().tag == root, r
    if sub == "requestPayment":
        assert r.xml().findtext("Payer") == "BucketOwner"
    else:
        assert len(list(r.xml())) == 0, r.text


@pytest.mark.parametrize("sub", ["accelerate", "analytics", "inventory", "metrics", "intelligent-tiering", "policyStatus", "events"])
def test_unimplemented_bucket_subresources(bk, sub):
    r = bucket_req(bk, "GET", query={sub: ""})
    assert r.status == 501 and r.code == "NotImplemented", r


def test_an_unrecognised_bucket_parameter_is_not_implemented_never_a_listing(bk):
    bk.put("k", b"x")
    for q in ({"bogus-subresource": ""}, {"definitely-not-s3": "1"}):
        r = bucket_req(bk, "GET", query=q)
        assert r.status == 501 and r.code == "NotImplemented", (q, r)
        assert b"<Contents>" not in r.body


def test_put_and_delete_of_admin_managed_subresources_are_access_denied(bk):
    for sub in ("versioning", "lifecycle", "encryption", "cors"):
        for method in ("PUT", "DELETE") if sub != "versioning" else ("PUT",):
            r = bucket_req(bk, method, query={sub: ""}, body=b"<X/>" if method == "PUT" else b"")
            assert r.status == 403 and r.code == "AccessDenied", (sub, method, r)


@pytest.mark.parametrize("query,method", [({"restore": ""}, "POST"), ({"select": "", "select-type": "2"}, "POST"), ({"torrent": ""}, "GET"),
                                          ({"retention": ""}, "GET"), ({"retention": ""}, "PUT"), ({"legal-hold": ""}, "GET"), ({"legal-hold": ""}, "PUT")],
                         ids=["restore", "select", "torrent", "get-retention", "put-retention", "get-legal-hold", "put-legal-hold"])
def test_unimplemented_object_operations(bk, query, method):
    bk.put("k", b"x")
    r = raw_req(bk, method, "k", query=query, body=b"<X/>" if method in ("POST", "PUT") else b"")
    assert r.status == 501 and r.code == "NotImplemented", r


@pytest.mark.parametrize("hname,value", [("x-amz-website-redirect-location", "/other"), ("x-amz-object-lock-mode", "GOVERNANCE"),
                                         ("x-amz-object-lock-retain-until-date", "2040-01-01T00:00:00Z"), ("x-amz-object-lock-legal-hold", "ON"),
                                         ("x-amz-server-side-encryption-customer-algorithm", "AES256"),
                                         ("x-amz-server-side-encryption-aws-kms-key-id", "alias/x")])
def test_headers_that_imply_unsupported_behaviour_are_rejected_not_ignored(bk, hname, value):
    r = raw_req(bk, "PUT", uniq("h"), body=b"x", headers={hname: value})
    assert r.status in (400, 501) and r.code, (hname, r)
    assert bk.keys() == []


def test_expected_bucket_owner_and_request_payer_are_ignored(bk):
    r = raw_req(bk, "PUT", "k", body=b"x", headers={"x-amz-expected-bucket-owner": "123456789012", "x-amz-request-payer": "requester"})
    assert r.status == 200, r
    r = raw_req(bk, "GET", "k", headers={"x-amz-expected-bucket-owner": "999999999999", "x-amz-request-payer": "requester"})
    assert r.status == 200 and r.body == b"x", r


def test_storage_class_and_unknown_headers(bk):
    r = raw_req(bk, "PUT", "k", body=b"x", headers={"x-amz-storage-class": "GLACIER"})
    assert r.status == 400 and r.code == "InvalidStorageClass", r
    r = raw_req(bk, "PUT", "k2", body=b"x", headers={"X-Totally-Unknown": "whatever", "x-binvault-ignored": "1"})
    assert r.status == 200, "unknown request headers are ignored: %r" % r


# --------------------------------------------------------------------------------------------
# bucket name handling and verbs

@pytest.mark.parametrize("name", ["UPPER", "ab", "has_underscore", "-leading", "trailing-", "a..b", "192.168.1.1", "x" * 64])
def test_invalid_bucket_names_in_the_path_are_client_errors(bk, name):
    r = bk.raw().request("GET", "/%s" % name, query={"list-type": "2"})
    assert 400 <= r.status < 500, (name, r)
    assert r.code in ("InvalidBucketName", "NoSuchBucket", "AccessDenied", "InvalidArgument"), (name, r)


def test_wrong_verbs_on_the_service_root(bk):
    for m in ("PUT", "DELETE", "POST"):
        r = bk.raw().request(m, "/", body=b"" if m != "POST" else b"x=1")
        assert r.status == 405 and r.code == "MethodNotAllowed", (m, r)


def test_post_to_a_bucket_without_a_form_or_delete_query_is_an_error(bk):
    r = bucket_req(bk, "POST", body=b"hello")
    assert 400 <= r.status < 500 or r.status == 501, r


def test_options_on_a_key_without_cors_rules_is_access_denied(bk):
    r = bk.raw().request("OPTIONS", "/%s/k" % bk.name, sign=False, headers={"Origin": "https://x.example.com", "Access-Control-Request-Method": "GET"})
    assert r.status == 403 and r.code == "AccessDenied", r


def test_service_endpoints_are_reserved_and_open():
    import http.client
    c = http.client.HTTPConnection(bvh.HOSTPORT.split(":")[0], int(bvh.HOSTPORT.split(":")[1]), timeout=10)
    try:
        c.request("GET", "/_healthz")
        r = c.getresponse()
        assert r.status == 200
        r.read()
        c.request("GET", "/_version")
        r = c.getresponse()
        body = r.read()
        assert r.status == 200 and b'"version"' in body, body
        c.request("GET", "/_admin/v1/status", headers={"Authorization": "Bearer " + bvh.ADMIN_TOKEN})
        r = c.getresponse()
        assert r.status == 404, "the admin API is not served on the public listener"
        r.read()
        c.request("GET", "/_metrics", headers={"Authorization": "Bearer " + bvh.ADMIN_TOKEN})
        r = c.getresponse()
        assert r.status == 404, "metrics are served on the admin listener only"
        r.read()
    finally:
        c.close()


def test_admin_listener_serves_metrics_and_status():
    import urllib.request
    req = urllib.request.Request(bvh.ADMIN_URL + "/_metrics", headers={"Authorization": "Bearer " + bvh.ADMIN_TOKEN})
    with urllib.request.urlopen(req, timeout=10) as r:
        body = r.read().decode()
        assert r.status == 200 and "binvault_" in body
    req = urllib.request.Request(bvh.ADMIN_URL + "/_admin/v1/status", headers={"Authorization": "Bearer " + bvh.ADMIN_TOKEN})
    with urllib.request.urlopen(req, timeout=10) as r:
        assert r.status == 200
