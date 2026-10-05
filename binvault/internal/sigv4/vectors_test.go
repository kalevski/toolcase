package sigv4

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"hash/crc32"
	"net/http"
	"strings"
	"testing"
	"time"
)

// The S3 SigV4 examples of the AWS documentation ("Examples: Signature
// calculations", "Authenticating requests: using query parameters",
// "Signature calculations ... in multiple chunks"), with the documented
// credentials, date, bucket and region and the documented signatures.

func TestAWSHeaderVectors(t *testing.T) {
	emptyHash := EmptySHA256
	putHash := sha256Hex([]byte("Welcome to Amazon S3."))
	if putHash != "44ce7dd67c959e0d3524ffac1771dfbba87d2b6b4b4e99e42034a8b803f8b072" {
		t.Fatalf("payload hash of the PUT example: %s", putHash)
	}
	tests := []struct {
		name, method, uri string
		headers           []string
		signed, sig       string
		payload           string
	}{
		{
			name: "GET Object with Range", method: "GET", uri: "/test.txt",
			headers: []string{"Range", "bytes=0-9", "x-amz-content-sha256", emptyHash, "x-amz-date", "20130524T000000Z"},
			signed:  "host;range;x-amz-content-sha256;x-amz-date",
			sig:     "f0e8bdb87c964420e857bd35b5d6ed310bd44f0170aba48dd91039c6036bdb41",
			payload: emptyHash,
		},
		{
			name: "PUT Object, $ sent raw", method: "PUT", uri: "/test$file.text",
			headers: []string{"Date", "Fri, 24 May 2013 00:00:00 GMT", "x-amz-date", "20130524T000000Z",
				"x-amz-storage-class", "REDUCED_REDUNDANCY", "x-amz-content-sha256", putHash},
			signed:  "date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class",
			sig:     "98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd",
			payload: putHash,
		},
		{
			name: "PUT Object, $ sent encoded", method: "PUT", uri: "/test%24file.text",
			headers: []string{"Date", "Fri, 24 May 2013 00:00:00 GMT", "x-amz-date", "20130524T000000Z",
				"x-amz-storage-class", "REDUCED_REDUNDANCY", "x-amz-content-sha256", putHash},
			signed:  "date;host;x-amz-content-sha256;x-amz-date;x-amz-storage-class",
			sig:     "98ad721746da40c64f1a55b78f14c238d841ea1380cd77a1b5971af0ece108bd",
			payload: putHash,
		},
		{
			name: "GET Bucket lifecycle", method: "GET", uri: "/?lifecycle",
			headers: []string{"x-amz-date", "20130524T000000Z", "x-amz-content-sha256", emptyHash},
			signed:  "host;x-amz-content-sha256;x-amz-date",
			sig:     "fea454ca298b7da1c68078a5d1bdbfbbe0d65c699e0f91ac7a200a0136783543",
			payload: emptyHash,
		},
		{
			name: "GET Bucket (list objects)", method: "GET", uri: "/?max-keys=2&prefix=J",
			headers: []string{"x-amz-date", "20130524T000000Z", "x-amz-content-sha256", emptyHash},
			signed:  "host;x-amz-content-sha256;x-amz-date",
			sig:     "34b48302e7b5fa45bde8084f4b7868a86f0a534bc59db6670ed5711ef69dc6f7",
			payload: emptyHash,
		},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			h := append([]string{"Authorization", authHeader(awsAKID, awsScope, tc.signed, tc.sig)}, tc.headers...)
			r := serverRequest(tc.method, "examplebucket.s3.amazonaws.com", tc.uri, h...)
			res, err := verify(r, awsKeys, at(awsTime.Add(3*time.Minute)))
			wantCode(t, err, "")
			if res.Signature != tc.sig || res.AccessKeyID != awsAKID || res.Region != "us-east-1" ||
				res.Date != "20130524" || !res.AmzDate.Equal(awsTime) || res.PayloadHash != tc.payload ||
				res.Stream != StreamNone || res.Presigned {
				t.Fatalf("result %+v", res)
			}
			if got := hex.EncodeToString(res.SigningKey); got != hex.EncodeToString(deriveKey(awsSecret, "20130524", "us-east-1")) {
				t.Fatalf("signing key %s", got)
			}

			// Sign reproduces the documented signature from the same inputs.
			c := serverRequest(tc.method, "examplebucket.s3.amazonaws.com", tc.uri)
			var extra []string
			for i := 0; i < len(tc.headers); i += 2 {
				name := strings.ToLower(tc.headers[i])
				if name != "x-amz-date" && name != "x-amz-content-sha256" {
					c.Header.Set(tc.headers[i], tc.headers[i+1])
					extra = append(extra, name)
				}
			}
			sres, err := Sign(c, awsAKID, awsSecret, "us-east-1", awsTime, tc.payload, extra...)
			if err != nil {
				t.Fatal(err)
			}
			if sres.Signature != tc.sig {
				t.Fatalf("Sign: %s, want %s", sres.Signature, tc.sig)
			}
		})
	}
}

