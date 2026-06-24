package manager

import (
	"context"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/deploy"
	gitsource "github.com/kalevski/toolcase/nginxpilot/internal/source/git"
	"github.com/kalevski/toolcase/nginxpilot/internal/state"
)

// TestReloadDrainsOldLoop verifies that after a site-changed Reload the new
// loop's first sync does not begin until the old loop's goroutine has exited
// (done channel closed). This prevents concurrent state-file and git-cache
// writes for the same domain (BUG-3 / BUG-6).
func TestReloadDrainsOldLoop(t *testing.T) {
	t.Parallel()

	var (
		// syncStarted receives the call number (1-based) each time syncFn starts.
		syncStarted = make(chan int, 10)
		// syncRelease is closed to unblock the first (blocking) sync.
		syncRelease = make(chan struct{})
	)
	var callCount int32

	dir := t.TempDir()
	store, err := state.NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	// Use a short interval so jitter is negligible (< 1 ms).
	interval := config.Duration(10 * time.Millisecond)

	makeSite := func(url string) config.Site {
		return config.Site{
			Domain: "example.com",
			Source: config.Source{Type: "git", URL: url, Interval: interval},
		}
	}

	cfg := &config.Config{
		DataDir: dir,
		Sites:   []config.Site{makeSite("fake://v1")},
	}

	m := &Manager{
		log:      logger,
		store:    store,
		cfg:      cfg,
		deployer: deploy.New(dir, logger),
		loops:    map[string]*siteLoop{},
		syncFn: func(ctx context.Context, site config.Site, defaults config.Defaults, dataDir string, st *state.Store, dep *deploy.Deployer, log *slog.Logger) (*state.SiteState, error) {
			n := int(atomic.AddInt32(&callCount, 1))
			syncStarted <- n
			if n == 1 {
				// Simulate a non-cancellable long sync: block until released
				// even if the context is cancelled.
				select {
				case <-syncRelease:
				case <-ctx.Done():
					<-syncRelease
				}
			}
			return &state.SiteState{Domain: site.Domain}, nil
		},
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go m.Run(ctx)

	// Wait for the first sync to start.
	select {
	case n := <-syncStarted:
		if n != 1 {
			t.Fatalf("expected call 1 first, got call %d", n)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timeout: first sync never started")
	}

	// Reload with a changed site URL — triggers the changed-site branch.
	newCfg := &config.Config{
		DataDir: dir,
		Sites:   []config.Site{makeSite("fake://v2")},
	}
	m.Reload(newCfg)

	// The new loop must not start its sync while the old one is still running.
	select {
	case n := <-syncStarted:
		t.Fatalf("new loop (call %d) started before old loop exited — drain missing", n)
	case <-time.After(100 * time.Millisecond):
		// Correct: new sync has not started while old sync is blocked.
	}

	// Unblock the old sync so the old goroutine can exit.
	close(syncRelease)

	// Now the new loop must start its first sync.
	select {
	case n := <-syncStarted:
		if n != 2 {
			t.Fatalf("expected call 2 after drain, got call %d", n)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("timeout: new loop's sync never started after old loop exited")
	}
}

// TestReconcileStateClearsStaleRef verifies that reconcileState clears
// DeployedRef (and related HTTP validators) when state says a deploy exists
// but the current/ symlink is absent from disk.
func TestReconcileStateClearsStaleRef(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	store, err := state.NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	domain := "example.com"

	// Seed state with a recorded deploy and HTTP validators, but leave the
	// current/ symlink absent (no releases directory either).
	seed := &state.SiteState{
		Domain:       domain,
		DeployedRef:  "abc123",
		ETag:         `"etag-val"`,
		LastModified: "Thu, 01 Jan 2026 00:00:00 GMT",
		ContentHash:  "deadbeef",
	}
	if err := store.Save(seed); err != nil {
		t.Fatal(err)
	}

	// Create the site directory WITHOUT a current symlink so CurrentExists → false.
	siteDir := filepath.Join(dir, "sites", domain)
	if err := os.MkdirAll(siteDir, 0o750); err != nil {
		t.Fatal(err)
	}

	cfg := &config.Config{
		DataDir: dir,
		Sites:   []config.Site{{Domain: domain, Source: config.Source{Type: "git", URL: "fake://x"}}},
	}
	m := &Manager{
		log:      logger,
		store:    store,
		cfg:      cfg,
		deployer: deploy.New(dir, logger),
		loops:    map[string]*siteLoop{},
		syncFn:   SyncSite,
	}

	m.reconcileState()

	got, err := store.Load(domain)
	if err != nil {
		t.Fatal(err)
	}
	if got.DeployedRef != "" {
		t.Errorf("DeployedRef not cleared: got %q", got.DeployedRef)
	}
	if got.ETag != "" {
		t.Errorf("ETag not cleared: got %q", got.ETag)
	}
	if got.LastModified != "" {
		t.Errorf("LastModified not cleared: got %q", got.LastModified)
	}
	if got.ContentHash != "" {
		t.Errorf("ContentHash not cleared: got %q", got.ContentHash)
	}
}

// TestPruneGitCaches verifies that pruneGitCaches removes cache dirs not
// referenced by any configured git site and leaves live ones untouched.
func TestPruneGitCaches(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	const domain = "example.com"
	const url = "https://github.com/example/repo.git"
	const branch = "main"

	// Create the cache/git/ directory and populate it.
	cacheBase := filepath.Join(dir, "cache", "git")
	if err := os.MkdirAll(cacheBase, 0o750); err != nil {
		t.Fatal(err)
	}

	// Live dir: what CacheDir produces for the configured site.
	liveDir := gitsource.CacheDir(domain, dir, url, branch)
	if err := os.MkdirAll(liveDir, 0o750); err != nil {
		t.Fatal(err)
	}

	// Stale dir: a leftover from a previously removed or identity-changed site.
	staleDir := filepath.Join(cacheBase, "deadbeefdeadbeef")
	if err := os.MkdirAll(staleDir, 0o750); err != nil {
		t.Fatal(err)
	}

	store, err := state.NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}

	cfg := &config.Config{
		DataDir: dir,
		Sites: []config.Site{
			{
				Domain: domain,
				Source: config.Source{Type: config.SourceGit, URL: url, Branch: branch},
			},
		},
	}
	m := &Manager{
		log:      logger,
		store:    store,
		cfg:      cfg,
		deployer: deploy.New(dir, logger),
		loops:    map[string]*siteLoop{},
		syncFn:   SyncSite,
	}

	m.pruneGitCaches()

	if _, err := os.Stat(liveDir); os.IsNotExist(err) {
		t.Error("live cache dir was incorrectly removed")
	}
	if _, err := os.Stat(staleDir); !os.IsNotExist(err) {
		t.Error("stale cache dir was not removed")
	}
}

// TestReconcileStateSkipsWhenCurrentExists verifies that reconcileState does
// not touch a site whose current/ symlink resolves to a real directory.
func TestReconcileStateSkipsWhenCurrentExists(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	store, err := state.NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	domain := "live.example.com"

	seed := &state.SiteState{
		Domain:      domain,
		DeployedRef: "live-sha",
	}
	if err := store.Save(seed); err != nil {
		t.Fatal(err)
	}

	// Build a valid current/ → releases/... structure.
	dep := deploy.New(dir, logger)
	releaseDir := filepath.Join(dep.SiteDir(domain), "releases", "20260101T000000-live-sha")
	if err := os.MkdirAll(releaseDir, 0o750); err != nil {
		t.Fatal(err)
	}
	if err := os.Symlink(filepath.Join("releases", "20260101T000000-live-sha"), dep.CurrentPath(domain)); err != nil {
		t.Fatal(err)
	}

	cfg := &config.Config{
		DataDir: dir,
		Sites:   []config.Site{{Domain: domain, Source: config.Source{Type: "git", URL: "fake://x"}}},
	}
	m := &Manager{
		log:      logger,
		store:    store,
		cfg:      cfg,
		deployer: dep,
		loops:    map[string]*siteLoop{},
		syncFn:   SyncSite,
	}

	m.reconcileState()

	got, err := store.Load(domain)
	if err != nil {
		t.Fatal(err)
	}
	if got.DeployedRef != "live-sha" {
		t.Errorf("DeployedRef must not be cleared when current/ exists; got %q", got.DeployedRef)
	}
}

// TestStatusNextSyncIsUTC guards the /status JSON timezone consistency: the
// loop must record next_sync in UTC so it matches last_success / last_error_time
// (both stored as UTC) rather than emitting a local-offset timestamp in the
// same payload.
func TestStatusNextSyncIsUTC(t *testing.T) {
	t.Parallel()

	dir := t.TempDir()
	store, err := state.NewStore(dir)
	if err != nil {
		t.Fatal(err)
	}
	logger := slog.New(slog.NewTextHandler(io.Discard, nil))

	// A long interval keeps the first tick far in the future: the loop sets
	// next_sync at startup and then blocks, so syncFn never runs in this window.
	site := config.Site{
		Domain: "example.com",
		Source: config.Source{Type: "git", URL: "fake://v1", Interval: config.Duration(time.Hour)},
	}
	m := &Manager{
		log:      logger,
		store:    store,
		cfg:      &config.Config{DataDir: dir, Sites: []config.Site{site}},
		deployer: deploy.New(dir, logger),
		loops:    map[string]*siteLoop{},
		syncFn: func(context.Context, config.Site, config.Defaults, string, *state.Store, *deploy.Deployer, *slog.Logger) (*state.SiteState, error) {
			return &state.SiteState{Domain: "example.com"}, nil
		},
	}

	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	m.mu.Lock()
	m.ctx = ctx
	m.startLoop(site)
	m.mu.Unlock()

	var ns *time.Time
	for i := 0; i < 200; i++ {
		s := m.Status()
		if len(s) == 1 && s[0].NextSync != nil {
			ns = s[0].NextSync
			break
		}
		time.Sleep(time.Millisecond)
	}
	if ns == nil {
		t.Fatal("next_sync was never set")
	}
	if loc := ns.Location(); loc != time.UTC {
		t.Fatalf("next_sync must be UTC for consistency with last_success/last_error_time, got %v", loc)
	}

	cancel()
	m.wg.Wait()
}
