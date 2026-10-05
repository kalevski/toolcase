"""Listing: ListObjects (V1) and ListObjectsV2, prefix, delimiter, paging, encoding, byte order (spec 5.4.6)."""
import re
import time

import pytest

import bvh
from bvh import s3error, uniq
from bvx_a import ISO_MS, S3_NS, list_pages, put_many, raw_list, raw_req, unq, utf8_sorted

TREE = ["a.txt", "b.txt", "c/1.txt", "c/2.txt", "c/d/3.txt", "c/d/4.txt", "e/1.txt", "f"]


@pytest.fixture(scope="module")
def tree():
    bk = bvh.fresh_bucket("list")
    for k in TREE:
        bk.put(k, ("data:" + k).encode())
    return bk


def model(keys, prefix="", delimiter="", start_after=""):
    """Entries of a listing in S3 order: ('key', k) or ('prefix', p); a prefix takes the place of its first key."""
    out, last = [], None
    for k in utf8_sorted(keys):
        if not k.startswith(prefix) or not k.encode() > start_after.encode():
            continue
        rest = k[len(prefix):]
        if delimiter and delimiter in rest:
            p = prefix + rest[:rest.index(delimiter) + len(delimiter)]
            if p != last:
                out.append(("prefix", p))
                last = p
        else:
            out.append(("key", k))
    return out


def split(entries):
    return sorted(k for t, k in entries if t == "key"), sorted(k for t, k in entries if t == "prefix")


def page_split(page):
    return sorted(o["Key"] for o in page.get("Contents", [])), sorted(p["Prefix"] for p in page.get("CommonPrefixes", []))


def check_paging(bk, keys, op, size, **params):
    """Walk the listing with the given page size; every page must hold exactly the next `size` model entries."""
    entries = model(keys, params.get("Prefix", ""), params.get("Delimiter", ""))
    pages = list_pages(bk, op=op, MaxKeys=size, **params)
    want = [entries[i:i + size] for i in range(0, len(entries), size)] or [[]]
    assert len(pages) == len(want), "page count %d, expected %d (size %d, %r)" % (len(pages), len(want), size, params)
    for i, (pg, exp) in enumerate(zip(pages, want)):
        assert page_split(pg) == split(exp), "page %d differs (size %d, %r)" % (i, size, params)
        assert pg["IsTruncated"] == (i < len(want) - 1)


# --------------------------------------------------------------------------------------------
# document shapes

def test_v2_document_shape(tree):
    r = raw_list(tree)
    assert r.status == 200, r
    assert r.header("content-type", "").startswith("application/xml")
    root = r.xml()
    assert root.tag == "ListBucketResult"
    assert 'xmlns="%s"' % S3_NS in r.text[:400], "the S3 namespace must be declared on the root element"
    assert root.findtext("Name") == tree.name
    assert root.find("Prefix") is not None and root.findtext("Prefix") in (None, "")
    assert root.findtext("MaxKeys") == "1000"
    assert root.findtext("KeyCount") == str(len(TREE))
    assert root.findtext("IsTruncated") == "false"
    assert root.find("NextContinuationToken") is None and root.find("Delimiter") is None and root.find("EncodingType") is None
    assert root.find("Contents/Owner") is None, "Owner is only returned with fetch-owner=true"
    keys = [c.findtext("Key") for c in root.findall("Contents")]
    assert keys == utf8_sorted(TREE)
    for c in root.findall("Contents"):
        assert ISO_MS.match(c.findtext("LastModified")), c.findtext("LastModified")
        assert re.fullmatch(r'"[0-9a-f]{32}"', c.findtext("ETag")), c.findtext("ETag")
        assert c.findtext("Size") == str(len(("data:" + c.findtext("Key")).encode()))
        assert c.findtext("StorageClass") == "STANDARD"


def test_v2_fetch_owner(tree):
    r = raw_list(tree, **{"fetch-owner": "true"})
    owners = r.xml().findall("Contents/Owner")
    assert len(owners) == len(TREE)
    for o in owners:
        assert o.findtext("ID") and o.findtext("DisplayName")
        assert o.findtext("ID") == tree.name and o.findtext("DisplayName") == tree.name   # spec 5.2: the bucket name


