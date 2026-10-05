package cluster

import (
	"context"
	"encoding/json"
	"errors"
	"sort"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/hlc"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// bucketMirror keeps every live bucket/<name> register in memory: every request
// to a node resolves its bucket's home first (§8.4), so the lookup must not cost
// a SQL query. It is updated, under Node.wmu, by every transaction that changes
// a bucket register, before the writer returns.
type bucketMirror struct {
	mu sync.RWMutex
	m  map[string]BucketRecord
}

func newBucketMirror() *bucketMirror { return &bucketMirror{m: map[string]BucketRecord{}} }

func decodeBucket(r *meta.CatalogReg) (BucketRecord, error) {
	rec := BucketRecord{Name: r.Name, HLC: hlc.Timestamp(r.HLC), Origin: r.Origin, Seq: r.Seq}
	err := json.Unmarshal(r.Payload, &rec.BucketEntry)
	return rec, err
}

func decodePipeline(r *meta.CatalogReg) (PipelineRecord, error) {
	rec := PipelineRecord{Name: r.Name, HLC: hlc.Timestamp(r.HLC), Origin: r.Origin, Seq: r.Seq}
	err := json.Unmarshal(r.Payload, &rec.PipelineEntry)
	return rec, err
}

func decodeKey(r *meta.CatalogReg) (KeyRecord, error) {
	rec := KeyRecord{AccessKeyID: r.Name, HLC: hlc.Timestamp(r.HLC), Origin: r.Origin, Seq: r.Seq}
	err := json.Unmarshal(r.Payload, &rec.KeyEntry)
	return rec, err
}

// load fills the mirror from the database.
func (b *bucketMirror) load(ctx context.Context, q meta.Q) error {
	m := map[string]BucketRecord{}
	after := ""
	for {
		regs, err := q.CatalogListRegs(ctx, KindBucket, after, 1000, false)
		if err != nil {
			return err
		}
		for i := range regs {
			rec, err := decodeBucket(&regs[i])
			if err != nil {
				continue // never happens for a validated register; Home then says "unknown"
			}
			m[rec.Name] = rec
			after = regs[i].Name
		}
		if len(regs) < 1000 {
			break
		}
	}
	b.mu.Lock()
	b.m = m
	b.mu.Unlock()
	return nil
}

// apply folds committed changes in.
func (b *bucketMirror) apply(changes []Change) {
	b.mu.Lock()
	defer b.mu.Unlock()
	for _, c := range changes {
		if c.Kind != KindBucket {
			continue
		}
		if c.Deleted {
			delete(b.m, c.Name)
			continue
		}
		rec := BucketRecord{Name: c.Name, HLC: c.Op.HLC, Origin: c.Op.Origin, Seq: c.Op.Seq}
		if err := json.Unmarshal(c.Value, &rec.BucketEntry); err != nil {
			delete(b.m, c.Name)
			continue
		}
		b.m[c.Name] = rec
	}
}

func (b *bucketMirror) get(name string) (BucketRecord, bool) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	rec, ok := b.m[name]
	return rec, ok
}

// ---- reads -------------------------------------------------------------------

// Home returns the node that homes a bucket, according to this node's copy of the
// catalog: the home's node id (not its name), the bucket's epoch and ok. ok is
// false when the catalog has no live entry for the name; the caller then
// SyncNow()s and looks again before it answers NoSuchBucket (§8.4).
func (n *Node) Home(bucket string) (nodeID string, epoch int64, ok bool) {
	rec, ok := n.bm.get(bucket)
	if !ok {
		return "", 0, false
	}
	return rec.Home, rec.Epoch, true
}

// Bucket returns a bucket's live catalog entry.
func (n *Node) Bucket(bucket string) (BucketRecord, bool) {
	rec, ok := n.bm.get(bucket)
	if ok {
		rec.Pipelines = append([]string(nil), rec.Pipelines...)
	}
	return rec, ok
}

// AttachedTo lists, by name, the buckets whose catalog entry has the pipeline
// attached: the delete guard of `DELETE /pipelines/{name}` and `attached_to` work
// from any node (§8.7).
func (n *Node) AttachedTo(pipeline string) []string {
	n.bm.mu.RLock()
	defer n.bm.mu.RUnlock()
	var out []string
	for name, rec := range n.bm.m {
		for _, p := range rec.Pipelines {
			if p == pipeline {
				out = append(out, name)
				break
			}
		}
	}
	sort.Strings(out)
	return out
}

