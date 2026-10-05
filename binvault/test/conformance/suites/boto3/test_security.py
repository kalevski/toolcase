"""Parsing hardening and injection (spec 10): XML without DTD or entity processing, header injection, keys that never reach the
filesystem, path tricks against the admin router."""
import os
import socket
import threading
import time
import urllib.parse

import pytest

import bvh
import bvx_c as X
from bvh import ADMIN_TOKEN, ADMIN_URL, uniq


@pytest.fixture(scope="module")
def bk():
    return bvh.fresh_bucket("sec")


PASSWD_MARKERS = (b"root:", b"/bin/", b"daemon:", b"nobody")
XML_HEAD = '<?xml version="1.0" encoding="UTF-8"?>'


def xml_calls(bk):
    """(name, method, path, query, body-builder) for every S3 operation that takes an XML request body."""
    key = uniq("xml")
    bk.put(key, b"x")
    up = bk.s3.create_multipart_upload(Bucket=bk.name, Key=key + "-mp")["UploadId"]
    p = "/%s/%s" % (bk.name, key)
    return [
        ("PutObjectTagging", "PUT", p, "tagging", lambda inner: "<Tagging><TagSet><Tag><Key>k</Key><Value>%s</Value></Tag></TagSet></Tagging>" % inner),
        ("DeleteObjects", "POST", "/%s" % bk.name, "delete", lambda inner: "<Delete><Object><Key>%s</Key></Object></Delete>" % inner),
        ("CompleteMultipartUpload", "POST", p + "-mp", "uploadId=%s" % up,
         lambda inner: "<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>%s</ETag></Part></CompleteMultipartUpload>" % inner),
        ("PutObjectAcl", "PUT", p, "acl", lambda inner: "<AccessControlPolicy><Owner><ID>%s</ID></Owner></AccessControlPolicy>" % inner),
    ]


def md5_header(body):
    import base64
    import hashlib
    return base64.b64encode(hashlib.md5(body).digest()).decode()


def send(bk, method, path, query, doc):
    body = doc.encode() if isinstance(doc, str) else doc
    return bk.raw().request(method, path, query=query, body=body, headers={"Content-Type": "application/xml", "Content-MD5": md5_header(body)})


def test_external_entities_are_never_expanded(bk):
    marker = open("/etc/passwd", "rb").read(64) if os.path.exists("/etc/passwd") else b""
    dtd = '<!DOCTYPE d [<!ENTITY xxe SYSTEM "file:///etc/passwd">]>'
    for name, method, path, query, build in xml_calls(bk):
        r = send(bk, method, path, query, XML_HEAD + dtd + build("&xxe;"))
        assert r.status < 500, (name, r)
        assert not any(m in r.body for m in PASSWD_MARKERS) and (not marker or marker not in r.body), "%s echoed a local file: %r" % (name, r.body[:200])
    # whatever was stored (tagging accepts any value that looks right) must not contain the file either
    key = uniq("xxe")
    bk.put(key, b"x")
    send(bk, "PUT", "/%s/%s" % (bk.name, key), "tagging", XML_HEAD + dtd + "<Tagging><TagSet><Tag><Key>k</Key><Value>&xxe;</Value></Tag></TagSet></Tagging>")
    tags = bk.s3.get_object_tagging(Bucket=bk.name, Key=key)["TagSet"]
    assert not any(any(m in t["Value"].encode() for m in PASSWD_MARKERS) for t in tags), tags


def test_external_entities_make_no_network_requests(bk):
    hits = []
    srv = socket.socket()
    srv.bind(("127.0.0.1", 0))
    srv.listen(8)
    srv.settimeout(0.3)
    stop = threading.Event()

    def accept():
        while not stop.is_set():
            try:
                c, _ = srv.accept()
                hits.append(c.recv(200))
                c.close()
            except OSError:
                pass

    t = threading.Thread(target=accept, daemon=True)
    t.start()
    try:
        port = srv.getsockname()[1]
        for entity in ('<!ENTITY xxe SYSTEM "http://127.0.0.1:%d/ssrf">' % port, '<!ENTITY %% p SYSTEM "http://127.0.0.1:%d/ssrf-param"> %%p;' % port):
            dtd = "<!DOCTYPE d [%s]>" % entity
            for name, method, path, query, build in xml_calls(bk):
                r = send(bk, method, path, query, XML_HEAD + dtd + build("&xxe;"))
                assert r.status < 500, (name, r)
        time.sleep(1.0)
    finally:
        stop.set()
        srv.close()
    assert not hits, "the server fetched a URL named in a DTD: %r" % hits[:2]