def test_v1_document_shape(tree):
    r = raw_list(tree, **{"list-type": None})
    assert r.status == 200, r
    root = r.xml()
    assert root.tag == "ListBucketResult"
    assert root.findtext("Name") == tree.name
    assert root.findtext("Marker") in (None, "")
    assert root.findtext("MaxKeys") == "1000" and root.findtext("IsTruncated") == "false"
    assert root.find("KeyCount") is None, "KeyCount is a V2-only element"
    assert [c.findtext("Key") for c in root.findall("Contents")] == utf8_sorted(TREE)
    for c in root.findall("Contents"):
        assert c.find("Owner") is not None and c.findtext("Owner/ID"), "V1 listings always carry the Owner"
        assert c.findtext("StorageClass") == "STANDARD"


def test_boto3_v2_and_v1_see_the_same_keys(tree):
    assert [o["Key"] for o in tree.s3.list_objects_v2(Bucket=tree.name)["Contents"]] == utf8_sorted(TREE)
    assert [o["Key"] for o in tree.s3.list_objects(Bucket=tree.name)["Contents"]] == utf8_sorted(TREE)
    r = tree.s3.list_objects_v2(Bucket=tree.name)
    assert r["KeyCount"] == len(TREE) and r["MaxKeys"] == 1000 and r["IsTruncated"] is False and r["Name"] == tree.name


def test_empty_bucket_listing():
    bk = bvh.fresh_bucket("listempty")
    r = bk.s3.list_objects_v2(Bucket=bk.name)
    assert r["KeyCount"] == 0 and r["IsTruncated"] is False and "Contents" not in r and "CommonPrefixes" not in r
    r = bk.s3.list_objects(Bucket=bk.name)
    assert r["IsTruncated"] is False and "Contents" not in r
    x = raw_list(bk).xml()
    assert x.findtext("KeyCount") == "0" and x.findall("Contents") == []


def test_listing_a_missing_bucket_is_nosuchbucket(tree):
    for q in ({"list-type": "2"}, {}):
        r = tree.raw().request("GET", "/bvt-nosuch-%s" % bvh.uuid.uuid4().hex[:10], query=q)
        assert r.status == 404 and r.code == "NoSuchBucket", r


# --------------------------------------------------------------------------------------------
# prefix and delimiter

@pytest.mark.parametrize("prefix", ["", "c", "c/", "c/d", "c/d/", "c/1", "c/1.txt", "e/", "z", "a.", "C/", "c//"])
def test_prefix(tree, prefix):
    want = sorted(k for k in TREE if k.startswith(prefix))
    got = [o["Key"] for o in tree.s3.list_objects_v2(Bucket=tree.name, Prefix=prefix).get("Contents", [])]
    assert got == want
    got1 = [o["Key"] for o in tree.s3.list_objects(Bucket=tree.name, Prefix=prefix).get("Contents", [])]
    assert got1 == want


@pytest.mark.parametrize("prefix,delim", [("", "/"), ("c/", "/"), ("c/d/", "/"), ("c", "/"), ("", "."), ("", "t"), ("e", "/"), ("", "/x"),
                                          ("zz", "/"), ("c/d/3", "/"), ("", "c/"), ("", "txt")])
@pytest.mark.parametrize("op", ["list_objects_v2", "list_objects"])
def test_delimiter_rolls_keys_up_into_common_prefixes(tree, op, prefix, delim):
    entries = model(TREE, prefix, delim)
    kw = dict(Bucket=tree.name, Prefix=prefix, Delimiter=delim)
    r = getattr(tree.s3, op)(**kw)
    assert page_split(r) == split(entries), r
    if op == "list_objects_v2":
        assert r["KeyCount"] == len(entries), "KeyCount counts keys and common prefixes"
    assert r.get("Delimiter") == delim


