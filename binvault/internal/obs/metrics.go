// Package obs holds logging and a small Prometheus-text metrics registry
// (spec §9). It has no dependencies beyond the standard library.
package obs

import (
	"fmt"
	"io"
	"math"
	"slices"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Registry collects metrics and writes the Prometheus text exposition.
type Registry struct {
	mu      sync.Mutex
	metrics []metric
	start   time.Time
}

type metric interface {
	write(w io.Writer)
	name() string
}

// NewRegistry returns an empty registry with the Go runtime and process
// metrics registered (runtime.go).
func NewRegistry() *Registry {
	r := &Registry{start: time.Now()}
	r.add(runtimeMetrics{start: r.start})
	return r
}

func (r *Registry) add(m metric) {
	r.mu.Lock()
	r.metrics = append(r.metrics, m)
	r.mu.Unlock()
}

// WriteTo writes every metric.
func (r *Registry) WriteTo(w io.Writer) (int64, error) {
	r.mu.Lock()
	ms := append([]metric(nil), r.metrics...)
	r.mu.Unlock()
	sort.Slice(ms, func(i, j int) bool { return ms[i].name() < ms[j].name() })
	cw := &countWriter{w: w}
	for _, m := range ms {
		m.write(cw)
	}
	return cw.n, cw.err
}

type countWriter struct {
	w   io.Writer
	n   int64
	err error
}

func (c *countWriter) Write(p []byte) (int, error) {
	if c.err != nil {
		return 0, c.err
	}
	n, err := c.w.Write(p)
	c.n += int64(n)
	c.err = err
	return n, err
}

// ---- labels -----------------------------------------------------------------

func labelKey(vals []string) string { return strings.Join(vals, "\x00") }

func escapeLabel(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, "\n", `\n`)
	return strings.ReplaceAll(s, `"`, `\"`)
}

func labelString(names, vals []string, extra ...string) string {
	if len(names) == 0 && len(extra) == 0 {
		return ""
	}
	var b strings.Builder
	b.WriteByte('{')
	for i, n := range names {
		if i > 0 {
			b.WriteByte(',')
		}
		fmt.Fprintf(&b, `%s="%s"`, n, escapeLabel(vals[i]))
	}
	for i := 0; i+1 < len(extra); i += 2 {
		if len(names) > 0 || i > 0 {
			b.WriteByte(',')
		}
		fmt.Fprintf(&b, `%s="%s"`, extra[i], escapeLabel(extra[i+1]))
	}
	b.WriteByte('}')
	return b.String()
}

func fmtFloat(v float64) string {
	switch {
	case math.IsInf(v, 1):
		return "+Inf"
	case math.IsInf(v, -1):
		return "-Inf"
	case math.IsNaN(v):
		return "NaN"
	}
	return strconv.FormatFloat(v, 'g', -1, 64)
}

// ---- counters ---------------------------------------------------------------

// CounterVec is a labelled monotonic counter.
type CounterVec struct {
	nm, help string
	labels   []string
	mu       sync.Mutex
	vals     map[string]*series
}

type series struct {
	labels []string
	v      float64
}

// Counter registers a counter family. A family of the same name and labels that
// is already registered is returned instead, so two components (the data plane
// and the admin API) can count into one family such as
// binvault_auth_failures_total.
func (r *Registry) Counter(name, help string, labels ...string) *CounterVec {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, m := range r.metrics {
		if c, ok := m.(*CounterVec); ok && c.nm == name && slices.Equal(c.labels, labels) {
			return c
		}
	}
	c := &CounterVec{nm: name, help: help, labels: labels, vals: map[string]*series{}}
	r.metrics = append(r.metrics, c)
	return c
}

// Add increases the counter for the label values.
func (c *CounterVec) Add(v float64, labelValues ...string) {
	k := labelKey(labelValues)
	c.mu.Lock()
	s := c.vals[k]
	if s == nil {
		s = &series{labels: append([]string(nil), labelValues...)}
		c.vals[k] = s
	}
	s.v += v
	c.mu.Unlock()
}

// Inc adds one.
func (c *CounterVec) Inc(labelValues ...string) { c.Add(1, labelValues...) }

