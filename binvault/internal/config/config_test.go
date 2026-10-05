package config

import (
	"bytes"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"maps"
	"net/netip"
	"reflect"
	"slices"
	"strings"
	"testing"
	"time"
)

// Fixtures. Every secret contains "SECRET" so tests can check none leaks.
var (
	testToken       = "tok-SECRET-0123456789abcdefghijklmn"     // 35 characters
	testToken2      = "tok2-SECRET-0123456789abcdefghijklmnopq" // 39 characters
	testKey         = bytes.Repeat([]byte{0x11}, 32)
	testKey2        = bytes.Repeat([]byte{0x22}, 32)
	testKey3        = bytes.Repeat([]byte{0x33}, 32)
	testClusterKey  = "cluster-SECRET-0123456789abcdefghij"    // 35 bytes
	testClusterKey2 = "cluster2-SECRET-0123456789abcdefghijkl" // 38 bytes
)

// unset, as a value given to env.set, removes the variable.
const unset = "\x00unset"

// env is a fake environment.
type env map[string]string

func (e env) lookup(k string) (string, bool) {
	v, ok := e[k]
	return v, ok
}

// set returns a copy of e with each key-value pair of kv applied.
func (e env) set(kv ...string) env {
	out := maps.Clone(e)
	for i := 0; i+1 < len(kv); i += 2 {
		if kv[i+1] == unset {
			delete(out, kv[i])
		} else {
			out[kv[i]] = kv[i+1]
		}
	}
	return out
}

// minimalEnv is the smallest valid single-node environment, plus kv.
func minimalEnv(kv ...string) env {
	return env{
		"BINVAULT_ADMIN_TOKEN": testToken,
		"BINVAULT_MASTER_KEY":  base64.StdEncoding.EncodeToString(testKey),
	}.set(kv...)
}

// clusterEnv is a valid cluster environment with a TLS peer listener, plus kv.
func clusterEnv(kv ...string) env {
	return minimalEnv(
		"BINVAULT_NODE_NAME", "node-a",
		"BINVAULT_CLUSTER_URLS", "https://10.0.0.1:9100,https://10.0.0.2:9100",
		"BINVAULT_CLUSTER_KEY", testClusterKey,
		"BINVAULT_CLUSTER_TLS_CERT_FILE", "/etc/binvault/peer.crt",
		"BINVAULT_CLUSTER_TLS_KEY_FILE", "/etc/binvault/peer.key",
	).set(kv...)
}

// fixedHost is a host-name source that always answers name.
func fixedHost(name string) func() (string, error) {
	return func() (string, error) { return name, nil }
}

// testLoad loads e with every key visible (so unknown variables are
// detected) and the host name "Node-1".
func testLoad(e env) (*Config, []string, error) {
	return load(e.lookup, slices.Collect(maps.Keys(e)), fixedHost("Node-1"))
}

func mustLoad(t *testing.T, e env) (*Config, []string) {
	t.Helper()
	c, warns, err := testLoad(e)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}
	return c, warns
}

func problemsOf(t *testing.T, err error) []Problem {
	t.Helper()
	var e *Error
	if !errors.As(err, &e) {
		t.Fatalf("error %v (%T) is not a *Error", err, err)
	}
	return e.Problems
}

func hasProblem(ps []Problem, name, substr string) bool {
	for _, p := range ps {
		if p.Var == name && strings.Contains(p.Msg, substr) {
			return true
		}
	}
	return false
}

// compareConfig reports every exported field of got that differs from want.
func compareConfig(t *testing.T, got, want *Config) {
	t.Helper()
	g, w := reflect.ValueOf(*got), reflect.ValueOf(*want)
	for i := range g.NumField() {
		f := g.Type().Field(i)
		if !f.IsExported() {
			continue
		}
		if gv, wv := g.Field(i).Interface(), w.Field(i).Interface(); !reflect.DeepEqual(gv, wv) {
			t.Errorf("%s = %#v, want %#v", f.Name, gv, wv)
		}
	}
}

