package s3

import (
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/checksum"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/httpcond"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/s3xml"
)

func quote(etag string) string { return `"` + etag + `"` }

// actor describes the request's principal for events (spec §7.5).
func (rc *reqCtx) actor() engine.Actor {
	a := engine.Actor{Kind: rc.p.Kind, ID: rc.p.AccessKey, Name: rc.p.Name}
	if rc.p.Kind == auth.KindPipeline {
		a.RunID = rc.p.Run
		if pt := rc.pipe(); pt != nil {
			// a write made with a pipeline token is one level deeper and carries
			// the pipeline in its chain (spec §7.11); an after run's token is
			// also held to the stale-write guard (spec §7.8)
			depth, chain := pt.Lineage()
			a.Depth = depth + 1
			a.Chain = append(append([]string(nil), chain...), rc.p.Name)
			a.Guard = pt.Guard()
		}
	}
	return a
}

// setObjectHeaders writes the stored object headers shared by GET, HEAD,
// PutObject results and CopyObject (spec §5.4.2).
func (s *Server) setObjectHeaders(h http.Header, b *meta.Bucket, o *meta.Object, checksums bool) {
	h.Set("Last-Modified", s3xml.HTTPDate(o.CreatedAt))
	h.Set("ETag", quote(o.ETag))
	h.Set("Accept-Ranges", "bytes")
	if o.ContentType != "" {
		h.Set("Content-Type", o.ContentType)
	}
	if o.ContentEncoding != "" {
		h.Set("Content-Encoding", o.ContentEncoding)
	}
	if o.ContentLanguage != "" {
		h.Set("Content-Language", o.ContentLanguage)
	}
	if o.ContentDisposition != "" {
		h.Set("Content-Disposition", o.ContentDisposition)
	}
	if o.CacheControl != "" {
		h.Set("Cache-Control", o.CacheControl)
	}
	if o.Expires != "" {
		h.Set("Expires", o.Expires)
	}
	for k, v := range o.Metadata {
		h["x-amz-meta-"+k] = []string{v}
	}
	if n := len(o.Tags); n > 0 {
		h.Set("x-amz-tagging-count", strconv.Itoa(n))
	}
	h.Set("x-binvault-version", o.Version)
	if b.Versioning == meta.VersioningEnabled {
		h.Set("x-amz-version-id", o.S3VersionID())
	}
	if o.SSE {
		h.Set("x-amz-server-side-encryption", "AES256")
	}
	h.Set("X-Content-Type-Options", "nosniff")
	if at, id, ok := engine.Expiry(b.Lifecycle, o); ok && o.IsLatest {
		h.Set("x-amz-expiration", fmt.Sprintf(`expiry-date="%s", rule-id="%s"`, s3xml.HTTPDate(at), id))
	}
	if checksums && o.ChecksumAlgo != "" && o.Checksum != "" {
		if a, ok := checksum.ParseAlgo(o.ChecksumAlgo); ok {
			h.Set(a.HeaderName(), o.Checksum)
			if o.ChecksumType != "" {
				h.Set("x-amz-checksum-type", o.ChecksumType)
			}
		}
	}
}

// ---- PutObject ---------------------------------------------------------------------

