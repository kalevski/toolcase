// Package config reads the environment-only configuration of webmail
// (spec §3.8). Every problem is collected, not just the first; secrets accept a
// NAME_FILE form; unknown WEBMAIL_* variables produce warnings with a
// did-you-mean suggestion; Applied lists what was set with secrets masked.
package config

import (
	"encoding/base64"
	"fmt"
	"io"
	"net"
	"net/netip"
	"net/url"
	"os"
	"slices"
	"strconv"
	"strings"
	"time"
	"unicode"
)

const (
	envPrefix  = "WEBMAIL_"
	fileSuffix = "_FILE"
	redacted   = "***"
	// maxSecretFile caps a _FILE secret so /dev/urandom fails instead of hanging.
	maxSecretFile = 64 << 10
	// SessionKeyLen is the decoded size of WEBMAIL_SESSION_KEY.
	SessionKeyLen = 32
)

// Config is the validated configuration.
type Config struct {
	Listen        string
	AdminListen   string
	PublicURL     string // scheme://host[:port], no trailing slash
	JMAPURL       string // no trailing slash
	PlatformURL   string // no trailing slash
	PlatformToken string
	SessionKey    []byte
	DataDir       string

	SessionIdle time.Duration
	SessionMax  time.Duration
	// RememberIdle is the idle expiry of a "remember me" session (30 days).
	RememberIdle time.Duration

	MaxUploadMB      int
	IPFailLimit      int // failed logins per IP per window
	AddressFailLimit int // failed logins per address per window
	TrustedProxies   []netip.Prefix
	BrandingTTL      time.Duration
	UpstreamTimeout  time.Duration

	LogFormat string
	LogLevel  string

	applied []string
}

// Secure reports whether the public URL is https (cookies, HSTS).
func (c *Config) Secure() bool { return strings.HasPrefix(c.PublicURL, "https://") }

// MaxUploadBytes is the upload cap in bytes.
func (c *Config) MaxUploadBytes() int64 { return int64(c.MaxUploadMB) << 20 }

// Applied lists "NAME=value" for every variable that was set, in table order,
// secrets masked.
func (c *Config) Applied() []string { return slices.Clone(c.applied) }

// Problem is one invalid setting.
type Problem struct {
	Var string
	Msg string
}

func (p Problem) String() string { return p.Var + ": " + p.Msg }

// Error holds every problem found.
type Error struct{ Problems []Problem }

func (e *Error) Error() string {
	switch len(e.Problems) {
	case 0:
		return "invalid configuration"
	case 1:
		return e.Problems[0].String()
	}
	var b strings.Builder
	fmt.Fprintf(&b, "%d configuration problems:", len(e.Problems))
	for _, p := range e.Problems {
		b.WriteString("\n  " + p.String())
	}
	return b.String()
}

// Variable names, in documentation order.
const (
	VarListen        = "WEBMAIL_LISTEN"
	VarAdminListen   = "WEBMAIL_ADMIN_LISTEN"
	VarPublicURL     = "WEBMAIL_PUBLIC_URL"
	VarJMAPURL       = "WEBMAIL_JMAP_URL"
	VarPlatformURL   = "WEBMAIL_PLATFORM_URL"
	VarPlatformToken = "WEBMAIL_PLATFORM_TOKEN"
	VarSessionKey    = "WEBMAIL_SESSION_KEY"
	VarDataDir       = "WEBMAIL_DATA_DIR"
	VarSessionIdle   = "WEBMAIL_SESSION_IDLE"
	VarSessionMax    = "WEBMAIL_SESSION_MAX"
	VarMaxUploadMB   = "WEBMAIL_MAX_UPLOAD_MB"
	VarLoginFail     = "WEBMAIL_LOGIN_FAIL_LIMIT"
	VarAddrFail      = "WEBMAIL_ADDRESS_FAIL_LIMIT"
	VarProxies       = "WEBMAIL_TRUSTED_PROXIES"
	VarBrandingTTL   = "WEBMAIL_BRANDING_TTL"
	VarUpstreamTO    = "WEBMAIL_UPSTREAM_TIMEOUT"
	VarLogFormat     = "WEBMAIL_LOG_FORMAT"
	VarLogLevel      = "WEBMAIL_LOG_LEVEL"
)

var allNames = []string{VarListen, VarAdminListen, VarPublicURL, VarJMAPURL, VarPlatformURL, VarPlatformToken,
	VarSessionKey, VarDataDir, VarSessionIdle, VarSessionMax, VarMaxUploadMB, VarLoginFail, VarAddrFail,
	VarProxies, VarBrandingTTL, VarUpstreamTO, VarLogFormat, VarLogLevel}

var secretNames = []string{VarPlatformToken, VarSessionKey}

