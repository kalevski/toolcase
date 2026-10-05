"""Multipart uploads: create, parts, complete, abort, listings, part copy, part reads (spec 5.6, 5.4.2, 5.11)."""
import concurrent.futures
import datetime
import hashlib
import io
import threading
import time

import pytest
from boto3.s3.transfer import TransferConfig

import bvh
from bvh import KiB, MiB, hdr, md5hex, multipart_etag, rnd, s3error, uniq
from bvx_a import ISO_MS, raw_get, raw_head, raw_req

MIN = 5 * MiB


def create(bk, key=None, **kw):
    key = key or uniq("mp")
    return key, bk.s3.create_multipart_upload(Bucket=bk.name, Key=key, **kw)["UploadId"]


def put_part(bk, key, uid, n, body, **kw):
    return bk.s3.upload_part(Bucket=bk.name, Key=key, UploadId=uid, PartNumber=n, Body=body, **kw)


def complete(bk, key, uid, etags, **kw):
    """etags: list of (part number, etag) in the order to send."""
    return bk.s3.complete_multipart_upload(Bucket=bk.name, Key=key, UploadId=uid,
                                           MultipartUpload={"Parts": [{"PartNumber": n, "ETag": e} for n, e in etags]}, **kw)


def upload_all(bk, key, uid, bodies, start=1):
    return [(start + i, put_part(bk, key, uid, start + i, b)["ETag"]) for i, b in enumerate(bodies)]


# --------------------------------------------------------------------------------------------
# the happy path

def test_three_part_upload_roundtrip(bk):
    parts = [rnd(MIN), rnd(MIN), rnd(123)]
    key, uid = create(bk)
    assert uid and isinstance(uid, str)
    cr = bk.s3.create_multipart_upload(Bucket=bk.name, Key="x")
    assert cr["Bucket"] == bk.name and cr["Key"] == "x"
    ets = []
    for i, p in enumerate(parts, 1):
        r = put_part(bk, key, uid, i, p)
        assert r["ETag"] == '"%s"' % md5hex(p), "the part ETag is the quoted MD5 of the part"
        ets.append((i, r["ETag"]))
    done = complete(bk, key, uid, ets)
    assert done["Bucket"] == bk.name and done["Key"] == key and done["Location"]
    assert done["ETag"] == '"%s"' % multipart_etag(parts), "the final ETag is md5(md5 parts)-N"
    assert bk.read(key) == b"".join(parts)
    h = bk.head(key)
    assert h["ContentLength"] == 2 * MIN + 123 and h["ETag"] == done["ETag"]
    listed = bk.s3.list_objects_v2(Bucket=bk.name, Prefix=key)["Contents"][0]
    assert listed["Size"] == 2 * MIN + 123 and listed["ETag"] == done["ETag"]
    assert bvh.hdr(h, "x-binvault-version")


def test_complete_response_document(bk):
    body = rnd(1000)
    key, uid = create(bk, "doc/key with space")
    ets = upload_all(bk, key, uid, [body])
    xml = ('<CompleteMultipartUpload xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Part><PartNumber>1</PartNumber><ETag>%s</ETag></Part>'
           '</CompleteMultipartUpload>' % ets[0][1])
    r = raw_req(bk, "POST", key, query={"uploadId": uid}, body=xml, headers={"Content-Type": "application/xml"})
    assert r.status == 200, r
    x = r.xml()
    assert x.tag == "CompleteMultipartUploadResult"
    assert x.findtext("Bucket") == bk.name and x.findtext("Key") == key
    assert x.findtext("ETag") == '"%s-1"' % hashlib.md5(hashlib.md5(body).digest()).hexdigest()
    assert x.findtext("Location")
    assert r.header("content-type", "").startswith("application/xml")


def test_single_small_part_is_a_valid_upload(bk):
    key, uid = create(bk)
    ets = upload_all(bk, key, uid, [b"x"])
    done = complete(bk, key, uid, ets)
    assert done["ETag"] == '"%s"' % multipart_etag([b"x"]) and done["ETag"].endswith('-1"')
    assert bk.read(key) == b"x"


def test_exactly_5mib_parts_are_big_enough():
    bk = bvh.fresh_bucket("mp5")
    parts = [rnd(MIN), rnd(MIN)]
    key, uid = create(bk)
    complete(bk, key, uid, upload_all(bk, key, uid, parts))
    assert bk.read(key) == parts[0] + parts[1]


def test_part_numbers_need_not_be_contiguous(bk):
    parts = {1: rnd(MIN), 5: rnd(MIN), 10: rnd(77)}
    key, uid = create(bk)
    ets = [(n, put_part(bk, key, uid, n, b)["ETag"]) for n, b in parts.items()]
    done = complete(bk, key, uid, ets)
    assert done["ETag"] == '"%s"' % multipart_etag(list(parts.values()))
    assert bk.read(key) == b"".join(parts.values())