def test_delimiter_prefix_and_contents_document(tree):
    r = raw_list(tree, delimiter="/")
    x = r.xml()
    assert x.findtext("Delimiter") == "/"
    assert [c.findtext("Prefix") for c in x.findall("CommonPrefixes")] == ["c/", "e/"]
    assert [c.findtext("Key") for c in x.findall("Contents")] == ["a.txt", "b.txt", "f"]
    assert x.findtext("KeyCount") == "5"


def test_multi_character_delimiter():
    bk = bvh.fresh_bucket("listmd")
    keys = ["x--1", "x--2", "x-3", "y", "y--z--w", "z--"]
    put_many(bk, keys)
    r = bk.s3.list_objects_v2(Bucket=bk.name, Delimiter="--")
    assert sorted(p["Prefix"] for p in r["CommonPrefixes"]) == ["x--", "y--", "z--"]
    assert sorted(o["Key"] for o in r["Contents"]) == ["x-3", "y"]
    r = bk.s3.list_objects_v2(Bucket=bk.name, Prefix="y--", Delimiter="--")
    assert [p["Prefix"] for p in r["CommonPrefixes"]] == ["y--z--"]


def test_directory_marker_object_appears_in_its_own_prefix_listing():
    bk = bvh.fresh_bucket("listdir")
    put_many(bk, ["dir/", "dir/a", "dir/sub/b"])
    r = bk.s3.list_objects_v2(Bucket=bk.name, Prefix="dir/", Delimiter="/")
    assert [o["Key"] for o in r["Contents"]] == ["dir/", "dir/a"] and [p["Prefix"] for p in r["CommonPrefixes"]] == ["dir/sub/"]


def test_query_encoding_of_prefix_plus_is_space_and_percent_2b_is_plus():
    bk = bvh.fresh_bucket("listplus")
    put_many(bk, ["a b/1", "a+b/2", "a%20b/3"])
    r = bk.raw().request("GET", "/" + bk.name, query="list-type=2&prefix=a+b%2F")             # '+' in a query is a space
    assert r.status == 200 and [e.text for e in r.xml().findall("Contents/Key")] == ["a b/1"], r.text
    r = bk.raw().request("GET", "/" + bk.name, query="list-type=2&prefix=a%2Bb%2F")           # %2B is a literal plus
    assert [e.text for e in r.xml().findall("Contents/Key")] == ["a+b/2"], r.text
    r = bk.raw().request("GET", "/" + bk.name, query="list-type=2&prefix=a%2520b")            # %25 is a percent sign
    assert [e.text for e in r.xml().findall("Contents/Key")] == ["a%20b/3"], r.text


# --------------------------------------------------------------------------------------------
# paging

@pytest.mark.parametrize("op", ["list_objects_v2", "list_objects"])
@pytest.mark.parametrize("size", [1, 2, 3, 4, 5, 7, 8, 9])
@pytest.mark.parametrize("params", [{}, {"Delimiter": "/"}, {"Prefix": "c/"}, {"Prefix": "c/", "Delimiter": "/"}], ids=["plain", "delim", "prefix", "prefix+delim"])
def test_paging_walks_every_entry_exactly_once(tree, op, size, params):
    check_paging(tree, TREE, op, size, **params)


def test_max_keys_zero_returns_nothing_and_is_not_truncated(tree):
    r = tree.s3.list_objects_v2(Bucket=tree.name, MaxKeys=0)
    assert r["KeyCount"] == 0 and r["IsTruncated"] is False and "Contents" not in r and "NextContinuationToken" not in r
    r = tree.s3.list_objects(Bucket=tree.name, MaxKeys=0)
    assert r["IsTruncated"] is False and "Contents" not in r


def test_truncated_page_carries_a_continuation_token(tree):
    r = raw_list(tree, **{"max-keys": "3"})
    x = r.xml()
    assert x.findtext("IsTruncated") == "true" and x.findtext("MaxKeys") == "3" and x.findtext("KeyCount") == "3"
    token = x.findtext("NextContinuationToken")
    assert token
    r2 = raw_list(tree, **{"max-keys": "3", "continuation-token": token})
    x2 = r2.xml()
    assert x2.findtext("ContinuationToken") == token, "the request's token is echoed"
    assert [c.findtext("Key") for c in x2.findall("Contents")] == utf8_sorted(TREE)[3:6]


