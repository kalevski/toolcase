package pipeline

import (
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
)

func testInvoker(t *testing.T, mod func(*config.Config)) *Invoker {
	t.Helper()
	cfg := config.ForTest(func(c *config.Config) {
		c.PipelineAllowPrivate = true
		if mod != nil {
			mod(c)
		}
	})
	iv, err := NewInvoker(cfg, "9.9.9", slog.New(slog.NewTextHandler(io.Discard, nil)))
	if err != nil {
		t.Fatal(err)
	}
	return iv
}

func baseCall(url string) Call {
	return Call{URL: url, Body: []byte(`{"a":1}`), Run: "run_1", Attempt: 2, Pipeline: "p", Stage: "after", Event: "object.created", Timeout: 2 * time.Second}
}

func TestClassify(t *testing.T) {
	want := map[int]Outcome{
		200: OutcomeOK, 201: OutcomeOK, 204: OutcomeOK,
		202: OutcomeFailed, 203: OutcomeFailed, 206: OutcomeFailed, 301: OutcomeFailed, 302: OutcomeFailed, 307: OutcomeFailed,
		400: OutcomeFailed, 401: OutcomeFailed, 403: OutcomeFailed, 404: OutcomeFailed, 409: OutcomeFailed, 410: OutcomeFailed,
		422: OutcomeRejected,
		408: OutcomeTransient, 425: OutcomeTransient, 429: OutcomeTransient, 500: OutcomeTransient, 502: OutcomeTransient,
		503: OutcomeTransient, 504: OutcomeTransient, 599: OutcomeTransient,
	}
	for status, o := range want {
		if got := Classify(status); got != o {
			t.Errorf("Classify(%d) = %v, want %v", status, got, o)
		}
	}
}

func TestSignMatchesAnIndependentHMAC(t *testing.T) {
	// computed independently with Python's hmac module
	got := Sign("0123456789abcdef0123456789abcdef", "1790942400", []byte(`{"a":1}`))
	if got != "v1=56893a75f2b0b5e23e5fedc19e6519a691d0792a7f0b97a2e9aff40bd16b1e1e" {
		t.Fatalf("signature = %s", got)
	}
}

func TestDoSendsTheInvocation(t *testing.T) {
	var gotHdr http.Header
	var gotBody []byte
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		gotHdr = r.Header.Clone()
		gotBody, _ = io.ReadAll(r.Body)
		if r.Method != "POST" || r.URL.Path != "/hooks/x" {
			t.Errorf("request: %s %s", r.Method, r.URL)
		}
		w.WriteHeader(204)
	}))
	defer srv.Close()
	iv := testInvoker(t, nil)
	c := baseCall(srv.URL + "/hooks/x")
	c.Headers = map[string]string{"Authorization": "Bearer service-secret", "X-Custom": "1"}
	c.Secret = "0123456789abcdef0123456789abcdef"
	res := iv.Do(context.Background(), c)
	if res.Outcome != OutcomeOK || res.Status != 204 {
		t.Fatalf("result: %+v", res)
	}
	if string(gotBody) != `{"a":1}` {
		t.Fatalf("body = %s", gotBody)
	}
	for h, want := range map[string]string{
		"Content-Type": "application/json", "User-Agent": "binvault/9.9.9", "Authorization": "Bearer service-secret", "X-Custom": "1",
		"X-Binvault-Run": "run_1", "X-Binvault-Attempt": "2", "X-Binvault-Pipeline": "p", "X-Binvault-Stage": "after",
		"X-Binvault-Event": "object.created",
	} {
		if gotHdr.Get(h) != want {
			t.Errorf("header %s = %q, want %q", h, gotHdr.Get(h), want)
		}
	}
	ts := gotHdr.Get("X-Binvault-Timestamp")
	sec, err := strconv.ParseInt(ts, 10, 64)
	if err != nil || time.Since(time.Unix(sec, 0)) > 5*time.Second {
		t.Fatalf("timestamp = %q", ts)
	}
	// the signature verifies the way a service would check it
	mac := hmac.New(sha256.New, []byte(c.Secret))
	mac.Write([]byte(ts + "."))
	mac.Write(gotBody)
	if want := "v1=" + hex.EncodeToString(mac.Sum(nil)); gotHdr.Get("X-Binvault-Signature") != want {
		t.Fatalf("signature = %q, want %q", gotHdr.Get("X-Binvault-Signature"), want)
	}
}

func TestDoWithoutSecretIsUnsigned(t *testing.T) {
	var sig atomic.Value
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		sig.Store(r.Header.Get("X-Binvault-Signature"))
		w.WriteHeader(200)
	}))
	defer srv.Close()
	if res := testInvoker(t, nil).Do(context.Background(), baseCall(srv.URL)); res.Outcome != OutcomeOK || sig.Load() != "" {
		t.Fatalf("%+v sig=%v", res, sig.Load())
	}
}

