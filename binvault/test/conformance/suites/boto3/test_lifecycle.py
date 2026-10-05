"""Lifecycle execution: expire_days, noncurrent_days/keep, expire_delete_markers, abort_multipart_days (spec 3.12).

Lifecycle counts in days, so the tests travel in time the black-box way: a private node runs with a 1 s janitor
interval, is stopped, the timestamps of the version rows / uploads in meta.db are moved into the past with the sqlite3
module, and the node is started again on the same data directory. Everything the janitor must do (and must not do)
is set up first, so one restart serves every test of the module.
"""
import datetime
import email.utils
import os
import re
import sqlite3
import time

import pytest

import bvh
from bvh import KiB, MiB, ADMIN, AdminError, md5hex, rnd, s3error, uniq
from bvx_a import raw_get, raw_head, raw_put, raw_req

DAY = 86400 * 1000


def now_ms():
    return int(time.time() * 1000)


def wait_for(cond, timeout=40.0, step=0.25):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if cond():
                return True
        except Exception:
            pass
        time.sleep(step)
    return False


class B:
    """A bucket on the private lifecycle node."""

    def __init__(self, world, name, ak, sk):
        self.world, self.name, self.ak, self.sk = world, name, ak, sk
        self._c = None
        self._ep = None

    @property
    def s3(self):
        if self._c is None or self._ep != self.world.node.endpoint:
            self._ep = self.world.node.endpoint
            self._c = self.world.node.client(self.ak, self.sk)
        return self._c

    def put(self, key, body=b"x", **kw):
        return self.s3.put_object(Bucket=self.name, Key=key, Body=body, **kw)

    def keys(self, **kw):
        out = []
        for p in self.s3.get_paginator("list_objects_v2").paginate(Bucket=self.name, **kw):
            out += [o["Key"] for o in p.get("Contents", [])]
        return out

    def versions(self, key=None):
        r = self.s3.list_object_versions(Bucket=self.name, **({"Prefix": key} if key else {}))
        return [v for v in r.get("Versions", []) if key is None or v["Key"] == key], [m for m in r.get("DeleteMarkers", []) if key is None or m["Key"] == key]

    def exists(self, key):
        try:
            self.s3.head_object(Bucket=self.name, Key=key)
            return True
        except Exception:
            return False


class World:
    def __init__(self):
        self.node = bvh.Node(env={"BINVAULT_LIFECYCLE_INTERVAL": "1s", "BINVAULT_LIFECYCLE_BATCH": "50", "BINVAULT_FSYNC": "false"})
        self.ops = []                       # (sql, params) applied to meta.db while the node is down
        self.n = 0

    def bucket(self, tag, **settings):
        name, ak, sk = self.node.fresh_bucket(tag, **settings)
        return B(self, name, ak, sk)

    def age_object(self, bk, key, days, version=None):
        """Make the (latest, or the given) version of key days old."""
        self.ops.append(("object-age", bk.name, key, version, days))

    def age_noncurrent(self, bk, key, version, days):
        self.ops.append(("noncurrent-age", bk.name, key, version, days))

    def age_upload(self, bk, upload_id, days):
        self.ops.append(("upload-age", bk.name, upload_id, None, days))

    def apply(self):
        con = sqlite3.connect(os.path.join(self.node.dir, "data", "meta.db"), timeout=30)
        try:
            con.execute("PRAGMA busy_timeout=30000")
            now = now_ms()
            for kind, bucket, key, version, days in self.ops:
                ts = now - int(days * DAY)
                if kind == "object-age":
                    if version:
                        n = con.execute("UPDATE objects SET created_at=? WHERE bucket=? AND key=? AND version=?", (ts, bucket, key, version)).rowcount
                    else:
                        n = con.execute("UPDATE objects SET created_at=? WHERE bucket=? AND key=? AND is_latest=1", (ts, bucket, key)).rowcount
                elif kind == "noncurrent-age":
                    n = con.execute("UPDATE objects SET noncurrent_since=? WHERE bucket=? AND key=? AND version=? AND is_latest=0", (ts, bucket, key, version)).rowcount
                else:
                    n = con.execute("UPDATE uploads SET initiated_at=? WHERE bucket=? AND upload_id=?", (ts, bucket, key)).rowcount
                assert n >= 1, "time travel matched no row: %r" % ((kind, bucket, key, version),)
            con.commit()
        finally:
            con.close()