@pytest.mark.parametrize("bad", ["-1", "abc", "1.5", "99999999999999999999"])
def test_invalid_max_keys_is_invalidargument(tree, bad):
    r = raw_list(tree, **{"max-keys": bad})
    assert r.status == 400 and r.code == "InvalidArgument", r


def test_max_keys_above_1000_is_capped_at_1000():
    bk = bvh.fresh_bucket("listcap")
    keys = ["k%04d" % i for i in range(1010)]
    put_many(bk, keys)
    r = raw_list(bk, **{"max-keys": "5000"})
    x = r.xml()
    assert r.status == 200 and len(x.findall("Contents")) == 1000 and x.findtext("IsTruncated") == "true", (r.status, len(x.findall("Contents")))
    assert x.findtext("NextContinuationToken")
    r = raw_list(bk)
    assert len(r.xml().findall("Contents")) == 1000, "the default page is 1000 keys"


def test_exactly_one_full_page_is_not_truncated():
    bk = bvh.fresh_bucket("listfull")
    put_many(bk, ["k%04d" % i for i in range(1000)])
    x = raw_list(bk).xml()
    assert x.findtext("IsTruncated") == "false" and x.findtext("KeyCount") == "1000" and x.find("NextContinuationToken") is None
    bk.put("k1000", b"x")
    x = raw_list(bk).xml()
    assert x.findtext("IsTruncated") == "true" and x.findtext("NextContinuationToken")


def test_2345_keys_in_three_pages():
    bk = bvh.fresh_bucket("list2k")
    keys = ["k%05d" % i for i in range(2345)]
    put_many(bk, keys)
    pages = list_pages(bk)
    assert [len(p["Contents"]) for p in pages] == [1000, 1000, 345]
    assert [o["Key"] for p in pages for o in p["Contents"]] == keys
    assert [p["IsTruncated"] for p in pages] == [True, True, False]
    assert "NextContinuationToken" not in pages[-1]
    v1 = list_pages(bk, op="list_objects")
    assert [o["Key"] for p in v1 for o in p["Contents"]] == keys
    assert bk.keys() == keys


def test_1200_common_prefixes_page_across_1000():
    bk = bvh.fresh_bucket("listpfx")
    put_many(bk, ["d%04d/x" % i for i in range(1200)])
    pages = list_pages(bk, Delimiter="/")
    assert [len(p["CommonPrefixes"]) for p in pages] == [1000, 200]
    assert [pp["Prefix"] for p in pages for pp in p["CommonPrefixes"]] == ["d%04d/" % i for i in range(1200)]
    assert all("Contents" not in p for p in pages)
    assert [p["KeyCount"] for p in pages] == [1000, 200]


def test_a_page_ending_on_a_common_prefix_never_repeats_it():
    bk = bvh.fresh_bucket("listrep")
    keys = ["a/1", "a/2", "a/3", "b", "c/1", "c/2", "d"]
    put_many(bk, keys)
    for op in ("list_objects_v2", "list_objects"):
        seen = []
        for page in list_pages(bk, op=op, Delimiter="/", MaxKeys=1):
            seen += [p["Prefix"] for p in page.get("CommonPrefixes", [])] + [o["Key"] for o in page.get("Contents", [])]
        assert seen == ["a/", "b", "c/", "d"], (op, seen)
    # V1 NextMarker is the common prefix itself; handing it back as Marker skips the whole prefix
    r = bk.s3.list_objects(Bucket=bk.name, Delimiter="/", MaxKeys=1)
    assert r["IsTruncated"] and r["NextMarker"] == "a/"
    r2 = bk.s3.list_objects(Bucket=bk.name, Delimiter="/", MaxKeys=5, Marker="a/")
    assert page_split(r2) == (["b", "d"], ["c/"]), r2


