// Package targetcheck validates proxy/upstream/stream backend targets in
// three tiers:
//
//	Tier 1 (ParsePass / ParseAddr) — strict, offline lexical validation. This
//	is the injection guard: a pass/address string is only ever a well-formed
//	scheme://host[:port][/path] or host:port / unix:/path — nginx config
//	metacharacters (';', '{', '}', '$', '"', whitespace, newlines) can never
//	reach a rendered file.
//	Tier 2 (Checker.CheckDNS) — the hostname resolves (bounded, network).
//	Tier 3 (Checker.CheckReachable) — a TCP dial succeeds (bounded, network,
//	always warn-only at the call sites).
//
// The package is pure and dependency-injected (Resolver/Dialer interfaces) so
// every tier is testable without a network. It must not import internal/config
// (config imports it for Tier 1).
package targetcheck

import (
	"context"
	"fmt"
	"net"
	"net/netip"
	"path"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"time"
)

// DefaultTimeout bounds one DNS lookup or dial when the caller sets none.
const DefaultTimeout = 3 * time.Second

// Target is a parsed backend target.
type Target struct {
	Scheme string // "http" | "https" for pass targets, "" for plain addresses
	Host   string // hostname or IP literal (no brackets)
	Port   string // "" when the target carries no explicit port
	Path   string // pass targets only
	IsIP   bool   // Host is an IP literal (Tiers 2-3 skip DNS)
	IsUnix bool   // unix:/path form (Tiers 2-3 skip DNS; dial uses UnixPath)
	Unix   string // socket path when IsUnix
}

// Addr returns the host:port dial address ("" for unix targets). Pass targets
// without an explicit port default to the scheme port (80/443); plain
// addresses default to 80 (nginx's upstream default).
func (t Target) Addr() string {
	if t.IsUnix {
		return ""
	}
	port := t.Port
	if port == "" {
		switch t.Scheme {
		case "https":
			port = "443"
		default:
			port = "80"
		}
	}
	return net.JoinHostPort(t.Host, port)
}

// charsetRe is the Tier-1 whole-string gate: everything a legitimate target
// can contain, and nothing nginx would interpret (no whitespace, ';', '{',
// '}', '$', '"', control chars, newlines — the injection vectors).
var charsetRe = regexp.MustCompile(`^[A-Za-z0-9.:/\[\]_-]+$`)

// labelRe validates one hostname label. Deliberately more permissive than
// strict DNS (underscores allowed — container/service names use them) but
// still shell/nginx-inert thanks to charsetRe.
var labelRe = regexp.MustCompile(`^[A-Za-z0-9_]([A-Za-z0-9_-]*[A-Za-z0-9_])?$`)

// Policy is the operator-controlled part of target validation: which unix
// sockets may be proxied to, and which literal IPs may not. A hostname cannot
// be judged here (nginx resolves it at runtime), so only literal IPs and the
// name "localhost" are denied.
type Policy struct {
	// UnixDirs are the directories a unix: target's socket may live under.
	// Empty means no unix: target is accepted at all.
	UnixDirs []string
	// DenyNets are the literal-IP ranges a target may not point into.
	DenyNets []netip.Prefix
	// DenyPaths are path fragments no unix: socket path may contain, on top of
	// the always-denied built-ins (docker.sock, /run/nginxpilot).
	DenyPaths []string
	// AdminAddr is the daemon's own admin listen address; a literal-IP target
	// on that port is refused when the address is a specific IP (or wildcard).
	AdminAddr netip.AddrPort
}

// DefaultDenyCIDRs are denied when the operator configures nothing: loopback,
// the unspecified address (nginx connects it to localhost) and link-local
// (cloud metadata lives at 169.254.169.254).
var DefaultDenyCIDRs = []string{"127.0.0.0/8", "0.0.0.0/8", "::1/128", "::/128", "169.254.0.0/16", "fe80::/10"}

// builtinDenyPaths are never allowed inside a unix: socket path, whatever the
// allowlist says: the daemon's own admin socket directory and the Docker API.
var builtinDenyPaths = []string{"docker.sock", "/run/nginxpilot", "/var/run/nginxpilot"}

// DefaultPolicy is the policy ParsePass / ParseAddr apply: no unix sockets,
// DefaultDenyCIDRs.
func DefaultPolicy() Policy {
	var p Policy
	for _, c := range DefaultDenyCIDRs {
		p.DenyNets = append(p.DenyNets, netip.MustParsePrefix(c))
	}
	return p
}

