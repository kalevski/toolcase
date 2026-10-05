"""Configuration the other modules do not reach: secrets from files, the exposure rules of the admin listener, built-in TLS
for the public and the admin listener, HTTP/2 (spec 2.3, 2.4, 4.2, 10)."""
import base64
import http.client
import json
import os
import shutil
import socket
import ssl
import subprocess
import tempfile
import time
import urllib.request
import uuid

import boto3
import pytest
from botocore.config import Config

import bvh
from bvh import MiB, rnd
from bvx_b import _make_cert


def newkey():
    return base64.b64encode(os.urandom(32)).decode()


def newtoken():
    return "tok-" + uuid.uuid4().hex + uuid.uuid4().hex


def try_boot(env, wait=6):
    """Start a node with this environment (on top of the harness defaults) and report (exit code or None if it kept running, output)."""
    node = bvh.Node(env=env)
    node.port, node.aport = bvh._free_port(), bvh._free_port()
    p = subprocess.Popen([bvh.BIN, "run"], env=node.base_env(), stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL)
    try:
        out, _ = p.communicate(timeout=wait)
        return p.returncode, out.decode("utf-8", "replace")
    except subprocess.TimeoutExpired:
        p.kill()
        out, _ = p.communicate()
        return None, out.decode("utf-8", "replace")


@pytest.fixture()
def certs():
    d = tempfile.mkdtemp(prefix="bvt-cfg-")
    try:
        yield d
    finally:
        shutil.rmtree(d, ignore_errors=True)


def unverified():
    ctx = ssl.create_default_context()
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    return ctx


def https_call(port, path, token=None, method="GET", body=None, headers=None):
    conn = http.client.HTTPSConnection("127.0.0.1", port, timeout=20, context=unverified())
    try:
        h = dict(headers or {})
        if token:
            h["Authorization"] = "Bearer " + token
        conn.request(method, path, body=body, headers=h)
        r = conn.getresponse()
        return r.status, r.read()
    finally:
        conn.close()


def wait_https(port, path="/_healthz", timeout=15):
    end = time.time() + timeout
    while time.time() < end:
        try:
            if https_call(port, path)[0] == 200:
                return
        except OSError:
            pass
        time.sleep(0.1)
    raise AssertionError("no TLS answer on port %d" % port)


def tls_client(port, ak, sk):
    import urllib3
    urllib3.disable_warnings()
    return boto3.client("s3", endpoint_url="https://127.0.0.1:%d" % port, aws_access_key_id=ak, aws_secret_access_key=sk, region_name=bvh.REGION, verify=False,
                        config=Config(signature_version="s3v4", s3={"addressing_style": "path"}, retries={"max_attempts": 1}))


# --------------------------------------------------------------------------------------------
# secrets from files (spec 2.3)

@pytest.mark.parametrize("newline", ["", "\n", "\r\n"])
def test_secrets_can_come_from_files(tmp_path, newline):
    token, master = newtoken(), newkey()
    (tmp_path / "admin-token").write_text(token + newline)
    (tmp_path / "master-key").write_text(master + newline)
    node = bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_ADMIN_TOKEN": None, "BINVAULT_MASTER_KEY": None,
                         "BINVAULT_ADMIN_TOKEN_FILE": str(tmp_path / "admin-token"), "BINVAULT_MASTER_KEY_FILE": str(tmp_path / "master-key")})
    node.token, node.master = token, master
    with node:
        name, ak, sk = node.fresh_bucket("file")
        node.client(ak, sk).put_object(Bucket=name, Key="k", Body=b"hello")
        node.stop()
        node.env = {"BINVAULT_FSYNC": "false"}                      # the same secrets, now from plain variables
        node.start()
        assert node.client(ak, sk).get_object(Bucket=name, Key="k")["Body"].read() == b"hello", "the sealed token secret must open under the key that was read from the file"


@pytest.mark.parametrize("variable", ["BINVAULT_ADMIN_TOKEN_FILE", "BINVAULT_MASTER_KEY_FILE"])
def test_a_missing_secret_file_stops_the_boot(tmp_path, variable):
    plain = variable.replace("_FILE", "")
    rc, out = try_boot({plain: None, variable: str(tmp_path / "does-not-exist")})
    assert rc not in (None, 0), "the node must not start without its %s: %s" % (plain, out[-300:])
    assert "does-not-exist" in out or variable in out, "the message should name the file or the variable: %s" % out[-300:]