// ListBuckets lists live buckets with name > after, ordered by name (GET
// /buckets reads the catalog, §6.3).
func (n *Node) ListBuckets(ctx context.Context, after string, limit int) ([]BucketRecord, error) {
	regs, err := n.db.Read().CatalogListRegs(ctx, KindBucket, after, limit, false)
	if err != nil {
		return nil, err
	}
	out := make([]BucketRecord, 0, len(regs))
	for i := range regs {
		rec, err := decodeBucket(&regs[i])
		if err != nil {
			continue
		}
		out = append(out, rec)
	}
	return out, nil
}

// CountBuckets counts the live buckets of the catalog.
func (n *Node) CountBuckets(ctx context.Context) (int64, error) {
	return n.db.Read().CatalogCount(ctx, KindBucket)
}

// BucketsHomed lists the live buckets the catalog homes on a node, by name.
func (n *Node) BucketsHomed(ctx context.Context, nodeID string) ([]BucketRecord, error) {
	regs, err := n.db.Read().CatalogRegsByAux(ctx, KindBucket, nodeID)
	if err != nil {
		return nil, err
	}
	out := make([]BucketRecord, 0, len(regs))
	for i := range regs {
		if rec, err := decodeBucket(&regs[i]); err == nil {
			out = append(out, rec)
		}
	}
	return out, nil
}

// Pipeline returns a live pipeline register. A tombstone, or no register at all,
// is ok=false; PipelineGeneration tells them apart from a re-created pipeline.
func (n *Node) Pipeline(name string) (PipelineRecord, bool) {
	r, err := n.db.Read().CatalogGetReg(context.Background(), KindPipeline+"/"+name)
	if err != nil || r.Deleted {
		if err != nil && !errors.Is(err, meta.ErrNotFound) {
			n.log.Error("reading a pipeline register failed", "pipeline", name, "error", err)
		}
		return PipelineRecord{}, false
	}
	rec, err := decodePipeline(r)
	return rec, err == nil
}

// PipelineGeneration returns the generation of the current pipeline/<name>
// register: live is false for a tombstone, and exists is false when the catalog
// holds no register under the name at all. A home drops the attachments whose
// generation differs from it (§8.5, §8.7).
func (n *Node) PipelineGeneration(name string) (generation string, live, exists bool) {
	r, err := n.db.Read().CatalogGetReg(context.Background(), KindPipeline+"/"+name)
	if err != nil {
		return "", false, false
	}
	if r.Deleted {
		return "", false, true
	}
	rec, err := decodePipeline(r)
	if err != nil {
		return "", false, true
	}
	return rec.Generation, true, true
}

// OpApplied reports whether this node has applied the catalog op with that id
// ("origin:seq"), which for a pipeline is its generation: a node that has applied it
// knows the incarnation the id names, and a pipeline/<name> register of another
// generation is then a later one. known is false for a string that is not an op id (a
// pipeline published with a generation of its own): nothing can be said about it.
func (n *Node) OpApplied(id string) (applied, known bool) {
	origin, seq, ok := splitOpID(id)
	if !ok {
		return false, false
	}
	vv, err := n.db.Read().CatalogVV(context.Background())
	if err != nil {
		return false, false
	}
	return vv[origin] >= seq, true
}

// ListPipelines lists live pipelines with name > after, ordered by name.
func (n *Node) ListPipelines(ctx context.Context, after string, limit int) ([]PipelineRecord, error) {
	regs, err := n.db.Read().CatalogListRegs(ctx, KindPipeline, after, limit, false)
	if err != nil {
		return nil, err
	}
	out := make([]PipelineRecord, 0, len(regs))
	for i := range regs {
		if rec, err := decodePipeline(&regs[i]); err == nil {
			out = append(out, rec)
		}
	}
	return out, nil
}

// LookupKey returns the bucket an access key id belongs to, from the access-key
// index (§8.4: a request that names no bucket is routed by its credential).
func (n *Node) LookupKey(accessKeyID string) (bucket string, ok bool) {
	r, err := n.db.Read().CatalogGetReg(context.Background(), KindKey+"/"+accessKeyID)
	if err != nil || r.Deleted {
		return "", false
	}
	rec, err := decodeKey(r)
	if err != nil {
		return "", false
	}
	return rec.Bucket, true
}

