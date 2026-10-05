package checksum

import (
	"bytes"
	"encoding/hex"
	"hash"
	"hash/crc32"
	"hash/crc64"
	"math/bits"
	"math/rand/v2"
	"net/http"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
)

func sum(a Algo, data []byte) []byte {
	h := a.New()
	h.Write(data)
	return h.Sum(nil)
}

func TestKnownVectors(t *testing.T) {
	tests := []struct {
		algo   Algo
		hex    string
		base64 string
	}{
		{CRC32, "cbf43926", "y/Q5Jg=="},
		{CRC32C, "e3069283", "4waSgw=="},
		{CRC64NVME, "ae8b14860a799888", "rosUhgp5mIg="},
		{SHA1, "f7c3bc1d808e04732adf679965ccc34ca7ae3441", "98O8HYCOBHMq32eZZczDTKeuNEE="},
		{SHA256, "15e2b0d3c33891ebb0f1ef609ec419420c20e320ce94c65fbc8c3312448eb225", "FeKw08M4keuw8e9gnsQZQgwg4yDOlMZfvIwzEkSOsiU="},
	}
	for _, tc := range tests {
		got := sum(tc.algo, []byte("123456789"))
		if hex.EncodeToString(got) != tc.hex {
			t.Errorf("%s(123456789) = %x, want %s", tc.algo, got, tc.hex)
		}
		if Encode(got) != tc.base64 {
			t.Errorf("Encode(%s) = %s, want %s", tc.algo, Encode(got), tc.base64)
		}
		if len(got) != tc.algo.Size() || tc.algo.New().Size() != tc.algo.Size() {
			t.Errorf("%s: digest %d bytes, Size() %d", tc.algo, len(got), tc.algo.Size())
		}
		if dec, err := Decode(tc.base64); err != nil || !bytes.Equal(dec, got) {
			t.Errorf("Decode(%s) = %x, %v", tc.base64, dec, err)
		}
	}
	// The CRCs of nothing are zero (initial value == final xor).
	for _, a := range []Algo{CRC32, CRC32C, CRC64NVME} {
		if s := sum(a, nil); !bytes.Equal(s, make([]byte, a.Size())) {
			t.Errorf("%s(empty) = %x", a, s)
		}
	}
}

func TestCRC64NVMEMatchesStdlib(t *testing.T) {
	if got := bits.Reverse64(crc64NVMEReflected); got != 0xad93d23594c93659 {
		t.Fatalf("reflected polynomial reverses to %#x", got)
	}
	tab := crc64.MakeTable(crc64NVMEReflected)
	rng := rand.New(rand.NewPCG(1, 2))
	for _, n := range []int{0, 1, 7, 8, 9, 63, 64, 2047, 2048, 4099, 100000} {
		data := make([]byte, n)
		for i := range data {
			data[i] = byte(rng.Uint32())
		}
		want := crc64.Checksum(data, tab)
		h := CRC64NVME.New().(hash.Hash64)
		h.Write(data)
		if got := h.Sum64(); got != want {
			t.Errorf("n=%d: Sum64 = %#x, stdlib %#x", n, got, want)
		}
		// Uneven writes take the same streaming path.
		w := CRC64NVME.New().(hash.Hash64)
		for rest := data; len(rest) > 0; {
			k := min(len(rest), 1+rng.IntN(5000))
			w.Write(rest[:k])
			rest = rest[k:]
		}
		if got := w.Sum64(); got != want {
			t.Errorf("n=%d: chunked writes give %#x, stdlib %#x", n, got, want)
		}
	}
	w := CRC64NVME.New()
	w.Write([]byte("junk"))
	w.Reset()
	w.Write([]byte("123456789"))
	if hex.EncodeToString(w.Sum(nil)) != "ae8b14860a799888" {
		t.Error("Reset did not reset")
	}
}

func TestParseAlgo(t *testing.T) {
	tests := []struct {
		in   string
		want Algo
		ok   bool
	}{
		{"CRC32", CRC32, true},
		{"crc32", CRC32, true},
		{"crc32c", CRC32C, true},
		{"Crc64Nvme", CRC64NVME, true},
		{"sha1", SHA1, true},
		{"SHA256", SHA256, true},
		{"MD5", "", false},
		{"CRC64", "", false},
		{"", "", false},
		{" CRC32", "", false},
	}
	for _, tc := range tests {
		got, ok := ParseAlgo(tc.in)
		if got != tc.want || ok != tc.ok {
			t.Errorf("ParseAlgo(%q) = %q, %v; want %q, %v", tc.in, got, ok, tc.want, tc.ok)
		}
	}
}

