"""GetObjectAttributes (spec 5.4.7) and the tagging operations (spec 5.7)."""
import datetime

import pytest

import bvh
import bvx_b as X
from bvh import KiB, MiB, hdr, md5hex, multipart_etag, rnd, s3error, uniq
from bvx_a import raw_get, raw_head, raw_put, raw_req

MIN = 5 * MiB
ALL = ["ETag", "Checksum", "ObjectParts", "StorageClass", "ObjectSize"]


def attrs(bk, key, which=ALL, **kw):
    return bk.s3.get_object_attributes(Bucket=bk.name, Key=key, ObjectAttributes=which, **kw)


def mpu(bk, key, parts, alg=None, **kw):
    args = dict(Bucket=bk.name, Key=key)
    if alg:
        args["ChecksumAlgorithm"] = alg
    uid = bk.s3.create_multipart_upload(**args, **kw)["UploadId"]
    done = []
    for i, p in enumerate(parts, 1):
        extra = {"ChecksumAlgorithm": alg} if alg else {}
        r = bk.s3.upload_part(Bucket=bk.name, Key=key, UploadId=uid, PartNumber=i, Body=p, **extra)
        e = {"PartNumber": i, "ETag": r["ETag"]}
        if alg:
            e["Checksum" + alg] = r["Checksum" + alg]
        done.append(e)
    return bk.s3.complete_multipart_upload(Bucket=bk.name, Key=key, UploadId=uid, MultipartUpload={"Parts": done})


# --------------------------------------------------------------------------------------------
# GetObjectAttributes

def test_all_attributes_of_a_plain_object(bk):
    body = rnd(1234)
    bk.put("k", body, ChecksumAlgorithm="SHA256")
    r = attrs(bk, "k")
    assert r["ETag"].strip('"') == md5hex(body)
    assert r["ObjectSize"] == 1234 and r["StorageClass"] == "STANDARD"
    assert r["Checksum"]["ChecksumSHA256"] == X.checksum_b64("SHA256", body)
    assert "ObjectParts" not in r, "a single-part object has no ObjectParts"
    assert isinstance(r["LastModified"], datetime.datetime)
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200


def test_only_the_requested_attributes_are_returned(bk):
    bk.put("k", b"data", ChecksumAlgorithm="CRC32")
    r = attrs(bk, "k", ["ObjectSize"])
    assert r["ObjectSize"] == 4
    assert "ETag" not in r and "StorageClass" not in r and "Checksum" not in r
    r = attrs(bk, "k", ["ETag", "StorageClass"])
    assert "ETag" in r and "StorageClass" in r and "ObjectSize" not in r


def test_document_shape_on_the_wire(bk):
    bk.put("k", b"data", ChecksumAlgorithm="CRC32")
    r = raw_req(bk, "GET", "k", query={"attributes": ""}, headers={"x-amz-object-attributes": "ETag,ObjectSize,StorageClass,Checksum"})
    assert r.status == 200, r
    x = r.xml()
    assert x.tag == "GetObjectAttributesResponse"
    assert x.findtext("ObjectSize") == "4" and x.findtext("StorageClass") == "STANDARD"
    assert x.findtext("ETag").strip('"') == md5hex(b"data")
    assert x.findtext("Checksum/ChecksumCRC32") == X.checksum_b64("CRC32", b"data")
    assert r.header("last-modified")


def test_no_attribute_header_is_invalidargument(bk):
    bk.put("k", b"data")
    r = raw_req(bk, "GET", "k", query={"attributes": ""})
    assert r.status == 400 and r.code == "InvalidArgument", r


def test_unknown_attribute_name_is_invalidargument(bk):
    bk.put("k", b"data")
    r = raw_req(bk, "GET", "k", query={"attributes": ""}, headers={"x-amz-object-attributes": "ObjectSize,Bogus"})
    assert r.status == 400 and r.code == "InvalidArgument", r


def test_missing_key_and_missing_bucket(bk):
    with s3error("NoSuchKey", 404):
        attrs(bk, "nope")
    r = bk.raw().request("GET", "/bvt-nosuch-%s/k" % uniq("x")[-6:], query={"attributes": ""}, headers={"x-amz-object-attributes": "ETag"})
    assert r.status == 404 and r.code == "NoSuchBucket", r


def test_multipart_object_parts(bk):
    parts = [rnd(MIN), rnd(MIN + 5), rnd(77)]
    done = mpu(bk, "mp", parts, "CRC32")
    r = attrs(bk, "mp")
    assert r["ETag"].strip('"') == multipart_etag(parts)
    assert r["ObjectSize"] == sum(len(p) for p in parts)
    op = r["ObjectParts"]
    assert op["TotalPartsCount"] == 3 and op["IsTruncated"] is False
    assert [(p["PartNumber"], p["Size"]) for p in op["Parts"]] == [(i + 1, len(p)) for i, p in enumerate(parts)]
    assert [p["ChecksumCRC32"] for p in op["Parts"]] == [X.checksum_b64("CRC32", p) for p in parts]
    assert r["Checksum"]["ChecksumCRC32"] == done["ChecksumCRC32"] == X.composite_b64("CRC32", parts)


