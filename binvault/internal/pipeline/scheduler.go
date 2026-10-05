package pipeline

import (
	"context"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// scheduler dispatches queued after runs (spec §7.10). The runnable rules live
// in one query (meta.RunnableRuns): a run is runnable when it is the first
// unfinished step of its group, its backoff time has passed, its attachment is
// enabled and no earlier group for the same (bucket, key) is unfinished.
// Pipelines that are disabled, paused or at max_concurrency are left out of
// the query. A single goroutine picks and claims runs; each claimed run
// executes in a goroutine of its own, at most BINVAULT_PIPELINE_WORKERS at a
// time.
type scheduler struct {
	m *Manager

	wake     chan struct{}
	stop     chan struct{}
	stopOnce sync.Once
	done     chan struct{}

	mu       sync.Mutex
	running  int
	workers  sync.WaitGroup
	loopOnce sync.Once
	started  bool
}

// safetyTick re-checks the queue even when no wake-up arrived.
const safetyTick = 5 * time.Second

func newScheduler(m *Manager) *scheduler {
	return &scheduler{m: m, wake: make(chan struct{}, 1), stop: make(chan struct{}), done: make(chan struct{})}
}

func (s *scheduler) start() {
	s.loopOnce.Do(func() {
		s.mu.Lock()
		s.started = true
		s.mu.Unlock()
		go s.loop()
	})
}

// wakeUp asks the loop to look at the queue.
func (s *scheduler) wakeUp() {
	select {
	case s.wake <- struct{}{}:
	default:
	}
}

// stopDispatch stops handing out runs; runs in flight continue.
func (s *scheduler) stopDispatch() { s.stopOnce.Do(func() { close(s.stop) }) }

// wait returns once the loop and every run in flight have ended.
func (s *scheduler) wait() {
	s.mu.Lock()
	started := s.started
	s.mu.Unlock()
	if started {
		<-s.done
	}
	s.workers.Wait()
}

func (s *scheduler) isStopped() bool {
	select {
	case <-s.stop:
		return true
	default:
		return false
	}
}

func (s *scheduler) loop() {
	defer close(s.done)
	timer := time.NewTimer(time.Hour)
	defer timer.Stop()
	tick := time.NewTicker(safetyTick)
	defer tick.Stop()
	for {
		next := s.dispatch()
		if !timer.Stop() {
			select {
			case <-timer.C:
			default:
			}
		}
		if !next.IsZero() {
			d := next.Sub(s.m.Now())
			if d < time.Millisecond {
				d = time.Millisecond
			}
			timer.Reset(d)
		}
		select {
		case <-s.stop:
			return
		case <-s.m.ctx.Done():
			return
		case <-s.wake:
		case <-timer.C:
		case <-tick.C:
		}
	}
}

// excluded names the pipelines whose runs must not be handed out now: held
// ones (disabled or paused) and those already running max_concurrency calls.
func (s *scheduler) excluded() []string {
	var out []string
	for _, p := range s.m.pipes.all() {
		if p.Held() {
			out = append(out, p.Name())
			continue
		}
		if sm := s.m.sems.peek(p.Name()); sm != nil && sm.full() {
			out = append(out, p.Name())
		}
	}
	return out
}

// dispatch hands out every run that can start now and returns the time of the
// earliest backoff still pending (zero if none).
func (s *scheduler) dispatch() time.Time {
	m := s.m
	for !s.isStopped() && m.ctx.Err() == nil {
		s.mu.Lock()
		free := m.cfg.PipelineWorkers - s.running
		s.mu.Unlock()
		if free <= 0 {
			break
		}
		now := m.Now()
		runs, err := m.db.Read().RunnableRunsOutside(m.ctx, now, s.excluded(), m.blockedBuckets(m.ctx), free)
		if err != nil {
			if m.ctx.Err() == nil {
				m.log.Error("pipeline scheduler: cannot list runnable runs", "error", err)
			}
			break
		}
		if len(runs) == 0 {
			break
		}
		type claim struct {
			run  *meta.Run
			sm   *sem
			ctx  context.Context
			done func()
			ok   bool
		}
		var claims []*claim
		for _, r := range runs {
			c := &claim{run: r}
			// a run of a bucket that froze, or that this node stopped serving, since the
			// query is not started
			if m.unserved(r.Bucket) {
				continue
			}
			var ok bool
			if c.ctx, c.done, ok = m.frz.reserve(m.ctx, r.Bucket, r.ID); !ok {
				continue
			}
			if p := m.pipes.get(r.Pipeline); p != nil {
				c.sm = m.sems.of(p)
				if !c.sm.tryAcquire() {
					c.done()
					continue // at capacity: the next pass excludes the pipeline
				}
			}
			claims = append(claims, c)
		}
		if len(claims) == 0 {
			break
		}
		err = m.db.Update(m.ctx, func(tx *meta.Tx) error {
			for _, c := range claims {
				ok, err := tx.MarkRunning(m.ctx, c.run, now)
				if err != nil {
					return err
				}
				c.ok = ok
			}
			return nil
		})
		started := 0
		for _, c := range claims {
			if err != nil || !c.ok {
				if c.sm != nil {
					c.sm.release()
				}
				c.done()
				continue
			}
			s.mu.Lock()
			s.running++
			s.mu.Unlock()
			s.workers.Add(1)
			m.inflight.Add(1)
			started++
			go s.runOne(c.ctx, c.done, c.run, c.sm)
		}
		if err != nil {
			if m.ctx.Err() == nil {
				m.log.Error("pipeline scheduler: cannot claim runs", "error", err)
			}
			break
		}
		if started == 0 {
			break
		}
	}
	next, err := m.db.Read().NextNotBefore(m.ctx, m.Now())
	if err != nil {
		return time.Time{}
	}
	return next
}

func (s *scheduler) runOne(ctx context.Context, done func(), run *meta.Run, sm *sem) {
	m := s.m
	defer func() {
		done() // after the outcome of the run has been recorded
		if sm != nil {
			sm.release()
		}
		s.mu.Lock()
		s.running--
		s.mu.Unlock()
		m.inflight.Done()
		s.workers.Done()
		s.wakeUp()
	}()
	defer func() {
		if r := recover(); r != nil {
			m.log.Error("pipeline run panicked", "run", run.ID, "pipeline", run.Pipeline, "panic", r)
			m.finishInternalError(run)
		}
	}()
	m.executeAfter(ctx, run)
}

// persistTimeout bounds one write that records how a run ended; persistRetry is
// the first pause before such a write is tried again.
var (
	persistTimeout = 30 * time.Second
	persistRetry   = 250 * time.Millisecond
)

// persistCtx is a context that outlives a shutdown for the writes that record
// how a run ended.
func (m *Manager) persistCtx() (context.Context, context.CancelFunc) {
	return context.WithTimeout(context.WithoutCancel(m.ctx), persistTimeout)
}
