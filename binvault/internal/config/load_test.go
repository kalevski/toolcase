package config

import (
	"encoding/base64"
	"encoding/hex"
	"errors"
	"os"
	"path/filepath"
	"slices"
	"strings"
	"testing"
	"time"
)

func TestRejectsInvalidValues(t *testing.T) {
	b64 := base64.StdEncoding.EncodeToString
	cases := []struct {
		name   string
		env    env
		v      string // variable the problem is reported for
		substr string // part of the message
	}{
		// Secrets (§4.2, §4.7).
		{"admin token missing", minimalEnv("BINVAULT_ADMIN_TOKEN", unset), "BINVAULT_ADMIN_TOKEN", "is required"},
		{"admin token blank", minimalEnv("BINVAULT_ADMIN_TOKEN", "  "), "BINVAULT_ADMIN_TOKEN", "is set but empty"},
		{"admin token short", minimalEnv("BINVAULT_ADMIN_TOKEN", "short-SECRET"), "BINVAULT_ADMIN_TOKEN", "is 12 characters long; at least 32 are required"},
		{"admin token counts characters", minimalEnv("BINVAULT_ADMIN_TOKEN", strings.Repeat("é", 31)), "BINVAULT_ADMIN_TOKEN", "is 31 characters long"},
		{"second admin token short", minimalEnv("BINVAULT_ADMIN_TOKEN", testToken+",short-SECRET"), "BINVAULT_ADMIN_TOKEN", "token 2 is 12 characters long"},
		{"admin tokens duplicated", minimalEnv("BINVAULT_ADMIN_TOKEN", testToken+", "+testToken), "BINVAULT_ADMIN_TOKEN", "tokens 1 and 2 are identical"},
		{"admin token list stray comma", minimalEnv("BINVAULT_ADMIN_TOKEN", testToken+",,"+testToken2), "BINVAULT_ADMIN_TOKEN", "token 2 is empty"},
		{"admin tokens on separate lines", minimalEnv("BINVAULT_ADMIN_TOKEN", testToken+"\n"+testToken2), "BINVAULT_ADMIN_TOKEN", "control character"},
		{"master key missing", minimalEnv("BINVAULT_MASTER_KEY", unset), "BINVAULT_MASTER_KEY", "is required"},
		{"master key not base64", minimalEnv("BINVAULT_MASTER_KEY", "not-base64-SECRET!!"), "BINVAULT_MASTER_KEY", "is not valid base64"},
		{"master key too short", minimalEnv("BINVAULT_MASTER_KEY", b64(testKey[:16])), "BINVAULT_MASTER_KEY", "decodes to 16 bytes"},
		{"master key in hex", minimalEnv("BINVAULT_MASTER_KEY", hex.EncodeToString(testKey)), "BINVAULT_MASTER_KEY", "looks like hex"},
		{"old key invalid", minimalEnv("BINVAULT_MASTER_KEY_OLD", b64(testKey2)+",SECRET!!"), "BINVAULT_MASTER_KEY_OLD", "key 2 is not valid base64"},
		{"old key is the current key", minimalEnv("BINVAULT_MASTER_KEY_OLD", b64(testKey)), "BINVAULT_MASTER_KEY_OLD", "is the current BINVAULT_MASTER_KEY"},
		{"old keys duplicated", minimalEnv("BINVAULT_MASTER_KEY_OLD", b64(testKey2)+","+base64.RawURLEncoding.EncodeToString(testKey2)), "BINVAULT_MASTER_KEY_OLD", "keys 1 and 2 are the same key"},
		{"old key blank", minimalEnv("BINVAULT_MASTER_KEY_OLD", ""), "BINVAULT_MASTER_KEY_OLD", "is set but empty"},
		{"both secret forms", minimalEnv("BINVAULT_ADMIN_TOKEN_FILE", "/run/secrets/admin"), "BINVAULT_ADMIN_TOKEN", "is set together with BINVAULT_ADMIN_TOKEN_FILE"},

		// Listeners and TLS.
		{"listen without colon", minimalEnv("BINVAULT_LISTEN", "9000"), "BINVAULT_LISTEN", "is not a host:port address"},
		{"listen port too big", minimalEnv("BINVAULT_LISTEN", ":99999"), "BINVAULT_LISTEN", "invalid port"},
		{"listen named port", minimalEnv("BINVAULT_LISTEN", ":http"), "BINVAULT_LISTEN", "invalid port"},
		{"listen bad host", minimalEnv("BINVAULT_LISTEN", "my host:9000"), "BINVAULT_LISTEN", "invalid host"},
		{"admin on every interface", minimalEnv("BINVAULT_ADMIN_LISTEN", ":9001"), "BINVAULT_ADMIN_LISTEN", "is not a loopback address, so the admin listener needs TLS"},
		{"admin on 0.0.0.0", minimalEnv("BINVAULT_ADMIN_LISTEN", "0.0.0.0:9001"), "BINVAULT_ADMIN_LISTEN", "BINVAULT_ADMIN_INSECURE_HTTP=true"},
		{"admin on a LAN address", minimalEnv("BINVAULT_ADMIN_LISTEN", "192.168.1.5:9001"), "BINVAULT_ADMIN_LISTEN", "not a loopback address"},
		{"admin cert without key", minimalEnv("BINVAULT_ADMIN_TLS_CERT_FILE", "/c"), "BINVAULT_ADMIN_TLS_KEY_FILE", "is required when BINVAULT_ADMIN_TLS_CERT_FILE is set"},
		{"admin key without cert", minimalEnv("BINVAULT_ADMIN_TLS_KEY_FILE", "/k"), "BINVAULT_ADMIN_TLS_CERT_FILE", "is required when BINVAULT_ADMIN_TLS_KEY_FILE is set"},
		{"admin cert path empty", minimalEnv("BINVAULT_ADMIN_TLS_CERT_FILE", "", "BINVAULT_ADMIN_TLS_KEY_FILE", "/k"), "BINVAULT_ADMIN_TLS_CERT_FILE", "is set but empty"},
		{"admin insecure not a boolean", minimalEnv("BINVAULT_ADMIN_INSECURE_HTTP", "maybe"), "BINVAULT_ADMIN_INSECURE_HTTP", "is not a boolean"},
		{"public cert without key", minimalEnv("BINVAULT_TLS_CERT_FILE", "/c"), "BINVAULT_TLS_KEY_FILE", "is required when BINVAULT_TLS_CERT_FILE is set"},
		{"public key without cert", minimalEnv("BINVAULT_TLS_KEY_FILE", "/k"), "BINVAULT_TLS_CERT_FILE", "is required when BINVAULT_TLS_KEY_FILE is set"},

		// Addressing.
		{"endpoint not http", minimalEnv("BINVAULT_ENDPOINT_URL", "ftp://x"), "BINVAULT_ENDPOINT_URL", "must be an http:// or https:// URL"},
		{"endpoint without scheme", minimalEnv("BINVAULT_ENDPOINT_URL", "s3.example.com"), "BINVAULT_ENDPOINT_URL", "must be an absolute http:// or https:// URL"},
		{"endpoint without host", minimalEnv("BINVAULT_ENDPOINT_URL", "http://"), "BINVAULT_ENDPOINT_URL", "has no host"},
		{"endpoint with path", minimalEnv("BINVAULT_ENDPOINT_URL", "http://x/s3"), "BINVAULT_ENDPOINT_URL", "must not have a path"},
		{"endpoint with user info", minimalEnv("BINVAULT_ENDPOINT_URL", "http://user:pw-SECRET@x"), "BINVAULT_ENDPOINT_URL", "must not contain user info"},
		{"endpoint with query", minimalEnv("BINVAULT_ENDPOINT_URL", "http://x?a=1"), "BINVAULT_ENDPOINT_URL", "must not have a query"},
		{"endpoint with fragment", minimalEnv("BINVAULT_ENDPOINT_URL", "http://x#top"), "BINVAULT_ENDPOINT_URL", "must not have a fragment"},
		{"endpoint port 0", minimalEnv("BINVAULT_ENDPOINT_URL", "http://x:0"), "BINVAULT_ENDPOINT_URL", "invalid port"},
		{"domain with scheme", minimalEnv("BINVAULT_DOMAIN", "https://example.com"), "BINVAULT_DOMAIN", "without a scheme"},
		{"domain with port", minimalEnv("BINVAULT_DOMAIN", "example.com:9000"), "BINVAULT_DOMAIN", "without a port"},
		{"domain with slash", minimalEnv("BINVAULT_DOMAIN", "example.com/x"), "BINVAULT_DOMAIN", "without slashes"},
		{"domain with space", minimalEnv("BINVAULT_DOMAIN", "exa mple.com"), "BINVAULT_DOMAIN", "is not a valid DNS name"},
		{"domain label starts with dash", minimalEnv("BINVAULT_DOMAIN", "-s3.example.com"), "BINVAULT_DOMAIN", "is not a valid DNS name"},
		{"domain is an IP", minimalEnv("BINVAULT_DOMAIN", "10.0.0.1"), "BINVAULT_DOMAIN", "not an IP address"},
		{"domain is a wildcard", minimalEnv("BINVAULT_DOMAIN", "*.example.com"), "BINVAULT_DOMAIN", `without "*."`},
		{"region with space", minimalEnv("BINVAULT_REGION", "us east-1"), "BINVAULT_REGION", "must not contain whitespace"},
		{"region with slash", minimalEnv("BINVAULT_REGION", "us/east-1"), "BINVAULT_REGION", "must not contain slashes"},
		{"proxy not an address", minimalEnv("BINVAULT_TRUSTED_PROXIES", "10.0.0.0/8, bogus"), "BINVAULT_TRUSTED_PROXIES", `entry 2 "bogus" is not an IP address or CIDR`},
		{"proxy prefix too long", minimalEnv("BINVAULT_TRUSTED_PROXIES", "10.0.0.0/33"), "BINVAULT_TRUSTED_PROXIES", "entry 1"},
		{"proxy with zone", minimalEnv("BINVAULT_TRUSTED_PROXIES", "fe80::1%eth0"), "BINVAULT_TRUSTED_PROXIES", "entry 1"},
		{"proxy list stray comma", minimalEnv("BINVAULT_TRUSTED_PROXIES", "10.0.0.0/8,"), "BINVAULT_TRUSTED_PROXIES", "entry 2 is empty"},

		// Storage and sizes.
		{"data dir relative", minimalEnv("BINVAULT_DATA_DIR", "var/lib/binvault"), "BINVAULT_DATA_DIR", "must be an absolute path"},
		{"fsync not a boolean", minimalEnv("BINVAULT_FSYNC", "nope"), "BINVAULT_FSYNC", "is not a boolean"},
		{"min free negative", minimalEnv("BINVAULT_MIN_FREE_MB", "-1"), "BINVAULT_MIN_FREE_MB", "whole number of MiB from 0 to"},
		{"min free not a number", minimalEnv("BINVAULT_MIN_FREE_MB", "lots"), "BINVAULT_MIN_FREE_MB", "whole number of MiB"},
		{"min free overflows bytes", minimalEnv("BINVAULT_MIN_FREE_MB", "9223372036854775807"), "BINVAULT_MIN_FREE_MB", "whole number of MiB"},
		{"max object zero", minimalEnv("BINVAULT_MAX_OBJECT_MB", "0"), "BINVAULT_MAX_OBJECT_MB", "from 1 to 5242880 (5 TiB)"},
		{"max object above 5 TiB", minimalEnv("BINVAULT_MAX_OBJECT_MB", "5242881"), "BINVAULT_MAX_OBJECT_MB", "from 1 to 5242880"},
		{"max object with unit", minimalEnv("BINVAULT_MAX_OBJECT_MB", "5G"), "BINVAULT_MAX_OBJECT_MB", "whole number of MiB"},

		// Durations and counts.
		{"gc grace zero", minimalEnv("BINVAULT_GC_GRACE", "0"), "BINVAULT_GC_GRACE", "must be greater than 0"},
		{"gc grace negative", minimalEnv("BINVAULT_GC_GRACE", "-1h"), "BINVAULT_GC_GRACE", "must be greater than 0"},
		{"gc grace in words", minimalEnv("BINVAULT_GC_GRACE", "1 hour"), "BINVAULT_GC_GRACE", "is not a valid duration"},
		{"multipart ttl below 1m", minimalEnv("BINVAULT_MULTIPART_TTL", "30s"), "BINVAULT_MULTIPART_TTL", "must be at least 1m"},
		{"multipart ttl in days", minimalEnv("BINVAULT_MULTIPART_TTL", "7d"), "BINVAULT_MULTIPART_TTL", "write 7d as 168h"},
		{"clock skew without unit", minimalEnv("BINVAULT_CLOCK_SKEW", "15"), "BINVAULT_CLOCK_SKEW", "has no unit"},
		{"header timeout zero", minimalEnv("BINVAULT_HEADER_TIMEOUT", "0s"), "BINVAULT_HEADER_TIMEOUT", "must be greater than 0"},
		{"body idle timeout garbage", minimalEnv("BINVAULT_BODY_IDLE_TIMEOUT", "fast"), "BINVAULT_BODY_IDLE_TIMEOUT", "is not a valid duration"},
		{"shutdown timeout negative", minimalEnv("BINVAULT_SHUTDOWN_TIMEOUT", "-1s"), "BINVAULT_SHUTDOWN_TIMEOUT", "must be greater than 0"},
		{"auth fail limit zero", minimalEnv("BINVAULT_AUTH_FAIL_LIMIT", "0"), "BINVAULT_AUTH_FAIL_LIMIT", "whole number of at least 1"},
		{"auth fail limit fraction", minimalEnv("BINVAULT_AUTH_FAIL_LIMIT", "1.5"), "BINVAULT_AUTH_FAIL_LIMIT", "whole number of at least 1"},
		{"scrub interval negative", minimalEnv("BINVAULT_SCRUB_INTERVAL", "-1h"), "BINVAULT_SCRUB_INTERVAL", "must not be negative"},
		{"lifecycle interval zero", minimalEnv("BINVAULT_LIFECYCLE_INTERVAL", "0"), "BINVAULT_LIFECYCLE_INTERVAL", "must be greater than 0"},
		{"lifecycle batch negative", minimalEnv("BINVAULT_LIFECYCLE_BATCH", "-5"), "BINVAULT_LIFECYCLE_BATCH", "whole number of at least 1"},
		{"pipeline workers zero", minimalEnv("BINVAULT_PIPELINE_WORKERS", "0"), "BINVAULT_PIPELINE_WORKERS", "whole number of at least 1"},
		{"before budget below 1s", minimalEnv("BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT", "500ms"), "BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT", "must be between 1s and 10m"},
		{"before budget above 10m", minimalEnv("BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT", "11m"), "BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT", "must be between 1s and 10m"},
		{"max depth zero", minimalEnv("BINVAULT_PIPELINE_MAX_DEPTH", "0"), "BINVAULT_PIPELINE_MAX_DEPTH", "whole number of at least 1"},
		{"allow private not a boolean", minimalEnv("BINVAULT_PIPELINE_ALLOW_PRIVATE", "2"), "BINVAULT_PIPELINE_ALLOW_PRIVATE", "is not a boolean"},
		{"pipeline CA path empty", minimalEnv("BINVAULT_PIPELINE_CA_FILE", ""), "BINVAULT_PIPELINE_CA_FILE", "is set but empty"},
		{"run retention in days", minimalEnv("BINVAULT_PIPELINE_RUN_RETENTION", "14d"), "BINVAULT_PIPELINE_RUN_RETENTION", "write 14d as 336h"},
		{"metrics per bucket not a boolean", minimalEnv("BINVAULT_METRICS_PER_BUCKET", "x"), "BINVAULT_METRICS_PER_BUCKET", "is not a boolean"},
		{"log format", minimalEnv("BINVAULT_LOG_FORMAT", "text"), "BINVAULT_LOG_FORMAT", "must be one of logfmt, json"},
		{"log level", minimalEnv("BINVAULT_LOG_LEVEL", "trace"), "BINVAULT_LOG_LEVEL", "must be one of debug, info, warn, error"},

		// Cluster (§8.3).
		{"node name missing", clusterEnv("BINVAULT_NODE_NAME", unset), "BINVAULT_NODE_NAME", "is required when BINVAULT_CLUSTER_URLS is set"},
		{"node name blank", clusterEnv("BINVAULT_NODE_NAME", " "), "BINVAULT_NODE_NAME", "is set but empty"},
		{"node name upper case", clusterEnv("BINVAULT_NODE_NAME", "Node-A"), "BINVAULT_NODE_NAME", "must be 1 to 63 characters"},
		{"node name leading dash", clusterEnv("BINVAULT_NODE_NAME", "-a"), "BINVAULT_NODE_NAME", "starting with a letter or digit"},
		{"node name too long", clusterEnv("BINVAULT_NODE_NAME", strings.Repeat("a", 64)), "BINVAULT_NODE_NAME", "must be 1 to 63 characters"},
		{"node name with dot", clusterEnv("BINVAULT_NODE_NAME", "a.b"), "BINVAULT_NODE_NAME", "must be 1 to 63 characters"},
		{"cluster key missing", clusterEnv("BINVAULT_CLUSTER_KEY", unset), "BINVAULT_CLUSTER_KEY", "is required when BINVAULT_CLUSTER_URLS is set"},
		{"cluster key short", clusterEnv("BINVAULT_CLUSTER_KEY", "short-SECRET"), "BINVAULT_CLUSTER_KEY", "is 12 bytes long; at least 32 are required"},
		{"second cluster key short", clusterEnv("BINVAULT_CLUSTER_KEY", testClusterKey+",short-SECRET"), "BINVAULT_CLUSTER_KEY", "key 2 is 12 bytes long"},
		{"cluster keys duplicated", clusterEnv("BINVAULT_CLUSTER_KEY", testClusterKey+","+testClusterKey), "BINVAULT_CLUSTER_KEY", "keys 1 and 2 are identical"},
		{"cluster keys on separate lines", clusterEnv("BINVAULT_CLUSTER_KEY", testClusterKey+"\n"+testClusterKey2), "BINVAULT_CLUSTER_KEY", "control character"},
		{"cluster key both forms", clusterEnv("BINVAULT_CLUSTER_KEY_FILE", "/run/secrets/cluster"), "BINVAULT_CLUSTER_KEY", "is set together with BINVAULT_CLUSTER_KEY_FILE"},
		{"plain http peers", clusterEnv("BINVAULT_CLUSTER_URLS", "http://10.0.0.1:9100,http://10.0.0.2:9100"), "BINVAULT_CLUSTER_URLS", "(http://10.0.0.1:9100, http://10.0.0.2:9100) need BINVAULT_CLUSTER_INSECURE_HTTP=true"},
		{"one plain http peer", clusterEnv("BINVAULT_CLUSTER_URLS", "https://10.0.0.1:9100,http://10.0.0.2:9100"), "BINVAULT_CLUSTER_URLS", "plain-http peer URLs (http://10.0.0.2:9100) need"},
		{"peer listed twice", clusterEnv("BINVAULT_CLUSTER_URLS", "https://a:9100,https://A:9100/"), "BINVAULT_CLUSTER_URLS", `entry 2 "https://a:9100" is listed twice (also entry 1)`},
		{"peer listed twice by default port", clusterEnv("BINVAULT_CLUSTER_URLS", "https://a,https://a:443"), "BINVAULT_CLUSTER_URLS", "is listed twice"},
		{"peer URL with path", clusterEnv("BINVAULT_CLUSTER_URLS", "https://a:9100/peer"), "BINVAULT_CLUSTER_URLS", "must not have a path"},
		{"peer URL without scheme", clusterEnv("BINVAULT_CLUSTER_URLS", "a:9100"), "BINVAULT_CLUSTER_URLS", "must be an absolute http:// or https:// URL"},
		{"peer URL with user info", clusterEnv("BINVAULT_CLUSTER_URLS", "https://u:pw-SECRET@a:9100"), "BINVAULT_CLUSTER_URLS", "must not contain user info"},
		{"peer list stray comma", clusterEnv("BINVAULT_CLUSTER_URLS", "https://a:9100,"), "BINVAULT_CLUSTER_URLS", "entry 2 is empty"},
		{"peer listener without TLS", clusterEnv("BINVAULT_CLUSTER_TLS_CERT_FILE", unset, "BINVAULT_CLUSTER_TLS_KEY_FILE", unset), "BINVAULT_CLUSTER_LISTEN", "is not a loopback address, so the peer listener needs TLS"},
		{"peer cert without key", clusterEnv("BINVAULT_CLUSTER_TLS_KEY_FILE", unset), "BINVAULT_CLUSTER_TLS_KEY_FILE", "is required when BINVAULT_CLUSTER_TLS_CERT_FILE is set"},
		{"peer key without cert", clusterEnv("BINVAULT_CLUSTER_TLS_CERT_FILE", unset), "BINVAULT_CLUSTER_TLS_CERT_FILE", "is required when BINVAULT_CLUSTER_TLS_KEY_FILE is set"},
		{"peer listen garbage", clusterEnv("BINVAULT_CLUSTER_LISTEN", "bogus"), "BINVAULT_CLUSTER_LISTEN", "is not a host:port address"},
		{"cluster insecure not a boolean", clusterEnv("BINVAULT_CLUSTER_INSECURE_HTTP", "x"), "BINVAULT_CLUSTER_INSECURE_HTTP", "is not a boolean"},
		{"cluster CA path empty", clusterEnv("BINVAULT_CLUSTER_CA_FILE", ""), "BINVAULT_CLUSTER_CA_FILE", "is set but empty"},
		{"pull interval zero", clusterEnv("BINVAULT_CLUSTER_PULL_INTERVAL", "0"), "BINVAULT_CLUSTER_PULL_INTERVAL", "must be greater than 0"},
		{"max clock skew garbage", clusterEnv("BINVAULT_CLUSTER_MAX_CLOCK_SKEW", "x"), "BINVAULT_CLUSTER_MAX_CLOCK_SKEW", "is not a valid duration"},
		{"startup fence negative", clusterEnv("BINVAULT_CLUSTER_STARTUP_FENCE", "-1s"), "BINVAULT_CLUSTER_STARTUP_FENCE", "must be greater than 0"},
		{"cluster retention in days", clusterEnv("BINVAULT_CLUSTER_RETENTION", "30d"), "BINVAULT_CLUSTER_RETENTION", "write 30d as 720h"},
		{"forward connect timeout zero", clusterEnv("BINVAULT_CLUSTER_FORWARD_CONNECT_TIMEOUT", "0"), "BINVAULT_CLUSTER_FORWARD_CONNECT_TIMEOUT", "must be greater than 0"},
		{"move streams zero", clusterEnv("BINVAULT_MOVE_STREAMS", "0"), "BINVAULT_MOVE_STREAMS", "whole number of at least 1"},
		{"move freeze timeout zero", clusterEnv("BINVAULT_MOVE_FREEZE_TIMEOUT", "0"), "BINVAULT_MOVE_FREEZE_TIMEOUT", "must be greater than 0"},
		{"cluster URLs blank", minimalEnv("BINVAULT_CLUSTER_URLS", " "), "BINVAULT_CLUSTER_URLS", "is set but empty"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, warns, err := testLoad(tc.env)
			if err == nil {
				t.Fatalf("Load succeeded, want a problem with %s", tc.v)
			}
			if c != nil {
				t.Error("Load returned a configuration together with an error")
			}
			ps := problemsOf(t, err)
			if !hasProblem(ps, tc.v, tc.substr) {
				t.Fatalf("want %s: …%s…, got:\n%v", tc.v, tc.substr, err)
			}
			if !strings.Contains(err.Error(), tc.v+": ") {
				t.Errorf("error text does not name %s: %v", tc.v, err)
			}
			// Secrets never reach a message, whatever is wrong.
			assertNoSecrets(t, "error", err.Error())
			assertNoSecrets(t, "warnings", strings.Join(warns, "\n"))
		})
	}
}