// KeysOf lists the live access-key index entries of a bucket.
func (n *Node) KeysOf(ctx context.Context, bucket string) ([]KeyRecord, error) {
	regs, err := n.db.Read().CatalogRegsByAux(ctx, KindKey, bucket)
	if err != nil {
		return nil, err
	}
	out := make([]KeyRecord, 0, len(regs))
	for i := range regs {
		if rec, err := decodeKey(&regs[i]); err == nil {
			out = append(out, rec)
		}
	}
	return out, nil
}

// Register returns a register as stored, tombstones included (ErrNotFound when
// there is none).
func (n *Node) Register(ctx context.Context, kind, name string) (*Register, error) {
	r, err := n.db.Read().CatalogGetReg(ctx, kind+"/"+name)
	if errors.Is(err, meta.ErrNotFound) {
		return nil, ErrNotFound
	}
	if err != nil {
		return nil, err
	}
	return registerFromMeta(r), nil
}

// Registers returns every register of the catalog, tombstones included, ordered
// by key. It reads the whole catalog: tests and small tools only; the snapshot
// export pages through it instead.
func (n *Node) Registers(ctx context.Context) ([]Register, error) {
	regs, err := n.db.Read().CatalogAllRegs(ctx)
	if err != nil {
		return nil, err
	}
	out := make([]Register, len(regs))
	for i := range regs {
		out[i] = *registerFromMeta(&regs[i])
	}
	return out, nil
}

// VersionVector returns, per op stream, the highest seq applied.
func (n *Node) VersionVector(ctx context.Context) (map[string]int64, error) {
	return n.db.Read().CatalogVV(ctx)
}

// ---- orphans and missing buckets (§8.5, §6.9) ----------------------------------

// Orphan is a bucket that exists locally although the catalog no longer agrees
// that this node homes it. It is not served; its data is kept until an admin
// deletes it (DELETE /cluster/orphans/{generation}).
type Orphan struct {
	Name string `json:"name"`
	// Generation is the local bucket's generation (the key of the delete call).
	Generation string `json:"generation"`
	// Reason: "deleted" (the entry is a tombstone, for example after a
	// catalog_only drop), "generation" (the name was re-created), "epoch" (the
	// bucket moved on while this copy was away), "other_home" (a concurrent
	// create elsewhere won) or "unknown" (the catalog has no entry at all).
	Reason string `json:"reason"`
	// Home, Epoch and CatalogGeneration describe the catalog's entry, if any.
	Home              string `json:"home,omitempty"`
	HomeName          string `json:"home_name,omitempty"`
	Epoch             int64  `json:"epoch,omitempty"`
	CatalogGeneration string `json:"catalog_generation,omitempty"`
}

// Missing is a bucket the catalog homes on a node that has no data for it: its
// home was retired or is not part of the cluster, or this node lost the data.
type Missing struct {
	Name       string `json:"name"`
	Home       string `json:"home"`
	HomeName   string `json:"home_name,omitempty"`
	Generation string `json:"generation"`
	// Reason: "retired_home", "unknown_home" or "no_local_data".
	Reason string `json:"reason"`
}

// OrphansOf compares the buckets this node holds locally with the catalog and
// returns the orphans (§8.5): local data the catalog gives to another home, epoch
// or generation, or no longer lists. A local epoch above the catalog's is not an
// orphan: the new home of a move records its epoch durably before the old home's
// hand-off op replicates (§8.8).
func (n *Node) OrphansOf(ctx context.Context, local []LocalBucket) ([]Orphan, error) {
	var out []Orphan
	for _, l := range local {
		r, err := n.db.Read().CatalogGetReg(ctx, KindBucket+"/"+l.Name)
		if errors.Is(err, meta.ErrNotFound) {
			out = append(out, Orphan{Name: l.Name, Generation: l.Generation, Reason: "unknown"})
			continue
		}
		if err != nil {
			return nil, err
		}
		if r.Deleted {
			out = append(out, Orphan{Name: l.Name, Generation: l.Generation, Reason: "deleted"})
			continue
		}
		rec, err := decodeBucket(r)
		if err != nil {
			return nil, err
		}
		o := Orphan{Name: l.Name, Generation: l.Generation, Home: rec.Home, HomeName: n.NodeName(rec.Home), Epoch: rec.Epoch, CatalogGeneration: rec.Generation}
		switch {
		case rec.Generation != l.Generation:
			o.Reason = "generation"
		case rec.Epoch > l.Epoch:
			o.Reason = "epoch"
		case rec.Epoch == l.Epoch && rec.Home != n.id:
			o.Reason = "other_home"
		default:
			continue
		}
		out = append(out, o)
	}
	sort.Slice(out, func(i, j int) bool { return out[i].Name < out[j].Name })
	return out, nil
}

