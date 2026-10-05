"""Private helpers of the versioning / SSE / checksum / multipart / streaming / attributes modules (fork F2).

Contents: checksum arithmetic (awscrt when installed, pure Python otherwise), a TLS-terminating TCP
proxy (botocore only produces aws-chunked trailers over https), a raw aws-chunked encoder with SigV4
chunk and trailer signatures, raw-socket helpers and small listing helpers.
"""
import base64
import contextlib
import hashlib
import hmac
import http.client
import os
import socket
import ssl
import subprocess
import tempfile
import threading
import time
import zlib

import bvh

try:
    from awscrt import checksums as _crt
except Exception:                                    # pragma: no cover - depends on the environment
    _crt = None
HAVE_CRT = _crt is not None

ALGOS = ["CRC32", "CRC32C", "CRC64NVME", "SHA1", "SHA256"]
CRT_ONLY = ("CRC32C", "CRC64NVME")                   # botocore needs awscrt to compute these
MiB = bvh.MiB
KiB = bvh.KiB


# --------------------------------------------------------------------------------------------
# checksums

def _make_crc_table(poly, width):
    mask = (1 << width) - 1
    t = []
    for i in range(256):
        c = i
        for _ in range(8):
            c = (c >> 1) ^ poly if c & 1 else c >> 1
        t.append(c & mask)
    return t


_CRC32C_T = _make_crc_table(0x82F63B78, 32)
_CRC64NVME_T = _make_crc_table(0x9A6C9329AC4BC9B5, 64)


def _crc32c_py(data):
    c = 0xFFFFFFFF
    for b in data:
        c = _CRC32C_T[(c ^ b) & 0xFF] ^ (c >> 8)
    return c ^ 0xFFFFFFFF


def _crc64nvme_py(data):
    c = 0xFFFFFFFFFFFFFFFF
    for b in data:
        c = _CRC64NVME_T[(c ^ b) & 0xFF] ^ (c >> 8)
    return c ^ 0xFFFFFFFFFFFFFFFF


def raw_checksum(alg, data):
    """Big-endian digest bytes of `data` under `alg` (CRC32, CRC32C, CRC64NVME, SHA1, SHA256)."""
    data = bytes(data)
    if alg == "CRC32":
        return zlib.crc32(data).to_bytes(4, "big")
    if alg == "CRC32C":
        v = _crt.crc32c(data) if _crt else _crc32c_py(data)
        return v.to_bytes(4, "big")
    if alg == "CRC64NVME":
        v = _crt.crc64nvme(data) if _crt else _crc64nvme_py(data)
        return v.to_bytes(8, "big")
    if alg == "SHA1":
        return hashlib.sha1(data).digest()
    if alg == "SHA256":
        return hashlib.sha256(data).digest()
    raise ValueError(alg)


def checksum_b64(alg, data):
    return base64.b64encode(raw_checksum(alg, data)).decode()


def composite_b64(alg, parts):
    """COMPOSITE multipart checksum: alg over the concatenated binary part checksums, '-N'."""
    h = b"".join(raw_checksum(alg, p) for p in parts)
    return base64.b64encode(raw_checksum(alg, h)).decode() + "-%d" % len(parts)


def hname(alg):
    return "x-amz-checksum-" + alg.lower()


def pname(alg):
    """boto3 parameter / response key: ChecksumCRC32C ..."""
    return "Checksum" + alg


def need_crt(alg):
    """pytest.skip reason when botocore cannot compute `alg` here."""
    import pytest
    if alg in CRT_ONLY and not HAVE_CRT:
        pytest.skip("awscrt is not installed: botocore cannot compute %s" % alg)


def wrong_checksum_b64(alg, data):
    """A syntactically valid value for `alg` that does not match `data`."""
    return checksum_b64(alg, bytes(data) + b"\x01")


# --------------------------------------------------------------------------------------------
# small helpers

def unquote_etag(e):
    return e.strip('"')


def hhdr(resp):
    """Lower-cased HTTP headers of a boto3 response (or of a ClientError.response)."""
    return resp["ResponseMetadata"]["HTTPHeaders"]


