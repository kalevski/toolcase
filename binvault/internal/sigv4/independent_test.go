package sigv4

import (
	"bytes"
	"encoding/json"
	"net/http"
	"os"
	"strings"
	"testing"
	"time"
)

// testdata/vectors.json holds requests signed by independent implementations
// (aws-sdk-go-v2's v4 signer, botocore's S3SigV4Auth / S3SigV4QueryAuth /
// S3SigV4PostAuth, and aws-sdk-java-v2's AwsV4HttpSigner for aws-chunked
// bodies), generated once outside the repository with fixed credentials and
// time and embedded here as fixed strings. alt_request_uris are other wire
// spellings of the same request (non-canonical escapes, '+' for space in a
// query, reordered parameters), which must verify with the same signature.
type vector struct {
	Name        string      `json:"name"`
	Source      string      `json:"source"`
	Kind        string      `json:"kind"`
	Method      string      `json:"method"`
	Host        string      `json:"host"`
	RequestURI  string      `json:"request_uri"`
	AltURIs     []string    `json:"alt_request_uris"`
	Headers     [][2]string `json:"headers"`
	AccessKeyID string      `json:"access_key_id"`
	Region      string      `json:"region"`
	Now         string      `json:"now"`
	Signature   string      `json:"signature"`

	// post
	Policy     string `json:"policy"`
	Credential string `json:"credential"`
	AmzDate    string `json:"amz_date"`

	// stream: the body is chunk_lines with the payload (byte i = i%251) in
	// between, then tail after the final chunk's header line.
	PayloadLen int      `json:"payload_len"`
	ChunkLines []string `json:"chunk_lines"`
	Tail       string   `json:"tail"`
}

func loadVectors(t *testing.T) []vector {
	t.Helper()
	b, err := os.ReadFile("testdata/vectors.json")
	if err != nil {
		t.Fatal(err)
	}
	var vs []vector
	if err := json.Unmarshal(b, &vs); err != nil {
		t.Fatal(err)
	}
	if len(vs) < 15 {
		t.Fatalf("only %d vectors", len(vs))
	}
	return vs
}

func (v vector) now(t *testing.T) time.Time {
	n, err := time.Parse(time.RFC3339, v.Now)
	if err != nil {
		t.Fatal(err)
	}
	return n
}

func (v vector) request(uri string) *http.Request {
	var h []string
	for _, kv := range v.Headers {
		h = append(h, kv[0], kv[1])
	}
	return serverRequest(v.Method, v.Host, uri, h...)
}

func vectorPayload(n int) []byte {
	p := make([]byte, n)
	for i := range p {
		p[i] = byte(i % 251)
	}
	return p
}

func (v vector) body(t *testing.T) []byte {
	payload := vectorPayload(v.PayloadLen)
	var b bytes.Buffer
	off := 0
	for i, line := range v.ChunkLines {
		b.WriteString(line + "\r\n")
		if i == len(v.ChunkLines)-1 {
			break
		}
		var size int
		for _, c := range strings.SplitN(line, ";", 2)[0] {
			size = size<<4 | unhex(byte(c))
		}
		b.Write(payload[off : off+size])
		b.WriteString("\r\n")
		off += size
	}
	if off != len(payload) {
		t.Fatalf("chunks carry %d of %d bytes", off, len(payload))
	}
	b.WriteString(v.Tail)
	return b.Bytes()
}

// tailTrailers parses the trailer lines of a vector's tail.
func (v vector) tailTrailers() (http.Header, string) {
	h := http.Header{}
	sig := ""
	for _, line := range strings.Split(v.Tail, "\r\n") {
		name, value, ok := strings.Cut(line, ":")
		if !ok {
			continue
		}
		if name == trailerSigName {
			sig = value
			continue
		}
		h[name] = append(h[name], strings.TrimSpace(value))
	}
	return h, sig
}

func TestIndependentVectors(t *testing.T) {
	for _, v := range loadVectors(t) {
		t.Run(v.Name, func(t *testing.T) {
			now := v.now(t)
			switch v.Kind {
			case "header", "presigned":
				for _, uri := range append([]string{v.RequestURI}, v.AltURIs...) {
					res, err := verify(v.request(uri), awsKeys, at(now.Add(time.Second)))
					if err != nil {
						t.Fatalf("%s (%s): %v", uri, v.Source, err)
					}
					if res.Signature != v.Signature || res.Region != v.Region || res.AccessKeyID != v.AccessKeyID ||
						res.Presigned != (v.Kind == "presigned") {
						t.Fatalf("%s: result %+v", uri, res)
					}
				}
				if v.Kind == "header" {
					checkSignReproduces(t, v, now)
				} else {
					checkPresignReproduces(t, v, now)
				}
			case "post":
				res, err := VerifyPostPolicy(v.Policy, v.Credential, v.AmzDate, v.Signature, awsKeys, at(now))
				wantCode(t, err, "")
				if res.AccessKeyID != v.AccessKeyID || res.Region != v.Region || !bytes.Contains(res.Policy, []byte(`"expiration"`)) {
					t.Fatalf("result %+v", res)
				}
				cred, date, sig := SignPostPolicy(v.Policy, v.AccessKeyID, bvSecret, v.Region, now)
				if cred != v.Credential || date != v.AmzDate || sig != v.Signature {
					t.Fatalf("SignPostPolicy: %s %s %s", cred, date, sig)
				}
			case "stream":
				checkStreamVector(t, v, now)
			default:
				t.Fatalf("kind %q", v.Kind)
			}
		})
	}
}

