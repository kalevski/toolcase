// Package certs discovers TLS certificates in a directory and watches it for
// renewals. nginxpilot only consumes certs — certbot/acme.sh/external tools
// issue and renew them; nginxpilot wires the discovered cert/key into resources
// and reloads nginx when they change.
//
// Two layouts are recognized per domain (first match wins), so a plain
// certbot/Let's Encrypt tree works with zero extra config:
//
//	<dir>/<domain>/fullchain.pem + privkey.pem   # certbot live layout
//	<dir>/<domain>.crt           + <domain>.key  # flat layout
package certs

import (
	"context"
	"crypto/sha256"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"
)

// Entry is a discovered cert/key pair for one domain.
type Entry struct {
	CertPath string
	KeyPath  string
	ModTime  time.Time
	// Names are the leaf certificate's SAN DNS names (lowercased), e.g.
	// ["webapp.mk", "*.webapp.mk"]. Empty when the cert could not be parsed —
	// matching then falls back to the directory/file-name key alone.
	Names []string
	// NotBefore/NotAfter are the leaf certificate's validity window and Issuer
	// its issuer CN. Parsed best-effort alongside Names: all three are zero when
	// the cert could not be parsed. Surfaced for the admin cert-listing API; the
	// apply path (For) never reads them.
	NotBefore time.Time
	NotAfter  time.Time
	Issuer    string
	// Serial is the leaf's serial number (lowercase hex) and FingerprintSHA256
	// the SHA-256 of its DER (lowercase hex). Both change on every issuance or
	// renewal, so a control plane can tell a renewed cert from the old one from
	// the listing alone. Empty when the cert could not be parsed.
	Serial            string
	FingerprintSHA256 string
}

// Cert pairs an index key with its Entry, for enumerating the whole index
// (Index.List) — the read-only cert-listing admin API. Domain is the
// directory/file-name key the entry was discovered under.
type Cert struct {
	Domain string
	Entry
}

// Match kinds for For's SAN fallback, ordered so a higher value wins.
const (
	matchNone = iota
	matchWildcard
	matchExact
)

// Index maps domains to their discovered cert/key pair. The zero/nil Index is
// usable: For always reports ok=false, so resources fall back to plain HTTP.
type Index struct {
	dir     string
	entries map[string]Entry
}

// Dir reports the directory the index was loaded from ("" for a nil/empty one).
func (i *Index) Dir() string {
	if i == nil {
		return ""
	}
	return i.dir
}

// For returns the cert and key paths for a domain, or ok=false when none is
// discovered. Matching is tried in order of decreasing precedence:
//
//  1. exact directory/file-name key (fast path; works even when the cert's
//     SANs could not be parsed),
//  2. exact SAN match (a multi-SAN cert listing the domain explicitly),
//  3. wildcard SAN match (e.g. *.webapp.mk covers test.webapp.mk).
//
// For wildcard candidates the most specific (longest) pattern wins; ties and
// equal-precedence matches are broken by sorted domain key for determinism.
func (i *Index) For(domain string) (cert, key string, ok bool) {
	if i == nil {
		return "", "", false
	}
	if e, ok := i.entries[domain]; ok {
		return e.CertPath, e.KeyPath, true
	}
	bestKind, bestSpec := matchNone, -1
	var best Entry
	for _, d := range i.Domains() { // sorted → deterministic selection
		e := i.entries[d]
		for _, name := range e.Names {
			kind := matchName(name, domain)
			if kind == matchNone {
				continue
			}
			if kind > bestKind || (kind == bestKind && len(name) > bestSpec) {
				bestKind, bestSpec, best = kind, len(name), e
			}
		}
	}
	if bestKind == matchNone {
		return "", "", false
	}
	return best.CertPath, best.KeyPath, true
}

// Get returns the entry indexed under exactly this directory/file-name key, with
// none of For's SAN fallback — for addressing one specific cert (the bundle
// export), where a wildcard or multi-SAN neighbour must never stand in.
func (i *Index) Get(domain string) (Entry, bool) {
	if i == nil {
		return Entry{}, false
	}
	e, ok := i.entries[domain]
	return e, ok
}

// matchName reports how pattern (a SAN DNS name) matches host: matchExact for
// an identical name, matchWildcard for an RFC 6125 wildcard (the leftmost label
// is "*", matching exactly one label — *.example.com covers a.example.com but
// not example.com nor a.b.example.com), else matchNone. Comparison is
// case-insensitive and ignores a trailing dot.
func matchName(pattern, host string) int {
	pattern = strings.ToLower(strings.TrimSuffix(pattern, "."))
	host = strings.ToLower(strings.TrimSuffix(host, "."))
	if pattern == host {
		return matchExact
	}
	if base, isWild := strings.CutPrefix(pattern, "*."); isWild {
		suffix := "." + base
		if left, found := strings.CutSuffix(host, suffix); found && left != "" && !strings.Contains(left, ".") {
			return matchWildcard
		}
	}
	return matchNone
}

