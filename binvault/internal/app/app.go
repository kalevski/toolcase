// Package app wires binvault's packages into a running node: storage, the
// engine, both listeners and the background jobs (spec §2, §3.9, §9.4). The
// binary and the integration tests both start a node through it.
package app

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/admin"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/janitor"
	"github.com/kalevski/toolcase/binvault/internal/lifecycle"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/obs"
	"github.com/kalevski/toolcase/binvault/internal/pipeline"
	"github.com/kalevski/toolcase/binvault/internal/s3"
	"github.com/kalevski/toolcase/binvault/internal/seal"
	"github.com/kalevski/toolcase/binvault/internal/sigv4"
	"github.com/kalevski/toolcase/binvault/internal/store"
)

// Build identifies the binary.
type Build struct {
	Version string
	Commit  string
}

// App is one node.
type App struct {
	Cfg      *config.Config
	Log      *slog.Logger
	Build    Build
	Store    *store.Store
	DB       *meta.DB
	Ring     *seal.Keyring
	Eng      *engine.Engine
	Tokens   *auth.Store
	Pipes    *pipeline.Manager
	S3       *s3.Server
	Admin    *admin.Server
	Registry *obs.Registry
	NodeID   string
	Started  time.Time

	public   *httpx.Server
	admSrv   *httpx.Server
	limiters *s3.Limiters
	runner   *janitor.Runner
	bgStop   context.CancelFunc
	closeMu  sync.Once

	// cl is the cluster side of the node: nil on a single node (cluster.go).
	cl *clusterRT
}

// New opens the node's state and builds its servers; it does not listen yet
// except that the listener addresses are bound (so port conflicts fail now).
func New(ctx context.Context, cfg *config.Config, log *slog.Logger, b Build) (*App, error) {
	return NewWithOptions(ctx, cfg, log, b, Options{})
}

// NewWithOptions is New with the Options tests use to control a node.
func NewWithOptions(ctx context.Context, cfg *config.Config, log *slog.Logger, b Build, opts Options) (*App, error) {
	if log == nil {
		log = slog.Default()
	}
	a := &App{Cfg: cfg, Log: log, Build: b, Started: time.Now(), Registry: obs.NewRegistry()}

	st, err := store.Open(cfg.DataDir, cfg.Fsync)
	if err != nil {
		var inUse *store.InUseError
		if errors.As(err, &inUse) {
			return nil, err // already says "data dir <dir> is in use by another process"
		}
		return nil, fmt.Errorf("data dir: %w", err)
	}
	a.Store = st
	// a node that does not come up must not keep the data dir's lock (spec §3.1)
	if err := st.CheckSameFilesystem(); err != nil {
		st.Close()
		return nil, err
	}
	sync := "FULL"
	if !cfg.Fsync {
		sync = "NORMAL"
	}
	db, err := meta.Open(ctx, st.MetaPath(), meta.Options{Synchronous: sync})
	if err != nil {
		st.Close()
		return nil, fmt.Errorf("metadata database: %w", err)
	}
	a.DB = db
	fail := func(err error) (*App, error) {
		db.Close()
		st.Close()
		return nil, err
	}

	ring, err := seal.New(cfg.MasterKey, cfg.MasterKeyOld...)
	if err != nil {
		return fail(fmt.Errorf("master key: %w", err))
	}
	a.Ring = ring
	problems, _, err := CheckSealed(ctx, db, ring)
	if err != nil {
		return fail(err)
	}
	if len(problems) > 0 {
		return fail(fmt.Errorf("the master key cannot open %d sealed value(s) (wrong BINVAULT_MASTER_KEY, or the old key is missing from BINVAULT_MASTER_KEY_OLD):\n  %s",
			len(problems), strings.Join(problems, "\n  ")))
	}
	if a.NodeID, err = nodeID(ctx, db); err != nil {
		return fail(err)
	}

	a.Eng = engine.New(db, st, ring, engine.Config{
		MaxObjectBytes: cfg.MaxObjectBytes(), MinFreeBytes: cfg.MinFreeBytes(), GCGrace: cfg.GCGrace, Region: cfg.Region,
	}, log)
	a.Tokens = auth.NewStore(db, ring)
	if n, err := a.Eng.ReconcileUploads(ctx); err != nil {
		log.Warn("reconciling open uploads failed", "error", err)
	} else if n > 0 {
		log.Warn("aborted multipart uploads whose part files are missing (uploads/ not restored?)", "count", n)
	}
	pm, err := pipeline.New(pipeline.Options{
		Config: cfg, DB: db, Engine: a.Eng, Ring: ring, Log: log, Registry: a.Registry,
		Version: b.Version, NodeName: a.nodeName(),
	})
	if err != nil {
		return fail(fmt.Errorf("pipelines: %w", err))
	}
	a.Pipes = pm
	// the engine's integration points (spec §3.5, §7.9, §7.10)
	a.Eng.Hooks.Outbox, a.Eng.Hooks.After = pm.Outbox, pm.Notify
	a.Eng.Before, a.Eng.BeforeDelete, a.Eng.BeforeMatches = pm.Before, pm.BeforeDelete, pm.BeforeMatches

	if err := a.buildServers(opts); err != nil {
		return fail(err)
	}
	a.registerMetrics()
	return a, nil
}

