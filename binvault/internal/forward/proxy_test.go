package forward

import (
	"context"
	"crypto/x509"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"os"
	"reflect"
	"strings"
	"sync/atomic"
	"syscall"
	"testing"
	"time"
)

func TestHeadersDropsHopByHopAndForwardingHeaders(t *testing.T) {
	r, _ := http.NewRequest("PUT", "http://x/b/k", nil)
	for k, v := range map[string]string{
		"Authorization":         "AWS4-HMAC-SHA256 Credential=x",
		"X-Amz-Date":            "20261002T000000Z",
		"Content-Type":          "text/plain",
		"Content-Length":        "12",
		"Connection":            "keep-alive, X-Private-Hop",
		"X-Private-Hop":         "secret",
		"Keep-Alive":            "timeout=5",
		"Transfer-Encoding":     "chunked",
		"Te":                    "trailers",
		"Upgrade":               "h2c",
		"Proxy-Authorization":   "Basic x",
		"X-Binvault-Origin":     "evil",
		"x-binvault-peer-key":   "evil",
		"X-Binvault-Epoch":      "9",
		"X-Binvault-Request-Id": "evil",
		"X-Binvault-Anything":   "evil",
		"X-Forwarded-For":       "6.6.6.6",
		"Expect":                "100-continue",
		"Range":                 "bytes=0-9",
	} {
		r.Header.Set(k, v)
	}
	got := (&Forwarder{}).headers(r)
	want := http.Header{
		"Authorization": {"AWS4-HMAC-SHA256 Credential=x"}, "X-Amz-Date": {"20261002T000000Z"}, "Content-Type": {"text/plain"},
		"Expect": {"100-continue"}, "Range": {"bytes=0-9"},
		"User-Agent": {""}, // none was sent: the transport must not invent one
	}
	if !reflect.DeepEqual(got, want) {
		t.Fatalf("headers\n got %v\nwant %v", got, want)
	}
	r.Header.Set("User-Agent", "aws-sdk-go/1.0")
	if got := (&Forwarder{}).headers(r); got.Get("User-Agent") != "aws-sdk-go/1.0" {
		t.Fatalf("the client's User-Agent must travel: %v", got)
	}
}

func TestConnectionTokens(t *testing.T) {
	h := http.Header{}
	h.Add("Connection", "close, X-One")
	h.Add("Connection", " x-two ")
	got := connectionTokens(h)
	if len(got) != 3 || !got["close"] || !got["x-one"] || !got["x-two"] {
		t.Fatalf("%v", got)
	}
	if connectionTokens(http.Header{}) != nil {
		t.Fatal("no Connection header, no tokens")
	}
}

func TestValidRequestID(t *testing.T) {
	for id, want := range map[string]bool{
		"01M3ZDAEN0FGNDFTPS9WNYWHX1": true, "trace-abc_1.2": true, "": false, "has space": false, "new\nline": false,
		"semi;colon": false, "ünï": false,
	} {
		if validRequestID(id) != want {
			t.Errorf("validRequestID(%q) = %v", id, !want)
		}
	}
	long := make([]byte, 65)
	for i := range long {
		long[i] = 'a'
	}
	if validRequestID(string(long)) {
		t.Error("an id longer than 64 characters is not accepted")
	}
}

// timeoutError is a net.Error that says it timed out, as the transport's
// "timeout awaiting response headers" does.
type timeoutError struct{}

func (timeoutError) Error() string   { return "net/http: timeout awaiting response headers" }
func (timeoutError) Timeout() bool   { return true }
func (timeoutError) Temporary() bool { return true }

