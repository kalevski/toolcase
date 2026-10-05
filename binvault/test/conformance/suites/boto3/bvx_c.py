"""Private helpers of the F3 modules (authentication, authorization, policy, edge cases).

Builds on bvh: a signer with full control over what is signed and what is sent, exact-wire HTTP
fetches, raw-socket exchanges, and error-shape assertions.
"""
import base64
import datetime
import hashlib
import hmac
import http.client
import json
import re
import socket
import threading
import time
import urllib.parse
import xml.etree.ElementTree as ET

import bvh
from bvh import Resp, s3quote, signing_key, canonical_query

UTC = datetime.timezone.utc


# --------------------------------------------------------------------------------------------
# time helpers

def now():
    return datetime.datetime.now(UTC)


def amzdate(dt=None):
    return (dt or now()).strftime("%Y%m%dT%H%M%SZ")


def ago(**kw):
    return now() - datetime.timedelta(**kw)


def ahead(**kw):
    return now() + datetime.timedelta(**kw)


def rfc3339(dt):
    return dt.astimezone(UTC).strftime("%Y-%m-%dT%H:%M:%SZ")


def http_date(dt):
    return dt.astimezone(UTC).strftime("%a, %d %b %Y %H:%M:%S GMT")


# --------------------------------------------------------------------------------------------
# exact-wire HTTP

def fetch(url, method="GET", headers=None, body=None, timeout=60):
    """One request with exactly the given headers (no implicit Content-Type, no redirects, no decoding).
    The request target is taken verbatim from the URL. Returns bvh.Resp, never raises on HTTP errors."""
    u = urllib.parse.urlsplit(url)
    target = u.path or "/"
    if u.query:
        target += "?" + u.query
    conn = http.client.HTTPConnection(u.hostname, u.port or 80, timeout=timeout)
    try:
        conn.putrequest(method, target, skip_host=True, skip_accept_encoding=True)
        hs = dict(headers or {})
        if not any(k.lower() == "host" for k in hs):
            hs["Host"] = u.netloc
        for k, v in hs.items():
            conn.putheader(k, v)
        if body is not None and not any(k.lower() == "content-length" for k in hs):
            conn.putheader("Content-Length", str(len(body)))
        conn.endheaders(body if body else None)
        r = conn.getresponse()
        data = r.read() if method != "HEAD" else b""
        return Resp(r.status, r.reason, r.getheaders(), data)
    finally:
        conn.close()


def parse_http_response(data):
    head, _, body = data.partition(b"\r\n\r\n")
    lines = head.decode("latin-1").split("\r\n")
    status_line = lines[0].split(" ", 2)
    headers = []
    for ln in lines[1:]:
        if ":" in ln:
            k, v = ln.split(":", 1)
            headers.append((k.strip(), v.strip()))
    h = {k.lower(): v for k, v in headers}
    if h.get("transfer-encoding", "").lower() == "chunked":
        out, rest = b"", body
        while rest:
            size_line, _, rest = rest.partition(b"\r\n")
            try:
                n = int(size_line.split(b";")[0], 16)
            except ValueError:
                break
            if n == 0:
                break
            out += rest[:n]
            rest = rest[n + 2:]
        body = out
    elif "content-length" in h:
        body = body[: int(h["content-length"])]
    return Resp(int(status_line[1]), status_line[2] if len(status_line) > 2 else "", headers, body)


def sock_exchange(hostport, payload, *, then=None, half_close=False, read_timeout=15, stall=0.0):
    """Send raw bytes, optionally a second chunk after `stall` seconds, optionally half-close, read the
    reply until EOF or timeout. Returns the raw reply bytes (b'' when the peer just closed)."""
    host, _, port = hostport.partition(":")
    s = socket.create_connection((host, int(port)), timeout=read_timeout)
    try:
        s.sendall(payload)
        if stall:
            time.sleep(stall)
        if then:
            s.sendall(then)
        if half_close:
            s.shutdown(socket.SHUT_WR)
        s.settimeout(read_timeout)
        buf = b""
        try:
            while True:
                chunk = s.recv(65536)
                if not chunk:
                    break
                buf += chunk
                if b"\r\n\r\n" in buf:
                    head, _, body = buf.partition(b"\r\n\r\n")
                    m = re.search(rb"(?i)content-length:\s*(\d+)", head)
                    if m and len(body) >= int(m.group(1)):
                        break
        except (socket.timeout, ConnectionResetError):
            pass
        return buf
    finally:
        s.close()


