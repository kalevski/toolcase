"""SigV4 verification details, driven with a hand-rolled signer (spec 4.5, 5.8, 2.4).

botocore only ever produces well-formed requests; these tests produce the odd-but-legal ones other
clients send (sub-delims unescaped on the wire, over-encoded paths, Date instead of x-amz-date,
any region, ...) and the illegal ones that must be refused with the right S3 error.
"""
import datetime
import hashlib
import urllib.parse

import pytest

import bvh
import bvx_c as X
from bvh import s3error, s3quote

EMPTY = hashlib.sha256(b"").hexdigest()


def p(bk, key=""):
    """Request path for a key, percent-encoded the AWS way."""
    return "/%s/%s" % (bk.name, s3quote(key)) if key else "/%s" % bk.name


# --------------------------------------------------------------------------------------------
# baseline

def test_baseline_signed_get(bk):
    bk.put("base.txt", b"hello")
    r = X.sreq(bk, "GET", p(bk, "base.txt"))
    assert r.status == 200 and r.body == b"hello", r


def test_baseline_signed_head(bk):
    bk.put("base.txt", b"hello")
    r = X.sreq(bk, "HEAD", p(bk, "base.txt"))
    assert r.status == 200 and r.header("content-length") == "5" and r.body == b""


def test_baseline_signed_put_with_body_hash(bk):
    r = X.sreq(bk, "PUT", p(bk, "put.txt"), body=b"payload", headers={"Content-Type": "text/plain"})
    assert r.status == 200, r
    assert bk.read("put.txt") == b"payload"
    assert bk.head("put.txt")["ContentType"] == "text/plain"


def test_signed_service_root_lists_the_token_bucket(bk):
    r = X.sreq(bk, "GET", "/")
    assert r.status == 200, r
    names = [e.text for e in r.xml().iter("Name")]
    assert names == [bk.name], names


def test_put_with_unsigned_payload(bk):
    body = b"u" * 1000
    r = X.sreq(bk, "PUT", p(bk, "u.bin"), body=body, payload_hash="UNSIGNED-PAYLOAD")
    assert r.status == 200, r
    assert bk.read("u.bin") == body


def test_put_payload_hash_mismatch_is_refused_and_stores_nothing(bk):
    wrong = hashlib.sha256(b"abd").hexdigest()
    r = X.sreq(bk, "PUT", p(bk, "m.bin"), body=b"abc", payload_hash=wrong)
    X.check_error(r, 400, "XAmzContentSHA256Mismatch")
    with s3error("NoSuchKey", 404):
        bk.get("m.bin")


def test_uppercase_hex_payload_hash_is_accepted_or_cleanly_refused(bk):
    # x-amz-content-sha256 is hex; S3 compares it case-sensitively against lower-case hex. Either
    # outcome is acceptable, a 5xx or a stored-but-mismatching object is not.
    body = b"case"
    r = X.sreq(bk, "PUT", p(bk, "up.bin"), body=body, payload_hash=hashlib.sha256(body).hexdigest().upper())
    assert r.status in (200, 400, 403), r
    if r.status == 200:
        assert bk.read("up.bin") == body


# --------------------------------------------------------------------------------------------
# credential scope

@pytest.mark.parametrize("region", ["us-east-1", "eu-west-3", "auto", "ap-southeast-2", "local", "x", "us-gov-west-1", "cn-north-1", "r" * 64])
def test_any_region_in_the_scope_is_accepted(bk, region):
    bk.put("r.txt", b"r")
    r = X.sreq(bk, "GET", p(bk, "r.txt"), region=region)
    assert r.status == 200 and r.body == b"r", "region %r: %r" % (region, r)


@pytest.mark.parametrize("service", ["ec2", "s3-fips", "S3", "execute-api", "s3express", ""])
def test_wrong_service_in_the_scope_is_malformed(bk, service):
    r = X.sreq(bk, "GET", p(bk, "x"), service=service)
    X.check_error(r, 400, "AuthorizationHeaderMalformed")