// One problem must not drag in a second, derived one for the same cause.
func TestNoCascadingProblems(t *testing.T) {
	cases := []env{
		minimalEnv("BINVAULT_ADMIN_LISTEN", "bogus"),                                      // no loopback complaint on top
		minimalEnv("BINVAULT_ADMIN_LISTEN", ":9001", "BINVAULT_ADMIN_TLS_KEY_FILE", "/k"), // the pair, not "needs TLS"
		minimalEnv("BINVAULT_ADMIN_LISTEN", ":9001", "BINVAULT_ADMIN_INSECURE_HTTP", "maybe"),
		minimalEnv("BINVAULT_LISTEN", "bogus"), // no default-endpoint complaint
		minimalEnv("BINVAULT_ENDPOINT_URL", "ftp://x"),
		minimalEnv("BINVAULT_ADMIN_TOKEN", ""), // "set but empty", not also "required"
		clusterEnv("BINVAULT_NODE_NAME", ""),
		clusterEnv("BINVAULT_CLUSTER_TLS_KEY_FILE", unset), // the pair, not "needs TLS"
		clusterEnv("BINVAULT_CLUSTER_URLS", "http://10.0.0.1:9100", "BINVAULT_CLUSTER_INSECURE_HTTP", "x"),
	}
	for _, e := range cases {
		_, _, err := testLoad(e)
		if ps := problemsOf(t, err); len(ps) != 1 {
			t.Errorf("want exactly one problem, got:\n%v", err)
		}
	}
}

