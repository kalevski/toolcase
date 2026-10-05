// Package seal protects small secrets at rest with AES-256-GCM under the
// master key (spec §4.7).
//
// SigV4 needs the raw secret, so bucket token secrets cannot be one-way
// hashed. They are sealed instead, and so are the SSE-S3 bucket data keys
// (§3.11), pipeline service.headers values and service.signing_secret. A
// sealed value is
//
//	key id (4) || nonce (12, random) || ciphertext || GCM tag (16)
//
// The key id is the first four bytes of SHA-256(master key). The associated
// data is recordType + ":" + id, so a sealed value opens only for the record
// it was sealed for: a token secret copied onto another token row, or a header
// value copied onto another pipeline, fails with ErrCorrupt. A record type
// may not contain ':' and neither part may be empty, which keeps that
// encoding unambiguous.
//
// # Rotation
//
// A Keyring holds the current master key (BINVAULT_MASTER_KEY), which seals,
// and any number of old keys (BINVAULT_MASTER_KEY_OLD), which only open. The
// key id inside a sealed value names the key that opens it, so values sealed
// before a rotation keep opening, and Reseal — the primitive behind
// `binvault rekey` — moves a value to the current key. A value whose key is not
// in the ring fails with ErrUnknownKey. Such a value must never be replaced:
// boot and `validate` fail instead and name the record (§4.7). In a cluster,
// IDs lists what a node can open, current first, for `hello` (§8.3).
//
// A Keyring is immutable and safe for concurrent use.
package seal

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

const (
	// KeySize is the length of a master key (AES-256).
	KeySize = 32
	// Overhead is what sealing adds to a plaintext: key id (4) + nonce (12)
	// + tag (16).
	Overhead = keyIDSize + nonceSize + tagSize
	// MaxPlaintext is the largest secret Seal accepts. Sealed values are
	// small secrets, never bulk data; Open treats anything longer than
	// Overhead+MaxPlaintext as corrupt without trying to decrypt it.
	MaxPlaintext = 1 << 20

	keyIDSize = 4
	nonceSize = 12
	tagSize   = 16

	// maxKeyText bounds a base64 key before decoding; base64 of 32 bytes is
	// 43 or 44 characters.
	maxKeyText = 256
)

var (
	// ErrUnknownKey means the value was sealed under a key that is not in
	// the keyring (the error text names the key id).
	ErrUnknownKey = errors.New("seal: sealed under a key that is not in the keyring")
	// ErrCorrupt means the value is malformed or fails authentication: it was
	// altered, truncated, or sealed for a different record type or id. The
	// cases are deliberately indistinguishable.
	ErrCorrupt = errors.New("seal: sealed value is corrupt or belongs to another record")

	errEmptyRing = errors.New("seal: keyring has no keys")
)

// KeyID identifies a master key: the first 4 bytes of SHA-256(key). It is
// stored in the clear in front of every sealed value and is not secret.
type KeyID [keyIDSize]byte

// String returns the key id as 8 lower-case hex characters.
func (k KeyID) String() string { return hex.EncodeToString(k[:]) }

// MarshalText encodes the key id as String does (so it travels as a JSON
// string, e.g. in the cluster `hello`).
func (k KeyID) MarshalText() ([]byte, error) { return []byte(k.String()), nil }

// UnmarshalText parses the form produced by MarshalText.
func (k *KeyID) UnmarshalText(text []byte) error {
	id, err := ParseKeyID(string(text))
	if err != nil {
		return err
	}
	*k = id
	return nil
}

// ParseKeyID parses 8 hex characters (either case) as a KeyID.
func ParseKeyID(s string) (KeyID, error) {
	var id KeyID
	if len(s) != 2*keyIDSize {
		return KeyID{}, errors.New("seal: a key id is 8 hex characters")
	}
	if _, err := hex.Decode(id[:], []byte(s)); err != nil {
		return KeyID{}, errors.New("seal: a key id is 8 hex characters")
	}
	return id, nil
}

func keyIDOf(key []byte) KeyID {
	sum := sha256.Sum256(key)
	var id KeyID
	copy(id[:], sum[:keyIDSize])
	return id
}

// Keyring seals under its current key and opens under any of its keys. Raw
// key bytes are not retained; only the expanded AES-GCM state is.
type Keyring struct {
	keys []ringKey // keys[0] is the current key
}

type ringKey struct {
	id   KeyID
	aead cipher.AEAD // random-nonce GCM: Seal prepends the nonce, Open strips it
}