// specNames is the §2.3 table, in order, spelled out independently of the
// constants.
var specNames = []string{
	"BINVAULT_ADMIN_TOKEN", "BINVAULT_MASTER_KEY", "BINVAULT_MASTER_KEY_OLD",
	"BINVAULT_LISTEN", "BINVAULT_ADMIN_LISTEN", "BINVAULT_ADMIN_TLS_CERT_FILE", "BINVAULT_ADMIN_TLS_KEY_FILE",
	"BINVAULT_ADMIN_INSECURE_HTTP", "BINVAULT_ENDPOINT_URL", "BINVAULT_DOMAIN", "BINVAULT_REGION",
	"BINVAULT_TLS_CERT_FILE", "BINVAULT_TLS_KEY_FILE", "BINVAULT_TRUSTED_PROXIES", "BINVAULT_DATA_DIR",
	"BINVAULT_FSYNC", "BINVAULT_MIN_FREE_MB", "BINVAULT_MAX_OBJECT_MB", "BINVAULT_GC_GRACE",
	"BINVAULT_MULTIPART_TTL", "BINVAULT_CLOCK_SKEW", "BINVAULT_HEADER_TIMEOUT", "BINVAULT_BODY_IDLE_TIMEOUT",
	"BINVAULT_SHUTDOWN_TIMEOUT", "BINVAULT_AUTH_FAIL_LIMIT", "BINVAULT_SCRUB_INTERVAL",
	"BINVAULT_LIFECYCLE_INTERVAL", "BINVAULT_LIFECYCLE_BATCH", "BINVAULT_PIPELINE_WORKERS",
	"BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT", "BINVAULT_PIPELINE_MAX_DEPTH", "BINVAULT_PIPELINE_ALLOW_PRIVATE",
	"BINVAULT_PIPELINE_CA_FILE", "BINVAULT_PIPELINE_RUN_RETENTION", "BINVAULT_METRICS_PER_BUCKET",
	"BINVAULT_LOG_FORMAT", "BINVAULT_LOG_LEVEL", "BINVAULT_NODE_NAME", "BINVAULT_CLUSTER_URLS",
	"BINVAULT_CLUSTER_KEY", "BINVAULT_CLUSTER_LISTEN", "BINVAULT_CLUSTER_TLS_CERT_FILE",
	"BINVAULT_CLUSTER_TLS_KEY_FILE", "BINVAULT_CLUSTER_CA_FILE", "BINVAULT_CLUSTER_INSECURE_HTTP",
	"BINVAULT_CLUSTER_PULL_INTERVAL", "BINVAULT_CLUSTER_MAX_CLOCK_SKEW", "BINVAULT_CLUSTER_STARTUP_FENCE",
	"BINVAULT_CLUSTER_RETENTION", "BINVAULT_CLUSTER_FORWARD_CONNECT_TIMEOUT", "BINVAULT_MOVE_STREAMS",
	"BINVAULT_MOVE_FREEZE_TIMEOUT",
}

func TestVariableTableMatchesSpec(t *testing.T) {
	var names, secrets, cluster []string
	for _, v := range variables {
		names = append(names, v.name)
		if v.secret {
			secrets = append(secrets, v.name)
		}
		if v.cluster {
			cluster = append(cluster, v.name)
		}
	}
	if !slices.Equal(names, specNames) {
		t.Errorf("variables = %v\nwant %v", names, specNames)
	}
	wantSecrets := []string{"BINVAULT_ADMIN_TOKEN", "BINVAULT_MASTER_KEY", "BINVAULT_MASTER_KEY_OLD", "BINVAULT_CLUSTER_KEY"}
	if !slices.Equal(secrets, wantSecrets) {
		t.Errorf("secret variables = %v, want %v", secrets, wantSecrets)
	}
	var wantCluster []string
	for _, n := range specNames {
		if n == "BINVAULT_NODE_NAME" || strings.HasPrefix(n, "BINVAULT_MOVE_") ||
			(strings.HasPrefix(n, "BINVAULT_CLUSTER_") && n != "BINVAULT_CLUSTER_URLS") {
			wantCluster = append(wantCluster, n)
		}
	}
	if !slices.Equal(cluster, wantCluster) {
		t.Errorf("cluster-only variables = %v, want %v", cluster, wantCluster)
	}
	if len(allNames) != len(specNames)+4 || !known["BINVAULT_CLUSTER_KEY_FILE"] || known["BINVAULT_LISTEN_FILE"] {
		t.Errorf("allNames = %v: want the table plus four _FILE forms", allNames)
	}
}

