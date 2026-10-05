"""Keys: the odd-keys table round-trips through every operation; key length and validity rules (spec 3.7, 2.4, 5.4.6).

Keys are byte-exact: no normalisation of Unicode, slashes, '.' or '..'; 1-1024 bytes of valid UTF-8, no NUL.
"""
import urllib.parse

import pytest

import bvh
import bvx_c as X
from bvh import md5hex, s3error, s3quote, uniq
from bvx_a import (list_pages, oddkeys, raw_get, raw_head, raw_list, raw_put, raw_req, too_long_key, unq, utf8_sorted)

ODD = oddkeys()
IDS = [i for i, _ in ODD]
KEYS = dict(ODD)


@pytest.fixture(scope="module")
def kb():
    """One bucket that holds the whole odd-keys table (put once, read many times)."""
    bk = bvh.fresh_bucket("keys")
    for kid, key in ODD:
        bk.put(key, ("body of " + kid).encode())
    return bk


@pytest.mark.parametrize("kid", IDS)
def test_get_and_head_roundtrip(kb, kid):
    key = KEYS[kid]
    want = ("body of " + kid).encode()
    assert kb.read(key) == want
    h = kb.head(key)
    assert h["ContentLength"] == len(want)
    assert h["ETag"] == '"%s"' % md5hex(want)


@pytest.mark.parametrize("kid", IDS)
def test_listing_returns_the_key_byte_exact(kb, kid):
    key = KEYS[kid]
    # boto3 sends encoding-type=url and decodes the answer
    got = [o["Key"] for o in kb.s3.list_objects_v2(Bucket=kb.name, Prefix=key)["Contents"]]
    assert key in got, "V2 listing with Prefix=%r does not contain the key (got %r)" % (key, got)
    got1 = [o["Key"] for o in kb.s3.list_objects(Bucket=kb.name, Prefix=key)["Contents"]]
    assert key in got1, "V1 listing with Prefix=%r does not contain the key" % key
    # the raw document: with encoding-type=url the key is percent-encoded, without it the literal text appears
    r = raw_list(kb, prefix=key, **{"encoding-type": "url"})
    assert r.status == 200, r
    keys = [unq(e.text) for e in r.xml().findall("Contents/Key")]
    assert key in keys, (key, keys)


@pytest.mark.parametrize("kid", IDS)
def test_raw_wire_spelling_of_the_path(kb, kid):
    key = KEYS[kid]
    want = ("body of " + kid).encode()
    r = raw_get(kb, key)                       # percent-encoded by s3quote, '/' and unreserved characters literal
    assert r.status == 200 and r.body == want, r
    # the same request spelled like Go's net/http would (sub-delimiters left unescaped), signed over the AWS form
    wire = "/%s/%s" % (kb.name, urllib.parse.quote(key, safe="/!*'()$&,:;=@+"))
    r2 = X.sreq(kb, "GET", wire)
    assert r2.status == 200 and r2.body == want, r2


@pytest.mark.parametrize("kid", IDS)
def test_copy_from_and_to_the_key(kb, kid):
    key = KEYS[kid]
    dst = uniq("copy") + "/" + key[-40:] if len(key) < 900 else uniq("copy")
    kb.s3.copy_object(Bucket=kb.name, Key=dst, CopySource={"Bucket": kb.name, "Key": key})
    assert kb.read(dst) == ("body of " + kid).encode()
    if len(key) < 900:
        # copy onto a key that needs encoding, source is the plain key
        kb.s3.copy_object(Bucket=kb.name, Key=key, CopySource={"Bucket": kb.name, "Key": dst},
                          MetadataDirective="REPLACE", Metadata={"touched": "1"})
        assert kb.head(key)["Metadata"] == {"touched": "1"}
        # restore the original body for the other tests of this module
        kb.put(key, ("body of " + kid).encode())
    kb.delete(dst)


@pytest.mark.parametrize("kid", IDS)
def test_virtual_hosted_style_roundtrip(kb, kid):
    key = KEYS[kid]
    want = ("body of " + kid).encode()
    assert kb.vs3.get_object(Bucket=kb.name, Key=key)["Body"].read() == want
    assert kb.vs3.head_object(Bucket=kb.name, Key=key)["ContentLength"] == len(want)


@pytest.mark.parametrize("kid", IDS)
def test_delete_objects_with_the_key(kid):
    key = KEYS[kid]
    bk = bvh.fresh_bucket("keysdel")
    bk.put(key, b"x")
    bk.put("neighbour", b"n")
    r = bk.s3.delete_objects(Bucket=bk.name, Delete={"Objects": [{"Key": key}, {"Key": "neighbour"}]})
    assert sorted(d["Key"] for d in r.get("Deleted", [])) == sorted([key, "neighbour"]), r
    assert not r.get("Errors")
    assert bk.keys() == []


