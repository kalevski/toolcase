"""Versioning (spec 3.10, 5.4.2, 5.4.3, 5.4.4, 5.4.8): version ids, delete markers, purge, null versions,
ListObjectVersions paging, copies from versions, quota and counters. Real S3 is the reference where the
spec is silent; places where the spec deliberately differs from S3 are called out in the test docstrings."""
import re
import urllib.parse

import pytest

import bvh
import bvx_b as X
from bvh import s3error, uniq, fresh_bucket, ADMIN, Raw, s3quote
from bvx_b import hhdr, put_versions, all_versions, version_ids

ULID_UNKNOWN = "01ARZ3NDEKTSV4RRFFQ69G5FAV"          # well-formed id that no bucket knows


def markers_of(client, bucket, **kw):
    es, _, _ = all_versions(client, bucket, **kw)
    return [e for k, e in es if k == "D"]


def datas_of(client, bucket, **kw):
    es, _, _ = all_versions(client, bucket, **kw)
    return [e for k, e in es if k == "V"]


def raw_versions(b, **q):
    """One raw ListObjectVersions page: returns (entries in document order, root). entries are
    ('V'|'D', key, version id, is_latest)."""
    query = {"versions": ""}
    query.update({k: str(v) for k, v in q.items()})
    r = b.raw().request("GET", "/" + b.name, query=query)
    assert r.status == 200, r
    root = r.xml()
    out = []
    for el in root:
        if el.tag in ("Version", "DeleteMarker"):
            out.append(("V" if el.tag == "Version" else "D", el.findtext("Key"), el.findtext("VersionId"), el.findtext("IsLatest")))
    return out, root


def ordered_ids(b, key):
    """Version ids (data versions and markers) of one key in the order the server lists them."""
    out, _ = raw_versions(b, prefix=key)
    return [vid for kind, k, vid, _ in out if k == key]


# ---------------------------------------------------------------------------------------------
# version ids on writes and reads

def test_each_write_gets_a_distinct_version_id(vbk):
    vs = put_versions(vbk, "k", 5)
    ids = [v["vid"] for v in vs]
    assert all(ids), "PutObject in a versioned bucket must answer x-amz-version-id: %r" % ids
    assert len(set(ids)) == 5, ids
    assert "null" not in ids
    for i in ids:
        assert re.fullmatch(r"[A-Za-z0-9._-]{1,128}", i), "version id must be a URL-safe token, got %r" % i
    for v in vs:
        assert v["bv"] == v["vid"], "spec 3.3: x-binvault-version is the S3 VersionId in an enabled bucket (%r vs %r)" % (v["bv"], v["vid"])


def test_get_and_head_without_version_id_return_the_newest(vbk):
    vs = put_versions(vbk, "k", 3)
    g = vbk.get("k")
    assert g["Body"].read() == vs[-1]["body"]
    assert g["VersionId"] == vs[-1]["vid"]
    h = vbk.head("k")
    assert h["VersionId"] == vs[-1]["vid"]
    assert h["ContentLength"] == len(vs[-1]["body"])
    assert X.unquote_etag(h["ETag"]) == vs[-1]["etag"]


def test_get_and_head_by_version_id_return_that_version(vbk):
    vs = put_versions(vbk, "k", 4, size=300)
    for v in vs:
        g = vbk.get("k", VersionId=v["vid"])
        assert g["Body"].read() == v["body"], "wrong content for version %s" % v["vid"]
        assert g["VersionId"] == v["vid"]
        assert X.unquote_etag(g["ETag"]) == v["etag"]
        h = vbk.head("k", VersionId=v["vid"])
        assert h["VersionId"] == v["vid"] and h["ContentLength"] == len(v["body"])


def test_ranged_get_of_an_old_version(vbk):
    vs = put_versions(vbk, "k", 3, size=1000)
    r = vbk.get("k", VersionId=vs[0]["vid"], Range="bytes=10-19")
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 206
    assert r["Body"].read() == vs[0]["body"][10:20]
    assert r["VersionId"] == vs[0]["vid"]


def test_unversioned_bucket_has_no_version_id_headers(bk):
    """Spec 3.10: responses carry x-amz-version-id only in enabled buckets; x-binvault-version always."""
    p = bk.put("k", b"one")
    assert "x-amz-version-id" not in hhdr(p), hhdr(p)
    assert hhdr(p).get("x-binvault-version"), "x-binvault-version is always present"
    g = bk.get("k")
    assert "x-amz-version-id" not in hhdr(g) and hhdr(g).get("x-binvault-version")
    h = bk.head("k")
    assert "x-amz-version-id" not in hhdr(h) and hhdr(h).get("x-binvault-version")
    c = bk.s3.copy_object(Bucket=bk.name, Key="k2", CopySource={"Bucket": bk.name, "Key": "k"})
    assert "x-amz-version-id" not in hhdr(c) and "x-amz-copy-source-version-id" not in hhdr(c), hhdr(c)
    d = bk.delete("k")
    assert "x-amz-version-id" not in hhdr(d) and "x-amz-delete-marker" not in hhdr(d), hhdr(d)


# ---------------------------------------------------------------------------------------------
# delete markers

def test_delete_without_version_id_adds_a_delete_marker(vbk):
    put = vbk.put("k", b"data")
    d = vbk.delete("k")
    assert d["ResponseMetadata"]["HTTPStatusCode"] == 204
    assert d.get("DeleteMarker") is True, hhdr(d)
    assert hhdr(d).get("x-amz-delete-marker") == "true"
    assert d.get("VersionId") and d["VersionId"] != put["VersionId"], "the marker gets its own version id"
    # plain reads now fail, with the marker flagged (spec 5.4.2 / 3.10)
    with s3error("NoSuchKey", 404) as e:
        vbk.get("k")
    h = hhdr(e.error.response)
    assert h.get("x-amz-delete-marker") == "true", "GET of a marker-latest key must carry x-amz-delete-marker: %r" % h
    with s3error(None, 404) as e:
        vbk.head("k")
    assert hhdr(e.error.response).get("x-amz-delete-marker") == "true"
    # the data version is still there
    assert vbk.read("k", VersionId=put["VersionId"]) == b"data"


