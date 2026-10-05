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

// This file holds what the pipeline package and the s3 package share with the
// engine: the stale-write guard of after runs (spec §7.8), the staged-view
// write of before runs, and a few helpers the pipeline package needs.

// Guard is the stale-write guard carried by the Actor of an after run's token
// (spec §7.8): a request that names the triggering key is implicitly
// conditional on that object still being the one the event is about. For
// created and updated events the key's live version must still be Version; for
// deleted events (Absent) the key must still have no visible object. The
// engine checks it inside the same transaction as the change it guards, at
// admission for a write (fast failure) and again at commit.
type Guard struct {
	Key     string
	Version string
	Absent  bool
}

// ErrObjectChanged is the 412 a violated guard answers with.
func ErrObjectChanged() *apierr.Error {
	return apierr.New("PreconditionFailed", "The object changed since this event.")
}

// Check reports whether the key's latest version row (nil: the key has no
// versions) satisfies the guard.
func (g *Guard) Check(latest *meta.Object) error {
	vis := latest != nil && !latest.DeleteMarker
	if g.Absent {
		if vis {
			return ErrObjectChanged()
		}
		return nil
	}
	if !vis || latest.Version != g.Version {
		return ErrObjectChanged()
	}
	return nil
}

// Pins reports whether a request for the S3 version id versionID of the
// guarded key pins the event's version, which is always allowed while that
// version exists (it can only touch that exact version).
func (g *Guard) Pins(versionID string) bool {
	return g != nil && !g.Absent && versionID != "" && versionID == g.Version
}

// Applies reports whether the guard covers requests naming key.
func (g *Guard) Applies(key string) bool { return g != nil && g.Key == key }

// StagedPut is a before run's replacement of the staged object: the body of the
// PUT its token made, with what the request said about content headers,
// metadata and tags (spec §7.8, "Staged view").
type StagedPut struct {
	Body io.Reader
	// Size is the declared plaintext length, -1 when unknown.
	Size int64
	// Algo is the additional checksum the request asked to be computed.
	Algo string
	// Verify checks Content-MD5, the signed payload hash and the checksum.
	Verify func(*Received) error

	// Headers holds the content headers the request specified; empty ones are
	// inherited from the staged object.
	Headers Headers
	// Metadata holds the user metadata the request specified; merged over the
	// staged object's, unless ReplaceMetadata.
	Metadata map[string]string
	// Tags are the tags the request specified, if TagsGiven; otherwise the
	// staged object's tags are inherited.
	Tags      map[string]string
	TagsGiven bool
	// ReplaceMetadata is x-binvault-replace-metadata: true: full S3 replace
	// semantics for headers, metadata and tags.
	ReplaceMetadata bool
	// IfMatch is the request's If-Match, checked against the staged ETag.
	IfMatch string
}

// BeforeBatch is shared by the entries of one DeleteObjects request, whose
// before delete chains share one budget (spec §5.4.4). State belongs to the
// pipeline package.
type BeforeBatch struct {
	State any
}

// TypeChecker returns the sniff callback that applies a bucket's
// allowed_content_types rule (nil without rules), for receiving a replacement
// body (spec §3.13).
func (e *Engine) TypeChecker(b *meta.Bucket) func(string) error { return e.typeChecker(b) }

// OpenStaged opens a staged file (not yet placed in blobs/) for reading its
// plaintext, decrypting it when it was staged encrypted. Every call opens its
// own file handle, so concurrent readers do not share an offset.
func (e *Engine) OpenStaged(ctx context.Context, b *meta.Bucket, rec *Received) (Body, error) {
	if rec == nil || rec.Staged == nil {
		return nil, errors.New("engine: no staged file")
	}
	f, err := os.Open(rec.Staged.Path)
	if err != nil {
		return nil, internal(err)
	}
	if !rec.Encrypted {
		return &plainBody{f: f, size: rec.Size}, nil
	}
	bk, err := e.BucketKey(ctx, b)
	if err != nil {
		f.Close()
		return nil, err
	}
	st, err := f.Stat()
	if err != nil {
		f.Close()
		return nil, internal(err)
	}
	cb, err := crypt.Open(f, st.Size(), crypt.DeriveKey(bk, rec.ID))
	if err != nil {
		f.Close()
		return nil, apierr.Wrap("InternalError", "The staged object cannot be decrypted.", err)
	}
	return &encBody{f: f, b: cb}, nil
}

// WrapError turns any error into an S3 error (internal errors pass through
// the same mapping the engine uses).
func WrapError(err error) error { return wrapErr(err) }
