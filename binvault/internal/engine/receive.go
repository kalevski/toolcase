package engine

import (
	"context"
	"crypto/md5"
	"crypto/sha256"
	"errors"
	"hash"
	"io"
	"net/http"
	"os"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/checksum"
	"github.com/kalevski/toolcase/binvault/internal/crypt"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/store"
)

// ReceiveOpts control how a body is streamed into staging (spec §3.5 step 2).
type ReceiveOpts struct {
	Bucket *meta.Bucket
	// Size is the declared plaintext length, -1 when unknown.
	Size int64
	// MaxBytes caps the plaintext length (EntityTooLarge beyond it).
	MaxBytes int64
	// Encrypt stores the body as an SSE-S3 blob.
	Encrypt bool
	// Algo is the additional checksum to compute ("" = none).
	Algo string
	// Algos computes several (multipart parts need none; copies none).
	// CheckType, when set, receives the sniffed type as soon as it is known;
	// a non-nil error switches to drain mode: the rest of the body is read and
	// discarded, nothing is stored, and the error is returned at the end
	// (spec §3.13).
	CheckType func(sniffed string) error
	// PartFile, when set, stages into this part file instead of a new blob file
	// (multipart UploadPart); the returned Received.ID is its id.
	Part *store.Staged
	// KeySalt overrides the blob id used to derive the encryption key (a part
	// file is keyed by its part id).
	NoSniff bool
}

// Received is the outcome of streaming a body into staging.
type Received struct {
	Staged     *store.Staged // nil when drained
	ID         string
	Size       int64 // plaintext bytes
	StoredSize int64 // bytes on disk
	MD5        []byte
	SHA256     []byte
	Checksum   []byte // raw digest of ReceiveOpts.Algo
	Algo       string
	Sniffed    string
	Encrypted  bool
}

// Discard removes the staging file.
func (r *Received) Discard() {
	if r != nil && r.Staged != nil {
		r.Staged.Discard()
		r.Staged = nil
	}
}

// Receive streams body into a staging file while hashing, sniffing, optionally
// encrypting, and enforcing the size cap. Memory use is independent of size.
func (e *Engine) Receive(ctx context.Context, body io.Reader, o ReceiveOpts) (*Received, error) {
	st := o.Part
	var err error
	if st == nil {
		st, err = e.Store.NewStaged()
		if err != nil {
			return nil, internal(err)
		}
	}
	ok := false
	defer func() {
		if !ok {
			st.Discard()
		}
	}()

	var sink io.Writer = st.File
	var cw *crypt.Writer
	if o.Encrypt {
		bk, err := e.BucketKey(ctx, o.Bucket)
		if err != nil {
			return nil, err
		}
		key := crypt.DeriveKey(bk, st.ID)
		cw, err = crypt.NewWriter(st.File, key)
		if err != nil {
			return nil, internal(err)
		}
		sink = cw
	}
	md, sh := md5.New(), sha256.New()
	var extra hash.Hash
	if o.Algo != "" {
		a, ok := checksum.ParseAlgo(o.Algo)
		if !ok {
			return nil, apierr.New("InvalidRequest", "Unsupported checksum algorithm.")
		}
		extra = a.New()
	}

	buf := store.Buffer()
	defer store.PutBuffer(buf)

	var total int64
	sniff := make([]byte, 0, SniffLen)
	sniffed := ""
	sniffDone := o.NoSniff
	var reject error
	drain := false

	decide := func() {
		sniffDone = true
		sniffed = Sniff(sniff)
		if o.CheckType != nil {
			if err := o.CheckType(sniffed); err != nil {
				reject, drain = err, true
				if cw == nil { // plain file: drop what was written so far
					_ = st.File.Truncate(0)
				}
			}
		}
	}

	for {
		if err := ctx.Err(); err != nil {
			return nil, err // the client is gone: stop (matters for long assemblies)
		}
		n, rerr := body.Read(*buf)
		if n > 0 {
			chunk := (*buf)[:n]
			total += int64(n)
			if o.MaxBytes > 0 && total > o.MaxBytes {
				return nil, apierr.New("EntityTooLarge", "Your proposed upload exceeds the maximum allowed object size.")
			}
			if !sniffDone && len(sniff) < SniffLen {
				take := SniffLen - len(sniff)
				if take > n {
					take = n
				}
				sniff = append(sniff, chunk[:take]...)
				if len(sniff) == SniffLen {
					decide()
				}
			}
			if !drain {
				md.Write(chunk)
				sh.Write(chunk)
				if extra != nil {
					extra.Write(chunk)
				}
				if _, werr := sink.Write(chunk); werr != nil {
					return nil, e.writeErr(werr)
				}
			}
		}
		if rerr != nil {
			if rerr == io.EOF {
				break
			}
			return nil, readErr(rerr)
		}
	}
	if !sniffDone {
		decide()
	}
	if o.Size >= 0 && total != o.Size {
		return nil, apierr.New("IncompleteBody", "You did not provide the number of bytes specified by the Content-Length HTTP header.")
	}
	if drain {
		return nil, reject
	}
	if cw != nil {
		if err := cw.Close(); err != nil {
			return nil, e.writeErr(err)
		}
	}
	stored := total
	if cw != nil {
		stored = crypt.EncryptedSize(total)
	}
	r := &Received{
		Staged: st, ID: st.ID, Size: total, StoredSize: stored,
		MD5: md.Sum(nil), SHA256: sh.Sum(nil), Sniffed: sniffed, Encrypted: o.Encrypt, Algo: o.Algo,
	}
	if extra != nil {
		r.Checksum = extra.Sum(nil)
	}
	ok = true
	return r, nil
}

// writeErr maps staging-file write failures (disk full) to S3 errors.
func (e *Engine) writeErr(err error) error {
	if isNoSpace(err) {
		return apierr.New("StorageFull", "The storage is full.")
	}
	return internal(err)
}

// readErr maps request-body read failures to S3 errors.
func readErr(err error) error {
	if _, ok := apierr.As(err); ok {
		return err
	}
	var mbe *http.MaxBytesError
	switch {
	case errors.Is(err, io.ErrUnexpectedEOF):
		return apierr.New("IncompleteBody", "You did not provide the number of bytes specified by the Content-Length HTTP header.")
	case errors.Is(err, httpx.ErrIdle), errors.Is(err, os.ErrDeadlineExceeded):
		return apierr.New("RequestTimeout", "Your socket connection to the server was not read from or written to within the timeout period.")
	case errors.As(err, &mbe):
		return apierr.New("EntityTooLarge", "Your proposed upload exceeds the maximum allowed size.")
	case errors.Is(err, context.Canceled):
		return err
	}
	return apierr.Wrap("IncompleteBody", "The request body could not be read.", err)
}
