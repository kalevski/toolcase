package logship

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"
)

// httpSendTimeout bounds one delivery attempt (the worker's retry loop owns
// the overall budget).
const httpSendTimeout = 15 * time.Second

// httpClient builds the shared client for a push destination, honouring a
// private CA bundle and the explicit verify-skip opt-in (G12).
func httpClient(d *Destination) (*http.Client, error) {
	tlsCfg := &tls.Config{InsecureSkipVerify: d.InsecureSkipVerify}
	if d.CAFile != "" {
		pem, err := os.ReadFile(d.CAFile)
		if err != nil {
			return nil, fmt.Errorf("ca_file: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			return nil, fmt.Errorf("ca_file %s: no certificates found", d.CAFile)
		}
		tlsCfg.RootCAs = pool
	}
	transport := http.DefaultTransport.(*http.Transport).Clone()
	transport.TLSClientConfig = tlsCfg
	return &http.Client{Transport: transport, Timeout: httpSendTimeout}, nil
}

// applyAuth sets the destination's Authorization header on a request.
func applyAuth(req *http.Request, a Auth) error {
	switch a.Method {
	case "", AuthNone:
		return nil
	case AuthBasic:
		secret, err := a.Secret()
		if err != nil {
			return fmt.Errorf("resolve basic-auth password: %w", err)
		}
		req.SetBasicAuth(a.Username, secret)
	case AuthBearer:
		secret, err := a.Secret()
		if err != nil {
			return fmt.Errorf("resolve bearer token: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+secret)
	default:
		return fmt.Errorf("unknown auth method %q", a.Method)
	}
	return nil
}

// classifyResponse maps an HTTP status to the worker's retry semantics.
func classifyResponse(resp *http.Response, body []byte) error {
	if resp.StatusCode >= 200 && resp.StatusCode < 300 {
		return nil
	}
	msg := strings.TrimSpace(string(body))
	if len(msg) > 200 {
		msg = msg[:200] + "…"
	}
	err := fmt.Errorf("HTTP %d: %s", resp.StatusCode, msg)
	switch {
	case resp.StatusCode == http.StatusTooManyRequests || resp.StatusCode == http.StatusServiceUnavailable:
		return &sendError{err: err, retryAfter: parseRetryAfter(resp.Header.Get("Retry-After"))}
	case resp.StatusCode >= 500:
		return &sendError{err: err}
	default:
		return &sendError{err: err, permanent: true} // 4xx: retrying can't help
	}
}

func parseRetryAfter(v string) time.Duration {
	if v == "" {
		return 0
	}
	if secs, err := strconv.Atoi(v); err == nil && secs >= 0 {
		return time.Duration(secs) * time.Second
	}
	if t, err := http.ParseTime(v); err == nil {
		if d := time.Until(t); d > 0 {
			return d
		}
	}
	return 0
}

// httpSink POSTs batches of newline-delimited JSON to a generic collector
// (Vector, a custom endpoint, a relay). Delivery is at-least-once (G8); the
// X-NP-Batch-ID header lets consumers dedupe replays.
type httpSink struct {
	url    string
	auth   Auth
	client *http.Client
}

func newHTTPSink(d *Destination) (Sink, error) {
	client, err := httpClient(d)
	if err != nil {
		return nil, err
	}
	return &httpSink{url: d.URL, auth: d.Auth, client: client}, nil
}

func (s *httpSink) Send(ctx context.Context, batch []Entry, batchID string) error {
	var body bytes.Buffer
	for _, e := range batch {
		body.Write(e.Raw)
		body.WriteByte('\n')
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.url, &body)
	if err != nil {
		return &sendError{err: err, permanent: true}
	}
	req.Header.Set("Content-Type", "application/x-ndjson")
	req.Header.Set("X-NP-Batch-ID", batchID)
	if err := applyAuth(req, s.auth); err != nil {
		return &sendError{err: err}
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return &sendError{err: err}
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	return classifyResponse(resp, respBody)
}

func (s *httpSink) Close() error { return nil }

// batchID is a random 16-hex-char id for at-least-once dedupe (G8).
func batchID() string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// lokiSink pushes batches to Loki's push API (POST /loki/api/v1/push, JSON
// body). Streams are grouped by resolved label set; values are
// [ns-timestamp, raw line] sorted by timestamp within each stream. Requires
// Loki ≥ 2.4 (out-of-order writes within the ingester window, G9).
type lokiSink struct {
	url    string
	tenant string
	auth   Auth
	labels Labels
	client *http.Client
}

func newLokiSink(d *Destination) (Sink, error) {
	client, err := httpClient(d)
	if err != nil {
		return nil, err
	}
	return &lokiSink{url: d.URL, tenant: d.Tenant, auth: d.Auth, labels: d.Labels, client: client}, nil
}

// lokiPush is the push API body shape.
type lokiPush struct {
	Streams []lokiStream `json:"streams"`
}

type lokiStream struct {
	Stream map[string]string `json:"stream"`
	Values [][2]string       `json:"values"`
}

func (s *lokiSink) Send(ctx context.Context, batch []Entry, _ string) error {
	byLabels := map[string]*lokiStream{}
	var order []string
	for i := range batch {
		e := &batch[i]
		labels := s.resolveLabels(e)
		key := labelKey(labels)
		st := byLabels[key]
		if st == nil {
			st = &lokiStream{Stream: labels}
			byLabels[key] = st
			order = append(order, key)
		}
		st.Values = append(st.Values, [2]string{strconv.FormatInt(e.TS.UnixNano(), 10), string(e.Raw)})
	}
	push := lokiPush{Streams: make([]lokiStream, 0, len(order))}
	for _, key := range order {
		st := byLabels[key]
		// Numeric-aware compare (decimal strings of differing length) so the
		// per-stream sort holds for any timestamp magnitude.
		sort.Slice(st.Values, func(i, j int) bool {
			a, b := st.Values[i][0], st.Values[j][0]
			if len(a) != len(b) {
				return len(a) < len(b)
			}
			return a < b
		})
		push.Streams = append(push.Streams, *st)
	}
	payload, err := json.Marshal(push)
	if err != nil {
		return &sendError{err: err, permanent: true}
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, s.url, bytes.NewReader(payload))
	if err != nil {
		return &sendError{err: err, permanent: true}
	}
	req.Header.Set("Content-Type", "application/json")
	if s.tenant != "" {
		req.Header.Set("X-Scope-OrgID", s.tenant)
	}
	if err := applyAuth(req, s.auth); err != nil {
		return &sendError{err: err}
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return &sendError{err: err}
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(io.LimitReader(resp.Body, 4096))
	return classifyResponse(resp, respBody)
}

func (s *lokiSink) Close() error { return nil }

// resolveLabels builds the label set for one entry: the static job + extras,
// plus the whitelisted dynamic host/status_code sources. A dynamic label whose
// source field is missing is dropped, not emitted empty (G22) — an
// empty-string label value would mint a junk stream.
func (s *lokiSink) resolveLabels(e *Entry) map[string]string {
	labels := make(map[string]string, 3+len(s.labels.Static))
	labels["job"] = s.labels.Job
	for k, v := range s.labels.Static {
		labels[k] = v
	}
	if src := s.labels.HostSource; src != "" {
		if v, ok := e.Field(strings.TrimPrefix(src, "$")); ok && v != "" {
			labels["host"] = v
		}
	}
	switch s.labels.StatusSource {
	case "$status":
		if e.F.Status > 0 {
			labels["status_code"] = strconv.Itoa(e.F.Status)
		}
	case "$status_class":
		if e.F.Status >= 100 && e.F.Status <= 599 {
			labels["status_code"] = strconv.Itoa(e.F.Status/100) + "xx"
		}
	}
	return labels
}

// labelKey builds a deterministic grouping key for a label set.
func labelKey(labels map[string]string) string {
	keys := make([]string, 0, len(labels))
	for k := range labels {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	for _, k := range keys {
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(labels[k])
		b.WriteByte('\xff')
	}
	return b.String()
}
