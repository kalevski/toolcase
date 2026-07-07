package logship

import (
	"sync"
	"time"
)

// ring is a bounded FIFO of entries with an entry cap AND a byte cap (G7).
// A full buffer drops the oldest entries and counts them — a dead destination
// must never block the intake or eat unbounded memory.
type ring struct {
	mu         sync.Mutex
	entries    []Entry
	head       int // index of the oldest entry
	count      int
	bytes      int64
	maxEntries int
	maxBytes   int64
	dropped    uint64
}

func newRing(maxEntries int, maxBytes int64) *ring {
	return &ring{
		entries:    make([]Entry, maxEntries),
		maxEntries: maxEntries,
		maxBytes:   maxBytes,
	}
}

// push appends an entry, evicting the oldest until both caps hold.
func (r *ring) push(e Entry) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if int64(len(e.Raw)) > r.maxBytes {
		r.dropped++ // a single entry larger than the whole buffer
		return
	}
	for r.count > 0 && (r.count == r.maxEntries || r.bytes+int64(len(e.Raw)) > r.maxBytes) {
		r.evictOldest()
		r.dropped++
	}
	tail := (r.head + r.count) % r.maxEntries
	r.entries[tail] = e
	r.count++
	r.bytes += int64(len(e.Raw))
}

// evictOldest must be called with r.mu held and r.count > 0.
func (r *ring) evictOldest() {
	r.bytes -= int64(len(r.entries[r.head].Raw))
	r.entries[r.head] = Entry{}
	r.head = (r.head + 1) % r.maxEntries
	r.count--
}

// popBatch removes and returns up to n oldest entries.
func (r *ring) popBatch(n int) []Entry {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.count == 0 {
		return nil
	}
	if n > r.count {
		n = r.count
	}
	out := make([]Entry, 0, n)
	for i := 0; i < n; i++ {
		out = append(out, r.entries[r.head])
		r.evictOldest()
	}
	return out
}

// requeue puts a failed batch back at the FRONT of the buffer (preserving
// order for the retry), dropping from its own front when the caps no longer
// hold — newer entries in the ring win over the oldest retried ones.
func (r *ring) requeue(batch []Entry) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := len(batch) - 1; i >= 0; i-- {
		e := batch[i]
		if r.count == r.maxEntries || r.bytes+int64(len(e.Raw)) > r.maxBytes {
			r.dropped += uint64(i + 1) // this entry and everything older
			return
		}
		r.head = (r.head - 1 + r.maxEntries) % r.maxEntries
		r.entries[r.head] = e
		r.count++
		r.bytes += int64(len(e.Raw))
	}
}

// addDropped records n entries lost outside the ring's own eviction path (e.g.
// a permanently-failed delivery), so status/dropped reflects all loss, not
// just buffer-full evictions.
func (r *ring) addDropped(n uint64) {
	r.mu.Lock()
	r.dropped += n
	r.mu.Unlock()
}

// stats returns (len, bytes, dropped, oldest event time).
func (r *ring) stats() (count int, bytes int64, dropped uint64, oldest time.Time) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.count > 0 {
		oldest = r.entries[r.head].TS
	}
	return r.count, r.bytes, r.dropped, oldest
}

func (r *ring) len() int {
	r.mu.Lock()
	defer r.mu.Unlock()
	return r.count
}
