package httpx

import (
	"bytes"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"net/netip"
	"strings"
	"testing"
	"time"
)

func TestClientIP(t *testing.T) {
	trusted := []netip.Prefix{netip.MustParsePrefix("10.0.0.0/8"), netip.MustParsePrefix("192.168.1.5/32")}
	mk := func(remote, xff string) *http.Request {
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = remote
		if xff != "" {
			r.Header.Set("X-Forwarded-For", xff)
		}
		return r
	}
	cases := []struct{ remote, xff, want string }{
		{"1.2.3.4:5", "9.9.9.9", "1.2.3.4"},            // untrusted peer: ignore XFF
		{"10.0.0.1:5", "9.9.9.9", "9.9.9.9"},           // trusted proxy
		{"10.0.0.1:5", "9.9.9.9, 10.0.0.7", "9.9.9.9"}, // right-most untrusted
		{"10.0.0.1:5", "8.8.8.8, 9.9.9.9", "9.9.9.9"},  // spoofed left entries ignored
		{"10.0.0.1:5", "", "10.0.0.1"},                 // no header
		{"192.168.1.5:80", "not-an-ip", "192.168.1.5"}, // garbage
		{"[::1]:5", "", "::1"},
	}
	for _, c := range cases {
		if got := ClientIP(mk(c.remote, c.xff), trusted); got != c.want {
			t.Errorf("%s %q: got %s want %s", c.remote, c.xff, got, c.want)
		}
	}
}

func TestRawRequestURI(t *testing.T) {
	var gotPath, gotQuery string
	h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotPath, gotQuery = SplitRequestURI(r)
		w.WriteHeader(204)
	}), Options{Log: slog.New(slog.NewTextHandler(io.Discard, nil))})
	srv := httptest.NewServer(h)
	defer srv.Close()
	conn, err := net.Dial("tcp", srv.Listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	// literal //, ., .. and encoded plus must survive untouched
	io.WriteString(conn, "GET //b/a/../c%2Bd+e?x=1+2&X-Amz-Signature=zz HTTP/1.1\r\nHost: x\r\nConnection: close\r\n\r\n")
	conn.SetReadDeadline(time.Now().Add(2 * time.Second))
	io.Copy(io.Discard, conn)
	if gotPath != "//b/a/../c%2Bd+e" || gotQuery != "x=1+2&X-Amz-Signature=zz" {
		t.Fatalf("path %q query %q", gotPath, gotQuery)
	}
	if SafeQuery(gotQuery) != "x=1+2" {
		t.Fatalf("safe query %q", SafeQuery(gotQuery))
	}
}

func TestWrapHeadersAndLog(t *testing.T) {
	var buf bytes.Buffer
	var done *Info
	h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		i := From(r.Context())
		i.Op, i.Bucket, i.Key, i.Principal = "GetObject", "b", "k", "token:BVK1"
		io.WriteString(w, "hello")
	}), Options{
		Log:    slog.New(slog.NewTextHandler(&buf, nil)),
		Node:   "n1",
		OnDone: func(i *Info, d time.Duration) { done = i },
	})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest("GET", "/b/k", nil))
	if rr.Header().Get("x-amz-request-id") == "" || rr.Header().Get("Server") != "binvault" || rr.Header().Get("x-binvault-node") != "n1" {
		t.Fatalf("headers %v", rr.Header())
	}
	if done == nil || done.Status != 200 || done.OutBytes.Load() != 5 {
		t.Fatalf("info %+v", done)
	}
	for _, want := range []string{"op=GetObject", "bucket=b", "key=k", "principal=token:BVK1", "status=200", "bytes_out=5"} {
		if !strings.Contains(buf.String(), want) {
			t.Errorf("log missing %q: %s", want, buf.String())
		}
	}
}

func TestPanicRecovered(t *testing.T) {
	h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { panic("boom") }),
		Options{Log: slog.New(slog.NewTextHandler(io.Discard, nil))})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest("GET", "/", nil))
	if rr.Code != 500 || !strings.Contains(rr.Body.String(), "InternalError") {
		t.Fatalf("%d %s", rr.Code, rr.Body.String())
	}
}

// A request whose body was fully read must not have its context cancelled by a
// read deadline that was armed for that body: long post-body work (a big
// multipart Complete, a slow before-chain) would be cut off after the idle time.
func TestIdleReaderDoesNotLeaveADeadlineArmedAfterEOF(t *testing.T) {
	const idle = 200 * time.Millisecond
	var ctxErr error
	var ran bool
	h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		body := NewIdleReader(w, r.Body, idle, nil)
		if _, err := io.Copy(io.Discard, body); err != nil {
			t.Errorf("reading the body: %v", err)
		}
		time.Sleep(3 * idle) // slow work after the body: longer than the idle timeout
		ctxErr = r.Context().Err()
		ran = true
		w.WriteHeader(http.StatusNoContent)
	}), Options{Log: slog.New(slog.NewTextHandler(io.Discard, nil)), IdleTimeout: idle})
	srv := httptest.NewServer(h)
	defer srv.Close()
	res, err := http.Post(srv.URL, "application/octet-stream", strings.NewReader("hello"))
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if !ran || ctxErr != nil {
		t.Fatalf("ran=%v ctx error after the body was read: %v", ran, ctxErr)
	}
}

