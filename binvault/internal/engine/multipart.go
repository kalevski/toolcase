package engine

import (
	"context"
	"crypto/md5"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"hash"
	"io"
	"os"
	"sort"
	"strconv"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/checksum"
	"github.com/kalevski/toolcase/binvault/internal/crypt"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/store"
)

// Multipart limits (spec §3.8).
const (
	MinPartSize      = 5 << 20
	MaxPartSize      = 5 << 30
	MaxParts         = 10000
	CompleteRetryTTL = 10 * time.Minute
)

// ---- create -----------------------------------------------------------------

// CreateUploadRequest starts a multipart upload (spec §5.6).
type CreateUploadRequest struct {
	Bucket       *meta.Bucket
	Key          string
	Headers      Headers
	Metadata     map[string]string
	Tags         map[string]string
	SSE          bool
	ChecksumAlgo string // "" none
	ChecksumType string // COMPOSITE | FULL_OBJECT | ""
	WriteOnce    bool
	Actor        Actor
}

// CreateUpload records a new upload.
func (e *Engine) CreateUpload(ctx context.Context, req *CreateUploadRequest) (*meta.Upload, error) {
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
	if req.WriteOnce {
		if err := e.checkNoVisible(ctx, b.Name, req.Key); err != nil {
			return nil, err
		}
	}
	if g := req.Actor.Guard; g.Applies(req.Key) { // stale-write guard (spec §7.8)
		latest, err := e.DB.Read().GetLatest(ctx, b.Name, req.Key)
		if err != nil && !errors.Is(err, meta.ErrNotFound) {
			return nil, internal(err)
		}
		if err != nil {
			latest = nil
		}
		if err := g.Check(latest); err != nil {
			return nil, err
		}
	}
	hdr, _ := json.Marshal(req.Headers)
	actor, _ := json.Marshal(req.Actor)
	u := &meta.Upload{
		UploadID: store.NewID(), Bucket: b.Name, Key: req.Key,
		Encrypted: b.Encryption == meta.EncryptionSSES3 || req.SSE,
		Headers:   map[string]string{"h": string(hdr)},
		Metadata:  orEmpty(req.Metadata), Tags: orEmpty(req.Tags),
		ChecksumAlgo: strings.ToUpper(req.ChecksumAlgo), ChecksumType: req.ChecksumType,
		Actor: actor,
	}
	if u.Encrypted {
		if _, err := e.BucketKey(ctx, b); err != nil {
			return nil, err
		}
	}
	err := e.DB.Update(ctx, func(tx *meta.Tx) error {
		if _, err := tx.GetBucket(ctx, b.Name); err != nil {
			return bucketLookupError(b.Name, err)
		}
		return tx.CreateUpload(ctx, u)
	})
	if err != nil {
		return nil, wrapErr(err)
	}
	return u, nil
}

func (e *Engine) checkNoVisible(ctx context.Context, bucket, key string) error {
	latest, err := e.DB.Read().GetLatest(ctx, bucket, key)
	if err != nil && !errors.Is(err, meta.ErrNotFound) {
		return internal(err)
	}
	if err == nil && visible(latest) {
		return apierr.New("AccessDenied", "This token may only create new keys; it cannot overwrite an existing object.")
	}
	return nil
}

// UploadHeaders decodes the content headers stored with an upload.
func UploadHeaders(u *meta.Upload) Headers {
	var h Headers
	if s := u.Headers["h"]; s != "" {
		_ = json.Unmarshal([]byte(s), &h)
	}
	return h
}

// UploadActor decodes the actor recorded at creation.
func UploadActor(u *meta.Upload) Actor {
	var a Actor
	_ = json.Unmarshal(u.Actor, &a)
	return a
}

// GetUpload loads an open upload bound to (bucket, key), else NoSuchUpload.
func (e *Engine) GetUpload(ctx context.Context, bucket, key, uploadID string) (*meta.Upload, error) {
	u, err := e.DB.Read().GetUpload(ctx, uploadID)
	if err != nil || u.State != "open" || u.Bucket != bucket || u.Key != key {
		if err != nil && !errors.Is(err, meta.ErrNotFound) {
			return nil, internal(err)
		}
		return nil, apierr.New("NoSuchUpload", "The specified upload does not exist. The upload ID may be invalid, or the upload may have been aborted or completed.").WithExtra("UploadId", uploadID)
	}
	return u, nil
}

