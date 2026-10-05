"""Consistency under concurrency: read-after-write, list-after-write, atomic overwrites, parallel multipart (spec 3.6)."""
import concurrent.futures
import hashlib
import random
import threading
import time

import pytest
from botocore.exceptions import ClientError

import bvh
from bvh import KiB, MiB, md5hex, multipart_etag, rnd, s3error, uniq
from bvx_a import put_many, raw_get


def pool(n=16):
    return concurrent.futures.ThreadPoolExecutor(max_workers=n)


def test_five_hundred_parallel_puts_are_all_visible_at_once(bk):
    keys = ["p/%04d" % i for i in range(500)]
    bodies = {k: rnd(10 + (i % 97)) for i, k in enumerate(keys)}
    with pool(24) as ex:
        list(ex.map(lambda k: bk.put(k, bodies[k]), keys))
    assert bk.keys() == sorted(keys), "list-after-write: every acknowledged key is listed"
    with pool(24) as ex:
        got = list(ex.map(lambda k: bk.read(k), keys))
    assert got == [bodies[k] for k in keys]


def test_overwrites_are_atomic_readers_see_one_whole_version(bk):
    versions = [rnd(200 * KiB + i * 17) for i in range(8)]
    digests = {md5hex(v) for v in versions}
    bk.put("hot", versions[0])
    stop = threading.Event()
    bad = []

    def writer(i):
        n = 0
        while not stop.is_set() and n < 25:
            bk.put("hot", versions[(i + n) % len(versions)])
            n += 1

    def reader():
        while not stop.is_set():
            r = bk.get("hot")
            body = r["Body"].read()
            if md5hex(body) not in digests or r["ETag"].strip('"') != md5hex(body):
                bad.append((len(body), r["ETag"]))

    rs = [threading.Thread(target=reader) for _ in range(6)]
    ws = [threading.Thread(target=writer, args=(i,)) for i in range(6)]
    for t in rs + ws:
        t.start()
    for t in ws:
        t.join()
    stop.set()
    for t in rs:
        t.join()
    assert not bad, "readers saw a body that is no complete version: %r" % bad[:3]
    assert md5hex(bk.read("hot")) in digests