// IsOrphan reports whether a local bucket is an orphan according to the catalog.
func (n *Node) IsOrphan(ctx context.Context, l LocalBucket) (bool, string, error) {
	o, err := n.OrphansOf(ctx, []LocalBucket{l})
	if err != nil || len(o) == 0 {
		return false, "", err
	}
	return true, o[0].Reason, nil
}

// MissingBuckets lists the buckets the catalog homes where there is no data for
// them: on this node when the application holds nothing under that name and
// generation (a node restored from a backup older than the bucket), and on a
// node that was retired or is not part of the cluster (§8.3, §8.4, §6.9). The
// application keeps answering 503 for them, never NoSuchBucket.
func (n *Node) MissingBuckets(ctx context.Context) ([]Missing, error) {
	var local map[string]LocalBucket
	if n.local != nil {
		lbs, err := n.local(ctx)
		if err != nil {
			return nil, err
		}
		local = make(map[string]LocalBucket, len(lbs))
		for _, l := range lbs {
			local[l.Name] = l
		}
	}
	live := n.liveHomes()
	var out []Missing
	after := ""
	for {
		page, err := n.ListBuckets(ctx, after, 1000)
		if err != nil {
			return nil, err
		}
		for _, b := range page {
			after = b.Name
			m := Missing{Name: b.Name, Home: b.Home, HomeName: n.NodeName(b.Home), Generation: b.Generation}
			switch {
			case b.Home == n.id:
				if local == nil {
					continue
				}
				if l, ok := local[b.Name]; ok && l.Generation == b.Generation {
					continue
				}
				m.Reason = "no_local_data"
			case live[b.Home]:
				continue
			default:
				m.Reason = "unknown_home"
				if n.isRetired(b.Home) {
					m.Reason = "retired_home"
				}
			}
			out = append(out, m)
		}
		if len(page) < 1000 {
			return out, nil
		}
	}
}

// missingHere counts the buckets homed on this node that it holds no data for
// (hello reports it so every node's GET /cluster can show it). The count walks
// every bucket homed here, so it is cached for a few seconds.
func (n *Node) missingHere(ctx context.Context) int64 {
	if n.local == nil {
		return 0
	}
	n.mu.Lock()
	if !n.missCache.at.IsZero() && time.Since(n.missCache.at) < 5*time.Second {
		v := n.missCache.v
		n.mu.Unlock()
		return v
	}
	n.mu.Unlock()
	lbs, err := n.local(ctx)
	if err != nil {
		return 0
	}
	have := make(map[string]string, len(lbs))
	for _, l := range lbs {
		have[l.Name] = l.Generation
	}
	homed, err := n.BucketsHomed(ctx, n.id)
	if err != nil {
		return 0
	}
	var c int64
	for _, b := range homed {
		if g, ok := have[b.Name]; !ok || g != b.Generation {
			c++
		}
	}
	n.mu.Lock()
	n.missCache.at, n.missCache.v = time.Now(), c
	n.mu.Unlock()
	return c
}

// liveHomes is the set of node ids that are members of the cluster: this node
// and every node behind a configured URL that is not retired.
func (n *Node) liveHomes() map[string]bool {
	n.mu.Lock()
	defer n.mu.Unlock()
	live := map[string]bool{n.id: true}
	for _, u := range n.urls {
		id := n.us[u].id
		if id == "" {
			id = n.urlIDs[u]
		}
		if id != "" && !n.retiredLocked(id) {
			live[id] = true
		}
	}
	return live
}

func (n *Node) isRetired(id string) bool {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.retiredLocked(id)
}
