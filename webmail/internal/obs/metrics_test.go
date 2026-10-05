package obs

import (
	"bytes"
	"strings"
	"testing"
)

func TestExposition(t *testing.T) {
	r := NewRegistry()
	c := r.Counter("binvault_http_requests_total", "Requests.", "op", "status")
	c.Inc("GetObject", "200")
	c.Add(2, "GetObject", "200")
	c.Inc("PutObject", "403")
	h := r.Histogram("binvault_http_request_duration_seconds", "Latency.", []float64{0.1, 1}, "op")
	h.Observe(0.05, "GetObject")
	h.Observe(0.5, "GetObject")
	g := r.Gauge("binvault_x", "X.", "bucket")
	g.Set(7, `we"ird`)
	var buf bytes.Buffer
	if _, err := r.WriteTo(&buf); err != nil {
		t.Fatal(err)
	}
	out := buf.String()
	for _, want := range []string{
		`binvault_http_requests_total{op="GetObject",status="200"} 3`,
		`binvault_http_requests_total{op="PutObject",status="403"} 1`,
		`binvault_http_request_duration_seconds_bucket{op="GetObject",le="0.1"} 1`,
		`binvault_http_request_duration_seconds_bucket{op="GetObject",le="+Inf"} 2`,
		`binvault_http_request_duration_seconds_count{op="GetObject"} 2`,
		`binvault_x{bucket="we\"ird"} 7`,
		`# TYPE go_goroutines gauge`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
}
