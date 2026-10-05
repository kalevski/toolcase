package s3xml

import (
	"bytes"
	"encoding/xml"
	"errors"
	"io"
	"net/http"
	"net/http/httptest"
	"reflect"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

const nsAttr = ` xmlns="http://s3.amazonaws.com/doc/2006-03-01/"`

// TestDecodeSDKRequests decodes request bodies the way current SDKs and tools
// send them: namespaced or not, members in alphabetical (aws-sdk-go-v2,
// aws-sdk-js-v3) or model (boto3) or ad-hoc (minio-go) order.
func TestDecodeSDKRequests(t *testing.T) {
	cases := []struct {
		name string
		body string
		into any
		want any
	}{
		{"complete/aws-sdk-go-v2 with CRC32", `<CompleteMultipartUpload` + nsAttr + `><Part><ChecksumCRC32>AAAAAA==</ChecksumCRC32><ETag>&#34;a54357aff0632cce46d942af68356b38&#34;</ETag><PartNumber>1</PartNumber></Part><Part><ChecksumCRC32>AAAAAQ==</ChecksumCRC32><ETag>&#34;0c78aef83f66abc1fa1e8477f296d394&#34;</ETag><PartNumber>2</PartNumber></Part></CompleteMultipartUpload>`,
			&CompleteMultipartUpload{}, CompleteMultipartUpload{Parts: []CompletedPart{
				{PartNumber: 1, ETag: `"a54357aff0632cce46d942af68356b38"`, Checksums: Checksums{CRC32: "AAAAAA=="}},
				{PartNumber: 2, ETag: `"0c78aef83f66abc1fa1e8477f296d394"`, Checksums: Checksums{CRC32: "AAAAAQ=="}},
			}}},
		{"complete/boto3 with CRC32C and SHA256", `<CompleteMultipartUpload` + nsAttr + `><Part><ETag>"a54357aff0632cce46d942af68356b38"</ETag><ChecksumCRC32C>AAAAAA==</ChecksumCRC32C><ChecksumSHA256>47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=</ChecksumSHA256><PartNumber>1</PartNumber></Part></CompleteMultipartUpload>`,
			&CompleteMultipartUpload{}, CompleteMultipartUpload{Parts: []CompletedPart{
				{PartNumber: 1, ETag: `"a54357aff0632cce46d942af68356b38"`, Checksums: Checksums{CRC32C: "AAAAAA==", SHA256: "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU="}},
			}}},
		{"complete/aws-sdk-js-v3 with CRC64NVME and SHA1", `<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUpload` + nsAttr + `><Part><ChecksumCRC64NVME>AAAAAAAAAAA=</ChecksumCRC64NVME><ChecksumSHA1>2jmj7l5rSw0yVb/vlWAYkK/YBwk=</ChecksumSHA1><ETag>"a54357aff0632cce46d942af68356b38"</ETag><PartNumber>1</PartNumber></Part></CompleteMultipartUpload>`,
			&CompleteMultipartUpload{}, CompleteMultipartUpload{Parts: []CompletedPart{
				{PartNumber: 1, ETag: `"a54357aff0632cce46d942af68356b38"`, Checksums: Checksums{CRC64NVME: "AAAAAAAAAAA=", SHA1: "2jmj7l5rSw0yVb/vlWAYkK/YBwk="}},
			}}},
		{"complete/minio-go without namespace", `<CompleteMultipartUpload><Part><PartNumber>1</PartNumber><ETag>a54357aff0632cce46d942af68356b38</ETag></Part></CompleteMultipartUpload>`,
			&CompleteMultipartUpload{}, CompleteMultipartUpload{Parts: []CompletedPart{{PartNumber: 1, ETag: "a54357aff0632cce46d942af68356b38"}}}},
		{"complete/prefixed namespace", `<s3:CompleteMultipartUpload xmlns:s3="http://s3.amazonaws.com/doc/2006-03-01/"><s3:Part><s3:PartNumber>3</s3:PartNumber><s3:ETag>x</s3:ETag></s3:Part></s3:CompleteMultipartUpload>`,
			&CompleteMultipartUpload{}, CompleteMultipartUpload{Parts: []CompletedPart{{PartNumber: 3, ETag: "x"}}}},
		{"complete/pretty-printed CRLF with padded number", "\xef\xbb\xbf<?xml version=\"1.0\"?>\r\n<CompleteMultipartUpload>\r\n  <Part>\r\n    <PartNumber> 7 </PartNumber>\r\n    <ETag>\"x\"</ETag>\r\n  </Part>\r\n</CompleteMultipartUpload>\r\n<!-- trailing comment -->\r\n",
			&CompleteMultipartUpload{}, CompleteMultipartUpload{Parts: []CompletedPart{{PartNumber: 7, ETag: `"x"`}}}},
		{"delete/aws-sdk-go-v2 quiet with version id", `<Delete` + nsAttr + `><Object><Key>a.jpg</Key></Object><Object><Key>b &amp; c.jpg</Key><VersionId>01J9ZN0000000000000000000A</VersionId></Object><Quiet>true</Quiet></Delete>`,
			&Delete{}, Delete{Quiet: true, Objects: []ObjectIdentifier{{Key: "a.jpg"}, {Key: "b & c.jpg", VersionID: "01J9ZN0000000000000000000A"}}}},
		{"delete/minio-go quiet first, null version", `<Delete><Quiet>true</Quiet><Object><Key>a.jpg</Key></Object><Object><Key>b.jpg</Key><VersionId>null</VersionId></Object></Delete>`,
			&Delete{}, Delete{Quiet: true, Objects: []ObjectIdentifier{{Key: "a.jpg"}, {Key: "b.jpg", VersionID: "null"}}}},
		{"delete/not quiet, key with spaces kept verbatim", `<Delete` + nsAttr + `><Object><Key> padded key </Key></Object><Quiet>false</Quiet></Delete>`,
			&Delete{}, Delete{Objects: []ObjectIdentifier{{Key: " padded key "}}}},
		{"delete/conditional fields", `<Delete` + nsAttr + `><Object><Key>a</Key><ETag>"abc"</ETag><LastModifiedTime>2026-09-30T08:15:00Z</LastModifiedTime><Size>12</Size></Object></Delete>`,
			&Delete{}, Delete{Objects: []ObjectIdentifier{{Key: "a", ETag: `"abc"`, LastModifiedTime: ptrTime(ts("2026-09-30T08:15:00Z")), Size: i64(12)}}}},
		{"tagging/namespaced", `<Tagging` + nsAttr + `><TagSet><Tag><Key>scan</Key><Value>clean</Value></Tag><Tag><Key>owner</Key><Value></Value></Tag></TagSet></Tagging>`,
			&Tagging{}, Tagging{TagSet: []Tag{{Key: "scan", Value: "clean"}, {Key: "owner"}}}},
		{"tagging/no namespace, empty tag set", `<Tagging><TagSet/></Tagging>`, &Tagging{}, Tagging{}},
		{"versioning/enabled", `<VersioningConfiguration` + nsAttr + `><Status>Enabled</Status></VersioningConfiguration>`,
			&VersioningConfiguration{}, VersioningConfiguration{Status: "Enabled"}},
		{"versioning/suspended with mfa", `<VersioningConfiguration><Status>Suspended</Status><MfaDelete>Disabled</MfaDelete></VersioningConfiguration>`,
			&VersioningConfiguration{}, VersioningConfiguration{Status: "Suspended", MFADelete: "Disabled"}},
		{"acl/aws-cli put-bucket-acl", `<AccessControlPolicy` + nsAttr + `><AccessControlList><Grant><Grantee xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:type="CanonicalUser"><ID>photos</ID></Grantee><Permission>FULL_CONTROL</Permission></Grant></AccessControlList><Owner><ID>photos</ID></Owner></AccessControlPolicy>`,
			&AccessControlPolicy{}, AccessControlPolicy{Owner: Owner{ID: "photos"}, AccessControlList: []Grant{{Grantee: Grantee{Type: "CanonicalUser", ID: "photos"}, Permission: "FULL_CONTROL"}}}},
		{"acl/group grant without xsi declaration", `<AccessControlPolicy><Owner><ID>photos</ID></Owner><AccessControlList><Grant><Grantee xsi:type="Group"><URI>http://acs.amazonaws.com/groups/global/AllUsers</URI></Grantee><Permission>READ</Permission></Grant></AccessControlList></AccessControlPolicy>`,
			&AccessControlPolicy{}, AccessControlPolicy{Owner: Owner{ID: "photos"}, AccessControlList: []Grant{{Grantee: Grantee{Type: "Group", URI: "http://acs.amazonaws.com/groups/global/AllUsers"}, Permission: "READ"}}}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if err := Decode(strings.NewReader(tc.body), tc.into, 0); err != nil {
				t.Fatalf("Decode: %v", err)
			}
			if got := clearXMLName(reflect.ValueOf(tc.into).Elem()); !reflect.DeepEqual(got, tc.want) {
				t.Fatalf("got  %#v\nwant %#v", got, tc.want)
			}
		})
	}
}

