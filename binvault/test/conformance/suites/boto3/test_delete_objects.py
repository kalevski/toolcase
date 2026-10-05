"""DeleteObjects: batches, Quiet mode, limits, malformed documents (spec 5.4.4, 3.8)."""
import base64
import hashlib

import pytest

import bvh
from bvh import md5hex, s3error, uniq
from bvx_a import put_many, raw_req

NS = 'xmlns="http://s3.amazonaws.com/doc/2006-03-01/"'


def delete_xml(keys, quiet=None, ns=True):
    inner = "".join("<Object><Key>%s</Key></Object>" % k.replace("&", "&amp;").replace("<", "&lt;") for k in keys)
    q = "" if quiet is None else "<Quiet>%s</Quiet>" % ("true" if quiet else "false")
    return "<Delete%s>%s%s</Delete>" % (" " + NS if ns else "", q, inner)


def post_delete(bk, xml, md5=True, headers=None):
    body = xml.encode() if isinstance(xml, str) else xml
    h = {"Content-Type": "application/xml"}
    if md5:
        h["Content-MD5"] = base64.b64encode(hashlib.md5(body).digest()).decode()
    h.update(headers or {})
    return raw_req(bk, "POST", None, query={"delete": ""}, body=body, headers=h)


def test_delete_a_batch_and_report_each_key(bk):
    keys = ["k%d" % i for i in range(7)]
    put_many(bk, keys)
    r = bk.s3.delete_objects(Bucket=bk.name, Delete={"Objects": [{"Key": k} for k in keys[:5]]})
    assert [d["Key"] for d in r["Deleted"]] == keys[:5], "results come back in request order"
    assert not r.get("Errors")
    assert bk.keys() == keys[5:]


def test_the_wire_document(bk):
    put_many(bk, ["a", "b"])
    r = post_delete(bk, delete_xml(["a", "b", "never-existed"]))
    assert r.status == 200, r
    assert r.header("content-type", "").startswith("application/xml")
    x = r.xml()
    assert x.tag == "DeleteResult"
    assert [d.findtext("Key") for d in x.findall("Deleted")] == ["a", "b", "never-existed"], "a key that does not exist is reported as deleted"
    assert x.findall("Error") == []
    assert bk.keys() == []


def test_quiet_mode_reports_nothing_for_successes(bk):
    put_many(bk, ["a", "b"])
    r = post_delete(bk, delete_xml(["a", "b", "ghost"], quiet=True))
    assert r.status == 200 and r.xml().findall("Deleted") == [] and r.xml().findall("Error") == [], r.text
    assert bk.keys() == []
    r = bk.s3.delete_objects(Bucket=bk.name, Delete={"Objects": [{"Key": "x"}], "Quiet": True})
    assert not r.get("Deleted")


def test_documents_without_the_s3_namespace_are_accepted(bk):
    put_many(bk, ["a"])
    r = post_delete(bk, delete_xml(["a"], ns=False))
    assert r.status == 200 and [d.findtext("Key") for d in r.xml().findall("Deleted")] == ["a"], r


def test_a_thousand_keys_are_allowed_a_thousand_and_one_are_not(bk):
    keys = ["k%04d" % i for i in range(1000)]
    put_many(bk, keys)
    r = bk.s3.delete_objects(Bucket=bk.name, Delete={"Objects": [{"Key": k} for k in keys]})
    assert len(r["Deleted"]) == 1000 and bk.keys() == []
    r = post_delete(bk, delete_xml(["k%04d" % i for i in range(1001)]))
    assert r.status == 400 and r.code == "MalformedXML", r


def test_an_empty_delete_is_malformedxml(bk):
    r = post_delete(bk, "<Delete %s></Delete>" % NS)
    assert r.status == 400 and r.code == "MalformedXML", r


@pytest.mark.parametrize("body", ["not xml", "<Delete><Object></Object></Delete>", "<Delete><Object><Key>a</Key></Delete>", "<Wrong><Object><Key>a</Key></Object></Wrong>", ""],
                         ids=["not-xml", "no-key", "unclosed", "wrong-root", "empty"])
