package engine

import (
	"context"
	"errors"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// CommitInput describes one write for the commit transaction (spec §3.5
// step 6). It is used by PutObject, POST, CopyObject, CompleteMultipartUpload
// and pipeline writes alike.
type CommitInput struct {
	Bucket  string
	Key     string
	Version string // ULID allocated at admission
	Op      string // put | post | copy | multipart | pipeline | backfill ...
	Actor   Actor

	// Obj carries the new version's content fields: sizes, digests, headers,
	// metadata, tags, parts, SSE. Identity and ordering fields are set here.
	Obj meta.Object

	// NewBlob is the blob created for this write (nil for a copy that shares
	// the source's blob, which is referenced instead).
	NewBlob *meta.Blob
	// CopyFrom, when set, is the source version row (by seq): re-read in the
	// transaction; the copy takes its blob and content fields (spec §3.5).
	CopyFrom *CopyFrom

	// Sniffed is the content type found in the bytes being committed, checked
	// against the bucket's allowed_content_types ("" = not sniffed, skip).
	Sniffed string

	// Preconditions and write-once, re-checked atomically.
	IfNoneMatchStar bool
	IfMatch         string // ETag, "" = none
	WriteOnce       bool   // token holds create but not write

	// ReleaseUploadBytes is the open-upload byte count freed by this commit
	// (CompleteMultipartUpload), applied to quota and counters.
	ReleaseUploadBytes int64
	// ReleaseFn, when set, computes the released bytes inside the commit
	// transaction from the live part rows (CompleteMultipartUpload): a part
	// uploaded while the object was being assembled is then neither leaked in
	// upload_bytes nor silently dropped. It may fail the commit.
	ReleaseFn func(ctx context.Context, tx *meta.Tx) (int64, error)

	// Extra runs inside the transaction before it commits (multipart completion
	// marks the upload completed, deletes its part rows).
	Extra func(ctx context.Context, tx *meta.Tx) error
}

// CopyFrom identifies a copy source.
type CopyFrom struct {
	Seq int64
	// RequireVersion, when set, fails the copy with PreconditionFailed unless
	// the source row still has this version (the stale-write guard of pipeline
	// tokens, spec §7.8).
	RequireVersion string
	// RequireLatest, when set, additionally requires the source key's latest
	// version to be this one: the guard of a copy whose source is not pinned
	// (spec §7.8), evaluated in the same transaction.
	RequireLatest string
	// Override applies the request's header/metadata/tag choices over the source
	// row's fields: it receives the freshly read source row and the new object.
	Override func(src *meta.Object, dst *meta.Object)
	// Share is true when the destination shares the source blob (same
	// encryption state); otherwise the caller already created NewBlob.
	Share bool
}

// CommitResult is what a commit reports.
type CommitResult struct {
	Obj      *meta.Object // the committed version
	Previous *meta.Object // the key's latest version before the commit, if any
	Event    *Event
	Bucket   *meta.Bucket // bucket as read inside the transaction
	Modified bool         // a before pipeline replaced the content
}

// Commit runs the commit transaction.
func (e *Engine) Commit(ctx context.Context, in *CommitInput) (*CommitResult, error) {
	var res *CommitResult
	err := e.DB.Update(ctx, func(tx *meta.Tx) error {
		r, err := e.commitTx(ctx, tx, in)
		res = r
		return err
	})
	if err != nil {
		return nil, wrapErr(err)
	}
	e.afterEvent(res.Event)
	return res, nil
}

func (e *Engine) afterEvent(ev *Event) {
	if ev != nil && e.Hooks.After != nil {
		e.Hooks.After(ev)
	}
}

func visible(o *meta.Object) bool { return o != nil && !o.DeleteMarker }

// commitTx is the versioned write state machine of spec §3.10.
func (e *Engine) commitTx(ctx context.Context, tx *meta.Tx, in *CommitInput) (*CommitResult, error) {
	b, err := tx.GetBucket(ctx, in.Bucket)
	if err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return nil, noSuchBucket(in.Bucket)
		}
		return nil, err
	}
	latest, err := tx.GetLatest(ctx, in.Bucket, in.Key)
	if err != nil && !errors.Is(err, meta.ErrNotFound) {
		return nil, err
	}
	if errors.Is(err, meta.ErrNotFound) {
		latest = nil
	}

	// The stale-write guard of an after run's token: a write to the triggering
	// key is conditional on the object still being the one the event is about.
	if g := in.Actor.Guard; g.Applies(in.Key) {
		if err := g.Check(latest); err != nil {
			return nil, err
		}
	}

	obj := in.Obj
	obj.Bucket, obj.Key, obj.Version = in.Bucket, in.Key, in.Version
	obj.DeleteMarker = false

	// Copy: take the blob reference from the source row as it is right now.
	var src *meta.Object
	if in.CopyFrom != nil {
		guarded := in.CopyFrom.RequireVersion != "" || in.CopyFrom.RequireLatest != ""
		src, err = tx.GetBySeq(ctx, in.CopyFrom.Seq)
		if err != nil || src == nil || src.DeleteMarker || src.BlobID == "" {
			if guarded {
				return nil, ErrObjectChanged() // the source moved on since the event
			}
			return nil, noSuchKey(in.Key)
		}
		if rv := in.CopyFrom.RequireVersion; rv != "" && src.Version != rv {
			return nil, ErrObjectChanged()
		}
		if rl := in.CopyFrom.RequireLatest; rl != "" {
			cur, err := tx.GetLatest(ctx, src.Bucket, src.Key)
			if err != nil && !errors.Is(err, meta.ErrNotFound) {
				return nil, err
			}
			if err != nil || cur.DeleteMarker || cur.Version != rl {
				return nil, ErrObjectChanged()
			}
		}
		if in.CopyFrom.Share {
			obj.BlobID, obj.Size, obj.ETag, obj.SHA256 = src.BlobID, src.Size, src.ETag, src.SHA256
			obj.ChecksumAlgo, obj.Checksum, obj.ChecksumType = src.ChecksumAlgo, src.Checksum, src.ChecksumType
			obj.Parts, obj.SSE = src.Parts, src.SSE
		}
		if in.CopyFrom.Override != nil {
			in.CopyFrom.Override(src, &obj)
		}
	}

	// Preconditions (spec §5.5) and write-once (spec §4.4).
	if in.IfNoneMatchStar && visible(latest) {
		return nil, apierr.New("PreconditionFailed", "At least one of the pre-conditions you specified did not hold.").WithExtra("Condition", "If-None-Match")
	}
	if in.IfMatch != "" {
		if !visible(latest) {
			return nil, noSuchKey(in.Key)
		}
		if !etagMatches(in.IfMatch, latest.ETag) {
			return nil, apierr.New("PreconditionFailed", "At least one of the pre-conditions you specified did not hold.").WithExtra("Condition", "If-Match")
		}
	}
	if in.WriteOnce && visible(latest) {
		return nil, apierr.New("AccessDenied", "This token may only create new keys; it cannot overwrite an existing object.")
	}

	// Bucket rules and quota against the final object (spec §3.13, §3.2).
	if b.MaxObjectBytes != nil && obj.Size > *b.MaxObjectBytes {
		return nil, apierr.New("EntityTooLarge", "Your proposed upload exceeds the maximum allowed object size.")
	}
	if obj.Size > e.Cfg.MaxObjectBytes {
		return nil, apierr.New("EntityTooLarge", "Your proposed upload exceeds the maximum allowed object size.")
	}
	if in.Sniffed != "" && !TypeAllowed(b.AllowedContentTypes, in.Sniffed) {
		return nil, apierr.Newf("ContentTypeNotAllowed", "The detected content type %q is not allowed in this bucket.", MediaType(in.Sniffed))
	}
	var replacedBytes, replacedVersions int64
	if b.Versioning != meta.VersioningEnabled && latest != nil {
		replacedBytes, replacedVersions = latest.Size, 1
	}
	release := in.ReleaseUploadBytes
	if in.ReleaseFn != nil {
		if release, err = in.ReleaseFn(ctx, tx); err != nil {
			return nil, err
		}
	}
	if b.QuotaBytes != nil {
		if b.Bytes+b.UploadBytes-release-replacedBytes+obj.Size > *b.QuotaBytes {
			return nil, apierr.New("QuotaExceeded", "The bucket's storage quota would be exceeded.")
		}
	}
	if b.MaxObjects != nil {
		if (b.Versions-b.DeleteMarkers)-replacedVersions+1 > *b.MaxObjects {
			return nil, apierr.New("QuotaExceeded", "The bucket's object count limit would be exceeded.")
		}
	}

	now := tx.Now().Truncate(time.Millisecond)
	obj.CreatedAt = now
	obj.IsLatest = true
	obj.NoncurrentSince = nil

	var d meta.Counters
	d.UploadBytes = -release
	prevVisible := visible(latest)

	switch b.Versioning {
	case meta.VersioningEnabled:
		obj.NullVersion = false
		if latest != nil {
			if err := tx.SetNoncurrent(ctx, latest.Seq, now.UnixMilli()); err != nil {
				return nil, err
			}
		}
	default:
		obj.NullVersion = true
		if latest != nil {
			if err := e.dropRow(ctx, tx, latest, &d); err != nil {
				return nil, err
			}
		}
	}

	// Blob reference for the new row.
	if in.NewBlob != nil {
		nb := *in.NewBlob
		nb.Bucket = in.Bucket
		nb.Refs = 1
		if err := tx.InsertBlob(ctx, &nb); err != nil {
			return nil, err
		}
		obj.BlobID = nb.BlobID
	} else {
		if obj.BlobID == "" {
			return nil, apierr.New("InternalError", "commit without a blob")
		}
		if _, err := tx.RefBlob(ctx, obj.BlobID, 1); err != nil {
			if errors.Is(err, meta.ErrNotFound) {
				return nil, noSuchKey(in.Key)
			}
			return nil, err
		}
	}

	if err := tx.InsertObject(ctx, &obj); err != nil {
		return nil, err
	}
	d.Versions++
	d.Bytes += obj.Size
	if !prevVisible {
		d.Objects++ // the key gains a visible object
	}
	if err := tx.AddCounters(ctx, in.Bucket, d); err != nil {
		return nil, err
	}

	if in.Extra != nil {
		if err := in.Extra(ctx, tx); err != nil {
			return nil, err
		}
	}

	res := &CommitResult{Obj: &obj, Previous: latest, Bucket: b}
	typ := EventCreated
	if prevVisible {
		typ = EventUpdated
	}
	ev := &Event{Type: typ, Operation: in.Op, Bucket: in.Bucket, Key: in.Key, Object: &obj, Actor: in.Actor, At: now, Sniffed: in.Sniffed}
	if prevVisible {
		ev.Previous = latest
	}
	if src != nil {
		ev.CopySource = &CopySource{Key: src.Key, Version: src.Version}
	}
	res.Event = ev
	if e.Hooks.Outbox != nil {
		if err := e.Hooks.Outbox(ctx, tx, ev); err != nil {
			return nil, err
		}
	}
	return res, nil
}