func ptrTime(t Time) *Time { return &t }

// TestRequestRoundTrip marshals request documents the way SDKs send them and
// decodes them back.
func TestRequestRoundTrip(t *testing.T) {
	for _, v := range []any{
		CompleteMultipartUpload{Parts: []CompletedPart{{PartNumber: 1, ETag: `"e1"`, Checksums: Checksums{CRC32: "AAAAAA==", CRC32C: "AAAAAQ==", CRC64NVME: "AAAAAAAAAAA=", SHA1: "s1", SHA256: "s256"}}}},
		Delete{Quiet: true, Objects: []ObjectIdentifier{{Key: "a"}, {Key: "b", VersionID: "null"}}},
		NewTagging(map[string]string{"k": "v"}),
		VersioningConfiguration{Status: "Enabled"},
		CreateBucketConfiguration{LocationConstraint: "eu-west-1"},
	} {
		doc, err := Marshal(v)
		if err != nil {
			t.Fatal(err)
		}
		if !bytes.Contains(doc, []byte(nsAttr)) {
			t.Fatalf("%T: request roots go out namespaced, as SDKs send them: %s", v, doc)
		}
		back := reflect.New(reflect.TypeOf(v))
		if err := Decode(bytes.NewReader(doc), back.Interface(), 0); err != nil {
			t.Fatalf("%T: %v", v, err)
		}
		if got := clearXMLName(back.Elem()); !reflect.DeepEqual(got, v) {
			t.Fatalf("%T round trip:\n got %#v\nwant %#v", v, got, v)
		}
	}
}

