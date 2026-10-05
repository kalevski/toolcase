// Package sigv4 verifies AWS Signature Version 4 in its S3 flavour, the
// credential of every signed request on binvault's S3 API (spec §4.5):
//
//   - the header form, Authorization: AWS4-HMAC-SHA256 Credential=…,
//     SignedHeaders=…, Signature=… (Verify);
//   - the presigned query form, X-Amz-Algorithm, X-Amz-Credential,
//     X-Amz-Date, X-Amz-Expires, X-Amz-SignedHeaders and X-Amz-Signature
//     (Verify, spec §5.9);
//   - aws-chunked streaming bodies: signed chunks, signed chunks with a signed
//     trailer, and unsigned chunks with a trailer (NewStreamReader, spec §5.8);
//   - POST Object policies, a SigV4 signature over the base64 policy
//     (VerifyPostPolicy, spec §5.4.9).
//
// Detect classifies a request's credentials, including binvault's Bearer
// extension for pipeline tokens (spec §4.5 item 3), which ParseBearer splits
// but does not judge. Sign, Presign, EncodeStream and SignPostPolicy produce
// the same wire formats so that other packages can build signed requests in
// their tests.
//
// S3 flavour means: the canonical URI is the path exactly as sent, decoded
// once and encoded once with no normalisation (no dot-segment removal, "//"
// kept); the payload hash is the x-amz-content-sha256 value, or
// UNSIGNED-PAYLOAD for presigned requests; and any region is accepted and used
// exactly as the client signed it (spec §4.5, §13.1). Every x-amz-* request
// header must be signed, as on S3.
//
// Secrets come from the caller through a SecretLookup. Derived signing keys
// can be kept in a bounded KeyCache, which is filled only after a signature
// has verified (spec §4.5). Every client-visible failure is an *apierr.Error
// carrying the S3 code of spec §5.11.
package sigv4