// Only a home that cannot be dialled, resets the connection or closes it without
// a byte of answer is reported as unreachable; one slow or stuck request is not a
// sign that the node is down (and would make it fail for every other client).
func TestFailureReportsOnlyAHomeThatLooksGone(t *testing.T) {
	op := func(name string, errno syscall.Errno) error {
		return &net.OpError{Op: name, Net: "tcp", Err: &os.SyscallError{Syscall: name, Err: errno}}
	}
	for _, tc := range []struct {
		name   string
		err    error
		cause  error
		reason string
		down   bool
	}{
		{"connection refused", op("dial", syscall.ECONNREFUSED), nil, "dial", true},
		{"dial timeout", &net.OpError{Op: "dial", Net: "tcp", Err: timeoutError{}}, nil, "dial", true},
		{"reset while waiting for the answer", fmt.Errorf("net/http: HTTP/1.x transport connection broken: %w", op("read", syscall.ECONNRESET)), nil, "upstream", true},
		{"reset while sending", op("write", syscall.ECONNRESET), nil, "upstream", true},
		{"broken pipe while sending", op("write", syscall.EPIPE), nil, "upstream", true},
		{"closed without an answer", io.EOF, nil, "upstream", true},
		{"closed in the middle of the headers", io.ErrUnexpectedEOF, nil, "upstream", true},

		{"no answer within the response timeout", timeoutError{}, nil, "timeout", false},
		{"a read that timed out", &net.OpError{Op: "read", Net: "tcp", Err: timeoutError{}}, nil, "timeout", false},
		{"deadline exceeded", context.DeadlineExceeded, nil, "timeout", false},
		{"the upload stalled", context.Canceled, errUploadStalled, "stalled", false},
		{"the response went idle", context.Canceled, errResponseIdle, "stalled", false},
		{"a stall that also looks like a reset", op("write", syscall.ECONNRESET), errUploadStalled, "stalled", false},
		{"a certificate the node does not trust", x509.UnknownAuthorityError{}, nil, "upstream", false},
		{"anything else", errors.New("boom"), nil, "upstream", false},
	} {
		reason, down := failure(tc.err, tc.cause)
		if reason != tc.reason || down != tc.down {
			t.Errorf("%s: failure = (%q, %v), want (%q, %v)", tc.name, reason, down, tc.reason, tc.down)
		}
	}
}

// countingSource is a client body that notes whether anything asked it for bytes.
type countingSource struct {
	r     io.Reader
	reads atomic.Int32
}

func (c *countingSource) Read(p []byte) (int, error) {
	c.reads.Add(1)
	return c.r.Read(p)
}

// The transport reads the client's body from a goroutine that outlives the attempt
// (blocked in a Read for a client that is slow to start, or waiting for a 100
// Continue); once the request is sent again or served here, that goroutine must not
// be able to take bytes of the body any more, or the new attempt would send a body
// with a hole at the front.
func TestAttemptBodyIsLentToOneAttemptAtATime(t *testing.T) {
	const payload = "0123456789abcdefghij"
	t.Run("an untouched body is returned whole to the next attempt", func(t *testing.T) {
		src := &countingSource{r: strings.NewReader(payload)}
		body := &reqBody{src: src, length: int64(len(payload))}
		first := body.attempt()
		if !first.seal() {
			t.Fatal("an attempt that never read must find the body untouched")
		}
		// the transport's goroutine of the first attempt wakes up late (the 100 Continue
		// timeout, say) and reads: it gets nothing, and the client's body keeps its bytes
		if n, err := first.Read(make([]byte, 8)); n != 0 || !errors.Is(err, errAttemptOver) {
			t.Fatalf("a Read after the seal: %d, %v", n, err)
		}
		if src.reads.Load() != 0 {
			t.Fatal("a sealed attempt reached the client's body")
		}
		got, err := io.ReadAll(body.attempt())
		if err != nil || string(got) != payload {
			t.Fatalf("the next attempt read %q, %v; want the whole body", got, err)
		}
	})

	t.Run("a Read that has begun makes the body unusable, even with no byte read yet", func(t *testing.T) {
		pr, pw := io.Pipe()
		body := &reqBody{src: pr, length: -1}
		first := body.attempt()
		got := make(chan string, 1)
		go func() { // the transport's write goroutine: the client has not started to send
			b, _ := io.ReadAll(first)
			got <- string(b)
		}()
		deadline := time.Now().Add(5 * time.Second)
		for !body.reading.Load() && time.Now().Before(deadline) {
			time.Sleep(time.Millisecond)
		}
		if first.seal() {
			t.Fatal("an attempt that is blocked in a Read was reported as not having read")
		}
		// the stale goroutine takes what the client sends next: the body is gone for any other attempt
		pw.Write([]byte(payload[:10]))
		pw.Close()
		if s := <-got; s != payload[:10] {
			t.Fatalf("the stale reader got %q", s)
		}
	})

	t.Run("an attempt that read some of the body is not untouched", func(t *testing.T) {
		body := &reqBody{src: strings.NewReader(payload), length: int64(len(payload))}
		a := body.attempt()
		if _, err := a.Read(make([]byte, 4)); err != nil {
			t.Fatal(err)
		}
		if a.seal() {
			t.Fatal("a body that was read from is not untouched")
		}
	})

	t.Run("a request without a body is always untouched", func(t *testing.T) {
		body := &reqBody{none: true}
		if !body.attempt().seal() {
			t.Fatal("no body, nothing to have touched")
		}
	})
}