func TestDecodeCreateBucket(t *testing.T) {
	cases := []struct {
		name, body, want, code string
	}{
		{"empty body (us-east-1)", "", "", ""},
		{"whitespace only", " \r\n\t", "", ""},
		{"namespaced configuration", `<CreateBucketConfiguration` + nsAttr + `><LocationConstraint>eu-west-1</LocationConstraint></CreateBucketConfiguration>`, "eu-west-1", ""},
		{"configuration without namespace", `<CreateBucketConfiguration><LocationConstraint>us-west-2</LocationConstraint></CreateBucketConfiguration>`, "us-west-2", ""},
		{"prefixed namespace", `<s3:CreateBucketConfiguration xmlns:s3="http://s3.amazonaws.com/doc/2006-03-01/"><s3:LocationConstraint>ap-south-1</s3:LocationConstraint></s3:CreateBucketConfiguration>`, "ap-south-1", ""},
		{"empty configuration", `<CreateBucketConfiguration` + nsAttr + `/>`, "", ""},
		{"bare LocationConstraint", `<LocationConstraint>eu-central-1</LocationConstraint>`, "eu-central-1", ""},
		{"bare namespaced LocationConstraint", `<?xml version="1.0" encoding="UTF-8"?>` + "\n" + `<LocationConstraint` + nsAttr + `> sa-east-1 </LocationConstraint>`, "sa-east-1", ""},
		{"pretty-printed", "<CreateBucketConfiguration>\n  <LocationConstraint>eu-west-1</LocationConstraint>\n</CreateBucketConfiguration>\n", "eu-west-1", ""},
		{"wrong root", `<Tagging/>`, "", "MalformedXML"},
		{"broken", `<CreateBucketConfiguration>`, "", "MalformedXML"},
		{"doctype", `<!DOCTYPE x><LocationConstraint>eu-west-1</LocationConstraint>`, "", "MalformedXML"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := DecodeCreateBucket(strings.NewReader(tc.body), 0)
			if code := codeOf(t, err); code != tc.code {
				t.Fatalf("error code %q, want %q (%v)", code, tc.code, err)
			}
			if got != tc.want {
				t.Fatalf("location %q, want %q", got, tc.want)
			}
		})
	}
}

// codeOf returns the S3 code of err ("" for nil) and fails if err is not an
// *apierr.Error.
func codeOf(t *testing.T, err error) string {
	t.Helper()
	if err == nil {
		return ""
	}
	ae, ok := err.(*apierr.Error)
	if !ok {
		t.Fatalf("error %T (%v) is not an *apierr.Error", err, err)
	}
	if ae.Status != apierr.StatusOf(ae.Code) {
		t.Fatalf("%s: status %d", ae.Code, ae.Status)
	}
	return ae.Code
}

func nest(open, close string, n int) string {
	return strings.Repeat(open, n) + strings.Repeat(close, n)
}

func TestDecodeHostile(t *testing.T) {
	const billionLaughs = `<?xml version="1.0"?>
<!DOCTYPE lolz [
  <!ENTITY lol "lol">
  <!ENTITY lol1 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">
  <!ENTITY lol2 "&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;&lol1;">
  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">
]>
<Delete><Object><Key>&lol3;</Key></Object></Delete>`
	const xxe = `<?xml version="1.0"?><!DOCTYPE d [<!ENTITY xxe SYSTEM "file:///etc/passwd">]><Delete><Object><Key>&xxe;</Key></Object></Delete>`
	ok := `<Delete><Object><Key>a</Key></Object></Delete>`

	cases := []struct {
		name, body, code string
	}{
		{"baseline", ok, ""},
		{"trailing whitespace and comment", ok + "\n <!-- done -->\n", ""},
		{"byte-order mark and declaration", "\xef\xbb\xbf<?xml version=\"1.0\" encoding=\"utf-8\"?>" + ok, ""},
		{"empty body", "", "MissingRequestBodyError"},
		{"whitespace body", "\n\t \r\n", "MissingRequestBodyError"},
		{"declaration only", `<?xml version="1.0" encoding="UTF-8"?>`, "MalformedXML"},
		{"billion laughs", billionLaughs, "MalformedXML"},
		{"external entity (XXE)", xxe, "MalformedXML"},
		{"bare DOCTYPE", `<!DOCTYPE Delete>` + ok, "MalformedXML"},
		{"DOCTYPE after the root", ok + `<!DOCTYPE Delete>`, "MalformedXML"},
		{"undeclared entity", `<Delete><Object><Key>&xxe;</Key></Object></Delete>`, "MalformedXML"},
		{"HTML entity", `<Delete><Object><Key>a&nbsp;b</Key></Object></Delete>`, "MalformedXML"},
		{"stylesheet processing instruction", `<?xml-stylesheet type="text/xsl" href="x.xsl"?>` + ok, "MalformedXML"},
		{"processing instruction inside", `<Delete><?php echo 1; ?><Object><Key>a</Key></Object></Delete>`, "MalformedXML"},
		{"declaration after a comment", `<!-- c --><?xml version="1.0"?>` + ok, "MalformedXML"},
		{"second declaration", `<?xml version="1.0"?><?xml version="1.0"?>` + ok, "MalformedXML"},
		{"XML 1.1", `<?xml version="1.1"?>` + ok, "MalformedXML"},
		{"non-UTF-8 encoding", `<?xml version="1.0" encoding="ISO-8859-1"?>` + ok, "MalformedXML"},
		{"UTF-16 body", "\xff\xfe<\x00D\x00/\x00>\x00", "MalformedXML"},
		{"invalid UTF-8", "<Delete><Object><Key>a\xffb</Key></Object></Delete>", "MalformedXML"},
		{"raw control character", "<Delete><Object><Key>a\x01b</Key></Object></Delete>", "MalformedXML"},
		{"control character reference", `<Delete><Object><Key>a&#x1;b</Key></Object></Delete>`, "MalformedXML"},
		{"NUL reference", `<Delete><Object><Key>a&#0;b</Key></Object></Delete>`, "MalformedXML"},
		{"text before the root", "junk" + ok, "MalformedXML"},
		{"text after the root", ok + "junk", "MalformedXML"},
		{"second root", ok + ok, "MalformedXML"},
		{"unclosed root", `<Delete><Object><Key>a</Key></Object>`, "MalformedXML"},
		{"mismatched end tag", `<Delete><Object></Delete></Object>`, "MalformedXML"},
		{"unquoted attribute", `<Delete a=b>` + `</Delete>`, "MalformedXML"},
		{"wrong root element", `<Tagging><TagSet/></Tagging>`, "MalformedXML"},
		{"bad boolean", `<Delete><Quiet>maybe</Quiet></Delete>`, "MalformedXML"},
		{"nesting at the limit", `<Delete>` + nest("<x>", "</x>", MaxDepth-1) + `</Delete>`, ""},
		{"nesting past the limit", `<Delete>` + nest("<x>", "</x>", MaxDepth) + `</Delete>`, "MalformedXML"},
		{"deep nesting attack", `<Delete>` + nest("<a>", "</a>", 100000) + `</Delete>`, "MalformedXML"},
		{"huge element", `<Delete><Object><Key>` + strings.Repeat("k", MaxRequestBytes) + `</Key></Object></Delete>`, "EntityTooLarge"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var d Delete
			err := Decode(strings.NewReader(tc.body), &d, 0)
			if code := codeOf(t, err); code != tc.code {
				t.Fatalf("code %q, want %q (%v)", code, tc.code, err)
			}
		})
	}

	t.Run("bad part number", func(t *testing.T) {
		var c CompleteMultipartUpload
		err := Decode(strings.NewReader(`<CompleteMultipartUpload><Part><PartNumber>one</PartNumber></Part></CompleteMultipartUpload>`), &c, 0)
		if code := codeOf(t, err); code != "MalformedXML" {
			t.Fatalf("code %q (%v)", code, err)
		}
	})
	t.Run("unexpected element in ListVersionsResult", func(t *testing.T) {
		var r ListVersionsResult
		err := Decode(strings.NewReader(`<ListVersionsResult><Name>b</Name><Bogus/></ListVersionsResult>`), &r, 0)
		if code := codeOf(t, err); code != "MalformedXML" {
			t.Fatalf("code %q (%v)", code, err)
		}
	})
}