def test_a_weak_admin_token_in_a_file_stops_the_boot(tmp_path):
    (tmp_path / "t").write_text("short\n")
    rc, out = try_boot({"BINVAULT_ADMIN_TOKEN": None, "BINVAULT_ADMIN_TOKEN_FILE": str(tmp_path / "t")})
    assert rc not in (None, 0), out[-300:]


# --------------------------------------------------------------------------------------------
# where the admin listener may listen (spec 2.3, 10)

@pytest.mark.parametrize("addr", ["0.0.0.0:%d", ":%d", "[::]:%d"])
def test_an_off_loopback_admin_listener_needs_tls_or_the_insecure_flag(addr):
    rc, out = try_boot({"BINVAULT_ADMIN_LISTEN": addr % bvh._free_port()})
    assert rc not in (None, 0), "the admin API must not come up in plain HTTP on %s: %s" % (addr, out[-300:])
    assert "INSECURE_HTTP" in out or "TLS" in out, out[-300:]


def test_the_insecure_flag_allows_a_wildcard_admin_listener():
    port = bvh._free_port()
    with bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_ADMIN_LISTEN": "0.0.0.0:%d" % port, "BINVAULT_ADMIN_INSECURE_HTTP": "true"}) as node:
        admin = bvh.Admin("http://127.0.0.1:%d" % port, node.token)
        assert admin.call("GET", "/status")[0] == 200


def test_tls_allows_a_wildcard_admin_listener_without_the_insecure_flag(certs):
    cert, key = _make_cert(certs)
    port = bvh._free_port()
    with bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_ADMIN_LISTEN": "0.0.0.0:%d" % port,
                       "BINVAULT_ADMIN_TLS_CERT_FILE": cert, "BINVAULT_ADMIN_TLS_KEY_FILE": key}) as node:
        status, body = https_call(port, "/_admin/v1/status", node.token)
        assert status == 200 and b'"uptime_seconds"' in body, (status, body)


# --------------------------------------------------------------------------------------------
# TLS must fail closed (spec 2.3: both files or none)

def test_incomplete_or_wrong_tls_configuration_stops_the_boot(certs):
    cert, key = _make_cert(certs)
    other = os.path.join(certs, "other")
    os.mkdir(other)
    cert2, key2 = _make_cert(other)
    cases = {
        "public: certificate without key": {"BINVAULT_TLS_CERT_FILE": cert},
        "public: key without certificate": {"BINVAULT_TLS_KEY_FILE": key},
        "public: files that do not exist": {"BINVAULT_TLS_CERT_FILE": cert + ".nope", "BINVAULT_TLS_KEY_FILE": key + ".nope"},
        "public: key of another certificate": {"BINVAULT_TLS_CERT_FILE": cert, "BINVAULT_TLS_KEY_FILE": key2},
        "admin: certificate without key": {"BINVAULT_ADMIN_TLS_CERT_FILE": cert},
        "admin: key without certificate": {"BINVAULT_ADMIN_TLS_KEY_FILE": key},
        "admin: files that do not exist": {"BINVAULT_ADMIN_TLS_CERT_FILE": cert + ".nope", "BINVAULT_ADMIN_TLS_KEY_FILE": key + ".nope"},
        "admin: key of another certificate": {"BINVAULT_ADMIN_TLS_CERT_FILE": cert, "BINVAULT_ADMIN_TLS_KEY_FILE": key2},
    }
    kept_running = {}
    for why, env in cases.items():
        rc, out = try_boot(dict(env, BINVAULT_FSYNC="false"))
        if rc in (None, 0):
            kept_running[why] = out[-200:]
    assert not kept_running, "a half-configured or broken TLS setup must stop the boot, not fall back to plain HTTP: %r" % kept_running


# --------------------------------------------------------------------------------------------
# built-in TLS on the public listener

@pytest.fixture(scope="module")
def tls_node():
    d = tempfile.mkdtemp(prefix="bvt-tlsn-")
    cert, key = _make_cert(d)
    node = bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_TLS_CERT_FILE": cert, "BINVAULT_TLS_KEY_FILE": key})
    node.start(ready="port")
    try:
        wait_https(node.port)
        yield node
    finally:
        node.stop()
        shutil.rmtree(d, ignore_errors=True)


