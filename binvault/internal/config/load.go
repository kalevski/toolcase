package config

import (
	"fmt"
	"math"
	"net"
	"net/netip"
	"os"
	"path/filepath"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"
)

const (
	// maxObjectMB is the hard ceiling of BINVAULT_MAX_OBJECT_MB: 5 TiB (§3.8).
	maxObjectMB = 5 << 20
	// maxMiB keeps a MiB count convertible to bytes in an int64.
	maxMiB = math.MaxInt64 >> 20
	// positive, as the minimum of a duration, means "greater than zero".
	positive = time.Nanosecond
	// maxNodes is the supported cluster size (§3.8).
	maxNodes = 16
)

// nodeNameRe is the shape of BINVAULT_NODE_NAME (§2.3).
var nodeNameRe = regexp.MustCompile(`^[a-z0-9][a-z0-9_-]{0,62}$`)

// Load builds the configuration from the environment. env looks a variable up
// the way os.LookupEnv does, which is what production passes (nil means
// os.LookupEnv); tests inject a fake.
//
// It returns the configuration, the warnings, and an error. Warnings are
// non-fatal findings for the boot log — cluster settings on a single node, a
// plain-HTTP peer link — and come back even when the error is not nil. The
// error is a *Error holding every problem found, not just the first, each
// prefixed with the variable's name; the configuration is nil then. No
// warning or error ever contains a secret value.
//
// A lookup function cannot enumerate the environment, so Load cannot warn
// about unknown (for example misspelt) BINVAULT_* variables: use
// LoadFromEnviron for that.
//
// Values are trimmed of surrounding whitespace, as are the entries of
// comma-separated lists. A variable set to an empty value is a problem, not
// a request for its default: unset it instead. So is an empty list entry,
// which usually means a stray comma or an unexpanded variable.
func Load(env func(key string) (string, bool)) (*Config, []string, error) {
	return load(env, nil, os.Hostname)
}

// LoadFromEnviron is Load over an environment in os.Environ form: "KEY=value"
// entries, where the first entry of a repeated key wins, as for os.Getenv.
// Because it sees every key it can also warn about unknown BINVAULT_*
// variables (the prefix compared without regard to case), suggesting the
// closest known name when one is within three edits. It is the entry point
// for the binary: LoadFromEnviron(os.Environ()).
func LoadFromEnviron(environ []string) (*Config, []string, error) {
	vars := make(map[string]string, len(environ))
	keys := make([]string, 0, len(environ))
	for _, kv := range environ {
		k, v, ok := strings.Cut(kv, "=")
		if !ok || k == "" {
			continue // malformed, or a Windows "=C:" drive entry
		}
		if _, dup := vars[k]; dup {
			continue
		}
		vars[k] = v
		keys = append(keys, k)
	}
	lookup := func(k string) (string, bool) {
		v, ok := vars[k]
		return v, ok
	}
	return load(lookup, keys, os.Hostname)
}

// load is Load with the environment's keys (nil: unknown, so unknown
// variables cannot be detected) and the host-name source made explicit.
func load(env func(string) (string, bool), keys []string, hostname func() (string, error)) (*Config, []string, error) {
	if env == nil {
		env = os.LookupEnv
	}
	l := &loader{
		env:      env,
		hostname: hostname,
		c:        defaults(),
		applied:  map[string]string{},
		bad:      map[string]bool{},
	}
	l.warnUnknown(keys)
	l.parse()
	cluster := l.parseCluster()
	publicTLS := l.checkListeners()
	l.defaultEndpointURL(publicTLS)
	if cluster {
		l.checkCluster()
	}
	if len(l.problems) > 0 {
		return nil, l.warnings, &Error{Problems: l.problems}
	}
	for _, n := range allNames {
		if v, ok := l.applied[n]; ok {
			l.c.applied = append(l.c.applied, n+"="+v)
		}
	}
	return l.c, l.warnings, nil
}

// loader accumulates one Load: the configuration being filled in, every
// problem and warning, and what was applied.
type loader struct {
	env      func(string) (string, bool)
	hostname func() (string, error)
	c        *Config
	problems []Problem
	warnings []string
	applied  map[string]string // variable → value as Applied shows it
	bad      map[string]bool   // variables that already have a problem
}

