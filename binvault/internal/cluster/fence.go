package cluster

import (
	"context"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// fenceOutcome says how the start-up fence ended.
type fenceOutcome struct {
	Done bool
	// Silent lists the URLs that had not answered when the fence gave up.
	Silent []string
	// NewStream is the fresh op stream id when some peer stayed silent.
	NewStream string
	Elapsed   time.Duration
}

// Fence returns how the start-up fence ended (zero until it has).
func (n *Node) Fence() (done bool, silent []string, newStream string) {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.fenceLog.Done, append([]string(nil), n.fenceLog.Silent...), n.fenceLog.NewStream
}

// fence is the start-up fence (spec §8.5). A node that starts in a cluster first
// asks EVERY peer for the ops of its own origin it does not hold and learns the
// current catalog, so that a sequence number is never reused (a node restored
// from an old backup restarts with a lower seq than its peers hold) and so that
// it knows which buckets it still homes. Until every peer URL has answered, or
// BINVAULT_CLUSTER_STARTUP_FENCE has passed, it serves no bucket and accepts no
// catalog write (Ready is false).
//
// If every peer answered, the node continues its op stream above the highest seq
// any of them holds: pulling its own ops back has already raised its version
// vector. If some stayed silent (a lone survivor, or a peer that is down), it goes
// ahead with a warning and starts a NEW op stream — a fresh origin id with the
// same node id — because a silent peer may hold ops of the old stream that it has
// not seen, and its new ops must never collide with them.
func (n *Node) fence(ctx context.Context) {
	start := time.Now()
	deadline := start.Add(n.fenceFor)
	var silent []string
	for {
		n.discover(ctx, true)
		n.pullAll(ctx)
		silent = n.silentURLs()
		if len(silent) == 0 || ctx.Err() != nil || time.Now().After(deadline) {
			break
		}
		select {
		case <-ctx.Done():
		case <-time.After(n.tune.FencePoll):
		}
	}
	if ctx.Err() != nil {
		return
	}
	out := fenceOutcome{Done: true, Silent: silent, Elapsed: time.Since(start)}
	if len(silent) > 0 {
		for {
			id, err := n.startNewStream(ctx)
			if err == nil {
				out.NewStream = id
				break
			}
			n.log.Error("starting a new op stream failed; retrying", "error", err)
			select {
			case <-ctx.Done():
				return
			case <-time.After(time.Second):
			}
		}
		n.log.Warn("start-up fence ended without hearing from every server: serving what this node has and starting a new op stream",
			"silent", silent, "stream", out.NewStream, "waited", out.Elapsed.Round(time.Millisecond))
	} else {
		n.log.Info("cluster start-up fence passed", "node", n.name, "stream", n.Origin(), "waited", out.Elapsed.Round(time.Millisecond))
	}
	n.mu.Lock()
	n.fenceLog = out
	n.mu.Unlock()
	n.setReady()
	// peers learn at once that this node serves now (their last hello said it was
	// still starting), instead of at their next discovery round
	n.announce()
}

// startNewStream switches to a fresh op stream and persists it.
func (n *Node) startNewStream(ctx context.Context) (string, error) {
	id, err := n.newStreamID()
	if err != nil {
		return "", err
	}
	n.wmu.Lock()
	defer n.wmu.Unlock()
	if err := n.db.Update(ctx, func(tx *meta.Tx) error { return tx.KVSet(ctx, kvOrigin, id) }); err != nil {
		return "", err
	}
	n.mu.Lock()
	n.origin = id
	n.mu.Unlock()
	return id, nil
}

// silentURLs lists the configured URLs the fence is still waiting for: a URL is
// settled when it is this node, or answers as a peer that has been pulled from
// (so its ops of our origin are back), or is known to be a retired node's. A URL
// that answers as a clone of this node or of another one is silent: it cannot be
// pulled from, and it may hold ops of our stream. A URL that is down but last
// answered as this node is taken for this node (a node that cannot reach its own
// URL, for example behind NAT without hairpinning, would otherwise start a new
// stream at every start).
func (n *Node) silentURLs() []string {
	n.mu.Lock()
	defer n.mu.Unlock()
	var out []string
	for _, u := range n.urls {
		s := n.us[u]
		id := s.id
		if !s.up {
			id = n.urlIDs[u]
		}
		switch {
		case s.up && s.class == classSelf:
			continue
		case id == "":
			out = append(out, u)
		case id == n.id && !s.up:
			continue // probably this node itself
		case n.retiredLocked(id) && !s.up:
			continue
		case s.up && (s.class == classClone || s.class == classAmbiguous):
			out = append(out, u)
		default:
			if id == n.id {
				out = append(out, u)
				continue
			}
			if why := n.dupName[id]; why != "" {
				out = append(out, u)
				continue
			}
			if p := n.peers[id]; p == nil || p.lastPull.IsZero() {
				out = append(out, u)
			}
		}
	}
	return out
}
