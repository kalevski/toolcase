"""The admin API: buckets, tokens, optimistic concurrency, validation, authentication (spec 6.1-6.4, 4.2)."""
import datetime
import json
import random
import re
import urllib.error
import urllib.parse
import urllib.request
import uuid

import pytest

import bvh
from bvh import ADMIN, ADMIN_TOKEN, ADMIN_URL, MiB, uniq

BASE = ADMIN_URL + "/_admin/v1"


def call(method, path, body=None, headers=None, token=ADMIN_TOKEN, raw_body=None, base=BASE):
    """(status, parsed json or text, headers) - never raises on HTTP errors."""
    data = raw_body if raw_body is not None else (None if body is None else json.dumps(body).encode())
    req = urllib.request.Request(base + path, data=data, method=method)
    if token is not None:
        req.add_header("Authorization", "Bearer " + token)
    if data is not None:
        req.add_header("Content-Type", "application/json")
    for k, v in (headers or {}).items():
        req.add_header(k, v)
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            raw, status, hs = r.read(), r.status, r.headers
    except urllib.error.HTTPError as e:
        raw, status, hs = e.read(), e.code, e.headers
    try:
        return status, json.loads(raw) if raw else None, hs
    except ValueError:
        return status, raw.decode("utf-8", "replace"), hs


def mkname(tag="adm"):
    return "bvt-%s-%s" % (tag, uniq("")[1:9])


RFC3339 = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?Z$")
DEFAULTS = {"quota_bytes": None, "max_objects": None, "max_object_bytes": None, "allowed_content_types": [], "versioning": "off",
            "encryption": "none", "lifecycle": [], "limits": {}, "anonymous_read": "off", "anonymous_prefixes": [], "cors": []}


# --------------------------------------------------------------------------------------------
# create / read

def test_create_returns_the_defaults_of_the_settings_table():
    name = mkname()
    status, b, _ = call("POST", "/buckets", {"name": name})
    assert status == 201, b
    assert b["name"] == name and b["revision"] == 1 and RFC3339.match(b["created_at"]), b
    for k, v in DEFAULTS.items():
        assert b[k] == v, "default of %s: %r != %r" % (k, b[k], v)
    assert b["home"], "home is reported (a single node homes everything)"
    assert b["stats"] == {"objects": 0, "versions": 0, "delete_markers": 0, "bytes": 0, "upload_bytes": 0}, b["stats"]
    status, got, _ = call("GET", "/buckets/" + name)
    assert status == 200 and got == b


def test_create_with_every_setting():
    name = mkname()
    settings = {"quota_bytes": 10 ** 9, "max_objects": 1000, "max_object_bytes": 10 ** 6, "allowed_content_types": ["image/*", "text/plain"],
                "versioning": "enabled", "encryption": "sse-s3", "limits": {"requests_per_second": 50, "burst": 100, "bytes_in_per_second": 10 ** 7, "bytes_out_per_second": 10 ** 7},
                "anonymous_read": "objects", "anonymous_prefixes": ["pub/"],
                "cors": [{"allowed_origins": ["https://a.example.com"], "allowed_methods": ["GET"], "allowed_headers": ["*"], "expose_headers": ["ETag"], "max_age_seconds": 60}],
                "lifecycle": [{"id": "r", "expire_days": 3}]}
    status, b, _ = call("POST", "/buckets", dict(settings, name=name))
    assert status == 201, b
    for k, v in settings.items():
        got = b[k]
        if k == "lifecycle":
            assert got and got[0]["id"] == "r" and got[0]["expire_days"] == 3, got
        else:
            assert got == v, "%s: %r != %r" % (k, got, v)


def test_duplicate_name_is_409_conflict():
    name = mkname()
    assert call("POST", "/buckets", {"name": name})[0] == 201
    status, b, _ = call("POST", "/buckets", {"name": name})
    assert status == 409 and b["error"] == "conflict" and b["detail"], b


def test_parallel_creates_of_one_name_have_exactly_one_winner():
    name = mkname()
    res = bvh.run_threads([lambda: call("POST", "/buckets", {"name": name})[0] for _ in range(12)])
    assert sorted(res).count(201) == 1 and all(r in (201, 409) for r in res), res