// fail records a problem with a variable.
func (l *loader) fail(name, format string, args ...any) {
	l.problems = append(l.problems, Problem{Var: name, Msg: fmt.Sprintf(format, args...)})
	l.bad[name] = true
}

// warn records a warning about a variable, as "NAME: message".
func (l *loader) warn(name, format string, args ...any) {
	l.warnings = append(l.warnings, name+": "+fmt.Sprintf(format, args...))
}

// get returns a non-secret variable's value, trimmed, and whether it is set
// to something. Set but empty is a problem, reported here.
func (l *loader) get(name string) (string, bool) {
	raw, ok := l.env(name)
	if !ok {
		return "", false
	}
	v := strings.TrimSpace(raw)
	if v == "" {
		l.fail(name, "is set but empty (unset it to use the default)")
		return "", false
	}
	l.applied[name] = v
	return v, true
}

// entry is one element of a comma-separated list.
type entry struct {
	n int    // 1-based position in the list
	v string // trimmed value
}

// entries splits a non-secret comma-separated list into trimmed entries,
// reporting empty ones.
func (l *loader) entries(name, v string) []entry {
	parts := strings.Split(v, ",")
	out := make([]entry, 0, len(parts))
	for i, p := range parts {
		if p = strings.TrimSpace(p); p == "" {
			l.fail(name, "entry %d is empty (stray comma?)", i+1)
			continue
		}
		out = append(out, entry{n: i + 1, v: p})
	}
	return out
}

// path reads a file path. Whether the file exists is checked at start-up,
// where it is opened, not here.
func (l *loader) path(name string, dst *string) {
	if v, ok := l.get(name); ok {
		*dst = v
	}
}

// listen reads a bind address (see checkListen).
func (l *loader) listen(name string, dst *string) {
	v, ok := l.get(name)
	if !ok {
		return
	}
	if problem := checkListen(v); problem != "" {
		l.fail(name, "%q %s", v, problem)
		return
	}
	*dst = v
}

// boolean reads a boolean (see parseBool).
func (l *loader) boolean(name string, dst *bool) {
	v, ok := l.get(name)
	if !ok {
		return
	}
	b, valid := parseBool(v)
	if !valid {
		l.fail(name, "%q is not a boolean: use true or false", v)
		return
	}
	*dst = b
}

