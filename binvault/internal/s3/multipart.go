package s3

import (
	"net/http"
	"net/url"
	"strconv"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/checksum"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/httpcond"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/s3xml"
)

func (s *Server) createMultipartUpload(rc *reqCtx) error {
	r, key := rc.r, rc.t.Key
	wh, err := ParseWriteHeaders(r.Header)
	if err != nil {
		return err
	}
	writeOnce, err := rc.writeAccess(key, len(wh.Tags) > 0)
	if err != nil {
		return err
	}
	algo := ""
	if v := r.Header.Get("x-amz-checksum-algorithm"); v != "" {
		a, ok := checksum.ParseAlgo(v)
		if !ok {
			return apierr.New("InvalidRequest", "Checksum algorithm provided is unsupported.")
		}
		algo = string(a)
	}
	ctype := strings.ToUpper(r.Header.Get("x-amz-checksum-type"))
	switch ctype {
	case "", "COMPOSITE", "FULL_OBJECT":
	default:
		return apierr.New("InvalidRequest", "The x-amz-checksum-type header is invalid.")
	}
	if ctype == "FULL_OBJECT" && (algo == "SHA1" || algo == "SHA256") {
		return apierr.New("InvalidRequest", "The FULL_OBJECT checksum type is not supported for this algorithm.")
	}
	if algo != "" && ctype == "" {
		ctype = "COMPOSITE"
		if algo == "CRC64NVME" {
			ctype = "FULL_OBJECT"
		}
	}
	u, err := s.Eng.CreateUpload(rc.ctx, &engine.CreateUploadRequest{
		Bucket: rc.b, Key: key, Headers: wh.Headers, Metadata: wh.Metadata, Tags: wh.Tags, SSE: wh.SSE,
		ChecksumAlgo: algo, ChecksumType: ctype, WriteOnce: writeOnce, Actor: rc.actor(),
	})
	if err != nil {
		return err
	}
	if u.Encrypted {
		rc.w.Header().Set("x-amz-server-side-encryption", "AES256")
	}
	if algo != "" {
		rc.w.Header().Set("x-amz-checksum-algorithm", algo)
		rc.w.Header().Set("x-amz-checksum-type", ctype)
	}
	applyCORS(rc.w, r, rc.b)
	return s.writeXML(rc, http.StatusOK, s3xml.InitiateMultipartUploadResult{Bucket: rc.b.Name, Key: key, UploadID: u.UploadID})
}

func partNumber(q Query) (int, error) {
	n, err := strconv.Atoi(q.Get("partNumber"))
	if err != nil || n < 1 || n > engine.MaxParts {
		return 0, apierr.New("InvalidArgument", "Part number must be an integer between 1 and 10000, inclusive.").WithExtra("ArgumentName", "partNumber")
	}
	return n, nil
}

func (s *Server) uploadPart(rc *reqCtx) error {
	key := rc.t.Key
	writeOnce, err := rc.writeAccess(key, false)
	if err != nil {
		return err
	}
	n, err := partNumber(rc.t.Query)
	if err != nil {
		return err
	}
	up, err := s.Eng.GetUpload(rc.ctx, rc.b.Name, key, rc.t.Query.Get("uploadId"))
	if err != nil {
		return err
	}
	pu, err := s.prepareUpload(rc)
	if err != nil {
		return err
	}
	algo := pu.Algo
	if algo == "" {
		algo = up.ChecksumAlgo // composite results need every part's checksum
	}
	part, err := s.Eng.UploadPart(rc.ctx, &engine.PartRequest{
		Bucket: rc.b, Upload: up, Number: n, Body: pu.Body, Size: pu.Size, Algo: algo, Verify: pu.Verify, WriteOnce: writeOnce,
	})
	if err != nil {
		return err
	}
	h := rc.w.Header()
	h.Set("ETag", quote(part.ETag))
	if part.ChecksumAlgo != "" {
		if a, ok := checksum.ParseAlgo(part.ChecksumAlgo); ok {
			h.Set(a.HeaderName(), part.Checksum)
		}
	}
	if up.Encrypted {
		h.Set("x-amz-server-side-encryption", "AES256")
	}
	applyCORS(rc.w, rc.r, rc.b)
	rc.w.WriteHeader(http.StatusOK)
	return nil
}

