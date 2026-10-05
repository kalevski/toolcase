package sigv4

import (
	"crypto/subtle"
	"encoding/base64"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

// PostResult is a verified POST Object policy (spec §5.4.9).
type PostResult struct {
	AccessKeyID string
	// Region is the region the form was signed for (any is accepted).
	Region string
	// Policy is the decoded policy document (JSON), for the caller to parse
	// and enforce, including its expiration.
	Policy []byte
}

// VerifyPostPolicy verifies the SigV4 signature of a POST Object form: the
// policy, x-amz-credential, x-amz-date and x-amz-signature fields. The string
// signed is the base64 policy itself. The caller checks that x-amz-algorithm
// is Algorithm, parses the decoded policy and enforces its expiration and
// conditions; the policy's expiration, not the clock-skew window, bounds the
// form's life, so the only time check here is that x-amz-date is not more
// than the skew in the future (spec §4.5).
//
// Errors, in order: a missing policy is InvalidPolicyDocument; a malformed
// credential, date or signature field is AuthorizationHeaderMalformed; an
// unknown key InvalidAccessKeyId; a future date RequestTimeTooSkewed; a bad
// signature SignatureDoesNotMatch; a signed policy that is not valid base64
// InvalidPolicyDocument.
func VerifyPostPolicy(policyB64, credential, amzDate, signature string, lookup SecretLookup, opt Options) (*PostResult, error) {
	if policyB64 == "" {
		return nil, apierr.New("InvalidPolicyDocument", "Invalid Policy: the policy field is missing.")
	}
	cred, err := parseCredential(credential, formPost)
	if err != nil {
		return nil, err
	}
	t, ok := parseAmzDate(amzDate)
	if !ok {
		return nil, formPost.malformed(`x-amz-date must be in the ISO8601 Long Format "yyyyMMdd'T'HHmmss'Z'".`)
	}
	if day := t.Format(DateFormat); cred.date != day {
		return nil, formPost.malformedf("invalid credential date %q. This date is not the same as x-amz-date %q.",
			cred.date, day)
	}
	if signature == "" {
		return nil, formPost.malformed("the x-amz-signature field is missing.")
	}

	secret, ok := lookup(cred.accessKeyID)
	if !ok {
		return nil, errInvalidAccessKeyID(cred.accessKeyID)
	}
	now := opt.now()
	if t.Sub(now) > opt.skew() {
		return nil, errSkewed(amzDate, now, opt.skew())
	}

	key, cached := opt.Cache.get(cred.accessKeyID, secret, cred.date, cred.region)
	if !cached {
		key = deriveKey(secret, cred.date, cred.region)
	}
	want := hmacHex(key, policyB64)
	if subtle.ConstantTimeCompare([]byte(want), []byte(signature)) != 1 {
		return nil, apierr.New("SignatureDoesNotMatch", msgSignature).
			WithExtra("AWSAccessKeyId", cred.accessKeyID).
			WithExtra("StringToSign", policyB64).
			WithExtra("SignatureProvided", signature)
	}
	if !cached {
		opt.Cache.add(cred.accessKeyID, secret, cred.date, cred.region, key)
	}

	policy, err := base64.StdEncoding.DecodeString(policyB64)
	if err != nil {
		return nil, apierr.Wrap("InvalidPolicyDocument", "Invalid Policy: Invalid Base64 Encoding.", err)
	}
	return &PostResult{AccessKeyID: cred.accessKeyID, Region: cred.region, Policy: policy}, nil
}