func TestAWSPresignedVector(t *testing.T) {
	const sig = "aeeed9bbccd4d02ee5c0109b86d86835f995330da4c265957d157751f604d404"
	const query = "X-Amz-Algorithm=AWS4-HMAC-SHA256" +
		"&X-Amz-Credential=AKIAIOSFODNN7EXAMPLE%2F20130524%2Fus-east-1%2Fs3%2Faws4_request" +
		"&X-Amz-Date=20130524T000000Z&X-Amz-Expires=86400&X-Amz-SignedHeaders=host"
	r := serverRequest("GET", "examplebucket.s3.amazonaws.com", "/test.txt?"+query+"&X-Amz-Signature="+sig)
	if k, err := Detect(r); err != nil || k != Presigned {
		t.Fatalf("Detect: %v %v", k, err)
	}
	if id, err := PeekAccessKey(r); err != nil || id != awsAKID {
		t.Fatalf("PeekAccessKey: %q %v", id, err)
	}
	// Valid a day long from its date, however long ago that was relative to
	// the skew window.
	for _, now := range []time.Time{awsTime.Add(-10 * time.Minute), awsTime, awsTime.Add(23 * time.Hour), awsTime.Add(24 * time.Hour)} {
		res, err := verify(r, awsKeys, at(now))
		wantCode(t, err, "")
		if res.Signature != sig || !res.Presigned || res.PayloadHash != UnsignedPayload ||
			!res.Expires.Equal(awsTime.Add(24*time.Hour)) || res.Stream != StreamNone {
			t.Fatalf("result %+v", res)
		}
	}
	_, err := verify(r, awsKeys, at(awsTime.Add(24*time.Hour+time.Second)))
	if e := wantCode(t, err, "AccessDenied"); e.Message != "Request has expired" {
		t.Fatalf("message %q", e.Message)
	}

	// Presign reproduces the documented URL.
	c, _ := http.NewRequest("GET", "https://examplebucket.s3.amazonaws.com/test.txt", nil)
	u, err := Presign(c, awsAKID, awsSecret, "us-east-1", awsTime, 86400*time.Second)
	if err != nil {
		t.Fatal(err)
	}
	if want := "https://examplebucket.s3.amazonaws.com/test.txt?" + query + "&X-Amz-Signature=" + sig; u != want {
		t.Fatalf("Presign:\n got %s\nwant %s", u, want)
	}
}

// awsChunkedExample is the PUT of the AWS streaming example: 66560 bytes of
// 'a' in 64 KiB chunks, STREAMING-AWS4-HMAC-SHA256-PAYLOAD.
func awsChunkedExample() *http.Request {
	return serverRequest("PUT", "s3.amazonaws.com", "/examplebucket/chunkObject.txt",
		"x-amz-date", "20130524T000000Z",
		"x-amz-storage-class", "REDUCED_REDUNDANCY",
		"Authorization", authHeader(awsAKID, awsScope,
			"content-encoding;content-length;host;x-amz-content-sha256;x-amz-date;x-amz-decoded-content-length;x-amz-storage-class",
			"4f232c4386841ef735655705268965c44a0e4690baa4adea153f7db9fa80a0a9"),
		"x-amz-content-sha256", StreamingPayload,
		"Content-Encoding", "aws-chunked",
		"x-amz-decoded-content-length", "66560",
		"Content-Length", "66824")
}

func awsChunkedBody() []byte {
	var b bytes.Buffer
	b.WriteString("10000;chunk-signature=ad80c730a21e5b8d04586a2213dd63b9a0e99e0e2307b0ade35a65485a288648\r\n")
	b.Write(repeat("a", 65536))
	b.WriteString("\r\n")
	b.WriteString("400;chunk-signature=0055627c9e194cb4542bae2aa5492e3c1575bbb81b612b7d234b86a503ef5497\r\n")
	b.Write(repeat("a", 1024))
	b.WriteString("\r\n")
	b.WriteString("0;chunk-signature=b6c6ea8a5354eaf15b3cb7646744f4275b71ea724fed81ceb9323e279d449df9\r\n\r\n")
	return b.Bytes()
}

