package sigv4

import (
	"bytes"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"hash/crc32"
	"io"
	"net/http"
	"runtime"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

var streamValues = map[StreamMode]string{
	StreamSigned:          StreamingPayload,
	StreamSignedTrailer:   StreamingPayloadTrailer,
	StreamUnsignedTrailer: StreamingUnsignedPayloadTrailer,
}

var streamModes = []StreamMode{StreamSigned, StreamSignedTrailer, StreamUnsignedTrailer}

// streamResult verifies a request announcing mode and returns its Result.
func streamResult(t testing.TB, mode StreamMode) *Result {
	t.Helper()
	r := serverRequest("PUT", "bucket.localhost:9000", "/bucket/k",
		"Content-Encoding", "aws-chunked", "X-Amz-Trailer", "x-amz-checksum-crc32")
	if _, err := Sign(r, bvAKID, bvSecret, "auto", tnow, streamValues[mode], "content-encoding", "x-amz-trailer"); err != nil {
		t.Fatal(err)
	}
	res, err := verify(r, awsKeys, at(tnow))
	if err != nil {
		t.Fatal(err)
	}
	if res.Stream != mode {
		t.Fatalf("stream mode %v", res.Stream)
	}
	return res
}

func crc32b64(b []byte) string {
	var s [4]byte
	binary.BigEndian.PutUint32(s[:], crc32.ChecksumIEEE(b))
	return base64.StdEncoding.EncodeToString(s[:])
}

func decode(body []byte, res *Result, maxChunk int) ([]byte, http.Header, error) {
	sr := NewStreamReader(bytes.NewReader(body), res, maxChunk)
	out, err := readAll(sr)
	return out, sr.Trailer(), err
}

func payloadOf(n int) []byte {
	p := make([]byte, n)
	for i := range p {
		p[i] = byte(i*7 + i/251)
	}
	return p
}

func TestStreamRoundTrip(t *testing.T) {
	for _, mode := range streamModes {
		res := streamResult(t, mode)
		for _, size := range []int{0, 1, 999, 8192, 8193, 20000} {
			for _, chunk := range []int{1, 7, 8192, 64 << 10} {
				if chunk == 1 && size > 1000 {
					continue
				}
				payload := payloadOf(size)
				crc := crc32b64(payload)
				body := EncodeStream(res, mode, payload, chunk, http.Header{"X-Amz-Checksum-Crc32": {crc}})
				got, tr, err := decode(body, res, 0)
				if err != nil {
					t.Fatalf("%v size %d chunk %d: %v", mode, size, chunk, err)
				}
				if !bytes.Equal(got, payload) {
					t.Fatalf("%v size %d chunk %d: payload differs", mode, size, chunk)
				}
				switch mode {
				case StreamSigned:
					if tr != nil {
						t.Fatalf("trailer %v", tr)
					}
				case StreamSignedTrailer:
					if len(tr["x-amz-checksum-crc32"]) != 1 || tr["x-amz-checksum-crc32"][0] != crc || len(tr[trailerSigName]) != 1 {
						t.Fatalf("trailer %v", tr)
					}
				case StreamUnsignedTrailer:
					if len(tr) != 1 || tr["x-amz-checksum-crc32"][0] != crc {
						t.Fatalf("trailer %v", tr)
					}
				}
			}
		}
	}
	// StreamNone is the payload itself.
	if got := EncodeStream(nil, StreamNone, []byte("abc"), 0, nil); string(got) != "abc" {
		t.Fatalf("%q", got)
	}
}

func TestStreamEveryByteFlipFails(t *testing.T) {
	for _, mode := range []StreamMode{StreamSigned, StreamSignedTrailer} {
		res := streamResult(t, mode)
		payload := payloadOf(100)
		body := EncodeStream(res, mode, payload, 40, http.Header{"x-amz-checksum-crc32": {crc32b64(payload)}})
		if _, _, err := decode(body, res, 0); err != nil {
			t.Fatal(err)
		}
		for i := range body {
			mut := append([]byte(nil), body...)
			mut[i] ^= 0x01
			_, _, err := decode(mut, res, 0)
			if err == nil {
				t.Fatalf("%v: flipping byte %d (%q) went unnoticed", mode, i, body[i])
			}
			e, ok := apierr.As(err)
			if !ok || (e.Code != "SignatureDoesNotMatch" && e.Code != "IncompleteBody" && e.Code != "InvalidRequest") {
				t.Fatalf("%v byte %d: %v", mode, i, err)
			}
		}
	}
}

func TestStreamTampering(t *testing.T) {
	res := streamResult(t, StreamSigned)
	body := EncodeStream(res, StreamSigned, []byte("hello world, chunked"), 8, nil)
	data := bytes.Index(body, []byte("hello"))
	mut := append([]byte(nil), body...)
	mut[data] = 'H'
	_, _, err := decode(mut, res, 0)
	wantCode(t, err, "SignatureDoesNotMatch")

	sig := bytes.Index(body, []byte("chunk-signature=")) + len("chunk-signature=")
	mut = append([]byte(nil), body...)
	if mut[sig] == 'f' {
		mut[sig] = '0'
	} else {
		mut[sig] = 'f'
	}
	_, _, err = decode(mut, res, 0)
	wantCode(t, err, "SignatureDoesNotMatch")

	// A body signed for another request (another seed) is refused.
	other := streamResult(t, StreamSigned)
	other.Signature = strings.Repeat("0", 64)
	_, _, err = decode(EncodeStream(other, StreamSigned, []byte("hello"), 8, nil), res, 0)
	wantCode(t, err, "SignatureDoesNotMatch")

	// Reordering two chunks of the same size breaks the chain.
	res2 := streamResult(t, StreamSigned)
	b2 := EncodeStream(res2, StreamSigned, []byte("aaaabbbb"), 4, nil)
	lines := bytes.SplitAfter(b2, []byte("\r\n"))
	swapped := bytes.Join([][]byte{lines[2], lines[3], lines[0], lines[1], lines[4], lines[5]}, nil)
	_, _, err = decode(swapped, res2, 0)
	wantCode(t, err, "SignatureDoesNotMatch")
}

// lenientPrefixes are the truncation points a mode accepts: in the trailer
// modes, the body may end in place of the final empty line.
func lenientPrefixes(mode StreamMode, body []byte) map[int]bool {
	ok := map[int]bool{}
	if mode == StreamSigned {
		return ok
	}
	final := bytes.LastIndex(body, []byte("\r\n0"))
	i := bytes.Index(body[final+2:], []byte("\r\n")) + final + 4 // after "0[;sig]\r\n"
	for i < len(body)-2 {
		j := bytes.Index(body[i:], []byte("\r\n")) + i + 2
		if mode == StreamUnsignedTrailer || bytes.HasPrefix(body[i:], []byte(trailerSigName)) {
			ok[j] = true
		}
		i = j
	}
	if mode == StreamUnsignedTrailer {
		ok[bytes.Index(body[final+2:], []byte("\r\n"))+final+4] = true // "0\r\n" then EOF
	}
	return ok
}

func TestStreamTruncation(t *testing.T) {
	for _, mode := range streamModes {
		res := streamResult(t, mode)
		payload := payloadOf(90)
		body := EncodeStream(res, mode, payload, 32, http.Header{
			"x-amz-checksum-crc32": {crc32b64(payload)}, "x-amz-meta-z": {"last"},
		})
		lenient := lenientPrefixes(mode, body)
		if mode != StreamSigned && len(lenient) == 0 {
			t.Fatalf("%v: no lenient prefix found", mode)
		}
		for n := 0; n < len(body); n++ {
			_, _, err := decode(body[:n], res, 0)
			if lenient[n] {
				if err != nil {
					t.Fatalf("%v: prefix %d of %d should be accepted: %v", mode, n, len(body), err)
				}
				continue
			}
			if err == nil {
				t.Fatalf("%v: prefix %d of %d accepted", mode, n, len(body))
			}
			wantCode(t, err, "IncompleteBody")
		}
	}
}

// chain signs hand-built aws-chunked bodies.
type chain struct {
	res  *Result
	prev string
}

func newChain(res *Result) *chain { return &chain{res: res, prev: res.Signature} }

func (c *chain) chunk(data string) string {
	c.prev = hmacHex(c.res.SigningKey, chunkAlgorithm+"\n"+c.res.amzDate()+"\n"+c.res.scope()+"\n"+c.prev+"\n"+
		EmptySHA256+"\n"+sha256Hex([]byte(data)))
	return c.prev
}

func (c *chain) trailer(fields ...trailerField) string {
	c.prev = hmacHex(c.res.SigningKey, trailerStringToSign(c.res.amzDate(), c.res.scope(), c.prev, fields))
	return c.prev
}

func TestStreamMalformed(t *testing.T) {
	signedRes := streamResult(t, StreamSigned)
	trailerRes := streamResult(t, StreamSignedTrailer)
	unsignedRes := streamResult(t, StreamUnsignedTrailer)

	sb := func(f func(c *chain) string) string { return f(newChain(signedRes)) }
	tb := func(f func(c *chain) string) string { return f(newChain(trailerRes)) }
	z := trailerField{"x-amz-meta-zeta", "z"}
	a := trailerField{"x-amz-checksum-crc32", "AAAAAA=="}

	tests := []struct {
		name string
		res  *Result
		body string
		code string
		data string
		tr   http.Header
	}{
		{"signed ok", signedRes, sb(func(c *chain) string {
			return "5;chunk-signature=" + c.chunk("hello") + "\r\nhello\r\n0;chunk-signature=" + c.chunk("") + "\r\n\r\n"
		}), "", "hello", nil},
		{"upper-case hex size", signedRes, sb(func(c *chain) string {
			d := strings.Repeat("x", 10)
			return "A;chunk-signature=" + c.chunk(d) + "\r\n" + d + "\r\n0;chunk-signature=" + c.chunk("") + "\r\n\r\n"
		}), "", strings.Repeat("x", 10), nil},
		{"leading zeros", signedRes, sb(func(c *chain) string {
			return "0005;chunk-signature=" + c.chunk("hello") + "\r\nhello\r\n0;chunk-signature=" + c.chunk("") + "\r\n\r\n"
		}), "", "hello", nil},
		{"bare LF", signedRes, sb(func(c *chain) string {
			return "5;chunk-signature=" + c.chunk("hello") + "\nhello\r\n0;chunk-signature=" + c.chunk("") + "\r\n\r\n"
		}), "IncompleteBody", "", nil},
		{"no CRLF after data", signedRes, sb(func(c *chain) string {
			return "5;chunk-signature=" + c.chunk("hello") + "\r\nhelloXX0;chunk-signature=" + c.chunk("") + "\r\n\r\n"
		}), "IncompleteBody", "", nil},
		{"short data", signedRes, sb(func(c *chain) string {
			return "6;chunk-signature=" + c.chunk("hello") + "\r\nhello\r\n"
		}), "IncompleteBody", "", nil},
		{"unknown extension", signedRes, "5;chunk-sig=" + strings.Repeat("0", 64) + "\r\nhello\r\n", "IncompleteBody", "", nil},
		{"two extensions", signedRes, sb(func(c *chain) string {
			return "5;chunk-signature=" + c.chunk("hello") + ";x=y\r\nhello\r\n"
		}), "SignatureDoesNotMatch", "", nil},
		{"no signature", signedRes, "5\r\nhello\r\n0\r\n\r\n", "IncompleteBody", "", nil},
		{"short signature", signedRes, "5;chunk-signature=abc\r\nhello\r\n", "SignatureDoesNotMatch", "", nil},
		{"empty size", signedRes, ";chunk-signature=" + strings.Repeat("0", 64) + "\r\n", "IncompleteBody", "", nil},
		{"non-hex size", signedRes, "5g;chunk-signature=" + strings.Repeat("0", 64) + "\r\n", "IncompleteBody", "", nil},
		{"spaced size", signedRes, " 5;chunk-signature=" + strings.Repeat("0", 64) + "\r\n", "IncompleteBody", "", nil},
		{"17 hex digits", signedRes, "00000000000000005;chunk-signature=" + strings.Repeat("0", 64) + "\r\n", "IncompleteBody", "", nil},
		{"huge size", signedRes, "ffffffffffffffff;chunk-signature=" + strings.Repeat("0", 64) + "\r\n", "InvalidRequest", "", nil},
		{"empty body", signedRes, "", "IncompleteBody", "", nil},
		{"trailer in signed mode", signedRes, sb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\nx-amz-checksum-crc32:AAAAAA==\r\n\r\n"
		}), "IncompleteBody", "", nil},
		{"no final CRLF in signed mode", signedRes, sb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\n"
		}), "IncompleteBody", "", nil},
		{"data after the end", signedRes, sb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\n\r\nextra"
		}), "IncompleteBody", "", nil},
		{"chunk after the end", signedRes, sb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\n\r\n0;chunk-signature=" + c.chunk("") + "\r\n\r\n"
		}), "IncompleteBody", "", nil},

		{"signed trailer ok", trailerRes, tb(func(c *chain) string {
			return "3;chunk-signature=" + c.chunk("abc") + "\r\nabc\r\n0;chunk-signature=" + c.chunk("") + "\r\n" +
				"x-amz-checksum-crc32:AAAAAA==\r\nx-amz-trailer-signature:" + c.trailer(a) + "\r\n\r\n"
		}), "", "abc", http.Header{"x-amz-checksum-crc32": {"AAAAAA=="}}},
		{"no final CRLF after trailer signature", trailerRes, tb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\nx-amz-checksum-crc32:AAAAAA==\r\nx-amz-trailer-signature:" + c.trailer(a) + "\r\n"
		}), "", "", http.Header{"x-amz-checksum-crc32": {"AAAAAA=="}}},
		{"trailers unsorted on the wire, signed sorted", trailerRes, tb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\nx-amz-meta-zeta: z \r\nX-Amz-Checksum-Crc32:AAAAAA==\r\n" +
				"x-amz-trailer-signature:" + c.trailer(z, a) + "\r\n\r\n"
		}), "", "", http.Header{"x-amz-checksum-crc32": {"AAAAAA=="}, "x-amz-meta-zeta": {"z"}}},
		{"repeated trailer", trailerRes, tb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\nx-amz-meta-a:1\r\nx-amz-meta-a:2\r\n" +
				"x-amz-trailer-signature:" + c.trailer(trailerField{"x-amz-meta-a", "1,2"}) + "\r\n\r\n"
		}), "", "", http.Header{"x-amz-meta-a": {"1", "2"}}},
		{"signature only", trailerRes, tb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\nx-amz-trailer-signature:" + c.trailer() + "\r\n\r\n"
		}), "", "", http.Header{}},
		{"bad trailer signature", trailerRes, tb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\nx-amz-checksum-crc32:AAAAAA==\r\nx-amz-trailer-signature:" +
				strings.Repeat("0", 64) + "\r\n\r\n"
		}), "SignatureDoesNotMatch", "", nil},
		{"tampered trailer", trailerRes, tb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\nx-amz-checksum-crc32:BBBBBB==\r\nx-amz-trailer-signature:" + c.trailer(a) + "\r\n\r\n"
		}), "SignatureDoesNotMatch", "", nil},
		{"trailer signed by the seed", trailerRes, tb(func(c *chain) string {
			c.chunk("")
			c.prev = trailerRes.Signature
			return "0;chunk-signature=" + newChain(trailerRes).chunk("") + "\r\nx-amz-checksum-crc32:AAAAAA==\r\nx-amz-trailer-signature:" + c.trailer(a) + "\r\n\r\n"
		}), "SignatureDoesNotMatch", "", nil},
		{"missing trailer signature", trailerRes, tb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\nx-amz-checksum-crc32:AAAAAA==\r\n\r\n"
		}), "SignatureDoesNotMatch", "", nil},
		{"body ends before trailer signature", trailerRes, tb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\nx-amz-checksum-crc32:AAAAAA==\r\n"
		}), "IncompleteBody", "", nil},
		{"trailer after signature", trailerRes, tb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\nx-amz-trailer-signature:" + c.trailer() + "\r\nx-amz-checksum-crc32:AAAAAA==\r\n\r\n"
		}), "IncompleteBody", "", nil},
		{"trailer without colon", trailerRes, tb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\nx-amz-checksum-crc32 AAAAAA==\r\n\r\n"
		}), "IncompleteBody", "", nil},
		{"trailer with bad name", trailerRes, tb(func(c *chain) string {
			return "0;chunk-signature=" + c.chunk("") + "\r\nx amz:AAAAAA==\r\n\r\n"
		}), "IncompleteBody", "", nil},
		{"trailer value with CR", unsignedRes, "0\r\nx-amz-checksum-crc32:AA\rX-Injected: 1\r\n\r\n", "IncompleteBody", "", nil},
		{"trailer value with NUL", unsignedRes, "0\r\nx-amz-checksum-crc32:AA\x00==\r\n\r\n", "IncompleteBody", "", nil},
		{"trailer value with tab", unsignedRes, "0\r\nx-amz-meta-t:a\tb\r\n\r\n", "", "", http.Header{"x-amz-meta-t": {"a\tb"}}},

		{"unsigned ok", unsignedRes, "5\r\nhello\r\n0\r\nx-amz-checksum-crc32:AAAAAA==\r\n\r\n", "", "hello",
			http.Header{"x-amz-checksum-crc32": {"AAAAAA=="}}},
		{"unsigned without final CRLF", unsignedRes, "5\r\nhello\r\n0\r\nx-amz-checksum-crc32:AAAAAA==\r\n", "", "hello",
			http.Header{"x-amz-checksum-crc32": {"AAAAAA=="}}},
		{"unsigned ending after the final chunk", unsignedRes, "5\r\nhello\r\n0\r\n", "", "hello", http.Header{}},
		{"unsigned with no trailer", unsignedRes, "5\r\nhello\r\n0\r\n\r\n", "", "hello", http.Header{}},
		{"unsigned chunk signature", unsignedRes, "5;chunk-signature=" + strings.Repeat("0", 64) + "\r\nhello\r\n0\r\n\r\n", "IncompleteBody", "", nil},
		{"unsigned trailer signature", unsignedRes, "0\r\nx-amz-trailer-signature:" + strings.Repeat("0", 64) + "\r\n\r\n", "IncompleteBody", "", nil},
		{"unsigned short data", unsignedRes, "5\r\nhell", "IncompleteBody", "", nil},
		{"unsigned no CRLF after data", unsignedRes, "5\r\nhelloX\r\n0\r\n\r\n", "IncompleteBody", "", nil},
		{"unsigned half CR", unsignedRes, "0\r\nx-amz-checksum-crc32:AAAAAA==\r\n\r", "IncompleteBody", "", nil},
		{"unsigned data after the end", unsignedRes, "0\r\n\r\n\r\n", "IncompleteBody", "", nil},
	}
	for _, tc := range tests {
		got, tr, err := decode([]byte(tc.body), tc.res, 0)
		if tc.code == "" && err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		wantCode(t, err, tc.code)
		if tc.code != "" {
			continue
		}
		if string(got) != tc.data {
			t.Fatalf("%s: data %q", tc.name, got)
		}
		for k, v := range tc.tr {
			if strings.Join(tr[k], "|") != strings.Join(v, "|") {
				t.Fatalf("%s: trailer %v", tc.name, tr)
			}
		}
		if tc.res.Stream != StreamSigned && len(tr)-len(tc.tr) != map[bool]int{true: 1}[tc.res.Stream == StreamSignedTrailer] {
			t.Fatalf("%s: trailer %v", tc.name, tr)
		}
	}
}

