"""Backup and restore (spec 9.5), blob garbage collection (spec 3.4, 3.9) and the integrity scrubber (spec 3.9).

The backup follows the documented recipe with nothing but sqlite3 and cp: VACUUM INTO of meta.db, then a copy of blobs/
(and optionally uploads/), restored into a fresh directory next to the master key.
"""
import hashlib
import os
import shutil
import sqlite3
import threading
import time

import pytest

import bvh
import bvm
from bvh import KiB, MiB, md5hex, rnd, s3error

SLOW = os.environ.get("BV_SLOW", "1") != "0"


def data_dir(node):
    return os.path.join(node.dir, "data")


def blob_files(node):
    """{path: size} of every file below blobs/."""
    out = {}
    for root, _, files in os.walk(os.path.join(data_dir(node), "blobs")):
        for f in files:
            p = os.path.join(root, f)
            out[p] = os.path.getsize(p)
    return out


def blobs_of_size(node, size):
    return [p for p, s in blob_files(node).items() if s == size]


def wait_for(cond, timeout=30.0, step=0.2):
    end = time.time() + timeout
    while time.time() < end:
        if cond():
            return True
        time.sleep(step)
    return False


# --------------------------------------------------------------------------------------------
# a node with a bit of everything, a fingerprint of it, and the documented backup recipe

class Plan:
    pass


def populate(node):
    p = Plan()
    p.vname, vak, vsk = node.fresh_bucket("bkv", versioning="enabled", encryption="sse-s3",
                                          cors=[{"allowed_origins": ["https://a.example.com"], "allowed_methods": ["GET"]}],
                                          lifecycle=[{"id": "tmp", "filter": {"prefix": "tmp/"}, "expire_days": 30}], quota_bytes=500 * MiB)
    p.pname, pak, psk = node.fresh_bucket("bkp", limits={"requests_per_second": 1000})
    p.v, p.p = node.client(vak, vsk), node.client(pak, psk)
    p.creds = {p.vname: (vak, vsk), p.pname: (pak, psk)}
    v = p.v
    v.put_object(Bucket=p.vname, Key="docs/a.txt", Body=b"a" * 100, Metadata={"gen": "1"}, Tagging="t=1")
    v.put_object(Bucket=p.vname, Key="docs/a.txt", Body=b"b" * 200, Metadata={"gen": "2"}, Tagging="t=2&u=3")
    p.enc = rnd(300 * KiB)
    v.put_object(Bucket=p.vname, Key="docs/enc.bin", Body=p.enc)
    v.put_object(Bucket=p.vname, Key="gone.txt", Body=b"x")
    v.delete_object(Bucket=p.vname, Key="gone.txt")                                         # a delete marker on top
    parts = [rnd(5 * MiB), rnd(1000)]
    up = v.create_multipart_upload(Bucket=p.vname, Key="assembled")["UploadId"]
    etags = [v.upload_part(Bucket=p.vname, Key="assembled", UploadId=up, PartNumber=i + 1, Body=b)["ETag"] for i, b in enumerate(parts)]
    v.complete_multipart_upload(Bucket=p.vname, Key="assembled", UploadId=up, MultipartUpload={"Parts": [{"PartNumber": i + 1, "ETag": e} for i, e in enumerate(etags)]})
    p.assembled = b"".join(parts)
    pc = p.p
    pc.put_object(Bucket=p.pname, Key="orig", Body=rnd(70000))
    pc.copy_object(Bucket=p.pname, Key="copy", CopySource={"Bucket": p.pname, "Key": "orig"})      # two rows, one blob
    p.pending_part = rnd(5 * MiB)
    p.upload = pc.create_multipart_upload(Bucket=p.pname, Key="pending")["UploadId"]
    p.pending_etag = pc.upload_part(Bucket=p.pname, Key="pending", UploadId=p.upload, PartNumber=1, Body=p.pending_part)["ETag"]
    p.reader = node.admin.create_token(p.pname, [{"actions": ["read", "list"], "keys": ["orig"]}], name="reader")
    return p