def test_every_odd_key_at_once_in_utf8_byte_order(kb):
    expect = utf8_sorted(KEYS.values())
    assert kb.keys() == expect, "V2 listing order / content differs from the raw-UTF-8 byte order of the table"
    v1 = []
    for page in list_pages(kb, op="list_objects"):
        v1 += [o["Key"] for o in page["Contents"]]
    assert v1 == expect


def test_delimiter_listing_of_the_odd_keys(kb):
    keys = list(KEYS.values())
    r = kb.s3.list_objects_v2(Bucket=kb.name, Delimiter="/")
    prefixes = sorted(p["Prefix"] for p in r.get("CommonPrefixes", []))
    contents = sorted(o["Key"] for o in r.get("Contents", []))
    exp_prefixes = sorted({k[:k.index("/") + 1] for k in keys if "/" in k})
    exp_contents = sorted(k for k in keys if "/" not in k)
    assert contents == exp_contents
    assert prefixes == exp_prefixes
    # the key made of a single leading slash segment: prefix "/" holds "/leading/slash.txt"
    r = kb.s3.list_objects_v2(Bucket=kb.name, Prefix="/", Delimiter="/")
    assert [p["Prefix"] for p in r.get("CommonPrefixes", [])] == ["/leading/"]


def test_unicode_normalisation_is_not_applied(kb):
    nfd, nfc = KEYS["combining"], KEYS["nfc"]
    assert nfd != nfc and nfd.encode() != nfc.encode()
    assert kb.read(nfd) == b"body of combining"
    assert kb.read(nfc) == b"body of nfc"
    import unicodedata
    # the same visible text in the other normalisation form is a different (missing) key
    with s3error("NoSuchKey", 404):
        kb.get(unicodedata.normalize("NFC", "é-nfd"))
    with s3error("NoSuchKey", 404):
        kb.get(unicodedata.normalize("NFD", "é-nfc"))


def test_slashes_and_dots_are_literal_key_text():
    bk = bvh.fresh_bucket("keyslash")
    keys = ["a/b", "a//b", "/a/b", "a/b/", "a/./b", "a/../b", "./a", "../a", ".", "..", "...", "a/.", "a/.."]
    for k in keys:
        bk.put(k, k.encode())
    for k in keys:
        assert bk.read(k) == k.encode(), k
        r = raw_get(bk, k)                              # literal dot segments on the wire, nothing cleaned
        assert r.status == 200 and r.body == k.encode(), (k, r)
    assert bk.keys() == utf8_sorted(keys)
    for k in keys:
        bk.delete(k)
    assert bk.keys() == []


def test_a_percent_sequence_in_a_key_is_literal_text():
    bk = bvh.fresh_bucket("keypct")
    for k in ("lit%2Fslash", "lit/slash", "x%20y", "x y", "plus+sign", "plus sign", "100%", "%", "%%", "%zz"):
        bk.put(k, k.encode())
    for k in ("lit%2Fslash", "lit/slash", "x%20y", "x y", "plus+sign", "plus sign", "100%", "%", "%%", "%zz"):
        assert bk.read(k) == k.encode(), k
    assert len(bk.keys()) == 10


def test_trailing_slash_marker_is_an_ordinary_zero_byte_object():
    bk = bvh.fresh_bucket("keydir")
    bk.put("folder/", b"")
    bk.put("folder/file", b"f")
    assert bk.head("folder/")["ContentLength"] == 0
    r = bk.s3.list_objects_v2(Bucket=bk.name, Prefix="folder/", Delimiter="/")
    assert [o["Key"] for o in r["Contents"]] == ["folder/", "folder/file"]
    r = bk.s3.list_objects_v2(Bucket=bk.name, Delimiter="/")
    assert [p["Prefix"] for p in r["CommonPrefixes"]] == ["folder/"] and "Contents" not in r
    with s3error("NoSuchKey", 404):
        bk.get("folder")


# --------------------------------------------------------------------------------------------
# length and validity

def test_longest_legal_keys_are_accepted():
    bk = bvh.fresh_bucket("keylen")
    for kid in ("len-1024", "len-1024-multibyte"):
        key = KEYS[kid]
        assert len(key.encode()) == 1024
        bk.put(key, b"x")
        assert bk.read(key) == b"x"
        assert bk.keys(Prefix=key[:10]) == [key]


def test_a_key_of_1025_bytes_is_refused_on_put():
    bk = bvh.fresh_bucket("keylong")
    key = too_long_key()
    assert len(key.encode()) == 1025
    with s3error("KeyTooLongError", 400):
        bk.put(key, b"x")
    r = raw_put(bk, key, b"x")
    assert r.status == 400 and r.code == "KeyTooLongError", r
    assert bk.keys() == []


