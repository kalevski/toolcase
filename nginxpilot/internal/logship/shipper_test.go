package logship

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"testing"
	"time"
)

func testLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

func mkEntry(host string, status int, ts time.Time) Entry {
	raw := fmt.Sprintf(`{"ts":%q,"host":%q,"status":%d,"resource":%q,"resource_type":"proxy"}`,
		ts.Format(time.RFC3339), host, status, host)
	return ParseAccessLine([]byte(raw), ParseOptions{RedactParams: []string{}})
}

// fakeLoki records push requests and can be told to fail.
type fakeLoki struct {
	mu       sync.Mutex
	pushes   []lokiPush
	tenants  []string
	fail     int // respond 429 for the first N requests
	failCode int
}

func (f *fakeLoki) handler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		f.mu.Lock()
		defer f.mu.Unlock()
		if f.fail > 0 {
			f.fail--
			code := f.failCode
			if code == 0 {
				code = http.StatusTooManyRequests
			}
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(code)
			return
		}
		body, _ := io.ReadAll(r.Body)
		var push lokiPush
		if err := json.Unmarshal(body, &push); err != nil {
			w.WriteHeader(http.StatusBadRequest)
			return
		}
		f.pushes = append(f.pushes, push)
		f.tenants = append(f.tenants, r.Header.Get("X-Scope-OrgID"))
		w.WriteHeader(http.StatusNoContent)
	}
}

func (f *fakeLoki) pushCount() int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return len(f.pushes)
}

func waitFor(t *testing.T, timeout time.Duration, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(timeout)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatal("condition not met before timeout")
}

func TestLokiSinkBatchShape(t *testing.T) {
	loki := &fakeLoki{}
	srv := httptest.NewServer(loki.handler())
	defer srv.Close()

	s := NewShipper(testLogger())
	dest := Destination{
		Name: "main-loki", Type: DestLoki, URL: srv.URL, Tenant: "infra",
		Labels:        Labels{Job: "nginx", HostSource: "$resource", StatusSource: "$status", Static: map[string]string{"instance": "edge-1"}},
		BatchSize:     10,
		FlushInterval: 20 * time.Millisecond,
	}
	dest.SetSpec("v1")
	s.Configure([]Destination{dest})
	defer s.Close()

	base := time.Date(2026, 7, 6, 10, 0, 0, 0, time.UTC)
	// Out of order on purpose — the sink must sort within each stream.
	s.Dispatch(mkEntry("api.example.com", 200, base.Add(2*time.Second)))
	s.Dispatch(mkEntry("api.example.com", 200, base))
	s.Dispatch(mkEntry("www.example.com", 502, base.Add(time.Second)))

	waitFor(t, 2*time.Second, func() bool { return loki.pushCount() >= 1 })

	loki.mu.Lock()
	defer loki.mu.Unlock()
	if loki.tenants[0] != "infra" {
		t.Errorf("tenant header = %q", loki.tenants[0])
	}
	push := loki.pushes[0]
	if len(push.Streams) != 2 {
		t.Fatalf("streams = %d, want 2 (grouped by label set)", len(push.Streams))
	}
	for _, st := range push.Streams {
		if st.Stream["job"] != "nginx" || st.Stream["instance"] != "edge-1" {
			t.Errorf("labels = %v", st.Stream)
		}
		if st.Stream["host"] == "" || st.Stream["status_code"] == "" {
			t.Errorf("dynamic labels missing: %v", st.Stream)
		}
		for i := 1; i < len(st.Values); i++ {
			if st.Values[i-1][0] > st.Values[i][0] {
				t.Error("values not sorted by timestamp")
			}
		}
	}
}

func TestShipperRetriesOn429(t *testing.T) {
	loki := &fakeLoki{fail: 2}
	srv := httptest.NewServer(loki.handler())
	defer srv.Close()

	s := NewShipper(testLogger())
	dest := Destination{
		Name: "loki", Type: DestLoki, URL: srv.URL,
		Labels:        Labels{Job: "nginx"},
		FlushInterval: 20 * time.Millisecond,
		MaxRetries:    5,
	}
	dest.SetSpec("v1")
	s.Configure([]Destination{dest})
	defer s.Close()

	s.Dispatch(mkEntry("api.example.com", 500, time.Now()))
	waitFor(t, 5*time.Second, func() bool { return loki.pushCount() >= 1 })

	st := s.Status()
	if st.Destinations[0].Shipped != 1 {
		t.Errorf("shipped = %d, want 1", st.Destinations[0].Shipped)
	}
}

