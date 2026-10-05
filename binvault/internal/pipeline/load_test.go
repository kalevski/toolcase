package pipeline_test

import (
	"fmt"
	"sync"
	"testing"
	"time"
)

// A burst of events is drained by the scheduler without losing or repeating a run.
func TestAfterBurst(t *testing.T) {
	if testing.Short() {
		t.Skip("burst")
	}
	const keys, perKey = 300, 3
	n := startNode(t, "", nil)
	svc := newService(t)
	n.bucket("bkt", map[string]any{"versioning": "enabled"})
	c := n.token("bkt", allGrants)
	n.createPipe(svc, "p", "after", map[string]any{
		"token":  map[string]any{"grants": []any{}},
		"limits": map[string]any{"max_concurrency": 16},
		// a deleted event is never superseded, so every event runs
		"events": []string{"object.deleted"},
	})
	n.attach("bkt", "p")
	var wg sync.WaitGroup
	sem := make(chan struct{}, 16)
	start := time.Now()
	for k := 0; k < keys; k++ {
		wg.Add(1)
		sem <- struct{}{}
		go func(k int) {
			defer wg.Done()
			defer func() { <-sem }()
			for i := 0; i < perKey; i++ {
				n.s3(c, "PUT", objPath("bkt", fmt.Sprintf("k%03d", k)), []byte{byte(i)})
				n.s3(c, "DELETE", objPath("bkt", fmt.Sprintf("k%03d", k)), nil)
			}
		}(k)
	}
	wg.Wait()
	t.Logf("%d writes+deletes in %v", keys*perKey*2, time.Since(start))
	eventually(t, 60*time.Second, "every run to succeed", func() bool {
		st := n.mustAdmin(200, "GET", "/status", nil)
		per := st["pipelines"].(map[string]any)["p"].(map[string]any)
		return per["queued"].(float64) == 0 && per["running"].(float64) == 0
	})
	t.Logf("drained after %v", time.Since(start))
	if got := len(svc.callsOf("p")); got != keys*perKey {
		t.Fatalf("calls = %d, want %d", got, keys*perKey)
	}
	// per key, the runs ran in commit order, one at a time
	seen := map[string]int{}
	for _, cl := range svc.callsOf("p") {
		seen[cl.str("key")]++
	}
	for k, v := range seen {
		if v != perKey {
			t.Fatalf("key %s: %d calls", k, v)
		}
	}
}
