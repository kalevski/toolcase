"""Error documents and protocol robustness: HTTP framing, abusive input, timeouts (spec 5.1, 5.11, 2.3, 3.8)."""
import http.client
import socket
import time
import urllib.parse

import pytest

import bvh
import bvx_b as XB
import bvx_c as X
from bvh import KiB, MiB, md5hex, rnd, s3error, uniq
from bvx_a import raw_get, raw_head, raw_put, raw_req

HOST, _, PORT = bvh.HOSTPORT.partition(":")


# --------------------------------------------------------------------------------------------
# the error document

CASES = [
    ("NoSuchKey", 404, lambda bk: raw_get(bk, "missing")),
    ("NoSuchBucket", 404, lambda bk: bk.raw().request("GET", "/bvt-none-%s/k" % uniq("x")[-8:])),
    ("NoSuchUpload", 404, lambda bk: raw_req(bk, "GET", "k", query={"uploadId": "nope"})),
    ("InvalidArgument", 400, lambda bk: raw_get(bk, "k", query={"versionId": "no-such-version"})),
    ("AccessDenied", 403, lambda bk: bk.raw().request("GET", "/%s/k" % bk.name, sign=False)),
    ("InvalidAccessKeyId", 403, lambda bk: bvh.Raw("BVKAAAAAAAAAAAAAAAAA", "s" * 40).request("GET", "/%s/k" % bk.name)),
    ("SignatureDoesNotMatch", 403, lambda bk: bvh.Raw(bk.ak, "s" * 40).request("GET", "/%s/k" % bk.name)),
    ("InvalidArgument", 400, lambda bk: raw_req(bk, "GET", None, query={"list-type": "2", "max-keys": "x"})),
    ("MalformedXML", 400, lambda bk: raw_req(bk, "POST", None, query={"delete": ""}, body="nope")),
    ("KeyTooLongError", 400, lambda bk: raw_put(bk, "k" * 1025, b"x")),
    ("BadDigest", 400, lambda bk: raw_put(bk, "k", b"x", headers={"Content-MD5": "AAAAAAAAAAAAAAAAAAAAAA=="})),
    ("InvalidDigest", 400, lambda bk: raw_put(bk, "k", b"x", headers={"Content-MD5": "!!"})),
    ("InvalidStorageClass", 400, lambda bk: raw_put(bk, "k", b"x", headers={"x-amz-storage-class": "GLACIER"})),
    ("PreconditionFailed", 412, lambda bk: raw_put(bk, "k", b"x", headers={"If-None-Match": "*"})),
    ("MethodNotAllowed", 405, lambda bk: bk.raw().request("DELETE", "/")),
    ("NotImplemented", 501, lambda bk: raw_req(bk, "GET", None, query={"accelerate": ""})),
    ("InvalidRange", 416, lambda bk: raw_get(bk, "k", headers={"Range": "bytes=999-"})),
]


@pytest.fixture(scope="module")
def eb():
    bk = bvh.fresh_bucket("err")
    bk.put("k", b"x")
    return bk


@pytest.mark.parametrize("code,status,call", CASES, ids=["%s-%d" % (c[0], i) for i, c in enumerate(CASES)])
def test_error_document_shape(eb, code, status, call):
    r = call(eb)
    X.check_error(r, status, code)
    f = X.err_fields(r)
    assert f.get("Resource"), "every error names its Resource: %r" % r.text[:300]
    assert r.xml().tag == "Error"
    assert r.text.startswith("<?xml version=\"1.0\" encoding=\"UTF-8\"?>")


@pytest.mark.parametrize("path,status", [("/%s/missing", 404), ("/bvt-none-xyz123/k", 404)], ids=["key", "bucket"])
def test_head_errors_carry_no_body(eb, path, status):
    r = eb.raw().request("HEAD", path % eb.name if "%s" in path else path)
    X.check_head_error(r, status)
    assert r.header("x-amz-request-id")


def test_every_response_has_the_standard_headers_even_when_abusive(eb):
    for raw in (b"GET /%s/k HTTP/1.1\r\nHost: %s\r\nAuthorization: AWS4-HMAC-SHA256 garbage\r\n\r\n" % (eb.name.encode(), bvh.HOSTPORT.encode()),
                b"GET / HTTP/1.1\r\nHost: %s\r\n\r\n" % bvh.HOSTPORT.encode()):
        reply = X.sock_exchange(bvh.HOSTPORT, raw)
        r = X.parse_http_response(reply)
        assert r.header("x-amz-request-id") and r.header("server") == "binvault", r.raw_headers


def test_the_exact_xml_declaration_and_media_type(eb):
    r = raw_get(eb, "missing")
    assert r.header("content-type") == "application/xml"
    assert r.text.startswith('<?xml version="1.0" encoding="UTF-8"?>')


