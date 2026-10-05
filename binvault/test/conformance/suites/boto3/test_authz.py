"""Bucket tokens: grants, key patterns, write-once, delete versus purge, token lifecycle (spec 4.3, 4.4, 6.4)."""
import re
import threading
import time

import pytest
from botocore.exceptions import ClientError

import bvh
import bvx_c as X
from bvh import ADMIN, FULL, MiB, make_client, s3error


def denied(status=403, code="AccessDenied"):
    return s3error(code, status)


# --------------------------------------------------------------------------------------------
# single actions

def test_read_only_token(bk):
    bk.put("a.txt", b"a", Tagging="k=v")
    c = bk.token([{"actions": ["read"]}])
    assert c.get_object(Bucket=bk.name, Key="a.txt")["Body"].read() == b"a"
    assert c.head_object(Bucket=bk.name, Key="a.txt")["ContentLength"] == 1
    assert c.get_object_tagging(Bucket=bk.name, Key="a.txt")["TagSet"] == [{"Key": "k", "Value": "v"}]
    assert "Owner" in c.get_object_acl(Bucket=bk.name, Key="a.txt")
    attrs = c.get_object_attributes(Bucket=bk.name, Key="a.txt", ObjectAttributes=["ETag", "ObjectSize"])
    assert attrs["ObjectSize"] == 1


@pytest.mark.parametrize("op", ["put", "delete", "put_tagging", "delete_tagging", "copy_dest", "list", "list_v1", "list_versions",
                                "list_uploads", "create_mpu", "put_acl", "list_parts", "abort_mpu"])
def test_read_only_token_cannot(bk, op):
    bk.put("a.txt", b"a")
    uid = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp")["UploadId"]
    c = bk.token([{"actions": ["read"]}])
    B = bk.name
    calls = {
        "put": lambda: c.put_object(Bucket=B, Key="new.txt", Body=b"x"),
        "delete": lambda: c.delete_object(Bucket=B, Key="a.txt"),
        "put_tagging": lambda: c.put_object_tagging(Bucket=B, Key="a.txt", Tagging={"TagSet": [{"Key": "a", "Value": "b"}]}),
        "delete_tagging": lambda: c.delete_object_tagging(Bucket=B, Key="a.txt"),
        "copy_dest": lambda: c.copy_object(Bucket=B, Key="b.txt", CopySource={"Bucket": B, "Key": "a.txt"}),
        "list": lambda: c.list_objects_v2(Bucket=B),
        "list_v1": lambda: c.list_objects(Bucket=B),
        "list_versions": lambda: c.list_object_versions(Bucket=B),
        "list_uploads": lambda: c.list_multipart_uploads(Bucket=B),
        "create_mpu": lambda: c.create_multipart_upload(Bucket=B, Key="m2"),
        "put_acl": lambda: c.put_object_acl(Bucket=B, Key="a.txt", ACL="private"),
        "list_parts": lambda: c.list_parts(Bucket=B, Key="mp", UploadId=uid),
        "abort_mpu": lambda: c.abort_multipart_upload(Bucket=B, Key="mp", UploadId=uid),
    }
    with denied():
        calls[op]()
    assert bk.read("a.txt") == b"a"
    with s3error("NoSuchKey"):
        bk.get("new.txt")


def test_list_only_token(bk):
    bk.put("a.txt", b"a")
    c = bk.token([{"actions": ["list"]}])
    assert [o["Key"] for o in c.list_objects_v2(Bucket=bk.name)["Contents"]] == ["a.txt"]
    assert [o["Key"] for o in c.list_objects(Bucket=bk.name)["Contents"]] == ["a.txt"]
    assert c.list_object_versions(Bucket=bk.name)["Versions"][0]["Key"] == "a.txt"
    c.list_multipart_uploads(Bucket=bk.name)
    with denied():
        c.get_object(Bucket=bk.name, Key="a.txt")
    with s3error(None, 403):
        c.head_object(Bucket=bk.name, Key="a.txt")
    with denied():
        c.get_object_tagging(Bucket=bk.name, Key="a.txt")
    with denied():
        c.put_object(Bucket=bk.name, Key="b", Body=b"x")


def test_write_token_implies_create_and_tag_and_nothing_else(bk):
    bk.put("a.txt", b"a")
    c = bk.token([{"actions": ["write"]}])
    c.put_object(Bucket=bk.name, Key="new.txt", Body=b"n")
    c.put_object(Bucket=bk.name, Key="a.txt", Body=b"overwritten")           # overwrite = write
    c.put_object(Bucket=bk.name, Key="tagged.txt", Body=b"t", Tagging="a=b")  # implies tag
    c.put_object_tagging(Bucket=bk.name, Key="a.txt", Tagging={"TagSet": [{"Key": "x", "Value": "y"}]})
    c.put_object_acl(Bucket=bk.name, Key="a.txt", ACL="private")
    X.mp_upload(c, bk.name, "mp.bin", [bvh.rnd(5 * MiB), b"tail"])
    assert bk.read("a.txt") == b"overwritten"
    for call in (
        lambda: c.get_object(Bucket=bk.name, Key="a.txt"),
        lambda: c.delete_object(Bucket=bk.name, Key="a.txt"),
        lambda: c.list_objects_v2(Bucket=bk.name),
        lambda: c.get_object_tagging(Bucket=bk.name, Key="a.txt"),
        lambda: c.copy_object(Bucket=bk.name, Key="copy", CopySource={"Bucket": bk.name, "Key": "a.txt"}),   # source needs read
    ):
        with denied():
            call()


