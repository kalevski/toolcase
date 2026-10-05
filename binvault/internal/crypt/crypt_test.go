package crypt

import (
	"bytes"
	"crypto/aes"
	"crypto/cipher"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/binary"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"math"
	"math/rand/v2"
	"os"
	"path/filepath"
	"runtime"
	"sync"
	"testing"
	"testing/iotest"
)

var testBucketKey = func() []byte {
	sum := sha256.Sum256([]byte("binvault crypt test bucket key"))
	return sum[:]
}()

func blobKey(id string) []byte { return DeriveKey(testBucketKey, id) }

// plaintext returns n deterministic pseudo-random bytes.
func plaintext(n int, seed uint64) []byte {
	b := make([]byte, n)
	_, _ = rand.NewChaCha8(chachaSeed(seed)).Read(b)
	return b
}

func chachaSeed(seed uint64) [32]byte {
	var s [32]byte
	binary.LittleEndian.PutUint64(s[:], seed)
	return s
}

func newFile(t testing.TB) *os.File {
	t.Helper()
	f, err := os.Create(filepath.Join(t.TempDir(), "blob"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { _ = f.Close() })
	return f
}

// encrypt writes plain through a Writer in pieces of piece(remaining) bytes
// and returns the encrypted file.
func encrypt(t testing.TB, key, plain []byte, piece func(remaining int) int) []byte {
	t.Helper()
	f := newFile(t)
	w, err := NewWriter(f, key)
	if err != nil {
		t.Fatal(err)
	}
	for p := plain; len(p) > 0; {
		n := min(max(piece(len(p)), 1), len(p))
		got, err := w.Write(p[:n])
		if err != nil || got != n {
			t.Fatalf("Write(%d) = %d, %v", n, got, err)
		}
		p = p[n:]
	}
	if w.Size() != int64(len(plain)) {
		t.Fatalf("Size = %d before Close, want %d", w.Size(), len(plain))
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	data, err := os.ReadFile(f.Name())
	if err != nil {
		t.Fatal(err)
	}
	return data
}

func whole(n int) int { return n }

func openBytes(data, key []byte) (*Blob, error) {
	return Open(bytes.NewReader(data), int64(len(data)), key)
}

// readRange reads [off, off+n) twice, through Read and through WriteTo, and
// fails the test if the two disagree.
func readRange(t testing.TB, b *Blob, off, n int64) ([]byte, error) {
	t.Helper()
	r1, err := b.NewReader(off, n)
	if err != nil {
		return nil, err
	}
	viaRead, err1 := io.ReadAll(r1)
	r2, err := b.NewReader(off, n)
	if err != nil {
		t.Fatalf("second NewReader: %v", err)
	}
	var buf bytes.Buffer
	_, err2 := r2.(io.WriterTo).WriteTo(&buf)
	if (err1 == nil) != (err2 == nil) || (err1 == nil && !bytes.Equal(viaRead, buf.Bytes())) {
		t.Fatalf("Read and WriteTo disagree at [%d,+%d): %v / %v", off, n, err1, err2)
	}
	return viaRead, err1
}

// refHKDF is RFC 5869 written out with HMAC, independent of crypto/hkdf.
func refHKDF(secret, salt []byte, info string, n int) []byte {
	ext := hmac.New(sha256.New, salt)
	ext.Write(secret)
	prk := ext.Sum(nil)
	var out, block []byte
	for i := byte(1); len(out) < n; i++ {
		m := hmac.New(sha256.New, prk)
		m.Write(block)
		m.Write([]byte(info))
		m.Write([]byte{i})
		block = m.Sum(nil)
		out = append(out, block...)
	}
	return out[:n]
}

func mustHex(s string) []byte {
	b, err := hex.DecodeString(s)
	if err != nil {
		panic(err)
	}
	return b
}

func TestDeriveKey(t *testing.T) {
	// The reference itself against RFC 5869, test case 1.
	okm := refHKDF(bytes.Repeat([]byte{0x0b}, 22), mustHex("000102030405060708090a0b0c"),
		string(mustHex("f0f1f2f3f4f5f6f7f8f9")), 42)
	if want := mustHex("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865"); !bytes.Equal(okm, want) {
		t.Fatalf("reference HKDF is wrong: %x", okm)
	}

	other := bytes.Clone(testBucketKey)
	other[0] ^= 1
	ids := []string{"01JABCDEFGHJKMNPQRSTVWXYZ0", "01JABCDEFGHJKMNPQRSTVWXYZ1", "p", "part-7f3a"}
	seen := map[string]bool{}
	for _, id := range ids {
		for _, bk := range [][]byte{testBucketKey, other} {
			k := DeriveKey(bk, id)
			if len(k) != KeySize || !bytes.Equal(k, refHKDF(bk, []byte(id), "binvault/blob/v1", KeySize)) {
				t.Fatalf("DeriveKey(%q) = %x, want HKDF-SHA256(bucket key, salt=id, info=binvault/blob/v1)", id, k)
			}
			if !bytes.Equal(k, DeriveKey(bk, id)) {
				t.Fatal("DeriveKey is not deterministic")
			}
			if seen[string(k)] {
				t.Fatalf("DeriveKey(%q) repeats another key", id)
			}
			seen[string(k)] = true
		}
	}

	for _, tc := range []struct {
		name      string
		bucketKey []byte
		id        string
	}{
		{"nil bucket key", nil, "b"},
		{"short bucket key", testBucketKey[:16], "b"},
		{"31-byte bucket key", testBucketKey[:31], "b"},
		{"long bucket key", append(bytes.Clone(testBucketKey), 0), "b"},
		{"empty blob id", testBucketKey, ""},
	} {
		if k := DeriveKey(tc.bucketKey, tc.id); k != nil {
			t.Errorf("%s: DeriveKey = %x, want nil", tc.name, k)
		}
	}
	// A nil key from DeriveKey fails closed.
	if _, err := NewWriter(newFile(t), DeriveKey(nil, "b")); err == nil {
		t.Fatal("NewWriter accepted a nil key")
	}
	if _, err := Open(bytes.NewReader(make([]byte, 64)), 48, nil); err == nil {
		t.Fatal("Open accepted a nil key")
	}

	k1, err := NewBucketKey()
	if err != nil {
		t.Fatal(err)
	}
	k2, err := NewBucketKey()
	if err != nil || len(k1) != KeySize || len(k2) != KeySize || bytes.Equal(k1, k2) {
		t.Fatalf("NewBucketKey = %x, %x, %v", k1, k2, err)
	}
}

func TestSizes(t *testing.T) {
	cases := []struct{ plain, enc int64 }{
		{0, HeaderSize + TagSize},
		{1, HeaderSize + 1 + TagSize},
		{ChunkSize - 1, HeaderSize + ChunkSize - 1 + TagSize},
		{ChunkSize, HeaderSize + ChunkSize + TagSize},
		{ChunkSize + 1, HeaderSize + ChunkSize + 1 + 2*TagSize},
		{3 * ChunkSize, HeaderSize + 3*ChunkSize + 3*TagSize},
		{3*ChunkSize + 7, HeaderSize + 3*ChunkSize + 7 + 4*TagSize},
		{5 << 40, HeaderSize + 5<<40 + TagSize*(5<<40/ChunkSize)},
		{MaxPlaintextSize, HeaderSize + MaxPlaintextSize + TagSize*(MaxPlaintextSize/ChunkSize)},
		{-1, -1},
		{math.MinInt64, -1},
		{MaxPlaintextSize + 1, -1},
		{math.MaxInt64, -1},
	}
	for _, tc := range cases {
		if got := EncryptedSize(tc.plain); got != tc.enc {
			t.Errorf("EncryptedSize(%d) = %d, want %d", tc.plain, got, tc.enc)
		}
		if tc.enc > 0 {
			if got, err := PlaintextSize(tc.enc); err != nil || got != tc.plain {
				t.Errorf("PlaintextSize(%d) = %d, %v; want %d", tc.enc, got, err, tc.plain)
			}
		}
	}

	// Exhaustive near the first chunk boundaries: every valid length maps
	// back, and nothing else is accepted.
	const window = HeaderSize + 4*sealedChunk + 100
	valid := 0
	for e := int64(-1); e < window; e++ {
		p, err := PlaintextSize(e)
		if err != nil {
			if !errors.Is(err, ErrCorrupt) {
				t.Fatalf("PlaintextSize(%d) error %v is not ErrCorrupt", e, err)
			}
			continue
		}
		valid++
		if EncryptedSize(p) != e {
			t.Fatalf("PlaintextSize(%d) = %d, but EncryptedSize of that is %d", e, p, EncryptedSize(p))
		}
	}
	for p := int64(0); EncryptedSize(p) < window; p++ {
		if got, err := PlaintextSize(EncryptedSize(p)); err != nil || got != p {
			t.Fatalf("PlaintextSize(EncryptedSize(%d)) = %d, %v", p, got, err)
		}
		valid--
	}
	if valid != 0 {
		t.Fatalf("%d encrypted lengths accepted that no plaintext produces", valid)
	}

	for _, e := range []int64{
		0, HeaderSize, HeaderSize + TagSize - 1,
		HeaderSize + sealedChunk + 1,       // a trailing piece shorter than a tag
		HeaderSize + sealedChunk + TagSize, // an empty chunk after a full one
		HeaderSize + 3*sealedChunk + TagSize - 1,
		math.MaxInt64,
	} {
		if _, err := PlaintextSize(e); !errors.Is(err, ErrCorrupt) {
			t.Errorf("PlaintextSize(%d) = %v; want ErrCorrupt", e, err)
		}
	}
}

// TestFormat pins the documented layout with an independent implementation,
// in both directions.
func TestFormat(t *testing.T) {
	key := blobKey("format")
	block, err := aes.NewCipher(key)
	if err != nil {
		t.Fatal(err)
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		t.Fatal(err)
	}
	nonceAAD := func(i int, final bool) (nonce, aad []byte) {
		nonce = make([]byte, 12)
		binary.BigEndian.PutUint64(nonce[4:], uint64(i))
		aad = make([]byte, 9)
		binary.BigEndian.PutUint64(aad, uint64(i))
		if final {
			aad[8] = 1
		}
		return nonce, aad
	}

	small := encrypt(t, key, []byte("hello"), whole)
	wantHeader := mustHex("4256534501000000" + "00010000" + "0000000000000005" + "000000000000000000000000")
	if !bytes.Equal(small[:HeaderSize], wantHeader) {
		t.Fatalf("header = %x\nwant     %x", small[:HeaderSize], wantHeader)
	}

	for _, size := range []int{0, 5, ChunkSize, ChunkSize + 1, 3*ChunkSize + 7} {
		plain := plaintext(size, uint64(size))

		// Ours, decrypted by the reference.
		data := encrypt(t, key, plain, whole)
		if binary.BigEndian.Uint64(data[12:20]) != uint64(size) {
			t.Fatalf("size %d: header length %d", size, binary.BigEndian.Uint64(data[12:20]))
		}
		var got []byte
		body := data[HeaderSize:]
		for i := 0; len(body) > 0; i++ {
			n := min(len(body), sealedChunk)
			nonce, aad := nonceAAD(i, n == len(body))
			pt, err := gcm.Open(nil, nonce, body[:n], aad)
			if err != nil {
				t.Fatalf("size %d: reference cannot open chunk %d: %v", size, i, err)
			}
			got = append(got, pt...)
			body = body[n:]
		}
		if !bytes.Equal(got, plain) {
			t.Fatalf("size %d: reference decryption differs", size)
		}

		// The reference, read by ours.
		hdr := encodeHeader(uint64(size)) // pinned byte for byte by wantHeader above
		ref := append([]byte{}, hdr[:]...)
		chunks := max(1, (size+ChunkSize-1)/ChunkSize)
		for i := 0; i < chunks; i++ {
			piece := plain[i*ChunkSize : min(size, (i+1)*ChunkSize)]
			nonce, aad := nonceAAD(i, i == chunks-1)
			ref = gcm.Seal(ref, nonce, piece, aad)
		}
		if !bytes.Equal(ref, data) {
			t.Fatalf("size %d: reference encryption differs from the Writer's", size)
		}
	}
}

var writePatterns = []struct {
	name  string
	piece func(remaining int) int
	limit int // largest plaintext this pattern is used for (0 = any)
}{
	{"whole", whole, 0},
	{"1 byte", func(int) int { return 1 }, 2*ChunkSize + 1},
	{"7 bytes", func(int) int { return 7 }, 0},
	{"4 KiB", func(int) int { return 4096 }, 0},
	{"chunk", func(int) int { return ChunkSize }, 0},
	{"chunk-1", func(int) int { return ChunkSize - 1 }, 0},
	{"chunk+1", func(int) int { return ChunkSize + 1 }, 0},
	{"two chunks", func(int) int { return 2 * ChunkSize }, 0},
	{"random", func() func(int) int {
		r := rand.New(rand.NewPCG(1, 2))
		return func(int) int { return 1 + r.IntN(3*ChunkSize) }
	}(), 0},
}

func TestRoundTrip(t *testing.T) {
	sizes := []int{0, 1, 2, ChunkSize - 1, ChunkSize, ChunkSize + 1, 2 * ChunkSize, 3 * ChunkSize, 3*ChunkSize + 7}
	key := blobKey("roundtrip")
	for _, size := range sizes {
		plain := plaintext(size, uint64(size)+1)
		var first []byte
		for _, wp := range writePatterns {
			if wp.limit > 0 && size > wp.limit {
				continue
			}
			t.Run(fmt.Sprintf("%d/%s", size, wp.name), func(t *testing.T) {
				data := encrypt(t, key, plain, wp.piece)
				if int64(len(data)) != EncryptedSize(int64(size)) {
					t.Fatalf("file is %d bytes, want %d", len(data), EncryptedSize(int64(size)))
				}
				// The format is deterministic, so how the stream was cut
				// into writes must not change a single byte.
				if first == nil {
					first = data
				} else if !bytes.Equal(first, data) {
					t.Fatal("output depends on the write pattern")
				}
				b, err := openBytes(data, key)
				if err != nil {
					t.Fatal(err)
				}
				if b.Size() != int64(size) {
					t.Fatalf("Size = %d, want %d", b.Size(), size)
				}
				got, err := readRange(t, b, 0, -1)
				if err != nil || !bytes.Equal(got, plain) {
					t.Fatalf("read back %d bytes, %v; want %d", len(got), err, size)
				}
			})
		}
	}
}

func TestRandomSizes(t *testing.T) {
	r := rand.New(rand.NewPCG(3, 4))
	key := blobKey("random")
	for i := 0; i < 40; i++ {
		size := r.IntN(5 * ChunkSize)
		if i%4 == 0 { // near a boundary
			size = (1+r.IntN(4))*ChunkSize + r.IntN(5) - 2
		}
		plain := plaintext(size, uint64(i))
		data := encrypt(t, key, plain, func(int) int { return 1 + r.IntN(2*ChunkSize) })
		b, err := openBytes(data, key)
		if err != nil {
			t.Fatalf("size %d: %v", size, err)
		}
		got, err := readRange(t, b, 0, -1)
		if err != nil || !bytes.Equal(got, plain) {
			t.Fatalf("size %d: read back %d bytes, %v", size, len(got), err)
		}
		off := r.Int64N(int64(size) + 1)
		n := r.Int64N(int64(size) - off + 1)
		if got, err := readRange(t, b, off, n); err != nil || !bytes.Equal(got, plain[off:off+n]) {
			t.Fatalf("size %d: range [%d,+%d): %v", size, off, n, err)
		}
	}
}

// recordingReaderAt notes the offset of every read.
type recordingReaderAt struct {
	r    io.ReaderAt
	mu   sync.Mutex
	offs []int64
}

func (c *recordingReaderAt) ReadAt(p []byte, off int64) (int, error) {
	c.mu.Lock()
	c.offs = append(c.offs, off)
	c.mu.Unlock()
	return c.r.ReadAt(p, off)
}

func (c *recordingReaderAt) chunksRead() []int64 {
	c.mu.Lock()
	defer c.mu.Unlock()
	var out []int64
	for _, off := range c.offs {
		out = append(out, (off-HeaderSize)/sealedChunk)
	}
	c.offs = nil
	return out
}

func TestRangedReads(t *testing.T) {
	key := blobKey("ranges")
	const C = ChunkSize
	for _, size := range []int64{3*C + 7, 2 * C, 0, 1, C - 1} {
		plain := plaintext(int(size), 99)
		data := encrypt(t, key, plain, whole)
		rec := &recordingReaderAt{r: bytes.NewReader(data)}
		b, err := Open(rec, int64(len(data)), key)
		if err != nil {
			t.Fatal(err)
		}
		chunks := chunkCount(size)
		rec.chunksRead() // forget Open's header and length reads

		ranges := [][2]int64{
			{0, 0}, {0, 1}, {0, C - 1}, {0, C}, {0, C + 1}, {0, -1},
			{C - 1, 1}, {C - 1, 2}, {C, 0}, {C, 1}, {C, C}, {C + 1, C}, {C - 10, 20},
			{C - 1, C + 2}, {2*C - 1, C + 2}, {C / 2, 2 * C}, {1, size - 2},
			{3 * C, 7}, {3 * C, -1}, {3*C + 6, 1}, {2*C + 5, -1}, {C, -1}, {2 * C, -1},
			{size - 1, 1}, {size - 1, -1}, {size, 0}, {size, -1}, {size / 2, 0},
		}
		r := rand.New(rand.NewPCG(5, uint64(size)))
		for i := 0; i < 300; i++ {
			off := r.Int64N(size + 1)
			ranges = append(ranges, [2]int64{off, r.Int64N(size - off + 1)})
		}
		for _, rg := range ranges {
			off, n := rg[0], rg[1]
			if off < 0 || off > size || n > size-off {
				continue // not a range of this size
			}
			end := size
			if n >= 0 {
				end = off + n
			}
			got, err := readRange(t, b, off, n)
			if err != nil || !bytes.Equal(got, plain[off:end]) {
				t.Fatalf("size %d [%d,+%d): got %d bytes, %v; want %d", size, off, n, len(got), err, end-off)
			}

			// Only the overlapping chunks were read (twice: Read and
			// WriteTo), plus the final one for a range reaching the end.
			var want []int64
			if end == size || end > off {
				first := min(off/C, chunks-1)
				last := chunks - 1
				if end < size {
					last = (end - 1) / C
				}
				for c := first; c <= last; c++ {
					want = append(want, c)
				}
			}
			want = append(want, want...)
			if gotChunks := rec.chunksRead(); fmt.Sprint(gotChunks) != fmt.Sprint(want) {
				t.Fatalf("size %d [%d,+%d): read chunks %v, want %v", size, off, n, gotChunks, want)
			}
		}

		for _, rg := range [][2]int64{{0, -1}, {size / 3, size / 3}, {size, 0}} {
			rd, err := b.NewReader(rg[0], rg[1])
			if err != nil {
				t.Fatal(err)
			}
			end := size
			if rg[1] >= 0 {
				end = rg[0] + rg[1]
			}
			if err := iotest.TestReader(rd, plain[rg[0]:end]); err != nil {
				t.Fatalf("size %d [%d,+%d): %v", size, rg[0], rg[1], err)
			}
		}
	}
}

func TestRangeErrors(t *testing.T) {
	const size = 2*ChunkSize + 3
	key := blobKey("range errors")
	b, err := openBytes(encrypt(t, key, plaintext(size, 1), whole), key)
	if err != nil {
		t.Fatal(err)
	}
	for _, rg := range [][2]int64{
		{-1, 1}, {-1, -1}, {math.MinInt64, 0}, {size + 1, 0}, {size + 1, -1}, {math.MaxInt64, -1},
		{0, size + 1}, {size, 1}, {1, size}, {size / 2, math.MaxInt64}, {math.MaxInt64, math.MaxInt64},
	} {
		if r, err := b.NewReader(rg[0], rg[1]); !errors.Is(err, ErrRange) || r != nil {
			t.Errorf("NewReader(%d, %d) = %v; want ErrRange", rg[0], rg[1], err)
		}
	}
}

func TestWriterErrors(t *testing.T) {
	key := blobKey("writer errors")

	if _, err := NewWriter(nil, key); err == nil {
		t.Error("NewWriter(nil) succeeded")
	}
	for _, k := range [][]byte{nil, key[:16], key[:24], append(bytes.Clone(key), 0)} {
		if _, err := NewWriter(newFile(t), k); err == nil {
			t.Errorf("NewWriter accepted a %d-byte key", len(k))
		}
	}

	nonEmpty := newFile(t)
	if _, err := nonEmpty.Write([]byte("x")); err != nil {
		t.Fatal(err)
	}
	if _, err := NewWriter(nonEmpty, key); err == nil {
		t.Error("NewWriter accepted a non-empty file")
	}

	dir := t.TempDir()
	appendOnly, err := os.OpenFile(filepath.Join(dir, "append"), os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0o600)
	if err != nil {
		t.Fatal(err)
	}
	defer appendOnly.Close()
	if _, err := NewWriter(appendOnly, key); err == nil {
		t.Error("NewWriter accepted an O_APPEND file, which cannot rewrite its header")
	}

	if err := os.WriteFile(filepath.Join(dir, "ro"), nil, 0o600); err != nil {
		t.Fatal(err)
	}
	readOnly, err := os.Open(filepath.Join(dir, "ro"))
	if err != nil {
		t.Fatal(err)
	}
	defer readOnly.Close()
	if _, err := NewWriter(readOnly, key); err == nil {
		t.Error("NewWriter accepted a read-only file")
	}

	t.Run("write after close", func(t *testing.T) {
		w, err := NewWriter(newFile(t), key)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write([]byte("abc")); err != nil {
			t.Fatal(err)
		}
		if err := w.Close(); err != nil {
			t.Fatal(err)
		}
		if err := w.Close(); err != nil {
			t.Fatalf("second Close = %v", err)
		}
		if n, err := w.Write([]byte("d")); err == nil || n != 0 {
			t.Fatalf("Write after Close = %d, %v", n, err)
		}
		if n, err := w.Write(nil); err == nil || n != 0 {
			t.Fatalf("empty Write after Close = %d, %v", n, err)
		}
	})

	t.Run("sticky write error", func(t *testing.T) {
		f := newFile(t)
		w, err := NewWriter(f, key)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := w.Write(plaintext(ChunkSize/2, 1)); err != nil {
			t.Fatal(err)
		}
		_ = f.Close() // the disk goes away under the writer
		if _, err := w.Write(plaintext(2*ChunkSize, 2)); err == nil {
			t.Fatal("Write to a closed file succeeded")
		}
		if _, err := w.Write([]byte("more")); err == nil {
			t.Fatal("the write error is not sticky")
		}
		if err := w.Close(); err == nil {
			t.Fatal("Close after a failed write succeeded")
		}
		if err := w.Close(); err == nil {
			t.Fatal("second Close forgot the failure")
		}
	})

	t.Run("failed source leaves an unopenable file", func(t *testing.T) {
		f := newFile(t)
		src := io.MultiReader(bytes.NewReader(plaintext(3*ChunkSize+5, 3)), iotest.ErrReader(errors.New("client went away")))
		n, err := Encrypt(f, key, src)
		if err == nil || n != 3*ChunkSize+5 {
			t.Fatalf("Encrypt = %d, %v; want the source error after %d bytes", n, err, 3*ChunkSize+5)
		}
		data, err := os.ReadFile(f.Name())
		if err != nil {
			t.Fatal(err)
		}
		if _, err := openBytes(data, key); !errors.Is(err, ErrCorrupt) {
			t.Fatalf("unfinished blob opened: %v", err)
		}
		// Even with the missing held-back chunk "restored", the header
		// still says unfinished.
		full := encrypt(t, key, plaintext(3*ChunkSize+5, 3), whole)
		withPlaceholder := append(append([]byte{}, data[:HeaderSize]...), full[HeaderSize:]...)
		if _, err := openBytes(withPlaceholder, key); !errors.Is(err, ErrCorrupt) {
			t.Fatalf("blob with the placeholder header opened: %v", err)
		}
	})
}

func TestEncryptFileRoundTrip(t *testing.T) {
	key := blobKey("file")
	plain := plaintext(5*ChunkSize+123, 7)
	f := newFile(t)
	n, err := Encrypt(f, key, bytes.NewReader(plain))
	if err != nil || n != int64(len(plain)) {
		t.Fatalf("Encrypt = %d, %v", n, err)
	}
	if err := f.Sync(); err != nil {
		t.Fatal(err)
	}
	st, err := f.Stat()
	if err != nil {
		t.Fatal(err)
	}
	if st.Size() != EncryptedSize(n) {
		t.Fatalf("file is %d bytes, want %d", st.Size(), EncryptedSize(n))
	}
	rf, err := os.Open(f.Name())
	if err != nil {
		t.Fatal(err)
	}
	defer rf.Close()
	// Opening with the size from the object row checks the row against the
	// file as well.
	b, err := Open(rf, EncryptedSize(int64(len(plain))), key)
	if err != nil {
		t.Fatal(err)
	}
	got, err := readRange(t, b, 0, -1)
	if err != nil || !bytes.Equal(got, plain) {
		t.Fatalf("read back %d bytes, %v", len(got), err)
	}
	if _, err := Open(rf, EncryptedSize(int64(len(plain)-1)), key); !errors.Is(err, ErrCorrupt) {
		t.Fatalf("a row size that disagrees with the file opened: %v", err)
	}
}

// TestLargeStreaming pushes 32 MiB through Encrypt and back, checking that
// memory use does not grow with the stream.
func TestLargeStreaming(t *testing.T) {
	const size = 32 << 20
	key := blobKey("large")
	src := func() io.Reader { return io.LimitReader(rand.NewChaCha8(chachaSeed(42)), size) }
	f := newFile(t)

	wantHash := sha256.New()
	before := totalAlloc()
	n, err := Encrypt(f, key, io.TeeReader(src(), wantHash))
	if err != nil || n != size {
		t.Fatalf("Encrypt = %d, %v", n, err)
	}
	if grew := totalAlloc() - before; grew > 4<<20 {
		t.Fatalf("encrypting %d MiB allocated %d bytes", size>>20, grew)
	}

	st, err := f.Stat()
	if err != nil {
		t.Fatal(err)
	}
	b, err := Open(f, st.Size(), key)
	if err != nil {
		t.Fatal(err)
	}
	gotHash := sha256.New()
	before = totalAlloc()
	r, err := b.NewReader(0, -1)
	if err != nil {
		t.Fatal(err)
	}
	if m, err := io.Copy(gotHash, r); err != nil || m != size {
		t.Fatalf("decrypted %d bytes, %v", m, err)
	}
	if grew := totalAlloc() - before; grew > 4<<20 {
		t.Fatalf("decrypting %d MiB allocated %d bytes", size>>20, grew)
	}
	if !bytes.Equal(gotHash.Sum(nil), wantHash.Sum(nil)) {
		t.Fatal("decrypted stream differs")
	}

	// A range deep inside, against the regenerated stream.
	off, length := int64(size-3*ChunkSize-11), int64(2*ChunkSize+29)
	want := make([]byte, off+length)
	if _, err := io.ReadFull(src(), want); err != nil {
		t.Fatal(err)
	}
	if got, err := readRange(t, b, off, length); err != nil || !bytes.Equal(got, want[off:]) {
		t.Fatalf("range [%d,+%d): %v", off, length, err)
	}
}

func totalAlloc() uint64 {
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	return m.TotalAlloc
}

func TestConcurrentReaders(t *testing.T) {
	key := blobKey("concurrent")
	plain := plaintext(5*ChunkSize+123, 11)
	f := newFile(t)
	if _, err := Encrypt(f, key, bytes.NewReader(plain)); err != nil {
		t.Fatal(err)
	}
	b, err := Open(f, EncryptedSize(int64(len(plain))), key)
	if err != nil {
		t.Fatal(err)
	}
	size := int64(len(plain))
	var wg sync.WaitGroup
	errs := make(chan error, 16)
	for g := 0; g < 16; g++ {
		wg.Add(1)
		go func(g int) {
			defer wg.Done()
			r := rand.New(rand.NewPCG(uint64(g), 77))
			for i := 0; i < 60; i++ {
				off := r.Int64N(size + 1)
				n := r.Int64N(size - off + 1)
				rd, err := b.NewReader(off, n)
				if err != nil {
					errs <- err
					return
				}
				got, err := io.ReadAll(rd)
				if err != nil || !bytes.Equal(got, plain[off:off+n]) {
					errs <- fmt.Errorf("goroutine %d: [%d,+%d): %v", g, off, n, err)
					return
				}
			}
		}(g)
	}
	wg.Wait()
	close(errs)
	for err := range errs {
		t.Fatal(err)
	}
}
