// Package config builds binvault's configuration from the process environment
// (spec §2.3, whose variable table is the contract). binvault v1 has no
// configuration file: every setting is a BINVAULT_* variable, every variable
// has a default except the admin token and the master key (and, in a cluster,
// the cluster key and node name), and the four secret variables also accept a
// _FILE form naming a mounted secret file.
//
// LoadFromEnviron(os.Environ()) is the entry point for `binvault run` and
// `binvault validate` (§2.1). It checks every value and the rules that span
// several variables — TLS files come in pairs, an admin listener off loopback
// needs TLS or an explicit opt-out (§2.3, §10), cluster trust (§8.3) — and
// reports every problem at once, each prefixed with the variable's name.
// Non-fatal findings come back as warnings for the boot log: unknown
// BINVAULT_* variables with a "did you mean" hint, cluster settings on a
// single node, a plain-HTTP peer link. There are no deprecated variables in
// v1.
//
// Secrets never leave this package readable: errors, warnings, Applied and
// String never contain them, and they are left out of JSON. Defaults and
// ForTest give other packages ready-made configurations for their tests.
//
// Related spec sections: §2.2 (container defaults), §3.8 (limits), §4.2 (the
// admin token and its rotation), §4.7 (the master key and its rotation), §4.8
// (trusted proxies), §7.9 and §7.13 (pipeline budget and outbound safety), §8.3
// (cluster membership and trust).
package config

import (
	"crypto/rand"
	"encoding/hex"
	"fmt"
	"log/slog"
	"net"
	"net/netip"
	"os"
	"reflect"
	"slices"
	"strings"
	"time"
)

