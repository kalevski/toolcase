"""Shared helpers for the boto3 suite: environment, clients, admin API, a raw SigV4 client, node launcher.

Nothing here asserts anything about binvault; the test modules do that.
"""
import atexit
import base64
import binascii
import contextlib
import datetime
import hashlib
import hmac
import http.client
import json
import os
import re
import shutil
import signal
import socket
import subprocess
import tempfile
import threading
import time
import urllib.parse
import urllib.request
import uuid
import xml.etree.ElementTree as ET

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

# --------------------------------------------------------------------------------------------
# environment (written by support/bootstrap.py)

ENV = json.load(open(os.environ["BV_ENV_JSON"]))
ENDPOINT = ENV["endpoint"]
ADMIN_URL = ENV["admin_url"]
ADMIN_TOKEN = ENV["admin_token"]
DOMAIN = ENV["domain"]
REGION = ENV["region"]
BIN = os.environ.get("BV_BIN", "")
PORT = int(urllib.parse.urlparse(ENDPOINT).port)
HOSTPORT = urllib.parse.urlparse(ENDPOINT).netloc          # 127.0.0.1:PORT
VH_ENDPOINT = "http://%s:%d" % (DOMAIN, PORT)              # virtual-hosted style base (bucket.DOMAIN:PORT)

KiB = 1024
MiB = 1024 * KiB
FULL = ["read", "write", "list", "delete", "purge", "tag"]


# --------------------------------------------------------------------------------------------
# virtual-hosted style needs <bucket>.<domain> to resolve; map every such name to loopback so the
# suite works offline (the harness picks a name that usually resolves anyway).

_real_getaddrinfo = socket.getaddrinfo


def _install_dns_shim(domain):
    if not domain:
        return

    def gai(host, *a, **kw):
        if isinstance(host, str) and (host == domain or host.endswith("." + domain)):
            host = "127.0.0.1"
        return _real_getaddrinfo(host, *a, **kw)

    socket.getaddrinfo = gai


_install_dns_shim(DOMAIN)


# --------------------------------------------------------------------------------------------
# data helpers

def rnd(n):
    return os.urandom(n)


def pattern(n, seed=0):
    """Deterministic, offset-sensitive bytes: byte i == (i + seed) % 251, so any slice is checkable."""
    block = bytes((i + seed) % 251 for i in range(251 * 64))
    reps = n // len(block) + 1
    out = (block * reps)[:n]
    # shift so that content at offset i is (i + seed) % 251 for every i
    return out


def md5hex(b):
    return hashlib.md5(b).hexdigest()


def uniq(prefix="k"):
    return "%s-%s" % (prefix, uuid.uuid4().hex[:12])


def multipart_etag(parts):
    """S3 multipart ETag: md5 of the concatenated binary md5s of the parts, '-N'."""
    h = hashlib.md5(b"".join(hashlib.md5(p).digest() for p in parts)).hexdigest()
    return "%s-%d" % (h, len(parts))


def b64(b):
    return base64.b64encode(b).decode()


# --------------------------------------------------------------------------------------------
# admin API

class AdminError(Exception):
    def __init__(self, status, body):
        super().__init__("admin API HTTP %s: %s" % (status, body))
        self.status, self.body = status, body


