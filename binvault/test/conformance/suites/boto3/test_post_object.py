"""POST Object: browser uploads with a signed policy (spec 5.4.9, 4.5, 5.10)."""
import base64
import datetime
import hashlib
import hmac
import json
import urllib.parse
import uuid

import pytest

import bvh
import bvx_b as X
from bvh import ADMIN, KiB, MiB, md5hex, rnd, s3error, signing_key, uniq
from bvx_a import raw_get, raw_head, vhost

UTC = datetime.timezone.utc
CT_PNG = "image/png"


def iso(dt):
    return dt.strftime("%Y-%m-%dT%H:%M:%S.000Z")


class Creds:
    def __init__(self, ak, sk):
        self.ak, self.sk = ak, sk


def creds_of(bk):
    return Creds(bk.ak, bk.sk)


def sign_policy(policy_b64, sk, datestamp, region=bvh.REGION, service="s3"):
    return hmac.new(signing_key(sk, datestamp, region, service), policy_b64.encode(), hashlib.sha256).hexdigest()


def build(bk, key, *, creds=None, conditions=None, extra_conditions=(), fields=None, expires_in=600, now=None, region=bvh.REGION,
          policy=None, signature=None, omit=(), cover=True, bucket_cond=True, service="s3"):
    """Return the list of form fields (without 'file') for a correct, signed POST of `key` into bk.

    conditions overrides the generated condition list; extra_conditions are appended; fields are the optional extra form
    fields (name -> value or list of values); cover=True adds an eq condition for each extra field; omit removes named
    fields from the result (after signing)."""
    creds = creds or creds_of(bk)
    now = now or datetime.datetime.now(UTC)
    ds = now.strftime("%Y%m%d")
    amzdate = now.strftime("%Y%m%dT%H%M%SZ")
    cred = "%s/%s/%s/%s/aws4_request" % (creds.ak, ds, region, service)
    fields = dict(fields or {})
    std = {"algorithm": "AWS4-HMAC-SHA256", "credential": cred, "date": amzdate}
    if callable(conditions):
        conditions = conditions(std)
    elif conditions is None:
        conditions = []
        if bucket_cond:
            conditions.append({"bucket": bk.name})
        conditions += [{"key": key}, {"x-amz-algorithm": "AWS4-HMAC-SHA256"}, {"x-amz-credential": cred}, {"x-amz-date": amzdate}]
        if cover:
            for k, v in fields.items():
                for one in (v if isinstance(v, list) else [v]):
                    conditions.append({k: one})
        conditions += list(extra_conditions)
    pol = policy if policy is not None else {"expiration": iso(now + datetime.timedelta(seconds=expires_in)), "conditions": conditions}
    pol_b64 = base64.b64encode(json.dumps(pol).encode()).decode() if not isinstance(pol, (bytes, str)) else base64.b64encode(pol if isinstance(pol, bytes) else pol.encode()).decode()
    sig = signature or sign_policy(pol_b64, creds.sk, ds, region, service)
    out = [("key", key), ("policy", pol_b64), ("x-amz-algorithm", "AWS4-HMAC-SHA256"), ("x-amz-credential", cred),
           ("x-amz-date", amzdate), ("x-amz-signature", sig)]
    for k, v in fields.items():
        for one in (v if isinstance(v, list) else [v]):
            out.append((k, one))
    return [(k, v) for k, v in out if k not in omit]


def std_conds(std):
    """The three conditions every signed form field needs."""
    return [{"x-amz-algorithm": std["algorithm"]}, {"x-amz-credential": std["credential"]}, {"x-amz-date": std["date"]}]


