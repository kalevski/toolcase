"""CORS: preflight, actual responses, rule matching (spec 5.10, 6.3)."""
import pytest

import bvh
from bvh import ADMIN, AdminError, http_raw, md5hex, s3error, uniq
from bvx_a import raw_get, raw_head, raw_req, vhost

R1 = {"allowed_origins": ["https://app.example.com", "https://*.example.org"], "allowed_methods": ["GET", "PUT", "HEAD"],
      "allowed_headers": ["Content-Type", "x-amz-meta-foo"], "expose_headers": ["ETag", "x-amz-version-id"], "max_age_seconds": 600}
R2 = {"allowed_origins": ["https://open.example.net"], "allowed_methods": ["GET", "POST", "DELETE"], "allowed_headers": ["*"],
      "expose_headers": ["x-amz-checksum-crc32"], "max_age_seconds": 3000}
R3 = {"allowed_origins": ["*"], "allowed_methods": ["GET"]}


@pytest.fixture(scope="module")
def cb():
    bk = bvh.fresh_bucket("cors", cors=[R1, R2, R3])
    bk.put("obj", b"cors object", ContentType="text/plain")
    return bk


def preflight(bk, origin="https://app.example.com", method="GET", headers=None, key="obj", extra=None):
    h = {}
    if origin is not None:
        h["Origin"] = origin
    if method is not None:
        h["Access-Control-Request-Method"] = method
    if headers is not None:
        h["Access-Control-Request-Headers"] = headers
    h.update(extra or {})
    target = "/%s/%s" % (bk.name, key) if key is not None else "/" + bk.name
    return http_raw("OPTIONS", bvh.HOSTPORT, target, headers=h)


def vary_values(r):
    return {tok.strip().lower() for k, v in r.raw_headers if k.lower() == "vary" for tok in v.split(",")}


# --------------------------------------------------------------------------------------------
# preflight

def test_preflight_from_an_allowed_origin(cb):
    r = preflight(cb, method="PUT", headers="content-type, x-amz-meta-foo")
    assert r.status == 200, r
    assert r.header("access-control-allow-origin") == "https://app.example.com"
    assert "PUT" in r.header("access-control-allow-methods", "")
    assert {h.strip().lower() for h in r.header("access-control-allow-headers", "").split(",")} >= {"content-type", "x-amz-meta-foo"}
    assert r.header("access-control-max-age") == "600"
    assert "origin" in vary_values(r)
    assert r.header("access-control-allow-credentials") is None, "credentials mode is not enabled"
    assert r.body == b""
    assert r.header("x-amz-request-id")


def test_preflight_needs_no_credentials_and_works_at_bucket_level_too(cb):
    r = preflight(cb, key=None)
    assert r.status == 200 and r.header("access-control-allow-origin") == "https://app.example.com"
    r = preflight(cb, key="a/key/that/does/not/exist")
    assert r.status == 200, "a preflight is answered from the bucket's rules whether or not the key exists"


def test_preflight_wildcard_origin_pattern(cb):
    r = preflight(cb, origin="https://static.example.org", method="PUT", headers="content-type")
    assert r.status == 200 and r.header("access-control-allow-origin") == "https://static.example.org", r
    # the bare domain and another scheme do not match "https://*.example.org" (R3 allows any origin, GET only)
    r = preflight(cb, origin="https://example.org", method="PUT")
    assert r.status == 403 and r.code == "AccessDenied", r
    r = preflight(cb, origin="http://static.example.org", method="PUT")
    assert r.status == 403, r


def test_preflight_unknown_origin_is_access_denied(cb):
    r = preflight(cb, origin="https://evil.example.com", method="PUT")
    assert r.status == 403 and r.code == "AccessDenied", r
    assert r.header("access-control-allow-origin") is None


def test_preflight_method_not_allowed_by_the_matching_rule(cb):
    r = preflight(cb, origin="https://app.example.com", method="DELETE")
    assert r.status == 403 and r.code == "AccessDenied", r
    r = preflight(cb, origin="https://app.example.com", method="POST")
    assert r.status == 403, r


