// Package checksum implements the additional S3 checksums of binvault spec
// §5.8 — CRC32, CRC32C, CRC64NVME, SHA1 and SHA256 — supplied as an
// x-amz-checksum-<algo> header or trailer, verified against the received
// bytes, stored with the version (§3.3) and returned on GET/HEAD with
// x-amz-checksum-mode: ENABLED.
//
// For multipart uploads (§5.6) it builds both object-level forms: COMPOSITE,
// the checksum of the concatenated part checksums with a "-<N>" suffix
// (Composite), and FULL_OBJECT, the CRC of the whole object computed from the
// part CRCs without re-reading any data (Combine).
//
// Every sum is the algorithm's big-endian digest; on the wire it is standard,
// padded base64 (Encode, Decode).
package checksum

import (
	"bytes"
	"crypto/sha1"
	"crypto/sha256"
	"encoding/base64"
	"encoding/binary"
	"errors"
	"fmt"
	"hash"
	"hash/crc32"
	"net/http"
	"strconv"
	"strings"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

// Algo is an additional checksum algorithm, named as S3 names it in
// x-amz-sdk-checksum-algorithm and x-amz-checksum-algorithm.
type Algo string

// The supported algorithms.
const (
	CRC32     Algo = "CRC32"
	CRC32C    Algo = "CRC32C"
	CRC64NVME Algo = "CRC64NVME"
	SHA1      Algo = "SHA1"
	SHA256    Algo = "SHA256"
)

var algos = [...]Algo{CRC32, CRC32C, CRC64NVME, SHA1, SHA256}

// ParseAlgo returns the algorithm named s, case-insensitively.
func ParseAlgo(s string) (Algo, bool) {
	for _, a := range algos {
		if strings.EqualFold(s, string(a)) {
			return a, true
		}
	}
	return "", false
}

// HeaderName returns the header (or trailer) that carries a's value, in lower
// case: "x-amz-checksum-crc32", "x-amz-checksum-crc32c",
// "x-amz-checksum-crc64nvme", "x-amz-checksum-sha1" or
// "x-amz-checksum-sha256". It is "" for an unknown Algo.
func (a Algo) HeaderName() string {
	switch a {
	case CRC32:
		return "x-amz-checksum-crc32"
	case CRC32C:
		return "x-amz-checksum-crc32c"
	case CRC64NVME:
		return "x-amz-checksum-crc64nvme"
	case SHA1:
		return "x-amz-checksum-sha1"
	case SHA256:
		return "x-amz-checksum-sha256"
	}
	return ""
}

// FromHeaderName returns the algorithm whose value header is name
// (case-insensitive), for example a name listed in x-amz-trailer.
// x-amz-checksum-type, -mode and -algorithm are not value headers.
func FromHeaderName(name string) (Algo, bool) {
	const prefix = "x-amz-checksum-"
	if len(name) <= len(prefix) || !strings.EqualFold(name[:len(prefix)], prefix) {
		return "", false
	}
	for _, a := range algos {
		if strings.EqualFold(name[len(prefix):], string(a)) {
			return a, true
		}
	}
	return "", false
}

// IsEmpty reports whether value (the wire form of a's checksum) is the checksum
// of zero bytes: "AAAAAA==" for CRC32 and CRC32C, for example. It is false for a
// value that is not valid base64 of a's digest size.
func IsEmpty(a Algo, value string) bool {
	raw, err := Decode(strings.TrimSpace(value))
	if err != nil || a.Size() == 0 || len(raw) != a.Size() {
		return false
	}
	return bytes.Equal(raw, a.New().Sum(nil))
}

// UnsupportedHeaderName reports whether name looks like the value header of a
// checksum algorithm binvault does not implement (x-amz-checksum-sha512, -md5,
// -xxhash64 ... of newer S3, or any other x-amz-checksum-<x>): accepting it and
// storing the body unverified would be a silent integrity gap, so callers refuse
// the request (Unsupported). x-amz-checksum-type, -mode and -algorithm are not
// value headers, and the supported algorithms are not unsupported.
func UnsupportedHeaderName(name string) bool {
	const prefix = "x-amz-checksum-"
	if len(name) <= len(prefix) || !strings.EqualFold(name[:len(prefix)], prefix) {
		return false
	}
	switch strings.ToLower(name[len(prefix):]) {
	case "type", "mode", "algorithm":
		return false
	}
	_, ok := FromHeaderName(name)
	return !ok
}

// Unsupported is the InvalidRequest (400) answer for a checksum header, trailer
// or algorithm name that binvault does not implement; what is quoted in the
// message (clipped).
func Unsupported(what string) *apierr.Error {
	if len(what) > 64 {
		what = what[:64] + "..."
	}
	return apierr.New("InvalidRequest", "The checksum algorithm "+strconv.Quote(what)+
		" is not supported; use one of CRC32, CRC32C, CRC64NVME, SHA1 or SHA256.")
}

var castagnoli = crc32.MakeTable(crc32.Castagnoli)

// New returns a hash computing a. Its Sum appends the big-endian digest; the
// CRCs also implement hash.Hash32 or hash.Hash64. New panics for an unknown
// Algo; validate input with ParseAlgo.
func (a Algo) New() hash.Hash {
	switch a {
	case CRC32:
		return crc32.NewIEEE()
	case CRC32C:
		return crc32.New(castagnoli)
	case CRC64NVME:
		return new(crc64nvme)
	case SHA1:
		return sha1.New()
	case SHA256:
		return sha256.New()
	}
	panic("checksum: unknown algorithm " + strconv.Quote(string(a)))
}

// Size returns the length of a's digest in bytes: 4, 4, 8, 20 or 32; 0 for an
// unknown Algo.
func (a Algo) Size() int {
	switch a {
	case CRC32, CRC32C:
		return 4
	case CRC64NVME:
		return 8
	case SHA1:
		return sha1.Size
	case SHA256:
		return sha256.Size
	}
	return 0
}

// Encode returns sum in the wire form: standard, padded base64.
func Encode(sum []byte) string { return base64.StdEncoding.EncodeToString(sum) }

// Decode parses the wire form of a sum.
func Decode(s string) ([]byte, error) { return base64.StdEncoding.DecodeString(s) }

// FromHeader finds the single x-amz-checksum-<algo> value in h (request
// headers, or the trailer of an aws-chunked body), matching names
// case-insensitively; x-amz-checksum-type, -mode and -algorithm are ignored.
// It returns the algorithm and the value re-encoded canonically (so it
// compares equal to Encode of a computed sum), or found == false if there is
// none. The errors are client-visible *apierr.Error values, InvalidRequest
// (400): more than one checksum value, a value that is not base64 of the
// algorithm's digest size, or the value header of an algorithm that is not
// implemented (UnsupportedHeaderName). On error the other results are zero.
func FromHeader(h http.Header) (algo Algo, value string, found bool, err error) {
	n := 0
	for k, vs := range h {
		a, ok := FromHeaderName(k)
		if !ok {
			if UnsupportedHeaderName(k) {
				return "", "", false, Unsupported(k)
			}
			continue
		}
		for _, v := range vs {
			algo, value = a, v
			n++
		}
	}
	switch {
	case n == 0:
		return "", "", false, nil
	case n > 1:
		return "", "", false, apierr.New("InvalidRequest",
			"Expecting a single x-amz-checksum- header. Multiple checksum Types are not allowed.")
	}
	sum, derr := Decode(strings.TrimSpace(value))
	if derr != nil || len(sum) != algo.Size() {
		return "", "", false, apierr.Wrap("InvalidRequest",
			"Value for "+algo.HeaderName()+" header is invalid.", derr)
	}
	return algo, Encode(sum), true, nil
}

// Composite returns the COMPOSITE checksum of a multipart object (§5.6):
// base64 of a's hash over the concatenated binary part sums, then "-" and the
// number of parts. It exists for CRC32, CRC32C, SHA1 and SHA256 (CRC64NVME
// is full-object only). Errors report misuse, not client input.
func Composite(a Algo, partSums [][]byte) (string, error) {
	switch a {
	case CRC32, CRC32C, SHA1, SHA256:
	default:
		return "", fmt.Errorf("checksum: %q has no composite form", a)
	}
	if len(partSums) == 0 {
		return "", errors.New("checksum: composite of zero parts")
	}
	h := a.New()
	for i, s := range partSums {
		if len(s) != a.Size() {
			return "", fmt.Errorf("checksum: part %d: %d-byte %s sum, want %d", i+1, len(s), a, a.Size())
		}
		h.Write(s)
	}
	return Encode(h.Sum(nil)) + "-" + strconv.Itoa(len(partSums)), nil
}

// Combine returns the CRC of the concatenation of two blocks from their CRCs
// — sum1 of the first, sum2 of the second, which is len2 bytes long — without
// the data: zlib's crc32_combine, generalised to CRC32, CRC32C and CRC64NVME.
// Folding it over the parts gives the FULL_OBJECT checksum of a multipart
// object (§5.6). Sums are big-endian. Errors report misuse, not client input.
func Combine(a Algo, sum1, sum2 []byte, len2 int64) ([]byte, error) {
	var c *crcPoly
	switch a {
	case CRC32:
		c = crc32IEEEPoly
	case CRC32C:
		c = crc32CPoly
	case CRC64NVME:
		c = crc64NVMEPoly
	default:
		return nil, fmt.Errorf("checksum: %q sums cannot be combined", a)
	}
	if len(sum1) != a.Size() || len(sum2) != a.Size() {
		return nil, fmt.Errorf("checksum: combining %d- and %d-byte %s sums, want %d", len(sum1), len(sum2), a, a.Size())
	}
	if len2 < 0 {
		return nil, fmt.Errorf("checksum: negative length %d", len2)
	}
	return c.store(c.combine(c.load(sum1), c.load(sum2), uint64(len2))), nil
}

// crcPoly is GF(2) polynomial arithmetic modulo a reflected CRC polynomial.
// A value of width w holds the coefficient of x^i in bit w-1-i, as the CRC
// register does.
//
// For a CRC whose initial value equals its final xor (all three here), with
// S_n(c) = c * x^(8n) mod P:
//
//	crc(A || B) = S_len(B)(crc(A)) xor crc(B)
type crcPoly struct {
	width uint       // 32 or 64
	poly  uint64     // reflected polynomial, without the x^width term
	x8pow [64]uint64 // x8pow[k] = x^(8 * 2^k) mod P
}

var (
	crc32IEEEPoly = newCRCPoly(32, crc32.IEEE)
	crc32CPoly    = newCRCPoly(32, crc32.Castagnoli)
	crc64NVMEPoly = newCRCPoly(64, crc64NVMEReflected)
)

func newCRCPoly(width uint, poly uint64) *crcPoly {
	c := &crcPoly{width: width, poly: poly}
	p := c.one() >> 8 // x^8
	for k := range c.x8pow {
		c.x8pow[k] = p
		p = c.mulmod(p, p)
	}
	return c
}

// one is the polynomial 1 (x^0).
func (c *crcPoly) one() uint64 { return 1 << (c.width - 1) }

// mulmod returns a*b mod P.
func (c *crcPoly) mulmod(a, b uint64) uint64 {
	var p uint64
	for m := c.one(); m != 0; m >>= 1 { // m walks x^0, x^1, ..., x^(w-1)
		if a&m != 0 {
			p ^= b
		}
		// b *= x
		if b&1 != 0 {
			b = b>>1 ^ c.poly
		} else {
			b >>= 1
		}
	}
	return p
}

// combine returns S_n(crc1) xor crc2: n is the second block's byte length.
func (c *crcPoly) combine(crc1, crc2, n uint64) uint64 {
	shift := c.one() // x^(8n), by square-and-multiply over the bits of n
	for k := 0; n != 0; k, n = k+1, n>>1 {
		if n&1 != 0 {
			shift = c.mulmod(c.x8pow[k], shift)
		}
	}
	return c.mulmod(shift, crc1) ^ crc2
}

func (c *crcPoly) load(b []byte) uint64 {
	if c.width == 32 {
		return uint64(binary.BigEndian.Uint32(b))
	}
	return binary.BigEndian.Uint64(b)
}

func (c *crcPoly) store(v uint64) []byte {
	if c.width == 32 {
		return binary.BigEndian.AppendUint32(nil, uint32(v))
	}
	return binary.BigEndian.AppendUint64(nil, v)
}

// crc64NVMEReflected is the CRC-64/NVME polynomial 0xad93d23594c93659,
// bit-reflected. Initial value and final xor are all ones, as in hash/crc64,
// which computes the same CRC with crc64.MakeTable(crc64NVMEReflected) but
// rebuilds a 16 KiB slicing table on every large write for a polynomial other
// than ISO and ECMA; this one is built once.
const crc64NVMEReflected = 0x9a6c9329ac4bc9b5

var crc64NVMETable = makeSlicing8(crc64NVMEReflected)

func makeSlicing8(poly uint64) *[8][256]uint64 {
	t := new([8][256]uint64)
	for i := range 256 {
		crc := uint64(i)
		for range 8 {
			if crc&1 != 0 {
				crc = crc>>1 ^ poly
			} else {
				crc >>= 1
			}
		}
		t[0][i] = crc
	}
	for i := range 256 {
		crc := t[0][i]
		for j := 1; j < 8; j++ {
			crc = t[0][crc&0xff] ^ crc>>8
			t[j][i] = crc
		}
	}
	return t
}

func updateCRC64NVME(crc uint64, p []byte) uint64 {
	t := crc64NVMETable
	crc = ^crc
	for len(p) >= 8 {
		crc ^= binary.LittleEndian.Uint64(p)
		crc = t[7][crc&0xff] ^ t[6][crc>>8&0xff] ^ t[5][crc>>16&0xff] ^ t[4][crc>>24&0xff] ^
			t[3][crc>>32&0xff] ^ t[2][crc>>40&0xff] ^ t[1][crc>>48&0xff] ^ t[0][crc>>56]
		p = p[8:]
	}
	for _, v := range p {
		crc = t[0][byte(crc)^v] ^ crc>>8
	}
	return ^crc
}

// crc64nvme is a hash.Hash64 for CRC-64/NVME.
type crc64nvme struct{ crc uint64 }

func (d *crc64nvme) Write(p []byte) (int, error) {
	d.crc = updateCRC64NVME(d.crc, p)
	return len(p), nil
}

func (d *crc64nvme) Sum(b []byte) []byte { return binary.BigEndian.AppendUint64(b, d.crc) }
func (d *crc64nvme) Sum64() uint64       { return d.crc }
func (d *crc64nvme) Reset()              { d.crc = 0 }
func (d *crc64nvme) Size() int           { return 8 }
func (d *crc64nvme) BlockSize() int      { return 1 }
