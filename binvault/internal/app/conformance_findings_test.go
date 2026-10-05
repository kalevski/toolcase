package app_test

import (
	"bufio"
	"bytes"
	"crypto/sha256"
	"crypto/sha512"
	"encoding/base64"
	"encoding/hex"
	"io"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// Regression tests for the findings of the real-client conformance suite
// (test/conformance/known-failures.tsv, BV-nn).

// presignedURL signs method+pathAndQuery the way generate_presigned_url / getSignedUrl
// do: the query, whatever it holds, is covered by the signature.
func presignedURL(t *testing.T, n *node, c cred, method, pathAndQuery string) string {
	t.Helper()
	req, err := http.NewRequest(method, n.s3URL+pathAndQuery, nil)
	if err != nil {
		t.Fatal(err)
	}
	u, err := sigv4.Presign(req, c.ak, c.sk, "us-east-1", time.Now(), time.Hour)
	if err != nil {
		t.Fatal(err)
	}
	return u
}

func (n *node) doBody(method, u string, body []byte) *resp {
	n.t.Helper()
	req, err := http.NewRequest(method, u, bytes.NewReader(body))
	if err != nil {
		n.t.Fatal(err)
	}
	return n.do(req)
}

// wrongSecret is sk with its first character changed to a different one (never the same secret).
func wrongSecret(sk string) string {
	if sk[0] == 'x' {
		return "y" + sk[1:]
	}
	return "x" + sk[1:]
}

func b64sha512(b []byte) string {
	s := sha512.Sum512(b)
	return base64.StdEncoding.EncodeToString(s[:])
}

func b64sha256(b []byte) string {
	s := sha256.Sum256(b)
	return base64.StdEncoding.EncodeToString(s[:])
}

// BV-18: the x-amz-* parameters of a presigned URL (what aws-sdk-js-v3 and others hoist
// into the query) are the headers they stand for, once the signature is verified.
func TestFindingPresignedQueryHeadersAreRequestHeaders(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)

	// metadata, tags and SSE-S3 asked for in the query
	u := presignedURL(t, n, c, "PUT", "/bkt/k?x-amz-meta-who=presign&x-amz-meta-Other=Two%20Words&x-amz-tagging=env%3Dprod%26team%3Dcore&x-amz-server-side-encryption=AES256")
	if r := n.doBody("PUT", u, []byte("hoisted")); r.status != 200 || r.header.Get("x-amz-server-side-encryption") != "AES256" {
		t.Fatalf("presigned PUT: %d %s %v", r.status, r.body, r.header)
	}
	h := n.must(c, 200, "HEAD", "/bkt/k", nil)
	if h.header.Get("x-amz-meta-who") != "presign" || h.header.Get("x-amz-meta-other") != "Two Words" ||
		h.header.Get("x-amz-server-side-encryption") != "AES256" || h.header.Get("x-amz-tagging-count") != "2" {
		t.Fatalf("what the query asked for was dropped: %v", h.header)
	}
	if g := n.must(c, 200, "GET", "/bkt/k?tagging", nil); !strings.Contains(string(g.body), "<Key>env</Key><Value>prod</Value>") {
		t.Fatalf("%s", g.body)
	}
	if g := n.must(c, 200, "GET", "/bkt/k", nil); string(g.body) != "hoisted" {
		t.Fatalf("%q", g.body)
	}

	// a wrong checksum in the query is verified against the body, a right one is fine
	body := []byte("checksummed through the query string")
	bad := presignedURL(t, n, c, "PUT", "/bkt/ck?x-amz-checksum-crc32="+url.QueryEscape(crc32IEEE([]byte("different")))+"&x-amz-sdk-checksum-algorithm=CRC32")
	if r := n.doBody("PUT", bad, body); r.status != 400 || r.code() != "BadDigest" {
		t.Fatalf("wrong checksum in the query: %d %s", r.status, r.code())
	}
	if r := n.s3(c, "GET", "/bkt/ck", nil); r.status != 404 {
		t.Fatalf("a refused presigned PUT stored something: %d", r.status)
	}
	good := presignedURL(t, n, c, "PUT", "/bkt/ck?x-amz-checksum-crc32="+url.QueryEscape(crc32IEEE(body))+"&x-amz-sdk-checksum-algorithm=CRC32")
	if r := n.doBody("PUT", good, body); r.status != 200 {
		t.Fatalf("right checksum in the query: %d %s", r.status, r.body)
	}

	// unsupported behaviour in the query is refused like the header form
	for _, tc := range []struct {
		query string
		code  string
		st    int
	}{
		{"x-amz-server-side-encryption=aws%3Akms", "NotImplemented", 501},
		{"x-amz-storage-class=GLACIER", "InvalidStorageClass", 400},
		{"x-amz-acl=public-read", "AccessControlListNotSupported", 400},
		{"x-amz-server-side-encryption-customer-algorithm=AES256", "NotImplemented", 501},
	} {
		r := n.doBody("PUT", presignedURL(t, n, c, "PUT", "/bkt/refused?"+tc.query), []byte("x"))
		if r.status != tc.st || r.code() != tc.code {
			t.Fatalf("%s: %d %s, want %d %s", tc.query, r.status, r.code(), tc.st, tc.code)
		}
	}
	if r := n.s3(c, "GET", "/bkt/refused", nil); r.status != 404 {
		t.Fatalf("a refused presigned PUT stored something: %d", r.status)
	}

	// a hoisted x-amz-copy-source makes the PUT a copy (not an empty object)
	n.must(c, 200, "PUT", "/bkt/src", []byte("SOURCE-DATA"))
	cp := presignedURL(t, n, c, "PUT", "/bkt/dst?x-amz-copy-source="+url.QueryEscape("/bkt/src"))
	if r := n.doBody("PUT", cp, nil); r.status != 200 || !strings.Contains(string(r.body), "<CopyObjectResult") {
		t.Fatalf("presigned copy: %d %s", r.status, r.body)
	}
	if g := n.must(c, 200, "GET", "/bkt/dst", nil); string(g.body) != "SOURCE-DATA" {
		t.Fatalf("the copy is %q", g.body)
	}

	// only a VERIFIED presigned query counts: a header-signed request's query parameters, and a
	// presigned URL with a forged signature, are not request headers
	n.must(c, 200, "PUT", "/bkt/plain?x-amz-meta-sneaky=1", []byte("x"))
	if h := n.must(c, 200, "HEAD", "/bkt/plain", nil); h.header.Get("x-amz-meta-sneaky") != "" {
		t.Fatalf("a header-signed request's query became a header: %v", h.header)
	}
	forged := presignedURL(t, n, c, "PUT", "/bkt/forged?x-amz-meta-who=x")
	forged = strings.Replace(forged, "x-amz-meta-who=x", "x-amz-meta-who=y", 1) // changed after signing
	if r := n.doBody("PUT", forged, []byte("x")); r.status != 403 || r.code() != "SignatureDoesNotMatch" {
		t.Fatalf("forged presigned URL: %d %s", r.status, r.code())
	}
}