def test_put_and_delete_racing_on_one_key_leave_a_consistent_state(bk):
    body = rnd(5000)

    def put():
        for _ in range(60):
            bk.put("race", body)

    def delete():
        for _ in range(60):
            bk.delete("race")

    ts = [threading.Thread(target=put) for _ in range(3)] + [threading.Thread(target=delete) for _ in range(3)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    try:
        assert bk.read("race") == body
        assert bk.keys() == ["race"]
    except ClientError as e:
        assert e.response["Error"]["Code"] == "NoSuchKey"
        assert bk.keys() == []


def test_overlapping_delete_objects_requests(bk):
    keys = ["d%03d" % i for i in range(300)]
    put_many(bk, keys)
    chunks = [keys[i:i + 150] for i in (0, 75, 150)]          # overlapping thirds

    def run(ch):
        return bk.s3.delete_objects(Bucket=bk.name, Delete={"Objects": [{"Key": k} for k in ch]})

    with pool(3) as ex:
        res = list(ex.map(run, chunks))
    for r in res:
        assert not r.get("Errors"), r.get("Errors")
        assert len(r["Deleted"]) == 150
    assert bk.keys() == []


def test_parallel_multipart_uploads_of_different_keys(bk):
    def one(i):
        parts = [rnd(5 * MiB), rnd(100 + i)]
        up = bk.s3.create_multipart_upload(Bucket=bk.name, Key="mp/%d" % i)["UploadId"]
        ets = []
        for n, p in enumerate(parts, 1):
            ets.append({"PartNumber": n, "ETag": bk.s3.upload_part(Bucket=bk.name, Key="mp/%d" % i, UploadId=up, PartNumber=n, Body=p)["ETag"]})
        done = bk.s3.complete_multipart_upload(Bucket=bk.name, Key="mp/%d" % i, UploadId=up, MultipartUpload={"Parts": ets})
        return i, parts, done["ETag"]

    with pool(6) as ex:
        results = list(ex.map(one, range(6)))
    for i, parts, etag in results:
        assert etag == '"%s"' % multipart_etag(parts)
        assert bk.read("mp/%d" % i) == b"".join(parts)


def test_two_uploads_for_the_same_key_complete_independently(bk):
    ups = []
    for n in (1, 2):
        ups.append((bk.s3.create_multipart_upload(Bucket=bk.name, Key="same")["UploadId"], bytes([n]) * 1000))
    ets = [bk.s3.upload_part(Bucket=bk.name, Key="same", UploadId=u, PartNumber=1, Body=b)["ETag"] for u, b in ups]
    bk.s3.complete_multipart_upload(Bucket=bk.name, Key="same", UploadId=ups[0][0], MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": ets[0]}]})
    assert bk.read("same") == ups[0][1]
    bk.s3.complete_multipart_upload(Bucket=bk.name, Key="same", UploadId=ups[1][0], MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": ets[1]}]})
    assert bk.read("same") == ups[1][1], "the last completed upload wins"


def test_many_parallel_downloads_of_one_big_object(bk):
    data = rnd(4 * MiB + 11)
    bk.put("big", data)
    h = hashlib.md5(data).hexdigest()
    with pool(24) as ex:
        res = list(ex.map(lambda _: md5hex(bk.read("big")), range(48)))
    assert res == [h] * 48


def test_parallel_range_reads_of_an_encrypted_object(ebk):
    data = rnd(3 * MiB + 5)
    ebk.put("enc", data)
    rng = random.Random(7)
    spans = [(a, min(len(data) - 1, a + rng.randrange(1, 300000))) for a in (rng.randrange(0, len(data)) for _ in range(60))]

    def one(span):
        a, b = span
        r = ebk.get("enc", Range="bytes=%d-%d" % (a, b))
        return r["Body"].read() == data[a:b + 1]

    with pool(16) as ex:
        assert all(ex.map(one, spans))


def test_listing_while_writing_is_sorted_and_duplicate_free(bk):
    stop = threading.Event()
    problems = []

    def writer(w):
        i = 0
        while not stop.is_set() and i < 150:
            bk.put("w%d/%04d" % (w, i), b"x")
            if i % 5 == 0:
                bk.delete("w%d/%04d" % (w, i // 2))
            i += 1

    ws = [threading.Thread(target=writer, args=(w,)) for w in range(4)]
    for t in ws:
        t.start()
    while any(t.is_alive() for t in ws):
        keys = bk.keys()
        if keys != sorted(keys) or len(keys) != len(set(keys)):
            problems.append(len(keys))
        time.sleep(0.05)
    stop.set()
    for t in ws:
        t.join()
    assert not problems, "a listing was unsorted or had duplicates (%d of them)" % len(problems)


def test_mixed_operation_storm_keeps_every_thread_consistent(bk):
    """Each thread owns a key space and checks its own read-your-writes / list-your-writes while all of them hammer one bucket."""
    errors = []

    def worker(w):
        rng = random.Random(1000 + w)
        model = {}
        prefix = "storm/%d/" % w
        try:
            for step in range(120):
                k = prefix + "k%d" % rng.randrange(12)
                op = rng.choice(["put", "put", "get", "delete", "copy", "head", "tag", "list"])
                if op == "put":
                    body = rnd(rng.randrange(0, 3000))
                    bk.put(k, body)
                    model[k] = body
                elif op == "get" or op == "head":
                    try:
                        got = bk.read(k) if op == "get" else bk.head(k)["ContentLength"]
                        assert k in model, "read a key that was deleted/never written: " + k
                        assert got == (model[k] if op == "get" else len(model[k]))
                    except ClientError as e:
                        assert e.response["ResponseMetadata"]["HTTPStatusCode"] == 404 and k not in model, (k, e)
                elif op == "delete":
                    bk.delete(k)
                    model.pop(k, None)
                elif op == "copy" and model:
                    src = rng.choice(sorted(model))
                    dst = prefix + "c%d" % rng.randrange(5)
                    if dst == src:
                        continue                                  # a self-copy is InvalidRequest by design
                    bk.s3.copy_object(Bucket=bk.name, Key=dst, CopySource={"Bucket": bk.name, "Key": src})
                    model[dst] = model[src]
                elif op == "tag" and model:
                    kk = rng.choice(sorted(model))
                    bk.s3.put_object_tagging(Bucket=bk.name, Key=kk, Tagging={"TagSet": [{"Key": "s", "Value": str(step)}]})
                elif op == "list":
                    assert bk.keys(Prefix=prefix) == sorted(model), "list-after-write violated in %s" % prefix
            assert bk.keys(Prefix=prefix) == sorted(model)
            for k, body in model.items():
                assert bk.read(k) == body
        except BaseException as e:          # noqa: BLE001
            errors.append((w, repr(e)[:300]))

    ts = [threading.Thread(target=worker, args=(w,)) for w in range(12)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    assert not errors, errors[:3]
    assert bvh.http_raw("GET", bvh.HOSTPORT, "/_healthz").status == 200


def test_versioned_storm_never_loses_a_version(vbk):
    n_threads, per = 8, 15
    ids = []
    lock = threading.Lock()

    def w(t):
        for i in range(per):
            r = vbk.put("one-key", ("t%d-%d" % (t, i)).encode())
            with lock:
                ids.append(r["VersionId"])

    ts = [threading.Thread(target=w, args=(t,)) for t in range(n_threads)]
    for t in ts:
        t.start()
    for t in ts:
        t.join()
    assert len(ids) == len(set(ids)) == n_threads * per
    listed = [v["VersionId"] for p in vbk.s3.get_paginator("list_object_versions").paginate(Bucket=vbk.name) for v in p["Versions"]]
    assert sorted(listed) == sorted(ids)
    for vid in ids[:20]:
        assert vbk.s3.get_object(Bucket=vbk.name, Key="one-key", VersionId=vid)["Body"].read().startswith(b"t")
