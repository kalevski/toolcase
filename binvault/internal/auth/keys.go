package auth

import (
	"crypto/rand"
	"math/big"
)

// Prefixes of access key ids: bucket tokens and pipeline tokens (spec §4.3, §7.8).
const (
	BucketKeyPrefix   = "BVK"
	PipelineKeyPrefix = "BVP"
)

const b32 = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567"
const alnum = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"

func randChars(alphabet string, n int) string {
	out := make([]byte, n)
	max := big.NewInt(int64(len(alphabet)))
	for i := range out {
		v, err := rand.Int(rand.Reader, max)
		if err != nil {
			panic("auth: no randomness: " + err.Error())
		}
		out[i] = alphabet[v.Int64()]
	}
	return string(out)
}

// NewAccessKeyID returns prefix + 17 characters from A-Z2-7 (20 in total, so
// SDKs that validate the key length are satisfied; spec §4.3).
func NewAccessKeyID(prefix string) string { return prefix + randChars(b32, 17) }

// NewSecret returns a 40-character random alphanumeric secret access key.
func NewSecret() string { return randChars(alnum, 40) }

// ValidAccessKeyID reports whether s has the shape of a bucket or pipeline key.
func ValidAccessKeyID(s string) bool {
	if len(s) != 20 || (s[:3] != BucketKeyPrefix && s[:3] != PipelineKeyPrefix) {
		return false
	}
	for i := 3; i < 20; i++ {
		if !('A' <= s[i] && s[i] <= 'Z' || '2' <= s[i] && s[i] <= '7') {
			return false
		}
	}
	return true
}

// IsPipelineKey reports whether the access key id belongs to a pipeline token.
func IsPipelineKey(s string) bool { return len(s) >= 3 && s[:3] == PipelineKeyPrefix }