class Admin:
    def __init__(self, url=ADMIN_URL, token=ADMIN_TOKEN):
        self.url, self.token = url, token

    def call(self, method, path, body=None, headers=None, ok=(200, 201, 204)):
        data = None if body is None else json.dumps(body).encode()
        req = urllib.request.Request(self.url + "/_admin/v1" + path, data=data, method=method)
        req.add_header("Authorization", "Bearer " + self.token)
        if data is not None:
            req.add_header("Content-Type", "application/json")
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
                status = r.status
        except urllib.error.HTTPError as e:
            raw, status = e.read(), e.code
        try:
            parsed = json.loads(raw) if raw else None
        except ValueError:
            parsed = {"raw": raw.decode("utf-8", "replace")}
        if status not in ok:
            raise AdminError(status, parsed)
        return status, parsed

    def create_bucket(self, name, **settings):
        return self.call("POST", "/buckets", dict(settings, name=name))[1]

    def patch_bucket(self, name, **settings):
        return self.call("PATCH", "/buckets/" + name, settings)[1]

    def put_bucket(self, name, **settings):
        return self.call("PUT", "/buckets/" + name, settings)[1]

    def get_bucket(self, name):
        return self.call("GET", "/buckets/" + name)[1]

    def delete_bucket(self, name, force=True):
        return self.call("DELETE", "/buckets/%s%s" % (name, "?force=true" if force else ""))

    def create_token(self, bucket, grants, name="t", expires_at=None, limits=None):
        body = {"name": name, "grants": grants}
        if expires_at is not None:
            body["expires_at"] = expires_at
        if limits is not None:
            body["limits"] = limits
        return self.call("POST", "/buckets/%s/tokens" % bucket, body)[1]

    def patch_token(self, bucket, key_id, **fields):
        return self.call("PATCH", "/buckets/%s/tokens/%s" % (bucket, key_id), fields)[1]

    def delete_token(self, bucket, key_id):
        return self.call("DELETE", "/buckets/%s/tokens/%s" % (bucket, key_id))

    def list_tokens(self, bucket):
        return self.call("GET", "/buckets/%s/tokens" % bucket)[1]


# --------------------------------------------------------------------------------------------
# boto3 clients

def make_client(ak, sk, *, endpoint=None, addressing="path", signature_version="s3v4", region=None,
                checksum_calculation=None, checksum_validation=None, payload_signing=None,
                s3=None, **cfg):
    """A boto3 S3 client with SDK retries disabled (a retried 5xx would hide what the server said)."""
    s3cfg = {"addressing_style": addressing}
    if payload_signing is not None:
        s3cfg["payload_signing_enabled"] = payload_signing
    s3cfg.update(s3 or {})
    kw = dict(signature_version=signature_version, s3=s3cfg, retries={"max_attempts": 1},
              connect_timeout=10, read_timeout=120)
    if checksum_calculation:
        kw["request_checksum_calculation"] = checksum_calculation
    if checksum_validation:
        kw["response_checksum_validation"] = checksum_validation
    kw.update(cfg)
    if endpoint is None:
        endpoint = VH_ENDPOINT if addressing == "virtual" else ENDPOINT
    return boto3.client("s3", endpoint_url=endpoint, aws_access_key_id=ak, aws_secret_access_key=sk,
                        region_name=region or REGION, config=Config(**kw))


class Bucket:
    """A bucket with one full-access token and ready-made clients."""

    def __init__(self, name, ak, sk, settings=None):
        self.name, self.ak, self.sk, self.settings = name, ak, sk, settings or {}
        self._clients = {}

    def client(self, **kw):
        """Cached client; keyword arguments are passed to make_client (addressing='virtual', ...)."""
        key = tuple(sorted(kw.items(), key=lambda kv: kv[0]))
        if key not in self._clients:
            self._clients[key] = make_client(self.ak, self.sk, **kw)
        return self._clients[key]

    @property
    def s3(self):
        return self.client()

    @property
    def vs3(self):
        return self.client(addressing="virtual")

    def url(self, key="", query=""):
        return "%s/%s/%s%s" % (ENDPOINT, self.name, urllib.parse.quote(key, safe="/"), ("?" + query) if query else "")

    def raw(self):
        return Raw(self.ak, self.sk)

    def put(self, key, body=b"", **kw):
        return self.s3.put_object(Bucket=self.name, Key=key, Body=body, **kw)

    def get(self, key, **kw):
        return self.s3.get_object(Bucket=self.name, Key=key, **kw)

    def read(self, key, **kw):
        return self.s3.get_object(Bucket=self.name, Key=key, **kw)["Body"].read()

    def head(self, key, **kw):
        return self.s3.head_object(Bucket=self.name, Key=key, **kw)

    def delete(self, key, **kw):
        return self.s3.delete_object(Bucket=self.name, Key=key, **kw)

    def keys(self, **kw):
        out = []
        for page in self.s3.get_paginator("list_objects_v2").paginate(Bucket=self.name, **kw):
            out += [o["Key"] for o in page.get("Contents", [])]
        return out

    def token(self, grants, **kw):
        """Mint another token on this bucket; returns a boto3 client using it."""
        t = ADMIN.create_token(self.name, grants, **kw)
        c = make_client(t["access_key_id"], t["secret_access_key"])
        c.bv_token = t
        return c

    def token_info(self, grants, **kw):
        return ADMIN.create_token(self.name, grants, **kw)


