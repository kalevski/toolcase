package s3

import (
	"encoding/base64"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/s3xml"
)

const maxList = 1000

// parseMaxKeys reads max-keys (default and ceiling 1000, 0 allowed).
func parseMaxKeys(q Query, name string) (int, error) {
	v := q.Get(name)
	if v == "" {
		return maxList, nil
	}
	n, err := strconv.Atoi(v)
	if err != nil || n < 0 {
		return 0, apierr.New("InvalidArgument", "Provided "+name+" not an integer or within integer range").WithExtra("ArgumentName", name).WithExtra("ArgumentValue", v)
	}
	if n > maxList {
		n = maxList
	}
	return n, nil
}

func parseEncoding(q Query) (bool, error) {
	switch q.Get("encoding-type") {
	case "":
		return false, nil
	case "url":
		return true, nil
	}
	return false, apierr.New("InvalidArgument", "Invalid Encoding Method specified in Request").WithExtra("ArgumentName", "encoding-type")
}

// continuation token: base64url of kind byte + key. 'K' = an object key,
// 'P' = a common prefix (resuming skips every key beneath it).
func encodeToken(kind byte, v string) string {
	return base64.RawURLEncoding.EncodeToString(append([]byte{kind}, v...))
}

func decodeToken(tok string) (kind byte, v string, err error) {
	raw, derr := base64.RawURLEncoding.DecodeString(tok)
	if derr != nil || len(raw) == 0 || (raw[0] != 'K' && raw[0] != 'P') {
		return 0, "", apierr.New("InvalidArgument", "The continuation token provided is incorrect").WithExtra("ArgumentName", "continuation-token")
	}
	return raw[0], string(raw[1:]), nil
}

// listPrelude authorises the listing and builds the common options.
func (rc *reqCtx) listOptions(prefix, delimiter string, maxKeys int) (meta.ListOptions, error) {
	if err := rc.needList(prefix); err != nil {
		return meta.ListOptions{}, err
	}
	return meta.ListOptions{Prefix: prefix, Delimiter: delimiter, MaxKeys: maxKeys, Allow: rc.p.Grants.ListFilter()}, nil
}

func (rc *reqCtx) needList(prefix string) error {
	if rc.p.Kind == auth.KindAnonymous {
		return accessDenied("Anonymous access is not allowed for this operation.")
	}
	if !rc.p.Grants.CanList(prefix) {
		return accessDenied("This credential is not allowed to list this prefix.")
	}
	return nil
}

func listObject(o *meta.Object, owner *s3xml.Owner) s3xml.Object {
	e := s3xml.Object{
		Key: o.Key, LastModified: s3xml.Time(o.CreatedAt), ETag: s3xml.ETagQuoted(o.ETag), Size: o.Size,
		StorageClass: s3xml.StorageClassStandard, Owner: owner,
	}
	if o.ChecksumAlgo != "" {
		e.ChecksumAlgorithm = []string{o.ChecksumAlgo}
		e.ChecksumType = o.ChecksumType
	}
	return e
}

// isCommonPrefix reports whether marker has the shape of a common prefix for
// (prefix, delimiter): prefix + a delimiter-free run + delimiter, at the end.
func isCommonPrefix(marker, prefix, delimiter string) bool {
	if delimiter == "" || !strings.HasPrefix(marker, prefix) || !strings.HasSuffix(marker, delimiter) ||
		len(marker)-len(delimiter) < len(prefix) { // marker == prefix, or the delimiter overlaps the prefix
		return false
	}
	rest := marker[len(prefix) : len(marker)-len(delimiter)]
	return !strings.Contains(rest, delimiter) || rest == ""
}