func (s *Server) uploadPartCopy(rc *reqCtx) error {
	key := rc.t.Key
	writeOnce, err := rc.writeAccess(key, false)
	if err != nil {
		return err
	}
	n, err := partNumber(rc.t.Query)
	if err != nil {
		return err
	}
	up, err := s.Eng.GetUpload(rc.ctx, rc.b.Name, key, rc.t.Query.Get("uploadId"))
	if err != nil {
		return err
	}
	_, src, err := s.resolveCopySource(rc)
	if err != nil {
		return err
	}
	off, length := int64(0), int64(-1)
	if v := rc.r.Header.Get("x-amz-copy-source-range"); v != "" {
		rg, ok := httpcond.ParseCopyRange(v, src.Size)
		if !ok {
			return apierr.New("InvalidArgument", "The x-amz-copy-source-range value must be of the form bytes=first-last where first and last are the zero-based offsets of the first and last bytes to copy").
				WithExtra("ArgumentName", "x-amz-copy-source-range").WithExtra("ArgumentValue", v)
		}
		off, length = rg.Start, rg.Length
	}
	part, err := s.Eng.CopyPart(rc.ctx, &engine.CopyPartRequest{
		Bucket: rc.b, Upload: up, Number: n, Src: src, Off: off, Len: length, Algo: up.ChecksumAlgo, WriteOnce: writeOnce,
	})
	if err != nil {
		return err
	}
	if rc.b.Versioning == meta.VersioningEnabled {
		rc.w.Header().Set("x-amz-copy-source-version-id", src.S3VersionID())
	}
	return s.writeXML(rc, http.StatusOK, s3xml.CopyPartResult{LastModified: s3xml.Time(part.CreatedAt), ETag: s3xml.ETagQuoted(part.ETag)})
}

func (s *Server) completeMultipartUpload(rc *reqCtx) error {
	r, key := rc.r, rc.t.Key
	if rc.p.Kind == auth.KindAnonymous {
		return accessDenied("Anonymous access is not allowed for this operation.")
	}
	var doc s3xml.CompleteMultipartUpload
	if err := s3xml.Decode(s.xmlBody(rc), &doc, 0); err != nil {
		return err
	}
	if err := doc.Validate(); err != nil {
		return err
	}
	refs := make([]engine.PartRef, len(doc.Parts))
	for i, p := range doc.Parts {
		refs[i] = engine.PartRef{Number: p.PartNumber, ETag: s3xml.ETagUnquoted(p.ETag), Checksum: firstChecksum(p.Checksums)}
	}
	uploadID := rc.t.Query.Get("uploadId")

	// a retried Complete is answered from the record, before the write-once
	// check and the conditional headers (spec §5.6)
	if prev, err := s.Eng.PreviousComplete(rc.ctx, rc.b.Name, key, uploadID, refs); err != nil {
		return err
	} else if prev != nil {
		if err := rc.need(auth.Create, key); err != nil && rc.need(auth.Write, key) != nil {
			return err
		}
		return s.completeResponse(rc, prev)
	}

	writeOnce, err := rc.writeAccess(key, false)
	if err != nil {
		return err
	}
	up, err := s.Eng.GetUpload(rc.ctx, rc.b.Name, key, uploadID)
	if err != nil {
		if apierr.Is(err, "NoSuchUpload") { // completed a moment ago by an overlapping request?
			if prev, perr := s.Eng.PreviousComplete(rc.ctx, rc.b.Name, key, uploadID, refs); perr == nil && prev != nil {
				return s.completeResponse(rc, prev)
			}
		}
		return err
	}
	star, ifMatch, err := WritePreconditions(r.Header)
	if err != nil {
		return err
	}
	return s.runWithKeepalive(rc, func() opResult {
		res, err := s.Eng.Complete(rc.ctx, &engine.CompleteRequest{
			Bucket: rc.b, Upload: up, Parts: refs, IfNoneMatchStar: star, IfMatch: ifMatch, WriteOnce: writeOnce,
			Actor: rc.actor(), ChecksumType: strings.ToUpper(r.Header.Get("x-amz-checksum-type")),
		})
		if err != nil {
			return opResult{err: err}
		}
		return s.completeResult(rc, res)
	})
}

