package pipeline

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/admin"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// Cluster mode (spec §8.5, §8.7).
//
// In a cluster pipeline definitions are catalog data: every pipeline write is a
// catalog op (the pipeline/<name> register), and every node — the one that took
// the admin call included — materialises the register into its own pipelines
// table and caches (materialise, run from cluster.Node.OnChange and, at start-up,
// from SyncCatalog). The register is last-writer-wins and carries the pipeline's
// generation: a node drops the attachments, and cancels the queued runs, of any
// generation that is not the register's, whether the register is a tombstone or a
// pipeline created again under the same name, so the outcome does not depend on
// which op arrived first.
//
// ?wait=replicated depends on that materialisation being synchronous with the
// delivery of the change: a node acknowledges an op to its peers only after the
// change has been delivered to its subscribers (cluster.Node.OnChange returned for
// it), so once the writer's call returns, a read of the pipeline through any node
// finds it. A subscriber that handed the work to another goroutine would break that.
//
// Attachments stay bucket state at the bucket's home. Only their names go into
// the bucket's catalog entry (PublishAttachments), so that `attached_to` and the
// delete guard work from any node.

// SetCluster puts the manager in cluster mode: from now on pipeline writes go
// through the catalog of n, and OnCatalogChange keeps the local copy in step.
func (m *Manager) SetCluster(n *cluster.Node) { m.cl = n }

// Clustered reports whether the manager runs in cluster mode.
func (m *Manager) Clustered() bool { return m.cl != nil }

// secret fields of a PipelineEntry.Sealed.
const (
	sealedHeaders = "headers"
	sealedSigning = "signing_secret"
)

// catalogDefinition is the definition document a pipeline/<name> register
// carries: the definition as responses show it (header values redacted, no
// signing secret), with its creation time and without the revision (the
// register's own) and the update time (the op's).
func catalogDefinition(def Definition, hasSecret bool, createdAt time.Time) (json.RawMessage, error) {
	pub := def.Public(hasSecret)
	pub.Revision, pub.UpdatedAt, pub.AttachedTo = 0, time.Time{}, nil
	pub.CreatedAt = createdAt.UTC()
	return json.Marshal(pub)
}

// sealedOf is the sealed secrets of a pipeline as a register carries them.
func sealedOf(name string, headers, signing []byte) map[string]cluster.SealedValue {
	out := map[string]cluster.SealedValue{}
	if len(headers) > 0 {
		out[sealedHeaders] = cluster.SealedValue{Type: SealHeaders, ID: name, Value: headers}
	}
	if len(signing) > 0 {
		out[sealedSigning] = cluster.SealedValue{Type: SealSigning, ID: name, Value: signing}
	}
	if len(out) == 0 {
		return nil
	}
	return out
}

// rowOf builds the pipelines-table row of a register.
func rowOf(name string, e *cluster.PipelineEntry, at time.Time) (*meta.Pipeline, Definition, error) {
	var def Definition
	if err := json.Unmarshal(e.Definition, &def); err != nil {
		return nil, def, fmt.Errorf("pipeline %q: unreadable definition in the catalog: %w", name, err)
	}
	def.Name = name
	created := def.CreatedAt
	if created.IsZero() {
		created = at
	}
	row := &meta.Pipeline{
		Name: name, Generation: e.Generation, Revision: e.Revision, Stage: def.Stage, Definition: string(e.Definition),
		HeadersSealed: e.Sealed[sealedHeaders].Value, SigningSealed: e.Sealed[sealedSigning].Value,
		CreatedAt: created.UTC(), UpdatedAt: at.UTC(),
	}
	return row, def, nil
}

// entryOfRow builds the register value of a pipeline that exists only locally
// (a single node joining a cluster publishes what it has, with its own
// generation and revision).
func entryOfRow(p *meta.Pipeline) (cluster.PipelineEntry, error) {
	var def Definition
	if err := json.Unmarshal([]byte(p.Definition), &def); err != nil {
		return cluster.PipelineEntry{}, fmt.Errorf("pipeline %q: unreadable definition: %w", p.Name, err)
	}
	def.Name, def.Stage = p.Name, p.Stage
	doc, err := catalogDefinition(def, len(p.SigningSealed) > 0, p.CreatedAt)
	if err != nil {
		return cluster.PipelineEntry{}, err
	}
	return cluster.PipelineEntry{
		Definition: doc, Revision: p.Revision, Generation: p.Generation, Sealed: sealedOf(p.Name, p.HeadersSealed, p.SigningSealed),
	}, nil
}

