package obs

import (
	"bytes"
	"runtime"
	"strconv"
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

// The runtime and process metrics carry the standard names and types (spec §9.2), with the
// platform-dependent ones only where the platform can give them.
func TestRuntimeAndProcessMetrics(t *testing.T) {
	r := NewRegistry()
	var buf bytes.Buffer
	if _, err := r.WriteTo(&buf); err != nil {
		t.Fatal(err)
	}
	out := buf.String()
	want := []string{
		"# TYPE go_goroutines gauge",
		"# TYPE go_threads gauge",
		"# TYPE go_memstats_alloc_bytes gauge",
		"# TYPE go_memstats_sys_bytes gauge",
		"# TYPE go_gc_cycles_total counter",
		"# TYPE go_gc_duration_seconds summary",
		`go_gc_duration_seconds{quantile="0"} `,
		`go_gc_duration_seconds{quantile="0.5"} `,
		`go_gc_duration_seconds{quantile="1"} `,
		"go_gc_duration_seconds_sum ",
		"go_gc_duration_seconds_count ",
		"# TYPE process_start_time_seconds gauge",
		"# TYPE process_uptime_seconds gauge",
	}
	switch runtime.GOOS {
	case "linux":
		want = append(want, "# TYPE process_cpu_seconds_total counter", "# TYPE process_resident_memory_bytes gauge",
			"# TYPE process_open_fds gauge", "# TYPE process_max_fds gauge")
	case "darwin", "freebsd":
		want = append(want, "# TYPE process_cpu_seconds_total counter")
	}
	for _, w := range want {
		if !strings.Contains(out, w) {
			t.Errorf("missing %q in:\n%s", w, out)
		}
	}
	// every family is declared once, and every sample line is "name value" with a number
	types := map[string]bool{}
	for _, line := range strings.Split(strings.TrimSpace(out), "\n") {
		if name, ok := strings.CutPrefix(line, "# TYPE "); ok {
			name = strings.Fields(name)[0]
			if types[name] {
				t.Errorf("%s declared twice", name)
			}
			types[name] = true
			continue
		}
		if strings.HasPrefix(line, "#") {
			continue
		}
		f := strings.Fields(line)
		if len(f) != 2 {
			t.Errorf("malformed sample %q", line)
			continue
		}
		if _, err := strconv.ParseFloat(f[1], 64); err != nil {
			t.Errorf("sample %q has no number: %v", line, err)
		}
	}
	if !strings.Contains(out, "process_start_time_seconds 1") { // seconds since the epoch: 1.7e9 and up
		t.Errorf("process_start_time_seconds is not an epoch time:\n%s", out)
	}
}