def test_parts_may_be_uploaded_in_any_order_and_concurrently(bk):
    parts = [rnd(MIN) for _ in range(4)] + [rnd(1000)]
    key, uid = create(bk)
    order = [4, 2, 0, 3, 1]
    res = bvh.run_threads([(lambda i=i: (i + 1, put_part(bk, key, uid, i + 1, parts[i])["ETag"])) for i in order])
    assert all(isinstance(r, tuple) for r in res), res
    ets = sorted(res)
    done = complete(bk, key, uid, ets)
    assert done["ETag"] == '"%s"' % multipart_etag(parts)
    assert bk.read(key) == b"".join(parts)


def test_ten_thousandth_part_number_is_accepted(bk):
    key, uid = create(bk)
    et = put_part(bk, key, uid, 10000, b"last")["ETag"]
    complete(bk, key, uid, [(10000, et)])
    assert bk.read(key) == b"last"


# --------------------------------------------------------------------------------------------
# validation

@pytest.mark.parametrize("n", [0, -1, 10001, 100000])
def test_part_number_out_of_range_is_invalidargument(bk, n):
    key, uid = create(bk)
    r = bk.raw().request("PUT", "/%s/%s" % (bk.name, key), query={"partNumber": str(n), "uploadId": uid}, body=b"x")
    assert r.status == 400 and r.code == "InvalidArgument", r


@pytest.mark.parametrize("n", ["abc", "1.5", ""])
def test_part_number_not_a_number_is_an_error(bk, n):
    key, uid = create(bk)
    r = bk.raw().request("PUT", "/%s/%s" % (bk.name, key), query={"partNumber": n, "uploadId": uid}, body=b"x")
    assert r.status == 400 and r.code in ("InvalidArgument", "InvalidRequest"), r


def test_a_non_last_part_below_5mib_is_entity_too_small_and_the_upload_survives(bk):
    key, uid = create(bk)
    small = rnd(MIN - 1)
    p2 = rnd(10)
    ets = upload_all(bk, key, uid, [small, p2])              # UploadPart itself accepts any size
    with s3error("EntityTooSmall", 400):
        complete(bk, key, uid, ets)
    with s3error(None, 404):
        bk.head(key)
    # repair: replace part 1 with a big enough one and complete
    big = rnd(MIN)
    ets[0] = (1, put_part(bk, key, uid, 1, big)["ETag"])
    done = complete(bk, key, uid, ets)
    assert done["ETag"] == '"%s"' % multipart_etag([big, p2])
    assert bk.read(key) == big + p2


def test_the_last_part_may_be_any_size_even_larger_than_the_others(bk):
    parts = [rnd(MIN), rnd(MIN + 4096)]
    key, uid = create(bk)
    complete(bk, key, uid, upload_all(bk, key, uid, parts))
    assert bk.read(key) == b"".join(parts)


def test_complete_with_parts_out_of_order_is_invalidpartorder(bk):
    key, uid = create(bk)
    ets = upload_all(bk, key, uid, [rnd(MIN), rnd(10)])
    with s3error("InvalidPartOrder", 400):
        complete(bk, key, uid, list(reversed(ets)))
    complete(bk, key, uid, ets)               # the upload is still open


def test_complete_with_a_duplicated_part_number_is_invalidpartorder(bk):
    key, uid = create(bk)
    ets = upload_all(bk, key, uid, [rnd(10)])
    with s3error("InvalidPartOrder", 400):
        complete(bk, key, uid, [ets[0], ets[0]])


def test_complete_with_a_wrong_etag_is_invalidpart(bk):
    key, uid = create(bk)
    ets = upload_all(bk, key, uid, [rnd(MIN), rnd(10)])
    with s3error("InvalidPart", 400):
        complete(bk, key, uid, [(1, '"%s"' % ("0" * 32)), ets[1]])
    with s3error(None, 404):
        bk.head(key)


def test_complete_naming_a_part_that_was_never_uploaded_is_invalidpart(bk):
    key, uid = create(bk)
    ets = upload_all(bk, key, uid, [rnd(MIN)])
    with s3error("InvalidPart", 400):
        complete(bk, key, uid, ets + [(2, '"%s"' % md5hex(b"never"))])
    with s3error("InvalidPart", 400):
        complete(bk, key, uid, [(7, ets[0][1])])


def test_complete_accepts_etags_without_quotes(bk):
    body = rnd(300)
    key, uid = create(bk)
    ets = upload_all(bk, key, uid, [body])
    done = complete(bk, key, uid, [(1, ets[0][1].strip('"'))])
    assert done["ETag"] == '"%s"' % multipart_etag([body])


def test_complete_without_parts_is_malformedxml(bk):
    key, uid = create(bk)
    upload_all(bk, key, uid, [rnd(10)])
    with s3error("MalformedXML", 400):
        bk.s3.complete_multipart_upload(Bucket=bk.name, Key=key, UploadId=uid, MultipartUpload={"Parts": []})
    r = raw_req(bk, "POST", key, query={"uploadId": uid}, body="<CompleteMultipartUpload></CompleteMultipartUpload>")
    assert r.status == 400 and r.code == "MalformedXML", r
    r = raw_req(bk, "POST", key, query={"uploadId": uid}, body="not xml at all")
    assert r.status == 400 and r.code == "MalformedXML", r