def test_second_delete_on_a_marker_adds_nothing(vbk):
    """Spec 3.10 (deliberately unlike S3, which stacks markers): nothing is added if the latest version already is a marker."""
    vbk.put("k", b"x")
    vbk.delete("k")
    r2 = vbk.delete("k")
    assert r2["ResponseMetadata"]["HTTPStatusCode"] == 204
    assert len(markers_of(vbk.s3, vbk.name)) == 1, "a delete on a delete marker must not add another marker"
    assert len(datas_of(vbk.s3, vbk.name)) == 1


def test_delete_of_a_never_existing_key_adds_nothing(vbk):
    """Spec 3.10: nothing is added if the key has no versions."""
    r = vbk.delete("ghost")
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 204
    es, _, _ = all_versions(vbk.s3, vbk.name)
    assert es == [], "no marker may be created for a key that never existed: %r" % es


def test_put_after_delete_marker_creates_a_new_visible_version(vbk):
    a = vbk.put("k", b"1")
    m = vbk.delete("k")
    b = vbk.put("k", b"2")
    assert vbk.read("k") == b"2"
    assert ordered_ids(vbk, "k") == [b["VersionId"], m["VersionId"], a["VersionId"]]


def test_get_by_version_id_of_a_delete_marker_is_method_not_allowed(vbk):
    vbk.put("k", b"x")
    m = vbk.delete("k")["VersionId"]
    with s3error("MethodNotAllowed", 405) as e:
        vbk.get("k", VersionId=m)
    assert hhdr(e.error.response).get("x-amz-delete-marker") == "true"
    with s3error(None, 405) as e:
        vbk.head("k", VersionId=m)
    assert hhdr(e.error.response).get("x-amz-delete-marker") == "true"


def test_unknown_version_id_is_no_such_version(vbk):
    vbk.put("k", b"x")
    with s3error("NoSuchVersion", 404):
        vbk.get("k", VersionId=ULID_UNKNOWN)
    with s3error(None, 404):
        vbk.head("k", VersionId=ULID_UNKNOWN)


def test_malformed_version_id(vbk):
    """Real S3 answers a malformed id with 400 InvalidArgument; spec 5.4.2 only says unknown id -> 404 NoSuchVersion.
    Either is accepted here (gap, not a failure) but it must be a clean 4xx."""
    vbk.put("k", b"x")
    with pytest.raises(Exception) as ei:
        vbk.get("k", VersionId="bogus!!id")
    resp = ei.value.response
    code, status = resp["Error"]["Code"], resp["ResponseMetadata"]["HTTPStatusCode"]
    assert (status, code) in ((400, "InvalidArgument"), (404, "NoSuchVersion")), (status, code)


def test_delete_of_an_unknown_version_is_idempotent(vbk):
    vbk.put("k", b"x")
    r = vbk.delete("k", VersionId=ULID_UNKNOWN)
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 204
    assert vbk.read("k") == b"x"


# ---------------------------------------------------------------------------------------------
# purge (delete with a version id)

def test_purge_removes_exactly_one_version(vbk):
    vs = put_versions(vbk, "k", 3)
    r = vbk.delete("k", VersionId=vs[1]["vid"])
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 204
    assert r.get("VersionId") == vs[1]["vid"], "the purge answers with the removed version id: %r" % hhdr(r)
    assert not r.get("DeleteMarker"), "removing a data version is not a marker removal"
    with s3error("NoSuchVersion", 404):
        vbk.get("k", VersionId=vs[1]["vid"])
    assert vbk.read("k") == vs[2]["body"], "the latest version is unchanged"
    assert version_ids(vbk.s3, vbk.name, "k") == [vs[2]["vid"], vs[0]["vid"]]


def test_purging_the_latest_version_promotes_the_next_highest(vbk):
    vs = put_versions(vbk, "k", 3)
    vbk.delete("k", VersionId=vs[2]["vid"])
    g = vbk.get("k")
    assert g["Body"].read() == vs[1]["body"] and g["VersionId"] == vs[1]["vid"]
    es, _, _ = all_versions(vbk.s3, vbk.name)
    latest = [e["VersionId"] for kind, e in es if e["IsLatest"]]
    assert latest == [vs[1]["vid"]], "exactly the next version becomes IsLatest: %r" % latest
    # and listing shows the promoted version
    lst = vbk.s3.list_objects_v2(Bucket=vbk.name)["Contents"]
    assert [(o["Key"], o["Size"]) for o in lst] == [("k", len(vs[1]["body"]))]


def test_purging_a_delete_marker_brings_the_key_back(vbk):
    a = vbk.put("k", b"alive")
    m = vbk.delete("k")["VersionId"]
    with s3error("NoSuchKey", 404):
        vbk.get("k")
    r = vbk.delete("k", VersionId=m)
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 204
    assert hhdr(r).get("x-amz-delete-marker") == "true", "removing a marker is reported with x-amz-delete-marker: %r" % hhdr(r)
    assert r.get("VersionId") == m
    g = vbk.get("k")
    assert g["Body"].read() == b"alive" and g["VersionId"] == a["VersionId"]
    assert vbk.keys() == ["k"]


def test_purging_the_last_version_removes_the_key_from_every_listing(vbk):
    a = vbk.put("k", b"x")
    vbk.delete("k", VersionId=a["VersionId"])
    assert vbk.keys() == []
    es, _, _ = all_versions(vbk.s3, vbk.name)
    assert es == []
    with s3error("NoSuchKey", 404) as e:
        vbk.get("k")
    assert "x-amz-delete-marker" not in hhdr(e.error.response)


def test_purging_a_noncurrent_marker_leaves_the_latest_alone(vbk):
    a = vbk.put("k", b"1")
    m = vbk.delete("k")["VersionId"]
    b = vbk.put("k", b"2")
    vbk.delete("k", VersionId=m)
    assert vbk.read("k") == b"2"
    assert version_ids(vbk.s3, vbk.name, "k") == [b["VersionId"], a["VersionId"]]


# ---------------------------------------------------------------------------------------------
# ListObjectVersions

