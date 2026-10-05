package crypt

import (
	"crypto/cipher"
	"errors"
	"fmt"
	"io"
)

// Blob is an opened encrypted blob. It is immutable and safe for concurrent
// use: any number of readers from NewReader may run at once, each with its
// own buffer, reading through r.ReadAt (which *os.File allows concurrently).
// The ReaderAt must stay open while readers are in use.
type Blob struct {
	r      io.ReaderAt
	aead   cipher.AEAD
	size   int64 // plaintext length
	chunks int64 // number of chunks, at least 1
	lastCT int   // stored length of the final chunk, tag included
}

// Open validates an encrypted blob of encryptedSize bytes: the size must be
// one EncryptedSize produces, every header field must hold its fixed value,
// the header's plaintext length must match the length derived from
// encryptedSize, and the file must be exactly encryptedSize bytes long. Any
// mismatch is ErrCorrupt. Chunks are authenticated later, as they are read.
//
// encryptedSize may come from Stat, or from the object row as
// EncryptedSize(size), which also checks the row against the file.
func Open(r io.ReaderAt, encryptedSize int64, key []byte) (*Blob, error) {
	if r == nil {
		return nil, errors.New("crypt: nil reader")
	}
	aead, err := newAEAD(key)
	if err != nil {
		return nil, err
	}
	plain, err := PlaintextSize(encryptedSize)
	if err != nil {
		return nil, err
	}
	var hdr [HeaderSize]byte
	switch err := readAt(r, hdr[:], 0); {
	case errors.Is(err, errShortRead):
		return nil, fmt.Errorf("%w: the header is truncated", ErrCorrupt)
	case err != nil:
		return nil, fmt.Errorf("crypt: reading the header: %w", err)
	}
	if err := checkHeader(&hdr, plain); err != nil {
		return nil, err
	}
	// One read of two bytes at the last byte proves the exact length: one
	// byte must come back, then EOF.
	var probe [2]byte
	n, err := r.ReadAt(probe[:], encryptedSize-1)
	switch {
	case n == 2:
		return nil, fmt.Errorf("%w: the file is longer than %d bytes", ErrCorrupt, encryptedSize)
	case n == 1 && (err == nil || errors.Is(err, io.EOF)):
	case n == 0 && (err == nil || errors.Is(err, io.EOF)):
		return nil, fmt.Errorf("%w: the file is shorter than %d bytes", ErrCorrupt, encryptedSize)
	default:
		return nil, fmt.Errorf("crypt: checking the blob length: %w", err)
	}
	chunks := chunkCount(plain)
	return &Blob{
		r:      r,
		aead:   aead,
		size:   plain,
		chunks: chunks,
		lastCT: int(encryptedSize - HeaderSize - (chunks-1)*sealedChunk),
	}, nil
}

// errShortRead marks a read that hit end of file early: the file is shorter
// than its layout, which callers report as ErrCorrupt.
var errShortRead = errors.New("short read")

// readAt fills p from offset off. It returns errShortRead when the data ends
// first, and other failures as they are (I/O errors, not corruption).
func readAt(r io.ReaderAt, p []byte, off int64) error {
	n, err := r.ReadAt(p, off)
	switch {
	case n == len(p):
		return nil
	case err == nil || errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF):
		return errShortRead
	default:
		return err
	}
}

// Size returns the plaintext length.
func (b *Blob) Size() int64 { return b.size }

// NewReader returns a reader of the plaintext bytes [off, off+n), or
// [off, Size()) when n < 0. It decrypts only the chunks the range overlaps,
// one at a time, and authenticates each before returning any of its bytes;
// a chunk that fails is ErrCorrupt from Read, so a damaged blob is never read
// silently short. A range that reaches the end of the blob also
// authenticates the final chunk even when it contributes no bytes, so a
// complete read proves the blob complete — an empty blob included.
//
// off must be within [0, Size()] and the range must end by Size(), else
// ErrRange. The reader also implements io.WriterTo, which io.Copy uses to
// write decrypted chunks without an extra copy.
func (b *Blob) NewReader(off, n int64) (io.Reader, error) {
	if off < 0 || off > b.size {
		return nil, fmt.Errorf("%w: offset %d, size %d", ErrRange, off, b.size)
	}
	if n < 0 {
		n = b.size - off
	}
	if n > b.size-off {
		return nil, fmt.Errorf("%w: %d bytes at offset %d, size %d", ErrRange, n, off, b.size)
	}
	end := off + n
	r := &rangeReader{b: b, remain: n}
	switch {
	case end == b.size:
		r.last = b.chunks - 1
	case n == 0:
		r.next, r.last = 0, -1 // empty range inside the blob: nothing to read
		return r, nil
	default:
		r.last = (end - 1) / ChunkSize
	}
	// off == size on a whole number of chunks points one past the last
	// chunk; start at the last chunk instead, which the range then skips.
	r.next = min(off/ChunkSize, b.chunks-1)
	r.skip = off - r.next*ChunkSize
	return r, nil
}