def test_write_token_may_list_parts_and_abort(bk):
    c = bk.token([{"actions": ["write"]}])
    uid = c.create_multipart_upload(Bucket=bk.name, Key="mp")["UploadId"]
    c.upload_part(Bucket=bk.name, Key="mp", UploadId=uid, PartNumber=1, Body=b"x" * 10)
    assert len(c.list_parts(Bucket=bk.name, Key="mp", UploadId=uid)["Parts"]) == 1
    c.abort_multipart_upload(Bucket=bk.name, Key="mp", UploadId=uid)


def test_upload_part_copy_needs_read_on_the_source(bk):
    bk.put("src.bin", bvh.rnd(6 * MiB))
    w = bk.token([{"actions": ["write"]}])
    uid = w.create_multipart_upload(Bucket=bk.name, Key="dst")["UploadId"]
    with denied():
        w.upload_part_copy(Bucket=bk.name, Key="dst", UploadId=uid, PartNumber=1, CopySource={"Bucket": bk.name, "Key": "src.bin"})
    rw = bk.token([{"actions": ["read", "write"]}])
    uid = rw.create_multipart_upload(Bucket=bk.name, Key="dst2")["UploadId"]
    rw.upload_part_copy(Bucket=bk.name, Key="dst2", UploadId=uid, PartNumber=1, CopySource={"Bucket": bk.name, "Key": "src.bin"})


# --------------------------------------------------------------------------------------------
# write-once (`create` without `write`)

def test_create_only_can_add_keys_but_not_replace_them(bk):
    c = bk.token([{"actions": ["create", "read"]}])
    c.put_object(Bucket=bk.name, Key="once.txt", Body=b"first")
    with denied():
        c.put_object(Bucket=bk.name, Key="once.txt", Body=b"second")
    assert bk.read("once.txt") == b"first"
    c.put_object(Bucket=bk.name, Key="other.txt", Body=b"other")


def test_create_only_overwrite_refusal_names_the_rule(bk):
    c = bk.token([{"actions": ["create"]}])
    c.put_object(Bucket=bk.name, Key="once.txt", Body=b"first")
    with s3error("AccessDenied", 403, contains="create"):
        c.put_object(Bucket=bk.name, Key="once.txt", Body=b"second")


def test_create_only_if_none_match_star_on_a_new_key(bk):
    c = bk.token([{"actions": ["create"]}])
    c.put_object(Bucket=bk.name, Key="new.txt", Body=b"n", IfNoneMatch="*")
    r = X.sreq(bk.raw_creds_for(c) if hasattr(bk, "raw_creds_for") else (c.bv_token["access_key_id"], c.bv_token["secret_access_key"]),
               "PUT", "/%s/new.txt" % bk.name, body=b"again", headers={"If-None-Match": "*"})
    assert r.status in (403, 412), r          # refused either by the write-once rule or by the precondition
    assert bk.read("new.txt") == b"n"


def test_create_only_copy_onto_an_existing_key_is_refused(bk):
    bk.put("src", b"src")
    bk.put("dst", b"old")
    c = bk.token([{"actions": ["read", "create"]}])
    with denied():
        c.copy_object(Bucket=bk.name, Key="dst", CopySource={"Bucket": bk.name, "Key": "src"})
    assert bk.read("dst") == b"old"
    c.copy_object(Bucket=bk.name, Key="fresh", CopySource={"Bucket": bk.name, "Key": "src"})
    assert bk.read("fresh") == b"src"


def test_create_only_multipart_cannot_replace_an_existing_key(bk):
    bk.put("mp.bin", b"original")
    c = bk.token([{"actions": ["create", "read"]}])
    outcome = []
    try:
        uid = c.create_multipart_upload(Bucket=bk.name, Key="mp.bin")["UploadId"]
        outcome.append("create-ok")
        c.upload_part(Bucket=bk.name, Key="mp.bin", UploadId=uid, PartNumber=1, Body=b"z" * 100)
        outcome.append("part-ok")
        c.complete_multipart_upload(Bucket=bk.name, Key="mp.bin", UploadId=uid, MultipartUpload={"Parts": [{"ETag": '"x"', "PartNumber": 1}]})
        outcome.append("complete-ok")
    except ClientError as e:
        assert e.response["Error"]["Code"] in ("AccessDenied", "InvalidPart"), (outcome, e.response["Error"])
    assert "complete-ok" not in outcome
    assert bk.read("mp.bin") == b"original"


def test_create_only_create_multipart_upload_on_an_existing_key_is_denied(bk):
    # spec 4.4 lists CreateMultipartUpload, UploadPart and CompleteMultipartUpload under the write-once rule
    bk.put("mp.bin", b"original")
    c = bk.token([{"actions": ["create"]}])
    with denied():
        c.create_multipart_upload(Bucket=bk.name, Key="mp.bin")


def test_create_only_multipart_on_a_new_key_works_end_to_end(bk):
    c = bk.token([{"actions": ["create", "read"]}])
    parts = [bvh.rnd(5 * MiB), bvh.rnd(321)]
    X.mp_upload(c, bk.name, "new-mp.bin", parts)
    assert bk.read("new-mp.bin") == b"".join(parts)


def test_create_only_complete_is_refused_when_the_key_appeared_meanwhile(bk):
    c = bk.token([{"actions": ["create", "read"]}])
    uid = c.create_multipart_upload(Bucket=bk.name, Key="late.bin")["UploadId"]
    et = c.upload_part(Bucket=bk.name, Key="late.bin", UploadId=uid, PartNumber=1, Body=b"p" * 100)["ETag"]
    bk.put("late.bin", b"someone else was faster")          # the key now has a visible object
    with denied():
        c.complete_multipart_upload(Bucket=bk.name, Key="late.bin", UploadId=uid, MultipartUpload={"Parts": [{"ETag": et, "PartNumber": 1}]})
    assert bk.read("late.bin") == b"someone else was faster"