// dropRow removes a version row for good: row, blob reference and the version,
// marker and byte counters. The caller accounts for the visible-key count.
func (e *Engine) dropRow(ctx context.Context, tx *meta.Tx, o *meta.Object, d *meta.Counters) error {
	if err := tx.DeleteObjectRow(ctx, o.Seq); err != nil {
		return err
	}
	if o.BlobID != "" {
		if _, err := tx.RefBlob(ctx, o.BlobID, -1); err != nil && !errors.Is(err, meta.ErrNotFound) {
			return err
		}
	}
	d.Versions--
	if o.DeleteMarker {
		d.DeleteMarkers--
	} else {
		d.Bytes -= o.Size
	}
	return nil
}

// etagMatches compares an If-Match value (possibly a list, possibly quoted or
// weak-prefixed) against a stored ETag.
func etagMatches(header, etag string) bool {
	for _, c := range splitETags(header) {
		if c == "*" || c == etag {
			return true
		}
	}
	return false
}

// splitETags parses an If-Match / If-None-Match header into bare ETag values.
func splitETags(h string) []string {
	var out []string
	for _, part := range splitComma(h) {
		p := trimSpace(part)
		p = trimPrefix(p, "W/")
		p = trimQuotes(p)
		if p != "" {
			out = append(out, p)
		}
	}
	return out
}