func TestHeaderNames(t *testing.T) {
	tests := []struct {
		algo Algo
		name string
		size int
	}{
		{CRC32, "x-amz-checksum-crc32", 4},
		{CRC32C, "x-amz-checksum-crc32c", 4},
		{CRC64NVME, "x-amz-checksum-crc64nvme", 8},
		{SHA1, "x-amz-checksum-sha1", 20},
		{SHA256, "x-amz-checksum-sha256", 32},
		{"MD5", "", 0},
	}
	for _, tc := range tests {
		if got := tc.algo.HeaderName(); got != tc.name {
			t.Errorf("%s.HeaderName() = %q, want %q", tc.algo, got, tc.name)
		}
		if got := tc.algo.Size(); got != tc.size {
			t.Errorf("%s.Size() = %d, want %d", tc.algo, got, tc.size)
		}
		if tc.name == "" {
			continue
		}
		for _, n := range []string{tc.name, http.CanonicalHeaderKey(tc.name)} {
			if a, ok := FromHeaderName(n); !ok || a != tc.algo {
				t.Errorf("FromHeaderName(%q) = %q, %v", n, a, ok)
			}
		}
	}
	for _, n := range []string{"x-amz-checksum-type", "X-Amz-Checksum-Mode", "x-amz-checksum-algorithm", "x-amz-checksum-", "x-amz-checksum-md5", "crc32", ""} {
		if a, ok := FromHeaderName(n); ok {
			t.Errorf("FromHeaderName(%q) = %q, want none", n, a)
		}
	}
}

func TestNewPanicsForUnknown(t *testing.T) {
	defer func() {
		if recover() == nil {
			t.Error("New for an unknown Algo did not panic")
		}
	}()
	Algo("MD5").New()
}

func TestFromHeader(t *testing.T) {
	crc := Encode(sum(CRC32, []byte("123456789"))) // y/Q5Jg==
	sha := Encode(sum(SHA256, []byte("123456789")))
	tests := []struct {
		name    string
		h       http.Header
		algo    Algo
		value   string
		found   bool
		invalid bool
	}{
		{"none", http.Header{}, "", "", false, false},
		{"nil", nil, "", "", false, false},
		{"crc32", hdr("X-Amz-Checksum-Crc32", crc), CRC32, crc, true, false},
		{"sha256", hdr("X-Amz-Checksum-Sha256", sha), SHA256, sha, true, false},
		{"lower-case key", http.Header{"x-amz-checksum-crc32c": {"4waSgw=="}}, CRC32C, "4waSgw==", true, false},
		{"crc64nvme", hdr("X-Amz-Checksum-Crc64nvme", "rosUhgp5mIg="), CRC64NVME, "rosUhgp5mIg=", true, false},
		{"type, mode and algorithm ignored", http.Header{
			"X-Amz-Checksum-Type":          {"FULL_OBJECT"},
			"X-Amz-Checksum-Mode":          {"ENABLED"},
			"X-Amz-Checksum-Algorithm":     {"CRC32"},
			"X-Amz-Sdk-Checksum-Algorithm": {"CRC32"},
			"X-Amz-Checksum-Crc32":         {crc},
		}, CRC32, crc, true, false},
		{"only type and mode", http.Header{"X-Amz-Checksum-Type": {"COMPOSITE"}, "X-Amz-Checksum-Mode": {"ENABLED"}}, "", "", false, false},
		{"surrounding space", hdr("X-Amz-Checksum-Crc32", " "+crc+" "), CRC32, crc, true, false},
		{"non-canonical base64 is canonicalised", hdr("X-Amz-Checksum-Crc32", "y/Q5Jh=="), CRC32, crc, true, false},
		{"two algorithms", http.Header{"X-Amz-Checksum-Crc32": {crc}, "X-Amz-Checksum-Sha256": {sha}}, "", "", false, true},
		{"same header twice", http.Header{"X-Amz-Checksum-Crc32": {crc, crc}}, "", "", false, true},
		{"two spellings", http.Header{"X-Amz-Checksum-Crc32": {crc}, "x-amz-checksum-crc32": {crc}}, "", "", false, true},
		{"bad base64", hdr("X-Amz-Checksum-Crc32", "not base64!"), "", "", false, true},
		{"wrong length", hdr("X-Amz-Checksum-Sha256", crc), "", "", false, true},
		{"empty value", hdr("X-Amz-Checksum-Crc32", ""), "", "", false, true},
		{"unpadded", hdr("X-Amz-Checksum-Crc32", "y/Q5Jg"), "", "", false, true},
		// algorithms of newer S3 that are not implemented here must not be skipped silently
		{"sha512", hdr("X-Amz-Checksum-Sha512", sha), "", "", false, true},
		{"md5", hdr("x-amz-checksum-md5", sha), "", "", false, true},
		{"xxhash3", hdr("X-Amz-Checksum-Xxhash3", crc), "", "", false, true},
		{"unsupported next to a supported one", http.Header{"X-Amz-Checksum-Crc32": {crc}, "X-Amz-Checksum-Sha512": {sha}}, "", "", false, true},
	}
	for _, tc := range tests {
		algo, value, found, err := FromHeader(tc.h)
		if tc.invalid {
			e, ok := apierr.As(err)
			if !ok || e.Code != "InvalidRequest" || e.Status != http.StatusBadRequest {
				t.Errorf("%s: err = %v, want InvalidRequest", tc.name, err)
			}
			if algo != "" || value != "" || found {
				t.Errorf("%s: results %q %q %v alongside the error", tc.name, algo, value, found)
			}
			continue
		}
		if err != nil || algo != tc.algo || value != tc.value || found != tc.found {
			t.Errorf("%s: FromHeader = %q, %q, %v, %v; want %q, %q, %v, nil", tc.name, algo, value, found, err, tc.algo, tc.value, tc.found)
		}
	}
}

