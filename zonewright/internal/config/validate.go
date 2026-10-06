package config

import (
	"fmt"
	"net"
	"net/netip"
	"path/filepath"
	"regexp"
	"strings"

	"golang.org/x/net/idna"
)

// Validation limits. TXT and CAA payloads are capped well below the wire
// maximum — a zone that needs more is not what this tool is for.
const (
	maxTXTLen    = 4096
	maxCAALen    = 255
	maxNameLen   = 253
	maxLabelLen  = 63
	maxRecords   = 10000
	maxUint16    = 65535
	maxCAAFlags  = 255
	maxCAATagLen = 15
)

var (
	labelRe  = regexp.MustCompile(`^[a-z0-9_]([a-z0-9_-]*[a-z0-9_])?$`)
	caaTagRe = regexp.MustCompile(`^[a-z0-9]+$`)
	// emailLocalRe is deliberately narrow: the local part is written into the
	// SOA RNAME verbatim (dots escaped), so nothing that is zone-file syntax —
	// whitespace, newlines, quotes, parens, ';', '$', '\\' — may pass.
	emailLocalRe = regexp.MustCompile(`^[A-Za-z0-9_+-]+(\.[A-Za-z0-9_+-]+)*$`)
	tokenNameRe  = regexp.MustCompile(`^[a-z0-9-]+$`)
)

// ValidTokenName reports whether name is an acceptable scoped token name.
func ValidTokenName(name string) bool { return len(name) <= 64 && tokenNameRe.MatchString(name) }

// NormalizeTokenZones normalizes a scoped token's zone list, rejecting an
// invalid or repeated zone.
func NormalizeTokenZones(zones []string) ([]string, error) {
	out := make([]string, 0, len(zones))
	seen := map[string]bool{}
	for i, z := range zones {
		n, err := NormalizeZoneName(z)
		if err != nil {
			return nil, fmt.Errorf("zones[%d]: %v", i, err)
		}
		if seen[n] {
			return nil, fmt.Errorf("zone %s is listed twice", n)
		}
		seen[n] = true
		out = append(out, n)
	}
	return out, nil
}

// validateScopedTokens checks admin.scoped_tokens and normalizes their zone
// lists in place.
func validateScopedTokens(a *Admin) error {
	if len(a.ScopedTokens) == 0 {
		return nil
	}
	if a.TokenEnv == "" && a.TokenFile == "" {
		return fmt.Errorf("admin.scoped_tokens needs admin.token_env or admin.token_file: without an admin token the API is unauthenticated")
	}
	names := map[string]bool{}
	for i := range a.ScopedTokens {
		t := &a.ScopedTokens[i]
		where := fmt.Sprintf("admin.scoped_tokens[%d]", i)
		if !ValidTokenName(t.Name) {
			return fmt.Errorf("%s: name %q must match [a-z0-9-]+ (at most 64 characters)", where, t.Name)
		}
		if names[t.Name] {
			return fmt.Errorf("%s: name %q is used twice", where, t.Name)
		}
		names[t.Name] = true
		if (t.TokenEnv == "") == (t.TokenFile == "") {
			return fmt.Errorf("%s (%s): set exactly one of token_env or token_file", where, t.Name)
		}
		if t.Scope != ScopeACME {
			return fmt.Errorf("%s (%s): scope %q is not supported (only %q)", where, t.Name, t.Scope, ScopeACME)
		}
		if t.AllZones && len(t.Zones) > 0 {
			return fmt.Errorf("%s (%s): set zones or all_zones: true, not both", where, t.Name)
		}
		zones, err := NormalizeTokenZones(t.Zones)
		if err != nil {
			return fmt.Errorf("%s (%s): %v", where, t.Name, err)
		}
		if len(t.Zones) > 0 {
			t.Zones = zones
		}
	}
	return nil
}