// ParseCIDRs parses CIDR or bare-IP strings into prefixes.
func ParseCIDRs(in []string) ([]netip.Prefix, error) {
	var out []netip.Prefix
	for _, c := range in {
		if pfx, err := netip.ParsePrefix(c); err == nil {
			out = append(out, pfx.Masked())
			continue
		}
		a, err := netip.ParseAddr(c)
		if err != nil {
			return nil, fmt.Errorf("%q is not an IP or a CIDR", c)
		}
		out = append(out, netip.PrefixFrom(a, a.BitLen()))
	}
	return out, nil
}

// checkHostAllowed applies the literal-IP / localhost rules to a parsed host.
func (p Policy) checkTarget(t Target) error {
	if t.IsUnix {
		return p.checkUnix(t.Unix)
	}
	host := strings.ToLower(strings.TrimSuffix(t.Host, "."))
	if host == "localhost" || strings.HasSuffix(host, ".localhost") {
		return fmt.Errorf("%q is not allowed as a backend (loopback)", t.Host)
	}
	if t.IsIP {
		ip, err := netip.ParseAddr(t.Host)
		if err != nil {
			return fmt.Errorf("%q is not a valid IP", t.Host)
		}
		ip = ip.Unmap()
		for _, n := range p.DenyNets {
			if n.Contains(ip) {
				return fmt.Errorf("%s is in a denied range (%s)", t.Host, n)
			}
		}
		if p.AdminAddr.IsValid() {
			port, _ := strconv.Atoi(t.portOrDefault())
			if uint16(port) == p.AdminAddr.Port() && (p.AdminAddr.Addr().IsUnspecified() || p.AdminAddr.Addr().Unmap() == ip) {
				return fmt.Errorf("%s is the daemon's own admin endpoint", t.Addr())
			}
		}
		return nil
	}
	return nil
}

func (t Target) portOrDefault() string {
	_, port, err := net.SplitHostPort(t.Addr())
	if err != nil {
		return "0"
	}
	return port
}

func (p Policy) checkUnix(sock string) error {
	clean := path.Clean(sock)
	lower := strings.ToLower(clean)
	for _, d := range append(append([]string(nil), builtinDenyPaths...), p.DenyPaths...) {
		if d != "" && strings.Contains(lower, strings.ToLower(d)) {
			return fmt.Errorf("unix socket %s is not allowed (reserved path)", sock)
		}
	}
	for _, d := range p.UnixDirs {
		dir := path.Clean(d)
		if dir != "/" && strings.HasPrefix(clean, dir+"/") {
			return nil
		}
	}
	return fmt.Errorf("unix: targets are not allowed here (proxy.unix_socket_dirs does not include %s)", path.Dir(clean))
}

// ParsePass validates a proxy pass URL string strictly: http(s) scheme, a
// valid hostname / IPv4 / [IPv6] host, an optional 1..65535 port, an optional
// clean absolute path — and nothing else (no userinfo, query, fragment, or
// nginx metacharacters anywhere). It applies DefaultPolicy.
func ParsePass(raw string) (Target, error) {
	return ParsePassPolicy(raw, DefaultPolicy())
}

// ParsePassPolicy is ParsePass under an explicit Policy.
func ParsePassPolicy(raw string, pol Policy) (Target, error) {
	t, err := parsePass(raw)
	if err != nil {
		return Target{}, err
	}
	if err := pol.checkTarget(t); err != nil {
		return Target{}, err
	}
	return t, nil
}

