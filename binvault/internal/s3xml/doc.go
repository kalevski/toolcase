// Package s3xml holds the S3 REST XML wire types and the codec binvault speaks
// on the data plane (spec §5). The documents follow the AWS S3 API reference so
// that stock SDKs (aws-sdk-go-v2, boto3, aws-sdk-js-v3, rclone, minio mc) parse
// them unchanged.
//
// Conventions (spec §5.1):
//
//   - Every response document is written by [Marshal]: the XML declaration
//     followed by the root element, which carries xmlns=[NS] for every root that
//     S3 namespaces. The <Error> document (§5.11, [ErrorDoc]) has no namespace.
//   - Timestamps inside XML use [TimeFormat] through the [Time] type, truncated
//     to the whole second as S3 writes them; headers use HTTP-date
//     ([HTTPDate], [ParseHTTPDate]).
//   - Request bodies are read by [Decode], which accepts documents with or
//     without the S3 namespace, bounds the body (§3.8: 2 MiB), and refuses DTDs,
//     entity declarations, processing instructions and deep nesting (§10).
//     Every failure is an *apierr.Error (MalformedXML, EntityTooLarge,
//     MissingRequestBodyError, ...).
//   - XML 1.0 cannot carry most control characters, which S3 keys may contain.
//     [Marshal] fails with an *[InvalidCharError] instead of silently replacing
//     them; listings that must carry such keys use encoding-type=url
//     ([EncodeKey] and the EncodeURL methods of the list results).
//
// Types cover the operations of the compatibility matrix (§5.2): ListBuckets
// and the bucket sub-resources answered from admin-managed settings (location,
// versioning §3.10, encryption §3.11, lifecycle §3.12 via [LifecycleXML], CORS
// §5.10 and §6.3, the ACL stub), listings (§5.4.6), ListObjectVersions (§5.4.8),
// CopyObject (§5.4.5), DeleteObjects (§5.4.4), GetObjectAttributes (§5.4.7),
// POST Object (§5.4.9), multipart uploads (§5.6) and tagging (§5.7).
package s3xml

// NS is the S3 XML namespace (spec §5.1).
const NS = "http://s3.amazonaws.com/doc/2006-03-01/"

// ContentType is the media type of every S3 XML body (spec §5.1).
const ContentType = "application/xml"

// MaxRequestBytes is the largest XML request body binvault accepts (spec §3.8).
// [Decode] uses it when given a limit of zero or less.
const MaxRequestBytes = 2 << 20

// MaxDepth is the deepest element nesting [Decode] accepts. The deepest S3
// request (a lifecycle <And> filter tag) is six levels down; anything near the
// limit is an attack, not a client.
const MaxDepth = 64

// StorageClassStandard is the only storage class binvault reports (spec §5.2).
const StorageClassStandard = "STANDARD"

// EncodingTypeURL is the encoding-type value that asks for percent-encoded
// keys in listings.
const EncodingTypeURL = "url"
