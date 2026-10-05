package s3

import (
	"net/http"
	"net/url"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/httpcond"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/s3xml"
)

// copySource is a parsed x-amz-copy-source.
type copySource struct {
	Bucket, Key, VersionID string
}

// parseCopySource reads `[/]bucket/key[?versionId=id]` (URL-encoded).
func parseCopySource(v string) (*copySource, error) {
	bad := apierr.New("InvalidArgument", "Copy Source must mention the source bucket and key: sourcebucket/sourcekey").
		WithExtra("ArgumentName", "x-amz-copy-source").WithExtra("ArgumentValue", v)
	path, query, _ := strings.Cut(v, "?")
	path = strings.TrimPrefix(path, "/")
	i := strings.IndexByte(path, '/')
	if i <= 0 || i == len(path)-1 {
		return nil, bad
	}
	bucket, err := url.PathUnescape(path[:i])
	if err != nil {
		return nil, bad
	}
	key, err := url.PathUnescape(path[i+1:])
	if err != nil {
		return nil, bad
	}
	cs := &copySource{Bucket: bucket, Key: key}
	if query != "" {
		q, err := parseQuery(query)
		if err != nil {
			return nil, bad
		}
		for name := range q {
			if name != "versionId" {
				return nil, bad
			}
		}
		cs.VersionID = q.Get("versionId")
	}
	return cs, nil
}

// resolveCopySource authorises and loads the source of a copy.
func (s *Server) resolveCopySource(rc *reqCtx) (*copySource, *meta.Object, error) {
	cs, err := parseCopySource(rc.r.Header.Get("x-amz-copy-source"))
	if err != nil {
		return nil, nil, err
	}
	if cs.Bucket != rc.b.Name {
		return nil, nil, accessDenied("Tokens are bucket-scoped: the copy source must be in the same bucket.")
	}
	if err := engine.ValidateKey(cs.Key); err != nil {
		return nil, nil, err
	}
	if err := rc.need(auth.Read, cs.Key); err != nil {
		return nil, nil, err
	}
	src, _, err := s.lookupRead(rc, cs.Key, cs.VersionID) // the stale-write guard covers a copy's source (spec §7.8)
	if err != nil {
		if apierr.Is(err, "MethodNotAllowed") {
			return nil, nil, apierr.New("InvalidRequest", "The source of a copy request may not specifically refer to a delete marker by version id.")
		}
		return nil, nil, err
	}
	if !httpcond.EvaluateCopy(rc.r.Header, src.ETag, src.CreatedAt) {
		return nil, nil, apierr.New("PreconditionFailed", "At least one of the pre-conditions you specified did not hold.")
	}
	return cs, src, nil
}

func (s *Server) copyObject(rc *reqCtx) error {
	r := rc.r
	cs, src, err := s.resolveCopySource(rc)
	if err != nil {
		return err
	}
	_ = cs
	dst := rc.t.Key
	if err := engine.ValidateKey(dst); err != nil {
		return err
	}
	req := &engine.CopyRequest{Bucket: rc.b, Src: src, DstKey: dst, Actor: rc.actor()}
	if g := rc.guard(); g.Applies(src.Key) {
		// checked again inside the commit: a pinned source must still exist as
		// the event's version, an unpinned one must still be the live version
		if g.Pins(cs.VersionID) {
			req.RequireSrcVersion = g.Version
		} else {
			req.RequireSrcLatest = g.Version
		}
	}

	switch d := strings.ToUpper(r.Header.Get("x-amz-metadata-directive")); d {
	case "", "COPY":
	case "REPLACE":
		req.ReplaceMetadata = true
	default:
		return apierr.New("InvalidArgument", "Unknown metadata directive.").WithExtra("ArgumentName", "x-amz-metadata-directive")
	}
	switch d := strings.ToUpper(r.Header.Get("x-amz-tagging-directive")); d {
	case "", "COPY":
	case "REPLACE":
		req.ReplaceTags = true
	default:
		return apierr.New("InvalidArgument", "Unknown tagging directive.").WithExtra("ArgumentName", "x-amz-tagging-directive")
	}
	wh, err := ParseWriteHeaders(r.Header)
	if err != nil {
		return err
	}
	req.SSE = wh.SSE
	if req.ReplaceMetadata {
		req.Headers, req.Metadata = wh.Headers, wh.Metadata
	}
	if req.ReplaceTags {
		req.Tags = wh.Tags
	}
	writeOnce, err := rc.writeAccess(dst, req.ReplaceTags && len(req.Tags) > 0)
	if err != nil {
		return err
	}
	req.WriteOnce = writeOnce
	req.IfNoneMatchStar, req.IfMatch, err = WritePreconditions(r.Header)
	if err != nil {
		return err
	}

	return s.runWithKeepalive(rc, func() opResult {
		res, err := s.Eng.Copy(rc.ctx, req)
		if err != nil {
			return opResult{err: err}
		}
		o := res.Obj
		doc := s3xml.CopyObjectResult{LastModified: s3xml.Time(o.CreatedAt), ETag: s3xml.ETagQuoted(o.ETag)}
		return opResult{body: doc, headers: func(h http.Header) {
			h.Set("x-binvault-version", o.Version)
			if rc.b.Versioning == meta.VersioningEnabled {
				h.Set("x-amz-version-id", o.S3VersionID())
				h.Set("x-amz-copy-source-version-id", src.S3VersionID())
			}
			if o.SSE {
				h.Set("x-amz-server-side-encryption", "AES256")
			}
			if res.Modified {
				h.Set("x-binvault-modified", "true")
			}
		}}
	})
}
