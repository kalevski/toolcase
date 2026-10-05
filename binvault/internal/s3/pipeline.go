package s3

import (
	"context"
	"errors"
	"io"
	"net/http"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// This file is the data plane's side of pipeline tokens (spec §7.8): the
// interface a token's state implements, the binding of a request to the token's
// lifetime, the staged view of before runs, and the stale-write guard of after
// runs. The pipeline package implements PipelineToken; nothing here knows how a
// run is scheduled.

// PipelineToken is the state of one pipeline token, carried in
// auth.Principal.Pipeline.
type PipelineToken interface {
	// Context ends when the token is revoked (its attempt ended) or expires:
	// every request made with the token is bound to it and aborted with it.
	Context() context.Context
	// Lineage is the causal depth and pipeline chain of the event the run reacts
	// to; writes made with the token carry depth+1 and the pipeline appended
	// (spec §7.11).
	Lineage() (depth int, chain []string)
	// Guard is the stale-write guard of an after run (nil for other runs).
	Guard() *engine.Guard

	// StagedKey is the key of the staged object of a before run that works on a
	// write ("" for every other run). The token sees the staged view of that key
	// and may not write anywhere else.
	StagedKey() string
	// StagedObject is the staged object as the token's attempt currently sees
	// it; deleted is true once the attempt marked it rejected.
	StagedObject() (o *meta.Object, deleted bool)
	// StagedOpen opens the staged bytes for reading.
	StagedOpen(ctx context.Context) (engine.Body, error)
	// StagedPut replaces the staged object (applied only if the attempt
	// succeeds) and returns the object as it now looks.
	StagedPut(ctx context.Context, in *engine.StagedPut) (*meta.Object, error)
	// StagedDelete marks the staged object rejected.
	StagedDelete() error
	// StagedSetTags changes the staged object's tags.
	StagedSetTags(tags map[string]string) error
}

// pipe returns the request principal's pipeline state, or nil.
func (rc *reqCtx) pipe() PipelineToken {
	if rc.p == nil || rc.p.Kind != auth.KindPipeline {
		return nil
	}
	pt, _ := rc.p.Pipeline.(PipelineToken)
	return pt
}

// guard returns the stale-write guard of the request's token, if any.
func (rc *reqCtx) guard() *engine.Guard {
	if pt := rc.pipe(); pt != nil {
		return pt.Guard()
	}
	return nil
}

// isBeforeToken reports whether the token belongs to a before run working on a
// staged write.
func (rc *reqCtx) isBeforeToken() bool {
	pt := rc.pipe()
	return pt != nil && pt.StagedKey() != ""
}

// staged returns the token when key is the staged key of a before run.
func (rc *reqCtx) staged(key string) PipelineToken {
	if pt := rc.pipe(); pt != nil && pt.StagedKey() != "" && pt.StagedKey() == key {
		return pt
	}
	return nil
}

// errRevoked is what a request sees when its token ended mid-flight.
func errRevoked() *apierr.Error {
	return apierr.New("InvalidAccessKeyId", "The pipeline token ended; its requests are aborted.")
}

// bindPipelineRequest ties a pipeline-token request to the token's lifetime:
// the request context is cancelled when the token is revoked, a body being read
// stops at once, and a transfer in flight is cut. The returned function ends
// the binding when the handler returns; it cuts the connection if the token
// ended during the request, since its deadlines were used to abort the I/O.
func (s *Server) bindPipelineRequest(rc *reqCtx, pt PipelineToken) (func(), error) {
	tctx := pt.Context()
	if tctx.Err() != nil {
		return func() {}, errRevoked()
	}
	ctx, cancel := context.WithCancel(rc.r.Context())
	rctl := http.NewResponseController(rc.w)
	var mu sync.Mutex
	finished, aborted := false, false
	stop := context.AfterFunc(tctx, func() {
		mu.Lock()
		defer mu.Unlock()
		if finished {
			return
		}
		aborted = true
		cancel()
		now := time.Now()
		_ = rctl.SetReadDeadline(now)
		_ = rctl.SetWriteDeadline(now)
	})
	rc.ctx = ctx
	rc.r = rc.r.WithContext(ctx)
	rc.r.Body = &revocableBody{ReadCloser: rc.r.Body, ctx: tctx}
	return func() {
		stop()
		mu.Lock()
		finished = true
		cut := aborted
		mu.Unlock()
		cancel()
		if cut {
			panic(http.ErrAbortHandler)
		}
	}, nil
}

// revocableBody stops a request body at once when the token ends.
type revocableBody struct {
	io.ReadCloser
	ctx context.Context
}

func (b *revocableBody) Read(p []byte) (int, error) {
	if b.ctx.Err() != nil {
		return 0, errRevoked()
	}
	n, err := b.ReadCloser.Read(p)
	if err != nil && b.ctx.Err() != nil {
		err = errRevoked()
	}
	return n, err
}

// beforeGate restricts a before run's token to the staged view (spec §7.8):
// GET/HEAD, one PUT and DELETE on the staged key, tagging, and reads and
// listings of committed data. Multipart, copies, batch deletes and any request
// that carries a versionId are refused: they would reach the committed object
// or commit unvetted bytes in the middle of the chain.
func (rc *reqCtx) beforeGate() error {
	if rc.t.Query.Has("versionId") {
		return accessDenied("A before pipeline's token cannot address object versions.")
	}
	switch rc.op {
	case OpCreateMultipartUpload, OpUploadPart, OpUploadPartCopy, OpCompleteMultipartUpload, OpAbortMultipartUpload,
		OpListParts, OpCopyObject, OpDeleteObjects, OpPostObject, OpPutObjectAcl:
		return accessDenied("A before pipeline's token may only replace, delete or tag the staged object with a single request.")
	}
	return nil
}

// lookupRead resolves the version a read addresses. A before run's token sees
// the staged object at its key; an after run's token is held to the stale-write
// guard (spec §7.8).
func (s *Server) lookupRead(rc *reqCtx, key, versionID string) (*meta.Object, PipelineToken, error) {
	if pt := rc.staged(key); pt != nil {
		o, deleted := pt.StagedObject()
		if deleted {
			return nil, nil, apierr.New("NoSuchKey", "The specified key does not exist.").WithExtra("Key", key)
		}
		return o, pt, nil
	}
	g := rc.guard()
	guarded := g.Applies(key) && !g.Pins(versionID)
	if guarded && versionID != "" {
		// naming another version: the live one must still be the event's
		if err := s.checkLive(rc, g, key); err != nil {
			return nil, nil, err
		}
	}
	obj, err := s.Eng.Lookup(rc.ctx, rc.b, key, versionID)
	if guarded && versionID == "" {
		// a plain read resolves the live version itself: compare what it found
		switch {
		case g.Absent && err == nil:
			return nil, nil, engine.ErrObjectChanged()
		case !g.Absent && err == nil && obj.Version != g.Version:
			return nil, nil, engine.ErrObjectChanged()
		case !g.Absent && err != nil && apierr.Is(err, "NoSuchKey"):
			return nil, nil, engine.ErrObjectChanged()
		}
	}
	return obj, nil, err
}

// checkLive applies the guard to the key's live version.
func (s *Server) checkLive(rc *reqCtx, g *engine.Guard, key string) error {
	latest, err := s.Eng.DB.Read().GetLatest(rc.ctx, rc.b.Name, key)
	if err != nil && !errors.Is(err, meta.ErrNotFound) {
		return apierr.Wrap("InternalError", "We encountered an internal error. Please try again.", err)
	}
	if err != nil {
		latest = nil
	}
	return g.Check(latest)
}

// openObjectBody opens the bytes of a looked-up object: the staged bytes for a
// staged view, the stored blob otherwise.
func (s *Server) openObjectBody(rc *reqCtx, obj *meta.Object, staged PipelineToken) (engine.Body, error) {
	if staged != nil {
		return staged.StagedOpen(rc.ctx)
	}
	return s.Eng.OpenBody(rc.ctx, rc.b, obj)
}