def test_wrong_terminator_in_the_scope_is_malformed(bk):
    hdr, _ = X.authorization(bk.ak, bk.sk, "GET", p(bk, "x"), "", {"host": bvh.HOSTPORT, "x-amz-date": X.amzdate(), "x-amz-content-sha256": EMPTY},
                             ["host", "x-amz-content-sha256", "x-amz-date"], EMPTY, X.amzdate())
    r = X.sreq(bk, "GET", p(bk, "x"), auth_header=hdr.replace("aws4_request", "aws5_request"))
    X.check_error(r, 400, "AuthorizationHeaderMalformed")


def test_scope_date_must_match_the_request_date(bk):
    r = X.sreq(bk, "GET", p(bk, "x"), scope_date="20200101")
    X.check_error(r, 400, "AuthorizationHeaderMalformed")


@pytest.mark.parametrize("bad_scope", ["20261", "2026-10-02", "abcdefgh", "20261340"])
def test_garbage_scope_date_is_malformed(bk, bad_scope):
    r = X.sreq(bk, "GET", p(bk, "x"), scope_date=bad_scope)
    X.check_error(r, 400, "AuthorizationHeaderMalformed")


def test_region_in_the_scope_is_part_of_the_signature(bk):
    # sign for eu-west-1, claim us-west-2: the server derives the key for the claimed region
    adate = X.amzdate()
    hs = {"host": bvh.HOSTPORT, "x-amz-date": adate, "x-amz-content-sha256": EMPTY}
    hdr, _ = X.authorization(bk.ak, bk.sk, "GET", p(bk, "x"), "", hs, ["host", "x-amz-content-sha256", "x-amz-date"], EMPTY, adate, region="eu-west-1")
    r = X.sreq(bk, "GET", p(bk, "x"), auth_header=hdr.replace("/eu-west-1/", "/us-west-2/"), adate=adate)
    X.check_error(r, 403, "SignatureDoesNotMatch")


def test_signing_key_cache_does_not_mix_up_regions_or_secrets(bk):
    bk.put("c.txt", b"c")
    for region in ["us-east-1", "eu-west-1", "us-east-1", "eu-west-1", "ap-south-1"]:
        r = X.sreq(bk, "GET", p(bk, "c.txt"), region=region)
        assert r.status == 200, (region, r)
    # the cache is warm for the right secret; a wrong secret must still fail
    r = X.sreq(bk, "GET", p(bk, "c.txt"), sk="w" * 40)
    X.check_error(r, 403, "SignatureDoesNotMatch")
    r = X.sreq(bk, "GET", p(bk, "c.txt"))
    assert r.status == 200, r
    # same date and region, two different tokens
    other = bk.token_info([{"actions": bvh.FULL}])
    r1 = X.sreq((other["access_key_id"], other["secret_access_key"]), "GET", p(bk, "c.txt"))
    assert r1.status == 200, r1
    r2 = X.sreq((other["access_key_id"], bk.sk), "GET", p(bk, "c.txt"))
    X.check_error(r2, 403, "SignatureDoesNotMatch")


def test_signing_key_cache_with_presigned_urls_over_several_days(bk):
    bk.put("c.txt", b"c")
    raw = bk.raw()
    for days in (0, 1, 2, 1, 0, 3):
        dt = X.ago(days=days, minutes=1) if days else X.ago(minutes=1)
        url = raw.presign("GET", p(bk, "c.txt"), expires=604800, amzdate=X.amzdate(dt))
        r = X.fetch(url)
        assert r.status == 200, (days, r)


# --------------------------------------------------------------------------------------------
# time

@pytest.mark.parametrize("delta", [dict(hours=-1), dict(hours=1), dict(days=-2), dict(minutes=-30), dict(minutes=30)])
def test_request_time_outside_the_skew_window(bk, delta):
    dt = X.now() + datetime.timedelta(**delta)
    r = X.sreq(bk, "GET", p(bk, "s.txt"), adate=X.amzdate(dt))
    X.check_error(r, 403, "RequestTimeTooSkewed")