func TestDecodeLimits(t *testing.T) {
	doc := `<Delete><Object><Key>` + strings.Repeat("k", 100) + `</Key></Object></Delete>`
	n := int64(len(doc))
	var d Delete
	if err := Decode(strings.NewReader(doc), &d, n); err != nil {
		t.Fatalf("a body of exactly the limit is accepted: %v", err)
	}
	if code := codeOf(t, Decode(strings.NewReader(doc), &d, n-1)); code != "EntityTooLarge" {
		t.Fatalf("one byte over the limit: %q", code)
	}
	// A caller-side io.LimitReader truncates instead: the document is cut and
	// is malformed rather than too large.
	if code := codeOf(t, Decode(io.LimitReader(strings.NewReader(doc), n-1), &d, n)); code != "MalformedXML" {
		t.Fatalf("truncated by the caller: %q", code)
	}
	// Default limit is MaxRequestBytes.
	big := `<Delete><Object><Key>` + strings.Repeat("k", MaxRequestBytes-60) + `</Key></Object></Delete>`
	if err := Decode(strings.NewReader(big), &d, -1); err != nil {
		t.Fatalf("just under 2 MiB: %v", err)
	}
	// http.MaxBytesReader in front of Decode.
	rec := httptest.NewRecorder()
	mbr := http.MaxBytesReader(rec, io.NopCloser(strings.NewReader(doc)), 10)
	if code := codeOf(t, Decode(mbr, &d, 0)); code != "EntityTooLarge" {
		t.Fatalf("MaxBytesReader: %q", code)
	}
}

type errReader struct{ err error }

func (r errReader) Read([]byte) (int, error) { return 0, r.err }

type timeoutErr struct{}

func (timeoutErr) Error() string { return "i/o timeout" }
func (timeoutErr) Timeout() bool { return true }

func TestDecodeReadErrors(t *testing.T) {
	sig := apierr.New("SignatureDoesNotMatch", "chunk signature mismatch")
	cases := []struct {
		name string
		r    io.Reader
		code string
	}{
		{"apierr from the body reader passes through", errReader{sig}, "SignatureDoesNotMatch"},
		{"timeout", errReader{timeoutErr{}}, "RequestTimeout"},
		{"connection reset", errReader{errors.New("connection reset by peer")}, "IncompleteBody"},
		{"unexpected EOF", io.MultiReader(strings.NewReader("<Delete>"), errReader{io.ErrUnexpectedEOF}), "IncompleteBody"},
		{"nil reader is an empty body", nil, "MissingRequestBodyError"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			var d Delete
			if code := codeOf(t, Decode(tc.r, &d, 0)); code != tc.code {
				t.Fatalf("code %q, want %q", code, tc.code)
			}
		})
	}
	var d Delete
	if code := codeOf(t, Decode(strings.NewReader("<Delete/>"), d, 0)); code != "InternalError" {
		t.Fatalf("non-pointer: %q", code)
	}
	if code := codeOf(t, Decode(strings.NewReader("<Delete/>"), (*Delete)(nil), 0)); code != "InternalError" {
		t.Fatalf("nil pointer: %q", code)
	}
}

func TestMarshalRefusesInvalidText(t *testing.T) {
	cases := []struct {
		name  string
		v     any
		field string
	}{
		{"control character in a key", ListBucketResultV2{Name: "b", Contents: []Object{{Key: "ok"}, {Key: "a\x01b"}}}, "ListBucketResultV2.Contents[1].Key"},
		{"invalid UTF-8 in a prefix", ListBucketResult{Name: "b", Prefix: "p\xff"}, "ListBucketResult.Prefix"},
		{"U+FFFE in a common prefix", ListVersionsResult{CommonPrefixes: []CommonPrefix{{Prefix: "x\xef\xbf\xbe"}}}, "ListVersionsResult.CommonPrefixes[0].Prefix"},
		{"escape in a version entry", ListVersionsResult{Entries: []VersionEntry{{DeleteMarker: true, Key: "\x1b[31m"}}}, "ListVersionsResult.Entries[0].Key"},
		{"NUL in a tag value", NewTagging(map[string]string{"k": "\x00"}), "Tagging.TagSet[0].Value"},
		{"control character in an error extra", ErrorDoc{Code: "NoSuchKey", Extra: map[string]string{"Key": "a\x02"}}, "ErrorDoc.Extra[Key]"},
		{"pointer root", &DeleteResult{Errors: []DeleteError{{Key: "k", Message: "bad\x07"}}}, "DeleteResult.Errors[0].Message"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			out, err := Marshal(tc.v)
			var ice *InvalidCharError
			if !errors.As(err, &ice) {
				t.Fatalf("want *InvalidCharError, got %v (output %q)", err, out)
			}
			if ice.Field != tc.field {
				t.Fatalf("field %q, want %q", ice.Field, tc.field)
			}
			if msg := err.Error(); !strings.Contains(msg, tc.field) || !strings.Contains(msg, "encoding-type=url") {
				t.Fatalf("message %q", msg)
			}
		})
	}
	if _, err := Marshal(nil); err == nil {
		t.Fatal("Marshal(nil) must fail")
	}
	if _, err := Marshal((*ListBucketResult)(nil)); err == nil {
		t.Fatal("Marshal of a nil pointer must fail")
	}

	// The same listing goes through with encoding-type=url.
	r := ListBucketResultV2{Name: "b", Contents: []Object{{Key: "a\x01b\x7f"}}}
	r.EncodeURL()
	out, err := Marshal(r)
	if err != nil {
		t.Fatalf("url-encoded listing: %v", err)
	}
	if !bytes.Contains(out, []byte("<Key>a%01b%7F</Key>")) || !bytes.Contains(out, []byte("<EncodingType>url</EncodingType>")) {
		t.Fatalf("url-encoded listing: %s", out)
	}
}