def test_preflight_header_not_allowed_by_the_matching_rule(cb):
    r = preflight(cb, origin="https://app.example.com", method="PUT", headers="authorization")
    assert r.status == 403, r
    r = preflight(cb, origin="https://app.example.com", method="PUT", headers="content-type, authorization")
    assert r.status == 403, "every requested header must be allowed"


def test_preflight_request_header_names_are_case_insensitive(cb):
    r = preflight(cb, origin="https://app.example.com", method="PUT", headers="Content-TYPE,X-Amz-Meta-FOO")
    assert r.status == 200, r


def test_preflight_wildcard_headers_rule(cb):
    r = preflight(cb, origin="https://open.example.net", method="POST", headers="x-anything, x-else, authorization")
    assert r.status == 200 and r.header("access-control-allow-origin") == "https://open.example.net", r
    assert r.header("access-control-max-age") == "3000"


def test_preflight_star_origin_rule_answers_star(cb):
    r = preflight(cb, origin="https://whoever.example.io", method="GET")
    assert r.status == 200, r
    assert r.header("access-control-allow-origin") in ("*", "https://whoever.example.io")
    assert r.header("access-control-max-age") is None, "R3 sets no max age"
    r = preflight(cb, origin="https://whoever.example.io", method="HEAD")
    assert r.status == 403, "R3 allows GET only"


def test_the_first_rule_that_matches_origin_and_method_wins(cb):
    r = preflight(cb, origin="https://app.example.com", method="GET")
    assert r.status == 200 and r.header("access-control-allow-origin") == "https://app.example.com" and r.header("access-control-max-age") == "600"


def test_preflight_without_origin_or_request_method_is_a_client_error(cb):
    r = preflight(cb, origin=None)
    assert 400 <= r.status < 500, r
    r = preflight(cb, method=None)
    assert 400 <= r.status < 500, r


def test_preflight_of_a_missing_bucket_is_nosuchbucket(cb):
    r = http_raw("OPTIONS", bvh.HOSTPORT, "/bvt-nosuch-%s/k" % uniq("x")[-8:], headers={"Origin": "https://app.example.com", "Access-Control-Request-Method": "GET"})
    assert r.status == 404 and r.code == "NoSuchBucket", r


def test_a_bucket_without_rules_denies_every_preflight():
    bk = bvh.fresh_bucket("corsnone")
    r = preflight(bk, method="GET")
    assert r.status == 403 and r.code == "AccessDenied", r
    assert "CORS" in r.xml().findtext("Message", ""), r.text


def test_virtual_hosted_preflight(cb):
    r = http_raw("OPTIONS", bvh.HOSTPORT, "/obj", headers={"Host": vhost(cb), "Origin": "https://app.example.com", "Access-Control-Request-Method": "GET"})
    assert r.status == 200 and r.header("access-control-allow-origin") == "https://app.example.com", r


# --------------------------------------------------------------------------------------------
# actual responses

def test_get_from_an_allowed_origin_carries_cors_headers(cb):
    r = raw_get(cb, "obj", headers={"Origin": "https://app.example.com"})
    assert r.status == 200 and r.body == b"cors object"
    assert r.header("access-control-allow-origin") == "https://app.example.com"
    assert "origin" in vary_values(r)
    exposed = {h.strip().lower() for h in r.header("access-control-expose-headers", "").split(",")}
    assert {"etag", "x-amz-version-id"} <= exposed, r.raw_headers
    assert r.header("access-control-allow-credentials") is None


def test_head_and_error_responses_carry_cors_headers_too(cb):
    for fn, key, status in ((raw_head, "obj", 200), (raw_get, "missing-key", 404), (raw_head, "missing-key", 404)):
        r = fn(cb, key, headers={"Origin": "https://app.example.com"})
        assert r.status == status, r
        assert r.header("access-control-allow-origin") == "https://app.example.com", (fn.__name__, key, r.raw_headers)


def test_get_from_an_unknown_origin_gets_the_object_without_cors_headers(cb):
    r = raw_get(cb, "obj", headers={"Origin": "https://evil.example.com"})
    assert r.status == 200 and r.body == b"cors object"
    assert not [h for h in r.headers if h.startswith("access-control-")] or r.header("access-control-allow-origin") == "*"