// aws-sdk-js-v3 signs presigned PutObject / UploadPart URLs with the checksum of the empty body
// it has at signing time (x-amz-checksum-crc32=AAAAAA==, x-amz-sdk-checksum-algorithm=CRC32):
// against the real body that is a placeholder, not something to verify (spec §5.9). The object
// still gets the checksum of what was uploaded.
func TestFindingPresignedEmptyBodyChecksumIsAPlaceholder(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	const jsDefault = "x-amz-checksum-crc32=AAAAAA%3D%3D&x-amz-sdk-checksum-algorithm=CRC32&x-id=PutObject"

	body := []byte("uploaded through a URL the JS SDK presigned by default")
	r := n.doBody("PUT", presignedURL(t, n, c, "PUT", "/bkt/js?"+jsDefault), body)
	if r.status != 200 || r.header.Get("x-amz-checksum-crc32") != crc32IEEE(body) {
		t.Fatalf("presigned PUT as the JS SDK builds it: %d %s %v", r.status, r.body, r.header)
	}
	if g := n.must(c, 200, "GET", "/bkt/js", nil, "x-amz-checksum-mode", "ENABLED"); string(g.body) != string(body) || g.header.Get("x-amz-checksum-crc32") != crc32IEEE(body) {
		t.Fatalf("the stored checksum is not the body's: %v", g.header)
	}
	// an empty body is verified against it like any other
	if r := n.doBody("PUT", presignedURL(t, n, c, "PUT", "/bkt/js-empty?"+jsDefault), nil); r.status != 200 || r.header.Get("x-amz-checksum-crc32") != "AAAAAA==" {
		t.Fatalf("empty body: %d %s %v", r.status, r.body, r.header)
	}
	// presigned parts of a multipart upload
	init := n.must(c, 200, "POST", "/bkt/mp?uploads", nil)
	id := regexp.MustCompile(`<UploadId>([^<]+)</UploadId>`).FindStringSubmatch(string(init.body))[1]
	part := bytes.Repeat([]byte("p"), 5<<20)
	pr := n.doBody("PUT", presignedURL(t, n, c, "PUT", "/bkt/mp?partNumber=1&uploadId="+id+"&"+jsDefault), part)
	if pr.status != 200 {
		t.Fatalf("presigned part: %d %s", pr.status, pr.body)
	}
	// any other value is a real checksum
	wrong := presignedURL(t, n, c, "PUT", "/bkt/js2?x-amz-checksum-crc32="+url.QueryEscape(crc32IEEE([]byte("something else")))+"&x-amz-sdk-checksum-algorithm=CRC32")
	if r := n.doBody("PUT", wrong, body); r.status != 400 || r.code() != "BadDigest" {
		t.Fatalf("a real but wrong checksum: %d %s", r.status, r.code())
	}
}