// Config is binvault's configuration: one typed field per variable of the
// spec §2.3 table, holding the variable's value or its default. Durations are
// time.Duration (Go syntax, no d or w units), sizes keep the table's MiB unit
// (see MaxObjectBytes and MinFreeBytes), and secrets are kept decoded.
//
// Build one with LoadFromEnviron or Load; Defaults and ForTest serve tests.
type Config struct {
	// Secrets (§4.2, §4.7). Applied and String redact them; JSON omits them.

	// AdminToken is BINVAULT_ADMIN_TOKEN (required): every admin bearer token
	// accepted, each at least 32 characters, no two alike. Several are listed
	// while the token is being rotated (§4.2).
	AdminToken []string `json:"-"`
	// MasterKey is BINVAULT_MASTER_KEY (required), decoded from base64: the
	// 32-byte key that seals secrets at rest (§4.7).
	MasterKey []byte `json:"-"`
	// MasterKeyOld is BINVAULT_MASTER_KEY_OLD (default none), decoded:
	// decrypt-only 32-byte keys kept during a key rotation, in the order
	// given. None of them equals MasterKey or another.
	MasterKeyOld [][]byte `json:"-"`

	// Listeners and TLS (§2.3, §2.4, §10).

	// Listen is BINVAULT_LISTEN (default ":9000"): bind address of the public
	// (S3) listener.
	Listen string
	// AdminListen is BINVAULT_ADMIN_LISTEN (default "127.0.0.1:9001"): bind
	// address of the admin listener, which serves /_admin/v1/** and /_metrics
	// only. Off loopback it has TLS or AdminInsecureHTTP.
	AdminListen string
	// AdminTLSCertFile is BINVAULT_ADMIN_TLS_CERT_FILE (default none): the
	// admin listener's certificate, set together with AdminTLSKeyFile.
	AdminTLSCertFile string
	// AdminTLSKeyFile is BINVAULT_ADMIN_TLS_KEY_FILE (default none): the
	// admin listener's private key, set together with AdminTLSCertFile.
	AdminTLSKeyFile string
	// AdminInsecureHTTP is BINVAULT_ADMIN_INSECURE_HTTP (default false):
	// allow a non-loopback admin listener without TLS. The image sets it
	// (§2.2).
	AdminInsecureHTTP bool
	// TLSCertFile is BINVAULT_TLS_CERT_FILE (default none): built-in TLS
	// (and HTTP/2) for the public listener, set together with TLSKeyFile.
	TLSCertFile string
	// TLSKeyFile is BINVAULT_TLS_KEY_FILE (default none), set together with
	// TLSCertFile.
	TLSKeyFile string

	// Addressing (§2.4, §4.5, §4.8).

	// EndpointURL is BINVAULT_ENDPOINT_URL (default "http://<hostname>:<port>"
	// with the port of Listen, https when the public listener serves TLS
	// itself): the URL at which pipeline services reach this node, normalised
	// to scheme://host[:port] with a lower-case host and no trailing slash.
	EndpointURL string
	// Domain is BINVAULT_DOMAIN (default none), lower-cased: enables
	// virtual-hosted-style requests for <bucket>.<domain>.
	Domain string
	// Region is BINVAULT_REGION (default "us-east-1"): the region reported
	// and handed to pipeline services. Any region is accepted in signatures.
	Region string
	// TrustedProxies is BINVAULT_TRUSTED_PROXIES (default none): networks
	// whose X-Forwarded-For is trusted on the public listener (§4.8). A bare
	// address is a /32 or /128; prefixes are masked, IPv4-mapped ones unmapped.
	TrustedProxies []netip.Prefix

	// Storage (§3).

	// DataDir is BINVAULT_DATA_DIR (default "/var/lib/binvault"), an absolute,
	// cleaned path: the root of all persistent state.
	DataDir string
	// Fsync is BINVAULT_FSYNC (default true): fsync blobs and directories
	// before acknowledging a write.
	Fsync bool
	// MinFreeMB is BINVAULT_MIN_FREE_MB (default 512, at least 0), in MiB:
	// writes fail with StorageFull below this much free space.
	MinFreeMB int64
	// MaxObjectMB is BINVAULT_MAX_OBJECT_MB (default 5120, 1 to 5242880, the
	// 5 TiB ceiling), in MiB: the largest object, single PUT or multipart.
	MaxObjectMB int64
	// GCGrace is BINVAULT_GC_GRACE (default 1h, positive): how long an
	// unreferenced blob is kept before it is unlinked.
	GCGrace time.Duration
	// MultipartTTL is BINVAULT_MULTIPART_TTL (default 168h, at least 1m):
	// idle multipart uploads older than this are aborted.
	MultipartTTL time.Duration

	// Requests (§4.5, §4.8, §9.4).

	// ClockSkew is BINVAULT_CLOCK_SKEW (default 15m, positive): the SigV4
	// timestamp tolerance.
	ClockSkew time.Duration
	// HeaderTimeout is BINVAULT_HEADER_TIMEOUT (default 10s, positive): the
	// time allowed to receive request headers.
	HeaderTimeout time.Duration
	// BodyIdleTimeout is BINVAULT_BODY_IDLE_TIMEOUT (default 60s, positive): a
	// transfer that moves no bytes for this long is aborted.
	BodyIdleTimeout time.Duration
	// ShutdownTimeout is BINVAULT_SHUTDOWN_TIMEOUT (default 60s, positive):
	// the grace period on SIGTERM.
	ShutdownTimeout time.Duration
	// AuthFailLimit is BINVAULT_AUTH_FAIL_LIMIT (default 30, at least 1):
	// failed authentications per minute per client address before throttling.
	AuthFailLimit int

	// Background jobs (§3.9, §3.12).

	// ScrubInterval is BINVAULT_SCRUB_INTERVAL (default 0, at least 0): the
	// interval of the integrity scrubber; 0 turns it off.
	ScrubInterval time.Duration
	// LifecycleInterval is BINVAULT_LIFECYCLE_INTERVAL (default 1h, positive):
	// how often lifecycle rules are evaluated.
	LifecycleInterval time.Duration
	// LifecycleBatch is BINVAULT_LIFECYCLE_BATCH (default 1000, at least 1):
	// lifecycle actions applied per transaction.
	LifecycleBatch int

	// Pipelines (§7).

	// PipelineWorkers is BINVAULT_PIPELINE_WORKERS (default 8, at least 1): the
	// concurrency of after runs on this node.
	PipelineWorkers int
	// PipelineBeforeTotalTimeout is BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT
	// (default 25s, 1s to 10m): the budget of a write's whole before chain
	// (§7.9). It must be the same on every node of a cluster.
	PipelineBeforeTotalTimeout time.Duration
	// PipelineMaxDepth is BINVAULT_PIPELINE_MAX_DEPTH (default 4, at least 1):
	// the deepest causal depth of after runs (§7.11).
	PipelineMaxDepth int
	// PipelineAllowPrivate is BINVAULT_PIPELINE_ALLOW_PRIVATE (default true):
	// allow pipeline URLs resolving to private or loopback addresses (§7.13).
	PipelineAllowPrivate bool
	// PipelineCAFile is BINVAULT_PIPELINE_CA_FILE (default none): an extra CA
	// bundle for pipeline HTTPS calls. Its existence is checked at start-up.
	PipelineCAFile string
	// PipelineRunRetention is BINVAULT_PIPELINE_RUN_RETENTION (default 336h,
	// positive): how long finished runs are kept.
	PipelineRunRetention time.Duration

	// Observability (§9).

	// MetricsPerBucket is BINVAULT_METRICS_PER_BUCKET (default true):
	// per-bucket metric labels.
	MetricsPerBucket bool
	// LogFormat is BINVAULT_LOG_FORMAT (default "logfmt"): "logfmt" or "json".
	LogFormat string
	// LogLevel is BINVAULT_LOG_LEVEL (default "info"): "debug", "info",
	// "warn" or "error". See SlogLevel.
	LogLevel string

	// Cluster (§8). These are read only when BINVAULT_CLUSTER_URLS is set;
	// on a single node they keep their defaults (see ClusterEnabled).

	// NodeName is BINVAULT_NODE_NAME (required in a cluster): this node's
	// unique name, matching ^[a-z0-9][a-z0-9_-]{0,62}$.
	NodeName string
	// ClusterURLs is BINVAULT_CLUSTER_URLS (default none): the peer-listener
	// URL of every node, this one included, normalised like EndpointURL. https
	// unless ClusterInsecureHTTP. Set means cluster mode.
	ClusterURLs []string
	// ClusterKey is BINVAULT_CLUSTER_KEY (required in a cluster): the shared
	// keys that authenticate peers, at least 32 bytes each. A node sends the
	// first and accepts all of them (rotation, §8.3).
	ClusterKey [][]byte `json:"-"`
	// ClusterListen is BINVAULT_CLUSTER_LISTEN (default ":9100"): the peer
	// listener. Off loopback it has TLS or ClusterInsecureHTTP.
	ClusterListen string
	// ClusterTLSCertFile is BINVAULT_CLUSTER_TLS_CERT_FILE (default none): the
	// peer listener's certificate, set together with ClusterTLSKeyFile.
	ClusterTLSCertFile string
	// ClusterTLSKeyFile is BINVAULT_CLUSTER_TLS_KEY_FILE (default none), set
	// together with ClusterTLSCertFile.
	ClusterTLSKeyFile string
	// ClusterCAFile is BINVAULT_CLUSTER_CA_FILE (default none): an extra CA
	// bundle or pinned certificate for peer HTTPS, checked at start-up.
	ClusterCAFile string
	// ClusterInsecureHTTP is BINVAULT_CLUSTER_INSECURE_HTTP (default false):
	// allow plain-HTTP peer URLs and listener. Load then warns that the peer
	// link travels readable.
	ClusterInsecureHTTP bool
	// ClusterPullInterval is BINVAULT_CLUSTER_PULL_INTERVAL (default 5s,
	// positive): the fallback poll of catalog replication (§8.5).
	ClusterPullInterval time.Duration
	// ClusterMaxClockSkew is BINVAULT_CLUSTER_MAX_CLOCK_SKEW (default 2m,
	// positive): catalog ops stamped further ahead are held and alarmed.
	ClusterMaxClockSkew time.Duration
	// ClusterStartupFence is BINVAULT_CLUSTER_STARTUP_FENCE (default 30s,
	// positive): how long a starting node waits for all its peers.
	ClusterStartupFence time.Duration
	// ClusterRetention is BINVAULT_CLUSTER_RETENTION (default 720h, positive):
	// how long catalog op history is kept.
	ClusterRetention time.Duration
	// ClusterForwardConnectTimeout is BINVAULT_CLUSTER_FORWARD_CONNECT_TIMEOUT
	// (default 3s, positive): the dial timeout when forwarding to a home node.
	ClusterForwardConnectTimeout time.Duration
	// MoveStreams is BINVAULT_MOVE_STREAMS (default 4, at least 1): parallel
	// blob streams during a bucket move (§8.8).
	MoveStreams int
	// MoveFreezeTimeout is BINVAULT_MOVE_FREEZE_TIMEOUT (default 60s,
	// positive): the longest a move's write freeze may last.
	MoveFreezeTimeout time.Duration

	// applied is what Applied returns, fixed by Load.
	applied []string
}

