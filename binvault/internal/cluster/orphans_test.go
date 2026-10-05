package cluster

import (
	"context"
	"path/filepath"
	"sync"
	"testing"
	"time"
)

// localSet is a node's idea of the buckets it holds, which the test edits.
type localSet struct {
	mu sync.Mutex
	l  []LocalBucket
}

func (s *localSet) set(l ...LocalBucket) {
	s.mu.Lock()
	s.l = l
	s.mu.Unlock()
}

func (s *localSet) get(context.Context) ([]LocalBucket, error) {
	s.mu.Lock()
	defer s.mu.Unlock()
	return append([]LocalBucket(nil), s.l...), nil
}

// The same bucket name created on two nodes at once (a partition, or a race the
// pre-check could not close): the later hlc wins everywhere and the loser's local
// bucket is an orphan — not served, data kept (spec §8.5).
func TestSimultaneousCreateLeavesAnOrphan(t *testing.T) {
	var la, lb localSet
	c := newManual(t, 2, func(i int, sp *spec) {
		if i == 0 {
			sp.local = la.get
		} else {
			sp.local = lb.get
		}
	})
	a, b := c[0], c[1]
	ctx := ctxT()
	a.down.Store(true)
	b.down.Store(true) // partitioned: the name check cannot see the other side
	opA := must(a.node.CreateBucket(ctx, "photos", BucketEntry{Home: a.id()}))
	la.set(LocalBucket{Name: "photos", Generation: opA.ID()})
	time.Sleep(5 * time.Millisecond)
	opB := must(b.node.CreateBucket(ctx, "photos", BucketEntry{Home: b.id()}))
	lb.set(LocalBucket{Name: "photos", Generation: opB.ID()})
	a.down.Store(false)
	b.down.Store(false)
	settle(c...)

	sameCatalog(t, "after the heal", catalogOf(t, a.node), catalogOf(t, b.node))
	if home, _, _ := a.node.Home("photos"); home != b.id() {
		t.Fatalf("the later create (b's) must win: home %q", home)
	}
	alA, err := a.node.Alarms(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(alA.Orphans) != 1 || alA.Orphans[0].Name != "photos" || alA.Orphans[0].Generation != opA.ID() ||
		alA.Orphans[0].Reason != "generation" || alA.Orphans[0].Home != b.id() || alA.Orphans[0].HomeName != "node2" {
		t.Fatalf("a's orphan: %+v", alA.Orphans)
	}
	alB, _ := b.node.Alarms(ctx)
	if len(alB.Orphans) != 0 {
		t.Fatalf("the winner has no orphan: %+v", alB.Orphans)
	}
	// both saw the other create as a concurrent write
	if len(a.node.Conflicts())+len(b.node.Conflicts()) == 0 {
		t.Fatal("the duplicate create was not reported as a conflict")
	}
	// the admin deletes the orphan's data (DELETE /cluster/orphans/{generation}): nothing left
	la.set()
	if alA, _ = a.node.Alarms(ctx); len(alA.Orphans) != 0 {
		t.Fatalf("%+v", alA.Orphans)
	}
}

// `DELETE /buckets/{name}?catalog_only=true` with the home down: the entry and its
// keys are tombstoned in one batch by the node that took the call; when the home
// returns its local data is an orphan (spec §6.3, §8.5, §8.9).
func TestCatalogOnlyDeleteWithTheHomeDown(t *testing.T) {
	var lb localSet
	c := newManual(t, 3, func(i int, sp *spec) {
		if i == 1 {
			sp.local = lb.get
		}
	})
	a, b, d := c[0], c[1], c[2]
	ctx := ctxT()
	op := must(b.node.CreateBucket(ctx, "photos", BucketEntry{Home: b.id()}))
	lb.set(LocalBucket{Name: "photos", Generation: op.ID()})
	must(b.node.PutKey(ctx, "BVKAAAAAAAA", KeyEntry{Bucket: "photos"}))
	must(b.node.PutKey(ctx, "BVKBBBBBBBB", KeyEntry{Bucket: "photos"}))
	settle(c...)

	b.down.Store(true) // the home is gone
	drafts := []Draft{DeleteBucketDraft("photos")}
	keys := must(a.node.KeysOf(ctx, "photos"))
	if len(keys) != 2 {
		t.Fatalf("%+v", keys)
	}
	for _, k := range keys {
		drafts = append(drafts, DeleteKeyDraft(k.AccessKeyID))
	}
	ops := must(a.node.Write(ctx, drafts...))
	settle(a, d)
	if _, ok := d.node.Bucket("photos"); ok {
		t.Fatal("the drop did not replicate")
	}
	if _, ok := d.node.LookupKey("BVKAAAAAAAA"); ok {
		t.Fatal("the keys of a dropped bucket must go with it")
	}
	if p := a.node.WaitReplicated(ctx, ops, time.Second); len(p) != 1 || p[0].Name != "node2" {
		t.Fatalf("the home is the only one pending: %+v", p)
	}

	b.down.Store(false)
	settle(c...)
	al, _ := b.node.Alarms(ctx)
	if len(al.Orphans) != 1 || al.Orphans[0].Reason != "deleted" || al.Orphans[0].Generation != op.ID() {
		t.Fatalf("the home's data is an orphan: %+v", al.Orphans)
	}
	if home, _, ok := b.node.Home("photos"); ok {
		t.Fatalf("b must not serve a dropped bucket: %q", home)
	}
}

// A node restored from a backup older than a move of one of its buckets: the
// catalog sync (the start-up fence) shows the bucket homed elsewhere at a higher
// epoch, and the stale local copy is an orphan (spec §8.5, §9.5).
func TestRestoreOlderThanAMoveLeavesAnOrphan(t *testing.T) {
	la, ua := listener(t)
	lb, ub := listener(t)
	urls := []string{ua, ub}
	ctx := ctxT()
	var restoredLocal localSet
	fence := fenceOf(10 * time.Second)
	a := newTestNode(t, spec{name: "a", l: la, urls: urls, start: true, cfg: fence})
	b := newTestNode(t, spec{name: "b", l: lb, urls: urls, start: true, cfg: fence})
	waitReady(t, 5*time.Second, a, b)

	create := must(a.node.CreateBucket(ctx, "photos", BucketEntry{Home: a.id()}))
	if p := a.node.WaitReplicated(ctx, []Op{create}, 5*time.Second); len(p) != 0 {
		t.Fatalf("%v", p)
	}
	backup := t.TempDir()
	if err := a.db.Backup(ctx, filepath.Join(backup, "meta.db")); err != nil {
		t.Fatal(err)
	}
	// the bucket moves to b: the hand-off op, written by a after b's OK
	hand := must(a.node.UpdateBucket(ctx, "photos", func(c BucketEntry) (BucketEntry, error) { c.Home, c.Epoch = b.id(), 1; return c, nil }))
	if p := a.node.WaitReplicated(ctx, []Op{hand}, 5*time.Second); len(p) != 0 {
		t.Fatalf("%v", p)
	}
	addr := la.Addr().String()
	a.close()

	restoredLocal.set(LocalBucket{Name: "photos", Generation: create.ID(), Epoch: 0}) // the stale copy, in the backup
	restored := newTestNode(t, spec{name: "a", dir: backup, l: rebind(t, addr), urls: urls, noStart: true, cfg: fence, local: restoredLocal.get})
	if home, epoch, _ := restored.node.Home("photos"); home != restored.id() || epoch != 0 {
		t.Fatalf("before the fence the backup says it still homes the bucket: %q %d", home, epoch)
	}
	restored.start()
	waitReady(t, 5*time.Second, restored)
	if home, epoch, ok := restored.node.Home("photos"); !ok || home != b.id() || epoch != 1 {
		t.Fatalf("after the fence the bucket is b's: %q %d %v", home, epoch, ok)
	}
	al, err := restored.node.Alarms(ctx)
	if err != nil {
		t.Fatal(err)
	}
	if len(al.Orphans) != 1 || al.Orphans[0].Name != "photos" || al.Orphans[0].Reason != "epoch" || al.Orphans[0].Home != b.id() || al.Orphans[0].Epoch != 1 {
		t.Fatalf("the stale copy must be an orphan: %+v", al.Orphans)
	}
	if hello := restored.node.hello(ctx); hello.Missing != 0 {
		t.Fatalf("the bucket is not homed here any more, so not missing here: %+v", hello)
	}
}