func parsePass(raw string) (Target, error) {
	if raw == "" {
		return Target{}, fmt.Errorf("target is empty")
	}
	if !charsetRe.MatchString(raw) {
		return Target{}, fmt.Errorf("target contains characters that are not allowed in a proxy target (letters, digits, '.', ':', '/', '[', ']', '_', '-' only)")
	}
	var scheme, rest string
	switch {
	case strings.HasPrefix(raw, "http://"):
		scheme, rest = "http", strings.TrimPrefix(raw, "http://")
	case strings.HasPrefix(raw, "https://"):
		scheme, rest = "https", strings.TrimPrefix(raw, "https://")
	default:
		return Target{}, fmt.Errorf("must be an http:// or https:// URL")
	}

	hostport := rest
	urlPath := ""
	if i := strings.IndexByte(rest, '/'); i >= 0 {
		hostport, urlPath = rest[:i], rest[i:]
	}
	host, port, err := splitHostPort(hostport)
	if err != nil {
		return Target{}, err
	}
	if urlPath != "" {
		// A trailing slash is meaningful to proxy_pass, so allow exactly one;
		// otherwise the path must already be in clean form (no "..", "//", ".").
		clean := path.Clean(urlPath)
		if strings.Contains(urlPath, "..") || (urlPath != clean && urlPath != clean+"/") {
			return Target{}, fmt.Errorf("path %q must be a clean absolute path", urlPath)
		}
	}
	if strings.EqualFold(host, "unix") {
		return Target{}, fmt.Errorf("the unix: socket form of a proxy target is not allowed")
	}
	t := Target{Scheme: scheme, Host: host, Port: port, Path: urlPath}
	t.IsIP = net.ParseIP(host) != nil
	if !t.IsIP {
		if err := checkHostname(host); err != nil {
			return Target{}, err
		}
	}
	return t, nil
}

// ParseAddr validates a host:port / host / unix:/path address as used by
// upstream servers and stream targets (no scheme, no URL path). It applies
// DefaultPolicy.
func ParseAddr(raw string) (Target, error) {
	return ParseAddrPolicy(raw, DefaultPolicy())
}

// ParseAddrPolicy is ParseAddr under an explicit Policy.
func ParseAddrPolicy(raw string, pol Policy) (Target, error) {
	t, err := parseAddr(raw)
	if err != nil {
		return Target{}, err
	}
	if err := pol.checkTarget(t); err != nil {
		return Target{}, err
	}
	return t, nil
}

func parseAddr(raw string) (Target, error) {
	if raw == "" {
		return Target{}, fmt.Errorf("address is empty")
	}
	if !charsetRe.MatchString(raw) {
		return Target{}, fmt.Errorf("address contains characters that are not allowed in a backend address (letters, digits, '.', ':', '/', '[', ']', '_', '-' only)")
	}
	if p, ok := strings.CutPrefix(raw, "unix:"); ok {
		if !strings.HasPrefix(p, "/") {
			return Target{}, fmt.Errorf("unix socket path must be absolute (unix:/path/to.sock)")
		}
		if strings.Contains(p, "..") {
			return Target{}, fmt.Errorf("unix socket path must not contain ..")
		}
		return Target{IsUnix: true, Unix: p}, nil
	}
	if strings.ContainsAny(raw, "/") {
		return Target{}, fmt.Errorf("address must be host[:port] or unix:/path (no '/')")
	}
	host, port, err := splitHostPort(raw)
	if err != nil {
		return Target{}, err
	}
	t := Target{Host: host, Port: port}
	t.IsIP = net.ParseIP(host) != nil
	if !t.IsIP {
		if err := checkHostname(host); err != nil {
			return Target{}, err
		}
	}
	return t, nil
}

// splitHostPort splits an optional-port host, handling bracketed IPv6.
func splitHostPort(s string) (host, port string, err error) {
	if s == "" {
		return "", "", fmt.Errorf("host is required")
	}
	if strings.HasPrefix(s, "[") {
		end := strings.IndexByte(s, ']')
		if end < 0 {
			return "", "", fmt.Errorf("unclosed '[' in IPv6 address")
		}
		host = s[1:end]
		if net.ParseIP(host) == nil || !strings.Contains(host, ":") {
			return "", "", fmt.Errorf("%q is not a valid IPv6 address", host)
		}
		rest := s[end+1:]
		if rest == "" {
			return host, "", nil
		}
		if !strings.HasPrefix(rest, ":") {
			return "", "", fmt.Errorf("unexpected %q after IPv6 address", rest)
		}
		port = rest[1:]
	} else {
		switch strings.Count(s, ":") {
		case 0:
			host = s
		case 1:
			i := strings.IndexByte(s, ':')
			host, port = s[:i], s[i+1:]
		default:
			return "", "", fmt.Errorf("bare IPv6 addresses must be bracketed ([::1]:port)")
		}
	}
	if host == "" {
		return "", "", fmt.Errorf("host is required")
	}
	if port != "" {
		n, perr := strconv.Atoi(port)
		if perr != nil || n < 1 || n > 65535 {
			return "", "", fmt.Errorf("port %q must be 1..65535", port)
		}
	}
	return host, port, nil
}

