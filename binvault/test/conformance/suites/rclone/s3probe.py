#!/usr/bin/env python3
"""Independent S3 probe (stdlib only) used by the rclone and mc suites to check what is REALLY stored,
without trusting the client under test.

  s3probe.py --kind plain|versioned|public|quota|ctype  COMMAND ...
  s3probe.py --bucket B --ak AK --sk SK                 COMMAND ...

Endpoint and credentials come from the BV_* environment (BV_ENDPOINT, BV_<KIND>_BUCKET/_AK/_SK).

commands
  list [PREFIX]            JSON array of every key (ListObjectsV2, paginated, encoding-type=url decoded)
  versions [PREFIX]        JSON array of {key, version, latest, marker} (ListObjectVersions)
  head KEY [VERSION]       JSON {status, headers}  (headers lower-cased)
  get KEY OUTFILE [VERSION]  prints the HTTP status; the body goes to OUTFILE
  put KEY FILE [Name: value ...]   prints the HTTP status
  delete KEY [VERSION]     prints the HTTP status
  tags KEY                 JSON {status, tags{}}
  mpu-create KEY           start a multipart upload; prints the UploadId
  mpu-list                 JSON array of {key, upload_id} (ListMultipartUploads)
  mpu-abort KEY UPLOAD_ID  prints the HTTP status
  quote KEY                the percent-encoded path of KEY (what goes on the wire)
  wirepaths LOGFILE METHOD decoded request paths found in an rclone `--dump headers` log
"""
import datetime
import hashlib
import hmac
import http.client
import json
import os
import re
import sys
import urllib.parse
import xml.etree.ElementTree as ET


def s3quote(s):
    return urllib.parse.quote(s, safe="/")


def _q(s):
    return urllib.parse.quote(s, safe="")


def _hm(k, m):
    return hmac.new(k, m.encode(), hashlib.sha256).digest()


class Probe:
    def __init__(self, bucket, ak, sk, endpoint, region="us-east-1"):
        self.bucket, self.ak, self.sk, self.region = bucket, ak, sk, region
        u = urllib.parse.urlparse(endpoint)
        self.host, self.port = u.hostname, u.port or 80

    def request(self, method, key=None, query=None, headers=None, body=b""):
        path = "/" + self.bucket + ("/" + s3quote(key) if key is not None else "")
        q = sorted((_q(k), _q(v)) for k, v in (query or []))
        cq = "&".join("%s=%s" % kv for kv in q)
        now = datetime.datetime.now(datetime.timezone.utc)
        amzdate, date = now.strftime("%Y%m%dT%H%M%SZ"), now.strftime("%Y%m%d")
        ph = hashlib.sha256(body).hexdigest()
        hostport = "%s:%d" % (self.host, self.port)
        hs = {"host": hostport, "x-amz-content-sha256": ph, "x-amz-date": amzdate}
        for k, v in (headers or {}).items():
            hs[k.lower()] = " ".join(str(v).split())
        names = sorted(hs)
        creq = "\n".join([method, path, cq, "".join("%s:%s\n" % (n, hs[n]) for n in names), ";".join(names), ph])
        scope = "%s/%s/s3/aws4_request" % (date, self.region)
        sts = "\n".join(["AWS4-HMAC-SHA256", amzdate, scope, hashlib.sha256(creq.encode()).hexdigest()])
        k = _hm(("AWS4" + self.sk).encode(), date)
        for part in (self.region, "s3", "aws4_request"):
            k = _hm(k, part)
        sig = hmac.new(k, sts.encode(), hashlib.sha256).hexdigest()
        auth = "AWS4-HMAC-SHA256 Credential=%s/%s, SignedHeaders=%s, Signature=%s" % (self.ak, scope, ";".join(names), sig)
        conn = http.client.HTTPConnection(self.host, self.port, timeout=120)
        try:
            conn.putrequest(method, path + ("?" + cq if cq else ""), skip_host=True, skip_accept_encoding=True)
            conn.putheader("Host", hostport)
            conn.putheader("x-amz-date", amzdate)
            conn.putheader("x-amz-content-sha256", ph)
            for kk, vv in (headers or {}).items():
                conn.putheader(kk, vv)
            conn.putheader("Authorization", auth)
            conn.putheader("Content-Length", str(len(body)))
            conn.endheaders(body or None)
            r = conn.getresponse()
            data = r.read() if method != "HEAD" else b""
            return r.status, {h.lower(): v for h, v in r.getheaders()}, data
        finally:
            conn.close()


def strip_ns(root):
    for el in root.iter():
        if "}" in el.tag:
            el.tag = el.tag.split("}", 1)[1]
    return root