def test_an_entity_expansion_bomb_is_cheap(bk):
    ents = '<!ENTITY lol0 "lol">' + "".join('<!ENTITY lol%d "%s">' % (i, "&lol%d;" % (i - 1) * 10) for i in range(1, 10))
    for name, method, path, query, build in xml_calls(bk):
        t0 = time.time()
        r = send(bk, method, path, query, XML_HEAD + "<!DOCTYPE lolz [%s]>" % ents + build("&lol9;"))
        assert r.status < 500, (name, r)
        assert time.time() - t0 < 5, "%s took %.1f s on an entity bomb" % (name, time.time() - t0)
    assert bvh.http_raw("GET", bvh.HOSTPORT, "/_healthz").status == 200


def test_deeply_nested_documents_are_refused_quickly(bk):
    depth = 150000                                                   # about 1 MB, under the 2 MiB document limit
    for name, method, path, query, build in xml_calls(bk):
        if name == "PutObjectAcl":
            continue                                                 # the body of an ACL write is not parsed at all (BV-11)
        doc = XML_HEAD + build("<a>" * depth + "</a>" * depth)
        t0 = time.time()
        try:
            r = send(bk, method, path, query, doc)
        except (BrokenPipeError, ConnectionError):
            r = None                                                  # refused early with the body unread (BV-19): fine here
        assert r is None or r.status in (400, 413), (name, r.status, r.code)
        assert time.time() - t0 < 10
    assert bvh.http_raw("GET", bvh.HOSTPORT, "/_healthz").status == 200


@pytest.mark.parametrize("doc", [
    XML_HEAD.replace("UTF-8", "UTF-16") + "<Tagging/>",
    XML_HEAD.replace("UTF-8", "ISO-8859-1") + "<Tagging><TagSet/></Tagging>",
    "﻿" + XML_HEAD + "<Tagging><TagSet/></Tagging>",
    XML_HEAD + "<Tagging><TagSet></Tagging>",
    XML_HEAD + "<Tagging><TagSet><Tag><Key>k</Key><Value>v</Value></Tag></TagSet></Tagging><!-- trailing -->junk",
    XML_HEAD + "<!DOCTYPE Tagging SYSTEM \"http://127.0.0.1:1/x.dtd\"><Tagging><TagSet/></Tagging>",
    "<Tagging xmlns:a=\"urn:a\" a:b=\"c\"><TagSet/></Tagging>",
    XML_HEAD + "<Tagging><TagSet><Tag><Key>\x01</Key><Value>v</Value></Tag></TagSet></Tagging>",
], ids=["utf16-declared", "latin1-declared", "bom", "unclosed", "trailing-junk", "external-dtd", "namespaced-attribute", "control-character"])
def test_odd_documents_are_client_errors_never_server_errors(bk, doc):
    key = uniq("odd")
    bk.put(key, b"x")
    r = send(bk, "PUT", "/%s/%s" % (bk.name, key), "tagging", doc)
    assert r.status < 500, r
    assert bvh.http_raw("GET", bvh.HOSTPORT, "/_healthz").status == 200


def test_invalid_utf8_in_an_xml_document_is_a_client_error(bk):
    key = uniq("u8")
    bk.put(key, b"x")
    r = send(bk, "PUT", "/%s/%s" % (bk.name, key), "tagging", XML_HEAD.encode() + b"<Tagging><TagSet><Tag><Key>k</Key><Value>\xff\xfe</Value></Tag></TagSet></Tagging>")
    assert r.status in (400, 200), r
    if r.status == 200:
        assert all("�" not in t["Value"] for t in bk.s3.get_object_tagging(Bucket=bk.name, Key=key)["TagSet"]), "invalid UTF-8 must not be stored as replacement characters"


# --------------------------------------------------------------------------------------------
# header injection

@pytest.mark.parametrize("param", ["response-content-disposition", "response-content-type", "response-cache-control", "response-content-language", "response-content-encoding"])
def test_response_overrides_cannot_inject_headers(bk, param):
    bk.put("inj", b"x")
    evil = "a%0d%0aX-Evil: 1%0d%0a%0d%0a<script>alert(1)</script>"
    r = bk.raw().request("GET", "/%s/inj" % bk.name, query=[(param, urllib.parse.unquote(evil))])
    assert r.status in (200, 400), r
    assert r.header("x-evil") is None, "header injected through %s: %r" % (param, r.raw_headers)
    assert b"<script>" not in r.body or r.status == 400
    # and through a presigned URL
    url = bk.raw().presign("GET", "/%s/inj" % bk.name, query=[(param, urllib.parse.unquote(evil))])
    r = bvh.http_get(url)
    assert r.header("x-evil") is None, r.raw_headers


