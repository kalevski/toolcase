"""Operating the binary: restarts, subcommands, configuration, key rotation, shutdown (spec 2.1, 2.3, 4.7, 9.x)."""
import base64
import glob
import json
import os
import signal
import subprocess
import threading
import time
import urllib.request

import pytest

import bvh
from bvh import ADMIN, KiB, MiB, md5hex, rnd, s3error, uniq

BIN = bvh.BIN


def newkey():
    return base64.b64encode(os.urandom(32)).decode()


def populated(node, tag="ops"):
    """A bucket with a bit of everything; returns (name, ak, sk, expected dict)."""
    name, ak, sk = node.fresh_bucket(tag, versioning="enabled", encryption="sse-s3", cors=[{"allowed_origins": ["https://a.example.com"], "allowed_methods": ["GET"]}],
                                     lifecycle=[{"id": "l", "filter": {"prefix": "tmp/"}, "expire_days": 30}], quota_bytes=100 * MiB)
    c = node.client(ak, sk)
    exp = {}
    for k in ("a.txt", "dir/b.bin", "dir/sub/c"):
        body = rnd(5000)
        r = c.put_object(Bucket=name, Key=k, Body=body, Metadata={"m": "1"}, Tagging="t=1")
        exp[k] = (body, r["ETag"], r["VersionId"])
    body2 = rnd(77)
    r2 = c.put_object(Bucket=name, Key="a.txt", Body=body2)             # a second version of a.txt
    exp["a.txt-v2"] = (body2, r2["ETag"], r2["VersionId"])
    c.delete_object(Bucket=name, Key="gone.txt")                         # nothing there: no marker
    return name, ak, sk, exp


def check_populated(node, name, ak, sk, exp):
    c = node.client(ak, sk)
    assert c.get_object(Bucket=name, Key="a.txt")["Body"].read() == exp["a.txt-v2"][0]
    for k in ("dir/b.bin", "dir/sub/c"):
        r = c.get_object(Bucket=name, Key=k)
        assert r["Body"].read() == exp[k][0] and r["ETag"] == exp[k][1] and r["Metadata"] == {"m": "1"} and r["ServerSideEncryption"] == "AES256"
    old = c.get_object(Bucket=name, Key="a.txt", VersionId=exp["a.txt"][2])
    assert old["Body"].read() == exp["a.txt"][0]
    assert len(c.list_object_versions(Bucket=name)["Versions"]) == 4
    assert {t["Key"] for t in c.get_object_tagging(Bucket=name, Key="dir/b.bin")["TagSet"]} == {"t"}
    b = node.admin.get_bucket(name)
    assert b["versioning"] == "enabled" and b["encryption"] == "sse-s3" and b["quota_bytes"] == 100 * MiB and b["lifecycle"][0]["id"] == "l"
    assert c.get_bucket_cors(Bucket=name)["CORSRules"][0]["AllowedOrigins"] == ["https://a.example.com"]


# --------------------------------------------------------------------------------------------
# restarts

def test_everything_survives_a_graceful_restart():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk, exp = populated(node)
        c = node.client(ak, sk)
        up = c.create_multipart_upload(Bucket=name, Key="open/mp")["UploadId"]
        e1 = c.upload_part(Bucket=name, Key="open/mp", UploadId=up, PartNumber=1, Body=rnd(5 * MiB))["ETag"]
        node.stop()
        assert node.proc.returncode == 0, "SIGTERM on an idle node must exit 0, got %r" % node.proc.returncode
        node.start()
        check_populated(node, name, ak, sk, exp)
        c = node.client(ak, sk)
        assert [u["UploadId"] for u in c.list_multipart_uploads(Bucket=name)["Uploads"]] == [up], "an open multipart upload survives"
        e2 = c.upload_part(Bucket=name, Key="open/mp", UploadId=up, PartNumber=2, Body=b"tail")["ETag"]
        c.complete_multipart_upload(Bucket=name, Key="open/mp", UploadId=up, MultipartUpload={"Parts": [{"PartNumber": 1, "ETag": e1}, {"PartNumber": 2, "ETag": e2}]})
        assert c.head_object(Bucket=name, Key="open/mp")["ContentLength"] == 5 * MiB + 4