// aws-chunked PUT in the unsigned-trailer mode, with the trailer announced as given
// ("" = no announcement) and carrying the given values.
func (n *node) unsignedTrailerPut(c cred, path string, payload []byte, announce string, trailer http.Header) *resp {
	n.t.Helper()
	req, _ := http.NewRequest("PUT", n.s3URL+path, nil)
	req.Header.Set("Content-Encoding", "aws-chunked")
	req.Header.Set("x-amz-decoded-content-length", strconv.Itoa(len(payload)))
	signed := []string{"content-encoding", "x-amz-decoded-content-length"}
	if announce != "" {
		req.Header.Set("x-amz-trailer", announce)
		signed = append(signed, "x-amz-trailer")
	}
	res, err := sigv4.Sign(req, c.ak, c.sk, "us-east-1", time.Now(), sigv4.StreamingUnsignedPayloadTrailer, signed...)
	if err != nil {
		n.t.Fatal(err)
	}
	body := sigv4.EncodeStream(res, sigv4.StreamUnsignedTrailer, payload, 8192, trailer)
	req.Body = io.NopCloser(bytes.NewReader(body))
	req.ContentLength = int64(len(body))
	return n.do(req)
}

// BV-05: a trailer announced by x-amz-trailer must arrive; BV-16: a checksum of an
// algorithm binvault does not implement is refused, not skipped.
func TestFindingAnnouncedTrailerMustArriveAndUnsupportedChecksumsAreRefused(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	payload := bytes.Repeat([]byte("trailer payload "), 500)
	trailer := func(name, value string) http.Header { h := http.Header{}; h.Set(name, value); return h }

	if r := n.unsignedTrailerPut(c, "/bkt/ok", payload, "x-amz-checksum-crc32", trailer("x-amz-checksum-crc32", crc32IEEE(payload))); r.status != 200 {
		t.Fatalf("trailer present: %d %s", r.status, r.body)
	}
	for name, r := range map[string]*resp{
		"announced, never sent":        n.unsignedTrailerPut(c, "/bkt/none", payload, "x-amz-checksum-crc32", nil),
		"announced crc32, sha256 came": n.unsignedTrailerPut(c, "/bkt/other", payload, "x-amz-checksum-crc32", trailer("x-amz-checksum-sha256", b64sha256(payload))),
	} {
		if r.status != 400 || r.code() != "MalformedTrailerError" {
			t.Fatalf("%s: %d %s %s", name, r.status, r.code(), r.body)
		}
	}
	for _, key := range []string{"none", "other"} {
		if r := n.s3(c, "GET", "/bkt/"+key, nil); r.status != 404 {
			t.Fatalf("%s: the unverified body was stored: %d", key, r.status)
		}
	}
	// a trailer of an algorithm that is not implemented is refused up front
	if r := n.unsignedTrailerPut(c, "/bkt/sha512t", payload, "x-amz-checksum-sha512", trailer("x-amz-checksum-sha512", b64sha512(payload))); r.status != 400 || r.code() != "InvalidRequest" {
		t.Fatalf("sha512 trailer: %d %s", r.status, r.code())
	}

	// header form
	for _, hdr := range [][]string{
		{"x-amz-checksum-sha512", b64sha512(payload), "x-amz-sdk-checksum-algorithm", "SHA512"},
		{"x-amz-checksum-md5", base64.StdEncoding.EncodeToString(make([]byte, 16))},
		{"x-amz-checksum-xxhash64", base64.StdEncoding.EncodeToString(make([]byte, 8))},
		{"x-amz-sdk-checksum-algorithm", "XXHASH128"}, // declared, nothing to verify it with
	} {
		r := n.s3(c, "PUT", "/bkt/unsup", payload, hdr...)
		if r.status != 400 || r.code() != "InvalidRequest" {
			t.Fatalf("%v: %d %s", hdr, r.status, r.code())
		}
	}
	if r := n.s3(c, "GET", "/bkt/unsup", nil); r.status != 404 {
		t.Fatalf("an upload with an unsupported checksum was stored: %d", r.status)
	}
	// the supported algorithms still work, and so do the non-value x-amz-checksum-* headers
	if r := n.s3(c, "PUT", "/bkt/sup", payload, "x-amz-checksum-sha256", b64sha256(payload), "x-amz-sdk-checksum-algorithm", "SHA256"); r.status != 200 {
		t.Fatalf("sha256: %d %s", r.status, r.body)
	}
	if g := n.s3(c, "GET", "/bkt/sup", nil, "x-amz-checksum-mode", "ENABLED"); g.status != 200 || g.header.Get("x-amz-checksum-sha256") == "" {
		t.Fatalf("%d %v", g.status, g.header)
	}
}