func TestStreamLimits(t *testing.T) {
	res := streamResult(t, StreamSigned)
	c := newChain(res)
	d := strings.Repeat("x", 1024)
	ok := "400;chunk-signature=" + c.chunk(d) + "\r\n" + d + "\r\n0;chunk-signature=" + c.chunk("") + "\r\n\r\n"
	if _, _, err := decode([]byte(ok), res, 1024); err != nil {
		t.Fatal(err)
	}
	_, _, err := decode([]byte(ok), res, 1023)
	wantCode(t, err, "InvalidRequest")
	// The default limit is 16 MiB, refused from the header alone.
	_, _, err = decode([]byte("1000001;chunk-signature="+strings.Repeat("0", 64)+"\r\n"), res, 0)
	wantCode(t, err, "InvalidRequest")
	// Lines over 4 KiB.
	_, _, err = decode([]byte("5;chunk-signature="+strings.Repeat("0", 5000)+"\r\n"), res, 0)
	wantCode(t, err, "InvalidRequest")
	ures := streamResult(t, StreamUnsignedTrailer)
	_, _, err = decode([]byte("0\r\nx-amz-meta-a:"+strings.Repeat("v", 4100)+"\r\n\r\n"), ures, 0)
	wantCode(t, err, "InvalidRequest")
	long := "0\r\nx-amz-meta-a:" + strings.Repeat("v", maxLine-len("x-amz-meta-a:")-2) + "\r\n\r\n"
	if _, _, err := decode([]byte(long), ures, 0); err != nil {
		t.Fatalf("a 4 KiB line is allowed: %v", err)
	}
	// A body that is already a large bufio.Reader still gets the line limit.
	_, _, err = decode([]byte("0\r\nx-amz-meta-a:"+strings.Repeat("v", 6000)+"\r\n\r\n"), ures, 0)
	wantCode(t, err, "InvalidRequest")
	// Too many trailers.
	var b strings.Builder
	b.WriteString("0\r\n")
	for i := 0; i <= maxTrailers; i++ {
		b.WriteString("x-amz-meta-t" + itoa(int64(i)) + ":v\r\n")
	}
	b.WriteString("\r\n")
	_, _, err = decode([]byte(b.String()), ures, 0)
	wantCode(t, err, "InvalidRequest")
}