def test_list_versions_order_and_fields(vbk):
    ka = put_versions(vbk, "a", 3)
    kb = put_versions(vbk, "b", 2)
    out, root = raw_versions(vbk)
    expect = [("a", v["vid"]) for v in reversed(ka)] + [("b", v["vid"]) for v in reversed(kb)]
    assert [(k, vid) for kind, k, vid, _ in out] == expect, "keys ascending, versions newest first: %r" % out
    flags = {(k, vid): latest for _, k, vid, latest in out}
    assert [k for (k, vid), l in flags.items() if l == "true"] == ["a", "b"]
    assert flags[("a", ka[-1]["vid"])] == "true" and flags[("a", ka[0]["vid"])] == "false"
    assert root.findtext("Name") == vbk.name
    assert root.findtext("IsTruncated") == "false"
    assert root.findtext("MaxKeys") == "1000"
    # typed entries through boto3
    r = vbk.s3.list_object_versions(Bucket=vbk.name)
    for v in r["Versions"]:
        assert re.fullmatch(r'"?[0-9a-f]{32}"?', v["ETag"]), v["ETag"]
        assert v["Size"] == 64
        assert v["StorageClass"] == "STANDARD"
        assert v["LastModified"].year >= 2024
        if "Owner" in v:
            assert v["Owner"]["ID"] == v["Owner"]["DisplayName"] == vbk.name, v["Owner"]


def test_list_versions_delete_marker_entries(vbk):
    a = vbk.put("k", b"1")
    m = vbk.delete("k")["VersionId"]
    r = vbk.s3.list_object_versions(Bucket=vbk.name)
    assert [d["VersionId"] for d in r["DeleteMarkers"]] == [m]
    d = r["DeleteMarkers"][0]
    assert d["Key"] == "k" and d["IsLatest"] is True and d["LastModified"]
    assert "Size" not in d and "ETag" not in d
    assert [(v["VersionId"], v["IsLatest"]) for v in r["Versions"]] == [(a["VersionId"], False)]
    if "Owner" in d:
        assert d["Owner"]["ID"] == d["Owner"]["DisplayName"] == vbk.name


def test_list_versions_paging_with_markers(vbk):
    ids = {}
    for key in ("k1", "k2", "k3"):
        ids[key] = [v["vid"] for v in put_versions(vbk, key, 5, tag=key)]
    full, _ = raw_versions(vbk)
    assert len(full) == 15
    expect = [(k, vid) for k in ("k1", "k2", "k3") for vid in reversed(ids[k])]
    assert [(k, vid) for _, k, vid, _ in full] == expect
    seen, pages, km, vm = [], 0, None, None
    while True:
        q = {"max-keys": 4}
        if km is not None:
            q["key-marker"] = km
        if vm is not None:
            q["version-id-marker"] = vm
        out, root = raw_versions(vbk, **q)
        pages += 1
        assert 1 <= len(out) <= 4
        if km is not None:
            assert root.findtext("KeyMarker") == km, "KeyMarker must echo the request"
        if vm is not None:
            assert root.findtext("VersionIdMarker") == vm
        seen += [(k, vid) for _, k, vid, _ in out]
        if root.findtext("IsTruncated") != "true":
            assert root.findtext("NextKeyMarker") in (None, "") and root.findtext("NextVersionIdMarker") in (None, "")
            break
        km, vm = root.findtext("NextKeyMarker"), root.findtext("NextVersionIdMarker")
        assert (km, vm) == (out[-1][1], out[-1][2]), "the next markers point at the last entry of the page"
        assert pages < 20
    assert pages == 4, "15 entries at 4 per page need 4 pages, got %d" % pages
    assert seen == expect, "paging must neither repeat nor skip an entry"


def test_list_versions_paginator_with_markers_and_delete_markers(vbk):
    for key in ("a", "b", "c"):
        put_versions(vbk, key, 3, tag=key)
    vbk.delete("b")
    full = vbk.s3.list_object_versions(Bucket=vbk.name)
    full_ids = sorted(v["VersionId"] for v in full["Versions"]) + sorted(d["VersionId"] for d in full["DeleteMarkers"])
    got_v, got_d = [], []
    for page in vbk.s3.get_paginator("list_object_versions").paginate(Bucket=vbk.name, PaginationConfig={"PageSize": 2}):
        got_v += [v["VersionId"] for v in page.get("Versions", [])]
        got_d += [d["VersionId"] for d in page.get("DeleteMarkers", [])]
    assert sorted(got_v) + sorted(got_d) == full_ids
    assert len(got_v) == 9 and len(got_d) == 1


def test_list_versions_prefix_and_delimiter(vbk):
    for key in ("top", "a/1", "a/2", "b/1", "b/sub/2"):
        put_versions(vbk, key, 2, tag="x")
    r = vbk.s3.list_object_versions(Bucket=vbk.name, Delimiter="/")
    assert sorted(p["Prefix"] for p in r["CommonPrefixes"]) == ["a/", "b/"]
    assert [v["Key"] for v in r["Versions"]] == ["top", "top"]
    r = vbk.s3.list_object_versions(Bucket=vbk.name, Prefix="a/")
    assert sorted({v["Key"] for v in r["Versions"]}) == ["a/1", "a/2"] and len(r["Versions"]) == 4
    r = vbk.s3.list_object_versions(Bucket=vbk.name, Prefix="b/", Delimiter="/")
    assert [p["Prefix"] for p in r["CommonPrefixes"]] == ["b/sub/"]
    assert {v["Key"] for v in r["Versions"]} == {"b/1"}
    assert r["Prefix"] == "b/" and r["Delimiter"] == "/"


def test_list_versions_paging_across_common_prefixes(vbk):
    for key in ("p/a", "p/b", "q/a", "z"):
        put_versions(vbk, key, 2, tag="x")
    seen_prefixes, seen_keys, km, vm = [], [], None, None
    for _ in range(10):
        q = {"delimiter": "/", "max-keys": 1}
        if km is not None:
            q["key-marker"] = km
        if vm:
            q["version-id-marker"] = vm
        out, root = raw_versions(vbk, **q)
        seen_prefixes += [e.findtext("Prefix") for e in root.findall("CommonPrefixes")]
        seen_keys += [(k, vid) for _, k, vid, _ in out]
        if root.findtext("IsTruncated") != "true":
            break
        km, vm = root.findtext("NextKeyMarker"), root.findtext("NextVersionIdMarker")
    assert seen_prefixes == ["p/", "q/"], "each common prefix appears exactly once across pages: %r" % seen_prefixes
    assert [k for k, _ in seen_keys] == ["z", "z"]


