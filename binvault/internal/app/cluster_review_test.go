package app_test

import (
	"fmt"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// Regression tests for the findings of the cluster-layer review.

// A bucket the admin dropped with catalog_only must not come back, with its data and
// its tokens, once its tombstone has been compacted away: a local bucket the catalog
// does not list is an orphan, not a bucket to publish (spec §8.5). Only the first
// publication of a node (the single-node upgrade) and a creation that crashed before
// its catalog write publish such a bucket.
func TestClusterDroppedBucketIsNotResurrectedByCompaction(t *testing.T) {
	tc := startCluster(t, 2, func(i int, c *config.Config) { c.ClusterRetention = 200 * time.Millisecond })
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "doomed", "home": "b"})
	cr := a.token("doomed", all, nil)
	a.must(cr, 200, "PUT", "/doomed/k", []byte("secret data"))
	keys, _ := b.app.Cluster().KeysOf(b.ctx, "doomed")
	if len(keys) != 1 {
		t.Fatalf("keys: %v", keys)
	}
	// what DELETE /buckets/doomed?catalog_only=true writes (the home is declared down)
	if _, err := a.app.Cluster().Write(a.ctx, cluster.DeleteBucketDraft("doomed"), cluster.DeleteKeyDraft(keys[0].AccessKeyID)); err != nil {
		t.Fatal(err)
	}
	eventually(t, 5*time.Second, "b to learn of the drop", func() bool { _, ok := b.app.Cluster().Bucket("doomed"); return !ok })

	time.Sleep(600 * time.Millisecond)
	eventually(t, 15*time.Second, "both nodes to compact the tombstone", func() bool {
		for _, n := range []*cnode{a, b} {
			if _, err := n.app.Cluster().Compact(n.ctx); err != nil {
				t.Fatal(err)
			}
		}
		_, ea := a.app.Cluster().Register(a.ctx, cluster.KindBucket, "doomed")
		_, eb := b.app.Cluster().Register(b.ctx, cluster.KindBucket, "doomed")
		return ea == cluster.ErrNotFound && eb == cluster.ErrNotFound
	})

	tc.restart(1, func(i int, c *config.Config) { c.ClusterRetention = time.Hour })
	tc.waitReady(15 * time.Second)
	time.Sleep(500 * time.Millisecond)
	if _, resurrected := a.app.Cluster().Bucket("doomed"); resurrected {
		t.Fatalf("a bucket the admin dropped is live again after its tombstone was compacted away")
	}
	if r := a.s3(cr, "GET", "/doomed/k", nil); r.status != 404 {
		t.Fatalf("the dropped bucket is served again: %d", r.status)
	}
	// its data is kept, listed as an orphan the admin can delete
	nb := tc.nodes[1]
	if _, err := nb.app.DB.Read().GetBucket(nb.ctx, "doomed"); err != nil {
		t.Fatalf("the orphan's data was not kept: %v", err)
	}
	orphans, err := nb.app.Cluster().OrphansOf(nb.ctx, []cluster.LocalBucket{{Name: "doomed", Generation: "x"}})
	if err != nil || len(orphans) != 1 || orphans[0].Reason != "unknown" {
		t.Fatalf("orphans: %+v %v", orphans, err)
	}
}

// A bucket whose creation crashed between the local row and the catalog write is
// published at the next start, by the marker the creation transaction left.
func TestClusterCreationThatCrashedBeforeTheCatalogWriteIsRepaired(t *testing.T) {
	tc := startCluster(t, 2, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "first", "home": "b"})
	// the creation of "second" on b: the local row and the marker are committed, the catalog write never happens
	if err := b.app.DB.Update(b.ctx, func(tx *meta.Tx) error {
		bk := &meta.Bucket{Name: "second", Generation: "gen-second"}
		if err := tx.CreateBucket(b.ctx, bk); err != nil {
			return err
		}
		return tx.KVSet(b.ctx, meta.PublishPendingKey("second"), bk.Generation)
	}); err != nil {
		t.Fatal(err)
	}
	// and a local bucket without the marker (what the compaction scenario leaves)
	if err := b.app.DB.Update(b.ctx, func(tx *meta.Tx) error {
		return tx.CreateBucket(b.ctx, &meta.Bucket{Name: "stray", Generation: "gen-stray"})
	}); err != nil {
		t.Fatal(err)
	}
	tc.restart(1, nil)
	tc.waitReady(15 * time.Second)
	eventually(t, 10*time.Second, "the marked bucket to be published", func() bool { _, ok := a.app.Cluster().Bucket("second"); return ok })
	if _, ok := a.app.Cluster().Bucket("stray"); ok {
		t.Fatal("a local bucket without a catalog entry or marker was published")
	}
	nb := tc.nodes[1]
	if _, err := nb.app.DB.Read().KVGet(nb.ctx, meta.PublishPendingKey("second")); err == nil {
		t.Fatal("the marker outlived the publication")
	}
}