# --------------------------------------------------------------------------------------------
# a signer with full control

def canonical_uri(path):
    """The AWS canonical URI of a request path: decode once, encode once."""
    return s3quote(urllib.parse.unquote(path, errors="surrogateescape"))


def authorization(ak, sk, method, path, query, headers, signed, payload_hash, adate,
                  region=bvh.REGION, service="s3", scope_date=None, uppercase_sig=False):
    hs = {k.lower(): " ".join(str(v).split()) for k, v in headers.items()}
    canon_headers = "".join("%s:%s\n" % (n, hs.get(n, "")) for n in signed)
    creq = "\n".join([method, canonical_uri(path), canonical_query(query), canon_headers, ";".join(signed), payload_hash])
    scope_date = scope_date or adate[:8]
    scope = "%s/%s/%s/aws4_request" % (scope_date, region, service)
    sts = "\n".join(["AWS4-HMAC-SHA256", adate, scope, hashlib.sha256(creq.encode()).hexdigest()])
    sig = hmac.new(signing_key(sk, scope_date, region, service), sts.encode(), hashlib.sha256).hexdigest()
    if uppercase_sig:
        sig = sig.upper()
    return "AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s" % (ak, scope, ";".join(signed), sig), sig


def sreq(b_or_creds, method, path, *, query=None, headers=None, body=b"", signed=None, payload_hash=None,
         adate=None, date_header=None, drop=(), region=None, service=None, scope_date=None,
         wire_path=None, wire_query=None, sk=None, ak=None, uppercase_sig=False, host=None, timeout=60,
         auth_header=None, extra_wire_headers=None):
    """Sign (header form) and send one request.

    path       the path used for signing (any percent-encoding; it is canonicalised like AWS does)
    wire_path  the request target path actually sent (default: path)
    query      dict/list/str used for signing; wire_query (str) is what is sent (default: encoded query)
    headers    extra headers (sent and, if their lower-case names are in `signed`, signed)
    signed     list of signed header names; default host;x-amz-content-sha256;x-amz-date (+ x-amz-* extras, content-type, content-md5)
    drop       header names that are signed but NOT sent (or removed from the defaults)
    """
    if isinstance(b_or_creds, tuple):
        key_id, secret = b_or_creds
    else:
        key_id, secret = b_or_creds.ak, b_or_creds.sk
    key_id = ak or key_id
    secret = sk or secret
    if isinstance(body, str):
        body = body.encode()
    host = host or bvh.HOSTPORT
    adate = adate or amzdate()
    ph = payload_hash if payload_hash is not None else hashlib.sha256(body).hexdigest()
    hdrs = {"Host": host}
    if date_header is None:
        hdrs["x-amz-date"] = adate
    else:
        hdrs["Date"] = date_header
    hdrs["x-amz-content-sha256"] = ph
    for k, v in (headers or {}).items():
        hdrs[k] = v
    for d in drop:
        for k in [k for k in hdrs if k.lower() == d.lower()]:
            if signed is None:
                del hdrs[k]
    if signed is None:
        signed = sorted({k.lower() for k in hdrs if k.lower() in ("host", "x-amz-date", "date", "content-type", "content-md5")
                         or k.lower().startswith("x-amz-")})
    qs_sign = query if query is not None else ""
    if auth_header is None:
        auth_header, _ = authorization(key_id, secret, method, path, qs_sign, hdrs, signed, ph, adate,
                                       region=region if region is not None else bvh.REGION, service=service if service is not None else "s3", scope_date=scope_date,
                                       uppercase_sig=uppercase_sig)
    send = dict(hdrs)
    for d in drop:
        for k in [k for k in send if k.lower() == d.lower()]:
            del send[k]
    send["Authorization"] = auth_header
    send.update(extra_wire_headers or {})
    if wire_query is None:
        if isinstance(qs_sign, str):
            wire_query = qs_sign
        else:
            pairs = list(qs_sign.items()) if isinstance(qs_sign, dict) else list(qs_sign)
            wire_query = urllib.parse.urlencode(pairs, quote_via=urllib.parse.quote)
    target = (wire_path if wire_path is not None else path) + (("?" + wire_query) if wire_query else "")
    return bvh.http_raw(method, host, target, headers=send, body=body, timeout=timeout)


