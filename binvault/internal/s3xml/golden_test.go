package s3xml

import (
	"bytes"
	"encoding/xml"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"reflect"
	"sort"
	"strings"
	"testing"
	"time"
)

func ts(s string) Time {
	t, err := time.Parse(time.RFC3339Nano, s)
	if err != nil {
		panic(err)
	}
	return Time(t)
}

func i64(v int64) *int64 { return &v }

var bucketOwner = Owner{ID: "photos", DisplayName: "photos"}

// goldenCases pairs each response value with its hand-written S3-style
// document in testdata/. The documents follow the AWS S3 API reference.
func goldenCases() []struct {
	file  string
	value any
} {
	urlListing := ListBucketResultV2{
		Name: "photos", Prefix: "my docs/", StartAfter: "my docs/a+a.txt", KeyCount: 3, MaxKeys: 1000, Delimiter: "/",
		Contents: []Object{
			{Key: "my docs/b c+d.txt", LastModified: ts("2026-09-30T08:15:00Z"), ETag: `"d41d8cd98f00b204e9800998ecf8427e"`, StorageClass: StorageClassStandard},
			{Key: "my docs/ctl\x01key~(1)_\xc3\xbc*.png", LastModified: ts("2026-09-30T08:15:00Z"), ETag: `"d41d8cd98f00b204e9800998ecf8427e"`, StorageClass: StorageClassStandard},
		},
		CommonPrefixes: []CommonPrefix{{Prefix: "my docs/sub%dir/"}},
	}
	urlListing.EncodeURL()

	return []struct {
		file  string
		value any
	}{
		{"error.xml", ErrorDoc{
			Code: "NoSuchKey", Message: "The specified key does not exist.",
			Extra:    map[string]string{"BucketName": "photos", "Key": "a.png"},
			Resource: "/photos/a.png", RequestID: "01J9ZQ6M3V8Q2T4X5Y6Z7A8B9C", HostID: "bv-node-a",
		}},
		{"list_buckets.xml", ListAllMyBucketsResult{
			Owner:   bucketOwner,
			Buckets: []Bucket{{Name: "photos", CreationDate: ts("2026-01-15T10:00:00Z")}},
		}},
		{"list_objects_v1.xml", ListBucketResult{
			Name: "photos", Prefix: "2026/", NextMarker: "2026/albums/", MaxKeys: 2, Delimiter: "/", IsTruncated: true,
			Contents: []Object{{
				Key: "2026/a.jpg", LastModified: ts("2009-10-12T17:50:30Z"), ETag: `"fba9dede5f27731c9771645a39863328"`,
				Size: 434234, Owner: &bucketOwner, StorageClass: StorageClassStandard,
			}},
			CommonPrefixes: []CommonPrefix{{Prefix: "2026/albums/"}},
		}},
		{"list_objects_v2.xml", ListBucketResultV2{
			Name: "photos", StartAfter: "a.jpg", ContinuationToken: "MS9hLmpwZw==", NextContinuationToken: "MS9hbGJ1bXMv",
			KeyCount: 3, MaxKeys: 3, Delimiter: "/", IsTruncated: true,
			Contents: []Object{
				{Key: "b.jpg", LastModified: ts("2026-09-30T08:15:00.000Z"), ETag: `"d41d8cd98f00b204e9800998ecf8427e"`,
					ChecksumAlgorithm: []string{"CRC32"}, ChecksumType: "FULL_OBJECT", StorageClass: StorageClassStandard},
				{Key: "c & d <e>.jpg", LastModified: ts("2026-09-30T08:16:00Z"), ETag: `"3858f62230ac3c915f300c664312c11f-9"`,
					Size: 47185920, StorageClass: StorageClassStandard},
			},
			CommonPrefixes: []CommonPrefix{{Prefix: "albums/"}},
		}},
		{"list_objects_v2_url.xml", urlListing},
		{"list_versions.xml", ListVersionsResult{
			Name: "photos", NextKeyMarker: "b.jpg", NextVersionIDMarker: "null", MaxKeys: 5, IsTruncated: true,
			Entries: []VersionEntry{
				{Key: "a.jpg", VersionID: "01J9ZQ6M3V8Q2T4X5Y6Z7A8B9C", IsLatest: true, LastModified: ts("2026-09-30T08:15:00Z"),
					ETag: `"fba9dede5f27731c9771645a39863328"`, ChecksumAlgorithm: []string{"CRC32"}, Size: 434234,
					Owner: &bucketOwner, StorageClass: StorageClassStandard},
				{DeleteMarker: true, Key: "a.jpg", VersionID: "01J9ZP0000000000000000000B", LastModified: ts("2026-09-29T08:15:00Z"), Owner: &bucketOwner},
				{Key: "a.jpg", VersionID: "01J9ZN0000000000000000000A", LastModified: ts("2026-09-28T08:15:00Z"),
					ETag: `"d41d8cd98f00b204e9800998ecf8427e"`, Owner: &bucketOwner, StorageClass: StorageClassStandard},
				{DeleteMarker: true, Key: "b.jpg", VersionID: "01J9ZR0000000000000000000D", IsLatest: true, LastModified: ts("2026-09-30T09:00:00Z"), Owner: &bucketOwner},
				{Key: "b.jpg", VersionID: "null", LastModified: ts("2026-01-15T10:00:00Z"), ETag: `"3858f62230ac3c915f300c664312c11f-9"`,
					Size: 47185920, Owner: &bucketOwner, StorageClass: StorageClassStandard},
			},
		}},
		{"copy_object.xml", CopyObjectResult{
			LastModified: ts("2026-09-30T08:15:00.000Z"), ETag: `"9b2cf535f27731c974343645a3985328"`,
			ChecksumType: "FULL_OBJECT", Checksums: Checksums{CRC32: "i9aeUg=="},
		}},
		{"copy_part.xml", CopyPartResult{LastModified: ts("2026-09-30T08:15:00Z"), ETag: `"b54357faf0632cce46e942fa68356b38"`}},
		{"initiate_multipart.xml", InitiateMultipartUploadResult{
			Bucket: "photos", Key: "big file.bin", UploadID: "VXBsb2FkIElEIGZvciBlbHZpbmcncyBteS1tb3ZpZS5tMnRzIHVwbG9hZA",
		}},
		{"complete_multipart.xml", CompleteMultipartUploadResult{
			Location: "http://localhost:9000/photos/big%20file.bin", Bucket: "photos", Key: "big file.bin",
			ETag: `"3858f62230ac3c915f300c664312c11f-9"`, Checksums: Checksums{CRC32: "1yHzVQ==-9"}, ChecksumType: "COMPOSITE",
		}},
		{"list_parts.xml", ListPartsResult{
			Bucket: "photos", Key: "big file.bin", UploadID: "VXBsb2FkIElEIGZvciBlbHZpbmcncyBteS1tb3ZpZS5tMnRzIHVwbG9hZA",
			Initiator: bucketOwner, Owner: bucketOwner, StorageClass: StorageClassStandard,
			PartNumberMarker: 1, NextPartNumberMarker: 3, MaxParts: 2, IsTruncated: true,
			Parts: []Part{
				{PartNumber: 2, LastModified: ts("2010-11-10T20:48:34Z"), ETag: `"7778aef83f66abc1fa1e8477f296d394"`, Size: 10485760, Checksums: Checksums{CRC32: "AAAAAA=="}},
				{PartNumber: 3, LastModified: ts("2010-11-10T20:48:33Z"), ETag: `"aaaa18db4cc2f85cedef654fccc4a4x8"`, Size: 10485760, Checksums: Checksums{CRC32: "AAAAAQ=="}},
			},
			ChecksumAlgorithm: "CRC32", ChecksumType: "COMPOSITE",
		}},
		{"list_uploads.xml", ListMultipartUploadsResult{
			Bucket: "photos", NextKeyMarker: "videos/b.mp4", NextUploadIDMarker: "YW55IGlkZWEgd2h5IGVsdmluZydzIHVwbG9hZCBmYWlsZWQ",
			Delimiter: "/", Prefix: "videos/", MaxUploads: 2, IsTruncated: true,
			Uploads: []Upload{
				{Key: "videos/a.mp4", UploadID: "XMgbGlrZSBlbHZpbmcncyBub3QgaGF2aW5nIG11Y2ggbHVjaw", Initiator: bucketOwner, Owner: bucketOwner,
					StorageClass: StorageClassStandard, Initiated: ts("2010-11-10T20:48:33Z")},
				{Key: "videos/b.mp4", UploadID: "YW55IGlkZWEgd2h5IGVsdmluZydzIHVwbG9hZCBmYWlsZWQ", Initiator: bucketOwner, Owner: bucketOwner,
					StorageClass: StorageClassStandard, Initiated: ts("2010-11-10T20:49:33Z"), ChecksumAlgorithm: "CRC32", ChecksumType: "FULL_OBJECT"},
			},
			CommonPrefixes: []CommonPrefix{{Prefix: "videos/raw/"}},
		}},
		{"delete_result.xml", DeleteResult{
			Deleted: []DeletedObject{
				{Key: "a.jpg"},
				{Key: "b.jpg", DeleteMarker: true, DeleteMarkerVersionID: "01J9ZR0000000000000000000D"},
				{Key: "c.jpg", VersionID: "01J9ZN0000000000000000000A"},
			},
			Errors: []DeleteError{
				{Key: "secret/d.jpg", Code: "AccessDenied", Message: "Access Denied"},
				{Key: "e.jpg", VersionID: "01J9ZP0000000000000000000B", Code: "PipelineTimeout", Message: "A before pipeline did not answer in time."},
			},
		}},
		{"tagging.xml", NewTagging(map[string]string{"team": "r&d", "scan": "clean"})},
		{"versioning.xml", VersioningConfiguration{Status: "Enabled"}},
		{"encryption.xml", SSES3Config()},
		{"lifecycle.xml", LifecycleXML([]LifecycleRule{
			{ID: "scratch", Enabled: true, Prefix: "tmp/", ExpireDays: 2, AbortMultipartDays: 1},
			{ID: "history", Enabled: true, NoncurrentDays: 30, NoncurrentKeep: 5, ExpireDeleteMarkers: true},
			{ID: "big-logs", Prefix: "logs/", Tags: map[string]string{"team": "core", "env": "prod"}, MinSize: 1024, MaxSize: 52428800,
				ExpireDays: 7, ExpireDeleteMarkers: true, NoncurrentDays: 1},
		})},
		{"cors.xml", CORSXML([]CORSRule{
			{AllowedHeaders: []string{"*"}, AllowedMethods: []string{"GET", "PUT", "HEAD"}, AllowedOrigins: []string{"https://app.example.com"},
				ExposeHeaders: []string{"ETag", "x-amz-checksum-crc32"}, MaxAgeSeconds: 3000},
			{ID: "uploads", AllowedMethods: []string{"POST"}, AllowedOrigins: []string{"*"}},
		})},
		{"location.xml", LocationConstraint{Region: "eu-west-1"}},
		{"acl.xml", StubACL("photos", "photos")},
		{"post_response.xml", PostResponse{
			Location: "http://localhost:9000/photos/uploads%2Fcat.jpg", Bucket: "photos", Key: "uploads/cat.jpg",
			ETag: `"fba9dede5f27731c9771645a39863328"`,
		}},
		{"object_attributes.xml", GetObjectAttributesResponse{
			ETag:     "3858f62230ac3c915f300c664312c11f-2",
			Checksum: &ObjectChecksum{Checksums: Checksums{CRC32: "1yHzVQ==-2"}, ChecksumType: "COMPOSITE"},
			ObjectParts: &ObjectParts{TotalPartsCount: 2, NextPartNumberMarker: 2, MaxParts: 1000, Parts: []ObjectPart{
				{PartNumber: 1, Size: 5242880, Checksums: Checksums{CRC32: "AAAAAA=="}},
				{PartNumber: 2, Size: 10, Checksums: Checksums{CRC32: "AAAAAQ=="}},
			}},
			StorageClass: StorageClassStandard, ObjectSize: i64(5242890),
		}},
		{"request_payment.xml", RequestPaymentConfiguration{Payer: "BucketOwner"}},
	}
}

