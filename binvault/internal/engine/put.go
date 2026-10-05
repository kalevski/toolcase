package engine

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"io"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// DefaultContentType is stored when a write names none (spec §3.3).
const DefaultContentType = "binary/octet-stream"

// Headers are the stored content headers of an object.
type Headers struct {
	ContentType        string
	ContentEncoding    string
	ContentLanguage    string
	ContentDisposition string
	CacheControl       string
	Expires            string
}

// PutRequest is a PutObject / POST Object / pipeline write (spec §5.4.1).
type PutRequest struct {
	Bucket *meta.Bucket
	Key    string
	Body   io.Reader
	// Size is the declared plaintext length (Content-Length, or
	// x-amz-decoded-content-length), -1 when unknown.
	Size int64

	Headers  Headers
	Metadata map[string]string
	Tags     map[string]string
	// SSE asks for AES256 on this request (the bucket default may too).
	SSE bool
	// ChecksumAlgo is the additional checksum to compute and store ("" = none).
	ChecksumAlgo string
	// Verify runs once the body has been received (MD5, content hash, checksum
	// header or trailer comparisons). Its error fails the write.
	Verify func(r *Received) error

	IfNoneMatchStar bool
	IfMatch         string
	WriteOnce       bool
	// NoNewBytes: the write adds no bytes to the disk (a copy that shares the
	// source blob), so the free-space guard does not apply (spec §3.4).
	NoNewBytes bool

	Actor Actor
	Op    string // put | post | pipeline
}

// PutResult is the committed write.
type PutResult struct {
	Obj      *meta.Object
	Previous *meta.Object
	Bucket   *meta.Bucket
	Modified bool // a before pipeline replaced the content
}

// Admission is the outcome of the checks made before a body is read.
type Admission struct {
	Version string
	Encrypt bool
	Max     int64
}

// Admit makes the checks of spec §3.5 step 1 that precede reading the body:
// validation, bucket rules, quota against the declared size, free disk, and
// the write-once / conditional prechecks. It allocates the version id.
func (e *Engine) Admit(ctx context.Context, req *PutRequest) (*Admission, error) {
	b := req.Bucket
	if err := ValidateKey(req.Key); err != nil {
		return nil, err
	}
	if err := ValidateMetadata(req.Metadata); err != nil {
		return nil, err
	}
	if err := ValidateTags(req.Tags); err != nil {
		return nil, err
	}
	max := e.Cfg.MaxObjectBytes
	if b.MaxObjectBytes != nil && *b.MaxObjectBytes < max {
		max = *b.MaxObjectBytes
	}
	if req.Size > max {
		return nil, apierr.New("EntityTooLarge", "Your proposed upload exceeds the maximum allowed object size.")
	}
	size := req.Size
	if size < 0 {
		size = 0
	}
	free, err := e.Store.FreeBytes()
	if !req.NoNewBytes && err == nil && int64(free) < e.Cfg.MinFreeBytes+size {
		return nil, apierr.New("StorageFull", "The storage is nearly full; writes are refused.")
	}

	guarded := req.Actor.Guard.Applies(req.Key)
	needLatest := req.WriteOnce || req.IfNoneMatchStar || req.IfMatch != "" || guarded ||
		((b.QuotaBytes != nil || b.MaxObjects != nil) && b.Versioning != meta.VersioningEnabled)
	var latest *meta.Object
	if needLatest {
		latest, err = e.DB.Read().GetLatest(ctx, b.Name, req.Key)
		if err != nil && !errors.Is(err, meta.ErrNotFound) {
			return nil, internal(err)
		}
		if errors.Is(err, meta.ErrNotFound) {
			latest = nil
		}
	}
	vis := visible(latest)
	if guarded { // fast failure; checked again inside the commit (spec §7.8)
		if err := req.Actor.Guard.Check(latest); err != nil {
			return nil, err
		}
	}
	if req.WriteOnce && vis {
		return nil, apierr.New("AccessDenied", "This token may only create new keys; it cannot overwrite an existing object.")
	}
	if req.IfNoneMatchStar && vis {
		return nil, apierr.New("PreconditionFailed", "At least one of the pre-conditions you specified did not hold.").WithExtra("Condition", "If-None-Match")
	}
	if req.IfMatch != "" {
		if !vis {
			return nil, noSuchKey(req.Key)
		}
		if !etagMatches(req.IfMatch, latest.ETag) {
			return nil, apierr.New("PreconditionFailed", "At least one of the pre-conditions you specified did not hold.").WithExtra("Condition", "If-Match")
		}
	}
	if b.QuotaBytes != nil {
		var replaced int64
		if b.Versioning != meta.VersioningEnabled && latest != nil {
			replaced = latest.Size
		}
		if b.Bytes+b.UploadBytes-replaced+size > *b.QuotaBytes {
			return nil, apierr.New("QuotaExceeded", "The bucket's storage quota would be exceeded.")
		}
	}
	if b.MaxObjects != nil && b.Versioning == meta.VersioningEnabled || b.MaxObjects != nil && latest == nil {
		if (b.Versions-b.DeleteMarkers)+1 > *b.MaxObjects {
			return nil, apierr.New("QuotaExceeded", "The bucket's object count limit would be exceeded.")
		}
	}
	return &Admission{
		Version: e.NewVersionID(),
		Encrypt: b.Encryption == meta.EncryptionSSES3 || req.SSE,
		Max:     max,
	}, nil
}