// BV-04: DeleteObjects verifies the x-amz-checksum-* it carries (as a header or the
// trailer of an aws-chunked body); BV-13: an <Object> without a <Key> is MalformedXML.
func TestFindingDeleteObjectsVerifiesChecksumsAndRequiresKeys(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	doc := []byte(`<Delete xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Object><Key>a</Key></Object></Delete>`)
	n.must(c, 200, "PUT", "/bkt/a", []byte("x"))

	if r := n.s3(c, "POST", "/bkt?delete", doc, "x-amz-checksum-crc32", "AAAAAA==", "x-amz-sdk-checksum-algorithm", "CRC32"); r.status != 400 || r.code() != "BadDigest" {
		t.Fatalf("wrong checksum header: %d %s", r.status, r.code())
	}
	if r := n.s3(c, "POST", "/bkt?delete", doc, "x-amz-checksum-sha512", b64sha512(doc)); r.status != 400 || r.code() != "InvalidRequest" {
		t.Fatalf("unsupported algorithm: %d %s", r.status, r.code())
	}
	n.must(c, 200, "HEAD", "/bkt/a", nil) // nothing was deleted by the refused requests

	// the same through the trailer of a signed aws-chunked body
	streamed := func(crc string) *resp {
		req, _ := http.NewRequest("POST", n.s3URL+"/bkt?delete", nil)
		req.Header.Set("Content-Encoding", "aws-chunked")
		req.Header.Set("x-amz-decoded-content-length", strconv.Itoa(len(doc)))
		req.Header.Set("x-amz-trailer", "x-amz-checksum-crc32")
		res, err := sigv4.Sign(req, c.ak, c.sk, "us-east-1", time.Now(), sigv4.StreamingPayloadTrailer, "content-encoding", "x-amz-decoded-content-length", "x-amz-trailer")
		if err != nil {
			t.Fatal(err)
		}
		tr := http.Header{}
		tr.Set("x-amz-checksum-crc32", crc)
		body := sigv4.EncodeStream(res, sigv4.StreamSignedTrailer, doc, 8192, tr)
		req.Body = io.NopCloser(bytes.NewReader(body))
		req.ContentLength = int64(len(body))
		return n.do(req)
	}
	if r := streamed("AAAAAA=="); r.status != 400 || r.code() != "BadDigest" {
		t.Fatalf("wrong checksum trailer: %d %s %s", r.status, r.code(), r.body)
	}
	n.must(c, 200, "HEAD", "/bkt/a", nil)
	if r := streamed(crc32IEEE(doc)); r.status != 200 || !strings.Contains(string(r.body), "<Deleted><Key>a</Key>") {
		t.Fatalf("right checksum trailer: %d %s", r.status, r.body)
	}
	n.must(c, 404, "HEAD", "/bkt/a", nil)

	// the header form with the right value
	n.must(c, 200, "PUT", "/bkt/a", []byte("x"))
	if r := n.s3(c, "POST", "/bkt?delete", doc, "x-amz-checksum-crc32", crc32IEEE(doc), "x-amz-sdk-checksum-algorithm", "CRC32"); r.status != 200 {
		t.Fatalf("right checksum header: %d %s", r.status, r.body)
	}

	// an <Object> without a <Key>
	n.must(c, 200, "PUT", "/bkt/a", []byte("x"))
	keyless := []byte(`<Delete><Object><Key>a</Key></Object><Object></Object></Delete>`)
	if r := n.s3(c, "POST", "/bkt?delete", keyless); r.status != 400 || r.code() != "MalformedXML" {
		t.Fatalf("keyless <Object>: %d %s", r.status, r.code())
	}
	n.must(c, 200, "HEAD", "/bkt/a", nil) // nothing is deleted by a malformed request
}

