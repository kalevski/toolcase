package logship

import (
	"context"
	"errors"
	"log/slog"
	"math/rand/v2"
	"sync"
	"sync/atomic"
	"time"
)

const (
	retryBaseDelay = 500 * time.Millisecond
	retryMaxDelay  = 30 * time.Second
)

// Shipper fans entries out to a reconfigurable set of destinations, each with its
// own filter, bounded ring buffer, batcher and sink. Best-effort: a dead
// destination accumulates counters, never blocks Dispatch.
type Shipper struct {
	log *slog.Logger

	mu      sync.Mutex
	workers map[string]*worker

	parseErrors atomic.Uint64
	received    atomic.Uint64
}

// NewShipper builds an empty shipper; call Configure to start destinations.
func NewShipper(log *slog.Logger) *Shipper {
	if log == nil {
		log = slog.Default()
	}
	return &Shipper{log: log, workers: map[string]*worker{}}
}

// Configure diffs desired destinations against running workers: unchanged specs
// keep their worker (and stats), changed ones restart, removed ones stop.
func (s *Shipper) Configure(dests []Destination) {
	s.mu.Lock()
	defer s.mu.Unlock()

	desired := map[string]*Destination{}
	for i := range dests {
		desired[dests[i].Name] = &dests[i]
	}
	for name, w := range s.workers {
		d, keep := desired[name]
		if keep && w.dest.SameSpec(d) {
			delete(desired, name)
			continue
		}
		w.stop()
		delete(s.workers, name)
		if !keep {
			s.log.Info("log destination stopped", "destination", name)
		}
	}
	for name, d := range desired {
		w, err := newWorker(d, s.log)
		if err != nil {
			s.log.Error("log destination failed to start", "destination", name, "error", err)
			w = brokenWorker(d, err)
		}
		s.workers[name] = w
		s.log.Info("log destination started", "destination", name, "type", d.Type)
	}
}

// Dispatch offers one entry to every destination (filter → sample → buffer).
func (s *Shipper) Dispatch(e Entry) {
	s.received.Add(1)
	if e.ParseError {
		s.parseErrors.Add(1)
	}
	s.mu.Lock()
	workers := make([]*worker, 0, len(s.workers))
	for _, w := range s.workers {
		workers = append(workers, w)
	}
	s.mu.Unlock()
	for _, w := range workers {
		w.offer(e)
	}
}

// Close stops every worker, flushing what it can within each sink's timeout.
func (s *Shipper) Close() {
	s.mu.Lock()
	workers := s.workers
	s.workers = map[string]*worker{}
	s.mu.Unlock()
	for _, w := range workers {
		w.stop()
	}
}

// Status snapshots per-destination shipping stats.
func (s *Shipper) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := Status{Received: s.received.Load(), ParseErrors: s.parseErrors.Load(), Destinations: []DestStatus{}}
	for _, w := range s.workers {
		out.Destinations = append(out.Destinations, w.status())
	}
	return out
}

// Status is the shipping-stats snapshot.
type Status struct {
	Received     uint64       `json:"received"`
	ParseErrors  uint64       `json:"parse_errors"`
	Destinations []DestStatus `json:"destinations"`
}

// DestStatus is one destination's shipping state.
type DestStatus struct {
	Name          string `json:"name"`
	Type          string `json:"type"`
	Shipped       uint64 `json:"shipped"`
	Dropped       uint64 `json:"dropped"`
	FailedBatches uint64 `json:"failed_batches"`
	BufferLen     int    `json:"buffer_len"`
	LastError     string `json:"last_error,omitempty"`
}

type worker struct {
	dest *Destination
	sink Sink
	buf  *ring
	log  *slog.Logger

	notify chan struct{}
	cancel context.CancelFunc
	done   chan struct{}

	mu            sync.Mutex
	shipped       uint64
	failedBatches uint64
	lastError     string

	startErr error
}

func newWorker(d *Destination, log *slog.Logger) (*worker, error) {
	sink, err := newSink(d)
	if err != nil {
		return nil, err
	}
	ctx, cancel := context.WithCancel(context.Background())
	w := &worker{
		dest:   d,
		sink:   sink,
		buf:    newRing(d.bufferEntries(), d.bufferBytes()),
		log:    log,
		notify: make(chan struct{}, 1),
		cancel: cancel,
		done:   make(chan struct{}),
	}
	go w.run(ctx)
	return w, nil
}

func brokenWorker(d *Destination, err error) *worker {
	w := &worker{dest: d, buf: newRing(1, 1), startErr: err, cancel: func() {}, done: make(chan struct{})}
	close(w.done)
	w.lastError = err.Error()
	return w
}

func (w *worker) offer(e Entry) {
	if w.startErr != nil {
		return
	}
	if !w.dest.Filter.Match(&e) {
		return
	}
	if s := w.dest.Sample; s > 0 && s < 1 && rand.Float64() >= s {
		return
	}
	w.buf.push(e)
	if w.buf.len() >= w.dest.batchSize() {
		select {
		case w.notify <- struct{}{}:
		default:
		}
	}
}

func (w *worker) run(ctx context.Context) {
	defer close(w.done)
	ticker := time.NewTicker(w.dest.flushInterval())
	defer ticker.Stop()
	for {
		select {
		case <-ctx.Done():
			flushCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			w.flushAll(flushCtx)
			cancel()
			_ = w.sink.Close()
			return
		case <-ticker.C:
		case <-w.notify:
		}
		w.flushAll(ctx)
	}
}

func (w *worker) flushAll(ctx context.Context) {
	for {
		batch := w.buf.popBatch(w.dest.batchSize())
		if len(batch) == 0 {
			return
		}
		if !w.deliver(ctx, batch) {
			return
		}
	}
}

func (w *worker) deliver(ctx context.Context, batch []Entry) bool {
	var lastErr error
	for attempt := 0; attempt <= w.dest.maxRetries(); attempt++ {
		if attempt > 0 {
			delay := retryBaseDelay << (attempt - 1)
			if delay > retryMaxDelay {
				delay = retryMaxDelay
			}
			var se *sendError
			if errors.As(lastErr, &se) && se.retryAfter > delay {
				delay = se.retryAfter
				if delay > retryMaxDelay {
					delay = retryMaxDelay
				}
			}
			select {
			case <-ctx.Done():
				w.buf.requeue(batch)
				return false
			case <-time.After(delay):
			}
		}
		err := w.sink.Send(ctx, batch)
		if err == nil {
			w.mu.Lock()
			w.shipped += uint64(len(batch))
			w.mu.Unlock()
			return true
		}
		lastErr = err
		var se *sendError
		if errors.As(err, &se) && se.permanent {
			w.recordFailure(err)
			return true
		}
	}
	w.recordFailure(lastErr)
	w.buf.requeue(batch)
	return false
}

func (w *worker) recordFailure(err error) {
	w.mu.Lock()
	w.failedBatches++
	w.lastError = err.Error()
	w.mu.Unlock()
	w.log.Warn("log batch delivery failed", "destination", w.dest.Name, "error", err)
}

func (w *worker) stop() {
	w.cancel()
	<-w.done
}

func (w *worker) status() DestStatus {
	count, _, dropped, _ := w.buf.stats()
	w.mu.Lock()
	defer w.mu.Unlock()
	return DestStatus{
		Name:          w.dest.Name,
		Type:          w.dest.Type,
		Shipped:       w.shipped,
		Dropped:       dropped,
		FailedBatches: w.failedBatches,
		BufferLen:     count,
		LastError:     w.lastError,
	}
}