def fingerprint(node, p):
    """Everything a client can observe, as plain data."""
    out = {}
    for name in (p.vname, p.pname):
        c = node.client(*p.creds[name])
        b = node.admin.get_bucket(name)
        entry = {"settings": b, "tokens": sorted((t["access_key_id"], t["name"], str(t["grants"]), str(t.get("limits")), str(t.get("expires_at"))) for t in node.admin.list_tokens(name)["items"])}
        vers = []
        for page in c.get_paginator("list_object_versions").paginate(Bucket=name):
            for x in page.get("Versions", []):
                got = c.get_object(Bucket=name, Key=x["Key"], VersionId=x["VersionId"])
                tags = sorted((t["Key"], t["Value"]) for t in c.get_object_tagging(Bucket=name, Key=x["Key"], VersionId=x["VersionId"])["TagSet"])
                vers.append((x["Key"], x["VersionId"], x["Size"], x["ETag"], x["IsLatest"], str(x["LastModified"]), md5hex(got["Body"].read()), sorted(got["Metadata"].items()), tags, got.get("ServerSideEncryption")))
            for m in page.get("DeleteMarkers", []):
                vers.append(("marker", m["Key"], m["VersionId"], m["IsLatest"], str(m["LastModified"])))
        entry["versions"] = sorted(vers, key=str)
        ups = []
        for u in c.list_multipart_uploads(Bucket=name).get("Uploads", []):
            parts = c.list_parts(Bucket=name, Key=u["Key"], UploadId=u["UploadId"]).get("Parts", [])
            ups.append((u["Key"], u["UploadId"], [(x["PartNumber"], x["Size"], x["ETag"]) for x in parts]))
        entry["uploads"] = sorted(ups)
        out[name] = entry
    return out


def snapshot(node, dest, with_uploads=True):
    """spec 9.5: (1) VACUUM INTO, (2) copy blobs/ afterwards. Returns a function that does step 2."""
    os.makedirs(dest)
    con = sqlite3.connect("file:%s?mode=ro" % os.path.join(data_dir(node), "meta.db"), uri=True, timeout=30)
    try:
        con.execute("VACUUM INTO '%s'" % os.path.join(dest, "meta.db"))
    finally:
        con.close()

    def step2():
        shutil.copytree(os.path.join(data_dir(node), "blobs"), os.path.join(dest, "blobs"))
        if with_uploads:
            shutil.copytree(os.path.join(data_dir(node), "uploads"), os.path.join(dest, "uploads"))
    return step2


def restored_node(src_node, backup_dir, tag):
    """A node on a fresh data dir holding only what the backup holds (no FORMAT marker, no tmp/), same secrets."""
    rd = os.path.join(src_node.dir, "restore-" + tag)
    shutil.copytree(backup_dir, rd)
    n = bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_DATA_DIR": rd})              # its own temp dir for the log
    n.master, n.token = src_node.master, src_node.token
    return n


