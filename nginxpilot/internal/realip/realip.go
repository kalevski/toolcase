// Package realip fetches, validates and caches the published IP ranges of CDN
// providers (better.md §8) for nginx's real_ip module. Every range is strictly
// validated (netip) before it is persisted or rendered, so a corrupted or
// hostile fetch can never place an unvetted string into an nginx directive —
// the disk cache only ever holds ranges that already passed validation, and a
// failed fetch simply keeps serving the cached set.
package realip

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/netip"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// CacheDirName is the directory under data_dir holding one cached range file
// per provider (<data_dir>/realip/<provider>.txt, one CIDR per line).
const CacheDirName = "realip"

// fetchTimeout bounds one provider fetch.
const fetchTimeout = 10 * time.Second

// maxBodyBytes bounds a provider response (the real lists are a few KB; AWS's
// full ip-ranges.json is ~2 MB).
const maxBodyBytes = 8 << 20

// httpClient is shared across fetches (and overridable in tests).
var httpClient = &http.Client{Timeout: fetchTimeout}

// providerURLs maps a provider to its published-range endpoints.
var providerURLs = map[string][]string{
	config.RealIPProviderCloudflare: {
		"https://www.cloudflare.com/ips-v4",
		"https://www.cloudflare.com/ips-v6",
	},
	config.RealIPProviderCloudfront: {
		"https://ip-ranges.amazonaws.com/ip-ranges.json",
	},
}

// Fetch downloads and validates one provider's current ranges. Returns them
// sorted + deduplicated; any malformed entry fails the whole fetch (a partial
// trust list is worse than the cached one).
func Fetch(ctx context.Context, provider string) ([]string, error) {
	urls, ok := providerURLs[provider]
	if !ok {
		return nil, fmt.Errorf("unknown real-ip provider %q", provider)
	}
	var all []string
	for _, u := range urls {
		body, err := get(ctx, u)
		if err != nil {
			return nil, fmt.Errorf("%s: %w", u, err)
		}
		var ranges []string
		if strings.HasSuffix(u, ".json") {
			ranges, err = parseAWSRanges(body, "CLOUDFRONT")
		} else {
			ranges, err = parseLines(body)
		}
		if err != nil {
			return nil, fmt.Errorf("%s: %w", u, err)
		}
		all = append(all, ranges...)
	}
	return normalize(all)
}

func get(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	res, err := httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer res.Body.Close()
	if res.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("status %d", res.StatusCode)
	}
	return io.ReadAll(io.LimitReader(res.Body, maxBodyBytes))
}

// parseLines reads a plain-text one-range-per-line list (Cloudflare's format).
func parseLines(body []byte) ([]string, error) {
	var out []string
	for _, line := range strings.Split(string(body), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		out = append(out, line)
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("empty range list")
	}
	return out, nil
}

// awsRanges is the subset of ip-ranges.json we read.
type awsRanges struct {
	Prefixes []struct {
		IPPrefix string `json:"ip_prefix"`
		Service  string `json:"service"`
	} `json:"prefixes"`
	IPv6Prefixes []struct {
		IPv6Prefix string `json:"ipv6_prefix"`
		Service    string `json:"service"`
	} `json:"ipv6_prefixes"`
}

// parseAWSRanges extracts one service's prefixes from ip-ranges.json.
func parseAWSRanges(body []byte, service string) ([]string, error) {
	var doc awsRanges
	if err := json.Unmarshal(body, &doc); err != nil {
		return nil, fmt.Errorf("parse ip-ranges.json: %w", err)
	}
	var out []string
	for _, p := range doc.Prefixes {
		if p.Service == service {
			out = append(out, p.IPPrefix)
		}
	}
	for _, p := range doc.IPv6Prefixes {
		if p.Service == service {
			out = append(out, p.IPv6Prefix)
		}
	}
	if len(out) == 0 {
		return nil, fmt.Errorf("no %s prefixes in ip-ranges.json", service)
	}
	return out, nil
}

// normalize validates every entry as a CIDR (or bare IP), dedups and sorts.
// One bad entry fails the set — nothing unvetted may reach a rendered file.
func normalize(ranges []string) ([]string, error) {
	seen := map[string]bool{}
	var out []string
	for _, r := range ranges {
		r = strings.TrimSpace(r)
		if _, err := netip.ParsePrefix(r); err != nil {
			if _, err2 := netip.ParseAddr(r); err2 != nil {
				return nil, fmt.Errorf("invalid range %q", r)
			}
		}
		if !seen[r] {
			seen[r] = true
			out = append(out, r)
		}
	}
	sort.Strings(out)
	return out, nil
}

// cachePath is one provider's on-disk range file.
func cachePath(dataDir, provider string) string {
	return filepath.Join(dataDir, CacheDirName, provider+".txt")
}

// Store atomically persists a provider's validated ranges.
func Store(dataDir, provider string, ranges []string) error {
	dir := filepath.Join(dataDir, CacheDirName)
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(dir, ".realip-*.tmp")
	if err != nil {
		return err
	}
	tmpName := tmp.Name()
	defer os.Remove(tmpName)
	if _, err := tmp.WriteString(strings.Join(ranges, "\n") + "\n"); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Chmod(0o640); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Sync(); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	return os.Rename(tmpName, cachePath(dataDir, provider))
}

// Load reads a provider's cached ranges (re-validated — a tampered cache is
// treated as absent). Missing file → (nil, nil).
func Load(dataDir, provider string) ([]string, error) {
	raw, err := os.ReadFile(cachePath(dataDir, provider))
	if err != nil {
		if os.IsNotExist(err) {
			return nil, nil
		}
		return nil, err
	}
	lines, err := parseLines(raw)
	if err != nil {
		return nil, nil
	}
	out, err := normalize(lines)
	if err != nil {
		return nil, nil
	}
	return out, nil
}

// LoadAll merges every provider's cached ranges (missing/invalid caches skip
// silently — the render must never fail because a fetch hasn't happened yet).
func LoadAll(dataDir string, providers []string) []string {
	var all []string
	for _, p := range providers {
		if ranges, err := Load(dataDir, p); err == nil {
			all = append(all, ranges...)
		}
	}
	out, err := normalize(all)
	if err != nil {
		return nil
	}
	return out
}