def test_list_versions_encoding_type_url(vbk):
    key = "dir/a b+c é.txt"
    put_versions(vbk, key, 2)
    # botocore sets EncodingType=url by itself and decodes the keys (unquote_plus)
    r = vbk.s3.list_object_versions(Bucket=vbk.name)
    assert [v["Key"] for v in r["Versions"]] == [key, key], "default listing must round-trip the key"
    # asked for explicitly, the keys stay encoded
    r = vbk.s3.list_object_versions(Bucket=vbk.name, EncodingType="url")
    assert r["EncodingType"] == "url"
    assert [urllib.parse.unquote_plus(v["Key"]) for v in r["Versions"]] == [key, key]
    raw, root = raw_versions(vbk, **{"encoding-type": "url"})
    assert root.findtext("EncodingType") == "url"
    wire = raw[0][1]
    assert urllib.parse.unquote_plus(wire) == key
    assert "+" not in wire.replace("%2B", ""), "a literal plus must be %2B (a bare + would mean space): %r" % wire
    assert " " not in wire and "é" not in wire, "url-encoded keys carry no raw spaces or non-ASCII: %r" % wire
    # without encoding-type the key is plain XML text
    raw, root = raw_versions(vbk)
    assert raw[0][1] == key and root.findtext("EncodingType") is None


def test_list_versions_marker_of_a_purged_version_is_invalid_argument(vbk):
    """Spec 5.4.8: a version-id-marker whose version has since been purged is InvalidArgument."""
    vs = put_versions(vbk, "k", 3)
    out, root = raw_versions(vbk, **{"max-keys": 1})
    km, vm = root.findtext("NextKeyMarker"), root.findtext("NextVersionIdMarker")
    assert (km, vm) == ("k", vs[2]["vid"])
    vbk.delete("k", VersionId=vm)
    with s3error("InvalidArgument", 400):
        vbk.s3.list_object_versions(Bucket=vbk.name, KeyMarker=km, VersionIdMarker=vm)


def test_list_versions_version_id_marker_requires_a_key_marker(vbk):
    vs = put_versions(vbk, "k", 2)
    with s3error("InvalidArgument", 400):
        vbk.s3.list_object_versions(Bucket=vbk.name, VersionIdMarker=vs[0]["vid"])


def test_list_versions_key_marker_without_version_marker_skips_the_whole_key(vbk):
    put_versions(vbk, "a", 3)
    put_versions(vbk, "b", 2)
    r = vbk.s3.list_object_versions(Bucket=vbk.name, KeyMarker="a")
    assert {v["Key"] for v in r["Versions"]} == {"b"}, "listing starts after the marker key"


def test_list_objects_omit_keys_whose_latest_version_is_a_delete_marker(vbk):
    for key in ("a", "b", "c"):
        vbk.put(key, key.encode())
    vbk.delete("b")
    v2 = vbk.s3.list_objects_v2(Bucket=vbk.name)
    assert [o["Key"] for o in v2["Contents"]] == ["a", "c"] and v2["KeyCount"] == 2
    v1 = vbk.s3.list_objects(Bucket=vbk.name)
    assert [o["Key"] for o in v1["Contents"]] == ["a", "c"]
    # the key comes back when the marker is purged
    m = [d["VersionId"] for d in vbk.s3.list_object_versions(Bucket=vbk.name)["DeleteMarkers"]][0]
    vbk.delete("b", VersionId=m)
    assert vbk.keys() == ["a", "b", "c"]


def test_list_objects_shows_only_the_latest_version_of_a_key(vbk):
    vs = put_versions(vbk, "k", 3, size=100)
    vbk.put("k", b"x" * 7)
    items = vbk.s3.list_objects_v2(Bucket=vbk.name)["Contents"]
    assert [(o["Key"], o["Size"]) for o in items] == [("k", 7)]


def test_list_with_a_common_prefix_hides_markers_too(vbk):
    for key in ("dir/a", "dir/b", "top"):
        vbk.put(key, b"x")
    vbk.delete("dir/a")
    vbk.delete("dir/b")
    r = vbk.s3.list_objects_v2(Bucket=vbk.name, Delimiter="/")
    assert [o["Key"] for o in r["Contents"]] == ["top"]
    assert "CommonPrefixes" not in r, "a prefix whose keys are all delete-marked is not listed: %r" % r.get("CommonPrefixes")


# ---------------------------------------------------------------------------------------------
# DeleteObjects

def test_delete_objects_mixed_plain_and_versioned_entries(vbk):
    a = put_versions(vbk, "a", 2)
    b = put_versions(vbk, "b", 2)
    r = vbk.s3.delete_objects(Bucket=vbk.name, Delete={"Objects": [
        {"Key": "a"},                                      # plain: adds a marker
        {"Key": "b", "VersionId": b[0]["vid"]},            # purge one version
        {"Key": "ghost"},                                  # nothing to delete
    ]})
    assert "Errors" not in r, r.get("Errors")
    by_key = {d["Key"]: d for d in r["Deleted"]}
    assert set(by_key) == {"a", "b", "ghost"}, r["Deleted"]
    assert by_key["a"].get("DeleteMarker") is True and by_key["a"].get("DeleteMarkerVersionId")
    assert "VersionId" not in by_key["a"], "a marker-creating entry echoes no VersionId: %r" % by_key["a"]
    assert by_key["b"].get("VersionId") == b[0]["vid"] and not by_key["b"].get("DeleteMarker")
    # effects
    assert [m["VersionId"] for m in markers_of(vbk.s3, vbk.name, Prefix="a")] == [by_key["a"]["DeleteMarkerVersionId"]]
    assert version_ids(vbk.s3, vbk.name, "b") == [b[1]["vid"]]
    with s3error("NoSuchKey", 404):
        vbk.get("a")
    assert vbk.read("b") == b[1]["body"]