func TestShipperPermanentFailureDropsBatch(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "bad payload", http.StatusBadRequest)
	}))
	defer srv.Close()

	s := NewShipper(testLogger())
	dest := Destination{
		Name: "loki", Type: DestLoki, URL: srv.URL,
		Labels:        Labels{Job: "nginx"},
		FlushInterval: 20 * time.Millisecond,
	}
	dest.SetSpec("v1")
	s.Configure([]Destination{dest})
	defer s.Close()

	s.Dispatch(mkEntry("api.example.com", 500, time.Now()))
	waitFor(t, 2*time.Second, func() bool {
		st := s.Status()
		return st.Destinations[0].FailedBatches >= 1
	})
	st := s.Status()
	d := st.Destinations[0]
	if d.Shipped != 0 || d.BufferLen != 0 {
		t.Errorf("permanent failure should drop the batch: %+v", d)
	}
	if !strings.Contains(d.LastError, "400") {
		t.Errorf("last_error = %q", d.LastError)
	}
	// Bug 11: a permanently-dropped batch must still count as dropped, or
	// received != shipped+dropped and the loss is invisible to operators.
	if d.Dropped == 0 {
		t.Errorf("permanently-failed batch not counted as dropped: %+v", d)
	}
}

// TestHTTPSinkBatchIDStableAcrossRetries is bug 3: a batch retried after a
// transient failure must present the same X-NP-Batch-ID on every attempt, or
// a dedupe-capable consumer can't recognize the replay.
func TestHTTPSinkBatchIDStableAcrossRetries(t *testing.T) {
	var mu sync.Mutex
	var ids []string
	attempts := 0
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		_, _ = io.ReadAll(r.Body)
		mu.Lock()
		attempts++
		n := attempts
		ids = append(ids, r.Header.Get("X-NP-Batch-ID"))
		mu.Unlock()
		if n == 1 {
			w.Header().Set("Retry-After", "0")
			w.WriteHeader(http.StatusTooManyRequests)
			return
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	defer srv.Close()

	s := NewShipper(testLogger())
	dest := Destination{
		Name: "http", Type: DestHTTP, URL: srv.URL,
		FlushInterval: 20 * time.Millisecond,
		MaxRetries:    3,
	}
	dest.SetSpec("v1")
	s.Configure([]Destination{dest})
	defer s.Close()

	s.Dispatch(mkEntry("api.example.com", 500, time.Now()))
	waitFor(t, 2*time.Second, func() bool {
		mu.Lock()
		defer mu.Unlock()
		return attempts >= 2
	})

	mu.Lock()
	defer mu.Unlock()
	if len(ids) < 2 {
		t.Fatalf("expected a retry, got %d attempt(s)", len(ids))
	}
	for i, id := range ids {
		if id == "" {
			t.Errorf("attempt %d: missing X-NP-Batch-ID", i)
		}
		if id != ids[0] {
			t.Errorf("attempt %d batch ID %q != attempt 0 ID %q — retries must reuse one ID", i, id, ids[0])
		}
	}
}

func TestShipperBufferDropsOldest(t *testing.T) {
	s := NewShipper(testLogger())
	// Destination with no reachable sink: use file in a temp dir but a tiny buffer,
	// and a very long flush interval so nothing drains during the test.
	dest := Destination{
		Name: "buf", Type: DestFile, Path: filepath.Join(t.TempDir(), "x.ndjson"),
		BufferEntries: 4, FlushInterval: time.Hour, BatchSize: 100,
	}
	dest.SetSpec("v1")
	s.Configure([]Destination{dest})
	defer s.Close()

	for i := 0; i < 10; i++ {
		s.Dispatch(mkEntry("api.example.com", 200, time.Now()))
	}
	st := s.Status()
	d := st.Destinations[0]
	if d.BufferLen != 4 {
		t.Errorf("buffer_len = %d, want 4", d.BufferLen)
	}
	if d.Dropped != 6 {
		t.Errorf("dropped = %d, want 6", d.Dropped)
	}
}

func TestShipperFilterAndSample(t *testing.T) {
	filter, err := CompileFilter(map[string][]string{"status": {"5xx"}}, FieldsAccess)
	if err != nil {
		t.Fatal(err)
	}
	s := NewShipper(testLogger())
	dest := Destination{
		Name: "errs", Type: DestFile, Path: filepath.Join(t.TempDir(), "e.ndjson"),
		Filter: filter, FlushInterval: time.Hour, BatchSize: 100,
	}
	dest.SetSpec("v1")
	s.Configure([]Destination{dest})
	defer s.Close()

	s.Dispatch(mkEntry("a", 200, time.Now()))
	s.Dispatch(mkEntry("a", 502, time.Now()))
	s.Dispatch(mkEntry("a", 301, time.Now()))
	if got := s.Status().Destinations[0].BufferLen; got != 1 {
		t.Errorf("buffer_len = %d, want 1 (only the 502)", got)
	}
}

func TestFileSinkRotation(t *testing.T) {
	dir := t.TempDir()
	path := filepath.Join(dir, "access.ndjson")
	sink, err := newFileSink(&Destination{Path: path, MaxSize: 100, MaxFiles: 2})
	if err != nil {
		t.Fatal(err)
	}
	defer sink.Close()

	line := mkEntry("api.example.com", 200, time.Now())
	for i := 0; i < 10; i++ {
		if err := sink.Send(context.Background(), []Entry{line}, "test-batch"); err != nil {
			t.Fatal(err)
		}
	}
	if _, err := os.Stat(path + ".1"); err != nil {
		t.Errorf("expected rotated file: %v", err)
	}
	if _, err := os.Stat(path + ".2"); err == nil {
		t.Error("max_files=2 must keep at most one rotated file")
	}
}

func TestConfigureKeepsUnchangedWorkerStats(t *testing.T) {
	s := NewShipper(testLogger())
	dest := Destination{
		Name: "keep", Type: DestFile, Path: filepath.Join(t.TempDir(), "k.ndjson"),
		FlushInterval: time.Hour, BatchSize: 100,
	}
	dest.SetSpec("spec-a")
	s.Configure([]Destination{dest})
	defer s.Close()
	s.Dispatch(mkEntry("a", 200, time.Now()))

	// Same spec → stats survive.
	s.Configure([]Destination{dest})
	if got := s.Status().Destinations[0].BufferLen; got != 1 {
		t.Errorf("unchanged spec should keep the worker (buffer_len = %d)", got)
	}

	// Changed spec → fresh worker.
	changed := dest
	changed.SetSpec("spec-b")
	s.Configure([]Destination{changed})
	if got := s.Status().Destinations[0].BufferLen; got != 0 {
		t.Errorf("changed spec should restart the worker (buffer_len = %d)", got)
	}
}

func TestTestDestination(t *testing.T) {
	loki := &fakeLoki{}
	srv := httptest.NewServer(loki.handler())
	defer srv.Close()

	err := TestDestination(context.Background(), &Destination{
		Name: "t", Type: DestLoki, URL: srv.URL, Labels: Labels{Job: "nginx"},
	})
	if err != nil {
		t.Fatalf("TestDestination: %v", err)
	}
	if loki.pushCount() != 1 {
		t.Errorf("pushes = %d", loki.pushCount())
	}

	bad := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
		http.Error(w, "no", http.StatusUnauthorized)
	}))
	defer bad.Close()
	err = TestDestination(context.Background(), &Destination{
		Name: "t", Type: DestLoki, URL: bad.URL, Labels: Labels{Job: "nginx"},
	})
	if err == nil || !strings.Contains(err.Error(), "401") {
		t.Errorf("expected 401 error, got %v", err)
	}
}

