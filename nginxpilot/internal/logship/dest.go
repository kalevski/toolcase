package logship

import (
	"time"
)

// Destination types.
const (
	DestLoki   = "loki"
	DestHTTP   = "http"
	DestFile   = "file"
	DestStdout = "stdout"
)

// Shipping defaults (log_ides.md §2.1).
const (
	DefaultBatchSize     = 500
	DefaultFlushInterval = 2 * time.Second
	DefaultMaxRetries    = 3
	DefaultBufferEntries = 8192
	// DefaultBufferBytes byte-caps a destination's ring buffer on top of the
	// entry cap (G7) so pathological line lengths can't eat unbounded memory.
	DefaultBufferBytes = 16 << 20 // 16 MiB
	// DefaultFileMaxSize / DefaultFileMaxFiles bound the self-rotating file sink.
	DefaultFileMaxSize  = 64 << 20 // 64 MiB
	DefaultFileMaxFiles = 3
)

// Auth methods for push destinations.
const (
	AuthNone   = "none"
	AuthBasic  = "basic"
	AuthBearer = "bearer"
)

// SecretFunc resolves a secret at use time. Env-backed secrets resolve once,
// file-backed secrets re-read per flush so rotated token files are picked up
// without a reload (G14) — the caller encodes that policy in the closure.
type SecretFunc func() (string, error)

// Auth carries a destination's resolved credential plumbing.
type Auth struct {
	Method   string
	Username string
	Secret   SecretFunc // password (basic) or token (bearer)
}

// Labels is the Loki label contract (§3.2): a static job, whitelisted dynamic
// sources for host/status_code, and a bounded set of extra static labels.
type Labels struct {
	Job string
	// HostSource is "", "$host", "$server_name" or "$resource" — the entry
	// field the host label is taken from ("" = no host label).
	HostSource string
	// StatusSource is "", "$status" (exact code) or "$status_class" ("4xx").
	StatusSource string
	// Static are extra static labels (instance, env, region…).
	Static map[string]string
}

// Destination is one compiled shipping target. It is logship's own type —
// the config package maps its YAML shape onto it — so the shipper stays
// decoupled from daemon configuration.
type Destination struct {
	Name string
	Type string // loki | http | file | stdout

	// loki / http
	URL    string
	Tenant string // Loki X-Scope-OrgID
	Auth   Auth
	Labels Labels // loki only
	// TLS: a private CA bundle and/or (explicitly opted-in) verify skip (G12).
	CAFile             string
	InsecureSkipVerify bool

	// file
	Path     string
	MaxSize  int64
	MaxFiles int

	// shipping tunables (zero = default)
	BatchSize     int
	FlushInterval time.Duration
	MaxRetries    int
	BufferEntries int
	BufferBytes   int64

	// Filter is the compiled entry filter (nil = everything).
	Filter *Filter
	// Sample keeps roughly this fraction of matched entries (0 or 1 = all).
	Sample float64

	// spec fingerprints the destination for reconfigure diffing (workers whose
	// spec is unchanged keep running and keep their stats). Set it from the
	// canonical serialized config the destination was built from.
	spec string
}

// SetSpec records the fingerprint used by Configure's diffing.
func (d *Destination) SetSpec(s string) { d.spec = s }

func (d *Destination) batchSize() int {
	if d.BatchSize > 0 {
		return d.BatchSize
	}
	return DefaultBatchSize
}

func (d *Destination) flushInterval() time.Duration {
	if d.FlushInterval > 0 {
		return d.FlushInterval
	}
	return DefaultFlushInterval
}

func (d *Destination) maxRetries() int {
	if d.MaxRetries > 0 {
		return d.MaxRetries
	}
	return DefaultMaxRetries
}

func (d *Destination) bufferEntries() int {
	if d.BufferEntries > 0 {
		return d.BufferEntries
	}
	return DefaultBufferEntries
}

func (d *Destination) bufferBytes() int64 {
	if d.BufferBytes > 0 {
		return d.BufferBytes
	}
	return DefaultBufferBytes
}

// SameSpec reports whether two destinations are interchangeable for a running
// worker (used by Configure to keep unchanged workers and their stats). Both
// must carry a fingerprint; destinations without one always count as changed.
func (d *Destination) SameSpec(o *Destination) bool {
	return d.spec != "" && d.spec == o.spec
}