def test_a_request_without_origin_has_no_cors_headers(cb):
    r = raw_get(cb, "obj")
    assert not [h for h in r.headers if h.startswith("access-control-")], r.raw_headers


def test_method_not_allowed_for_the_origin_means_no_cors_headers(cb):
    r = raw_req(cb, "DELETE", "to-delete", headers={"Origin": "https://app.example.com"})
    assert r.status == 204
    assert r.header("access-control-allow-origin") is None, "DELETE is not allowed for this origin by any rule"


def test_put_from_an_allowed_origin(cb):
    r = raw_req(cb, "PUT", "from-browser", body=b"x", headers={"Origin": "https://app.example.com", "Content-Type": "text/plain"})
    assert r.status == 200 and r.header("access-control-allow-origin") == "https://app.example.com", r


def test_presigned_get_with_origin(cb):
    url = cb.s3.generate_presigned_url("get_object", Params={"Bucket": cb.name, "Key": "obj"}, ExpiresIn=60)
    r = bvh.http_get(url, headers={"Origin": "https://app.example.com"})
    assert r.status == 200 and r.header("access-control-allow-origin") == "https://app.example.com", r.raw_headers


def test_anonymous_read_with_origin():
    cors = [{"allowed_origins": ["https://site.example.com"], "allowed_methods": ["GET", "HEAD"], "expose_headers": ["ETag"]}]
    bk = bvh.fresh_bucket("corsanon", anonymous_read="objects", cors=cors)
    bk.put("pub.txt", b"public")
    r = bvh.http_get(bk.url("pub.txt"), headers={"Origin": "https://site.example.com"})
    assert r.status == 200 and r.header("access-control-allow-origin") == "https://site.example.com", r.raw_headers
    r = bvh.http_get(bk.url("pub.txt"), headers={"Origin": "https://other.example.com"})
    assert r.status == 200 and r.header("access-control-allow-origin") is None


def test_authentication_errors_still_work_for_cors_requests(cb):
    r = cb.raw().request("GET", "/%s/obj" % cb.name, sign=False, headers={"Origin": "https://app.example.com"})
    assert r.status == 403 and r.code == "AccessDenied", r


def test_listing_response_carries_cors_headers(cb):
    r = raw_req(cb, "GET", None, query={"list-type": "2"}, headers={"Origin": "https://app.example.com"})
    assert r.status == 200 and r.header("access-control-allow-origin") == "https://app.example.com", r.raw_headers


# --------------------------------------------------------------------------------------------
# rule changes through the admin API take effect at once, and are validated

def test_rule_changes_apply_to_the_next_request():
    bk = bvh.fresh_bucket("corschg")
    assert preflight(bk, method="GET").status == 403
    ADMIN.patch_bucket(bk.name, cors=[{"allowed_origins": ["https://app.example.com"], "allowed_methods": ["GET"]}])
    assert preflight(bk, method="GET").status == 200
    ADMIN.patch_bucket(bk.name, cors=[])
    assert preflight(bk, method="GET").status == 403


@pytest.mark.parametrize("rule", [
    {"allowed_origins": [], "allowed_methods": ["GET"]},
    {"allowed_origins": ["https://a.example.com"], "allowed_methods": []},
    {"allowed_origins": ["https://a.example.com"], "allowed_methods": ["FETCH"]},
    {"allowed_origins": ["https://a.example.com"], "allowed_methods": ["GET"], "max_age_seconds": -1},
    {"allowed_origins": ["https://a.example.com"], "allowed_methods": ["GET"], "unknown_field": 1},
    {"allowed_methods": ["GET"]},
], ids=["no-origins", "no-methods", "bad-method", "negative-max-age", "unknown-field", "missing-origins"])
def test_invalid_rules_are_rejected_by_the_admin_api(rule):
    bk = bvh.fresh_bucket("corsbad")
    with pytest.raises(AdminError) as ei:
        ADMIN.patch_bucket(bk.name, cors=[rule])
    assert ei.value.status == 400, ei.value
