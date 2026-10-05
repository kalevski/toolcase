package cluster

import (
	"errors"
	"math/rand/v2"
	"runtime"
	"sync"
	"sync/atomic"
	"testing"
	"time"
)

// Four live nodes — their own goroutines, real HTTP, nudges — write concurrently
// while links drop and return; once the writers stop and the links are back every
// node holds the identical catalog (spec §8.9 "network partition: converge on
// healing").
func TestLiveClusterConvergesUnderWritesAndPartitions(t *testing.T) {
	if testing.Short() {
		t.Skip("slow")
	}
	c := newManual(t, 4, func(i int, sp *spec) { sp.start = true })
	waitReady(t, 10*time.Second, c...)
	var ids []string
	for _, n := range c {
		ids = append(ids, n.id())
	}

	stop := make(chan struct{})
	var wg sync.WaitGroup
	var writes atomic.Int64
	for i, n := range c {
		wg.Add(1)
		go func(i int, n *tnode) {
			defer wg.Done()
			rng := rand.New(rand.NewPCG(uint64(i)+100, 3))
			for {
				select {
				case <-stop:
					return
				default:
				}
				_, err := n.node.Write(ctxT(), randomDraft(rng, n.node, ids))
				switch {
				case err == nil:
					writes.Add(1)
				case errors.Is(err, ErrExists), errors.Is(err, ErrNotFound):
				default:
					t.Errorf("node %d: %v", i, err)
					return
				}
				time.Sleep(time.Duration(rng.IntN(8)) * time.Millisecond)
			}
		}(i, n)
	}
	// links drop and return
	wg.Add(1)
	go func() {
		defer wg.Done()
		rng := rand.New(rand.NewPCG(7, 7))
		for {
			select {
			case <-stop:
				return
			case <-time.After(60 * time.Millisecond):
			}
			n := c[rng.IntN(len(c))]
			n.down.Store(!n.down.Load())
		}
	}()
	time.Sleep(2500 * time.Millisecond)
	close(stop)
	wg.Wait()
	for _, n := range c {
		n.down.Store(false)
	}
	if writes.Load() < 50 {
		t.Fatalf("only %d writes happened", writes.Load())
	}

	eventually(t, 20*time.Second, "all four catalogs to be identical", func() bool {
		want := catalogOf(t, c[0].node)
		for _, n := range c[1:] {
			if !sameQuiet(want, catalogOf(t, n.node)) {
				return false
			}
		}
		return true
	})
	// they agree on what they have applied, too
	want := vvOf(t, c[0].node)
	eventually(t, 10*time.Second, "version vectors to agree", func() bool {
		for _, n := range c[1:] {
			got := vvOf(t, n.node)
			if len(got) != len(want) {
				return false
			}
			for o, s := range want {
				if got[o] != s {
					return false
				}
			}
		}
		return true
	})
	t.Logf("%d writes, %d registers, %d origins", writes.Load(), len(catalogOf(t, c[0].node)), len(want))
}

// A node that is draining or cordoned says so at once, not at the next hello.
func TestDrainingAndCordonAreAnnounced(t *testing.T) {
	// the periodic hello is an hour away: only the announcement can tell b
	slow := fastTuning()
	slow.HelloInterval = time.Hour
	c := newManual(t, 2, func(i int, sp *spec) { sp.start = true; sp.tune = &slow })
	waitReady(t, 10*time.Second, c...)
	a, b := c[0], c[1]
	peerOf := func(n *tnode, id string) PeerInfo {
		p, _ := n.node.PeerByID(id)
		return p
	}
	a.node.SetDraining(true)
	eventually(t, 3*time.Second, "b to hear that a is draining", func() bool { return peerOf(b, a.id()).Draining })
	if !a.node.Draining() || !a.node.Self().Draining {
		t.Fatal("Draining")
	}
	a.node.SetDraining(false)
	eventually(t, 3*time.Second, "b to hear that a is back", func() bool { return !peerOf(b, a.id()).Draining })

	if err := a.node.SetCordoned(ctxT(), true); err != nil {
		t.Fatal(err)
	}
	eventually(t, 3*time.Second, "b to hear about the cordon", func() bool { return peerOf(b, a.id()).Cordoned })
	if !a.node.Cordoned() {
		t.Fatal("Cordoned")
	}
	// the cordon survives a restart
	a.close()
	a2 := newTestNode(t, spec{name: "node1", dir: a.dir, urls: b.node.urls, noStart: true})
	if !a2.node.Cordoned() {
		t.Fatal("the cordon was not persisted")
	}
}

