package engine

import (
	"context"
	"encoding/hex"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// CopyRequest is CopyObject within one bucket (spec §5.4.5). The caller has
// resolved the source version, checked read access and the copy-source
// conditionals.
type CopyRequest struct {
	Bucket *meta.Bucket
	Src    *meta.Object
	DstKey string

	// ReplaceMetadata is x-amz-metadata-directive: REPLACE; Headers and Metadata
	// then come from the request.
	ReplaceMetadata bool
	Headers         Headers
	Metadata        map[string]string
	// ReplaceTags is x-amz-tagging-directive: REPLACE.
	ReplaceTags bool
	Tags        map[string]string
	// SSE asks for AES256 on the destination.
	SSE bool

	IfNoneMatchStar bool
	IfMatch         string
	WriteOnce       bool
	// RequireSrcVersion and RequireSrcLatest are the stale-write guard for the
	// source of a copy made with an after run's token (spec §7.8): the source row
	// must be this version (a pinned source), and for an unpinned source the
	// key's latest version must be it too.
	RequireSrcVersion string
	RequireSrcLatest  string

	Actor Actor
}

// Copy creates the destination version. Same-bucket copies share the source
// blob (O(1)) unless the destination's encryption state differs from the
// source's, in which case the bytes are rewritten (spec §3.11).
func (e *Engine) Copy(ctx context.Context, req *CopyRequest) (*CommitResult, error) {
	b, src := req.Bucket, req.Src
	if err := ValidateKey(req.DstKey); err != nil {
		return nil, err
	}
	if err := ValidateMetadata(req.Metadata); err != nil {
		return nil, err
	}
	if err := ValidateTags(req.Tags); err != nil {
		return nil, err
	}
	dstEnc := req.SSE || b.Encryption == meta.EncryptionSSES3 || src.SSE
	// copying the current version onto itself with nothing changed is invalid (S3)
	if req.DstKey == src.Key && src.IsLatest && !req.ReplaceMetadata && !req.ReplaceTags && dstEnc == src.SSE {
		return nil, apierr.New("InvalidRequest", "This copy request is illegal because it is trying to copy an object to itself without changing the object's metadata, storage class, website redirect location or encryption attributes.")
	}
	max := e.Cfg.MaxObjectBytes
	if b.MaxObjectBytes != nil && *b.MaxObjectBytes < max {
		max = *b.MaxObjectBytes
	}
	if src.Size > max {
		return nil, apierr.New("EntityTooLarge", "Your proposed upload exceeds the maximum allowed object size.")
	}
	share := dstEnc == src.SSE

	// bucket rules apply to every write path, copies included (spec §3.13): the
	// rules may have changed since the source was written, and a shared-blob copy
	// reads no bytes otherwise
	if len(b.AllowedContentTypes) > 0 {
		body, err := e.OpenBody(ctx, b, src)
		if err != nil {
			return nil, err
		}
		head := make([]byte, SniffLen)
		n, _ := body.ReadAt(head, 0) // a short object is fine: n counts what exists
		body.Close()
		if sniffed := Sniff(head[:n]); !TypeAllowed(b.AllowedContentTypes, sniffed) {
			return nil, contentTypeNotAllowed(sniffed)
		}
	}

	// quota / write-once / conditionals are judged again inside the commit; the
	// admission here only needs to refuse early when it is cheap to do so.
	adm := &PutRequest{Bucket: b, Key: req.DstKey, Size: src.Size, WriteOnce: req.WriteOnce, NoNewBytes: share,
		IfNoneMatchStar: req.IfNoneMatchStar, IfMatch: req.IfMatch, Actor: req.Actor}
	a, err := e.Admit(ctx, adm)
	if err != nil {
		return nil, err
	}

	in := &CommitInput{
		Bucket: b.Name, Key: req.DstKey, Version: a.Version, Op: "copy", Actor: req.Actor,
		IfNoneMatchStar: req.IfNoneMatchStar, IfMatch: req.IfMatch, WriteOnce: req.WriteOnce,
		CopyFrom: &CopyFrom{Seq: src.Seq, Share: share, RequireVersion: req.RequireSrcVersion, RequireLatest: req.RequireSrcLatest},
	}
	in.CopyFrom.Override = func(s *meta.Object, d *meta.Object) {
		if req.ReplaceMetadata {
			h := req.Headers
			if h.ContentType == "" {
				h.ContentType = DefaultContentType
			}
			d.ContentType, d.ContentEncoding, d.ContentLanguage = h.ContentType, h.ContentEncoding, h.ContentLanguage
			d.ContentDisposition, d.CacheControl, d.Expires = h.ContentDisposition, h.CacheControl, h.Expires
			d.Metadata = orEmpty(req.Metadata)
		} else {
			d.ContentType, d.ContentEncoding, d.ContentLanguage = s.ContentType, s.ContentEncoding, s.ContentLanguage
			d.ContentDisposition, d.CacheControl, d.Expires = s.ContentDisposition, s.CacheControl, s.Expires
			d.Metadata = orEmpty(s.Metadata)
		}
		if req.ReplaceTags {
			d.Tags = orEmpty(req.Tags)
		} else {
			d.Tags = orEmpty(s.Tags)
		}
		d.Parts = nil // a copy is a single-part object
	}

	// A before chain that matches the destination needs a staged copy to work on;
	// a copy that would share the source blob is materialised only then.
	if e.Before != nil && e.BeforeMatches != nil {
		pr := e.copyPutRequest(req, in, a)
		need, err := e.BeforeMatches(ctx, &BeforeCall{Req: pr, Adm: a, CopySrc: src})
		if err != nil {
			return nil, err
		}
		if need {
			return e.copyThroughBefore(ctx, req, in, a, pr, max)
		}
	}

	if share {
		res, err := e.Commit(ctx, in)
		if err != nil {
			return nil, err
		}
		return res, nil
	}

	// the destination is encrypted but the source is not: write a new blob
	body, err := e.OpenBody(ctx, b, src)
	if err != nil {
		return nil, err
	}
	defer body.Close()
	pr, pw := pipeFrom(body)
	rec, err := e.Receive(ctx, pr, ReceiveOpts{Bucket: b, Size: src.Size, MaxBytes: max, Encrypt: true, CheckType: e.typeChecker(b)})
	pr.Close()
	_ = pw
	if err != nil {
		return nil, err
	}
	defer rec.Discard()
	if err := e.Store.Sync(rec.Staged.File); err != nil {
		return nil, internal(err)
	}
	in.NewBlob = &meta.Blob{BlobID: rec.ID, Size: rec.StoredSize, PlainSize: rec.Size, SSE: true}
	in.Sniffed = rec.Sniffed
	in.Obj = meta.Object{
		Size: rec.Size, ETag: src.ETag, SHA256: hex.EncodeToString(rec.SHA256), SSE: true,
		ChecksumAlgo: src.ChecksumAlgo, Checksum: src.Checksum, ChecksumType: src.ChecksumType,
	}
	if err := e.Store.Commit(rec.Staged); err != nil {
		return nil, internal(err)
	}
	rec.Staged = nil
	res, err := e.Commit(ctx, in)
	if err != nil {
		_ = e.Store.Remove(rec.ID)
		return nil, err
	}
	return res, nil
}

// copyPutRequest describes a copy's destination as the write it is, with the
// headers, metadata and tags the copy would end up with: what a before chain
// sees and may adjust.
func (e *Engine) copyPutRequest(req *CopyRequest, in *CommitInput, a *Admission) *PutRequest {
	src := req.Src
	pr := &PutRequest{Bucket: req.Bucket, Key: req.DstKey, Size: src.Size, SSE: req.SSE,
		IfNoneMatchStar: req.IfNoneMatchStar, IfMatch: req.IfMatch, WriteOnce: req.WriteOnce, Actor: req.Actor, Op: "copy"}
	var dst meta.Object
	in.CopyFrom.Override(src, &dst)
	pr.Headers = Headers{ContentType: dst.ContentType, ContentEncoding: dst.ContentEncoding, ContentLanguage: dst.ContentLanguage,
		ContentDisposition: dst.ContentDisposition, CacheControl: dst.CacheControl, Expires: dst.Expires}
	pr.Metadata = copyMap(dst.Metadata)
	pr.Tags = copyMap(dst.Tags)
	return pr
}

func copyMap(m map[string]string) map[string]string {
	out := make(map[string]string, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

// copyThroughBefore stages a real copy of the source bytes, runs the before
// chain on it and commits whatever the chain left. The staged copy becomes a
// blob of its own: sharing is given up only when a chain actually matched.
func (e *Engine) copyThroughBefore(ctx context.Context, req *CopyRequest, in *CommitInput, a *Admission, pr *PutRequest, max int64) (*CommitResult, error) {
	b, src := req.Bucket, req.Src
	body, err := e.OpenBody(ctx, b, src)
	if err != nil {
		return nil, err
	}
	defer body.Close()
	encrypt := req.SSE || b.Encryption == meta.EncryptionSSES3 || src.SSE // a copy never silently decrypts (spec §3.11)
	pipeR, _ := pipeFrom(body)
	rec, err := e.Receive(ctx, pipeR, ReceiveOpts{Bucket: b, Size: src.Size, MaxBytes: max, Encrypt: encrypt,
		Algo: src.ChecksumAlgo, CheckType: e.typeChecker(b)})
	pipeR.Close()
	if err != nil {
		return nil, err
	}
	defer rec.Discard()
	if err := e.Store.Sync(rec.Staged.File); err != nil {
		return nil, internal(err)
	}
	modified := false
	out, err := e.Before(ctx, &BeforeCall{Req: pr, Adm: a, Rec: rec, CopySrc: src, ETag: src.ETag})
	if err != nil {
		return nil, err
	}
	if out != nil && out.Replaced != nil {
		rec.Discard()
		rec = out.Replaced
		modified = true
	}
	cin := e.commitInputFromPut(pr, a, rec)
	if !modified {
		// the bytes passed unchanged: the copy keeps the source's ETag and checksum
		// as a copy without a chain does, whatever the source's part layout (spec §5.4.5)
		cin.Obj.ETag = src.ETag
		cin.Obj.ChecksumAlgo, cin.Obj.Checksum, cin.Obj.ChecksumType = src.ChecksumAlgo, src.Checksum, src.ChecksumType
	}
	cin.CopyFrom = &CopyFrom{Seq: src.Seq, RequireVersion: req.RequireSrcVersion, RequireLatest: req.RequireSrcLatest}
	cin.Op = "copy"
	if err := e.Store.Commit(rec.Staged); err != nil {
		rec.Discard()
		return nil, internal(err)
	}
	rec.Staged = nil
	res, err := e.Commit(ctx, cin)
	if err != nil {
		_ = e.Store.Remove(rec.ID)
		return nil, err
	}
	res.Modified = modified
	return res, nil
}