ADMIN = Admin()


def fresh_bucket(tag="b", **settings):
    """Create a new, isolated bucket (admin API) with a full-access token."""
    name = "bvt-b3-%s-%s" % (re.sub(r"[^a-z0-9-]", "", tag.lower())[:20], uuid.uuid4().hex[:10])
    ADMIN.create_bucket(name, **settings)
    t = ADMIN.create_token(name, [{"actions": FULL}], name="fresh")
    return Bucket(name, t["access_key_id"], t["secret_access_key"], settings)


def suite_bucket(kind):
    """One of the five buckets created by the harness (plain, versioned, public, quota, ctype)."""
    b = ENV["buckets"][kind]
    return Bucket(b["name"], b["access_key"], b["secret_key"], b["settings"])


# --------------------------------------------------------------------------------------------
# error assertions

@contextlib.contextmanager
def s3error(code=None, status=None, contains=None):
    """with s3error('NoSuchKey', 404): ...  - the block must raise a botocore ClientError.

    HEAD responses carry no body, so botocore reports the status text as the code; pass code=None
    to check only the status. The caught error is available as the context value (.response)."""
    holder = type("Holder", (), {})()
    try:
        yield holder
    except ClientError as e:
        holder.error = e
        got_code = e.response.get("Error", {}).get("Code")
        got_status = e.response.get("ResponseMetadata", {}).get("HTTPStatusCode")
        msg = e.response.get("Error", {}).get("Message", "")
        if code is not None:
            assert got_code == code, "expected error code %s, got %s (HTTP %s): %s" % (code, got_code, got_status, msg)
        if status is not None:
            assert got_status == status, "expected HTTP %s, got %s (code %s): %s" % (status, got_status, got_code, msg)
        if contains is not None:
            assert contains.lower() in msg.lower(), "message %r does not contain %r" % (msg, contains)
    else:
        raise AssertionError("expected S3 error %s (HTTP %s) but the call succeeded" % (code, status))


def err_of(fn, *a, **kw):
    """Call fn and return (status, code) of the ClientError it raises (AssertionError when it succeeds)."""
    try:
        fn(*a, **kw)
    except ClientError as e:
        return (e.response["ResponseMetadata"]["HTTPStatusCode"], e.response.get("Error", {}).get("Code"))
    raise AssertionError("call succeeded, an error was expected")


def hdr(resp, name, default=None):
    """Response header from a boto3 result, case-insensitive."""
    h = resp["ResponseMetadata"]["HTTPHeaders"]
    return h.get(name.lower(), default)


# --------------------------------------------------------------------------------------------
# wire capture: see exactly what botocore sent

class Capture:
    """with Capture(client) as cap: client.put_object(...)  ->  cap.requests[0].headers / .body / .url"""

    def __init__(self, client):
        self.client, self.requests = client, []

    def _handler(self, request, **kw):
        self.requests.append(request)

    def __enter__(self):
        self.client.meta.events.register("before-send.s3", self._handler)
        return self

    def __exit__(self, *exc):
        self.client.meta.events.unregister("before-send.s3", self._handler)

    @property
    def last(self):
        return self.requests[-1]

    def header(self, name, idx=-1):
        v = self.requests[idx].headers.get(name)
        return v.decode() if isinstance(v, bytes) else v