def main(argv):
    kind = bucket = ak = sk = None
    while argv and argv[0].startswith("--"):
        opt = argv.pop(0)
        if opt == "--kind":
            kind = argv.pop(0)
        elif opt == "--bucket":
            bucket = argv.pop(0)
        elif opt == "--ak":
            ak = argv.pop(0)
        elif opt == "--sk":
            sk = argv.pop(0)
        else:
            sys.exit("unknown option " + opt)
    cmd = argv.pop(0) if argv else ""
    if cmd == "quote":
        sys.stdout.write(s3quote(argv[0]))
        return 0
    if cmd == "wirepaths":
        log, method = argv[0], argv[1]
        for ln in open(log, errors="replace"):
            m = re.search(r"\b%s (/\S*) HTTP/1\.[01]" % re.escape(method), ln)
            if m:
                p = m.group(1).split("?", 1)[0]
                parts = p.split("/", 2)       # '', bucket, key
                key = urllib.parse.unquote(parts[2]) if len(parts) > 2 else ""
                print(key)
        return 0
    if kind:
        K = kind.upper()
        bucket, ak, sk = os.environ["BV_%s_BUCKET" % K], os.environ["BV_%s_AK" % K], os.environ["BV_%s_SK" % K]
    p = Probe(bucket, ak, sk, os.environ["BV_ENDPOINT"])

    if cmd == "list":
        prefix = argv[0] if argv else ""
        keys, token = [], None
        while True:
            q = [("list-type", "2"), ("encoding-type", "url"), ("max-keys", "1000")]
            if prefix:
                q.append(("prefix", prefix))
            if token:
                q.append(("continuation-token", token))
            st, _, body = p.request("GET", None, q)
            if st != 200:
                sys.stderr.write("list failed: HTTP %d %s\n" % (st, body[:300]))
                return 2
            root = strip_ns(ET.fromstring(body))
            keys += [urllib.parse.unquote(c.findtext("Key")) for c in root.findall("Contents")]
            if root.findtext("IsTruncated") == "true":
                token = root.findtext("NextContinuationToken")
            else:
                break
        print(json.dumps(keys, ensure_ascii=False))
    elif cmd == "versions":
        prefix = argv[0] if argv else ""
        out, kmark, vmark = [], None, None
        while True:
            q = [("versions", ""), ("encoding-type", "url")]
            if prefix:
                q.append(("prefix", prefix))
            if kmark is not None:
                q += [("key-marker", kmark), ("version-id-marker", vmark or "")]
            st, _, body = p.request("GET", None, q)
            if st != 200:
                sys.stderr.write("versions failed: HTTP %d %s\n" % (st, body[:300]))
                return 2
            root = strip_ns(ET.fromstring(body))
            for tag in ("Version", "DeleteMarker"):
                for e in root.findall(tag):
                    out.append({"key": urllib.parse.unquote(e.findtext("Key")), "version": e.findtext("VersionId"),
                                "latest": e.findtext("IsLatest") == "true", "marker": tag == "DeleteMarker"})
            if root.findtext("IsTruncated") == "true":
                kmark, vmark = urllib.parse.unquote(root.findtext("NextKeyMarker")), root.findtext("NextVersionIdMarker")
            else:
                break
        print(json.dumps(out, ensure_ascii=False))
    elif cmd == "head":
        q = [("versionId", argv[1])] if len(argv) > 1 else None
        st, h, _ = p.request("HEAD", argv[0], q)
        print(json.dumps({"status": st, "headers": h}))
    elif cmd == "get":
        q = [("versionId", argv[2])] if len(argv) > 2 else None
        st, _, body = p.request("GET", argv[0], q)
        open(argv[1], "wb").write(body)
        print(st)
    elif cmd == "put":
        extra = {}
        for hv in argv[2:]:
            n, _, v = hv.partition(":")
            extra[n.strip()] = v.strip()
        st, h, body = p.request("PUT", argv[0], None, extra, open(argv[1], "rb").read())
        print(st)
        if st >= 300:
            sys.stderr.write(body.decode("utf-8", "replace")[:400] + "\n")
    elif cmd == "delete":
        q = [("versionId", argv[1])] if len(argv) > 1 else None
        st, _, _ = p.request("DELETE", argv[0], q)
        print(st)
    elif cmd == "tags":
        st, _, body = p.request("GET", argv[0], [("tagging", "")])
        tags = {}
        if st == 200:
            root = strip_ns(ET.fromstring(body))
            for t in root.iter("Tag"):
                tags[t.findtext("Key")] = t.findtext("Value")
        print(json.dumps({"status": st, "tags": tags}))
    elif cmd == "mpu-create":
        st, _, body = p.request("POST", argv[0], [("uploads", "")])
        if st != 200:
            sys.stderr.write("mpu-create failed: HTTP %d %s\n" % (st, body[:300]))
            return 2
        print(strip_ns(ET.fromstring(body)).findtext("UploadId"))
    elif cmd == "mpu-list":
        st, _, body = p.request("GET", None, [("uploads", ""), ("encoding-type", "url")])
        if st != 200:
            sys.stderr.write("mpu-list failed: HTTP %d %s\n" % (st, body[:300]))
            return 2
        root = strip_ns(ET.fromstring(body))
        print(json.dumps([{"key": urllib.parse.unquote(u.findtext("Key")), "upload_id": u.findtext("UploadId")}
                          for u in root.findall("Upload")], ensure_ascii=False))
    elif cmd == "mpu-abort":
        st, _, _ = p.request("DELETE", argv[0], [("uploadId", argv[1])])
        print(st)
    else:
        sys.exit(__doc__)
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
