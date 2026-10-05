"""Private helpers of the core-object-operations modules (fork F1). Nothing here asserts binvault behaviour
beyond tiny parsing conveniences; the test modules own all expectations."""
import concurrent.futures
import datetime
import email.utils
import re
import urllib.parse

import bvh
from bvh import DOMAIN, PORT, s3quote

ISO_MS = re.compile(r"^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$")
HTTP_DATE = re.compile(r"^(Mon|Tue|Wed|Thu|Fri|Sat|Sun), \d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4} \d{2}:\d{2}:\d{2} GMT$")
S3_NS = "http://s3.amazonaws.com/doc/2006-03-01/"


def parse_http_date(s):
    return email.utils.parsedate_to_datetime(s)


def http_date(dt):
    """RFC 9110 IMF-fixdate of an aware datetime."""
    return email.utils.format_datetime(dt.astimezone(datetime.timezone.utc), usegmt=True)


def now_utc():
    return datetime.datetime.now(datetime.timezone.utc)


def vhost(bucket):
    return "%s.%s:%d" % (bucket.name, DOMAIN, PORT)


# ---- raw (exact-bytes) requests -----------------------------------------------------------

def raw_req(bk, method, key=None, query=None, headers=None, body=b"", vhosted=False, **kw):
    """Signed request with the exact encoded path: /bucket/<key> (path style) or /<key> on <bucket>.<domain>."""
    raw = bk.raw()
    if vhosted:
        path = "/" + (s3quote(key) if key is not None else "")
        return raw.request(method, path, query=query, headers=headers, body=body, host=vhost(bk),
                           connect_host="127.0.0.1", **kw)
    path = "/" + bk.name
    if key is not None:
        path += "/" + s3quote(key)
    return raw.request(method, path, query=query, headers=headers, body=body, **kw)


def raw_put(bk, key, body=b"", headers=None, **kw):
    return raw_req(bk, "PUT", key, headers=headers, body=body, **kw)


def raw_get(bk, key, headers=None, query=None, **kw):
    return raw_req(bk, "GET", key, query=query, headers=headers, **kw)


def raw_head(bk, key, headers=None, query=None, **kw):
    return raw_req(bk, "HEAD", key, query=query, headers=headers, **kw)


def raw_list(bk, **params):
    """GET /bucket?list-type=2&... (V2) unless list-type is given explicitly (None removes it => V1)."""
    q = {"list-type": "2"}
    q.update(params)
    q = {k: v for k, v in q.items() if v is not None}
    return raw_req(bk, "GET", None, query=q)


def etag_of(resp):
    return resp.header("etag")


# ---- bulk helpers -------------------------------------------------------------------------

def put_many(bk, keys, body=b"x", workers=16, **kw):
    """PUT every key concurrently with the bucket's boto3 client; re-raises the first failure."""
    s3 = bk.s3

    def one(k):
        b = body(k) if callable(body) else body
        s3.put_object(Bucket=bk.name, Key=k, Body=b, **kw)

    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        list(ex.map(one, keys))


def list_all_keys(bk, **kw):
    return bk.keys(**kw)


def list_pages(bk, op="list_objects_v2", **kw):
    """All raw boto3 pages of a listing, following continuation manually (so tests see every page)."""
    s3 = bk.s3
    pages = []
    token = {}
    while True:
        if op == "list_objects_v2":
            r = s3.list_objects_v2(Bucket=bk.name, **kw, **token)
            pages.append(r)
            if not r["IsTruncated"]:
                return pages
            token = {"ContinuationToken": r["NextContinuationToken"]}
        else:
            r = s3.list_objects(Bucket=bk.name, **kw, **token)
            pages.append(r)
            if not r["IsTruncated"]:
                return pages
            nm = r.get("NextMarker") or r["Contents"][-1]["Key"]
            token = {"Marker": nm}
        if len(pages) > 5000:
            raise AssertionError("listing does not terminate")


def utf8_sorted(keys):
    return sorted(keys, key=lambda k: k.encode("utf-8"))


def unq(s):
    """Decode an encoding-type=url value the way S3 SDKs do (form decoding: '+' is a space)."""
    return urllib.parse.unquote_plus(s)


def oddkeys():
    """[(id, key)] of support/oddkeys.json with the 'gen' entries expanded."""
    import json
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    doc = json.load(open(os.path.join(here, "..", "..", "support", "oddkeys.json"), encoding="utf-8"))
    out = []
    for e in doc["keys"]:
        k = e.get("key")
        if k is None:
            g = e["gen"]
            k = g["char"] * g["count"]
        out.append((e["id"], k))
    return out


def too_long_key():
    import json
    import os
    here = os.path.dirname(os.path.abspath(__file__))
    doc = json.load(open(os.path.join(here, "..", "..", "support", "oddkeys.json"), encoding="utf-8"))
    g = doc["too_long"]
    return g["char"] * g["count"]
