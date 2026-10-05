package session

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"errors"
	"fmt"
)

// sealVersion prefixes every sealed blob so the format can change.
const sealVersion byte = 1

// ErrOpen is returned when a sealed blob cannot be opened: wrong key,
// tampered data, or a blob bound to a different session.
var ErrOpen = errors.New("session: cannot open sealed credential")

// Seal encrypts plaintext with AES-256-GCM under key. aad binds the blob to
// its row (the session id), so a stolen blob cannot be moved to another row.
// Layout: version(1) || nonce(12) || ciphertext+tag.
func Seal(key, plaintext, aad []byte) ([]byte, error) {
	gcm, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := rand.Read(nonce); err != nil {
		return nil, err
	}
	out := make([]byte, 0, 1+len(nonce)+len(plaintext)+gcm.Overhead())
	out = append(out, sealVersion)
	out = append(out, nonce...)
	return gcm.Seal(out, nonce, plaintext, aad), nil
}

// Open reverses Seal.
func Open(key, blob, aad []byte) ([]byte, error) {
	gcm, err := newGCM(key)
	if err != nil {
		return nil, err
	}
	if len(blob) < 1+gcm.NonceSize()+gcm.Overhead() || blob[0] != sealVersion {
		return nil, ErrOpen
	}
	nonce := blob[1 : 1+gcm.NonceSize()]
	pt, err := gcm.Open(nil, nonce, blob[1+gcm.NonceSize():], aad)
	if err != nil {
		return nil, ErrOpen
	}
	return pt, nil
}

func newGCM(key []byte) (cipher.AEAD, error) {
	if len(key) != 32 {
		return nil, fmt.Errorf("session: key must be 32 bytes, got %d", len(key))
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, err
	}
	return cipher.NewGCM(block)
}