def encode(fields, file=("upload.bin", b"", None), boundary=None, file_first=False, file_field="file"):
    b = boundary or "----bvtboundary" + uuid.uuid4().hex
    parts = []
    for name, value in fields:
        parts.append(b'--' + b.encode() + b'\r\nContent-Disposition: form-data; name="' + name.encode() + b'"\r\n\r\n' + str(value).encode() + b"\r\n")
    filepart = None
    if file is not None:
        fn, content, ctype = file
        head = b'--' + b.encode() + b'\r\nContent-Disposition: form-data; name="' + file_field.encode() + b'"; filename="' + fn.encode() + b'"\r\n'
        if ctype:
            head += b"Content-Type: " + ctype.encode() + b"\r\n"
        filepart = head + b"\r\n" + content + b"\r\n"
    if filepart and file_first:
        parts.insert(0, filepart)
    elif filepart:
        parts.append(filepart)
    parts.append(b"--" + b.encode() + b"--\r\n")
    return b"".join(parts), "multipart/form-data; boundary=" + b


def post(bk, fields, file=("upload.bin", b"hello post", None), *, path=None, host=None, headers=None, file_first=False, boundary=None, timeout=60):
    body, ctype = encode(fields, file, boundary, file_first)
    h = {"Content-Type": ctype}
    h.update(headers or {})
    if host:
        h["Host"] = host
    return bvh.http_raw("POST", bvh.HOSTPORT, path or "/" + bk.name, headers=h, body=body, timeout=timeout)


@pytest.fixture(scope="module")
def pb():
    return bvh.fresh_bucket("post")


# --------------------------------------------------------------------------------------------
# success responses

def test_basic_post_answers_204_and_stores_the_object(pb):
    r = post(pb, build(pb, "basic/one.txt"), ("one.txt", b"hello post", "text/plain"))
    assert r.status == 204 and r.body == b"", r
    assert r.header("etag") == '"%s"' % md5hex(b"hello post")
    assert pb.read("basic/one.txt") == b"hello post"
    assert r.header("x-amz-request-id")


@pytest.mark.parametrize("status,expect", [("200", 200), ("201", 201), ("204", 204), ("202", 204), ("abc", 204), ("", 204)])
def test_success_action_status(pb, status, expect):
    key = uniq("sas")
    r = post(pb, build(pb, key, fields={"success_action_status": status}))
    assert r.status == expect, r
    if expect != 201:
        assert r.body == b""
    assert pb.read(key) == b"hello post"


def test_201_returns_a_post_response_document(pb):
    key = "doc/with space.txt"
    r = post(pb, build(pb, key, fields={"success_action_status": "201"}), ("x", b"payload", None))
    assert r.status == 201, r
    x = r.xml()
    assert x.tag == "PostResponse"
    assert x.findtext("Bucket") == pb.name and x.findtext("Key") == key
    assert x.findtext("ETag") == '"%s"' % md5hex(b"payload")
    assert x.findtext("Location")
    assert r.header("content-type", "").startswith("application/xml")


def test_success_action_redirect_is_a_303_with_bucket_key_and_etag(pb):
    key = uniq("redir")
    target = "https://app.example.com/done?x=1"
    r = post(pb, build(pb, key, fields={"success_action_redirect": target}), ("x", b"redirect me", None))
    assert r.status == 303, r
    loc = urllib.parse.urlparse(r.header("location"))
    q = urllib.parse.parse_qs(loc.query)
    assert loc.scheme == "https" and loc.netloc == "app.example.com" and loc.path == "/done"
    assert q["x"] == ["1"] and q["bucket"] == [pb.name] and q["key"] == [key]
    assert q["etag"][0].strip('"') == md5hex(b"redirect me"), q
    assert pb.read(key) == b"redirect me"


def test_filename_placeholder_in_the_key(pb):
    prefix = uniq("fn") + "/"
    fields = build(pb, prefix + "${filename}", conditions=lambda std: [{"bucket": pb.name}, ["starts-with", "$key", prefix]] + std_conds(std))
    r = post(pb, fields, ("my file \u00e9.txt", b"named", None))
    assert r.status == 204, r
    assert pb.read(prefix + "my file \u00e9.txt") == b"named"


def test_post_replaces_an_existing_object(pb):
    key = uniq("over")
    pb.put(key, b"old")
    assert post(pb, build(pb, key), ("x", b"new content", None)).status == 204
    assert pb.read(key) == b"new content"