// Domains lists the discovered domains (sorted), for logging/status.
func (i *Index) Domains() []string {
	if i == nil {
		return nil
	}
	out := make([]string, 0, len(i.entries))
	for d := range i.entries {
		out = append(out, d)
	}
	sort.Strings(out)
	return out
}

// List returns every indexed cert/key pair (key + Entry), sorted by domain key.
// The nil/empty Index yields an empty, non-nil slice. Unlike For it does no
// SAN-fallback matching — it's the inverse of Domains, for enumerating the index.
func (i *Index) List() []Cert {
	out := []Cert{}
	if i == nil {
		return out
	}
	for _, d := range i.Domains() { // sorted → deterministic order
		out = append(out, Cert{Domain: d, Entry: i.entries[d]})
	}
	return out
}

// ExpiringWithin returns every indexed cert whose leaf expires within d of
// now (strictly less than the threshold), sorted by domain key. Entries whose
// cert could not be parsed (zero NotAfter) are skipped — there is nothing to
// decide a renewal on.
func (i *Index) ExpiringWithin(now time.Time, d time.Duration) []Cert {
	out := []Cert{}
	for _, c := range i.List() {
		if c.NotAfter.IsZero() {
			continue
		}
		if c.NotAfter.Sub(now) < d {
			out = append(out, c)
		}
	}
	return out
}

// Fingerprint is a stable digest of (domain, key-mtime) pairs. It changes when
// a cert is added, removed, or renewed in place (renewals rewrite the same
// paths with a fresh mtime), so a watcher can cheaply detect renewals.
func (i *Index) Fingerprint() string {
	if i == nil || len(i.entries) == 0 {
		return ""
	}
	parts := make([]string, 0, len(i.entries))
	for d, e := range i.entries {
		parts = append(parts, d+"="+strconv.FormatInt(e.ModTime.UnixNano(), 10))
	}
	sort.Strings(parts)
	return strings.Join(parts, "\x00")
}

// Load scans dir and builds an Index. A missing directory is not an error — it
// yields an empty Index (resources with tls: auto fall back to HTTP, tls:
// required get quarantined). dir == "" also yields an empty Index.
func Load(dir string) (*Index, error) {
	idx := &Index{dir: dir, entries: map[string]Entry{}}
	if dir == "" {
		return idx, nil
	}
	entries, err := os.ReadDir(dir)
	if os.IsNotExist(err) {
		return idx, nil
	}
	if err != nil {
		return nil, fmt.Errorf("read cert dir: %w", err)
	}

	// First pass: certbot live layout (<domain>/fullchain.pem + privkey.pem).
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		domain := e.Name()
		cert := filepath.Join(dir, domain, "fullchain.pem")
		key := filepath.Join(dir, domain, "privkey.pem")
		if ci, ki := regularInfo(cert), regularInfo(key); ci != nil && ki != nil {
			idx.entries[domain] = newEntry(cert, key, ci, ki)
		}
	}

	// Second pass: flat layout (<domain>.crt + <domain>.key). The certbot
	// layout wins, so only fill domains not already discovered.
	for _, e := range entries {
		if e.IsDir() || !strings.HasSuffix(e.Name(), ".crt") {
			continue
		}
		domain := strings.TrimSuffix(e.Name(), ".crt")
		if _, exists := idx.entries[domain]; exists {
			continue
		}
		cert := filepath.Join(dir, e.Name())
		key := filepath.Join(dir, domain+".key")
		if ci, ki := regularInfo(cert), regularInfo(key); ci != nil && ki != nil {
			idx.entries[domain] = newEntry(cert, key, ci, ki)
		}
	}
	pruneLeafCache(idx)
	return idx, nil
}

// leafMeta is the parsed-leaf part of an Entry.
type leafMeta struct {
	names                 []string
	notBefore, notAfter   time.Time
	issuer, serial, print string
	parsed                bool
}

// leafKey identifies one on-disk version of a cert file: renewals rewrite the
// file, which changes its mtime and (almost always) size.
type leafKey struct {
	mtime int64
	size  int64
}

type leafCacheEntry struct {
	key  leafKey
	meta leafMeta
}

// leafCache memoizes parsed leaf metadata per cert path so the cert-watcher
// poll and GET /certs don't re-read and re-parse every PEM on each call. An
// entry is valid only while the file's (mtime, size) are unchanged; Load prunes
// paths that left the directory, so the cache is bounded by the cert count.
var leafCache = struct {
	sync.Mutex
	m map[string]leafCacheEntry
}{m: map[string]leafCacheEntry{}}

// newEntry builds an Entry for a cert/key pair, parsing the leaf cert's SANs and
// validity/issuer metadata best-effort (an unparseable cert still yields a
// usable Entry matchable by its directory/file-name key).
func newEntry(cert, key string, certInfo, keyInfo os.FileInfo) Entry {
	e := Entry{CertPath: cert, KeyPath: key, ModTime: keyInfo.ModTime()}
	m := cachedLeaf(cert, certInfo)
	if m.parsed {
		e.Names = m.names
		e.NotBefore, e.NotAfter = m.notBefore, m.notAfter
		e.Issuer, e.Serial, e.FingerprintSHA256 = m.issuer, m.serial, m.print
	}
	return e
}