// Validate checks the merged config and normalizes it in place: zone names to
// lowercase ASCII, record names to their relative form, types to upper case,
// hostname targets to their rendered form and IPs to canonical text. Any
// error rejects the whole config (the running one stays active).
func Validate(cfg *Config) error {
	if !filepath.IsAbs(cfg.DataDir) {
		return fmt.Errorf("data_dir %q must be an absolute path", cfg.DataDir)
	}
	if !filepath.IsAbs(cfg.Bind.ZoneDir) {
		return fmt.Errorf("bind.zone_dir %q must be an absolute path (named resolves it against its own directory)", cfg.Bind.ZoneDir)
	}
	if !filepath.IsAbs(cfg.Bind.ConfFile) {
		return fmt.Errorf("bind.conf_file %q must be an absolute path", cfg.Bind.ConfFile)
	}
	switch cfg.LogLevel {
	case "debug", "info", "warn", "error":
	default:
		return fmt.Errorf("log_level %q must be debug, info, warn or error", cfg.LogLevel)
	}
	if cfg.Admin.TokenEnv != "" && cfg.Admin.TokenFile != "" {
		return fmt.Errorf("admin: set token_env or token_file, not both")
	}
	// The API rewrites what the world resolves; it is never reachable off
	// the host without a token.
	if l := cfg.Admin.ListenAddr(); l != "" && cfg.Admin.TokenEnv == "" && cfg.Admin.TokenFile == "" && !loopbackListen(l) {
		return fmt.Errorf("admin.listen %q is not a loopback address: set admin.token_env or admin.token_file, or listen on 127.0.0.1", l)
	}
	if l := cfg.Admin.ListenAddr(); l != "" && !loopbackListen(l) && !cfg.Admin.TLS.Enabled() && !cfg.Admin.AllowInsecureHTTP {
		return fmt.Errorf("admin.listen %q is not a loopback address and admin.tls is not set: the token would travel in clear text; set admin.tls, or allow_insecure_http: true for a private network / TLS proxy", l)
	}
	if (cfg.Admin.TLS.CertFile == "") != (cfg.Admin.TLS.KeyFile == "") {
		return fmt.Errorf("admin.tls needs both cert_file and key_file")
	}
	if err := validateScopedTokens(&cfg.Admin); err != nil {
		return err
	}
	if cfg.Cluster != nil {
		if err := validateCluster(cfg.Cluster); err != nil {
			return err
		}
	}

	if err := validateDefaults(&cfg.Defaults); err != nil {
		return fmt.Errorf("defaults: %w", err)
	}

	seen := map[string]string{}
	for i := range cfg.Zones {
		z := &cfg.Zones[i]
		if err := validateZone(cfg, z); err != nil {
			return fmt.Errorf("%s: zone %q: %w", z.File, z.Name, err)
		}
		if prev, dup := seen[z.Name]; dup {
			return fmt.Errorf("zone %q declared twice (%s and %s)", z.Name, prev, z.File)
		}
		seen[z.Name] = z.File
	}
	return nil
}

func validateDefaults(d *Defaults) error {
	if err := checkTTL(d.TTL, "ttl"); err != nil {
		return err
	}
	for i, ns := range d.Nameservers {
		n, err := normalizeAbsolute(ns)
		if err != nil {
			return fmt.Errorf("nameservers[%d]: %w", i, err)
		}
		d.Nameservers[i] = n
	}
	if err := validateSOA(&d.SOA); err != nil {
		return fmt.Errorf("soa: %w", err)
	}
	if err := validateACL(d.AllowTransfer, true); err != nil {
		return fmt.Errorf("allow_transfer: %w", err)
	}
	if err := validateACL(d.AlsoNotify, false); err != nil {
		return fmt.Errorf("also_notify: %w", err)
	}
	return nil
}

// NormalizeSettings validates and normalizes a zone's name and non-record
// settings (ttl, nameservers, soa, acls) in place.
func NormalizeSettings(z *Zone) error {
	name, err := NormalizeZoneName(z.Name)
	if err != nil {
		return err
	}
	z.Name = name
	if err := checkTTL(z.TTL, "ttl"); err != nil {
		return err
	}
	for i, ns := range z.Nameservers {
		n, err := normalizeAbsolute(ns)
		if err != nil {
			return fmt.Errorf("nameservers[%d]: %w", i, err)
		}
		z.Nameservers[i] = n
	}
	if err := validateSOA(&z.SOA); err != nil {
		return fmt.Errorf("soa: %w", err)
	}
	if err := validateACL(z.AllowTransfer, true); err != nil {
		return fmt.Errorf("allow_transfer: %w", err)
	}
	if err := validateACL(z.AlsoNotify, false); err != nil {
		return fmt.Errorf("also_notify: %w", err)
	}
	return nil
}