type failingReader struct {
	data []byte
	err  error
}

func (f *failingReader) Read(p []byte) (int, error) {
	if len(f.data) == 0 {
		return 0, f.err
	}
	n := copy(p, f.data)
	f.data = f.data[n:]
	return n, nil
}

func TestStreamReaderErrors(t *testing.T) {
	_, err := NewStreamReader(bytes.NewReader(nil), nil, 0).Read(make([]byte, 1))
	wantCode(t, err, "InternalError")
	_, err = NewStreamReader(nil, &Result{Stream: StreamUnsignedTrailer}, 0).Read(make([]byte, 1))
	wantCode(t, err, "InternalError")
	_, err = NewStreamReader(bytes.NewReader(nil), &Result{Stream: StreamNone}, 0).Read(make([]byte, 1))
	wantCode(t, err, "InternalError")
	_, err = NewStreamReader(bytes.NewReader(nil), &Result{Stream: StreamSigned, Signature: strings.Repeat("a", 64)}, 0).Read(make([]byte, 1))
	wantCode(t, err, "InternalError")

	// Errors of the underlying reader pass through unchanged, in every state.
	cause := errors.New("connection reset")
	res := streamResult(t, StreamSignedTrailer)
	body := EncodeStream(res, StreamSignedTrailer, payloadOf(300), 100, http.Header{"x-amz-checksum-crc32": {"AAAAAA=="}})
	for _, n := range []int{0, 3, 50, 150, len(body) - 50, len(body) - 1} {
		sr := NewStreamReader(&failingReader{data: body[:n], err: cause}, res, 0)
		_, err := readAll(sr)
		if !errors.Is(err, cause) {
			t.Fatalf("cut at %d: %v", n, err)
		}
		if _, again := sr.Read(make([]byte, 10)); !errors.Is(again, cause) {
			t.Fatalf("the error is not sticky: %v", again)
		}
		if sr.Trailer() != nil {
			t.Fatal("trailer after an error")
		}
	}
	ures := streamResult(t, StreamUnsignedTrailer)
	ubody := EncodeStream(ures, StreamUnsignedTrailer, payloadOf(300), 100, nil)
	sr := NewStreamReader(&failingReader{data: ubody[:120], err: cause}, ures, 0)
	if _, err := readAll(sr); !errors.Is(err, cause) {
		t.Fatalf("unsigned: %v", err)
	}

	// Trailer is nil until the end; an empty read is a no-op.
	sr = NewStreamReader(bytes.NewReader(body), res, 0)
	if n, err := sr.Read(nil); n != 0 || err != nil {
		t.Fatalf("empty read: %d %v", n, err)
	}
	if sr.Trailer() != nil {
		t.Fatal("trailer before the end")
	}
	if _, err := io.ReadAll(sr); err != nil {
		t.Fatal(err)
	}
	if sr.Trailer() == nil {
		t.Fatal("no trailer at the end")
	}
	if n, err := sr.Read(make([]byte, 8)); n != 0 || err != io.EOF {
		t.Fatalf("after EOF: %d %v", n, err)
	}
}

// A declared chunk size is never allocated up front: memory follows the
// bytes that arrive.
func TestStreamAllocationBound(t *testing.T) {
	res := streamResult(t, StreamSigned)
	body := []byte("f00000;chunk-signature=" + strings.Repeat("0", 64) + "\r\n0123456789")
	var before, after runtime.MemStats
	runtime.GC()
	runtime.ReadMemStats(&before)
	for i := 0; i < 20; i++ {
		_, _, err := decode(body, res, 0)
		wantCode(t, err, "IncompleteBody")
	}
	runtime.ReadMemStats(&after)
	if grew := after.TotalAlloc - before.TotalAlloc; grew > 8<<20 {
		t.Fatalf("20 decodes of a 15 MiB chunk header allocated %d bytes", grew)
	}
}