@pytest.mark.parametrize("delta", [dict(minutes=-10), dict(minutes=10), dict(minutes=-1)])
def test_request_time_inside_the_skew_window(bk, delta):
    bk.put("s.txt", b"s")
    dt = X.now() + datetime.timedelta(**delta)
    r = X.sreq(bk, "GET", p(bk, "s.txt"), adate=X.amzdate(dt))
    assert r.status == 200, (delta, r)


def test_date_header_is_accepted_instead_of_x_amz_date(bk):
    bk.put("d.txt", b"d")
    dt = X.now().replace(microsecond=0)
    r = X.sreq(bk, "GET", p(bk, "d.txt"), adate=X.amzdate(dt), date_header=X.http_date(dt),
               signed=["date", "host", "x-amz-content-sha256"])
    assert r.status == 200 and r.body == b"d", r


def test_date_header_must_be_signed_when_it_is_the_time_source(bk):
    dt = X.now().replace(microsecond=0)
    r = X.sreq(bk, "GET", p(bk, "d.txt"), adate=X.amzdate(dt), date_header=X.http_date(dt),
               signed=["host", "x-amz-content-sha256"])
    assert r.status in (400, 403), r
    assert r.code in ("AuthorizationHeaderMalformed", "AccessDenied", "SignatureDoesNotMatch"), r


def test_request_without_any_date_is_refused(bk):
    r = X.sreq(bk, "GET", p(bk, "d.txt"), drop=["x-amz-date"], signed=["host", "x-amz-content-sha256"])
    assert r.status in (400, 403), r
    assert r.code in ("AccessDenied", "AuthorizationHeaderMalformed", "MissingSecurityHeader", "InvalidRequest"), r


def test_malformed_x_amz_date_is_refused(bk):
    r = X.sreq(bk, "GET", p(bk, "d.txt"), headers={"x-amz-date": "2026-10-02T10:00:00Z"})
    assert r.status in (400, 403), r
    assert r.code in ("AccessDenied", "AuthorizationHeaderMalformed", "RequestTimeTooSkewed", "SignatureDoesNotMatch"), r


# --------------------------------------------------------------------------------------------
# what must be signed

def test_host_must_be_signed(bk):
    r = X.sreq(bk, "GET", p(bk, "x"), signed=["x-amz-content-sha256", "x-amz-date"])
    assert r.status in (400, 403), "an unsigned host header must be refused: %r" % r
    assert r.code in ("AuthorizationHeaderMalformed", "AccessDenied", "SignatureDoesNotMatch"), r


def test_x_amz_date_must_be_signed(bk):
    r = X.sreq(bk, "GET", p(bk, "x"), signed=["host", "x-amz-content-sha256"])
    assert r.status in (400, 403), "an unsigned x-amz-date must be refused: %r" % r
    assert r.code in ("AuthorizationHeaderMalformed", "AccessDenied", "SignatureDoesNotMatch"), r


def test_unsigned_x_amz_header_on_a_header_signed_request_is_refused(bk):
    # S3: "There were headers present in the request which were not signed" (AccessDenied)
    bk.put("src.txt", b"s")
    r = X.sreq(bk, "PUT", p(bk, "dst.txt"), headers={"x-amz-copy-source": "/%s/src.txt" % bk.name},
               signed=["host", "x-amz-content-sha256", "x-amz-date"])
    assert r.status == 403 and r.code == "AccessDenied", r
    with s3error("NoSuchKey", 404):
        bk.get("dst.txt")


def test_missing_content_sha256_is_refused(bk):
    r = X.sreq(bk, "GET", p(bk, "x"), drop=["x-amz-content-sha256"])
    X.check_error(r, 400, "InvalidRequest")


@pytest.mark.parametrize("val", ["banana", "UNSIGNED", "e3b0c442", "g" * 64, "STREAMING-FOO"])
def test_invalid_content_sha256_value_is_invalid_argument(bk, val):
    r = X.sreq(bk, "GET", p(bk, "x"), payload_hash=val)
    X.check_error(r, 400, "InvalidArgument")