def test_acknowledged_writes_survive_kill_9():
    with bvh.Node() as node:                                 # fsync stays on: a 200 means data and metadata are on stable storage
        name, ak, sk, exp = populated(node)
        node.kill9()
        node.start()
        check_populated(node, name, ak, sk, exp)
        code, out = node.cli("validate", "--deep")
        assert code == 0, out


def test_tokens_keep_working_across_restarts_with_the_same_secret():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("tok")
        node.stop()
        node.start()
        node.client(ak, sk).put_object(Bucket=name, Key="k", Body=b"x")
        assert node.admin.list_tokens(name)["items"][0]["access_key_id"] == ak


# --------------------------------------------------------------------------------------------
# subcommands

def test_validate_passes_on_a_healthy_directory_and_changes_nothing():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        populated(node)
        node.stop()
        before = sorted(glob.glob(os.path.join(node.dir, "data", "**", "*"), recursive=True))
        for args in (("validate",), ("validate", "--deep")):
            code, out = node.cli(*args)
            assert code == 0, (args, out)
        after = sorted(glob.glob(os.path.join(node.dir, "data", "**", "*"), recursive=True))
        assert [p for p in after if not p.endswith(("-wal", "-shm"))] == [p for p in before if not p.endswith(("-wal", "-shm"))]


def test_validate_deep_notices_a_missing_blob():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("deep")
        c = node.client(ak, sk)
        c.put_object(Bucket=name, Key="k", Body=rnd(3000))
        node.stop()
        blobs = [p for p in glob.glob(os.path.join(node.dir, "data", "blobs", "**", "*"), recursive=True) if os.path.isfile(p)]
        assert blobs, "no blob file found under data/blobs"
        os.remove(blobs[0])
        code, out = node.cli("validate")
        assert code == 0, "without --deep blobs are not opened: %s" % out
        code, out = node.cli("validate", "--deep")
        assert code != 0, out
        assert "blob" in out.lower(), out


def test_validate_with_the_wrong_master_key_names_the_problem():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("wk")
        node.stop()
        code, out = node.cli("validate", env={"BINVAULT_MASTER_KEY": newkey()})
        assert code != 0 and ("master key" in out.lower() or "seal" in out.lower() or ak in out), out
        # boot fails too
        e = node.base_env()
        e["BINVAULT_MASTER_KEY"] = newkey()
        p = subprocess.run([BIN, "run"], env=e, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=30)
        assert p.returncode != 0, p.stdout.decode()[-500:]
        # and the right key still opens everything
        node.start()
        node.client(ak, sk).put_object(Bucket=name, Key="k", Body=b"x")


def test_healthcheck_exit_codes():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        e = {"BINVAULT_LISTEN": "127.0.0.1:%d" % node.port}
        code, out = node.cli("healthcheck", env=e)
        assert code == 0, out
        node.stop()
        code, out = node.cli("healthcheck", env=e)
        assert code == 1, out


