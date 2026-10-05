package pipeline

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

// Seal record types of a pipeline's secrets (spec §4.7). The record id is the
// pipeline's name.
const (
	SealHeaders = "pipeline.headers"
	SealSigning = "pipeline.signing"
)

// Pipe is a pipeline as this node uses it: the definition, its opened secrets
// and the values derived from them. A Pipe is immutable once built; an edit
// builds a new one, so a run that holds a Pipe sees one consistent version.
type Pipe struct {
	// Def is the public form of the definition (header values redacted, no
	// signing secret); Revision, CreatedAt and UpdatedAt are filled in.
	Def        Definition
	Generation string

	// Headers are the opened service.headers values and Secret the opened
	// signing secret ("" = unsigned).
	Headers map[string]string
	Secret  string

	matcher   *Matcher
	timeout   time.Duration
	queueWait time.Duration
	backoff   []time.Duration
}

// Name is the pipeline's name.
func (p *Pipe) Name() string { return p.Def.Name }

// Before reports whether this is a before pipeline.
func (p *Pipe) Before() bool { return p.Def.Stage == StageBefore }

// Held reports whether new work for the pipeline is held: it is disabled, or
// (after only) paused. A before pipeline that is disabled is simply skipped.
func (p *Pipe) Held() bool { return !p.Def.Enabled || p.Def.Paused }

// Subscribes reports whether the pipeline listens to the event type.
func (p *Pipe) Subscribes(event string) bool { return contains(p.Def.Events, event) }

// MaxAttempts is retry.max_attempts.
func (p *Pipe) MaxAttempts() int { return p.Def.Retry.MaxAttempts }

// build derives the runtime values of a normalised definition.
func (p *Pipe) build() error {
	p.matcher = p.Def.Match.Compile()
	var err error
	if p.timeout, err = time.ParseDuration(p.Def.Service.Timeout); err != nil {
		return fmt.Errorf("service.timeout: %w", err)
	}
	if p.Def.Stage == StageBefore {
		if p.queueWait, err = time.ParseDuration(p.Def.Limits.QueueTimeout); err != nil {
			return fmt.Errorf("limits.queue_timeout: %w", err)
		}
	}
	p.backoff = p.backoff[:0]
	for _, b := range p.Def.Retry.Backoff {
		d, err := time.ParseDuration(b)
		if err != nil {
			return fmt.Errorf("retry.backoff: %w", err)
		}
		p.backoff = append(p.backoff, d)
	}
	return nil
}

// ---- persistence ----------------------------------------------------------------

// encoded is a pipeline ready to be written: the redacted definition JSON and
// the sealed secrets.
type encoded struct {
	definition string
	headers    []byte
	signing    []byte
}

// encode seals a normalised definition's secrets. headers are the clear header
// values, secret the clear signing secret ("" = none).
func encode(ring *seal.Keyring, def Definition, headers map[string]string, secret string) (encoded, error) {
	var out encoded
	pub := def.Public(secret != "")
	// what the row stores is the definition as responses show it, minus what
	// the columns hold
	pub.Revision, pub.CreatedAt, pub.UpdatedAt, pub.AttachedTo = 0, time.Time{}, time.Time{}, nil
	raw, err := json.Marshal(pub)
	if err != nil {
		return out, err
	}
	out.definition = string(raw)
	if len(headers) > 0 {
		hb, err := json.Marshal(headers)
		if err != nil {
			return out, err
		}
		if out.headers, err = ring.Seal(SealHeaders, def.Name, hb); err != nil {
			return out, err
		}
	}
	if secret != "" {
		if out.signing, err = ring.Seal(SealSigning, def.Name, []byte(secret)); err != nil {
			return out, err
		}
	}
	return out, nil
}

// open builds the runtime pipeline from a stored row, opening its secrets.
func open(ring *seal.Keyring, rec *meta.Pipeline) (*Pipe, error) {
	var def Definition
	if err := json.Unmarshal([]byte(rec.Definition), &def); err != nil {
		return nil, fmt.Errorf("pipeline %q: unreadable definition: %w", rec.Name, err)
	}
	def.Name, def.Stage = rec.Name, rec.Stage
	def.Revision, def.CreatedAt, def.UpdatedAt = rec.Revision, rec.CreatedAt, rec.UpdatedAt
	p := &Pipe{Def: def, Generation: rec.Generation, Headers: map[string]string{}}
	if len(rec.HeadersSealed) > 0 {
		raw, err := ring.Open(SealHeaders, rec.Name, rec.HeadersSealed)
		if err != nil {
			return nil, fmt.Errorf("pipeline %q: service.headers: %w", rec.Name, err)
		}
		if err := json.Unmarshal(raw, &p.Headers); err != nil {
			return nil, fmt.Errorf("pipeline %q: service.headers: %w", rec.Name, err)
		}
	}
	if len(rec.SigningSealed) > 0 {
		raw, err := ring.Open(SealSigning, rec.Name, rec.SigningSealed)
		if err != nil {
			return nil, fmt.Errorf("pipeline %q: service.signing_secret: %w", rec.Name, err)
		}
		p.Secret = string(raw)
	}
	p.Def.Service.HasSigningSecret = p.Secret != ""
	if p.Def.Service.Headers == nil {
		p.Def.Service.Headers = map[string]string{}
	}
	if err := p.build(); err != nil {
		return nil, fmt.Errorf("pipeline %q: %w", rec.Name, err)
	}
	return p, nil
}