func TestIntakeEndToEnd(t *testing.T) {
	s := NewShipper(testLogger())
	dest := Destination{
		Name: "all", Type: DestFile, Path: filepath.Join(t.TempDir(), "a.ndjson"),
		FlushInterval: time.Hour, BatchSize: 1000,
	}
	dest.SetSpec("v1")
	s.Configure([]Destination{dest})
	defer s.Close()

	intake := NewIntake("127.0.0.1:0", s, ParseOptions{}, testLogger())
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	if err := intake.Start(ctx); err != nil {
		t.Fatal(err)
	}
	defer intake.Close()

	addr := intake.conn.LocalAddr().String()
	conn, err := net.Dial("udp", addr)
	if err != nil {
		t.Fatal(err)
	}
	defer conn.Close()

	_, _ = conn.Write([]byte(`<190>Jul  6 10:00:00 edge nginxpilot: ` + sampleLine))
	_, _ = conn.Write([]byte(`<190>Jul  6 10:00:00 edge nginxpilot: {"truncated`))
	_, _ = conn.Write([]byte(`total garbage`))

	waitFor(t, 2*time.Second, func() bool { return s.Status().Received == 3 })
	st := s.Status()
	if st.ParseErrors != 2 {
		t.Errorf("parse_errors = %d, want 2", st.ParseErrors)
	}
	if st.Destinations[0].BufferLen != 3 {
		t.Errorf("buffered = %d, want 3 (parse errors ship too)", st.Destinations[0].BufferLen)
	}
}