def test_create_only_abort_and_list_parts_are_not_restricted(bk):
    bk.put("mp.bin", b"original")
    full_uid = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp.bin")["UploadId"]    # opened by a write-capable token
    c = bk.token([{"actions": ["create"]}])
    assert c.list_parts(Bucket=bk.name, Key="mp.bin", UploadId=full_uid).get("Parts", []) == []   # no <Part> elements -> no key
    c.abort_multipart_upload(Bucket=bk.name, Key="mp.bin", UploadId=full_uid)


def test_create_only_race_has_exactly_one_winner(bk):
    c = bk.token([{"actions": ["create", "read"]}])
    n = 10
    bodies = [bvh.rnd(3 * MiB) for _ in range(n)]
    barrier = threading.Barrier(n)

    def put(i):
        barrier.wait()
        try:
            r = c.put_object(Bucket=bk.name, Key="race", Body=bodies[i])
            return ("ok", r["ETag"].strip('"'))
        except ClientError as e:
            return (e.response["Error"]["Code"], None)

    res = bvh.run_threads([lambda i=i: put(i) for i in range(n)])
    codes = [r[0] for r in res]
    assert codes.count("ok") == 1, codes
    assert codes.count("AccessDenied") == n - 1, codes
    winner = next(r[1] for r in res if r[0] == "ok")
    assert bvh.md5hex(bk.read("race")) == winner


def test_create_only_may_write_over_a_delete_marker(vbk):
    vbk.put("k", b"v1")
    vbk.delete("k")                                   # latest version is now a delete marker
    c = vbk.token([{"actions": ["create", "read"]}])
    r = c.put_object(Bucket=vbk.name, Key="k", Body=b"v2", IfNoneMatch="*")
    assert r["VersionId"]
    assert vbk.read("k") == b"v2"
    with denied():                                    # now there is a visible object again
        c.put_object(Bucket=vbk.name, Key="k", Body=b"v3")


# --------------------------------------------------------------------------------------------
# tag

def test_create_without_tag_cannot_attach_tags(bk):
    c = bk.token([{"actions": ["create"]}])
    with denied():
        c.put_object(Bucket=bk.name, Key="t.txt", Body=b"x", Tagging="a=b")
    c.put_object(Bucket=bk.name, Key="plain.txt", Body=b"x")
    with denied():
        c.create_multipart_upload(Bucket=bk.name, Key="mp", Tagging="a=b")


def test_create_plus_tag_can_attach_tags(bk):
    c = bk.token([{"actions": ["create", "tag"]}])
    c.put_object(Bucket=bk.name, Key="t.txt", Body=b"x", Tagging="a=b")
    got = bk.s3.get_object_tagging(Bucket=bk.name, Key="t.txt")["TagSet"]
    assert got == [{"Key": "a", "Value": "b"}]
    uid = c.create_multipart_upload(Bucket=bk.name, Key="mp", Tagging="c=d")["UploadId"]
    c.abort_multipart_upload(Bucket=bk.name, Key="mp", UploadId=uid)


def test_tag_only_token_edits_tags_of_existing_objects(bk):
    bk.put("a.txt", b"a")
    c = bk.token([{"actions": ["tag"]}])
    c.put_object_tagging(Bucket=bk.name, Key="a.txt", Tagging={"TagSet": [{"Key": "x", "Value": "y"}]})
    assert bk.s3.get_object_tagging(Bucket=bk.name, Key="a.txt")["TagSet"] == [{"Key": "x", "Value": "y"}]
    c.delete_object_tagging(Bucket=bk.name, Key="a.txt")
    with denied():
        c.get_object_tagging(Bucket=bk.name, Key="a.txt")          # reading tags is `read`
    with denied():
        c.put_object(Bucket=bk.name, Key="n", Body=b"x")


def test_copy_with_replaced_tags_needs_tag(bk):
    bk.put("src", b"s")
    c = bk.token([{"actions": ["read", "create"]}])
    with denied():
        c.copy_object(Bucket=bk.name, Key="dst", CopySource={"Bucket": bk.name, "Key": "src"},
                      TaggingDirective="REPLACE", Tagging="a=b")
    ct = bk.token([{"actions": ["read", "create", "tag"]}])
    ct.copy_object(Bucket=bk.name, Key="dst", CopySource={"Bucket": bk.name, "Key": "src"}, TaggingDirective="REPLACE", Tagging="a=b")
    assert bk.s3.get_object_tagging(Bucket=bk.name, Key="dst")["TagSet"] == [{"Key": "a", "Value": "b"}]


# --------------------------------------------------------------------------------------------
# delete versus purge

def test_delete_only_token_in_a_versioned_bucket_adds_markers_only(vbk):
    v1 = vbk.put("k", b"one")["VersionId"]
    c = vbk.token([{"actions": ["delete"]}])
    r = c.delete_object(Bucket=vbk.name, Key="k")
    assert r["DeleteMarker"] is True and r["VersionId"]
    with denied():
        c.delete_object(Bucket=vbk.name, Key="k", VersionId=v1)
    assert vbk.s3.get_object(Bucket=vbk.name, Key="k", VersionId=v1)["Body"].read() == b"one"


def test_purge_only_token_removes_versions_but_cannot_add_markers(vbk):
    v1 = vbk.put("k", b"one")["VersionId"]
    c = vbk.token([{"actions": ["purge"]}])
    with denied():
        c.delete_object(Bucket=vbk.name, Key="k")
    c.delete_object(Bucket=vbk.name, Key="k", VersionId=v1)
    with s3error("NoSuchKey"):
        vbk.get("k")
    assert "Versions" not in vbk.s3.list_object_versions(Bucket=vbk.name)


