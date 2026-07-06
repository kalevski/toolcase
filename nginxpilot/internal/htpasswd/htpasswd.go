// Package htpasswd implements the Apache apr1 (MD5-crypt variant) password
// hash — the one scheme nginx's auth_basic accepts on every platform (bcrypt
// support depends on the system crypt(3); apr1 is built into nginx itself).
// Used by the admin access-list API to hash plaintext passwords server-side so
// neither fragments nor the API ever store or echo plaintext.
package htpasswd

import (
	"crypto/md5"
	"crypto/rand"
	"fmt"
	"strings"
)

// saltAlphabet is the traditional crypt(3) salt charset.
const saltAlphabet = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// itoa64 is the base-64 variant crypt(3) uses for hash encoding (NOT RFC 4648).
const itoa64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz"

// NewSalt returns a fresh 8-character apr1 salt.
func NewSalt() (string, error) {
	raw := make([]byte, 8)
	if _, err := rand.Read(raw); err != nil {
		return "", fmt.Errorf("salt: %w", err)
	}
	var b strings.Builder
	for _, c := range raw {
		b.WriteByte(saltAlphabet[int(c)%len(saltAlphabet)])
	}
	return b.String(), nil
}

// Hash hashes password with a fresh random salt, returning the full
// "$apr1$<salt>$<hash>" htpasswd field.
func Hash(password string) (string, error) {
	salt, err := NewSalt()
	if err != nil {
		return "", err
	}
	return HashWithSalt(password, salt), nil
}

// HashWithSalt implements the apr1 algorithm (Apache's md5crypt variant with
// the "$apr1$" magic) for a caller-supplied salt — deterministic, so the test
// vectors can pin it against `openssl passwd -apr1`.
func HashWithSalt(password, salt string) string {
	if len(salt) > 8 {
		salt = salt[:8]
	}

	// Initial digest: password + magic + salt, then a peculiar mixing schedule
	// faithful to the original apr_md5_encode.
	h := md5.New()
	h.Write([]byte(password))
	h.Write([]byte("$apr1$"))
	h.Write([]byte(salt))

	alt := md5.Sum([]byte(password + salt + password))
	for i := len(password); i > 0; i -= 16 {
		if i > 16 {
			h.Write(alt[:])
		} else {
			h.Write(alt[:i])
		}
	}
	for i := len(password); i != 0; i >>= 1 {
		if i&1 != 0 {
			h.Write([]byte{0})
		} else {
			h.Write([]byte(password[:1]))
		}
	}
	final := h.Sum(nil)

	// 1000 stretching rounds.
	for i := 0; i < 1000; i++ {
		r := md5.New()
		if i&1 != 0 {
			r.Write([]byte(password))
		} else {
			r.Write(final)
		}
		if i%3 != 0 {
			r.Write([]byte(salt))
		}
		if i%7 != 0 {
			r.Write([]byte(password))
		}
		if i&1 != 0 {
			r.Write(final)
		} else {
			r.Write([]byte(password))
		}
		final = r.Sum(nil)
	}

	// crypt(3) base-64 of the permuted digest.
	var out strings.Builder
	to64 := func(v uint, n int) {
		for ; n > 0; n-- {
			out.WriteByte(itoa64[v&0x3f])
			v >>= 6
		}
	}
	to64(uint(final[0])<<16|uint(final[6])<<8|uint(final[12]), 4)
	to64(uint(final[1])<<16|uint(final[7])<<8|uint(final[13]), 4)
	to64(uint(final[2])<<16|uint(final[8])<<8|uint(final[14]), 4)
	to64(uint(final[3])<<16|uint(final[9])<<8|uint(final[15]), 4)
	to64(uint(final[4])<<16|uint(final[10])<<8|uint(final[5]), 4)
	to64(uint(final[11]), 2)

	return "$apr1$" + salt + "$" + out.String()
}
