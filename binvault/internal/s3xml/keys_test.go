package s3xml

import (
	"encoding/xml"
	"net/url"
	"reflect"
	"testing"
	"time"
)

func TestEncodeKey(t *testing.T) {
	cases := []struct {
		in, want string
	}{
		{"", ""},
		{"photos/2006/a.jpg", "photos/2006/a.jpg"},
		{"AZaz09-_.*/", "AZaz09-_.*/"},
		{"a b", "a%20b"},
		{"a+b", "a%2Bb"},
		{"100%", "100%25"},
		{"test_file(3).png", "test_file%283%29.png"},
		{"~user/x", "%7Euser/x"},
		{"q?x=1&y=2#f", "q%3Fx%3D1%26y%3D2%23f"},
		{"a\x01b\x7f", "a%01b%7F"},
		{"tab\tnl\ncr\r", "tab%09nl%0Acr%0D"},
		{`"quoted" 'single' <tag>`, "%22quoted%22%20%27single%27%20%3Ctag%3E"},
		{"\xc3\xbc", "%C3%BC"},
		{"\xf0\x9f\x98\x80/emoji", "%F0%9F%98%80/emoji"},
		{"bad\xff", "bad%FF"},
		{"a//b/", "a//b/"},
		{",;:@!$'()=", "%2C%3B%3A%40%21%24%27%28%29%3D"},
	}
	for _, tc := range cases {
		got := EncodeKey(tc.in, true)
		if got != tc.want {
			t.Errorf("EncodeKey(%q) = %q, want %q", tc.in, got, tc.want)
		}
		if EncodeKey(tc.in, false) != tc.in {
			t.Errorf("EncodeKey(%q, false) must not change the key", tc.in)
		}
		if !ValidXMLText(got) {
			t.Errorf("EncodeKey(%q) = %q is not valid XML text", tc.in, got)
		}
		// Every decoder SDK users reach for gets the key back: botocore's
		// unquote_plus and Go's QueryUnescape ('+' is space) as well as
		// PathUnescape and decodeURIComponent (it is not).
		for name, unescape := range map[string]func(string) (string, error){
			"QueryUnescape": url.QueryUnescape, "PathUnescape": url.PathUnescape,
		} {
			if back, err := unescape(got); err != nil || back != tc.in {
				t.Errorf("%s(%q) = %q, %v; want %q", name, got, back, err, tc.in)
			}
		}
	}
}

// TestEncodeURL checks each listing encodes exactly the fields S3 encodes
// for encoding-type=url, and leaves tokens and ids alone.
func TestEncodeURL(t *testing.T) {
	const raw, enc = "a b+", "a%20b%2B"
	const token = "tok en+/="

	v1 := ListBucketResult{Prefix: raw, Delimiter: raw, Marker: raw, NextMarker: raw,
		Contents: []Object{{Key: raw}}, CommonPrefixes: []CommonPrefix{{Prefix: raw}}}
	v1.EncodeURL()
	want1 := ListBucketResult{EncodingType: "url", Prefix: enc, Delimiter: enc, Marker: enc, NextMarker: enc,
		Contents: []Object{{Key: enc}}, CommonPrefixes: []CommonPrefix{{Prefix: enc}}}

	v2 := ListBucketResultV2{Prefix: raw, Delimiter: raw, StartAfter: raw, ContinuationToken: token, NextContinuationToken: token,
		Contents: []Object{{Key: raw}}, CommonPrefixes: []CommonPrefix{{Prefix: raw}}}
	v2.EncodeURL()
	want2 := ListBucketResultV2{EncodingType: "url", Prefix: enc, Delimiter: enc, StartAfter: enc, ContinuationToken: token, NextContinuationToken: token,
		Contents: []Object{{Key: enc}}, CommonPrefixes: []CommonPrefix{{Prefix: enc}}}

	vs := ListVersionsResult{Prefix: raw, Delimiter: raw, KeyMarker: raw, NextKeyMarker: raw, VersionIDMarker: token, NextVersionIDMarker: token,
		Entries: []VersionEntry{{Key: raw, VersionID: token}, {DeleteMarker: true, Key: raw, VersionID: token}}, CommonPrefixes: []CommonPrefix{{Prefix: raw}}}
	vs.EncodeURL()
	wantVs := ListVersionsResult{EncodingType: "url", Prefix: enc, Delimiter: enc, KeyMarker: enc, NextKeyMarker: enc, VersionIDMarker: token, NextVersionIDMarker: token,
		Entries: []VersionEntry{{Key: enc, VersionID: token}, {DeleteMarker: true, Key: enc, VersionID: token}}, CommonPrefixes: []CommonPrefix{{Prefix: enc}}}

	up := ListMultipartUploadsResult{Bucket: raw, Prefix: raw, Delimiter: raw, KeyMarker: raw, NextKeyMarker: raw, UploadIDMarker: token, NextUploadIDMarker: token,
		Uploads: []Upload{{Key: raw, UploadID: token}}, CommonPrefixes: []CommonPrefix{{Prefix: raw}}}
	up.EncodeURL()
	wantUp := ListMultipartUploadsResult{EncodingType: "url", Bucket: raw, Prefix: enc, Delimiter: enc, KeyMarker: enc, NextKeyMarker: enc, UploadIDMarker: token, NextUploadIDMarker: token,
		Uploads: []Upload{{Key: enc, UploadID: token}}, CommonPrefixes: []CommonPrefix{{Prefix: enc}}}

	for _, c := range []struct{ got, want any }{{v1, want1}, {v2, want2}, {vs, wantVs}, {up, wantUp}} {
		if !reflect.DeepEqual(c.got, c.want) {
			t.Errorf("got  %#v\nwant %#v", c.got, c.want)
		}
	}
}

