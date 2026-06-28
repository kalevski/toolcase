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
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"
	"time"
)

// Entry is a discovered cert/key pair for one domain.
type Entry struct {
	CertPath string
	KeyPath  string
	ModTime  time.Time
}

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
// discovered.
func (i *Index) For(domain string) (cert, key string, ok bool) {
	if i == nil {
		return "", "", false
	}
	e, ok := i.entries[domain]
	if !ok {
		return "", "", false
	}
	return e.CertPath, e.KeyPath, true
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
		if regular(cert) && regular(key) {
			idx.entries[domain] = Entry{CertPath: cert, KeyPath: key, ModTime: mtime(key)}
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
		if regular(cert) && regular(key) {
			idx.entries[domain] = Entry{CertPath: cert, KeyPath: key, ModTime: mtime(key)}
		}
	}
	return idx, nil
}

func regular(path string) bool {
	fi, err := os.Stat(path)
	return err == nil && fi.Mode().IsRegular()
}

func mtime(path string) time.Time {
	fi, err := os.Stat(path)
	if err != nil {
		return time.Time{}
	}
	return fi.ModTime()
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
