package realip

import (
	"os"
	"path/filepath"
	"testing"
)

func TestParseLinesAndNormalize(t *testing.T) {
	body := []byte("173.245.48.0/20\n\n# comment\n103.21.244.0/22\n173.245.48.0/20\n")
	lines, err := parseLines(body)
	if err != nil {
		t.Fatal(err)
	}
	out, err := normalize(lines)
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 2 || out[0] != "103.21.244.0/22" || out[1] != "173.245.48.0/20" {
		t.Errorf("unexpected normalize output: %v", out)
	}
}

func TestNormalizeRejectsBadEntry(t *testing.T) {
	if _, err := normalize([]string{"10.0.0.0/8", "set_real_ip_from evil;"}); err == nil {
		t.Error("a malformed entry must fail the whole set")
	}
}

func TestParseAWSRanges(t *testing.T) {
	body := []byte(`{
        "prefixes": [
            {"ip_prefix": "13.32.0.0/15", "service": "CLOUDFRONT"},
            {"ip_prefix": "10.9.9.0/24", "service": "EC2"}
        ],
        "ipv6_prefixes": [
            {"ipv6_prefix": "2600:9000::/28", "service": "CLOUDFRONT"}
        ]
    }`)
	out, err := parseAWSRanges(body, "CLOUDFRONT")
	if err != nil {
		t.Fatal(err)
	}
	if len(out) != 2 || out[0] != "13.32.0.0/15" || out[1] != "2600:9000::/28" {
		t.Errorf("unexpected CLOUDFRONT prefixes: %v", out)
	}
}

func TestStoreLoadRoundTrip(t *testing.T) {
	dir := t.TempDir()
	ranges := []string{"10.0.0.0/8", "2001:db8::/32"}
	if err := Store(dir, "cloudflare", ranges); err != nil {
		t.Fatal(err)
	}
	got, err := Load(dir, "cloudflare")
	if err != nil {
		t.Fatal(err)
	}
	if len(got) != 2 || got[0] != "10.0.0.0/8" {
		t.Errorf("round-trip mismatch: %v", got)
	}
	// Missing provider → nil, nil.
	got, err = Load(dir, "cloudfront")
	if err != nil || got != nil {
		t.Errorf("missing cache must be (nil, nil), got %v / %v", got, err)
	}
}

func TestLoadRejectsTamperedCache(t *testing.T) {
	dir := t.TempDir()
	if err := Store(dir, "cloudflare", []string{"10.0.0.0/8"}); err != nil {
		t.Fatal(err)
	}
	// Tamper with the file directly.
	path := filepath.Join(dir, CacheDirName, "cloudflare.txt")
	if err := writeRaw(path, "10.0.0.0/8\ninjected directive;\n"); err != nil {
		t.Fatal(err)
	}
	if got, _ := Load(dir, "cloudflare"); got != nil {
		t.Errorf("tampered cache must load as absent, got %v", got)
	}
	if got := LoadAll(dir, []string{"cloudflare"}); got != nil {
		t.Errorf("LoadAll must skip a tampered cache, got %v", got)
	}
}

func TestFetchUnknownProvider(t *testing.T) {
	if _, err := Fetch(t.Context(), "akamai"); err == nil {
		t.Error("unknown provider must error")
	}
}

// writeRaw bypasses Store for tamper tests.
func writeRaw(path, content string) error {
	return os.WriteFile(path, []byte(content), 0o640)
}
