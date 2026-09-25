package zonefile

import (
	"strings"
	"testing"

	"github.com/kalevski/toolcase/zonewright/internal/config"
)

func intp(v int) *int { return &v }

func testConfig(t *testing.T, z config.Zone) (*config.Config, *config.Zone) {
	t.Helper()
	cfg := &config.Config{DataDir: "/var/lib/zonewright", Zones: []config.Zone{z}}
	cfg.Defaults.Nameservers = []string{"ns1.example.net", "ns2.example.net"}
	config.ApplyDefaults(cfg)
	if err := config.Validate(cfg); err != nil {
		t.Fatal(err)
	}
	return cfg, &cfg.Zones[0]
}

func TestRender(t *testing.T) {
	cfg, z := testConfig(t, config.Zone{
		Name: "example.com",
		SOA:  config.SOA{AdminEmail: "john.doe@example.com"},
		Records: []config.Record{
			{Name: "@", Type: "A", Value: "192.0.2.1"},
			{Name: "www", Type: "CNAME", Value: "@", TTL: 300},
			{Name: "@", Type: "MX", Value: "mail", Priority: intp(10)},
			{Name: "@", Type: "NS", Value: "ns2.example.net"}, // already in nameservers → not repeated
			{Name: "@", Type: "NS", Value: "ns3.example.org"},
			{Name: "_sip._tcp", Type: "SRV", Value: "sip.example.com", Priority: intp(10), Weight: intp(5), Port: intp(5060)},
			{Name: "@", Type: "CAA", Tag: "issue", Value: "letsencrypt.org"},
		},
	})
	out := Render(cfg, z, 2026092501)
	for _, want := range []string{
		"$ORIGIN example.com.\n$TTL 3600\n",
		"@\t3600\tIN\tSOA\tns1.example.net. john\\.doe.example.com. (",
		"2026092501\t; serial",
		"@\t3600\tIN\tNS\tns1.example.net.\n@\t3600\tIN\tNS\tns2.example.net.\n@\t3600\tIN\tNS\tns3.example.org.\n",
		"@\t3600\tIN\tA\t192.0.2.1\n",
		"www\t300\tIN\tCNAME\t@\n",
		"@\t3600\tIN\tMX\t10 mail\n",
		"_sip._tcp\t3600\tIN\tSRV\t10 5 5060 sip.example.com.\n",
		"@\t3600\tIN\tCAA\t0 issue \"letsencrypt.org\"\n",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
	if strings.Count(out, "ns2.example.net.") != 1 {
		t.Errorf("apex NS not de-duplicated:\n%s", out)
	}
}

func TestTXT(t *testing.T) {
	if got := TXT(`v=spf1 "q" \ -all`); got != `"v=spf1 \"q\" \\ -all"` {
		t.Errorf("escape: %s", got)
	}
	if got := TXT("a\nb"); got != `"a\010b"` {
		t.Errorf("control char: %s", got)
	}
	if got := TXT(""); got != `""` {
		t.Errorf("empty: %s", got)
	}
	long := TXT(strings.Repeat("x", 300))
	if long != `"`+strings.Repeat("x", 255)+`" "`+strings.Repeat("x", 45)+`"` {
		t.Errorf("chunking: %s", long)
	}
	// Chunking splits raw bytes before escaping: 254 x's + a quote must not
	// split the \" escape.
	edge := TXT(strings.Repeat("x", 254) + `""`)
	if !strings.HasSuffix(edge, `\"" "\""`) {
		t.Errorf("escape split across chunks: %s", edge)
	}
}

func TestContentHashIgnoresSerial(t *testing.T) {
	cfg, z := testConfig(t, config.Zone{Name: "example.com"})
	h1 := ContentHash(cfg, z)
	if Render(cfg, z, 1) == Render(cfg, z, 2) {
		t.Fatal("serial should appear in output")
	}
	z.Records = append(z.Records, config.Record{Name: "a", Type: "A", Value: "192.0.2.1"})
	if ContentHash(cfg, z) == h1 {
		t.Fatal("hash should change with content")
	}
}

func TestInclude(t *testing.T) {
	out := Include([]IncludeZone{
		{Name: "example.com", File: "/z/example.com.db"},
		{Name: "example.org", File: "/z/example.org.db", AllowTransfer: []string{"10.0.0.2"}, AlsoNotify: []string{"10.0.0.2"}},
	})
	for _, want := range []string{
		"zone \"example.com\" {\n    type primary;\n    file \"/z/example.com.db\";\n    allow-transfer { none; };\n};",
		"allow-transfer { 10.0.0.2; };\n    notify yes;\n    also-notify { 10.0.0.2; };",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q in:\n%s", want, out)
		}
	}
}