// catalogErr maps a cluster error to an admin error.
func catalogErr(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, cluster.ErrNotReady):
		return admin.Unavailable("this node is starting: the cluster start-up fence has not ended")
	case errors.Is(err, cluster.ErrStopped):
		return admin.Unavailable("this node is shutting down")
	}
	return admin.Internal(err)
}

// ---- writes ----------------------------------------------------------------------------------

// writePipelineCluster is writePipeline in a cluster: the validated and encoded
// definition becomes a catalog op, and the node materialises it at once, so the
// caller reads its own write. The op is handed to rc for ?wait=replicated.
func (m *Manager) writePipelineCluster(rc *admin.Ctx, def Definition, enc encoded, cur *Pipe, rev int64) (*Pipe, error) {
	created := m.Now()
	if cur != nil {
		created = cur.Def.CreatedAt
	}
	doc, err := catalogDefinition(def, len(enc.signing) > 0, created)
	if err != nil {
		return nil, admin.Internal(err)
	}
	entry := cluster.PipelineEntry{Definition: doc, Sealed: sealedOf(def.Name, enc.headers, enc.signing)}
	// the catalog write and the materialisation outlive a client that goes away
	ctx := context.WithoutCancel(rc.Ctx)
	var op cluster.Op
	if cur == nil {
		if n, err := m.db.Read().CountPipelines(ctx); err == nil && n >= MaxPipelines {
			return nil, admin.Conflict(fmt.Sprintf("at most %d pipelines can be defined", MaxPipelines))
		}
		op, err = m.cl.CreatePipeline(ctx, def.Name, entry)
	} else {
		op, err = m.cl.UpdatePipeline(ctx, def.Name, func(c cluster.PipelineEntry) (cluster.PipelineEntry, error) {
			if rev > 0 && c.Revision != rev {
				return c, errPipelineChanged
			}
			entry.Revision, entry.Generation = c.Revision, c.Generation
			return entry, nil
		})
	}
	switch {
	case errors.Is(err, cluster.ErrExists):
		return nil, admin.Conflict(fmt.Sprintf("pipeline %q already exists", def.Name))
	case errors.Is(err, cluster.ErrNotFound):
		return nil, admin.NotFound(fmt.Sprintf("pipeline %q does not exist", def.Name))
	case errors.Is(err, errPipelineChanged):
		return nil, errPipelineChanged
	case err != nil:
		return nil, catalogErr(err)
	}
	rc.AddOps(op)
	if err := m.materialise(ctx, def.Name); err != nil {
		return nil, admin.Internal(err)
	}
	p, err := m.pipe(ctx, m.db.Read(), def.Name)
	if err != nil || p == nil {
		return nil, admin.Internal(fmt.Errorf("pipeline %q was written to the catalog but cannot be read back: %v", def.Name, err))
	}
	return p, nil
}

// deletePipelineCluster is deletePipeline in a cluster: `attached_to` comes from
// the catalog (the buckets' entries name their attached pipelines), the delete
// is a tombstone, and every home drops its attachments and cancels its queued
// runs when it materialises it.
func (m *Manager) deletePipelineCluster(rc *admin.Ctx, name string) error {
	detach := rc.R.URL.Query().Get("detach") == "true"
	if _, ok := m.cl.Pipeline(name); !ok {
		return admin.NotFound(fmt.Sprintf("pipeline %q does not exist", name))
	}
	if attached := m.cl.AttachedTo(name); len(attached) > 0 && !detach {
		return admin.Conflict(fmt.Sprintf("pipeline %q is attached to %s; detach it first or use ?detach=true", name, strings.Join(attached, ", ")))
	}
	ctx := context.WithoutCancel(rc.Ctx)
	op, err := m.cl.DeletePipeline(ctx, name)
	if err != nil {
		return catalogErr(err)
	}
	rc.AddOps(op)
	if err := m.materialise(ctx, name); err != nil {
		return admin.Internal(err)
	}
	rc.WriteReplicated(http.StatusNoContent, nil)
	return nil
}

// attachedTo lists the buckets a pipeline is attached to: from the catalog in a
// cluster, from the local attachments otherwise.
func (m *Manager) attachedTo(ctx context.Context, name string) ([]string, error) {
	if m.cl != nil {
		return append([]string{}, m.cl.AttachedTo(name)...), nil
	}
	atts, err := m.db.Read().AttachmentsOfPipeline(ctx, name)
	if err != nil {
		return nil, err
	}
	out := []string{}
	for _, a := range atts {
		out = append(out, a.Bucket)
	}
	return out, nil
}

// ---- materialising the catalog -----------------------------------------------------------