def test_delete_objects_entries_are_judged_one_by_one(vbk):
    v1 = vbk.put("a", b"1")["VersionId"]
    v2 = vbk.put("b", b"2")["VersionId"]
    c = vbk.token([{"actions": ["delete"]}])
    r = c.delete_objects(Bucket=vbk.name, Delete={"Objects": [{"Key": "a"}, {"Key": "b", "VersionId": v2}]})
    assert [d["Key"] for d in r.get("Deleted", [])] == ["a"], r
    assert r["Deleted"][0].get("DeleteMarker") is True
    assert [(e["Key"], e["Code"]) for e in r["Errors"]] == [("b", "AccessDenied")], r
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200
    assert vbk.s3.get_object(Bucket=vbk.name, Key="b", VersionId=v2)["Body"].read() == b"2"
    # and the mirror image
    p = vbk.token([{"actions": ["purge"]}])
    r = p.delete_objects(Bucket=vbk.name, Delete={"Objects": [{"Key": "b"}, {"Key": "a", "VersionId": v1}]})
    assert [e["Key"] for e in r["Errors"]] == ["b"] and r["Errors"][0]["Code"] == "AccessDenied", r
    assert [d["Key"] for d in r["Deleted"]] == ["a"], r


def test_unversioned_bucket_version_id_null_needs_only_delete(bk):
    bk.put("k", b"v")
    c = bk.token([{"actions": ["delete"]}])
    c.delete_object(Bucket=bk.name, Key="k", VersionId="null")       # counts as no version id at all
    with s3error("NoSuchKey"):
        bk.get("k")
    bk.put("k2", b"v")
    r = c.delete_objects(Bucket=bk.name, Delete={"Objects": [{"Key": "k2", "VersionId": "null"}]})
    assert [d["Key"] for d in r["Deleted"]] == ["k2"] and "Errors" not in r, r


def test_unversioned_bucket_purge_only_token_cannot_delete(bk):
    bk.put("k", b"v")
    c = bk.token([{"actions": ["purge"]}])
    with denied():
        c.delete_object(Bucket=bk.name, Key="k")
    with denied():
        c.delete_object(Bucket=bk.name, Key="k", VersionId="null")
    assert bk.read("k") == b"v"


def test_delete_of_a_missing_key_is_204_with_the_delete_grant(bk):
    c = bk.token([{"actions": ["delete"]}])
    assert c.delete_object(Bucket=bk.name, Key="never-existed")["ResponseMetadata"]["HTTPStatusCode"] == 204


# --------------------------------------------------------------------------------------------
# key patterns

def test_prefix_pattern(bk):
    bk.put("users/43/secret.txt", b"s")
    c = bk.token([{"actions": ["read", "write", "delete"], "keys": ["users/42/*"]}])
    c.put_object(Bucket=bk.name, Key="users/42/a.txt", Body=b"a")
    c.put_object(Bucket=bk.name, Key="users/42/deep/er/b.txt", Body=b"b")
    c.put_object(Bucket=bk.name, Key="users/42/", Body=b"")
    assert c.get_object(Bucket=bk.name, Key="users/42/a.txt")["Body"].read() == b"a"
    for key in ("users/43/a.txt", "users/42", "users/4", "users/420/a.txt", "other.txt", "Users/42/a.txt"):
        with denied():
            c.put_object(Bucket=bk.name, Key=key, Body=b"x")
    with denied():
        c.get_object(Bucket=bk.name, Key="users/43/secret.txt")
    with denied():
        c.delete_object(Bucket=bk.name, Key="users/43/secret.txt")
    c.delete_object(Bucket=bk.name, Key="users/42/a.txt")
    assert bk.read("users/43/secret.txt") == b"s"


def test_exact_key_pattern(bk):
    c = bk.token([{"actions": ["read", "write"], "keys": ["config.json"]}])
    c.put_object(Bucket=bk.name, Key="config.json", Body=b"{}")
    for key in ("config.json2", "config.json/x", "Config.json", "x/config.json", "config.jso"):
        with denied():
            c.put_object(Bucket=bk.name, Key=key, Body=b"x")


def test_escaped_star_and_backslash_in_patterns(bk):
    c = bk.token([{"actions": ["write"], "keys": [r"a\*b", r"c\\d", r"e\*f*"]}])
    for key in ("a*b", "c\\d", "e*f", "e*f/anything"):
        c.put_object(Bucket=bk.name, Key=key, Body=b"x")
    for key in ("aXb", "a\\*b", "c\\\\d", "cXd", "eXf", "e*", "a*bc"):
        with denied():
            c.put_object(Bucket=bk.name, Key=key, Body=b"x")


def test_single_star_pattern_matches_every_key(bk):
    c = bk.token([{"actions": ["write", "read"], "keys": ["*"]}])
    for key in ("a", "x/y/z", "ключ", "/lead"):
        c.put_object(Bucket=bk.name, Key=key, Body=b"x")
        assert c.get_object(Bucket=bk.name, Key=key)["Body"].read() == b"x"


def test_grants_are_a_union(bk):
    bk.put("pub/a", b"a")
    bk.put("inbox/b", b"b")
    c = bk.token([{"actions": ["read"], "keys": ["pub/*"]}, {"actions": ["write"], "keys": ["inbox/*"]}])
    assert c.get_object(Bucket=bk.name, Key="pub/a")["Body"].read() == b"a"
    c.put_object(Bucket=bk.name, Key="inbox/new", Body=b"n")
    with denied():
        c.get_object(Bucket=bk.name, Key="inbox/b")           # write does not imply read
    with denied():
        c.put_object(Bucket=bk.name, Key="pub/new", Body=b"n")


def test_a_grant_without_keys_covers_every_key_next_to_a_restricted_one(bk):
    bk.put("anything", b"x")
    c = bk.token([{"actions": ["read"]}, {"actions": ["write"], "keys": ["a/*"]}])
    assert c.get_object(Bucket=bk.name, Key="anything")["Body"].read() == b"x"
    c.put_object(Bucket=bk.name, Key="a/ok", Body=b"1")
    with denied():
        c.put_object(Bucket=bk.name, Key="b/no", Body=b"1")


