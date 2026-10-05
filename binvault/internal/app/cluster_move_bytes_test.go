package app_test

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"regexp"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
)

// The target is asked for the disk the bucket really takes — the stored bytes of its blobs, each
// once, and of its open uploads' part files — not for the sum of the sizes of its versions: copies
// of an object share their blob, so the logical size of such a bucket is many times what moves.
func TestClusterMovePrepareAsksForTheStoredBytesOfTheBucket(t *testing.T) {
	f := newFaults()
	var asked atomic.Int64
	asked.Store(-1)
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 1 {
			o.PeerWrap = f.wrap
		}
	})
	a, b := tc.nodes[0], tc.nodes[1]
	f.set("prepare", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		raw, _ := io.ReadAll(r.Body)
		r.Body = io.NopCloser(bytes.NewReader(raw))
		var req struct {
			Bytes int64 `json:"bytes"`
		}
		_ = json.Unmarshal(raw, &req)
		asked.Store(req.Bytes)
		next.ServeHTTP(w, r)
	})
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "shared", "home": "a", "versioning": "enabled"})
	cr := a.token("shared", all, nil)
	const size, copies = 100 << 10, 5
	a.must(cr, 200, "PUT", "/shared/original", bytes.Repeat([]byte("o"), size))
	for i := 0; i < copies; i++ {
		a.must(cr, 200, "PUT", fmt.Sprintf("/shared/copy%d", i), nil, "x-amz-copy-source", "/shared/original")
	}
	// an open upload with one part
	init := a.must(cr, 200, "POST", "/shared/big?uploads", nil)
	uploadID := regexp.MustCompile(`<UploadId>([^<]+)</UploadId>`).FindStringSubmatch(string(init.body))[1]
	const partSize = 10 << 10
	a.must(cr, 200, "PUT", "/shared/big?partNumber=1&uploadId="+uploadID, bytes.Repeat([]byte("p"), partSize))

	bk, err := a.app.DB.Read().GetBucket(context.Background(), "shared")
	if err != nil {
		t.Fatal(err)
	}
	logical := bk.Bytes
	if logical < (copies+1)*size {
		t.Fatalf("the setup does not hold: the bucket counts %d bytes, want at least %d (the copies are versions of their own)", logical, (copies+1)*size)
	}

	id := startMove(t, a, "shared", "b", nil)
	mv := waitMove(t, a, id, 20*time.Second, "done", "failed")
	if mv["state"] != "done" {
		t.Fatalf("the move: %v", mv)
	}
	if got, want := asked.Load(), int64(size+partSize); got != want {
		t.Fatalf("the target was asked to find room for %d bytes; the bucket's blobs and part files take %d (its versions count %d)", got, want, logical)
	}
	if mv["bytes_total"].(float64) != float64(size+partSize) {
		t.Fatalf("bytes_total of the move: %v", mv["bytes_total"])
	}
	for _, n := range tc.nodes {
		n := n
		waitFor(t, 10*time.Second, n.name+" to serve the copies", func() bool {
			return n.s3(cr, "GET", "/shared/copy4", nil).status == 200
		})
	}
	_ = b
}

// binvault_move_freeze_seconds measures the freeze, not the move that follows it: it is observed when
// the target has taken the bucket over, before the hand-off wait and the cleanup (here the source is
// held right after it recorded that the bucket moved).
func TestClusterMoveFreezeSecondsEndWithTheCutover(t *testing.T) {
	var armed atomic.Bool
	armed.Store(true)
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		if i == 0 {
			o.MoverTuning.CrashPoint = func(p string) bool { return p == "moved" && armed.Load() }
		}
	})
	a := tc.nodes[0]
	ctx := context.Background()
	seedBucket(t, a, "frz", "a", 4)
	id := startMove(t, a, "frz", "c", nil)
	waitFor(t, 10*time.Second, "the source to record the move", func() bool {
		st, _ := a.app.DB.Read().GetMove(ctx, id)
		return st != nil && st.State == "moved"
	})
	if m := a.metric(t, "binvault_move_freeze_seconds_count"); !regexp.MustCompile(`outcome="done"\} 1\b`).MatchString(m) {
		t.Fatalf("the freeze was not observed before the cleanup: %q", m)
	}
	armed.Store(false)
	a = tc.restart(0, nil)
	tc.waitReady(15 * time.Second)
	if mv := waitMove(t, a, id, 20*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("the move after the restart: %v", mv)
	}
	// a move that ends in a process other than the one that froze the bucket does not know
	// the freeze: it observes nothing
	if m := a.metric(t, "binvault_move_freeze_seconds_count"); regexp.MustCompile(`outcome="done"\} [1-9]`).MatchString(m) {
		t.Fatalf("the restarted node observed a freeze it did not see: %q", m)
	}
}