func cachedLeaf(cert string, fi os.FileInfo) leafMeta {
	k := leafKey{mtime: fi.ModTime().UnixNano(), size: fi.Size()}
	leafCache.Lock()
	c, ok := leafCache.m[cert]
	leafCache.Unlock()
	if ok && c.key == k {
		return c.meta
	}
	var m leafMeta
	if leaf := parseLeaf(cert); leaf != nil {
		for _, n := range leaf.DNSNames {
			m.names = append(m.names, strings.ToLower(n))
		}
		m.notBefore, m.notAfter = leaf.NotBefore, leaf.NotAfter
		m.issuer = leaf.Issuer.CommonName
		if m.issuer == "" {
			m.issuer = leaf.Issuer.String()
		}
		m.serial = LeafSerial(leaf)
		m.print = LeafFingerprint(leaf)
		m.parsed = true
	}
	leafCache.Lock()
	leafCache.m[cert] = leafCacheEntry{key: k, meta: m}
	leafCache.Unlock()
	return m
}

// pruneLeafCache drops cache entries for certs no longer in the index.
func pruneLeafCache(idx *Index) {
	live := make(map[string]bool, len(idx.entries))
	for _, e := range idx.entries {
		live[e.CertPath] = true
	}
	leafCache.Lock()
	defer leafCache.Unlock()
	for p := range leafCache.m {
		if !live[p] {
			delete(leafCache.m, p)
		}
	}
}

// LeafSerial renders a certificate's serial number as lowercase hex, the form
// the admin API reports it in.
func LeafSerial(c *x509.Certificate) string {
	return strings.ToLower(c.SerialNumber.Text(16))
}

// LeafFingerprint is the lowercase-hex SHA-256 of a certificate's DER, the same
// value `openssl x509 -fingerprint -sha256` prints (without the colons).
func LeafFingerprint(c *x509.Certificate) string {
	sum := sha256.Sum256(c.Raw)
	return hex.EncodeToString(sum[:])
}

// parseLeaf parses the leaf certificate (the first CERTIFICATE block in a
// fullchain/flat PEM). Best-effort: a missing/unreadable/unparseable file yields
// nil, leaving the entry matchable only by its directory/file-name key.
func parseLeaf(certPath string) *x509.Certificate {
	data, err := os.ReadFile(certPath)
	if err != nil {
		return nil
	}
	for len(data) > 0 {
		var block *pem.Block
		block, data = pem.Decode(data)
		if block == nil {
			return nil
		}
		if block.Type != "CERTIFICATE" {
			continue
		}
		c, err := x509.ParseCertificate(block.Bytes)
		if err != nil {
			return nil
		}
		return c
	}
	return nil
}

// regularInfo stats path and returns its info, or nil unless it is a regular file.
func regularInfo(path string) os.FileInfo {
	fi, err := os.Stat(path)
	if err != nil || !fi.Mode().IsRegular() {
		return nil
	}
	return fi
}

// Watcher polls a cert directory and invokes onChange whenever the discovered
// set or any cert's mtime changes. Polling (rather than inotify) is the safe
// default — it works across bind-mounts/NFS where inotify is unreliable.
type Watcher struct {
	dir      string
	interval time.Duration
	log      *slog.Logger
	last     string
}

// NewWatcher builds a watcher over dir. last is the fingerprint of the index
// already applied at startup, so the first real change (not the initial state)
// triggers onChange.
func NewWatcher(dir string, interval time.Duration, last string, log *slog.Logger) *Watcher {
	return &Watcher{dir: dir, interval: interval, last: last, log: log}
}

// Poll loads the index once and reports whether it changed since the last call
// (or since the fingerprint the watcher was constructed with). Exposed so the
// loop is testable without real time.
func (w *Watcher) Poll() (changed bool, idx *Index, err error) {
	idx, err = Load(w.dir)
	if err != nil {
		return false, nil, err
	}
	fp := idx.Fingerprint()
	if fp == w.last {
		return false, idx, nil
	}
	w.last = fp
	return true, idx, nil
}

// Run polls on the interval until ctx is cancelled, calling onChange with the
// freshly loaded index on every detected change.
func (w *Watcher) Run(ctx context.Context, onChange func(*Index)) {
	if w.dir == "" || w.interval <= 0 {
		<-ctx.Done()
		return
	}
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			changed, idx, err := w.Poll()
			if err != nil {
				w.log.Warn("cert watch poll failed", "dir", w.dir, "error", err)
				continue
			}
			if changed {
				w.log.Info("cert change detected, reapplying", "dir", w.dir, "domains", len(idx.Domains()))
				onChange(idx)
			}
		}
	}
}