def test_copy_needs_read_on_the_source_pattern_and_write_on_the_destination_pattern(bk):
    bk.put("pub/x", b"x")
    bk.put("secret/x", b"secret")
    c = bk.token([{"actions": ["read"], "keys": ["pub/*"]}, {"actions": ["write"], "keys": ["inbox/*"]}])
    B = bk.name
    c.copy_object(Bucket=B, Key="inbox/x", CopySource={"Bucket": B, "Key": "pub/x"})
    assert bk.read("inbox/x") == b"x"
    with denied():
        c.copy_object(Bucket=B, Key="pub/y", CopySource={"Bucket": B, "Key": "pub/x"})            # no write on pub/
    with denied():
        c.copy_object(Bucket=B, Key="inbox/z", CopySource={"Bucket": B, "Key": "secret/x"})        # no read on secret/
    with denied():
        c.copy_object(Bucket=B, Key="pub/z", CopySource={"Bucket": B, "Key": "inbox/x"})


def test_list_needs_a_prefix_inside_the_granted_pattern(bk):
    for k in ("users/42/a", "users/42/sub/b", "users/43/c", "other"):
        bk.put(k, b"x")
    c = bk.token([{"actions": ["list"], "keys": ["users/42/*"]}])
    B = bk.name
    assert [o["Key"] for o in c.list_objects_v2(Bucket=B, Prefix="users/42/")["Contents"]] == ["users/42/a", "users/42/sub/b"]
    assert [o["Key"] for o in c.list_objects_v2(Bucket=B, Prefix="users/42/sub")["Contents"]] == ["users/42/sub/b"]
    for prefix in (None, "", "users/", "users/4", "users/43/", "other", "users/42"):
        kw = {} if prefix is None else {"Prefix": prefix}
        with denied():
            c.list_objects_v2(Bucket=B, **kw)
    with denied():
        c.list_objects(Bucket=B, Prefix="users/")
    with denied():
        c.list_object_versions(Bucket=B, Prefix="users/")
    with denied():
        c.list_multipart_uploads(Bucket=B, Prefix="users/")


def test_list_with_delimiter_inside_the_pattern(bk):
    for k in ("users/42/a", "users/42/sub/b", "users/43/c"):
        bk.put(k, b"x")
    c = bk.token([{"actions": ["list"], "keys": ["users/42/*"]}])
    r = c.list_objects_v2(Bucket=bk.name, Prefix="users/42/", Delimiter="/")
    assert [o["Key"] for o in r["Contents"]] == ["users/42/a"]
    assert [p["Prefix"] for p in r["CommonPrefixes"]] == ["users/42/sub/"]


def test_list_results_are_filtered_to_the_keys_the_pattern_covers(bk):
    for k in ("docs/readme.txt", "docs/readme.txt.bak", "docs/readme.txt/inner"):
        bk.put(k, b"x")
    c = bk.token([{"actions": ["list"], "keys": ["docs/readme.txt"]}])
    r = c.list_objects_v2(Bucket=bk.name, Prefix="docs/readme.txt")
    assert [o["Key"] for o in r.get("Contents", [])] == ["docs/readme.txt"], r
    r = c.list_objects(Bucket=bk.name, Prefix="docs/readme.txt")
    assert [o["Key"] for o in r.get("Contents", [])] == ["docs/readme.txt"], r


def test_list_with_delimiter_does_not_reveal_unpermitted_prefixes(bk):
    for k in ("docs/readme.txt", "docs/readme.txt/inner"):
        bk.put(k, b"x")
    c = bk.token([{"actions": ["list"], "keys": ["docs/readme.txt"]}])
    r = c.list_objects_v2(Bucket=bk.name, Prefix="docs/readme.txt", Delimiter="/")
    assert "CommonPrefixes" not in r, "a common prefix covering only forbidden keys leaks their existence: %r" % r.get("CommonPrefixes")
    assert [o["Key"] for o in r.get("Contents", [])] == ["docs/readme.txt"]


def test_listing_pages_of_a_filtered_listing_are_consistent(bk):
    for i in range(7):
        bk.put("docs/f.txt.%d" % i, b"x")
    bk.put("docs/f.txt", b"x")
    c = bk.token([{"actions": ["list"], "keys": ["docs/f.txt"]}])
    seen = []
    token = None
    for _ in range(20):
        kw = {"Bucket": bk.name, "Prefix": "docs/f.txt", "MaxKeys": 2}
        if token:
            kw["ContinuationToken"] = token
        r = c.list_objects_v2(**kw)
        seen += [o["Key"] for o in r.get("Contents", [])]
        if not r["IsTruncated"]:
            break
        token = r["NextContinuationToken"]
    else:
        pytest.fail("listing did not terminate")
    assert seen == ["docs/f.txt"], seen


def test_delete_objects_with_patterns(bk):
    bk.put("users/42/a", b"a")
    bk.put("users/43/b", b"b")
    c = bk.token([{"actions": ["delete"], "keys": ["users/42/*"]}])
    r = c.delete_objects(Bucket=bk.name, Delete={"Objects": [{"Key": "users/42/a"}, {"Key": "users/43/b"}]})
    assert [d["Key"] for d in r["Deleted"]] == ["users/42/a"], r
    assert [(e["Key"], e["Code"]) for e in r["Errors"]] == [("users/43/b", "AccessDenied")], r
    assert bk.read("users/43/b") == b"b"
    with s3error("NoSuchKey"):
        bk.get("users/42/a")


def test_pipeline_style_templates_are_not_accepted_in_bucket_token_patterns(bk):
    # `{key}` style variables exist only for pipeline grants (spec 4.4/7.8); in a bucket token they are literal text
    c = bk.token([{"actions": ["write"], "keys": ["{key}"]}])
    with denied():
        c.put_object(Bucket=bk.name, Key="anything", Body=b"x")