func TestETags(t *testing.T) {
	quoted := []struct{ in, want string }{
		{"d41d8cd98f00b204e9800998ecf8427e", `"d41d8cd98f00b204e9800998ecf8427e"`},
		{"3858f62230ac3c915f300c664312c11f-9", `"3858f62230ac3c915f300c664312c11f-9"`},
		{`"3858f62230ac3c915f300c664312c11f-9"`, `"3858f62230ac3c915f300c664312c11f-9"`},
		{`W/"abc"`, `W/"abc"`},
		{"", `""`},
		{`"`, `"""`},
	}
	for _, tc := range quoted {
		if got := ETagQuoted(tc.in); got != tc.want {
			t.Errorf("ETagQuoted(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
	unquoted := []struct{ in, want string }{
		{`"d41d8cd98f00b204e9800998ecf8427e"`, "d41d8cd98f00b204e9800998ecf8427e"},
		{"d41d8cd98f00b204e9800998ecf8427e", "d41d8cd98f00b204e9800998ecf8427e"},
		{` "abc-2" `, "abc-2"},
		{`""`, ""},
		{`"`, `"`},
	}
	for _, tc := range unquoted {
		if got := ETagUnquoted(tc.in); got != tc.want {
			t.Errorf("ETagUnquoted(%q) = %q, want %q", tc.in, got, tc.want)
		}
	}
}

func TestHTTPDate(t *testing.T) {
	at := time.Date(1994, 11, 6, 8, 49, 37, 0, time.UTC)
	if got := HTTPDate(at.In(time.FixedZone("CEST", 2*3600))); got != "Sun, 06 Nov 1994 08:49:37 GMT" {
		t.Fatalf("HTTPDate = %q", got)
	}
	ok := []string{
		"Sun, 06 Nov 1994 08:49:37 GMT",  // IMF-fixdate
		"Sunday, 06-Nov-94 08:49:37 GMT", // RFC 850
		"Sun Nov  6 08:49:37 1994",       // asctime
		"Sun, 6 Nov 1994 08:49:37 GMT",
		"Sun, 06 Nov 1994 08:49:37 UTC",
		"Sun, 06 Nov 1994 09:49:37 +0100",
		"  Sun, 06 Nov 1994 08:49:37 GMT ",
	}
	for _, s := range ok {
		got, valid := ParseHTTPDate(s)
		if !valid || !got.Equal(at) || got.Location() != time.UTC {
			t.Errorf("ParseHTTPDate(%q) = %v, %v", s, got, valid)
		}
	}
	for _, s := range []string{"", "yesterday", "1994-11-06T08:49:37Z", "Sun, 06 Nov 1994 08:49:37 EST", "Sun, 32 Nov 1994 08:49:37 GMT"} {
		if _, valid := ParseHTTPDate(s); valid {
			t.Errorf("ParseHTTPDate(%q) accepted", s)
		}
	}
}

func TestTime(t *testing.T) {
	type doc struct {
		XMLName xml.Name `xml:"D"`
		At      Time     `xml:"At"`
		Opt     *Time    `xml:"Opt,omitempty"`
	}
	marshal := []struct {
		in   time.Time
		want string
	}{
		{time.Date(2009, 10, 12, 17, 50, 30, 0, time.UTC), "2009-10-12T17:50:30.000Z"},
		{time.Date(2026, 9, 30, 8, 15, 0, 123456789, time.UTC), "2026-09-30T08:15:00.000Z"}, // whole seconds like S3, truncated, not rounded
		{time.Date(2026, 9, 30, 10, 15, 0, 999999999, time.FixedZone("CEST", 2*3600)), "2026-09-30T08:15:00.000Z"},
		{time.Date(2026, 9, 30, 8, 15, 59, 999000000, time.UTC), "2026-09-30T08:15:59.000Z"},
		{time.Time{}, "0001-01-01T00:00:00.000Z"},
	}
	for _, tc := range marshal {
		out, err := xml.Marshal(doc{At: Time(tc.in)})
		if err != nil {
			t.Fatal(err)
		}
		if want := "<D><At>" + tc.want + "</At></D>"; string(out) != want {
			t.Errorf("%v: %s, want %s", tc.in, out, want)
		}
		if Time(tc.in).String() != tc.want {
			t.Errorf("String() = %s", Time(tc.in).String())
		}
	}

	parse := []struct {
		in   string
		want time.Time
	}{
		{"2009-10-12T17:50:30.000Z", time.Date(2009, 10, 12, 17, 50, 30, 0, time.UTC)},
		{"2009-10-12T17:50:30Z", time.Date(2009, 10, 12, 17, 50, 30, 0, time.UTC)},
		{"2009-10-12T17:50:30.5Z", time.Date(2009, 10, 12, 17, 50, 30, 500000000, time.UTC)},
		{"2009-10-12T19:50:30+02:00", time.Date(2009, 10, 12, 17, 50, 30, 0, time.UTC)},
		{"2009-10-12T17:50:30.123456789Z", time.Date(2009, 10, 12, 17, 50, 30, 123456789, time.UTC)},
		{"2009-10-12T17:50:30", time.Date(2009, 10, 12, 17, 50, 30, 0, time.UTC)},
		{" 2009-10-12T17:50:30Z\n", time.Date(2009, 10, 12, 17, 50, 30, 0, time.UTC)},
		{"", time.Time{}},
	}
	for _, tc := range parse {
		var d doc
		if err := xml.Unmarshal([]byte("<D><At>"+tc.in+"</At><Opt>"+tc.in+"</Opt></D>"), &d); err != nil {
			t.Errorf("%q: %v", tc.in, err)
			continue
		}
		if got := time.Time(d.At); !got.Equal(tc.want) || got.Location() != time.UTC {
			t.Errorf("%q parsed as %v, want %v", tc.in, got, tc.want)
		}
		if d.Opt == nil || !time.Time(*d.Opt).Equal(tc.want) {
			t.Errorf("%q: pointer field %v", tc.in, d.Opt)
		}
	}
	for _, bad := range []string{"yesterday", "2009-13-12T17:50:30Z", "Mon, 12 Oct 2009 17:50:30 GMT"} {
		var d doc
		if err := xml.Unmarshal([]byte("<D><At>"+bad+"</At></D>"), &d); err == nil {
			t.Errorf("%q accepted", bad)
		}
	}
	if out, _ := xml.Marshal(doc{}); string(out) != "<D><At>0001-01-01T00:00:00.000Z</At></D>" {
		t.Errorf("nil *Time must be omitted: %s", out)
	}
}