def test_version_prints_build_info():
    p = subprocess.run([BIN, "version"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=30)
    out = p.stdout.decode()
    assert p.returncode == 0 and out.startswith("binvault ") and "go" in out, out


def test_unknown_subcommand_is_a_usage_error():
    p = subprocess.run([BIN, "frobnicate"], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, timeout=30)
    assert p.returncode == 2 and b"unknown subcommand" in p.stdout, p.stdout


# --------------------------------------------------------------------------------------------
# configuration

def boot(env, timeout=15):
    e = {k: v for k, v in os.environ.items() if not k.startswith("BINVAULT_")}
    e.update(env)
    try:
        p = subprocess.run([BIN, "run"], env=e, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, timeout=timeout)
        return p.returncode, p.stdout.decode("utf-8", "replace")
    except subprocess.TimeoutExpired as ex:
        return None, (ex.stdout or b"").decode("utf-8", "replace")


@pytest.mark.parametrize("override,why", [
    ({"BINVAULT_ADMIN_TOKEN": "short"}, "admin token shorter than 32 characters"),
    ({"BINVAULT_ADMIN_TOKEN": "a" * 20 + "," + "b" * 20}, "a comma-separated list needs 32 characters each"),
    ({"BINVAULT_ADMIN_TOKEN": ""}, "no admin token"),
    ({"BINVAULT_MASTER_KEY": ""}, "no master key"),
    ({"BINVAULT_MASTER_KEY": "not base64 !!!"}, "master key that is not base64"),
    ({"BINVAULT_MASTER_KEY": base64.b64encode(b"short").decode()}, "master key of the wrong length"),
    ({"BINVAULT_LISTEN": "definitely not an address"}, "bad listen address"),
    ({"BINVAULT_FSYNC": "maybe"}, "bad boolean"),
    ({"BINVAULT_MIN_FREE_MB": "-4"}, "negative size"),
    ({"BINVAULT_LIFECYCLE_INTERVAL": "soon"}, "bad duration"),
    ({"BINVAULT_MAX_OBJECT_MB": "9999999999"}, "above the 5 TiB hard ceiling"),
])
def test_bad_configuration_stops_the_boot(tmp_path, override, why):
    env = {"BINVAULT_ADMIN_TOKEN": "t" * 40, "BINVAULT_MASTER_KEY": newkey(), "BINVAULT_DATA_DIR": str(tmp_path / "data"),
           "BINVAULT_LISTEN": "127.0.0.1:0", "BINVAULT_ADMIN_LISTEN": "127.0.0.1:0"}
    env.update(override)
    code, out = boot(env)
    assert code is not None, "the node kept running with %s: %s" % (why, out[-300:])
    assert code != 0 and out.strip(), "%s must fail loudly: rc=%r out=%r" % (why, code, out[-300:])


def test_secrets_are_never_logged_and_unknown_variables_are_warned_about():
    with bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_FROBNICATE": "1", "BINVAULT_LOG_LEVEL": "debug"}) as node:
        name, ak, sk = node.fresh_bucket("log")
        c = node.client(ak, sk)
        c.put_object(Bucket=name, Key="k", Body=b"x")
        c.get_object(Bucket=name, Key="k")
        node.admin.list_tokens(name)
        node.stop()
        log = node.logtext()
        assert "BINVAULT_FROBNICATE" in log, "unknown BINVAULT_* variables produce a warning"
        for secret in (node.token, node.master, sk):
            assert secret not in log, "a secret leaked into the log"
        assert "level=ERROR" not in log, [l for l in log.splitlines() if "level=ERROR" in l][:3]


def test_json_log_format():
    with bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_LOG_FORMAT": "json"}) as node:
        name, ak, sk = node.fresh_bucket("jlog")
        node.client(ak, sk).put_object(Bucket=name, Key="k", Body=b"x")
        node.stop()
        lines = [l for l in node.logtext().splitlines() if l.strip()]
        assert lines
        recs = [json.loads(l) for l in lines]
        reqs = [r for r in recs if r.get("msg") == "request"]
        assert any(r.get("op") == "PutObject" and r.get("status") == 200 for r in reqs), reqs[:3]


def test_request_log_lines_carry_the_documented_fields():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("rl")
        node.client(ak, sk).put_object(Bucket=name, Key="k", Body=b"abc")
        node.stop()
        line = next(l for l in node.logtext().splitlines() if "op=PutObject" in l)
        for field in ("request_id=", "method=PUT", "status=200", "duration_ms=", "bytes_in=3", "principal=token:" + ak, "bucket=" + name):
            assert field in line, (field, line)


def test_the_effective_config_endpoint_hides_secrets():
    with bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_REGION": "eu-central-1"}) as node:
        code, cfg = node.admin.call("GET", "/config")
        text = json.dumps(cfg)
        assert node.token not in text and node.master not in text
        assert "eu-central-1" in text
        code, st = node.admin.call("GET", "/status")
        assert st.get("version") is not None or st.get("uptime") is not None or st, st


def test_admin_token_rotation_accepts_every_listed_token():
    t1, t2 = "first-" + "a" * 40, "second-" + "b" * 40
    with bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_ADMIN_TOKEN": "%s,%s" % (t1, t2)}) as node:
        for t in (t1, t2):
            req = urllib.request.Request(node.admin.url + "/_admin/v1/status", headers={"Authorization": "Bearer " + t})
            with urllib.request.urlopen(req, timeout=10) as r:
                assert r.status == 200
        req = urllib.request.Request(node.admin.url + "/_admin/v1/status", headers={"Authorization": "Bearer " + "c" * 40})
        with pytest.raises(urllib.error.HTTPError) as ei:
            urllib.request.urlopen(req, timeout=10)
        assert ei.value.code == 401


def test_region_setting_is_reported_and_any_signing_region_is_accepted():
    with bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_REGION": "eu-west-1"}) as node:
        name, ak, sk = node.fresh_bucket("reg")
        for region in ("eu-west-1", "us-east-1", "auto", "ap-southeast-9"):
            c = node.client(ak, sk, region=region)
            c.put_object(Bucket=name, Key="k-" + region, Body=b"x")
        c = node.client(ak, sk, region="eu-west-1")
        assert c.get_bucket_location(Bucket=name)["LocationConstraint"] == "eu-west-1"
        r = bvh.Raw(ak, sk, endpoint=node.endpoint).request("HEAD", "/" + name)
        assert r.status == 200 and r.header("x-amz-bucket-region") in ("eu-west-1", None), r.raw_headers


def test_without_a_domain_the_host_header_never_selects_a_bucket():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}, domain=None) as node:
        name, ak, sk = node.fresh_bucket("nodom")
        node.client(ak, sk).put_object(Bucket=name, Key="k", Body=b"x")
        raw = bvh.Raw(ak, sk, endpoint=node.endpoint)
        r = raw.request("GET", "/k", host="%s.s3.example.com" % name, connect_host="127.0.0.1")
        assert r.status in (403, 404), r             # "k" is read as a bucket name
        assert raw.request("GET", "/%s/k" % name, host="%s.s3.example.com" % name, connect_host="127.0.0.1").status == 200


