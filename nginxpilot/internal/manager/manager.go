// Package manager runs one sync loop per site (goroutine each) with
// startup jitter, exponential backoff on failure streaks, manual sync
// kicks, and diff-based SIGHUP reloads (spec §2, §6).
package manager

import (
	"context"
	"log/slog"
	"math/rand/v2"
	"os"
	"path/filepath"
	"reflect"
	"sync"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/certs"
	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/deploy"
	"github.com/kalevski/toolcase/nginxpilot/internal/nginxctl"
	gitsource "github.com/kalevski/toolcase/nginxpilot/internal/source/git"
	"github.com/kalevski/toolcase/nginxpilot/internal/state"
)

// syncTimeout bounds one sync attempt end-to-end (fetch + extract + swap).
const syncTimeout = 15 * time.Minute

// Manager owns the site loops.
type Manager struct {
	log   *slog.Logger
	store *state.Store

	mu       sync.Mutex
	cfg      *config.Config
	deployer *deploy.Deployer
	loops    map[string]*siteLoop
	wg       sync.WaitGroup
	ctx      context.Context
	syncFn   func(ctx context.Context, site config.Site, defaults config.Defaults, dataDir string, store *state.Store, dep *deploy.Deployer, log *slog.Logger) (*state.SiteState, error)

	// Managed mode (nginx.manage: true). engine is nil in generate-only mode.
	engine         *nginxctl.Engine
	certDir        string
	watchInterval  time.Duration
	reloadOnChange bool

	applyMu   sync.Mutex
	lastApply nginxctl.ApplyResult
	certIndex *certs.Index
}

type siteLoop struct {
	site     config.Site
	interval time.Duration
	cancel   context.CancelFunc
	kick     chan struct{}
	done     chan struct{}

	mu       sync.Mutex
	nextSync time.Time
	syncing  bool
}

// SiteStatus is the per-site JSON served by GET /status (spec §6).
type SiteStatus struct {
	Domain        string     `json:"domain"`
	SourceType    string     `json:"source_type"`
	SourceURL     string     `json:"source_url"`
	DeployedRef   string     `json:"deployed_ref,omitempty"`
	Bytes         int64      `json:"bytes"` // live current release size, cached per sync (task 739)
	LastSuccess   *time.Time `json:"last_success,omitempty"`
	LastError     string     `json:"last_error,omitempty"`
	LastErrorTime *time.Time `json:"last_error_time,omitempty"`
	FailureStreak int        `json:"failure_streak"`
	NeverSynced   bool       `json:"never_synced"`
	Syncing       bool       `json:"syncing"`
	NextSync      *time.Time `json:"next_sync,omitempty"`
}

// New builds a Manager for a validated config.
func New(cfg *config.Config, store *state.Store, log *slog.Logger) *Manager {
	m := &Manager{
		log:      log,
		store:    store,
		cfg:      cfg,
		deployer: deploy.New(cfg.DataDir, log),
		loops:    map[string]*siteLoop{},
		syncFn:   SyncSite,
	}
	if cfg.Nginx.Manage {
		m.engine = nginxctl.New(cfg, log)
		dir, err := cfg.Tls.ResolveDir()
		if err != nil {
			log.Warn("cert dir not resolvable; TLS resources will fall back to HTTP (or be disabled if required)", "error", err)
		}
		m.certDir = dir
		m.watchInterval = time.Duration(cfg.Tls.WatchInterval)
		m.reloadOnChange = cfg.Tls.ReloadOnChangeEnabled()
	}
	return m
}

// Run starts every site loop and blocks until ctx is cancelled and all
// loops have drained (graceful shutdown: in-flight swaps finish, in-flight
// downloads abort via context).
func (m *Manager) Run(ctx context.Context) {
	m.mu.Lock()
	m.ctx = ctx
	m.reconcileState()
	for i := range m.cfg.Sites {
		m.startLoop(m.cfg.Sites[i])
	}
	m.mu.Unlock()

	m.warnOrphans()

	// Managed mode: write the live nginx config and start watching for cert
	// renewals. nginx only ever receives config that passed `nginx -t`.
	if m.engine != nil {
		m.applyManaged(ctx)
		go m.runCertWatch(ctx)
	}

	<-ctx.Done()
	m.log.Info("shutting down, waiting for in-flight syncs")
	m.wg.Wait()
}

// reconcileState clears DeployedRef and HTTP validators for any site whose
// state records a deploy but whose current/ symlink resolves to nothing.
// Called once at startup (with m.mu held) before loops begin, so a daemon
// restarted after a manual rm of current/ self-heals on the first tick.
func (m *Manager) reconcileState() {
	for _, site := range m.cfg.Sites {
		if !m.deployer.CurrentExists(site.Domain) {
			st, err := m.store.Load(site.Domain)
			if err != nil || st.DeployedRef == "" {
				continue
			}
			m.log.Warn("state records a deploy but current is missing; clearing ref so next sync redeploys",
				"domain", site.Domain)
			st.DeployedRef, st.ETag, st.LastModified, st.ContentHash = "", "", "", ""
			st.DeployedBytes = 0
			_ = m.store.Save(st)
		}
	}
}

