package manager

import (
	"context"
	"fmt"
	"log/slog"
	"os"
	"path/filepath"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/deploy"
	"github.com/kalevski/toolcase/nginxpilot/internal/source"
	gitsource "github.com/kalevski/toolcase/nginxpilot/internal/source/git"
	"github.com/kalevski/toolcase/nginxpilot/internal/source/httpzip"
	"github.com/kalevski/toolcase/nginxpilot/internal/state"
)

func (sl *siteLoop) setNext(t time.Time) {
	sl.mu.Lock()
	sl.nextSync = t
	sl.mu.Unlock()
}

func (sl *siteLoop) setSyncing(v bool) {
	sl.mu.Lock()
	sl.syncing = v
	sl.mu.Unlock()
}

// buildSource instantiates the right syncer for a site.
func buildSource(site config.Site, dataDir string, log *slog.Logger) (source.Source, error) {
	switch site.Source.Type {
	case config.SourceGit:
		return gitsource.New(site.Domain, site.Source, dataDir, log), nil
	case config.SourceHTTPZip:
		return httpzip.New(site.Domain, site.Source, dataDir, log), nil
	default:
		return nil, fmt.Errorf("unknown source type %q", site.Source.Type)
	}
}

// SyncSite runs the full sync pipeline for one site:
//
//	source check/fetch → non-empty + require_file gates → excludes →
//	atomic deploy → state update
//
// It is shared by the daemon loops and the one-shot `sync <domain>`
// subcommand. The returned state always reflects what was persisted —
// on failure it carries the recorded error and bumped failure streak
// (spec §4.5: any failure before the symlink rename leaves `current`
// untouched; the last good version keeps serving).
func SyncSite(ctx context.Context, site config.Site, defaults config.Defaults, dataDir string, store *state.Store, dep *deploy.Deployer, log *slog.Logger) (*state.SiteState, error) {
	st, err := store.Load(site.Domain)
	if err != nil {
		return &state.SiteState{Domain: site.Domain}, err
	}

	// Source identity change (URL/branch/auth) → treat as brand-new source,
	// full resync (spec §6 reload semantics).
	fp := site.Source.Fingerprint()
	if st.SourceFingerprint != "" && st.SourceFingerprint != fp {
		log.Info("source identity changed, forcing full resync", "domain", site.Domain)
		st.DeployedRef, st.ETag, st.LastModified, st.ContentHash = "", "", "", ""
		st.DeployedBytes = 0
	}
	st.SourceFingerprint = fp

	keep := site.KeepReleases(defaults)
	err = doSync(ctx, site, dataDir, keep, st, dep, log)
	if err != nil {
		st.FailureStreak++
		st.LastError = err.Error()
		st.LastErrorTime = time.Now().UTC()
		if saveErr := store.Save(st); saveErr != nil {
			log.Error("state save failed", "domain", site.Domain, "error", saveErr)
		}
		return st, err
	}

	st.FailureStreak = 0
	st.LastError = ""
	st.LastErrorTime = time.Time{}
	if saveErr := store.Save(st); saveErr != nil {
		log.Error("state save failed", "domain", site.Domain, "error", saveErr)
	}
	return st, nil
}

// doSync mutates st on success (deployed ref, validators, timestamps).
func doSync(ctx context.Context, site config.Site, dataDir string, keep int, st *state.SiteState, dep *deploy.Deployer, log *slog.Logger) error {
	src, err := buildSource(site, dataDir, log)
	if err != nil {
		return err
	}

	staging, err := dep.NewStaging(site.Domain)
	if err != nil {
		return fmt.Errorf("create staging dir: %w", err)
	}
	consumed := false
	defer func() {
		if !consumed {
			_ = os.RemoveAll(staging)
		}
	}()

	res, err := src.Sync(ctx, st, staging)
	if err != nil {
		return err
	}

	if !res.Changed && !dep.CurrentExists(site.Domain) {
		log.Warn("deployed ref recorded but current release missing; forcing resync", "domain", site.Domain)
		st.DeployedRef, st.ETag, st.LastModified, st.ContentHash = "", "", "", ""
		st.DeployedBytes = 0
		// re-run the source with cleared validators
		res, err = src.Sync(ctx, st, staging)
		if err != nil {
			return err
		}
	}

	if !res.Changed {
		// Cheap no-op (the common case) — still refresh validators so the
		// next conditional GET uses the freshest ones.
		st.ETag, st.LastModified = pick(res.ETag, st.ETag), pick(res.LastModified, st.LastModified)
		if res.ContentHash != "" {
			st.ContentHash = res.ContentHash
		}
		log.Debug("no change", "domain", site.Domain, "ref", st.DeployedRef)
		return nil
	}

	// Excludes run before the gates so a tree that is empty after
	// stripping (e.g. only .git metadata) fails the sanity check.
	removed, err := deploy.ApplyExcludes(staging, site.Exclude)
	if err != nil {
		return fmt.Errorf("apply excludes: %w", err)
	}
	if len(removed) > 0 {
		log.Debug("excluded entries", "domain", site.Domain, "count", len(removed))
	}

	// Default gate: staging contains at least one regular file (spec §4.1).
	n, err := deploy.CountRegularFiles(staging)
	if err != nil {
		return err
	}
	if n == 0 {
		return fmt.Errorf("staged content contains no regular files")
	}

	// Opt-in stricter gate (spec Q14 — index.html is not hardcoded).
	for _, required := range site.Source.RequireFile {
		p := filepath.Join(staging, filepath.FromSlash(required))
		fi, err := os.Stat(p)
		if err != nil || !fi.Mode().IsRegular() {
			return fmt.Errorf("require_file gate failed: %s missing from fetched content", required)
		}
	}

	releasePath, err := dep.Promote(site.Domain, res.Ref, staging, keep)
	if err != nil {
		return fmt.Errorf("deploy: %w", err)
	}
	consumed = true

	st.DeployedRef = res.Ref
	st.ETag = res.ETag
	st.LastModified = res.LastModified
	if res.ContentHash != "" {
		st.ContentHash = res.ContentHash
	}
	st.LastSuccess = time.Now().UTC()

	// Measure the freshly promoted release once and cache it on the state so
	// GET /status reports the deployed size without re-walking (task 739). A
	// measurement failure is non-fatal — the deploy already succeeded.
	if size, err := deploy.DirSize(releasePath); err != nil {
		log.Warn("measure deployed size failed", "domain", site.Domain, "error", err)
	} else {
		st.DeployedBytes = size
	}

	log.Info("deployed", "domain", site.Domain, "ref", res.Ref,
		"release", filepath.Base(releasePath), "files", n)
	return nil
}

func pick(a, b string) string {
	if a != "" {
		return a
	}
	return b
}
