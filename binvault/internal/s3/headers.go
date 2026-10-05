package s3

import (
	"encoding/base64"
	"net/http"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/engine"
)

// WriteHeaders is what a write request stores about the object.
type WriteHeaders struct {
	Headers  engine.Headers
	Metadata map[string]string
	Tags     map[string]string
	SSE      bool // x-amz-server-side-encryption: AES256
}

// ParseWriteHeaders extracts stored content headers, user metadata, tags and
// the encryption request from a PutObject / CreateMultipartUpload /
// CopyObject (REPLACE) request, rejecting headers that imply behaviour binvault
// does not provide (spec §5.1).
func ParseWriteHeaders(h http.Header) (*WriteHeaders, error) {
	if err := rejectUnsupported(h); err != nil {
		return nil, err
	}
	w := &WriteHeaders{
		Headers: engine.Headers{
			ContentType:        h.Get("Content-Type"),
			ContentEncoding:    stripAWSChunked(h.Values("Content-Encoding")),
			ContentLanguage:    h.Get("Content-Language"),
			ContentDisposition: h.Get("Content-Disposition"),
			CacheControl:       h.Get("Cache-Control"),
			Expires:            h.Get("Expires"),
		},
		Metadata: UserMetadata(h),
	}
	if t := h.Get("x-amz-tagging"); t != "" {
		tags, err := engine.ParseTagging(t)
		if err != nil {
			return nil, err
		}
		w.Tags = tags
	}
	sse, err := ParseSSE(h)
	if err != nil {
		return nil, err
	}
	w.SSE = sse
	return w, nil
}

// UserMetadata collects x-amz-meta-* headers, names lower-cased.
func UserMetadata(h http.Header) map[string]string {
	var md map[string]string
	for k, vs := range h {
		lk := strings.ToLower(k)
		if !strings.HasPrefix(lk, "x-amz-meta-") {
			continue
		}
		if md == nil {
			md = map[string]string{}
		}
		md[lk[len("x-amz-meta-"):]] = strings.Join(vs, ",")
	}
	return md
}

// stripAWSChunked removes the aws-chunked content coding SDKs add (spec §5.8).
func stripAWSChunked(values []string) string {
	var keep []string
	for _, v := range values {
		for _, part := range strings.Split(v, ",") {
			p := strings.TrimSpace(part)
			if p == "" || strings.EqualFold(p, "aws-chunked") {
				continue
			}
			keep = append(keep, p)
		}
	}
	return strings.Join(keep, ", ")
}

// ParseSSE reads x-amz-server-side-encryption: AES256 asks for SSE-S3; KMS and
// customer keys are NotImplemented (spec §3.11).
func ParseSSE(h http.Header) (bool, error) {
	for k := range h {
		lk := strings.ToLower(k)
		if strings.HasPrefix(lk, "x-amz-server-side-encryption-customer-") ||
			strings.HasPrefix(lk, "x-amz-copy-source-server-side-encryption-customer-") ||
			lk == "x-amz-server-side-encryption-aws-kms-key-id" ||
			lk == "x-amz-server-side-encryption-context" ||
			lk == "x-amz-server-side-encryption-bucket-key-enabled" && strings.EqualFold(h.Get(k), "true") {
			return false, notImplemented("Server-side encryption with KMS or customer keys is not supported.")
		}
	}
	switch v := h.Get("x-amz-server-side-encryption"); v {
	case "":
		return false, nil
	case "AES256":
		return true, nil
	default:
		return false, notImplemented("Only server-side encryption AES256 is supported.")
	}
}

func notImplemented(msg string) *apierr.Error { return apierr.New("NotImplemented", msg) }

// rejectUnsupported refuses recognised x-amz-* headers whose behaviour is not
// provided, instead of silently ignoring them.
func rejectUnsupported(h http.Header) error {
	for k := range h {
		lk := strings.ToLower(k)
		switch {
		case strings.HasPrefix(lk, "x-amz-object-lock-"):
			return notImplemented("Object Lock is not supported.")
		case lk == "x-amz-website-redirect-location":
			return notImplemented("Website redirects are not supported.")
		case strings.HasPrefix(lk, "x-amz-grant-"):
			return apierr.New("AccessControlListNotSupported", "The bucket does not allow ACLs.")
		}
	}
	if acl := h.Get("x-amz-acl"); acl != "" && acl != "private" && acl != "bucket-owner-full-control" {
		return apierr.New("AccessControlListNotSupported", "The bucket does not allow ACLs.")
	}
	switch sc := h.Get("x-amz-storage-class"); sc {
	case "", "STANDARD", "REDUCED_REDUNDANCY":
	default:
		return apierr.New("InvalidStorageClass", "The storage class you specified is not valid.")
	}
	return nil
}

// ParseContentMD5 decodes a Content-MD5 header (base64 of 16 bytes).
func ParseContentMD5(v string) ([]byte, error) {
	if v == "" {
		return nil, nil
	}
	b, err := base64.StdEncoding.DecodeString(v)
	if err != nil || len(b) != 16 {
		return nil, apierr.New("InvalidDigest", "The Content-MD5 you specified was invalid.")
	}
	return b, nil
}

// IfMatchValue returns the If-Match / If-None-Match preconditions of a write.
func WritePreconditions(h http.Header) (ifNoneMatchStar bool, ifMatch string, err error) {
	if v := strings.TrimSpace(h.Get("If-None-Match")); v != "" {
		if v != "*" {
			return false, "", notImplemented("Only If-None-Match: * is supported on writes.")
		}
		ifNoneMatchStar = true
	}
	return ifNoneMatchStar, strings.TrimSpace(h.Get("If-Match")), nil
}