// A handler that answers without reading the body must not wait for a client
// that stalls mid-body: Go would otherwise discard the unread body (up to
// 256 KiB) before sending the response, which pins the connection.
func TestUnreadBodyDoesNotDelayTheResponse(t *testing.T) {
	h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusForbidden) // e.g. authentication failed before reading the body
	}), Options{Log: slog.New(slog.NewTextHandler(io.Discard, nil)), IdleTimeout: time.Minute})
	srv := httptest.NewServer(h)
	defer srv.Close()
	conn, err := net.Dial("tcp", srv.Listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	// announce 1000 bytes, send 2, then stall
	io.WriteString(conn, "PUT /x/k HTTP/1.1\r\nHost: x\r\nContent-Length: 1000\r\n\r\nab")
	conn.SetReadDeadline(time.Now().Add(3 * time.Second))
	buf := make([]byte, 512)
	n, err := conn.Read(buf)
	if err != nil {
		t.Fatalf("no response while the client stalls mid-body: %v", err)
	}
	resp := string(buf[:n])
	if !strings.HasPrefix(resp, "HTTP/1.1 403") || !strings.Contains(strings.ToLower(resp), "connection: close") {
		t.Fatalf("want an immediate 403 with Connection: close, got %q", resp)
	}
}

// A fully read body keeps the connection alive.
func TestReadBodyKeepsTheConnectionAlive(t *testing.T) {
	h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		io.Copy(io.Discard, r.Body)
		w.WriteHeader(http.StatusForbidden)
	}), Options{Log: slog.New(slog.NewTextHandler(io.Discard, nil))})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest("PUT", "/x", strings.NewReader("data")))
	if got := rr.Header().Get("Connection"); got != "" {
		t.Fatalf("Connection header %q on a fully read request", got)
	}
}

func TestAccessLogStripsSignatures(t *testing.T) {
	var buf bytes.Buffer
	h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }),
		Options{Log: slog.New(slog.NewTextHandler(&buf, nil))})
	rr := httptest.NewRecorder()
	h.ServeHTTP(rr, httptest.NewRequest("GET", "/b/k?X-Amz-Signature=deadbeef&x=1&X-Amz-Credential=AK%2F2026", nil))
	out := buf.String()
	if strings.Contains(out, "deadbeef") || strings.Contains(out, "X-Amz-Credential") {
		t.Fatalf("signature material in the access log: %s", out)
	}
	if !strings.Contains(out, "x=1") {
		t.Fatalf("harmless query parameters should still be logged: %s", out)
	}
}

// refuse answers 403 without touching the body, like an admission refusal.
func refuse(opt Options) *httptest.Server {
	opt.Log = slog.New(slog.NewTextHandler(io.Discard, nil))
	return httptest.NewServer(Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/xml")
		w.WriteHeader(http.StatusForbidden)
		io.WriteString(w, "<Error><Code>QuotaExceeded</Code></Error>")
	}), opt))
}

// readUntilClose reads what the server sends until it closes the connection and
// reports how long that took; a connection still open at the deadline is an error.
func readUntilClose(t *testing.T, conn net.Conn, within time.Duration) (string, time.Duration) {
	t.Helper()
	start := time.Now()
	conn.SetReadDeadline(start.Add(within))
	b, err := io.ReadAll(conn)
	if err != nil {
		t.Fatalf("the server did not close the connection within %v (read %q): %v", within, b, err)
	}
	return string(b), time.Since(start)
}