func (s *Server) putObject(rc *reqCtx) error {
	r, key := rc.r, rc.t.Key
	if pt := rc.pipe(); pt != nil && pt.StagedKey() != "" {
		return s.putStaged(rc, pt)
	}
	wh, err := ParseWriteHeaders(r.Header)
	if err != nil {
		return err
	}
	writeOnce, err := rc.writeAccess(key, len(wh.Tags) > 0)
	if err != nil {
		return err
	}
	star, ifMatch, err := WritePreconditions(r.Header)
	if err != nil {
		return err
	}
	up, err := s.prepareUpload(rc)
	if err != nil {
		return err
	}
	res, err := s.Eng.Put(rc.ctx, &engine.PutRequest{
		Bucket: rc.b, Key: key, Body: up.Body, Size: up.Size,
		Headers: wh.Headers, Metadata: wh.Metadata, Tags: wh.Tags, SSE: wh.SSE,
		ChecksumAlgo: up.Algo, Verify: up.Verify,
		IfNoneMatchStar: star, IfMatch: ifMatch, WriteOnce: writeOnce,
		Actor: rc.actor(), Op: "put",
	})
	if err != nil {
		return err
	}
	applyCORS(rc.w, r, rc.b)
	h := rc.w.Header()
	h.Set("ETag", quote(res.Obj.ETag))
	h.Set("x-binvault-version", res.Obj.Version)
	if rc.b.Versioning == meta.VersioningEnabled {
		h.Set("x-amz-version-id", res.Obj.S3VersionID())
	}
	if res.Obj.SSE {
		h.Set("x-amz-server-side-encryption", "AES256")
	}
	if res.Modified {
		h.Set("x-binvault-modified", "true")
	}
	if res.Obj.ChecksumAlgo != "" {
		if a, ok := checksum.ParseAlgo(res.Obj.ChecksumAlgo); ok {
			h.Set(a.HeaderName(), res.Obj.Checksum)
		}
	}
	if at, id, ok := engine.Expiry(rc.b.Lifecycle, res.Obj); ok {
		h.Set("x-amz-expiration", fmt.Sprintf(`expiry-date="%s", rule-id="%s"`, s3xml.HTTPDate(at), id))
	}
	rc.w.WriteHeader(http.StatusOK)
	return nil
}

// putStaged is the PUT of a before run's token: it replaces the staged object
// (spec §7.8, "Staged view"). Content headers, user metadata and tags the
// request leaves out are inherited from the staged object, metadata keys it
// names are merged over them, and x-binvault-replace-metadata: true asks for
// full S3 replace semantics. The change is pending until the attempt succeeds.
func (s *Server) putStaged(rc *reqCtx, pt PipelineToken) error {
	r, key := rc.r, rc.t.Key
	if key != pt.StagedKey() {
		return accessDenied("A before pipeline's token may only write the staged key.")
	}
	if err := rc.need(auth.Write, key); err != nil {
		return err
	}
	wh, err := ParseWriteHeaders(r.Header)
	if err != nil {
		return err
	}
	star, ifMatch, err := WritePreconditions(r.Header)
	if err != nil {
		return err
	}
	if star {
		return apierr.New("PreconditionFailed", "At least one of the pre-conditions you specified did not hold.").WithExtra("Condition", "If-None-Match")
	}
	up, err := s.prepareUpload(rc)
	if err != nil {
		return err
	}
	obj, err := pt.StagedPut(rc.ctx, &engine.StagedPut{
		Body: up.Body, Size: up.Size, Algo: up.Algo, Verify: up.Verify,
		Headers: wh.Headers, Metadata: wh.Metadata, Tags: wh.Tags, TagsGiven: r.Header.Get("x-amz-tagging") != "",
		ReplaceMetadata: strings.EqualFold(strings.TrimSpace(r.Header.Get("x-binvault-replace-metadata")), "true"),
		IfMatch:         ifMatch,
	})
	if err != nil {
		return err
	}
	h := rc.w.Header()
	h.Set("ETag", quote(obj.ETag))
	h.Set("x-binvault-version", obj.Version)
	if rc.b.Versioning == meta.VersioningEnabled {
		h.Set("x-amz-version-id", obj.S3VersionID())
	}
	if obj.SSE {
		h.Set("x-amz-server-side-encryption", "AES256")
	}
	if obj.ChecksumAlgo != "" {
		if a, ok := checksum.ParseAlgo(obj.ChecksumAlgo); ok {
			h.Set(a.HeaderName(), obj.Checksum)
		}
	}
	rc.w.WriteHeader(http.StatusOK)
	return nil
}

// ---- GetObject / HeadObject --------------------------------------------------------

var responseOverrides = map[string]string{
	"response-content-type":        "Content-Type",
	"response-content-language":    "Content-Language",
	"response-expires":             "Expires",
	"response-cache-control":       "Cache-Control",
	"response-content-disposition": "Content-Disposition",
	"response-content-encoding":    "Content-Encoding",
}