def test_v1_next_marker_is_present_with_a_delimiter(tree):
    x = raw_req(tree, "GET", None, query={"delimiter": "/", "max-keys": "2"}).xml()
    assert x.findtext("IsTruncated") == "true" and x.findtext("NextMarker")
    assert x.findtext("Delimiter") == "/" and x.findtext("MaxKeys") == "2"


def test_v1_marker_and_v2_start_after(tree):
    allk = utf8_sorted(TREE)
    for i, k in enumerate(allk):
        assert [o["Key"] for o in tree.s3.list_objects(Bucket=tree.name, Marker=k).get("Contents", [])] == allk[i + 1:]
        assert [o["Key"] for o in tree.s3.list_objects_v2(Bucket=tree.name, StartAfter=k).get("Contents", [])] == allk[i + 1:]
    # a marker that is not an existing key
    assert [o["Key"] for o in tree.s3.list_objects_v2(Bucket=tree.name, StartAfter="c/1.5").get("Contents", [])] == [k for k in allk if k > "c/1.5"]
    assert [o["Key"] for o in tree.s3.list_objects(Bucket=tree.name, Marker="zzz").get("Contents", [])] == []
    r = raw_list(tree, **{"start-after": "c/2.txt"}).xml()
    assert r.findtext("StartAfter") == "c/2.txt"


def test_start_after_combines_with_prefix(tree):
    got = [o["Key"] for o in tree.s3.list_objects_v2(Bucket=tree.name, Prefix="c/", StartAfter="c/2.txt").get("Contents", [])]
    assert got == ["c/d/3.txt", "c/d/4.txt"]


def test_continuation_token_wins_over_start_after(tree):
    r1 = tree.s3.list_objects_v2(Bucket=tree.name, MaxKeys=2)
    tok = r1["NextContinuationToken"]
    r2 = tree.s3.list_objects_v2(Bucket=tree.name, MaxKeys=2, ContinuationToken=tok, StartAfter="zzz")
    assert [o["Key"] for o in r2["Contents"]] == utf8_sorted(TREE)[2:4]


@pytest.mark.parametrize("token", ["garbage", "!!!", "AAAA", "%00", "x" * 300])
def test_garbage_continuation_token_is_an_error(tree, token):
    r = raw_list(tree, **{"continuation-token": token})
    assert r.status == 400 and r.code in ("InvalidArgument", "InvalidRequest"), r


def test_tokens_stay_valid_after_the_bucket_changes():
    bk = bvh.fresh_bucket("listtok")
    keys = ["k%02d" % i for i in range(10)]
    put_many(bk, keys)
    r1 = bk.s3.list_objects_v2(Bucket=bk.name, MaxKeys=4)
    tok = r1["NextContinuationToken"]
    bk.delete("k03")                      # the last key of page 1 vanishes: the token still means "after k03"
    bk.put("k03a", b"between")
    r2 = bk.s3.list_objects_v2(Bucket=bk.name, MaxKeys=100, ContinuationToken=tok)
    assert [o["Key"] for o in r2["Contents"]] == ["k03a"] + keys[4:]


def test_list_type_other_than_2_is_invalidargument(tree):
    r = raw_list(tree, **{"list-type": "3"})
    assert r.status == 400 and r.code == "InvalidArgument", r
    r = raw_list(tree, **{"list-type": "two"})
    assert r.status == 400 and r.code == "InvalidArgument", r


# --------------------------------------------------------------------------------------------
# encoding-type=url