// checkHostname validates a non-IP host: dot-separated labels, each ≤63 chars,
// total ≤253, no empty labels.
func checkHostname(host string) error {
	h := strings.TrimSuffix(host, ".")
	if h == "" || len(h) > 253 {
		return fmt.Errorf("%q is not a valid hostname", host)
	}
	// libc reads "2130706433", "0x7f.1" and "017700000001" as IPv4 literals, so
	// a host whose last label is numeric or hex-prefixed is an IP in disguise.
	last := h[strings.LastIndexByte(h, '.')+1:]
	if numericLabel(last) {
		return fmt.Errorf("%q looks like a numeric IP form; write the address in dotted-quad form", host)
	}
	for _, label := range strings.Split(h, ".") {
		if len(label) == 0 || len(label) > 63 || !labelRe.MatchString(label) {
			return fmt.Errorf("%q is not a valid hostname (label %q)", host, label)
		}
	}
	return nil
}

// Resolver is the DNS seam (net.DefaultResolver in production).
type Resolver interface {
	LookupHost(ctx context.Context, host string) ([]string, error)
}

// Dialer is the reachability seam (a net.Dialer in production).
type Dialer interface {
	DialContext(ctx context.Context, network, addr string) (net.Conn, error)
}

// Checker runs the network tiers with injected dependencies.
type Checker struct {
	Resolver Resolver      // nil → net.DefaultResolver
	Dialer   Dialer        // nil → &net.Dialer{}
	Timeout  time.Duration // per-check budget; 0 → DefaultTimeout
}

func (c *Checker) timeout() time.Duration {
	if c.Timeout > 0 {
		return c.Timeout
	}
	return DefaultTimeout
}

func (c *Checker) resolver() Resolver {
	if c.Resolver != nil {
		return c.Resolver
	}
	return net.DefaultResolver
}

func (c *Checker) dialer() Dialer {
	if c.Dialer != nil {
		return c.Dialer
	}
	return &net.Dialer{}
}

// CheckDNS resolves the target's host with a bounded timeout. IP literals and
// unix sockets are skipped (nil).
func (c *Checker) CheckDNS(ctx context.Context, t Target) error {
	if t.IsIP || t.IsUnix || t.Host == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, c.timeout())
	defer cancel()
	if _, err := c.resolver().LookupHost(ctx, t.Host); err != nil {
		return fmt.Errorf("host %q does not resolve: %v", t.Host, err)
	}
	return nil
}

// ResolveHost returns the target host's addresses, sorted so that two lookups
// of the same host compare equal however the resolver happened to order them.
// IP literals and unix sockets resolve to nil (nothing to drift). The error is
// the same shape CheckDNS reports, so a caller can use either tier.
func (c *Checker) ResolveHost(ctx context.Context, t Target) ([]string, error) {
	if t.IsIP || t.IsUnix || t.Host == "" {
		return nil, nil
	}
	ctx, cancel := context.WithTimeout(ctx, c.timeout())
	defer cancel()
	addrs, err := c.resolver().LookupHost(ctx, t.Host)
	if err != nil {
		return nil, fmt.Errorf("host %q does not resolve: %v", t.Host, err)
	}
	out := append([]string(nil), addrs...)
	sort.Strings(out)
	return out, nil
}

// CheckReachable TCP-dials the target with a bounded timeout (unix targets
// dial the socket). nil = something is listening. Callers surface failures as
// warnings only — reachability is advisory, never a gate.
func (c *Checker) CheckReachable(ctx context.Context, t Target) error {
	ctx, cancel := context.WithTimeout(ctx, c.timeout())
	defer cancel()
	network, addr := "tcp", t.Addr()
	if t.IsUnix {
		network, addr = "unix", t.Unix
	}
	conn, err := c.dialer().DialContext(ctx, network, addr)
	if err != nil {
		return fmt.Errorf("%s is not reachable: %v", addr, err)
	}
	_ = conn.Close()
	return nil
}

// numericLabel reports whether a label is all decimal digits or a 0x-prefixed
// hex number — the forms libc's inet_aton accepts as an IPv4 component.
func numericLabel(l string) bool {
	if l == "" {
		return false
	}
	if rest, ok := strings.CutPrefix(strings.ToLower(l), "0x"); ok {
		l = rest
		for _, c := range l {
			if (c < '0' || c > '9') && (c < 'a' || c > 'f') {
				return false
			}
		}
		return true
	}
	for _, c := range l {
		if c < '0' || c > '9' {
			return false
		}
	}
	return true
}
