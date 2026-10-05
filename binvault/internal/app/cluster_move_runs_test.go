package app_test

import (
	"fmt"
	"net/http"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
)

// A bulk run call that names a pipeline but no bucket (POST /runs/cancel {"pipeline": ...}) must not
// touch the runs of a bucket that is frozen for a move: the rows of the bucket have been exported
// already, so the new home would run again what the admin cancelled (or leave failed what the admin
// retried, whatever the answer said). Such runs are left alone and counted as `skipped`; the other
// buckets are served as usual.
func TestClusterMoveBulkRunCallsLeaveAFrozenBucketsRunsAlone(t *testing.T) {
	const keys = 6
	// each case: the pipeline, the state its runs are in, the bulk call, the answer's field and
	// the state the call puts the runs of the bucket that is served into
	for _, tcase := range []struct {
		name, pipeline, state, call, field, served string
	}{
		{"cancel", "hold", "queued", "cancel", "cancelled", "cancelled"},
		{"retry", "fp", "failed", "retry", "requeued", "failed"}, // retried, and failed again at once
	} {
		tcase := tcase
		t.Run(tcase.name, func(t *testing.T) {
			f := newFaults()
			tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
				if i == 1 {
					o.PeerWrap = f.wrap
				}
			})
			a, b := tc.nodes[0], tc.nodes[1]
			svc := newFsvc(t)
			svc.on["fp"] = func(*fcall) int { return 500 }
			// hold: paused, its runs stay queued; fp: fails at once, its runs end failed
			a.mustAdmin(201, "POST", "/pipelines?wait=replicated", pipeDef("hold", "after", svc.url("hold"), a.s3URL, map[string]any{"paused": true}))
			a.mustAdmin(201, "POST", "/pipelines?wait=replicated", pipeDef("fp", "after", svc.url("fp"), a.s3URL, map[string]any{
				"retry": map[string]any{"max_attempts": 1},
			}))
			for _, name := range []string{"movebkt", "otherbkt"} {
				a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": name, "home": "a"})
				a.mustAdmin(200, "PUT", "/buckets/"+name+"/pipelines", map[string]any{"items": []map[string]any{{"pipeline": tcase.pipeline, "enabled": true}}})
				cr := a.token(name, all, nil)
				for i := 0; i < keys; i++ {
					a.must(cr, 200, "PUT", fmt.Sprintf("/%s/k%03d", name, i), []byte("x"))
				}
			}
			count := func(n *cnode, bucket, state string) int {
				return len(items(t, n.mustAdmin(200, "GET", fmt.Sprintf("/runs?bucket=%s&pipeline=%s&state=%s&limit=500", bucket, tcase.pipeline, state), nil)))
			}
			for _, name := range []string{"movebkt", "otherbkt"} {
				name := name
				waitFor(t, 15*time.Second, "the runs of "+name, func() bool { return count(a, name, tcase.state) == keys })
			}

			// the rows are slow: the freeze lasts, and the snapshot has been taken when the call comes
			f.set("rows", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
				time.Sleep(2500 * time.Millisecond)
				next.ServeHTTP(w, r)
			})
			id := startMove(t, a, "movebkt", "b", nil)
			waitMove(t, a, id, 10*time.Second, "frozen")
			time.Sleep(400 * time.Millisecond)

			out := a.mustAdmin(200, "POST", "/runs/"+tcase.call, map[string]any{"pipeline": tcase.pipeline})
			if out[tcase.field] != float64(keys) || out["skipped"] != float64(keys) {
				t.Fatalf("a bulk %s by pipeline while a bucket is frozen: %v (want %d done, %d skipped)", tcase.call, out, keys, keys)
			}
			// the bucket that is served was changed; the frozen one was not
			waitFor(t, 15*time.Second, "the served bucket's runs", func() bool { return count(a, "otherbkt", tcase.served) == keys })
			if n := count(a, "movebkt", tcase.state); n != keys {
				t.Fatalf("the frozen bucket has %d runs that are %s, want %d: the call touched it", n, tcase.state, keys)
			}

			if mv := waitMove(t, a, id, 30*time.Second, "done", "failed"); mv["state"] != "done" {
				t.Fatalf("the move: %v", mv)
			}
			// the new home has the runs as they were when the rows were exported
			if n := count(b, "movebkt", tcase.state); n != keys {
				t.Fatalf("on the new home the moved bucket has %d runs that are %s, want %d", n, tcase.state, keys)
			}
			// and a bulk call after the move reaches them, on the node that has them now
			out = a.mustAdmin(200, "POST", "/runs/"+tcase.call, map[string]any{"pipeline": tcase.pipeline})
			if out[tcase.field].(float64) < keys || out["skipped"] != nil {
				t.Fatalf("a bulk %s after the move: %v", tcase.call, out)
			}
			tc.noAlarms()
		})
	}
}
