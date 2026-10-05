package config

import (
	"fmt"
	"net"
	"net/netip"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"
	"unicode"
)

// checkListen checks a bind address: host:port, where the host is empty
// (every interface), an IP address or a host name, and the port is a number
// from 0 to 65535 (0 lets the kernel choose, for tests). It returns what is
// wrong, or "".
func checkListen(addr string) string {
	host, port, err := net.SplitHostPort(addr)
	if err != nil {
		return "is not a host:port address (for example :9000, or 127.0.0.1:9000 for loopback only)"
	}
	if !isPort(port, 0) {
		return "has an invalid port: want a number from 0 to 65535"
	}
	if host != "" {
		if _, err := netip.ParseAddr(host); err != nil && !validDNSName(strings.TrimSuffix(strings.ToLower(host), ".")) {
			return "has an invalid host: want an IP address or a host name"
		}
	}
	return ""
}

// isPort reports whether s is a decimal port number from min to 65535.
func isPort(s string, min int) bool {
	if s == "" || strings.Trim(s, "0123456789") != "" {
		return false
	}
	n, err := strconv.Atoi(s)
	return err == nil && n >= min && n <= 65535
}

// isLoopbackListen reports whether a bind address is loopback only: the host
// is in 127.0.0.0/8, is ::1 (IPv4-mapped forms included), or is the name
// localhost. An empty host means every interface, so it is not loopback.
func isLoopbackListen(addr string) bool {
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

// parseBaseURL checks a URL that names a server and nothing else: http or
// https, a host and an optional port, no user info, path, query or fragment
// (a lone trailing "/" is allowed and dropped). It returns the normalised
// scheme://host[:port] with the host lower-cased, a key that also folds in
// the scheme's default port (for finding duplicates), and what is wrong, or
// "".
func parseBaseURL(raw string) (norm, key, problem string) {
	if !strings.Contains(raw, "://") {
		return "", "", "must be an absolute http:// or https:// URL"
	}
	u, err := url.Parse(raw)
	if err != nil {
		return "", "", "is not a valid URL"
	}
	switch {
	case u.Scheme != "http" && u.Scheme != "https":
		return "", "", "must be an http:// or https:// URL"
	case u.User != nil:
		return "", "", "must not contain user info"
	case u.Hostname() == "":
		return "", "", "has no host"
	case u.Path != "" && u.Path != "/":
		return "", "", "must not have a path"
	case u.RawQuery != "" || u.ForceQuery:
		return "", "", "must not have a query"
	case strings.Contains(raw, "#"):
		return "", "", "must not have a fragment"
	}
	port := u.Port()
	if port != "" && !isPort(port, 1) {
		return "", "", "has an invalid port: want a number from 1 to 65535"
	}
	host := strings.TrimSuffix(strings.ToLower(u.Host), ":")
	effective := port
	if effective == "" {
		effective = map[string]string{"http": "80", "https": "443"}[u.Scheme]
	}
	return u.Scheme + "://" + host,
		u.Scheme + "://" + net.JoinHostPort(strings.ToLower(u.Hostname()), effective),
		""
}

// displayURL is raw for use in a message, with any password masked.
func displayURL(raw string) string {
	if u, err := url.Parse(raw); err == nil && u.User != nil {
		return u.Redacted()
	}
	return raw
}

// checkDomain checks BINVAULT_DOMAIN: a bare DNS name, without scheme, port,
// slashes or wildcard. It returns the name lower-cased and without a trailing
// dot, or what is wrong.
func checkDomain(raw string) (string, string) {
	d := strings.ToLower(raw)
	switch {
	case strings.Contains(d, "://"):
		return "", "must be a bare DNS name such as s3.example.com, without a scheme"
	case strings.Contains(d, "/"):
		return "", "must be a bare DNS name, without slashes"
	case strings.HasPrefix(d, "*."):
		return "", `must be the domain itself, without "*." (every <bucket>.<domain> is then served)`
	}
	if _, err := netip.ParseAddr(strings.Trim(d, "[]")); err == nil {
		return "", "must be a DNS name, not an IP address"
	}
	if strings.Contains(d, ":") {
		return "", "must be a bare DNS name, without a port"
	}
	d = strings.TrimSuffix(d, ".")
	if !validDNSName(d) {
		return "", "is not a valid DNS name"
	}
	return d, ""
}

// validDNSName reports whether s (lower case, no trailing dot) is a DNS name:
// at most 253 bytes of dot-separated labels, each 1-63 bytes of a-z, 0-9, -
// and _, not starting or ending with -.
func validDNSName(s string) bool {
	if s == "" || len(s) > 253 {
		return false
	}
	for _, label := range strings.Split(s, ".") {
		if label == "" || len(label) > 63 || label[0] == '-' || label[len(label)-1] == '-' {
			return false
		}
		for i := 0; i < len(label); i++ {
			ch := label[i]
			if (ch < 'a' || ch > 'z') && (ch < '0' || ch > '9') && ch != '-' && ch != '_' {
				return false
			}
		}
	}
	return true
}

// checkRegion checks BINVAULT_REGION: no whitespace, control characters or
// slashes (a region is one element of a SigV4 credential scope).
func checkRegion(v string) string {
	if strings.ContainsFunc(v, func(r rune) bool { return unicode.IsSpace(r) || unicode.IsControl(r) }) {
		return "must not contain whitespace"
	}
	if strings.Contains(v, "/") {
		return "must not contain slashes"
	}
	return ""
}

// parseProxy parses one BINVAULT_TRUSTED_PROXIES entry: a CIDR, or a bare
// address taken as a /32 or /128. Zones are refused. The prefix is masked,
// and an IPv4-mapped one becomes plain IPv4 so that it matches unmapped
// addresses (IsTrustedProxy unmaps).
func parseProxy(s string) (netip.Prefix, bool) {
	var p netip.Prefix
	if strings.Contains(s, "/") {
		var err error
		if p, err = netip.ParsePrefix(s); err != nil {
			return netip.Prefix{}, false
		}
	} else {
		a, err := netip.ParseAddr(s)
		if err != nil || a.Zone() != "" {
			return netip.Prefix{}, false
		}
		p = netip.PrefixFrom(a, a.BitLen())
	}
	if a := p.Addr(); a.Is4In6() && p.Bits() >= 96 {
		p = netip.PrefixFrom(a.Unmap(), p.Bits()-96)
	}
	return p.Masked(), true
}

// parseBool accepts what strconv.ParseBool does plus yes/no and on/off, in
// any case.
func parseBool(s string) (value, ok bool) {
	switch strings.ToLower(s) {
	case "1", "t", "true", "yes", "on":
		return true, true
	case "0", "f", "false", "no", "off":
		return false, true
	}
	return false, false
}

var (
	// dayWeekRe matches a duration written with Go's units plus d and w.
	dayWeekRe = regexp.MustCompile(`^(?:(?:\d+(?:\.\d*)?|\.\d+)(?:ns|us|µs|μs|ms|s|m|h|d|w))+$`)
	// durationPartRe is one number and unit of such a duration.
	durationPartRe = regexp.MustCompile(`(\d+(?:\.\d*)?|\.\d+)(ns|us|µs|μs|ms|s|m|h|d|w)`)
)

// durationProblem explains why v is not a Go duration. Days and weeks are
// common in retention settings and Go has neither, so for those it spells
// out the equivalent in hours ("write 30d as 720h").
func durationProblem(v string) string {
	if dayWeekRe.MatchString(v) && strings.ContainsAny(v, "dw") {
		var b strings.Builder
		for _, m := range durationPartRe.FindAllStringSubmatch(v, -1) {
			num, unit := m[1], m[2]
			hours := map[string]float64{"d": 24, "w": 7 * 24}[unit]
			if hours == 0 {
				b.WriteString(num + unit)
				continue
			}
			f, _ := strconv.ParseFloat(num, 64)
			b.WriteString(strconv.FormatFloat(f*hours, 'f', -1, 64) + "h")
		}
		if d, err := time.ParseDuration(b.String()); err == nil {
			return fmt.Sprintf("%q is not a valid duration: days (d) and weeks (w) are not supported, so write %s as %s", v, v, fmtDuration(d))
		}
	}
	if strings.Trim(v, "0123456789") == "" {
		return fmt.Sprintf("%q has no unit: write %ss, %sm or %sh", v, v, v, v)
	}
	return fmt.Sprintf("%q is not a valid duration (Go syntax, such as 90s, 15m or 168h)", v)
}

// durationRange describes the accepted range [min, max] of a duration; max 0
// means unbounded, and min positive means "greater than zero".
func durationRange(min, max time.Duration) string {
	switch {
	case max > 0:
		return fmt.Sprintf("must be between %s and %s", fmtDuration(min), fmtDuration(max))
	case min <= 0:
		return "must not be negative"
	case min == positive:
		return "must be greater than 0"
	}
	return "must be at least " + fmtDuration(min)
}

// fmtDuration is d.String() without trailing zero units: 720h, 10m, 1h30m.
func fmtDuration(d time.Duration) string {
	s := d.String()
	if strings.HasSuffix(s, "m0s") {
		s = strings.TrimSuffix(s, "0s")
	}
	if strings.HasSuffix(s, "h0m") {
		s = strings.TrimSuffix(s, "0m")
	}
	return s
}
