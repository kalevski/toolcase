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

const httpSendTimeout = 15 * time.Second

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
		return &sendError{err: err, permanent: true}
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

// httpSink POSTs batches of newline-delimited JSON to a generic collector.
// At-least-once (G8); the X-QK-Batch-ID header lets consumers dedupe replays.
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

func (s *httpSink) Send(ctx context.Context, batch []Entry) error {
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
	req.Header.Set("X-QK-Batch-ID", batchID())
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

func batchID() string {
	var b [8]byte
	_, _ = rand.Read(b[:])
	return hex.EncodeToString(b[:])
}

// lokiSink pushes batches to Loki's push API. Streams grouped by resolved label
// set; values are [ns-timestamp, raw line] sorted by timestamp. Requires Loki ≥ 2.4.
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

type lokiPush struct {
	Streams []lokiStream `json:"streams"`
}

type lokiStream struct {
	Stream map[string]string `json:"stream"`
	Values [][2]string       `json:"values"`
}

func (s *lokiSink) Send(ctx context.Context, batch []Entry) error {
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

// resolveLabels builds the label set for one entry: resolved static labels plus
// dynamic labels taken from a field. A dynamic label whose field is missing/empty
// is dropped, not emitted empty (G22).
func (s *lokiSink) resolveLabels(e *Entry) map[string]string {
	labels := make(map[string]string, len(s.labels.Static)+len(s.labels.Dynamic))
	for k, v := range s.labels.Static {
		labels[k] = v
	}
	for label, field := range s.labels.Dynamic {
		if v, ok := e.Field(field); ok && v != "" {
			labels[label] = v
		}
	}
	return labels
}

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