func TestAcceptsValidValues(t *testing.T) {
	b64 := func(enc *base64.Encoding) string { return enc.EncodeToString(testKey) }
	cases := []struct {
		name  string
		env   env
		check func(c *Config) bool
	}{
		{"booleans true", minimalEnv("BINVAULT_FSYNC", "1", "BINVAULT_METRICS_PER_BUCKET", "T", "BINVAULT_PIPELINE_ALLOW_PRIVATE", "Yes", "BINVAULT_ADMIN_INSECURE_HTTP", "ON"),
			func(c *Config) bool {
				return c.Fsync && c.MetricsPerBucket && c.PipelineAllowPrivate && c.AdminInsecureHTTP
			}},
		{"booleans false", minimalEnv("BINVAULT_FSYNC", "False", "BINVAULT_METRICS_PER_BUCKET", "f", "BINVAULT_PIPELINE_ALLOW_PRIVATE", "NO", "BINVAULT_ADMIN_INSECURE_HTTP", "0"),
			func(c *Config) bool {
				return !c.Fsync && !c.MetricsPerBucket && !c.PipelineAllowPrivate && !c.AdminInsecureHTTP
			}},
		{"scrubber off with 0", minimalEnv("BINVAULT_SCRUB_INTERVAL", "0"), func(c *Config) bool { return c.ScrubInterval == 0 }},
		{"scrubber off with 0s", minimalEnv("BINVAULT_SCRUB_INTERVAL", "0s"), func(c *Config) bool { return c.ScrubInterval == 0 }},
		{"before budget lower edge", minimalEnv("BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT", "1s"), func(c *Config) bool { return c.PipelineBeforeTotalTimeout == time.Second }},
		{"multipart ttl lower edge", minimalEnv("BINVAULT_MULTIPART_TTL", "1m"), func(c *Config) bool { return c.MultipartTTL == time.Minute }},
		{"max object lower edge", minimalEnv("BINVAULT_MAX_OBJECT_MB", "1"), func(c *Config) bool { return c.MaxObjectBytes() == 1<<20 }},
		{"admin on IPv6 loopback", minimalEnv("BINVAULT_ADMIN_LISTEN", "[::1]:9001"), func(c *Config) bool { return c.AdminListen == "[::1]:9001" }},
		{"admin on localhost", minimalEnv("BINVAULT_ADMIN_LISTEN", "localhost:9001"), func(c *Config) bool { return c.AdminListenIsLoopback() }},
		{"admin on 127/8", minimalEnv("BINVAULT_ADMIN_LISTEN", "127.0.0.2:9001"), func(c *Config) bool { return c.AdminListenIsLoopback() }},
		{"admin off loopback, insecure (the image)", minimalEnv("BINVAULT_ADMIN_LISTEN", "0.0.0.0:9001", "BINVAULT_ADMIN_INSECURE_HTTP", "true"),
			func(c *Config) bool { return c.AdminInsecureHTTP && !c.AdminListenIsLoopback() }},
		{"admin off loopback with TLS", minimalEnv("BINVAULT_ADMIN_LISTEN", ":9001", "BINVAULT_ADMIN_TLS_CERT_FILE", "/c", "BINVAULT_ADMIN_TLS_KEY_FILE", "/k"),
			func(c *Config) bool { return c.AdminTLSEnabled() }},
		{"listen on port 0 with an endpoint", minimalEnv("BINVAULT_LISTEN", "127.0.0.1:0", "BINVAULT_ENDPOINT_URL", "http://127.0.0.1:9000"),
			func(c *Config) bool { return c.Listen == "127.0.0.1:0" }},
		{"listen on a host name", minimalEnv("BINVAULT_LISTEN", "s3.internal:9000"), func(c *Config) bool { return c.Listen == "s3.internal:9000" }},
		{"values are trimmed", minimalEnv("BINVAULT_LISTEN", " :9000 \n", "BINVAULT_REGION", "\tauto "), func(c *Config) bool { return c.Listen == ":9000" && c.Region == "auto" }},
		{"endpoint IPv6", minimalEnv("BINVAULT_ENDPOINT_URL", "HTTP://[::1]:9000/"), func(c *Config) bool { return c.EndpointURL == "http://[::1]:9000" }},
		{"endpoint without port", minimalEnv("BINVAULT_ENDPOINT_URL", "https://s3.example.com"), func(c *Config) bool { return c.EndpointURL == "https://s3.example.com" }},
		{"single-label domain", minimalEnv("BINVAULT_DOMAIN", "localhost"), func(c *Config) bool { return c.Domain == "localhost" }},
		{"master key std", minimalEnv("BINVAULT_MASTER_KEY", b64(base64.StdEncoding)), func(c *Config) bool { return string(c.MasterKey) == string(testKey) }},
		{"master key raw std", minimalEnv("BINVAULT_MASTER_KEY", b64(base64.RawStdEncoding)), func(c *Config) bool { return string(c.MasterKey) == string(testKey) }},
		{"master key url", minimalEnv("BINVAULT_MASTER_KEY", b64(base64.URLEncoding)), func(c *Config) bool { return string(c.MasterKey) == string(testKey) }},
		{"master key raw url", minimalEnv("BINVAULT_MASTER_KEY", b64(base64.RawURLEncoding)), func(c *Config) bool { return string(c.MasterKey) == string(testKey) }},
		{"master key padded by blanks", minimalEnv("BINVAULT_MASTER_KEY", "  "+b64(base64.StdEncoding)+"\n"), func(c *Config) bool { return string(c.MasterKey) == string(testKey) }},
		{"admin token of 32 multi-byte characters", minimalEnv("BINVAULT_ADMIN_TOKEN", strings.Repeat("é", 32)), func(c *Config) bool { return len(c.AdminToken) == 1 }},
		{"admin token exactly 32", minimalEnv("BINVAULT_ADMIN_TOKEN", strings.Repeat("a", 32)), func(c *Config) bool { return c.AdminToken[0] == strings.Repeat("a", 32) }},
		{"durations in Go syntax", minimalEnv("BINVAULT_GC_GRACE", "1h30m", "BINVAULT_CLOCK_SKEW", "90s"),
			func(c *Config) bool { return c.GCGrace == 90*time.Minute && c.ClockSkew == 90*time.Second }},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, _ := mustLoad(t, tc.env)
			if !tc.check(c) {
				t.Errorf("unexpected configuration: %v", c)
			}
		})
	}
}

