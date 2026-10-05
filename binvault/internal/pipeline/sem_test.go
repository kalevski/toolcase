package pipeline

import (
	"context"
	"errors"
	"sync"
	"testing"
	"time"
)

func TestSemLimit(t *testing.T) {
	s := newSem(2)
	if !s.tryAcquire() || !s.tryAcquire() || s.tryAcquire() {
		t.Fatal("two slots")
	}
	if !s.full() || s.inUse() != 2 {
		t.Fatal("full")
	}
	s.release()
	if s.full() || !s.tryAcquire() {
		t.Fatal("a released slot is reusable")
	}
}

func TestSemAcquireWaits(t *testing.T) {
	s := newSem(1)
	s.tryAcquire()
	start := time.Now()
	if err := s.acquire(context.Background(), 60*time.Millisecond); !errors.Is(err, errNoCapacity) {
		t.Fatalf("no capacity: %v", err)
	}
	if time.Since(start) < 50*time.Millisecond {
		t.Fatal("must wait the queue timeout")
	}
	if err := s.acquire(context.Background(), 0); !errors.Is(err, errNoCapacity) {
		t.Fatalf("zero wait: %v", err)
	}
	// freed while waiting
	go func() { time.Sleep(30 * time.Millisecond); s.release() }()
	if err := s.acquire(context.Background(), 2*time.Second); err != nil {
		t.Fatalf("acquire after release: %v", err)
	}
	// a cancelled context ends the wait
	ctx, cancel := context.WithCancel(context.Background())
	go func() { time.Sleep(30 * time.Millisecond); cancel() }()
	if err := s.acquire(ctx, 5*time.Second); !errors.Is(err, context.Canceled) {
		t.Fatalf("cancel: %v", err)
	}
}

func TestSemSetLimitWakesWaiters(t *testing.T) {
	s := newSem(1)
	s.tryAcquire()
	done := make(chan error, 1)
	go func() { done <- s.acquire(context.Background(), 5*time.Second) }()
	time.Sleep(30 * time.Millisecond)
	s.setLimit(2)
	if err := <-done; err != nil {
		t.Fatalf("a raised limit admits the waiter: %v", err)
	}
}

func TestSemConcurrentNeverExceedsLimit(t *testing.T) {
	s := newSem(3)
	var mu sync.Mutex
	cur, max := 0, 0
	var wg sync.WaitGroup
	for i := 0; i < 40; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			if err := s.acquire(context.Background(), 5*time.Second); err != nil {
				t.Error(err)
				return
			}
			mu.Lock()
			cur++
			if cur > max {
				max = cur
			}
			mu.Unlock()
			time.Sleep(2 * time.Millisecond)
			mu.Lock()
			cur--
			mu.Unlock()
			s.release()
		}()
	}
	wg.Wait()
	if max > 3 {
		t.Fatalf("limit exceeded: %d", max)
	}
}