func (s *Server) getObject(rc *reqCtx) error {
	r, w, key, q := rc.r, rc.w, rc.t.Key, rc.t.Query
	versionID := q.Get("versionId")
	hasOverrides := false
	for k := range q {
		if _, ok := responseOverrides[k]; ok {
			hasOverrides = true
		}
	}
	if rc.p.Kind == auth.KindAnonymous {
		if versionID != "" || !rc.anonymousRead(key) {
			return accessDenied("Anonymous access is not allowed for this object.")
		}
		if hasOverrides {
			return apierr.New("InvalidRequest", "Request specified a response-* override, which requires a signed request.")
		}
	} else if err := rc.need(auth.Read, key); err != nil {
		return err
	}
	applyCORS(w, r, rc.b)
	if q.Get("partNumber") != "" && r.Header.Get("Range") != "" {
		return apierr.New("InvalidRequest", "Cannot specify both Range header and partNumber query parameter")
	}

	obj, staged, err := s.lookupRead(rc, key, versionID)
	if err != nil {
		return err
	}
	switch httpcond.Evaluate(r.Header, obj.ETag, obj.CreatedAt) {
	case httpcond.Failed:
		return apierr.New("PreconditionFailed", "At least one of the pre-conditions you specified did not hold.")
	case httpcond.NotModified:
		w.Header().Set("ETag", quote(obj.ETag))
		w.Header().Set("Last-Modified", s3xml.HTTPDate(obj.CreatedAt))
		if rc.b.Versioning == meta.VersioningEnabled {
			w.Header().Set("x-amz-version-id", obj.S3VersionID())
		}
		w.WriteHeader(http.StatusNotModified)
		return nil
	}

	body, err := s.openObjectBody(rc, obj, staged)
	if err != nil {
		return err
	}
	defer body.Close()
	size := body.Size()

	// range / part number
	start, length := int64(0), size
	partial := false
	h := w.Header()
	if pn := q.Get("partNumber"); pn != "" {
		n, perr := strconv.Atoi(pn)
		if perr != nil || n < 1 {
			return apierr.New("InvalidArgument", "Part number must be an integer between 1 and 10000, inclusive.")
		}
		switch {
		case len(obj.Parts) == 0 && n == 1:
		case len(obj.Parts) == 0 || n > len(obj.Parts):
			return apierr.New("InvalidPartNumber", "The requested partnumber is not satisfiable").WithStatus(http.StatusRequestedRangeNotSatisfiable)
		default:
			for _, ps := range obj.Parts[:n-1] {
				start += ps
			}
			length = obj.Parts[n-1]
			partial = true
			h.Set("x-amz-mp-parts-count", strconv.Itoa(len(obj.Parts)))
		}
	} else {
		rg, res := httpcond.ParseRange(r.Header.Get("Range"), size)
		switch res {
		case httpcond.Unsatisfiable:
			h.Set("Content-Range", "bytes */"+strconv.FormatInt(size, 10))
			return apierr.New("InvalidRange", "The requested range is not satisfiable").
				WithExtra("ActualObjectSize", strconv.FormatInt(size, 10)).
				WithExtra("RangeRequested", r.Header.Get("Range"))
		case httpcond.Partial:
			start, length, partial = rg.Start, rg.Length, true
		}
	}

	s.setObjectHeaders(h, rc.b, obj, strings.EqualFold(r.Header.Get("x-amz-checksum-mode"), "ENABLED"))
	if partial {
		// a partial response does not describe the whole object's checksum
		for k := range h {
			if strings.HasPrefix(strings.ToLower(k), "x-amz-checksum-") {
				delete(h, k)
			}
		}
	}
	for param, header := range responseOverrides {
		if v := q.Get(param); v != "" {
			h.Set(header, v)
		}
	}
	if rc.p.Kind == auth.KindAnonymous {
		h.Set("Content-Security-Policy", "sandbox")
	}
	h.Set("Content-Length", strconv.FormatInt(length, 10))
	status := http.StatusOK
	if partial {
		status = http.StatusPartialContent
		h.Set("Content-Range", fmt.Sprintf("bytes %d-%d/%d", start, start+length-1, size))
	}
	w.WriteHeader(status)
	if r.Method == http.MethodHead || length == 0 {
		return nil
	}
	return s.streamBody(rc, body, start, length)
}

