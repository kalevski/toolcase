package manager

import (
	"context"
	"io"
	"log/slog"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/deploy"
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
		deployer: deploy.New(dir, 3, logger),
		loops:    map[string]*siteLoop{},
		syncFn: func(ctx context.Context, site config.Site, dataDir string, st *state.Store, dep *deploy.Deployer, log *slog.Logger) (*state.SiteState, error) {
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