@pytest.mark.parametrize("bad", ["UPPER", "ab", "x" * 64, "has_underscore", "-leading", "trailing-", "a..b", "192.168.0.1", "_reserved", "sp ace", "ünï", ""])
def test_invalid_bucket_names_are_400_with_the_field_named(bad):
    status, b, _ = call("POST", "/buckets", {"name": bad})
    assert status == 400 and b["error"] == "invalid_request", (bad, b)
    assert "name" in (b.get("fields") or {}), (bad, b)


def test_missing_name_and_malformed_bodies():
    for body in ({}, {"quota_bytes": 5}, []):
        status, b, _ = call("POST", "/buckets", body)
        assert status == 400 and b["error"] == "invalid_request", (body, status, b)
    for raw in (b"", b"not json", b'{"name": "x"', b'{"name":"abc-xyz"} trailing', b"null", b'"string"'):
        status, b, _ = call("POST", "/buckets", raw_body=raw)
        assert status == 400, (raw, status, b)


def test_unknown_fields_are_rejected_everywhere():
    name = mkname()
    status, b, _ = call("POST", "/buckets", {"name": name, "quotaBytes": 5})
    assert status == 400 and "quotaBytes" in (b.get("fields") or {}), b
    assert call("POST", "/buckets", {"name": name})[0] == 201
    assert call("PATCH", "/buckets/" + name, {"nope": 1})[0] == 400
    assert call("PUT", "/buckets/" + name, {"nope": 1})[0] == 400
    assert call("POST", "/buckets/%s/tokens" % name, {"name": "t", "grants": [{"actions": ["read"]}], "nope": 1})[0] == 400


@pytest.mark.parametrize("body", [
    {"quota_bytes": -1}, {"quota_bytes": "ten"}, {"max_objects": -5}, {"max_object_bytes": -1}, {"max_object_bytes": 10 ** 18},
    {"versioning": "suspended"}, {"versioning": "on"}, {"encryption": "aws:kms"}, {"encryption": "AES256"}, {"anonymous_read": "list"},
    {"anonymous_prefixes": "pub/"}, {"allowed_content_types": "image/png"}, {"allowed_content_types": [""]}, {"limits": {"requests_per_second": -1}},
    {"cors": [{"allowed_origins": [], "allowed_methods": ["GET"]}]}, {"lifecycle": [{"id": "x"}]}, {"home": "elsewhere"},
])
def test_invalid_settings_are_400(body):
    name = mkname()
    status, b, _ = call("POST", "/buckets", dict(body, name=name))
    assert status == 400 and b["error"] == "invalid_request", (body, status, b)
    assert call("GET", "/buckets/" + name)[0] == 404, "a rejected create must not leave a bucket behind"


def test_get_of_a_missing_bucket_is_404_not_found():
    status, b, _ = call("GET", "/buckets/" + mkname("missing"))
    assert status == 404 and b["error"] == "not_found", b


# --------------------------------------------------------------------------------------------
# list

def test_list_pages_by_limit_and_cursor():
    prefix = "bvt-lst%s" % uniq("")[1:7]
    names = sorted("%s-%d" % (prefix, i) for i in range(5))
    for n in names:
        assert call("POST", "/buckets", {"name": n})[0] == 201
    seen, cursor, pages = [], None, 0
    while True:
        status, b, _ = call("GET", "/buckets?limit=2" + ("&cursor=" + cursor if cursor else ""))
        assert status == 200 and set(b) >= {"items", "next_cursor"}, b
        assert len(b["items"]) <= 2
        seen += [x["name"] for x in b["items"] if x["name"].startswith(prefix)]
        pages += 1
        cursor = b["next_cursor"]
        if cursor is None:
            break
        assert pages < 500
    assert seen == names, "every bucket exactly once, in name order"
    assert all("stats" not in x for x in call("GET", "/buckets?limit=3")[1]["items"]), "stats only on request"
    items = call("GET", "/buckets?limit=3&stats=true")[1]["items"]
    assert all("stats" in x for x in items), items


