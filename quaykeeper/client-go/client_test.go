package quaykeeper

import (
	"context"
	"net/http"
	"net/http/httptest"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

func testConfig(url string) Config {
	return Config{URL: url, Instance: "test-instance", Secret: "s"}
}

// TestWatchRetriesTransientFirstFetchError is bug 13: a transient failure on
// Watch's very first fetch (e.g. the control plane blips right as the client
// boots) must be retried on the ticker like any steady-state failure, not
// killed outright — only misconfiguration should return an error from Watch.
func TestWatchRetriesTransientFirstFetchError(t *testing.T) {
	var requests atomic.Int32
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		n := requests.Add(1)
		if n == 1 {
			w.WriteHeader(http.StatusInternalServerError) // the "blip"
			return
		}
		w.Header().Set("ETag", "v1")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"env":{},"flags":{},"logs":{"destinations":null},"version":"v1"}`))
	}))
	defer srv.Close()

	c := New(testConfig(srv.URL))
	ctx, cancel := context.WithTimeout(context.Background(), 2*time.Second)
	defer cancel()

	var mu sync.Mutex
	var got []Snapshot
	watchErr := make(chan error, 1)
	go func() {
		watchErr <- c.Watch(ctx, 30*time.Millisecond, func(s Snapshot) {
			mu.Lock()
			got = append(got, s)
			mu.Unlock()
		})
	}()

	deadline := time.Now().Add(1500 * time.Millisecond)
	for time.Now().Before(deadline) {
		mu.Lock()
		n := len(got)
		mu.Unlock()
		if n > 0 {
			break
		}
		time.Sleep(10 * time.Millisecond)
	}

	mu.Lock()
	n := len(got)
	mu.Unlock()
	if n == 0 {
		t.Fatal("cb was never called — Watch did not recover from the transient first-fetch error")
	}

	cancel()
	if err := <-watchErr; err != context.Canceled && err != context.DeadlineExceeded {
		t.Errorf("Watch returned %v, want a context error from cancellation", err)
	}
}

// TestWatchReturnsPermanentValidationError confirms Watch still fails fast on
// misconfiguration (the one case that should NOT be retried).
func TestWatchReturnsPermanentValidationError(t *testing.T) {
	c := New(Config{}) // missing everything
	err := c.Watch(context.Background(), time.Second, func(Snapshot) {})
	if err == nil {
		t.Fatal("expected a validation error for an empty Config")
	}
}

// TestFetchConfigConcurrentRace exercises FetchConfig from two goroutines
// against the same Client to prove etag access doesn't race (bug 13; run with
// -race).
func TestFetchConfigConcurrentRace(t *testing.T) {
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("ETag", "v1")
		w.WriteHeader(http.StatusOK)
		_, _ = w.Write([]byte(`{"env":{},"flags":{},"logs":{"destinations":null},"version":"v1"}`))
	}))
	defer srv.Close()

	c := New(testConfig(srv.URL))
	var wg sync.WaitGroup
	for i := 0; i < 20; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			_, _, _ = c.FetchConfig(context.Background())
		}()
	}
	wg.Wait()
}
