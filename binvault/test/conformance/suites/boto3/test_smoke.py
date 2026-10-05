"""Sanity checks of the harness itself (the node answers, a token works, the raw signer agrees with botocore)."""
import bvh
from bvh import Raw, s3quote


def test_put_get_roundtrip(bk):
    body = bvh.rnd(100_000)
    r = bk.put("hello/world.bin", body, ContentType="application/x-test")
    assert r["ETag"].strip('"') == bvh.md5hex(body)
    assert bk.read("hello/world.bin") == body


def test_raw_signer_matches_server(bk):
    bk.put("raw/one.txt", b"hello")
    raw = bk.raw()
    r = raw.request("GET", "/%s/%s" % (bk.name, s3quote("raw/one.txt")))
    assert r.status == 200 and r.body == b"hello", r
    r = raw.request("GET", "/%s" % bk.name, query={"list-type": "2", "prefix": "raw/"})
    assert r.status == 200 and b"<Key>raw/one.txt</Key>" in r.body, r


def test_virtual_hosted_roundtrip(bk):
    bk.put("vh/a b.txt", b"vh")
    assert bk.vs3.get_object(Bucket=bk.name, Key="vh/a b.txt")["Body"].read() == b"vh"


def test_missing_key_is_nosuchkey(bk):
    with bvh.s3error("NoSuchKey", 404):
        bk.get("nope")