@pytest.fixture(scope="module")
def world():
    w = World()
    w.node.start()
    try:
        w.setup()
        w.node.stop()
        w.apply()
        w.node.start()
        yield w
    finally:
        w.node.stop()


def _setup(w):
    # ---- unversioned bucket with several rules --------------------------------------------------
    rules = [
        {"id": "tmp", "filter": {"prefix": "tmp/"}, "expire_days": 2},
        {"id": "tagged", "filter": {"prefix": "tagged/", "tags": {"scan": "clean"}}, "expire_days": 3},
        {"id": "sized", "filter": {"prefix": "sized/", "min_size": 1000, "max_size": 5000}, "expire_days": 1},
        {"id": "off", "enabled": False, "filter": {"prefix": "off/"}, "expire_days": 1},
        {"id": "slow", "filter": {"prefix": "multi/"}, "expire_days": 10},
        {"id": "fast", "filter": {"prefix": "multi/"}, "expire_days": 1},
    ]
    u = w.u = w.bucket("lcu", lifecycle=rules)
    for key, size, age, tags in (("tmp/old", 10, 3, None), ("tmp/edge", 10, 1.9, None), ("tmp/young", 10, 0.1, None), ("other/ancient", 10, 400, None),
                                 ("tagged/old", 10, 4, "scan=clean&extra=1"), ("tagged/untagged", 10, 4, None), ("tagged/wrongtag", 10, 4, "scan=dirty"),
                                 ("tagged/young", 10, 2, "scan=clean"),
                                 ("sized/small", 500, 2, None), ("sized/in", 2000, 2, None), ("sized/big", 6000, 2, None),
                                 ("off/old", 10, 5, None), ("multi/a", 10, 2, None), ("multi/b", 10, 0.5, None)):
        kw = {"Tagging": tags} if tags else {}
        u.put(key, rnd(size), **kw)
        w.age_object(u, key, age)

    # ---- versioned bucket ------------------------------------------------------------------------
    vrules = [
        {"id": "cur", "filter": {"prefix": "cur/"}, "expire_days": 2},
        {"id": "hist", "filter": {"prefix": "hist/"}, "noncurrent_days": 30, "noncurrent_keep": 1},
        {"id": "hist0", "filter": {"prefix": "hist0/"}, "noncurrent_days": 30},
        {"id": "dm", "filter": {"prefix": "dm/"}, "expire_delete_markers": True},
    ]
    v = w.v = w.bucket("lcv", versioning="enabled", lifecycle=vrules)
    v.put("cur/a", b"old current")
    w.age_object(v, "cur/a", 3)
    v.put("cur/b", b"young current")
    w.age_object(v, "cur/b", 1)
    for prefix in ("hist/", "hist0/"):
        vids = [v.put(prefix + "k", ("v%d" % i).encode())["VersionId"] for i in range(1, 5)]
        w.hist = getattr(w, "hist", {})
        w.hist[prefix] = vids
        for vid, age in zip(vids[:3], (100, 90, 80)):
            w.age_noncurrent(v, prefix + "k", vid, age)
    y1 = v.put("hist/young", b"1")["VersionId"]
    v.put("hist/young", b"2")
    w.age_noncurrent(v, "hist/young", y1, 5)
    # a marker that is the only version left, one that still covers history, a marker of a different prefix
    d1 = v.put("dm/lone", b"x")["VersionId"]
    v.s3.delete_object(Bucket=v.name, Key="dm/lone")
    v.s3.delete_object(Bucket=v.name, Key="dm/lone", VersionId=d1)
    v.put("dm/covering", b"x")
    v.s3.delete_object(Bucket=v.name, Key="dm/covering")
    v.put("keep/lone", b"x")
    v.s3.delete_object(Bucket=v.name, Key="keep/lone")
    v.s3.delete_object(Bucket=v.name, Key="keep/lone", VersionId=v.versions("keep/lone")[0][0]["VersionId"])

    # ---- multipart uploads -----------------------------------------------------------------------
    m = w.m = w.bucket("lcm", lifecycle=[{"id": "abort", "filter": {"prefix": "tmp/"}, "abort_multipart_days": 1}])
    w.up_old = m.s3.create_multipart_upload(Bucket=m.name, Key="tmp/old")["UploadId"]
    m.s3.upload_part(Bucket=m.name, Key="tmp/old", UploadId=w.up_old, PartNumber=1, Body=b"part")
    w.up_other = m.s3.create_multipart_upload(Bucket=m.name, Key="other/old")["UploadId"]
    w.up_young = m.s3.create_multipart_upload(Bucket=m.name, Key="tmp/young")["UploadId"]
    w.age_upload(m, w.up_old, 3)
    w.age_upload(m, w.up_other, 3)
    m2 = w.m2 = w.bucket("lcm2", lifecycle=[{"id": "abort-all", "abort_multipart_days": 2}])
    w.up2_old = m2.s3.create_multipart_upload(Bucket=m2.name, Key="a/b")["UploadId"]
    w.up2_young = m2.s3.create_multipart_upload(Bucket=m2.name, Key="c")["UploadId"]
    w.age_upload(m2, w.up2_old, 5)
    w.age_upload(m2, w.up2_young, 1)

    # ---- more candidates than one batch ----------------------------------------------------------
    k = w.k = w.bucket("lck", lifecycle=[{"id": "bulk", "filter": {"prefix": "bulk/"}, "expire_days": 1}])
    for i in range(130):
        k.put("bulk/%03d" % i, b"b")
        w.age_object(k, "bulk/%03d" % i, 2)
    for i in range(5):
        k.put("keep/%d" % i, b"k")
        w.age_object(k, "keep/%d" % i, 2)       # old but outside the rule's prefix