def test_delete_objects_entry_naming_a_marker_reports_the_marker(vbk):
    vbk.put("k", b"x")
    m = vbk.delete("k")["VersionId"]
    r = vbk.s3.delete_objects(Bucket=vbk.name, Delete={"Objects": [{"Key": "k", "VersionId": m}]})
    d = r["Deleted"][0]
    assert d["Key"] == "k" and d["VersionId"] == m
    assert d.get("DeleteMarker") is True and d.get("DeleteMarkerVersionId") == m, d
    assert vbk.read("k") == b"x", "removing the marker uncovers the data"


def test_delete_objects_unknown_version_is_deleted_idempotently(vbk):
    vbk.put("k", b"x")
    r = vbk.s3.delete_objects(Bucket=vbk.name, Delete={"Objects": [{"Key": "k", "VersionId": ULID_UNKNOWN}]})
    assert "Errors" not in r and r["Deleted"][0]["Key"] == "k"
    assert vbk.read("k") == b"x"


def test_delete_objects_quiet_mode_reports_only_errors(vbk):
    put_versions(vbk, "a", 1)
    r = vbk.s3.delete_objects(Bucket=vbk.name, Delete={"Quiet": True, "Objects": [{"Key": "a"}]})
    assert "Deleted" not in r and "Errors" not in r, r
    with s3error("NoSuchKey", 404):
        vbk.get("a")


def test_delete_objects_hundreds_of_keys_each_get_a_marker(vbk):
    keys = ["many/%03d" % i for i in range(120)]
    for k in keys:
        vbk.put(k, b"x")
    r = vbk.s3.delete_objects(Bucket=vbk.name, Delete={"Objects": [{"Key": k} for k in keys]})
    assert len(r["Deleted"]) == 120 and all(d.get("DeleteMarker") for d in r["Deleted"])
    assert vbk.keys() == []
    assert len(markers_of(vbk.s3, vbk.name)) == 120


# ---------------------------------------------------------------------------------------------
# bucket-level calls

def test_get_bucket_versioning_reports_enabled(vbk):
    r = vbk.s3.get_bucket_versioning(Bucket=vbk.name)
    assert r.get("Status") == "Enabled", r
    assert "MFADelete" not in r or r["MFADelete"] != "Enabled"


def test_get_bucket_versioning_of_an_unversioned_bucket_is_empty(bk):
    r = bk.s3.get_bucket_versioning(Bucket=bk.name)
    assert "Status" not in r, "an unversioned bucket answers an empty VersioningConfiguration: %r" % r


def test_put_bucket_versioning_is_access_denied(vbk, bk):
    for b in (vbk, bk):
        with s3error("AccessDenied", 403):
            b.s3.put_bucket_versioning(Bucket=b.name, VersioningConfiguration={"Status": "Suspended"})
    with s3error("AccessDenied", 403):
        bk.s3.put_bucket_versioning(Bucket=bk.name, VersioningConfiguration={"Status": "Enabled"})


def test_admin_cannot_turn_versioning_back_off(vbk):
    with pytest.raises(bvh.AdminError) as e:
        ADMIN.patch_bucket(vbk.name, versioning="off")
    assert e.value.status == 409


# ---------------------------------------------------------------------------------------------
# null versions (a bucket that is enabled after it already holds objects)

def test_existing_objects_become_null_versions_when_versioning_is_enabled(bk):
    bk.put("a", b"alpha")
    bk.put("b", b"beta")
    ADMIN.patch_bucket(bk.name, versioning="enabled")
    r = bk.s3.list_object_versions(Bucket=bk.name)
    assert [(v["Key"], v["VersionId"], v["IsLatest"]) for v in r["Versions"]] == [("a", "null", True), ("b", "null", True)]
    g = bk.get("a")
    assert g["Body"].read() == b"alpha" and g.get("VersionId") == "null", hhdr(g)
    assert bk.read("a", VersionId="null") == b"alpha"
    assert bk.head("b", VersionId="null")["ContentLength"] == 4


def test_new_write_makes_the_null_version_noncurrent(bk):
    bk.put("a", b"old")
    ADMIN.patch_bucket(bk.name, versioning="enabled")
    n = bk.put("a", b"new")
    assert n["VersionId"] and n["VersionId"] != "null"
    r = bk.s3.list_object_versions(Bucket=bk.name)
    assert [(v["VersionId"], v["IsLatest"]) for v in r["Versions"]] == [(n["VersionId"], True), ("null", False)]
    assert bk.read("a") == b"new"
    assert bk.read("a", VersionId="null") == b"old"


def test_deleting_the_null_version_by_id_removes_it_for_good(bk):
    bk.put("a", b"old")
    ADMIN.patch_bucket(bk.name, versioning="enabled")
    n = bk.put("a", b"new")
    r = bk.delete("a", VersionId="null")
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 204
    assert r.get("VersionId") == "null", hhdr(r)
    with s3error("NoSuchVersion", 404):
        bk.get("a", VersionId="null")
    assert version_ids(bk.s3, bk.name, "a") == [n["VersionId"]]
    assert bk.read("a") == b"new"


def test_plain_delete_of_a_null_latest_adds_a_marker_and_keeps_the_null_version(bk):
    bk.put("a", b"old")
    ADMIN.patch_bucket(bk.name, versioning="enabled")
    m = bk.delete("a")
    assert m.get("DeleteMarker") is True and m["VersionId"] != "null"
    with s3error("NoSuchKey", 404):
        bk.get("a")
    assert bk.read("a", VersionId="null") == b"old"
    bk.delete("a", VersionId=m["VersionId"])
    assert bk.read("a") == b"old"


def test_null_version_can_be_copied_and_tagged(bk):
    bk.put("a", b"old")
    ADMIN.patch_bucket(bk.name, versioning="enabled")
    c = bk.s3.copy_object(Bucket=bk.name, Key="copy", CopySource={"Bucket": bk.name, "Key": "a", "VersionId": "null"})
    assert c["VersionId"] and c["CopySourceVersionId"] == "null", hhdr(c)
    bk.s3.put_object_tagging(Bucket=bk.name, Key="a", VersionId="null", Tagging={"TagSet": [{"Key": "k", "Value": "v"}]})
    t = bk.s3.get_object_tagging(Bucket=bk.name, Key="a", VersionId="null")
    assert t["TagSet"] == [{"Key": "k", "Value": "v"}] and t["VersionId"] == "null"