// count reads a whole number of at least 1.
func (l *loader) count(name string, dst *int) {
	v, ok := l.get(name)
	if !ok {
		return
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 1 {
		l.fail(name, "%q must be a whole number of at least 1", v)
		return
	}
	*dst = n
}

// mebibytes reads a size in MiB, from min to max.
func (l *loader) mebibytes(name string, dst *int64, min, max int64, unit string) {
	v, ok := l.get(name)
	if !ok {
		return
	}
	n, err := strconv.ParseInt(v, 10, 64)
	if err != nil || n < min || n > max {
		l.fail(name, "%q must be a whole number of MiB from %d to %d%s", v, min, max, unit)
		return
	}
	*dst = n
}

// duration reads a Go duration from min to max (max 0: unbounded).
func (l *loader) duration(name string, dst *time.Duration, min, max time.Duration) {
	v, ok := l.get(name)
	if !ok {
		return
	}
	d, err := time.ParseDuration(v)
	if err != nil {
		l.fail(name, "%s", durationProblem(v))
		return
	}
	if d < min || (max > 0 && d > max) {
		l.fail(name, "%q %s", v, durationRange(min, max))
		return
	}
	*dst = d
}

// choice reads one of a fixed set of lower-case words, in any case.
func (l *loader) choice(name string, dst *string, allowed ...string) {
	v, ok := l.get(name)
	if !ok {
		return
	}
	if lv := strings.ToLower(v); slices.Contains(allowed, lv) {
		*dst = lv
		return
	}
	l.fail(name, "%q must be one of %s", v, strings.Join(allowed, ", "))
}

// parse reads every variable that applies to a single node, in table order.
func (l *loader) parse() {
	c := l.c
	l.adminToken()
	l.masterKeys()
	l.listen(envListen, &c.Listen)
	l.listen(envAdminListen, &c.AdminListen)
	l.path(envAdminTLSCertFile, &c.AdminTLSCertFile)
	l.path(envAdminTLSKeyFile, &c.AdminTLSKeyFile)
	l.boolean(envAdminInsecureHTTP, &c.AdminInsecureHTTP)
	l.endpointURL()
	l.domain()
	l.region()
	l.path(envTLSCertFile, &c.TLSCertFile)
	l.path(envTLSKeyFile, &c.TLSKeyFile)
	l.trustedProxies()
	l.dataDir()
	l.boolean(envFsync, &c.Fsync)
	l.mebibytes(envMinFreeMB, &c.MinFreeMB, 0, maxMiB, "")
	l.mebibytes(envMaxObjectMB, &c.MaxObjectMB, 1, maxObjectMB, " (5 TiB)")
	l.duration(envGCGrace, &c.GCGrace, positive, 0)
	l.duration(envMultipartTTL, &c.MultipartTTL, time.Minute, 0)
	l.duration(envClockSkew, &c.ClockSkew, positive, 0)
	l.duration(envHeaderTimeout, &c.HeaderTimeout, positive, 0)
	l.duration(envBodyIdleTimeout, &c.BodyIdleTimeout, positive, 0)
	l.duration(envShutdownTimeout, &c.ShutdownTimeout, positive, 0)
	l.count(envAuthFailLimit, &c.AuthFailLimit)
	l.duration(envScrubInterval, &c.ScrubInterval, 0, 0)
	l.duration(envLifecycleInterval, &c.LifecycleInterval, positive, 0)
	l.count(envLifecycleBatch, &c.LifecycleBatch)
	l.count(envPipelineWorkers, &c.PipelineWorkers)
	l.duration(envPipelineBeforeTotalTimeout, &c.PipelineBeforeTotalTimeout, time.Second, 10*time.Minute)
	l.count(envPipelineMaxDepth, &c.PipelineMaxDepth)
	l.boolean(envPipelineAllowPrivate, &c.PipelineAllowPrivate)
	l.path(envPipelineCAFile, &c.PipelineCAFile)
	l.duration(envPipelineRunRetention, &c.PipelineRunRetention, positive, 0)
	l.boolean(envMetricsPerBucket, &c.MetricsPerBucket)
	l.choice(envLogFormat, &c.LogFormat, "logfmt", "json")
	l.choice(envLogLevel, &c.LogLevel, "debug", "info", "warn", "error")
}

// endpointURL reads an explicit BINVAULT_ENDPOINT_URL; defaultEndpointURL
// fills it in otherwise.
func (l *loader) endpointURL() {
	v, ok := l.get(envEndpointURL)
	if !ok {
		return
	}
	norm, _, problem := parseBaseURL(v)
	if problem != "" {
		l.fail(envEndpointURL, "%q %s (it is the URL at which pipeline services reach this node: scheme://host[:port])",
			displayURL(v), problem)
		return
	}
	l.c.EndpointURL = norm
}

// domain reads BINVAULT_DOMAIN (see checkDomain).
func (l *loader) domain() {
	v, ok := l.get(envDomain)
	if !ok {
		return
	}
	d, problem := checkDomain(v)
	if problem != "" {
		l.fail(envDomain, "%q %s", v, problem)
		return
	}
	l.c.Domain = d
}

// region reads BINVAULT_REGION (see checkRegion).
func (l *loader) region() {
	v, ok := l.get(envRegion)
	if !ok {
		return
	}
	if problem := checkRegion(v); problem != "" {
		l.fail(envRegion, "%q %s", v, problem)
		return
	}
	l.c.Region = v
}

// trustedProxies reads BINVAULT_TRUSTED_PROXIES (see parseProxy).
func (l *loader) trustedProxies() {
	v, ok := l.get(envTrustedProxies)
	if !ok {
		return
	}
	var out []netip.Prefix
	for _, e := range l.entries(envTrustedProxies, v) {
		p, ok := parseProxy(e.v)
		if !ok {
			l.fail(envTrustedProxies, "entry %d %q is not an IP address or CIDR (such as 10.0.0.0/8 or 192.0.2.7)", e.n, e.v)
			continue
		}
		out = append(out, p)
	}
	l.c.TrustedProxies = out
}

// dataDir reads BINVAULT_DATA_DIR, which must be absolute so that the server
// and `binvault validate` see the same directory whatever their working
// directory.
func (l *loader) dataDir() {
	v, ok := l.get(envDataDir)
	if !ok {
		return
	}
	if !filepath.IsAbs(v) {
		l.fail(envDataDir, "%q must be an absolute path", v)
		return
	}
	l.c.DataDir = filepath.Clean(v)
}

// parseCluster reads the cluster variables (§8.3), in table order, when
// BINVAULT_CLUSTER_URLS is set, and reports whether it is. On a single node
// it only warns about the cluster variables that are set: they are not
// parsed, so a leftover cluster setting can never fail a boot.
func (l *loader) parseCluster() bool {
	if raw, ok := l.env(envClusterURLs); !ok || strings.TrimSpace(raw) == "" {
		if ok {
			l.get(envClusterURLs) // reports "set but empty"
		}
		l.warnClusterVars()
		return false
	}
	c := l.c
	l.nodeName()
	l.clusterURLs()
	l.clusterKey()
	l.listen(envClusterListen, &c.ClusterListen)
	l.path(envClusterTLSCertFile, &c.ClusterTLSCertFile)
	l.path(envClusterTLSKeyFile, &c.ClusterTLSKeyFile)
	l.path(envClusterCAFile, &c.ClusterCAFile)
	l.boolean(envClusterInsecureHTTP, &c.ClusterInsecureHTTP)
	l.duration(envClusterPullInterval, &c.ClusterPullInterval, positive, 0)
	l.duration(envClusterMaxClockSkew, &c.ClusterMaxClockSkew, positive, 0)
	l.duration(envClusterStartupFence, &c.ClusterStartupFence, positive, 0)
	l.duration(envClusterRetention, &c.ClusterRetention, positive, 0)
	l.duration(envClusterForwardConnectTimeout, &c.ClusterForwardConnectTimeout, positive, 0)
	l.count(envMoveStreams, &c.MoveStreams)
	l.duration(envMoveFreezeTimeout, &c.MoveFreezeTimeout, positive, 0)
	return true
}

// nodeName reads BINVAULT_NODE_NAME, required in a cluster.
func (l *loader) nodeName() {
	v, ok := l.get(envNodeName)
	if !ok {
		if !l.bad[envNodeName] {
			l.fail(envNodeName, "is required when %s is set: a unique name for this node "+
				"(a container's default hostname changes on every re-create)", envClusterURLs)
		}
		return
	}
	if !nodeNameRe.MatchString(v) {
		l.fail(envNodeName, "%q must be 1 to 63 characters of a-z, 0-9, _ and -, starting with a letter or digit", v)
		return
	}
	l.c.NodeName = v
}

// clusterURLs reads BINVAULT_CLUSTER_URLS: the peer URL of every node, each
// scheme://host[:port], none listed twice. Whether plain http is allowed is
// decided by checkCluster, once BINVAULT_CLUSTER_INSECURE_HTTP is known.
func (l *loader) clusterURLs() {
	v, ok := l.get(envClusterURLs)
	if !ok {
		return
	}
	seen := map[string]int{}
	var urls []string
	for _, e := range l.entries(envClusterURLs, v) {
		norm, key, problem := parseBaseURL(e.v)
		if problem != "" {
			l.fail(envClusterURLs, "entry %d %q %s (a peer URL is scheme://host[:port])", e.n, displayURL(e.v), problem)
			continue
		}
		if first, dup := seen[key]; dup {
			l.fail(envClusterURLs, "entry %d %q is listed twice (also entry %d)", e.n, norm, first)
			continue
		}
		seen[key] = e.n
		urls = append(urls, norm)
	}
	l.c.ClusterURLs = urls
}

// tlsPair checks that a certificate and a key file are set together, and
// reports whether they are consistent: both set, or neither.
func (l *loader) tlsPair(certVar, keyVar, cert, key string) bool {
	if l.bad[certVar] || l.bad[keyVar] {
		return false
	}
	switch {
	case cert != "" && key == "":
		l.fail(keyVar, "is required when %s is set (set both or neither)", certVar)
		return false
	case cert == "" && key != "":
		l.fail(certVar, "is required when %s is set (set both or neither)", keyVar)
		return false
	}
	return true
}

// checkListeners applies the rules that span the listener variables: TLS
// files come in pairs, and an admin listener off loopback needs TLS or
// BINVAULT_ADMIN_INSECURE_HTTP (§2.3, §10). It reports whether the public
// listener's TLS pair is consistent.
func (l *loader) checkListeners() bool {
	c := l.c
	adminPair := l.tlsPair(envAdminTLSCertFile, envAdminTLSKeyFile, c.AdminTLSCertFile, c.AdminTLSKeyFile)
	if adminPair && !l.bad[envAdminListen] && !l.bad[envAdminInsecureHTTP] &&
		!c.AdminTLSEnabled() && !c.AdminInsecureHTTP && !c.AdminListenIsLoopback() {
		l.fail(envAdminListen, "%q is not a loopback address, so the admin listener needs TLS (%s and %s) or %s=true "+
			"(for example in a container whose admin port is published on the host's loopback only)",
			c.AdminListen, envAdminTLSCertFile, envAdminTLSKeyFile, envAdminInsecureHTTP)
	}
	return l.tlsPair(envTLSCertFile, envTLSKeyFile, c.TLSCertFile, c.TLSKeyFile)
}

// defaultEndpointURL fills in BINVAULT_ENDPOINT_URL when it is not set:
// http://<hostname>:<port of BINVAULT_LISTEN>, or https when the public
// listener serves TLS itself. It needs a valid BINVAULT_LISTEN and TLS pair.
func (l *loader) defaultEndpointURL(publicTLS bool) {
	c := l.c
	if c.EndpointURL != "" || l.bad[envEndpointURL] || l.bad[envListen] || !publicTLS {
		return
	}
	_, port, _ := net.SplitHostPort(c.Listen)
	if port == "0" {
		l.fail(envEndpointURL, "is required when %s uses port 0: the default http://<hostname>:<port> needs a real port", envListen)
		return
	}
	host, err := l.hostname()
	if err != nil || host == "" {
		reason := "it is empty"
		if err != nil {
			reason = err.Error()
		}
		l.fail(envEndpointURL, "is not set and the hostname is unknown (%s): set it to the URL at which pipeline services reach this node", reason)
		return
	}
	scheme := defaultEndpointScheme
	if c.TLSEnabled() {
		scheme = "https"
	}
	u := endpointURL(scheme, host, port)
	norm, _, problem := parseBaseURL(u)
	if problem != "" {
		l.fail(envEndpointURL, "is not set, and the default %q built from the hostname %s; set it explicitly", u, problem)
		return
	}
	c.EndpointURL = norm
}

// checkCluster applies the cluster rules that span several variables (§8.3):
// plain-http peer URLs need BINVAULT_CLUSTER_INSECURE_HTTP, the peer listener
// has TLS unless it is on loopback (behind a TLS proxy) or insecure HTTP is
// allowed, and an insecure link or an oversized cluster is warned about.
func (l *loader) checkCluster() {
	c := l.c
	var plainURLs []string
	for _, u := range c.ClusterURLs {
		if strings.HasPrefix(u, "http://") {
			plainURLs = append(plainURLs, u)
		}
	}
	insecureKnown := !l.bad[envClusterInsecureHTTP]
	if len(plainURLs) > 0 && insecureKnown && !c.ClusterInsecureHTTP {
		l.fail(envClusterURLs, "plain-http peer URLs (%s) need %s=true (private network or VPN only); use https:// otherwise",
			strings.Join(plainURLs, ", "), envClusterInsecureHTTP)
	}
	pair := l.tlsPair(envClusterTLSCertFile, envClusterTLSKeyFile, c.ClusterTLSCertFile, c.ClusterTLSKeyFile)
	plainListener := pair && !l.bad[envClusterListen] && !c.ClusterTLSEnabled() && !c.ClusterListenIsLoopback()
	if plainListener && insecureKnown && !c.ClusterInsecureHTTP {
		l.fail(envClusterListen, "%q is not a loopback address, so the peer listener needs TLS (%s and %s); "+
			"or bind it to loopback behind a TLS proxy, or set %s=true on a private network or VPN",
			c.ClusterListen, envClusterTLSCertFile, envClusterTLSKeyFile, envClusterInsecureHTTP)
	}
	if c.ClusterInsecureHTTP && (len(plainURLs) > 0 || plainListener) {
		l.warn(envClusterInsecureHTTP, "the peer link uses plain HTTP, so everything on it travels readable: "+
			"the cluster key, forwarded object data and newly issued token secrets (private network or VPN only)")
	}
	if n := len(c.ClusterURLs); n > maxNodes {
		l.warn(envClusterURLs, "lists %d nodes; at most %d are supported (every node pulls from every other)", n, maxNodes)
	}
}