// OnCatalogChange is the cluster.Node.OnChange subscriber: it makes the local
// pipelines table follow every pipeline register that changed.
func (m *Manager) OnCatalogChange(changes []cluster.Change) {
	for _, c := range changes {
		if c.Kind != cluster.KindPipeline {
			continue
		}
		if err := m.materialise(m.ctx, c.Name); err != nil && m.ctx.Err() == nil {
			m.log.Error("applying a catalog pipeline failed", "pipeline", c.Name, "error", err)
		}
	}
}

// materialise makes this node's copy of one pipeline equal to its register.
// It is idempotent and reads the register itself, so it converges whatever the
// order in which changes and calls arrive: the last run sees the last register.
// A name the catalog has never heard of is left alone — it is a local pipeline
// that SyncCatalog has not published yet.
func (m *Manager) materialise(ctx context.Context, name string) error {
	buckets, err := m.materialiseLocked(ctx, name)
	if err != nil {
		return err
	}
	for _, b := range buckets {
		if err := m.PublishAttachments(ctx, b); err != nil {
			m.log.Warn("publishing a bucket's attachments after a pipeline change failed", "bucket", b, "error", err)
		}
	}
	return nil
}

func (m *Manager) materialiseLocked(ctx context.Context, name string) ([]string, error) {
	m.matMu.Lock()
	defer m.matMu.Unlock()
	reg, err := m.cl.Register(ctx, cluster.KindPipeline, name)
	switch {
	case errors.Is(err, cluster.ErrNotFound):
		return nil, nil
	case err != nil:
		return nil, err
	case reg.Deleted:
		return m.dropLocal(ctx, name)
	}
	var e cluster.PipelineEntry
	if err := json.Unmarshal(reg.Value, &e); err != nil {
		return nil, fmt.Errorf("pipeline %q: unreadable register: %w", name, err)
	}
	row, def, err := rowOf(name, &e, reg.HLC.Physical())
	if err != nil {
		return nil, err
	}
	var (
		dropped   []string
		refs      []meta.RunRef
		cancelled []string
		changed   bool
	)
	err = m.db.Update(ctx, func(tx *meta.Tx) error {
		dropped, refs, cancelled, changed = nil, nil, nil, false
		old, err := tx.GetPipeline(ctx, name)
		if err != nil && !errors.Is(err, meta.ErrNotFound) {
			return err
		}
		have := err == nil
		if have && old.Generation == row.Generation && old.Revision == row.Revision && old.Definition == row.Definition &&
			bytes.Equal(old.HeadersSealed, row.HeadersSealed) && bytes.Equal(old.SigningSealed, row.SigningSealed) {
			return nil // already there
		}
		changed = true
		if have && old.Generation != row.Generation {
			// a pipeline deleted and created again is a new pipeline: what was made for
			// the old one goes (spec §8.5)
			if dropped, err = tx.DeleteStaleAttachments(ctx, name, row.Generation); err != nil {
				return err
			}
			for _, b := range dropped {
				if err := tx.KVDelete(ctx, attachmentHoldKey(b, name)); err != nil {
					return err
				}
			}
			if refs, err = tx.CancelStaleRuns(ctx, name, row.Generation, ReasonPipelineRemoved, tx.Now()); err != nil {
				return err
			}
			if cancelled, err = runningBackfillsOf(ctx, tx, name); err != nil {
				return err
			}
			if err := tx.CancelBackfillsOf(ctx, "", name, tx.Now()); err != nil {
				return err
			}
			if err := tx.KVDelete(ctx, pipelineHoldKey(name)); err != nil {
				return err
			}
		}
		if err := tx.PutPipeline(ctx, row); err != nil {
			return err
		}
		// a pipeline released after being held: the time it was held does not count
		// toward its queued runs' 24 hours of retrying (spec §7.10)
		return m.settlePipelineHold(ctx, tx, def)
	})
	if err != nil {
		return nil, err
	}
	if !changed {
		// make sure the caches hold it (a restart finds the row but not the cache)
		if m.pipes.get(name) == nil {
			if fresh, err := m.db.Read().GetPipeline(ctx, name); err == nil {
				if p, err := open(m.ring, fresh); err == nil {
					m.pipes.set(p)
					m.sems.of(p)
				}
			}
		}
		return nil, nil
	}
	fresh, err := m.db.Read().GetPipeline(ctx, name)
	if err != nil {
		return nil, err
	}
	p, err := open(m.ring, fresh)
	if err != nil {
		return nil, err
	}
	m.pipes.set(p)
	m.sems.of(p) // applies a changed max_concurrency
	m.afterDrop(dropped, refs, cancelled)
	return dropped, nil
}

