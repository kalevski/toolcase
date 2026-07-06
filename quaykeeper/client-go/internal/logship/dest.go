package logship

import "time"

// Destination types the client ships to. loki / http push over the network;
// stdout / file are local (useful for debugging a collector config).
const (
	DestLoki   = "loki"
	DestHTTP   = "http"
	DestStdout = "stdout"
	DestFile   = "file"
)

// Shipping defaults (log_ides.md §2.1).
const (
	DefaultBatchSize     = 500
	DefaultFlushInterval = 2 * time.Second
	DefaultMaxRetries    = 3
	DefaultBufferEntries = 8192
	DefaultBufferBytes   = 16 << 20
	DefaultFileMaxSize   = 64 << 20
	DefaultFileMaxFiles  = 3
)

// Auth methods for push destinations.
const (
	AuthNone   = "none"
	AuthBasic  = "basic"
	AuthBearer = "bearer"
)

// SecretFunc resolves a secret at use time. The client builds it to read the
// fetched instance env first, then process env, or a file re-read per flush.
type SecretFunc func() (string, error)

// Auth carries a destination's resolved credential plumbing.
type Auth struct {
	Method   string
	Username string
	Secret   SecretFunc
}

// Labels is the generalized Loki label contract for app logs: fully-resolved
// static labels (with ${VAR} substitution already applied by the caller) plus
// dynamic labels whose value is taken from a log field at ship time. A dynamic
// label whose field is missing/empty is DROPPED, not emitted empty (G22) — an
// empty label value would mint a junk Loki stream.
type Labels struct {
	Static  map[string]string // resolved name → value
	Dynamic map[string]string // label name → field name (e.g. "level")
}

// Destination is one compiled shipping target.
type Destination struct {
	Name string
	Type string

	URL                string
	Tenant             string
	Auth               Auth
	Labels             Labels
	CAFile             string
	InsecureSkipVerify bool

	// file
	Path     string
	MaxSize  int64
	MaxFiles int

	BatchSize     int
	FlushInterval time.Duration
	MaxRetries    int
	BufferEntries int
	BufferBytes   int64

	Filter *Filter
	Sample float64

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
// worker (Configure keeps unchanged workers and their stats). Both must carry a
// fingerprint; destinations without one always count as changed.
func (d *Destination) SameSpec(o *Destination) bool {
	return d.spec != "" && d.spec == o.spec
}