def test_empty_file(pb):
    key = uniq("empty")
    assert post(pb, build(pb, key), ("x", b"", None)).status == 204
    assert pb.head(key)["ContentLength"] == 0


def test_a_large_file_streams(pb):
    key = uniq("big")
    data = rnd(9 * MiB + 3)
    r = post(pb, build(pb, key), ("big.bin", data, "application/octet-stream"))
    assert r.status == 204 and r.header("etag") == '"%s"' % md5hex(data), r
    assert pb.read(key) == data


def test_post_to_a_versioned_bucket_returns_a_version_id():
    vb = bvh.fresh_bucket("postv", versioning="enabled")
    r1 = post(vb, build(vb, "k"), ("x", b"one", None))
    r2 = post(vb, build(vb, "k"), ("x", b"two!", None))
    v1, v2 = r1.header("x-amz-version-id"), r2.header("x-amz-version-id")
    assert v1 and v2 and v1 != v2
    assert vb.read("k") == b"two!"
    assert vb.s3.get_object(Bucket=vb.name, Key="k", VersionId=v1)["Body"].read() == b"one"


def test_virtual_hosted_style_post(pb):
    key = uniq("vh")
    r = post(pb, build(pb, key), ("x", b"vhost", None), path="/", host=vhost(pb))
    assert r.status == 204, r
    assert pb.read(key) == b"vhost"


def test_boto3_generate_presigned_post_works(pb):
    key = uniq("b3") + "/${filename}"
    p = pb.s3.generate_presigned_post(pb.name, key, Fields={"Content-Type": "text/plain", "x-amz-meta-origin": "boto3"},
                                      Conditions=[["starts-with", "$key", "b3"], {"Content-Type": "text/plain"}, {"x-amz-meta-origin": "boto3"},
                                                  ["content-length-range", 1, 100000]], ExpiresIn=300)
    fields = list(p["fields"].items())
    r = post(pb, fields, ("hello.txt", b"from boto3", "text/plain"), path="/" + pb.name)
    assert r.status == 204, r
    stored = [k for k in pb.keys() if k.endswith("/hello.txt") or k.endswith("hello.txt")]
    assert len(stored) == 1, pb.keys()
    h = pb.head(stored[0])
    assert h["ContentType"] == "text/plain" and h["Metadata"] == {"origin": "boto3"}


# --------------------------------------------------------------------------------------------
# what the form can set

def test_form_fields_become_object_headers_and_metadata(pb):
    key = uniq("meta")
    fields = {"Content-Type": "application/x-mine", "Cache-Control": "max-age=77", "Content-Disposition": 'attachment; filename="a.bin"',
              "Content-Encoding": "identity", "Expires": "Wed, 01 Jan 2031 00:00:00 GMT", "x-amz-meta-user": "42", "x-amz-meta-Other": "Mixed",
              "x-amz-storage-class": "REDUCED_REDUNDANCY"}
    r = post(pb, build(pb, key, fields=fields), ("whatever.dat", b"meta", "text/html"))
    assert r.status == 204, r
    h = pb.head(key)
    assert h["ContentType"] == "application/x-mine", "the Content-Type form field wins over the file part's type"
    assert h["CacheControl"] == "max-age=77" and h["ContentDisposition"] == 'attachment; filename="a.bin"' and h["ContentEncoding"] == "identity"
    assert h["Metadata"] == {"user": "42", "other": "Mixed"}
    assert raw_head(pb, key).header("expires") == "Wed, 01 Jan 2031 00:00:00 GMT"


def test_without_a_content_type_field_the_default_applies(pb):
    key = uniq("noct")
    assert post(pb, build(pb, key), ("pic.png", b"abc", "image/png")).status == 204
    assert raw_head(pb, key).header("content-type") == "binary/octet-stream"


def test_tagging_field_is_xml(pb):
    key = uniq("tag")
    xml = "<Tagging><TagSet><Tag><Key>env</Key><Value>prod</Value></Tag><Tag><Key>team</Key><Value>core</Value></Tag></TagSet></Tagging>"
    r = post(pb, build(pb, key, fields={"tagging": xml}))
    assert r.status == 204, r
    assert {t["Key"]: t["Value"] for t in pb.s3.get_object_tagging(Bucket=pb.name, Key=key)["TagSet"]} == {"env": "prod", "team": "core"}