func (c *CounterVec) name() string { return c.nm }
func (c *CounterVec) write(w io.Writer) {
	c.mu.Lock()
	defer c.mu.Unlock()
	fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s counter\n", c.nm, c.help, c.nm)
	keys := make([]string, 0, len(c.vals))
	for k := range c.vals {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	if len(keys) == 0 && len(c.labels) == 0 {
		fmt.Fprintf(w, "%s 0\n", c.nm)
	}
	for _, k := range keys {
		s := c.vals[k]
		fmt.Fprintf(w, "%s%s %s\n", c.nm, labelString(c.labels, s.labels), fmtFloat(s.v))
	}
}

// ---- gauges -----------------------------------------------------------------

// GaugeFunc is a gauge family computed at scrape time. fn returns one sample per
// label-value tuple.
type GaugeFunc struct {
	nm, help string
	labels   []string
	fn       func() []Sample
}

// Sample is one labelled value.
type Sample struct {
	Labels []string
	Value  float64
}

// GaugeFunc registers a scrape-time gauge.
func (r *Registry) GaugeFunc(name, help string, labels []string, fn func() []Sample) {
	r.add(&GaugeFunc{nm: name, help: help, labels: labels, fn: fn})
}

func (g *GaugeFunc) name() string { return g.nm }
func (g *GaugeFunc) write(w io.Writer) {
	fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s gauge\n", g.nm, g.help, g.nm)
	for _, s := range g.fn() {
		fmt.Fprintf(w, "%s%s %s\n", g.nm, labelString(g.labels, s.Labels), fmtFloat(s.Value))
	}
}

// GaugeVec is a settable labelled gauge.
type GaugeVec struct {
	nm, help string
	labels   []string
	mu       sync.Mutex
	vals     map[string]*series
}

// Gauge registers a settable gauge family.
func (r *Registry) Gauge(name, help string, labels ...string) *GaugeVec {
	g := &GaugeVec{nm: name, help: help, labels: labels, vals: map[string]*series{}}
	r.add(g)
	return g
}

// Set stores a value.
func (g *GaugeVec) Set(v float64, labelValues ...string) {
	k := labelKey(labelValues)
	g.mu.Lock()
	s := g.vals[k]
	if s == nil {
		s = &series{labels: append([]string(nil), labelValues...)}
		g.vals[k] = s
	}
	s.v = v
	g.mu.Unlock()
}

// Add changes a value by delta.
func (g *GaugeVec) Add(delta float64, labelValues ...string) {
	k := labelKey(labelValues)
	g.mu.Lock()
	s := g.vals[k]
	if s == nil {
		s = &series{labels: append([]string(nil), labelValues...)}
		g.vals[k] = s
	}
	s.v += delta
	g.mu.Unlock()
}

// Reset forgets every series (for gauges rebuilt each scrape).
func (g *GaugeVec) Reset() {
	g.mu.Lock()
	g.vals = map[string]*series{}
	g.mu.Unlock()
}

func (g *GaugeVec) name() string { return g.nm }
func (g *GaugeVec) write(w io.Writer) {
	g.mu.Lock()
	defer g.mu.Unlock()
	fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s gauge\n", g.nm, g.help, g.nm)
	keys := make([]string, 0, len(g.vals))
	for k := range g.vals {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		s := g.vals[k]
		fmt.Fprintf(w, "%s%s %s\n", g.nm, labelString(g.labels, s.labels), fmtFloat(s.v))
	}
}

// ---- histograms ---------------------------------------------------------------

// HistogramVec is a labelled histogram.
type HistogramVec struct {
	nm, help string
	labels   []string
	bounds   []float64
	mu       sync.Mutex
	vals     map[string]*hist
}

type hist struct {
	labels  []string
	buckets []uint64
	sum     float64
	count   uint64
}

// DefaultBuckets suit request latencies in seconds.
var DefaultBuckets = []float64{.001, .005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 30, 60}

// Histogram registers a histogram family.
func (r *Registry) Histogram(name, help string, bounds []float64, labels ...string) *HistogramVec {
	if bounds == nil {
		bounds = DefaultBuckets
	}
	h := &HistogramVec{nm: name, help: help, labels: labels, bounds: bounds, vals: map[string]*hist{}}
	r.add(h)
	return h
}

// Observe records one value.
func (h *HistogramVec) Observe(v float64, labelValues ...string) {
	k := labelKey(labelValues)
	h.mu.Lock()
	s := h.vals[k]
	if s == nil {
		s = &hist{labels: append([]string(nil), labelValues...), buckets: make([]uint64, len(h.bounds))}
		h.vals[k] = s
	}
	for i, b := range h.bounds {
		if v <= b {
			s.buckets[i]++
		}
	}
	s.sum += v
	s.count++
	h.mu.Unlock()
}

func (h *HistogramVec) name() string { return h.nm }
func (h *HistogramVec) write(w io.Writer) {
	h.mu.Lock()
	defer h.mu.Unlock()
	fmt.Fprintf(w, "# HELP %s %s\n# TYPE %s histogram\n", h.nm, h.help, h.nm)
	keys := make([]string, 0, len(h.vals))
	for k := range h.vals {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		s := h.vals[k]
		for i, b := range h.bounds {
			fmt.Fprintf(w, "%s_bucket%s %d\n", h.nm, labelString(h.labels, s.labels, "le", fmtFloat(b)), s.buckets[i])
		}
		fmt.Fprintf(w, "%s_bucket%s %d\n", h.nm, labelString(h.labels, s.labels, "le", "+Inf"), s.count)
		fmt.Fprintf(w, "%s_sum%s %s\n", h.nm, labelString(h.labels, s.labels), fmtFloat(s.sum))
		fmt.Fprintf(w, "%s_count%s %d\n", h.nm, labelString(h.labels, s.labels), s.count)
	}
}