func TestGoldenResponses(t *testing.T) {
	for _, tc := range goldenCases() {
		t.Run(tc.file, func(t *testing.T) {
			want, err := os.ReadFile(filepath.Join("testdata", tc.file))
			if err != nil {
				t.Fatal(err)
			}
			got, err := Marshal(tc.value)
			if err != nil {
				t.Fatalf("Marshal: %v", err)
			}

			// Byte-level framing: declaration, newline, compact root with
			// xmlns exactly where S3 puts it (never on <Error>).
			root := reflect.TypeOf(tc.value).Name()
			if start, ok := rootStart(reflect.TypeOf(tc.value)); ok {
				root = start.Name.Local
			} else if root == "ErrorDoc" {
				root = "Error"
			}
			prefix := xml.Header + "<" + root
			if root != "Error" {
				prefix += ` xmlns="` + NS + `"`
			}
			if !bytes.HasPrefix(got, []byte(prefix+">")) {
				t.Fatalf("output does not start with %q:\n%s", prefix+">", got)
			}
			if n := bytes.Count(got, []byte("\n")); n != 1 {
				t.Fatalf("want compact output (one newline after the declaration), got %d newlines", n)
			}

			if diff := diffCanon(t, canon(t, want), canon(t, got)); diff != "" {
				t.Fatalf("document differs from testdata/%s:\n%s\ngot:\n%s", tc.file, diff, got)
			}

			// The golden document decodes back into the same value.
			back := reflect.New(reflect.TypeOf(tc.value))
			if err := Decode(bytes.NewReader(want), back.Interface(), 0); err != nil {
				t.Fatalf("Decode(testdata/%s): %v", tc.file, err)
			}
			if gotV, wantV := clearXMLName(back.Elem()), clearXMLName(reflect.ValueOf(tc.value)); !reflect.DeepEqual(gotV, wantV) {
				t.Fatalf("decoded value differs:\n got %#v\nwant %#v", gotV, wantV)
			}
		})
	}
}