def test_bad_tagging_xml_is_refused(pb):
    key = uniq("tagbad")
    r = post(pb, build(pb, key, fields={"tagging": "<Tagging><TagSet>"}))
    assert r.status == 400, r
    with s3error(None, 404):
        pb.head(key)


def test_server_side_encryption_field(pb):
    key = uniq("sse")
    r = post(pb, build(pb, key, fields={"x-amz-server-side-encryption": "AES256"}))
    assert r.status == 204 and r.header("x-amz-server-side-encryption") == "AES256", r
    assert pb.head(key)["ServerSideEncryption"] == "AES256"
    r = post(pb, build(pb, uniq("kms"), fields={"x-amz-server-side-encryption": "aws:kms"}))
    assert r.status == 501 and r.code == "NotImplemented", r


@pytest.mark.parametrize("acl,expect", [("private", 204), ("bucket-owner-full-control", 204), ("public-read", 400), ("public-read-write", 400)])
def test_acl_field(pb, acl, expect):
    key = uniq("acl")
    r = post(pb, build(pb, key, fields={"acl": acl}))
    assert r.status == expect, r
    if expect == 400:
        assert r.code == "AccessControlListNotSupported", r


def test_storage_class_field_validation(pb):
    r = post(pb, build(pb, uniq("sc"), fields={"x-amz-storage-class": "GLACIER"}))
    assert r.status == 400 and r.code == "InvalidStorageClass", r


def test_checksum_field_is_verified(pb):
    data = b"checksummed form upload"
    good = X.checksum_b64("CRC32", data)
    key = uniq("ck")
    r = post(pb, build(pb, key, fields={"x-amz-checksum-crc32": good}), ("x", data, None))
    assert r.status == 204, r
    assert pb.s3.head_object(Bucket=pb.name, Key=key, ChecksumMode="ENABLED")["ChecksumCRC32"] == good
    key2 = uniq("ckbad")
    r = post(pb, build(pb, key2, fields={"x-amz-checksum-crc32": X.wrong_checksum_b64("CRC32", data)}), ("x", data, None))
    assert r.status == 400 and r.code == "BadDigest", r
    with s3error(None, 404):
        pb.head(key2)


def test_field_names_are_case_insensitive(pb):
    key = uniq("case")
    fields = build(pb, key, fields={"Content-Type": "text/x-case", "x-amz-meta-Mixed": "1"})
    ren = {"key": "KEY", "policy": "Policy", "x-amz-signature": "X-AMZ-SIGNATURE", "x-amz-credential": "X-Amz-Credential",
           "Content-Type": "content-type", "x-amz-meta-Mixed": "X-AMZ-META-MIXED"}
    r = post(pb, [(ren.get(n, n), v) for n, v in fields])
    assert r.status == 204, r
    h = pb.head(key)
    assert h["ContentType"] == "text/x-case" and h["Metadata"] == {"mixed": "1"}


def test_x_ignore_fields_need_no_condition(pb):
    key = uniq("ign")
    r = post(pb, build(pb, key) + [("x-ignore-anything", "whatever")])
    assert r.status == 204, r


# --------------------------------------------------------------------------------------------
# policy conditions

def test_eq_and_starts_with_conditions(pb):
    key = uniq("cond")
    conds = lambda std: [{"bucket": pb.name}, ["eq", "$key", key], ["starts-with", "$x-amz-meta-note", "ok-"], ["eq", "$Content-Type", "text/plain"]] + std_conds(std)
    assert post(pb, build(pb, key, conditions=conds, fields={"x-amz-meta-note": "ok-fine", "Content-Type": "text/plain"})).status == 204
    r = post(pb, build(pb, key, conditions=conds, fields={"x-amz-meta-note": "nope", "Content-Type": "text/plain"}))
    assert r.status == 403 and r.code == "AccessDenied", r
    r = post(pb, build(pb, key, conditions=conds, fields={"x-amz-meta-note": "ok-fine", "Content-Type": "text/html"}))
    assert r.status == 403 and r.code == "AccessDenied", r