def test_malformed_documents(bk, body):
    bk.put("a", b"x")
    r = post_delete(bk, body, md5=bool(body))
    assert r.status == 400 and r.code in ("MalformedXML", "InvalidRequest", "MissingRequestBodyError"), (body, r)
    assert bk.keys() == ["a"], "nothing is deleted by a malformed request"


def test_content_md5_is_verified_when_present_and_not_required(bk):
    bk.put("a", b"x")
    wrong = base64.b64encode(hashlib.md5(b"other").digest()).decode()
    r = post_delete(bk, delete_xml(["a"]), md5=False, headers={"Content-MD5": wrong})
    assert r.status == 400 and r.code == "BadDigest", r
    assert bk.keys() == ["a"]
    r = post_delete(bk, delete_xml(["a"]), md5=False)
    assert r.status == 200 and bk.keys() == [], "no Content-MD5 and no checksum: still fine"


def test_checksum_header_is_verified(bk):
    import bvx_b as X
    bk.put("a", b"x")
    xml = delete_xml(["a"]).encode()
    r = post_delete(bk, xml, md5=False, headers={"x-amz-checksum-crc32": X.wrong_checksum_b64("CRC32", xml), "x-amz-sdk-checksum-algorithm": "CRC32"})
    assert r.status == 400 and r.code == "BadDigest", r
    r = post_delete(bk, xml, md5=False, headers={"x-amz-checksum-crc32": X.checksum_b64("CRC32", xml), "x-amz-sdk-checksum-algorithm": "CRC32"})
    assert r.status == 200, r


def test_duplicate_keys_in_one_request(bk):
    bk.put("a", b"x")
    r = post_delete(bk, delete_xml(["a", "a", "a"]))
    assert r.status == 200 and [d.findtext("Key") for d in r.xml().findall("Deleted")] == ["a", "a", "a"], r
    assert bk.keys() == []


def test_delete_objects_on_a_missing_bucket(bk):
    r = bk.raw().request("POST", "/bvt-nosuch-%s" % uniq("x")[-8:], query={"delete": ""}, body=delete_xml(["a"]).encode())
    assert r.status == 404 and r.code == "NoSuchBucket", r


def test_oversized_document_is_refused(bk):
    huge = delete_xml(["k" * 900 + str(i) for i in range(2500)])           # ~2.3 MiB
    assert len(huge) > 2 * 1024 * 1024
    r = post_delete(bk, huge)
    assert r.status in (400, 413) and r.code in ("MalformedXML", "EntityTooLarge", "InvalidRequest"), r


def test_keys_with_odd_characters_round_trip_through_the_xml(bk):
    keys = ["sp ace", "unié日本", "amp&amp;", "lt<gt>", "quote\"'", "plus+", "slash/"]
    put_many(bk, keys)
    r = bk.s3.delete_objects(Bucket=bk.name, Delete={"Objects": [{"Key": k} for k in keys]})
    assert sorted(d["Key"] for d in r["Deleted"]) == sorted(keys)
    assert bk.keys() == []


def test_permission_errors_are_per_key_not_per_request(bk):
    bk.put("mine/a", b"x")
    bk.put("theirs/b", b"x")
    c = bk.token([{"actions": ["delete"], "keys": ["mine/*"]}])
    r = c.delete_objects(Bucket=bk.name, Delete={"Objects": [{"Key": "mine/a"}, {"Key": "theirs/b"}]})
    assert [d["Key"] for d in r["Deleted"]] == ["mine/a"]
    assert [(e["Key"], e["Code"]) for e in r["Errors"]] == [("theirs/b", "AccessDenied")]
    assert bk.keys() == ["theirs/b"]


def test_delete_objects_in_a_versioned_bucket_report_markers(vbk):
    vbk.put("a", b"1")
    r = vbk.s3.delete_objects(Bucket=vbk.name, Delete={"Objects": [{"Key": "a"}, {"Key": "never"}]})
    by = {d["Key"]: d for d in r["Deleted"]}
    assert by["a"].get("DeleteMarker") is True and by["a"].get("DeleteMarkerVersionId")
    assert "never" in by
