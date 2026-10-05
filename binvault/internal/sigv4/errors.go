package sigv4

import (
	"fmt"
	"strconv"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

// form is where a credential came from; it picks the S3 error code used for a
// malformed credential.
type form int

const (
	formHeader form = iota // Authorization header
	formQuery              // presigned query parameters
	formPost               // POST Object form fields
)

// malformed is the 400 for a structurally invalid credential.
func (f form) malformed(detail string) *apierr.Error {
	switch f {
	case formQuery:
		return apierr.New("AuthorizationQueryParametersError", detail)
	case formPost:
		return apierr.New("AuthorizationHeaderMalformed", "The POST policy credential is malformed; "+detail)
	default:
		return apierr.New("AuthorizationHeaderMalformed", "The authorization header is malformed; "+detail)
	}
}

func (f form) malformedf(format string, args ...any) *apierr.Error {
	return f.malformed(fmt.Sprintf(format, args...))
}

const credentialShape = `the Credential is mal-formed; expecting "<YOUR-AKID>/YYYYMMDD/REGION/SERVICE/aws4_request".`

const msgPresignParams = "Query-string authentication version 4 requires the X-Amz-Algorithm, " +
	"X-Amz-Credential, X-Amz-Signature, X-Amz-Date, X-Amz-SignedHeaders, and X-Amz-Expires parameters."

func errUnsupportedAuth() *apierr.Error {
	return apierr.New("InvalidRequest",
		"The authorization mechanism you have provided is not supported. Please use AWS4-HMAC-SHA256.")
}

func errMixedAuth() *apierr.Error {
	return apierr.New("InvalidRequest",
		"Only one auth mechanism allowed; only the X-Amz-Algorithm query parameter, Signature query "+
			"string parameter or the Authorization header should be specified")
}

func errNotSigned() *apierr.Error {
	return apierr.New("AccessDenied", "The request is not signed with AWS Signature Version 4.")
}

func errInvalidAccessKeyID(akid string) *apierr.Error {
	e := apierr.New("InvalidAccessKeyId", "The AWS Access Key Id you provided does not exist in our records.")
	if akid != "" {
		e = e.WithExtra("AWSAccessKeyId", akid)
	}
	return e
}

func errNoDate() *apierr.Error {
	return apierr.New("AccessDenied", "AWS authentication requires a valid Date or x-amz-date header")
}

func errMissingContentSHA256() *apierr.Error {
	return apierr.New("InvalidRequest", "Missing required header for this request: x-amz-content-sha256")
}

func errBadContentSHA256() *apierr.Error {
	return apierr.New("InvalidArgument",
		"x-amz-content-sha256 must be UNSIGNED-PAYLOAD, STREAMING-AWS4-HMAC-SHA256-PAYLOAD, "+
			"STREAMING-AWS4-HMAC-SHA256-PAYLOAD-TRAILER, STREAMING-UNSIGNED-PAYLOAD-TRAILER, "+
			"or a valid sha256 value.").
		WithExtra("ArgumentName", "x-amz-content-sha256")
}

// errInvalidURI is S3's answer to a path or query with a broken percent
// escape. The code is not in apierr's table, so the status is set here.
func errInvalidURI() *apierr.Error {
	return apierr.New("InvalidURI", "Couldn't parse the specified URI.").WithStatus(400)
}

func errHeadersNotSigned(names string) *apierr.Error {
	return apierr.New("AccessDenied", "There were headers present in the request which were not signed").
		WithExtra("HeadersNotSigned", names)
}

const msgSignature = "The request signature we calculated does not match the signature you provided. " +
	"Check your key and signing method."

// errSignature carries the debugging fields S3 returns, so a client author can
// compare canonical requests. They hold only what the client itself sent.
func errSignature(akid, stringToSign, provided, canonicalRequest string) *apierr.Error {
	return apierr.New("SignatureDoesNotMatch", msgSignature).
		WithExtra("AWSAccessKeyId", akid).
		WithExtra("StringToSign", stringToSign).
		WithExtra("SignatureProvided", provided).
		WithExtra("CanonicalRequest", canonicalRequest)
}

func errSkewed(requestTime string, now time.Time, skew time.Duration) *apierr.Error {
	return apierr.New("RequestTimeTooSkewed",
		"The difference between the request time and the current time is too large.").
		WithExtra("RequestTime", requestTime).
		WithExtra("ServerTime", now.UTC().Format(time.RFC3339)).
		WithExtra("MaxAllowedSkewMilliseconds", strconv.FormatInt(skew.Milliseconds(), 10))
}

func errExpired(expires int64, expiresAt, now time.Time) *apierr.Error {
	return apierr.New("AccessDenied", "Request has expired").
		WithExtra("X-Amz-Expires", strconv.FormatInt(expires, 10)).
		WithExtra("Expires", expiresAt.UTC().Format(time.RFC3339)).
		WithExtra("ServerTime", now.UTC().Format(time.RFC3339))
}

// Streaming errors (NewStreamReader).

func errStreamFraming(detail string) *apierr.Error {
	return apierr.New("IncompleteBody", "The aws-chunked request body is incomplete or malformed: "+detail)
}

func errStreamLimit(detail string) *apierr.Error {
	return apierr.New("InvalidRequest", "The aws-chunked request body exceeds a limit: "+detail)
}

func errStreamSignature(detail string) *apierr.Error {
	return apierr.New("SignatureDoesNotMatch", msgSignature+" ("+detail+")")
}
