// Package httpzip implements the http-zip source (spec §4.2): conditional
// GET, streamed download with limits, optional checksum verification, and
// extraction hardened against zip-slip and zip-bombs.
package httpzip

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"time"

	"github.com/kalevski/toolcase/nginx-static-server/internal/config"
	"github.com/kalevski/toolcase/nginx-static-server/internal/source"
	"github.com/kalevski/toolcase/nginx-static-server/internal/state"
)

const maxRedirects = 5

// Syncer syncs one http-zip-backed site.
type Syncer struct {
	domain      string
	url         string
	checksumURL string
	strip       *int
	auth        config.Auth
	limits      config.Limits
	dataDir     string
	client      *http.Client
	log         *slog.Logger
}

// New builds a Syncer from a validated site source.
func New(domain string, src config.Source, dataDir string, log *slog.Logger) *Syncer {
	return &Syncer{
		domain:      domain,
		url:         src.URL,
		checksumURL: src.ChecksumURL,
		strip:       src.StripComponents,
		auth:        src.Auth,
		limits:      src.Limits.Effective(),
		dataDir:     dataDir,
		log:         log,
		client: &http.Client{
			CheckRedirect: func(req *http.Request, via []*http.Request) error {
				if len(via) >= maxRedirects {
					return fmt.Errorf("stopped after %d redirects", maxRedirects)
				}
				return nil
			},
		},
	}
}

// Type implements source.Source.
func (s *Syncer) Type() string { return config.SourceHTTPZip }

// Sync implements source.Source.
func (s *Syncer) Sync(ctx context.Context, st *state.SiteState, stagingDir string) (*source.Result, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.url, nil)
	if err != nil {
		return nil, err
	}
	if err := s.applyAuth(req); err != nil {
		return nil, err
	}
	// Conditional GET with stored validators (spec Q16).
	if st.ETag != "" {
		req.Header.Set("If-None-Match", st.ETag)
	}
	if st.LastModified != "" {
		req.Header.Set("If-Modified-Since", st.LastModified)
	}

	resp, err := s.client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("download: %w", err)
	}
	defer resp.Body.Close()

	switch {
	case resp.StatusCode == http.StatusNotModified:
		return &source.Result{Changed: false, Ref: st.DeployedRef, ETag: st.ETag, LastModified: st.LastModified}, nil
	case resp.StatusCode != http.StatusOK:
		io.Copy(io.Discard, io.LimitReader(resp.Body, 4096))
		return nil, fmt.Errorf("download: unexpected status %s", resp.Status)
	}

	etag := resp.Header.Get("ETag")
	lastModified := resp.Header.Get("Last-Modified")
	// Weak validators are treated as none (spec §4.2).
	if strings.HasPrefix(etag, "W/") {
		etag = ""
	}
	// Strong ETag matching the stored one → trust it, no re-hashing.
	if etag != "" && etag == st.ETag {
		return &source.Result{Changed: false, Ref: st.DeployedRef, ETag: etag, LastModified: lastModified}, nil
	}

	// Stream to tmp file, hashing as we go.
	tmpPath, bodyHash, size, err := s.download(resp.Body)
	if tmpPath != "" {
		defer os.Remove(tmpPath)
	}
	if err != nil {
		return nil, err
	}

	// No (strong) validators → content hash decides (spec Q16).
	if bodyHash == st.ContentHash && st.ContentHash != "" {
		return &source.Result{Changed: false, Ref: st.DeployedRef, ETag: etag, LastModified: lastModified, ContentHash: bodyHash}, nil
	}

	if s.checksumURL != "" {
		if err := s.verifyChecksum(ctx, bodyHash); err != nil {
			return nil, err
		}
	}

	if err := s.extract(tmpPath, size, stagingDir); err != nil {
		return nil, err
	}

	return &source.Result{
		Changed:      true,
		Ref:          bodyHash[:12],
		ETag:         etag,
		LastModified: lastModified,
		ContentHash:  bodyHash,
	}, nil
}

// download streams the body to <data_dir>/tmp/<domain>.zip.partial,
// enforcing max_archive_size and computing SHA-256 on the fly.
func (s *Syncer) download(body io.Reader) (path string, hash string, size int64, err error) {
	tmpDir := filepath.Join(s.dataDir, "tmp")
	if err := os.MkdirAll(tmpDir, 0o750); err != nil {
		return "", "", 0, err
	}
	path = filepath.Join(tmpDir, s.domain+".zip.partial")
	f, err := os.OpenFile(path, os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0o640)
	if err != nil {
		return "", "", 0, err
	}

	maxSize := int64(s.limits.MaxArchiveSize)
	hasher := sha256.New()
	// Read one byte past the limit so we can tell "exactly at limit" from
	// "exceeds limit".
	size, err = io.Copy(io.MultiWriter(f, hasher), io.LimitReader(body, maxSize+1))
	closeErr := f.Close()
	if err != nil {
		return path, "", 0, fmt.Errorf("download: %w", err)
	}
	if closeErr != nil {
		return path, "", 0, closeErr
	}
	if size > maxSize {
		return path, "", 0, fmt.Errorf("limit exceeded: max_archive_size (%s)", s.limits.MaxArchiveSize)
	}
	return path, hex.EncodeToString(hasher.Sum(nil)), size, nil
}

// verifyChecksum fetches checksum_url and hard-fails on mismatch (spec Q10).
func (s *Syncer) verifyChecksum(ctx context.Context, bodyHash string) error {
	ctx, cancel := context.WithTimeout(ctx, 30*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, s.checksumURL, nil)
	if err != nil {
		return err
	}
	if err := s.applyAuth(req); err != nil {
		return err
	}
	resp, err := s.client.Do(req)
	if err != nil {
		return fmt.Errorf("fetch checksum: %w", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("fetch checksum: unexpected status %s", resp.Status)
	}
	raw, err := io.ReadAll(io.LimitReader(resp.Body, 1024))
	if err != nil {
		return err
	}
	fields := strings.Fields(string(raw))
	if len(fields) == 0 {
		return errors.New("checksum file is empty")
	}
	expected := strings.ToLower(fields[0])
	if len(expected) != 64 {
		return fmt.Errorf("checksum file does not contain a SHA-256 hex digest")
	}
	if expected != bodyHash {
		return fmt.Errorf("checksum mismatch: expected %s, got %s", expected, bodyHash)
	}
	return nil
}

func (s *Syncer) applyAuth(req *http.Request) error {
	switch s.auth.MethodOrNone() {
	case config.AuthNone:
		return nil
	case config.AuthBearer:
		token, err := config.ResolveSecret(s.auth.TokenEnv, s.auth.TokenFile)
		if err != nil {
			return fmt.Errorf("resolve bearer token: %w", err)
		}
		req.Header.Set("Authorization", "Bearer "+token)
	case config.AuthBasic:
		password, err := config.ResolveSecret(s.auth.PasswordEnv, s.auth.PasswordFile)
		if err != nil {
			return fmt.Errorf("resolve basic password: %w", err)
		}
		req.SetBasicAuth(s.auth.Username, password)
	case config.AuthHeader:
		value, err := config.ResolveSecret(s.auth.ValueEnv, s.auth.ValueFile)
		if err != nil {
			return fmt.Errorf("resolve header value: %w", err)
		}
		req.Header.Set(s.auth.Name, value)
	}
	return nil
}