def test_folded_and_odd_header_values_stay_inside_their_header(bk):
    key = uniq("fold")
    body = b"x"
    path = "/%s/%s" % (bk.name, key)
    r = bk.raw().request("PUT", path, body=body, headers={"Content-Disposition": "attachment; filename=a.txt", "x-amz-meta-note": "plain value"})
    assert r.status == 200
    g = bk.raw().request("GET", path)
    assert g.header("content-disposition") == "attachment; filename=a.txt" and g.header("x-evil") is None
    # a header continuation line (obsolete line folding) must not smuggle a header into the stored object
    raw = ("PUT %s HTTP/1.1\r\nHost: %s\r\nContent-Length: 1\r\nContent-Disposition: inline\r\n X-Evil: 1\r\nx-amz-content-sha256: UNSIGNED-PAYLOAD\r\n\r\nx"
           % (path, bvh.HOSTPORT)).encode()
    X.sock_exchange(bvh.HOSTPORT, raw, read_timeout=5)
    g = bk.raw().request("GET", path)
    assert g.header("x-evil") is None


@pytest.mark.parametrize("tagging", ["a=b%0d%0aX-Evil%3D1", "k=v%00w", "k%0a=v", "k=%3Cscript%3E", "k=v;x", "k=v|x", "=v"])
def test_tag_syntax_is_validated(bk, tagging):
    key = uniq("tag")
    r = bk.raw().request("PUT", "/%s/%s" % (bk.name, key), body=b"x", headers={"x-amz-tagging": tagging})
    assert r.status == 400 and r.code in ("InvalidTag", "InvalidArgument", "InvalidRequest"), (tagging, r.status, r.code)
    assert bvh.err_of(bk.s3.head_object, Bucket=bk.name, Key=key)[0] == 404, "a refused write stores nothing"


# --------------------------------------------------------------------------------------------
# keys and names never reach the filesystem

def test_keys_never_become_file_names():
    with bvh.Node(env={"BINVAULT_FSYNC": "false"}) as node:
        name, ak, sk = node.fresh_bucket("fs")
        c = node.client(ak, sk)
        marker = uniq("escape")
        outside = os.path.join(os.path.dirname(node.dir), "bv-" + marker)
        keys = ["../../../bv-" + marker, "..%2f" + marker, "/abs/" + marker, "a/../../" + marker, "x/./" + marker, "\\..\\" + marker, marker + "/", "..", ".", "con", "nul.txt", marker + "‮"]
        for k in keys:
            c.put_object(Bucket=name, Key=k, Body=b"payload " + k.encode())
        for k in keys:
            assert c.get_object(Bucket=name, Key=k)["Body"].read() == b"payload " + k.encode()
        assert not os.path.exists(outside) and not os.path.exists(outside + "/") and not any(marker in f for f in os.listdir(os.path.dirname(node.dir))), "a key escaped the data directory"
        for root, dirs, files in os.walk(node.dir):
            for f in dirs + files:
                assert marker not in f and "payload" not in f, "a key shows up as a file name: %s" % os.path.join(root, f)


@pytest.mark.parametrize("name", ["../x", "a/b", "a\\b", "%2e%2e", "..", "a/../b", "bvt-ok\x00x", "x" * 3 + "\n"])
def test_bucket_names_with_path_syntax_are_refused_by_the_admin_api(name):
    import json
    import urllib.request
    req = urllib.request.Request(ADMIN_URL + "/_admin/v1/buckets", data=json.dumps({"name": name}).encode(), method="POST",
                                 headers={"Authorization": "Bearer " + ADMIN_TOKEN, "Content-Type": "application/json"})
    try:
        urllib.request.urlopen(req, timeout=10)
        status = 200
    except urllib.error.HTTPError as e:
        status = e.code
    assert status == 400, (name, status)


@pytest.mark.parametrize("path", ["/_admin/v1/buckets/../status", "/_admin/v1/buckets/%2e%2e/status", "/_admin/v1/buckets/..%2fstatus", "/_admin/v1/buckets/x/../../status",
                                  "/_admin/v1/./status", "/_admin/v1/status%00", "/_admin/v1/STATUS", "/_admin/V1/status"])
def test_path_tricks_do_not_reach_other_admin_routes(path):
    hostport = urllib.parse.urlparse(ADMIN_URL).netloc
    r = bvh.http_raw("GET", hostport, path, headers={"Authorization": "Bearer " + ADMIN_TOKEN})
    assert r.status in (400, 404), (path, r.status, r.text[:100])
    assert b'"uptime_seconds"' not in r.body, "the status document was served for %s" % path