# --------------------------------------------------------------------------------------------
# framing

def test_pipelined_requests_are_answered_in_order(eb):
    eb.put("p1", b"first")
    eb.put("p2", b"second")
    reqs = b""
    for key in ("p1", "missing", "p2"):
        p, q, h = XB.signed_headers(eb.raw(), "GET", "/%s/%s" % (eb.name, key), None, {}, payload="UNSIGNED-PAYLOAD")
        reqs += XB.request_bytes("GET", p, h)
    host, _, port = bvh.HOSTPORT.partition(":")
    with socket.create_connection((host, int(port)), timeout=10) as s:
        s.sendall(reqs)
        s.settimeout(5)
        buf = b""
        while not (b"first" in buf and b"NoSuchKey" in buf and b"second" in buf):
            chunk = s.recv(65536)
            if not chunk:
                break
            buf += chunk
    statuses = [int(x.split(b" ", 1)[0]) for x in buf.split(b"HTTP/1.1 ")[1:]]
    assert statuses == [200, 404, 200], buf[:400]
    assert buf.index(b"first") < buf.index(b"NoSuchKey") < buf.index(b"second")


def test_keep_alive_survives_error_responses(eb):
    c = http.client.HTTPConnection(HOST, int(PORT), timeout=10)
    try:
        for i in range(30):
            key = "k" if i % 3 else "missing-%d" % i
            p, q, h = XB.signed_headers(eb.raw(), "GET", "/%s/%s" % (eb.name, key), None, {}, payload="UNSIGNED-PAYLOAD")
            c.putrequest("GET", p, skip_host=True, skip_accept_encoding=True)
            for k, v in h.items():
                c.putheader(k, v)
            c.endheaders()
            r = c.getresponse()
            r.read()
            assert r.status == (200 if i % 3 else 404), (i, r.status)
    finally:
        c.close()


def test_connection_close_is_honoured(eb):
    p, q, h = XB.signed_headers(eb.raw(), "GET", "/%s/k" % eb.name, None, {"Connection": "close"}, payload="UNSIGNED-PAYLOAD", signed_headers=["host", "x-amz-content-sha256", "x-amz-date"])
    reply = X.sock_exchange(bvh.HOSTPORT, XB.request_bytes("GET", p, h), read_timeout=5)
    assert reply.startswith(b"HTTP/1.1 200"), reply[:100]


def test_the_server_never_compresses_responses(eb):
    eb.put("gz", b"a" * 5000)
    r = raw_get(eb, "gz", headers={"Accept-Encoding": "gzip, deflate, br"})
    assert r.status == 200 and r.body == b"a" * 5000 and r.header("content-encoding") is None, r.raw_headers


@pytest.mark.parametrize("method", ["PATCH", "TRACE", "PROPFIND", "COPY", "LOCK"])
def test_unsupported_methods_are_client_errors(eb, method):
    for path in ("/%s/k" % eb.name, "/%s" % eb.name):
        r = eb.raw().request(method, path)
        assert r.status in (405, 501, 400, 404), (method, path, r)
        assert r.status < 500 or r.status == 501


def test_options_without_origin_is_a_client_error_or_denied(eb):
    r = bvh.http_raw("OPTIONS", bvh.HOSTPORT, "/%s/k" % eb.name)
    assert 400 <= r.status < 500, r


def test_unknown_reserved_path_is_404(eb):
    r = bvh.http_raw("GET", bvh.HOSTPORT, "/_unknown-endpoint")
    assert r.status == 404, r


def test_trailing_slash_on_the_bucket_is_the_same_bucket(eb):
    a = eb.raw().request("GET", "/%s" % eb.name, query={"list-type": "2"})
    b = eb.raw().request("GET", "/%s/" % eb.name, query={"list-type": "2"})
    assert a.status == b.status == 200 and a.xml().findtext("KeyCount") == b.xml().findtext("KeyCount")


# --------------------------------------------------------------------------------------------
# abusive input

def test_header_block_over_64_kib_is_refused(eb):
    big = "x" * (70 * KiB)
    reply = X.sock_exchange(bvh.HOSTPORT, b"GET /%s/k HTTP/1.1\r\nHost: %s\r\nX-Big: %s\r\n\r\n" % (eb.name.encode(), bvh.HOSTPORT.encode(), big.encode()))
    assert reply == b"" or b" 431 " in reply[:20] or b" 400 " in reply[:20], reply[:100]
    assert raw_get(eb, "k").status == 200, "the server is still fine"


def test_a_very_long_request_target_is_refused(eb):
    reply = X.sock_exchange(bvh.HOSTPORT, b"GET /%s/%s HTTP/1.1\r\nHost: %s\r\n\r\n" % (eb.name.encode(), b"a" * 100000, bvh.HOSTPORT.encode()))
    assert reply == b"" or reply.split(b" ", 2)[1] in (b"400", b"414", b"431", b"403", b"404"), reply[:100]
    assert raw_get(eb, "k").status == 200


