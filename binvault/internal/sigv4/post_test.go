package sigv4

import (
	"encoding/base64"
	"strings"
	"testing"
	"time"
)

func TestPostPolicy(t *testing.T) {
	doc := `{"expiration":"2025-01-16T00:00:00Z","conditions":[{"bucket":"b"},["starts-with","$key","u/"]]}`
	policy := base64.StdEncoding.EncodeToString([]byte(doc))
	cred, date, sig := SignPostPolicy(policy, bvAKID, bvSecret, "auto", tnow)
	if cred != bvAKID+"/20250115/auto/s3/aws4_request" || date != "20250115T123456Z" || len(sig) != 64 {
		t.Fatalf("SignPostPolicy: %s %s %s", cred, date, sig)
	}

	cache := NewKeyCache(4)
	opt := at(tnow)
	opt.Cache = cache
	res, err := VerifyPostPolicy(policy, cred, date, sig, awsKeys, opt)
	wantCode(t, err, "")
	if res.AccessKeyID != bvAKID || res.Region != "auto" || string(res.Policy) != doc || cache.Len() != 1 {
		t.Fatalf("result %+v, cache %d", res, cache.Len())
	}

	tests := []struct {
		name                    string
		policy, cred, date, sig string
		now                     time.Time
		lookup                  SecretLookup
		code                    string
	}{
		{"a month later", policy, cred, date, sig, tnow.Add(30 * 24 * time.Hour), awsKeys, ""},
		{"skew early", policy, cred, date, sig, tnow.Add(-15 * time.Minute), awsKeys, ""},
		{"too early", policy, cred, date, sig, tnow.Add(-16 * time.Minute), awsKeys, "RequestTimeTooSkewed"},
		{"wrong secret", policy, cred, date, sig, tnow, keys(bvAKID, "other"), "SignatureDoesNotMatch"},
		{"unknown key", policy, cred, date, sig, tnow, keys(), "InvalidAccessKeyId"},
		{"tampered policy", base64.StdEncoding.EncodeToString([]byte(doc + " ")), cred, date, sig, tnow, awsKeys, "SignatureDoesNotMatch"},
		{"tampered signature", policy, cred, date, strings.Repeat("0", 64), tnow, awsKeys, "SignatureDoesNotMatch"},
		{"upper-case signature", policy, cred, date, strings.ToUpper(sig), tnow, awsKeys, "SignatureDoesNotMatch"},
		{"empty policy", "", cred, date, sig, tnow, noLookup(t), "InvalidPolicyDocument"},
		{"service", policy, strings.Replace(cred, "/s3/", "/s4/", 1), date, sig, tnow, noLookup(t), "AuthorizationHeaderMalformed"},
		{"terminator", policy, strings.TrimSuffix(cred, "_request"), date, sig, tnow, noLookup(t), "AuthorizationHeaderMalformed"},
		{"short credential", policy, bvAKID + "/20250115/auto", date, sig, tnow, noLookup(t), "AuthorizationHeaderMalformed"},
		{"empty region", policy, bvAKID + "/20250115//s3/aws4_request", date, sig, tnow, noLookup(t), "AuthorizationHeaderMalformed"},
		{"date format", policy, cred, "2025-01-15T12:34:56Z", sig, tnow, noLookup(t), "AuthorizationHeaderMalformed"},
		{"date mismatch", policy, cred, "20250116T123456Z", sig, tnow, noLookup(t), "AuthorizationHeaderMalformed"},
		{"no signature", policy, cred, date, "", tnow, noLookup(t), "AuthorizationHeaderMalformed"},
	}
	for _, tc := range tests {
		_, err := VerifyPostPolicy(tc.policy, tc.cred, tc.date, tc.sig, tc.lookup, at(tc.now))
		if tc.code == "" && err != nil {
			t.Fatalf("%s: %v", tc.name, err)
		}
		wantCode(t, err, tc.code)
	}

	// A signed policy that is not base64 is refused after authentication.
	bad := "not base64!"
	c, d, s := SignPostPolicy(bad, bvAKID, bvSecret, "auto", tnow)
	_, err = VerifyPostPolicy(bad, c, d, s, awsKeys, at(tnow))
	wantCode(t, err, "InvalidPolicyDocument")
	// Base64 wrapped over lines (as some libraries emit it) decodes.
	wrapped := policy[:20] + "\r\n" + policy[20:]
	c, d, s = SignPostPolicy(wrapped, bvAKID, bvSecret, "auto", tnow)
	if res, err := VerifyPostPolicy(wrapped, c, d, s, awsKeys, at(tnow)); err != nil || string(res.Policy) != doc {
		t.Fatalf("wrapped policy: %v", err)
	}
	// Failures never reach the cache.
	cache2 := NewKeyCache(4)
	opt2 := at(tnow)
	opt2.Cache = cache2
	_, err = VerifyPostPolicy(policy, cred, date, strings.Repeat("0", 64), awsKeys, opt2)
	wantCode(t, err, "SignatureDoesNotMatch")
	if cache2.Len() != 0 {
		t.Fatal("a failed signature was cached")
	}
}
