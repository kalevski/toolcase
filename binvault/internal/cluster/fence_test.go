package cluster

import (
	"context"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
)

func fenceOf(d time.Duration) func(*config.Config) {
	return func(c *config.Config) { c.ClusterStartupFence = d }
}

func waitReady(t *testing.T, d time.Duration, nodes ...*tnode) {
	t.Helper()
	for _, n := range nodes {
		ctx, cancel := context.WithTimeout(context.Background(), d)
		err := n.node.WaitReady(ctx)
		cancel()
		if err != nil {
			t.Fatalf("%s: the start-up fence never passed (%v)", n.node.Name(), err)
		}
	}
}

// A node restored from an old backup restarts with a lower seq than its peers
// hold. The fence pulls its own ops back from every peer before it accepts a
// write, so a sequence number is never reused (spec §8.5, §9.5).
func TestFenceRestoreFromOldBackup(t *testing.T) {
	la, ua := listener(t)
	lb, ub := listener(t)
	urls := []string{ua, ub}
	ctx := ctxT()
	a := newTestNode(t, spec{name: "a", l: la, urls: urls, start: true, cfg: fenceOf(10 * time.Second)})
	b := newTestNode(t, spec{name: "b", l: lb, urls: urls, start: true, cfg: fenceOf(10 * time.Second)})
	waitReady(t, 5*time.Second, a, b)

	must(a.node.CreateBucket(ctx, "one", BucketEntry{Home: a.id()}))
	backup := t.TempDir()
	if err := a.db.Backup(ctx, filepath.Join(backup, "meta.db")); err != nil {
		t.Fatal(err)
	}
	must(a.node.CreateBucket(ctx, "two", BucketEntry{Home: a.id()}))
	last := must(a.node.CreateBucket(ctx, "three", BucketEntry{Home: a.id()}))
	if p := a.node.WaitReplicated(ctx, []Op{last}, 5*time.Second); len(p) != 0 {
		t.Fatalf("%v", p)
	}
	idA := a.id()
	addr := la.Addr().String()
	a.close()

	restored := newTestNode(t, spec{name: "a", dir: backup, l: rebind(t, addr), urls: urls, noStart: true, cfg: fenceOf(10 * time.Second)})
	if restored.id() != idA {
		t.Fatal("a restore keeps the node id")
	}
	if got := vvOf(t, restored.node)[idA]; got != 1 {
		t.Fatalf("the backup holds %d ops of the node's own stream, want 1", got)
	}
	if restored.node.Ready() {
		t.Fatal("not started yet")
	}
	if _, err := restored.node.CreateBucket(ctx, "early", BucketEntry{Home: idA}); !errors.Is(err, ErrNotReady) {
		t.Fatalf("a write before the fence: %v", err)
	}
	restored.start()
	waitReady(t, 5*time.Second, restored)

	if got := vvOf(t, restored.node)[idA]; got != 3 {
		t.Fatalf("the fence did not bring the node's own ops back: seq %d, peers hold 3", got)
	}
	if done, silent, stream := restored.node.Fence(); !done || len(silent) != 0 || stream != "" {
		t.Fatalf("fence: %v %v %q", done, silent, stream)
	}
	if restored.node.Origin() != idA {
		t.Fatalf("every peer answered: the stream continues, got %q", restored.node.Origin())
	}
	for _, name := range []string{"two", "three"} {
		if _, ok := restored.node.Bucket(name); !ok {
			t.Fatalf("the catalog was not relearnt: %s", name)
		}
	}
	next := must(restored.node.CreateBucket(ctx, "four", BucketEntry{Home: idA}))
	if next.Origin != idA || next.Seq != 4 {
		t.Fatalf("the next op reused a sequence number: %s", next.ID())
	}
	// it is accepted by the peer (no clash with the ops it already has)
	if p := restored.node.WaitReplicated(ctx, []Op{next}, 5*time.Second); len(p) != 0 {
		t.Fatalf("%v", p)
	}
	sameCatalog(t, "after the restore", catalogOf(t, restored.node), catalogOf(t, b.node))
}

