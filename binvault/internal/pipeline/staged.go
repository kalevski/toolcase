package pipeline

import (
	"context"
	"encoding/base64"
	"encoding/hex"
	"io"
	"strings"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/checksum"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// The staged view of before runs (spec §7.8).
//
// A write whose before chain is running is a slot: the staged file the client
// uploaded, with the content headers, metadata and tags it will be committed
// with. Each attempt of each pipeline of the chain works on its own working
// copy of the slot (an attempt). The attempt's token reads and changes that
// copy; when the attempt ends the token is revoked and its requests are
// aborted first, then, only if the attempt succeeded, the copy replaces the
// slot's state. A failed, timed-out or retried attempt therefore leaves the
// slot exactly as it was, and a late request of an ended attempt can never
// reach it.

// stagedState is what the chain knows of the object it works on.
type stagedState struct {
	rec *engine.Received
	// owned: rec was made by a replacement during the chain, so the chain must
	// discard it unless the engine takes it over. The engine's own staged file
	// is never owned.
	owned bool
	// etag is the ETag when it is not hex(MD5): the composite ETag of a
	// multipart upload, until a replacement makes the object single-part.
	etag     string
	headers  engine.Headers
	metadata map[string]string
	tags     map[string]string
	// deleted: the object was marked rejected through the token.
	deleted bool
	// modified: the bytes were replaced.
	modified bool
}

func copyStrMap(m map[string]string) map[string]string {
	out := make(map[string]string, len(m))
	for k, v := range m {
		out[k] = v
	}
	return out
}

func (s stagedState) clone() stagedState {
	s.metadata = copyStrMap(s.metadata)
	s.tags = copyStrMap(s.tags)
	return s
}

func (s *stagedState) etagOf() string {
	if s.etag != "" {
		return s.etag
	}
	return hex.EncodeToString(s.rec.MD5)
}

// slot is the staged object of one write across its whole before chain.
type slot struct {
	eng     *engine.Engine
	bucket  *meta.Bucket
	key     string
	version string
	at      time.Time
	// algo is the additional checksum algorithm of the original write; a
	// replacement's checksum is recomputed with it (spec §5.8).
	algo string
	// maxBytes caps a replacement (the write's size limit).
	maxBytes int64

	mu     sync.Mutex
	st     stagedState
	handed bool // the replacement was handed to the engine
}

func newSlot(eng *engine.Engine, b *meta.Bucket, key, version string, rec *engine.Received, etag string,
	h engine.Headers, md, tags map[string]string, maxBytes int64, at time.Time) *slot {
	if h.ContentType == "" {
		h.ContentType = engine.DefaultContentType
	}
	return &slot{
		eng: eng, bucket: b, key: key, version: version, at: at, algo: rec.Algo, maxBytes: maxBytes,
		st: stagedState{rec: rec, etag: etag, headers: h, metadata: copyStrMap(md), tags: copyStrMap(tags)},
	}
}

// state returns a copy of the slot's committed state.
func (s *slot) state() stagedState {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.st.clone()
}

// apply makes a successful attempt's working copy the slot's state.
func (s *slot) apply(w stagedState) {
	s.mu.Lock()
	defer s.mu.Unlock()
	if w.rec != s.st.rec && s.st.owned {
		s.st.rec.Discard()
	}
	s.st = w
}

// replacement returns the staged file of a replaced object for the engine to
// commit (nil when the bytes were not replaced) and marks it handed over.
func (s *slot) replacement() *engine.Received {
	s.mu.Lock()
	defer s.mu.Unlock()
	if !s.st.modified || !s.st.owned {
		return nil
	}
	s.handed = true
	return s.st.rec
}

// cleanup discards a replacement the engine did not take (the chain ended in
// a rejection or an error).
func (s *slot) cleanup() {
	s.mu.Lock()
	defer s.mu.Unlock()
	if s.st.owned && !s.handed {
		s.st.rec.Discard()
		s.st.owned = false
	}
}

// object renders a state as the object the token and the invocation see.
func (s *slot) object(st *stagedState) *meta.Object {
	o := &meta.Object{
		Bucket: s.bucket.Name, Key: s.key, Version: s.version, IsLatest: true,
		Size: st.rec.Size, ETag: st.etagOf(), SHA256: hex.EncodeToString(st.rec.SHA256),
		ContentType: st.headers.ContentType, ContentEncoding: st.headers.ContentEncoding,
		ContentLanguage: st.headers.ContentLanguage, ContentDisposition: st.headers.ContentDisposition,
		CacheControl: st.headers.CacheControl, Expires: st.headers.Expires,
		Metadata: copyStrMap(st.metadata), Tags: copyStrMap(st.tags),
		CreatedAt: s.at, SSE: st.rec.Encrypted,
	}
	if st.rec.Algo != "" && len(st.rec.Checksum) > 0 {
		o.ChecksumAlgo = strings.ToUpper(st.rec.Algo)
		o.Checksum = base64.StdEncoding.EncodeToString(st.rec.Checksum)
		o.ChecksumType = "FULL_OBJECT"
	}
	return o
}

// view is the slot's current object (for the invocation of the next pipeline).
func (s *slot) view() *meta.Object {
	st := s.state()
	return s.object(&st)
}

// begin starts an attempt on a working copy of the slot.
func (s *slot) begin() *attempt { return &attempt{s: s, work: s.state()} }

// attempt is one attempt's working copy of the slot.
type attempt struct {
	s      *slot
	mu     sync.Mutex
	closed bool
	work   stagedState
}

func errAttemptEnded() error {
	return apierr.New("InvalidAccessKeyId", "The pipeline token ended; its requests are aborted.")
}

// finish ends the attempt: nothing can change it afterwards, and the working
// copy becomes the slot's state if the attempt succeeded. The caller revokes
// the token first (cancelling its in-flight requests), so no request is still
// running here; a request that slips past that is turned away by closed.
func (a *attempt) finish(ok bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.closed {
		return
	}
	a.closed = true
	if ok {
		a.s.apply(a.work)
		return
	}
	if a.work.rec != a.s.stateRec() {
		a.work.rec.Discard()
	}
}

// stateRec is the slot's current staged file.
func (s *slot) stateRec() *engine.Received {
	s.mu.Lock()
	defer s.mu.Unlock()
	return s.st.rec
}

// object returns the object as this attempt currently sees it.
func (a *attempt) object() (*meta.Object, bool) {
	a.mu.Lock()
	defer a.mu.Unlock()
	return a.s.object(&a.work), a.work.deleted
}

// open opens the staged bytes as this attempt sees them.
func (a *attempt) open(ctx context.Context) (engine.Body, error) {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.closed {
		return nil, errAttemptEnded()
	}
	if a.work.deleted {
		return nil, apierr.New("NoSuchKey", "The specified key does not exist.").WithExtra("Key", a.s.key)
	}
	return a.s.eng.OpenStaged(ctx, a.s.bucket, a.work.rec)
}

// del marks the staged object rejected.
func (a *attempt) del() error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.closed {
		return errAttemptEnded()
	}
	a.work.deleted = true
	return nil
}

