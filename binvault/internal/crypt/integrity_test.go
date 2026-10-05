package crypt

import (
	"bytes"
	"encoding/binary"
	"errors"
	"io"
	"math"
	"testing"
)

func withHeaderLen(data []byte, n uint64) []byte {
	mod := bytes.Clone(data)
	binary.BigEndian.PutUint64(mod[12:20], n)
	return mod
}

func openAndRead(t *testing.T, data, key []byte, off, n int64) ([]byte, error) {
	t.Helper()
	b, err := openBytes(data, key)
	if err != nil {
		return nil, err
	}
	return readRange(t, b, off, n)
}

// fullChunk returns the stored bytes of full chunk i (aliasing data).
func fullChunk(data []byte, i int) []byte {
	return data[HeaderSize+i*sealedChunk : HeaderSize+(i+1)*sealedChunk]
}

// checkChunks reads every chunk of b on its own: those in bad must fail with
// ErrCorrupt, the others must return the right plaintext.
func checkChunks(t *testing.T, b *Blob, plain []byte, bad ...int) {
	t.Helper()
	for c := 0; int64(c) < b.chunks; c++ {
		off := int64(c) * ChunkSize
		n := min(ChunkSize, b.size-off)
		got, err := readRange(t, b, off, n)
		wantBad := false
		for _, x := range bad {
			wantBad = wantBad || x == c
		}
		switch {
		case wantBad && !errors.Is(err, ErrCorrupt):
			t.Errorf("chunk %d: read = %d bytes, %v; want ErrCorrupt", c, len(got), err)
		case !wantBad && (err != nil || !bytes.Equal(got, plain[off:off+n])):
			t.Errorf("chunk %d: read = %d bytes, %v; want its plaintext", c, len(got), err)
		}
	}
	if len(bad) > 0 {
		if _, err := readRange(t, b, 0, -1); !errors.Is(err, ErrCorrupt) {
			t.Errorf("full read = %v; want ErrCorrupt", err)
		}
	}
}

func TestTruncation(t *testing.T) {
	key := blobKey("truncation")
	plain := plaintext(3*ChunkSize+7, 21)
	data := encrypt(t, key, plain, whole)

	cuts := []int{0, 1, HeaderSize - 1, len(data) - 1}
	for k := 0; k <= 3; k++ {
		boundary := HeaderSize + k*sealedChunk
		for _, d := range []int{0, 1, 15, 16, 17, ChunkSize / 2, sealedChunk - 1} {
			if cut := boundary + d; cut < len(data) {
				cuts = append(cuts, cut)
			}
		}
	}
	for _, cut := range cuts {
		short := data[:cut]
		// As cut: the header still records the full length.
		if _, err := openBytes(short, key); !errors.Is(err, ErrCorrupt) {
			t.Errorf("cut at %d: Open = %v; want ErrCorrupt", cut, err)
		}
		// Opened with the length the object row expects.
		if _, err := Open(bytes.NewReader(short), int64(len(data)), key); !errors.Is(err, ErrCorrupt) {
			t.Errorf("cut at %d, full length claimed: Open = %v; want ErrCorrupt", cut, err)
		}
		// With the header forged to agree with the shorter file, Open
		// succeeds, but no read that reaches the new end does.
		p, err := PlaintextSize(int64(cut))
		if err != nil {
			continue // no header can make this length valid
		}
		b, err := openBytes(withHeaderLen(short, uint64(p)), key)
		if err != nil {
			t.Fatalf("cut at %d: forged header refused: %v", cut, err)
		}
		if got, err := readRange(t, b, 0, -1); !errors.Is(err, ErrCorrupt) {
			t.Errorf("cut at %d, forged header: full read = %d bytes, %v; want ErrCorrupt", cut, len(got), err)
		}
		if _, err := readRange(t, b, max(p-1, 0), -1); !errors.Is(err, ErrCorrupt) {
			t.Errorf("cut at %d, forged header: read of the tail = %v; want ErrCorrupt", cut, err)
		}
		if p > ChunkSize {
			// Bytes before the damaged tail are authentic and still read.
			if got, err := readRange(t, b, 0, 10); err != nil || !bytes.Equal(got, plain[:10]) {
				t.Errorf("cut at %d, forged header: head read = %v", cut, err)
			}
		}
	}

	// A file that grew is refused as well.
	if _, err := openBytes(append(bytes.Clone(data), 0), key); !errors.Is(err, ErrCorrupt) {
		t.Errorf("extended file: Open = %v; want ErrCorrupt", err)
	}
	if _, err := Open(bytes.NewReader(append(bytes.Clone(data), 0)), int64(len(data)), key); !errors.Is(err, ErrCorrupt) {
		t.Errorf("extended file, recorded length claimed: Open = %v; want ErrCorrupt", err)
	}
}