def put_versions(bucket, key, n, size=64, tag="v"):
    """Write n versions of key; returns [{vid, body, etag}] oldest first."""
    out = []
    for i in range(n):
        body = ("%s-%d-" % (tag, i)).encode() * (size // 4 + 1)
        body = body[:size]
        r = bucket.put(key, body)
        out.append({"vid": r.get("VersionId"), "body": body, "etag": unquote_etag(r["ETag"]), "bv": hhdr(r).get("x-binvault-version")})
    return out


def all_versions(client, bucket, page=1000, **kw):
    """Follow KeyMarker/VersionIdMarker. Returns (entries, prefixes, pages) where entries is the
    server-ordered list of ('V'|'D', entry-dict) and pages the number of requests made."""
    entries, prefixes, pages = [], [], 0
    key_marker, vid_marker = None, None
    while True:
        args = dict(Bucket=bucket, MaxKeys=page, **kw)
        if key_marker is not None:
            args["KeyMarker"] = key_marker
        if vid_marker is not None:
            args["VersionIdMarker"] = vid_marker
        r = client.list_object_versions(**args)
        pages += 1
        merged = [("V", v) for v in r.get("Versions", [])] + [("D", d) for d in r.get("DeleteMarkers", [])]
        # a page interleaves versions and markers by key; order by (key) is enough for set comparisons
        entries += merged
        prefixes += [p["Prefix"] for p in r.get("CommonPrefixes", [])]
        if not r.get("IsTruncated"):
            return entries, prefixes, pages
        key_marker, vid_marker = r.get("NextKeyMarker"), r.get("NextVersionIdMarker")
        assert key_marker is not None, "truncated listing without NextKeyMarker: %r" % r
        if pages > 500:
            raise AssertionError("listing does not terminate")


def version_ids(client, bucket, key):
    """Version ids of one key, newest first (as listed)."""
    es, _, _ = all_versions(client, bucket, Prefix=key)
    return [e["VersionId"] for kind, e in es if e["Key"] == key]


# --------------------------------------------------------------------------------------------
# TLS-terminating TCP proxy: botocore uses aws-chunked trailers only over https, and the harness
# node speaks plain http, so terminate TLS here and forward the decrypted bytes verbatim.

def _make_cert(dirpath):
    cert, key = os.path.join(dirpath, "cert.pem"), os.path.join(dirpath, "key.pem")
    subprocess.run(
        ["openssl", "req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", key, "-out", cert, "-days", "2",
         "-subj", "/CN=127.0.0.1", "-addext", "subjectAltName=IP:127.0.0.1,DNS:localhost"],
        check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    return cert, key


class TlsProxy:
    def __init__(self, target_port, target_host="127.0.0.1"):
        self.target = (target_host, target_port)
        self.dir = tempfile.mkdtemp(prefix="bvt-tls-")
        self.cert, self.key = _make_cert(self.dir)
        ctx = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        ctx.load_cert_chain(self.cert, self.key)
        self.ctx = ctx
        self.lsock = socket.socket()
        self.lsock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        self.lsock.bind(("127.0.0.1", 0))
        self.lsock.listen(64)
        self.port = self.lsock.getsockname()[1]
        self.stopped = False
        self.thread = threading.Thread(target=self._accept, daemon=True)
        self.thread.start()

    @property
    def url(self):
        return "https://127.0.0.1:%d" % self.port

    def _accept(self):
        while not self.stopped:
            try:
                c, _ = self.lsock.accept()
            except OSError:
                return
            threading.Thread(target=self._serve, args=(c,), daemon=True).start()

    def _serve(self, raw):
        try:
            c = self.ctx.wrap_socket(raw, server_side=True)
        except Exception:
            raw.close()
            return
        try:
            u = socket.create_connection(self.target, timeout=120)
        except OSError:
            c.close()
            return

        def pump(src, dst):
            try:
                while True:
                    d = src.recv(65536)
                    if not d:
                        break
                    dst.sendall(d)
            except Exception:
                pass
            finally:
                for s, how in ((dst, socket.SHUT_WR),):
                    try:
                        s.shutdown(how)
                    except Exception:
                        pass

        t1 = threading.Thread(target=pump, args=(c, u), daemon=True)
        t2 = threading.Thread(target=pump, args=(u, c), daemon=True)
        t1.start(); t2.start()
        t1.join(); t2.join()
        for s in (c, u):
            try:
                s.close()
            except Exception:
                pass

    def client(self, ak, sk, **kw):
        """boto3 client talking https to the proxy (certificate verification off: self-signed)."""
        return _tls_client(self, ak, sk, **kw)

    def stop(self):
        self.stopped = True
        try:
            self.lsock.close()
        except OSError:
            pass
        if not os.environ.get("BV_KEEP_TMP"):
            import shutil
            shutil.rmtree(self.dir, ignore_errors=True)


def _tls_client(proxy, ak, sk, **kw):
    import boto3
    from botocore.config import Config
    import urllib3
    urllib3.disable_warnings()
    s3cfg = {"addressing_style": "path"}
    if kw.get("payload_signing") is not None:
        s3cfg["payload_signing_enabled"] = kw.pop("payload_signing")
    cfg = dict(signature_version="s3v4", s3=s3cfg, retries={"max_attempts": 1}, connect_timeout=10, read_timeout=120)
    if kw.get("checksum_calculation"):
        cfg["request_checksum_calculation"] = kw.pop("checksum_calculation")
    if kw.get("checksum_validation"):
        cfg["response_checksum_validation"] = kw.pop("checksum_validation")
    return boto3.client("s3", endpoint_url=proxy.url, aws_access_key_id=ak, aws_secret_access_key=sk,
                        region_name=bvh.REGION, config=Config(**cfg), verify=False)


# --------------------------------------------------------------------------------------------
# raw requests: obtain the headers a signed request would carry, then send bytes ourselves

def signed_headers(raw, method, path, query=None, headers=None, **kw):
    """Run Raw.request with a stub transport and return (path, query, headers) as signed."""
    captured = {}
    orig = bvh._send

    def fake(raw_, method_, path_, query_, headers_, body_, timeout_, connect_host_=None):
        captured.update(path=path_, query=query_, headers=dict(headers_))
        return bvh.Resp(0, "", [], b"")

    bvh._send = fake
    try:
        raw.request(method, path, query, headers, b"", **kw)
    finally:
        bvh._send = orig
    return captured["path"], captured["query"], captured["headers"]


def _target(path, query):
    qs = ""
    if query:
        qs = "?" + bvh.canonical_query(query)
    return path + qs


def seed_signature(headers):
    auth = headers["Authorization"]
    return auth.rsplit("Signature=", 1)[1]


def send(hostport, method, target, headers, body=b"", timeout=60):
    """One request on a fresh connection; returns bvh.Resp. No Content-Length is added automatically."""
    host, _, port = hostport.partition(":")
    conn = http.client.HTTPConnection(host, int(port), timeout=timeout)
    try:
        conn.putrequest(method, target, skip_host=True, skip_accept_encoding=True)
        for k, v in headers.items():
            conn.putheader(k, str(v))
        conn.endheaders(body or None)
        r = conn.getresponse()
        data = r.read() if method != "HEAD" else b""
        return bvh.Resp(r.status, r.reason, r.getheaders(), data)
    finally:
        conn.close()


def read_response(sock, method="GET"):
    """Parse one HTTP response from a connected socket."""
    r = http.client.HTTPResponse(sock, method=method)
    r.begin()
    data = r.read() if method != "HEAD" else b""
    return bvh.Resp(r.status, r.reason, r.getheaders(), data)


# --------------------------------------------------------------------------------------------
# aws-chunked encoding

def _hmac_hex(key, msg):
    return hmac.new(key, msg.encode(), hashlib.sha256).hexdigest()


def aws_chunked(data, mode, *, chunk_size=64 * 1024, signing=None, trailer=None, tamper=None):
    """Encode `data` as an aws-chunked body.

    mode:   'signed'            STREAMING-AWS4-HMAC-SHA256-PAYLOAD
            'signed-trailer'    STREAMING-AWS4-HMAC-SHA256-PAYLOAD-TRAILER
            'unsigned-trailer'  STREAMING-UNSIGNED-PAYLOAD-TRAILER
    signing: dict(key=signing key bytes, amzdate=..., scope=..., seed=seed signature) for the signed modes
    trailer: (header name, base64 value) for the *-trailer modes
    tamper:  optional callable (index, signature) -> signature to corrupt a chunk signature
             (index = chunk number, 'final' = the zero chunk, 'trailer' = the trailer signature)
    """
    out = []
    pieces = [data[i:i + chunk_size] for i in range(0, len(data), chunk_size)]
    if mode == "unsigned-trailer":
        for p in pieces:
            out.append(b"%x\r\n" % len(p) + p + b"\r\n")
        out.append(b"0\r\n")
        name, value = trailer
        out.append(("%s:%s\r\n\r\n" % (name, value)).encode())
        return b"".join(out)

    key, amzdate, scope, prev = signing["key"], signing["amzdate"], signing["scope"], signing["seed"]
    empty = hashlib.sha256(b"").hexdigest()

    def chunk_sig(chunk, prev_sig):
        sts = "\n".join(["AWS4-HMAC-SHA256-PAYLOAD", amzdate, scope, prev_sig, empty, hashlib.sha256(chunk).hexdigest()])
        return _hmac_hex(key, sts)

    for i, p in enumerate(pieces):
        sig = chunk_sig(p, prev)
        wire = tamper(i, sig) if tamper else sig
        out.append(b"%x;chunk-signature=%s\r\n" % (len(p), wire.encode()) + p + b"\r\n")
        prev = sig                                   # the next signature chains on the real one
    sig = chunk_sig(b"", prev)
    wire = tamper("final", sig) if tamper else sig
    if mode == "signed":
        out.append(b"0;chunk-signature=%s\r\n\r\n" % wire.encode())
        return b"".join(out)
    out.append(b"0;chunk-signature=%s\r\n" % wire.encode())
    name, value = trailer
    canon = "%s:%s\n" % (name, value)
    sts = "\n".join(["AWS4-HMAC-SHA256-TRAILER", amzdate, scope, sig, hashlib.sha256(canon.encode()).hexdigest()])
    tsig = _hmac_hex(key, sts)
    twire = tamper("trailer", tsig) if tamper else tsig
    out.append(("%s:%s\r\nx-amz-trailer-signature:%s\r\n\r\n" % (name, value, twire)).encode())
    return b"".join(out)


def put_chunked(bucket, key, data, mode, *, chunk_size=64 * 1024, trailer_alg="CRC32", trailer_value=None,
                tamper=None, decoded_len=None, extra_headers=None, content_encoding="aws-chunked",
                body_override=None, path_key=None, timeout=60):
    """PUT `data` to bucket/key as a hand-made aws-chunked request in `mode`; returns bvh.Resp.

    trailer_value overrides the (correct) trailer checksum, decoded_len the x-amz-decoded-content-length."""
    raw = bucket.raw()
    path = "/%s/%s" % (bucket.name, bvh.s3quote(path_key or key))
    sha_mode = {"signed": "STREAMING-AWS4-HMAC-SHA256-PAYLOAD", "signed-trailer": "STREAMING-AWS4-HMAC-SHA256-PAYLOAD-TRAILER",
                "unsigned-trailer": "STREAMING-UNSIGNED-PAYLOAD-TRAILER"}[mode]
    hdrs = {"x-amz-decoded-content-length": str(len(data) if decoded_len is None else decoded_len)}
    if content_encoding:
        hdrs["Content-Encoding"] = content_encoding
    trailer = None
    if mode != "signed":
        hdrs["x-amz-trailer"] = hname(trailer_alg)
        hdrs["x-amz-sdk-checksum-algorithm"] = trailer_alg
        trailer = (hname(trailer_alg), trailer_value if trailer_value is not None else checksum_b64(trailer_alg, data))
    hdrs.update(extra_headers or {})
    signed_names = sorted(k.lower() for k in list(hdrs) + ["host", "x-amz-date", "x-amz-content-sha256"] if k.lower() == "host" or k.lower().startswith("x-amz-") or k.lower() == "content-encoding")
    p, q, h = signed_headers(raw, "PUT", path, None, hdrs, payload=sha_mode, signed_headers=signed_names)
    scope_date = h["x-amz-date"][:8]
    signing = None
    if mode != "unsigned-trailer":
        signing = dict(key=bvh.signing_key(bucket.sk, scope_date, bvh.REGION, "s3"), amzdate=h["x-amz-date"],
                       scope="%s/%s/s3/aws4_request" % (scope_date, bvh.REGION), seed=seed_signature(h))
    body = body_override if body_override is not None else aws_chunked(data, mode, chunk_size=chunk_size, signing=signing, trailer=trailer, tamper=tamper)
    h["Content-Length"] = str(len(body))
    return send(raw.hostport(), "PUT", _target(p, q), h, body, timeout=timeout)


@contextlib.contextmanager
def raw_socket(hostport, timeout=30):
    host, _, port = hostport.partition(":")
    s = socket.create_connection((host, int(port)), timeout=timeout)
    try:
        yield s
    finally:
        try:
            s.close()
        except OSError:
            pass


def request_bytes(method, target, headers):
    lines = ["%s %s HTTP/1.1" % (method, target)] + ["%s: %s" % (k, v) for k, v in headers.items()]
    return ("\r\n".join(lines) + "\r\n\r\n").encode()


def wait_for(cond, timeout=10.0, step=0.05):
    end = time.time() + timeout
    while time.time() < end:
        if cond():
            return True
        time.sleep(step)
    return False