// Defaults for the variables whose default the other code needs to know.
const (
	defaultListen = ":9000"
	// defaultEndpointScheme is the scheme of the default BINVAULT_ENDPOINT_URL
	// unless the public listener serves TLS itself.
	defaultEndpointScheme = "http"
)

// defaults is every §2.3 default except BINVAULT_ENDPOINT_URL, which depends
// on the host name and BINVAULT_LISTEN.
func defaults() *Config {
	return &Config{
		Listen:                       defaultListen,
		AdminListen:                  "127.0.0.1:9001",
		Region:                       "us-east-1",
		DataDir:                      "/var/lib/binvault",
		Fsync:                        true,
		MinFreeMB:                    512,
		MaxObjectMB:                  5120,
		GCGrace:                      time.Hour,
		MultipartTTL:                 168 * time.Hour,
		ClockSkew:                    15 * time.Minute,
		HeaderTimeout:                10 * time.Second,
		BodyIdleTimeout:              60 * time.Second,
		ShutdownTimeout:              60 * time.Second,
		AuthFailLimit:                30,
		ScrubInterval:                0,
		LifecycleInterval:            time.Hour,
		LifecycleBatch:               1000,
		PipelineWorkers:              8,
		PipelineBeforeTotalTimeout:   25 * time.Second,
		PipelineMaxDepth:             4,
		PipelineAllowPrivate:         true,
		PipelineRunRetention:         336 * time.Hour,
		MetricsPerBucket:             true,
		LogFormat:                    "logfmt",
		LogLevel:                     "info",
		ClusterListen:                ":9100",
		ClusterPullInterval:          5 * time.Second,
		ClusterMaxClockSkew:          2 * time.Minute,
		ClusterStartupFence:          30 * time.Second,
		ClusterRetention:             720 * time.Hour,
		ClusterForwardConnectTimeout: 3 * time.Second,
		MoveStreams:                  4,
		MoveFreezeTimeout:            60 * time.Second,
	}
}

