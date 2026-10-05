package sdkgo

import (
	"bytes"
	"crypto/md5"
	"crypto/rand"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"encoding/hex"
	"hash/crc32"
	"hash/crc64"
	"io"
	"net/url"
	"strconv"
	"strings"
	"testing"

	s3types "github.com/aws/aws-sdk-go-v2/service/s3/types"
)

const (
	KiB = 1024
	MiB = 1024 * KiB
)

// pattern returns n bytes where byte i is (i+seed)%251: any slice of it can be checked by offset.
func pattern(n int, seed int) []byte {
	b := make([]byte, n)
	for i := range b {
		b[i] = byte((i + seed) % 251)
	}
	return b
}

func randBytes(n int) []byte {
	b := make([]byte, n)
	_, _ = rand.Read(b)
	return b
}

func md5hex(b []byte) string {
	s := md5.Sum(b)
	return hex.EncodeToString(s[:])
}

// etagOf is the quoted single-part ETag of b.
func etagOf(b []byte) string { return `"` + md5hex(b) + `"` }

// multipartETag is the S3 composite ETag of the given parts.
func multipartETag(parts ...[]byte) string {
	var cat []byte
	for _, p := range parts {
		s := md5.Sum(p)
		cat = append(cat, s[:]...)
	}
	s := md5.Sum(cat)
	return `"` + hex.EncodeToString(s[:]) + "-" + strconv.Itoa(len(parts)) + `"`
}

var (
	crc32cTable     = crc32.MakeTable(crc32.Castagnoli)
	crc64nvmeTable  = crc64.MakeTable(0x9a6c9329ac4bc9b5) // reflected CRC-64/NVME polynomial
	allChecksumAlgs = []s3types.ChecksumAlgorithm{
		s3types.ChecksumAlgorithmCrc32, s3types.ChecksumAlgorithmCrc32c, s3types.ChecksumAlgorithmSha1,
		s3types.ChecksumAlgorithmSha256, s3types.ChecksumAlgorithmCrc64nvme,
	}
)

// checksumB64 is the base64 value S3 uses for the given algorithm over b.
func checksumB64(alg s3types.ChecksumAlgorithm, b []byte) string {
	switch alg {
	case s3types.ChecksumAlgorithmCrc32:
		var o [4]byte
		binary.BigEndian.PutUint32(o[:], crc32.ChecksumIEEE(b))
		return base64.StdEncoding.EncodeToString(o[:])
	case s3types.ChecksumAlgorithmCrc32c:
		var o [4]byte
		binary.BigEndian.PutUint32(o[:], crc32.Checksum(b, crc32cTable))
		return base64.StdEncoding.EncodeToString(o[:])
	case s3types.ChecksumAlgorithmCrc64nvme:
		var o [8]byte
		binary.BigEndian.PutUint64(o[:], crc64.Checksum(b, crc64nvmeTable))
		return base64.StdEncoding.EncodeToString(o[:])
	case s3types.ChecksumAlgorithmSha1:
		s := sha1.Sum(b)
		return base64.StdEncoding.EncodeToString(s[:])
	case s3types.ChecksumAlgorithmSha256:
		s := sha256.Sum256(b)
		return base64.StdEncoding.EncodeToString(s[:])
	}
	return ""
}

func sha256hex(b []byte) string {
	s := sha256.Sum256(b)
	return hex.EncodeToString(s[:])
}

func readAll(t testing.TB, rc io.ReadCloser) []byte {
	t.Helper()
	defer rc.Close()
	b, err := io.ReadAll(rc)
	if err != nil {
		t.Fatalf("reading body: %v", err)
	}
	return b
}

func sameBytes(t testing.TB, what string, got, want []byte) {
	t.Helper()
	if bytes.Equal(got, want) {
		return
	}
	if len(got) != len(want) {
		t.Fatalf("%s: length %d, want %d", what, len(got), len(want))
	}
	for i := range got {
		if got[i] != want[i] {
			t.Fatalf("%s: first difference at offset %d (got 0x%02x, want 0x%02x)", what, i, got[i], want[i])
		}
	}
}

// awsEscape percent-encodes everything except unreserved characters, keeping '/' (what AWS expects
// in x-amz-copy-source).
func awsEscape(s string) string {
	var b strings.Builder
	for i := 0; i < len(s); i++ {
		c := s[i]
		switch {
		case c >= 'A' && c <= 'Z', c >= 'a' && c <= 'z', c >= '0' && c <= '9', c == '-', c == '_', c == '.', c == '~', c == '/':
			b.WriteByte(c)
		default:
			b.WriteString("%" + strings.ToUpper(hex.EncodeToString([]byte{c})))
		}
	}
	return b.String()
}

func copySource(bucket, key string) string { return bucket + "/" + awsEscape(key) }

// unescapeKey decodes a key returned with EncodingType=url.
func unescapeKey(t testing.TB, s string) string {
	t.Helper()
	d, err := url.QueryUnescape(s)
	if err != nil {
		t.Fatalf("cannot decode url-encoded key %q: %v", s, err)
	}
	return d
}