# ---------------------------------------------------------------------------------------------
# unversioned buckets and version ids

def test_unversioned_bucket_accepts_version_id_null(bk):
    bk.put("k", b"one")
    assert bk.read("k", VersionId="null") == b"one"
    assert bk.head("k", VersionId="null")["ContentLength"] == 3
    # a delete with versionId=null is an ordinary delete (spec 3.10)
    r = bk.delete("k", VersionId="null")
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 204
    assert "x-amz-delete-marker" not in hhdr(r)
    with s3error("NoSuchKey", 404):
        bk.get("k")


def test_unversioned_bucket_rejects_any_other_version_id(bk):
    bk.put("k", b"one")
    with s3error("InvalidArgument", 400):
        bk.get("k", VersionId="abc")
    with s3error(None, 400):
        bk.head("k", VersionId="abc")
    with s3error("InvalidArgument", 400):
        bk.delete("k", VersionId="abc")
    assert bk.read("k") == b"one", "the refused delete must not have removed anything"
    with s3error("InvalidArgument", 400):
        bk.s3.get_object_tagging(Bucket=bk.name, Key="k", VersionId="abc")


def test_unversioned_bucket_lists_every_key_with_one_null_version(bk):
    for k in ("a", "b"):
        bk.put(k, k.encode())
    bk.put("a", b"again")
    r = bk.s3.list_object_versions(Bucket=bk.name)
    assert [(v["Key"], v["VersionId"], v["IsLatest"]) for v in r["Versions"]] == [("a", "null", True), ("b", "null", True)]
    assert "DeleteMarkers" not in r


def test_unversioned_delete_objects_with_null_version_id(bk):
    bk.put("a", b"x")
    r = bk.s3.delete_objects(Bucket=bk.name, Delete={"Objects": [{"Key": "a", "VersionId": "null"}]})
    assert "Errors" not in r and r["Deleted"][0]["Key"] == "a"
    assert bk.keys() == []


# ---------------------------------------------------------------------------------------------
# CopyObject with versions

def test_copy_from_an_old_version_restores_it(vbk):
    vs = put_versions(vbk, "k", 3)
    c = vbk.s3.copy_object(Bucket=vbk.name, Key="k", CopySource={"Bucket": vbk.name, "Key": "k", "VersionId": vs[0]["vid"]})
    assert c["VersionId"] not in [v["vid"] for v in vs]
    assert c["CopySourceVersionId"] == vs[0]["vid"]
    assert vbk.read("k") == vs[0]["body"], "the copy of the old version is now the newest"
    assert len(version_ids(vbk.s3, vbk.name, "k")) == 4


def test_copy_of_the_latest_version_onto_itself_is_invalid(vbk):
    vbk.put("k", b"x")
    with s3error("InvalidRequest", 400):
        vbk.s3.copy_object(Bucket=vbk.name, Key="k", CopySource={"Bucket": vbk.name, "Key": "k"})
    assert len(version_ids(vbk.s3, vbk.name, "k")) == 1


def test_copy_onto_itself_with_replaced_metadata_adds_a_version(vbk):
    a = vbk.put("k", b"x", Metadata={"m": "1"})
    c = vbk.s3.copy_object(Bucket=vbk.name, Key="k", CopySource={"Bucket": vbk.name, "Key": "k"},
                           MetadataDirective="REPLACE", Metadata={"m": "2"})
    assert c["VersionId"] != a["VersionId"]
    assert vbk.head("k")["Metadata"] == {"m": "2"}
    assert vbk.head("k", VersionId=a["VersionId"])["Metadata"] == {"m": "1"}


def test_copy_naming_a_delete_marker_version_is_invalid_request(vbk):
    vbk.put("k", b"x")
    m = vbk.delete("k")["VersionId"]
    with s3error("InvalidRequest", 400):
        vbk.s3.copy_object(Bucket=vbk.name, Key="k2", CopySource={"Bucket": vbk.name, "Key": "k", "VersionId": m})


def test_copy_of_a_key_whose_latest_is_a_marker_is_no_such_key(vbk):
    vbk.put("k", b"x")
    vbk.delete("k")
    with s3error("NoSuchKey", 404):
        vbk.s3.copy_object(Bucket=vbk.name, Key="k2", CopySource={"Bucket": vbk.name, "Key": "k"})


def test_copy_from_an_unknown_version_is_no_such_version(vbk):
    vbk.put("k", b"x")
    with s3error("NoSuchVersion", 404):
        vbk.s3.copy_object(Bucket=vbk.name, Key="k2", CopySource={"Bucket": vbk.name, "Key": "k", "VersionId": ULID_UNKNOWN})


def test_copy_to_another_key_adds_one_version_and_leaves_the_source_alone(vbk):
    vs = put_versions(vbk, "src", 2)
    c = vbk.s3.copy_object(Bucket=vbk.name, Key="dst", CopySource={"Bucket": vbk.name, "Key": "src", "VersionId": vs[0]["vid"]})
    assert c["VersionId"] and hhdr(c).get("x-amz-copy-source-version-id") == vs[0]["vid"]
    assert vbk.read("dst") == vs[0]["body"]
    assert version_ids(vbk.s3, vbk.name, "src") == [vs[1]["vid"], vs[0]["vid"]]
    assert len(version_ids(vbk.s3, vbk.name, "dst")) == 1


# ---------------------------------------------------------------------------------------------
# metadata and tags are per version

def test_metadata_and_content_type_are_per_version(vbk):
    a = vbk.put("k", b"1", ContentType="text/plain", Metadata={"gen": "1"}, CacheControl="max-age=1")
    b = vbk.put("k", b"22", ContentType="application/json", Metadata={"gen": "2"})
    ha, hb = vbk.head("k", VersionId=a["VersionId"]), vbk.head("k", VersionId=b["VersionId"])
    assert (ha["ContentType"], ha["Metadata"], ha.get("CacheControl")) == ("text/plain", {"gen": "1"}, "max-age=1")
    assert (hb["ContentType"], hb["Metadata"], hb.get("CacheControl")) == ("application/json", {"gen": "2"}, None)