// ---- parts ------------------------------------------------------------------

// PartRequest is UploadPart.
type PartRequest struct {
	Bucket    *meta.Bucket
	Upload    *meta.Upload
	Number    int
	Body      io.Reader
	Size      int64 // declared plaintext length, -1 unknown
	Algo      string
	Verify    func(r *Received) error
	WriteOnce bool
}

func validPartNumber(n int) error {
	if n < 1 || n > MaxParts {
		return apierr.New("InvalidArgument", "Part number must be an integer between 1 and 10000, inclusive.")
	}
	return nil
}

// UploadPart stores one part (spec §5.6).
func (e *Engine) UploadPart(ctx context.Context, req *PartRequest) (*meta.Part, error) {
	if err := validPartNumber(req.Number); err != nil {
		return nil, err
	}
	if req.WriteOnce {
		if err := e.checkNoVisible(ctx, req.Bucket.Name, req.Upload.Key); err != nil {
			return nil, err
		}
	}
	if err := e.partAdmission(ctx, req.Bucket, req.Upload, req.Number, req.Size); err != nil {
		return nil, err
	}
	var check func(string) error
	if req.Number == 1 {
		check = e.typeChecker(req.Bucket)
	}
	st, err := e.Store.NewPart(req.Upload.UploadID)
	if err != nil {
		return nil, internal(err)
	}
	rec, err := e.Receive(ctx, req.Body, ReceiveOpts{
		Bucket: req.Bucket, Size: req.Size, MaxBytes: MaxPartSize, Encrypt: req.Upload.Encrypted,
		Algo: req.Algo, CheckType: check, Part: st, NoSniff: req.Number != 1,
	})
	if err != nil {
		return nil, err
	}
	if req.Verify != nil {
		if err := req.Verify(rec); err != nil {
			rec.Discard()
			return nil, err
		}
	}
	return e.finishPart(ctx, req.Bucket, req.Upload, req.Number, rec)
}

func (e *Engine) partAdmission(ctx context.Context, b *meta.Bucket, u *meta.Upload, number int, size int64) error {
	if size > MaxPartSize {
		return apierr.New("EntityTooLarge", "Your proposed upload exceeds the maximum allowed object size.")
	}
	if size < 0 {
		size = 0
	}
	max := e.Cfg.MaxObjectBytes
	if b.MaxObjectBytes != nil && *b.MaxObjectBytes < max {
		max = *b.MaxObjectBytes
	}
	if size > max {
		return apierr.New("EntityTooLarge", "Your proposed upload exceeds the maximum allowed object size.")
	}
	if free, err := e.Store.FreeBytes(); err == nil && int64(free) < e.Cfg.MinFreeBytes+size {
		return apierr.New("StorageFull", "The storage is nearly full; writes are refused.")
	}
	if b.QuotaBytes != nil {
		var replaced int64
		if old, err := e.DB.Read().GetPart(ctx, u.UploadID, number); err == nil {
			replaced = old.Size
		}
		if b.Bytes+b.UploadBytes-replaced+size > *b.QuotaBytes {
			return apierr.New("QuotaExceeded", "The bucket's storage quota would be exceeded.")
		}
	}
	return nil
}