# --------------------------------------------------------------------------------------------
# bucket-level calls need any one action

@pytest.mark.parametrize("action", ["read", "list", "create", "write", "tag", "delete", "purge"])
def test_bucket_level_calls_accept_any_single_action(bk, action):
    c = bk.token([{"actions": [action]}])
    B = bk.name
    c.head_bucket(Bucket=B)
    assert c.get_bucket_location(Bucket=B)["ResponseMetadata"]["HTTPStatusCode"] == 200
    assert [b["Name"] for b in c.list_buckets()["Buckets"]] == [B]
    c.get_bucket_versioning(Bucket=B)
    c.get_bucket_acl(Bucket=B)
    with s3error("NoSuchCORSConfiguration", 404):
        c.get_bucket_cors(Bucket=B)
    with s3error("NoSuchLifecycleConfiguration", 404):
        c.get_bucket_lifecycle_configuration(Bucket=B)
    c.put_bucket_acl(Bucket=B, ACL="private")
    assert c.create_bucket(Bucket=B)["ResponseMetadata"]["HTTPStatusCode"] == 200


def test_bucket_level_calls_with_a_path_restricted_token(bk):
    c = bk.token([{"actions": ["read"], "keys": ["only/this/*"]}])
    c.head_bucket(Bucket=bk.name)
    assert [b["Name"] for b in c.list_buckets()["Buckets"]] == [bk.name]


def test_list_buckets_shows_only_the_token_bucket(bk):
    other = bvh.fresh_bucket("other")
    r = bk.s3.list_buckets()
    assert [b["Name"] for b in r["Buckets"]] == [bk.name]
    assert r["Buckets"][0]["CreationDate"]
    assert r["Owner"]["ID"] and r["Owner"]["DisplayName"]
    assert [b["Name"] for b in other.s3.list_buckets()["Buckets"]] == [other.name]


def test_create_bucket_for_the_own_bucket_is_ok_and_changes_nothing(bk):
    bk.put("keep", b"k")
    assert bk.s3.create_bucket(Bucket=bk.name)["ResponseMetadata"]["HTTPStatusCode"] == 200
    assert bk.read("keep") == b"k"


def test_create_bucket_for_any_other_name_is_access_denied(bk):
    other = bvh.fresh_bucket("other")
    with denied():
        bk.s3.create_bucket(Bucket=other.name)           # exists, belongs to someone else
    with denied():
        bk.s3.create_bucket(Bucket="bvt-brand-new-%s" % bvh.uuid.uuid4().hex[:8])      # does not exist (spec 5.2: "anything else -> AccessDenied")


def test_delete_bucket_is_access_denied(bk):
    bk.put("keep", b"k")
    with denied():
        bk.s3.delete_bucket(Bucket=bk.name)
    assert bk.read("keep") == b"k"


@pytest.mark.parametrize("call", ["versioning", "lifecycle", "encryption", "cors", "delete_lifecycle", "delete_cors", "delete_encryption"])
def test_admin_managed_bucket_configuration_cannot_be_changed_over_s3(bk, call):
    B, c = bk.name, bk.s3
    calls = {
        "versioning": lambda: c.put_bucket_versioning(Bucket=B, VersioningConfiguration={"Status": "Enabled"}),
        "lifecycle": lambda: c.put_bucket_lifecycle_configuration(Bucket=B, LifecycleConfiguration={"Rules": [
            {"ID": "r", "Status": "Enabled", "Filter": {"Prefix": ""}, "Expiration": {"Days": 1}}]}),
        "encryption": lambda: c.put_bucket_encryption(Bucket=B, ServerSideEncryptionConfiguration={"Rules": [
            {"ApplyServerSideEncryptionByDefault": {"SSEAlgorithm": "AES256"}}]}),
        "cors": lambda: c.put_bucket_cors(Bucket=B, CORSConfiguration={"CORSRules": [
            {"AllowedOrigins": ["*"], "AllowedMethods": ["GET"]}]}),
        "delete_lifecycle": lambda: c.delete_bucket_lifecycle(Bucket=B),
        "delete_cors": lambda: c.delete_bucket_cors(Bucket=B),
        "delete_encryption": lambda: c.delete_bucket_encryption(Bucket=B),
    }
    with denied():
        calls[call]()
    assert bvh.ADMIN.get_bucket(B)["versioning"] == "off"


# --------------------------------------------------------------------------------------------
# cross-bucket and foreign credentials

def test_token_of_another_bucket_is_access_denied_everywhere(bk):
    other = bvh.fresh_bucket("other")
    other.put("x", b"theirs")
    mine = bk.s3
    B = other.name
    with denied():
        mine.get_object(Bucket=B, Key="x")
    with denied():
        mine.put_object(Bucket=B, Key="y", Body=b"z")
    with denied():
        mine.list_objects_v2(Bucket=B)
    with denied():
        mine.delete_object(Bucket=B, Key="x")
    with s3error(None, 403):
        mine.head_bucket(Bucket=B)
    with denied():
        mine.copy_object(Bucket=bk.name, Key="stolen", CopySource={"Bucket": B, "Key": "x"})
    assert other.read("x") == b"theirs"


def test_missing_bucket_is_no_such_bucket(bk):
    with s3error("NoSuchBucket", 404):
        bk.s3.list_objects_v2(Bucket="bvt-does-not-exist-%s" % bvh.uuid.uuid4().hex[:8])