func TestXMLText(t *testing.T) {
	cases := []struct {
		in, clean string
		valid     bool
	}{
		{"plain/key.txt", "plain/key.txt", true},
		{"tab\tnewline\ncr\r", "tab\tnewline\ncr\r", true},
		{"\xc3\xbc \xe2\x82\xac \xf0\x9f\x98\x80", "\xc3\xbc \xe2\x82\xac \xf0\x9f\x98\x80", true},
		{"del\x7f c1\xc2\x85", "del\x7f c1\xc2\x85", true},
		{"a\x00b", "a\xef\xbf\xbdb", false},
		{"a\x01\x1fb", "a\xef\xbf\xbd\xef\xbf\xbdb", false},
		{"bad\xffutf8", "bad\xef\xbf\xbdutf8", false},
		{"truncated\xe2\x82", "truncated\xef\xbf\xbd\xef\xbf\xbd", false},
		{"nonchar\xef\xbf\xbe\xef\xbf\xbf", "nonchar\xef\xbf\xbd\xef\xbf\xbd", false},
		{"replacement \xef\xbf\xbd is fine", "replacement \xef\xbf\xbd is fine", true},
	}
	for _, tc := range cases {
		if got := ValidXMLText(tc.in); got != tc.valid {
			t.Errorf("ValidXMLText(%q) = %v", tc.in, got)
		}
		if got := CleanXMLText(tc.in); got != tc.clean {
			t.Errorf("CleanXMLText(%q) = %q, want %q", tc.in, got, tc.clean)
		}
		if !ValidXMLText(CleanXMLText(tc.in)) {
			t.Errorf("CleanXMLText(%q) is not valid", tc.in)
		}
	}
}

// TestKeyEscaping round-trips keys made of everything XML must escape or
// that parsers like to normalise.
func TestKeyEscaping(t *testing.T) {
	keys := []string{
		`a&b<c>d"e'f`,
		"tab\there",
		"line\nbreak",
		"carriage\rreturn",
		"crlf\r\nend",
		"  spaces  ",
		"]]>cdata-end",
		"&amp; literally",
		"&#34; literally",
		"\xc3\xbcnic\xc3\xb8de/\xf0\x9f\x98\x80",
	}
	r := ListBucketResultV2{Name: "b"}
	for _, k := range keys {
		r.Contents = append(r.Contents, Object{Key: k, ETag: `"e"`})
	}
	out, err := Marshal(r)
	if err != nil {
		t.Fatal(err)
	}
	var back ListBucketResultV2
	if err := Decode(bytes.NewReader(out), &back, 0); err != nil {
		t.Fatalf("Decode: %v\n%s", err, out)
	}
	for i, k := range keys {
		if back.Contents[i].Key != k {
			t.Errorf("key %q came back as %q", k, back.Contents[i].Key)
		}
	}
	if !bytes.Contains(out, []byte("<ETag>&quot;e&quot;</ETag>")) {
		t.Errorf("ETags are written with &quot; as S3 does:\n%s", out)
	}
	if !bytes.Contains(out, []byte(`<Key>a&amp;b&lt;c&gt;d&quot;e'f</Key>`)) {
		t.Errorf("escaping differs from S3:\n%s", out)
	}
}