// startLoop must be called with m.mu held and m.ctx set.
func (m *Manager) startLoop(site config.Site) {
	loopCtx, cancel := context.WithCancel(m.ctx)
	sl := &siteLoop{
		site:     site,
		interval: site.Interval(m.cfg.Defaults),
		cancel:   cancel,
		kick:     make(chan struct{}, 1),
		done:     make(chan struct{}),
	}
	m.loops[site.Domain] = sl
	m.wg.Add(1)
	go m.loop(loopCtx, sl)
}

func (m *Manager) loop(ctx context.Context, sl *siteLoop) {
	defer m.wg.Done()
	defer close(sl.done)

	// Startup jitter avoids a thundering herd when many sites share an
	// interval (spec §2).
	first := jitter(sl.interval)
	sl.setNext(time.Now().UTC().Add(first))
	timer := time.NewTimer(first)
	defer timer.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-timer.C:
		case <-sl.kick:
			if !timer.Stop() {
				select {
				case <-timer.C:
				default:
				}
			}
		}

		streak := m.syncOnce(ctx, sl)
		if ctx.Err() != nil {
			return
		}

		// Exponential backoff on failure streaks: interval × 2^streak,
		// capped at 4× (spec Q19).
		delay := backoff(sl.interval, streak)
		sl.setNext(time.Now().UTC().Add(delay))
		timer.Reset(delay)
	}
}

func (m *Manager) syncOnce(ctx context.Context, sl *siteLoop) (streak int) {
	sl.setSyncing(true)
	defer sl.setSyncing(false)

	m.mu.Lock()
	dep := m.deployer
	dataDir := m.cfg.DataDir
	defaults := m.cfg.Defaults
	m.mu.Unlock()

	syncCtx, cancel := context.WithTimeout(ctx, syncTimeout)
	defer cancel()

	st, err := m.syncFn(syncCtx, sl.site, defaults, dataDir, m.store, dep, m.log)
	if err != nil {
		m.log.Error("sync failed", "domain", sl.site.Domain, "error", err,
			"failure_streak", st.FailureStreak)
	}
	return st.FailureStreak
}

func backoff(interval time.Duration, streak int) time.Duration {
	if streak <= 0 {
		return interval
	}
	if streak > 2 {
		streak = 2 // 2^2 = 4× cap
	}
	return interval * time.Duration(1<<streak)
}

func jitter(interval time.Duration) time.Duration {
	max := interval / 10
	if max > 10*time.Second {
		max = 10 * time.Second
	}
	if max <= 0 {
		return 0
	}
	return time.Duration(rand.Int64N(int64(max)))
}

// Kick triggers an immediate sync for a domain (POST /sync/<domain>).
// Returns false if the domain is not managed.
func (m *Manager) Kick(domain string) bool {
	m.mu.Lock()
	sl, ok := m.loops[domain]
	m.mu.Unlock()
	if !ok {
		return false
	}
	select {
	case sl.kick <- struct{}{}:
	default: // a kick is already pending
	}
	return true
}

// Status snapshots every managed site for the admin endpoint.
func (m *Manager) Status() []SiteStatus {
	m.mu.Lock()
	loops := make([]*siteLoop, 0, len(m.loops))
	for _, sl := range m.loops {
		loops = append(loops, sl)
	}
	sites := m.cfg.Sites
	m.mu.Unlock()

	byDomain := map[string]*siteLoop{}
	for _, sl := range loops {
		byDomain[sl.site.Domain] = sl
	}

	out := make([]SiteStatus, 0, len(sites))
	for _, site := range sites {
		sl := byDomain[site.Domain]
		if sl == nil {
			continue
		}
		st, err := m.store.Load(site.Domain)
		if err != nil {
			st = &state.SiteState{Domain: site.Domain}
		}
		status := SiteStatus{
			Domain:        site.Domain,
			SourceType:    site.Source.Type,
			SourceURL:     site.Source.URL,
			DeployedRef:   st.DeployedRef,
			Bytes:         st.DeployedBytes,
			LastError:     st.LastError,
			FailureStreak: st.FailureStreak,
			NeverSynced:   st.NeverSynced(),
		}
		if !st.LastSuccess.IsZero() {
			t := st.LastSuccess
			status.LastSuccess = &t
		}
		if !st.LastErrorTime.IsZero() {
			t := st.LastErrorTime
			status.LastErrorTime = &t
		}
		sl.mu.Lock()
		status.Syncing = sl.syncing
		if !sl.nextSync.IsZero() {
			t := sl.nextSync
			status.NextSync = &t
		}
		sl.mu.Unlock()
		out = append(out, status)
	}
	return out
}

// Config returns the live config under lock. Reload swaps the pointer
// wholesale, so callers always observe the current sites/upstreams/proxies —
// used by the admin /vhost endpoint to generate nginx config on demand.
func (m *Manager) Config() *config.Config {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.cfg
}