def test_multipart_object_parts_paging(bk):
    parts = [rnd(MIN), rnd(MIN), rnd(MIN), rnd(10)]
    mpu(bk, "mp", parts)
    r = attrs(bk, "mp", ["ObjectParts"], MaxParts=2)
    op = r["ObjectParts"]
    assert op["TotalPartsCount"] == 4 and op["MaxParts"] == 2 and op["IsTruncated"] is True
    assert [p["PartNumber"] for p in op["Parts"]] == [1, 2] and op["NextPartNumberMarker"] == 2
    r = attrs(bk, "mp", ["ObjectParts"], MaxParts=2, PartNumberMarker=2)
    op = r["ObjectParts"]
    assert [p["PartNumber"] for p in op["Parts"]] == [3, 4] and op["IsTruncated"] is False and op["PartNumberMarker"] == 2


def test_copied_multipart_object_is_single_part(bk):
    mpu(bk, "mp", [rnd(MIN), rnd(10)])
    bk.s3.copy_object(Bucket=bk.name, Key="cp", CopySource={"Bucket": bk.name, "Key": "mp"})
    r = attrs(bk, "cp")
    assert "ObjectParts" not in r or r["ObjectParts"].get("TotalPartsCount") in (None, 0, 1)      # spec 5.4.5: a copy is a single-part object


def test_attributes_by_version_id():
    bk = bvh.fresh_bucket("attrv", versioning="enabled")
    v1 = bk.put("k", b"first")["VersionId"]
    v2 = bk.put("k", b"second one")["VersionId"]
    r = attrs(bk, "k", ["ObjectSize"])
    assert r["ObjectSize"] == 10 and r["VersionId"] == v2
    r = attrs(bk, "k", ["ObjectSize", "ETag"], VersionId=v1)
    assert r["ObjectSize"] == 5 and r["VersionId"] == v1 and r["ETag"].strip('"') == md5hex(b"first")
    bk.delete("k")
    with s3error("NoSuchKey", 404) as e:
        attrs(bk, "k")
    assert hdr(e.error.response, "x-amz-delete-marker") == "true"
    marker = bk.s3.list_object_versions(Bucket=bk.name)["DeleteMarkers"][0]["VersionId"]
    with s3error("MethodNotAllowed", 405):
        attrs(bk, "k", VersionId=marker)
    with s3error("NoSuchVersion", 404):
        attrs(bk, "k", VersionId="01JNOSUCHVERSIONIDXXXXXXXXXX")


def test_attributes_of_an_encrypted_object_describe_the_plaintext():
    bk = bvh.fresh_bucket("attre", encryption="sse-s3")
    body = rnd(200 * KiB)
    bk.put("k", body)
    r = attrs(bk, "k")
    assert r["ObjectSize"] == len(body) and r["ETag"].strip('"') == md5hex(body)


def test_attributes_need_read_permission(bk):
    bk.put("k", b"data")
    ro = bk.token([{"actions": ["read"]}])
    assert ro.get_object_attributes(Bucket=bk.name, Key="k", ObjectAttributes=["ObjectSize"])["ObjectSize"] == 4
    for actions in (["list"], ["write"], ["delete"], ["tag"]):
        c = bk.token([{"actions": actions}])
        with s3error("AccessDenied", 403):
            c.get_object_attributes(Bucket=bk.name, Key="k", ObjectAttributes=["ObjectSize"])


def test_attributes_of_a_zero_byte_object(bk):
    bk.put("e", b"")
    r = attrs(bk, "e", ["ObjectSize", "ETag"])
    assert r["ObjectSize"] == 0 and r["ETag"].strip('"') == md5hex(b"")


# --------------------------------------------------------------------------------------------
# tagging

def tags_of(bk, key, **kw):
    return {t["Key"]: t["Value"] for t in bk.s3.get_object_tagging(Bucket=bk.name, Key=key, **kw)["TagSet"]}


def put_tags(bk, key, tags, **kw):
    return bk.s3.put_object_tagging(Bucket=bk.name, Key=key, Tagging={"TagSet": [{"Key": k, "Value": v} for k, v in tags]}, **kw)