// dropLocal removes a pipeline whose register is a tombstone: the row, every
// attachment, the queued runs and the walking backfills.
func (m *Manager) dropLocal(ctx context.Context, name string) ([]string, error) {
	var (
		dropped   []string
		refs      []meta.RunRef
		cancelled []string
		had       bool
	)
	err := m.db.Update(ctx, func(tx *meta.Tx) error {
		dropped, refs, cancelled, had = nil, nil, nil, false
		_, err := tx.GetPipeline(ctx, name)
		switch {
		case err == nil:
			had = true
		case !errors.Is(err, meta.ErrNotFound):
			return err
		}
		if dropped, err = tx.DeleteStaleAttachments(ctx, name, ""); err != nil {
			return err
		}
		for _, b := range dropped {
			if err := tx.KVDelete(ctx, attachmentHoldKey(b, name)); err != nil {
				return err
			}
		}
		if err := tx.KVDelete(ctx, pipelineHoldKey(name)); err != nil {
			return err
		}
		if refs, err = tx.CancelStaleRuns(ctx, name, "", ReasonPipelineRemoved, tx.Now()); err != nil {
			return err
		}
		if cancelled, err = runningBackfillsOf(ctx, tx, name); err != nil {
			return err
		}
		if err := tx.CancelBackfillsOf(ctx, "", name, tx.Now()); err != nil {
			return err
		}
		if had {
			return tx.DeletePipeline(ctx, name)
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	m.pipes.remove(name)
	m.sems.forget(name)
	m.afterDrop(dropped, refs, cancelled)
	return dropped, nil
}

func runningBackfillsOf(ctx context.Context, tx *meta.Tx, pipeline string) ([]string, error) {
	bfs, err := tx.RunningBackfills(ctx)
	if err != nil {
		return nil, err
	}
	var ids []string
	for _, b := range bfs {
		if b.Pipeline == pipeline {
			ids = append(ids, b.ID)
		}
	}
	return ids, nil
}

// BucketImported makes the attachments that came with a moved bucket agree with
// the catalog's pipelines, in the transaction that imports the bucket's rows on its
// new home (spec §8.8 step 4): a pipeline deleted, or deleted and created again,
// while the bucket was on its way is a pipeline the bucket is not attached to any
// more, and what was made for it goes — the attachment, its queued runs and its
// running backfills — exactly as when this node materialises such a change. The old
// home does the same to the rows it keeps, which the move has exported already, so
// without this the new home would hold an attachment of a generation nobody can
// check and no change of the pipeline would ever clean it up.
//
// missing names a pipeline of which the node's catalog does not hold what the
// attachment was made for yet — no register at all, or an older incarnation than the
// attachment's, whose creating op has not arrived: the pipeline's register is still on
// its way here, so nothing can be said about the attachment and the import must not
// go on (nothing was changed; the move waits and asks again).
func (m *Manager) BucketImported(ctx context.Context, tx *meta.Tx, bucket string) (missing string, err error) {
	if m.cl == nil {
		return "", nil
	}
	atts, err := tx.ListAttachments(ctx, bucket)
	if err != nil {
		return "", err
	}
	var stale []string
	for _, a := range atts {
		gen, live, exists := m.cl.PipelineGeneration(a.Pipeline)
		switch {
		case !exists:
			return a.Pipeline, nil
		case !live || gen != a.Generation:
			// The attachment is stale only if this node knows the incarnation it was made
			// for (a generation is the id of the op that created the pipeline) and the
			// register is of a later one. A node that has not applied that op yet sees an
			// older register — an older incarnation, or the tombstone before the re-creation
			// — and would drop an attachment that is current.
			if applied, known := m.cl.OpApplied(a.Generation); known && !applied {
				return a.Pipeline, nil
			}
			stale = append(stale, a.Pipeline)
		}
	}
	if len(stale) == 0 {
		return "", nil
	}
	var refs []meta.RunRef
	for _, name := range stale {
		if err := tx.DeleteAttachment(ctx, bucket, name); err != nil {
			return "", err
		}
		if err := tx.KVDelete(ctx, attachmentHoldKey(bucket, name)); err != nil {
			return "", err
		}
		r, err := tx.CancelRuns(ctx, meta.RunFilter{Bucket: bucket, Pipeline: name}, ReasonPipelineRemoved, tx.Now())
		if err != nil {
			return "", err
		}
		refs = append(refs, r...)
		if err := tx.CancelBackfillsIn(ctx, bucket, name, tx.Now()); err != nil {
			return "", err
		}
	}
	tx.AfterCommit(func() {
		m.log.Info("move: dropped the attachments of pipelines that changed while the bucket was moving", "bucket", bucket, "pipelines", stale, "runs_cancelled", len(refs))
		m.atts.forget(bucket)
		for _, r := range refs {
			m.mt.runs.Inc(r.Pipeline, r.Stage, meta.RunCancelled)
		}
	})
	return "", nil
}

// afterDrop updates the node-local state after attachments, runs and backfills
// were taken away.
func (m *Manager) afterDrop(buckets []string, refs []meta.RunRef, backfills []string) {
	for _, b := range buckets {
		m.atts.forget(b)
	}
	for _, id := range backfills {
		m.bf.cancel(id)
	}
	for _, r := range refs {
		m.mt.runs.Inc(r.Pipeline, r.Stage, meta.RunCancelled)
	}
	m.notify()
}

// SyncCatalog brings the node's pipelines in line with the catalog at start-up,
// after the start-up fence (spec §8.5): every register is materialised — the
// ones that changed while the node was down — and a pipeline that exists only
// here, because the data dir came from a single node, is published with its
// local generation and revision. A catalog tombstone for a local pipeline wins:
// it was deleted while this node was away.
func (m *Manager) SyncCatalog(ctx context.Context) error {
	seen := map[string]bool{}
	for after := ""; ; {
		rows, err := m.db.Read().ListPipelines(ctx, after, 200)
		if err != nil {
			return err
		}
		for _, row := range rows {
			after = row.Name
			seen[row.Name] = true
			_, err := m.cl.Register(ctx, cluster.KindPipeline, row.Name)
			if errors.Is(err, cluster.ErrNotFound) {
				entry, err := entryOfRow(row)
				if err != nil {
					m.log.Error("a local pipeline cannot be published", "pipeline", row.Name, "error", err)
					continue
				}
				if _, err := m.cl.CreatePipeline(ctx, row.Name, entry); err != nil && !errors.Is(err, cluster.ErrExists) {
					return fmt.Errorf("publishing pipeline %q: %w", row.Name, err)
				}
				m.log.Info("published a local pipeline to the cluster catalog", "pipeline", row.Name)
			} else if err != nil {
				return err
			}
			if err := m.materialise(ctx, row.Name); err != nil {
				return err
			}
		}
		if len(rows) < 200 {
			break
		}
	}
	for after := ""; ; {
		recs, err := m.cl.ListPipelines(ctx, after, 200)
		if err != nil {
			return err
		}
		for _, rec := range recs {
			after = rec.Name
			if seen[rec.Name] {
				continue
			}
			if err := m.materialise(ctx, rec.Name); err != nil {
				return err
			}
		}
		if len(recs) < 200 {
			return nil
		}
	}
}

// ---- attachments in the catalog -------------------------------------------------------------

// AttachmentNames lists, in order, the names of the pipelines attached to a
// local bucket.
func (m *Manager) AttachmentNames(ctx context.Context, bucket string) ([]string, error) {
	atts, err := m.db.Read().ListAttachments(ctx, bucket)
	if err != nil {
		return nil, err
	}
	names := make([]string, 0, len(atts))
	for _, a := range atts {
		names = append(names, a.Pipeline)
	}
	return names, nil
}

// PublishAttachments writes the names of a bucket's attached pipelines into the
// bucket's catalog entry when they differ (spec §8.2, §8.7). It does nothing for
// a bucket this node is not the catalog's home of: the home owns the truth about
// its bucket, and this is also how a home repairs an entry that another write
// (a hand-off, a concurrent update) left with stale names. Callers are serialised,
// and each reads the attachments inside the critical section, so the last write
// carries the last state.
func (m *Manager) PublishAttachments(ctx context.Context, bucket string) error {
	if m.cl == nil {
		return nil
	}
	m.pubMu.Lock()
	defer m.pubMu.Unlock()
	b, err := m.db.Read().GetBucket(ctx, bucket)
	if err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return nil
		}
		return err
	}
	rec, ok := m.cl.Bucket(bucket)
	if !ok || rec.Home != m.cl.ID() || rec.Generation != b.Generation || rec.Epoch != b.Epoch {
		return nil
	}
	names, err := m.AttachmentNames(ctx, bucket)
	if err != nil {
		return err
	}
	if slices.Equal(names, rec.Pipelines) {
		return nil
	}
	_, err = m.cl.UpdateBucket(ctx, bucket, func(c cluster.BucketEntry) (cluster.BucketEntry, error) {
		c.Pipelines = names
		return c, nil
	})
	if errors.Is(err, cluster.ErrNotFound) {
		return nil
	}
	return err
}
