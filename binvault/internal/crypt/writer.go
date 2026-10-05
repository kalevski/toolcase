package crypt

import (
	"crypto/cipher"
	"errors"
	"fmt"
	"io"
	"os"
)

var errWriterClosed = errors.New("crypt: write to a closed Writer")

// Writer encrypts a plaintext stream into a blob file (§3.5 step 2: while
// the body streams into tmp/). Memory use is one chunk buffer, whatever the
// size of the stream.
//
// The Writer holds the latest full chunk back until it knows whether more
// data follows, because the last chunk must be sealed as final. Close seals
// it and then rewrites the header with the plaintext length, so the target
// must allow positional writes; all writes go through WriteAt, and the file
// offset is never used or moved.
//
// After any error the file is unusable and must be discarded: its header
// still marks it unfinished, so it never opens. A Writer is not safe for
// concurrent use.
type Writer struct {
	f      io.WriterAt
	aead   cipher.AEAD
	buf    []byte // plaintext of the chunk being filled; cap sealedChunk, so it is sealed in place
	index  uint64 // index of the next chunk to seal
	size   int64  // plaintext bytes accepted
	err    error  // first failure; sticky
	closed bool
}

// NewWriter starts an encrypted blob in f, which must be empty, under key
// (normally DeriveKey(bucketKey, blobID)). It writes a placeholder header at
// offset 0 right away.
func NewWriter(f *os.File, key []byte) (*Writer, error) {
	if f == nil {
		return nil, errors.New("crypt: nil file")
	}
	aead, err := newAEAD(key)
	if err != nil {
		return nil, err
	}
	st, err := f.Stat()
	if err != nil {
		return nil, fmt.Errorf("crypt: %w", err)
	}
	if st.Size() != 0 {
		return nil, fmt.Errorf("crypt: target file is not empty (%d bytes)", st.Size())
	}
	hdr := encodeHeader(unfinished)
	if _, err := f.WriteAt(hdr[:], 0); err != nil {
		return nil, fmt.Errorf("crypt: writing the header: %w", err)
	}
	return &Writer{f: f, aead: aead, buf: make([]byte, 0, sealedChunk)}, nil
}

// Write encrypts p. Every chunk but the held-back one is on its way to the
// file when Write returns.
func (w *Writer) Write(p []byte) (int, error) {
	if w.closed {
		return 0, errWriterClosed
	}
	if w.err != nil {
		return 0, w.err
	}
	if int64(len(p)) > MaxPlaintextSize-w.size {
		w.err = fmt.Errorf("crypt: plaintext exceeds %d bytes", int64(MaxPlaintextSize))
		return 0, w.err
	}
	n := 0
	for len(p) > 0 {
		if len(w.buf) == ChunkSize {
			// More data follows, so the held-back chunk is not the last.
			if err := w.seal(w.buf, false); err != nil {
				return n, err
			}
		}
		if len(w.buf) == 0 && len(p) > ChunkSize {
			// A whole chunk with more data behind it: seal it straight
			// from p, without copying it into the buffer first.
			if err := w.seal(p[:ChunkSize], false); err != nil {
				return n, err
			}
			p = p[ChunkSize:]
			n += ChunkSize
			w.size += ChunkSize
			continue
		}
		k := copy(w.buf[len(w.buf):ChunkSize], p)
		w.buf = w.buf[:len(w.buf)+k]
		p = p[k:]
		n += k
		w.size += int64(k)
	}
	return n, nil
}

// seal encrypts pt as the next chunk and writes it. pt is either w.buf
// (sealed in place) or a caller's slice while w.buf is empty (w.buf is then
// only the output buffer).
func (w *Writer) seal(pt []byte, final bool) error {
	nonce := chunkNonce(w.index)
	aad := chunkAAD(w.index, final)
	ct := w.aead.Seal(w.buf[:0], nonce[:], pt, aad[:])
	if _, err := w.f.WriteAt(ct, HeaderSize+int64(w.index)*sealedChunk); err != nil {
		w.err = fmt.Errorf("crypt: writing chunk %d: %w", w.index, err)
		return w.err
	}
	w.index++
	w.buf = w.buf[:0]
	return nil
}

// Close seals the last chunk as final and rewrites the header with the
// plaintext length. It neither syncs nor closes the file: the caller fsyncs
// it before committing (§3.5 step 4). Calling Close again returns the first
// result.
func (w *Writer) Close() error {
	if w.closed {
		return w.err
	}
	w.closed = true
	if w.err != nil {
		return w.err
	}
	if err := w.seal(w.buf, true); err != nil {
		return err
	}
	hdr := encodeHeader(uint64(w.size))
	if _, err := w.f.WriteAt(hdr[:], 0); err != nil {
		w.err = fmt.Errorf("crypt: rewriting the header: %w", err)
		return w.err
	}
	return nil
}

// Size returns the number of plaintext bytes accepted so far; after a
// successful Close, the blob's plaintext length.
func (w *Writer) Size() int64 { return w.size }

// Encrypt streams src into dst, which must be empty, as an encrypted blob
// under key and returns the number of plaintext bytes written. dst is not
// synced or closed. On error the file is unusable and must be discarded.
func Encrypt(dst *os.File, key []byte, src io.Reader) (int64, error) {
	w, err := NewWriter(dst, key)
	if err != nil {
		return 0, err
	}
	if _, err := io.CopyBuffer(w, src, make([]byte, ChunkSize)); err != nil {
		return w.Size(), err
	}
	return w.Size(), w.Close()
}