// finishPart records a received part file in the database.
func (e *Engine) finishPart(ctx context.Context, b *meta.Bucket, u *meta.Upload, number int, rec *Received) (*meta.Part, error) {
	if err := e.Store.FinishPart(rec.Staged); err != nil {
		rec.Discard()
		return nil, internal(err)
	}
	part := &meta.Part{
		UploadID: u.UploadID, Number: number, PartID: rec.ID, Size: rec.Size, StoredSize: rec.StoredSize,
		ETag: hex.EncodeToString(rec.MD5),
	}
	if rec.Algo != "" && len(rec.Checksum) > 0 {
		part.ChecksumAlgo = strings.ToUpper(rec.Algo)
		part.Checksum = base64.StdEncoding.EncodeToString(rec.Checksum)
	}
	var old *meta.Part
	err := e.DB.Update(ctx, func(tx *meta.Tx) error {
		cur, err := tx.GetUpload(ctx, u.UploadID)
		if err != nil || cur.State != "open" {
			return apierr.New("NoSuchUpload", "The specified upload does not exist.")
		}
		bk, err := tx.GetBucket(ctx, u.Bucket)
		if err != nil {
			return bucketLookupError(u.Bucket, err)
		}
		var replaced int64
		if prev, err := tx.GetPart(ctx, u.UploadID, number); err == nil {
			replaced = prev.Size
		}
		delta := part.Size - replaced
		if bk.QuotaBytes != nil && bk.Bytes+bk.UploadBytes+delta > *bk.QuotaBytes {
			return apierr.New("QuotaExceeded", "The bucket's storage quota would be exceeded.")
		}
		old, err = tx.PutPart(ctx, part)
		if err != nil {
			return err
		}
		if err := tx.AddCounters(ctx, u.Bucket, meta.Counters{UploadBytes: delta}); err != nil {
			return err
		}
		return tx.TouchUpload(ctx, u.UploadID)
	})
	if err != nil {
		e.Store.RemovePart(u.UploadID, rec.ID)
		return nil, wrapErr(err)
	}
	if old != nil && old.PartID != rec.ID {
		e.Store.RemovePart(u.UploadID, old.PartID)
	}
	return part, nil
}

// CopyPartRequest is UploadPartCopy: bytes [Off, Off+Len) of a source object
// (the caller checked read access and conditionals) become a part.
type CopyPartRequest struct {
	Bucket    *meta.Bucket
	Upload    *meta.Upload
	Number    int
	Src       *meta.Object
	Off       int64
	Len       int64 // -1 = to the end
	Algo      string
	WriteOnce bool
}

// CopyPart implements UploadPartCopy (spec §5.6, §3.11).
func (e *Engine) CopyPart(ctx context.Context, req *CopyPartRequest) (*meta.Part, error) {
	if err := validPartNumber(req.Number); err != nil {
		return nil, err
	}
	if req.WriteOnce {
		if err := e.checkNoVisible(ctx, req.Bucket.Name, req.Upload.Key); err != nil {
			return nil, err
		}
	}
	body, err := e.OpenBody(ctx, req.Bucket, req.Src)
	if err != nil {
		return nil, err
	}
	defer body.Close()
	n := req.Len
	if n < 0 || req.Off+n > body.Size() {
		n = body.Size() - req.Off
	}
	if n < 0 || req.Off < 0 || req.Off > body.Size() {
		return nil, apierr.New("InvalidRange", "The requested range is not satisfiable")
	}
	if err := e.partAdmission(ctx, req.Bucket, req.Upload, req.Number, n); err != nil {
		return nil, err
	}
	u := req.Upload
	// A part copied from an encrypted source makes the whole upload encrypted
	// (spec §3.11): UploadPartCopy cannot decrypt.
	if req.Src.SSE && !u.Encrypted {
		if _, err := e.BucketKey(ctx, req.Bucket); err != nil {
			return nil, err
		}
		if err := e.DB.Update(ctx, func(tx *meta.Tx) error { return tx.MarkUploadEncrypted(ctx, u.UploadID) }); err != nil {
			return nil, wrapErr(err)
		}
		u.Encrypted = true
	}
	pr, pw := io.Pipe()
	go func() {
		_, err := body.WriteRange(pw, req.Off, n)
		pw.CloseWithError(err)
	}()
	st, err := e.Store.NewPart(u.UploadID)
	if err != nil {
		pr.Close()
		return nil, internal(err)
	}
	var check func(string) error
	if req.Number == 1 {
		check = e.typeChecker(req.Bucket)
	}
	rec, err := e.Receive(ctx, pr, ReceiveOpts{
		Bucket: req.Bucket, Size: n, MaxBytes: MaxPartSize, Encrypt: u.Encrypted, Algo: req.Algo,
		CheckType: check, Part: st, NoSniff: req.Number != 1,
	})
	pr.Close()
	if err != nil {
		return nil, err
	}
	return e.finishPart(ctx, req.Bucket, u, req.Number, rec)
}

// ---- complete ---------------------------------------------------------------

// PartRef names a part in a CompleteMultipartUpload request.
type PartRef struct {
	Number   int
	ETag     string // bare hex (quotes stripped)
	Checksum string // base64, if the client supplied one for this part
}