@pytest.mark.parametrize("q", ["limit=0", "limit=-1", "limit=abc", "limit=501", "limit=100000"])
def test_list_limit_validation(q):
    status, b, _ = call("GET", "/buckets?" + q)
    if q == "limit=501" or q == "limit=100000":
        assert status in (200, 400), (q, status, b)           # capped at 500 or refused
        if status == 200:
            assert len(b["items"]) <= 500
    else:
        assert status == 400 and b["error"] == "invalid_request", (q, status, b)


def test_a_garbage_list_cursor_is_never_a_server_error():
    for cursor in ("%00%01garbage", "zzzz", "a" * 5000, "%ff%fe", "../../etc/passwd", "'; DROP TABLE buckets; --"):
        status, b, _ = call("GET", "/buckets?limit=5&cursor=" + urllib.parse.quote(cursor, safe="%"))
        assert status in (200, 400), (cursor[:30], status, b)
        if status == 200:
            assert set(b) >= {"items", "next_cursor"} and len(b["items"]) <= 5, b


# --------------------------------------------------------------------------------------------
# PUT / PATCH

def make(**settings):
    name = mkname()
    status, b, _ = call("POST", "/buckets", dict(settings, name=name))
    assert status == 201, b
    return name, b


def test_put_replaces_the_settings_and_resets_what_it_leaves_out():
    name, _ = make(quota_bytes=5000, anonymous_read="objects", cors=[{"allowed_origins": ["*"], "allowed_methods": ["GET"]}], versioning="enabled")
    status, b, _ = call("PUT", "/buckets/" + name, {"versioning": "enabled", "max_objects": 7})
    assert status == 200, b
    assert b["quota_bytes"] is None and b["anonymous_read"] == "off" and b["cors"] == [] and b["max_objects"] == 7 and b["versioning"] == "enabled", b


def test_put_of_a_missing_bucket_is_404_it_never_creates():
    status, b, _ = call("PUT", "/buckets/" + mkname("nope"), {"quota_bytes": 1})
    assert status == 404 and b["error"] == "not_found", b


def test_put_cannot_turn_versioning_off_again():
    name, _ = make(versioning="enabled")
    status, b, _ = call("PUT", "/buckets/" + name, {"versioning": "off"})
    assert status == 409 and b["error"] == "conflict", b
    status, b, _ = call("PATCH", "/buckets/" + name, {"versioning": "off"})
    assert status == 409, b
    assert call("GET", "/buckets/" + name)[1]["versioning"] == "enabled"


def test_put_with_identical_settings_changes_nothing():
    name, created = make(quota_bytes=777)
    status, b, _ = call("PUT", "/buckets/" + name, {"quota_bytes": 777})
    assert status == 200 and b["revision"] == created["revision"], "re-sending identical settings must not bump the revision: %r" % b


def test_patch_is_a_json_merge_patch():
    name, _ = make(quota_bytes=100, max_objects=5, limits={"requests_per_second": 10, "burst": 20}, cors=[{"allowed_origins": ["*"], "allowed_methods": ["GET"]}])
    status, b, _ = call("PATCH", "/buckets/" + name, {"max_objects": None, "limits": {"burst": None}})
    assert status == 200, b
    assert b["quota_bytes"] == 100, "untouched fields stay"
    assert b["max_objects"] is None, "null clears"
    assert b["limits"] == {"requests_per_second": 10}, "merge-patch recurses into objects: %r" % b["limits"]
    assert len(b["cors"]) == 1
    status, b, _ = call("PATCH", "/buckets/" + name, {"cors": []})
    assert b["cors"] == [], "arrays are replaced"
    status, b, _ = call("PATCH", "/buckets/" + name, {})
    assert status == 200 and b["quota_bytes"] == 100


def test_the_name_is_immutable_and_home_only_moves_through_a_move():
    name, _ = make()
    assert call("PATCH", "/buckets/" + name, {"name": mkname()})[0] == 400
    status, b, _ = call("PATCH", "/buckets/" + name, {"home": "auto"})
    assert status in (200, 400), b
    assert call("PATCH", "/buckets/" + name, {"home": "some-other-node"})[0] == 400


