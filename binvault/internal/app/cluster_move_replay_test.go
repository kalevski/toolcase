package app_test

import (
	"fmt"
	"net/http"
	"net/http/httptest"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
)

// A replayed `activate` of a move that is long finished must change nothing on the target.
//
// The target answers OK to the activation, but the answer never reaches the source (a proxy
// page, a lost packet): the source stays in `cutover` and asks again with a growing pause. The
// bucket is homed on B meanwhile, and B starts a second move of it (B -> C: nothing forbids it,
// the first move's record on B is `activated`, a final state). The replays reach B's `activated`
// branch; if completing the activation again reopened B's engine gate and pipelines, B would
// accept and acknowledge writes that the rows already sent to C do not contain, and C would
// activate without them.
func TestClusterMoveActivateReplayDoesNotReopenAMovedOnBucket(t *testing.T) {
	fb, fc := newFaults(), newFaults()
	tc := startClusterWith(t, 3, nil, func(i int, o *app.Options) {
		switch i {
		case 1:
			o.PeerWrap = fb.wrap
		case 2:
			o.PeerWrap = fc.wrap
		}
	})
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	cr := seedBucket(t, a, "replayb", "a", 5)

	// B serves its activation (it decides, writes the catalog, starts serving) but the answer is
	// lost: to A it looks like a proxy's error page, until the test lets it through
	var mu sync.Mutex
	garbled := 0
	letThrough := make(chan struct{})
	fb.set("activate", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		select {
		case <-letThrough:
			next.ServeHTTP(w, r)
			return
		default:
		}
		next.ServeHTTP(httptest.NewRecorder(), r) // the real handler runs: decision, hand-off, thaw
		mu.Lock()
		garbled++
		mu.Unlock()
		faultGarbage(w)
	})
	// C holds B's activation for a while: B stays in `cutover` of its second move
	holdC := make(chan struct{})
	fc.set("activate", func(n int, w http.ResponseWriter, r *http.Request, next http.Handler) {
		<-holdC
		next.ServeHTTP(w, r)
	})
	t.Cleanup(func() {
		select {
		case <-holdC:
		default:
			close(holdC)
		}
		select {
		case <-letThrough:
		default:
			close(letThrough)
		}
	})

	id1 := startMove(t, a, "replayb", "b", nil)
	waitMove(t, a, id1, 15*time.Second, "cutover")
	eventually(t, 10*time.Second, "b to be the home in the catalog", func() bool {
		h, e := bucketHome(t, a, "replayb")
		return h == "b" && e == 1
	})
	eventually(t, 10*time.Second, "b to serve", func() bool { return b.s3(cr, "GET", "/replayb/k000", nil).status == 200 })
	b.must(cr, 200, "PUT", "/replayb/written-on-b", []byte("first write on the new home"))

	// the admin moves it on, from b to c
	id2 := startMove(t, b, "replayb", "c", nil)
	waitMove(t, b, id2, 15*time.Second, "cutover")
	st1, _ := moveState(a, id1)
	mu.Lock()
	t.Logf("move 1 (a->b) is %s on a, move 2 (b->c) is in cutover on b; a keeps asking b: %d garbled answers so far", st1, garbled)
	mu.Unlock()

	// a's replays keep arriving at b, whose bucket is paused by its own move: no write may be
	// acknowledged now
	var acked []string
	for i := 0; i < 30; i++ {
		key := fmt.Sprintf("/replayb/during-cutover-%02d", i)
		if r := tc.nodes[i%3].s3(cr, "PUT", key, []byte("accepted while b was handing the bucket over")); r.status == 200 {
			acked = append(acked, key)
		}
		time.Sleep(60 * time.Millisecond)
	}
	close(holdC)
	close(letThrough)
	if mv := waitMove(t, b, id2, 30*time.Second, "done", "failed"); mv["state"] != "done" {
		t.Fatalf("move 2: %v", mv)
	}
	waitMove(t, a, id1, 30*time.Second, "done", "failed", "cancelled")
	lost := 0
	for _, key := range acked {
		if r := c.s3(cr, "GET", key, nil); r.status != 200 {
			lost++
			t.Logf("LOST: %s was acknowledged with 200 but GET now says %d", key, r.status)
		}
	}
	if len(acked) > 0 {
		t.Errorf("%d writes were acknowledged by b during its own cutover, %d of them are gone after c activated", len(acked), lost)
	}
}