World.setup = _setup


# --------------------------------------------------------------------------------------------
# expire_days, unversioned

def test_expire_days_deletes_old_objects_with_a_matching_prefix(world):
    u = world.u
    assert wait_for(lambda: not u.exists("tmp/old")), "tmp/old (3 days old, rule tmp: 2 days) was not expired within 40 s; log tail:\n" + world.node.logtext()[-800:]
    assert u.exists("tmp/edge"), "1.9 days is younger than the 2-day rule"
    assert u.exists("tmp/young")
    assert u.exists("other/ancient"), "no rule covers other/: nothing may touch it"


def test_expired_objects_leave_every_listing(world):
    u = world.u
    assert wait_for(lambda: "tmp/old" not in u.keys())
    assert "tmp/old" not in [o["Key"] for o in u.s3.list_objects(Bucket=u.name, Prefix="tmp/").get("Contents", [])]
    assert "tmp/old" not in [v["Key"] for v in u.s3.list_object_versions(Bucket=u.name, Prefix="tmp/").get("Versions", [])]
    assert sorted(o["Key"] for o in u.s3.list_objects_v2(Bucket=u.name, Prefix="tmp/")["Contents"]) == ["tmp/edge", "tmp/young"]


def test_tag_filter_requires_every_listed_tag(world):
    u = world.u
    assert wait_for(lambda: not u.exists("tagged/old"))
    assert u.exists("tagged/untagged"), "no tags: the filter does not match"
    assert u.exists("tagged/wrongtag"), "scan=dirty is not scan=clean"
    assert u.exists("tagged/young")


def test_size_filter(world):
    u = world.u
    assert wait_for(lambda: not u.exists("sized/in"))
    assert u.exists("sized/small") and u.exists("sized/big")


def test_a_disabled_rule_does_nothing(world):
    u = world.u
    assert wait_for(lambda: not u.exists("tmp/old"))             # the janitor has certainly run by now
    time.sleep(2.5)
    assert u.exists("off/old")


def test_the_earliest_expiry_among_matching_rules_wins(world):
    u = world.u
    assert wait_for(lambda: not u.exists("multi/a")), "the 1-day rule must beat the 10-day rule"
    assert u.exists("multi/b")


def test_a_backlog_larger_than_one_batch_is_cleared(world):
    k = world.k
    assert wait_for(lambda: not any(key.startswith("bulk/") for key in k.keys()), timeout=60), "left over: %d" % len([x for x in k.keys() if x.startswith("bulk/")])
    assert sorted(k.keys()) == ["keep/%d" % i for i in range(5)]