def test_header_values_are_trimmed_and_collapsed_before_signing(bk):
    # SigV4 "Trimall": runs of spaces inside a signed header value count as one space
    r = X.sreq(bk, "PUT", p(bk, "w.txt"), body=b"w", headers={"x-amz-meta-w": "a   b"})
    assert r.status == 200, r
    assert bk.head("w.txt")["Metadata"]["w"].split() == ["a", "b"]


def test_signed_content_type_header(bk):
    r = X.sreq(bk, "PUT", p(bk, "ct.txt"), body=b"c", headers={"Content-Type": "text/x-special"},
               signed=["content-type", "host", "x-amz-content-sha256", "x-amz-date"])
    assert r.status == 200, r
    assert bk.head("ct.txt")["ContentType"] == "text/x-special"


def test_changing_a_signed_header_value_breaks_the_signature(bk):
    hdrs = {"x-amz-meta-a": "one"}
    adate = X.amzdate()
    full = {"host": bvh.HOSTPORT, "x-amz-date": adate, "x-amz-content-sha256": hashlib.sha256(b"q").hexdigest(), "x-amz-meta-a": "one"}
    auth, _ = X.authorization(bk.ak, bk.sk, "PUT", p(bk, "q.txt"), "", full, sorted(full), full["x-amz-content-sha256"], adate)
    r = X.sreq(bk, "PUT", p(bk, "q.txt"), body=b"q", headers={"x-amz-meta-a": "TWO"}, auth_header=auth, adate=adate)
    X.check_error(r, 403, "SignatureDoesNotMatch")


# --------------------------------------------------------------------------------------------
# canonical URI: the same key on the wire in different (legal) spellings

URI_KEYS = [
    ("space", "a b/c d.txt"),
    ("plus", "a+b/c+d+.txt"),
    ("percent", "100%/x%.txt"),
    ("percent-hex", "lit%2Fslash%20x.txt"),
    ("tilde", "a~b.txt"),
    ("unicode", "ключ/日本語/😀.txt"),
    ("bang", "a!b.txt"),
    ("star", "a*b.txt"),
    ("squote", "a'b.txt"),
    ("parens", "a(b)c.txt"),
    ("dollar-amp", "a$b&c.txt"),
    ("comma-colon", "a,b:c.txt"),
    ("semi-eq", "a;b=c.txt"),
    ("at", "a@b.txt"),
    ("brackets", "a[b]c.txt"),
    ("braces", "a{b}c.txt"),
    ("pipe-caret", "a|b^c.txt"),
    ("backtick", "a`b.txt"),
    ("angle-quote", 'a<b>c"d.txt'),
    ("backslash", "a\\b.txt"),
    ("hash-qmark", "a#b?c.txt"),
    ("double-slash", "a//b///c.txt"),
    ("leading-slash", "/lead/x.txt"),
    ("dot-segment", "dir/./x.txt"),
    ("dotdot-segment", "dir/../x.txt"),
    ("trailing-slash", "folder/"),
]

# what Go's net/http leaves unescaped in a path: it is what Go/JS SDKs may put on the wire while they
# sign the fully-encoded form
GO_SAFE = "/!*'()$&,:;=@+"


def wire_aws(key):
    return s3quote(key)


def wire_go(key):
    return urllib.parse.quote(key, safe=GO_SAFE)


def wire_over(key):
    out = []
    for ch in key:
        if ch == "/":
            out.append("/")
        else:
            out.extend("%%%02X" % b for b in ch.encode("utf-8"))
    return "".join(out)


VARIANTS = {"aws-encoded": wire_aws, "go-style-unescaped-subdelims": wire_go, "over-encoded": wire_over}


@pytest.mark.parametrize("variant", sorted(VARIANTS))
@pytest.mark.parametrize("name,key", URI_KEYS, ids=[k[0] for k in URI_KEYS])
def test_canonical_uri_wire_spellings(bk, name, key, variant):
    """The canonical URI is the decoded path encoded once the AWS way, whatever spelling the client put
    on the wire (spec 4.5). PUT and GET with the same wire spelling must verify and address one key."""
    wire = "/%s/%s" % (bk.name, VARIANTS[variant](key))
    body = ("body-" + name).encode()
    r = X.sreq(bk, "PUT", wire, body=body)
    assert r.status == 200, "PUT %s failed: %r" % (wire, r)
    r = X.sreq(bk, "GET", wire)
    assert r.status == 200 and r.body == body, "GET %s failed: %r" % (wire, r)
    # boto3 (AWS-style wire form) must see the very same key
    assert bk.read(key) == body, "the key stored via %s is not the key boto3 addresses" % wire
    assert key in bk.keys()