func TestDoStaticUserAgentWins(t *testing.T) {
	var ua atomic.Value
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { ua.Store(r.Header.Get("User-Agent")); w.WriteHeader(200) }))
	defer srv.Close()
	c := baseCall(srv.URL)
	c.Headers = map[string]string{"User-Agent": "my-agent"}
	testInvoker(t, nil).Do(context.Background(), c)
	if ua.Load() != "my-agent" {
		t.Fatalf("user agent = %v", ua.Load())
	}
}

func TestDoMessageAndRetryAfter(t *testing.T) {
	long := strings.Repeat("é", 600)
	cases := []struct {
		name   string
		status int
		ctype  string
		body   string
		retry  string
		msg    string
		ra     time.Duration
	}{
		{"json message", 422, "application/json", `{"message":"not a valid image"}`, "", "not a valid image", 0},
		{"json with charset", 422, "application/json; charset=utf-8", `{"message":"ok"}`, "", "ok", 0},
		{"not json", 422, "text/plain", `{"message":"ignored"}`, "", "", 0},
		{"message not a string", 422, "application/json", `{"message":42}`, "", "", 0},
		{"bad json", 422, "application/json", `{"message":`, "", "", 0},
		{"capped at 512 characters", 422, "application/json", `{"message":"` + long + `"}`, "", strings.Repeat("é", 512), 0},
		{"control characters are scrubbed", 422, "application/json", `{"message":"a\u0000b\u001bc"}`, "", "a b c", 0},
		{"retry after seconds", 429, "", "", "7", "", 7 * time.Second},
		{"retry after capped", 503, "", "", "999999", "", time.Hour},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
				if tc.ctype != "" {
					w.Header().Set("Content-Type", tc.ctype)
				}
				if tc.retry != "" {
					w.Header().Set("Retry-After", tc.retry)
				}
				w.WriteHeader(tc.status)
				io.WriteString(w, tc.body)
			}))
			defer srv.Close()
			res := testInvoker(t, nil).Do(context.Background(), baseCall(srv.URL))
			if res.Status != tc.status || res.Message != tc.msg || res.RetryAfter != tc.ra {
				t.Fatalf("result: %+v", res)
			}
		})
	}
}

func TestDoNeverFollowsRedirects(t *testing.T) {
	var hits atomic.Int32
	target := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits.Add(1); w.WriteHeader(200) }))
	defer target.Close()
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, target.URL, http.StatusFound)
	}))
	defer srv.Close()
	res := testInvoker(t, nil).Do(context.Background(), baseCall(srv.URL))
	if res.Outcome != OutcomeFailed || res.Status != 302 || hits.Load() != 0 {
		t.Fatalf("a redirect is a failure and is not followed: %+v hits=%d", res, hits.Load())
	}
}

func TestDoTimeout(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(3 * time.Second):
		case <-r.Context().Done():
		}
	}))
	defer srv.Close()
	c := baseCall(srv.URL)
	c.Timeout = 150 * time.Millisecond
	start := time.Now()
	res := testInvoker(t, nil).Do(context.Background(), c)
	if res.Outcome != OutcomeTransient || !res.TimedOut || time.Since(start) > 6*time.Second {
		t.Fatalf("timeout: %+v after %v", res, time.Since(start))
	}
}

func TestDoCancelled(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		select {
		case <-time.After(3 * time.Second):
		case <-r.Context().Done():
		}
	}))
	defer srv.Close()
	ctx, cancel := context.WithCancel(context.Background())
	go func() { time.Sleep(100 * time.Millisecond); cancel() }()
	res := testInvoker(t, nil).Do(ctx, baseCall(srv.URL))
	if res.Outcome != OutcomeCanceled {
		t.Fatalf("a cancelled caller is not a service failure: %+v", res)
	}
}

func TestDoConnectionRefusedIsTransient(t *testing.T) {
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	addr := l.Addr().String()
	l.Close()
	res := testInvoker(t, nil).Do(context.Background(), baseCall("http://"+addr))
	if res.Outcome != OutcomeTransient || res.Err == "" || res.TimedOut {
		t.Fatalf("connection error: %+v", res)
	}
}

func TestDoCapsTheResponseBody(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(200)
		chunk := []byte(strings.Repeat("x", 1<<20))
		for i := 0; i < 64; i++ { // 64 MiB the client never needs
			if _, err := w.Write(chunk); err != nil {
				return
			}
		}
	}))
	defer srv.Close()
	start := time.Now()
	res := testInvoker(t, nil).Do(context.Background(), baseCall(srv.URL))
	if res.Outcome != OutcomeOK || time.Since(start) > 20*time.Second {
		t.Fatalf("%+v after %v", res, time.Since(start))
	}
}