def test_lifecycle_actions_are_counted_per_bucket_in_a_metric(world):
    import bvm
    k = world.k
    assert wait_for(lambda: not any(key.startswith("bulk/") for key in k.keys()), timeout=60)
    rows = bvm.scrape_node(world.node).series("binvault_lifecycle_actions_total", bucket=k.name)
    assert rows, "spec 9.2: binvault_lifecycle_actions_total{bucket,action}"
    assert sum(v for _, v in rows) == 130, "130 objects were expired in this bucket: %r" % rows
    assert all(l.get("action") for l, _ in rows), rows


# --------------------------------------------------------------------------------------------
# versioned buckets

def test_expiring_the_current_version_of_a_versioned_key_adds_a_delete_marker(world):
    v = world.v
    assert wait_for(lambda: bool(v.versions("cur/a")[1])), "no delete marker for cur/a"
    versions, markers = v.versions("cur/a")
    assert len(versions) == 1 and len(markers) == 1 and markers[0]["IsLatest"] and not versions[0]["IsLatest"], "expiry only hides the data version"
    with s3error("NoSuchKey", 404) as e:
        v.s3.get_object(Bucket=v.name, Key="cur/a")
    assert e.error.response["ResponseMetadata"]["HTTPHeaders"].get("x-amz-delete-marker") == "true"
    assert v.s3.get_object(Bucket=v.name, Key="cur/a", VersionId=versions[0]["VersionId"])["Body"].read() == b"old current"
    assert v.exists("cur/b") and not v.versions("cur/b")[1]


def test_noncurrent_days_with_keep(world):
    v = world.v
    vids = world.hist["hist/"]
    assert wait_for(lambda: vids[0] not in [x["VersionId"] for x in v.versions("hist/k")[0]]), "the oldest noncurrent version was not removed"
    left = [x["VersionId"] for x in v.versions("hist/k")[0]]
    assert vids[0] not in left and vids[1] not in left, "both versions beyond the keep window are removed"
    assert vids[2] in left, "noncurrent_keep=1 keeps the newest noncurrent version although it is older than 30 days"
    assert vids[3] in left, "the current version is never removed by noncurrent_days"
    assert v.s3.get_object(Bucket=v.name, Key="hist/k")["Body"].read() == b"v4"


def test_noncurrent_days_without_keep_removes_every_old_noncurrent_version(world):
    v = world.v
    vids = world.hist["hist0/"]
    assert wait_for(lambda: len(v.versions("hist0/k")[0]) == 1)
    assert [x["VersionId"] for x in v.versions("hist0/k")[0]] == [vids[3]]


def test_recent_noncurrent_versions_stay(world):
    v = world.v
    assert wait_for(lambda: len(v.versions("hist0/k")[0]) == 1)       # the janitor has run
    assert len(v.versions("hist/young")[0]) == 2


def test_expire_delete_markers_removes_only_lone_markers(world):
    v = world.v
    assert wait_for(lambda: not v.versions("dm/lone")[1]), "a delete marker that is the only version left must go"
    assert v.versions("dm/lone") == ([], [])
    versions, markers = v.versions("dm/covering")
    assert len(versions) == 1 and len(markers) == 1, "a marker above history stays"
    assert len(v.versions("keep/lone")[1]) == 1, "no rule covers keep/: its lone marker stays"


# --------------------------------------------------------------------------------------------
# multipart

def test_abort_multipart_days_aborts_old_uploads_matching_the_prefix(world):
    m = world.m
    assert wait_for(lambda: world.up_old not in [u["UploadId"] for u in m.s3.list_multipart_uploads(Bucket=m.name).get("Uploads", [])]), "old upload still open"
    left = [u["UploadId"] for u in m.s3.list_multipart_uploads(Bucket=m.name).get("Uploads", [])]
    assert world.up_other in left, "outside the rule's prefix"
    assert world.up_young in left, "younger than the rule"
    with s3error("NoSuchUpload", 404):
        m.s3.upload_part(Bucket=m.name, Key="tmp/old", UploadId=world.up_old, PartNumber=2, Body=b"late")


def test_abort_multipart_days_without_a_filter(world):
    m2 = world.m2
    assert wait_for(lambda: world.up2_old not in [u["UploadId"] for u in m2.s3.list_multipart_uploads(Bucket=m2.name).get("Uploads", [])])
    assert [u["UploadId"] for u in m2.s3.list_multipart_uploads(Bucket=m2.name).get("Uploads", [])] == [world.up2_young]


