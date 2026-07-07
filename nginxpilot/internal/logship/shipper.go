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

// Backoff bounds for failed batch deliveries.
const (
	retryBaseDelay = 500 * time.Millisecond
	retryMaxDelay  = 30 * time.Second
)

// Shipper fans entries out to a reconfigurable set of destinations, each with
// its own filter, bounded ring buffer, batcher and sink. Everything is
// best-effort: a dead destination accumulates counters, never blocks Dispatch.
type Shipper struct {
	log *slog.Logger

	mu      sync.Mutex
	workers map[string]*worker

	parseErrors atomic.Uint64
	received    atomic.Uint64
}

// NewShipper builds an empty shipper; call Configure to start destinations.
func NewShipper(log *slog.Logger) *Shipper {
	return &Shipper{log: log, workers: map[string]*worker{}}
}

// Configure diffs the desired destinations against the running workers:
// unchanged specs keep their worker (and stats), changed ones are restarted,
// removed ones are stopped. Never touches nginx — destinations hot-reload
// independently of the vhost render path.
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
			delete(desired, name) // unchanged — keep running
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
			s.workers[name] = w
			continue
		}
		s.workers[name] = w
		s.log.Info("log destination started", "destination", name, "type", d.Type)
	}
}

// Dispatch offers one entry to every destination (filter → sample → buffer).
// Non-blocking: a full buffer drops its oldest entry.
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

// Status snapshots per-destination shipping stats for /status and /logs/status.
func (s *Shipper) Status() Status {
	s.mu.Lock()
	defer s.mu.Unlock()
	out := Status{
		Received:     s.received.Load(),
		ParseErrors:  s.parseErrors.Load(),
		Destinations: []DestStatus{},
	}
	for _, w := range s.workers {
		out.Destinations = append(out.Destinations, w.status())
	}
	sortDestStatus(out.Destinations)
	return out
}

// Status is the `logs` object embedded in GET /status.
type Status struct {
	Received     uint64       `json:"received"`
	ParseErrors  uint64       `json:"parse_errors"`
	Destinations []DestStatus `json:"destinations"`
}

// DestStatus is one destination's shipping state.
type DestStatus struct {
	Name          string     `json:"name"`
	Type          string     `json:"type"`
	Shipped       uint64     `json:"shipped"`
	Dropped       uint64     `json:"dropped"`
	FailedBatches uint64     `json:"failed_batches"`
	BufferLen     int        `json:"buffer_len"`
	BufferBytes   int64      `json:"buffer_bytes"`
	LastError     string     `json:"last_error,omitempty"`
	LastErrorTime *time.Time `json:"last_error_time,omitempty"`
	LastFlush     *time.Time `json:"last_flush,omitempty"`
	// OldestBuffered surfaces backlog age so operators can see when a backing-
	// off destination risks falling outside Loki's ingester window (G9).
	OldestBuffered *time.Time `json:"oldest_buffered,omitempty"`
}

func sortDestStatus(ds []DestStatus) {
	for i := 1; i < len(ds); i++ {
		for j := i; j > 0 && ds[j].Name < ds[j-1].Name; j-- {
			ds[j], ds[j-1] = ds[j-1], ds[j]
		}
	}
}

// worker owns one destination: ring buffer + flush loop + sink.
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
	lastErrorTime time.Time
	lastFlush     time.Time

	// startErr marks a worker whose sink could not be built (bad CA file…);
	// it accepts and drops nothing, existing only to surface the error.
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

// brokenWorker records a destination that failed to start so /status shows it.
func brokenWorker(d *Destination, err error) *worker {
	w := &worker{
		dest:     d,
		buf:      newRing(1, 1),
		startErr: err,
		cancel:   func() {},
		done:     make(chan struct{}),
	}
	close(w.done)
	w.lastError = err.Error()
	w.lastErrorTime = time.Now().UTC()
	return w
}

// offer runs the filter + sampling and buffers a matching entry.
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
			// Final best-effort flush with a short budget.
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

// flushAll drains the buffer batch by batch until empty or a delivery fails.
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

// deliver sends one batch with bounded retries and exponential backoff,
// honouring server Retry-After hints. Returns false when the batch could not
// be delivered (it is requeued unless the failure was permanent).
func (w *worker) deliver(ctx context.Context, batch []Entry) bool {
	id := batchID() // one ID per batch — every retry attempt must reuse it (G8 dedupe)
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
		err := w.sink.Send(ctx, batch, id)
		if err == nil {
			w.mu.Lock()
			w.shipped += uint64(len(batch))
			w.lastFlush = time.Now().UTC()
			w.mu.Unlock()
			return true
		}
		lastErr = err
		var se *sendError
		if errors.As(err, &se) && se.permanent {
			w.recordFailure(err, len(batch), false)
			w.buf.addDropped(uint64(len(batch)))
			return true // batch dropped; keep draining
		}
	}
	w.recordFailure(lastErr, len(batch), true)
	w.buf.requeue(batch) // may itself drop (buffer full) — ring already counts that
	return false
}

func (w *worker) recordFailure(err error, batchLen int, requeued bool) {
	w.mu.Lock()
	w.failedBatches++
	w.lastError = err.Error()
	w.lastErrorTime = time.Now().UTC()
	w.mu.Unlock()
	w.log.Warn("log batch delivery failed", "destination", w.dest.Name,
		"entries", batchLen, "requeued", requeued, "error", err)
}

func (w *worker) stop() {
	w.cancel()
	<-w.done
}

func (w *worker) status() DestStatus {
	count, bytes, dropped, oldest := w.buf.stats()
	w.mu.Lock()
	defer w.mu.Unlock()
	ds := DestStatus{
		Name:          w.dest.Name,
		Type:          w.dest.Type,
		Shipped:       w.shipped,
		Dropped:       dropped,
		FailedBatches: w.failedBatches,
		BufferLen:     count,
		BufferBytes:   bytes,
		LastError:     w.lastError,
	}
	if !w.lastErrorTime.IsZero() {
		t := w.lastErrorTime
		ds.LastErrorTime = &t
	}
	if !w.lastFlush.IsZero() {
		t := w.lastFlush
		ds.LastFlush = &t
	}
	if count > 0 && !oldest.IsZero() {
		t := oldest.UTC()
		ds.OldestBuffered = &t
	}
	return ds
}

// TestDestination builds the destination's sink and pushes one synthetic test
// entry, returning the delivery error (nil = accepted). Backs the admin
// "Test connection" endpoint — the log-pipeline analog of POST /nginx/test.
func TestDestination(ctx context.Context, d *Destination) error {
	sink, err := newSink(d)
	if err != nil {
		return err
	}
	defer sink.Close()
	entry := ParseAccessLine([]byte(`{"ts":"`+time.Now().UTC().Format(time.RFC3339)+`","host":"nginxpilot.test","server_name":"nginxpilot.test","remote_addr":"127.0.0.1","method":"GET","path":"/nginxpilot-test","query":"","status":200,"bytes_sent":0,"request_time":0,"scheme":"https","protocol":"HTTP/1.1","referer":"","user_agent":"nginxpilot-test","resource":"nginxpilot.test","resource_type":"proxy","nginxpilot_test":true}`), ParseOptions{})
	return sink.Send(ctx, []Entry{entry}, batchID())
}