def test_s3_works_over_built_in_tls(tls_node):
    name, ak, sk = tls_node.fresh_bucket("tls")
    c = tls_client(tls_node.port, ak, sk)
    body = rnd(300000)
    c.put_object(Bucket=name, Key="small", Body=body)
    assert c.get_object(Bucket=name, Key="small")["Body"].read() == body
    parts = [rnd(5 * MiB), rnd(1000)]
    up = c.create_multipart_upload(Bucket=name, Key="mp")["UploadId"]
    etags = [c.upload_part(Bucket=name, Key="mp", UploadId=up, PartNumber=i + 1, Body=p)["ETag"] for i, p in enumerate(parts)]
    c.complete_multipart_upload(Bucket=name, Key="mp", UploadId=up, MultipartUpload={"Parts": [{"PartNumber": i + 1, "ETag": e} for i, e in enumerate(etags)]})
    assert c.get_object(Bucket=name, Key="mp")["Body"].read() == b"".join(parts)
    url = c.generate_presigned_url("get_object", Params={"Bucket": name, "Key": "small"}, ExpiresIn=60)
    with urllib.request.urlopen(urllib.request.Request(url), context=unverified(), timeout=20) as r:
        assert r.read() == body
    assert [o["Key"] for o in c.list_objects_v2(Bucket=name)["Contents"]] == ["mp", "small"]


def alpn(port, offered, version=None):
    ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_CLIENT)
    ctx.check_hostname = False
    ctx.verify_mode = ssl.CERT_NONE
    ctx.set_alpn_protocols(offered)
    if version:
        ctx.maximum_version = version
    with socket.create_connection(("127.0.0.1", port), timeout=10) as s:
        with ctx.wrap_socket(s, server_hostname="127.0.0.1") as t:
            return t.selected_alpn_protocol(), t.version()


def test_http2_is_negotiated_and_http_1_1_still_works(tls_node):
    assert alpn(tls_node.port, ["h2", "http/1.1"])[0] == "h2", "built-in TLS enables HTTP/2 (spec 2.3)"
    assert alpn(tls_node.port, ["http/1.1"])[0] == "http/1.1"


def test_tls_1_2_and_1_3_are_accepted(tls_node):
    assert alpn(tls_node.port, ["http/1.1"])[1] == "TLSv1.3"
    assert alpn(tls_node.port, ["http/1.1"], ssl.TLSVersion.TLSv1_2)[1] == "TLSv1.2"


def curl_has_http2():
    try:
        out = subprocess.run(["curl", "--version"], capture_output=True, text=True, timeout=10).stdout
    except (OSError, subprocess.SubprocessError):
        return False
    return "HTTP2" in out or "nghttp2" in out


@pytest.mark.skipif(not curl_has_http2(), reason="curl with HTTP/2 support is not installed")
def test_presigned_requests_verify_over_http2(tls_node):
    """Over HTTP/2 there is no Host header, only :authority: the signature check must still see the host that was signed."""
    name, ak, sk = tls_node.fresh_bucket("h2")
    c = tls_client(tls_node.port, ak, sk)
    data = rnd(3 * MiB + 17)
    src = os.path.join(tls_node.dir, "upload.bin")
    with open(src, "wb") as f:
        f.write(data)
    put_url = c.generate_presigned_url("put_object", Params={"Bucket": name, "Key": "up"}, ExpiresIn=120)
    p = subprocess.run(["curl", "-sk", "--http2", "-X", "PUT", "--data-binary", "@" + src, "-o", os.devnull, "-w", "%{http_version} %{http_code}", put_url],
                       capture_output=True, text=True, timeout=60)
    assert p.stdout == "2 200", "presigned PUT over HTTP/2: %r %r" % (p.stdout, p.stderr)
    assert c.get_object(Bucket=name, Key="up")["Body"].read() == data
    out = os.path.join(tls_node.dir, "download.bin")
    get_url = c.generate_presigned_url("get_object", Params={"Bucket": name, "Key": "up"}, ExpiresIn=120)
    p = subprocess.run(["curl", "-sk", "--http2", "-o", out, "-w", "%{http_version} %{http_code}", get_url], capture_output=True, text=True, timeout=60)
    assert p.stdout == "2 200", (p.stdout, p.stderr)
    assert open(out, "rb").read() == data
    tampered = get_url[:-3] + ("000" if not get_url.endswith("000") else "111")
    p = subprocess.run(["curl", "-sk", "--http2", "-o", os.devnull, "-w", "%{http_version} %{http_code}", tampered], capture_output=True, text=True, timeout=60)
    assert p.stdout == "2 403", "a wrong signature is still refused over HTTP/2: %r" % p.stdout


