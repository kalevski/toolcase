package pipeline

import (
	"context"
	"sync"
	"sync/atomic"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/s3"
)

// TokenGrace is how long a pipeline token outlives its attempt's deadline if it
// was somehow not revoked sooner (spec §7.8).
const TokenGrace = 30 * time.Second

// tokenRegistry is the node's pipeline tokens (spec §7.8): in memory only,
// never persisted, one per attempt. It implements s3.PipelineTokens. All of its
// state is node-local; nothing about a token is replicated or stored.
type tokenRegistry struct {
	mu   sync.RWMutex
	byID map[string]*token
	now  func() time.Time
	// onRevoke is told the access key id of every token that ends, so caches
	// keyed by it can drop their entries.
	onRevoke func(id string)
}

func newTokenRegistry(now func() time.Time) *tokenRegistry {
	return &tokenRegistry{byID: map[string]*token{}, now: now}
}

// token is one pipeline token and the state its requests share: the lineage of
// the event, the stale-write guard of an after run, or the staged view of a
// before run. It implements s3.PipelineToken.
type token struct {
	reg    *tokenRegistry
	id     string
	secret string

	pipeline string
	run      string
	bucket   string

	principal *auth.Principal
	grants    []meta.Grant // expanded, as shown to the service

	// ctx ends when the token is revoked or expires; every request made with the
	// token is bound to it (spec §7.8).
	ctx     context.Context
	cancel  context.CancelFunc
	expires time.Time
	revoked atomic.Bool

	depth int
	chain []string
	guard *engine.Guard

	// staged is the attempt of a before run working on a staged write.
	staged *attempt
}

var (
	_ s3.PipelineTokens = (*Manager)(nil)
	_ s3.PipelineToken  = (*token)(nil)
)

// mintSpec describes a token to mint.
type mintSpec struct {
	Pipeline string
	Run      string
	Bucket   string
	// Grants are the pipeline's grants with the templates already expanded.
	Grants []meta.Grant
	// Deadline is when the attempt is abandoned; the token expires TokenGrace
	// later if it is not revoked before.
	Deadline time.Time
	// Depth and Chain are the lineage of the event the run reacts to.
	Depth int
	Chain []string
	// Guard is the stale-write guard of an after run (nil otherwise).
	Guard *engine.Guard
	// Staged is the attempt of a before run on a staged write (nil otherwise).
	Staged *attempt
}

// mint creates and registers a token. The caller must end it (revoke) when the
// attempt is over.
func (r *tokenRegistry) mint(sp mintSpec) (*token, error) {
	grants, err := auth.CompileExpanded(sp.Grants)
	if err != nil {
		return nil, err
	}
	id, secret := auth.NewAccessKeyID(auth.PipelineKeyPrefix), auth.NewSecret()
	expires := sp.Deadline.Add(TokenGrace)
	ctx, cancel := context.WithDeadline(context.Background(), expires)
	t := &token{
		reg: r, id: id, secret: secret, pipeline: sp.Pipeline, run: sp.Run, bucket: sp.Bucket,
		grants: sp.Grants, ctx: ctx, cancel: cancel, expires: expires,
		depth: sp.Depth, chain: append([]string(nil), sp.Chain...), guard: sp.Guard, staged: sp.Staged,
	}
	t.principal = &auth.Principal{
		Kind: auth.KindPipeline, AccessKey: id, Name: sp.Pipeline, Bucket: sp.Bucket, Grants: grants,
		Run: sp.Run, Pipeline: t,
	}
	r.mu.Lock()
	r.byID[id] = t
	r.mu.Unlock()
	return t, nil
}

// lookup returns a live token.
func (r *tokenRegistry) lookup(id string) *token {
	r.mu.RLock()
	t := r.byID[id]
	r.mu.RUnlock()
	if t == nil || t.revoked.Load() || !r.now().Before(t.expires) {
		return nil
	}
	return t
}

// sweep drops tokens past their expiry that were never revoked (spec §3.9).
func (r *tokenRegistry) sweep() int {
	now := r.now()
	var gone []*token
	r.mu.RLock()
	for _, t := range r.byID {
		if !now.Before(t.expires) {
			gone = append(gone, t)
		}
	}
	r.mu.RUnlock()
	for _, t := range gone {
		t.revoke()
	}
	return len(gone)
}

// count is the number of live tokens (tests, metrics).
func (r *tokenRegistry) count() int {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return len(r.byID)
}

// revoke ends the token: it stops authenticating at once and every request it
// has in flight is aborted (their contexts end, spec §7.8). It is idempotent.
func (t *token) revoke() {
	if !t.revoked.CompareAndSwap(false, true) {
		return
	}
	t.reg.mu.Lock()
	delete(t.reg.byID, t.id)
	t.reg.mu.Unlock()
	t.cancel()
	if t.reg.onRevoke != nil {
		t.reg.onRevoke(t.id)
	}
}

// Lookup implements s3.PipelineTokens.
func (m *Manager) Lookup(accessKeyID string) (*auth.Principal, string, bool) {
	t := m.toks.lookup(accessKeyID)
	if t == nil {
		return nil, "", false
	}
	return t.principal, t.secret, true
}

// ---- s3.PipelineToken -----------------------------------------------------------

// Context implements s3.PipelineToken.
func (t *token) Context() context.Context { return t.ctx }

// Lineage implements s3.PipelineToken.
func (t *token) Lineage() (int, []string) { return t.depth, t.chain }

// Guard implements s3.PipelineToken.
func (t *token) Guard() *engine.Guard { return t.guard }

// StagedKey implements s3.PipelineToken.
func (t *token) StagedKey() string {
	if t.staged == nil {
		return ""
	}
	return t.staged.s.key
}

var errNoStaged = apierr.New("AccessDenied", "This token has no staged object.")

// StagedObject implements s3.PipelineToken.
func (t *token) StagedObject() (*meta.Object, bool) {
	if t.staged == nil {
		return nil, true
	}
	return t.staged.object()
}

// StagedOpen implements s3.PipelineToken.
func (t *token) StagedOpen(ctx context.Context) (engine.Body, error) {
	if t.staged == nil {
		return nil, errNoStaged
	}
	return t.staged.open(ctx)
}

// StagedPut implements s3.PipelineToken.
func (t *token) StagedPut(ctx context.Context, in *engine.StagedPut) (*meta.Object, error) {
	if t.staged == nil {
		return nil, errNoStaged
	}
	return t.staged.put(ctx, in)
}

// StagedDelete implements s3.PipelineToken.
func (t *token) StagedDelete() error {
	if t.staged == nil {
		return errNoStaged
	}
	return t.staged.del()
}

// StagedSetTags implements s3.PipelineToken.
func (t *token) StagedSetTags(tags map[string]string) error {
	if t.staged == nil {
		return errNoStaged
	}
	return t.staged.setTags(tags)
}
