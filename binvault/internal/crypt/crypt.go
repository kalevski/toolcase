// Package crypt implements SSE-S3 encryption of object bodies (spec §3.11):
// per-blob keys derived from the bucket data key, and a chunked AES-256-GCM
// file format that supports ranged reads and detects tampering, reordering
// and truncation.
//
// # Keys
//
// Each bucket has a random 256-bit data key (NewBucketKey), stored sealed
// under the master key (package seal, §4.7). The key of one blob file is
//
//	HKDF-SHA256(secret = bucket data key, salt = blob id, info = "binvault/blob/v1")
//
// (DeriveKey); a multipart part file uses its part id as the salt (§3.11).
// Every file therefore has its own key, and that is what makes the counter
// nonces below safe: a key must encrypt exactly one file. Never run a second
// Writer, not even a retry, under the key of a blob id or part id that has
// already been used — allocate a fresh id instead.
//
// # Format
//
//	offset  size  field
//	0       4     magic "BVSE"
//	4       1     format version, 1
//	5       3     reserved, zero
//	8       4     chunk size, big-endian uint32, 65536
//	12      8     plaintext length, big-endian uint64
//	20      12    reserved, zero
//	32      ...   chunks
//
// The plaintext is cut into ChunkSize pieces. Chunk i is stored as
// AES-256-GCM ciphertext || 16-byte tag with
//
//	nonce = 0x00000000 || uint64be(i)
//	aad   = uint64be(i) || final      (final = 1 for the last chunk, else 0)
//
// The last chunk is flagged final even when it is a full ChunkSize long, and
// an empty plaintext is a single empty final chunk (a tag alone), so each
// plaintext length has exactly one encrypted length (EncryptedSize,
// PlaintextSize). Because the index is in the nonce and the final flag in the
// associated data, a chunk that is altered, moved, duplicated or dropped
// fails authentication, and so does a file cut short at a chunk boundary.
//
// The header is not authenticated, and does not need to be: Open checks every
// field against a constant or against the length derived from the file size,
// so it carries nothing an attacker could change undetected. Its plaintext
// length is written last (Writer.Close), so a file that was never finished
// does not open.
package crypt

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/hkdf"
	"crypto/rand"
	"crypto/sha256"
	"encoding/binary"
	"errors"
	"fmt"
	"math"
)

const (
	// KeySize is the length of a bucket data key and of a blob key (AES-256).
	KeySize = 32
	// ChunkSize is the plaintext length of every chunk but the last.
	ChunkSize = 64 << 10
	// HeaderSize is the length of the fixed header in front of the chunks.
	HeaderSize = 32
	// TagSize is the per-chunk overhead: one GCM tag.
	TagSize = 16
	// MaxPlaintextSize is the largest plaintext the format describes (4 EiB,
	// far above the 5 TiB object ceiling), which keeps every size computation
	// inside int64.
	MaxPlaintextSize = 1 << 62

	formatVersion = 1
	sealedChunk   = ChunkSize + TagSize
	blobInfo      = "binvault/blob/v1"

	// unfinished is the plaintext length of the placeholder header that
	// NewWriter writes; it can never match a real length.
	unfinished = math.MaxUint64
)

var magic = [4]byte{'B', 'V', 'S', 'E'}

var (
	// ErrCorrupt means an encrypted blob failed validation: a bad header, a
	// length that disagrees with the header or with the file, or a chunk that
	// fails authentication (altered, reordered, truncated — or the wrong
	// key, which is indistinguishable).
	ErrCorrupt = errors.New("crypt: encrypted blob is corrupt or truncated, or the key is wrong")
	// ErrRange means a requested byte range lies outside the plaintext.
	ErrRange = errors.New("crypt: range outside the blob")

	errKeySize = fmt.Errorf("crypt: key must be %d bytes", KeySize)
)

// NewBucketKey returns a fresh random 256-bit bucket data key (§3.11). The
// caller seals it (package seal) and commits it before the first byte is
// encrypted under it.
func NewBucketKey() ([]byte, error) {
	key := make([]byte, KeySize)
	if _, err := rand.Read(key); err != nil {
		return nil, fmt.Errorf("crypt: generating a bucket key: %w", err)
	}
	return key, nil
}

// DeriveKey returns the 32-byte key of one blob (or multipart part) file:
// HKDF-SHA256 with the bucket data key as the secret, blobID as the salt and
// "binvault/blob/v1" as the info.
//
// It returns nil when bucketKey is not KeySize bytes or blobID is empty, and
// NewWriter and Open refuse a nil key, so a missing bucket key or id fails
// closed instead of producing a key computable from public inputs, or one
// shared by many files.
func DeriveKey(bucketKey []byte, blobID string) []byte {
	if len(bucketKey) != KeySize || blobID == "" {
		return nil
	}
	key, err := hkdf.Key(sha256.New, bucketKey, []byte(blobID), blobInfo, KeySize)
	if err != nil {
		return nil
	}
	return key
}