// nodeID returns this node's identity, generated at first start and kept in
// meta.db so it travels with backups (spec §3.1).
func nodeID(ctx context.Context, db *meta.DB) (string, error) {
	var id string
	err := db.Update(ctx, func(tx *meta.Tx) error {
		v, err := tx.KVGet(ctx, "node_id")
		if err == nil {
			id = v
			return nil
		}
		if !errors.Is(err, meta.ErrNotFound) {
			return err
		}
		var raw [12]byte
		if _, err := rand.Read(raw[:]); err != nil {
			return err
		}
		id = "n_" + hex.EncodeToString(raw[:])
		return tx.KVSet(ctx, "node_id", id)
	})
	return id, err
}

func (a *App) nodeName() string {
	if a.Cfg.NodeName != "" {
		return a.Cfg.NodeName
	}
	return "local"
}

func (a *App) buildServers(opts Options) error {
	cfg := a.Cfg
	keyCache := sigv4.NewKeyCache(sigv4.DefaultKeyCacheSize)
	limiters := s3.NewLimiters()
	a.limiters = limiters
	a.S3 = &s3.Server{
		Eng: a.Eng, Tokens: a.Tokens, Cfg: cfg, Log: a.Log,
		Throttle: auth.NewThrottle(cfg.AuthFailLimit, time.Minute), KeyCache: keyCache,
		Metrics: s3.NewMetrics(a.Registry), Version: a.Build.Version, Commit: a.Build.Commit,
		Health: a.health, Limits: limiters, Pipes: a.Pipes,
	}
	a.Pipes.SetOnRevoke(keyCache.Invalidate)
	a.Admin = &admin.Server{
		Eng: a.Eng, Tokens: a.Tokens, Cfg: cfg, Log: a.Log, Metrics: a.Registry, KeyCache: keyCache,
		Throttle: auth.NewThrottle(cfg.AuthFailLimit, time.Minute), Version: a.Build.Version, Commit: a.Build.Commit,
		Started: a.Started, NodeID: a.NodeID, NodeName: a.nodeName(),
		Extra: a.Pipes.Routes, StatusExtra: a.Pipes.StatusExtra, PipelinesOf: a.Pipes.PipelinesOf,
		OnBucketDeleteTx: a.Pipes.BucketDeleting,
		OnBucketDeleted: func(name string) {
			limiters.ForgetBucket(name)
			a.Pipes.ForgetBucket(name)
		},
	}
	node := "" // the x-binvault-node of responses: set in a cluster only
	if cfg.ClusterEnabled() {
		if err := a.newCluster(opts); err != nil {
			return err
		}
		a.cl.wire()
		node = a.nodeName()
	}

	reqs := a.Registry.Counter("binvault_http_requests_total", "HTTP requests by operation and status.", "op", "status")
	dur := a.Registry.Histogram("binvault_http_request_duration_seconds", "Request duration by operation.", nil, "op")
	bytes := a.Registry.Counter("binvault_bytes_total", "Bytes received and sent in request and response bodies.", "direction")
	onDone := func(i *httpx.Info, d time.Duration) {
		op := i.Op
		if op == "" {
			op = "Unknown"
		}
		reqs.Inc(op, strconv.Itoa(i.Status))
		dur.Observe(d.Seconds(), op)
		bytes.Add(float64(i.InBytes.Load()), "in")
		bytes.Add(float64(i.OutBytes.Load()), "out")
	}
	quiet := func(r *http.Request) bool { return r.URL.Path == "/_healthz" }

	pubH := httpx.Wrap(a.S3, httpx.Options{Log: a.Log, Node: node, Trusted: cfg.TrustedProxies, IdleTimeout: cfg.BodyIdleTimeout, OnDone: onDone, Quiet: quiet})
	admH := httpx.Wrap(a.Admin, httpx.Options{Log: a.Log, Node: node, IdleTimeout: cfg.BodyIdleTimeout, OnDone: onDone})

	var err error
	a.public, err = httpx.NewServer(httpx.ServerConfig{Name: "s3", Addr: cfg.Listen, Handler: pubH, HeaderTimeout: cfg.HeaderTimeout,
		TLSCertFile: cfg.TLSCertFile, TLSKeyFile: cfg.TLSKeyFile, Log: a.Log})
	if err != nil {
		return fmt.Errorf("public listener: %w", err)
	}
	a.admSrv, err = httpx.NewServer(httpx.ServerConfig{Name: "admin", Addr: cfg.AdminListen, Handler: admH, HeaderTimeout: cfg.HeaderTimeout,
		TLSCertFile: cfg.AdminTLSCertFile, TLSKeyFile: cfg.AdminTLSKeyFile, Log: a.Log})
	if err != nil {
		a.public.Close()
		return fmt.Errorf("admin listener: %w", err)
	}
	if a.cl != nil {
		if err := a.cl.peerServer(opts.PeerListener, opts.PeerWrap, onDone); err != nil {
			a.public.Close()
			a.admSrv.Close()
			return err
		}
	}
	return nil
}