// CompleteRequest is CompleteMultipartUpload.
type CompleteRequest struct {
	Bucket          *meta.Bucket
	Upload          *meta.Upload
	Parts           []PartRef
	IfNoneMatchStar bool
	IfMatch         string
	WriteOnce       bool
	Actor           Actor
	// ChecksumType is the requested x-amz-checksum-type (COMPOSITE|FULL_OBJECT|"").
	ChecksumType string
}

// CompleteResult is the finished object, also recorded for retried completes.
type CompleteResult struct {
	Key          string `json:"key"`
	ETag         string `json:"etag"`
	Version      string `json:"version"`
	S3VersionID  string `json:"s3_version_id"`
	Versioned    bool   `json:"versioned"`
	ChecksumAlgo string `json:"checksum_algo,omitempty"`
	Checksum     string `json:"checksum,omitempty"`
	ChecksumType string `json:"checksum_type,omitempty"`
	SSE          bool   `json:"sse,omitempty"`
	Modified     bool   `json:"modified,omitempty"`
}

func partListHash(parts []PartRef) string {
	h := sha256.New()
	for _, p := range parts {
		fmt.Fprintf(h, "%d:%s\n", p.Number, p.ETag)
	}
	return hex.EncodeToString(h.Sum(nil))
}

// PreviousComplete returns the recorded result of an already-completed upload
// when the same part list is sent again within CompleteRetryTTL (spec §5.6).
func (e *Engine) PreviousComplete(ctx context.Context, bucket, key, uploadID string, parts []PartRef) (*CompleteResult, error) {
	u, err := e.DB.Read().GetUpload(ctx, uploadID)
	if err != nil || u.State != "completed" || u.Bucket != bucket || u.Key != key {
		return nil, nil
	}
	if u.CompletedAt == nil || e.Now().Sub(*u.CompletedAt) > CompleteRetryTTL || u.CompleteHash != partListHash(parts) {
		return nil, nil
	}
	var res CompleteResult
	if err := json.Unmarshal(u.CompleteResult, &res); err != nil {
		return nil, nil
	}
	return &res, nil
}

