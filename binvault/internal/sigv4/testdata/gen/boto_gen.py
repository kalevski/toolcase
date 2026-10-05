# Generator of the botocore entries of ../vectors.json.
#   python3 -m venv venv && ./venv/bin/pip install botocore==1.43.107
#   ./venv/bin/python boto_gen.py > boto_vectors.json

import json, datetime, hashlib, base64
from urllib.parse import quote, urlsplit
import botocore, botocore.auth
from botocore.awsrequest import AWSRequest
from botocore.credentials import Credentials

NOW = datetime.datetime(2025, 1, 15, 12, 34, 56)
botocore.auth.get_current_datetime = lambda: NOW
AKID, SECRET = "BVKABCDEFGHIJKLMNOPQ", "q7Zr2Xv9LmT4Wc8Ns1Ke5Yd3Hb6Gf0Ja2Pu7Ro9V"
creds = Credentials(AKID, SECRET)
SRC = "botocore " + botocore.__version__
out = []

def req_uri(url):
    p = urlsplit(url)
    return p.path + (("?" + p.query) if p.query else "")

def header_vec(name, method, url, headers, body, region):
    r = AWSRequest(method=method, url=url, headers=headers, data=body)
    botocore.auth.S3SigV4Auth(creds, "s3", region).add_auth(r)
    hs = [[k, v] for k, v in r.headers.items()]
    if body:
        hs.append(["Content-Length", str(len(body))])
    auth = r.headers["Authorization"]
    out.append(dict(name=name, source=SRC, kind="header", method=method, host=urlsplit(url).netloc,
                    request_uri=req_uri(r.url), headers=hs, access_key_id=AKID, region=region,
                    now=NOW.strftime("%Y-%m-%dT%H:%M:%SZ"), signature=auth.split("Signature=")[1]))

def presign_vec(name, method, url, headers, region, expires):
    r = AWSRequest(method=method, url=url, headers=headers)
    botocore.auth.S3SigV4QueryAuth(creds, "s3", region, expires=expires).add_auth(r)
    q = urlsplit(r.url).query
    sig = [p.split("=", 1)[1] for p in q.split("&") if p.startswith("X-Amz-Signature=")][0]
    out.append(dict(name=name, source=SRC + " (presign)", kind="presigned", method=method, host=urlsplit(url).netloc,
                    request_uri=req_uri(r.url), headers=[[k, v] for k, v in r.headers.items()], access_key_id=AKID,
                    region=region, now=NOW.strftime("%Y-%m-%dT%H:%M:%SZ"), signature=sig))

header_vec("boto-repeated-params-tab-header", "GET",
           "http://localhost:9000/bucket?a=2&a=1&b=&c=x%2By&list-type=2",
           {"X-Amz-Meta-Tabbed": "a\t\tb  c", "x-amz-request-payer": "requester"}, None, "us-east-1")

key = "docs/report (final).pdf"
body = b"hello world"
header_vec("boto-put-signed-payload-headers", "PUT",
           "http://localhost:9000/bucket/" + quote(key, safe="/~"),
           {"Content-Type": "application/pdf",
            "Content-MD5": base64.b64encode(hashlib.md5(body).digest()).decode(),
            "x-amz-storage-class": "STANDARD", "x-amz-tagging": "a=b&c=d",
            "x-amz-meta-author": "Ana  Smith"}, body, "us-east-1")

presign_vec("boto-presign-unicode-week", "GET",
            "https://s3.example.com:8443/bucket/" + quote("日本/😀 x.txt", safe="/~") +
            "?versionId=abc&response-content-type=text%2Fplain", {}, "auto", 604800)

presign_vec("boto-presign-delete-1s", "DELETE",
            "http://localhost:9000/bucket/tmp/x", {}, "us-east-1", 1)

# POST policy (S3SigV4PostAuth)
policy = {"expiration": "2025-01-16T12:34:56Z",
          "conditions": [{"bucket": "uploads"}, ["starts-with", "$key", "user/42/"],
                         ["content-length-range", 1, 10485760]]}
r = AWSRequest(method="POST", url="https://s3.example.com/uploads")
r.context["s3-presign-post-fields"] = {"key": "user/42/${filename}"}
r.context["s3-presign-post-policy"] = policy
botocore.auth.S3SigV4PostAuth(creds, "s3", "eu-west-3").add_auth(r)
f = r.context["s3-presign-post-fields"]
out.append(dict(name="boto-post-policy", source=SRC + " (S3SigV4PostAuth)", kind="post", access_key_id=AKID,
                region="eu-west-3", now=NOW.strftime("%Y-%m-%dT%H:%M:%SZ"), policy=f["policy"],
                credential=f["x-amz-credential"], amz_date=f["x-amz-date"], signature=f["x-amz-signature"],
                policy_json=base64.b64decode(f["policy"]).decode()))

print(json.dumps(out, indent=2, ensure_ascii=False))