// ValidateZone validates and normalizes one zone against cfg's defaults —
// used for replicated zones, which are not part of the file config.
func ValidateZone(cfg *Config, z *Zone) error { return validateZone(cfg, z) }

func validateZone(cfg *Config, z *Zone) error {
	if err := NormalizeSettings(z); err != nil {
		return err
	}
	if len(z.Records) > maxRecords {
		return fmt.Errorf("%d records exceeds the %d-record limit", len(z.Records), maxRecords)
	}

	for i := range z.Records {
		r := &z.Records[i]
		if err := NormalizeRecord(r, z.Name); err != nil {
			return fmt.Errorf("records[%d] (%s %s): %w", i, r.Name, r.Type, err)
		}
	}
	return checkRRsets(cfg, z)
}

// checkRRsets enforces the cross-record rules named-checkzone would otherwise
// reject (or silently "fix"): no duplicate records, one TTL per RRset, CNAME
// alone at its name and never at the apex, and a non-empty apex NS set.
func checkRRsets(cfg *Config, z *Zone) error {
	zoneTTL := cfg.EffectiveTTL(z)
	type rrsetKey struct{ name, typ string }
	type identityKey struct{ name, typ, rdata string }
	ttls := make(map[rrsetKey]TTL, len(z.Records))
	identity := make(map[identityKey]int, len(z.Records))
	typeCount := make(map[string]int, len(z.Records)) // distinct RR types per owner name
	cnames := map[string]int{}                        // CNAME records per owner name
	apexNS := false

	for i := range z.Records {
		r := &z.Records[i]
		id := identityKey{r.Name, r.Type, r.RData()}
		if j, dup := identity[id]; dup {
			return fmt.Errorf("records[%d] duplicates records[%d] (%s %s %s)", i, j, r.Name, r.Type, id.rdata)
		}
		identity[id] = i

		ttl := r.TTL
		if ttl == 0 {
			ttl = zoneTTL
		}
		k := rrsetKey{r.Name, r.Type}
		prev, seen := ttls[k]
		if seen && prev != ttl {
			return fmt.Errorf("records[%d]: the %s %s RRset mixes TTLs %d and %d — every record of one name+type must share a TTL", i, r.Name, r.Type, prev, ttl)
		}
		if !seen {
			typeCount[r.Name]++
		}
		ttls[k] = ttl

		if r.Type == TypeCNAME {
			cnames[r.Name]++
		}
		if r.Name == "@" && r.Type == TypeNS {
			apexNS = true
		}
	}

	for name, n := range cnames {
		if name == "@" {
			return fmt.Errorf("a CNAME is not allowed at the zone apex (use A/AAAA records there)")
		}
		if typeCount[name] > 1 {
			return fmt.Errorf("%s has a CNAME and other records — a CNAME must be the only record at its name", name)
		}
		if n > 1 {
			return fmt.Errorf("%s has %d CNAME records — only one is allowed", name, n)
		}
	}

	if len(cfg.EffectiveNameservers(z)) == 0 && !apexNS {
		return fmt.Errorf("no nameservers: set nameservers (on the zone or in defaults) or add an NS record at \"@\"")
	}
	return nil
}

