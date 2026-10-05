package s3

import (
	"net/http"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

// Op names (the `op` metric label, spec §9.2).
const (
	OpListBuckets             = "ListBuckets"
	OpHeadBucket              = "HeadBucket"
	OpCreateBucket            = "CreateBucket"
	OpDeleteBucket            = "DeleteBucket"
	OpGetBucketLocation       = "GetBucketLocation"
	OpGetBucketVersioning     = "GetBucketVersioning"
	OpGetBucketLifecycle      = "GetBucketLifecycleConfiguration"
	OpGetBucketEncryption     = "GetBucketEncryption"
	OpGetBucketCors           = "GetBucketCors"
	OpGetBucketAcl            = "GetBucketAcl"
	OpPutBucketAcl            = "PutBucketAcl"
	OpBucketStub              = "BucketSubresource" // not-configured / default-empty stubs
	OpBucketRestricted        = "BucketRestricted"  // Put/Delete of admin-managed sub-resources
	OpListObjects             = "ListObjects"
	OpListObjectsV2           = "ListObjectsV2"
	OpListObjectVersions      = "ListObjectVersions"
	OpListMultipartUploads    = "ListMultipartUploads"
	OpDeleteObjects           = "DeleteObjects"
	OpPostObject              = "PostObject"
	OpPutObject               = "PutObject"
	OpGetObject               = "GetObject"
	OpHeadObject              = "HeadObject"
	OpDeleteObject            = "DeleteObject"
	OpCopyObject              = "CopyObject"
	OpGetObjectAttributes     = "GetObjectAttributes"
	OpGetObjectTagging        = "GetObjectTagging"
	OpPutObjectTagging        = "PutObjectTagging"
	OpDeleteObjectTagging     = "DeleteObjectTagging"
	OpGetObjectAcl            = "GetObjectAcl"
	OpPutObjectAcl            = "PutObjectAcl"
	OpCreateMultipartUpload   = "CreateMultipartUpload"
	OpUploadPart              = "UploadPart"
	OpUploadPartCopy          = "UploadPartCopy"
	OpCompleteMultipartUpload = "CompleteMultipartUpload"
	OpAbortMultipartUpload    = "AbortMultipartUpload"
	OpListParts               = "ListParts"
	OpOptions                 = "CORSPreflight"
	OpUnknown                 = "Unknown"
)

// bucket sub-resources that are admin-managed or stubbed (spec §5.2)
var (
	bucketReadStubs = map[string]string{
		"location": OpGetBucketLocation, "versioning": OpGetBucketVersioning, "lifecycle": OpGetBucketLifecycle,
		"encryption": OpGetBucketEncryption, "cors": OpGetBucketCors, "acl": OpGetBucketAcl,
	}
	// sub-resources answered "not configured" on GET and NotImplemented on PUT/DELETE
	bucketNotConfigured = map[string]string{
		"policy": "NoSuchBucketPolicy", "tagging": "NoSuchTagSet", "website": "NoSuchWebsiteConfiguration",
		"object-lock": "ObjectLockConfigurationNotFoundError", "replication": "ReplicationConfigurationNotFoundError",
		"ownershipControls": "OwnershipControlsNotFoundError", "publicAccessBlock": "NoSuchPublicAccessBlockConfiguration",
	}
	// sub-resources whose GET is a default empty document
	bucketEmptyDocs = map[string]bool{"logging": true, "notification": true, "requestPayment": true}
	// sub-resources that exist in S3 but are not implemented at all
	bucketNotImplemented = map[string]bool{
		"accelerate": true, "analytics": true, "inventory": true, "metrics": true, "intelligent-tiering": true,
		"policyStatus": true, "events": true,
	}
	// parameters that belong to ListObjects/V2/Versions and plain requests
	listParams = map[string]bool{
		"prefix": true, "delimiter": true, "max-keys": true, "encoding-type": true, "marker": true,
		"continuation-token": true, "start-after": true, "fetch-owner": true, "list-type": true,
		"x-id": true, "versions": true, "key-marker": true, "version-id-marker": true, "uploads": true,
		"upload-id-marker": true, "max-uploads": true, "delete": true, "optional-object-attributes": true,
	}
	objectNotImplemented = map[string]bool{
		"torrent": true, "retention": true, "legal-hold": true, "select": true, "restore": true, "object-lock": true,
	}
)

func isAmzParam(k string) bool {
	lk := strings.ToLower(k)
	return strings.HasPrefix(lk, "x-amz-") || strings.HasPrefix(lk, "response-")
}

// Dispatch maps a request to an operation name. A non-nil error is the S3
// error to answer (NotImplemented, MethodNotAllowed). For not-configured stubs
// the second return value is the error code to report.
func Dispatch(r *http.Request, t *Target) (op string, stub string, err error) {
	m := r.Method
	q := t.Query
	if t.Service {
		if m == http.MethodGet || m == http.MethodHead {
			return OpListBuckets, "", nil
		}
		return "", "", apierr.New("MethodNotAllowed", "The specified method is not allowed against this resource.")
	}
	if m == http.MethodOptions {
		return OpOptions, "", nil
	}
	if !t.HasKey() {
		return dispatchBucket(m, q, r)
	}
	return dispatchObject(m, q, r)
}

func dispatchBucket(m string, q Query, r *http.Request) (string, string, error) {
	// find the first sub-resource parameter
	for name := range q {
		if op, ok := bucketReadStubs[name]; ok {
			switch m {
			case http.MethodGet:
				return op, "", nil
			case http.MethodPut:
				if name == "acl" {
					return OpPutBucketAcl, "", nil
				}
				return OpBucketRestricted, "", nil
			case http.MethodDelete:
				return OpBucketRestricted, "", nil
			case http.MethodHead:
				return OpHeadBucket, "", nil
			}
		}
		if code, ok := bucketNotConfigured[name]; ok {
			if m == http.MethodGet {
				return OpBucketStub, code, nil
			}
			return "", "", apierr.New("NotImplemented", "A header you provided implies functionality that is not implemented.")
		}
		if bucketEmptyDocs[name] {
			if m == http.MethodGet {
				return OpBucketStub, name, nil
			}
			return "", "", apierr.New("NotImplemented", "A header you provided implies functionality that is not implemented.")
		}
		if bucketNotImplemented[name] {
			return "", "", apierr.New("NotImplemented", "A header you provided implies functionality that is not implemented.")
		}
	}
	switch m {
	case http.MethodHead:
		return OpHeadBucket, "", nil
	case http.MethodPut:
		return OpCreateBucket, "", nil
	case http.MethodDelete:
		return OpDeleteBucket, "", nil
	case http.MethodPost:
		if q.Has("delete") {
			return OpDeleteObjects, "", nil
		}
		ct := strings.ToLower(r.Header.Get("Content-Type"))
		if strings.HasPrefix(ct, "multipart/form-data") {
			return OpPostObject, "", nil
		}
		return "", "", apierr.New("MethodNotAllowed", "The specified method is not allowed against this resource.")
	case http.MethodGet:
		for k := range q {
			if !listParams[k] && !isAmzParam(k) {
				return "", "", apierr.New("NotImplemented", "A header you provided implies functionality that is not implemented.")
			}
		}
		switch {
		case q.Has("uploads"):
			return OpListMultipartUploads, "", nil
		case q.Has("versions"):
			return OpListObjectVersions, "", nil
		case q.Get("list-type") == "2":
			return OpListObjectsV2, "", nil
		case q.Has("list-type"):
			return "", "", apierr.New("InvalidArgument", "Invalid list-type: only 2 is supported.")
		}
		return OpListObjects, "", nil
	}
	return "", "", apierr.New("MethodNotAllowed", "The specified method is not allowed against this resource.")
}

func dispatchObject(m string, q Query, r *http.Request) (string, string, error) {
	for name := range q {
		if objectNotImplemented[name] {
			return "", "", apierr.New("NotImplemented", "A header you provided implies functionality that is not implemented.")
		}
	}
	switch m {
	case http.MethodGet:
		switch {
		case q.Has("uploadId"):
			return OpListParts, "", nil
		case q.Has("tagging"):
			return OpGetObjectTagging, "", nil
		case q.Has("acl"):
			return OpGetObjectAcl, "", nil
		case q.Has("attributes"):
			return OpGetObjectAttributes, "", nil
		}
		return OpGetObject, "", nil
	case http.MethodHead:
		return OpHeadObject, "", nil
	case http.MethodPut:
		switch {
		case q.Has("uploadId") && q.Has("partNumber"):
			if r.Header.Get("x-amz-copy-source") != "" {
				return OpUploadPartCopy, "", nil
			}
			return OpUploadPart, "", nil
		case q.Has("tagging"):
			return OpPutObjectTagging, "", nil
		case q.Has("acl"):
			return OpPutObjectAcl, "", nil
		case r.Header.Get("x-amz-copy-source") != "":
			return OpCopyObject, "", nil
		}
		return OpPutObject, "", nil
	case http.MethodDelete:
		switch {
		case q.Has("uploadId"):
			return OpAbortMultipartUpload, "", nil
		case q.Has("tagging"):
			return OpDeleteObjectTagging, "", nil
		}
		return OpDeleteObject, "", nil
	case http.MethodPost:
		switch {
		case q.Has("uploads"):
			return OpCreateMultipartUpload, "", nil
		case q.Has("uploadId"):
			return OpCompleteMultipartUpload, "", nil
		}
	}
	return "", "", apierr.New("MethodNotAllowed", "The specified method is not allowed against this resource.")
}