// Complete assembles the parts into one object and commits it (spec §5.6).
func (e *Engine) Complete(ctx context.Context, req *CompleteRequest) (*CompleteResult, error) {
	u, b := req.Upload, req.Bucket
	if len(req.Parts) == 0 {
		return nil, apierr.New("MalformedXML", "The XML you provided was not well-formed or did not validate against our published schema.")
	}
	// One Complete per upload at a time: a client retry that overlaps the original
	// (SDK timeouts) waits for it and then replays its result instead of
	// assembling the whole object a second time and failing at the commit.
	unlock := e.lockUpload(u.UploadID)
	defer unlock()
	cur, err := e.DB.Read().GetUpload(ctx, u.UploadID)
	if err != nil {
		return nil, apierr.New("NoSuchUpload", "The specified upload does not exist.").WithExtra("UploadId", u.UploadID)
	}
	if cur.State != "open" {
		if prev, perr := e.PreviousComplete(ctx, b.Name, u.Key, u.UploadID, req.Parts); perr == nil && prev != nil {
			return prev, nil
		}
		return nil, apierr.New("NoSuchUpload", "The specified upload does not exist. The upload ID may be invalid, or the upload may have been aborted or completed.").WithExtra("UploadId", u.UploadID)
	}
	u = cur // the freshest row: encryption may have been switched on by an UploadPartCopy
	// the part list must be ascending and unique
	for i := 1; i < len(req.Parts); i++ {
		if req.Parts[i].Number <= req.Parts[i-1].Number {
			return nil, apierr.New("InvalidPartOrder", "The list of parts was not in ascending order. The parts list must be specified in order by part number.")
		}
	}
	stored, err := e.DB.Read().ListParts(ctx, u.UploadID, 0, MaxParts)
	if err != nil {
		return nil, internal(err)
	}
	byNum := make(map[int]*meta.Part, len(stored))
	for _, p := range stored {
		byNum[p.Number] = p
	}
	var total int64
	parts := make([]*meta.Part, len(req.Parts))
	for i, ref := range req.Parts {
		p := byNum[ref.Number]
		if p == nil || (ref.ETag != "" && !strings.EqualFold(ref.ETag, p.ETag)) {
			return nil, apierr.New("InvalidPart", "One or more of the specified parts could not be found. The part may not have been uploaded, or the specified entity tag may not match the part's entity tag.")
		}
		if ref.Checksum != "" && p.ChecksumAlgo != "" && ref.Checksum != p.Checksum {
			return nil, apierr.New("InvalidPart", "The checksum of a part does not match.")
		}
		if i < len(req.Parts)-1 && p.Size < MinPartSize {
			return nil, apierr.New("EntityTooSmall", "Your proposed upload is smaller than the minimum allowed object size.")
		}
		parts[i] = p
		total += p.Size
	}
	max := e.Cfg.MaxObjectBytes
	if b.MaxObjectBytes != nil && *b.MaxObjectBytes < max {
		max = *b.MaxObjectBytes
	}
	if total > max {
		return nil, apierr.New("EntityTooLarge", "Your proposed upload exceeds the maximum allowed object size.")
	}

	// write-once / conditionals precheck (fast failure; re-checked in the commit)
	guarded := req.Actor.Guard.Applies(u.Key)
	if req.WriteOnce || req.IfNoneMatchStar || req.IfMatch != "" || guarded {
		latest, err := e.DB.Read().GetLatest(ctx, b.Name, u.Key)
		if err != nil && !errors.Is(err, meta.ErrNotFound) {
			return nil, internal(err)
		}
		if err != nil {
			latest = nil
		}
		if guarded {
			if err := req.Actor.Guard.Check(latest); err != nil {
				return nil, err
			}
		}
		switch {
		case req.WriteOnce && visible(latest):
			return nil, apierr.New("AccessDenied", "This token may only create new keys; it cannot overwrite an existing object.")
		case req.IfNoneMatchStar && visible(latest):
			return nil, apierr.New("PreconditionFailed", "At least one of the pre-conditions you specified did not hold.")
		case req.IfMatch != "" && !visible(latest):
			return nil, noSuchKey(u.Key)
		case req.IfMatch != "" && !etagMatches(req.IfMatch, latest.ETag):
			return nil, apierr.New("PreconditionFailed", "At least one of the pre-conditions you specified did not hold.")
		}
	}
	if free, err := e.Store.FreeBytes(); err == nil && int64(free) < e.Cfg.MinFreeBytes+total {
		return nil, apierr.New("StorageFull", "The storage is nearly full; writes are refused.")
	}

	algo := u.ChecksumAlgo
	ctype := u.ChecksumType
	if ctype == "" {
		ctype = req.ChecksumType
	}
	rec, partSums, err := e.assemble(ctx, b, u, parts, algo)
	if err != nil {
		return nil, err
	}
	defer rec.Discard()
	if err := e.Store.Sync(rec.Staged.File); err != nil {
		return nil, internal(err)
	}

	// final ETag and checksum
	etag := multipartETag(parts)
	var csAlgo, csVal, csType string
	if algo != "" {
		a, _ := checksum.ParseAlgo(algo)
		csAlgo = string(a)
		if ctype == "FULL_OBJECT" && a != checksum.SHA1 && a != checksum.SHA256 {
			csType, csVal = "FULL_OBJECT", checksum.Encode(rec.Checksum)
		} else {
			v, cerr := checksum.Composite(a, partSums)
			if cerr != nil {
				return nil, apierr.New("InvalidRequest", "Could not compute the composite checksum: every part needs a "+algo+" checksum.")
			}
			csType, csVal = "COMPOSITE", v
		}
	}
	version := e.NewVersionID()
	hdr := UploadHeaders(u)
	if hdr.ContentType == "" {
		hdr.ContentType = DefaultContentType
	}
	partSizes := make([]int64, len(parts))
	for i, p := range parts {
		partSizes[i] = p.Size
	}
	in := &CommitInput{
		Bucket: b.Name, Key: u.Key, Version: version, Op: "multipart", Actor: req.Actor,
		Obj: meta.Object{
			Size: rec.Size, ETag: etag, SHA256: hex.EncodeToString(rec.SHA256),
			ChecksumAlgo: csAlgo, Checksum: csVal, ChecksumType: csType,
			ContentType: hdr.ContentType, ContentEncoding: hdr.ContentEncoding, ContentLanguage: hdr.ContentLanguage,
			ContentDisposition: hdr.ContentDisposition, CacheControl: hdr.CacheControl, Expires: hdr.Expires,
			Metadata: orEmpty(u.Metadata), Tags: orEmpty(u.Tags), Parts: partSizes, SSE: rec.Encrypted,
		},
		NewBlob: &meta.Blob{BlobID: rec.ID, Size: rec.StoredSize, PlainSize: rec.Size, SSE: rec.Encrypted},
		Sniffed: rec.Sniffed, IfNoneMatchStar: req.IfNoneMatchStar, IfMatch: req.IfMatch, WriteOnce: req.WriteOnce,
	}
	// The open-upload bytes released at this commit are those of ALL part rows
	// live at the commit (parts left out of the list are discarded with the
	// upload). Read inside the transaction, so a part uploaded while the object
	// was being assembled cannot leak upload_bytes; a LISTED part that was
	// replaced meanwhile makes the assembled object stale: refuse.
	in.ReleaseFn = func(ctx context.Context, tx *meta.Tx) (int64, error) {
		live, err := tx.ListParts(ctx, u.UploadID, 0, MaxParts)
		if err != nil {
			return 0, err
		}
		byNumber := make(map[int]*meta.Part, len(live))
		var sum int64
		for _, p := range live {
			byNumber[p.Number] = p
			sum += p.Size
		}
		for _, p := range parts {
			if q := byNumber[p.Number]; q == nil || q.PartID != p.PartID {
				return 0, apierr.New("InvalidPart", "A part was replaced or removed while the upload was being completed; retry CompleteMultipartUpload.")
			}
		}
		return sum, nil
	}
	result := &CompleteResult{
		Key: u.Key, ETag: etag, Version: version, Versioned: b.Versioning == meta.VersioningEnabled,
		ChecksumAlgo: csAlgo, Checksum: csVal, ChecksumType: csType, SSE: rec.Encrypted,
	}
	// the S3 version id is known before the commit: a new row of a versioned
	// bucket is never a null version. The record written inside the transaction
	// (served again to a retried Complete) must carry it.
	if result.Versioned {
		result.S3VersionID = version
	} else {
		result.S3VersionID = "null"
	}
	listHash := partListHash(req.Parts)
	in.Extra = func(ctx context.Context, tx *meta.Tx) error {
		cur, err := tx.GetUpload(ctx, u.UploadID)
		if err != nil || cur.State != "open" {
			return apierr.New("NoSuchUpload", "The specified upload does not exist.")
		}
		if err := tx.DeleteParts(ctx, u.UploadID); err != nil {
			return err
		}
		blob, _ := json.Marshal(result)
		return tx.CompleteUpload(ctx, u.UploadID, listHash, blob)
	}

	// before pipelines run on the assembled object (spec §5.6); a rejection
	// aborts the upload, any other failure keeps it open.
	pr := &PutRequest{
		Bucket: b, Key: u.Key, Size: rec.Size, Headers: hdr, Metadata: u.Metadata, Tags: u.Tags,
		IfNoneMatchStar: req.IfNoneMatchStar, IfMatch: req.IfMatch, WriteOnce: req.WriteOnce, Actor: req.Actor, Op: "multipart",
	}
	adm := &Admission{Version: version, Encrypt: u.Encrypted, Max: max}
	if e.Before != nil {
		out, berr := e.Before(ctx, &BeforeCall{Req: pr, Adm: adm, Rec: rec, Multipart: true, ETag: etag})
		if berr != nil {
			if apierr.Is(berr, "PipelineRejected") {
				_ = e.AbortUpload(ctx, b, u)
			}
			return nil, berr
		}
		// the chain may have changed the content headers, metadata and tags
		in.Obj.ContentType, in.Obj.ContentEncoding, in.Obj.ContentLanguage = pr.Headers.ContentType, pr.Headers.ContentEncoding, pr.Headers.ContentLanguage
		in.Obj.ContentDisposition, in.Obj.CacheControl, in.Obj.Expires = pr.Headers.ContentDisposition, pr.Headers.CacheControl, pr.Headers.Expires
		if in.Obj.ContentType == "" {
			in.Obj.ContentType = DefaultContentType
		}
		in.Obj.Metadata, in.Obj.Tags = orEmpty(pr.Metadata), orEmpty(pr.Tags)
		if out != nil && out.Replaced != nil {
			rec.Discard()
			rec = out.Replaced
			in.Obj.Size, in.Obj.ETag = rec.Size, hex.EncodeToString(rec.MD5)
			in.Obj.SHA256 = hex.EncodeToString(rec.SHA256)
			in.Obj.Parts = nil // the replaced object is single-part (spec §3.3)
			in.Obj.SSE = rec.Encrypted
			in.NewBlob = &meta.Blob{BlobID: rec.ID, Size: rec.StoredSize, PlainSize: rec.Size, SSE: rec.Encrypted}
			in.Sniffed = rec.Sniffed
			if csAlgo != "" && len(rec.Checksum) > 0 {
				in.Obj.Checksum, in.Obj.ChecksumType = checksum.Encode(rec.Checksum), "FULL_OBJECT"
			}
			result.ETag, result.Modified = in.Obj.ETag, true
			result.Checksum, result.ChecksumType = in.Obj.Checksum, in.Obj.ChecksumType
		}
	}
	if err := e.Store.Commit(rec.Staged); err != nil {
		return nil, internal(err)
	}
	rec.Staged = nil
	cres, err := e.Commit(ctx, in)
	if err != nil {
		_ = e.Store.Remove(rec.ID)
		return nil, err
	}
	result.Version, result.S3VersionID = cres.Obj.Version, cres.Obj.S3VersionID()
	_ = e.Store.RemoveUpload(u.UploadID)
	return result, nil
}