// A client that keeps streaming a large body must be able to finish sending and
// read the S3 error: the node reads and discards the rest after answering,
// instead of closing the connection on data that is still arriving (an RST that
// shows up as "broken pipe" in the client, spec §3.5).
func TestRefusedUploadIsDrainedSoTheClientSeesTheAnswer(t *testing.T) {
	srv := refuse(Options{IdleTimeout: time.Minute})
	defer srv.Close()
	conn, err := net.Dial("tcp", srv.Listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	const size = 8 << 20
	io.WriteString(conn, "PUT /x/k HTTP/1.1\r\nHost: x\r\nContent-Length: 8388608\r\n\r\n")
	chunk := bytes.Repeat([]byte("x"), 64<<10)
	for sent := 0; sent < size; sent += len(chunk) {
		conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
		if _, err := conn.Write(chunk); err != nil {
			t.Fatalf("the connection was torn down after %d of %d bytes: %v", sent, size, err)
		}
	}
	// the answer is complete and the connection ends in an orderly close
	resp, _ := readUntilClose(t, conn, 5*time.Second)
	if !strings.HasPrefix(resp, "HTTP/1.1 403") || !strings.Contains(strings.ToLower(resp), "connection: close") || !strings.Contains(resp, "QuotaExceeded") {
		t.Fatalf("want the 403 with Connection: close and its body, got %q", resp)
	}
}

// What the node reads after the answer is bounded: a body that stalls (the
// client sent a little and went quiet) does not pin the connection for longer
// than the idle wait, and one that goes on and on is cut at the byte cap.
func TestLingeringIsBounded(t *testing.T) {
	t.Run("stalled body", func(t *testing.T) {
		srv := refuse(Options{IdleTimeout: 300 * time.Millisecond})
		defer srv.Close()
		conn, err := net.Dial("tcp", srv.Listener.Addr().String())
		if err != nil {
			t.Fatal(err)
		}
		defer conn.Close()
		io.WriteString(conn, "PUT /x/k HTTP/1.1\r\nHost: x\r\nContent-Length: 1000\r\n\r\nab") // then silence
		// the answer is not held up by the body ...
		conn.SetReadDeadline(time.Now().Add(time.Second))
		buf := make([]byte, 1024)
		n, err := conn.Read(buf)
		if err != nil || !strings.HasPrefix(string(buf[:n]), "HTTP/1.1 403") {
			t.Fatalf("no prompt answer: %q %v", buf[:n], err)
		}
		// ... and the connection is not held for it for long either
		if _, d := readUntilClose(t, conn, 5*time.Second); d > 3*time.Second {
			t.Fatalf("the connection was held for %v for a body that does not arrive", d)
		}
	})
	t.Run("endless body", func(t *testing.T) {
		defer func(old int64) { lingerMaxBytes = old }(lingerMaxBytes)
		lingerMaxBytes = 256 << 10
		srv := refuse(Options{IdleTimeout: time.Minute})
		defer srv.Close()
		conn, err := net.Dial("tcp", srv.Listener.Addr().String())
		if err != nil {
			t.Fatal(err)
		}
		defer conn.Close()
		io.WriteString(conn, "PUT /x/k HTTP/1.1\r\nHost: x\r\nContent-Length: 1073741824\r\n\r\n")
		done := make(chan struct{})
		go func() { // keeps sending until the node cuts it off
			defer close(done)
			chunk := bytes.Repeat([]byte("x"), 64<<10)
			for i := 0; i < 16384; i++ {
				conn.SetWriteDeadline(time.Now().Add(5 * time.Second))
				if _, err := conn.Write(chunk); err != nil {
					return
				}
			}
		}()
		select {
		case <-done: // the writer failed: the node closed the connection at the cap
		case <-time.After(10 * time.Second):
			t.Fatal("the node kept reading a body far beyond the cap")
		}
	})
}

// A client that asked for 100-continue and was refused has sent no body: the
// node neither invites it nor waits for it.
func TestExpectContinueRefusalDoesNotWaitForTheBody(t *testing.T) {
	srv := refuse(Options{IdleTimeout: time.Minute})
	defer srv.Close()
	conn, err := net.Dial("tcp", srv.Listener.Addr().String())
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()
	io.WriteString(conn, "PUT /x/k HTTP/1.1\r\nHost: x\r\nContent-Length: 5242880\r\nExpect: 100-continue\r\n\r\n")
	resp, d := readUntilClose(t, conn, 5*time.Second)
	if !strings.HasPrefix(resp, "HTTP/1.1 403") || strings.Contains(resp, "100 Continue") {
		t.Fatalf("%q", resp)
	}
	if d > 2*time.Second {
		t.Fatalf("closed after %v: the node waits for a body the client holds back", d)
	}
}

// A 503 SlowDown is the rate limit working, so its access-log line is a warning; any other 5xx stays
// an error (spec §9.1).
func TestThrottlingIsLoggedAsAWarning(t *testing.T) {
	log := func(status int, code string) string {
		var buf bytes.Buffer
		h := Wrap(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			From(r.Context()).ErrCode = code
			w.WriteHeader(status)
		}), Options{Log: slog.New(slog.NewTextHandler(&buf, nil))})
		h.ServeHTTP(httptest.NewRecorder(), httptest.NewRequest("GET", "/b/k", nil))
		return buf.String()
	}
	if got := log(503, "SlowDown"); !strings.Contains(got, "level=WARN") {
		t.Errorf("a throttled request is logged %q", got)
	}
	if got := log(503, "ServiceUnavailable"); !strings.Contains(got, "level=ERROR") {
		t.Errorf("an unavailable service is logged %q", got)
	}
	if got := log(500, "InternalError"); !strings.Contains(got, "level=ERROR") {
		t.Errorf("a server error is logged %q", got)
	}
	if got := log(200, ""); !strings.Contains(got, "level=INFO") {
		t.Errorf("a normal request is logged %q", got)
	}
}