// ---- deletes ---------------------------------------------------------------

// DeleteRequest is a DeleteObject (spec §5.4.3).
type DeleteRequest struct {
	Bucket    string
	Key       string
	VersionID string // S3 version id; "" = none ("null" is normalised away in unversioned buckets)
	Op        string // delete | lifecycle | ...
	Actor     Actor
	// IfSeq conditions the delete on the state the caller observed: > 0 skips it
	// unless the key's latest version still has this seq; -1 skips it if the key
	// now has a visible object (the caller saw none); 0 = unconditional.
	IfSeq int64
}

// DeleteResult describes the outcome.
type DeleteResult struct {
	// DeleteMarker: a marker was created, or the version removed was a marker.
	DeleteMarker bool
	// VersionID is the S3 version id of the marker created or the version
	// removed ("" when nothing happened or the bucket is unversioned).
	VersionID string
	Existed   bool
	Event     *Event
	Skipped   bool // IfSeq did not match
	Bucket    *meta.Bucket
}

// Delete deletes a key (adding a marker when the bucket is versioned), or one
// version permanently when VersionID is set.
func (e *Engine) Delete(ctx context.Context, req *DeleteRequest) (*DeleteResult, error) {
	var res *DeleteResult
	err := e.DB.Update(ctx, func(tx *meta.Tx) error {
		r, err := e.deleteTx(ctx, tx, req)
		res = r
		return err
	})
	if err != nil {
		return nil, wrapErr(err)
	}
	e.afterEvent(res.Event)
	return res, nil
}

