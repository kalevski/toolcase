package api

import (
	"bufio"
	"net/http/httptest"
	"strconv"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/imagewarden/internal/state"
)

// TestHandleMetricsContentType pins the exact Prometheus text-exposition
// content type (spec §5, §8).
func TestHandleMetricsContentType(t *testing.T) {
	s := newTestServer(state.New())

	rr := httptest.NewRecorder()
	s.handleMetrics(rr, httptest.NewRequest("GET", "/metrics", nil))

	want := "text/plain; version=0.0.4; charset=utf-8"
	if got := rr.Header().Get("Content-Type"); got != want {
		t.Errorf("Content-Type = %q, want %q", got, want)
	}
}

// TestHandleMetricsRequestsAndDecisions asserts the plain counters and the
// deterministic allow/review/block label ordering.
func TestHandleMetricsRequestsAndDecisions(t *testing.T) {
	st := state.New()
	st.RecordRequest()
	st.RecordRequest()
	st.RecordDecision("allow")
	st.RecordDecision("allow")
	st.RecordDecision("block")

	s := newTestServer(st)
	rr := httptest.NewRecorder()
	s.handleMetrics(rr, httptest.NewRequest("GET", "/metrics", nil))
	body := rr.Body.String()

	if !strings.Contains(body, "imagewarden_requests_total 2\n") {
		t.Errorf("body missing imagewarden_requests_total 2, got:\n%s", body)
	}

	wantLines := []string{
		`imagewarden_decisions_total{decision="allow"} 2`,
		`imagewarden_decisions_total{decision="review"} 0`,
		`imagewarden_decisions_total{decision="block"} 1`,
	}
	idx := -1
	for _, want := range wantLines {
		i := strings.Index(body, want)
		if i == -1 {
			t.Fatalf("body missing line %q, got:\n%s", want, body)
		}
		if i <= idx {
			t.Errorf("decision label lines out of order: %q did not appear after previous label", want)
		}
		idx = i
	}
}

// TestHandleMetricsErrorsSortedByCode asserts errors_by_code is rendered
// over a sorted key slice, not raw (unordered) map iteration.
func TestHandleMetricsErrorsSortedByCode(t *testing.T) {
	st := state.New()
	st.RecordError(500)
	st.RecordError(400)
	st.RecordError(429)

	s := newTestServer(st)
	rr := httptest.NewRecorder()
	s.handleMetrics(rr, httptest.NewRequest("GET", "/metrics", nil))
	body := rr.Body.String()

	var codeLines []string
	for _, line := range strings.Split(body, "\n") {
		if strings.HasPrefix(line, "imagewarden_errors_total{") {
			codeLines = append(codeLines, line)
		}
	}

	// state.New pre-populates every known error code, so all 8 lines are
	// always present regardless of which codes actually errored.
	wantCodes := []int{400, 401, 413, 415, 422, 429, 500, 503}
	if len(codeLines) != len(wantCodes) {
		t.Fatalf("got %d imagewarden_errors_total lines, want %d:\n%v", len(codeLines), len(wantCodes), codeLines)
	}
	for i, code := range wantCodes {
		want := `imagewarden_errors_total{code="` + strconv.Itoa(code) + `"}`
		if !strings.HasPrefix(codeLines[i], want) {
			t.Errorf("line %d = %q, want prefix %q (sorted code order)", i, codeLines[i], want)
		}
	}

	if !strings.Contains(body, `imagewarden_errors_total{code="500"} 1`) {
		t.Errorf("body missing imagewarden_errors_total{code=\"500\"} 1, got:\n%s", body)
	}
	if !strings.Contains(body, `imagewarden_errors_total{code="400"} 1`) {
		t.Errorf("body missing imagewarden_errors_total{code=\"400\"} 1, got:\n%s", body)
	}
	if !strings.Contains(body, `imagewarden_errors_total{code="429"} 1`) {
		t.Errorf("body missing imagewarden_errors_total{code=\"429\"} 1, got:\n%s", body)
	}
}