# --------------------------------------------------------------------------------------------
# key rotation (spec 4.7)

def test_master_key_rotation_end_to_end():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk, exp = populated(node, "rot")
        key_a = node.master
        key_b = newkey()
        # 1. new key current, old key decrypt-only: everything still opens
        node.stop()
        node.master = key_b
        node.env["BINVAULT_MASTER_KEY_OLD"] = key_a
        node.start()
        check_populated(node, name, ak, sk, exp)
        # 2. re-seal everything under the new key (server stopped)
        node.stop()
        code, out = node.cli("rekey")
        assert code == 0, out
        # 3. the old key can go
        del node.env["BINVAULT_MASTER_KEY_OLD"]
        code, out = node.cli("validate", "--deep")
        assert code == 0, out
        node.start()
        check_populated(node, name, ak, sk, exp)
        # 4. the old key alone no longer opens anything
        node.stop()
        node.master = key_a
        code, out = node.cli("validate")
        assert code != 0, out


def test_old_key_is_needed_until_rekey_has_run():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("rot2", encryption="sse-s3")
        node.client(ak, sk).put_object(Bucket=name, Key="k", Body=b"secret data")
        key_a = node.master
        node.stop()
        node.master = newkey()
        code, out = node.cli("validate")
        assert code != 0, "new key without the old one cannot open the sealed values: " + out
        node.env["BINVAULT_MASTER_KEY_OLD"] = key_a
        code, out = node.cli("validate")
        assert code == 0, out


