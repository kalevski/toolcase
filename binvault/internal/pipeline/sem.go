package pipeline

import (
	"context"
	"errors"
	"sync"
	"time"
)

// errNoCapacity is returned by sem.acquire when no slot freed up in time.
var errNoCapacity = errors.New("no free slot")

// sem is a counting semaphore whose limit can change while it is in use: the
// concurrency slots of one pipeline (limits.max_concurrency, spec §7.2).
type sem struct {
	mu    sync.Mutex
	limit int
	used  int
	// freed is closed, and replaced, whenever capacity may have appeared.
	freed chan struct{}
}

func newSem(limit int) *sem { return &sem{limit: limit, freed: make(chan struct{})} }

// setLimit changes the number of slots; calls in progress are unaffected.
func (s *sem) setLimit(n int) {
	s.mu.Lock()
	grew := n > s.limit
	s.limit = n
	if grew {
		s.wakeLocked()
	}
	s.mu.Unlock()
}

func (s *sem) wakeLocked() {
	close(s.freed)
	s.freed = make(chan struct{})
}

// tryAcquire takes a slot if one is free.
func (s *sem) tryAcquire() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.used < s.limit {
		s.used++
		return true
	}
	return false
}

// acquire takes a slot, waiting up to wait for one to free up. It returns
// errNoCapacity when the wait ran out and ctx's error when ctx ended first.
func (s *sem) acquire(ctx context.Context, wait time.Duration) error {
	var timer *time.Timer
	var expired <-chan time.Time
	for {
		s.mu.Lock()
		if s.used < s.limit {
			s.used++
			s.mu.Unlock()
			if timer != nil {
				timer.Stop()
			}
			return nil
		}
		ch := s.freed
		s.mu.Unlock()
		if wait <= 0 {
			return errNoCapacity
		}
		if timer == nil {
			timer = time.NewTimer(wait)
			expired = timer.C
		}
		select {
		case <-ch:
		case <-expired:
			return errNoCapacity
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		}
	}
}

// release returns a slot.
func (s *sem) release() {
	s.mu.Lock()
	if s.used > 0 {
		s.used--
	}
	s.wakeLocked()
	s.mu.Unlock()
}

// full reports whether no slot is free.
func (s *sem) full() bool {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.used >= s.limit
}

// inUse is the number of slots taken.
func (s *sem) inUse() int {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.used
}

// semMap holds one semaphore per pipeline name.
type semMap struct {
	mu sync.Mutex
	m  map[string]*sem
}

func newSemMap() *semMap { return &semMap{m: map[string]*sem{}} }

// of returns the pipeline's semaphore, creating it and applying the pipeline's
// current limit.
func (s *semMap) of(p *Pipe) *sem {
	s.mu.Lock()
	defer s.mu.Unlock()
	x := s.m[p.Name()]
	if x == nil {
		x = newSem(p.Def.Limits.MaxConcurrency)
		s.m[p.Name()] = x
		return x
	}
	x.setLimit(p.Def.Limits.MaxConcurrency)
	return x
}

// peek returns the semaphore if one exists.
func (s *semMap) peek(name string) *sem {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.m[name]
}

func (s *semMap) forget(name string) {
	s.mu.Lock()
	delete(s.m, name)
	s.mu.Unlock()
}