// checkSignReproduces signs the same request with Sign, signing the same
// headers, and expects the same signature.
func checkSignReproduces(t *testing.T, v vector, now time.Time) {
	t.Helper()
	var signed string
	for _, kv := range v.Headers {
		if kv[0] == "Authorization" {
			signed = strings.Split(strings.Split(kv[1], "SignedHeaders=")[1], ",")[0]
		}
	}
	r := serverRequest(v.Method, v.Host, v.RequestURI)
	payload := ""
	for _, kv := range v.Headers {
		switch strings.ToLower(kv[0]) {
		case "authorization", "x-amz-date":
		case "x-amz-content-sha256":
			payload = kv[1]
		default:
			r.Header.Add(kv[0], kv[1])
		}
	}
	res, err := Sign(r, v.AccessKeyID, bvSecret, v.Region, now, payload, strings.Split(signed, ";")...)
	if err != nil {
		t.Fatal(err)
	}
	if res.Signature != v.Signature {
		t.Fatalf("Sign gives %s, %s gives %s", res.Signature, v.Source, v.Signature)
	}
}

// checkPresignReproduces presigns the request again when it signs host only.
func checkPresignReproduces(t *testing.T, v vector, now time.Time) {
	t.Helper()
	path, query, _ := strings.Cut(v.RequestURI, "?")
	var keep []string
	var expires time.Duration
	for _, p := range strings.Split(query, "&") {
		switch {
		case strings.HasPrefix(p, "X-Amz-SignedHeaders="):
			if p != "X-Amz-SignedHeaders=host" {
				return
			}
		case strings.HasPrefix(p, "X-Amz-Expires="):
			n, _ := parseExpires(strings.TrimPrefix(p, "X-Amz-Expires="))
			expires = time.Duration(n) * time.Second
		case strings.HasPrefix(p, "X-Amz-"):
		default:
			keep = append(keep, p)
		}
	}
	uri := path
	if len(keep) > 0 {
		uri += "?" + strings.Join(keep, "&")
	}
	r := serverRequest(v.Method, v.Host, uri)
	u, err := Presign(r, v.AccessKeyID, bvSecret, v.Region, now, expires)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.HasSuffix(u, "X-Amz-Signature="+v.Signature) {
		t.Fatalf("Presign gives %s, want signature %s", u, v.Signature)
	}
}

func checkStreamVector(t *testing.T, v vector, now time.Time) {
	t.Helper()
	body := v.body(t)
	r := v.request(v.RequestURI)
	if cl := r.Header.Get("Content-Length"); cl != itoa(int64(len(body))) {
		t.Fatalf("Content-Length %s, body %d", cl, len(body))
	}
	res, err := verify(r, awsKeys, at(now))
	wantCode(t, err, "")
	if res.Signature != v.Signature || res.Stream == StreamNone {
		t.Fatalf("result %+v", res)
	}
	sr := NewStreamReader(bytes.NewReader(body), res, 0)
	got, err := readAll(sr)
	wantCode(t, err, "")
	payload := vectorPayload(v.PayloadLen)
	if !bytes.Equal(got, payload) {
		t.Fatalf("decoded %d bytes, want %d", len(got), len(payload))
	}
	want, wantSig := v.tailTrailers()
	tr := sr.Trailer()
	for name, vals := range want {
		if len(tr[name]) != 1 || tr[name][0] != vals[0] {
			t.Fatalf("trailer %s = %q, want %q", name, tr[name], vals)
		}
	}

	// EncodeStream signs the same chunks and the same trailer. It writes
	// trailers sorted by name; the Java SDK writes them in insertion order, so
	// with several trailers only the signatures can be compared.
	enc := EncodeStream(res, res.Stream, payload, 128<<10, want)
	if len(want) <= 1 {
		if !bytes.Equal(enc, body) {
			t.Fatalf("EncodeStream differs from the %s body:\n%q\n%q", v.Source, tail(enc), tail(body))
		}
	} else {
		if wantSig != "" && !bytes.Contains(enc, []byte(trailerSigName+":"+wantSig+"\r\n")) {
			t.Fatalf("EncodeStream trailer signature differs: %q", tail(enc))
		}
		if _, err := readAll(NewStreamReader(bytes.NewReader(enc), res, 0)); err != nil {
			t.Fatal(err)
		}
	}
}

func tail(b []byte) []byte {
	if len(b) > 300 {
		return b[len(b)-300:]
	}
	return b
}