def test_starts_with_on_the_key_limits_where_the_form_may_write(pb):
    prefix = uniq("allowed") + "/"
    conds = lambda std: [{"bucket": pb.name}, ["starts-with", "$key", prefix]] + std_conds(std)
    assert post(pb, build(pb, prefix + "inside.txt", conditions=conds)).status == 204
    r = post(pb, build(pb, "outside/" + uniq("o"), conditions=conds))
    assert r.status == 403 and r.code == "AccessDenied", r


def test_starts_with_empty_prefix_allows_any_value(pb):
    key = uniq("anyval")
    conds = lambda std: [{"bucket": pb.name}, {"key": key}, ["starts-with", "$x-amz-meta-free", ""]] + std_conds(std)
    assert post(pb, build(pb, key, conditions=conds, fields={"x-amz-meta-free": "anything at all"})).status == 204


def test_key_condition_mismatch_is_access_denied(pb):
    conds = lambda std: [{"bucket": pb.name}, {"key": "the-only-allowed-key"}] + std_conds(std)
    r = post(pb, build(pb, "some-other-key", conditions=conds))
    assert r.status == 403 and r.code == "AccessDenied", r


def test_bucket_condition_is_checked_against_the_target_bucket(pb):
    conds = lambda std: [{"bucket": "some-other-bucket"}, {"key": "k"}] + std_conds(std)
    r = post(pb, build(pb, "k", conditions=conds))
    assert r.status == 403 and r.code == "AccessDenied", r


def test_a_policy_without_a_bucket_condition_is_fine(pb):
    assert post(pb, build(pb, uniq("nb"), bucket_cond=False)).status == 204


def test_extra_form_fields_must_be_covered_by_a_condition(pb):
    key = uniq("extra")
    r = post(pb, build(pb, key, fields={"x-amz-meta-sneaky": "1"}, cover=False))
    assert r.status == 403 and r.code == "AccessDenied", r
    assert "extra input fields" in r.xml().findtext("Message", "").lower(), r.text
    with s3error(None, 404):
        pb.head(key)


def test_a_field_added_after_signing_is_not_covered(pb):
    key = uniq("late")
    r = post(pb, build(pb, key) + [("x-amz-meta-added", "later")])
    assert r.status == 403 and r.code == "AccessDenied", r


def test_content_length_range_bounds(pb):
    def conds(lo, hi):
        return lambda std: [{"bucket": pb.name}, ["starts-with", "$key", "clr/"], ["content-length-range", lo, hi]] + std_conds(std)

    for size, lo, hi, status, code in ((10, 5, 20, 204, None), (5, 5, 20, 204, None), (20, 5, 20, 204, None), (4, 5, 20, 400, "EntityTooSmall"),
                                       (21, 5, 20, 400, "EntityTooLarge"), (0, 1, 10, 400, "EntityTooSmall")):
        key = "clr/%s-%d-%d-%d" % (uniq("k"), size, lo, hi)
        r = post(pb, build(pb, key, conditions=conds(lo, hi)), ("x", rnd(size), None))
        assert r.status == status, (size, lo, hi, r)
        if code:
            assert r.code == code, (size, lo, hi, r)
            with s3error(None, 404):
                pb.head(key)
        else:
            assert pb.head(key)["ContentLength"] == size


def test_content_length_range_is_enforced_while_streaming(pb):
    conds = lambda std: [{"bucket": pb.name}, ["starts-with", "$key", "clrbig/"], ["content-length-range", 0, 64 * KiB]] + std_conds(std)
    key = "clrbig/" + uniq("k")
    r = post(pb, build(pb, key, conditions=conds), ("big", rnd(200 * KiB), None))
    assert r.status == 400 and r.code == "EntityTooLarge", r
    with s3error(None, 404):
        pb.head(key)