# --------------------------------------------------------------------------------------------
# resources and shutdown

def test_storage_full_refuses_writes_but_not_reads_or_deletes():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("full")
        c = node.client(ak, sk)
        c.put_object(Bucket=name, Key="k", Body=b"existing")
        up = c.create_multipart_upload(Bucket=name, Key="mp")["UploadId"]
        node.stop()
        node.env["BINVAULT_MIN_FREE_MB"] = "1000000000"          # a petabyte must be free: it never is
        node.start(ready="port")
        r = bvh.http_raw("GET", node.endpoint.split("//")[1], "/_healthz")
        assert r.status == 503 and r.body.strip(), "spec 9.3: 503 naming the failing check, got %r" % r
        c = node.client(ak, sk)
        # every operation that has to write bytes is refused ...
        for fn in (lambda: c.put_object(Bucket=name, Key="new", Body=b"x"),
                   lambda: c.upload_part(Bucket=name, Key="mp", UploadId=up, PartNumber=1, Body=b"x" * 100),
                   lambda: c.upload_part_copy(Bucket=name, Key="mp", UploadId=up, PartNumber=2, CopySource={"Bucket": name, "Key": "k"}),
                   lambda: c.copy_object(Bucket=name, Key="cp-enc", CopySource={"Bucket": name, "Key": "k"}, ServerSideEncryption="AES256")):   # re-encrypts: a new blob
            with s3error("StorageFull", 507):
                fn()
        # ... a copy that only adds a row for the same blob costs no disk (spec 3.4): either answer is fine, nothing else is
        try:
            assert c.copy_object(Bucket=name, Key="cp", CopySource={"Bucket": name, "Key": "k"})["ResponseMetadata"]["HTTPStatusCode"] == 200
        except Exception as e:      # noqa: BLE001
            assert "StorageFull" in repr(e), e
        assert c.get_object(Bucket=name, Key="k")["Body"].read() == b"existing"
        assert c.delete_object(Bucket=name, Key="k")["ResponseMetadata"]["HTTPStatusCode"] == 204
        st = node.admin.call("GET", "/status")[1]
        assert "free" in json.dumps(st).lower(), st


def test_graceful_shutdown_lets_an_inflight_download_finish():
    with bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_SHUTDOWN_TIMEOUT": "30s"}) as node:
        name, ak, sk = node.fresh_bucket("shut", limits={"bytes_out_per_second": 200 * KiB})
        c = node.client(ak, sk)
        data = rnd(600 * KiB)
        c.put_object(Bucket=name, Key="big", Body=data)
        result = {}

        def download():
            try:
                result["data"] = c.get_object(Bucket=name, Key="big")["Body"].read()
            except Exception as e:           # noqa: BLE001
                result["error"] = e

        t = threading.Thread(target=download)
        t.start()
        time.sleep(0.8)
        node.proc.send_signal(signal.SIGTERM)
        t.join(30)
        assert result.get("data") == data, "an in-flight transfer must complete during shutdown: %r" % result.get("error")
        node.proc.wait(30)
        assert node.proc.returncode == 0
        # the listener is gone afterwards
        with pytest.raises(Exception):
            node.client(ak, sk).head_object(Bucket=name, Key="big")


def test_admin_status_reports_totals():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("st")
        c = node.client(ak, sk)
        for i in range(3):
            c.put_object(Bucket=name, Key="k%d" % i, Body=b"x" * 100)
        st = node.admin.call("GET", "/status")[1]
        text = json.dumps(st)
        assert '"buckets"' in text or "buckets" in text, st
        b = node.admin.get_bucket(name)
        assert b["stats"]["objects"] == 3 and b["stats"]["bytes"] == 300
        lst = node.admin.call("GET", "/buckets?stats=true")[1]["items"]
        assert any(x["name"] == name and x["stats"]["objects"] == 3 for x in lst), lst