func TestAggregatesEveryProblem(t *testing.T) {
	e := minimalEnv(
		"BINVAULT_ADMIN_TOKEN", "short-SECRET",
		"BINVAULT_MASTER_KEY", unset,
		"BINVAULT_LISTEN", "9000",
		"BINVAULT_GC_GRACE", "1d",
		"BINVAULT_LOG_LEVEL", "loud",
		"BINVAULT_ADMIN_LISTEN", "0.0.0.0:9001",
	)
	_, _, err := testLoad(e)
	ps := problemsOf(t, err)
	want := []string{
		"BINVAULT_ADMIN_TOKEN", "BINVAULT_MASTER_KEY", "BINVAULT_LISTEN", "BINVAULT_GC_GRACE",
		"BINVAULT_LOG_LEVEL", "BINVAULT_ADMIN_LISTEN",
	}
	var got []string
	for _, p := range ps {
		got = append(got, p.Var)
	}
	if !slices.Equal(got, want) {
		t.Fatalf("problems for %v, want %v:\n%v", got, want, err)
	}
	text := err.Error()
	if !strings.HasPrefix(text, "6 configuration problems:") {
		t.Errorf("error text: %q", text)
	}
	for _, p := range ps {
		if !strings.Contains(text, "\n  "+p.String()) {
			t.Errorf("error text lacks %q", p.String())
		}
	}
	assertNoSecrets(t, "error", text)
}