func (s *Server) listObjects(rc *reqCtx, v2 bool) error {
	q := rc.t.Query
	prefix, delimiter := q.Get("prefix"), q.Get("delimiter")
	maxKeys, err := parseMaxKeys(q, "max-keys")
	if err != nil {
		return err
	}
	encode, err := parseEncoding(q)
	if err != nil {
		return err
	}
	opts, err := rc.listOptions(prefix, delimiter, maxKeys)
	if err != nil {
		return err
	}
	var owner *s3xml.Owner
	startAfter, tokenIn, marker := q.Get("start-after"), q.Get("continuation-token"), q.Get("marker")
	if v2 {
		opts.After = startAfter
		if tokenIn != "" {
			kind, val, err := decodeToken(tokenIn)
			if err != nil {
				return err
			}
			opts.After = val
			if kind == 'P' {
				opts.SkipUnder = val
			}
		}
		if q.Get("fetch-owner") == "true" {
			owner = &s3xml.Owner{ID: rc.b.Name, DisplayName: rc.b.Name}
		}
	} else {
		opts.After = marker
		if isCommonPrefix(marker, prefix, delimiter) {
			opts.SkipUnder = marker
		}
		owner = &s3xml.Owner{ID: rc.b.Name, DisplayName: rc.b.Name}
	}

	res, err := s.Eng.DB.Read().ListLatest(rc.ctx, rc.b.Name, opts)
	if err != nil {
		return err
	}
	var contents []s3xml.Object
	var prefixes []s3xml.CommonPrefix
	lastKind, lastVal := byte(0), ""
	for _, e := range res.Entries {
		if e.Obj != nil {
			contents = append(contents, listObject(e.Obj, owner))
			lastKind, lastVal = 'K', e.Obj.Key
		} else {
			prefixes = append(prefixes, s3xml.CommonPrefix{Prefix: e.Prefix})
			lastKind, lastVal = 'P', e.Prefix
		}
	}
	applyCORS(rc.w, rc.r, rc.b)
	if v2 {
		out := s3xml.ListBucketResultV2{
			Name: rc.b.Name, Prefix: prefix, StartAfter: startAfter, ContinuationToken: tokenIn,
			KeyCount: len(contents) + len(prefixes), MaxKeys: maxKeys, Delimiter: delimiter,
			IsTruncated: res.Truncated, Contents: contents, CommonPrefixes: prefixes,
		}
		if res.Truncated && lastKind != 0 {
			out.NextContinuationToken = encodeToken(lastKind, lastVal)
		}
		if encode {
			out.EncodeURL()
		}
		return s.writeXML(rc, http.StatusOK, out)
	}
	out := s3xml.ListBucketResult{
		Name: rc.b.Name, Prefix: prefix, Marker: marker, MaxKeys: maxKeys, Delimiter: delimiter,
		IsTruncated: res.Truncated, Contents: contents, CommonPrefixes: prefixes,
	}
	if res.Truncated && delimiter != "" && lastKind != 0 {
		out.NextMarker = lastVal
	}
	if encode {
		out.EncodeURL()
	}
	return s.writeXML(rc, http.StatusOK, out)
}

func (s *Server) listObjectVersions(rc *reqCtx) error {
	q := rc.t.Query
	prefix, delimiter := q.Get("prefix"), q.Get("delimiter")
	maxKeys, err := parseMaxKeys(q, "max-keys")
	if err != nil {
		return err
	}
	encode, err := parseEncoding(q)
	if err != nil {
		return err
	}
	opts, err := rc.listOptions(prefix, delimiter, maxKeys)
	if err != nil {
		return err
	}
	keyMarker, vidMarker := q.Get("key-marker"), q.Get("version-id-marker")
	if vidMarker != "" && keyMarker == "" {
		return apierr.New("InvalidArgument", "A version-id marker cannot be specified without a key marker.")
	}
	opts.After = keyMarker
	if keyMarker != "" && vidMarker != "" {
		badMarker := apierr.New("InvalidArgument", "Invalid version id specified").WithExtra("ArgumentName", "version-id-marker").WithExtra("ArgumentValue", vidMarker)
		// a marker the token may not list answers exactly like a missing one, so
		// markers cannot be used to probe for keys outside the grant (spec §4.4)
		if allow := rc.p.Grants.ListFilter(); allow != nil && !allow(keyMarker) {
			return badMarker
		}
		o, err := s.Eng.DB.Read().GetS3Version(rc.ctx, rc.b.Name, keyMarker, vidMarker)
		if err != nil {
			if errors.Is(err, meta.ErrNotFound) {
				return badMarker
			}
			return err
		}
		opts.VersionSeq = o.Seq
	} else if isCommonPrefix(keyMarker, prefix, delimiter) {
		opts.SkipUnder = keyMarker
	}

	res, err := s.Eng.DB.Read().ListVersions(rc.ctx, rc.b.Name, opts)
	if err != nil {
		return err
	}
	out := s3xml.ListVersionsResult{
		Name: rc.b.Name, Prefix: prefix, KeyMarker: keyMarker, VersionIDMarker: vidMarker, MaxKeys: maxKeys,
		Delimiter: delimiter, IsTruncated: res.Truncated,
	}
	var last *s3xml.VersionEntry
	var lastPrefix string
	for _, e := range res.Entries {
		if e.Obj != nil {
			o := e.Obj
			ve := s3xml.VersionEntry{
				DeleteMarker: o.DeleteMarker, Key: o.Key, VersionID: o.S3VersionID(), IsLatest: o.IsLatest,
				LastModified: s3xml.Time(o.CreatedAt),
			}
			if !o.DeleteMarker {
				ve.ETag, ve.Size, ve.StorageClass = s3xml.ETagQuoted(o.ETag), o.Size, s3xml.StorageClassStandard
				if o.ChecksumAlgo != "" {
					ve.ChecksumAlgorithm, ve.ChecksumType = []string{o.ChecksumAlgo}, o.ChecksumType
				}
			}
			out.Entries = append(out.Entries, ve)
			last, lastPrefix = &out.Entries[len(out.Entries)-1], ""
		} else {
			out.CommonPrefixes = append(out.CommonPrefixes, s3xml.CommonPrefix{Prefix: e.Prefix})
			last, lastPrefix = nil, e.Prefix
		}
	}
	if res.Truncated {
		switch {
		case last != nil:
			out.NextKeyMarker, out.NextVersionIDMarker = last.Key, last.VersionID
		case lastPrefix != "":
			out.NextKeyMarker = lastPrefix
		}
	}
	applyCORS(rc.w, rc.r, rc.b)
	if encode {
		out.EncodeURL()
	}
	return s.writeXML(rc, http.StatusOK, out)
}