// BV-11: an ACL body that grants anyone but the owner is refused, not ignored.
func TestFindingACLBodiesThatShareAreRefused(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	n.must(c, 200, "PUT", "/bkt/k", []byte("x"))
	owner := `<Owner><ID>bkt</ID><DisplayName>bkt</DisplayName></Owner>`
	grant := func(grantee, perm string) string {
		return `<Grant>` + grantee + `<Permission>` + perm + `</Permission></Grant>`
	}
	allUsers := `<Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="Group"><URI>http://acs.amazonaws.com/groups/global/AllUsers</URI></Grantee>`
	ownerGrantee := `<Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID>bkt</ID><DisplayName>bkt</DisplayName></Grantee>`
	someoneElse := `<Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID>another-account</ID></Grantee>`
	policy := func(grants ...string) []byte {
		return []byte(`<AccessControlPolicy xmlns="http://s3.amazonaws.com/doc/2006-03-01/">` + owner + `<AccessControlList>` + strings.Join(grants, "") + `</AccessControlList></AccessControlPolicy>`)
	}
	for _, target := range []string{"/bkt/k?acl", "/bkt?acl"} {
		// what s3cmd sends for "private": the owner's own FULL_CONTROL (and nothing at all)
		for _, ok := range [][]byte{policy(grant(ownerGrantee, "FULL_CONTROL")), policy()} {
			if r := n.s3(c, "PUT", target, ok, "Content-Type", "application/xml"); r.status != 200 {
				t.Fatalf("%s owner-only ACL: %d %s %s", target, r.status, r.code(), r.body)
			}
		}
		// the canned form has no body
		if r := n.s3(c, "PUT", target, nil, "x-amz-acl", "private"); r.status != 200 {
			t.Fatalf("%s canned private: %d %s", target, r.status, r.code())
		}
		for name, bad := range map[string][]byte{
			"AllUsers READ":         policy(grant(ownerGrantee, "FULL_CONTROL"), grant(allUsers, "READ")),
			"another account":       policy(grant(someoneElse, "FULL_CONTROL")),
			"AllUsers alone":        policy(grant(allUsers, "READ")),
			"owner and another one": policy(grant(ownerGrantee, "FULL_CONTROL"), grant(someoneElse, "READ")),
		} {
			if r := n.s3(c, "PUT", target, bad, "Content-Type", "application/xml"); r.status != 400 || r.code() != "AccessControlListNotSupported" {
				t.Fatalf("%s %s: %d %s", target, name, r.status, r.code())
			}
		}
		if r := n.s3(c, "PUT", target, nil, "x-amz-grant-read", `uri="http://acs.amazonaws.com/groups/global/AllUsers"`); r.status != 400 || r.code() != "AccessControlListNotSupported" {
			t.Fatalf("%s grant header: %d %s", target, r.status, r.code())
		}
		if r := n.s3(c, "PUT", target, nil, "x-amz-acl", "public-read"); r.status != 400 || r.code() != "AccessControlListNotSupported" {
			t.Fatalf("%s public-read: %d %s", target, r.status, r.code())
		}
		if r := n.s3(c, "PUT", target, []byte("not xml"), "Content-Type", "application/xml"); r.status != 400 || r.code() != "MalformedXML" {
			t.Fatalf("%s malformed: %d %s", target, r.status, r.code())
		}
	}
}

// BV-08: CreateBucket never creates anything: AccessDenied for any name but the
// token's own existing bucket (which answers 200), also when the name does not exist.
func TestFindingCreateBucketOfAnotherNameIsAccessDenied(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	n.bucket("other", nil)
	c := n.token("bkt", all, nil)
	n.must(c, 200, "PUT", "/bkt", nil)
	for _, name := range []string{"does-not-exist", "other", "Bad_Name"} {
		if r := n.s3(c, "PUT", "/"+name, nil); r.status != 403 || r.code() != "AccessDenied" {
			t.Fatalf("CreateBucket %s: %d %s", name, r.status, r.code())
		}
	}
	if r := n.s3(cred{}, "PUT", "/does-not-exist", nil); r.status != 403 || r.code() != "AccessDenied" {
		t.Fatalf("anonymous CreateBucket: %d %s", r.status, r.code())
	}
	if code, _ := n.admin("GET", "/buckets/does-not-exist", nil); code != 404 {
		t.Fatalf("CreateBucket created a bucket: %d", code)
	}
}

// BV-17: XML timestamps are whole seconds like S3's (millisecond field .000), so a
// listing agrees with the Last-Modified header (`aws s3 sync --exact-timestamps`).
func TestFindingListingTimestampsAreWholeSeconds(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	for i := 0; i < 5; i++ { // the odds of five 0 ms values by chance are nil
		n.must(c, 200, "PUT", "/bkt/o"+strconv.Itoa(i), []byte("x"))
		time.Sleep(3 * time.Millisecond)
	}
	n.must(c, 200, "PUT", "/bkt/copy", nil, "x-amz-copy-source", "/bkt/o0", "x-amz-metadata-directive", "REPLACE", "x-amz-meta-a", "b")
	re := regexp.MustCompile(`<(LastModified|CreationDate|Initiated)>([^<]*)</`)
	check := func(what string, body []byte) {
		t.Helper()
		ms := re.FindAllStringSubmatch(string(body), -1)
		if len(ms) == 0 {
			t.Fatalf("%s: no timestamps in %s", what, body)
		}
		for _, m := range ms {
			if !strings.HasSuffix(m[2], ".000Z") {
				t.Fatalf("%s: %s is %s, S3 writes whole seconds", what, m[1], m[2])
			}
		}
	}
	check("ListObjectsV2", n.must(c, 200, "GET", "/bkt?list-type=2", nil).body)
	check("ListObjects", n.must(c, 200, "GET", "/bkt", nil).body)
	check("ListObjectVersions", n.must(c, 200, "GET", "/bkt?versions", nil).body)
	check("ListBuckets", n.must(c, 200, "GET", "/", nil).body)
	cp := n.must(c, 200, "PUT", "/bkt/copy2", nil, "x-amz-copy-source", "/bkt/o1", "x-amz-metadata-directive", "REPLACE", "x-amz-meta-a", "c")
	check("CopyObject", cp.body)
	mp := n.must(c, 200, "POST", "/bkt/mp?uploads", nil)
	check("ListMultipartUploads", n.must(c, 200, "GET", "/bkt?uploads", nil).body)
	_ = mp
	// and the header agrees with the listing to the second
	head := n.must(c, 200, "HEAD", "/bkt/o2", nil)
	lm, err := http.ParseTime(head.header.Get("Last-Modified"))
	if err != nil {
		t.Fatal(err)
	}
	var found bool
	for _, m := range re.FindAllStringSubmatch(string(n.must(c, 200, "GET", "/bkt?list-type=2&prefix=o2", nil).body), -1) {
		got, err := time.Parse("2006-01-02T15:04:05.000Z", m[2])
		if err != nil {
			t.Fatal(err)
		}
		found = true
		if !got.Equal(lm) {
			t.Fatalf("listing %s, Last-Modified %s", got, lm)
		}
	}
	if !found {
		t.Fatal("o2 is not listed")
	}
}