# --------------------------------------------------------------------------------------------
# headers and the S3 view of the rules (no time travel needed)

def parse_expiration(h):
    m = re.fullmatch(r'expiry-date="([^"]+)", rule-id="([^"]+)"', h)
    assert m, "x-amz-expiration has the form expiry-date=\"<HTTP-date>\", rule-id=\"<id>\": %r" % h
    return email.utils.parsedate_to_datetime(m.group(1)), m.group(2)


def test_x_amz_expiration_header_on_put_get_and_head():
    bk = bvh.fresh_bucket("lchdr", lifecycle=[{"id": "scratch", "filter": {"prefix": "exp/"}, "expire_days": 3},
                                              {"id": "tagged", "filter": {"prefix": "tg/", "tags": {"a": "1"}}, "expire_days": 9}])
    r = raw_put(bk, "exp/one", b"x")
    assert r.status == 200 and r.header("x-amz-expiration"), r.raw_headers
    when, rid = parse_expiration(r.header("x-amz-expiration"))
    assert rid == "scratch"
    g = raw_get(bk, "exp/one")
    h = raw_head(bk, "exp/one")
    lm = email.utils.parsedate_to_datetime(g.header("last-modified"))
    assert g.header("x-amz-expiration") == h.header("x-amz-expiration") == r.header("x-amz-expiration")
    # a day is 24 hours from the version's timestamp; not rounded to midnight (spec 3.12)
    assert abs((when - lm).total_seconds() - 3 * 86400) <= 1.5, (when, lm)
    assert raw_put(bk, "other/one", b"x").header("x-amz-expiration") is None
    assert raw_head(bk, "other/one").header("x-amz-expiration") is None
    assert bk.s3.head_object(Bucket=bk.name, Key="exp/one")["Expiration"] == h.header("x-amz-expiration")


def test_x_amz_expiration_follows_tag_filters_and_is_absent_without_expire_days():
    bk = bvh.fresh_bucket("lchdr2", lifecycle=[{"id": "tagged", "filter": {"prefix": "tg/", "tags": {"a": "1"}}, "expire_days": 9},
                                               {"id": "nc", "filter": {"prefix": "nc/"}, "noncurrent_days": 3}])
    assert raw_put(bk, "tg/untagged", b"x").header("x-amz-expiration") is None
    r = raw_put(bk, "tg/tagged", b"x", headers={"x-amz-tagging": "a=1"})
    assert r.header("x-amz-expiration") and parse_expiration(r.header("x-amz-expiration"))[1] == "tagged"
    assert raw_put(bk, "nc/x", b"x").header("x-amz-expiration") is None, "noncurrent_days rules set no expiration header"


def test_a_disabled_expire_rule_sets_no_header():
    bk = bvh.fresh_bucket("lchdr3", lifecycle=[{"id": "off", "enabled": False, "expire_days": 2}])
    assert raw_put(bk, "k", b"x").header("x-amz-expiration") is None


def test_lifecycle_rule_validation_in_the_admin_api():
    bk = bvh.fresh_bucket("lcval")
    bad = [
        [{"id": "neg", "expire_days": -1}],
        [{"id": "keep-only", "noncurrent_keep": 3}],
        [{"id": "dup", "expire_days": 1}, {"id": "dup", "expire_days": 2}],
        [{"id": "nothing"}],
        [{"id": "x", "expire_days": 1, "bogus_field": 1}],
        [{"id": "sz", "expire_days": 1, "filter": {"min_size": 10, "max_size": 5}}],
        [{"id": "r%d" % i, "expire_days": 1} for i in range(101)],
    ]
    for rules in bad:
        with pytest.raises(AdminError) as ei:
            ADMIN.patch_bucket(bk.name, lifecycle=rules)
        assert ei.value.status == 400, (rules[:1], ei.value)
    ADMIN.patch_bucket(bk.name, lifecycle=[{"id": "r%d" % i, "expire_days": 1} for i in range(100)])
    ADMIN.patch_bucket(bk.name, lifecycle=[])
    with s3error("NoSuchLifecycleConfiguration", 404):
        bk.s3.get_bucket_lifecycle_configuration(Bucket=bk.name)