def test_a_body_far_over_the_range_never_gets_stored_and_the_server_stays_healthy(pb):
    """A 12 MiB body against a 1 MiB limit: the server may answer 400 EntityTooLarge or drop the connection when it stops
    reading (the sender then sees a broken pipe); either way nothing is stored."""
    conds = lambda std: [{"bucket": pb.name}, ["starts-with", "$key", "clrfar/"], ["content-length-range", 0, 1 * MiB]] + std_conds(std)
    key = "clrfar/" + uniq("k")
    try:
        r = post(pb, build(pb, key, conditions=conds), ("big", rnd(12 * MiB), None))
        assert r.status == 400 and r.code == "EntityTooLarge", r
    except (BrokenPipeError, ConnectionResetError):
        pass
    with s3error(None, 404):
        pb.head(key)
    assert post(pb, build(pb, uniq("after")), ("x", b"still serving", None)).status == 204


def test_unknown_condition_operator_is_an_invalid_policy(pb):
    conds = lambda std: [{"bucket": pb.name}, {"key": "k"}, ["matches", "$key", "k"]] + std_conds(std)
    r = post(pb, build(pb, "k", conditions=conds))
    assert r.status in (400, 403) and r.code, r
    with s3error(None, 404):
        pb.head("k")


# --------------------------------------------------------------------------------------------
# time, signature and credentials

def test_expired_policy_is_access_denied(pb):
    key = uniq("exp")
    now = datetime.datetime.now(UTC) - datetime.timedelta(hours=1)
    r = post(pb, build(pb, key, now=now, expires_in=60))
    assert r.status == 403 and r.code == "AccessDenied", r
    with s3error(None, 404):
        pb.head(key)


def test_a_policy_signed_long_ago_is_valid_until_its_own_expiry(pb):
    """Spec 4.5: a POST policy is valid from its signing date until its expiry, however long ago that was."""
    now = datetime.datetime.now(UTC) - datetime.timedelta(hours=3)
    assert post(pb, build(pb, uniq("old"), now=now, expires_in=6 * 3600)).status == 204


def test_a_policy_signed_in_the_future_beyond_the_skew_is_refused(pb):
    now = datetime.datetime.now(UTC) + datetime.timedelta(hours=3)
    r = post(pb, build(pb, uniq("fut"), now=now, expires_in=3600))
    assert r.status == 403 and r.code == "RequestTimeTooSkewed", r


def test_policy_expiration_more_than_seven_days_away_is_refused(pb):
    r = post(pb, build(pb, uniq("long"), expires_in=8 * 86400))
    assert r.status in (400, 403) and r.code, r
    assert post(pb, build(pb, uniq("six"), expires_in=6 * 86400)).status == 204


def test_wrong_signature_is_signaturedoesnotmatch(pb):
    key = uniq("sig")
    f = build(pb, key, signature="0" * 64)
    r = post(pb, f)
    assert r.status == 403 and r.code == "SignatureDoesNotMatch", r
    with s3error(None, 404):
        pb.head(key)


def test_wrong_secret_is_signaturedoesnotmatch(pb):
    r = post(pb, build(pb, uniq("sec"), creds=Creds(pb.ak, "x" * 40)))
    assert r.status == 403 and r.code == "SignatureDoesNotMatch", r


def test_unknown_access_key_is_invalidaccesskeyid(pb):
    r = post(pb, build(pb, uniq("ak"), creds=Creds("BVKAAAAAAAAAAAAAAAAA", "x" * 40)))
    assert r.status == 403 and r.code == "InvalidAccessKeyId", r


def test_the_policy_text_is_what_is_signed(pb):
    key = uniq("tamper")
    f = dict(build(pb, key))
    pol = json.loads(base64.b64decode(f["policy"]))
    pol["conditions"].append(["content-length-range", 0, 10 ** 9])         # altered after signing
    f["policy"] = base64.b64encode(json.dumps(pol).encode()).decode()
    r = post(pb, list(f.items()))
    assert r.status == 403 and r.code == "SignatureDoesNotMatch", r


def test_any_region_in_the_credential_scope_is_accepted(pb):
    assert post(pb, build(pb, uniq("reg"), region="eu-north-7")).status == 204


