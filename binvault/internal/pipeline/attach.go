package pipeline

import (
	"context"
	"errors"
	"sync"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// attEntry is one attachment as the node uses it: the stored row plus its
// compiled narrowing filter (spec §6.6, §7.3).
type attEntry struct {
	meta.Attachment
	match   Match
	matcher *Matcher
}

func newAttEntry(a meta.Attachment) attEntry {
	m, raw := compileJSON(a.Match)
	return attEntry{Attachment: a, match: raw, matcher: m}
}

// attSet is a bucket's ordered attachments at one revision.
type attSet struct {
	rev   int64
	items []attEntry
}

// attCache caches each bucket's attachments, validated by the bucket's
// attachments_revision (spec §6.6): a lookup that knows a newer revision than
// the cached one reloads. On a single node the admin handlers, the only
// writers, store the new list as they commit it, so a lookup normally never
// touches the database; a bucket without attachments costs one empty entry.
type attCache struct {
	mu       sync.RWMutex
	byBucket map[string]*attSet
}

func newAttCache() *attCache { return &attCache{byBucket: map[string]*attSet{}} }

func (c *attCache) get(bucket string) *attSet {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return c.byBucket[bucket]
}

// set stores a list unless the cache already holds a newer revision (a slow
// loader must not overwrite what a writer just stored).
func (c *attCache) set(bucket string, s *attSet) {
	c.mu.Lock()
	if cur := c.byBucket[bucket]; cur == nil || s.rev >= cur.rev {
		c.byBucket[bucket] = s
	}
	c.mu.Unlock()
}

func (c *attCache) forget(bucket string) {
	c.mu.Lock()
	delete(c.byBucket, bucket)
	c.mu.Unlock()
}

// attachments returns the bucket's attachments. minRev is the newest
// attachments_revision the caller has seen (0 = unknown): a cached list older
// than it is reloaded.
func (m *Manager) attachments(ctx context.Context, q meta.Q, bucket string, minRev int64) (*attSet, error) {
	if s := m.atts.get(bucket); s != nil && s.rev >= minRev {
		return s, nil
	}
	rev, err := q.AttachmentsRevision(ctx, bucket)
	if err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return &attSet{}, nil // the bucket is gone
		}
		return nil, err
	}
	rows, err := q.ListAttachments(ctx, bucket)
	if err != nil {
		return nil, err
	}
	s := &attSet{rev: rev, items: make([]attEntry, len(rows))}
	for i, a := range rows {
		s.items[i] = newAttEntry(a)
	}
	m.atts.set(bucket, s)
	return s, nil
}

// ForgetBucket drops what the node remembers of a bucket that was deleted.
func (m *Manager) ForgetBucket(name string) {
	m.atts.forget(name)
	m.frz.thaw(name)
	m.notify()
}