def test_admin_token_is_not_an_s3_credential_as_sigv4_access_key(bk):
    c = make_client(bvh.ADMIN_TOKEN, bvh.ADMIN_TOKEN)
    with s3error("InvalidAccessKeyId", 403) as h:
        c.list_objects_v2(Bucket=bk.name)
    unknown = make_client("BVKAAAAAAAAAAAAAAAAA", "x" * 40)
    with s3error("InvalidAccessKeyId", 403) as h2:
        unknown.list_objects_v2(Bucket=bk.name)
    m1 = h.error.response["Error"]["Message"]
    m2 = h2.error.response["Error"]["Message"]
    assert m1 == m2, "the admin token must be rejected exactly like an unknown key (no hint): %r vs %r" % (m1, m2)


@pytest.mark.parametrize("form", ["plain", "with-dot", "admin-as-id-and-secret"])
def test_admin_token_as_bearer_is_rejected_like_any_invalid_credential(bk, form):
    tok = {"plain": bvh.ADMIN_TOKEN, "with-dot": bvh.ADMIN_TOKEN + ".secretpart",
           "admin-as-id-and-secret": bvh.ADMIN_TOKEN + "." + bvh.ADMIN_TOKEN}[form]
    r = bvh.http_raw("GET", bvh.HOSTPORT, "/%s?list-type=2" % bk.name, headers={"Authorization": "Bearer " + tok})
    X.check_error(r, 403, "InvalidAccessKeyId")
    assert "admin" not in r.text.lower().replace("administrat", ""), "no hint that this is the admin token: " + r.text


def test_bucket_token_as_bearer_is_access_denied_with_a_hint(bk):
    r = bvh.http_raw("GET", bvh.HOSTPORT, "/%s?list-type=2" % bk.name, headers={"Authorization": "Bearer %s.%s" % (bk.ak, bk.sk)})
    X.check_error(r, 403, "AccessDenied", message_contains="sigv4")
    assert bk.sk not in r.text


def test_unknown_pipeline_style_bearer_is_invalid_access_key(bk):
    r = bvh.http_raw("GET", bvh.HOSTPORT, "/%s?list-type=2" % bk.name, headers={"Authorization": "Bearer BVPAAAAAAAAAAAAAAAAA.secretsecret"})
    X.check_error(r, 403, "InvalidAccessKeyId")


def test_unknown_access_key_via_sigv4(bk):
    c = make_client("BVKZZZZZZZZZZZZZZZZZ", "s" * 40)
    with s3error("InvalidAccessKeyId", 403):
        c.get_object(Bucket=bk.name, Key="x")


def test_wrong_secret_via_sigv4(bk):
    c = make_client(bk.ak, "s" * 40)
    with s3error("SignatureDoesNotMatch", 403):
        c.get_object(Bucket=bk.name, Key="x")


# --------------------------------------------------------------------------------------------
# token lifecycle

def test_grant_changes_apply_to_the_very_next_request(bk):
    bk.put("a.txt", b"a")
    t = bk.token_info([{"actions": ["read"]}])
    c = make_client(t["access_key_id"], t["secret_access_key"])
    with denied():
        c.put_object(Bucket=bk.name, Key="n", Body=b"1")
    ADMIN.patch_token(bk.name, t["access_key_id"], grants=[{"actions": ["read", "write"]}])
    c.put_object(Bucket=bk.name, Key="n", Body=b"1")
    ADMIN.patch_token(bk.name, t["access_key_id"], grants=[{"actions": ["read"]}])
    with denied():
        c.put_object(Bucket=bk.name, Key="n2", Body=b"1")
    assert c.get_object(Bucket=bk.name, Key="a.txt")["Body"].read() == b"a"


def test_revoked_token_fails_at_once(bk):
    t = bk.token_info([{"actions": FULL}])
    c = make_client(t["access_key_id"], t["secret_access_key"])
    c.put_object(Bucket=bk.name, Key="k", Body=b"1")
    ADMIN.delete_token(bk.name, t["access_key_id"])
    with s3error("InvalidAccessKeyId", 403):
        c.get_object(Bucket=bk.name, Key="k")
    with s3error("InvalidAccessKeyId", 403):
        c.put_object(Bucket=bk.name, Key="k2", Body=b"1")


def test_token_expiry(bk):
    t = bk.token_info([{"actions": FULL}], expires_at=X.rfc3339(X.ahead(seconds=3)))
    c = make_client(t["access_key_id"], t["secret_access_key"])
    c.put_object(Bucket=bk.name, Key="k", Body=b"1")
    time.sleep(3.6)
    with s3error("InvalidAccessKeyId", 403):
        c.get_object(Bucket=bk.name, Key="k")


def test_token_expiry_can_be_extended_with_patch(bk):
    t = bk.token_info([{"actions": FULL}], expires_at=X.rfc3339(X.ahead(seconds=3)))
    c = make_client(t["access_key_id"], t["secret_access_key"])
    c.put_object(Bucket=bk.name, Key="k", Body=b"1")
    ADMIN.patch_token(bk.name, t["access_key_id"], expires_at=X.rfc3339(X.ahead(hours=1)))
    time.sleep(3.6)
    assert c.get_object(Bucket=bk.name, Key="k")["Body"].read() == b"1"


def test_deleted_bucket_kills_its_tokens(bk):
    t = bk.token_info([{"actions": FULL}])
    c = make_client(t["access_key_id"], t["secret_access_key"])
    c.put_object(Bucket=bk.name, Key="k", Body=b"1")
    ADMIN.delete_bucket(bk.name, force=True)
    with s3error(None, None) as h:
        c.get_object(Bucket=bk.name, Key="k")
    assert h.error.response["Error"]["Code"] in ("NoSuchBucket", "InvalidAccessKeyId")


# --------------------------------------------------------------------------------------------
# token administration (spec 4.3, 6.4)

