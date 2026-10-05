package sigv4

import (
	"bytes"
	"io"
	"math/rand"
	"net/http"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

// Hostile input must never panic, never yield more bytes than it holds, and
// only fail with S3 errors. `go test -fuzz=FuzzStreamReader` explores further;
// the seeds and TestStreamRandomInput run on every `go test`.

const fuzzMaxChunk = 1 << 12

func streamSeeds(t testing.TB) (map[StreamMode]*Result, [][]byte) {
	res := map[StreamMode]*Result{}
	var seeds [][]byte
	for _, m := range streamModes {
		res[m] = streamResult(t, m)
		for _, n := range []int{0, 5, 70} {
			seeds = append(seeds, EncodeStream(res[m], m, payloadOf(n), 32,
				http.Header{"x-amz-checksum-crc32": {crc32b64(payloadOf(n))}, "x-amz-meta-b": {"2"}}))
		}
	}
	seeds = append(seeds, []byte("ffffffff\r\n"), []byte("0\r\n"), []byte("\r\n\r\n"), []byte(";;;\r\n"),
		[]byte("5;chunk-signature=\r\nhello\r\n"), bytes.Repeat([]byte("a"), 5000))
	return res, seeds
}

func checkDecode(t *testing.T, body []byte, res *Result) {
	t.Helper()
	sr := NewStreamReader(bytes.NewReader(body), res, fuzzMaxChunk)
	out, err := io.ReadAll(sr)
	if len(out) > len(body) {
		t.Fatalf("decoded %d bytes from %d", len(out), len(body))
	}
	if err != nil {
		if _, ok := apierr.As(err); !ok {
			t.Fatalf("non-S3 error %v", err)
		}
		if sr.Trailer() != nil {
			t.Fatal("trailer after an error")
		}
	}
}

func FuzzStreamReader(f *testing.F) {
	res, seeds := streamSeeds(f)
	for i, s := range seeds {
		f.Add(s, uint8(i))
	}
	f.Fuzz(func(t *testing.T, body []byte, mode uint8) {
		checkDecode(t, body, res[streamModes[int(mode)%len(streamModes)]])
	})
}

func TestStreamRandomInput(t *testing.T) {
	res, seeds := streamSeeds(t)
	rng := rand.New(rand.NewSource(1))
	for i := 0; i < 4000; i++ {
		var body []byte
		switch i % 4 {
		case 0: // noise
			body = make([]byte, rng.Intn(600))
			rng.Read(body)
		case 1: // noise from the framing alphabet
			alphabet := "0123456789abcdefABCDEF;=:\r\n-chunksignaturex"
			body = make([]byte, rng.Intn(400))
			for j := range body {
				body[j] = alphabet[rng.Intn(len(alphabet))]
			}
		default: // mutated valid bodies
			body = append([]byte(nil), seeds[rng.Intn(9)]...)
			for k := rng.Intn(4) + 1; k > 0 && len(body) > 0; k-- {
				p := rng.Intn(len(body))
				switch rng.Intn(4) {
				case 0:
					body[p] = byte(rng.Intn(256))
				case 1:
					body = append(body[:p], body[p+1:]...)
				case 2:
					body = append(body[:p], append([]byte{byte(rng.Intn(256))}, body[p:]...)...)
				case 3:
					q := p + rng.Intn(len(body)-p)
					body = append(body[:p:p], append(append([]byte(nil), body[q:]...), body[p:q]...)...)
				}
			}
		}
		for _, m := range streamModes {
			checkDecode(t, body, res[m])
		}
	}
	for _, s := range seeds[:9] {
		ok := false
		for _, m := range streamModes {
			sr := NewStreamReader(bytes.NewReader(s), res[m], fuzzMaxChunk)
			if _, err := io.ReadAll(sr); err == nil {
				ok = true
			}
		}
		if !ok {
			t.Fatal("a valid seed does not decode")
		}
	}
}

// FuzzVerifyHeader feeds hostile Authorization headers, dates and request
// targets to Detect, PeekAccessKey and Verify.
func FuzzVerifyHeader(f *testing.F) {
	good := serverRequest("PUT", "bucket.localhost:9000", "/bucket/k?x=1")
	if _, err := Sign(good, bvAKID, bvSecret, "auto", tnow, UnsignedPayload); err != nil {
		f.Fatal(err)
	}
	f.Add(good.Header.Get("Authorization"), "20250115T123456Z", "/bucket/k?x=1", UnsignedPayload)
	f.Add("AWS4-HMAC-SHA256 Credential=a/b/c/s3/aws4_request,SignedHeaders=host,Signature=0", "x", "/%zz", "x")
	f.Add("Bearer a.b", "", "/?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=a%2F", "")
	f.Add("", "", "/?X-Amz-Algorithm=AWS4-HMAC-SHA256&X-Amz-Credential=BVK%2F20250115%2Fauto%2Fs3%2Faws4_request"+
		"&X-Amz-Date=20250115T123456Z&X-Amz-Expires=60&X-Amz-SignedHeaders=host&X-Amz-Signature=00", "")
	f.Fuzz(func(t *testing.T, auth, date, uri, payload string) {
		r := serverRequest("PUT", "bucket.localhost:9000", uri)
		if auth != "" {
			r.Header.Set("Authorization", auth)
		}
		if date != "" {
			r.Header.Set("X-Amz-Date", date)
		}
		if payload != "" {
			r.Header.Set("X-Amz-Content-Sha256", payload)
		}
		for _, err := range []error{mustKind(Detect(r)), mustID(PeekAccessKey(r)), mustErr(verify(r, awsKeys, at(tnow)))} {
			if err != nil {
				if _, ok := apierr.As(err); !ok {
					t.Fatalf("non-S3 error %v", err)
				}
			}
		}
	})
}

func mustID(_ string, err error) error { return err }

func TestVerifyRandomInput(t *testing.T) {
	good := serverRequest("PUT", "bucket.localhost:9000", "/bucket/k?x=1")
	if _, err := Sign(good, bvAKID, bvSecret, "auto", tnow, UnsignedPayload, "content-type"); err != nil {
		t.Fatal(err)
	}
	auth := good.Header.Get("Authorization")
	rng := rand.New(rand.NewSource(2))
	for i := 0; i < 3000; i++ {
		const alphabet = ",;=/ \x00aZ9"
		b := []byte(auth)
		for k := rng.Intn(3) + 1; k > 0; k-- {
			b[rng.Intn(len(b))] = alphabet[rng.Intn(len(alphabet))]
		}
		r := serverRequest("PUT", "bucket.localhost:9000", "/bucket/k?x=1",
			"X-Amz-Date", "20250115T123456Z", "X-Amz-Content-Sha256", UnsignedPayload, "Authorization", string(b))
		_, err := verify(r, awsKeys, at(tnow))
		if err == nil {
			// Only a mutation that leaves the components unchanged (spacing,
			// an empty component) can keep the header valid.
			a0, _ := parseAuthorization(auth)
			if a1, _ := parseAuthorization(string(b)); a1 != a0 {
				t.Fatalf("mutated header verified: %q", b)
			}
			continue
		}
		if _, ok := apierr.As(err); !ok {
			t.Fatalf("non-S3 error %v", err)
		}
	}
}
