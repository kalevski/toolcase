package api

import (
	"fmt"
	"net/http"
	"sort"
)

// decisionLabels is the fixed, ordered set of classify verdict labels emitted
// for imagewarden_decisions_total, so output ordering is deterministic across
// scrapes (the drift/format test asserts it) instead of depending on Go's
// unspecified map iteration order.
var decisionLabels = []string{"allow", "review", "block"}

// metricsLatencyBuckets mirrors internal/state's cumulative histogram bounds
// (state.latencyBuckets is unexported) purely so a test can assert the two
// never diverge. Rendering itself never reads this slice — it reads the "le"
// value straight off each state.Bucket in the Snapshot, so the emitted
// boundaries are always exactly what state computed the counts against.
var metricsLatencyBuckets = []float64{5, 10, 20, 50, 100, 200, 500}

// handleMetrics renders Prometheus text exposition format v0.0.4 (spec §5,
// §8) by hand, with no client-library dependency (spec keeps go.mod small).
// One Snapshot backs the whole response so counters and the latency
// histogram agree within a single scrape.
//
// Label-value escaping: Prometheus label values require escaping `\`, `"`,
// and newline. Every label value written here — "allow"/"review"/"block",
// numeric error codes, numeric "le" bounds — is drawn from a fixed,
// hand-picked vocabulary that can never contain those characters, so no
// escaping helper is used. Called out explicitly rather than left implicit:
// a future label built from anything other than this fixed vocabulary (e.g.
// a dynamic value) must escape it before reuse here.
func (s *Server) handleMetrics(w http.ResponseWriter, _ *http.Request) {
	snap := s.state.Snapshot()

	w.Header().Set("Content-Type", "text/plain; version=0.0.4; charset=utf-8")

	fmt.Fprintf(w, "# HELP imagewarden_requests_total Total number of HTTP requests handled.\n")
	fmt.Fprintf(w, "# TYPE imagewarden_requests_total counter\n")
	fmt.Fprintf(w, "imagewarden_requests_total %d\n", snap.Requests)

	decisionCounts := map[string]int64{
		"allow":  snap.Allow,
		"review": snap.Review,
		"block":  snap.Block,
	}
	fmt.Fprintf(w, "# HELP imagewarden_decisions_total Total classify decisions by verdict.\n")
	fmt.Fprintf(w, "# TYPE imagewarden_decisions_total counter\n")
	for _, label := range decisionLabels {
		fmt.Fprintf(w, "imagewarden_decisions_total{decision=%q} %d\n", label, decisionCounts[label])
	}

	codes := make([]int, 0, len(snap.ErrorsByCode))
	for code := range snap.ErrorsByCode {
		codes = append(codes, code)
	}
	sort.Ints(codes)
	fmt.Fprintf(w, "# HELP imagewarden_errors_total Total HTTP error responses by status code.\n")
	fmt.Fprintf(w, "# TYPE imagewarden_errors_total counter\n")
	for _, code := range codes {
		fmt.Fprintf(w, "imagewarden_errors_total{code=\"%d\"} %d\n", code, snap.ErrorsByCode[code])
	}

	// Buckets are read straight from the Snapshot (state.State keeps them
	// cumulative and monotonic across ObserveLatency calls); le="+Inf" is
	// defined to equal the total observation count, matching Prometheus'
	// hard requirement that the +Inf bucket equal _count.
	fmt.Fprintf(w, "# HELP imagewarden_request_latency_ms Request latency in milliseconds.\n")
	fmt.Fprintf(w, "# TYPE imagewarden_request_latency_ms histogram\n")
	for _, b := range snap.Buckets {
		fmt.Fprintf(w, "imagewarden_request_latency_ms_bucket{le=\"%g\"} %d\n", b.Le, b.Count)
	}
	fmt.Fprintf(w, "imagewarden_request_latency_ms_bucket{le=\"+Inf\"} %d\n", snap.LatCount)
	fmt.Fprintf(w, "imagewarden_request_latency_ms_sum %g\n", snap.LatSum)
	fmt.Fprintf(w, "imagewarden_request_latency_ms_count %d\n", snap.LatCount)
}