def test_tagging_addresses_one_version(vbk):
    vs = put_versions(vbk, "k", 2)
    s3 = vbk.s3
    r = s3.put_object_tagging(Bucket=vbk.name, Key="k", VersionId=vs[0]["vid"], Tagging={"TagSet": [{"Key": "gen", "Value": "old"}]})
    assert hhdr(r).get("x-amz-version-id") == vs[0]["vid"], "tagging answers with the version it changed"
    old = s3.get_object_tagging(Bucket=vbk.name, Key="k", VersionId=vs[0]["vid"])
    assert old["TagSet"] == [{"Key": "gen", "Value": "old"}] and old["VersionId"] == vs[0]["vid"]
    assert s3.get_object_tagging(Bucket=vbk.name, Key="k")["TagSet"] == [], "the latest version is untagged"
    assert hhdr(vbk.head("k", VersionId=vs[0]["vid"])).get("x-amz-tagging-count") == "1"
    d = s3.delete_object_tagging(Bucket=vbk.name, Key="k", VersionId=vs[0]["vid"])
    assert d["ResponseMetadata"]["HTTPStatusCode"] == 204
    assert s3.get_object_tagging(Bucket=vbk.name, Key="k", VersionId=vs[0]["vid"])["TagSet"] == []


def test_tag_changes_do_not_create_a_version_or_change_the_etag(vbk):
    a = vbk.put("k", b"x")
    before = vbk.head("k")
    vbk.s3.put_object_tagging(Bucket=vbk.name, Key="k", Tagging={"TagSet": [{"Key": "a", "Value": "b"}]})
    after = vbk.head("k")
    assert after["ETag"] == before["ETag"] and after["LastModified"] == before["LastModified"] and after["VersionId"] == a["VersionId"]
    assert version_ids(vbk.s3, vbk.name, "k") == [a["VersionId"]]


def test_tagging_a_delete_marker_version_is_refused(vbk):
    vbk.put("k", b"x")
    m = vbk.delete("k")["VersionId"]
    with s3error(None, 405):
        vbk.s3.get_object_tagging(Bucket=vbk.name, Key="k", VersionId=m)


def test_last_modified_never_goes_backwards_across_versions(vbk):
    put_versions(vbk, "k", 6)
    r = vbk.s3.list_object_versions(Bucket=vbk.name)["Versions"]
    stamps = [v["LastModified"] for v in r]            # newest first
    assert all(a >= b for a, b in zip(stamps, stamps[1:])), "LastModified must be non-increasing from newest to oldest: %r" % stamps


# ---------------------------------------------------------------------------------------------
# conditional writes, write-once and permissions interplay

def test_put_if_none_match_star_after_a_delete_marker_succeeds(vbk):
    """Spec 5.5: a latest delete marker counts as 'no visible object'."""
    vbk.put("k", b"1")
    with s3error("PreconditionFailed", 412):
        vbk.s3.put_object(Bucket=vbk.name, Key="k", Body=b"2", IfNoneMatch="*")
    vbk.delete("k")
    r = vbk.s3.put_object(Bucket=vbk.name, Key="k", Body=b"3", IfNoneMatch="*")
    assert r["VersionId"]
    assert vbk.read("k") == b"3"


def test_create_only_token_may_write_over_a_delete_marker(vbk):
    """Spec 4.4: a key whose latest version is a delete marker has no visible object, so create suffices."""
    c = vbk.token([{"actions": ["create", "read", "list"]}])
    c.put_object(Bucket=vbk.name, Key="k", Body=b"first")
    with s3error("AccessDenied", 403):
        c.put_object(Bucket=vbk.name, Key="k", Body=b"overwrite")
    vbk.delete("k")
    r = c.put_object(Bucket=vbk.name, Key="k", Body=b"after-marker")
    assert r["VersionId"]
    assert vbk.read("k") == b"after-marker"
    assert len(version_ids(vbk.s3, vbk.name, "k")) == 3


def test_delete_only_token_cannot_purge(vbk):
    """Spec 4.4: a delete with a version id needs purge, not delete."""
    vs = put_versions(vbk, "k", 2)
    c = vbk.token([{"actions": ["read", "list", "delete"]}])
    with s3error("AccessDenied", 403):
        c.delete_object(Bucket=vbk.name, Key="k", VersionId=vs[0]["vid"])
    assert c.delete_object(Bucket=vbk.name, Key="k")["DeleteMarker"] is True
    assert len(version_ids(vbk.s3, vbk.name, "k")) == 3


def test_purge_only_token_can_purge_but_cannot_add_markers(vbk):
    vs = put_versions(vbk, "k", 2)
    c = vbk.token([{"actions": ["read", "list", "purge"]}])
    with s3error("AccessDenied", 403):
        c.delete_object(Bucket=vbk.name, Key="k")
    r = c.delete_object(Bucket=vbk.name, Key="k", VersionId=vs[0]["vid"])
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 204
    assert version_ids(vbk.s3, vbk.name, "k") == [vs[1]["vid"]]


def test_delete_objects_judges_each_entry_like_the_single_delete(vbk):
    vs = put_versions(vbk, "k", 2)
    vbk.put("j", b"x")
    c = vbk.token([{"actions": ["read", "list", "delete"]}])
    r = c.delete_objects(Bucket=vbk.name, Delete={"Objects": [{"Key": "j"}, {"Key": "k", "VersionId": vs[0]["vid"]}]})
    assert [d["Key"] for d in r.get("Deleted", [])] == ["j"], r
    assert [(e["Key"], e["Code"]) for e in r["Errors"]] == [("k", "AccessDenied")], r["Errors"]
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200
    p = vbk.token([{"actions": ["read", "list", "purge"]}])
    r = p.delete_objects(Bucket=vbk.name, Delete={"Objects": [{"Key": "k", "VersionId": vs[0]["vid"]}, {"Key": "k"}]})
    assert [d["Key"] for d in r.get("Deleted", [])] == ["k"] and r["Deleted"][0]["VersionId"] == vs[0]["vid"]
    assert [(e["Key"], e["Code"]) for e in r["Errors"]] == [("k", "AccessDenied")]