func TestDoRefusesPrivateAddressesWhenConfigured(t *testing.T) {
	var hits atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { hits.Add(1); w.WriteHeader(200) }))
	defer srv.Close()
	// the test server is on loopback
	iv := testInvoker(t, func(c *config.Config) { c.PipelineAllowPrivate = false })
	res := iv.Do(context.Background(), baseCall(srv.URL))
	if res.Outcome != OutcomeFailed || !strings.Contains(res.Err, "BINVAULT_PIPELINE_ALLOW_PRIVATE") || hits.Load() != 0 {
		t.Fatalf("loopback with allow_private=false: %+v hits=%d", res, hits.Load())
	}
	// a host name that resolves to loopback is refused at dial time too
	_, port, _ := net.SplitHostPort(strings.TrimPrefix(srv.URL, "http://"))
	res = iv.Do(context.Background(), baseCall("http://localhost:"+port))
	if res.Outcome != OutcomeFailed || hits.Load() != 0 {
		t.Fatalf("localhost with allow_private=false: %+v hits=%d", res, hits.Load())
	}
	// and the default allows it
	if res = testInvoker(t, nil).Do(context.Background(), baseCall(srv.URL)); res.Outcome != OutcomeOK {
		t.Fatalf("allowed by default: %+v", res)
	}
}

func TestDoAlwaysRefusesLinkLocalAndMetadata(t *testing.T) {
	iv := testInvoker(t, nil) // private addresses allowed
	for _, u := range []string{
		"http://169.254.169.254/latest/meta-data/", "http://169.254.1.1:8080/", "http://[fe80::1]:8080/",
		"http://[fd00:ec2::254]/", "http://100.100.100.200/", "http://192.0.0.192/", "http://168.63.129.16/",
	} {
		c := baseCall(u)
		c.Timeout = 3 * time.Second
		res := iv.Do(context.Background(), c)
		if res.Outcome != OutcomeFailed || !strings.Contains(res.Err, "not allowed") {
			t.Errorf("%s: %+v", u, res)
		}
	}
}

func TestDoTLSVerification(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(204) }))
	defer srv.Close()
	// TLS verification is on: an unknown CA is a connection failure
	res := testInvoker(t, nil).Do(context.Background(), baseCall(srv.URL))
	if res.Outcome != OutcomeTransient || !strings.Contains(res.Err, "certificate") {
		t.Fatalf("untrusted certificate: %+v", res)
	}
	// BINVAULT_PIPELINE_CA_FILE adds a trusted root
	ca := filepath.Join(t.TempDir(), "ca.pem")
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: srv.Certificate().Raw})
	if err := os.WriteFile(ca, pemBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	res = testInvoker(t, func(c *config.Config) { c.PipelineCAFile = ca }).Do(context.Background(), baseCall(srv.URL))
	if res.Outcome != OutcomeOK {
		t.Fatalf("trusted certificate: %+v", res)
	}
	_ = x509.NewCertPool
}

func TestNewInvokerCAFileErrors(t *testing.T) {
	cfg := config.ForTest(func(c *config.Config) { c.PipelineCAFile = filepath.Join(t.TempDir(), "missing.pem") })
	if _, err := NewInvoker(cfg, "v", nil); err == nil {
		t.Fatal("a missing CA file must fail")
	}
	bad := filepath.Join(t.TempDir(), "bad.pem")
	_ = os.WriteFile(bad, []byte("not a certificate"), 0o600)
	cfg = config.ForTest(func(c *config.Config) { c.PipelineCAFile = bad })
	if _, err := NewInvoker(cfg, "v", nil); err == nil {
		t.Fatal("a CA file without certificates must fail")
	}
}

func TestDoIgnoresEnvironmentProxies(t *testing.T) {
	t.Setenv("HTTP_PROXY", "http://127.0.0.1:1")
	t.Setenv("HTTPS_PROXY", "http://127.0.0.1:1")
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { w.WriteHeader(200) }))
	defer srv.Close()
	if res := testInvoker(t, nil).Do(context.Background(), baseCall(srv.URL)); res.Outcome != OutcomeOK {
		t.Fatalf("the address checked is the address dialed, never a proxy: %+v", res)
	}
}

func TestDoSpeaksHTTP2ToHTTPSServices(t *testing.T) {
	var proto atomic.Int32
	srv := httptest.NewUnstartedServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		proto.Store(int32(r.ProtoMajor))
		w.WriteHeader(204)
	}))
	srv.EnableHTTP2 = true
	srv.StartTLS()
	defer srv.Close()
	ca := filepath.Join(t.TempDir(), "ca.pem")
	if err := os.WriteFile(ca, pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: srv.Certificate().Raw}), 0o600); err != nil {
		t.Fatal(err)
	}
	res := testInvoker(t, func(c *config.Config) { c.PipelineCAFile = ca }).Do(context.Background(), baseCall(srv.URL))
	if res.Outcome != OutcomeOK || proto.Load() != 2 {
		t.Fatalf("%+v proto=%d", res, proto.Load())
	}
}
