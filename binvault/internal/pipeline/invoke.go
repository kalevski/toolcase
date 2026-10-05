package pipeline

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/sha256"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strconv"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/kalevski/toolcase/binvault/internal/config"
)

// Response limits (spec §7.13, §7.7).
const (
	maxResponseBody = 64 << 10
	maxLoggedBody   = 4 << 10
	maxMessageChars = 512
)

// Outcome classifies a call's result by its HTTP status (spec §7.7).
type Outcome int

const (
	// OutcomeOK: 200, 201 or 204.
	OutcomeOK Outcome = iota
	// OutcomeRejected: 422. A before write fails with PipelineRejected; an after
	// run fails permanently.
	OutcomeRejected
	// OutcomeTransient: 408, 425, 429, 5xx, a timeout or a connection error.
	OutcomeTransient
	// OutcomeFailed: any other status (202 and every other 2xx, 3xx, other 4xx),
	// or an address the outbound safety rules refuse. Never retried.
	OutcomeFailed
	// OutcomeCanceled: the caller's context ended (client gone, shutdown).
	OutcomeCanceled
)

func (o Outcome) String() string {
	return [...]string{"ok", "rejected", "transient", "failed", "canceled"}[o]
}

// Classify maps an HTTP status to an outcome (spec §7.7).
func Classify(status int) Outcome {
	switch status {
	case http.StatusOK, http.StatusCreated, http.StatusNoContent:
		return OutcomeOK
	case http.StatusUnprocessableEntity:
		return OutcomeRejected
	case http.StatusRequestTimeout, http.StatusTooEarly, http.StatusTooManyRequests:
		return OutcomeTransient
	}
	if status >= 500 && status <= 599 {
		return OutcomeTransient
	}
	return OutcomeFailed
}

// Call is one invocation attempt.
type Call struct {
	URL     string
	Headers map[string]string // static service.headers
	Secret  string            // signing secret, "" = unsigned
	Body    []byte
	// X-Binvault-* identification.
	Run      string
	Attempt  int
	Pipeline string
	Stage    string
	Event    string
	// Timeout bounds this attempt.
	Timeout time.Duration
}

// CallResult is what an attempt came to.
type CallResult struct {
	Outcome Outcome
	// Status is the HTTP status, 0 when there was no response.
	Status int
	// Message is the service's {"message": "…"}, at most 512 characters.
	Message string
	// Err describes a failure for run records and logs.
	Err string
	// TimedOut marks a failure caused by the attempt's timeout.
	TimedOut bool
	// RetryAfter is the service's Retry-After, capped at one hour.
	RetryAfter time.Duration
	Latency    time.Duration
}

// Invoker makes the HTTP calls to services (spec §7.6, §7.13): http and https
// only, TLS verified, redirects never followed, the connection made to the
// address that was checked.
type Invoker struct {
	client  *http.Client
	version string
	log     *slog.Logger
	now     func() time.Time
}

// NewInvoker builds the outbound client from the configuration. The
// configuration is read at call time for BINVAULT_PIPELINE_ALLOW_PRIVATE.
func NewInvoker(cfg *config.Config, version string, log *slog.Logger) (*Invoker, error) {
	if log == nil {
		log = slog.Default()
	}
	var roots *x509.CertPool
	if cfg.PipelineCAFile != "" {
		pem, err := os.ReadFile(cfg.PipelineCAFile)
		if err != nil {
			return nil, fmt.Errorf("BINVAULT_PIPELINE_CA_FILE: %w", err)
		}
		roots, err = x509.SystemCertPool()
		if err != nil || roots == nil {
			roots = x509.NewCertPool()
		}
		if !roots.AppendCertsFromPEM(pem) {
			return nil, errors.New("BINVAULT_PIPELINE_CA_FILE: no certificate found in the file")
		}
	}
	tr := &http.Transport{
		// never an environment proxy: the address checked is the address dialed
		Proxy:                 nil,
		DialContext:           newDialer(func() bool { return cfg.PipelineAllowPrivate }).DialContext,
		TLSClientConfig:       &tls.Config{MinVersion: tls.VersionTLS12, RootCAs: roots},
		ForceAttemptHTTP2:     true, // https services may speak HTTP/2; plain http stays HTTP/1.1
		TLSHandshakeTimeout:   10 * time.Second,
		MaxIdleConns:          256,
		MaxIdleConnsPerHost:   16,
		IdleConnTimeout:       90 * time.Second,
		ResponseHeaderTimeout: 0, // the attempt's timeout bounds it
		DisableCompression:    true,
	}
	return &Invoker{
		client: &http.Client{
			Transport:     tr,
			CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse },
		},
		version: version, log: log, now: time.Now,
	}, nil
}

// Sign is the X-Binvault-Signature value: "v1=" + hex HMAC-SHA256, keyed with
// the signing secret, of "<timestamp>.<raw request body>" (spec §7.6).
func Sign(secret, timestamp string, body []byte) string {
	m := hmac.New(sha256.New, []byte(secret))
	m.Write([]byte(timestamp))
	m.Write([]byte{'.'})
	m.Write(body)
	return "v1=" + hex.EncodeToString(m.Sum(nil))
}

// Do makes the call. ctx is the caller's: when it ends the call is abandoned
// and the result is OutcomeCanceled; the call's own timeout is Call.Timeout.
func (iv *Invoker) Do(ctx context.Context, c Call) CallResult {
	start := iv.now()
	res := iv.do(ctx, c)
	res.Latency = iv.now().Sub(start)
	return res
}