def test_put_get_delete_tagging_roundtrip(bk):
    bk.put("k", b"data")
    assert tags_of(bk, "k") == {}
    r = put_tags(bk, "k", [("env", "prod"), ("team", "core")])
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 200
    assert tags_of(bk, "k") == {"env": "prod", "team": "core"}
    put_tags(bk, "k", [("only", "this")])                      # PUT replaces the whole set
    assert tags_of(bk, "k") == {"only": "this"}
    r = bk.s3.delete_object_tagging(Bucket=bk.name, Key="k")
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 204
    assert tags_of(bk, "k") == {}
    r = bk.s3.delete_object_tagging(Bucket=bk.name, Key="k")           # idempotent
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 204


def test_get_tagging_document_on_the_wire(bk):
    bk.put("k", b"data")
    put_tags(bk, "k", [("b", "2"), ("a", "1")])
    r = raw_req(bk, "GET", "k", query={"tagging": ""})
    assert r.status == 200, r
    x = r.xml()
    assert x.tag == "Tagging"
    assert sorted((t.findtext("Key"), t.findtext("Value")) for t in x.findall("TagSet/Tag")) == [("a", "1"), ("b", "2")]
    bk.s3.delete_object_tagging(Bucket=bk.name, Key="k")
    x = raw_req(bk, "GET", "k", query={"tagging": ""}).xml()
    assert x.find("TagSet") is not None and x.findall("TagSet/Tag") == []


def test_an_empty_tag_set_clears_the_tags(bk):
    bk.put("k", b"data", Tagging="a=1")
    put_tags(bk, "k", [])
    assert tags_of(bk, "k") == {}


def test_tagging_a_missing_key_and_bucket(bk):
    for fn in (lambda: put_tags(bk, "nope", [("a", "1")]), lambda: tags_of(bk, "nope"), lambda: bk.s3.delete_object_tagging(Bucket=bk.name, Key="nope")):
        with s3error("NoSuchKey", 404):
            fn()
    with s3error("NoSuchBucket", 404):
        bk.s3.get_object_tagging(Bucket="bvt-nosuch-" + uniq("b")[-8:], Key="k")


def test_ten_tags_are_allowed_eleven_are_invalidtag(bk):
    bk.put("k", b"data")
    ten = [("k%d" % i, "v%d" % i) for i in range(10)]
    put_tags(bk, "k", ten)
    assert tags_of(bk, "k") == dict(ten)
    with s3error("InvalidTag", 400):
        put_tags(bk, "k", ten + [("k10", "v10")])
    assert tags_of(bk, "k") == dict(ten), "a refused PutObjectTagging changes nothing"


def test_tag_key_and_value_length_limits(bk):
    bk.put("k", b"data")
    put_tags(bk, "k", [("k" * 128, "v" * 256)])
    assert tags_of(bk, "k") == {"k" * 128: "v" * 256}
    with s3error("InvalidTag", 400):
        put_tags(bk, "k", [("k" * 129, "v")])
    with s3error("InvalidTag", 400):
        put_tags(bk, "k", [("k", "v" * 257)])
    assert tags_of(bk, "k") == {"k" * 128: "v" * 256}


def test_duplicate_tag_keys_and_an_empty_key_are_invalidtag(bk):
    bk.put("k", b"data")
    with s3error("InvalidTag", 400):
        put_tags(bk, "k", [("a", "1"), ("a", "2")])
    r = raw_req(bk, "PUT", "k", query={"tagging": ""}, headers={"Content-Type": "application/xml"},
                body="<Tagging><TagSet><Tag><Key></Key><Value>1</Value></Tag></TagSet></Tagging>")     # botocore refuses an empty key itself
    assert r.status == 400 and r.code in ("InvalidTag", "MalformedXML"), r


def test_tag_values_may_be_empty_and_unicode(bk):
    bk.put("k", b"data")
    put_tags(bk, "k", [("empty", ""), ("unié 日本", "vé w"), ("with space", "a b"), ("sym", "a+b=c/d:e@f.g_h-i")])
    got = tags_of(bk, "k")
    assert got["empty"] == "" and got["unié 日本"] == "vé w" and got["with space"] == "a b" and got["sym"] == "a+b=c/d:e@f.g_h-i"


def test_malformed_tagging_xml_is_malformedxml(bk):
    bk.put("k", b"data")
    for body in ("not xml", "<Tagging><TagSet><Tag><Key>a</Key></Tag></TagSet></Tagging>", "<Tagging/>x"):
        r = raw_req(bk, "PUT", "k", query={"tagging": ""}, body=body, headers={"Content-Type": "application/xml"})
        assert r.status == 400 and r.code == "MalformedXML", (body, r)
    ok = ('<Tagging xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><TagSet><Tag><Key>a</Key><Value>1</Value></Tag></TagSet></Tagging>')
    r = raw_req(bk, "PUT", "k", query={"tagging": ""}, body=ok, headers={"Content-Type": "application/xml"})
    assert r.status == 200, r
    assert tags_of(bk, "k") == {"a": "1"}
    r = raw_req(bk, "PUT", "k", query={"tagging": ""}, body=ok.replace(' xmlns="http://s3.amazonaws.com/doc/2006-03-01/"', ""),
                headers={"Content-Type": "application/xml"})
    assert r.status == 200, "the namespace is optional on request documents (S3 accepts both): %r" % r