// multipartETag is the hex MD5 of the concatenated binary part MD5s plus "-N".
func multipartETag(parts []*meta.Part) string {
	h := md5.New()
	for _, p := range parts {
		b, _ := hex.DecodeString(p.ETag)
		h.Write(b)
	}
	return hex.EncodeToString(h.Sum(nil)) + "-" + strconv.Itoa(len(parts))
}

// assemble concatenates the parts into a staged blob, hashing the plaintext and
// (re-)encrypting when the upload is encrypted. It returns the per-part raw
// checksums for the composite calculation.
func (e *Engine) assemble(ctx context.Context, b *meta.Bucket, u *meta.Upload, parts []*meta.Part, algo string) (*Received, [][]byte, error) {
	var bk []byte
	var err error
	anyEncrypted := u.Encrypted
	for _, p := range parts {
		if p.StoredSize != p.Size {
			anyEncrypted = true
		}
	}
	if anyEncrypted {
		bk, err = e.BucketKey(ctx, b)
		if err != nil {
			return nil, nil, err
		}
	}
	sources := make([]io.Reader, 0, len(parts))
	var open []*os.File
	closeAll := func() {
		for _, f := range open {
			f.Close()
		}
	}
	defer closeAll()
	partSums := make([][]byte, 0, len(parts))
	for _, p := range parts {
		f, err := e.Store.OpenPart(u.UploadID, p.PartID)
		if err != nil {
			return nil, nil, apierr.Wrap("InternalError", "A part file is missing.", err)
		}
		open = append(open, f)
		if p.StoredSize != p.Size { // encrypted part: decrypt with its own key
			cb, err := crypt.Open(f, p.StoredSize, crypt.DeriveKey(bk, p.PartID))
			if err != nil {
				return nil, nil, apierr.Wrap("InternalError", "A part file cannot be decrypted.", err)
			}
			r, err := cb.NewReader(0, -1)
			if err != nil {
				return nil, nil, internal(err)
			}
			sources = append(sources, r)
		} else {
			sources = append(sources, io.NewSectionReader(f, 0, p.Size))
		}
		if p.Checksum != "" {
			raw, derr := checksum.Decode(p.Checksum)
			if derr == nil {
				partSums = append(partSums, raw)
			}
		}
	}
	if len(partSums) != len(parts) {
		partSums = nil
	}
	rec, err := e.Receive(ctx, io.MultiReader(sources...), ReceiveOpts{
		Bucket: b, Size: -1, MaxBytes: 0, Encrypt: u.Encrypted || anyEncrypted, Algo: algo,
		CheckType: e.typeChecker(b),
	})
	return rec, partSums, err
}