// EncryptedSize returns the file length of a blob with plain plaintext
// bytes: HeaderSize + plain + TagSize per chunk, with at least one chunk. It
// returns -1 for a negative plain or one above MaxPlaintextSize.
func EncryptedSize(plain int64) int64 {
	if plain < 0 || plain > MaxPlaintextSize {
		return -1
	}
	return HeaderSize + plain + TagSize*chunkCount(plain)
}

// PlaintextSize is the inverse of EncryptedSize. A length that no plaintext
// encrypts to (shorter than a header and one tag, a trailing piece too short
// to hold a tag, or an empty chunk after full ones) is reported as ErrCorrupt.
func PlaintextSize(encrypted int64) (int64, error) {
	if encrypted < HeaderSize+TagSize {
		return 0, fmt.Errorf("%w: %d bytes is too short for an encrypted blob", ErrCorrupt, encrypted)
	}
	data := encrypted - HeaderSize
	full, rest := data/sealedChunk, data%sealedChunk
	var plain int64
	switch {
	case rest == 0: // the final chunk is a full one
		plain = full * ChunkSize
	case rest < TagSize, rest == TagSize && full > 0:
		return 0, fmt.Errorf("%w: %d bytes is not a valid encrypted length", ErrCorrupt, encrypted)
	default:
		plain = full*ChunkSize + rest - TagSize
	}
	if plain > MaxPlaintextSize {
		return 0, fmt.Errorf("%w: %d bytes is beyond the largest encrypted blob", ErrCorrupt, encrypted)
	}
	return plain, nil
}

// chunkCount is the number of chunks for a plaintext length: at least one.
func chunkCount(plain int64) int64 {
	if plain == 0 {
		return 1
	}
	return (plain + ChunkSize - 1) / ChunkSize
}

func newAEAD(key []byte) (cipher.AEAD, error) {
	if len(key) != KeySize {
		return nil, errKeySize
	}
	block, err := aes.NewCipher(key)
	if err != nil {
		return nil, fmt.Errorf("crypt: %w", err)
	}
	aead, err := cipher.NewGCM(block)
	if err != nil {
		return nil, fmt.Errorf("crypt: %w", err)
	}
	return aead, nil
}

func chunkNonce(i uint64) [12]byte {
	var n [12]byte
	binary.BigEndian.PutUint64(n[4:], i)
	return n
}

func chunkAAD(i uint64, final bool) [9]byte {
	var a [9]byte
	binary.BigEndian.PutUint64(a[:8], i)
	if final {
		a[8] = 1
	}
	return a
}

func encodeHeader(plainLen uint64) [HeaderSize]byte {
	var h [HeaderSize]byte
	copy(h[0:4], magic[:])
	h[4] = formatVersion
	binary.BigEndian.PutUint32(h[8:12], ChunkSize)
	binary.BigEndian.PutUint64(h[12:20], plainLen)
	return h
}

// checkHeader validates every header field; plain is the plaintext length
// derived from the file length.
func checkHeader(h *[HeaderSize]byte, plain int64) error {
	if [4]byte(h[0:4]) != magic {
		return fmt.Errorf("%w: not an encrypted blob (bad magic)", ErrCorrupt)
	}
	if h[4] != formatVersion {
		return fmt.Errorf("%w: unsupported format version %d", ErrCorrupt, h[4])
	}
	for _, b := range h[5:8] {
		if b != 0 {
			return fmt.Errorf("%w: reserved header bytes are not zero", ErrCorrupt)
		}
	}
	for _, b := range h[20:] {
		if b != 0 {
			return fmt.Errorf("%w: reserved header bytes are not zero", ErrCorrupt)
		}
	}
	if cs := binary.BigEndian.Uint32(h[8:12]); cs != ChunkSize {
		return fmt.Errorf("%w: unsupported chunk size %d", ErrCorrupt, cs)
	}
	switch got := binary.BigEndian.Uint64(h[12:20]); {
	case got == unfinished:
		return fmt.Errorf("%w: the blob was never finished (Writer.Close was not called)", ErrCorrupt)
	case got != uint64(plain):
		return fmt.Errorf("%w: header says %d plaintext bytes, the file length implies %d", ErrCorrupt, got, plain)
	}
	return nil
}
