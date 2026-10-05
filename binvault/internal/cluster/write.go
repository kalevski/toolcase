package cluster

import (
	"context"
	"encoding/json"
	"errors"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// Draft is one catalog change before it becomes an op. Build one with the
// constructors below and hand it to Write; the single-register helpers
// (CreateBucket, ...) are Write with one draft.
type Draft struct {
	Kind, Key string
	// build produces the canonical payload from the id the op will have and the
	// register as it is in the transaction (nil if there is none).
	build func(opID string, cur *meta.CatalogReg) ([]byte, error)
}

// CreateBucketDraft creates bucket/<name>. Generation is the entry's own if it
// has one (the application's generation of the bucket: it must be unique per
// incarnation of the name, and is what attachments and orphan detection compare),
// otherwise the id of the op (spec §8.5). The draft fails with ErrExists while a
// live entry exists.
func CreateBucketDraft(name string, e BucketEntry) Draft {
	return Draft{Kind: KindBucket, Key: name, build: func(id string, cur *meta.CatalogReg) ([]byte, error) {
		if cur != nil && !cur.Deleted {
			return nil, ErrExists
		}
		if e.Generation == "" {
			e.Generation = id
		}
		e.Pipelines = append([]string(nil), e.Pipelines...)
		return e.canonical()
	}}
}

// UpdateBucketDraft rewrites a live bucket entry: fn receives a copy of the
// current entry and returns the next one. The generation cannot change. fn runs
// inside the write transaction: it must be quick, must not block and must not
// call the node.
func UpdateBucketDraft(name string, fn func(cur BucketEntry) (BucketEntry, error)) Draft {
	return Draft{Kind: KindBucket, Key: name, build: func(id string, cur *meta.CatalogReg) ([]byte, error) {
		if cur == nil || cur.Deleted {
			return nil, ErrNotFound
		}
		var c BucketEntry
		if err := json.Unmarshal(cur.Payload, &c); err != nil {
			return nil, err
		}
		next, err := fn(c)
		if err != nil {
			return nil, err
		}
		next.Generation = c.Generation
		return next.canonical()
	}}
}

// DeleteBucketDraft writes the tombstone of bucket/<name>. It is written even
// when no entry exists locally, so a create that arrives late cannot resurrect
// the name.
func DeleteBucketDraft(name string) Draft { return tombstoneDraft(KindBucket, name) }

// CreatePipelineDraft creates pipeline/<name>. Generation is the entry's own if it
// has one, otherwise the id of the op; Revision defaults to 1. The draft fails
// with ErrExists while a live pipeline exists.
func CreatePipelineDraft(name string, e PipelineEntry) Draft {
	return Draft{Kind: KindPipeline, Key: name, build: func(id string, cur *meta.CatalogReg) ([]byte, error) {
		if cur != nil && !cur.Deleted {
			return nil, ErrExists
		}
		if e.Generation == "" {
			e.Generation = id
		}
		if e.Revision == 0 {
			e.Revision = 1
		}
		return e.canonical()
	}}
}

// UpdatePipelineDraft rewrites a live pipeline: fn receives a copy of the current
// entry and returns the next one. The generation cannot change, and the revision
// is raised to cur+1 when fn does not raise it. fn runs inside the write
// transaction (see UpdateBucketDraft).
func UpdatePipelineDraft(name string, fn func(cur PipelineEntry) (PipelineEntry, error)) Draft {
	return Draft{Kind: KindPipeline, Key: name, build: func(id string, cur *meta.CatalogReg) ([]byte, error) {
		if cur == nil || cur.Deleted {
			return nil, ErrNotFound
		}
		var c PipelineEntry
		if err := json.Unmarshal(cur.Payload, &c); err != nil {
			return nil, err
		}
		next, err := fn(c)
		if err != nil {
			return nil, err
		}
		next.Generation = c.Generation
		if next.Revision <= c.Revision {
			next.Revision = c.Revision + 1
		}
		return next.canonical()
	}}
}

// DeletePipelineDraft writes the tombstone of pipeline/<name>.
func DeletePipelineDraft(name string) Draft { return tombstoneDraft(KindPipeline, name) }

// PutKeyDraft writes key/<access key id> (create or replace).
func PutKeyDraft(accessKeyID string, e KeyEntry) Draft {
	return Draft{Kind: KindKey, Key: accessKeyID, build: func(string, *meta.CatalogReg) ([]byte, error) {
		return e.canonical()
	}}
}

// DeleteKeyDraft writes the tombstone of key/<access key id>.
func DeleteKeyDraft(accessKeyID string) Draft { return tombstoneDraft(KindKey, accessKeyID) }

func tombstoneDraft(kind, key string) Draft {
	return Draft{Kind: kind, Key: key, build: func(string, *meta.CatalogReg) ([]byte, error) {
		return tombstonePayload, nil
	}}
}

// Write turns the drafts into ops of this node's current op stream and applies
// them in one transaction: either all of them are written or none. It returns
// the ops, in order, for WaitReplicated. A node accepts catalog writes only after
// the start-up fence (ErrNotReady). Creating a name that is live returns
// ErrExists, updating one that is not returns ErrNotFound, and a draft that
// would produce an op peers would refuse returns an error wrapping ErrInvalid.
// After the commit the node nudges its peers, so replication normally takes well
// under a second (§8.5).
func (n *Node) Write(ctx context.Context, drafts ...Draft) ([]Op, error) {
	if len(drafts) == 0 {
		return nil, nil
	}
	if n.stopped.Load() {
		return nil, ErrStopped
	}
	if !n.ready.Load() {
		return nil, ErrNotReady
	}
	n.wmu.Lock()
	defer n.wmu.Unlock()
	origin := n.Origin()
	var ops []Op
	var changes []Change
	err := n.db.Update(ctx, func(tx *meta.Tx) error {
		ops, changes = ops[:0], changes[:0]
		vv, err := tx.CatalogVV(ctx)
		if err != nil {
			return err
		}
		seq := vv[origin]
		for i := range drafts {
			d := &drafts[i]
			if d.build == nil {
				return invalidf("empty draft")
			}
			cur, err := tx.CatalogGetReg(ctx, d.Kind+"/"+d.Key)
			if errors.Is(err, meta.ErrNotFound) {
				cur, err = nil, nil
			}
			if err != nil {
				return err
			}
			seq++
			id := meta.CatalogOpID(origin, seq)
			payload, err := d.build(id, cur)
			if err != nil {
				return err
			}
			op := Op{Origin: origin, Seq: seq, HLC: n.clock.Now(), V: ProtocolVersion, Kind: d.Kind, Key: d.Key, Payload: payload}
			if cur != nil {
				op.Prev = cur.WinnerID()
			}
			if err := validateOp(&op); err != nil {
				return err
			}
			mop := op.toMeta()
			if _, err := tx.CatalogAppendOp(ctx, &mop); err != nil {
				return err
			}
			reg := regOf(&op)
			won, err := tx.CatalogUpsertReg(ctx, reg)
			if err != nil {
				return err
			}
			if won {
				changes = append(changes, changeOf(reg, true, false))
			}
			ops = append(ops, op)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	changes = coalesce(changes)
	n.bm.apply(changes)
	n.disp.enqueue(changes)
	n.nudgePeers("")
	return append([]Op(nil), ops...), nil
}

// regOf is the register row an op writes.
func regOf(op *Op) *meta.CatalogReg {
	del := op.Deleted()
	return &meta.CatalogReg{
		Key: op.Reg(), Kind: op.Kind, Name: op.Key, Deleted: del, Payload: []byte(op.Payload),
		Aux: auxOf(op.Kind, op.Payload, del), Prev: op.Prev, HLC: uint64(op.HLC), Origin: op.Origin, Seq: op.Seq,
	}
}

func (n *Node) one(ctx context.Context, d Draft) (Op, error) {
	ops, err := n.Write(ctx, d)
	if err != nil {
		return Op{}, err
	}
	return ops[0], nil
}

// CreateBucket writes the bucket/<name> entry of a new bucket (the home calls it
// when it creates the bucket). Without an explicit Generation the returned op's id
// is the bucket's generation.
func (n *Node) CreateBucket(ctx context.Context, name string, e BucketEntry) (Op, error) {
	return n.one(ctx, CreateBucketDraft(name, e))
}

// UpdateBucket rewrites a live bucket entry: attachments changed, or the home
// and epoch changed by a move's hand-off (§8.8).
func (n *Node) UpdateBucket(ctx context.Context, name string, fn func(cur BucketEntry) (BucketEntry, error)) (Op, error) {
	return n.one(ctx, UpdateBucketDraft(name, fn))
}

// DeleteBucket tombstones a bucket entry (also `catalog_only` deletes, §6.3).
func (n *Node) DeleteBucket(ctx context.Context, name string) (Op, error) {
	return n.one(ctx, DeleteBucketDraft(name))
}

// CreatePipeline writes the pipeline/<name> entry of a new pipeline.
func (n *Node) CreatePipeline(ctx context.Context, name string, e PipelineEntry) (Op, error) {
	return n.one(ctx, CreatePipelineDraft(name, e))
}

// UpdatePipeline rewrites a live pipeline entry.
func (n *Node) UpdatePipeline(ctx context.Context, name string, fn func(cur PipelineEntry) (PipelineEntry, error)) (Op, error) {
	return n.one(ctx, UpdatePipelineDraft(name, fn))
}

// DeletePipeline tombstones a pipeline entry.
func (n *Node) DeletePipeline(ctx context.Context, name string) (Op, error) {
	return n.one(ctx, DeletePipelineDraft(name))
}

// PutKey publishes access key id -> bucket (the home calls it when it creates a
// token).
func (n *Node) PutKey(ctx context.Context, accessKeyID string, e KeyEntry) (Op, error) {
	return n.one(ctx, PutKeyDraft(accessKeyID, e))
}

// DeleteKey tombstones an access-key index entry.
func (n *Node) DeleteKey(ctx context.Context, accessKeyID string) (Op, error) {
	return n.one(ctx, DeleteKeyDraft(accessKeyID))
}