// view is the definition as responses show it.
func (p *Pipe) view() Definition { return p.Def.Public(p.Secret != "") }

// CheckSecrets opens every sealed pipeline value (boot and `validate`, spec
// §4.7) and returns a description of each one the keyring cannot open, plus
// the number of values checked.
func CheckSecrets(ctx context.Context, db *meta.DB, ring *seal.Keyring) (problems []string, n int, err error) {
	after := ""
	for {
		ps, err := db.Read().ListPipelines(ctx, after, 200)
		if err != nil {
			return nil, 0, err
		}
		for _, p := range ps {
			after = p.Name
			if len(p.HeadersSealed) > 0 {
				n++
				if _, err := ring.Open(SealHeaders, p.Name, p.HeadersSealed); err != nil {
					problems = append(problems, fmt.Sprintf("pipeline %s service.headers: %v", p.Name, err))
				}
			}
			if len(p.SigningSealed) > 0 {
				n++
				if _, err := ring.Open(SealSigning, p.Name, p.SigningSealed); err != nil {
					problems = append(problems, fmt.Sprintf("pipeline %s service.signing_secret: %v", p.Name, err))
				}
			}
		}
		if len(ps) < 200 {
			return problems, n, nil
		}
	}
}

// RekeySecrets re-seals every pipeline secret under the current key (spec
// §4.7) inside tx and returns how many values were rewritten.
func RekeySecrets(ctx context.Context, tx *meta.Tx, ring *seal.Keyring) (int, error) {
	changed := 0
	after := ""
	for {
		ps, err := tx.ListPipelines(ctx, after, 200)
		if err != nil {
			return changed, err
		}
		for _, p := range ps {
			after = p.Name
			h, s := p.HeadersSealed, p.SigningSealed
			dirty := false
			if len(h) > 0 {
				out, ch, err := ring.Reseal(SealHeaders, p.Name, h)
				if err != nil {
					return changed, fmt.Errorf("pipeline %s service.headers: %w", p.Name, err)
				}
				if ch {
					h, dirty = out, true
					changed++
				}
			}
			if len(s) > 0 {
				out, ch, err := ring.Reseal(SealSigning, p.Name, s)
				if err != nil {
					return changed, fmt.Errorf("pipeline %s service.signing_secret: %w", p.Name, err)
				}
				if ch {
					s, dirty = out, true
					changed++
				}
			}
			if dirty {
				if err := tx.SetPipelineSecrets(ctx, p.Name, h, s); err != nil {
					return changed, err
				}
			}
		}
		if len(ps) < 200 {
			return changed, nil
		}
	}
}

// ---- the pipeline cache ---------------------------------------------------------

// pipeCache holds every pipeline of the node, built. Pipelines are few (at
// most 256, spec §3.8) and read on every event, so all of them stay in memory;
// the admin handlers, the only writers on a single node, keep it current. A
// cluster would call set and remove when a catalog op arrives (spec §8.7).
type pipeCache struct {
	mu   sync.RWMutex
	byID map[string]*Pipe
}

func newPipeCache() *pipeCache { return &pipeCache{byID: map[string]*Pipe{}} }

func (c *pipeCache) get(name string) *Pipe {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.byID[name]
}

func (c *pipeCache) set(p *Pipe) {
	c.mu.Lock()
	c.byID[p.Name()] = p
	c.mu.Unlock()
}

func (c *pipeCache) remove(name string) {
	c.mu.Lock()
	delete(c.byID, name)
	c.mu.Unlock()
}

// all returns the cached pipelines ordered by name.
func (c *pipeCache) all() []*Pipe {
	c.mu.RLock()
	out := make([]*Pipe, 0, len(c.byID))
	for _, p := range c.byID {
		out = append(out, p)
	}
	c.mu.RUnlock()
	sort.Slice(out, func(i, j int) bool { return out[i].Name() < out[j].Name() })
	return out
}

// pipe returns the named pipeline, loading it when the cache has not seen it
// (nil when it does not exist). q reads through the caller's transaction when
// the caller is inside one.
func (m *Manager) pipe(ctx context.Context, q meta.Q, name string) (*Pipe, error) {
	if p := m.pipes.get(name); p != nil {
		return p, nil
	}
	rec, err := q.GetPipeline(ctx, name)
	if errors.Is(err, meta.ErrNotFound) {
		return nil, nil
	}
	if err != nil {
		return nil, err
	}
	p, err := open(m.ring, rec)
	if err != nil {
		return nil, err
	}
	m.pipes.set(p)
	return p, nil
}