// endpointURL is the default BINVAULT_ENDPOINT_URL for a host name and port.
func endpointURL(scheme, hostname, port string) string {
	return scheme + "://" + net.JoinHostPort(strings.ToLower(hostname), port)
}

// Defaults returns what Load yields when only the required secrets are set,
// minus those secrets: every field at its §2.3 default, EndpointURL derived
// from os.Hostname ("localhost" if unknown) and port 9000. Without secrets it
// is not a usable configuration; ForTest adds them.
func Defaults() *Config {
	c := defaults()
	host, err := os.Hostname()
	if err != nil || host == "" {
		host = "localhost"
	}
	_, port, _ := net.SplitHostPort(defaultListen)
	c.EndpointURL = endpointURL(defaultEndpointScheme, host, port)
	return c
}

// ForTest returns Defaults with a fresh random admin token and master key,
// with mod (if not nil) then applied: a valid configuration for other
// packages' tests. What mod changes is not validated; tests typically point
// DataDir at t.TempDir() and the listeners at 127.0.0.1:0.
func ForTest(mod func(*Config)) *Config {
	c := Defaults()
	token := make([]byte, 24)
	_, _ = rand.Read(token) // crypto/rand.Read never fails (Go 1.24+)
	c.AdminToken = []string{hex.EncodeToString(token)}
	c.MasterKey = make([]byte, masterKeyLen)
	_, _ = rand.Read(c.MasterKey)
	if mod != nil {
		mod(c)
	}
	return c
}