func TestExactDocuments(t *testing.T) {
	const h = xml.Header
	cases := []struct {
		name string
		v    any
		want string
	}{
		{"versioning off is an empty document", VersioningConfiguration{}, h + `<VersioningConfiguration` + nsAttr + `></VersioningConfiguration>`},
		{"versioning enabled", VersioningConfiguration{Status: "Enabled"}, h + `<VersioningConfiguration` + nsAttr + `><Status>Enabled</Status></VersioningConfiguration>`},
		{"us-east-1 location is empty", LocationConstraint{}, h + `<LocationConstraint` + nsAttr + `></LocationConstraint>`},
		{"location", LocationConstraint{Region: "eu-west-1"}, h + `<LocationConstraint` + nsAttr + `>eu-west-1</LocationConstraint>`},
		{"no tags keeps the TagSet", Tagging{}, h + `<Tagging` + nsAttr + `><TagSet></TagSet></Tagging>`},
		{"quiet delete with no errors", DeleteResult{}, h + `<DeleteResult` + nsAttr + `></DeleteResult>`},
		{"no buckets keeps Buckets", ListAllMyBucketsResult{Owner: Owner{ID: "b"}}, h + `<ListAllMyBucketsResult` + nsAttr + `><Owner><ID>b</ID></Owner><Buckets></Buckets></ListAllMyBucketsResult>`},
		{"empty V1 listing", ListBucketResult{Name: "b", MaxKeys: 1000}, h + `<ListBucketResult` + nsAttr + `><Name>b</Name><Prefix></Prefix><Marker></Marker><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated></ListBucketResult>`},
		{"empty V2 listing with max-keys=0", ListBucketResultV2{Name: "b"}, h + `<ListBucketResult` + nsAttr + `><Name>b</Name><Prefix></Prefix><KeyCount>0</KeyCount><MaxKeys>0</MaxKeys><IsTruncated>false</IsTruncated></ListBucketResult>`},
		{"empty versions listing", ListVersionsResult{Name: "b", MaxKeys: 1000}, h + `<ListVersionsResult` + nsAttr + `><Name>b</Name><Prefix></Prefix><KeyMarker></KeyMarker><VersionIdMarker></VersionIdMarker><MaxKeys>1000</MaxKeys><IsTruncated>false</IsTruncated></ListVersionsResult>`},
		{"empty uploads listing", ListMultipartUploadsResult{Bucket: "b", MaxUploads: 1000}, h + `<ListMultipartUploadsResult` + nsAttr + `><Bucket>b</Bucket><KeyMarker></KeyMarker><UploadIdMarker></UploadIdMarker><NextKeyMarker></NextKeyMarker><NextUploadIdMarker></NextUploadIdMarker><Prefix></Prefix><MaxUploads>1000</MaxUploads><IsTruncated>false</IsTruncated></ListMultipartUploadsResult>`},
		{"object size 0 is still reported", GetObjectAttributesResponse{ObjectSize: i64(0)}, h + `<GetObjectAttributesResponse` + nsAttr + `><ObjectSize>0</ObjectSize></GetObjectAttributesResponse>`},
		{"delete marker carries no ETag or Size", ListVersionsResult{Entries: []VersionEntry{{DeleteMarker: true, Key: "k", VersionID: "v", ETag: `"x"`, Size: 9, StorageClass: "STANDARD"}}}, h + `<ListVersionsResult` + nsAttr + `><Name></Name><Prefix></Prefix><KeyMarker></KeyMarker><VersionIdMarker></VersionIdMarker><MaxKeys>0</MaxKeys><IsTruncated>false</IsTruncated><DeleteMarker><Key>k</Key><VersionId>v</VersionId><IsLatest>false</IsLatest><LastModified>0001-01-01T00:00:00.000Z</LastModified></DeleteMarker></ListVersionsResult>`},
		{"logging", BucketLoggingStatus{}, h + `<BucketLoggingStatus` + nsAttr + `></BucketLoggingStatus>`},
		{"notification", NotificationConfiguration{}, h + `<NotificationConfiguration` + nsAttr + `></NotificationConfiguration>`},
		{"error has no namespace", ErrorDoc{Code: "AccessDenied", Message: "Access Denied"}, h + `<Error><Code>AccessDenied</Code><Message>Access Denied</Message></Error>`},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			got, err := Marshal(tc.v)
			if err != nil {
				t.Fatal(err)
			}
			if string(got) != tc.want {
				t.Fatalf("got\n%s\nwant\n%s", got, tc.want)
			}
		})
	}

	body, err := MarshalElement(CopyObjectResult{ETag: `"e"`})
	if err != nil || bytes.HasPrefix(body, []byte("<?xml")) || !bytes.HasPrefix(body, []byte(`<CopyObjectResult`+nsAttr+`>`)) {
		t.Fatalf("MarshalElement must omit the declaration: %s (%v)", body, err)
	}
}

func TestVersionEntriesKeepOrder(t *testing.T) {
	kinds := []bool{false, true, false, true, true, false} // DeleteMarker per entry
	var r ListVersionsResult
	for i, dm := range kinds {
		r.Entries = append(r.Entries, VersionEntry{DeleteMarker: dm, Key: string(rune('a' + i/2)), VersionID: string(rune('0' + i))})
	}
	r.CommonPrefixes = []CommonPrefix{{Prefix: "z/"}}
	out, err := Marshal(r)
	if err != nil {
		t.Fatal(err)
	}
	var names []string
	d := xml.NewDecoder(bytes.NewReader(out))
	depth := 0
	for {
		tok, err := d.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatal(err)
		}
		switch x := tok.(type) {
		case xml.StartElement:
			depth++
			if depth == 2 && (x.Name.Local == "Version" || x.Name.Local == "DeleteMarker" || x.Name.Local == "CommonPrefixes") {
				names = append(names, x.Name.Local)
			}
		case xml.EndElement:
			depth--
		}
	}
	want := []string{"Version", "DeleteMarker", "Version", "DeleteMarker", "DeleteMarker", "Version", "CommonPrefixes"}
	if !reflect.DeepEqual(names, want) {
		t.Fatalf("element order %v, want %v", names, want)
	}
	var back ListVersionsResult
	if err := Decode(bytes.NewReader(out), &back, 0); err != nil {
		t.Fatal(err)
	}
	for i, e := range back.Entries {
		if e.DeleteMarker != kinds[i] || e.VersionID != r.Entries[i].VersionID {
			t.Fatalf("entry %d: %+v", i, e)
		}
	}
}