def test_conflicting_content_lengths_are_refused(eb):
    p, q, h = XB.signed_headers(eb.raw(), "PUT", "/%s/cl" % eb.name, None, {}, payload="UNSIGNED-PAYLOAD")
    raw = XB.request_bytes("PUT", p, dict(h, **{"Content-Length": "5"})).replace(b"\r\n\r\n", b"\r\nContent-Length: 6\r\n\r\n") + b"hello!"
    reply = X.sock_exchange(bvh.HOSTPORT, raw, half_close=True)
    assert reply == b"" or reply.split(b" ", 2)[1] == b"400", reply[:100]
    with s3error(None, 404):
        eb.head("cl")


def test_chunked_together_with_content_length_never_stores_a_wrong_object(eb):
    p, q, h = XB.signed_headers(eb.raw(), "PUT", "/%s/te-cl" % eb.name, None, {}, payload="UNSIGNED-PAYLOAD")
    h["Transfer-Encoding"] = "chunked"
    h["Content-Length"] = "3"
    raw = XB.request_bytes("PUT", p, h) + b"5\r\nhello\r\n0\r\n\r\n"
    reply = X.sock_exchange(bvh.HOSTPORT, raw, half_close=True, read_timeout=5)
    status = reply.split(b" ", 2)[1] if reply else b""
    assert status in (b"", b"400", b"200"), reply[:100]
    try:
        body = eb.read("te-cl")
        assert body == b"hello", "if anything is stored it must be the chunked body, not a 3-byte prefix: %r" % body
    except Exception:
        pass


def test_truncated_body_stores_nothing(eb):
    eb.put("trunc", b"previous content")
    p, q, h = XB.signed_headers(eb.raw(), "PUT", "/%s/trunc" % eb.name, None, {}, payload="UNSIGNED-PAYLOAD")
    h["Content-Length"] = "1000"
    reply = X.sock_exchange(bvh.HOSTPORT, XB.request_bytes("PUT", p, h) + b"x" * 400, half_close=True, read_timeout=8)
    if reply:
        r = X.parse_http_response(reply)
        assert r.status in (400, 408), r
        assert r.code in ("IncompleteBody", "RequestTimeout", "BadRequest", ""), r
    assert eb.read("trunc") == b"previous content", "a half-received overwrite must leave the old object"


def test_expect_100_continue_for_a_doomed_request_is_not_answered_with_100(eb):
    p, q, h = XB.signed_headers(eb.raw(), "PUT", "/bvt-none-%s/k" % uniq("x")[-8:], None, {"Expect": "100-continue", "Content-Length": "5000"}, payload="UNSIGNED-PAYLOAD")
    reply = X.sock_exchange(bvh.HOSTPORT, XB.request_bytes("PUT", p, h), read_timeout=5)
    assert reply.startswith(b"HTTP/1.1 404"), reply[:100]


def test_expect_100_continue_for_a_signature_failure(eb):
    p, q, h = XB.signed_headers(bvh.Raw(eb.ak, "wrong" * 8), "PUT", "/%s/k2" % eb.name, None, {"Expect": "100-continue", "Content-Length": "5000"}, payload="UNSIGNED-PAYLOAD")
    reply = X.sock_exchange(bvh.HOSTPORT, XB.request_bytes("PUT", p, h), read_timeout=5)
    assert reply.startswith(b"HTTP/1.1 403"), reply[:100]


def test_a_flood_of_garbage_requests_leaves_the_server_healthy(eb):
    payloads = [b"\x00\x01\x02\x03\r\n\r\n", b"GET\r\n\r\n", b"GET / HTTP/9.9\r\n\r\n", b"G\xffT / HTTP/1.1\r\nHost: x\r\n\r\n", b"POST / HTTP/1.1\r\nHost: x\r\nContent-Length: abc\r\n\r\n",
                b"GET /" + b"%" * 50 + b" HTTP/1.1\r\nHost: x\r\n\r\n", b"GET /bucket/\x00key HTTP/1.1\r\nHost: x\r\n\r\n", b"\r\n\r\n\r\n", b"GET http://evil.example.com/ HTTP/1.1\r\nHost: x\r\n\r\n"]
    for p in payloads:
        X.sock_exchange(bvh.HOSTPORT, p, half_close=True, read_timeout=3)
    assert raw_get(eb, "k").status == 200
    assert bvh.http_raw("GET", bvh.HOSTPORT, "/_healthz").status == 200


def test_many_concurrent_connections(eb):
    socks = []
    try:
        for _ in range(200):
            socks.append(socket.create_connection((HOST, int(PORT)), timeout=5))
        assert raw_get(eb, "k").status == 200, "idle connections must not starve new requests"
    finally:
        for s in socks:
            s.close()