// New builds a keyring from the current key and the old, decrypt-only keys.
// Every key must be exactly KeySize bytes and not all zero, and no key may
// appear twice. The slices are not retained or modified.
func New(current []byte, old ...[]byte) (*Keyring, error) {
	all := make([][]byte, 0, 1+len(old))
	all = append(all, current)
	all = append(all, old...)
	k := &Keyring{keys: make([]ringKey, 0, len(all))}
	for i, key := range all {
		if err := checkKey(key); err != nil {
			return nil, fmt.Errorf("seal: %s %w", ringKeyName(i), err)
		}
		id := keyIDOf(key)
		for j := 0; j < i; j++ {
			if subtle.ConstantTimeCompare(key, all[j]) == 1 {
				return nil, fmt.Errorf("seal: key %s is given more than once", id)
			}
			if k.keys[j].id == id {
				return nil, fmt.Errorf("seal: two different keys share key id %s", id)
			}
		}
		block, err := aes.NewCipher(key)
		if err != nil {
			return nil, fmt.Errorf("seal: %s: %w", ringKeyName(i), err)
		}
		aead, err := cipher.NewGCMWithRandomNonce(block)
		if err != nil {
			return nil, fmt.Errorf("seal: %s: %w", ringKeyName(i), err)
		}
		k.keys = append(k.keys, ringKey{id: id, aead: aead})
	}
	return k, nil
}

func ringKeyName(i int) string {
	if i == 0 {
		return "current key"
	}
	return fmt.Sprintf("old key %d", i)
}

// checkKey rejects keys of the wrong length and the all-zero key (what
// `head -c 32 /dev/zero | base64` produces), the one weak key a length check
// cannot catch. The returned text never contains key material.
func checkKey(key []byte) error {
	if len(key) != KeySize {
		return fmt.Errorf("must be %d bytes, got %d", KeySize, len(key))
	}
	var zero [KeySize]byte
	if subtle.ConstantTimeCompare(key, zero[:]) == 1 {
		return errors.New("is all zero bytes")
	}
	return nil
}

// Parse builds a keyring from configuration text (spec §2.3): masterB64 is
// BINVAULT_MASTER_KEY, the base64 of 32 random bytes; oldCSV is
// BINVAULT_MASTER_KEY_OLD, comma-separated base64 keys, possibly empty. Each
// key may use the standard or the URL-safe alphabet, with or without padding;
// surrounding whitespace (such as the newline of a _FILE secret) is ignored,
// as are empty entries in oldCSV. Error messages never contain key material.
func Parse(masterB64, oldCSV string) (*Keyring, error) {
	current, err := decodeKey(masterB64)
	if err != nil {
		return nil, fmt.Errorf("seal: master key %w", err)
	}
	defer clear(current)
	var old [][]byte
	defer func() {
		for _, key := range old {
			clear(key)
		}
	}()
	if strings.TrimSpace(oldCSV) != "" {
		for i, field := range strings.Split(oldCSV, ",") {
			if strings.TrimSpace(field) == "" {
				continue
			}
			key, err := decodeKey(field)
			if err != nil {
				// i+1 is the entry's position in the list, the number an
				// operator counts commas to find.
				return nil, fmt.Errorf("seal: old master key %d %w", i+1, err)
			}
			old = append(old, key)
		}
	}
	return New(current, old...)
}

var keyEncodings = []*base64.Encoding{
	base64.StdEncoding, base64.RawStdEncoding, base64.URLEncoding, base64.RawURLEncoding,
}

// decodeKey decodes and checks one base64 key. Errors read as a predicate
// ("is not valid base64") and never echo the input.
func decodeKey(s string) ([]byte, error) {
	s = strings.TrimSpace(s)
	switch {
	case s == "":
		return nil, errors.New("is empty")
	case len(s) > maxKeyText:
		return nil, errors.New("is too long to be base64 of 32 bytes")
	}
	for _, enc := range keyEncodings {
		key, err := enc.DecodeString(s)
		if err != nil {
			continue
		}
		if err := checkKey(key); err != nil {
			clear(key)
			if len(key) != KeySize {
				return nil, fmt.Errorf("decodes to %d bytes, want %d (base64 of 32 random bytes: openssl rand -base64 32)", len(key), KeySize)
			}
			return nil, err
		}
		return key, nil
	}
	return nil, errors.New("is not valid base64")
}

// CurrentID is the id of the key Seal uses.
func (k *Keyring) CurrentID() KeyID {
	if k == nil || len(k.keys) == 0 {
		return KeyID{}
	}
	return k.keys[0].id
}

