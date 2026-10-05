package engine

import (
	"context"
	"errors"
	"io"
	"os"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/crypt"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// Lookup resolves a key (and optional S3 version id) to a version row for a
// read (spec §3.10, §5.4.2): a plain read of a key whose latest version is a
// delete marker is NoSuchKey; a version id that names a marker is
// MethodNotAllowed; an unknown id is NoSuchVersion.
func (e *Engine) Lookup(ctx context.Context, b *meta.Bucket, key, versionID string) (*meta.Object, error) {
	q := e.DB.Read()
	if b.Versioning != meta.VersioningEnabled {
		if versionID == "null" {
			versionID = ""
		} else if versionID != "" {
			return nil, apierr.New("InvalidArgument", "Invalid version id specified: this bucket is not versioned.")
		}
	}
	if versionID == "" {
		o, err := q.GetLatest(ctx, b.Name, key)
		if err != nil {
			if errors.Is(err, meta.ErrNotFound) {
				return nil, noSuchKey(key)
			}
			return nil, internal(err)
		}
		if o.DeleteMarker {
			return nil, noSuchKey(key).WithHeader("x-amz-delete-marker", "true").WithHeader("x-amz-version-id", o.S3VersionID())
		}
		return o, nil
	}
	o, err := q.GetS3Version(ctx, b.Name, key, versionID)
	if err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return nil, apierr.New("NoSuchVersion", "The specified version does not exist.").WithExtra("Key", key).WithExtra("VersionId", versionID)
		}
		return nil, internal(err)
	}
	if o.DeleteMarker {
		return nil, apierr.New("MethodNotAllowed", "The specified method is not allowed against this resource.").
			WithHeader("x-amz-delete-marker", "true").WithHeader("x-amz-version-id", o.S3VersionID()).WithHeader("Allow", "DELETE")
	}
	return o, nil
}

// Body is random access to an object's plaintext bytes.
type Body interface {
	io.ReaderAt
	// Size is the plaintext length.
	Size() int64
	// WriteRange streams [off, off+n) to w.
	WriteRange(w io.Writer, off, n int64) (int64, error)
	Close() error
}

type plainBody struct {
	f    *os.File
	size int64
}

func (p *plainBody) ReadAt(b []byte, off int64) (int, error) { return p.f.ReadAt(b, off) }
func (p *plainBody) Size() int64                             { return p.size }
func (p *plainBody) Close() error                            { return p.f.Close() }

// WriteRange seeks and copies with CopyN so net/http can use sendfile.
func (p *plainBody) WriteRange(w io.Writer, off, n int64) (int64, error) {
	if _, err := p.f.Seek(off, io.SeekStart); err != nil {
		return 0, err
	}
	return io.CopyN(w, p.f, n)
}

type encBody struct {
	f *os.File
	b *crypt.Blob
}

func (c *encBody) Size() int64  { return c.b.Size() }
func (c *encBody) Close() error { return c.f.Close() }
func (c *encBody) ReadAt(p []byte, off int64) (int, error) {
	if off >= c.b.Size() {
		return 0, io.EOF
	}
	n := int64(len(p))
	short := false
	if off+n > c.b.Size() {
		n, short = c.b.Size()-off, true
	}
	r, err := c.b.NewReader(off, n)
	if err != nil {
		return 0, err
	}
	m, err := io.ReadFull(r, p[:n])
	if err == nil && short {
		err = io.EOF
	}
	return m, err
}

func (c *encBody) WriteRange(w io.Writer, off, n int64) (int64, error) {
	r, err := c.b.NewReader(off, n)
	if err != nil {
		return 0, err
	}
	return io.Copy(w, r)
}

// openEncrypted authenticates the blob header and returns a decrypting Body.
func (e *Engine) openEncrypted(ctx context.Context, b *meta.Bucket, f *os.File, o *meta.Object) (Body, error) {
	fail := func(err error) (Body, error) {
		f.Close()
		e.Log.Error("cannot open encrypted blob", "blob", o.BlobID, "bucket", o.Bucket, "key", o.Key, "error", err)
		return nil, apierr.Wrap("InternalError", "The object's data cannot be decrypted.", err)
	}
	if len(b.DataKey) == 0 {
		return fail(errors.New("bucket has no data key"))
	}
	bk, err := e.openBucketKey(b)
	if err != nil {
		f.Close()
		return nil, err
	}
	st, err := f.Stat()
	if err != nil {
		return fail(err)
	}
	cb, err := crypt.Open(f, st.Size(), crypt.DeriveKey(bk, o.BlobID))
	if err != nil {
		return fail(err)
	}
	return &encBody{f: f, b: cb}, nil
}

// OpenBody opens an object's blob for reading, decrypting when it is encrypted.
func (e *Engine) OpenBody(ctx context.Context, b *meta.Bucket, o *meta.Object) (Body, error) {
	if o.BlobID == "" {
		return nil, errors.New("engine: object has no blob")
	}
	f, err := e.Store.Open(o.BlobID)
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			e.Log.Error("blob missing", "blob", o.BlobID, "bucket", o.Bucket, "key", o.Key)
			return nil, apierr.Wrap("InternalError", "The object's data is missing.", err)
		}
		return nil, internal(err)
	}
	if o.SSE {
		return e.openEncrypted(ctx, b, f, o)
	}
	return &plainBody{f: f, size: o.Size}, nil
}
