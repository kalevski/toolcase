package s3

import (
	"net/http"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/s3xml"
)

// lookupVersion resolves the addressed version of an object for a sub-resource
// call (tagging, ACL, attributes).
func (s *Server) lookupVersion(rc *reqCtx) (*meta.Object, error) {
	o, _, err := s.lookupRead(rc, rc.t.Key, rc.t.Query.Get("versionId"))
	return o, err
}

func (s *Server) setVersionHeader(rc *reqCtx, o *meta.Object) {
	if rc.b.Versioning == meta.VersioningEnabled {
		rc.w.Header().Set("x-amz-version-id", o.S3VersionID())
	}
}

func (s *Server) getObjectTagging(rc *reqCtx) error {
	if err := rc.need(auth.Read, rc.t.Key); err != nil {
		return err
	}
	o, err := s.lookupVersion(rc)
	if err != nil {
		return err
	}
	s.setVersionHeader(rc, o)
	return s.writeXML(rc, http.StatusOK, s3xml.NewTagging(o.Tags))
}

func (s *Server) putObjectTagging(rc *reqCtx) error {
	if err := rc.need(auth.Tag, rc.t.Key); err != nil {
		return err
	}
	var doc s3xml.Tagging
	if err := s3xml.Decode(s.xmlBody(rc), &doc, 0); err != nil {
		return err
	}
	if err := doc.Validate(); err != nil {
		return err
	}
	tags := doc.Map()
	if err := engine.ValidateTags(tags); err != nil {
		return err
	}
	if err := s.setTags(rc, tags); err != nil {
		return err
	}
	rc.w.WriteHeader(http.StatusOK)
	return nil
}

// setTags replaces the tags of the addressed version: the pending tags of the
// staged object for a before run's token, otherwise the stored ones, held to
// the stale-write guard for an after run's token (spec §7.8).
func (s *Server) setTags(rc *reqCtx, tags map[string]string) error {
	key := rc.t.Key
	o, _, err := s.lookupRead(rc, key, rc.t.Query.Get("versionId"))
	if err != nil {
		return err
	}
	if pt := rc.staged(key); pt != nil {
		if err := pt.StagedSetTags(tags); err != nil {
			return err
		}
		s.setVersionHeader(rc, o)
		return nil
	}
	g := rc.guard()
	if err := s.Eng.SetTagsGuarded(rc.ctx, rc.b.Name, o, tags, g, g.Pins(rc.t.Query.Get("versionId"))); err != nil {
		return err
	}
	s.setVersionHeader(rc, o)
	return nil
}

func (s *Server) deleteObjectTagging(rc *reqCtx) error {
	if err := rc.need(auth.Tag, rc.t.Key); err != nil {
		return err
	}
	if err := s.setTags(rc, nil); err != nil {
		return err
	}
	rc.w.WriteHeader(http.StatusNoContent)
	return nil
}

// getObjectAcl / putObjectAcl are the fixed stubs of spec §5.2.
func (s *Server) getObjectAcl(rc *reqCtx) error {
	if err := rc.need(auth.Read, rc.t.Key); err != nil {
		return err
	}
	o, err := s.lookupVersion(rc)
	if err != nil {
		return err
	}
	s.setVersionHeader(rc, o)
	return s.writeXML(rc, http.StatusOK, s3xml.StubACL(rc.b.Name, rc.b.Name))
}

func (s *Server) putObjectAcl(rc *reqCtx) error {
	if err := rc.need(auth.Write, rc.t.Key); err != nil {
		return err
	}
	if err := s.checkACLRequest(rc); err != nil {
		return err
	}
	if _, err := s.lookupVersion(rc); err != nil {
		return err
	}
	rc.w.WriteHeader(http.StatusOK)
	return nil
}

// checkACLRequest judges a PutObjectAcl / PutBucketAcl request (spec §5.2). The
// canned ACLs private and bucket-owner-full-control are accepted and ignored,
// and so is an AccessControlPolicy body that grants nothing to anyone but the
// owner (what s3cmd and `aws s3api put-*-acl --access-control-policy` send for
// "private"). Grant headers, other canned ACLs and a body that grants access to
// anyone else are AccessControlListNotSupported: a client must never believe
// an object or bucket was shared when binvault ignored it.
func (s *Server) checkACLRequest(rc *reqCtx) error {
	notSupported := apierr.New("AccessControlListNotSupported", "The bucket does not allow ACLs.")
	h := rc.r.Header
	if acl := h.Get("x-amz-acl"); acl != "" && acl != "private" && acl != "bucket-owner-full-control" {
		return notSupported
	}
	for k := range h {
		if strings.HasPrefix(strings.ToLower(k), "x-amz-grant-") {
			return notSupported
		}
	}
	var doc s3xml.AccessControlPolicy
	switch err := s3xml.Decode(s.xmlBody(rc), &doc, 0); {
	case err == nil:
		if !doc.OwnerOnly(rc.b.Name) {
			return notSupported
		}
	case apierr.Is(err, "MissingRequestBodyError"): // the canned form has no body
	default:
		return err
	}
	return nil
}
