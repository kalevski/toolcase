package pipeline

import (
	"context"
	"log/slog"
	"math/rand/v2"
	"sync"
	"sync/atomic"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/obs"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

// Options configure New.
type Options struct {
	Config *config.Config
	DB     *meta.DB
	Engine *engine.Engine
	Ring   *seal.Keyring
	Log    *slog.Logger
	// Registry receives the pipeline metrics (spec §9.2); nil keeps them private.
	Registry *obs.Registry
	Version  string
	// NodeName is shown as `node` in run records.
	NodeName string
}

// Manager is the pipeline subsystem of one node (spec §7). Its state is of two
// kinds, kept apart so that a cluster can later give each home node its own
// copy of the first:
//
//   - persisted state, in package meta: definitions, attachments, runs,
//     backfills;
//   - node-local state, here: the pipeline and attachment caches, the pipeline
//     tokens, the concurrency slots, the scheduler and the backfill walkers.
type Manager struct {
	cfg  *config.Config
	db   *meta.DB
	eng  *engine.Engine
	ring *seal.Keyring
	log  *slog.Logger
	inv  *Invoker
	node string

	// Now is the clock; tests move it.
	Now func() time.Time
	rnd func() float64

	pipes *pipeCache
	atts  *attCache
	toks  *tokenRegistry
	sems  *semMap
	mt    *metrics

	sched *scheduler
	bf    *backfiller

	// editMu serialises edits of pipeline definitions (admin-rate), so that a
	// read-modify-write of stored secrets never races with another edit.
	editMu sync.Mutex

	// Cluster mode (cluster.go): cl is the node (nil on a single node), matMu
	// serialises the materialisation of catalog pipelines and pubMu the
	// publication of attachment names.
	cl    *cluster.Node
	matMu sync.Mutex
	pubMu sync.Mutex

	ctx           context.Context
	cancel        context.CancelFunc
	draining      atomic.Bool
	inflight      inflightGroup            // before chains and after calls in flight
	frz           *freezer                 // buckets being moved
	servedBy      func(bucket string) bool // cluster: does this node serve the bucket? (SetServedBy)
	unservedCache unservedCache
	started       atomic.Bool
}

// metrics are the pipeline metrics of spec §9.2.
type metrics struct {
	runs       *obs.CounterVec
	duration   *obs.HistogramVec
	retries    *obs.CounterVec
	rejections *obs.CounterVec
}

// New builds the manager. It does not start any work: call Start.
func New(o Options) (*Manager, error) {
	if o.Log == nil {
		o.Log = slog.Default()
	}
	if o.Registry == nil {
		o.Registry = obs.NewRegistry()
	}
	inv, err := NewInvoker(o.Config, o.Version, o.Log)
	if err != nil {
		return nil, err
	}
	m := &Manager{
		cfg: o.Config, db: o.DB, eng: o.Engine, ring: o.Ring, log: o.Log, inv: inv, node: o.NodeName,
		Now: time.Now, rnd: rand.Float64,
		pipes: newPipeCache(), atts: newAttCache(), sems: newSemMap(), frz: newFreezer(),
	}
	m.toks = newTokenRegistry(func() time.Time { return m.Now() })
	m.ctx, m.cancel = context.WithCancel(context.Background())
	r := o.Registry
	m.mt = &metrics{
		runs: r.Counter("binvault_pipeline_runs_total", "Pipeline runs by the state they reached.", "pipeline", "stage", "state"),
		duration: r.Histogram("binvault_pipeline_run_duration_seconds", "Duration of pipeline service calls.",
			[]float64{.005, .01, .025, .05, .1, .25, .5, 1, 2.5, 5, 10, 30, 60, 300, 1800}, "pipeline", "stage"),
		retries:    r.Counter("binvault_pipeline_retries_total", "Pipeline attempts that were retried.", "pipeline"),
		rejections: r.Counter("binvault_pipeline_rejections_total", "Writes and deletes rejected by a before pipeline.", "pipeline"),
	}
	r.GaugeFunc("binvault_pipeline_queue_depth", "Queued and running after runs per pipeline.", []string{"pipeline"}, m.queueDepth)
	m.sched = newScheduler(m)
	m.bf = newBackfiller(m)
	return m, nil
}

// SetOnRevoke registers a function told the access key id of every pipeline
// token that ends (the S3 server drops its cached signing keys with it).
func (m *Manager) SetOnRevoke(f func(id string)) { m.toks.onRevoke = f }

// queueDepth is the scrape-time gauge: the queued runs of each pipeline.
func (m *Manager) queueDepth() []obs.Sample {
	load, err := m.db.Read().OpenRunsByPipeline(context.Background())
	if err != nil {
		return nil
	}
	var out []obs.Sample
	seen := map[string]bool{}
	for _, p := range m.pipes.all() {
		seen[p.Name()] = true
		out = append(out, obs.Sample{Labels: []string{p.Name()}, Value: float64(load[p.Name()].Queued)})
	}
	for name, l := range load {
		if !seen[name] {
			out = append(out, obs.Sample{Labels: []string{name}, Value: float64(l.Queued)})
		}
	}
	return out
}

// Start loads the pipelines, puts the runs that were running at the last
// shutdown or crash back in the queue (spec §7.10) and starts the scheduler
// and the backfills that were walking.
func (m *Manager) Start(ctx context.Context) error {
	if !m.started.CompareAndSwap(false, true) {
		return nil
	}
	if err := m.loadAll(ctx); err != nil {
		return err
	}
	var requeued int64
	if err := m.db.Update(ctx, func(tx *meta.Tx) error {
		n, err := tx.RequeueRunning(ctx)
		requeued = n
		return err
	}); err != nil {
		return err
	}
	if requeued > 0 {
		m.log.Info("pipeline runs requeued after restart", "count", requeued)
	}
	m.sched.start()
	return m.bf.resume(ctx)
}

// loadAll builds every stored pipeline into the cache.
func (m *Manager) loadAll(ctx context.Context) error {
	after := ""
	for {
		ps, err := m.db.Read().ListPipelines(ctx, after, 200)
		if err != nil {
			return err
		}
		for _, rec := range ps {
			after = rec.Name
			p, err := open(m.ring, rec)
			if err != nil {
				m.log.Error("pipeline cannot be loaded", "pipeline", rec.Name, "error", err)
				continue
			}
			m.pipes.set(p)
		}
		if len(ps) < 200 {
			return nil
		}
	}
}

// Drain stops dispatching after runs and refuses new before chains (shutdown,
// spec §9.4). Calls in flight continue; Wait waits for them.
func (m *Manager) Drain() {
	m.draining.Store(true)
	m.sched.stopDispatch()
	m.bf.stopAll()
}

// Wait blocks until every call in flight has ended or ctx is done.
func (m *Manager) Wait(ctx context.Context) error {
	done := make(chan struct{})
	go func() { m.inflight.Wait(); close(done) }()
	select {
	case <-done:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

// Close aborts whatever is still in flight (their runs go back to the queue)
// and stops the background goroutines.
func (m *Manager) Close() {
	m.draining.Store(true)
	m.cancel()
	m.sched.stopDispatch()
	m.sched.wait()
	m.bf.stopAll()
	m.bf.wait()
}

// notify wakes the scheduler: runs may have become runnable.
func (m *Manager) notify() { m.sched.wakeUp() }

// Notify is the engine's After hook: a change committed.
func (m *Manager) Notify(ev *engine.Event) {
	if ev == nil {
		return
	}
	m.notify()
}

// SweepTokens drops expired pipeline tokens that were never revoked (spec §3.9).
func (m *Manager) SweepTokens() int { return m.toks.sweep() }

// Prune deletes finished runs older than the retention (spec §3.9) and returns
// how many it removed.
func (m *Manager) Prune(ctx context.Context) (int64, error) {
	cutoff := m.Now().Add(-m.cfg.PipelineRunRetention)
	var total int64
	for {
		var n int64
		err := m.db.Update(ctx, func(tx *meta.Tx) (err error) {
			n, err = tx.PruneRuns(ctx, cutoff, 1000)
			return err
		})
		if err != nil {
			return total, err
		}
		total += n
		if n < 1000 {
			return total, nil
		}
	}
}

// ---- small shared helpers ----------------------------------------------------------