func (iv *Invoker) do(ctx context.Context, c Call) CallResult {
	cctx, cancel := context.WithTimeout(ctx, c.Timeout)
	defer cancel()
	req, err := http.NewRequestWithContext(cctx, http.MethodPost, c.URL, bytes.NewReader(c.Body))
	if err != nil {
		return CallResult{Outcome: OutcomeFailed, Err: "invalid service URL: " + err.Error()}
	}
	for k, v := range c.Headers {
		req.Header.Set(k, v)
	}
	if req.Header.Get("User-Agent") == "" {
		req.Header.Set("User-Agent", "binvault/"+iv.version)
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("X-Binvault-Run", c.Run)
	req.Header.Set("X-Binvault-Attempt", strconv.Itoa(c.Attempt))
	req.Header.Set("X-Binvault-Pipeline", c.Pipeline)
	req.Header.Set("X-Binvault-Stage", c.Stage)
	req.Header.Set("X-Binvault-Event", c.Event)
	ts := strconv.FormatInt(iv.now().Unix(), 10)
	req.Header.Set("X-Binvault-Timestamp", ts)
	if c.Secret != "" {
		req.Header.Set("X-Binvault-Signature", Sign(c.Secret, ts, c.Body))
	}

	resp, err := iv.client.Do(req)
	if err != nil {
		return iv.transportFailure(ctx, cctx, err)
	}
	defer resp.Body.Close()
	body, rerr := io.ReadAll(io.LimitReader(resp.Body, maxResponseBody))
	if rerr == nil {
		_, _ = io.CopyN(io.Discard, resp.Body, 1<<20) // let the connection be reused; bounded
	}
	res := CallResult{Status: resp.StatusCode, Outcome: Classify(resp.StatusCode)}
	if ra, ok := ParseRetryAfter(resp.Header.Get("Retry-After"), iv.now()); ok {
		res.RetryAfter = ra
	}
	res.Message = parseMessage(resp.Header.Get("Content-Type"), body)
	if rerr != nil && res.Outcome == OutcomeOK {
		// the answer was cut short: the status alone is not trustworthy
		if ctx.Err() != nil {
			return CallResult{Outcome: OutcomeCanceled, Err: "canceled"}
		}
		res.Outcome, res.Err = OutcomeTransient, "the response could not be read: "+rerr.Error()
		res.TimedOut = errors.Is(cctx.Err(), context.DeadlineExceeded)
		return res
	}
	if res.Outcome != OutcomeOK {
		res.Err = fmt.Sprintf("the service answered %d", resp.StatusCode)
		if res.Outcome == OutcomeFailed && resp.StatusCode/100 == 2 {
			res.Err += " (only 200, 201 and 204 mean done)"
		}
		level := slog.LevelWarn
		if res.Outcome == OutcomeRejected {
			level = slog.LevelInfo // a rejection is the service doing its job
		}
		iv.log.Log(ctx, level, "pipeline service answered", "pipeline", c.Pipeline, "run", c.Run, "attempt", c.Attempt,
			"status", resp.StatusCode, "body", loggedBody(body))
	}
	return res
}

func (iv *Invoker) transportFailure(parent, attempt context.Context, err error) CallResult {
	if parent.Err() != nil {
		return CallResult{Outcome: OutcomeCanceled, Err: "canceled"}
	}
	if b, ok := isBlocked(err); ok {
		return CallResult{Outcome: OutcomeFailed, Err: b.msg}
	}
	var ne net.Error
	timedOut := errors.Is(attempt.Err(), context.DeadlineExceeded) || (errors.As(err, &ne) && ne.Timeout())
	if timedOut {
		return CallResult{Outcome: OutcomeTransient, TimedOut: true, Err: "the service did not answer in time"}
	}
	msg := err.Error()
	var ue interface{ Unwrap() error }
	if errors.As(err, &ue) {
		if inner := ue.Unwrap(); inner != nil {
			msg = inner.Error()
		}
	}
	return CallResult{Outcome: OutcomeTransient, Err: "could not reach the service: " + msg}
}

// parseMessage reads the optional {"message": "…"} body (spec §7.7), at most
// 512 characters; any other body is ignored.
func parseMessage(contentType string, body []byte) string {
	if !strings.HasPrefix(strings.ToLower(strings.TrimSpace(contentType)), "application/json") || len(body) == 0 {
		return ""
	}
	var doc struct {
		Message any `json:"message"`
	}
	if json.Unmarshal(body, &doc) != nil {
		return ""
	}
	msg, ok := doc.Message.(string)
	if !ok {
		return ""
	}
	return truncateRunes(sanitizeText(msg), maxMessageChars)
}

func sanitizeText(s string) string {
	return strings.Map(func(r rune) rune {
		if r < 0x20 && r != '\t' && r != '\n' || r == 0x7f {
			return ' '
		}
		return r
	}, strings.ToValidUTF8(s, "?"))
}

func truncateRunes(s string, n int) string {
	if utf8.RuneCountInString(s) <= n {
		return s
	}
	r := []rune(s)
	return string(r[:n])
}

func loggedBody(b []byte) string {
	if len(b) > maxLoggedBody {
		b = b[:maxLoggedBody]
	}
	return sanitizeText(string(b))
}