// IDs lists the id of every key this ring can open, the current key first,
// then the old keys in the order given.
func (k *Keyring) IDs() []KeyID {
	if k == nil {
		return nil
	}
	ids := make([]KeyID, len(k.keys))
	for i, key := range k.keys {
		ids[i] = key.id
	}
	return ids
}

// Can reports whether the ring holds the key with this id.
func (k *Keyring) Can(id KeyID) bool { return k.find(id) != nil }

func (k *Keyring) find(id KeyID) cipher.AEAD {
	if k == nil {
		return nil
	}
	for _, key := range k.keys {
		if key.id == id {
			return key.aead
		}
	}
	return nil
}

// recordAAD builds the associated data recordType + ":" + id. Because the
// record type cannot contain ':', the first ':' always separates the two
// parts and distinct (recordType, id) pairs never share associated data.
func recordAAD(recordType, id string) ([]byte, error) {
	if recordType == "" || strings.IndexByte(recordType, ':') >= 0 {
		return nil, fmt.Errorf("seal: invalid record type %q (empty or contains ':')", recordType)
	}
	if id == "" {
		return nil, errors.New("seal: empty record id")
	}
	aad := make([]byte, 0, len(recordType)+1+len(id))
	aad = append(aad, recordType...)
	aad = append(aad, ':')
	aad = append(aad, id...)
	return aad, nil
}

// Seal encrypts plaintext under the current key for the record identified
// by recordType and id: keyid(4) || nonce(12, random) || ciphertext || tag(16).
// Every call draws a fresh nonce, so sealing the same secret twice gives
// different outputs. The result is a new slice; plaintext is not retained.
func (k *Keyring) Seal(recordType, id string, plaintext []byte) ([]byte, error) {
	if k == nil || len(k.keys) == 0 {
		return nil, errEmptyRing
	}
	aad, err := recordAAD(recordType, id)
	if err != nil {
		return nil, err
	}
	if len(plaintext) > MaxPlaintext {
		return nil, fmt.Errorf("seal: plaintext is %d bytes, more than %d", len(plaintext), MaxPlaintext)
	}
	cur := k.keys[0]
	out := make([]byte, keyIDSize, Overhead+len(plaintext))
	copy(out, cur.id[:])
	return cur.aead.Seal(out, nil, plaintext, aad), nil
}

// Open authenticates and decrypts a value produced by Seal for the same
// recordType and id, using the key named by its embedded key id. It returns
// ErrUnknownKey when that key is not in the ring and ErrCorrupt when the
// value is too short or too long, or fails authentication (altered bytes, or
// a different record type or id). It never returns unauthenticated bytes.
func (k *Keyring) Open(recordType, id string, sealed []byte) ([]byte, error) {
	if k == nil || len(k.keys) == 0 {
		return nil, errEmptyRing
	}
	aad, err := recordAAD(recordType, id)
	if err != nil {
		return nil, err
	}
	if len(sealed) < Overhead || len(sealed) > Overhead+MaxPlaintext {
		return nil, ErrCorrupt
	}
	kid := KeyID(sealed[:keyIDSize])
	aead := k.find(kid)
	if aead == nil {
		return nil, fmt.Errorf("%w (key id %s)", ErrUnknownKey, kid)
	}
	plaintext, err := aead.Open(make([]byte, 0, len(sealed)-Overhead), nil, sealed[keyIDSize:], aad)
	if err != nil {
		return nil, ErrCorrupt
	}
	return plaintext, nil
}

// SealedKeyID returns the id of the key that sealed a value, without
// opening it. It fails with ErrCorrupt when sealed is too short (or too long)
// to be a sealed value.
func SealedKeyID(sealed []byte) (KeyID, error) {
	if len(sealed) < Overhead || len(sealed) > Overhead+MaxPlaintext {
		return KeyID{}, ErrCorrupt
	}
	return KeyID(sealed[:keyIDSize]), nil
}

// Reseal re-seals a value under the current key, for `binvault rekey`. The
// value is always opened (authenticated) first, so a corrupt value or one
// under an unknown key is reported, never rewritten. When it is already
// sealed under the current key, Reseal returns sealed itself and
// changed=false; otherwise a fresh value and changed=true.
func (k *Keyring) Reseal(recordType, id string, sealed []byte) (out []byte, changed bool, err error) {
	plaintext, err := k.Open(recordType, id, sealed)
	if err != nil {
		return nil, false, err
	}
	defer clear(plaintext)
	if KeyID(sealed[:keyIDSize]) == k.keys[0].id {
		return sealed, false, nil
	}
	out, err = k.Seal(recordType, id, plaintext)
	if err != nil {
		return nil, false, err
	}
	return out, true, nil
}