// BV-02: a refused POST Object form carries the CORS headers too, so the page's script
// can read the error.
func TestFindingPostObjectErrorsCarryCORSHeaders(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", map[string]any{
		"cors": []map[string]any{{"allowed_origins": []string{"https://app.example.com"}, "allowed_methods": []string{"POST"}}},
	})
	c := n.token("bkt", all, nil)
	pol := policyFor(map[string]string{"bucket": "bkt"}, []any{"starts-with", "$key", ""})
	_, dt, _ := sigv4.SignPostPolicy(pol, c.ak, c.sk, "us-east-1", time.Now())
	form := func(sig string) *resp {
		cr, _, _ := sigv4.SignPostPolicy(pol, c.ak, c.sk, "us-east-1", time.Now())
		body, ct := postFormBody([][2]string{{"key", "k"}, {"policy", pol}, {"x-amz-algorithm", sigv4.Algorithm}, {"x-amz-credential", cr}, {"x-amz-date", dt}, {"x-amz-signature", sig}}, []byte("data"))
		req, _ := http.NewRequest("POST", n.s3URL+"/bkt", bytes.NewReader(body))
		req.Header.Set("Content-Type", ct)
		req.Header.Set("Origin", "https://app.example.com")
		return n.do(req)
	}
	r := form(strings.Repeat("0", 64))
	if r.status != 403 || r.code() != "SignatureDoesNotMatch" || r.header.Get("Access-Control-Allow-Origin") != "https://app.example.com" {
		t.Fatalf("refused form: %d %s %v", r.status, r.code(), r.header)
	}
	_, _, goodSig := sigv4.SignPostPolicy(pol, c.ak, c.sk, "us-east-1", time.Now())
	if ok := form(goodSig); ok.status != 204 || ok.header.Get("Access-Control-Allow-Origin") != "https://app.example.com" || len(ok.header.Values("Vary")) != 1 {
		t.Fatalf("accepted form: %d %v", ok.status, ok.header)
	}
	// an origin that is not in the rules gets no CORS headers, success or not
	req, _ := http.NewRequest("POST", n.s3URL+"/bkt", strings.NewReader("junk"))
	req.Header.Set("Content-Type", "multipart/form-data; boundary=x")
	req.Header.Set("Origin", "https://evil.example.com")
	if r := n.do(req); r.header.Get("Access-Control-Allow-Origin") != "" {
		t.Fatalf("CORS headers for a foreign origin: %v", r.header)
	}
}

// BV-23 / BV-12: tag syntax and required elements.
func TestFindingTagSyntaxAndRequiredElements(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	for _, tagging := range []string{"a=b%0d%0aX-Evil%3D1", "k%0a=v", "k=v%09w", "k=v%00", "k=%3Cscript%3E"} {
		if r := n.s3(c, "PUT", "/bkt/t", []byte("x"), "x-amz-tagging", tagging); r.status != 400 || r.code() != "InvalidTag" {
			t.Fatalf("%s: %d %s", tagging, r.status, r.code())
		}
	}
	if r := n.s3(c, "GET", "/bkt/t", nil); r.status != 404 {
		t.Fatalf("a refused write stored something: %d", r.status)
	}
	if r := n.s3(c, "PUT", "/bkt/t", []byte("x"), "x-amz-tagging", "env=prod%20eu&k2=a%2Bb%3Dc%2Fd%3Ae%40f.g_h-i"); r.status != 200 {
		t.Fatalf("legal tags: %d %s", r.status, r.body)
	}
	xml := func(inner string) []byte {
		return []byte(`<Tagging xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><TagSet>` + inner + `</TagSet></Tagging>`)
	}
	if r := n.s3(c, "PUT", "/bkt/t?tagging", xml("<Tag><Key>a</Key><Value>line1&#10;line2</Value></Tag>")); r.status != 400 || r.code() != "InvalidTag" {
		t.Fatalf("a newline in a tag value: %d %s", r.status, r.code())
	}
	for name, inner := range map[string]string{"no value": "<Tag><Key>a</Key></Tag>", "no key": "<Tag><Value>1</Value></Tag>"} {
		if r := n.s3(c, "PUT", "/bkt/t?tagging", xml(inner)); r.status != 400 || r.code() != "MalformedXML" {
			t.Fatalf("%s: %d %s", name, r.status, r.code())
		}
	}
	if r := n.s3(c, "PUT", "/bkt/t?tagging", xml("<Tag><Key>a</Key><Value></Value></Tag>")); r.status != 200 {
		t.Fatalf("an empty value is a value: %d %s", r.status, r.code())
	}
}

