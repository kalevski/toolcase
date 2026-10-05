package s3

import (
	"bytes"
	"crypto/md5"
	"io"
	"net/http"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/s3xml"
	"github.com/kalevski/toolcase/binvault/internal/sigv4"
)

// deleteObjects implements DeleteObjects (spec §5.4.4): every entry is judged
// exactly like the equivalent DeleteObject.
func (s *Server) deleteObjects(rc *reqCtx) error {
	if err := rc.needAnyAction(); err != nil {
		return err
	}
	src := s.xmlBody(rc)
	body, err := io.ReadAll(io.LimitReader(src, s3xml.MaxRequestBytes+1))
	if err != nil {
		return toAPIError(err)
	}
	if len(body) > s3xml.MaxRequestBytes {
		return apierr.New("EntityTooLarge", "The XML you provided is too large.")
	}
	if want, err := ParseContentMD5(rc.r.Header.Get("Content-MD5")); err != nil {
		return err
	} else if want != nil {
		sum := md5.Sum(body)
		if !bytes.Equal(want, sum[:]) {
			return apierr.New("BadDigest", "The Content-MD5 you specified did not match what we received.")
		}
	}
	// the x-amz-checksum-<algo> SDKs send instead of (or beside) Content-MD5, as a
	// header or as the trailer of an aws-chunked body (spec §5.4.4)
	var trailer http.Header
	if sr, ok := src.(*sigv4.StreamReader); ok {
		trailer = sr.Trailer()
	}
	if err := verifyBodyChecksum(rc.r.Header, trailer, body); err != nil {
		return err
	}
	var doc s3xml.Delete
	if err := s3xml.Decode(bytes.NewReader(body), &doc, 0); err != nil {
		return err
	}
	if err := doc.Validate(); err != nil {
		return err
	}

	unversioned := rc.b.Versioning != meta.VersioningEnabled
	res := s3xml.DeleteResult{}
	batch := &engine.BeforeBatch{} // the entries' before delete chains share one budget (spec §5.4.4)
	for _, e := range doc.Objects {
		purge := e.VersionID != "" && !(unversioned && e.VersionID == "null")
		action := auth.Delete
		if purge {
			action = auth.Purge
		}
		fail := func(err error) {
			// a delete that the freeze of the bucket (a move, spec §8.8) cut short is a
			// SlowDown to retry, like the whole request would be, not an internal error
			ae := toAPIError(engine.FrozenCause(rc.ctx, err))
			res.Errors = append(res.Errors, s3xml.DeleteError{Key: e.Key, VersionID: e.VersionID, Code: ae.Code, Message: ae.Message})
		}
		if err := rc.need(action, e.Key); err != nil {
			fail(err)
			continue
		}
		if err := engine.ValidateKey(e.Key); err != nil {
			fail(err)
			continue
		}
		dr, err := s.deleteWithGate(rc, e.Key, e.VersionID, purge, batch)
		if err != nil {
			fail(err)
			continue
		}
		if doc.Quiet {
			continue
		}
		d := s3xml.DeletedObject{Key: e.Key, VersionID: e.VersionID}
		if rc.b.Versioning == meta.VersioningEnabled && dr.DeleteMarker {
			d.DeleteMarker = true
			d.DeleteMarkerVersionID = dr.VersionID
			if !purge {
				d.VersionID = ""
			}
		}
		res.Deleted = append(res.Deleted, d)
	}
	applyCORS(rc.w, rc.r, rc.b)
	return s.writeXML(rc, http.StatusOK, res)
}