BAD_GRANTS = [
    pytest.param([], id="no-grants"),
    pytest.param([{"actions": []}], id="empty-actions"),
    pytest.param([{"actions": ["read"], "keys": []}], id="empty-keys"),
    pytest.param([{"actions": ["admin"]}], id="unknown-action"),
    pytest.param([{"actions": ["READ"]}], id="uppercase-action"),
    pytest.param([{"actions": ["read"], "keys": ["a*b"]}], id="star-in-the-middle"),
    pytest.param([{"actions": ["read"], "keys": ["a**"]}], id="double-star"),
    pytest.param([{"actions": ["read"], "keys": [""]}], id="empty-pattern"),
    pytest.param([{"keys": ["x"]}], id="no-actions-field"),
    pytest.param([{"actions": ["read"], "extra": 1}], id="unknown-field-in-grant"),
    pytest.param("read", id="grants-not-a-list"),
]


@pytest.mark.parametrize("grants", BAD_GRANTS)
def test_invalid_grants_are_rejected_by_the_admin_api(bk, grants):
    with X.raises_admin(400, "invalid_request"):
        ADMIN.call("POST", "/buckets/%s/tokens" % bk.name, {"name": "t", "grants": grants})


def test_token_needs_a_name_and_rejects_unknown_fields(bk):
    with X.raises_admin(400, "invalid_request"):
        ADMIN.call("POST", "/buckets/%s/tokens" % bk.name, {"grants": [{"actions": ["read"]}]})
    with X.raises_admin(400, "invalid_request"):
        ADMIN.call("POST", "/buckets/%s/tokens" % bk.name, {"name": "t", "grants": [{"actions": ["read"]}], "typo": 1})


def test_token_expiry_in_the_past_is_rejected(bk):
    with X.raises_admin(400, "invalid_request"):
        ADMIN.create_token(bk.name, [{"actions": ["read"]}], expires_at=X.rfc3339(X.ago(hours=1)))


def test_token_for_a_missing_bucket_is_404(bk):
    with X.raises_admin(404, "not_found"):
        ADMIN.create_token("bvt-no-such-bucket-%s" % bvh.uuid.uuid4().hex[:8], [{"actions": ["read"]}])


def test_token_shape_and_secret_shown_once(bk):
    t = ADMIN.create_token(bk.name, [{"actions": ["read"]}], name="shape")
    assert re.fullmatch(r"BVK[A-Z2-7]{17}", t["access_key_id"]), t["access_key_id"]
    assert re.fullmatch(r"[A-Za-z0-9]{40}", t["secret_access_key"]), t["secret_access_key"]
    for view in (ADMIN.list_tokens(bk.name), ADMIN.call("GET", "/buckets/%s/tokens/%s" % (bk.name, t["access_key_id"]))[1]):
        assert t["secret_access_key"] not in str(view), "the secret must be shown once, at creation"
        assert "secret" not in str(view).lower()
    listed = [x for x in ADMIN.list_tokens(bk.name)["items"] if x["access_key_id"] == t["access_key_id"]][0]
    assert listed["name"] == "shape" and listed["grants"] == [{"actions": ["read"]}] and listed["created_at"]


def test_patch_token_validates_and_keeps_unrelated_fields(bk):
    t = ADMIN.create_token(bk.name, [{"actions": ["read"]}], name="orig", limits={"requests_per_second": 50})
    with X.raises_admin(400, "invalid_request"):
        ADMIN.patch_token(bk.name, t["access_key_id"], grants=[{"actions": ["bogus"]}])
    with X.raises_admin(400, "invalid_request"):
        ADMIN.patch_token(bk.name, t["access_key_id"], secret_access_key="mine")
    got = ADMIN.patch_token(bk.name, t["access_key_id"], name="renamed")
    assert got["name"] == "renamed" and got["grants"] == [{"actions": ["read"]}] and got["limits"]["requests_per_second"] == 50
    # an old secret keeps working after an edit
    c = make_client(t["access_key_id"], t["secret_access_key"])
    c.list_objects_v2(Bucket=bk.name) if False else c.head_bucket(Bucket=bk.name)


def test_patch_with_a_stale_revision_is_412(bk):
    t = ADMIN.create_token(bk.name, [{"actions": ["read"]}])
    rev = t["revision"]
    ADMIN.patch_token(bk.name, t["access_key_id"], name="one")
    with X.raises_admin(412, "precondition_failed"):
        ADMIN.call("PATCH", "/buckets/%s/tokens/%s" % (bk.name, t["access_key_id"]), {"name": "two"}, headers={"If-Match": '"%s"' % rev})


def test_deleting_a_token_twice_is_404(bk):
    t = ADMIN.create_token(bk.name, [{"actions": ["read"]}])
    ADMIN.delete_token(bk.name, t["access_key_id"])
    with X.raises_admin(404, "not_found"):
        ADMIN.delete_token(bk.name, t["access_key_id"])


def test_token_cannot_be_managed_through_another_bucket(bk):
    other = bvh.fresh_bucket("other")
    t = ADMIN.create_token(bk.name, [{"actions": ["read"]}])
    with X.raises_admin(404, "not_found"):
        ADMIN.delete_token(other.name, t["access_key_id"])
    with X.raises_admin(404, "not_found"):
        ADMIN.patch_token(other.name, t["access_key_id"], name="x")


def test_last_used_at_is_recorded_within_a_minute(bk):
    import os
    if os.environ.get("BV_SLOW", "1") in ("", "0", "no", "false"):
        pytest.skip("slow (~50 s); unset BV_SLOW or set it to 1 to run")
    t = ADMIN.create_token(bk.name, [{"actions": FULL}])
    c = make_client(t["access_key_id"], t["secret_access_key"])
    c.head_bucket(Bucket=bk.name)
    deadline = time.time() + 75
    while time.time() < deadline:
        got = [x for x in ADMIN.list_tokens(bk.name)["items"] if x["access_key_id"] == t["access_key_id"]][0]
        if got.get("last_used_at"):
            return
        time.sleep(3)
    pytest.fail("last_used_at was not set within 75 s of the first use (spec 4.3: updated at most once a minute)")