// Load builds the configuration. env looks a variable up like os.LookupEnv
// (nil means os.LookupEnv). Unknown variables cannot be detected: use
// LoadFromEnviron for that.
func Load(env func(string) (string, bool)) (*Config, []string, error) { return load(env, nil) }

// LoadFromEnviron is Load over os.Environ()-style entries and also warns about
// unknown WEBMAIL_* variables.
func LoadFromEnviron(environ []string) (*Config, []string, error) {
	vars := make(map[string]string, len(environ))
	keys := make([]string, 0, len(environ))
	for _, kv := range environ {
		k, v, ok := strings.Cut(kv, "=")
		if !ok || k == "" {
			continue
		}
		if _, dup := vars[k]; dup {
			continue
		}
		vars[k] = v
		keys = append(keys, k)
	}
	return load(func(k string) (string, bool) { v, ok := vars[k]; return v, ok }, keys)
}

type loader struct {
	env      func(string) (string, bool)
	c        *Config
	problems []Problem
	warnings []string
	applied  map[string]string
}

func load(env func(string) (string, bool), keys []string) (*Config, []string, error) {
	if env == nil {
		env = os.LookupEnv
	}
	l := &loader{env: env, applied: map[string]string{}, c: &Config{
		Listen: ":8080", AdminListen: "127.0.0.1:8081", DataDir: "/var/lib/webmail",
		SessionIdle: 12 * time.Hour, SessionMax: 720 * time.Hour, RememberIdle: 720 * time.Hour,
		MaxUploadMB: 25, IPFailLimit: 20, AddressFailLimit: 10,
		BrandingTTL: 60 * time.Second, UpstreamTimeout: 30 * time.Second,
		LogFormat: "logfmt", LogLevel: "info",
	}}
	l.warnUnknown(keys)
	l.parse()
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

func (l *loader) fail(name, format string, args ...any) {
	l.problems = append(l.problems, Problem{Var: name, Msg: fmt.Sprintf(format, args...)})
}

func (l *loader) warn(name, format string, args ...any) {
	l.warnings = append(l.warnings, name+": "+fmt.Sprintf(format, args...))
}

// get returns a non-secret variable's trimmed value; set-but-empty is a problem.
func (l *loader) get(name string) (string, bool) {
	raw, ok := l.env(name)
	if !ok {
		return "", false
	}
	v := strings.TrimSpace(raw)
	if v == "" {
		l.fail(name, "is set but empty; unset it to use the default")
		return "", false
	}
	l.applied[name] = v
	return v, true
}

func (l *loader) warnUnknown(keys []string) {
	if keys == nil {
		return
	}
	known := map[string]bool{}
	for _, n := range allNames {
		known[n] = true
	}
	for _, n := range secretNames {
		known[n+fileSuffix] = true
	}
	var unknown []string
	for _, k := range keys {
		if strings.HasPrefix(strings.ToUpper(k), envPrefix) && !known[k] && !slices.Contains(unknown, k) {
			unknown = append(unknown, k)
		}
	}
	slices.Sort(unknown)
	for _, k := range unknown {
		msg := "unknown variable, ignored"
		best, bd := "", 4
		for n := range known {
			if d := levenshtein(strings.ToUpper(k), n); d < bd || (d == bd && best != "" && n < best) {
				best, bd = n, d
			}
		}
		if best != "" && bd <= 3 {
			msg += " (did you mean " + best + "?)"
		} else if strings.HasSuffix(strings.ToUpper(k), fileSuffix) {
			msg += " (only " + strings.Join(secretNames, " and ") + " accept a _FILE form)"
		}
		l.warn(k, "%s", msg)
	}
}

func levenshtein(a, b string) int {
	ra, rb := []rune(a), []rune(b)
	prev := make([]int, len(rb)+1)
	for j := range prev {
		prev[j] = j
	}
	for i := 1; i <= len(ra); i++ {
		cur := make([]int, len(rb)+1)
		cur[0] = i
		for j := 1; j <= len(rb); j++ {
			cost := 1
			if ra[i-1] == rb[j-1] {
				cost = 0
			}
			cur[j] = min(prev[j]+1, cur[j-1]+1, prev[j-1]+cost)
		}
		prev = cur
	}
	return prev[len(rb)]
}

// secret reads NAME or NAME_FILE.
func (l *loader) secret(name string) (string, bool) {
	fileVar := name + fileSuffix
	raw, inEnv := l.env(name)
	path, inFile := l.env(fileVar)
	switch {
	case inEnv && inFile:
		l.fail(name, "is set together with %s: set only one of them", fileVar)
	case inEnv:
		if strings.TrimSpace(raw) == "" {
			l.fail(name, "is set but empty")
			return "", false
		}
		l.applied[name] = redacted
		return strings.TrimSpace(raw), true
	case inFile:
		path = strings.TrimSpace(path)
		if path == "" {
			l.fail(fileVar, "is set but empty")
			return "", false
		}
		l.applied[fileVar] = path
		s, err := readSecretFile(path)
		if err != nil {
			l.fail(fileVar, "%v", err)
			return "", false
		}
		return s, true
	}
	return "", false
}

func readSecretFile(path string) (string, error) {
	f, err := os.Open(path)
	if err != nil {
		return "", fmt.Errorf("cannot read the secret file: %v", err)
	}
	defer f.Close()
	data, err := io.ReadAll(io.LimitReader(f, maxSecretFile+1))
	if err != nil {
		return "", fmt.Errorf("cannot read the secret file: %v", err)
	}
	if len(data) > maxSecretFile {
		return "", fmt.Errorf("the secret file %s is larger than 64 KiB; is it the right file?", path)
	}
	s := strings.TrimRightFunc(string(data), unicode.IsSpace)
	if s == "" {
		return "", fmt.Errorf("the secret file %s is empty", path)
	}
	return s, nil
}

func (l *loader) required(name string) (string, bool) {
	v, ok := l.get(name)
	if !ok {
		if _, set := l.env(name); !set {
			l.fail(name, "is required")
		}
	}
	return v, ok
}

func (l *loader) parse() {
	c := l.c
	if v, ok := l.get(VarListen); ok {
		if p := checkListen(v); p != "" {
			l.fail(VarListen, "%s", p)
		} else {
			c.Listen = v
		}
	}
	if v, ok := l.get(VarAdminListen); ok {
		if p := checkListen(v); p != "" {
			l.fail(VarAdminListen, "%s", p)
		} else {
			c.AdminListen = v
		}
	}
	if v, ok := l.required(VarPublicURL); ok {
		if n, p := baseURL(v, true); p != "" {
			l.fail(VarPublicURL, "%s", p)
		} else {
			c.PublicURL = n
		}
	}
	if v, ok := l.required(VarJMAPURL); ok {
		if n, p := baseURL(v, false); p != "" {
			l.fail(VarJMAPURL, "%s", p)
		} else {
			c.JMAPURL = n
		}
	}
	if v, ok := l.required(VarPlatformURL); ok {
		if n, p := baseURL(v, false); p != "" {
			l.fail(VarPlatformURL, "%s", p)
		} else {
			c.PlatformURL = n
		}
	}
	if v, ok := l.secret(VarPlatformToken); ok {
		if strings.ContainsFunc(v, unicode.IsControl) || strings.ContainsAny(v, " \t") {
			l.fail(VarPlatformToken, "must not contain spaces or control characters")
		}
		c.PlatformToken = v
	} else if !l.hasProblem(VarPlatformToken) {
		l.fail(VarPlatformToken, "is required (or %s%s)", VarPlatformToken, fileSuffix)
	}
	if v, ok := l.secret(VarSessionKey); ok {
		key, err := base64.StdEncoding.DecodeString(v)
		if err != nil {
			key, err = base64.RawStdEncoding.DecodeString(v)
		}
		switch {
		case err != nil:
			l.fail(VarSessionKey, "is not valid base64 (generate one with: openssl rand -base64 32)")
		case len(key) != SessionKeyLen:
			l.fail(VarSessionKey, "decodes to %d bytes, want %d (generate one with: openssl rand -base64 32)", len(key), SessionKeyLen)
		default:
			c.SessionKey = key
		}
	} else if !l.hasProblem(VarSessionKey) {
		l.fail(VarSessionKey, "is required (or %s%s)", VarSessionKey, fileSuffix)
	}
	if v, ok := l.get(VarDataDir); ok {
		if !strings.HasPrefix(v, "/") && !strings.HasPrefix(v, ".") && !strings.Contains(v, string(os.PathSeparator)) {
			l.fail(VarDataDir, "should be a path (use ./%s for a relative one)", v)
		}
		c.DataDir = v
	}
	l.duration(VarSessionIdle, &c.SessionIdle, time.Minute, 24*time.Hour*365)
	l.duration(VarSessionMax, &c.SessionMax, time.Minute, 24*time.Hour*365)
	l.duration(VarBrandingTTL, &c.BrandingTTL, time.Second, 24*time.Hour)
	l.duration(VarUpstreamTO, &c.UpstreamTimeout, time.Second, 10*time.Minute)
	if c.SessionIdle > c.SessionMax && !l.hasProblem(VarSessionIdle) && !l.hasProblem(VarSessionMax) {
		l.fail(VarSessionIdle, "must not exceed %s (%s)", VarSessionMax, c.SessionMax)
	}
	if c.RememberIdle > c.SessionMax {
		c.RememberIdle = c.SessionMax
	}
	l.integer(VarMaxUploadMB, &c.MaxUploadMB, 1, 2048)
	l.integer(VarLoginFail, &c.IPFailLimit, 1, 100000)
	l.integer(VarAddrFail, &c.AddressFailLimit, 1, 100000)
	if v, ok := l.get(VarProxies); ok {
		for i, part := range strings.Split(v, ",") {
			part = strings.TrimSpace(part)
			if part == "" {
				l.fail(VarProxies, "entry %d is empty (stray comma?)", i+1)
				continue
			}
			p, err := netip.ParsePrefix(part)
			if err != nil {
				a, aerr := netip.ParseAddr(part)
				if aerr != nil {
					l.fail(VarProxies, "entry %d is not a CIDR or an IP address", i+1)
					continue
				}
				p = netip.PrefixFrom(a, a.BitLen())
			}
			c.TrustedProxies = append(c.TrustedProxies, p.Masked())
		}
	}
	if v, ok := l.get(VarLogFormat); ok {
		switch strings.ToLower(v) {
		case "logfmt", "json":
			c.LogFormat = strings.ToLower(v)
		default:
			l.fail(VarLogFormat, "must be logfmt or json")
		}
	}
	if v, ok := l.get(VarLogLevel); ok {
		switch strings.ToLower(v) {
		case "debug", "info", "warn", "error":
			c.LogLevel = strings.ToLower(v)
		default:
			l.fail(VarLogLevel, "must be debug, info, warn or error")
		}
	}
	if c.Listen == c.AdminListen && !strings.HasSuffix(c.Listen, ":0") {
		l.fail(VarAdminListen, "must differ from %s", VarListen)
	}
	if c.PublicURL != "" && !c.Secure() {
		l.warn(VarPublicURL, "is plain http: the __Host- session cookie is only accepted by browsers on localhost; use https in production")
	}
	if c.AdminListen != "" && !isLoopback(c.AdminListen) {
		l.warn(VarAdminListen, "is not loopback only: /_metrics is unauthenticated, keep it off the public network")
	}
}

func (l *loader) hasProblem(name string) bool {
	for _, p := range l.problems {
		if p.Var == name || p.Var == name+fileSuffix {
			return true
		}
	}
	return false
}

func (l *loader) duration(name string, dst *time.Duration, lo, hi time.Duration) {
	v, ok := l.get(name)
	if !ok {
		return
	}
	d, err := time.ParseDuration(v)
	switch {
	case err != nil:
		l.fail(name, "is not a duration such as 30s, 12h or 720h")
	case d < lo || d > hi:
		l.fail(name, "must be between %s and %s", lo, hi)
	default:
		*dst = d
	}
}

func (l *loader) integer(name string, dst *int, lo, hi int) {
	v, ok := l.get(name)
	if !ok {
		return
	}
	n, err := strconv.Atoi(v)
	switch {
	case err != nil:
		l.fail(name, "is not a whole number")
	case n < lo || n > hi:
		l.fail(name, "must be between %d and %d", lo, hi)
	default:
		*dst = n
	}
}

// checkListen validates host:port ("" if fine).
func checkListen(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return "is not a host:port address (for example :8080)"
	}
	n, err := strconv.Atoi(port)
	if err != nil || n < 0 || n > 65535 {
		return "has an invalid port: want a number from 0 to 65535"
	}
	if host != "" {
		if _, err := netip.ParseAddr(host); err != nil && strings.ContainsAny(host, " /:") {
			return "has an invalid host: want an IP address or a host name"
		}
	}
	return ""
}

func isLoopback(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil {
		return false
	}
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip, err := netip.ParseAddr(host)
	return err == nil && ip.Unmap().IsLoopback()
}

// baseURL validates an http(s) URL. With originOnly the path must be empty;
// otherwise a path prefix is allowed (a JMAP base may live under a path).
func baseURL(raw string, originOnly bool) (string, string) {
	if !strings.Contains(raw, "://") {
		return "", "must be an absolute http:// or https:// URL"
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", "is not a valid URL"
	}
	switch {
	case u.Scheme != "http" && u.Scheme != "https":
		return "", "must be an http:// or https:// URL"
	case u.User != nil:
		return "", "must not contain user info"
	case u.Hostname() == "":
		return "", "has no host"
	case u.RawQuery != "" || u.ForceQuery || strings.Contains(raw, "#"):
		return "", "must not have a query or fragment"
	case originOnly && u.Path != "" && u.Path != "/":
		return "", "must not have a path"
	}
	return strings.TrimRight(u.Scheme+"://"+strings.ToLower(u.Host)+u.EscapedPath(), "/"), ""
}