// Every default must be exactly the §2.3 table's (values spelled out here,
// not taken from defaults()).
func TestDefaultsMatchSpec(t *testing.T) {
	c, warns := mustLoad(t, minimalEnv())
	if len(warns) != 0 {
		t.Errorf("warnings = %q, want none", warns)
	}
	want := &Config{
		AdminToken:                   []string{testToken},
		MasterKey:                    testKey,
		Listen:                       ":9000",
		AdminListen:                  "127.0.0.1:9001",
		EndpointURL:                  "http://node-1:9000",
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
	compareConfig(t, c, want)

	if got := c.Applied(); !slices.Equal(got, []string{"BINVAULT_ADMIN_TOKEN=***", "BINVAULT_MASTER_KEY=***"}) {
		t.Errorf("Applied() = %q", got)
	}
	if c.ClusterEnabled() || c.TLSEnabled() || c.AdminTLSEnabled() || c.ClusterTLSEnabled() || !c.AdminListenIsLoopback() {
		t.Error("defaults: want a single node, no TLS, admin on loopback")
	}
	if c.MaxObjectBytes() != 5<<30 || c.MinFreeBytes() != 512<<20 || c.SlogLevel() != slog.LevelInfo {
		t.Errorf("MaxObjectBytes %d, MinFreeBytes %d, SlogLevel %v", c.MaxObjectBytes(), c.MinFreeBytes(), c.SlogLevel())
	}

	// Defaults is the same configuration without the secrets.
	d := Defaults()
	if !strings.HasPrefix(d.EndpointURL, "http://") || !strings.HasSuffix(d.EndpointURL, ":9000") {
		t.Errorf("Defaults().EndpointURL = %q, want http://<hostname>:9000", d.EndpointURL)
	}
	d.EndpointURL = want.EndpointURL
	noSecrets := *want
	noSecrets.AdminToken, noSecrets.MasterKey = nil, nil
	compareConfig(t, d, &noSecrets)
	if len(d.Applied()) != 0 {
		t.Errorf("Defaults().Applied() = %q, want none", d.Applied())
	}
}

// everyVariable sets every §2.3 variable to a valid value other than its
// default, in cluster mode, with literal names.
func everyVariable() env {
	return env{
		"BINVAULT_ADMIN_TOKEN":                     testToken + ", " + testToken2,
		"BINVAULT_MASTER_KEY":                      base64.StdEncoding.EncodeToString(testKey),
		"BINVAULT_MASTER_KEY_OLD":                  base64.RawURLEncoding.EncodeToString(testKey2) + " , " + base64.URLEncoding.EncodeToString(testKey3),
		"BINVAULT_LISTEN":                          "0.0.0.0:8000",
		"BINVAULT_ADMIN_LISTEN":                    "10.1.2.3:8001",
		"BINVAULT_ADMIN_TLS_CERT_FILE":             "/etc/binvault/admin.crt",
		"BINVAULT_ADMIN_TLS_KEY_FILE":              "/etc/binvault/admin.key",
		"BINVAULT_ADMIN_INSECURE_HTTP":             "yes",
		"BINVAULT_ENDPOINT_URL":                    "https://S3.Example.com:8443/",
		"BINVAULT_DOMAIN":                          "S3.Example.COM.",
		"BINVAULT_REGION":                          "eu-central-1",
		"BINVAULT_TLS_CERT_FILE":                   "/etc/binvault/tls.crt",
		"BINVAULT_TLS_KEY_FILE":                    "/etc/binvault/tls.key",
		"BINVAULT_TRUSTED_PROXIES":                 "10.0.0.0/8, 192.168.1.7 ,fd00::/8,2001:db8::1,::ffff:172.16.0.0/108,10.9.8.7/16",
		"BINVAULT_DATA_DIR":                        "/srv/binvault/",
		"BINVAULT_FSYNC":                           "off",
		"BINVAULT_MIN_FREE_MB":                     "0",
		"BINVAULT_MAX_OBJECT_MB":                   "5242880",
		"BINVAULT_GC_GRACE":                        "2h30m",
		"BINVAULT_MULTIPART_TTL":                   "24h",
		"BINVAULT_CLOCK_SKEW":                      "5m",
		"BINVAULT_HEADER_TIMEOUT":                  "5s",
		"BINVAULT_BODY_IDLE_TIMEOUT":               "2m",
		"BINVAULT_SHUTDOWN_TIMEOUT":                "90s",
		"BINVAULT_AUTH_FAIL_LIMIT":                 "100",
		"BINVAULT_SCRUB_INTERVAL":                  "168h",
		"BINVAULT_LIFECYCLE_INTERVAL":              "15m",
		"BINVAULT_LIFECYCLE_BATCH":                 "250",
		"BINVAULT_PIPELINE_WORKERS":                "32",
		"BINVAULT_PIPELINE_BEFORE_TOTAL_TIMEOUT":   "10m",
		"BINVAULT_PIPELINE_MAX_DEPTH":              "2",
		"BINVAULT_PIPELINE_ALLOW_PRIVATE":          "FALSE",
		"BINVAULT_PIPELINE_CA_FILE":                "/etc/ssl/pipeline-ca.pem",
		"BINVAULT_PIPELINE_RUN_RETENTION":          "72h",
		"BINVAULT_METRICS_PER_BUCKET":              "0",
		"BINVAULT_LOG_FORMAT":                      "JSON",
		"BINVAULT_LOG_LEVEL":                       "Debug",
		"BINVAULT_NODE_NAME":                       "node-a_1",
		"BINVAULT_CLUSTER_URLS":                    "https://10.0.0.1:9100/, https://Node-B.internal:9100",
		"BINVAULT_CLUSTER_KEY":                     testClusterKey + "," + testClusterKey2,
		"BINVAULT_CLUSTER_LISTEN":                  "10.0.0.1:9200",
		"BINVAULT_CLUSTER_TLS_CERT_FILE":           "/etc/binvault/peer.crt",
		"BINVAULT_CLUSTER_TLS_KEY_FILE":            "/etc/binvault/peer.key",
		"BINVAULT_CLUSTER_CA_FILE":                 "/etc/binvault/peer-ca.pem",
		"BINVAULT_CLUSTER_INSECURE_HTTP":           "on",
		"BINVAULT_CLUSTER_PULL_INTERVAL":           "1s",
		"BINVAULT_CLUSTER_MAX_CLOCK_SKEW":          "30s",
		"BINVAULT_CLUSTER_STARTUP_FENCE":           "1m",
		"BINVAULT_CLUSTER_RETENTION":               "168h",
		"BINVAULT_CLUSTER_FORWARD_CONNECT_TIMEOUT": "500ms",
		"BINVAULT_MOVE_STREAMS":                    "16",
		"BINVAULT_MOVE_FREEZE_TIMEOUT":             "5m",
	}
}

func TestEveryVariableParsed(t *testing.T) {
	e := everyVariable()
	if len(e) != len(specNames) {
		t.Fatalf("fixture sets %d variables, the table has %d", len(e), len(specNames))
	}
	c, warns := mustLoad(t, e)
	if len(warns) != 0 {
		t.Errorf("warnings = %q, want none", warns)
	}
	compareConfig(t, c, &Config{
		AdminToken:        []string{testToken, testToken2},
		MasterKey:         testKey,
		MasterKeyOld:      [][]byte{testKey2, testKey3},
		Listen:            "0.0.0.0:8000",
		AdminListen:       "10.1.2.3:8001",
		AdminTLSCertFile:  "/etc/binvault/admin.crt",
		AdminTLSKeyFile:   "/etc/binvault/admin.key",
		AdminInsecureHTTP: true,
		TLSCertFile:       "/etc/binvault/tls.crt",
		TLSKeyFile:        "/etc/binvault/tls.key",
		EndpointURL:       "https://s3.example.com:8443",
		Domain:            "s3.example.com",
		Region:            "eu-central-1",
		TrustedProxies: []netip.Prefix{
			netip.MustParsePrefix("10.0.0.0/8"),
			netip.MustParsePrefix("192.168.1.7/32"),
			netip.MustParsePrefix("fd00::/8"),
			netip.MustParsePrefix("2001:db8::1/128"),
			netip.MustParsePrefix("172.16.0.0/12"),
			netip.MustParsePrefix("10.9.0.0/16"),
		},
		DataDir:                      "/srv/binvault",
		Fsync:                        false,
		MinFreeMB:                    0,
		MaxObjectMB:                  5242880,
		GCGrace:                      2*time.Hour + 30*time.Minute,
		MultipartTTL:                 24 * time.Hour,
		ClockSkew:                    5 * time.Minute,
		HeaderTimeout:                5 * time.Second,
		BodyIdleTimeout:              2 * time.Minute,
		ShutdownTimeout:              90 * time.Second,
		AuthFailLimit:                100,
		ScrubInterval:                168 * time.Hour,
		LifecycleInterval:            15 * time.Minute,
		LifecycleBatch:               250,
		PipelineWorkers:              32,
		PipelineBeforeTotalTimeout:   10 * time.Minute,
		PipelineMaxDepth:             2,
		PipelineAllowPrivate:         false,
		PipelineCAFile:               "/etc/ssl/pipeline-ca.pem",
		PipelineRunRetention:         72 * time.Hour,
		MetricsPerBucket:             false,
		LogFormat:                    "json",
		LogLevel:                     "debug",
		NodeName:                     "node-a_1",
		ClusterURLs:                  []string{"https://10.0.0.1:9100", "https://node-b.internal:9100"},
		ClusterKey:                   [][]byte{[]byte(testClusterKey), []byte(testClusterKey2)},
		ClusterListen:                "10.0.0.1:9200",
		ClusterTLSCertFile:           "/etc/binvault/peer.crt",
		ClusterTLSKeyFile:            "/etc/binvault/peer.key",
		ClusterCAFile:                "/etc/binvault/peer-ca.pem",
		ClusterInsecureHTTP:          true,
		ClusterPullInterval:          time.Second,
		ClusterMaxClockSkew:          30 * time.Second,
		ClusterStartupFence:          time.Minute,
		ClusterRetention:             168 * time.Hour,
		ClusterForwardConnectTimeout: 500 * time.Millisecond,
		MoveStreams:                  16,
		MoveFreezeTimeout:            5 * time.Minute,
	})
	if !c.ClusterEnabled() || c.AdminListenIsLoopback() || !c.TLSEnabled() || c.SlogLevel() != slog.LevelDebug {
		t.Error("helpers disagree with the parsed values")
	}

	// Applied lists every variable once, in table order, secrets redacted.
	applied := c.Applied()
	var names []string
	for _, a := range applied {
		name, _, _ := strings.Cut(a, "=")
		names = append(names, name)
	}
	if !slices.Equal(names, specNames) {
		t.Errorf("Applied() names = %v\nwant %v", names, specNames)
	}
	for _, want := range []string{
		"BINVAULT_ADMIN_TOKEN=***", "BINVAULT_MASTER_KEY=***", "BINVAULT_MASTER_KEY_OLD=***", "BINVAULT_CLUSTER_KEY=***",
		"BINVAULT_LISTEN=0.0.0.0:8000", "BINVAULT_LOG_LEVEL=Debug", "BINVAULT_GC_GRACE=2h30m",
	} {
		if !slices.Contains(applied, want) {
			t.Errorf("Applied() lacks %q: %q", want, applied)
		}
	}
	assertNoSecrets(t, "Applied()", strings.Join(applied, "\n"))
}

// secretForms are the ways a fixture secret could show up in text.
func secretForms() []string {
	forms := []string{"SECRET"}
	for _, k := range [][]byte{testKey, testKey2, testKey3} {
		forms = append(forms,
			base64.StdEncoding.EncodeToString(k), base64.RawURLEncoding.EncodeToString(k),
			hex.EncodeToString(k), strings.Trim(fmt.Sprint(k), "[]"))
	}
	return forms
}

func assertNoSecrets(t *testing.T, what, text string) {
	t.Helper()
	for _, s := range secretForms() {
		if strings.Contains(text, s) {
			t.Errorf("%s contains secret %q:\n%s", what, s, text)
		}
	}
}

func TestStringAndJSONRedactSecrets(t *testing.T) {
	c, _ := mustLoad(t, everyVariable())
	for _, format := range []string{"%v", "%+v", "%s", "%#v"} {
		for _, arg := range []any{c, *c} {
			out := fmt.Sprintf(format, arg)
			assertNoSecrets(t, fmt.Sprintf("Sprintf(%q, %T)", format, arg), out)
			for _, want := range []string{"AdminToken:***", "MasterKeyOld:***", "ClusterKey:***", `Listen:"0.0.0.0:8000"`, "GCGrace:2h30m0s"} {
				if !strings.Contains(out, want) {
					t.Errorf("Sprintf(%q, %T) lacks %q:\n%s", format, arg, want, out)
				}
			}
		}
	}
	if out := fmt.Sprint(Defaults()); !strings.Contains(out, "AdminToken: ") || strings.Contains(out, redacted) {
		t.Errorf("unset secrets should print empty: %s", out)
	}
	js, err := json.Marshal(c)
	if err != nil {
		t.Fatal(err)
	}
	assertNoSecrets(t, "json.Marshal", string(js))
	if !strings.Contains(string(js), `"Region":"eu-central-1"`) {
		t.Errorf("json.Marshal lost non-secret fields: %s", js)
	}
	var buf bytes.Buffer
	slog.New(slog.NewTextHandler(&buf, nil)).Info("boot", "config", c)
	slog.New(slog.NewJSONHandler(&buf, nil)).Info("boot", "config", c)
	assertNoSecrets(t, "slog", buf.String())
}

func TestForTest(t *testing.T) {
	c := ForTest(func(c *Config) { c.DataDir = "/tmp/binvault-test" })
	if len(c.AdminToken) != 1 || len(c.AdminToken[0]) < minAdminToken {
		t.Errorf("AdminToken = %q, want one token of at least %d characters", c.AdminToken, minAdminToken)
	}
	if len(c.MasterKey) != masterKeyLen {
		t.Errorf("MasterKey has %d bytes, want %d", len(c.MasterKey), masterKeyLen)
	}
	if c.DataDir != "/tmp/binvault-test" || c.Listen != ":9000" {
		t.Errorf("mod not applied over Defaults: DataDir %q, Listen %q", c.DataDir, c.Listen)
	}
	if other := ForTest(nil); bytes.Equal(other.MasterKey, c.MasterKey) || other.AdminToken[0] == c.AdminToken[0] {
		t.Error("two ForTest configurations share their secrets")
	}
	if len(c.Applied()) != 0 {
		t.Errorf("ForTest().Applied() = %q, want none", c.Applied())
	}
	if d := Defaults(); d.AdminToken != nil || d.MasterKey != nil {
		t.Error("Defaults() must not carry secrets")
	}
	// The generated secrets pass Load's own rules.
	e := env{
		"BINVAULT_ADMIN_TOKEN": c.AdminToken[0],
		"BINVAULT_MASTER_KEY":  base64.StdEncoding.EncodeToString(c.MasterKey),
	}
	if _, _, err := testLoad(e); err != nil {
		t.Errorf("ForTest secrets rejected by Load: %v", err)
	}
}

func TestListenIsLoopback(t *testing.T) {
	cases := map[string]bool{
		"127.0.0.1:9001":          true,
		"127.8.9.10:1":            true,
		"[::1]:9001":              true,
		"[::ffff:127.0.0.1]:9001": true,
		"localhost:9001":          true,
		"LocalHost:9001":          true,
		":9001":                   false,
		"0.0.0.0:9001":            false,
		"[::]:9001":               false,
		"10.0.0.1:9001":           false,
		"example.com:9001":        false,
		"localhost.:9001":         false,
		"garbage":                 false,
	}
	for addr, want := range cases {
		c := &Config{AdminListen: addr, ClusterListen: addr}
		if got := c.AdminListenIsLoopback(); got != want {
			t.Errorf("AdminListenIsLoopback(%q) = %v, want %v", addr, got, want)
		}
		if got := c.ClusterListenIsLoopback(); got != want {
			t.Errorf("ClusterListenIsLoopback(%q) = %v, want %v", addr, got, want)
		}
	}
}

func TestIsTrustedProxy(t *testing.T) {
	c, _ := mustLoad(t, minimalEnv("BINVAULT_TRUSTED_PROXIES", "10.0.0.0/8, 2001:db8::/32, fe80::/10, 192.0.2.7"))
	cases := map[string]bool{
		"10.1.2.3":         true,
		"::ffff:10.1.2.3":  true,
		"11.0.0.1":         false,
		"192.0.2.7":        true,
		"192.0.2.8":        false,
		"2001:db8::5":      true,
		"2001:db9::5":      false,
		"fe80::1%eth0":     true,
		"::ffff:192.0.2.7": true,
	}
	for s, want := range cases {
		if got := c.IsTrustedProxy(netip.MustParseAddr(s)); got != want {
			t.Errorf("IsTrustedProxy(%s) = %v, want %v", s, got, want)
		}
	}
	if c.IsTrustedProxy(netip.Addr{}) {
		t.Error("the zero address must never be trusted")
	}
	if (&Config{}).IsTrustedProxy(netip.MustParseAddr("10.0.0.1")) {
		t.Error("no proxies configured: nothing is trusted")
	}
}

func TestSmallHelpers(t *testing.T) {
	levels := map[string]slog.Level{"debug": slog.LevelDebug, "info": slog.LevelInfo, "warn": slog.LevelWarn, "error": slog.LevelError, "": slog.LevelInfo}
	for in, want := range levels {
		if got := (&Config{LogLevel: in}).SlogLevel(); got != want {
			t.Errorf("SlogLevel(%q) = %v, want %v", in, got, want)
		}
	}
	c := &Config{MaxObjectMB: maxObjectMB, MinFreeMB: 1}
	if c.MaxObjectBytes() != 5<<40 || c.MinFreeBytes() != 1<<20 {
		t.Errorf("MaxObjectBytes %d, MinFreeBytes %d", c.MaxObjectBytes(), c.MinFreeBytes())
	}
	if (&Config{TLSCertFile: "/c"}).TLSEnabled() || !(&Config{TLSCertFile: "/c", TLSKeyFile: "/k"}).TLSEnabled() {
		t.Error("TLSEnabled needs both files")
	}
	if (&Config{AdminTLSKeyFile: "/k"}).AdminTLSEnabled() || (&Config{ClusterTLSCertFile: "/c"}).ClusterTLSEnabled() {
		t.Error("AdminTLSEnabled and ClusterTLSEnabled need both files")
	}
	if (&Config{}).ClusterEnabled() || !(&Config{ClusterURLs: []string{"https://a"}}).ClusterEnabled() {
		t.Error("ClusterEnabled follows ClusterURLs")
	}
}

func TestErrorRendering(t *testing.T) {
	one := &Error{Problems: []Problem{{Var: "BINVAULT_LISTEN", Msg: "is bad"}}}
	if got := one.Error(); got != "BINVAULT_LISTEN: is bad" {
		t.Errorf("one problem: %q", got)
	}
	two := &Error{Problems: []Problem{{Var: "BINVAULT_A", Msg: "x"}, {Var: "BINVAULT_B", Msg: "y"}}}
	if got := two.Error(); got != "2 configuration problems:\n  BINVAULT_A: x\n  BINVAULT_B: y" {
		t.Errorf("two problems: %q", got)
	}
}