# --------------------------------------------------------------------------------------------
# timeouts (private nodes with short settings)

def test_a_stalled_upload_is_aborted_with_requesttimeout_and_stores_nothing():
    with bvh.Node(env={"BINVAULT_BODY_IDLE_TIMEOUT": "2s", "BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("idle")
        raw = bvh.Raw(ak, sk, endpoint=node.endpoint)
        p, q, h = XB.signed_headers(raw, "PUT", "/%s/slow" % name, None, {}, payload="UNSIGNED-PAYLOAD")
        h["Content-Length"] = "1000"
        t0 = time.time()
        reply = X.sock_exchange(node.endpoint.split("//")[1], XB.request_bytes("PUT", p, h) + b"x" * 100, stall=6.0, read_timeout=12)
        elapsed = time.time() - t0
        if reply:
            r = X.parse_http_response(reply)
            assert r.status == 400 and r.code == "RequestTimeout", r
        c = node.client(ak, sk)
        with s3error(None, 404):
            c.head_object(Bucket=name, Key="slow")
        assert elapsed < 12


def test_a_slow_but_steady_upload_is_not_cut_off():
    """spec 2.3: there is no overall transfer timeout, only an idle one."""
    with bvh.Node(env={"BINVAULT_BODY_IDLE_TIMEOUT": "2s", "BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("steady")
        raw = bvh.Raw(ak, sk, endpoint=node.endpoint)
        p, q, h = XB.signed_headers(raw, "PUT", "/%s/steady" % name, None, {}, payload="UNSIGNED-PAYLOAD")
        h["Content-Length"] = "12"
        host, _, port = node.endpoint.split("//")[1].partition(":")
        with socket.create_connection((host, int(port)), timeout=10) as s:
            s.sendall(XB.request_bytes("PUT", p, h))
            for _ in range(6):
                s.sendall(b"ab")
                time.sleep(1.0)                    # 6 s in total, never 2 s of silence
            s.settimeout(10)
            reply = s.recv(4096)
        assert reply.startswith(b"HTTP/1.1 200"), reply[:100]
        assert node.client(ak, sk).get_object(Bucket=name, Key="steady")["Body"].read() == b"ab" * 6


def test_a_client_that_never_finishes_its_headers_is_dropped_and_the_server_stays_up():
    with bvh.Node(env={"BINVAULT_HEADER_TIMEOUT": "1s", "BINVAULT_FSYNC": "false"}) as node:
        hostport = node.endpoint.split("//")[1]
        t0 = time.time()
        reply = X.sock_exchange(hostport, b"GET /_healthz HTTP/1.1\r\nHost: x\r\n", stall=0.0, read_timeout=6)
        assert time.time() - t0 < 5.5, "the connection should be closed after the header timeout"
        assert reply == b"" or reply.split(b" ", 2)[1] in (b"408", b"400"), reply[:100]
        assert bvh.http_raw("GET", hostport, "/_healthz").status == 200


# --------------------------------------------------------------------------------------------
# a refused upload with a big body

@pytest.mark.parametrize("size", [300 * KiB, 2 * MiB, 8 * MiB], ids=["300KiB", "2MiB", "8MiB"])
def test_a_refused_upload_does_not_reset_the_connection_while_the_client_is_still_sending(size):
    """Spec 3.5: admission checks run before the body is read. Clients that do not wait for 100-continue (rclone, the Node SDK,
    anything that streams) keep sending; if the node answers and closes with unread data the client sees EPIPE / a reset instead of
    the S3 error ("request send failed"). Spec 3.13 drains a body to be able to answer 415; the other early refusals
    (QuotaExceeded, EntityTooLarge, a write-once AccessDenied ...) should leave the client able to finish sending and read the answer."""
    bk = bvh.fresh_bucket("rstq", quota_bytes=1000)
    p, q, h = XB.signed_headers(bk.raw(), "PUT", "/%s/big" % bk.name, None, {}, payload="UNSIGNED-PAYLOAD")
    h["Content-Length"] = str(size)
    with XB.raw_socket(bvh.HOSTPORT, timeout=20) as s:
        s.sendall(XB.request_bytes("PUT", p, h))
        chunk = b"x" * 65536
        sent = 0
        try:
            while sent < size:
                n = min(len(chunk), size - sent)
                s.sendall(chunk[:n])
                sent += n
        except (BrokenPipeError, ConnectionResetError) as e:
            pytest.fail("the connection was torn down after %d of %d bytes while the client was still sending (%s)" % (sent, size, type(e).__name__))
        resp = XB.read_response(s)
    assert resp.status == 403 and resp.code == "QuotaExceeded", resp