// TestHandleMetricsHistogramCumulativeAndMonotonic pins the hard Prometheus
// requirements: bucket counts are cumulative/non-decreasing across "le"
// boundaries, and the "+Inf" bucket equals _count.
func TestHandleMetricsHistogramCumulativeAndMonotonic(t *testing.T) {
	st := state.New()
	for _, ms := range []float64{1, 6, 15, 30, 75, 150, 300, 600} {
		st.ObserveLatency(ms)
	}
	snap := st.Snapshot()

	s := newTestServer(st)
	rr := httptest.NewRecorder()
	s.handleMetrics(rr, httptest.NewRequest("GET", "/metrics", nil))
	body := rr.Body.String()

	var buckets []int64
	var infCount int64
	sc := bufio.NewScanner(strings.NewReader(body))
	for sc.Scan() {
		line := sc.Text()
		if !strings.HasPrefix(line, "imagewarden_request_latency_ms_bucket{le=") {
			continue
		}
		fields := strings.Fields(line)
		count, err := strconv.ParseInt(fields[len(fields)-1], 10, 64)
		if err != nil {
			t.Fatalf("bucket line %q: %v", line, err)
		}
		if strings.Contains(line, `le="+Inf"`) {
			infCount = count
			continue
		}
		buckets = append(buckets, count)
	}

	if len(buckets) != len(metricsLatencyBuckets) {
		t.Fatalf("got %d finite buckets, want %d", len(buckets), len(metricsLatencyBuckets))
	}
	for i := 1; i < len(buckets); i++ {
		if buckets[i] < buckets[i-1] {
			t.Errorf("bucket[%d]=%d < bucket[%d]=%d, want non-decreasing", i, buckets[i], i-1, buckets[i-1])
		}
	}
	if infCount != snap.LatCount {
		t.Errorf("+Inf bucket = %d, want %d (== _count)", infCount, snap.LatCount)
	}
	if !strings.Contains(body, "imagewarden_request_latency_ms_count "+strconv.FormatInt(snap.LatCount, 10)) {
		t.Errorf("body missing imagewarden_request_latency_ms_count %d, got:\n%s", snap.LatCount, body)
	}
}

// TestMetricsBucketBoundariesMatchState guards metricsLatencyBuckets (mirrored
// here purely for this assertion) against silently diverging from the
// boundaries internal/state actually computed its counts against.
func TestMetricsBucketBoundariesMatchState(t *testing.T) {
	snap := state.New().Snapshot()
	if len(snap.Buckets) != len(metricsLatencyBuckets) {
		t.Fatalf("state.Snapshot has %d buckets, metricsLatencyBuckets has %d", len(snap.Buckets), len(metricsLatencyBuckets))
	}
	for i, b := range snap.Buckets {
		if b.Le != metricsLatencyBuckets[i] {
			t.Errorf("bucket[%d].Le = %v, want %v (metricsLatencyBuckets diverged from state)", i, b.Le, metricsLatencyBuckets[i])
		}
	}
}

// TestHandleMetricsHelpAndType asserts every metric has both a HELP and a
// TYPE comment line, with the expected metric type.
func TestHandleMetricsHelpAndType(t *testing.T) {
	s := newTestServer(state.New())
	rr := httptest.NewRecorder()
	s.handleMetrics(rr, httptest.NewRequest("GET", "/metrics", nil))
	body := rr.Body.String()

	wantTypes := map[string]string{
		"imagewarden_requests_total":     "counter",
		"imagewarden_decisions_total":    "counter",
		"imagewarden_errors_total":       "counter",
		"imagewarden_request_latency_ms": "histogram",
	}
	for name, typ := range wantTypes {
		if !strings.Contains(body, "# HELP "+name+" ") {
			t.Errorf("body missing HELP line for %s, got:\n%s", name, body)
		}
		if !strings.Contains(body, "# TYPE "+name+" "+typ+"\n") {
			t.Errorf("body missing TYPE %s %s line, got:\n%s", name, typ, body)
		}
	}
}