func TestReorder(t *testing.T) {
	key := blobKey("reorder")
	plain := plaintext(4*ChunkSize+100, 22) // chunks 0-3 full, 4 final
	data := encrypt(t, key, plain, whole)

	swap := func(i, j int) []byte {
		mod := bytes.Clone(data)
		a := bytes.Clone(fullChunk(mod, i))
		copy(fullChunk(mod, i), fullChunk(mod, j))
		copy(fullChunk(mod, j), a)
		return mod
	}
	copyOver := func(src []byte, from, to int) []byte {
		mod := bytes.Clone(data)
		copy(fullChunk(mod, to), fullChunk(src, from))
		return mod
	}
	other := encrypt(t, blobKey("reorder-other"), plain, whole)

	cases := []struct {
		name string
		data []byte
		bad  []int
	}{
		{"swap 0 and 1", swap(0, 1), []int{0, 1}},
		{"swap 1 and 3", swap(1, 3), []int{1, 3}},
		{"chunk 0 duplicated over 2", copyOver(data, 0, 2), []int{2}},
		{"chunk 1 taken from another blob", copyOver(other, 1, 1), []int{1}},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			b, err := openBytes(tc.data, key)
			if err != nil {
				t.Fatal(err)
			}
			checkChunks(t, b, plain, tc.bad...)
		})
	}

	t.Run("middle chunk dropped", func(t *testing.T) {
		dropped := append(bytes.Clone(data[:HeaderSize+2*sealedChunk]), data[HeaderSize+3*sealedChunk:]...)
		b, err := openBytes(withHeaderLen(dropped, uint64(len(plain)-ChunkSize)), key)
		if err != nil {
			t.Fatal(err)
		}
		// Chunks 0 and 1 are where they were; the rest moved up by one.
		checkChunks(t, b, append(bytes.Clone(plain[:2*ChunkSize]), plain[3*ChunkSize:]...), 2, 3)
	})

	t.Run("final chunk moved up", func(t *testing.T) {
		// Keep chunks 0-2 and put the real final chunk where chunk 3 was
		// cut out: right length, right flag, wrong index.
		moved := append(bytes.Clone(data[:HeaderSize+3*sealedChunk]), data[HeaderSize+4*sealedChunk:]...)
		b, err := openBytes(withHeaderLen(moved, uint64(3*ChunkSize+100)), key)
		if err != nil {
			t.Fatal(err)
		}
		checkChunks(t, b, append(bytes.Clone(plain[:3*ChunkSize]), plain[4*ChunkSize:]...), 3)
	})
}

func TestBitFlips(t *testing.T) {
	key := blobKey("flips")

	// Small blobs, every bit of every byte: header, data and tag.
	for _, size := range []int{0, 1, 100} {
		data := encrypt(t, key, plaintext(size, 31), whole)
		for i := range data {
			for bit := 0; bit < 8; bit++ {
				mod := bytes.Clone(data)
				mod[i] ^= 1 << bit
				if got, err := openAndRead(t, mod, key, 0, -1); !errors.Is(err, ErrCorrupt) {
					t.Fatalf("size %d, byte %d bit %d: read = %d bytes, %v; want ErrCorrupt", size, i, bit, len(got), err)
				}
			}
		}
	}

	// A multi-chunk blob: damage stays confined to its chunk.
	const size = 3*ChunkSize + 7
	plain := plaintext(size, 32)
	data := encrypt(t, key, plain, whole)
	for i := 0; i < HeaderSize; i++ {
		mod := bytes.Clone(data)
		mod[i] ^= 0x01
		if _, err := openBytes(mod, key); !errors.Is(err, ErrCorrupt) {
			t.Fatalf("header byte %d: Open = %v; want ErrCorrupt", i, err)
		}
	}
	for c := 0; c < 4; c++ {
		start := HeaderSize + c*sealedChunk
		stored := min(sealedChunk, len(data)-start)
		dataLen := stored - TagSize
		for _, pos := range []int{0, 1, dataLen / 2, dataLen - 1, dataLen, stored - 1} {
			mod := bytes.Clone(data)
			mod[start+pos] ^= 0x80
			b, err := openBytes(mod, key)
			if err != nil {
				t.Fatalf("chunk %d +%d: Open = %v", c, pos, err)
			}
			checkChunks(t, b, plain, c)
		}
	}
}

func TestWrongKey(t *testing.T) {
	otherBucket := bytes.Clone(testBucketKey)
	otherBucket[31] ^= 1
	for _, size := range []int{0, 1, ChunkSize, 3*ChunkSize + 7} {
		data := encrypt(t, blobKey("right"), plaintext(size, 41), whole)
		for _, wrong := range []struct {
			name string
			key  []byte
		}{
			{"another blob id", blobKey("wrong")},
			{"another bucket key", DeriveKey(otherBucket, "right")},
		} {
			// The header is not keyed, so Open succeeds; every read fails.
			b, err := openBytes(data, wrong.key)
			if err != nil {
				t.Fatalf("size %d, %s: Open = %v", size, wrong.name, err)
			}
			if got, err := readRange(t, b, 0, -1); !errors.Is(err, ErrCorrupt) {
				t.Errorf("size %d, %s: full read = %d bytes, %v; want ErrCorrupt", size, wrong.name, len(got), err)
			}
			if size > 0 {
				if _, err := readRange(t, b, int64(size-1), 1); !errors.Is(err, ErrCorrupt) {
					t.Errorf("size %d, %s: last byte = %v; want ErrCorrupt", size, wrong.name, err)
				}
			}
		}
	}
}

