package logship

import (
	"sync"
	"time"
)

// ring is a bounded FIFO of entries with an entry cap AND a byte cap. A full
// buffer drops the oldest entries and counts them — a dead destination must never
// block log capture or eat unbounded memory. (Ported from nginxpilot/internal/logship.)
type ring struct {
	mu         sync.Mutex
	entries    []Entry
	head       int
	count      int
	bytes      int64
	maxEntries int
	maxBytes   int64
	dropped    uint64
}

func newRing(maxEntries int, maxBytes int64) *ring {
	if maxEntries < 1 {
		maxEntries = 1
	}
	if maxBytes < 1 {
		maxBytes = 1
	}
	return &ring{entries: make([]Entry, maxEntries), maxEntries: maxEntries, maxBytes: maxBytes}
}

func (r *ring) push(e Entry) {
	r.mu.Lock()
	defer r.mu.Unlock()
	if int64(len(e.Raw)) > r.maxBytes {
		r.dropped++
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

func (r *ring) evictOldest() {
	r.bytes -= int64(len(r.entries[r.head].Raw))
	r.entries[r.head] = Entry{}
	r.head = (r.head + 1) % r.maxEntries
	r.count--
}

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

func (r *ring) requeue(batch []Entry) {
	r.mu.Lock()
	defer r.mu.Unlock()
	for i := len(batch) - 1; i >= 0; i-- {
		e := batch[i]
		if r.count == r.maxEntries || r.bytes+int64(len(e.Raw)) > r.maxBytes {
			r.dropped += uint64(i + 1)
			return
		}
		r.head = (r.head - 1 + r.maxEntries) % r.maxEntries
		r.entries[r.head] = e
		r.count++
		r.bytes += int64(len(e.Raw))
	}
}

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