// NormalizeRecord validates one record against its zone and rewrites it to
// canonical form in place. Exposed for the admin record endpoints.
func NormalizeRecord(r *Record, zone string) error {
	name, err := NormalizeOwner(r.Name, zone)
	if err != nil {
		return err
	}
	r.Name = name
	r.Type = strings.ToUpper(strings.TrimSpace(r.Type))
	if err := checkTTL(r.TTL, "ttl"); err != nil {
		return err
	}

	has := func(p *int) bool { return p != nil }
	inRange := func(field string, p *int, max int) error {
		if p == nil {
			return fmt.Errorf("%s is required for %s", field, r.Type)
		}
		if *p < 0 || *p > max {
			return fmt.Errorf("%s %d out of range 0-%d", field, *p, max)
		}
		return nil
	}
	forbid := func(allowed ...string) error {
		fields := map[string]bool{
			"priority": has(r.Priority), "weight": has(r.Weight), "port": has(r.Port),
			"flags": has(r.Flags), "tag": r.Tag != "",
		}
		ok := map[string]bool{}
		for _, a := range allowed {
			ok[a] = true
		}
		for f, set := range fields {
			if set && !ok[f] {
				return fmt.Errorf("%s is not valid on a %s record", f, r.Type)
			}
		}
		return nil
	}

	switch r.Type {
	case TypeA, TypeAAAA:
		if err := forbid(); err != nil {
			return err
		}
		ip, err := netip.ParseAddr(strings.TrimSpace(r.Value))
		if err != nil || ip.Zone() != "" {
			return fmt.Errorf("value %q is not an IP address", r.Value)
		}
		if r.Type == TypeA && !ip.Is4() {
			return fmt.Errorf("value %q is not an IPv4 address (use AAAA for IPv6)", r.Value)
		}
		if r.Type == TypeAAAA && (!ip.Is6() || ip.Is4In6()) {
			return fmt.Errorf("value %q is not an IPv6 address (use A for IPv4)", r.Value)
		}
		r.Value = ip.String()
	case TypeCNAME, TypeNS, TypePTR:
		if err := forbid(); err != nil {
			return err
		}
		v, err := normalizeTarget(r.Value, false)
		if err != nil {
			return err
		}
		r.Value = v
	case TypeMX:
		if err := forbid("priority"); err != nil {
			return err
		}
		if err := inRange("priority", r.Priority, maxUint16); err != nil {
			return err
		}
		v, err := normalizeTarget(r.Value, true)
		if err != nil {
			return err
		}
		r.Value = v
	case TypeSRV:
		if err := forbid("priority", "weight", "port"); err != nil {
			return err
		}
		for _, f := range []struct {
			name string
			p    *int
		}{{"priority", r.Priority}, {"weight", r.Weight}, {"port", r.Port}} {
			if err := inRange(f.name, f.p, maxUint16); err != nil {
				return err
			}
		}
		v, err := normalizeTarget(r.Value, true)
		if err != nil {
			return err
		}
		r.Value = v
	case TypeTXT:
		if err := forbid(); err != nil {
			return err
		}
		if len(r.Value) > maxTXTLen {
			return fmt.Errorf("value is %d bytes (max %d)", len(r.Value), maxTXTLen)
		}
	case TypeCAA:
		if err := forbid("flags", "tag"); err != nil {
			return err
		}
		if r.Flags != nil {
			if err := inRange("flags", r.Flags, maxCAAFlags); err != nil {
				return err
			}
		}
		r.Tag = strings.ToLower(strings.TrimSpace(r.Tag))
		if r.Tag == "" {
			return fmt.Errorf("tag is required for CAA (issue, issuewild, iodef)")
		}
		if len(r.Tag) > maxCAATagLen || !caaTagRe.MatchString(r.Tag) {
			return fmt.Errorf("tag %q must be 1-%d lowercase letters/digits", r.Tag, maxCAATagLen)
		}
		if len(r.Value) > maxCAALen {
			return fmt.Errorf("value is %d bytes (max %d)", len(r.Value), maxCAALen)
		}
	case "":
		return fmt.Errorf("type is required")
	default:
		return fmt.Errorf("unsupported record type %q (supported: %s)", r.Type, strings.Join(RecordTypes, ", "))
	}
	return nil
}

// NormalizeValue canonicalizes a bare value the way NormalizeRecord would for
// the given type — used to match ?value= on the admin DELETE endpoint.
func NormalizeValue(typ, v string) (string, error) {
	switch strings.ToUpper(typ) {
	case TypeA, TypeAAAA:
		ip, err := netip.ParseAddr(strings.TrimSpace(v))
		if err != nil {
			return "", fmt.Errorf("value %q is not an IP address", v)
		}
		return ip.String(), nil
	case TypeCNAME, TypeNS, TypePTR:
		return normalizeTarget(v, false)
	case TypeMX, TypeSRV:
		return normalizeTarget(v, true)
	default:
		return v, nil
	}
}