# --------------------------------------------------------------------------------------------
# a raw SigV4 client for the cases botocore will not let us produce (clock skew, bad scopes, ...)

def s3quote(s):
    """URI-encode like AWS does: everything except A-Za-z0-9-_.~ ; '/' kept for paths."""
    return urllib.parse.quote(s, safe="/")


def _q(s):
    return urllib.parse.quote(s, safe="")


def _hmac(key, msg):
    return hmac.new(key, msg.encode(), hashlib.sha256).digest()


def signing_key(sk, date, region, service):
    k = _hmac(("AWS4" + sk).encode(), date)
    k = hmac.new(k, region.encode(), hashlib.sha256).digest()
    k = hmac.new(k, service.encode(), hashlib.sha256).digest()
    return hmac.new(k, b"aws4_request", hashlib.sha256).digest()


def canonical_query(query):
    if not query:
        return ""
    if isinstance(query, str):
        pairs = urllib.parse.parse_qsl(query, keep_blank_values=True)
    elif isinstance(query, dict):
        pairs = list(query.items())
    else:
        pairs = list(query)
    enc = sorted((_q(str(k)), _q(str(v))) for k, v in pairs)
    return "&".join("%s=%s" % kv for kv in enc)


class Resp:
    def __init__(self, status, reason, headers, body):
        self.status, self.reason, self.body = status, reason, body
        self.headers = {k.lower(): v for k, v in headers}
        self.raw_headers = headers

    def header(self, name, default=None):
        return self.headers.get(name.lower(), default)

    @property
    def text(self):
        return self.body.decode("utf-8", "replace")

    def xml(self):
        root = ET.fromstring(self.body)
        for el in root.iter():              # drop namespaces for easy paths
            if "}" in el.tag:
                el.tag = el.tag.split("}", 1)[1]
        return root

    @property
    def code(self):
        """The <Code> of an S3 error body ('' when there is none)."""
        try:
            return self.xml().findtext("Code") or ""
        except ET.ParseError:
            return ""

    def __repr__(self):
        return "<Resp %s %s %r>" % (self.status, self.code, self.body[:200])