// If a peer stays silent the node goes ahead after BINVAULT_CLUSTER_STARTUP_FENCE
// and starts a NEW op stream: the silent peer may hold ops of the old stream that
// the node has not seen (spec §8.5).
func TestFenceSilentPeerStartsANewStream(t *testing.T) {
	la, ua := listener(t)
	lb, ub := listener(t)
	urls := []string{ua, ub}
	ctx := ctxT()
	a := newTestNode(t, spec{name: "a", l: la, urls: urls, start: true, cfg: fenceOf(10 * time.Second)})
	b := newTestNode(t, spec{name: "b", l: lb, urls: urls, start: true, cfg: fenceOf(10 * time.Second)})
	waitReady(t, 5*time.Second, a, b)
	must(a.node.CreateBucket(ctx, "one", BucketEntry{Home: a.id()}))
	backup := t.TempDir()
	if err := a.db.Backup(ctx, filepath.Join(backup, "meta.db")); err != nil {
		t.Fatal(err)
	}
	must(a.node.CreateBucket(ctx, "lost-a", BucketEntry{Home: a.id()}))
	last := must(a.node.CreateBucket(ctx, "lost-b", BucketEntry{Home: a.id()}))
	if p := a.node.WaitReplicated(ctx, []Op{last}, 5*time.Second); len(p) != 0 {
		t.Fatalf("%v", p)
	}
	idA, addr := a.id(), la.Addr().String()
	a.close()

	// b holds ops of a's stream that the backup lacks, and it is unreachable when a restarts
	b.down.Store(true)
	restored := newTestNode(t, spec{name: "a", dir: backup, l: rebind(t, addr), urls: urls, noStart: true, cfg: fenceOf(700 * time.Millisecond)})
	started := time.Now()
	restored.start()
	if _, err := restored.node.CreateBucket(ctx, "early", BucketEntry{Home: idA}); !errors.Is(err, ErrNotReady) {
		t.Fatalf("%v", err)
	}
	waitReady(t, 5*time.Second, restored)
	if waited := time.Since(started); waited < 600*time.Millisecond {
		t.Fatalf("the fence ended after %s, before BINVAULT_CLUSTER_STARTUP_FENCE", waited)
	}
	done, silent, stream := restored.node.Fence()
	if !done || len(silent) != 1 || silent[0] != ub || !strings.HasPrefix(stream, idA+".") {
		t.Fatalf("fence: %v %v %q", done, silent, stream)
	}
	if restored.node.Origin() != stream || NodeOf(stream) != idA {
		t.Fatalf("origin %q", restored.node.Origin())
	}
	op := must(restored.node.CreateBucket(ctx, "fresh", BucketEntry{Home: idA}))
	if op.Origin != stream || op.Seq != 1 {
		t.Fatalf("a new stream starts at seq 1: %s", op.ID())
	}

	// a restart keeps the stream (it is persisted)
	restored.close()
	again := newTestNode(t, spec{name: "a", dir: restored.dir, l: rebind(t, addr), urls: urls, noStart: true, cfg: fenceOf(300 * time.Millisecond)})
	if again.node.Origin() != stream {
		t.Fatalf("the stream was not persisted: %q", again.node.Origin())
	}

	// b returns: the old stream's lost ops come back, the new stream goes out
	b.down.Store(false)
	again.start()
	waitReady(t, 5*time.Second, again)
	eventually(t, 10*time.Second, "both streams to meet", func() bool {
		vv := vvOf(t, again.node)
		wb := vvOf(t, b.node)
		return vv[idA] == 3 && vv[stream] == 1 && wb[stream] == 1 && wb[idA] == 3
	})
	for _, name := range []string{"lost-a", "lost-b", "fresh"} {
		if _, ok := again.node.Bucket(name); !ok {
			t.Fatalf("%s missing after the streams met", name)
		}
	}
	eventually(t, 5*time.Second, "identical catalogs", func() bool {
		x, y := catalogOf(t, again.node), catalogOf(t, b.node)
		return len(x) == len(y) && len(x) > 0 && sameQuiet(x, y)
	})
}

func sameQuiet(a, b []regView) bool {
	if len(a) != len(b) {
		return false
	}
	for i := range a {
		if a[i] != b[i] {
			return false
		}
	}
	return true
}