def test_tagging_does_not_change_etag_last_modified_or_version(bk):
    bk.put("k", b"data")
    before = raw_head(bk, "k")
    import time
    time.sleep(1.1)
    put_tags(bk, "k", [("a", "1")])
    after = raw_head(bk, "k")
    for h in ("etag", "last-modified", "x-binvault-version", "content-length"):
        assert after.header(h) == before.header(h), h
    assert after.header("x-amz-tagging-count") == "1"


def test_tag_count_header_on_get_and_head(bk):
    bk.put("k", b"data", Tagging="a=1&b=2&c=3")
    for fn in (raw_get, raw_head):
        r = fn(bk, "k")
        assert r.header("x-amz-tagging-count") == "3", r.raw_headers
    bk.put("plain", b"x")
    assert raw_get(bk, "plain").header("x-amz-tagging-count") is None
    assert bk.s3.get_object(Bucket=bk.name, Key="k")["TagCount"] == 3


def test_tagging_header_on_put(bk):
    bk.put("k", b"data", Tagging="env=prod&team=core")
    assert tags_of(bk, "k") == {"env": "prod", "team": "core"}
    bk.put("k", b"data2")                         # an overwrite without tags removes the old tags
    assert tags_of(bk, "k") == {}
    bk.put("e", b"x", Tagging="a%20b=c%2Bd&e=")
    assert tags_of(bk, "e") == {"a b": "c+d", "e": ""}


def test_tagging_header_limits(bk):
    many = "&".join("k%d=v" % i for i in range(11))
    with s3error("InvalidTag", 400):
        bk.put("k", b"x", Tagging=many)
    with s3error("InvalidTag", 400):
        bk.put("k", b"x", Tagging="a=1&a=2")
    with s3error("InvalidTag", 400):
        bk.put("k", b"x", Tagging="%s=v" % ("k" * 129))
    with s3error(None, 404):
        bk.head("k")
    bk.put("k", b"x", Tagging="&".join("k%d=v" % i for i in range(10)))
    assert len(tags_of(bk, "k")) == 10


def test_copy_object_tagging_directive(bk):
    bk.put("src", b"data", Tagging="a=1&b=2")
    bk.s3.copy_object(Bucket=bk.name, Key="c1", CopySource={"Bucket": bk.name, "Key": "src"})
    assert tags_of(bk, "c1") == {"a": "1", "b": "2"}
    bk.s3.copy_object(Bucket=bk.name, Key="c2", CopySource={"Bucket": bk.name, "Key": "src"}, TaggingDirective="REPLACE", Tagging="z=26")
    assert tags_of(bk, "c2") == {"z": "26"}
    bk.s3.copy_object(Bucket=bk.name, Key="c3", CopySource={"Bucket": bk.name, "Key": "src"}, TaggingDirective="REPLACE")
    assert tags_of(bk, "c3") == {}
    assert tags_of(bk, "src") == {"a": "1", "b": "2"}, "tagging a copy leaves the source alone"


def test_tags_follow_the_object_across_a_copy_that_replaces_metadata(bk):
    bk.put("src", b"data", Tagging="a=1")
    bk.s3.copy_object(Bucket=bk.name, Key="src", CopySource={"Bucket": bk.name, "Key": "src"}, MetadataDirective="REPLACE", Metadata={"m": "1"})
    assert tags_of(bk, "src") == {"a": "1"}


def test_bucket_tagging_is_not_configured(bk):
    r = bk.raw().request("GET", "/" + bk.name, query={"tagging": ""})
    assert r.status == 404 and r.code == "NoSuchTagSet", r
    r = bk.raw().request("PUT", "/" + bk.name, query={"tagging": ""}, body="<Tagging><TagSet/></Tagging>")
    assert r.status in (501, 403), r
    if r.status == 501:
        assert r.code == "NotImplemented"


def test_tagging_on_an_object_in_a_prefix_restricted_token(bk):
    bk.put("a/1", b"x")
    bk.put("b/1", b"x")
    c = bk.token([{"actions": ["tag", "read"], "keys": ["a/*"]}])
    c.put_object_tagging(Bucket=bk.name, Key="a/1", Tagging={"TagSet": [{"Key": "k", "Value": "v"}]})
    with s3error("AccessDenied", 403):
        c.put_object_tagging(Bucket=bk.name, Key="b/1", Tagging={"TagSet": [{"Key": "k", "Value": "v"}]})
    assert tags_of(bk, "a/1") == {"k": "v"} and tags_of(bk, "b/1") == {}