func TestErrorDocuments(t *testing.T) {
	e := apierr.New("NoSuchKey", "The specified key does not exist.").WithExtra("Key", "bad\x01key").WithExtra("BucketName", "photos").
		WithExtra("Code", "Overridden").WithExtra("not a name", "x").WithExtra("RequestId", "spoofed")
	doc := FromAPIError(e, "REQ1", "/photos/bad\x01key")
	var back ErrorDoc
	if err := Decode(bytes.NewReader(doc), &back, 0); err != nil {
		t.Fatalf("FromAPIError output must always parse: %v\n%s", err, doc)
	}
	want := ErrorDoc{
		Code: "NoSuchKey", Message: "The specified key does not exist.",
		Extra:    map[string]string{"Key": "bad\xef\xbf\xbdkey", "BucketName": "photos"},
		Resource: "/photos/bad\xef\xbf\xbdkey", RequestID: "REQ1",
	}
	if !reflect.DeepEqual(back, want) {
		t.Fatalf("got  %#v\nwant %#v", back, want)
	}
	if !bytes.HasPrefix(doc, []byte(xml.Header+"<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message><Key>")) {
		t.Fatalf("order or namespace wrong:\n%s", doc)
	}

	// Bytes lets callers add the HostId (x-amz-id-2) and still never fails
	// where Marshal refuses.
	d := NewErrorDoc(apierr.New("SlowDown", "Please reduce your request rate."), "R2", "/photos")
	d.HostID = "node-b"
	d.Extra = map[string]string{"Key": "k\x03"}
	if _, err := Marshal(d); err == nil {
		t.Fatal("Marshal must refuse the control character")
	}
	var back2 ErrorDoc
	if err := Decode(bytes.NewReader(d.Bytes()), &back2, 0); err != nil || back2.HostID != "node-b" || back2.Extra["Key"] != "k\xef\xbf\xbd" {
		t.Fatalf("%+v (%v)", back2, err)
	}

	// A Resource on the error wins over the request's.
	e2 := apierr.New("NoSuchUpload", "The specified upload does not exist.")
	e2.Resource = "/photos/k?uploadId=1"
	if d := NewErrorDoc(e2, "R", "/photos/k"); d.Resource != "/photos/k?uploadId=1" || d.Code != "NoSuchUpload" {
		t.Fatalf("%+v", d)
	}
	// nil and code-less errors are InternalError.
	for _, in := range []*apierr.Error{nil, {Message: ""}} {
		var d ErrorDoc
		if err := Decode(bytes.NewReader(FromAPIError(in, "R", "/")), &d, 0); err != nil || d.Code != "InternalError" || d.Message == "" {
			t.Fatalf("%v: %+v (%v)", in, d, err)
		}
	}
	// Extras: well-known names in S3 order, then the rest sorted.
	names := ErrorDoc{Extra: map[string]string{"Zeta": "", "Alpha": "", "BucketName": "", "Key": "", "Condition": ""}}.extraNames()
	if want := []string{"Key", "BucketName", "Condition", "Alpha", "Zeta"}; !reflect.DeepEqual(names, want) {
		t.Fatalf("extra order %v, want %v", names, want)
	}
}

func TestValidate(t *testing.T) {
	objs := func(n int) Delete {
		d := Delete{}
		for i := 0; i < n; i++ {
			d.Objects = append(d.Objects, ObjectIdentifier{Key: "k"})
		}
		return d
	}
	parts := func(nums ...int) CompleteMultipartUpload {
		var c CompleteMultipartUpload
		for _, n := range nums {
			c.Parts = append(c.Parts, CompletedPart{PartNumber: n, ETag: `"e"`})
		}
		return c
	}
	tags := func(kv ...string) Tagging {
		var t Tagging
		for i := 0; i+1 < len(kv); i += 2 {
			t.TagSet = append(t.TagSet, Tag{Key: kv[i], Value: kv[i+1]})
		}
		return t
	}
	many := Tagging{}
	for i := 0; i < MaxTags+1; i++ {
		many.TagSet = append(many.TagSet, Tag{Key: string(rune('a' + i)), Value: "v"})
	}
	cases := []struct {
		name string
		err  error
		code string
	}{
		{"delete one", objs(1).Validate(), ""},
		{"delete 1000", objs(MaxDeleteObjects).Validate(), ""},
		{"delete none", objs(0).Validate(), "MalformedXML"},
		{"delete 1001", objs(MaxDeleteObjects + 1).Validate(), "MalformedXML"},
		{"complete ascending with gaps", parts(1, 2, 5, 10000).Validate(), ""},
		{"complete empty", parts().Validate(), "MalformedXML"},
		{"complete descending", parts(2, 1).Validate(), "InvalidPartOrder"},
		{"complete duplicate", parts(1, 1).Validate(), "InvalidPartOrder"},
		{"complete part 0", parts(0).Validate(), "InvalidArgument"},
		{"complete part 10001", parts(1, 10001).Validate(), "InvalidArgument"},
		{"tags ok", tags("a", "1", "b", "").Validate(), ""},
		{"tags none", Tagging{}.Validate(), ""},
		{"tags ten", Tagging{TagSet: many.TagSet[:MaxTags]}.Validate(), ""},
		{"tags eleven", many.Validate(), "InvalidTag"},
		{"tag key 128 runes", tags(strings.Repeat("\xc3\xbc", 128), "v").Validate(), ""},
		{"tag key 129", tags(strings.Repeat("k", 129), "v").Validate(), "InvalidTag"},
		{"tag key empty", tags("", "v").Validate(), "InvalidTag"},
		{"tag value 256 runes", tags("k", strings.Repeat("\xe2\x82\xac", 256)).Validate(), ""},
		{"tag value 257", tags("k", strings.Repeat("v", 257)).Validate(), "InvalidTag"},
		{"tag key repeated", tags("k", "1", "k", "2").Validate(), "InvalidTag"},
	}
	for _, tc := range cases {
		if code := codeOf(t, tc.err); code != tc.code {
			t.Errorf("%s: code %q, want %q", tc.name, code, tc.code)
		}
	}
}

func TestTaggingMap(t *testing.T) {
	in := map[string]string{"b": "2", "a": "1", "c": ""}
	tg := NewTagging(in)
	if want := []Tag{{"a", "1"}, {"b", "2"}, {"c", ""}}; !reflect.DeepEqual(tg.TagSet, want) {
		t.Fatalf("NewTagging sorts by key: %v", tg.TagSet)
	}
	if !reflect.DeepEqual(tg.Map(), in) {
		t.Fatalf("Map: %v", tg.Map())
	}
}