// PublicAddr and AdminAddr are the bound listener addresses (useful with port 0).
func (a *App) PublicAddr() string { return a.public.Addr().String() }
func (a *App) AdminAddr() string  { return a.admSrv.Addr().String() }

// health is the /_healthz check (spec §9.3): the database answers, the data dir
// is writable and free space is above the minimum. /_healthz is unauthenticated,
// so it names only the failing check (database, data dir not writable, low disk
// space); what failed, with paths and driver text, goes to the log.
func (a *App) health(ctx context.Context) string {
	if a.cl != nil && !a.cl.booted.Load() {
		return "starting" // a cluster node serves nothing until its start-up fence has ended (spec §9.3)
	}
	if _, err := a.DB.Version(ctx); err != nil {
		a.Log.Error("health check failed: the database does not answer", "error", err)
		return "database"
	}
	if err := a.Store.CheckWritable(); err != nil {
		a.Log.Error("health check failed: the data dir is not writable", "error", err)
		return "data dir not writable"
	}
	if free, err := a.Store.FreeBytes(); err == nil && int64(free) < a.Cfg.MinFreeBytes() {
		a.Log.Warn("health check failed: free disk space is below BINVAULT_MIN_FREE_MB", "free_bytes", free, "min_free_mb", a.Cfg.MinFreeMB)
		return "low disk space"
	}
	return ""
}