// setTags replaces the staged object's tags.
func (a *attempt) setTags(tags map[string]string) error {
	a.mu.Lock()
	defer a.mu.Unlock()
	if a.closed {
		return errAttemptEnded()
	}
	if a.work.deleted {
		return apierr.New("NoSuchKey", "The specified key does not exist.").WithExtra("Key", a.s.key)
	}
	a.work.tags = copyStrMap(tags)
	return nil
}

// put replaces the staged object with the body of the token's PUT (spec §7.8).
// The body is received like any upload (size caps and the bucket's content-type
// rules apply); content headers, metadata and tags the request leaves out are
// inherited from the staged object, metadata keys it names are merged over
// them, and x-binvault-replace-metadata: true asks for full S3 replace
// semantics. The change is pending until the attempt succeeds.
func (a *attempt) put(ctx context.Context, in *engine.StagedPut) (*meta.Object, error) {
	s := a.s
	a.mu.Lock()
	if a.closed {
		a.mu.Unlock()
		return nil, errAttemptEnded()
	}
	cur := a.work.clone()
	a.mu.Unlock()

	if in.IfMatch != "" && !etagListMatches(in.IfMatch, cur.etagOf()) {
		return nil, apierr.New("PreconditionFailed", "At least one of the pre-conditions you specified did not hold.").WithExtra("Condition", "If-Match")
	}
	if err := engine.ValidateMetadata(in.Metadata); err != nil {
		return nil, err
	}
	if err := engine.ValidateTags(in.Tags); err != nil {
		return nil, err
	}

	// the replacement keeps the checksum algorithm of the original write, and is
	// still verified against whatever checksum the PUT itself carried
	recvAlgo := in.Algo
	if recvAlgo == "" {
		recvAlgo = s.algo
	}
	rec, err := s.eng.Receive(ctx, in.Body, engine.ReceiveOpts{
		Bucket: s.bucket, Size: in.Size, MaxBytes: s.maxBytes, Encrypt: cur.rec.Encrypted, Algo: recvAlgo,
		CheckType: s.eng.TypeChecker(s.bucket),
	})
	if err != nil {
		return nil, err
	}
	keep := false
	defer func() {
		if !keep {
			rec.Discard()
		}
	}()
	if in.Verify != nil {
		if err := in.Verify(rec); err != nil {
			return nil, err
		}
	}
	if err := s.alignChecksum(ctx, rec); err != nil {
		return nil, err
	}
	if err := s.eng.Store.Sync(rec.Staged.File); err != nil {
		return nil, engine.WrapError(err)
	}

	a.mu.Lock()
	defer a.mu.Unlock()
	if a.closed { // the attempt ended while the body was arriving: it lands nowhere
		return nil, errAttemptEnded()
	}
	next := a.work.clone()
	if in.ReplaceMetadata {
		next.headers = in.Headers
		if next.headers.ContentType == "" {
			next.headers.ContentType = engine.DefaultContentType
		}
		next.metadata = copyStrMap(in.Metadata)
		next.tags = copyStrMap(in.Tags)
	} else {
		h := &next.headers
		inherit(&h.ContentType, in.Headers.ContentType)
		inherit(&h.ContentEncoding, in.Headers.ContentEncoding)
		inherit(&h.ContentLanguage, in.Headers.ContentLanguage)
		inherit(&h.ContentDisposition, in.Headers.ContentDisposition)
		inherit(&h.CacheControl, in.Headers.CacheControl)
		inherit(&h.Expires, in.Headers.Expires)
		for k, v := range in.Metadata {
			next.metadata[k] = v
		}
		if in.TagsGiven {
			next.tags = copyStrMap(in.Tags)
		}
	}
	if err := engine.ValidateMetadata(next.metadata); err != nil {
		return nil, err
	}
	if next.rec != s.stateRec() { // an earlier replacement of this very attempt
		next.rec.Discard()
	}
	next.rec, next.owned, next.etag = rec, true, ""
	next.deleted, next.modified = false, true
	a.work = next
	keep = true
	return a.s.object(&a.work), nil
}