// Applied returns "NAME=value" for every variable that was explicitly set and
// applied, in §2.3 table order, for the boot log. Secret values read "***"
// and a _FILE form shows its path. Cluster variables ignored on a single node
// are not listed (Load warns about them instead), and a configuration from
// Defaults or ForTest lists nothing.
func (c *Config) Applied() []string { return slices.Clone(c.applied) }

// ClusterEnabled reports whether BINVAULT_CLUSTER_URLS is set: the node runs
// in cluster mode and starts its peer listener (§8).
func (c *Config) ClusterEnabled() bool { return len(c.ClusterURLs) > 0 }

// MaxObjectBytes is MaxObjectMB in bytes.
func (c *Config) MaxObjectBytes() int64 { return c.MaxObjectMB << 20 }

// MinFreeBytes is MinFreeMB in bytes.
func (c *Config) MinFreeBytes() int64 { return c.MinFreeMB << 20 }

// AdminListenIsLoopback reports whether AdminListen binds loopback only: an
// address in 127.0.0.0/8, ::1, or the host name localhost.
func (c *Config) AdminListenIsLoopback() bool { return isLoopbackListen(c.AdminListen) }

// ClusterListenIsLoopback reports whether ClusterListen binds loopback only,
// as AdminListenIsLoopback does for the admin listener.
func (c *Config) ClusterListenIsLoopback() bool { return isLoopbackListen(c.ClusterListen) }

// TLSEnabled reports whether the public listener serves TLS itself.
func (c *Config) TLSEnabled() bool { return c.TLSCertFile != "" && c.TLSKeyFile != "" }

// AdminTLSEnabled reports whether the admin listener serves TLS.
func (c *Config) AdminTLSEnabled() bool { return c.AdminTLSCertFile != "" && c.AdminTLSKeyFile != "" }

// ClusterTLSEnabled reports whether the peer listener serves TLS itself.
func (c *Config) ClusterTLSEnabled() bool {
	return c.ClusterTLSCertFile != "" && c.ClusterTLSKeyFile != ""
}

// IsTrustedProxy reports whether a socket peer address lies in
// TrustedProxies (§4.8). IPv4-mapped IPv6 addresses match IPv4 networks, and
// an IPv6 zone is ignored.
func (c *Config) IsTrustedProxy(addr netip.Addr) bool {
	addr = addr.Unmap().WithZone("")
	for _, p := range c.TrustedProxies {
		if p.Contains(addr) {
			return true
		}
	}
	return false
}

// SlogLevel is LogLevel as a slog.Level (info for anything unrecognised).
func (c *Config) SlogLevel() slog.Level {
	switch c.LogLevel {
	case "debug":
		return slog.LevelDebug
	case "warn":
		return slog.LevelWarn
	case "error":
		return slog.LevelError
	}
	return slog.LevelInfo
}

// secretFields are the Config fields that String redacts.
var secretFields = map[string]bool{"AdminToken": true, "MasterKey": true, "MasterKeyOld": true, "ClusterKey": true}

// String renders every exported field for debugging, secrets as *** (or as
// nothing when unset). It has a value receiver so that Config and *Config
// both print safely with %v, %+v and %s; GoString covers %#v.
func (c Config) String() string {
	v := reflect.ValueOf(c)
	t := v.Type()
	var b strings.Builder
	b.WriteString("config.Config{")
	sep := ""
	for i := range t.NumField() {
		f := t.Field(i)
		if !f.IsExported() {
			continue
		}
		b.WriteString(sep + f.Name + ":")
		sep = " "
		fv := v.Field(i)
		if secretFields[f.Name] {
			if fv.Len() > 0 {
				b.WriteString(redacted)
			}
			continue
		}
		switch x := fv.Interface().(type) {
		case string, []string:
			fmt.Fprintf(&b, "%q", x)
		default:
			fmt.Fprintf(&b, "%v", x)
		}
	}
	b.WriteByte('}')
	return b.String()
}

// GoString is String, so that %#v redacts secrets too.
func (c Config) GoString() string { return c.String() }