func (a *App) registerMetrics() {
	r := a.Registry
	r.GaugeFunc("binvault_disk_free_bytes", "Free bytes on the data directory's filesystem.", nil, func() []obs.Sample {
		free, _ := a.Store.FreeBytes()
		return []obs.Sample{{Value: float64(free)}}
	})
	r.GaugeFunc("binvault_blob_gc_pending", "Blobs waiting to be unlinked.", nil, func() []obs.Sample {
		n, _ := a.DB.Read().GCPending(context.Background())
		return []obs.Sample{{Value: float64(n)}}
	})
	r.GaugeFunc("binvault_multipart_open", "Open multipart uploads.", nil, func() []obs.Sample {
		n, _ := a.DB.Read().CountOpenUploads(context.Background(), "")
		return []obs.Sample{{Value: float64(n)}}
	})
	if a.Cfg.MetricsPerBucket {
		per := func(f func(b *meta.Bucket) float64) func() []obs.Sample {
			return func() []obs.Sample {
				var out []obs.Sample
				after := ""
				for {
					bs, err := a.DB.Read().ListBuckets(context.Background(), after, 500)
					if err != nil {
						return out
					}
					for _, b := range bs {
						after = b.Name
						out = append(out, obs.Sample{Labels: []string{b.Name}, Value: f(b)})
					}
					if len(bs) < 500 {
						return out
					}
				}
			}
		}
		r.GaugeFunc("binvault_objects", "Visible objects per bucket.", []string{"bucket"}, per(func(b *meta.Bucket) float64 { return float64(b.Objects) }))
		r.GaugeFunc("binvault_object_versions", "Version rows per bucket.", []string{"bucket"}, per(func(b *meta.Bucket) float64 { return float64(b.Versions) }))
		r.GaugeFunc("binvault_stored_bytes", "Logical bytes per bucket.", []string{"bucket"}, per(func(b *meta.Bucket) float64 { return float64(b.Bytes) }))
	} else {
		// without the bucket label the families stay, as node-wide sums (spec §9.2)
		total := func(f func(c meta.Counters) float64) func() []obs.Sample {
			return func() []obs.Sample {
				_, c, _ := a.DB.Read().Stats(context.Background())
				return []obs.Sample{{Value: f(c)}}
			}
		}
		r.GaugeFunc("binvault_objects", "Visible objects, all buckets.", nil, total(func(c meta.Counters) float64 { return float64(c.Objects) }))
		r.GaugeFunc("binvault_object_versions", "Version rows, all buckets.", nil, total(func(c meta.Counters) float64 { return float64(c.Versions) }))
		r.GaugeFunc("binvault_stored_bytes", "Logical bytes, all buckets.", nil, total(func(c meta.Counters) float64 { return float64(c.Bytes) }))
	}
	r.GaugeFunc("binvault_info", "Build information.", []string{"version", "commit", "go"}, func() []obs.Sample {
		return []obs.Sample{{Labels: []string{a.Build.Version, a.Build.Commit, runtime.Version()}, Value: 1}}
	})
}

// jobStartDelay is how long after boot the first lifecycle pass and the first
// scrub wait (spec §3.9): not at once, while the node is recovering, but soon, so
// that a long interval does not mean "never" on a node that restarts more often.
// A variable so that tests can shorten it.
var jobStartDelay = time.Minute

// startJobs launches the periodic maintenance jobs (spec §3.9).
func (a *App) startJobs(ctx context.Context) {
	cfg := a.Cfg
	r := &janitor.Runner{Log: a.Log}
	r.Add(janitor.Job{Name: "blob-gc", Interval: time.Minute, Fn: func(ctx context.Context) error {
		_, err := janitor.GC(ctx, a.DB, a.Store, cfg.GCGrace, time.Now())
		return err
	}})
	r.Add(janitor.Job{Name: "orphan-sweeper", Interval: time.Hour, RunAtStart: true, Fn: func(ctx context.Context) error {
		var keep func(string) bool
		if a.cl != nil {
			keep = a.cl.mv.ProtectedUpload
		}
		blobs, uploads, err := janitor.SweepOrphans(ctx, a.DB, a.Store, time.Hour, time.Now(), keep)
		if blobs+uploads > 0 {
			a.Log.Info("orphan sweep", "blobs", blobs, "uploads", uploads)
		}
		return err
	}})
	r.Add(janitor.Job{Name: "multipart-expiry", Interval: 10 * time.Minute, Fn: func(ctx context.Context) error {
		n, err := a.Eng.ExpireUploads(ctx, cfg.MultipartTTL)
		if n > 0 {
			a.Log.Info("expired multipart uploads", "count", n)
		}
		return err
	}})
	r.Add(janitor.Job{Name: "token-bookkeeping", Interval: time.Minute, Fn: func(ctx context.Context) error {
		a.Pipes.SweepTokens()
		return a.Tokens.Flush(ctx)
	}})
	r.Add(janitor.Job{Name: "run-pruning", Interval: time.Hour, RunAtStart: true, Fn: func(ctx context.Context) error {
		n, err := a.Pipes.Prune(ctx)
		if n > 0 {
			a.Log.Info("pruned pipeline runs", "count", n)
		}
		return err
	}})
	mism := a.Registry.Counter("binvault_scrub_mismatches_total", "Blobs that failed integrity verification.")
	if cfg.ScrubInterval > 0 {
		r.Add(janitor.Job{Name: "scrubber", Interval: cfg.ScrubInterval, RunAtStart: true, StartDelay: jobStartDelay, Fn: func(ctx context.Context) error {
			checked, bad, err := a.Eng.Scrub(ctx, func(o *meta.Object, err error) {
				mism.Inc()
				a.Log.Error("scrubber: integrity mismatch", "bucket", o.Bucket, "key", o.Key, "blob", o.BlobID, "error", err)
			})
			a.Log.Info("scrubber finished", "checked", checked, "mismatches", bad)
			return err
		}})
	}
	lc := lifecycle.NewWith(a.Eng, cfg.LifecycleBatch, a.Log, a.Registry, cfg.MetricsPerBucket)
	if a.cl != nil {
		// an orphan's data is kept as it is (spec §8.5); so is a bucket this node
		// cannot place in the catalog yet
		lc.Skip = func(name string) bool { return !a.cl.booted.Load() || !a.cl.serves(name) }
	}
	r.Add(janitor.Job{Name: "lifecycle", Interval: cfg.LifecycleInterval, RunAtStart: true, StartDelay: jobStartDelay, Fn: func(ctx context.Context) error {
		_, err := lc.Run(ctx, time.Now().Add(cfg.LifecycleInterval))
		return err
	}})
	a.runner = r
	r.Start(ctx)
}