func firstChecksum(c s3xml.Checksums) string {
	for _, v := range []string{c.CRC32, c.CRC32C, c.CRC64NVME, c.SHA1, c.SHA256} {
		if v != "" {
			return v
		}
	}
	return ""
}

func (s *Server) completeResult(rc *reqCtx, res *engine.CompleteResult) opResult {
	doc := s3xml.CompleteMultipartUploadResult{
		Location: s.objectURL(rc), Bucket: rc.b.Name, Key: res.Key, ETag: s3xml.ETagQuoted(res.ETag), ChecksumType: res.ChecksumType,
	}
	switch res.ChecksumAlgo {
	case "CRC32":
		doc.CRC32 = res.Checksum
	case "CRC32C":
		doc.CRC32C = res.Checksum
	case "CRC64NVME":
		doc.CRC64NVME = res.Checksum
	case "SHA1":
		doc.SHA1 = res.Checksum
	case "SHA256":
		doc.SHA256 = res.Checksum
	}
	return opResult{body: doc, headers: func(h http.Header) {
		h.Set("x-binvault-version", res.Version)
		if rc.b.Versioning == meta.VersioningEnabled {
			h.Set("x-amz-version-id", res.S3VersionID)
		}
		if res.SSE {
			h.Set("x-amz-server-side-encryption", "AES256")
		}
		if res.Modified {
			h.Set("x-binvault-modified", "true")
		}
	}}
}

func (s *Server) completeResponse(rc *reqCtx, res *engine.CompleteResult) error {
	out := s.completeResult(rc, res)
	out.headers(rc.w.Header())
	return s.writeXML(rc, http.StatusOK, out.body)
}

// objectURL is the Location of a completed upload.
func (s *Server) objectURL(rc *reqCtx) string {
	base := strings.TrimRight(s.Cfg.EndpointURL, "/")
	return base + "/" + url.PathEscape(rc.b.Name) + "/" + escapeKeyPath(rc.t.Key)
}

func escapeKeyPath(key string) string {
	parts := strings.Split(key, "/")
	for i, p := range parts {
		parts[i] = url.PathEscape(p)
	}
	return strings.Join(parts, "/")
}

func (s *Server) abortMultipartUpload(rc *reqCtx) error {
	key := rc.t.Key
	if _, err := rc.writeAccess(key, false); err != nil {
		return err
	}
	up, err := s.Eng.GetUpload(rc.ctx, rc.b.Name, key, rc.t.Query.Get("uploadId"))
	if err != nil {
		return err
	}
	if err := s.Eng.AbortUpload(rc.ctx, rc.b, up); err != nil {
		return err
	}
	rc.w.WriteHeader(http.StatusNoContent)
	return nil
}

func (s *Server) listParts(rc *reqCtx) error {
	key := rc.t.Key
	if _, err := rc.writeAccess(key, false); err != nil {
		return err
	}
	up, err := s.Eng.GetUpload(rc.ctx, rc.b.Name, key, rc.t.Query.Get("uploadId"))
	if err != nil {
		return err
	}
	maxParts, err := parseMaxKeys(rc.t.Query, "max-parts")
	if err != nil {
		return err
	}
	marker := 0
	if v := rc.t.Query.Get("part-number-marker"); v != "" {
		marker, err = strconv.Atoi(v)
		if err != nil || marker < 0 {
			return apierr.New("InvalidArgument", "Part number marker must be a non-negative integer.")
		}
	}
	parts, err := s.Eng.DB.Read().ListParts(rc.ctx, up.UploadID, marker, maxParts+1)
	if err != nil {
		return err
	}
	out := s3xml.ListPartsResult{
		Bucket: rc.b.Name, Key: key, UploadID: up.UploadID, StorageClass: s3xml.StorageClassStandard,
		Initiator: s3xml.Owner{ID: rc.b.Name, DisplayName: rc.b.Name}, Owner: s3xml.Owner{ID: rc.b.Name, DisplayName: rc.b.Name},
		PartNumberMarker: marker, MaxParts: maxParts, ChecksumAlgorithm: up.ChecksumAlgo, ChecksumType: up.ChecksumType,
	}
	if len(parts) > maxParts {
		parts, out.IsTruncated = parts[:maxParts], true
	}
	for _, p := range parts {
		xp := s3xml.Part{PartNumber: p.Number, LastModified: s3xml.Time(p.CreatedAt), ETag: s3xml.ETagQuoted(p.ETag), Size: p.Size}
		switch p.ChecksumAlgo {
		case "CRC32":
			xp.CRC32 = p.Checksum
		case "CRC32C":
			xp.CRC32C = p.Checksum
		case "CRC64NVME":
			xp.CRC64NVME = p.Checksum
		case "SHA1":
			xp.SHA1 = p.Checksum
		case "SHA256":
			xp.SHA256 = p.Checksum
		}
		out.Parts = append(out.Parts, xp)
		out.NextPartNumberMarker = p.Number
	}
	if up.Encrypted {
		rc.w.Header().Set("x-amz-server-side-encryption", "AES256")
	}
	return s.writeXML(rc, http.StatusOK, out)
}