def test_revisions_and_if_match():
    name, created = make()
    rev = created["revision"]
    status, b, _ = call("PATCH", "/buckets/" + name, {"max_objects": 3}, headers={"If-Match": '"%d"' % rev})
    assert status == 200 and b["revision"] == rev + 1, b
    status, b, _ = call("PATCH", "/buckets/" + name, {"max_objects": 4}, headers={"If-Match": '"%d"' % rev})
    assert status == 412 and b["error"] == "precondition_failed", "a stale revision: %r" % b
    assert call("GET", "/buckets/" + name)[1]["max_objects"] == 3, "the refused patch changed nothing"
    status, b, _ = call("PUT", "/buckets/" + name, {"max_objects": 9}, headers={"If-Match": '"%d"' % rev})
    assert status == 412, b
    status, b, _ = call("PUT", "/buckets/" + name, {"max_objects": 9}, headers={"If-Match": '"%d"' % (rev + 1)})
    assert status == 200 and b["max_objects"] == 9, b


def test_concurrent_patches_with_if_match_have_one_winner():
    name, created = make()
    rev = created["revision"]
    res = bvh.run_threads([lambda i=i: call("PATCH", "/buckets/" + name, {"max_objects": 10 + i}, headers={"If-Match": '"%d"' % rev})[0] for i in range(10)])
    assert sorted(res).count(200) == 1 and all(r in (200, 412) for r in res), res


# --------------------------------------------------------------------------------------------
# delete

def test_delete_of_a_bucket_that_holds_data_needs_force():
    bk = bvh.fresh_bucket("del")
    bk.put("k", b"x")
    status, b, _ = call("DELETE", "/buckets/" + bk.name)
    assert status == 409 and b["error"] == "conflict", b
    assert bk.read("k") == b"x"
    status, b, _ = call("DELETE", "/buckets/%s?force=true" % bk.name)
    assert status in (200, 204), b
    assert bvh.err_of(bk.s3.get_object, Bucket=bk.name, Key="k")[1] in ("NoSuchBucket", "InvalidAccessKeyId")


def test_an_empty_bucket_deletes_without_force_and_the_name_can_be_reused_clean():
    bk = bvh.fresh_bucket("redo")
    old_ak = bk.ak
    status, b, _ = call("DELETE", "/buckets/" + bk.name)
    assert status in (200, 204), b
    assert call("GET", "/buckets/" + bk.name)[0] == 404
    status, nb, _ = call("POST", "/buckets", {"name": bk.name})
    assert status == 201, nb
    assert nb["stats"]["objects"] == 0
    assert [t for t in call("GET", "/buckets/%s/tokens" % bk.name)[1]["items"]] == [], "a re-created bucket starts without the old tokens"
    # the old credentials do not work on the new bucket
    assert bvh.err_of(bk.s3.list_objects_v2, Bucket=bk.name)[1] in ("InvalidAccessKeyId", "AccessDenied")


def test_delete_counts_noncurrent_versions_markers_and_open_uploads():
    vb = bvh.fresh_bucket("delv", versioning="enabled")
    vb.put("k", b"x")
    vb.delete("k")                                            # a delete marker above a version
    assert call("DELETE", "/buckets/" + vb.name)[0] == 409
    for v in vb.s3.list_object_versions(Bucket=vb.name)["Versions"]:
        vb.s3.delete_object(Bucket=vb.name, Key="k", VersionId=v["VersionId"])
    assert call("DELETE", "/buckets/" + vb.name)[0] == 409, "a bucket that only holds delete markers still holds version rows (spec 6.3)"
    for m in vb.s3.list_object_versions(Bucket=vb.name)["DeleteMarkers"]:
        vb.s3.delete_object(Bucket=vb.name, Key="k", VersionId=m["VersionId"])
    up = vb.s3.create_multipart_upload(Bucket=vb.name, Key="mp")["UploadId"]
    assert call("DELETE", "/buckets/" + vb.name)[0] == 409, "an open upload blocks the delete"
    vb.s3.abort_multipart_upload(Bucket=vb.name, Key="mp", UploadId=up)
    assert call("DELETE", "/buckets/" + vb.name)[0] in (200, 204)