class Raw:
    """Tiny SigV4 (S3 flavour) client on http.client with full control over what is signed and sent."""

    def __init__(self, ak, sk, endpoint=None, region=REGION, service="s3"):
        self.ak, self.sk, self.region, self.service = ak, sk, region, service
        u = urllib.parse.urlparse(endpoint or ENDPOINT)
        self.scheme, self.host, self.port = u.scheme, u.hostname, u.port or 80

    def hostport(self):
        return "%s:%d" % (self.host, self.port)

    def request(self, method, path, query=None, headers=None, body=b"", *, sign=True, payload=None, amzdate=None,
                host=None, region=None, service=None, scope_date=None, signed_headers=None, timeout=60,
                connect_host=None, auth_override=None, include_content_sha=True):
        """path must already be percent-encoded (use s3quote). payload: None = sha256 of body,
        'UNSIGNED-PAYLOAD' or a literal x-amz-content-sha256 value. amzdate/scope_date override the clock.
        Returns Resp."""
        headers = dict(headers or {})
        host = host or self.hostport()
        headers.setdefault("Host", host)
        if isinstance(body, str):
            body = body.encode()
        ph = payload if payload is not None else hashlib.sha256(body).hexdigest()
        if sign:
            now = datetime.datetime.now(datetime.timezone.utc)
            amzdate = amzdate or now.strftime("%Y%m%dT%H%M%SZ")
            scope_date = scope_date or amzdate[:8]
            headers["x-amz-date"] = amzdate
            if include_content_sha:
                headers["x-amz-content-sha256"] = ph
            hs = {k.lower(): " ".join(str(v).split()) for k, v in headers.items()}
            names = sorted(signed_headers or [k for k in hs if k == "host" or k.startswith("x-amz-") or k in ("content-type", "content-md5")])
            canon_headers = "".join("%s:%s\n" % (n, hs[n]) for n in names)
            creq = "\n".join([method, path, canonical_query(query), canon_headers, ";".join(names),
                              ph if include_content_sha else hashlib.sha256(body).hexdigest()])
            reg, svc = region or self.region, service or self.service
            scope = "%s/%s/%s/aws4_request" % (scope_date, reg, svc)
            sts = "\n".join(["AWS4-HMAC-SHA256", amzdate, scope, hashlib.sha256(creq.encode()).hexdigest()])
            sig = hmac.new(signing_key(self.sk, scope_date, reg, svc), sts.encode(), hashlib.sha256).hexdigest()
            headers["Authorization"] = auth_override or ("AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s"
                                                         % (self.ak, scope, ";".join(names), sig))
        elif auth_override:
            headers["Authorization"] = auth_override
        return _send(self, method, path, query, headers, body, timeout, connect_host)

    def presign(self, method, path, query=None, expires=300, headers=None, amzdate=None, host=None,
                region=None, service=None, scope_date=None, extra_signed=None, payload="UNSIGNED-PAYLOAD"):
        """Returns a full URL (with Host = host or this endpoint) signed in query form."""
        host = host or self.hostport()
        now = datetime.datetime.now(datetime.timezone.utc)
        amzdate = amzdate or now.strftime("%Y%m%dT%H%M%SZ")
        scope_date = scope_date or amzdate[:8]
        reg, svc = region or self.region, service or self.service
        hdrs = {"host": host}
        hdrs.update({k.lower(): " ".join(str(v).split()) for k, v in (extra_signed or {}).items()})
        names = sorted(hdrs)
        q = []
        if isinstance(query, dict):
            q = list(query.items())
        elif isinstance(query, str) and query:
            q = urllib.parse.parse_qsl(query, keep_blank_values=True)
        elif query:
            q = list(query)
        q += [("X-Amz-Algorithm", "AWS4-HMAC-SHA256"),
              ("X-Amz-Credential", "%s/%s/%s/%s/aws4_request" % (self.ak, scope_date, reg, svc)),
              ("X-Amz-Date", amzdate), ("X-Amz-Expires", str(expires)),
              ("X-Amz-SignedHeaders", ";".join(names))]
        canon_headers = "".join("%s:%s\n" % (n, hdrs[n]) for n in names)
        creq = "\n".join([method, path, canonical_query(q), canon_headers, ";".join(names), payload])
        scope = "%s/%s/%s/aws4_request" % (scope_date, reg, svc)
        sts = "\n".join(["AWS4-HMAC-SHA256", amzdate, scope, hashlib.sha256(creq.encode()).hexdigest()])
        sig = hmac.new(signing_key(self.sk, scope_date, reg, svc), sts.encode(), hashlib.sha256).hexdigest()
        qs = canonical_query(q) + "&X-Amz-Signature=" + sig
        return "%s://%s%s?%s" % (self.scheme, host, path, qs)


def _send(raw, method, path, query, headers, body, timeout, connect_host=None):
    qs = ""
    if query:
        qs = "?" + (query if isinstance(query, str) else urllib.parse.urlencode(list(query.items()) if isinstance(query, dict) else list(query),
                                                                                  quote_via=urllib.parse.quote))
    conn = http.client.HTTPConnection(connect_host or raw.host, raw.port, timeout=timeout)
    try:
        conn.putrequest(method, path + qs, skip_host=True, skip_accept_encoding=True)
        for k, v in headers.items():
            conn.putheader(k, v)
        if body and "content-length" not in {k.lower() for k in headers}:
            conn.putheader("Content-Length", str(len(body)))
        elif method in ("PUT", "POST") and not body and "content-length" not in {k.lower() for k in headers}:
            conn.putheader("Content-Length", "0")
        conn.endheaders(body or None)
        r = conn.getresponse()
        data = r.read() if method != "HEAD" else b""
        return Resp(r.status, r.reason, r.getheaders(), data)
    finally:
        conn.close()


