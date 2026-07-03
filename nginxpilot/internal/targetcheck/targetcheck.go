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
	"path"
	"regexp"
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

// ParsePass validates a proxy pass URL string strictly: http(s) scheme, a
// valid hostname / IPv4 / [IPv6] host, an optional 1..65535 port, an optional
// clean absolute path — and nothing else (no userinfo, query, fragment, or
// nginx metacharacters anywhere).
func ParsePass(raw string) (Target, error) {
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
// upstream servers and stream targets (no scheme, no URL path).
func ParseAddr(raw string) (Target, error) {
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