// canon reduces a document to a comparable token list: resolved names,
// sorted attributes (namespace declarations included), leaf text, no
// indentation, comments or declaration.
func canon(t *testing.T, doc []byte) []string {
	t.Helper()
	d := xml.NewDecoder(bytes.NewReader(doc))
	var toks []xml.Token
	for {
		tok, err := d.Token()
		if err == io.EOF {
			break
		}
		if err != nil {
			t.Fatalf("canon: %v\n%s", err, doc)
		}
		toks = append(toks, xml.CopyToken(tok))
	}
	var out []string
	for i, tok := range toks {
		switch x := tok.(type) {
		case xml.StartElement:
			attrs := make([]string, 0, len(x.Attr))
			for _, a := range x.Attr {
				attrs = append(attrs, fmt.Sprintf("%s|%s=%q", a.Name.Space, a.Name.Local, a.Value))
			}
			sort.Strings(attrs)
			out = append(out, fmt.Sprintf("<{%s}%s %s>", x.Name.Space, x.Name.Local, strings.Join(attrs, " ")))
		case xml.EndElement:
			out = append(out, fmt.Sprintf("</{%s}%s>", x.Name.Space, x.Name.Local))
		case xml.CharData:
			_, afterStart := prevTok(toks, i).(xml.StartElement)
			_, beforeEnd := nextTok(toks, i).(xml.EndElement)
			if len(bytes.TrimSpace(x)) == 0 && !(afterStart && beforeEnd) {
				continue // indentation
			}
			out = append(out, fmt.Sprintf("%q", string(x)))
		}
	}
	return out
}

func prevTok(toks []xml.Token, i int) xml.Token {
	if i == 0 {
		return nil
	}
	return toks[i-1]
}

func nextTok(toks []xml.Token, i int) xml.Token {
	if i+1 >= len(toks) {
		return nil
	}
	return toks[i+1]
}

func diffCanon(t *testing.T, want, got []string) string {
	t.Helper()
	for i := 0; i < len(want) || i < len(got); i++ {
		var w, g string
		if i < len(want) {
			w = want[i]
		}
		if i < len(got) {
			g = got[i]
		}
		if w != g {
			return fmt.Sprintf("token %d:\n want %s\n  got %s", i, w, g)
		}
	}
	return ""
}

// clearXMLName returns a copy of v with any top-level XMLName zeroed: the
// decoder records the root name, a hand-built value leaves it empty.
func clearXMLName(v reflect.Value) any {
	c := reflect.New(v.Type()).Elem()
	c.Set(v)
	if c.Kind() == reflect.Struct {
		if f := c.FieldByName("XMLName"); f.IsValid() && f.Type() == xmlNameType {
			f.Set(reflect.Zero(xmlNameType))
		}
	}
	return c.Interface()
}