func TestDurationProblem(t *testing.T) {
	cases := map[string]string{
		"30d":   `"30d" is not a valid duration: days (d) and weeks (w) are not supported, so write 30d as 720h`,
		"2w":    "write 2w as 336h",
		"1d12h": "write 1d12h as 36h",
		"1.5d":  "write 1.5d as 36h",
		"1w2d":  "write 1w2d as 216h",
		"1d30m": "write 1d30m as 24h30m",
		"30":    `"30" has no unit: write 30s, 30m or 30h`,
		"1 h":   "is not a valid duration (Go syntax",
		"d":     "is not a valid duration (Go syntax",
	}
	for in, want := range cases {
		if got := durationProblem(in); !strings.Contains(got, want) {
			t.Errorf("durationProblem(%q) = %q, want …%s…", in, got, want)
		}
	}
	for d, want := range map[time.Duration]string{
		720 * time.Hour: "720h", 10 * time.Minute: "10m", 90 * time.Minute: "1h30m",
		time.Second: "1s", 500 * time.Millisecond: "500ms", 90 * time.Second: "1m30s",
	} {
		if got := fmtDuration(d); got != want {
			t.Errorf("fmtDuration(%v) = %q, want %q", d, got, want)
		}
	}
}

func TestEndpointURLDefault(t *testing.T) {
	failHost := func() (string, error) { return "", errors.New("uname failed") }
	cases := []struct {
		name     string
		env      env
		hostname func() (string, error)
		want     string // EndpointURL, or "" when a problem is expected
		problem  string
	}{
		{"hostname and default port", minimalEnv(), fixedHost("Builder-7"), "http://builder-7:9000", ""},
		{"port of BINVAULT_LISTEN", minimalEnv("BINVAULT_LISTEN", "127.0.0.1:8080"), fixedHost("node-1"), "http://node-1:8080", ""},
		{"https with built-in TLS", minimalEnv("BINVAULT_TLS_CERT_FILE", "/c", "BINVAULT_TLS_KEY_FILE", "/k"), fixedHost("node-1"), "https://node-1:9000", ""},
		{"IPv6 listen", minimalEnv("BINVAULT_LISTEN", "[::]:9443"), fixedHost("node-1"), "http://node-1:9443", ""},
		{"explicit wins", minimalEnv("BINVAULT_ENDPOINT_URL", "http://s3.lan:9000"), failHost, "http://s3.lan:9000", ""},
		{"hostname unknown", minimalEnv(), failHost, "", "the hostname is unknown (uname failed)"},
		{"hostname empty", minimalEnv(), fixedHost(""), "", "the hostname is unknown (it is empty)"},
		{"hostname unusable", minimalEnv(), fixedHost("bad host"), "", `the default "http://bad host:9000" built from the hostname`},
		{"listen port 0", minimalEnv("BINVAULT_LISTEN", ":0"), fixedHost("node-1"), "", "is required when BINVAULT_LISTEN uses port 0"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, _, err := load(tc.env.lookup, nil, tc.hostname)
			if tc.problem != "" {
				if !hasProblem(problemsOf(t, err), "BINVAULT_ENDPOINT_URL", tc.problem) {
					t.Fatalf("want BINVAULT_ENDPOINT_URL: …%s…, got %v", tc.problem, err)
				}
				return
			}
			if err != nil {
				t.Fatal(err)
			}
			if c.EndpointURL != tc.want {
				t.Errorf("EndpointURL = %q, want %q", c.EndpointURL, tc.want)
			}
			if slices.ContainsFunc(c.Applied(), func(a string) bool { return strings.HasPrefix(a, "BINVAULT_ENDPOINT_URL=") }) !=
				(tc.env["BINVAULT_ENDPOINT_URL"] != "") {
				t.Errorf("Applied() = %q: a derived default is not an applied variable", c.Applied())
			}
		})
	}
}