def test_encoded_slash_is_the_same_key_as_a_slash(bk):
    bk.put("a/b/c.txt", b"slashes")
    r = X.sreq(bk, "GET", "/%s/a%%2Fb%%2Fc.txt" % bk.name)
    assert r.status == 200 and r.body == b"slashes", r


def test_bucket_segment_may_be_percent_encoded(bk):
    bk.put("e.txt", b"e")
    enc = "".join("%%%02X" % ord(c) for c in bk.name)
    r = X.sreq(bk, "GET", "/%s/e.txt" % enc)
    assert r.status in (200, 403, 404), r   # S3 would decode; just no 5xx / no crash
    assert r.status < 500


def test_invalid_percent_escape_in_the_path_is_invalid_uri(bk):
    r = bvh.http_raw("GET", bvh.HOSTPORT, "/%s/a%%zzb" % bk.name)
    assert r.status == 400 and r.code == "InvalidURI", r


def test_invalid_percent_escape_in_the_query_is_a_client_error(bk):
    r = bvh.http_raw("GET", bvh.HOSTPORT, "/%s?list-type=2&prefix=%%zz" % bk.name)
    assert 400 <= r.status < 500, r


# --------------------------------------------------------------------------------------------
# canonical query

def test_query_parameter_order_does_not_matter(bk):
    bk.put("q/a.txt", b"1")
    bk.put("q/b.txt", b"2")
    bk.put("z.txt", b"3")
    r = X.sreq(bk, "GET", "/" + bk.name, query="prefix=q%2F&list-type=2&delimiter=%2F&max-keys=10")
    assert r.status == 200, r
    keys = [e.text for e in r.xml().iter("Key")]
    assert keys == ["q/a.txt", "q/b.txt"], keys


@pytest.mark.parametrize("sub", ["location", "versioning", "acl", "uploads", "cors", "lifecycle", "encryption", "logging", "requestPayment"])
def test_valueless_subresource_is_signed_as_an_empty_value(bk, sub):
    r = X.sreq(bk, "GET", "/" + bk.name, query=sub)
    assert r.code != "SignatureDoesNotMatch", "the canonical query must render '?%s' as '%s=': %r" % (sub, sub, r)
    assert r.status < 500, r


def test_valueless_object_subresource(bk):
    bk.put("t.txt", b"t")
    for sub in ("tagging", "acl", "attributes"):
        hdrs = {"x-amz-object-attributes": "ETag"} if sub == "attributes" else {}
        r = X.sreq(bk, "GET", p(bk, "t.txt"), query=sub, headers=hdrs)
        assert r.status == 200, (sub, r)


def test_plus_in_a_query_value_is_a_space_and_percent_2b_is_a_plus(bk):
    bk.put("a b/x.txt", b"x")
    bk.put("a+b/y.txt", b"y")

    def keys(q):
        r = X.sreq(bk, "GET", "/" + bk.name, query=q)
        assert r.status == 200, (q, r)
        return [e.text for e in r.xml().iter("Key")]

    assert keys("list-type=2&prefix=a+b%2F") == ["a b/x.txt"]
    assert keys("list-type=2&prefix=a%20b%2F") == ["a b/x.txt"]
    assert keys("list-type=2&prefix=a%2Bb%2F") == ["a+b/y.txt"]


def test_empty_query_values_and_stray_ampersands(bk):
    bk.put("e.txt", b"e")
    r = X.sreq(bk, "GET", "/" + bk.name, query="list-type=2&&prefix=&delimiter=")
    assert r.status == 200, r
    assert b"<Key>e.txt</Key>" in r.body


# --------------------------------------------------------------------------------------------
# the Authorization header itself