def test_healthcheck_speaks_tls(tls_node):
    rc, out = tls_node.cli("healthcheck", env={"BINVAULT_LISTEN": "127.0.0.1:%d" % tls_node.port})
    assert rc == 0, "binvault healthcheck must work when the node serves TLS: rc=%r %s" % (rc, out)
    rc, _ = tls_node.cli("healthcheck", env={"BINVAULT_LISTEN": "127.0.0.1:%d" % bvh._free_port()})
    assert rc != 0


def test_plain_http_to_the_tls_port_is_not_served(tls_node):
    conn = http.client.HTTPConnection("127.0.0.1", tls_node.port, timeout=10)
    try:
        conn.request("GET", "/_healthz")
        r = conn.getresponse()
        assert r.status == 400, r.status
        assert b"ok" not in r.read()
    except (ConnectionError, http.client.HTTPException):
        pass                                                           # a reset is just as good
    finally:
        conn.close()


def test_every_log_line_is_json_when_the_format_is_json(certs):
    cert, key = _make_cert(certs)
    node = bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_LOG_FORMAT": "json", "BINVAULT_TLS_CERT_FILE": cert, "BINVAULT_TLS_KEY_FILE": key})
    node.start(ready="port")
    try:
        wait_https(node.port)
        for payload in (b"GET /_healthz HTTP/1.1\r\nHost: x\r\n\r\n", b"\x16\x03\x01garbage", b"\x00" * 64):    # plain HTTP, a broken hello, noise
            with socket.create_connection(("127.0.0.1", node.port), timeout=5) as s:
                s.sendall(payload)
                s.settimeout(2)
                try:
                    s.recv(4096)
                except OSError:
                    pass
        time.sleep(0.3)
    finally:
        node.stop()
    bad = []
    for line in node.logtext().splitlines():
        if not line.strip():
            continue
        try:
            json.loads(line)
        except ValueError:
            bad.append(line[:160])
    assert not bad, "BINVAULT_LOG_FORMAT=json but these lines are not JSON: %r" % bad[:5]


# --------------------------------------------------------------------------------------------
# built-in TLS on the admin listener

def test_the_admin_api_over_tls(certs):
    cert, key = _make_cert(certs)
    with bvh.Node(env={"BINVAULT_FSYNC": "false", "BINVAULT_ADMIN_TLS_CERT_FILE": cert, "BINVAULT_ADMIN_TLS_KEY_FILE": key}) as node:
        status, body = https_call(node.aport, "/_admin/v1/status", node.token)
        assert status == 200 and json.loads(body)["version"], (status, body)
        status, body = https_call(node.aport, "/_metrics", node.token)
        assert status == 200 and b"binvault_http_requests_total" in body
        assert https_call(node.aport, "/_admin/v1/status", "x" * 40)[0] == 401
        status, body = https_call(node.aport, "/_admin/v1/buckets", node.token, "POST", json.dumps({"name": "bvt-tls-adm-%s" % uuid.uuid4().hex[:8]}), {"Content-Type": "application/json"})
        assert status == 201, (status, body)
        conn = http.client.HTTPConnection("127.0.0.1", node.aport, timeout=10)
        try:
            conn.request("GET", "/_admin/v1/status", headers={"Authorization": "Bearer " + node.token})
            r = conn.getresponse()
            assert r.status == 400 and b'"version"' not in r.read(), "the admin token must not get an answer over plain HTTP"
        except (ConnectionError, http.client.HTTPException):
            pass
        finally:
            conn.close()
        # S3 stays plain HTTP: only the admin listener has TLS
        assert bvh.http_raw("GET", "127.0.0.1:%d" % node.port, "/_healthz").status == 200
