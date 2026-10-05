package cluster

import (
	"context"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/hlc"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// compactState is what the last compaction run learnt.
type compactState struct {
	blocked []string
	last    time.Time
	result  CompactResult
}

// CompactResult says what a compaction run did.
type CompactResult struct {
	// Ops is the number of ops removed from the log, Tombstones the number of
	// tombstone registers purged.
	Ops        int64
	Tombstones int64
	// Blocked names the URLs whose silence stopped the run altogether: a URL that
	// has never answered, so nobody knows what it has applied.
	Blocked []string
}

func (n *Node) compactLoop(ctx context.Context) {
	t := time.NewTicker(n.tune.CompactEvery)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			if res, err := n.Compact(ctx); err != nil {
				n.log.Error("compacting the catalog log failed", "error", err)
			} else if res.Ops > 0 || res.Tombstones > 0 {
				n.log.Info("compacted the catalog log", "ops", res.Ops, "tombstones", res.Tombstones)
			}
		}
	}
}

// Compact removes what no peer needs any more (spec §8.5): an op or tombstone
// older than BINVAULT_CLUSTER_RETENTION that every known peer has acknowledged.
//
//   - A peer's acknowledgement is the version vector of its last pull. Per origin
//     only ops up to the lowest acknowledged seq go, so a peer that is down or
//     behind holds back what it has not acknowledged. After this node restarts it
//     knows no acknowledgement until each peer pulls once, and removes nothing.
//   - Retired ids never hold compaction back. A configured URL that has never
//     answered does, completely: nothing is known about what it holds.
//   - A tombstone is purged only when its own op is older than the retention and
//     acknowledged by every known peer. Purging earlier would let a node that was
//     offline resurrect the deleted register; a snapshot that merely covers the
//     op does not count (a tombstone merged from a snapshot is as young as its
//     op).
//
// A peer that lost its state or fell behind the compacted prefix catches up by
// snapshot.
func (n *Node) Compact(ctx context.Context) (CompactResult, error) {
	var res CompactResult
	if !n.Ready() {
		return res, ErrNotReady
	}
	vv, err := n.db.Read().CatalogVV(ctx)
	if err != nil {
		return res, err
	}
	acks, blocked := n.compactionAcks()
	if len(blocked) > 0 {
		n.mu.Lock()
		n.compact.blocked, n.compact.last = blocked, n.now()
		n.mu.Unlock()
		res.Blocked = blocked
		return res, nil
	}
	cutoff := hlc.FromTime(n.now().Add(-n.retention))
	safe := make(map[string]int64, len(vv))
	for o, top := range vv {
		s := top
		for _, ack := range acks {
			s = min(s, ack[o])
		}
		safe[o] = s
	}
	n.wmu.Lock()
	defer n.wmu.Unlock()
	err = n.db.Update(ctx, func(tx *meta.Tx) error {
		res.Ops, res.Tombstones = 0, 0
		for o, upTo := range safe {
			if upTo <= 0 {
				continue
			}
			d, err := tx.CatalogCompactOps(ctx, o, upTo, uint64(cutoff))
			if err != nil {
				return err
			}
			res.Ops += d
		}
		tombs, err := tx.CatalogTombstones(ctx)
		if err != nil {
			return err
		}
		for _, t := range tombs {
			if hlc.Timestamp(t.HLC) >= cutoff || t.Seq > safe[t.Origin] {
				continue
			}
			ok, err := tx.CatalogPurgeTombstone(ctx, t.Key, t.Origin, t.Seq)
			if err != nil {
				return err
			}
			if ok {
				res.Tombstones++
			}
		}
		return nil
	})
	if err != nil {
		return CompactResult{}, err
	}
	n.mu.Lock()
	n.compact.blocked, n.compact.last, n.compact.result = nil, n.now(), res
	n.mu.Unlock()
	return res, nil
}

// compactionAcks returns the last acknowledged version vector of every active
// peer (an empty one for a peer that has not pulled since this node started), or
// the URLs that block the run altogether.
func (n *Node) compactionAcks() (acks []map[string]int64, blocked []string) {
	n.mu.Lock()
	defer n.mu.Unlock()
	seen := map[string]bool{}
	for _, u := range n.urls {
		s := n.us[u]
		id := s.id
		if id == "" {
			id = n.urlIDs[u]
		}
		switch {
		case s.class == classSelf || (id == n.id && s.class != classClone):
			continue
		case id == "":
			blocked = append(blocked, u)
			continue
		case s.class == classClone || seen[id] || n.retiredLocked(id):
			continue
		}
		seen[id] = true
		ack := n.acks[id]
		if ack == nil {
			ack = map[string]int64{}
		}
		acks = append(acks, ack)
	}
	return acks, blocked
}

// CompactionBlockedBy names what keeps the op log from being compacted (GET
// /cluster, §8.5): URLs that have never answered, and peers that do not answer
// now (their last acknowledgement is all the log can be cut to).
func (n *Node) CompactionBlockedBy() []string {
	n.mu.Lock()
	defer n.mu.Unlock()
	idOf := func(u string) string {
		if id := n.us[u].id; id != "" {
			return id
		}
		return n.urlIDs[u]
	}
	reachable := map[string]bool{}
	for _, u := range n.urls {
		if s := n.us[u]; s.up {
			reachable[idOf(u)] = true
		}
	}
	var out []string
	seen := map[string]bool{}
	for _, u := range n.urls {
		s := n.us[u]
		id := idOf(u)
		switch {
		case s.class == classSelf || s.up || (id == n.id && s.class != classClone):
			continue
		case id == "":
			out = append(out, u+" (has never answered)")
		case reachable[id] || seen[id] || n.retiredLocked(id):
			continue
		default:
			seen[id] = true
			name := id
			if k := n.known[id]; k != nil && k.name != "" {
				name = k.name
			}
			out = append(out, name+" ("+u+" does not answer)")
		}
	}
	return out
}

// LastCompaction says when compaction last ran and what it did (the zero time if
// it has not run yet).
func (n *Node) LastCompaction() (time.Time, CompactResult) {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.compact.last, n.compact.result
}