// ---- abort ------------------------------------------------------------------

// AbortUpload deletes an upload and its parts and releases their quota.
func (e *Engine) AbortUpload(ctx context.Context, b *meta.Bucket, u *meta.Upload) error {
	err := e.DB.Update(ctx, func(tx *meta.Tx) error {
		cur, err := tx.GetUpload(ctx, u.UploadID)
		if err != nil {
			return apierr.New("NoSuchUpload", "The specified upload does not exist.")
		}
		if cur.State == "open" {
			var sum int64
			ps, err := tx.ListParts(ctx, u.UploadID, 0, MaxParts)
			if err != nil {
				return err
			}
			for _, p := range ps {
				sum += p.Size
			}
			if sum != 0 {
				if err := tx.AddCounters(ctx, u.Bucket, meta.Counters{UploadBytes: -sum}); err != nil {
					return err
				}
			}
		}
		return tx.DeleteUpload(ctx, u.UploadID)
	})
	if err != nil {
		return wrapErr(err)
	}
	_ = e.Store.RemoveUpload(u.UploadID)
	return nil
}

// ExpireUploads aborts open uploads idle for longer than ttl and prunes the
// records of completed ones past the retry window (spec §3.9).
func (e *Engine) ExpireUploads(ctx context.Context, ttl time.Duration) (int, error) {
	now := e.Now()
	var n int
	// one sweep in upload id order: an upload that is left alone (its bucket is
	// frozen for a move, or not served by this node) must not hide the others
	for after := ""; ; {
		us, err := e.DB.Read().ExpiredUploadsAfter(ctx, now.Add(-ttl), after, 100)
		if err != nil {
			return n, err
		}
		if len(us) == 0 {
			break
		}
		for _, u := range us {
			after = u.UploadID
			if e.Skip != nil && e.Skip(u.Bucket) {
				continue
			}
			// an upload of a bucket that is frozen for a move is left for the next run:
			// what it changed after the rows were copied would be lost (spec §8.8)
			gctx, end, gerr := e.Gate.Begin(ctx, u.Bucket, true)
			if gerr != nil {
				continue
			}
			err := e.AbortUpload(gctx, nil, u)
			end()
			if errors.Is(err, ErrFrozen) || errors.Is(FrozenCause(gctx, err), ErrFrozen) {
				continue // frozen after it was admitted
			}
			if err != nil && !apierr.Is(err, "NoSuchUpload") {
				return n, err
			}
			n++
		}
	}
	err := e.DB.Update(ctx, func(tx *meta.Tx) error {
		_, err := tx.PruneCompletedUploads(ctx, now.Add(-CompleteRetryTTL))
		return err
	})
	return n, err
}