func TestACLOwnerOnly(t *testing.T) {
	stub := StubACL("photos", "photos")
	cases := []struct {
		name string
		p    AccessControlPolicy
		want bool
	}{
		{"stub", stub, true},
		{"no grants", AccessControlPolicy{Owner: Owner{ID: "photos"}}, true},
		{"owner READ without a type", AccessControlPolicy{AccessControlList: []Grant{{Grantee: Grantee{ID: "photos"}, Permission: "READ"}}}, true},
		{"another user", AccessControlPolicy{AccessControlList: []Grant{stub.AccessControlList[0], {Grantee: Grantee{Type: "CanonicalUser", ID: "other"}, Permission: "READ"}}}, false},
		{"AllUsers group", AccessControlPolicy{AccessControlList: []Grant{{Grantee: Grantee{Type: "Group", URI: "http://acs.amazonaws.com/groups/global/AllUsers"}, Permission: "READ"}}}, false},
		{"by e-mail", AccessControlPolicy{AccessControlList: []Grant{{Grantee: Grantee{Type: "AmazonCustomerByEmail", EmailAddress: "a@example.com"}, Permission: "READ"}}}, false},
	}
	for _, tc := range cases {
		if got := tc.p.OwnerOnly("photos"); got != tc.want {
			t.Errorf("%s: OwnerOnly = %v", tc.name, got)
		}
	}
}

// FuzzDecode: whatever the body, Decode returns nil or an *apierr.Error and
// never panics; whatever it accepts re-encodes.
func FuzzDecode(f *testing.F) {
	for _, s := range []string{
		`<Delete><Object><Key>a</Key><VersionId>v</VersionId></Object><Quiet>true</Quiet></Delete>`,
		`<Delete xmlns="http://s3.amazonaws.com/doc/2006-03-01/"><Object><Key>a&amp;b</Key></Object></Delete>`,
		`<!DOCTYPE x [<!ENTITY a "b">]><Delete/>`,
		"\xef\xbb\xbf<?xml version=\"1.0\"?><Delete/>",
		`<Delete><Object><Key>&#x1;</Key></Object></Delete>`,
		``,
	} {
		f.Add([]byte(s))
	}
	f.Fuzz(func(t *testing.T, body []byte) {
		var d Delete
		err := Decode(bytes.NewReader(body), &d, 1<<16)
		if err != nil {
			if _, ok := err.(*apierr.Error); !ok {
				t.Fatalf("error %T is not an *apierr.Error", err)
			}
			return
		}
		if _, err := Marshal(d); err != nil {
			t.Fatalf("re-encoding an accepted document: %v", err)
		}
	})
}

// A <Tag> needs both <Key> and <Value>, an <Object> of a Delete needs a <Key>:
// S3 answers MalformedXML for the document, not a per-entry or InvalidTag error.
func TestRequiredElementsOfRequestDocuments(t *testing.T) {
	tags := []struct{ name, body, code string }{
		{"tag with key and value", `<Tagging><TagSet><Tag><Key>a</Key><Value>1</Value></Tag></TagSet></Tagging>`, ""},
		{"tag with an empty value", `<Tagging><TagSet><Tag><Key>a</Key><Value></Value></Tag></TagSet></Tagging>`, ""},
		{"tag with a self-closed value", `<Tagging><TagSet><Tag><Key>a</Key><Value/></Tag></TagSet></Tagging>`, ""},
		{"tag without a value", `<Tagging><TagSet><Tag><Key>a</Key></Tag></TagSet></Tagging>`, "MalformedXML"},
		{"tag without a key", `<Tagging><TagSet><Tag><Value>1</Value></Tag></TagSet></Tagging>`, "MalformedXML"},
		{"empty tag", `<Tagging><TagSet><Tag/></TagSet></Tagging>`, "MalformedXML"},
		{"one good tag and one without a value", `<Tagging><TagSet><Tag><Key>a</Key><Value>1</Value></Tag><Tag><Key>b</Key></Tag></TagSet></Tagging>`, "MalformedXML"},
	}
	for _, tc := range tags {
		t.Run(tc.name, func(t *testing.T) {
			var d Tagging
			if code := codeOf(t, Decode(strings.NewReader(tc.body), &d, 0)); code != tc.code {
				t.Fatalf("code %q, want %q", code, tc.code)
			}
		})
	}
	objects := []struct{ name, body, code string }{
		{"object with a key", `<Delete><Object><Key>a</Key></Object></Delete>`, ""},
		{"object with an empty key is left to the per-entry validation", `<Delete><Object><Key></Key></Object></Delete>`, ""},
		{"object without a key", `<Delete><Object></Object></Delete>`, "MalformedXML"},
		{"object with only a version id", `<Delete><Object><VersionId>v</VersionId></Object></Delete>`, "MalformedXML"},
		{"good and keyless objects", `<Delete><Object><Key>a</Key></Object><Object/></Delete>`, "MalformedXML"},
	}
	for _, tc := range objects {
		t.Run(tc.name, func(t *testing.T) {
			var d Delete
			if code := codeOf(t, Decode(strings.NewReader(tc.body), &d, 0)); code != tc.code {
				t.Fatalf("code %q, want %q", code, tc.code)
			}
		})
	}
	var d Delete
	body := `<Delete><Quiet>true</Quiet><Object><Key>a</Key><VersionId>v1</VersionId><ETag>"e"</ETag><Size>5</Size></Object></Delete>`
	if err := Decode(strings.NewReader(body), &d, 0); err != nil {
		t.Fatal(err)
	}
	if !d.Quiet || len(d.Objects) != 1 || d.Objects[0].Key != "a" || d.Objects[0].VersionID != "v1" || d.Objects[0].ETag != `"e"` || d.Objects[0].Size == nil || *d.Objects[0].Size != 5 {
		t.Fatalf("%+v", d)
	}
}