def test_scope_service_must_be_s3(pb):
    r = post(pb, build(pb, uniq("svc"), service="ec2"))
    assert r.status == 400 and r.code == "AuthorizationHeaderMalformed", r


@pytest.mark.parametrize("algo", ["AWS4-HMAC-SHA512", "AWS2", ""])
def test_unsupported_algorithm_field(pb, algo):
    f = [(k, algo if k == "x-amz-algorithm" else v) for k, v in build(pb, uniq("alg"))]
    r = post(pb, f)
    assert r.status in (400, 403) and r.code, r


@pytest.mark.parametrize("missing", ["policy", "x-amz-signature", "x-amz-credential", "x-amz-date", "x-amz-algorithm"])
def test_missing_signature_fields(pb, missing):
    key = uniq("miss")
    r = post(pb, build(pb, key, omit=(missing,)))
    assert r.status in (400, 403) and r.code, (missing, r)
    with s3error(None, 404):
        pb.head(key)


def test_missing_key_field(pb):
    r = post(pb, build(pb, "k", omit=("key",)))
    assert r.status == 400, r


def test_anonymous_post_is_access_denied(pb):
    r = post(pb, [("key", uniq("anon"))])
    assert r.status == 403 and r.code == "AccessDenied", r


def test_malformed_policy_documents(pb):
    for pol in ("not json", "{}", '{"expiration": "tomorrow", "conditions": []}', '{"conditions": []}', "[]"):
        r = post(pb, build(pb, uniq("badpol"), policy=pol))
        assert r.status in (400, 403) and r.code, (pol, r)


# --------------------------------------------------------------------------------------------
# permissions of the signing token

def test_token_without_write_or_create_cannot_post(pb):
    t = pb.token_info([{"actions": ["read", "list", "delete"]}])
    r = post(pb, build(pb, uniq("ro"), creds=Creds(t["access_key_id"], t["secret_access_key"])))
    assert r.status == 403 and r.code == "AccessDenied", r


def test_write_once_token_posts_new_keys_but_never_replaces(pb):
    t = pb.token_info([{"actions": ["create", "read"]}])
    c = Creds(t["access_key_id"], t["secret_access_key"])
    key = uniq("wo")
    assert post(pb, build(pb, key, creds=c), ("x", b"first", None)).status == 204
    r = post(pb, build(pb, key, creds=c), ("x", b"second", None))
    assert r.status == 403 and r.code == "AccessDenied", r
    assert pb.read(key) == b"first"


def test_tagging_needs_the_tag_action(pb):
    xml = "<Tagging><TagSet><Tag><Key>a</Key><Value>1</Value></Tag></TagSet></Tagging>"
    t = pb.token_info([{"actions": ["create"]}])
    r = post(pb, build(pb, uniq("nt"), creds=Creds(t["access_key_id"], t["secret_access_key"]), fields={"tagging": xml}))
    assert r.status == 403 and r.code == "AccessDenied", r
    t2 = pb.token_info([{"actions": ["create", "tag"]}])
    key = uniq("yt")
    assert post(pb, build(pb, key, creds=Creds(t2["access_key_id"], t2["secret_access_key"]), fields={"tagging": xml})).status == 204
    t3 = pb.token_info([{"actions": ["write"]}])
    assert post(pb, build(pb, uniq("wt"), creds=Creds(t3["access_key_id"], t3["secret_access_key"]), fields={"tagging": xml})).status == 204


def test_token_key_patterns_apply_to_the_final_key(pb):
    t = pb.token_info([{"actions": ["write"], "keys": ["inbox/*"]}])
    c = Creds(t["access_key_id"], t["secret_access_key"])
    assert post(pb, build(pb, "inbox/" + uniq("a"), creds=c)).status == 204
    r = post(pb, build(pb, "elsewhere/" + uniq("a"), creds=c))
    assert r.status == 403 and r.code == "AccessDenied", r