def test_anonymous_requests_see_only_the_latest_version():
    b = fresh_bucket("anon", versioning="enabled", anonymous_read="objects")
    vs = put_versions(b, "k", 2)
    base = b.url("k")
    r = bvh.http_get(base)
    assert r.status == 200 and r.body == vs[1]["body"]
    r = bvh.http_get(base + "?versionId=" + vs[0]["vid"])
    assert r.status == 403 and r.code == "AccessDenied", "any versionId is AccessDenied for anonymous callers (spec 3.10): %r" % r
    r = bvh.http_get("%s/%s?versions" % (bvh.ENDPOINT, b.name))
    assert r.status == 403, "anonymous callers cannot list versions"


# ---------------------------------------------------------------------------------------------
# quota, counters, concurrency

def test_quota_counts_every_data_version():
    b = fresh_bucket("quota", versioning="enabled", quota_bytes=1_000_000)
    k = bvh.rnd(400_000)
    b.put("k", k)
    b.put("k", k)
    with s3error("QuotaExceeded", 403):
        b.put("k", k)                                  # an overwrite still adds a version: 1.2 MB > 1 MB
    vs = [v["VersionId"] for v in b.s3.list_object_versions(Bucket=b.name)["Versions"]]
    b.delete("k", VersionId=vs[-1])                    # purge the oldest: space is freed
    b.put("k", k)
    b.delete("k")                                      # a delete marker costs nothing
    assert len(markers_of(b.s3, b.name)) == 1


def test_bucket_counters_follow_versions_markers_and_purges():
    b = fresh_bucket("stats", versioning="enabled")

    def stats():
        return ADMIN.get_bucket(b.name)["stats"]

    a = [b.put("a", bytes(n)) for n in (100, 200, 300)]
    bb = [b.put("b", bytes(n)) for n in (400, 500)]
    s = stats()
    assert (s["objects"], s["versions"], s["bytes"]) == (2, 5, 1500), s
    assert s.get("delete_markers", 0) == 0
    m = b.delete("b")["VersionId"]
    s = stats()
    assert (s["objects"], s["versions"], s["bytes"], s.get("delete_markers")) == (1, 6, 1500, 1), s
    b.delete("b", VersionId=m)
    s = stats()
    assert (s["objects"], s["versions"], s["bytes"], s.get("delete_markers", 0)) == (2, 5, 1500, 0), s
    b.delete("a", VersionId=a[2]["VersionId"])          # the newest of a (300 bytes)
    s = stats()
    assert (s["objects"], s["versions"], s["bytes"]) == (2, 4, 1200), s
    for v in bb:
        b.delete("b", VersionId=v["VersionId"])
    s = stats()
    assert (s["objects"], s["versions"], s["bytes"]) == (1, 2, 300), s
    m = b.delete("a")["VersionId"]
    s = stats()
    assert (s["objects"], s["versions"], s["bytes"], s.get("delete_markers")) == (0, 3, 300, 1), s
    for vid in [m, a[0]["VersionId"], a[1]["VersionId"]]:
        b.delete("a", VersionId=vid)
    s = stats()
    assert (s["objects"], s["versions"], s["bytes"], s.get("delete_markers", 0)) == (0, 0, 0, 0), s


def test_concurrent_writers_to_one_key_produce_distinct_versions(vbk):
    n = 16
    bodies = [("writer-%02d-" % i).encode() * 50 for i in range(n)]

    def w(i):
        return lambda: vbk.s3.put_object(Bucket=vbk.name, Key="hot", Body=bodies[i])

    res = bvh.run_threads([w(i) for i in range(n)])
    errs = [r for r in res if isinstance(r, BaseException)]
    assert not errs, errs
    ids = [r["VersionId"] for r in res]
    assert len(set(ids)) == n, "every concurrent write is its own version"
    listed = version_ids(vbk.s3, vbk.name, "hot")
    assert sorted(listed) == sorted(ids), "all versions are listed exactly once"
    r = vbk.s3.list_object_versions(Bucket=vbk.name)["Versions"]
    assert [v["IsLatest"] for v in r].count(True) == 1 and r[0]["IsLatest"], "exactly the newest listed version is IsLatest"
    latest = vbk.get("hot")
    assert latest["VersionId"] == r[0]["VersionId"]
    for i, rr in enumerate(res):
        assert vbk.read("hot", VersionId=rr["VersionId"]) == bodies[i], "version %s lost its own content" % rr["VersionId"]


def test_concurrent_write_and_delete_keep_the_chain_consistent(vbk):
    vbk.put("hot", b"seed")

    def put(i):
        return lambda: vbk.s3.put_object(Bucket=vbk.name, Key="hot", Body=b"p%d" % i)

    def dele():
        return vbk.s3.delete_object(Bucket=vbk.name, Key="hot")

    res = bvh.run_threads([put(i) for i in range(8)] + [dele for _ in range(8)])
    assert not [r for r in res if isinstance(r, BaseException)], res
    r = vbk.s3.list_object_versions(Bucket=vbk.name)
    entries = [(v["VersionId"], v["IsLatest"]) for v in r.get("Versions", [])] + [(d["VersionId"], d["IsLatest"]) for d in r.get("DeleteMarkers", [])]
    assert [l for _, l in entries].count(True) == 1, "exactly one latest version after racing writes and deletes: %r" % entries
    assert len({v for v, _ in entries}) == len(entries)
    assert len(r["Versions"]) == 9
    # the key is visible iff the latest entry is a data version
    latest_is_data = any(v["IsLatest"] for v in r["Versions"])
    assert (vbk.keys() == ["hot"]) == latest_is_data


def test_version_listing_matches_a_long_history(vbk):
    ids = [v["vid"] for v in put_versions(vbk, "long", 120, size=8)]
    listed = version_ids(vbk.s3, vbk.name, "long")
    assert listed == list(reversed(ids)), "120 versions come back newest first, paged internally by 1000 per page"
    es, _, pages = all_versions(vbk.s3, vbk.name, page=50)
    assert pages == 3 and [e["VersionId"] for _, e in es] == list(reversed(ids))