func (s *Server) listMultipartUploads(rc *reqCtx) error {
	q := rc.t.Query
	prefix, delimiter := q.Get("prefix"), q.Get("delimiter")
	maxUploads, err := parseMaxKeys(q, "max-uploads")
	if err != nil {
		return err
	}
	encode, err := parseEncoding(q)
	if err != nil {
		return err
	}
	if err := rc.needList(prefix); err != nil {
		return err
	}
	allow := rc.p.Grants.ListFilter()
	keyMarker, idMarker := q.Get("key-marker"), q.Get("upload-id-marker")
	out := s3xml.ListMultipartUploadsResult{
		Bucket: rc.b.Name, KeyMarker: keyMarker, UploadIDMarker: idMarker, Delimiter: delimiter, Prefix: prefix, MaxUploads: maxUploads,
	}
	// A listing that stopped on a common prefix resumes beyond everything
	// beneath it, so the page never repeats and never loops.
	jumpTo := ""
	if idMarker == "" && keyMarker != "" && isCommonPrefix(keyMarker, prefix, delimiter) {
		jumpTo = meta.PrefixUpper(keyMarker)
	}
	curKey, curID := keyMarker, idMarker
	count := 0
	const batchSize = 200
scan:
	for !out.IsTruncated {
		var batch []*meta.Upload
		if jumpTo != "" {
			batch, err = s.Eng.DB.Read().ListUploadsFrom(rc.ctx, rc.b.Name, prefix, jumpTo, batchSize)
			jumpTo = ""
		} else {
			batch, err = s.Eng.DB.Read().ListUploads(rc.ctx, rc.b.Name, prefix, curKey, curID, batchSize)
		}
		if err != nil {
			return err
		}
		if len(batch) == 0 {
			break
		}
		for _, u := range batch {
			curKey, curID = u.Key, u.UploadID
			if allow != nil && !allow(u.Key) {
				continue
			}
			if delimiter != "" {
				if i := strings.Index(u.Key[len(prefix):], delimiter); i >= 0 {
					cp := prefix + u.Key[len(prefix):][:i+len(delimiter)]
					if count == maxUploads {
						out.IsTruncated = true
						break scan
					}
					out.CommonPrefixes = append(out.CommonPrefixes, s3xml.CommonPrefix{Prefix: cp})
					count++
					out.NextKeyMarker, out.NextUploadIDMarker = cp, ""
					jumpTo = meta.PrefixUpper(cp)
					if jumpTo == "" {
						break scan
					}
					continue scan // the rest of this batch is beneath the prefix: jump past it
				}
			}
			if count == maxUploads {
				out.IsTruncated = true
				break scan
			}
			out.Uploads = append(out.Uploads, s3xml.Upload{Key: u.Key, UploadID: u.UploadID, StorageClass: s3xml.StorageClassStandard,
				Initiated: s3xml.Time(u.InitiatedAt), ChecksumAlgorithm: u.ChecksumAlgo, ChecksumType: u.ChecksumType,
				Initiator: s3xml.Owner{ID: rc.b.Name, DisplayName: rc.b.Name}, Owner: s3xml.Owner{ID: rc.b.Name, DisplayName: rc.b.Name}})
			out.NextKeyMarker, out.NextUploadIDMarker = u.Key, u.UploadID
			count++
		}
		if len(batch) < batchSize {
			break
		}
	}
	if !out.IsTruncated {
		out.NextKeyMarker, out.NextUploadIDMarker = "", ""
	}
	if encode {
		out.EncodeURL()
	}
	return s.writeXML(rc, http.StatusOK, out)
}