def _good_header(bk, key="x"):
    adate = X.amzdate()
    hs = {"host": bvh.HOSTPORT, "x-amz-date": adate, "x-amz-content-sha256": EMPTY}
    hdr, _ = X.authorization(bk.ak, bk.sk, "GET", p(bk, key), "", hs, ["host", "x-amz-content-sha256", "x-amz-date"], EMPTY, adate)
    return hdr, adate


def test_authorization_header_without_spaces_after_commas_is_accepted(bk):
    bk.put("x", b"x")
    hdr, adate = _good_header(bk)
    r = X.sreq(bk, "GET", p(bk, "x"), auth_header=hdr.replace(", ", ","), adate=adate)
    assert r.status == 200, r


def test_authorization_header_with_extra_spaces_is_accepted(bk):
    bk.put("x", b"x")
    hdr, adate = _good_header(bk)
    r = X.sreq(bk, "GET", p(bk, "x"), auth_header=hdr.replace("AWS4-HMAC-SHA256 ", "AWS4-HMAC-SHA256   ").replace(", ", " ,  "), adate=adate)
    assert r.status in (200, 400), r        # S3 accepts it; a strict parser may refuse, but cleanly
    if r.status == 400:
        assert r.code == "AuthorizationHeaderMalformed", r


@pytest.mark.parametrize("what", ["no-signature", "no-signedheaders", "no-credential", "scheme-only", "garbage-after-scheme",
                                  "short-credential", "credential-6-parts", "empty-credential", "empty-signature",
                                  "unknown-component", "repeated-component"])
def test_malformed_authorization_header(bk, what):
    hdr, adate = _good_header(bk)
    cred = hdr.split("Credential=")[1].split(",")[0]
    sh = hdr.split("SignedHeaders=")[1].split(",")[0]
    sig = hdr.split("Signature=")[1]
    variants = {
        "no-signature": "AWS4-HMAC-SHA256 Credential=%s, SignedHeaders=%s" % (cred, sh),
        "no-signedheaders": "AWS4-HMAC-SHA256 Credential=%s, Signature=%s" % (cred, sig),
        "no-credential": "AWS4-HMAC-SHA256 SignedHeaders=%s, Signature=%s" % (sh, sig),
        "scheme-only": "AWS4-HMAC-SHA256",
        "garbage-after-scheme": "AWS4-HMAC-SHA256 foo",
        "short-credential": "AWS4-HMAC-SHA256 Credential=%s/20260101/us-east-1, SignedHeaders=%s, Signature=%s" % (bk.ak, sh, sig),
        "credential-6-parts": "AWS4-HMAC-SHA256 Credential=%s/x, SignedHeaders=%s, Signature=%s" % (cred, sh, sig),
        "empty-credential": "AWS4-HMAC-SHA256 Credential=, SignedHeaders=%s, Signature=%s" % (sh, sig),
        "empty-signature": "AWS4-HMAC-SHA256 Credential=%s, SignedHeaders=%s, Signature=" % (cred, sh),
        "unknown-component": "AWS4-HMAC-SHA256 Credential=%s, SignedHeaders=%s, Signature=%s, Foo=bar" % (cred, sh, sig),
        "repeated-component": "AWS4-HMAC-SHA256 Credential=%s, Credential=%s, SignedHeaders=%s, Signature=%s" % (cred, cred, sh, sig),
    }
    r = X.sreq(bk, "GET", p(bk, "x"), auth_header=variants[what], adate=adate)
    X.check_error(r, 400, "AuthorizationHeaderMalformed")


def test_two_authorization_headers_are_refused(bk):
    hdr, adate = _good_header(bk)
    req = ("GET %s HTTP/1.1\r\nHost: %s\r\nx-amz-date: %s\r\nx-amz-content-sha256: %s\r\nAuthorization: %s\r\nAuthorization: %s\r\n\r\n"
           % (p(bk, "x"), bvh.HOSTPORT, adate, EMPTY, hdr, hdr)).encode()
    r = X.parse_http_response(X.sock_exchange(bvh.HOSTPORT, req))
    assert 400 <= r.status < 500, r