// streamBody copies [off, off+n) of body to the client in chunks, extending the
// write deadline between chunks (idle-bounded, spec §2.3). Without a bandwidth
// limit the ResponseWriter itself is the destination, which keeps sendfile.
func (s *Server) streamBody(rc *reqCtx, body engine.Body, off, n int64) error {
	const chunk = 4 << 20
	var w io.Writer = rc.w
	if s.Limits != nil && rc.p.Kind != auth.KindPipeline {
		w = s.Limits.WrapWriter(rc.ctx, rc.p, rc.b, rc.w)
	}
	rctl := http.NewResponseController(rc.w)
	for n > 0 {
		c := int64(chunk)
		if n < c {
			c = n
		}
		if s.Cfg.BodyIdleTimeout > 0 {
			_ = rctl.SetWriteDeadline(time.Now().Add(s.Cfg.BodyIdleTimeout))
		}
		m, err := body.WriteRange(w, off, c)
		off += m
		n -= m
		if err != nil {
			// the headers are out: the only honest signal left is cutting the
			// connection so the client sees the truncation
			panic(http.ErrAbortHandler)
		}
	}
	return nil
}

// ---- DeleteObject ------------------------------------------------------------------

func (s *Server) deleteObject(rc *reqCtx) error {
	r, w, key := rc.r, rc.w, rc.t.Key
	versionID := rc.t.Query.Get("versionId")
	unversioned := rc.b.Versioning != meta.VersioningEnabled
	purge := versionID != "" && !(unversioned && versionID == "null")
	action := auth.Delete
	if purge {
		action = auth.Purge
	}
	if err := rc.need(action, key); err != nil {
		return err
	}
	if err := engine.ValidateKey(key); err != nil {
		return err
	}
	if pt := rc.staged(key); pt != nil {
		// a before run's DELETE marks the staged object rejected (spec §7.8)
		if err := pt.StagedDelete(); err != nil {
			return err
		}
		w.WriteHeader(http.StatusNoContent)
		return nil
	}
	res, err := s.deleteWithGate(rc, key, versionID, purge, nil)
	if err != nil {
		return err
	}
	applyCORS(w, r, rc.b)
	h := w.Header()
	if res.DeleteMarker {
		h.Set("x-amz-delete-marker", "true")
	}
	if res.VersionID != "" && rc.b.Versioning == meta.VersioningEnabled {
		h.Set("x-amz-version-id", res.VersionID)
	}
	w.WriteHeader(http.StatusNoContent)
	return nil
}

// deleteWithGate runs the before-delete chain (when wired) and deletes. A
// delete with a version id runs no chain (spec §5.4.3).
func (s *Server) deleteWithGate(rc *reqCtx, key, versionID string, purge bool, batch *engine.BeforeBatch) (*engine.DeleteResult, error) {
	req := &engine.DeleteRequest{Bucket: rc.b.Name, Key: key, VersionID: versionID, Actor: rc.actor()}
	if !purge && s.Eng.BeforeDelete != nil {
		seq, err := s.Eng.BeforeDelete(rc.ctx, &engine.BeforeDeleteCall{Bucket: rc.b, Key: key, Actor: req.Actor, Batch: batch})
		if err != nil {
			return nil, err
		}
		req.IfSeq = seq
	}
	res, err := s.Eng.Delete(rc.ctx, req)
	if err != nil {
		return nil, err
	}
	if res.Skipped {
		return nil, apierr.New("ConditionalRequestConflict", "The object was replaced while the delete was being vetted; try again.")
	}
	return res, nil
}
