package s3

import (
	"net/http"
	"sort"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/checksum"
)

// presignOwnParams are the x-amz-* query parameters that belong to the SigV4
// query form itself (or, X-Amz-Content-Sha256, to the payload hash the
// signature covers); they are never request headers in disguise.
var presignOwnParams = map[string]bool{
	"x-amz-algorithm":      true,
	"x-amz-credential":     true,
	"x-amz-date":           true,
	"x-amz-expires":        true,
	"x-amz-signedheaders":  true,
	"x-amz-signature":      true,
	"x-amz-security-token": true,
	"x-amz-content-sha256": true,
}

// hoistQueryHeaders copies the x-amz-* parameters of a presigned URL into h, so
// the rest of the request is handled exactly like the header form (spec §5.9).
// Signers other than botocore (aws-sdk-js-v3, the Java SDK, ...) "hoist"
// x-amz-meta-*, x-amz-tagging, x-amz-server-side-encryption,
// x-amz-storage-class, x-amz-acl, x-amz-checksum-* and the like into the query,
// where the signature covers them; S3 treats them as the headers they stand
// for. It must only be called once the signature is verified: an unsigned
// request's query is not the signer's word. A header the request also carries
// wins (it is signed too). It reports whether anything was copied.
//
// One value is not taken at its word: aws-sdk-js-v3 signs every presigned
// PutObject / UploadPart URL with x-amz-checksum-crc32=AAAAAA== (and
// x-amz-sdk-checksum-algorithm=CRC32) — the checksum of the empty body it has at
// signing time. Unless the request is known to carry an empty body, a checksum
// parameter that is the checksum of zero bytes is therefore a placeholder, not
// something to verify the real body against: it only declares the algorithm,
// whose checksum of the real body is then computed and stored.
func hoistQueryHeaders(h http.Header, q Query, emptyBody bool) bool {
	names := make([]string, 0, len(q))
	for name := range q {
		ln := strings.ToLower(name)
		if strings.HasPrefix(ln, "x-amz-") && !presignOwnParams[ln] {
			names = append(names, name)
		}
	}
	sort.Strings(names) // a name given twice in different cases joins in a fixed order
	copied := false
	var placeholder checksum.Algo
	for _, name := range names {
		if h.Get(name) != "" {
			continue
		}
		if a, ok := checksum.FromHeaderName(name); ok && !emptyBody && len(q[name]) == 1 && checksum.IsEmpty(a, q[name][0]) {
			placeholder = a
			continue
		}
		for _, v := range q[name] {
			h.Add(name, v)
			copied = true
		}
	}
	if placeholder != "" && h.Get("x-amz-sdk-checksum-algorithm") == "" {
		h.Set("x-amz-sdk-checksum-algorithm", string(placeholder))
		copied = true
	}
	return copied
}

// hoistPresigned applies hoistQueryHeaders to a verified presigned request and
// re-dispatches it when the hoisted x-amz-copy-source turns the PUT into a copy
// (CopyObject / UploadPartCopy are recognised by that header).
func (rc *reqCtx) hoistPresigned() {
	r := rc.r
	if !hoistQueryHeaders(r.Header, rc.t.Query, r.ContentLength == 0 && len(r.TransferEncoding) == 0) {
		return
	}
	if r.Header.Get("x-amz-copy-source") == "" || (rc.op != OpPutObject && rc.op != OpUploadPart) {
		return
	}
	if op, _, err := Dispatch(r, rc.t); err == nil && op != rc.op {
		rc.op, rc.info.Op = op, op
	}
}