// BV-09 / BV-15: partNumber with Range is InvalidRequest; the service root's errors name their Resource.
func TestFindingPartNumberWithRangeAndServiceRootResource(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	n.must(c, 200, "PUT", "/bkt/k", []byte("0123456789"))
	if r := n.s3(c, "GET", "/bkt/k?partNumber=1", nil, "Range", "bytes=0-3"); r.status != 400 || r.code() != "InvalidRequest" {
		t.Fatalf("partNumber with Range: %d %s", r.status, r.code())
	}
	if r := n.must(c, 200, "GET", "/bkt/k?partNumber=1", nil); string(r.body) != "0123456789" {
		t.Fatalf("partNumber alone: %q", r.body)
	}
	if r := n.must(c, 206, "GET", "/bkt/k", nil, "Range", "bytes=0-3"); string(r.body) != "0123" {
		t.Fatalf("Range alone: %q", r.body)
	}
	r := n.s3(c, "DELETE", "/", nil)
	if r.status != 405 || r.code() != "MethodNotAllowed" || !strings.Contains(string(r.body), "<Resource>/</Resource>") {
		t.Fatalf("service root: %d %s %s", r.status, r.code(), r.body)
	}
	if r := n.s3(c, "GET", "/bkt/k?partNumber=1", nil, "Range", "bytes=0-3"); !strings.Contains(string(r.body), "<Resource>/bkt/k</Resource>") {
		t.Fatalf("object error: %s", r.body)
	}
}

// BV-07: ListMultipartUploads lists the uploads of one key in initiation order, and
// pages by (key-marker, upload-id-marker) in that order.
func TestFindingMultipartUploadsAreListedInInitiationOrder(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	idRe := regexp.MustCompile(`<UploadId>([^<]+)</UploadId>`)
	var created []string
	for i := 0; i < 6; i++ {
		r := n.must(c, 200, "POST", "/bkt/same?uploads", nil)
		created = append(created, idRe.FindStringSubmatch(string(r.body))[1])
		time.Sleep(5 * time.Millisecond) // initiation times have millisecond resolution
	}
	n.must(c, 200, "POST", "/bkt/zzz?uploads", nil)
	list := func(query string) (ids []string, truncated bool, nextKey, nextID string) {
		t.Helper()
		r := n.must(c, 200, "GET", "/bkt?uploads"+query, nil)
		for _, m := range idRe.FindAllStringSubmatch(string(r.body), -1) {
			ids = append(ids, m[1])
		}
		truncated = strings.Contains(string(r.body), "<IsTruncated>true</IsTruncated>")
		if m := regexp.MustCompile(`<NextKeyMarker>([^<]*)</NextKeyMarker>`).FindStringSubmatch(string(r.body)); m != nil {
			nextKey = m[1]
		}
		if m := regexp.MustCompile(`<NextUploadIdMarker>([^<]*)</NextUploadIdMarker>`).FindStringSubmatch(string(r.body)); m != nil {
			nextID = m[1]
		}
		return
	}
	all, _, _, _ := list("")
	if got := strings.Join(all[:6], ","); got != strings.Join(created, ",") {
		t.Fatalf("listed %s, initiated %s", got, strings.Join(created, ","))
	}
	// page through two at a time with the markers the listing hands out
	var paged []string
	query := "&max-uploads=2"
	for i := 0; i < 10; i++ {
		ids, truncated, nk, ni := list(query)
		paged = append(paged, ids...)
		if !truncated {
			break
		}
		query = "&max-uploads=2&key-marker=" + url.QueryEscape(nk) + "&upload-id-marker=" + url.QueryEscape(ni)
	}
	if len(paged) != 7 || strings.Join(paged[:6], ",") != strings.Join(created, ",") {
		t.Fatalf("paged %v, initiated %v", paged, created)
	}
	// a clean-up loop aborts what it listed: the marker upload is gone, the rest of its key must still come
	for _, id := range created[:2] {
		n.must(c, 204, "DELETE", "/bkt/same?uploadId="+id, nil)
	}
	rest, _, _, _ := list("&key-marker=same&upload-id-marker=" + created[1])
	if len(rest) != 5 || strings.Join(rest[:4], ",") != strings.Join(created[2:], ",") {
		t.Fatalf("after aborting the marker upload: %v, want %v then zzz", rest, created[2:])
	}
}