// Put writes an object: admit, receive, verify, stage, commit (spec §3.5).
func (e *Engine) Put(ctx context.Context, req *PutRequest) (*PutResult, error) {
	adm, err := e.Admit(ctx, req)
	if err != nil {
		return nil, err
	}
	b := req.Bucket
	rec, err := e.Receive(ctx, req.Body, ReceiveOpts{
		Bucket: b, Size: req.Size, MaxBytes: adm.Max, Encrypt: adm.Encrypt, Algo: req.ChecksumAlgo,
		CheckType: e.typeChecker(b),
	})
	if err != nil {
		return nil, err
	}
	defer rec.Discard()
	if req.Verify != nil {
		if err := req.Verify(rec); err != nil {
			return nil, err
		}
	}
	if err := e.Store.Sync(rec.Staged.File); err != nil {
		return nil, internal(err)
	}

	res, modified, err := e.finishWrite(ctx, req, adm, rec)
	if err != nil {
		return nil, err
	}
	return &PutResult{Obj: res.Obj, Previous: res.Previous, Bucket: res.Bucket, Modified: modified}, nil
}

// typeChecker returns the sniff callback for a bucket (nil without rules).
func (e *Engine) typeChecker(b *meta.Bucket) func(string) error {
	if len(b.AllowedContentTypes) == 0 {
		return nil
	}
	pats := b.AllowedContentTypes
	return func(sniffed string) error {
		if TypeAllowed(pats, sniffed) {
			return nil
		}
		return contentTypeNotAllowed(sniffed)
	}
}

func contentTypeNotAllowed(sniffed string) error {
	return apierr.Newf("ContentTypeNotAllowed", "The detected content type %q is not allowed in this bucket.", MediaType(sniffed))
}

// finishWrite runs the before hook (when wired), commits the staged file as a
// blob and the version row, and cleans up on failure.
func (e *Engine) finishWrite(ctx context.Context, req *PutRequest, adm *Admission, rec *Received) (*CommitResult, bool, error) {
	modified := false
	if e.Before != nil {
		out, err := e.Before(ctx, &BeforeCall{Req: req, Adm: adm, Rec: rec})
		if err != nil {
			return nil, false, err
		}
		if out != nil && out.Replaced != nil {
			rec.Discard()
			rec = out.Replaced
			modified = true
		}
	}
	in := e.commitInputFromPut(req, adm, rec)
	if err := e.Store.Commit(rec.Staged); err != nil {
		return nil, false, internal(err)
	}
	rec.Staged = nil // placed: the file is now the blob
	res, err := e.Commit(ctx, in)
	if err != nil {
		_ = e.Store.Remove(rec.ID)
		return nil, false, err
	}
	return res, modified, nil
}

func (e *Engine) commitInputFromPut(req *PutRequest, adm *Admission, rec *Received) *CommitInput {
	h := req.Headers
	if h.ContentType == "" {
		h.ContentType = DefaultContentType
	}
	obj := meta.Object{
		Size: rec.Size, ETag: hex.EncodeToString(rec.MD5), SHA256: hex.EncodeToString(rec.SHA256),
		ContentType: h.ContentType, ContentEncoding: h.ContentEncoding, ContentLanguage: h.ContentLanguage,
		ContentDisposition: h.ContentDisposition, CacheControl: h.CacheControl, Expires: h.Expires,
		Metadata: orEmpty(req.Metadata), Tags: orEmpty(req.Tags), SSE: rec.Encrypted,
	}
	if rec.Algo != "" && len(rec.Checksum) > 0 {
		obj.ChecksumAlgo = strings.ToUpper(rec.Algo)
		obj.Checksum = base64.StdEncoding.EncodeToString(rec.Checksum)
		obj.ChecksumType = "FULL_OBJECT"
	}
	op := req.Op
	if op == "" {
		op = "put"
	}
	return &CommitInput{
		Bucket: req.Bucket.Name, Key: req.Key, Version: adm.Version, Op: op, Actor: req.Actor,
		Obj:     obj,
		NewBlob: &meta.Blob{BlobID: rec.ID, Size: rec.StoredSize, PlainSize: rec.Size, SSE: rec.Encrypted},
		Sniffed: rec.Sniffed, IfNoneMatchStar: req.IfNoneMatchStar, IfMatch: req.IfMatch, WriteOnce: req.WriteOnce,
	}
}

func orEmpty(m map[string]string) map[string]string {
	if m == nil {
		return map[string]string{}
	}
	return m
}

// BeforeCall is what the pipeline package receives for a staged write. The
// chain may adjust Req.Headers, Req.Metadata and Req.Tags: the commit uses them.
type BeforeCall struct {
	Req *PutRequest
	Adm *Admission
	Rec *Received
	// Multipart is true for the assembled object of CompleteMultipartUpload.
	Multipart bool
	// ETag is the ETag the object has if the chain leaves it unchanged, when it
	// is not the MD5 of the bytes (the composite ETag of a multipart upload).
	ETag string
	// CopySrc is the source version of a CopyObject destination (Rec is nil in
	// BeforeMatches, which runs before the copy is staged).
	CopySrc *meta.Object
}

// BeforeOutcome is a before chain's result: nil Replaced = unchanged.
type BeforeOutcome struct {
	Replaced *Received
}