def http_get(url, headers=None, method="GET", data=None, timeout=60):
    """Unsigned/pre-signed request with plain urllib; never raises on HTTP errors. Returns Resp."""
    req = urllib.request.Request(url, headers=headers or {}, method=method, data=data)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return Resp(r.status, r.reason, r.getheaders(), r.read() if method != "HEAD" else b"")
    except urllib.error.HTTPError as e:
        return Resp(e.code, e.reason, e.headers.items(), e.read() if method != "HEAD" else b"")


def http_raw(method, hostport, target, headers=None, body=b"", timeout=30):
    """Send an HTTP request with no signing and no normalisation of `target` (exact request-target)."""
    host, _, port = hostport.partition(":")
    conn = http.client.HTTPConnection(host, int(port or 80), timeout=timeout)
    try:
        conn.putrequest(method, target, skip_host=True, skip_accept_encoding=True)
        h = dict(headers or {})
        h.setdefault("Host", hostport)
        for k, v in h.items():
            conn.putheader(k, v)
        if body and "content-length" not in {k.lower() for k in h}:
            conn.putheader("Content-Length", str(len(body)))
        conn.endheaders(body or None)
        r = conn.getresponse()
        data = r.read() if method != "HEAD" else b""
        return Resp(r.status, r.reason, r.getheaders(), data)
    finally:
        conn.close()


# --------------------------------------------------------------------------------------------
# extra nodes for tests that need a different configuration (tiny timeouts, auth-failure limits, ...)

def _free_port():
    s = socket.socket()
    s.bind(("127.0.0.1", 0))
    p = s.getsockname()[1]
    s.close()
    return p


_NODES = []


def _cleanup_nodes():
    """At interpreter exit: kill any node a failed test left running and remove the temp dirs the nodes created
    (BV_KEEP_TMP=1 keeps them for a post-mortem)."""
    for n in _NODES:
        try:
            if n.proc and n.proc.poll() is None:
                n.proc.kill()
                n.proc.wait(10)
        except Exception:   # noqa: BLE001
            pass
        if n.owns_dir and not os.environ.get("BV_KEEP_TMP"):
            shutil.rmtree(n.dir, ignore_errors=True)


atexit.register(_cleanup_nodes)