func TestAWSStreamingVector(t *testing.T) {
	body := awsChunkedBody()
	if len(body) != 66824 {
		t.Fatalf("encoded length %d, want the documented 66824", len(body))
	}
	res, err := verify(awsChunkedExample(), awsKeys, at(awsTime))
	wantCode(t, err, "")
	if res.Stream != StreamSigned || res.Signature != "4f232c4386841ef735655705268965c44a0e4690baa4adea153f7db9fa80a0a9" {
		t.Fatalf("result %+v", res)
	}
	got, err := readAll(NewStreamReader(bytes.NewReader(body), res, 0))
	wantCode(t, err, "")
	if !bytes.Equal(got, repeat("a", 66560)) {
		t.Fatalf("decoded %d bytes", len(got))
	}
	// EncodeStream rebuilds the documented body byte for byte.
	if enc := EncodeStream(res, StreamSigned, repeat("a", 66560), 65536, nil); !bytes.Equal(enc, body) {
		t.Fatalf("EncodeStream differs from the documented body")
	}
}

// The trailer example of the AWS documentation ("Signature calculations for
// trailing headers"): the same 66560 bytes with a signed CRC32C trailer.
func TestAWSStreamingTrailerVector(t *testing.T) {
	const (
		seed     = "106e2a8a18243abcf37539882f36619c00e2dfc72633413f02d3b74544bfeb8e"
		trailSig = "d81f82fc3505edab99d459891051a732e8730629a2e4a59689829ca17fe2e435"
	)
	var sum [4]byte
	binary.BigEndian.PutUint32(sum[:], crc32.Checksum(repeat("a", 66560), crc32.MakeTable(crc32.Castagnoli)))
	crc := base64.StdEncoding.EncodeToString(sum[:])
	if crc != "sOO8/Q==" {
		t.Fatalf("CRC32C of the payload: %s", crc)
	}
	r := serverRequest("PUT", "s3.amazonaws.com", "/examplebucket/chunkObject.txt",
		"x-amz-date", "20130524T000000Z",
		"x-amz-storage-class", "REDUCED_REDUNDANCY",
		"Authorization", authHeader(awsAKID, awsScope,
			"content-encoding;host;x-amz-content-sha256;x-amz-date;x-amz-decoded-content-length;x-amz-storage-class;x-amz-trailer",
			seed),
		"x-amz-content-sha256", StreamingPayloadTrailer,
		"Content-Encoding", "aws-chunked",
		"x-amz-decoded-content-length", "66560",
		"x-amz-trailer", "x-amz-checksum-crc32c",
		"Content-Length", "66946")
	res, err := verify(r, awsKeys, at(awsTime))
	wantCode(t, err, "")
	if res.Signature != seed || res.Stream != StreamSignedTrailer {
		t.Fatalf("result %+v", res)
	}
	var b bytes.Buffer
	b.WriteString("10000;chunk-signature=b474d8862b1487a5145d686f57f013e54db672cee1c953b3010fb58501ef5aa2\r\n")
	b.Write(repeat("a", 65536))
	b.WriteString("\r\n")
	b.WriteString("400;chunk-signature=1c1344b170168f8e65b41376b44b20fe354e373826ccbbe2c1d40a8cae51e5c7\r\n")
	b.Write(repeat("a", 1024))
	b.WriteString("\r\n")
	b.WriteString("0;chunk-signature=2ca2aba2005185cf7159c6277faf83795951dd77a3a99e6e65d5c9f85863f992\r\n")
	b.WriteString("x-amz-checksum-crc32c:" + crc + "\r\n")
	b.WriteString("x-amz-trailer-signature:" + trailSig + "\r\n\r\n")
	if b.Len() != 66946 {
		t.Fatalf("encoded length %d, want the documented 66946", b.Len())
	}
	sr := NewStreamReader(bytes.NewReader(b.Bytes()), res, 0)
	got, err := readAll(sr)
	wantCode(t, err, "")
	if !bytes.Equal(got, repeat("a", 66560)) {
		t.Fatalf("decoded %d bytes", len(got))
	}
	if v := sr.Trailer()["x-amz-checksum-crc32c"]; len(v) != 1 || v[0] != crc {
		t.Fatalf("trailer %v", sr.Trailer())
	}
	enc := EncodeStream(res, StreamSignedTrailer, repeat("a", 66560), 65536, http.Header{"X-Amz-Checksum-Crc32c": {crc}})
	if !bytes.Equal(enc, b.Bytes()) {
		t.Fatalf("EncodeStream differs from the documented body")
	}
}