// The fence waits for a peer that starts a little late, as long as it answers
// within BINVAULT_CLUSTER_STARTUP_FENCE: no new stream.
func TestFenceWaitsForALatePeer(t *testing.T) {
	la, ua := listener(t)
	lb, ub := listener(t)
	urls := []string{ua, ub}
	a := newTestNode(t, spec{name: "a", l: la, urls: urls, start: true, cfg: fenceOf(10 * time.Second)})
	started := time.Now()
	time.Sleep(400 * time.Millisecond)
	if a.node.Ready() {
		t.Fatal("the fence ended without hearing from the other node")
	}
	b := newTestNode(t, spec{name: "b", l: lb, urls: urls, start: true, cfg: fenceOf(10 * time.Second)})
	waitReady(t, 5*time.Second, a, b)
	if waited := time.Since(started); waited < 350*time.Millisecond {
		t.Fatalf("ready after %s", waited)
	}
	if _, silent, stream := a.node.Fence(); len(silent) != 0 || stream != "" || a.node.Origin() != a.id() {
		t.Fatalf("%v %q %q", silent, stream, a.node.Origin())
	}
}

// A URL that last answered as this node (a node that cannot reach its own URL, or
// a URL retired with its node) is not waited for, and a stream is not abandoned
// at every start because of it. A URL that has never answered is waited for.
func TestFenceSkipsOwnAndRetiredURLs(t *testing.T) {
	la, ua := listener(t)
	ghost1, u1 := listener(t)
	ghost2, u2 := listener(t)
	ghost1.Close()
	ghost2.Close()
	urls := []string{ua, u1, u2}
	a := newTestNode(t, spec{name: "a", l: la, urls: urls, noStart: true, cfg: fenceOf(10 * time.Second)})
	a.node.mu.Lock()
	a.node.urlIDs[u1] = a.id()      // it was us, last time it answered
	a.node.urlIDs[u2] = "n_retired" // and this one is a node that was retired
	a.node.known["n_retired"] = &knownPeer{name: "gone", retired: true}
	a.node.mu.Unlock()
	started := time.Now()
	a.start()
	waitReady(t, 5*time.Second, a)
	if time.Since(started) > 5*time.Second {
		t.Fatal("waited for URLs that are accounted for")
	}
	if _, silent, stream := a.node.Fence(); len(silent) != 0 || stream != "" {
		t.Fatalf("silent %v stream %q", silent, stream)
	}
}

func TestFenceOfAClusterOfOne(t *testing.T) {
	l, u := listener(t)
	a := newTestNode(t, spec{name: "solo", l: l, urls: []string{u}, noStart: true, cfg: fenceOf(30 * time.Second)})
	started := time.Now()
	a.start()
	waitReady(t, 5*time.Second, a)
	if time.Since(started) > 3*time.Second {
		t.Fatalf("a node alone waited %s", time.Since(started))
	}
	if _, silent, stream := a.node.Fence(); len(silent) != 0 || stream != "" {
		t.Fatalf("%v %q", silent, stream)
	}
}

// A node that cannot reach its own URL (NAT without hairpinning) never sees itself.
// Its peers can reach the URL and tell it so in hello: it neither waits for that
// URL nor abandons its op stream at every start, and the URL does not hold
// compaction back.
func TestOwnUnreachableURLIsLearnedFromPeers(t *testing.T) {
	lPub, uPub := listener(t) // the public URL of a: a cannot connect to it
	lb, ub := listener(t)
	urls := []string{uPub, ub}
	a := newTestNode(t, spec{name: "a", l: lPub, urls: urls, noStart: true, cfg: fenceOf(10 * time.Second)})
	id := a.id()
	a.reject.Store(&id)
	b := newTestNode(t, spec{name: "b", l: lb, urls: urls, start: true, cfg: fenceOf(10 * time.Second)})

	started := time.Now()
	a.start()
	waitReady(t, 8*time.Second, a, b)
	if time.Since(started) > 5*time.Second {
		t.Fatalf("a waited %s for a URL that is itself", time.Since(started))
	}
	if _, silent, stream := a.node.Fence(); len(silent) != 0 || stream != "" || a.node.Origin() != id {
		t.Fatalf("silent %v stream %q origin %q", silent, stream, a.node.Origin())
	}
	a.node.mu.Lock()
	learned := a.node.urlIDs[uPub]
	a.node.mu.Unlock()
	if learned != id {
		t.Fatalf("a learnt that %s is %q", uPub, learned)
	}
	if persisted := must(a.db.Read().PeerURLs(ctxT())); persisted[uPub] != id {
		t.Fatalf("not persisted: %v", persisted)
	}
	if _, blocked := a.node.compactionAcks(); len(blocked) != 0 {
		t.Fatalf("compaction blocked by %v", blocked)
	}
	// and it is not a peer
	for _, p := range a.node.Peers() {
		if p.ID == id {
			t.Fatalf("a lists itself as a peer: %+v", p)
		}
	}
}