// BV-19: a request refused at admission does not reset the connection of a client that
// keeps streaming a large body: it reads the S3 error. The node reads and discards
// what is still arriving after answering (bounded, spec §3.5).
func TestFindingRefusedUploadDoesNotResetAStreamingClient(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("quo", map[string]any{"quota_bytes": 1000})
	c := n.token("quo", all, nil)
	for _, size := range []int{300 << 10, 2 << 20, 8 << 20} {
		req, _ := http.NewRequest("PUT", n.s3URL+"/quo/big", bytes.NewReader(make([]byte, size)))
		if _, err := sigv4.Sign(req, c.ak, c.sk, "us-east-1", time.Now(), sigv4.UnsignedPayload); err != nil {
			t.Fatal(err)
		}
		conn, err := net.Dial("tcp", strings.TrimPrefix(n.s3URL, "http://"))
		if err != nil {
			t.Fatal(err)
		}
		conn.SetDeadline(time.Now().Add(20 * time.Second))
		if err := req.Write(conn); err != nil { // the whole body goes out; it must not be reset half way
			conn.Close()
			t.Fatalf("%d bytes: the connection was torn down while the client was still sending: %v", size, err)
		}
		res, err := http.ReadResponse(bufio.NewReader(conn), req)
		if err != nil {
			conn.Close()
			t.Fatalf("%d bytes: no answer: %v", size, err)
		}
		body, _ := io.ReadAll(res.Body)
		conn.Close()
		if res.StatusCode != 403 || !strings.Contains(string(body), "<Code>QuotaExceeded</Code>") || !res.Close {
			t.Fatalf("%d bytes: %d %v %s", size, res.StatusCode, res.Header, body)
		}
	}
	if r := n.s3(c, "GET", "/quo/big", nil); r.status != 404 {
		t.Fatalf("a refused upload stored something: %d", r.status)
	}
}

// BV-20: failed admin-API authentications are counted in binvault_auth_failures_total
// (scheme "admin"); an address over the limit in binvault_throttled_total{reason="auth"}.
func TestFindingAdminAuthFailuresAreCounted(t *testing.T) {
	n := startNode(t, nil)
	metric := func(name string) string {
		req, _ := http.NewRequest("GET", n.adminURL+"/_metrics", nil)
		req.Header.Set("Authorization", "Bearer "+n.adminTok)
		r := n.do(req)
		if r.status != 200 {
			t.Fatalf("metrics: %d", r.status)
		}
		for _, line := range strings.Split(string(r.body), "\n") {
			if strings.HasPrefix(line, name) {
				return line
			}
		}
		return ""
	}
	bad := func() int {
		req, _ := http.NewRequest("GET", n.adminURL+"/_admin/v1/status", nil)
		req.Header.Set("Authorization", "Bearer "+strings.Repeat("z", 40))
		return n.do(req).status
	}
	for i := 0; i < 2; i++ {
		if st := bad(); st != 401 {
			t.Fatalf("bad token: %d", st)
		}
	}
	if got := metric(`binvault_auth_failures_total{scheme="admin"}`); !strings.HasSuffix(got, " 2") {
		t.Fatalf("admin failures: %q", got)
	}
	if got := strings.Count(metricsText(t, n), "# TYPE binvault_auth_failures_total"); got != 1 {
		t.Fatalf("the family is declared %d times", got)
	}
	// the S3 side keeps counting into the same family
	n.bucket("bkt", nil)
	c := n.token("bkt", all, nil)
	if r := n.s3(cred{c.ak, wrongSecret(c.sk)}, "GET", "/bkt/k", nil); r.status != 403 {
		t.Fatalf("bad secret: %d", r.status)
	}
	if got := metric(`binvault_auth_failures_total{scheme="header"}`); !strings.HasSuffix(got, " 1") {
		t.Fatalf("header failures: %q", got)
	}
	if got := metric(`binvault_auth_failures_total{scheme="admin"}`); !strings.HasSuffix(got, " 2") {
		t.Fatalf("admin failures: %q", got)
	}
}

func metricsText(t *testing.T, n *node) string {
	t.Helper()
	req, _ := http.NewRequest("GET", n.adminURL+"/_metrics", nil)
	req.Header.Set("Authorization", "Bearer "+n.adminTok)
	return string(n.do(req).body)
}

var _ = hex.EncodeToString