# --------------------------------------------------------------------------------------------
# assertions

SEEN_ERROR_BODIES = []


def err_fields(resp):
    try:
        root = resp.xml()
    except ET.ParseError:
        return {}
    return {el.tag: (el.text or "") for el in root}


def check_error(resp, status, code=None, *, message_contains=None):
    """Assert an S3 error response: status, code, and the documented shape of the XML body (spec 5.1/5.11)."""
    SEEN_ERROR_BODIES.append(resp.text)
    assert resp.status == status, "expected HTTP %s %s, got %s %s: %s" % (status, code or "", resp.status, resp.code, resp.text[:400])
    if resp.status in (304,):
        return
    ct = resp.header("content-type", "")
    assert ct.startswith("application/xml"), "error Content-Type should be application/xml, got %r" % ct
    f = err_fields(resp)
    assert f.get("Code"), "error body has no <Code>: %r" % resp.text[:300]
    if code is not None:
        assert f["Code"] == code, "expected error code %s, got %s (HTTP %s): %s" % (code, f["Code"], resp.status, resp.text[:400])
    assert "Message" in f, "error body has no <Message>: %r" % resp.text[:300]
    rid = resp.header("x-amz-request-id")
    assert rid, "no x-amz-request-id header on an error response"
    assert f.get("RequestId") == rid, "<RequestId> %r != x-amz-request-id %r" % (f.get("RequestId"), rid)
    if message_contains:
        assert message_contains.lower() in f["Message"].lower(), "message %r lacks %r" % (f["Message"], message_contains)


def check_head_error(resp, status):
    assert resp.status == status, "expected HTTP %s, got %s" % (status, resp.status)
    assert resp.body == b"", "HEAD error must carry no body, got %r" % resp.body[:200]


def raises_admin(status, error=None):
    """with raises_admin(400, 'invalid_request'): ADMIN.call(...)"""
    import contextlib

    @contextlib.contextmanager
    def cm():
        try:
            yield
        except bvh.AdminError as e:
            assert e.status == status, "expected admin HTTP %s, got %s: %s" % (status, e.status, e.body)
            if error is not None:
                assert isinstance(e.body, dict) and e.body.get("error") == error, \
                    "expected admin error %r, got %r" % (error, e.body)
        else:
            raise AssertionError("expected admin API HTTP %s but the call succeeded" % status)
    return cm()


def mp_upload(client, bucket, key, parts, **create_kw):
    """Create + upload the given parts + complete; returns the complete response."""
    up = client.create_multipart_upload(Bucket=bucket, Key=key, **create_kw)
    uid = up["UploadId"]
    done = []
    for i, p in enumerate(parts, 1):
        r = client.upload_part(Bucket=bucket, Key=key, UploadId=uid, PartNumber=i, Body=p)
        done.append({"ETag": r["ETag"], "PartNumber": i})
    return client.complete_multipart_upload(Bucket=bucket, Key=key, UploadId=uid, MultipartUpload={"Parts": done})


# a minimal PNG / JPEG / GIF / PDF / ZIP so the content sniffer has something real to look at
PNG = b"\x89PNG\r\n\x1a\n" + b"\x00\x00\x00\rIHDR" + b"\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06\x00\x00\x00\x1f\x15\xc4\x89" + b"\x00" * 64
JPEG = b"\xff\xd8\xff\xe0\x00\x10JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00" + b"\xff\xd9" * 8
GIF = b"GIF89a\x01\x00\x01\x00\x80\x00\x00\x00\x00\x00\xff\xff\xff!\xf9\x04\x01\x00\x00\x00\x00,\x00\x00\x00\x00\x01\x00\x01\x00\x00\x02\x02D\x01\x00;"
PDF = b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n"
ZIP = b"PK\x03\x04\x14\x00\x00\x00\x00\x00" + b"\x00" * 40
HTML = b"<!DOCTYPE html><html><head><title>x</title></head><body>hi</body></html>"
JSONTXT = b'{"a": 1, "b": [1, 2, 3]}'
TEXT = b"just some plain text, nothing to see here\n"