def test_revoked_and_expired_tokens_cannot_post(pb):
    t = pb.token_info([{"actions": ["write"]}])
    c = Creds(t["access_key_id"], t["secret_access_key"])
    assert post(pb, build(pb, uniq("live"), creds=c)).status == 204
    ADMIN.delete_token(pb.name, t["access_key_id"])
    r = post(pb, build(pb, uniq("dead"), creds=c))
    assert r.status == 403 and r.code == "InvalidAccessKeyId", r


def test_another_buckets_token_cannot_post_here(pb):
    other = bvh.fresh_bucket("postother")
    r = post(pb, build(pb, uniq("x"), creds=creds_of(other)))
    assert r.status == 403, r


# --------------------------------------------------------------------------------------------
# multipart/form-data details

def test_a_field_may_appear_only_once(pb):
    r = post(pb, build(pb, uniq("dup")) + [("x-ignore-a", "1"), ("x-ignore-a", "2")])
    assert r.status == 400, r
    f = build(pb, uniq("dup2")) + [("key", "second-key")]
    r = post(pb, f)
    assert r.status == 400, r


def test_the_file_part_must_come_last(pb):
    key = uniq("order")
    r = post(pb, build(pb, key), ("x", b"data", None), file_first=True)
    assert r.status in (400, 403) and r.code, "fields after the file part are not read: %r" % r
    with s3error(None, 404):
        pb.head(key)


def test_no_file_part(pb):
    r = post(pb, build(pb, uniq("nofile")), file=None)
    assert r.status == 400, r


def test_form_fields_are_limited_to_20_kib(pb):
    key = uniq("big-fields")
    r = post(pb, build(pb, key, fields={"x-amz-meta-huge": "v" * (21 * KiB)}))
    assert r.status == 400, r
    with s3error(None, 404):
        pb.head(key)


def test_not_a_multipart_body(pb):
    r = bvh.http_raw("POST", bvh.HOSTPORT, "/" + pb.name, headers={"Content-Type": "application/x-www-form-urlencoded"}, body=b"key=a&file=b")
    assert 400 <= r.status < 500 or r.status == 501, r
    r = bvh.http_raw("POST", bvh.HOSTPORT, "/" + pb.name, headers={"Content-Type": "multipart/form-data"}, body=b"junk")
    assert 400 <= r.status < 500, r


def test_key_too_long_via_post(pb):
    r = post(pb, build(pb, "k" * 1025))
    assert r.status == 400 and r.code == "KeyTooLongError", r


# --------------------------------------------------------------------------------------------
# CORS on the response

def test_post_response_carries_cors_headers_when_post_is_allowed():
    rules = [{"allowed_origins": ["https://app.example.com"], "allowed_methods": ["POST"], "expose_headers": ["ETag"]}]
    bk = bvh.fresh_bucket("postcors", cors=rules)
    r = post(bk, build(bk, "k"), headers={"Origin": "https://app.example.com"})
    assert r.status == 204 and r.header("access-control-allow-origin") == "https://app.example.com", r.raw_headers
    r = post(bk, build(bk, "k2"), headers={"Origin": "https://evil.example.com"})
    assert r.status == 204 and r.header("access-control-allow-origin") is None


def test_post_response_has_no_cors_headers_when_post_is_not_in_the_rules():
    rules = [{"allowed_origins": ["https://app.example.com"], "allowed_methods": ["GET", "PUT"]}]
    bk = bvh.fresh_bucket("postcors2", cors=rules)
    r = post(bk, build(bk, "k"), headers={"Origin": "https://app.example.com"})
    assert r.status == 204
    assert r.header("access-control-allow-origin") is None, "POST is not in allowed_methods (spec 5.10)"


def test_error_responses_of_post_carry_cors_headers_too():
    rules = [{"allowed_origins": ["https://app.example.com"], "allowed_methods": ["POST"]}]
    bk = bvh.fresh_bucket("postcors3", cors=rules)
    r = post(bk, build(bk, "k", signature="0" * 64), headers={"Origin": "https://app.example.com"})
    assert r.status == 403 and r.header("access-control-allow-origin") == "https://app.example.com", r.raw_headers