def test_delete_of_a_missing_bucket_is_404():
    status, b, _ = call("DELETE", "/buckets/" + mkname("gone"))
    assert status == 404 and b["error"] == "not_found", b


# --------------------------------------------------------------------------------------------
# tokens

def test_token_listing_pages_and_never_shows_secrets():
    bk = bvh.fresh_bucket("tokl")
    ids = [ADMIN.create_token(bk.name, [{"actions": ["read"]}], name="t%d" % i)["access_key_id"] for i in range(5)] + [bk.ak]
    seen, cursor = [], None
    while True:
        status, b, _ = call("GET", "/buckets/%s/tokens?limit=2%s" % (bk.name, "&cursor=" + cursor if cursor else ""))
        assert status == 200 and len(b["items"]) <= 2, b
        for t in b["items"]:
            assert "secret_access_key" not in t and "secret" not in t, "secrets are shown once, at creation"
            assert set(t) >= {"access_key_id", "name", "grants", "limits", "created_at", "revision"}, t
        seen += [t["access_key_id"] for t in b["items"]]
        cursor = b["next_cursor"]
        if not cursor:
            break
    assert sorted(seen) == sorted(ids)


def test_one_thousand_tokens_per_bucket():
    bk = bvh.fresh_bucket("tok1k")
    base = len(call("GET", "/buckets/%s/tokens?limit=500" % bk.name)[1]["items"])
    res = bvh.run_threads([lambda: call("POST", "/buckets/%s/tokens" % bk.name, {"name": "t", "grants": [{"actions": ["read"]}]})[0] for _ in range(1000 - base)], 16)
    assert res.count(201) == 1000 - base, set(res)
    status, b, _ = call("POST", "/buckets/%s/tokens" % bk.name, {"name": "one too many", "grants": [{"actions": ["read"]}]})
    assert status in (400, 409, 422), "the 1001st token: %r %r" % (status, b)


def test_token_patch_and_delete_follow_revisions():
    bk = bvh.fresh_bucket("tokr")
    t = ADMIN.create_token(bk.name, [{"actions": ["read"]}], name="orig")
    status, b, _ = call("PATCH", "/buckets/%s/tokens/%s" % (bk.name, t["access_key_id"]), {"name": "renamed"}, headers={"If-Match": '"%d"' % t["revision"]})
    assert status == 200 and b["name"] == "renamed" and b["revision"] == t["revision"] + 1, b
    status, b, _ = call("PATCH", "/buckets/%s/tokens/%s" % (bk.name, t["access_key_id"]), {"name": "again"}, headers={"If-Match": '"%d"' % t["revision"]})
    assert status == 412, b
    status, b, _ = call("DELETE", "/buckets/%s/tokens/%s" % (bk.name, t["access_key_id"]))
    assert status in (200, 204)
    assert call("GET", "/buckets/%s/tokens" % bk.name)[1]["items"][0]["access_key_id"] != t["access_key_id"]


# --------------------------------------------------------------------------------------------
# authentication, routing, limits

def test_admin_calls_need_the_admin_token():
    for token in (None, "", "x" * 40, ADMIN_TOKEN[:-1], ADMIN_TOKEN + "x", ADMIN_TOKEN.upper() if ADMIN_TOKEN != ADMIN_TOKEN.upper() else "y" * 40):
        status, b, hs = call("GET", "/buckets", token=token)
        assert status == 401 and b["error"] == "unauthorized", (token, status, b)
        assert "bearer" in (hs.get("WWW-Authenticate") or "").lower(), hs
    for scheme in ("Basic " + ADMIN_TOKEN, ADMIN_TOKEN, "Token " + ADMIN_TOKEN):
        status, b, _ = call("GET", "/buckets", headers={"Authorization": scheme}, token=None)
        assert status == 401, (scheme, status)
    status, b, _ = call("GET", "/buckets?token=" + ADMIN_TOKEN, token=None)
    assert status == 401, "tokens in query strings are not accepted"


