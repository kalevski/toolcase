package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func intp(v int) *int { return &v }

func baseConfig(zones ...Zone) *Config {
	cfg := &Config{DataDir: "/var/lib/zonewright", Zones: zones}
	cfg.Defaults.Nameservers = []string{"ns1.example.net"}
	ApplyDefaults(cfg)
	return cfg
}

func TestParseTTL(t *testing.T) {
	cases := map[string]TTL{"300": 300, "5m": 300, "1h": 3600, "1d": 86400, "2w": 1209600, "1h30m": 5400, " 1H ": 3600}
	for in, want := range cases {
		got, err := ParseTTL(in)
		if err != nil || got != want {
			t.Errorf("ParseTTL(%q) = %d, %v; want %d", in, got, err, want)
		}
	}
	for _, bad := range []string{"", "h", "5x", "1h5", "-5", "99999999999"} {
		if _, err := ParseTTL(bad); err == nil {
			t.Errorf("ParseTTL(%q) should fail", bad)
		}
	}
}

func TestNormalizeOwner(t *testing.T) {
	ok := map[string]string{
		"":                 "@",
		"@":                "@",
		"WWW":              "www",
		"a.b":              "a.b",
		"*":                "*",
		"*.dev":            "*.dev",
		"_dmarc":           "_dmarc",
		"example.com.":     "@",
		"www.example.com.": "www",
		"x.y.example.com.": "x.y",
		"_sip._tcp":        "_sip._tcp",
	}
	for in, want := range ok {
		got, err := NormalizeOwner(in, "example.com")
		if err != nil || got != want {
			t.Errorf("NormalizeOwner(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, bad := range []string{"www.example.com", "example.com", "other.org.", "a..b", "-x", "a.*", "sp ace"} {
		if _, err := NormalizeOwner(bad, "example.com"); err == nil {
			t.Errorf("NormalizeOwner(%q) should fail", bad)
		}
	}
}

// The ambiguity error must suggest both unambiguous spellings.
func TestNormalizeOwnerAmbiguityHint(t *testing.T) {
	_, err := NormalizeOwner("www.example.com", "example.com")
	if err == nil || !strings.Contains(err.Error(), `"www"`) || !strings.Contains(err.Error(), `"www.example.com."`) {
		t.Fatalf("want a hint naming www and www.example.com., got %v", err)
	}
}

func TestNormalizeRecordTargets(t *testing.T) {
	cases := []struct {
		rec  Record
		want string
	}{
		{Record{Type: "cname", Value: "ghs.googlehosted.com"}, "ghs.googlehosted.com."},
		{Record{Type: "CNAME", Value: "www"}, "www"},
		{Record{Type: "CNAME", Value: "@"}, "@"},
		{Record{Type: "MX", Value: "Mail.Example.com.", Priority: intp(10)}, "mail.example.com."},
		{Record{Type: "MX", Value: ".", Priority: intp(0)}, "."},
		{Record{Type: "A", Value: " 192.0.2.1 "}, "192.0.2.1"},
		{Record{Type: "AAAA", Value: "2001:DB8:0:0::1"}, "2001:db8::1"},
	}
	for _, c := range cases {
		r := c.rec
		r.Name = "x"
		if err := NormalizeRecord(&r, "example.com"); err != nil {
			t.Errorf("%+v: %v", c.rec, err)
			continue
		}
		if r.Value != c.want {
			t.Errorf("%+v: value %q, want %q", c.rec, r.Value, c.want)
		}
	}
}

func TestNormalizeRecordRejects(t *testing.T) {
	bad := []Record{
		{Name: "x", Type: "A", Value: "2001:db8::1"},
		{Name: "x", Type: "AAAA", Value: "192.0.2.1"},
		{Name: "x", Type: "AAAA", Value: "::ffff:192.0.2.1"},
		{Name: "x", Type: "A", Value: "nope"},
		{Name: "x", Type: "MX", Value: "mail"},                        // missing priority
		{Name: "x", Type: "MX", Value: "mail", Priority: intp(70000)}, // out of range
		{Name: "x", Type: "A", Value: "192.0.2.1", Priority: intp(1)}, // priority on A
		{Name: "x", Type: "SRV", Value: "sip", Priority: intp(1)},     // missing weight/port
		{Name: "x", Type: "CNAME", Value: "."},                        // root only for MX/SRV
		{Name: "x", Type: "CAA", Value: "letsencrypt.org"},            // missing tag
		{Name: "x", Type: "CAA", Value: "x", Tag: "Is-sue"},           // bad tag
		{Name: "x", Type: "TXT", Value: strings.Repeat("a", maxTXTLen+1)},
		{Name: "x", Type: "SOA", Value: "x"},
		{Name: "x", Value: "x"},
	}
	for _, r := range bad {
		rr := r
		if err := NormalizeRecord(&rr, "example.com"); err == nil {
			t.Errorf("%+v should be rejected", r)
		}
	}
}

func TestValidateRRsetRules(t *testing.T) {
	cases := map[string][]Record{
		"CNAME is not allowed at the zone apex": {{Name: "@", Type: "CNAME", Value: "x.org"}},
		"CNAME and other records":               {{Name: "w", Type: "CNAME", Value: "x.org"}, {Name: "w", Type: "A", Value: "192.0.2.1"}},
		"only one is allowed":                   {{Name: "w", Type: "CNAME", Value: "x.org"}, {Name: "w", Type: "CNAME", Value: "y.org"}},
		"duplicates":                            {{Name: "w", Type: "A", Value: "192.0.2.1"}, {Name: "W", Type: "A", Value: "192.0.2.1"}},
		"mixes TTLs":                            {{Name: "w", Type: "A", Value: "192.0.2.1", TTL: 60}, {Name: "w", Type: "A", Value: "192.0.2.2"}},
	}
	for want, recs := range cases {
		err := Validate(baseConfig(Zone{Name: "example.com", Records: recs}))
		if err == nil || !strings.Contains(err.Error(), want) {
			t.Errorf("want error containing %q, got %v", want, err)
		}
	}
}

func TestValidateNeedsNameservers(t *testing.T) {
	cfg := baseConfig(Zone{Name: "example.com"})
	cfg.Defaults.Nameservers = nil
	if err := Validate(cfg); err == nil || !strings.Contains(err.Error(), "no nameservers") {
		t.Fatalf("want no-nameservers error, got %v", err)
	}
	// An apex NS record satisfies it.
	cfg = baseConfig(Zone{Name: "example.com", Records: []Record{{Name: "@", Type: "NS", Value: "ns1.example.org"}}})
	cfg.Defaults.Nameservers = nil
	if err := Validate(cfg); err != nil {
		t.Fatal(err)
	}
}

func TestValidateNormalizesZone(t *testing.T) {
	cfg := baseConfig(Zone{
		Name:          "Example.COM.",
		Nameservers:   []string{"NS1.example.com"},
		AllowTransfer: []string{"10.0.0.0/8", "192.0.2.7"},
		Records:       []Record{{Name: "www.example.com.", Type: "a", Value: "192.0.2.1"}},
	})
	if err := Validate(cfg); err != nil {
		t.Fatal(err)
	}
	z := cfg.Zones[0]
	if z.Name != "example.com" || z.Nameservers[0] != "ns1.example.com." || z.Records[0].Name != "www" || z.Records[0].Type != "A" {
		t.Fatalf("not normalized: %+v", z)
	}
}

func TestValidateDuplicateZones(t *testing.T) {
	cfg := baseConfig(Zone{Name: "example.com", File: "a.yml"}, Zone{Name: "EXAMPLE.com", File: "b.yml"})
	if err := Validate(cfg); err == nil || !strings.Contains(err.Error(), "declared twice") {
		t.Fatalf("want duplicate error, got %v", err)
	}
}

func TestValidateACL(t *testing.T) {
	for _, bad := range [][]string{{"any", "10.0.0.1"}, {"host.example"}} {
		if err := validateACL(append([]string(nil), bad...), true); err == nil {
			t.Errorf("allow_transfer %v should fail", bad)
		}
	}
	if err := validateACL([]string{"10.0.0.0/8"}, false); err == nil {
		t.Error("also_notify must reject CIDRs")
	}
}

func TestEffectiveSOA(t *testing.T) {
	cfg := baseConfig(Zone{Name: "example.com", SOA: SOA{Retry: 60}})
	if err := Validate(cfg); err != nil {
		t.Fatal(err)
	}
	soa := cfg.EffectiveSOA(&cfg.Zones[0])
	if soa.PrimaryNS != "ns1.example.net." || soa.AdminEmail != "hostmaster@example.com" ||
		soa.Retry != 60 || soa.Refresh != DefaultRefresh || soa.Minimum != DefaultMinimum {
		t.Fatalf("unexpected SOA %+v", soa)
	}
}

func TestLoadWithIncludes(t *testing.T) {
	dir := t.TempDir()
	must := func(err error) {
		t.Helper()
		if err != nil {
			t.Fatal(err)
		}
	}
	must(os.MkdirAll(filepath.Join(dir, "zones.d"), 0o750))
	must(os.WriteFile(filepath.Join(dir, "config.yml"), []byte(`
data_dir: `+dir+`
defaults:
  ttl: 30m
  nameservers: [ns1.example.net]
include:
  - zones.d/*.yml
`), 0o640))
	must(os.WriteFile(filepath.Join(dir, "zones.d", "example.com.yml"), []byte(`
zones:
  - name: example.com
    records:
      - {name: www, type: A, value: 192.0.2.1, ttl: 5m}
`), 0o640))
	res, err := Load(filepath.Join(dir, "config.yml"))
	must(err)
	cfg := res.Config
	if len(cfg.Zones) != 1 || cfg.Defaults.TTL != 1800 || cfg.Zones[0].Records[0].TTL != 300 {
		t.Fatalf("unexpected config: %+v", cfg)
	}
	if cfg.Bind.ZoneDir != filepath.Join(dir, "zones") || cfg.Bind.ReloadCmd[0] != "rndc" {
		t.Fatalf("bind defaults not applied: %+v", cfg.Bind)
	}
	if !strings.HasSuffix(cfg.Zones[0].File, "example.com.yml") {
		t.Fatalf("provenance: %s", cfg.Zones[0].File)
	}
}

func TestParseFragmentStrict(t *testing.T) {
	if _, err := ParseFragment([]byte("zones: []\nbogus: 1\n"), "x"); err == nil {
		t.Fatal("unknown keys must be rejected")
	}
	// JSON is YAML.
	f, err := ParseFragment([]byte(`{"zones":[{"name":"example.com","records":[{"name":"@","type":"A","value":"192.0.2.1","ttl":"1h"}]}]}`), "x")
	if err != nil || f.Zones[0].Records[0].TTL != 3600 {
		t.Fatalf("json fragment: %v %+v", err, f)
	}
}

// MarshalFragment output must parse back to the same zone.
func TestMarshalFragmentRoundTrip(t *testing.T) {
	z := Zone{Name: "example.com", TTL: 600, SOA: SOA{AdminEmail: "a@b.c"}, Records: []Record{
		{Name: "@", Type: "MX", Value: "mail.example.com.", Priority: intp(0)},
		{Name: "_s._tcp", Type: "SRV", Value: "sip", Priority: intp(1), Weight: intp(0), Port: intp(5060)},
		{Name: "@", Type: "CAA", Tag: "issue", Value: "letsencrypt.org", Flags: intp(0)},
	}}
	raw, err := MarshalFragment(z)
	if err != nil {
		t.Fatal(err)
	}
	f, err := ParseFragment(raw, "x")
	if err != nil {
		t.Fatalf("%v\n%s", err, raw)
	}
	got := f.Zones[0]
	if got.TTL != 600 || got.SOA.AdminEmail != "a@b.c" || *got.Records[0].Priority != 0 || *got.Records[1].Port != 5060 || *got.Records[2].Flags != 0 {
		t.Fatalf("round trip lost data:\n%s", raw)
	}
}

// admin_email is written into the SOA verbatim; zone-file syntax must never
// get through (a newline would start a new directive such as $INCLUDE).
func TestAdminEmailRejectsZoneSyntax(t *testing.T) {
	for _, bad := range []string{"x\n$INCLUDE@example.com", "a b@example.com", "a$b@example.com", "a;b@example.com", ".a@example.com", "a..b@example.com", "a\x00@example.com", "@example.com", "a@exa mple.com"} {
		s := SOA{AdminEmail: bad}
		if err := validateSOA(&s); err == nil {
			t.Errorf("admin_email %q should be rejected", bad)
		}
	}
	s := SOA{AdminEmail: "Host.Master+dns@Example.COM."}
	if err := validateSOA(&s); err != nil || s.AdminEmail != "Host.Master+dns@example.com" {
		t.Fatalf("valid address: %v %q", err, s.AdminEmail)
	}
}

func TestTTLOverflowRejected(t *testing.T) {
	for _, bad := range []string{"18446744073709551615h", "99999999999999999999s", "5124095576030431w"} {
		if _, err := ParseTTL(bad); err == nil {
			t.Errorf("ParseTTL(%q) should fail, not wrap", bad)
		}
	}
}

func TestRemoteListenRequiresToken(t *testing.T) {
	listen := func(s string) *string { return &s }
	for addr, wantErr := range map[string]bool{
		"0.0.0.0:9053": true, ":9053": true, "10.0.0.1:9053": true, "[::]:9053": true,
		"127.0.0.1:9053": false, "localhost:9053": false, "[::1]:9053": false, "": false,
	} {
		cfg := baseConfig()
		cfg.Admin.Listen = listen(addr)
		err := Validate(cfg)
		if (err != nil) != wantErr {
			t.Errorf("listen %q without token: err=%v, wantErr=%v", addr, err, wantErr)
		}
		cfg.Admin.TokenEnv = "ZW_TOKEN"
		if err := Validate(cfg); (err != nil) != wantErr {
			t.Errorf("listen %q with token but no TLS: err=%v, wantErr=%v", addr, err, wantErr)
		}
		cfg.Admin.TLS = TLSFiles{CertFile: "/c.pem", KeyFile: "/k.pem"}
		if err := Validate(cfg); err != nil {
			t.Errorf("listen %q with token + TLS: %v", addr, err)
		}
		cfg.Admin.TLS = TLSFiles{}
		cfg.Admin.AllowInsecureHTTP = true
		if err := Validate(cfg); err != nil {
			t.Errorf("listen %q with token + allow_insecure_http: %v", addr, err)
		}
	}
}

func TestClusterConfig(t *testing.T) {
	valid := func() *Cluster {
		return &Cluster{KeyFile: "/k", Listen: "0.0.0.0:9153", TLS: TLSFiles{CertFile: "/c", KeyFile: "/k"},
			URLs: []string{"https://NS1.example.com:9153/", "https://ns2.example.com:9153"}}
	}
	cfg := baseConfig()
	cfg.Cluster = valid()
	ApplyDefaults(cfg)
	if err := Validate(cfg); err != nil {
		t.Fatal(err)
	}
	if cfg.Cluster.URLs[0] != "https://ns1.example.com:9153" || cfg.Cluster.Retention != DefaultRetention {
		t.Fatalf("not normalized/defaulted: %+v", cfg.Cluster)
	}
	bad := map[string]func(c *Cluster){
		"no key":        func(c *Cluster) { c.KeyFile = "" },
		"no urls":       func(c *Cluster) { c.URLs = nil },
		"plain http":    func(c *Cluster) { c.URLs[0] = "http://ns1.example.com:9153" },
		"path in url":   func(c *Cluster) { c.URLs[0] = "https://ns1.example.com/x" },
		"duplicate url": func(c *Cluster) { c.URLs[1] = "https://ns1.example.com:9153" },
		"no tls public": func(c *Cluster) { c.TLS = TLSFiles{} },
		"bad pin":       func(c *Cluster) { c.Fingerprint = "abc" },
	}
	for name, mut := range bad {
		cfg := baseConfig()
		cfg.Cluster = valid()
		mut(cfg.Cluster)
		if err := Validate(cfg); err == nil {
			t.Errorf("%s: should fail", name)
		}
	}
	// Plain http is fine when explicitly allowed; loopback listener without
	// TLS is fine (TLS proxy in front).
	cfg = baseConfig()
	cfg.Cluster = valid()
	cfg.Cluster.URLs[0] = "http://10.0.0.1:9153"
	cfg.Cluster.AllowInsecureHTTP = true
	if err := Validate(cfg); err != nil {
		t.Errorf("allow_insecure_http: %v", err)
	}
	cfg = baseConfig()
	cfg.Cluster = valid()
	cfg.Cluster.TLS, cfg.Cluster.Listen = TLSFiles{}, "127.0.0.1:9153"
	if err := Validate(cfg); err != nil {
		t.Errorf("loopback behind proxy: %v", err)
	}
}
