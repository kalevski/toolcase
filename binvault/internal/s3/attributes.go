package s3

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/checksum"
	"github.com/kalevski/toolcase/binvault/internal/s3xml"
)

// getObjectAttributes implements GetObjectAttributes (spec §5.4.7).
func (s *Server) getObjectAttributes(rc *reqCtx) error {
	if err := rc.need(auth.Read, rc.t.Key); err != nil {
		return err
	}
	want := map[string]bool{}
	for _, v := range rc.r.Header.Values("x-amz-object-attributes") {
		for _, a := range strings.Split(v, ",") {
			a = strings.TrimSpace(a)
			switch a {
			case "ETag", "Checksum", "ObjectParts", "StorageClass", "ObjectSize":
				want[a] = true
			case "":
			default:
				return apierr.New("InvalidArgument", "Invalid attribute name specified.").WithExtra("ArgumentName", "x-amz-object-attributes").WithExtra("ArgumentValue", a)
			}
		}
	}
	if len(want) == 0 {
		return apierr.New("InvalidArgument", "The x-amz-object-attributes header must name at least one attribute.")
	}
	o, err := s.lookupVersion(rc)
	if err != nil {
		return err
	}
	out := s3xml.GetObjectAttributesResponse{}
	if want["ETag"] {
		out.ETag = o.ETag
	}
	if want["StorageClass"] {
		out.StorageClass = s3xml.StorageClassStandard
	}
	if want["ObjectSize"] {
		n := o.Size
		out.ObjectSize = &n
	}
	if want["Checksum"] && o.ChecksumAlgo != "" {
		cs := &s3xml.ObjectChecksum{ChecksumType: o.ChecksumType}
		switch o.ChecksumAlgo {
		case string(checksum.CRC32):
			cs.CRC32 = o.Checksum
		case string(checksum.CRC32C):
			cs.CRC32C = o.Checksum
		case string(checksum.CRC64NVME):
			cs.CRC64NVME = o.Checksum
		case string(checksum.SHA1):
			cs.SHA1 = o.Checksum
		case string(checksum.SHA256):
			cs.SHA256 = o.Checksum
		}
		out.Checksum = cs
	}
	if want["ObjectParts"] && len(o.Parts) > 0 {
		maxParts := 1000
		if v := rc.r.Header.Get("x-amz-max-parts"); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil || n < 0 {
				return apierr.New("InvalidArgument", "Invalid x-amz-max-parts.")
			}
			if n < maxParts {
				maxParts = n
			}
		}
		marker := 0
		if v := rc.r.Header.Get("x-amz-part-number-marker"); v != "" {
			n, err := strconv.Atoi(v)
			if err != nil || n < 0 {
				return apierr.New("InvalidArgument", "Invalid x-amz-part-number-marker.")
			}
			marker = n
		}
		op := &s3xml.ObjectParts{TotalPartsCount: len(o.Parts), PartNumberMarker: marker, MaxParts: maxParts}
		for i, sz := range o.Parts {
			n := i + 1
			if n <= marker {
				continue
			}
			if len(op.Parts) == maxParts {
				op.IsTruncated = true
				break
			}
			op.Parts = append(op.Parts, s3xml.ObjectPart{PartNumber: n, Size: sz})
			op.NextPartNumberMarker = n
		}
		out.ObjectParts = op
	}
	h := rc.w.Header()
	h.Set("Last-Modified", s3xml.HTTPDate(o.CreatedAt))
	s.setVersionHeader(rc, o)
	return s.writeXML(rc, http.StatusOK, out)
}