func TestSecretFiles(t *testing.T) {
	dir := t.TempDir()
	write := func(name, content string) string {
		t.Helper()
		p := filepath.Join(dir, name)
		if err := os.WriteFile(p, []byte(content), 0o600); err != nil {
			t.Fatal(err)
		}
		return p
	}
	adminFile := write("admin", testToken+","+testToken2+"\n")
	masterFile := write("master", base64.StdEncoding.EncodeToString(testKey)+"\n\n")
	oldFile := write("old", base64.StdEncoding.EncodeToString(testKey2)+"\r\n")
	clusterFile := write("cluster", testClusterKey+"\n")

	c, warns := mustLoad(t, clusterEnv(
		"BINVAULT_ADMIN_TOKEN", unset, "BINVAULT_ADMIN_TOKEN_FILE", adminFile,
		"BINVAULT_MASTER_KEY", unset, "BINVAULT_MASTER_KEY_FILE", masterFile,
		"BINVAULT_MASTER_KEY_OLD_FILE", oldFile,
		"BINVAULT_CLUSTER_KEY", unset, "BINVAULT_CLUSTER_KEY_FILE", clusterFile,
	))
	if len(warns) != 0 {
		t.Errorf("warnings = %q", warns)
	}
	if !slices.Equal(c.AdminToken, []string{testToken, testToken2}) {
		t.Errorf("AdminToken = %q", c.AdminToken)
	}
	if string(c.MasterKey) != string(testKey) || len(c.MasterKeyOld) != 1 || string(c.MasterKeyOld[0]) != string(testKey2) {
		t.Error("master keys not read from their files")
	}
	if len(c.ClusterKey) != 1 || string(c.ClusterKey[0]) != testClusterKey {
		t.Errorf("ClusterKey not read from its file (trailing newline must go)")
	}
	applied := c.Applied()
	for _, want := range []string{
		"BINVAULT_ADMIN_TOKEN_FILE=" + adminFile, "BINVAULT_MASTER_KEY_FILE=" + masterFile,
		"BINVAULT_MASTER_KEY_OLD_FILE=" + oldFile, "BINVAULT_CLUSTER_KEY_FILE=" + clusterFile,
	} {
		if !slices.Contains(applied, want) {
			t.Errorf("Applied() lacks %q: %q", want, applied)
		}
	}
	if slices.Contains(applied, "BINVAULT_ADMIN_TOKEN=***") {
		t.Errorf("Applied() lists the plain form although the file form was used: %q", applied)
	}
	assertNoSecrets(t, "Applied()", strings.Join(applied, "\n"))

	// Only trailing whitespace is cut from a file; what is left is parsed
	// like the plain form.
	for content, want := range map[string]string{
		"value\n":      "value",
		"value \t\r\n": "value",
		"  value\n":    "  value",
		"a\nb\n":       "a\nb",
	} {
		if got, err := readSecretFile(write("trim", content)); err != nil || got != want {
			t.Errorf("readSecretFile(%q) = %q, %v; want %q", content, got, err, want)
		}
	}

	empty := write("empty", "\n \n")
	big := write("big", strings.Repeat("x", maxSecretFile+1))
	badKey := write("badkey", "SECRET-not-base64!!\n")
	shortToken := write("short", "SECRET-short\n")
	cases := []struct {
		name   string
		env    env
		v      string
		substr string
	}{
		{"both forms", minimalEnv("BINVAULT_ADMIN_TOKEN_FILE", adminFile), "BINVAULT_ADMIN_TOKEN", "is set together with BINVAULT_ADMIN_TOKEN_FILE"},
		{"missing file", minimalEnv("BINVAULT_MASTER_KEY", unset, "BINVAULT_MASTER_KEY_FILE", filepath.Join(dir, "nope")), "BINVAULT_MASTER_KEY_FILE", "no such file"},
		{"blank file", minimalEnv("BINVAULT_ADMIN_TOKEN", unset, "BINVAULT_ADMIN_TOKEN_FILE", empty), "BINVAULT_ADMIN_TOKEN_FILE", "the secret file " + empty + " is empty"},
		{"blank key file", minimalEnv("BINVAULT_MASTER_KEY", unset, "BINVAULT_MASTER_KEY_FILE", empty), "BINVAULT_MASTER_KEY_FILE", "the secret file " + empty + " is empty"},
		{"directory", minimalEnv("BINVAULT_MASTER_KEY", unset, "BINVAULT_MASTER_KEY_FILE", dir), "BINVAULT_MASTER_KEY_FILE", "cannot read the secret file"},
		{"too large", minimalEnv("BINVAULT_ADMIN_TOKEN", unset, "BINVAULT_ADMIN_TOKEN_FILE", big), "BINVAULT_ADMIN_TOKEN_FILE", "larger than 64 KiB"},
		{"blank path", minimalEnv("BINVAULT_MASTER_KEY_OLD_FILE", " "), "BINVAULT_MASTER_KEY_OLD_FILE", "is set but empty"},
		{"invalid key in file", minimalEnv("BINVAULT_MASTER_KEY", unset, "BINVAULT_MASTER_KEY_FILE", badKey), "BINVAULT_MASTER_KEY_FILE", "is not valid base64"},
		{"short token in file", minimalEnv("BINVAULT_ADMIN_TOKEN", unset, "BINVAULT_ADMIN_TOKEN_FILE", shortToken), "BINVAULT_ADMIN_TOKEN_FILE", "at least 32 are required"},
		{"short cluster key in file", clusterEnv("BINVAULT_CLUSTER_KEY", unset, "BINVAULT_CLUSTER_KEY_FILE", shortToken), "BINVAULT_CLUSTER_KEY_FILE", "at least 32 are required"},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			_, _, err := testLoad(tc.env)
			if !hasProblem(problemsOf(t, err), tc.v, tc.substr) {
				t.Fatalf("want %s: …%s…, got %v", tc.v, tc.substr, err)
			}
			assertNoSecrets(t, "error", err.Error())
		})
	}
}

