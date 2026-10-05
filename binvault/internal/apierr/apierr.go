// Package apierr is the one error type that crosses package boundaries on the
// S3 data plane (spec §5.11). Every package that can fail a request in a way
// the client sees returns an *Error; the s3 package renders it as S3 XML.
package apierr

import (
	"errors"
	"fmt"
	"net/http"
)

// Error is an S3-visible error: a code, a human message and an HTTP status.
type Error struct {
	Code    string // S3 error code, e.g. "NoSuchKey"
	Message string
	Status  int
	// Resource and Extra are optional XML fields (<Resource>, <Key>, ...).
	Resource string
	Extra    map[string]string
	// Header carries response headers to add (e.g. Retry-After).
	Header http.Header
	// Err is an optional underlying cause, for logs only.
	Err error
}

func (e *Error) Error() string {
	if e.Err != nil {
		return fmt.Sprintf("%s: %s: %v", e.Code, e.Message, e.Err)
	}
	return fmt.Sprintf("%s: %s", e.Code, e.Message)
}

func (e *Error) Unwrap() error { return e.Err }

// New builds an error for code; the HTTP status comes from the table below.
func New(code, message string) *Error {
	return &Error{Code: code, Message: message, Status: StatusOf(code)}
}

// Newf is New with a formatted message.
func Newf(code, format string, args ...any) *Error {
	return New(code, fmt.Sprintf(format, args...))
}

// Wrap attaches a cause (logged, never sent).
func Wrap(code, message string, cause error) *Error {
	e := New(code, message)
	e.Err = cause
	return e
}

// WithStatus overrides the status.
func (e *Error) WithStatus(s int) *Error { c := *e; c.Status = s; return &c }

// WithExtra adds an XML field.
func (e *Error) WithExtra(k, v string) *Error {
	c := *e
	c.Extra = map[string]string{}
	for kk, vv := range e.Extra {
		c.Extra[kk] = vv
	}
	c.Extra[k] = v
	return &c
}

// WithHeader adds a response header.
func (e *Error) WithHeader(k, v string) *Error {
	c := *e
	c.Header = http.Header{}
	for kk, vv := range e.Header {
		c.Header[kk] = vv
	}
	c.Header.Set(k, v)
	return &c
}

// As extracts an *Error from err.
func As(err error) (*Error, bool) {
	var e *Error
	if errors.As(err, &e) {
		return e, true
	}
	return nil, false
}

// Is reports whether err is an *Error with the given code.
func Is(err error, code string) bool {
	e, ok := As(err)
	return ok && e.Code == code
}

// StatusOf is the HTTP status for an S3 code (500 for unknown codes).
func StatusOf(code string) int {
	if s, ok := statuses[code]; ok {
		return s
	}
	return http.StatusInternalServerError
}

var statuses = map[string]int{
	// auth
	"AccessDenied":                      403,
	"InvalidAccessKeyId":                403,
	"SignatureDoesNotMatch":             403,
	"RequestTimeTooSkewed":              403,
	"AuthorizationHeaderMalformed":      400,
	"AuthorizationQueryParametersError": 400,
	"AccessControlListNotSupported":     400,
	"IncompleteSignature":               400,
	"MissingSecurityHeader":             400,
	// not found
	"NoSuchBucket":                 404,
	"NoSuchKey":                    404,
	"NoSuchUpload":                 404,
	"NoSuchVersion":                404,
	"NoSuchLifecycleConfiguration": 404,
	"ServerSideEncryptionConfigurationNotFoundError": 404,
	"NoSuchCORSConfiguration":                        404,
	"NoSuchBucketPolicy":                             404,
	"NoSuchTagSet":                                   404,
	"NoSuchWebsiteConfiguration":                     404,
	"ObjectLockConfigurationNotFoundError":           404,
	"ReplicationConfigurationNotFoundError":          404,
	"OwnershipControlsNotFoundError":                 404,
	"NoSuchPublicAccessBlockConfiguration":           404,
	// validation
	"InvalidBucketName":                 400,
	"InvalidArgument":                   400,
	"InvalidRequest":                    400,
	"InvalidTag":                        400,
	"InvalidStorageClass":               400,
	"InvalidDigest":                     400,
	"KeyTooLongError":                   400,
	"MetadataTooLarge":                  400,
	"MalformedXML":                      400,
	"MalformedPOSTRequest":              400,
	"InvalidPolicyDocument":             400,
	"UnexpectedContent":                 400,
	"MissingRequestBodyError":           400,
	"InvalidLocationConstraint":         400,
	"InvalidURI":                        400,
	"BadRequest":                        400,
	"MaxPostPreDataLengthExceededError": 400,
	// integrity / size
	"BadDigest":                 400,
	"XAmzContentSHA256Mismatch": 400,
	"IncompleteBody":            400,
	"MalformedTrailerError":     400,
	"EntityTooLarge":            400,
	"EntityTooSmall":            400,
	"InvalidPart":               400,
	"InvalidPartOrder":          400,
	"InvalidPartNumber":         416,
	"RequestTimeout":            400,
	"MissingContentLength":      411,
	"InvalidRange":              416,
	// conditions
	"PreconditionFailed":         412,
	"ConditionalRequestConflict": 409,
	"MethodNotAllowed":           405,
	"NotImplemented":             501,
	"BucketNotEmpty":             409,
	// server
	"SlowDown":           503,
	"ServiceUnavailable": 503,
	"InternalError":      500,
	// binvault specific
	"PipelineRejected":      422,
	"PipelineFailed":        502,
	"PipelineTimeout":       504,
	"QuotaExceeded":         403,
	"StorageFull":           507,
	"ContentTypeNotAllowed": 415,
}