func TestHeaderLies(t *testing.T) {
	key := blobKey("header")
	const size = 3*ChunkSize + 7
	data := encrypt(t, key, plaintext(size, 51), whole)
	if _, err := openBytes(data, key); err != nil {
		t.Fatal(err)
	}
	putLen := func(n uint64) func([]byte) { return func(h []byte) { binary.BigEndian.PutUint64(h[12:20], n) } }
	putChunk := func(n uint32) func([]byte) { return func(h []byte) { binary.BigEndian.PutUint32(h[8:12], n) } }
	set := func(i int, v byte) func([]byte) { return func(h []byte) { h[i] = v } }
	cases := []struct {
		name string
		edit func(h []byte)
	}{
		{"length - 1", putLen(size - 1)},
		{"length + 1", putLen(size + 1)},
		{"length 0", putLen(0)},
		{"length + a chunk", putLen(size + ChunkSize)},
		{"length of full chunks only", putLen(3 * ChunkSize)},
		{"length 2^63", putLen(1 << 63)},
		{"length unfinished", putLen(math.MaxUint64)},
		{"magic", set(0, 'b')},
		{"magic last byte", set(3, 'F')},
		{"version 0", set(4, 0)},
		{"version 2", set(4, 2)},
		{"reserved byte 5", set(5, 1)},
		{"reserved byte 7", set(7, 0x80)},
		{"reserved byte 20", set(20, 1)},
		{"reserved byte 31", set(31, 1)},
		{"chunk size 32 KiB", putChunk(32 << 10)},
		{"chunk size 64 KiB - 1", putChunk(ChunkSize - 1)},
		{"chunk size 128 KiB", putChunk(128 << 10)},
		{"chunk size 0", putChunk(0)},
		{"chunk size max", putChunk(math.MaxUint32)},
	}
	for _, tc := range cases {
		mod := bytes.Clone(data)
		tc.edit(mod[:HeaderSize])
		if b, err := openBytes(mod, key); !errors.Is(err, ErrCorrupt) || b != nil {
			t.Errorf("%s: Open = %v; want ErrCorrupt", tc.name, err)
		}
	}
}

// failingReaderAt fails every read that touches [from, ∞).
type failingReaderAt struct {
	r    io.ReaderAt
	from int64
}

var errDisk = errors.New("disk on fire")

func (f failingReaderAt) ReadAt(p []byte, off int64) (int, error) {
	if off+int64(len(p)) > f.from {
		return 0, errDisk
	}
	return f.r.ReadAt(p, off)
}

func TestIOErrors(t *testing.T) {
	key := blobKey("io")
	plain := plaintext(3*ChunkSize+7, 61)
	data := encrypt(t, key, plain, whole)
	size := int64(len(data))

	// I/O failures surface as themselves, not as corruption.
	if _, err := Open(failingReaderAt{bytes.NewReader(data), 0}, size, key); !errors.Is(err, errDisk) || errors.Is(err, ErrCorrupt) {
		t.Fatalf("header read failure: %v", err)
	}
	if _, err := Open(failingReaderAt{bytes.NewReader(data), size - 1}, size, key); !errors.Is(err, errDisk) || errors.Is(err, ErrCorrupt) {
		t.Fatalf("length probe failure: %v", err)
	}

	// Fails only inside chunk 2: chunks 0 and 1 still read.
	lazy := &failAfterOpen{r: bytes.NewReader(data), from: HeaderSize + 2*sealedChunk}
	b, err := Open(lazy, size, key)
	if err != nil {
		t.Fatal(err)
	}
	lazy.armed = true
	if got, err := readRange(t, b, 0, 2*ChunkSize); err != nil || !bytes.Equal(got, plain[:2*ChunkSize]) {
		t.Fatalf("chunks before the failure: %v", err)
	}
	if _, err := readRange(t, b, 0, -1); !errors.Is(err, errDisk) || errors.Is(err, ErrCorrupt) {
		t.Fatalf("read across the failure: %v", err)
	}
}

// failAfterOpen fails reads at or after from once armed.
type failAfterOpen struct {
	r     io.ReaderAt
	from  int64
	armed bool
}

func (f *failAfterOpen) ReadAt(p []byte, off int64) (int, error) {
	if f.armed && off+int64(len(p)) > f.from {
		return 0, errDisk
	}
	return f.r.ReadAt(p, off)
}