// chunk reads and authenticates chunk i into buf (cap sealedChunk) and
// returns its plaintext, which aliases buf.
func (b *Blob) chunk(i int64, buf []byte) ([]byte, error) {
	final := i == b.chunks-1
	n := sealedChunk
	if final {
		n = b.lastCT
	}
	ct := buf[:n]
	switch err := readAt(b.r, ct, HeaderSize+i*sealedChunk); {
	case errors.Is(err, errShortRead):
		return nil, fmt.Errorf("%w: chunk %d is truncated", ErrCorrupt, i)
	case err != nil:
		return nil, fmt.Errorf("crypt: reading chunk %d: %w", i, err)
	}
	nonce := chunkNonce(uint64(i))
	aad := chunkAAD(uint64(i), final)
	pt, err := b.aead.Open(ct[:0], nonce[:], ct, aad[:])
	if err != nil || len(pt) != n-TagSize {
		return nil, fmt.Errorf("%w: chunk %d failed authentication", ErrCorrupt, i)
	}
	return pt, nil
}

// errInvalidWrite reports an io.Writer that claimed an impossible count.
var errInvalidWrite = errors.New("crypt: invalid write result")

// rangeReader yields a byte range of a Blob, one authenticated chunk at a
// time.
type rangeReader struct {
	b      *Blob
	next   int64  // next chunk to decrypt
	last   int64  // last chunk to decrypt, inclusive
	skip   int64  // bytes to drop from the front of the first chunk
	remain int64  // plaintext bytes still to deliver
	buf    []byte // chunk buffer, allocated on first use
	pend   []byte // decrypted bytes not yet delivered (aliases buf)
	err    error  // sticky: io.EOF or the first failure
}

// fill decrypts chunks until there are bytes to deliver, or returns io.EOF
// once every chunk of the range has been authenticated.
func (r *rangeReader) fill() error {
	for len(r.pend) == 0 {
		if r.err != nil {
			return r.err
		}
		if r.next > r.last {
			r.err, r.buf = io.EOF, nil
			return r.err
		}
		if r.buf == nil {
			r.buf = make([]byte, sealedChunk)
		}
		pt, err := r.b.chunk(r.next, r.buf)
		if err == nil && r.skip > int64(len(pt)) {
			err = fmt.Errorf("%w: chunk %d is shorter than its layout", ErrCorrupt, r.next)
		}
		if err != nil {
			r.err, r.buf = err, nil
			return err
		}
		r.next++
		pt = pt[r.skip:]
		r.skip = 0
		if int64(len(pt)) > r.remain {
			pt = pt[:r.remain]
		}
		r.remain -= int64(len(pt))
		r.pend = pt
	}
	return nil
}

// Read implements io.Reader.
func (r *rangeReader) Read(p []byte) (int, error) {
	if len(p) == 0 {
		return 0, nil
	}
	if err := r.fill(); err != nil {
		return 0, err
	}
	n := copy(p, r.pend)
	r.pend = r.pend[n:]
	return n, nil
}

// WriteTo implements io.WriterTo.
func (r *rangeReader) WriteTo(w io.Writer) (int64, error) {
	var total int64
	for {
		if err := r.fill(); err != nil {
			if err == io.EOF {
				return total, nil
			}
			return total, err
		}
		n, err := w.Write(r.pend)
		if n < 0 || n > len(r.pend) {
			return total, errInvalidWrite
		}
		total += int64(n)
		r.pend = r.pend[n:]
		if err != nil {
			return total, err
		}
		if len(r.pend) != 0 {
			return total, io.ErrShortWrite
		}
	}
}