class Node:
    """A private binvault process: Node(env={'BINVAULT_CLOCK_SKEW': '1m'}).start() ... .stop()"""

    def __init__(self, env=None, data_dir=None, domain=None):
        self.env = dict(env or {})
        self.owns_dir = data_dir is None
        self.dir = data_dir or tempfile.mkdtemp(prefix="bvt-node-")
        _NODES.append(self)
        self.token = "t" + uuid.uuid4().hex + uuid.uuid4().hex
        self.master = base64.b64encode(os.urandom(32)).decode()
        self.domain = domain
        self.proc = None
        self.log_path = os.path.join(self.dir, "node.log")

    def base_env(self):
        """The environment of a `binvault` process on this node's data directory (BINVAULT_* variables only from here)."""
        e = dict(os.environ)
        for k in [k for k in e if k.startswith("BINVAULT_")]:
            del e[k]
        e.update({
            "BINVAULT_ADMIN_TOKEN": self.token, "BINVAULT_MASTER_KEY": self.master,
            "BINVAULT_DATA_DIR": os.path.join(self.dir, "data"), "BINVAULT_LISTEN": "127.0.0.1:%d" % (getattr(self, "port", 0) or 9000),
            "BINVAULT_ADMIN_LISTEN": "127.0.0.1:%d" % (getattr(self, "aport", 0) or 9001), "BINVAULT_ENDPOINT_URL": "http://127.0.0.1:%d" % (getattr(self, "port", 0) or 9000),
            "BINVAULT_MIN_FREE_MB": "1",
        })
        if self.domain:
            e["BINVAULT_DOMAIN"] = self.domain
        e.update(self.env)
        for k in [k for k, v in e.items() if v is None]:      # env={"BINVAULT_ADMIN_TOKEN": None} removes a default
            del e[k]
        return e

    def cli(self, *args, env=None, timeout=120):
        """Run `binvault <args>` against this node's data directory; returns (exit code, combined output)."""
        e = self.base_env()
        e.update(env or {})
        e = {k: v for k, v in e.items() if v is not None}
        p = subprocess.run([BIN] + list(args), env=e, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, timeout=timeout)
        return p.returncode, p.stdout.decode("utf-8", "replace")

    def start(self, ready="healthz"):
        """Start the process and wait until it answers. ready="port" only waits for the S3 port to accept connections
        (for nodes that are healthy-but-503 on purpose, e.g. with an impossible BINVAULT_MIN_FREE_MB)."""
        for _ in range(5):
            self.port, self.aport = _free_port(), _free_port()
            if self.port == self.aport:
                continue
            e = self.base_env()
            self.log = open(self.log_path, "ab")
            self.proc = subprocess.Popen([BIN, "run"], env=e, stdout=self.log, stderr=self.log, stdin=subprocess.DEVNULL)
            self.endpoint = "http://127.0.0.1:%d" % self.port
            self.admin = Admin("http://127.0.0.1:%d" % self.aport, self.token)
            deadline = time.time() + 30
            while time.time() < deadline:
                if self.proc.poll() is not None:
                    break
                try:
                    if ready == "port":
                        socket.create_connection(("127.0.0.1", self.port), timeout=2).close()
                        return self
                    with urllib.request.urlopen(self.endpoint + "/_healthz", timeout=2) as r:
                        if r.status == 200:
                            return self
                except Exception:
                    time.sleep(0.1)
            if self.proc.poll() is None:
                self.proc.kill()
            self.proc.wait()
            if "already in use" not in open(self.log_path, errors="replace").read():
                raise RuntimeError("node failed to start:\n" + open(self.log_path, errors="replace").read()[-2000:])
        raise RuntimeError("no free ports")

    def client(self, ak, sk, **kw):
        return make_client(ak, sk, endpoint=self.endpoint, **kw)

    def fresh_bucket(self, tag="n", **settings):
        name = "bvt-n-%s-%s" % (re.sub(r"[^a-z0-9-]", "", tag.lower())[:16], uuid.uuid4().hex[:10])
        self.admin.create_bucket(name, **settings)
        t = self.admin.create_token(name, [{"actions": FULL}], name="fresh")
        return name, t["access_key_id"], t["secret_access_key"]

    def stop(self, sig=signal.SIGTERM):
        if self.proc and self.proc.poll() is None:
            self.proc.send_signal(sig)
            try:
                self.proc.wait(30)
            except subprocess.TimeoutExpired:
                self.proc.kill()
                self.proc.wait()
        if getattr(self, "log", None):
            self.log.close()

    def kill9(self):
        self.stop(signal.SIGKILL)

    def logtext(self):
        try:
            return open(self.log_path, errors="replace").read()
        except OSError:
            return ""

    def __enter__(self):
        return self.start()

    def __exit__(self, *a):
        self.stop()


def run_threads(fns, workers=None):
    """Run callables concurrently (at most `workers` at a time; default: all at once); returns the list of results
    (exceptions are returned, not raised)."""
    res = [None] * len(fns)
    gate = threading.Semaphore(workers) if workers else None

    def run(i, f):
        try:
            res[i] = f()
        except BaseException as e:   # noqa: BLE001
            res[i] = e
        finally:
            if gate:
                gate.release()

    ts = []
    for i, f in enumerate(fns):
        if gate:
            gate.acquire()
        t = threading.Thread(target=run, args=(i, f))
        t.start()
        ts.append(t)
    for t in ts:
        t.join()
    return res