def test_a_bucket_token_is_not_an_admin_credential():
    bk = bvh.fresh_bucket("notadmin")
    status, b, _ = call("GET", "/buckets", token=bk.ak + "." + bk.sk)
    assert status == 401
    status, b, _ = call("GET", "/buckets", token=bk.sk)
    assert status == 401


def test_unknown_routes_and_wrong_methods_answer_json_errors():
    status, b, _ = call("GET", "/nope")
    assert status == 404 and isinstance(b, dict) and b.get("error") == "not_found", (status, b)
    status, b, _ = call("PATCH", "/buckets", {"x": 1})
    assert status in (404, 405), (status, b)
    status, b, _ = call("DELETE", "/buckets")
    assert status in (404, 405), (status, b)


def test_json_bodies_over_256_kib_are_refused():
    big = json.dumps({"name": mkname(), "allowed_content_types": ["x/y"], "padding": "p" * (300 * 1024)}).encode()
    status, b, _ = call("POST", "/buckets", raw_body=big)
    assert status in (400, 413), (status, str(b)[:200])
    if status == 413:
        assert b["error"] == "payload_too_large"


def test_status_and_config_are_node_local_views():
    status, st, _ = call("GET", "/status")
    assert status == 200 and isinstance(st, dict), st
    flat = json.dumps(st).lower()
    assert "uptime" in flat and "version" in flat and ("free" in flat or "disk" in flat), st
    status, cfg, _ = call("GET", "/config")
    assert status == 200 and isinstance(cfg, dict)
    assert ADMIN_TOKEN not in json.dumps(cfg)


def test_timestamps_are_rfc3339_utc():
    bk = bvh.fresh_bucket("ts")
    assert RFC3339.match(call("GET", "/buckets/" + bk.name)[1]["created_at"])
    for t in call("GET", "/buckets/%s/tokens" % bk.name)[1]["items"]:
        assert RFC3339.match(t["created_at"]), t
    t = ADMIN.create_token(bk.name, [{"actions": ["read"]}], expires_at=(datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)).strftime("%Y-%m-%dT%H:%M:%SZ"))
    assert RFC3339.match(t["expires_at"]), t


# --------------------------------------------------------------------------------------------
# home and the replication flag (spec 6.1, 6.3: a single node always homes everything)

def test_home_is_the_node_and_only_a_move_changes_it():
    name = mkname("home")
    status, b, _ = call("POST", "/buckets", {"name": name, "home": "auto"})
    assert status == 201, b
    home = b["home"]
    assert home and home != "auto", "the response names the node that homes the bucket: %r" % home
    for body in ({"home": "auto"}, {"home": home}, {}):
        assert call("PUT", "/buckets/" + name, body)[0] == 200, ("PUT", body)
        assert call("PATCH", "/buckets/" + name, body)[0] == 200, ("PATCH", body)
    for verb in ("PUT", "PATCH"):
        status, b, _ = call(verb, "/buckets/" + name, {"home": "no-such-node"})
        assert status in (400, 409) and b["error"] in ("invalid_request", "conflict"), (verb, status, b)
    assert call("GET", "/buckets/" + name)[1]["home"] == home
    status, b, _ = call("POST", "/buckets", {"name": mkname("home"), "home": home})
    assert status == 201 and b["home"] == home, b
    status, b, _ = call("POST", "/buckets", {"name": mkname("home"), "home": "no-such-node"})
    assert status == 400 and "home" in (b.get("fields") or {}), b


def test_the_replication_flag_is_ignored_on_a_single_node():
    name = mkname("wait")
    status, b, _ = call("POST", "/buckets?wait=replicated", {"name": name})
    assert status == 201 and "pending" not in b, (status, b)
    status, b, _ = call("PATCH", "/buckets/%s?wait=replicated" % name, {"max_objects": 3})
    assert status == 200 and "pending" not in b, (status, b)
    assert call("GET", "/buckets/%s?wait=replicated" % name)[0] == 200
    assert call("DELETE", "/buckets/%s?wait=replicated" % name)[0] in (200, 204)


# --------------------------------------------------------------------------------------------
# names (spec 3.7) and the limits of the settings table (spec 3.8, 3.13)