func hdr(k, v string) http.Header { return http.Header{k: {v}} }

func TestUnsupportedHeaderName(t *testing.T) {
	for n, want := range map[string]bool{
		"x-amz-checksum-sha512": true, "X-Amz-Checksum-MD5": true, "x-amz-checksum-xxhash64": true, "x-amz-checksum-xxhash128": true,
		"x-amz-checksum-foo":   true,
		"x-amz-checksum-crc32": false, "X-Amz-Checksum-Crc64nvme": false, "x-amz-checksum-sha256": false,
		"x-amz-checksum-type": false, "x-amz-checksum-mode": false, "X-Amz-Checksum-Algorithm": false,
		"x-amz-checksum-": false, "x-amz-sdk-checksum-algorithm": false, "content-md5": false, "": false,
	} {
		if got := UnsupportedHeaderName(n); got != want {
			t.Errorf("UnsupportedHeaderName(%q) = %v, want %v", n, got, want)
		}
	}
	e := Unsupported("SHA512")
	if e.Code != "InvalidRequest" || e.Status != http.StatusBadRequest || !strings.Contains(e.Message, "SHA512") {
		t.Errorf("Unsupported = %+v", e)
	}
}

func TestComposite(t *testing.T) {
	parts := [][]byte{[]byte("part one, which is the larger part"), []byte("part two"), []byte("3")}
	for _, a := range []Algo{CRC32, CRC32C, SHA1, SHA256} {
		var sums [][]byte
		var concat []byte
		for _, p := range parts {
			s := sum(a, p)
			sums = append(sums, s)
			concat = append(concat, s...)
		}
		got, err := Composite(a, sums)
		if err != nil {
			t.Fatalf("Composite(%s): %v", a, err)
		}
		if want := Encode(sum(a, concat)) + "-3"; got != want {
			t.Errorf("Composite(%s) = %s, want %s", a, got, want)
		}
	}

	// Manual CRC32 computation, independent of Algo.New.
	s1 := crc32.ChecksumIEEE([]byte("hello"))
	s2 := crc32.ChecksumIEEE([]byte("world"))
	b1 := []byte{byte(s1 >> 24), byte(s1 >> 16), byte(s1 >> 8), byte(s1)}
	b2 := []byte{byte(s2 >> 24), byte(s2 >> 16), byte(s2 >> 8), byte(s2)}
	c := crc32.ChecksumIEEE(append(append([]byte{}, b1...), b2...))
	want := Encode([]byte{byte(c >> 24), byte(c >> 16), byte(c >> 8), byte(c)}) + "-2"
	if got, err := Composite(CRC32, [][]byte{b1, b2}); err != nil || got != want {
		t.Errorf("Composite(CRC32, hello, world) = %s, %v; want %s", got, err, want)
	}

	errs := []struct {
		name string
		algo Algo
		sums [][]byte
	}{
		{"crc64nvme", CRC64NVME, [][]byte{make([]byte, 8)}},
		{"unknown", "MD5", [][]byte{make([]byte, 16)}},
		{"no parts", CRC32, nil},
		{"wrong size", CRC32, [][]byte{make([]byte, 4), make([]byte, 8)}},
	}
	for _, tc := range errs {
		if _, err := Composite(tc.algo, tc.sums); err == nil {
			t.Errorf("Composite %s: no error", tc.name)
		}
	}
}