// Run serves both listeners until ctx is cancelled, then shuts down
// gracefully (spec §9.4).
func (a *App) Run(ctx context.Context) error {
	bg, stop := context.WithCancel(context.Background())
	a.bgStop = stop
	a.startJobs(bg)
	if a.cl == nil {
		// a cluster node starts its pipelines after the start-up fence (cluster.go)
		if err := a.Pipes.Start(bg); err != nil {
			stop()
			a.Close()
			return fmt.Errorf("pipelines: %w", err)
		}
	}
	a.Log.Info("binvault listening", "s3", a.PublicAddr(), "admin", a.AdminAddr(), "node", a.nodeName(), "node_id", a.NodeID,
		"version", a.Build.Version, "data_dir", a.Cfg.DataDir)

	errc := make(chan error, 3)
	go func() { errc <- a.public.Serve() }()
	go func() { errc <- a.admSrv.Serve() }()
	if a.cl != nil {
		a.Log.Info("cluster mode", "peer", a.PeerAddr(), "peers", len(a.Cfg.ClusterURLs))
		// the peer listener serves before the node starts: the fence asks every URL
		// of the list, this node's own included, who answers there
		go func() { errc <- a.cl.peer.Serve() }()
		if err := a.cl.start(bg, errc); err != nil {
			stop()
			a.Close()
			return fmt.Errorf("cluster: %w", err)
		}
	}

	var serveErr error
	select {
	case <-ctx.Done():
	case serveErr = <-errc:
	}
	a.Log.Info("shutting down")
	a.S3.Draining.Store(true)
	if a.cl != nil {
		a.cl.drain() // peers answer 503 for our buckets at once (spec §9.4)
	}
	// stop dispatching after runs and starting before chains; calls in flight get
	// the grace period, with the S3 listener still up for their tokens, and the
	// rest stay queued (spec §9.4)
	a.Pipes.Drain()
	sctx, cancel := context.WithTimeout(context.Background(), a.Cfg.ShutdownTimeout)
	defer cancel()
	_ = a.Pipes.Wait(sctx)
	_ = a.public.Shutdown(sctx)
	_ = a.admSrv.Shutdown(sctx)
	if a.cl != nil {
		a.cl.shutdown(sctx)
	}
	a.Close()
	return serveErr
}

// Close stops background work and closes the database (checkpointing the WAL).
func (a *App) Close() {
	a.closeMu.Do(func() {
		if a.bgStop != nil {
			a.bgStop()
		}
		if a.Pipes != nil {
			a.Pipes.Close()
		}
		if a.runner != nil {
			a.runner.Wait()
		}
		if a.cl != nil && a.cl.mv != nil {
			a.cl.mv.Close() // a move past its cutover is left as it is: the next start finishes it
		}
		_ = a.Tokens.Flush(context.Background())
		if a.public != nil {
			_ = a.public.Close()
		}
		if a.admSrv != nil {
			_ = a.admSrv.Close()
		}
		if a.cl != nil {
			a.cl.close()
		}
		_ = a.DB.Close()
		_ = a.Store.Close() // last: the next process to start may open meta.db the moment the lock is gone (spec §3.1)
	})
}