def test_the_documented_backup_and_restore_recipe():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as a:
        p = populate(a)
        before = fingerprint(a, p)
        step2 = snapshot(a, os.path.join(a.dir, "backup"))
        # the world moves on between the two steps: a drop after step 1 must not cost the backup a blob
        p.p.delete_object(Bucket=p.pname, Key="copy")
        p.p.delete_object(Bucket=p.pname, Key="orig")
        for x in p.v.list_object_versions(Bucket=p.vname, Prefix="docs/enc.bin")["Versions"]:
            p.v.delete_object(Bucket=p.vname, Key="docs/enc.bin", VersionId=x["VersionId"])
        p.p.put_object(Bucket=p.pname, Key="late", Body=b"after the snapshot")
        step2()
        n = restored_node(a, os.path.join(a.dir, "backup"), "full")
        code, out = n.cli("validate", "--deep")
        assert code == 0 and "all checks passed" in out, out
        n.start()
        try:
            assert fingerprint(n, p) == before, "the restored node must show the state of the snapshot"
            assert n.admin.get_bucket(p.pname)["stats"]["objects"] == 2
            with s3error("NoSuchKey", 404):
                n.client(*p.creds[p.pname]).get_object(Bucket=p.pname, Key="late")
            # old token secrets keep working (the master key opens the sealed values)
            c = n.client(p.reader["access_key_id"], p.reader["secret_access_key"])
            assert len(c.get_object(Bucket=p.pname, Key="orig")["Body"].read()) == 70000
            assert bvh.err_of(c.put_object, Bucket=p.pname, Key="x", Body=b"1")[0] == 403, "grants survive the restore"
            # the open upload resumes because uploads/ was restored
            pc = n.client(*p.creds[p.pname])
            r = pc.complete_multipart_upload(Bucket=p.pname, Key="pending", UploadId=p.upload, MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": p.pending_etag}]})
            assert pc.get_object(Bucket=p.pname, Key="pending")["Body"].read() == p.pending_part
            assert r["ETag"].strip('"').endswith("-1")
            # the restored node is a normal node: writes work, new uploads work
            pc.put_object(Bucket=p.pname, Key="new", Body=b"fresh")
            assert pc.get_object(Bucket=p.pname, Key="new")["Body"].read() == b"fresh"
        finally:
            n.stop()


def test_restoring_without_uploads_aborts_the_open_uploads_at_boot():
    """spec 9.5: uploads/ is optional; without it binvault aborts every open multipart upload at boot (their rows have no files)."""
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as a:
        p = populate(a)
        snapshot(a, os.path.join(a.dir, "backup"), with_uploads=False)()
        n = restored_node(a, os.path.join(a.dir, "backup"), "nouploads")
        assert n.cli("validate", "--deep")[0] == 0
        n.start()
        try:
            c = n.client(*p.creds[p.pname])
            assert c.get_object(Bucket=p.pname, Key="orig")["Body"].read(), "the data itself is fine"
            assert c.list_multipart_uploads(Bucket=p.pname).get("Uploads", []) == [], "the upload has no part files any more: it must have been aborted at boot"
            with s3error("NoSuchUpload", 404):
                c.upload_part(Bucket=p.pname, Key="pending", UploadId=p.upload, PartNumber=2, Body=b"x")
            with s3error("NoSuchUpload", 404):
                c.complete_multipart_upload(Bucket=p.pname, Key="pending", UploadId=p.upload, MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": p.pending_etag}]})
            assert n.admin.get_bucket(p.pname)["stats"]["upload_bytes"] == 0
        finally:
            n.stop()


def test_a_backup_with_a_missing_blob_is_caught_by_validate_deep():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as a:
        p = populate(a)
        snapshot(a, os.path.join(a.dir, "backup"))()
        victim = blobs_of_size(a, 70000)
        assert len(victim) == 1
        os.unlink(os.path.join(a.dir, "backup", "blobs", os.path.relpath(victim[0], os.path.join(data_dir(a), "blobs"))))
        n = restored_node(a, os.path.join(a.dir, "backup"), "broken")
        code, out = n.cli("validate", "--deep")
        assert code != 0 and "blob" in out.lower(), "validate --deep exists to find this: rc=%r %s" % (code, out)
        assert n.cli("validate")[0] == 0, "the shallow check does not look at blobs"


# --------------------------------------------------------------------------------------------
# garbage collection (spec 3.4, 3.9): the tick is every minute, so this one is slow

@pytest.mark.skipif(not SLOW, reason="BV_SLOW=0: waits for a one-minute GC tick")
def test_unreferenced_blobs_are_unlinked_after_the_grace_period_and_readers_finish():
    short = bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_GC_GRACE": "1s"})
    long_ = bvh.Node(env={"BINVAULT_FSYNC": "false"})                       # default grace: 1 h
    with short, long_:
        started = time.time()
        sizes = {"shared": 3 * MiB + 11, "stream": 2 * MiB + 7, "plain": 200000 + 3}
        info = {}
        for tag, node in (("short", short), ("long", long_)):
            name, ak, sk = node.fresh_bucket("gc")
            c = node.client(ak, sk)
            c.put_object(Bucket=name, Key="a", Body=rnd(sizes["shared"]))
            c.copy_object(Bucket=name, Key="b", CopySource={"Bucket": name, "Key": "a"})
            c.put_object(Bucket=name, Key="stream", Body=rnd(sizes["stream"]))
            c.put_object(Bucket=name, Key="plain", Body=rnd(sizes["plain"]))
            info[tag] = (node, name, ak, sk, c)
        # a slow reader on the short-grace node: its blob is unlinked while the download is still running
        node, name, ak, sk, c = info["short"]
        node.admin.patch_bucket(name, limits={"bytes_out_per_second": 128 * KiB})
        result = {}

        def slow_read():
            try:
                r = c.get_object(Bucket=name, Key="stream")
                h = hashlib.md5()
                while True:
                    chunk = r["Body"].read(64 * KiB)
                    if not chunk:
                        break
                    h.update(chunk)
                result["md5"], result["etag"] = h.hexdigest(), r["ETag"].strip('"')
            except Exception as e:      # noqa: BLE001
                result["error"] = repr(e)

        for tag in ("short", "long"):
            n_, nm, _, _, cc = info[tag]
            cc.delete_object(Bucket=nm, Key="plain")                       # last reference gone
            cc.delete_object(Bucket=nm, Key="a")                           # b still references the shared blob
        # let the first minute tick get close, then start the slow read and drop its last reference
        time.sleep(max(0.0, 44 - (time.time() - started)))
        t = threading.Thread(target=slow_read)
        t.start()
        time.sleep(1.5)
        for tag in ("short", "long"):
            n_, nm, _, _, cc = info[tag]
            cc.delete_object(Bucket=nm, Key="stream")
        assert blobs_of_size(short, sizes["plain"]) and blobs_of_size(long_, sizes["plain"]), "nothing is unlinked before the tick"
        gone = wait_for(lambda: not blobs_of_size(short, sizes["plain"]), timeout=90)
        assert gone, "an unreferenced blob older than BINVAULT_GC_GRACE=1s was still on disk %.0f s after the node started" % (time.time() - started)
        assert blobs_of_size(short, sizes["shared"]), "the shared blob is still referenced by b and must stay"
        assert blobs_of_size(long_, sizes["plain"]), "BINVAULT_GC_GRACE=1h: the blob must be kept"
        assert blobs_of_size(long_, sizes["stream"])
        t.join(timeout=120)
        assert "error" not in result, result
        assert not blobs_of_size(short, sizes["stream"]), "the streamed blob has been unlinked while the reader was still reading"
        assert result.get("md5") == result.get("etag"), "an open reader keeps reading an unlinked file (spec 3.4): %r" % result
        # the gauge agrees with the disk: nothing waits any more; dropping the last reference of the shared blob makes it wait again
        assert bvm.scrape_node(short).total("binvault_blob_gc_pending") == 0
        node, name, _, _, c = info["short"]
        c.delete_object(Bucket=name, Key="b")
        assert bvm.scrape_node(short).total("binvault_blob_gc_pending") == 1
        assert blobs_of_size(short, sizes["shared"]), "still on disk until the next tick"


# --------------------------------------------------------------------------------------------
# scrubber (spec 3.9): re-hash blobs against the stored SHA-256; log and count, never repair or delete

def test_the_scrubber_counts_a_corrupted_blob_and_touches_nothing():
    with bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_SCRUB_INTERVAL": "1s", "BINVAULT_LOG_LEVEL": "info"}) as node:
        name, ak, sk = node.fresh_bucket("scrub")
        c = node.client(ak, sk)
        good, bad = rnd(100000), rnd(100001)
        c.put_object(Bucket=name, Key="good", Body=good)
        c.put_object(Bucket=name, Key="bad", Body=bad)
        assert wait_for(lambda: "scrubber finished" in node.logtext(), timeout=15), "no scrub pass within 15 s of BINVAULT_SCRUB_INTERVAL=1s:\n" + node.logtext()[-600:]
        assert bvm.scrape_node(node).total("binvault_scrub_mismatches_total") == 0, "healthy blobs are no mismatch"
        path = blobs_of_size(node, 100001)[0]
        with open(path, "r+b") as f:
            f.seek(500)
            byte = f.read(1)
            f.seek(500)
            f.write(bytes([byte[0] ^ 0xFF]))
        assert wait_for(lambda: bvm.scrape_node(node).total("binvault_scrub_mismatches_total") >= 1, timeout=20), "the flipped byte was not noticed:\n" + node.logtext()[-800:]
        log = node.logtext()
        assert "mismatch" in log.lower(), "the scrubber must log the blob it found:\n" + log[-800:]
        # nothing is repaired or deleted
        assert os.path.exists(path) and os.path.getsize(path) == 100001
        with open(path, "rb") as f:
            f.seek(500)
            assert f.read(1) == bytes([byte[0] ^ 0xFF]), "the scrubber never repairs"
        assert sorted(o["Key"] for o in c.list_objects_v2(Bucket=name)["Contents"]) == ["bad", "good"]
        assert c.get_object(Bucket=name, Key="good")["Body"].read() == good, "the other blob is untouched"
        assert node.admin.get_bucket(name)["stats"]["objects"] == 2


def test_the_scrubber_is_off_by_default():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("noscrub")
        node.client(ak, sk).put_object(Bucket=name, Key="k", Body=rnd(1000))
        path = blobs_of_size(node, 1000)[0]
        with open(path, "r+b") as f:
            f.write(b"\xff")
        time.sleep(3)
        assert "scrubber" not in node.logtext().lower()
        assert bvm.scrape_node(node).total("binvault_scrub_mismatches_total") == 0