// SortPartRefs orders part references by number (helper for tests).
func SortPartRefs(p []PartRef) {
	sort.Slice(p, func(i, j int) bool { return p[i].Number < p[j].Number })
}

var _ hash.Hash // keep imports tidy when features are toggled

// ReconcileUploads aborts every open upload whose part files are missing (a
// restore without uploads/, or a lost file): their rows have no data and a
// Complete could only fail (spec §9.5). It returns how many were aborted.
func (e *Engine) ReconcileUploads(ctx context.Context) (int, error) {
	aborted := 0
	after := ""
	for {
		us, err := e.DB.Read().OpenUploadsAfter(ctx, after, 100)
		if err != nil {
			return aborted, err
		}
		for _, u := range us {
			after = u.UploadID
			parts, err := e.DB.Read().ListParts(ctx, u.UploadID, 0, MaxParts)
			if err != nil {
				return aborted, err
			}
			missing := false
			for _, p := range parts {
				if _, err := os.Stat(e.Store.PartPath(u.UploadID, p.PartID)); err != nil {
					missing = true
					break
				}
			}
			if !missing {
				continue
			}
			b, err := e.DB.Read().GetBucket(ctx, u.Bucket)
			if err != nil {
				continue
			}
			if err := e.AbortUpload(ctx, b, u); err == nil {
				aborted++
			}
		}
		if len(us) < 100 {
			return aborted, nil
		}
	}
}