func (e *Engine) deleteTx(ctx context.Context, tx *meta.Tx, req *DeleteRequest) (*DeleteResult, error) {
	b, err := tx.GetBucket(ctx, req.Bucket)
	if err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return nil, noSuchBucket(req.Bucket)
		}
		return nil, err
	}
	vid := req.VersionID
	if b.Versioning != meta.VersioningEnabled {
		if vid == "null" {
			vid = ""
		} else if vid != "" {
			return nil, apierr.New("InvalidArgument", "Invalid version id specified: this bucket is not versioned.")
		}
	}
	latest, err := tx.GetLatest(ctx, req.Bucket, req.Key)
	if err != nil && !errors.Is(err, meta.ErrNotFound) {
		return nil, err
	}
	if errors.Is(err, meta.ErrNotFound) {
		latest = nil
	}
	res := &DeleteResult{Bucket: b}
	// The stale-write guard: a delete naming the triggering key is conditional on
	// the object still being the one the event is about, unless it purges
	// exactly the event's version (spec §7.8).
	if g := req.Actor.Guard; g.Applies(req.Key) {
		pinned := false
		if vid != "" && !g.Absent {
			if t, gerr := tx.GetS3Version(ctx, req.Bucket, req.Key, vid); gerr == nil && t.Version == g.Version {
				pinned = true
			}
		}
		if !pinned {
			if err := g.Check(latest); err != nil {
				return nil, err
			}
		}
	}
	if req.IfSeq > 0 && (latest == nil || latest.Seq != req.IfSeq) ||
		req.IfSeq < 0 && visible(latest) {
		res.Skipped = true
		return res, nil
	}
	now := tx.Now().Truncate(time.Millisecond)
	var d meta.Counters
	prevVisible := visible(latest)

	switch {
	case vid != "":
		// permanent removal of one version or marker
		target, err := tx.GetS3Version(ctx, req.Bucket, req.Key, vid)
		if err != nil {
			if errors.Is(err, meta.ErrNotFound) {
				res.VersionID = vid
				return res, nil // idempotent, as S3
			}
			return nil, err
		}
		res.Existed = true
		res.VersionID = target.S3VersionID()
		res.DeleteMarker = target.DeleteMarker
		wasLatest := target.IsLatest
		if err := e.dropRow(ctx, tx, target, &d); err != nil {
			return nil, err
		}
		if wasLatest && !target.DeleteMarker {
			d.Objects-- // the visible key loses its object (re-added below if an older one is uncovered)
		}
		var newLatest *meta.Object
		if wasLatest {
			newLatest, err = tx.NewestVersion(ctx, req.Bucket, req.Key)
			if err != nil && !errors.Is(err, meta.ErrNotFound) {
				return nil, err
			}
			if errors.Is(err, meta.ErrNotFound) {
				newLatest = nil
			}
			if newLatest != nil {
				if err := tx.SetLatest(ctx, newLatest.Seq); err != nil {
					return nil, err
				}
				newLatest.IsLatest, newLatest.NoncurrentSince = true, nil
				if !newLatest.DeleteMarker {
					d.Objects++
				}
			}
		}
		if err := tx.AddCounters(ctx, req.Bucket, d); err != nil {
			return nil, err
		}
		if wasLatest {
			now2 := visible(newLatest)
			var typ string
			switch {
			case !prevVisible && now2:
				typ = EventCreated
			case prevVisible && now2:
				typ = EventUpdated
			case prevVisible && !now2:
				typ = EventDeleted
			}
			if typ != "" {
				ev := &Event{Type: typ, Operation: "delete_version", Bucket: req.Bucket, Key: req.Key, Actor: req.Actor, At: now}
				if now2 {
					ev.Object = newLatest
				}
				if prevVisible {
					ev.Previous = latest
				}
				res.Event = ev
			}
		}

	case b.Versioning == meta.VersioningEnabled:
		if latest == nil {
			return res, nil
		}
		if latest.DeleteMarker {
			res.Existed, res.DeleteMarker, res.VersionID = true, true, latest.S3VersionID()
			return res, nil
		}
		res.Existed, res.DeleteMarker = true, true
		if err := tx.SetNoncurrent(ctx, latest.Seq, now.UnixMilli()); err != nil {
			return nil, err
		}
		m := meta.Object{
			Bucket: req.Bucket, Key: req.Key, Version: e.NewVersionID(), IsLatest: true, DeleteMarker: true,
			CreatedAt: now, ContentType: "", Metadata: map[string]string{}, Tags: map[string]string{},
		}
		if err := tx.InsertObject(ctx, &m); err != nil {
			return nil, err
		}
		res.VersionID = m.Version
		d.Versions++
		d.DeleteMarkers++
		d.Objects--
		if err := tx.AddCounters(ctx, req.Bucket, d); err != nil {
			return nil, err
		}
		res.Event = &Event{Type: EventDeleted, Operation: opOr(req.Op, "delete"), Bucket: req.Bucket, Key: req.Key,
			Previous: latest, Actor: req.Actor, At: now, Marker: &m}

	default: // unversioned: remove the only version
		if latest == nil {
			return res, nil
		}
		res.Existed = true
		if err := e.dropRow(ctx, tx, latest, &d); err != nil {
			return nil, err
		}
		d.Objects--
		if err := tx.AddCounters(ctx, req.Bucket, d); err != nil {
			return nil, err
		}
		res.Event = &Event{Type: EventDeleted, Operation: opOr(req.Op, "delete"), Bucket: req.Bucket, Key: req.Key,
			Previous: latest, Actor: req.Actor, At: now}
	}

	if res.Event != nil && e.Hooks.Outbox != nil {
		if err := e.Hooks.Outbox(ctx, tx, res.Event); err != nil {
			return nil, err
		}
	}
	return res, nil
}

func opOr(op, def string) string {
	if op == "" {
		return def
	}
	return op
}