// RData is the record's data in the canonical text used for identity
// (duplicate detection, DELETE-by-value matching). It is not zone-file
// escaped — see zonefile for that.
func (r *Record) RData() string {
	iv := func(p *int) int {
		if p == nil {
			return 0
		}
		return *p
	}
	switch r.Type {
	case TypeMX:
		return fmt.Sprintf("%d %s", iv(r.Priority), r.Value)
	case TypeSRV:
		return fmt.Sprintf("%d %d %d %s", iv(r.Priority), iv(r.Weight), iv(r.Port), r.Value)
	case TypeCAA:
		return fmt.Sprintf("%d %s %s", iv(r.Flags), r.Tag, r.Value)
	default:
		return r.Value
	}
}

// NormalizeZoneName validates a zone apex and returns it as lowercase ASCII
// (IDNA) without a trailing dot.
func NormalizeZoneName(name string) (string, error) {
	n := strings.TrimSuffix(strings.TrimSpace(name), ".")
	if n == "" {
		return "", fmt.Errorf("zone name is required (the root zone is not supported)")
	}
	ascii, err := idna.Lookup.ToASCII(n)
	if err != nil {
		// idna rejects underscores; fall back to plain label rules for those.
		ascii = strings.ToLower(n)
	}
	if err := checkLabels(ascii, false); err != nil {
		return "", fmt.Errorf("invalid zone name %q: %w", name, err)
	}
	return ascii, nil
}

// NormalizeOwner turns a record name into its zone-relative form: "@" for the
// apex, otherwise the labels below it. Absolute names (trailing dot) must lie
// inside the zone. A dotless name that already ends in the zone apex is
// rejected as ambiguous — it would silently become www.example.com.example.com.
func NormalizeOwner(name, zone string) (string, error) {
	n := strings.ToLower(strings.TrimSpace(name))
	if n == "" || n == "@" {
		return "@", nil
	}
	if abs, ok := strings.CutSuffix(n, "."); ok {
		if abs == zone {
			return "@", nil
		}
		rel, inside := strings.CutSuffix(abs, "."+zone)
		if !inside {
			return "", fmt.Errorf("name %q is outside zone %s", name, zone)
		}
		n = rel
	} else if n == zone || strings.HasSuffix(n, "."+zone) {
		return "", fmt.Errorf("name %q ends with the zone name — use a relative name (%q) or an absolute one with a trailing dot (%q)",
			name, strings.TrimSuffix(strings.TrimSuffix(n, zone), "."), n+".")
	}
	if err := checkLabels(n, true); err != nil {
		return "", fmt.Errorf("invalid name %q: %w", name, err)
	}
	if len(n)+1+len(zone) > maxNameLen {
		return "", fmt.Errorf("name %q is longer than %d characters once qualified", name, maxNameLen)
	}
	return n, nil
}

// normalizeTarget applies the hostname-value rule: "@" and single labels stay
// relative to the zone; anything containing a dot is absolute and gets its
// trailing dot. allowRoot admits "." (null MX, "no service" SRV).
func normalizeTarget(v string, allowRoot bool) (string, error) {
	t := strings.ToLower(strings.TrimSpace(v))
	switch {
	case t == "":
		return "", fmt.Errorf("value (a hostname) is required")
	case t == "@":
		return t, nil
	case t == ".":
		if !allowRoot {
			return "", fmt.Errorf("value \".\" is only valid for MX and SRV")
		}
		return t, nil
	}
	bare := strings.TrimSuffix(t, ".")
	if err := checkLabels(bare, false); err != nil {
		return "", fmt.Errorf("value %q is not a valid hostname: %w", v, err)
	}
	if strings.Contains(bare, ".") {
		return bare + ".", nil
	}
	if strings.HasSuffix(t, ".") {
		return t, nil // an explicitly absolute single label
	}
	return bare, nil
}