def boundary_name(kind):
    h = uuid.uuid4().hex
    if kind == "3 characters":
        return "t" + h[:2]
    if kind == "63 characters":
        return ("bvt-adm63-" + h * 2)[:63]
    if kind == "digits only":
        return "".join(str(random.randrange(10)) for _ in range(12))
    return "bvt--adm--" + h[:8]                                            # double hyphens


@pytest.mark.parametrize("kind", ["3 characters", "63 characters", "digits only", "double hyphens"])
def test_boundary_bucket_names_are_valid_and_usable(kind):
    for _ in range(40):                                                     # a 3-character name can collide with a leftover
        name = boundary_name(kind)
        status, b, _ = call("POST", "/buckets", {"name": name})
        if status != 409:
            break
    assert status == 201, (name, status, b)
    try:
        t = ADMIN.create_token(name, [{"actions": bvh.FULL}])
        c = bvh.make_client(t["access_key_id"], t["secret_access_key"])
        c.put_object(Bucket=name, Key="k", Body=b"x")
        assert c.get_object(Bucket=name, Key="k")["Body"].read() == b"x"
        if bvh.DOMAIN:
            v = bvh.make_client(t["access_key_id"], t["secret_access_key"], addressing="virtual")
            assert v.get_object(Bucket=name, Key="k")["Body"].read() == b"x", "the name must also work as a host label"
    finally:
        call("DELETE", "/buckets/%s?force=true" % name)


def test_dots_in_bucket_names_need_a_node_without_a_domain():
    if bvh.DOMAIN:
        status, b, _ = call("POST", "/buckets", {"name": "bvt.dot.%s" % uuid.uuid4().hex[:8]})
        assert status == 400 and "name" in (b.get("fields") or {}), "a node with BINVAULT_DOMAIN cannot address dotted names, so it refuses them: %r" % b
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        base = node.admin.url + "/_admin/v1"
        name = "bvt.dot.%s" % uuid.uuid4().hex[:8]
        status, b, _ = call("POST", "/buckets", {"name": name}, base=base, token=node.token)
        assert status == 201, b
        t = node.admin.create_token(name, [{"actions": bvh.FULL}])
        c = node.client(t["access_key_id"], t["secret_access_key"])
        c.put_object(Bucket=name, Key="k", Body=b"x")
        assert c.get_object(Bucket=name, Key="k")["Body"].read() == b"x"
        for bad in ("a..b", ".abc", "abc.", "192.168.1.1", "1.2.3.4"):
            status, b, _ = call("POST", "/buckets", {"name": bad}, base=base, token=node.token)
            assert status == 400 and "name" in (b.get("fields") or {}), (bad, status, b)


def test_settings_limits_of_the_spec():
    ceiling = call("GET", "/config")[1]["max_object_mb"] * MiB

    def create(**settings):
        return call("POST", "/buckets", dict(settings, name=mkname("lim")))[:2]

    status, b = create(max_object_bytes=ceiling)
    assert status == 201, ("max_object_bytes may equal BINVAULT_MAX_OBJECT_MB", b)
    status, b = create(max_object_bytes=ceiling + 1)
    assert status == 400 and "max_object_bytes" in b["fields"], ("max_object_bytes above BINVAULT_MAX_OBJECT_MB", b)
    types = ["image/x%d" % i for i in range(101)]
    assert create(allowed_content_types=types[:100])[0] == 201
    status, b = create(allowed_content_types=types)
    assert status == 400 and "allowed_content_types" in b["fields"], ("101 patterns", b)
    rules = [{"id": "r%d" % i, "expire_days": 1, "filter": {"prefix": "p%d/" % i}} for i in range(101)]
    assert create(lifecycle=rules[:100])[0] == 201
    status, b = create(lifecycle=rules)
    assert status == 400 and "lifecycle" in b["fields"], ("101 lifecycle rules", b)
    for field, value in (("quota_bytes", 1.5), ("quota_bytes", 2 ** 63), ("max_objects", "5"), ("max_objects", True)):
        status, b = create(**{field: value})
        assert status == 400 and b["error"] == "invalid_request", (field, value, status, b)
    assert create(quota_bytes=2 ** 63 - 1)[0] == 201