func TestCombine(t *testing.T) {
	rng := rand.New(rand.NewPCG(7, 11))
	lengths := []int{0, 1, 2, 3, 7, 8, 9, 15, 16, 17, 63, 64, 65, 255, 1000, 4096, 65537, 1 << 20}
	for _, a := range []Algo{CRC32, CRC32C, CRC64NVME} {
		for _, n := range lengths {
			data := make([]byte, n)
			for i := range data {
				data[i] = byte(rng.Uint32())
			}
			splits := []int{0, n, n / 2}
			for range 3 {
				splits = append(splits, rng.IntN(n+1))
			}
			for _, k := range splits {
				got, err := Combine(a, sum(a, data[:k]), sum(a, data[k:]), int64(n-k))
				if err != nil {
					t.Fatalf("Combine(%s): %v", a, err)
				}
				if want := sum(a, data); !bytes.Equal(got, want) {
					t.Errorf("%s n=%d split=%d: Combine = %x, want %x", a, n, k, got, want)
				}
			}
		}

		// Fold over many parts, as for a multipart FULL_OBJECT checksum.
		data := make([]byte, 300000)
		for i := range data {
			data[i] = byte(rng.Uint32())
		}
		acc := sum(a, nil)
		for rest := data; len(rest) > 0; {
			k := min(len(rest), 1+rng.IntN(40000))
			var err error
			if acc, err = Combine(a, acc, sum(a, rest[:k]), int64(k)); err != nil {
				t.Fatal(err)
			}
			rest = rest[k:]
		}
		if want := sum(a, data); !bytes.Equal(acc, want) {
			t.Errorf("%s: folded parts = %x, want %x", a, acc, want)
		}

		// Huge lengths (multipart objects of many GiB): shifting by n2 then
		// n3 must equal shifting by n2+n3.
		for range 20 {
			s1, s2, s3 := randSum(rng, a), randSum(rng, a), randSum(rng, a)
			n2, n3 := rng.Int64N(5<<40), rng.Int64N(5<<40)
			left, _ := Combine(a, s1, s2, n2)
			left, _ = Combine(a, left, s3, n3)
			right, _ := Combine(a, s2, s3, n3)
			right, _ = Combine(a, s1, right, n2+n3)
			if !bytes.Equal(left, right) {
				t.Errorf("%s: combine is not associative for n2=%d n3=%d", a, n2, n3)
			}
		}
	}

	errs := []struct {
		name       string
		algo       Algo
		sum1, sum2 []byte
		len2       int64
	}{
		{"sha256", SHA256, make([]byte, 32), make([]byte, 32), 1},
		{"sha1", SHA1, make([]byte, 20), make([]byte, 20), 1},
		{"short sum1", CRC32, make([]byte, 3), make([]byte, 4), 1},
		{"long sum2", CRC64NVME, make([]byte, 8), make([]byte, 9), 1},
		{"negative length", CRC32C, make([]byte, 4), make([]byte, 4), -1},
	}
	for _, tc := range errs {
		if _, err := Combine(tc.algo, tc.sum1, tc.sum2, tc.len2); err == nil {
			t.Errorf("Combine %s: no error", tc.name)
		}
	}
}

func randSum(rng *rand.Rand, a Algo) []byte {
	b := make([]byte, a.Size())
	for i := range b {
		b[i] = byte(rng.Uint32())
	}
	return b
}

func BenchmarkCRC64NVME(b *testing.B) {
	buf := make([]byte, 32<<10)
	h := CRC64NVME.New()
	b.SetBytes(int64(len(buf)))
	for range b.N {
		h.Write(buf)
	}
}

func BenchmarkCombine(b *testing.B) {
	s1, s2 := make([]byte, 8), make([]byte, 8)
	for range b.N {
		Combine(CRC64NVME, s1, s2, 5<<30)
	}
}

func TestIsEmpty(t *testing.T) {
	for _, tc := range []struct {
		a     Algo
		value string
		want  bool
	}{
		{CRC32, "AAAAAA==", true},
		{CRC32C, "AAAAAA==", true},
		{CRC64NVME, "AAAAAAAAAAA=", true},
		{SHA1, "2jmj7l5rSw0yVb/vlWAYkK/YBwk=", true},
		{SHA256, "47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU=", true},
		{SHA256, " 47DEQpj8HBSa+/TImW+5JCeuQeRkm5NMpJWZG3hSuFU= ", true},
		{CRC32, "y/Q5Jg==", false},     // CRC32("123456789")
		{CRC32, "AAAAAAAAAAA=", false}, // right digest for another algorithm's size
		{SHA256, "AAAAAA==", false},    // wrong size
		{CRC32, "", false},
		{CRC32, "not base64!", false},
		{"MD5", "AAAAAA==", false},
	} {
		if got := IsEmpty(tc.a, tc.value); got != tc.want {
			t.Errorf("IsEmpty(%s, %q) = %v, want %v", tc.a, tc.value, got, tc.want)
		}
	}
}