func TestUnknownVariables(t *testing.T) {
	environ := []string{
		"BINVAULT_ADMIN_TOKEN=" + testToken,
		"BINVAULT_MASTER_KEY=" + base64.StdEncoding.EncodeToString(testKey),
		"BINVAULT_ENDPOINT_URL=http://127.0.0.1:9000",
		"BINVAULT_LISTN=:9000",
		"BINVAULT_ADMIN_TOKN=" + testToken2, // a misspelt secret: its value must not leak
		"BINVAULT_FROBNICATE=1",
		"BINVAULT_REGION_FILE=/run/secrets/region",
		"binvault_listen=:9000",
		"BINVAULT_LISTN=:9001", // repeated: one warning
		"PATH=/usr/bin",
		"HOME=/root",
	}
	c, warns, err := LoadFromEnviron(environ)
	if err != nil {
		t.Fatal(err)
	}
	want := []string{
		"BINVAULT_ADMIN_TOKN: unknown variable, ignored (did you mean BINVAULT_ADMIN_TOKEN?)",
		"BINVAULT_FROBNICATE: unknown variable, ignored",
		"BINVAULT_LISTN: unknown variable, ignored (did you mean BINVAULT_LISTEN?)",
		"BINVAULT_REGION_FILE: unknown variable, ignored (only BINVAULT_ADMIN_TOKEN, BINVAULT_MASTER_KEY, BINVAULT_MASTER_KEY_OLD and BINVAULT_CLUSTER_KEY accept a _FILE form)",
		"binvault_listen: unknown variable, ignored (did you mean BINVAULT_LISTEN?)",
	}
	if !slices.Equal(warns, want) {
		t.Errorf("warnings:\n%s\nwant:\n%s", strings.Join(warns, "\n"), strings.Join(want, "\n"))
	}
	assertNoSecrets(t, "warnings", strings.Join(warns, "\n"))
	if c.Listen != ":9000" {
		t.Errorf("an unknown variable changed the configuration: Listen %q", c.Listen)
	}

	// A lookup function cannot enumerate, so Load cannot warn.
	vars := map[string]string{}
	for _, kv := range environ {
		k, v, _ := strings.Cut(kv, "=")
		vars[k] = v
	}
	_, warns, err = Load(func(k string) (string, bool) { v, ok := vars[k]; return v, ok })
	if err != nil || len(warns) != 0 {
		t.Errorf("Load: warnings %q, err %v; want neither", warns, err)
	}
}

func TestSuggestion(t *testing.T) {
	cases := map[string]string{
		"BINVAULT_LISTN":                  "BINVAULT_LISTEN",
		"BINVAULT_LISTEN_":                "BINVAULT_LISTEN",
		"BINVAULT_MAX_OBJECTS_MB":         "BINVAULT_MAX_OBJECT_MB",
		"BINVAULT_ADMIN_TOKEN_FIL":        "BINVAULT_ADMIN_TOKEN_FILE",
		"BINVAULT_Cluster_Urls":           "BINVAULT_CLUSTER_URLS",
		"BINVAULT_CLUSTER_RETENSION":      "BINVAULT_CLUSTER_RETENTION",
		"BINVAULT_PIPELINE_WORKER":        "BINVAULT_PIPELINE_WORKERS",
		"BINVAULT_MASTERKEY":              "BINVAULT_MASTER_KEY",
		"BINVAULT_LOGLVL":                 "BINVAULT_LOG_LEVEL", // distance 3: the limit
		"BINVAULT_LSN":                    "BINVAULT_LISTEN",    // ties BINVAULT_FSYNC at 3: table order wins
		"BINVAULT_ENDPOINT":               "",                   // distance 4
		"BINVAULT_SOMETHING_ELSE":         "",
		"BINVAULT_MAX_OBJECT_SIZE":        "",
		"BINVAULT_PIPELINE_BEFORE_BUDGET": "",
	}
	for in, want := range cases {
		got := suggestion(in)
		if want == "" {
			if got != "" {
				t.Errorf("suggestion(%q) = %q, want none", in, got)
			}
			continue
		}
		if got != " (did you mean "+want+"?)" {
			t.Errorf("suggestion(%q) = %q, want %s", in, got, want)
		}
	}
	for _, tc := range []struct {
		a, b string
		d    int
	}{{"", "", 0}, {"a", "", 1}, {"kitten", "sitting", 3}, {"flaw", "lawn", 2}, {"é", "e", 1}, {"same", "same", 0}} {
		if got := levenshtein(tc.a, tc.b); got != tc.d {
			t.Errorf("levenshtein(%q, %q) = %d, want %d", tc.a, tc.b, got, tc.d)
		}
	}
}

func TestLoadReadsTheProcessEnvironment(t *testing.T) {
	for _, kv := range os.Environ() {
		if strings.HasPrefix(strings.ToUpper(kv), envPrefix) {
			t.Skip("the test process already has BINVAULT_* variables")
		}
	}
	t.Setenv("BINVAULT_ADMIN_TOKEN", testToken)
	t.Setenv("BINVAULT_MASTER_KEY", base64.StdEncoding.EncodeToString(testKey))
	t.Setenv("BINVAULT_ENDPOINT_URL", "http://127.0.0.1:9000")
	t.Setenv("BINVAULT_REGION", "test-region-1")
	c, warns, err := Load(nil)
	if err != nil || len(warns) != 0 || c.Region != "test-region-1" {
		t.Fatalf("Load(nil): %v, warnings %q, err %v", c, warns, err)
	}
	c, warns, err = LoadFromEnviron(os.Environ())
	if err != nil || len(warns) != 0 || c.Region != "test-region-1" {
		t.Fatalf("LoadFromEnviron(os.Environ()): %v, warnings %q, err %v", c, warns, err)
	}
}