# --------------------------------------------------------------------------------------------
# tokens belong to one bucket (spec 4.3, 6.4)

def test_a_token_is_only_reachable_through_its_own_bucket():
    a, b = bvh.fresh_bucket("scopea"), bvh.fresh_bucket("scopeb")
    t = ADMIN.create_token(a.name, [{"actions": ["read"]}], name="mine")
    path = "/buckets/%s/tokens/%s"
    for method, body in (("GET", None), ("PATCH", {"name": "stolen"}), ("DELETE", None)):
        status, j, _ = call(method, path % (b.name, t["access_key_id"]), body)
        assert status == 404 and j["error"] == "not_found", (method, status, j)
    assert call("GET", path % (a.name, t["access_key_id"]))[1]["name"] == "mine", "the foreign calls changed nothing"
    c = bvh.make_client(t["access_key_id"], t["secret_access_key"])
    c.head_bucket(Bucket=a.name)
    assert bvh.err_of(c.head_bucket, Bucket=b.name)[0] == 403, "a token authorises exactly one bucket"
    assert t["access_key_id"] not in [x["access_key_id"] for x in call("GET", "/buckets/%s/tokens" % b.name)[1]["items"]]


def parse_time(s):
    s = re.sub(r"(\.\d{6})\d+", r"\1", s.replace("Z", "+00:00"))
    return datetime.datetime.fromisoformat(s)


def test_token_expiry_is_reported_and_last_use_starts_empty():
    bk = bvh.fresh_bucket("ttime")
    plain = ADMIN.create_token(bk.name, [{"actions": ["read"]}], name="forever")
    soon = (datetime.datetime.now(datetime.timezone.utc) + datetime.timedelta(days=1)).replace(microsecond=0)
    timed = ADMIN.create_token(bk.name, [{"actions": ["read"]}], name="timed", expires_at=soon.strftime("%Y-%m-%dT%H:%M:%SZ"))
    listed = {x["access_key_id"]: x for x in call("GET", "/buckets/%s/tokens" % bk.name)[1]["items"]}
    assert not listed[plain["access_key_id"]].get("expires_at"), listed[plain["access_key_id"]]
    assert parse_time(listed[timed["access_key_id"]]["expires_at"]) == soon
    for t in (plain, timed):
        assert not listed[t["access_key_id"]].get("last_used_at"), "never used yet"


# --------------------------------------------------------------------------------------------
# the admin listener serves the admin API and metrics, nothing else (spec 2.4)

@pytest.mark.parametrize("path", ["/", "/_healthz", "/_version", "/some-bucket", "/some-bucket/key", "/_peer/v1/hello", "/_admin", "/_nope"])
def test_the_admin_listener_serves_nothing_but_the_admin_api_and_metrics(path):
    hostport = urllib.parse.urlparse(ADMIN_URL).netloc
    for method in ("GET", "PUT", "POST", "DELETE"):
        r = bvh.http_raw(method, hostport, path, headers={"Authorization": "Bearer " + ADMIN_TOKEN}, body=b"x" if method in ("PUT", "POST") else b"")
        assert r.status == 404, (method, path, r.status, r.text[:100])


def test_s3_requests_on_the_admin_listener_are_not_served_even_when_signed():
    bk = bvh.fresh_bucket("onadmin")
    bk.put("k", b"x")
    r = bvh.Raw(bk.ak, bk.sk, endpoint=ADMIN_URL).request("GET", "/%s/k" % bk.name)
    assert r.status == 404, r
    assert bk.read("k") == b"x"


@pytest.mark.parametrize("path", ["/_x", "/_x/key", "/_admin/v1/buckets", "/_peer/v1/hello", "/_metrics", "/_"])
def test_underscore_paths_are_reserved_on_the_public_listener(path):
    for method in ("GET", "HEAD", "PUT", "DELETE", "POST"):
        r = bvh.http_raw(method, bvh.HOSTPORT, path, body=b"x" if method in ("PUT", "POST") else b"")
        assert r.status == 404, (method, path, r.status)
    r = bvh.suite_bucket("plain").raw().request("PUT", path, body=b"x")
    assert r.status == 404, ("signed", path, r.status, r.code)
