package s3

import (
	"net/http"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/s3xml"
)

func (s *Server) listBuckets(rc *reqCtx) error {
	if err := rc.needAnyAction(); err != nil {
		return err
	}
	res := s3xml.ListAllMyBucketsResult{
		Owner:   s3xml.Owner{ID: rc.b.Name, DisplayName: rc.b.Name},
		Buckets: []s3xml.Bucket{{Name: rc.b.Name, CreationDate: s3xml.Time(rc.b.CreatedAt)}},
	}
	return s.writeXML(rc, http.StatusOK, res)
}

func (s *Server) headBucket(rc *reqCtx) error {
	if err := rc.needAnyAction(); err != nil {
		return err
	}
	rc.w.Header().Set("x-amz-bucket-region", s.Cfg.Region)
	rc.w.WriteHeader(http.StatusOK)
	return nil
}

// createBucket answers 200 for the token's own bucket and changes nothing
// (spec §5.3): tools that "ensure the bucket exists" keep working.
func (s *Server) createBucket(rc *reqCtx) error {
	if err := rc.needAnyAction(); err != nil {
		return err
	}
	rc.w.Header().Set("Location", "/"+rc.b.Name)
	rc.w.WriteHeader(http.StatusOK)
	return nil
}

// bucketSubresource serves the read-only views and stubs of spec §5.2.
func (s *Server) bucketSubresource(rc *reqCtx, stub string) error {
	if err := rc.needAnyAction(); err != nil {
		return err
	}
	b := rc.b
	switch rc.op {
	case OpGetBucketLocation:
		loc := s.Cfg.Region
		if loc == "us-east-1" {
			loc = ""
		}
		return s.writeXML(rc, http.StatusOK, s3xml.LocationConstraint{Region: loc})
	case OpGetBucketVersioning:
		var v s3xml.VersioningConfiguration
		if b.Versioning == meta.VersioningEnabled {
			v.Status = "Enabled"
		}
		return s.writeXML(rc, http.StatusOK, v)
	case OpGetBucketEncryption:
		if b.Encryption != meta.EncryptionSSES3 {
			return apierr.New("ServerSideEncryptionConfigurationNotFoundError", "The server side encryption configuration was not found.")
		}
		return s.writeXML(rc, http.StatusOK, s3xml.SSES3Config())
	case OpGetBucketAcl:
		return s.writeXML(rc, http.StatusOK, s3xml.StubACL(b.Name, b.Name))
	case OpPutBucketAcl:
		if err := s.checkACLRequest(rc); err != nil {
			return err
		}
		rc.w.WriteHeader(http.StatusOK)
		return nil
	case OpBucketStub:
		switch stub {
		case "logging":
			return s.writeXML(rc, http.StatusOK, s3xml.BucketLoggingStatus{})
		case "notification":
			return s.writeXML(rc, http.StatusOK, s3xml.NotificationConfiguration{})
		case "requestPayment":
			return s.writeXML(rc, http.StatusOK, s3xml.RequestPaymentConfiguration{Payer: "BucketOwner"})
		default: // a "not configured" error code
			return apierr.New(stub, "The requested configuration does not exist.")
		}
	case OpGetBucketLifecycle:
		return s.getLifecycle(rc)
	case OpGetBucketCors:
		return s.getCORS(rc)
	}
	return apierr.New("NotImplemented", "A header you provided implies functionality that is not implemented.")
}

var _ = strings.ToLower