// The skew between two clocks is measured on hello and shown per node.
func TestClockSkewIsMeasured(t *testing.T) {
	ahead, base := newFakeClock(), newFakeClock()
	ahead.Advance(30 * time.Second)
	c := newManual(t, 2, func(i int, sp *spec) {
		if i == 0 {
			sp.clock = base
		} else {
			sp.clock = ahead
		}
	})
	settle(c...)
	p, ok := c[0].node.PeerByID(c[1].id())
	if !ok || p.ClockSkew < 29*time.Second || p.ClockSkew > 31*time.Second {
		t.Fatalf("skew %s", p.ClockSkew)
	}
	q, _ := c[1].node.PeerByID(c[0].id())
	if q.ClockSkew > -29*time.Second || q.ClockSkew < -31*time.Second {
		t.Fatalf("skew %s", q.ClockSkew)
	}
	// beyond BINVAULT_CLUSTER_MAX_CLOCK_SKEW a peer's new ops are held, but only its
	// ops: an honest origin keeps flowing
	ahead.Advance(10 * time.Minute)
	must(c[1].node.CreateBucket(ctxT(), "future", BucketEntry{Home: c[1].id()}))
	must(c[0].node.CreateBucket(ctxT(), "present", BucketEntry{Home: c[0].id()}))
	settle(c...)
	if _, ok := c[0].node.Bucket("future"); ok {
		t.Fatal("an op stamped 10 minutes ahead was applied")
	}
	if _, ok := c[1].node.Bucket("present"); !ok {
		t.Fatal("an honest origin was held up")
	}
	if h := c[0].node.HeldOps(); len(h) != 1 || h[0].Reason != "clock" || h[0].Peer != c[1].id() {
		t.Fatalf("%+v", h)
	}
	if p, _ := c[0].node.PeerByID(c[1].id()); p.Lag == 0 {
		t.Fatal("a held op shows as lag")
	}
	// the sender's clock is fixed (or ours catches up)
	base.Advance(10*time.Minute + 29*time.Second)
	settle(c...)
	if _, ok := c[0].node.Bucket("future"); !ok {
		t.Fatal("the held op was not applied once the clocks agreed")
	}
	if h := c[0].node.HeldOps(); len(h) != 0 {
		t.Fatalf("%+v", h)
	}
}

// Stop ends every goroutine the node started (discovery, one pull loop and one
// nudge loop per peer, compaction, the dispatcher).
func TestStopEndsEveryGoroutine(t *testing.T) {
	settleGoroutines := func() int {
		time.Sleep(50 * time.Millisecond)
		return runtime.NumGoroutine()
	}
	before := settleGoroutines()
	c := newManual(t, 3, func(i int, sp *spec) { sp.start = true })
	waitReady(t, 10*time.Second, c...)
	must(c[0].node.CreateBucket(ctxT(), "photos", BucketEntry{Home: c[0].id()}))
	if p := c[0].node.WaitReplicated(ctxT(), nil, time.Second); p != nil {
		t.Fatal(p)
	}
	eventually(t, 5*time.Second, "replication", func() bool { _, ok := c[2].node.Bucket("photos"); return ok })
	for _, n := range c {
		n.close() // cancels, Stop, closes the listener and the database
	}
	eventually(t, 5*time.Second, "the goroutines to end", func() bool { return runtime.NumGoroutine() <= before+3 })
}