// normalizeAbsolute validates a name that is always absolute (nameservers,
// SOA MNAME) and returns it with a trailing dot.
func normalizeAbsolute(v string) (string, error) {
	t := strings.TrimSuffix(strings.ToLower(strings.TrimSpace(v)), ".")
	if t == "" {
		return "", fmt.Errorf("hostname is required")
	}
	if err := checkLabels(t, false); err != nil {
		return "", fmt.Errorf("%q is not a valid hostname: %w", v, err)
	}
	return t + ".", nil
}

func checkLabels(name string, allowWildcard bool) error {
	if len(name) > maxNameLen {
		return fmt.Errorf("longer than %d characters", maxNameLen)
	}
	for i, l := range strings.Split(name, ".") {
		if l == "*" {
			if !allowWildcard || i != 0 {
				return fmt.Errorf("\"*\" is only allowed as the leftmost label of a record name")
			}
			continue
		}
		if l == "" {
			return fmt.Errorf("empty label")
		}
		if len(l) > maxLabelLen {
			return fmt.Errorf("label %q is longer than %d characters", l, maxLabelLen)
		}
		if !labelRe.MatchString(l) {
			return fmt.Errorf("label %q may only contain a-z, 0-9, '-' and '_' (and not start or end with '-')", l)
		}
	}
	return nil
}

func validateSOA(s *SOA) error {
	if s.PrimaryNS != "" {
		n, err := normalizeAbsolute(s.PrimaryNS)
		if err != nil {
			return fmt.Errorf("primary_ns: %w", err)
		}
		s.PrimaryNS = n
	}
	if s.AdminEmail != "" {
		local, domain, ok := strings.Cut(strings.TrimSpace(s.AdminEmail), "@")
		if !ok || len(local) > maxLabelLen || !emailLocalRe.MatchString(local) {
			return fmt.Errorf("admin_email %q must be an address like hostmaster@example.com (local part: letters, digits, . _ + -)", s.AdminEmail)
		}
		domain = strings.TrimSuffix(strings.ToLower(domain), ".")
		if err := checkLabels(domain, false); err != nil {
			return fmt.Errorf("admin_email %q: %w", s.AdminEmail, err)
		}
		s.AdminEmail = local + "@" + domain
	}
	for _, f := range []struct {
		name string
		v    TTL
	}{{"refresh", s.Refresh}, {"retry", s.Retry}, {"expire", s.Expire}, {"minimum", s.Minimum}} {
		if err := checkTTL(f.v, f.name); err != nil {
			return err
		}
	}
	return nil
}

// validateACL checks an address-match list. Entries are IPs or CIDRs;
// allow_transfer additionally accepts the BIND keywords any / none.
func validateACL(list []string, keywords bool) error {
	for i, e := range list {
		e = strings.TrimSpace(e)
		list[i] = e
		if keywords && (e == "any" || e == "none") {
			if len(list) > 1 {
				return fmt.Errorf("%q must be the only entry", e)
			}
			continue
		}
		if p, err := netip.ParsePrefix(e); err == nil {
			list[i] = p.String()
			continue
		}
		if ip, err := netip.ParseAddr(e); err == nil && ip.Zone() == "" {
			list[i] = ip.String()
			continue
		}
		if keywords {
			return fmt.Errorf("entry %q must be an IP, a CIDR, \"any\" or \"none\"", e)
		}
		return fmt.Errorf("entry %q must be an IP address", e)
	}
	if !keywords {
		for _, e := range list {
			if strings.Contains(e, "/") {
				return fmt.Errorf("entry %q must be an IP address, not a CIDR", e)
			}
		}
	}
	return nil
}

// loopbackListen reports whether a listen address binds only loopback. An
// empty host (":9053") binds every interface, so it is not loopback.
func loopbackListen(listen string) bool {
	host, _, err := net.SplitHostPort(listen)
	if err != nil {
		return false
	}
	if strings.EqualFold(host, "localhost") {
		return true
	}
	ip, err := netip.ParseAddr(host)
	return err == nil && ip.IsLoopback()
}

func checkTTL(t TTL, field string) error {
	if t > MaxTTL {
		return fmt.Errorf("%s %d exceeds %d", field, t, MaxTTL)
	}
	return nil
}