def test_encoding_type_url_encodes_keys_prefixes_and_markers():
    bk = bvh.fresh_bucket("listenc")
    keys = ["sp ace/k 1", "sp ace/é", "plus+/x", "sp ace/日本"]
    put_many(bk, keys)
    r = raw_list(bk, prefix="sp ace/", delimiter="/", **{"encoding-type": "url", "start-after": "sp ace/a"})
    assert r.status == 200, r
    x = r.xml()
    assert x.findtext("EncodingType") == "url"
    assert unq(x.findtext("Prefix")) == "sp ace/" and " " not in x.findtext("Prefix")
    assert unq(x.findtext("Delimiter")) == "/"
    assert unq(x.findtext("StartAfter")) == "sp ace/a" and " " not in x.findtext("StartAfter")
    got = [unq(e.text) for e in x.findall("Contents/Key")]
    assert got == utf8_sorted([k for k in keys if k.startswith("sp ace/")])
    assert all(" " not in e.text and "é" not in e.text for e in x.findall("Contents/Key")), "keys must be percent-encoded"
    r = raw_list(bk, delimiter="/", **{"encoding-type": "url"})
    assert sorted(unq(e.text) for e in r.xml().findall("CommonPrefixes/Prefix")) == ["plus+/", "sp ace/"]
    assert all(" " not in e.text for e in r.xml().findall("CommonPrefixes/Prefix"))


def test_v1_encoding_type_url_encodes_marker_and_next_marker():
    bk = bvh.fresh_bucket("listenc1")
    put_many(bk, ["a b", "c d", "e f"])
    x = raw_list(bk, **{"list-type": None, "encoding-type": "url", "max-keys": "1", "delimiter": "x", "marker": "a b"}).xml()
    assert unq(x.findtext("Marker")) == "a b" and " " not in x.findtext("Marker")
    assert unq(x.findtext("NextMarker")) == "c d" and " " not in x.findtext("NextMarker")


def test_unknown_encoding_type_is_invalidargument(tree):
    r = raw_list(tree, **{"encoding-type": "base64"})
    assert r.status == 400 and r.code == "InvalidArgument", r


def test_unencoded_listing_returns_keys_verbatim():
    bk = bvh.fresh_bucket("listraw")
    put_many(bk, ["sp ace", "é", "plus+"])
    x = raw_list(bk).xml()
    assert sorted(e.text for e in x.findall("Contents/Key")) == sorted(["sp ace", "é", "plus+"])
    assert x.find("EncodingType") is None


# --------------------------------------------------------------------------------------------
# order: raw UTF-8 bytes

BYTE_ORDER_KEYS = ["a", "a b", "a-b", "a.b", "a/b", "a0", "A", "Z", "_", "~", "é", "ÿ", "Ā", "߿", "ࠀ", "�",
                   "～", "\U00010000", "\U0001f600", "\U0010ffff", " ", "!", "éa", "あ"]


def test_listing_is_in_raw_utf8_byte_order():
    bk = bvh.fresh_bucket("listorder")
    # a UTF-16 ordering would put U+10000..U+10FFFF (surrogates D800..) before U+E000..U+FFFF
    put_many(bk, BYTE_ORDER_KEYS)
    want = utf8_sorted(BYTE_ORDER_KEYS)
    assert bk.keys() == want
    assert want.index("～") < want.index("\U0001f600")
    v1 = [o["Key"] for p in list_pages(bk, op="list_objects") for o in p["Contents"]]
    assert v1 == want
    # paging one key at a time preserves the order too
    paged = [o["Key"] for p in list_pages(bk, MaxKeys=1) for o in p["Contents"]]
    assert paged == want
    # prefix and start-after use the same order
    for k in ("～", "\U0001f600", "a/b", "~"):
        assert bk.keys(StartAfter=k) == [x for x in want if x.encode() > k.encode()], k


def test_slash_sorts_by_byte_value_not_as_a_separator():
    bk = bvh.fresh_bucket("listslash")
    keys = ["a", "a-b", "a.b", "a/b", "a0", "a b", "a!", "aé"]
    put_many(bk, keys)
    assert bk.keys() == utf8_sorted(keys) == ["a", "a b", "a!", "a-b", "a.b", "a/b", "a0", "aé"]
    r = bk.s3.list_objects_v2(Bucket=bk.name, Delimiter="/")
    assert page_split(r) == (["a", "a b", "a!", "a-b", "a.b", "a0", "aé"], ["a/"])


# --------------------------------------------------------------------------------------------
# consistency and visibility