func TestLoadFromEnvironParsing(t *testing.T) {
	environ := []string{
		"=C:=C:\\binvault", // a Windows drive entry
		"MALFORMED",
		"BINVAULT_ADMIN_TOKEN=" + testToken,
		"BINVAULT_MASTER_KEY=" + base64.StdEncoding.EncodeToString(testKey),
		"BINVAULT_ENDPOINT_URL=http://127.0.0.1:9000",
		"BINVAULT_REGION=first=wins",
		"BINVAULT_REGION=second",
	}
	c, warns, err := LoadFromEnviron(environ)
	if err != nil {
		t.Fatal(err)
	}
	if c.Region != "first=wins" || len(warns) != 0 {
		t.Errorf("Region %q (want the first entry, with its '='), warnings %q", c.Region, warns)
	}
	if _, _, err := LoadFromEnviron(nil); err == nil {
		t.Error("an empty environment lacks the required secrets")
	}
}

// On a single node the cluster variables are never parsed: anything set
// there warns, never fails, and is not listed as applied.
func TestSingleNodeIgnoresClusterVariables(t *testing.T) {
	e := minimalEnv(
		"BINVAULT_NODE_NAME", "Not A Valid Name!",
		"BINVAULT_CLUSTER_KEY", "short-SECRET",
		"BINVAULT_CLUSTER_KEY_FILE", "/nonexistent/SECRET",
		"BINVAULT_CLUSTER_LISTEN", "garbage",
		"BINVAULT_CLUSTER_PULL_INTERVAL", "often",
		"BINVAULT_CLUSTER_RETENTION", "30d",
		"BINVAULT_CLUSTER_INSECURE_HTTP", "",
		"BINVAULT_MOVE_STREAMS", "0",
	)
	c, warns := mustLoad(t, e)
	want := []string{
		"BINVAULT_NODE_NAME", "BINVAULT_CLUSTER_KEY", "BINVAULT_CLUSTER_KEY_FILE", "BINVAULT_CLUSTER_LISTEN",
		"BINVAULT_CLUSTER_INSECURE_HTTP", "BINVAULT_CLUSTER_PULL_INTERVAL", "BINVAULT_CLUSTER_RETENTION", "BINVAULT_MOVE_STREAMS",
	}
	var got []string
	for _, w := range warns {
		name, msg, _ := strings.Cut(w, ": ")
		if msg != "has no effect in single-node mode (BINVAULT_CLUSTER_URLS is not set)" {
			t.Errorf("warning %q", w)
		}
		got = append(got, name)
	}
	if !slices.Equal(got, want) {
		t.Errorf("warned about %v, want %v", got, want)
	}
	assertNoSecrets(t, "warnings", strings.Join(warns, "\n"))
	if c.ClusterEnabled() || c.NodeName != "" || c.ClusterKey != nil || c.ClusterListen != ":9100" || c.MoveStreams != 4 {
		t.Error("single-node mode must keep the cluster fields at their defaults")
	}
	for _, a := range c.Applied() {
		if strings.Contains(a, "CLUSTER") || strings.Contains(a, "NODE_NAME") || strings.Contains(a, "MOVE") {
			t.Errorf("Applied() lists ignored %q", a)
		}
	}
}

func TestClusterModes(t *testing.T) {
	seventeen := make([]string, 17)
	for i := range seventeen {
		seventeen[i] = "https://node" + string(rune('a'+i)) + ":9100"
	}
	cases := []struct {
		name  string
		env   env
		warn  string // substring of the one expected warning, "" for none
		check func(c *Config) bool
	}{
		{"TLS peer listener", clusterEnv(), "",
			func(c *Config) bool { return c.ClusterEnabled() && c.ClusterTLSEnabled() && c.NodeName == "node-a" }},
		{"loopback listener behind a TLS proxy",
			clusterEnv("BINVAULT_CLUSTER_LISTEN", "127.0.0.1:9100", "BINVAULT_CLUSTER_TLS_CERT_FILE", unset, "BINVAULT_CLUSTER_TLS_KEY_FILE", unset), "",
			func(c *Config) bool { return !c.ClusterTLSEnabled() && c.ClusterListenIsLoopback() }},
		{"plain http on a private network (the cluster tour)",
			clusterEnv("BINVAULT_CLUSTER_URLS", "http://10.0.0.1:9100,http://10.0.0.2:9100,http://10.0.0.3:9100",
				"BINVAULT_CLUSTER_INSECURE_HTTP", "true", "BINVAULT_CLUSTER_TLS_CERT_FILE", unset, "BINVAULT_CLUSTER_TLS_KEY_FILE", unset),
			"the peer link uses plain HTTP, so everything on it travels readable",
			func(c *Config) bool { return len(c.ClusterURLs) == 3 && c.ClusterInsecureHTTP }},
		{"https URLs but a plain non-loopback listener",
			clusterEnv("BINVAULT_CLUSTER_INSECURE_HTTP", "true", "BINVAULT_CLUSTER_TLS_CERT_FILE", unset, "BINVAULT_CLUSTER_TLS_KEY_FILE", unset),
			"travels readable", func(c *Config) bool { return c.ClusterInsecureHTTP }},
		{"insecure allowed but unused", clusterEnv("BINVAULT_CLUSTER_INSECURE_HTTP", "true"), "",
			func(c *Config) bool { return c.ClusterInsecureHTTP }},
		{"cluster of one", clusterEnv("BINVAULT_CLUSTER_URLS", "https://10.0.0.1:9100"), "",
			func(c *Config) bool { return slices.Equal(c.ClusterURLs, []string{"https://10.0.0.1:9100"}) }},
		{"more nodes than supported", clusterEnv("BINVAULT_CLUSTER_URLS", strings.Join(seventeen, ",")), "lists 17 nodes; at most 16 are supported",
			func(c *Config) bool { return len(c.ClusterURLs) == 17 }},
		{"key rotation sends the first", clusterEnv("BINVAULT_CLUSTER_KEY", testClusterKey2+", "+testClusterKey), "",
			func(c *Config) bool {
				return len(c.ClusterKey) == 2 && string(c.ClusterKey[0]) == testClusterKey2 && string(c.ClusterKey[1]) == testClusterKey
			}},
		{"URLs normalised", clusterEnv("BINVAULT_CLUSTER_URLS", "HTTPS://Node-A.Internal:9100/, https://[FD00::2]:9100"), "",
			func(c *Config) bool {
				return slices.Equal(c.ClusterURLs, []string{"https://node-a.internal:9100", "https://[fd00::2]:9100"})
			}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			c, warns := mustLoad(t, tc.env)
			switch {
			case tc.warn == "" && len(warns) != 0:
				t.Errorf("warnings = %q, want none", warns)
			case tc.warn != "" && (len(warns) != 1 || !strings.Contains(warns[0], tc.warn)):
				t.Errorf("warnings = %q, want one containing %q", warns, tc.warn)
			}
			if !tc.check(c) {
				t.Errorf("unexpected configuration: %v", c)
			}
			assertNoSecrets(t, "warnings", strings.Join(warns, "\n"))
		})
	}
}