def test_a_multibyte_key_over_1024_bytes_is_refused():
    bk = bvh.fresh_bucket("keylong2")
    key = "é" * 513                        # 513 characters, 1026 bytes
    assert len(key) == 513 and len(key.encode()) == 1026
    with s3error("KeyTooLongError", 400):
        bk.put(key, b"x")


def test_a_too_long_key_is_refused_as_copy_destination_and_multipart_target():
    bk = bvh.fresh_bucket("keylong3")
    bk.put("src", b"s")
    key = too_long_key()
    with s3error("KeyTooLongError", 400):
        bk.s3.copy_object(Bucket=bk.name, Key=key, CopySource={"Bucket": bk.name, "Key": "src"})
    with s3error("KeyTooLongError", 400):
        bk.s3.create_multipart_upload(Bucket=bk.name, Key=key)
    assert bk.keys() == ["src"]


def test_a_nul_byte_in_a_key_is_refused():
    bk = bvh.fresh_bucket("keynul")
    r = bk.raw().request("PUT", "/%s/a%%00b" % bk.name, body=b"x")
    assert r.status == 400 and r.code, r
    r = bk.raw().request("GET", "/%s/a%%00b" % bk.name)
    assert 400 <= r.status < 500, r
    assert bk.keys() == []


@pytest.mark.parametrize("raw_key", ["a%FFb", "%C3%28", "%80", "%C0%AF", "%ED%A0%80"],
                         ids=["lone-ff", "bad-continuation", "lone-continuation", "overlong-slash", "utf16-surrogate"])
def test_invalid_utf8_in_a_key_is_refused(raw_key):
    bk = bvh.fresh_bucket("keybad")
    r = bk.raw().request("PUT", "/%s/%s" % (bk.name, raw_key), body=b"x")
    assert r.status == 400 and r.code, "invalid UTF-8 key %s: %r" % (raw_key, r)
    assert bk.keys() == []


def test_a_one_byte_key_and_a_key_that_is_only_a_slash():
    bk = bvh.fresh_bucket("keytiny")
    for k in ("a", "/", "//", " ", "~"):
        bk.put(k, k.encode())
    for k in ("a", "/", "//", " ", "~"):
        assert bk.read(k) == k.encode(), repr(k)
    assert bk.keys() == utf8_sorted(["a", "/", "//", " ", "~"])


def test_control_characters_in_keys_need_encoding_type_url_in_listings():
    bk = bvh.fresh_bucket("keyctl")
    key = "ctl\x01\x1f-key"
    bk.put(key, b"c")
    bk.put("plain", b"p")
    assert bk.read(key) == b"c"
    # without encoding-type=url the XML would be invalid: 400 InvalidRequest that points at encoding-type=url
    r = raw_list(bk)
    assert r.status == 400 and r.code == "InvalidRequest", r
    assert "encoding-type" in r.xml().findtext("Message", "").lower(), r.text
    r = raw_list(bk, **{"encoding-type": "url"})
    assert r.status == 200, r
    assert sorted(unq(e.text) for e in r.xml().findall("Contents/Key")) == sorted([key, "plain"])
    assert "%01" in r.text and "\x01" not in r.text, "control characters must come back percent-encoded"
    assert sorted(bk.keys()) == sorted([key, "plain"])        # boto3 always asks for url encoding
    r = raw_req(bk, "GET", None, query={"versions": "", "prefix": "ctl"})
    assert r.status == 400 and r.code == "InvalidRequest", r
    v1 = raw_list(bk, **{"list-type": None})
    assert v1.status == 400 and v1.code == "InvalidRequest", v1


def test_control_characters_in_a_key_are_returned_by_head_and_get_paths():
    bk = bvh.fresh_bucket("keyctl2")
    key = "a\x01b\tc\x7fd"
    bk.put(key, b"1")
    assert bk.read(key) == b"1"
    assert bk.head(key)["ContentLength"] == 1
    r = raw_head(bk, key)
    assert r.status == 200


def test_xml_special_characters_in_keys_survive_listings_and_delete_objects():
    bk = bvh.fresh_bucket("keyxml")
    keys = ["a&b", "<tag>", "x\"y'z", "]]>", "<![CDATA[", "&amp;", "&#x41;"]
    for k in keys:
        bk.put(k, b"x")
    assert bk.keys() == utf8_sorted(keys)
    r = raw_list(bk)                                    # no control characters: an unencoded listing is valid
    assert r.status == 200, r
    assert sorted(e.text for e in r.xml().findall("Contents/Key")) == sorted(keys)
    resp = bk.s3.delete_objects(Bucket=bk.name, Delete={"Objects": [{"Key": k} for k in keys]})
    assert sorted(d["Key"] for d in resp["Deleted"]) == sorted(keys)
    assert bk.keys() == []