def test_list_after_write_is_immediate():
    bk = bvh.fresh_bucket("listraw2")
    for i in range(20):
        k = "k%02d" % i
        bk.put(k, b"x" * (i + 1))
        got = bk.s3.list_objects_v2(Bucket=bk.name)["Contents"]
        assert got[-1]["Key"] == k and got[-1]["Size"] == i + 1 and len(got) == i + 1
    bk.put("k05", b"replaced-and-longer")
    sizes = {o["Key"]: o["Size"] for o in bk.s3.list_objects_v2(Bucket=bk.name)["Contents"]}
    assert sizes["k05"] == len(b"replaced-and-longer") and len(sizes) == 20
    for i in range(20):
        bk.delete("k%02d" % i)
        assert len(bk.keys()) == 19 - i


def test_open_multipart_uploads_and_their_parts_are_never_listed():
    bk = bvh.fresh_bucket("listmpu")
    up = bk.s3.create_multipart_upload(Bucket=bk.name, Key="big/object")
    bk.s3.upload_part(Bucket=bk.name, Key="big/object", UploadId=up["UploadId"], PartNumber=1, Body=b"p" * (5 * bvh.MiB))
    assert bk.keys() == []
    r = bk.s3.list_objects_v2(Bucket=bk.name, Delimiter="/")
    assert r["KeyCount"] == 0 and "CommonPrefixes" not in r
    bk.s3.abort_multipart_upload(Bucket=bk.name, Key="big/object", UploadId=up["UploadId"])
    assert bk.keys() == []


def test_overwritten_object_is_listed_once_with_the_new_etag():
    bk = bvh.fresh_bucket("listover")
    bk.put("k", b"first")
    bk.put("k", b"second version")
    objs = bk.s3.list_objects_v2(Bucket=bk.name)["Contents"]
    assert len(objs) == 1 and objs[0]["Size"] == len(b"second version") and objs[0]["ETag"] == bk.head("k")["ETag"]


def test_virtual_hosted_style_listing(tree):
    got = tree.vs3.list_objects_v2(Bucket=tree.name, Prefix="c/", Delimiter="/")
    assert [o["Key"] for o in got["Contents"]] == ["c/1.txt", "c/2.txt"] and [p["Prefix"] for p in got["CommonPrefixes"]] == ["c/d/"]
    assert [o["Key"] for o in tree.vs3.list_objects(Bucket=tree.name).get("Contents", [])] == utf8_sorted(TREE)


def test_listing_checksum_algorithm_field():
    bk = bvh.fresh_bucket("listck")
    bk.put("with", b"data", ChecksumAlgorithm="CRC32C")
    bvh.make_client(bk.ak, bk.sk, checksum_calculation="when_required").put_object(Bucket=bk.name, Key="without", Body=b"data")
    c = {o["Key"]: o for o in bk.s3.list_objects_v2(Bucket=bk.name)["Contents"]}
    assert c["with"].get("ChecksumAlgorithm") == ["CRC32C"], c["with"]
    assert not c["without"].get("ChecksumAlgorithm"), c["without"]


def test_listing_timestamps_have_second_resolution_like_the_last_modified_header():
    """S3 always writes LastModified as ...:SS.000Z in listings, the same instant as the Last-Modified header. Tools that
    compare the two (aws s3 sync --exact-timestamps) never converge when the listing carries real milliseconds."""
    import email.utils
    bk = bvh.fresh_bucket("listlm")
    for i in range(6):
        bk.put("k%d" % i, b"x")
        time.sleep(0.07)
    x = raw_list(bk).xml()
    for c in x.findall("Contents"):
        listed = c.findtext("LastModified")
        header = email.utils.parsedate_to_datetime(raw_req(bk, "HEAD", c.findtext("Key")).header("last-modified"))
        assert listed.endswith(".000Z"), "listing timestamp %r carries milliseconds; HEAD says %s" % (listed, header)
        assert listed[:19] == header.strftime("%Y-%m-%dT%H:%M:%S"), (listed, header)