def test_reuploading_a_part_replaces_it(bk):
    key, uid = create(bk)
    first, second = rnd(MIN), rnd(MIN + 1)
    e1 = put_part(bk, key, uid, 1, first)["ETag"]
    e2 = put_part(bk, key, uid, 1, second)["ETag"]
    assert e1 != e2
    parts = bk.s3.list_parts(Bucket=bk.name, Key=key, UploadId=uid)["Parts"]
    assert [(p["PartNumber"], p["ETag"], p["Size"]) for p in parts] == [(1, e2, MIN + 1)]
    with s3error("InvalidPart", 400):
        complete(bk, key, uid, [(1, e1)])
    tail = rnd(5)
    et = put_part(bk, key, uid, 2, tail)["ETag"]
    complete(bk, key, uid, [(1, e2), (2, et)])
    assert bk.read(key) == second + tail


def test_parts_not_named_in_complete_are_left_out(bk):
    a, b, c = rnd(MIN), rnd(MIN), rnd(30)
    key, uid = create(bk)
    ets = upload_all(bk, key, uid, [a, b, c])
    done = complete(bk, key, uid, [ets[0], ets[2]])
    assert done["ETag"] == '"%s"' % multipart_etag([a, c])
    assert bk.read(key) == a + c


def test_unknown_upload_id_is_nosuchupload(bk):
    key = uniq("nu")
    bogus = "bogus-upload-id-0000"
    B = bk.name
    for fn in (lambda: bk.s3.upload_part(Bucket=B, Key=key, UploadId=bogus, PartNumber=1, Body=b"x"),
               lambda: bk.s3.complete_multipart_upload(Bucket=B, Key=key, UploadId=bogus, MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": '"a"'}]}),
               lambda: bk.s3.abort_multipart_upload(Bucket=B, Key=key, UploadId=bogus),
               lambda: bk.s3.list_parts(Bucket=B, Key=key, UploadId=bogus)):
        with s3error("NoSuchUpload", 404):
            fn()


def test_an_upload_id_belongs_to_one_key(bk):
    key, uid = create(bk, "key-a")
    with s3error("NoSuchUpload", 404):
        put_part(bk, "key-b", uid, 1, b"x")
    with s3error("NoSuchUpload", 404):
        bk.s3.list_parts(Bucket=bk.name, Key="key-b", UploadId=uid)
    ets = upload_all(bk, "key-a", uid, [b"x"])
    with s3error("NoSuchUpload", 404):
        complete(bk, "key-b", uid, ets)
    with s3error("NoSuchUpload", 404):
        bk.s3.abort_multipart_upload(Bucket=bk.name, Key="key-b", UploadId=uid)
    complete(bk, "key-a", uid, ets)


def test_upload_part_content_md5_is_verified(bk):
    import base64
    key, uid = create(bk)
    body = rnd(5000)
    good = base64.b64encode(hashlib.md5(body).digest()).decode()
    assert put_part(bk, key, uid, 1, body, ContentMD5=good)["ETag"] == '"%s"' % md5hex(body)
    bad = base64.b64encode(hashlib.md5(b"other").digest()).decode()
    with s3error("BadDigest", 400):
        put_part(bk, key, uid, 2, body, ContentMD5=bad)
    with s3error("InvalidDigest", 400):
        put_part(bk, key, uid, 2, body, ContentMD5="@@@not-base64")
    assert [p["PartNumber"] for p in bk.s3.list_parts(Bucket=bk.name, Key=key, UploadId=uid)["Parts"]] == [1], "a rejected part must not be stored"


# --------------------------------------------------------------------------------------------
# abort

def test_abort_discards_the_upload(bk):
    key, uid = create(bk)
    upload_all(bk, key, uid, [rnd(MIN)])
    r = bk.s3.abort_multipart_upload(Bucket=bk.name, Key=key, UploadId=uid)
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 204
    with s3error("NoSuchUpload", 404):
        put_part(bk, key, uid, 2, b"x")
    with s3error("NoSuchUpload", 404):
        bk.s3.list_parts(Bucket=bk.name, Key=key, UploadId=uid)
    with s3error("NoSuchUpload", 404):
        complete(bk, key, uid, [(1, '"x"')])
    with s3error("NoSuchUpload", 404):
        bk.s3.abort_multipart_upload(Bucket=bk.name, Key=key, UploadId=uid)
    assert bk.s3.list_multipart_uploads(Bucket=bk.name).get("Uploads", []) == []
    assert bk.keys() == []


def test_abort_leaves_an_existing_object_alone(bk):
    bk.put("keep", b"original")
    uid = bk.s3.create_multipart_upload(Bucket=bk.name, Key="keep")["UploadId"]
    upload_all(bk, "keep", uid, [b"new"])
    assert bk.read("keep") == b"original", "an open upload must not change the visible object"
    bk.s3.abort_multipart_upload(Bucket=bk.name, Key="keep", UploadId=uid)
    assert bk.read("keep") == b"original"


def test_complete_replaces_the_object_atomically(bk):
    bk.put("swap", b"old content")
    key, uid = create(bk, "swap")
    ets = upload_all(bk, key, uid, [b"new content"])
    assert bk.read("swap") == b"old content"
    complete(bk, key, uid, ets)
    assert bk.read("swap") == b"new content"
    assert len(bk.keys()) == 1


def test_complete_twice_returns_the_same_result_and_leaves_one_object(bk):
    parts = [rnd(MIN), rnd(99)]
    key, uid = create(bk)
    ets = upload_all(bk, key, uid, parts)
    first = complete(bk, key, uid, ets)
    again = complete(bk, key, uid, ets)        # an SDK retry after a timeout (spec 5.6)
    assert again["ETag"] == first["ETag"] and again["Key"] == key and again["Bucket"] == bk.name
    assert bk.read(key) == b"".join(parts)
    # a different part list after completion is not a retry
    with s3error("NoSuchUpload", 404):
        complete(bk, key, uid, ets[:1])
    with s3error("NoSuchUpload", 404):
        bk.s3.list_parts(Bucket=bk.name, Key=key, UploadId=uid)


def test_repeated_complete_after_the_object_was_overwritten_still_answers_200(bk):
    key, uid = create(bk)
    ets = upload_all(bk, key, uid, [b"mine"])
    first = complete(bk, key, uid, ets)
    bk.put(key, b"someone else")
    again = complete(bk, key, uid, ets)
    assert again["ETag"] == first["ETag"]
    assert bk.read(key) == b"someone else", "a replayed Complete must not resurrect the old content"


# --------------------------------------------------------------------------------------------
# ListParts / ListMultipartUploads

def test_list_parts_document_and_paging(bk):
    key, uid = create(bk)
    bodies = {n: bytes([n]) * (n * 10) for n in (3, 1, 7, 5, 2, 6, 4)}
    for n in (3, 1, 7, 5, 2, 6, 4):                       # uploaded in a scrambled order
        put_part(bk, key, uid, n, bodies[n])
    r = bk.s3.list_parts(Bucket=bk.name, Key=key, UploadId=uid)
    assert [p["PartNumber"] for p in r["Parts"]] == [1, 2, 3, 4, 5, 6, 7]
    assert r["IsTruncated"] is False and r["Bucket"] == bk.name and r["Key"] == key and r["UploadId"] == uid
    assert r["StorageClass"] == "STANDARD"
    for p in r["Parts"]:
        assert p["Size"] == p["PartNumber"] * 10 and p["ETag"] == '"%s"' % md5hex(bodies[p["PartNumber"]])
        assert isinstance(p["LastModified"], datetime.datetime)
    # paging
    seen = []
    marker = 0
    pages = 0
    while True:
        r = bk.s3.list_parts(Bucket=bk.name, Key=key, UploadId=uid, MaxParts=3, PartNumberMarker=marker)
        pages += 1
        seen += [p["PartNumber"] for p in r["Parts"]]
        assert r["MaxParts"] == 3 and r["PartNumberMarker"] == marker
        if not r["IsTruncated"]:
            break
        marker = r["NextPartNumberMarker"]
        assert marker == r["Parts"][-1]["PartNumber"]
    assert seen == [1, 2, 3, 4, 5, 6, 7] and pages == 3
    r = bk.s3.list_parts(Bucket=bk.name, Key=key, UploadId=uid, PartNumberMarker=5)
    assert [p["PartNumber"] for p in r["Parts"]] == [6, 7]
    r = bk.s3.list_parts(Bucket=bk.name, Key=key, UploadId=uid, PartNumberMarker=7)
    assert r.get("Parts", []) == [] and r["IsTruncated"] is False


def test_list_parts_with_no_parts_yet(bk):
    key, uid = create(bk)
    r = bk.s3.list_parts(Bucket=bk.name, Key=key, UploadId=uid)
    assert r.get("Parts", []) == [] and r["IsTruncated"] is False


def test_list_parts_default_page_is_1000(bk):
    key, uid = create(bk)
    n = 1005
    with concurrent.futures.ThreadPoolExecutor(16) as ex:
        list(ex.map(lambda i: put_part(bk, key, uid, i, b"p"), range(1, n + 1)))
    r = bk.s3.list_parts(Bucket=bk.name, Key=key, UploadId=uid)
    assert len(r["Parts"]) == 1000 and r["IsTruncated"] is True and r["NextPartNumberMarker"] == 1000
    r = bk.s3.list_parts(Bucket=bk.name, Key=key, UploadId=uid, MaxParts=5000)
    assert len(r["Parts"]) == 1000


def test_list_multipart_uploads_document_and_filters(bk):
    ups = {}
    for key in ("b/one", "b/two", "a", "c", "b/one"):
        ups.setdefault(key, []).append(bk.s3.create_multipart_upload(Bucket=bk.name, Key=key)["UploadId"])
        time.sleep(0.01)
    r = bk.s3.list_multipart_uploads(Bucket=bk.name)
    got = [(u["Key"], u["UploadId"]) for u in r["Uploads"]]
    want = [(k, uid) for k in sorted(ups) for uid in ups[k]]
    assert [k for k, _ in got] == [k for k, _ in want], "uploads are sorted by key"
    assert sorted(got) == sorted(want), "every open upload is listed exactly once"        # (same-key order: see the test below)
    assert r["Bucket"] == bk.name and r["IsTruncated"] is False
    for u in r["Uploads"]:
        assert isinstance(u["Initiated"], datetime.datetime) and u["StorageClass"] == "STANDARD"
    x = raw_req(bk, "GET", None, query={"uploads": ""}).xml()
    assert x.tag == "ListMultipartUploadsResult"
    assert ISO_MS.match(x.find("Upload/Initiated").text)
    assert [k.text for k in x.findall("Upload/Key")] == [k for k, _ in want]
    r = bk.s3.list_multipart_uploads(Bucket=bk.name, Prefix="b/")
    assert [u["Key"] for u in r["Uploads"]] == ["b/one", "b/one", "b/two"]
    r = bk.s3.list_multipart_uploads(Bucket=bk.name, Delimiter="/")
    assert [p["Prefix"] for p in r["CommonPrefixes"]] == ["b/"] and [u["Key"] for u in r["Uploads"]] == ["a", "c"]
    r = bk.s3.list_multipart_uploads(Bucket=bk.name, Prefix="zzz")
    assert r.get("Uploads", []) == []


def test_list_multipart_uploads_paging(bk):
    uploads = []
    for key in ("k1", "k2", "k2", "k3", "k4"):
        uploads.append((key, bk.s3.create_multipart_upload(Bucket=bk.name, Key=key)["UploadId"]))
        time.sleep(0.01)
    want = sorted(uploads, key=lambda t: t[0])
    seen = []
    key_marker, uid_marker = "", ""
    for _ in range(10):
        kw = dict(Bucket=bk.name, MaxUploads=2)
        if key_marker:
            kw["KeyMarker"] = key_marker
        if uid_marker:
            kw["UploadIdMarker"] = uid_marker
        r = bk.s3.list_multipart_uploads(**kw)
        seen += [(u["Key"], u["UploadId"]) for u in r.get("Uploads", [])]
        assert r["MaxUploads"] == 2
        if not r["IsTruncated"]:
            break
        key_marker, uid_marker = r["NextKeyMarker"], r.get("NextUploadIdMarker", "")
    assert len(seen) == len(set(seen)) and sorted(seen) == sorted(want), "paging must list each upload exactly once"
    assert [k for k, _ in seen] == [k for k, _ in want]


def test_uploads_of_one_key_are_listed_in_initiation_order(bk):
    """AWS sorts ListMultipartUploads by key and then by initiation time; the order must also drive paging."""
    ids = []
    for _ in range(6):
        ids.append(bk.s3.create_multipart_upload(Bucket=bk.name, Key="same")["UploadId"])
        time.sleep(0.01)
    assert [u["UploadId"] for u in bk.s3.list_multipart_uploads(Bucket=bk.name)["Uploads"]] == ids
    seen, km, um = [], None, None
    for _ in range(10):
        kw = dict(Bucket=bk.name, MaxUploads=2)
        if km:
            kw.update(KeyMarker=km, UploadIdMarker=um)
        r = bk.s3.list_multipart_uploads(**kw)
        seen += [u["UploadId"] for u in r.get("Uploads", [])]
        if not r["IsTruncated"]:
            break
        km, um = r["NextKeyMarker"], r["NextUploadIdMarker"]
    assert seen == ids


def test_completed_and_aborted_uploads_disappear_from_the_listing(bk):
    k1, u1 = create(bk, "done")
    k2, u2 = create(bk, "gone")
    k3, u3 = create(bk, "open")
    complete(bk, k1, u1, upload_all(bk, k1, u1, [b"x"]))
    bk.s3.abort_multipart_upload(Bucket=bk.name, Key=k2, UploadId=u2)
    assert [(u["Key"], u["UploadId"]) for u in bk.s3.list_multipart_uploads(Bucket=bk.name)["Uploads"]] == [("open", u3)]


def test_list_multipart_uploads_encoding_type_url(bk):
    key = "dir with space/é file"
    k, uid = create(bk, key)
    r = bk.s3.list_multipart_uploads(Bucket=bk.name)          # boto3 asks for url encoding and decodes
    assert [u["Key"] for u in r["Uploads"]] == [key]
    x = raw_req(bk, "GET", None, query={"uploads": "", "encoding-type": "url"}).xml()
    assert x.findtext("EncodingType") == "url" and " " not in x.find("Upload/Key").text


# --------------------------------------------------------------------------------------------
# what the finished object carries

def test_headers_metadata_and_tags_given_at_create_apply_to_the_object(bk):
    key, uid = create(bk, ContentType="application/x-mine", CacheControl="max-age=9", ContentDisposition="attachment; filename=a.bin",
                      ContentLanguage="de", Metadata={"owner": "me", "Mixed": "Case"}, Tagging="env=prod&team=core",
                      Expires=datetime.datetime(2031, 5, 6, 7, 8, 9, tzinfo=datetime.timezone.utc))
    complete(bk, key, uid, upload_all(bk, key, uid, [b"payload"]))
    h = bk.head(key)
    assert h["ContentType"] == "application/x-mine" and h["CacheControl"] == "max-age=9"
    assert h["ContentDisposition"] == "attachment; filename=a.bin" and h["ContentLanguage"] == "de"
    assert h["Metadata"] == {"owner": "me", "mixed": "Case"}
    assert {t["Key"]: t["Value"] for t in bk.s3.get_object_tagging(Bucket=bk.name, Key=key)["TagSet"]} == {"env": "prod", "team": "core"}
    r = raw_head(bk, key)
    assert r.header("x-amz-tagging-count") == "2"
    import email.utils
    exp = datetime.datetime(2031, 5, 6, 7, 8, 9, tzinfo=datetime.timezone.utc)
    assert r.header("expires") == email.utils.format_datetime(exp, usegmt=True), r.raw_headers


def test_headers_sent_with_complete_or_parts_do_not_change_the_object(bk):
    key, uid = create(bk, ContentType="text/plain")
    ets = [(1, put_part(bk, key, uid, 1, b"abc", )["ETag"])]
    complete(bk, key, uid, ets)
    assert bk.head(key)["ContentType"] == "text/plain"


def test_default_content_type_of_a_multipart_object(bk):
    key, uid = create(bk)
    complete(bk, key, uid, upload_all(bk, key, uid, [b"abc"]))
    assert bk.head(key)["ContentType"] == "binary/octet-stream"


# --------------------------------------------------------------------------------------------
# reading parts back

@pytest.fixture(scope="module")
def mpobj():
    bk = bvh.fresh_bucket("mpread")
    parts = [rnd(MIN), rnd(MIN + 11), rnd(33)]
    key, uid = create(bk, "obj")
    done = complete(bk, key, uid, upload_all(bk, key, uid, parts))
    bk.parts, bk.etag = parts, done["ETag"]
    bk.put("single", b"one piece")
    return bk


@pytest.mark.parametrize("n", [1, 2, 3])
def test_get_object_by_part_number(mpobj, n):
    parts = mpobj.parts
    start = sum(len(p) for p in parts[:n - 1])
    total = sum(len(p) for p in parts)
    r = mpobj.get("obj", PartNumber=n)
    assert r["ResponseMetadata"]["HTTPStatusCode"] == 206
    assert r["Body"].read() == parts[n - 1]
    assert r["PartsCount"] == 3
    assert r["ContentLength"] == len(parts[n - 1])
    assert r["ContentRange"] == "bytes %d-%d/%d" % (start, start + len(parts[n - 1]) - 1, total)
    assert r["ETag"] == mpobj.etag
    h = mpobj.head("obj", PartNumber=n)
    assert h["ContentLength"] == len(parts[n - 1]) and h["PartsCount"] == 3 and h["ResponseMetadata"]["HTTPStatusCode"] == 206


def test_part_number_beyond_the_last_part_is_invalidpartnumber(mpobj):
    r = raw_get(mpobj, "obj", query={"partNumber": "4"})
    assert r.status == 416 and r.code == "InvalidPartNumber", r
    r = raw_head(mpobj, "obj", query={"partNumber": "4"})
    assert r.status == 416 and r.body == b""


@pytest.mark.parametrize("n", ["0", "-1", "abc", "10001"])
def test_invalid_part_number_on_get(mpobj, n):
    r = raw_get(mpobj, "obj", query={"partNumber": n})
    assert r.status in (400, 416) and r.code in ("InvalidArgument", "InvalidPartNumber"), r


def test_part_number_one_of_a_single_part_object_is_the_whole_object(mpobj):
    r = raw_get(mpobj, "single", query={"partNumber": "1"})
    assert r.status in (200, 206) and r.body == b"one piece", r
    r = raw_get(mpobj, "single", query={"partNumber": "2"})
    assert r.status == 416 and r.code == "InvalidPartNumber", r


def test_part_number_together_with_range_is_refused(mpobj):
    r = raw_get(mpobj, "obj", query={"partNumber": "1"}, headers={"Range": "bytes=0-10"})
    assert r.status == 400 and r.code in ("InvalidRequest", "InvalidArgument"), r


def test_plain_get_of_the_multipart_object_has_no_parts_count(mpobj):
    r = raw_get(mpobj, "obj", headers={"Range": "bytes=0-9"})
    assert r.status == 206 and r.body == mpobj.parts[0][:10]
    assert r.header("x-amz-mp-parts-count") is None


def test_part_number_read_reports_the_parts_count_header(mpobj):
    r = raw_head(mpobj, "obj", query={"partNumber": "2"})
    assert r.header("x-amz-mp-parts-count") == "3" and r.status == 206


def test_range_reads_across_part_boundaries(mpobj):
    parts = mpobj.parts
    whole = b"".join(parts)
    edge = len(parts[0])
    for a, b in ((edge - 5, edge + 5), (0, 0), (edge, edge), (len(whole) - 1, len(whole) - 1), (edge - 1, edge)):
        r = raw_get(mpobj, "obj", headers={"Range": "bytes=%d-%d" % (a, b)})
        assert r.status == 206 and r.body == whole[a:b + 1], (a, b)


# --------------------------------------------------------------------------------------------
# UploadPartCopy

@pytest.fixture(scope="module")
def src():
    bk = bvh.fresh_bucket("mpcopy")
    data = rnd(2 * MIN + 12345)
    bk.put("src", data)
    bk.data = data
    return bk


def test_upload_part_copy_ranges_assemble_the_source(src):
    key, uid = create(src, "dst")
    edges = [(0, MIN - 1), (MIN, 2 * MIN - 1), (2 * MIN, len(src.data) - 1)]
    ets = []
    for i, (a, b) in enumerate(edges, 1):
        r = src.s3.upload_part_copy(Bucket=src.name, Key=key, UploadId=uid, PartNumber=i, CopySource={"Bucket": src.name, "Key": "src"},
                                    CopySourceRange="bytes=%d-%d" % (a, b))
        assert r["CopyPartResult"]["ETag"] == '"%s"' % md5hex(src.data[a:b + 1])
        assert isinstance(r["CopyPartResult"]["LastModified"], datetime.datetime)
        ets.append((i, r["CopyPartResult"]["ETag"]))
    done = complete(src, key, uid, ets)
    assert done["ETag"] == '"%s"' % multipart_etag([src.data[a:b + 1] for a, b in edges])
    assert src.read(key) == src.data


def test_upload_part_copy_without_a_range_copies_the_whole_object(src):
    key, uid = create(src, "dst-whole")
    r = src.s3.upload_part_copy(Bucket=src.name, Key=key, UploadId=uid, PartNumber=1, CopySource={"Bucket": src.name, "Key": "src"})
    complete(src, key, uid, [(1, r["CopyPartResult"]["ETag"])])
    assert src.read(key) == src.data


def test_upload_part_copy_mixed_with_uploaded_parts(src):
    key, uid = create(src, "dst-mixed")
    a = src.s3.upload_part_copy(Bucket=src.name, Key=key, UploadId=uid, PartNumber=1, CopySource={"Bucket": src.name, "Key": "src"},
                                CopySourceRange="bytes=0-%d" % (MIN - 1))["CopyPartResult"]["ETag"]
    tail = rnd(100)
    b = put_part(src, key, uid, 2, tail)["ETag"]
    complete(src, key, uid, [(1, a), (2, b)])
    assert src.read(key) == src.data[:MIN] + tail


def test_upload_part_copy_range_edges(src):
    key, uid = create(src, "dst-edge")
    n = len(src.data)
    ok = src.s3.upload_part_copy(Bucket=src.name, Key=key, UploadId=uid, PartNumber=1, CopySource={"Bucket": src.name, "Key": "src"},
                                 CopySourceRange="bytes=%d-%d" % (n - 1, n - 1))
    assert ok["CopyPartResult"]["ETag"] == '"%s"' % md5hex(src.data[-1:])
    for rng in ("bytes=%d-%d" % (n, n + 5), "bytes=5-2", "bytes=abc", "5-10", "bytes=-10", "bytes=10-"):
        r = src.raw().request("PUT", "/%s/%s" % (src.name, key), query={"partNumber": "2", "uploadId": uid},
                              headers={"x-amz-copy-source": "/%s/src" % src.name, "x-amz-copy-source-range": rng})
        assert r.status in (400, 416) and r.code in ("InvalidArgument", "InvalidRequest", "InvalidRange"), (rng, r)


def test_upload_part_copy_errors(src):
    key, uid = create(src, "dst-err")
    with s3error("NoSuchKey", 404):
        src.s3.upload_part_copy(Bucket=src.name, Key=key, UploadId=uid, PartNumber=1, CopySource={"Bucket": src.name, "Key": "missing"})
    other = bvh.fresh_bucket("mpother")
    other.put("o", b"o")
    with s3error("AccessDenied", 403):
        src.s3.upload_part_copy(Bucket=src.name, Key=key, UploadId=uid, PartNumber=1, CopySource={"Bucket": other.name, "Key": "o"})
    with s3error("NoSuchUpload", 404):
        src.s3.upload_part_copy(Bucket=src.name, Key=key, UploadId="nope", PartNumber=1, CopySource={"Bucket": src.name, "Key": "src"})
    with s3error("PreconditionFailed", 412):
        src.s3.upload_part_copy(Bucket=src.name, Key=key, UploadId=uid, PartNumber=1, CopySource={"Bucket": src.name, "Key": "src"},
                                CopySourceIfMatch='"00000000000000000000000000000000"')
    with s3error("InvalidArgument", 400):
        src.s3.upload_part_copy(Bucket=src.name, Key=key, UploadId=uid, PartNumber=0, CopySource={"Bucket": src.name, "Key": "src"})


def test_upload_part_copy_from_an_old_version():
    bk = bvh.fresh_bucket("mpcopyv", versioning="enabled")
    v1 = bk.put("k", b"first version")["VersionId"]
    bk.put("k", b"second version, longer")
    key, uid = create(bk, "dst")
    r = bk.s3.upload_part_copy(Bucket=bk.name, Key=key, UploadId=uid, PartNumber=1, CopySource={"Bucket": bk.name, "Key": "k", "VersionId": v1})
    done = complete(bk, key, uid, [(1, r["CopyPartResult"]["ETag"])])
    assert done.get("VersionId")
    assert bk.read(key) == b"first version"
    # without a version id the copy takes the latest version
    key2, uid2 = create(bk, "dst2")
    r2 = bk.s3.upload_part_copy(Bucket=bk.name, Key=key2, UploadId=uid2, PartNumber=1, CopySource={"Bucket": bk.name, "Key": "k"})
    complete(bk, key2, uid2, [(1, r2["CopyPartResult"]["ETag"])])
    assert bk.read(key2) == b"second version, longer"


# --------------------------------------------------------------------------------------------
# versioned buckets and managed transfers

def test_multipart_into_a_versioned_bucket_adds_a_version(vbk):
    vbk.put("k", b"v1")
    key, uid = create(vbk, "k")
    done = complete(vbk, key, uid, upload_all(vbk, key, uid, [b"v2 via multipart"]))
    assert done.get("VersionId") and hdr(done, "x-amz-version-id") == done["VersionId"]
    vers = vbk.s3.list_object_versions(Bucket=vbk.name)["Versions"]
    assert len(vers) == 2 and sum(1 for v in vers if v["IsLatest"]) == 1
    assert vbk.read("k") == b"v2 via multipart"
    assert vbk.s3.get_object(Bucket=vbk.name, Key="k", VersionId=done["VersionId"])["Body"].read() == b"v2 via multipart"


def test_boto3_upload_file_and_download_file_use_multipart_and_ranged_gets(bk, tmp_path):
    data = rnd(21 * MiB + 17)
    src_file = tmp_path / "src.bin"
    src_file.write_bytes(data)
    cfg = TransferConfig(multipart_threshold=8 * MiB, multipart_chunksize=8 * MiB, max_concurrency=4)
    bk.s3.upload_file(str(src_file), bk.name, "managed/big.bin", Config=cfg, ExtraArgs={"ContentType": "application/x-big"})
    h = bk.head("managed/big.bin")
    assert h["ContentLength"] == len(data) and h["ContentType"] == "application/x-big"
    assert h["ETag"] == '"%s"' % multipart_etag([data[i:i + 8 * MiB] for i in range(0, len(data), 8 * MiB)])
    dst = tmp_path / "dst.bin"
    bk.s3.download_file(bk.name, "managed/big.bin", str(dst), Config=cfg)
    assert dst.read_bytes() == data


def test_boto3_upload_fileobj_from_a_stream_of_unknown_size(bk):
    data = rnd(13 * MiB + 5)

    class Stream(io.RawIOBase):               # not seekable, size unknown
        def __init__(self, b):
            self.b, self.pos = b, 0

        def readable(self):
            return True

        def readinto(self, buf):
            n = min(len(buf), len(self.b) - self.pos, 100 * KiB)
            buf[:n] = self.b[self.pos:self.pos + n]
            self.pos += n
            return n

    bk.s3.upload_fileobj(io.BufferedReader(Stream(data)), bk.name, "managed/stream.bin",
                         Config=TransferConfig(multipart_threshold=5 * MiB, multipart_chunksize=5 * MiB, max_concurrency=3))
    assert bk.read("managed/stream.bin") == data


def test_boto3_copy_of_a_large_object_uses_part_copies(bk):
    data = rnd(11 * MiB)
    bk.put("big-src", data)
    bk.s3.copy({"Bucket": bk.name, "Key": "big-src"}, bk.name, "big-dst",
               Config=TransferConfig(multipart_threshold=5 * MiB, multipart_chunksize=5 * MiB))
    assert bk.read("big-dst") == data


def test_open_uploads_do_not_block_deleting_the_key_or_the_bucket_listing(bk):
    key, uid = create(bk, "inflight")
    upload_all(bk, key, uid, [rnd(MIN)])
    bk.put("inflight", b"direct put wins until complete")
    assert bk.read("inflight") == b"direct put wins until complete"
    bk.delete("inflight")
    ets = [(1, bk.s3.list_parts(Bucket=bk.name, Key=key, UploadId=uid)["Parts"][0]["ETag"])]
    done = complete(bk, key, uid, ets)
    assert bk.head(key)["ContentLength"] == MIN and done["Key"] == key