@pytest.mark.parametrize("hdr", [
    "AWS AKIAIOSFODNN7EXAMPLE:frJIUN8DYpKDtOLCwo//yllqDzg=",        # Signature V2
    "Basic dXNlcjpwYXNzd29yZA==",                                      # HTTP Basic
    "Digest username=x",
    "AWS4-HMAC-SHA512 Credential=a/b/c/s3/aws4_request, SignedHeaders=host, Signature=00",
    "Negotiate abc",
    "Token abc",
])
def test_unsupported_authentication_schemes_are_refused(bk, hdr):
    bk.put("x", b"x")
    r = bvh.http_raw("GET", bvh.HOSTPORT, p(bk, "x"), headers={"Authorization": hdr})
    assert 400 <= r.status < 500, "an unsupported scheme must be refused with a client error: %r" % r
    assert r.code, "expected an S3 error body: %r" % r
    assert r.code != "NoSuchKey"


def test_unsigned_request_to_a_private_bucket_is_access_denied(bk):
    bk.put("x", b"x")
    r = bvh.http_raw("GET", bvh.HOSTPORT, p(bk, "x"))
    X.check_error(r, 403, "AccessDenied")


@pytest.mark.parametrize("param", ["X-Amz-Signature=abcd", "X-Amz-Algorithm=AWS4-HMAC-SHA256", "X-Amz-Credential=a%2Fb"])
def test_header_auth_plus_v4_query_auth_is_invalid_request(bk, param):
    bk.put("x", b"x")
    r = X.sreq(bk, "GET", p(bk, "x"), query=param)
    X.check_error(r, 400, "InvalidRequest")


def test_header_auth_plus_v2_query_auth_is_invalid_request(bk):
    bk.put("x", b"x")
    r = X.sreq(bk, "GET", p(bk, "x"), query="AWSAccessKeyId=%s&Signature=abc&Expires=99999999999" % bk.ak)
    X.check_error(r, 400, "InvalidRequest")


@pytest.mark.parametrize("hdr", [
    "AWS4-HMAC-SHA256 Credential=" + "a" * 5000 + "/20261002/us-east-1/s3/aws4_request, SignedHeaders=host, Signature=00",
    "AWS4-HMAC-SHA256 Credential=ak/20261002/us-east-1/s3/aws4_request, SignedHeaders=" + ";".join("h%d" % i for i in range(500)) + ", Signature=00",
    "AWS4-HMAC-SHA256 Credential=ak/20261002/" + "r" * 300 + "/s3/aws4_request, SignedHeaders=host, Signature=00",
    "AWS4-HMAC-SHA256 Credential=ak/20261002/us-east-1/s3/aws4_request, SignedHeaders=Host;X-Amz-Date, Signature=00",
    "AWS4-HMAC-SHA256 Credential=ak/20261002/us-east-1/s3/aws4_request, SignedHeaders=host;host, Signature=00",
    "AWS4-HMAC-SHA256 Credential=ak/20261002/us-east-1/s3/aws4_request, SignedHeaders=host;;x-amz-date, Signature=00",
    "AWS4-HMAC-SHA256 Credential=aké/20261002/us-east-1/s3/aws4_request, SignedHeaders=host, Signature=00",
    "AWS4-HMAC-SHA256 Credential=ak/20261002/us-east-1/s3/aws4_request, SignedHeaders=host, Signature=" + "0" * 200,
])
def test_abusive_authorization_headers_never_crash_the_server(bk, hdr):
    try:
        r = bvh.http_raw("GET", bvh.HOSTPORT, p(bk, "x"), headers={"Authorization": hdr, "x-amz-date": X.amzdate(),
                                                                       "x-amz-content-sha256": EMPTY})
    except UnicodeEncodeError:
        pytest.skip("header cannot be sent by http.client")
    assert 400 <= r.status < 500, r
    assert r.code, "expected an S3 error body: %r" % r
    # and the node is still fine afterwards
    assert bvh.http_get(bvh.ENDPOINT + "/_healthz").status == 200