// A bucket the catalog homes on a node that holds no data for it (restored from an
// older backup) can be deleted from any node: the delete removes the catalog entry.
func TestClusterCatalogEntryWithoutLocalDataCanBeDropped(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "lost", "home": "b"})
	if err := b.app.DB.Update(b.ctx, func(tx *meta.Tx) error { return tx.DeleteBucket(b.ctx, "lost") }); err != nil {
		t.Fatal(err)
	}
	// through another node (relayed to the home), then at the home itself
	c.mustAdmin(204, "DELETE", "/buckets/lost?wait=replicated", nil)
	for _, n := range []*cnode{a, b, c} {
		n := n
		eventually(t, 5*time.Second, "the entry to be gone on "+n.name, func() bool { _, ok := n.app.Cluster().Bucket("lost"); return !ok })
	}
	// the name is free again
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "lost", "home": "b"})
}

// A delete whose catalog write failed after the local deletion left a ghost: the
// retry finishes it.
func TestClusterDeleteThatFailedAfterTheLocalDeletionCanBeFinished(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "ghost", "home": "b"})
	cr := a.token("ghost", all, nil)
	a.must(cr, 200, "PUT", "/ghost/k", []byte("important data"))
	b.app.Cluster().Stop() // a delete that is still running when the node stops
	b.admin("DELETE", "/buckets/ghost?force=true", nil)
	if _, err := b.app.DB.Read().GetBucket(b.ctx, "ghost"); err == nil {
		t.Fatalf("the local bucket still exists")
	}
	tc.restart(1, nil)
	tc.waitReady(15 * time.Second)
	nb := tc.nodes[1]
	if _, listed := a.app.Cluster().Bucket("ghost"); listed {
		nb.mustAdmin(204, "DELETE", "/buckets/ghost", nil)
	}
	eventually(t, 5*time.Second, "the entry to be gone", func() bool { _, ok := a.app.Cluster().Bucket("ghost"); return !ok })
}

// The queued after-runs of a bucket that no node serves any more (an orphan) are not
// dispatched: the service is not called for data that belongs to nobody here (spec §8.5).
func TestClusterOrphanedBucketsRunsAreNotDispatched(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	svc := newFsvc(t)
	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", pipeDef("orp", "after", svc.url("orp"), b.s3URL, map[string]any{"paused": true}))
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "orph", "home": "b"})
	c.mustAdmin(200, "PUT", "/buckets/orph/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "orp", "enabled": true}}})
	cr := a.token("orph", all, nil)
	for i := 0; i < 2; i++ {
		a.must(cr, 200, "PUT", fmt.Sprintf("/orph/k%d", i), []byte("v"))
	}
	eventually(t, 5*time.Second, "two queued runs on b", func() bool {
		return len(items(t, b.mustAdmin(200, "GET", "/runs?pipeline=orp&state=queued", nil))) == 2
	})
	if _, err := a.app.Cluster().Write(a.ctx, cluster.DeleteBucketDraft("orph")); err != nil {
		t.Fatal(err)
	}
	eventually(t, 5*time.Second, "b to learn of the drop", func() bool { _, ok := b.app.Cluster().Bucket("orph"); return !ok })
	a.mustAdmin(200, "PATCH", "/pipelines/orp?wait=replicated", map[string]any{"paused": false})
	time.Sleep(2500 * time.Millisecond)
	if n := len(svc.callsOf("orp")); n != 0 {
		t.Fatalf("the service was called %d times for the runs of an orphan", n)
	}
}

// Relayed admin calls are counted and logged under their own operation name, as on a
// single node.
func TestClusterRelayedAdminCallsAreNamedInMetrics(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a := tc.nodes[0]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "mtr", "home": "b"})
	a.mustAdmin(200, "GET", "/buckets/mtr", nil)
	a.mustAdmin(200, "GET", "/runs", nil)
	m := a.metric(t, "binvault_http_requests_total")
	if strings.Contains(m, `op="Unknown"`) {
		t.Fatalf("relayed admin calls are counted as op=\"Unknown\":\n%s", m)
	}
	for _, op := range []string{"AdminGetBucket", "AdminListRuns"} {
		if !strings.Contains(m, `op="`+op+`"`) {
			t.Fatalf("no request counted as %s:\n%s", op, m)
		}
	}
}