// Reload applies a freshly validated config: diff-based per spec §6.
// The caller guarantees newCfg passed validation — a config that fails
// validation must never reach here (reload rejected wholesale).
func (m *Manager) Reload(newCfg *config.Config) {
	m.mu.Lock()
	defer m.mu.Unlock()

	oldSites := map[string]config.Site{}
	for _, s := range m.cfg.Sites {
		oldSites[s.Domain] = s
	}
	newSites := map[string]config.Site{}
	for _, s := range newCfg.Sites {
		newSites[s.Domain] = s
	}

	m.cfg = newCfg
	m.deployer = deploy.New(newCfg.DataDir, m.log)

	// Removed sites: stop the loop; content stays on disk (orphan).
	for domain, sl := range m.loops {
		if _, keep := newSites[domain]; !keep {
			m.log.Warn("site removed from config; loop stopped, content kept on disk (orphan)",
				"domain", domain)
			sl.cancel()
			delete(m.loops, domain)
		}
	}

	for domain, site := range newSites {
		old, existed := oldSites[domain]
		sl, running := m.loops[domain]
		switch {
		case !existed || !running:
			// Added → loop starts, immediate first sync.
			m.log.Info("site added", "domain", domain)
			m.startLoop(site)
			m.loops[domain].kick <- struct{}{} // immediate first sync
		case !sameSite(old, site) || sl.interval != site.Interval(newCfg.Defaults):
			// Changed → restart loop. A source identity change is caught by
			// the fingerprint check inside the sync and forces a full resync.
			// We wait for the old loop's done channel before starting the new
			// one so two syncs never overlap on the same domain (BUG-3/BUG-6).
			m.log.Info("site changed, restarting loop", "domain", domain)
			sl.cancel()
			delete(m.loops, domain)
			go func(old *siteLoop, ns config.Site) {
				<-old.done
				m.mu.Lock()
				defer m.mu.Unlock()
				if _, exists := m.loops[ns.Domain]; exists {
					return // re-added by a concurrent Reload
				}
				m.startLoop(ns)
				m.loops[ns.Domain].kick <- struct{}{}
			}(sl, site)
		}
	}

	go m.warnOrphans()

	// Managed mode: re-render and reload nginx for the new config (off the lock
	// path — applyManaged reads m.Config()).
	m.triggerApply()
}

// sameSite compares sites ignoring provenance.
func sameSite(a, b config.Site) bool {
	a.File, b.File = "", ""
	return reflect.DeepEqual(a, b)
}

// warnOrphans logs site directories on disk that no configured domain owns
// (spec §6: warning while orphans exist; --prune-orphans deletes) and
// immediately removes stale git bare-repo caches (task 592, IMP-5/613).
func (m *Manager) warnOrphans() {
	m.mu.Lock()
	dep := m.deployer
	configured := map[string]bool{}
	for _, s := range m.cfg.Sites {
		configured[s.Domain] = true
	}
	m.mu.Unlock()

	orphans, err := dep.Orphans(configured)
	if err != nil {
		m.log.Warn("orphan scan failed", "error", err)
		return
	}
	for _, domain := range orphans {
		m.log.Warn("orphaned site content on disk (not in config); use --prune-orphans to delete",
			"domain", domain)
	}

	m.pruneGitCaches()
}

// pruneGitCaches removes git bare-repo cache dirs under cache/git/ that no
// configured site references, preventing unbounded growth when a site's URL
// or branch changes. Git caches are fully disposable — deleted caches are
// recloned on the next sync. Mirrors warnOrphans/PruneOrphans for sites
// (task 592, cross-ref task 613).
func (m *Manager) pruneGitCaches() {
	m.mu.Lock()
	dataDir := m.cfg.DataDir
	sites := m.cfg.Sites
	m.mu.Unlock()

	live := map[string]bool{}
	for _, site := range sites {
		if site.Source.Type == config.SourceGit {
			live[gitsource.CacheDir(site.Domain, dataDir, site.Source.URL, site.Source.Branch)] = true
		}
	}

	cacheBase := filepath.Join(dataDir, "cache", "git")
	entries, err := os.ReadDir(cacheBase)
	if os.IsNotExist(err) {
		return
	}
	if err != nil {
		m.log.Warn("git cache GC scan failed", "error", err)
		return
	}
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		dir := filepath.Join(cacheBase, e.Name())
		if !live[dir] {
			m.log.Info("removing stale git cache", "dir", e.Name())
			if err := os.RemoveAll(dir); err != nil {
				m.log.Warn("git cache GC remove failed", "dir", e.Name(), "error", err)
			}
		}
	}
}

// PruneOrphans deletes orphaned site content and state (--prune-orphans).
func (m *Manager) PruneOrphans() error {
	m.mu.Lock()
	dep := m.deployer
	configured := map[string]bool{}
	for _, s := range m.cfg.Sites {
		configured[s.Domain] = true
	}
	m.mu.Unlock()

	orphans, err := dep.Orphans(configured)
	if err != nil {
		return err
	}
	for _, domain := range orphans {
		m.log.Info("pruning orphaned site", "domain", domain)
		if err := dep.RemoveSite(domain); err != nil {
			return err
		}
		if err := m.store.Delete(domain); err != nil {
			return err
		}
	}
	return nil
}