func inherit(dst *string, v string) {
	if v != "" {
		*dst = v
	}
}

// alignChecksum makes the replacement carry the checksum of the original
// write's algorithm (none when the original had none).
func (s *slot) alignChecksum(ctx context.Context, rec *engine.Received) error {
	want := s.algo
	if want == "" {
		rec.Algo, rec.Checksum = "", nil
		return nil
	}
	if strings.EqualFold(rec.Algo, want) && len(rec.Checksum) > 0 {
		rec.Algo = want
		return nil
	}
	a, ok := checksum.ParseAlgo(want)
	if !ok {
		rec.Algo, rec.Checksum = "", nil
		return nil
	}
	body, err := s.eng.OpenStaged(ctx, s.bucket, rec)
	if err != nil {
		return err
	}
	defer body.Close()
	h := a.New()
	if _, err := io.Copy(h, io.NewSectionReader(body, 0, body.Size())); err != nil {
		return engine.WrapError(err)
	}
	rec.Algo, rec.Checksum = want, h.Sum(nil)
	return nil
}

// etagListMatches evaluates an If-Match value (a list of quoted ETags or *)
// against an ETag.
func etagListMatches(header, etag string) bool {
	for _, part := range strings.Split(header, ",") {
		p := strings.TrimSpace(part)
		p = strings.TrimPrefix(p, "W/")
		p = strings.Trim(p, `"`)
		if p == "*" || p == etag {
			return true
		}
	}
	return false
}
