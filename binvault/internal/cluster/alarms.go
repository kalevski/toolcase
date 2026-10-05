package cluster

import (
	"context"
	"fmt"
	"sort"
	"strings"
	"time"
)

// Conflict records two writes to one register that neither author had seen when
// it wrote (spec §8.5): the later (hlc, origin) won everywhere and this is the
// loser, kept for the operator. It is detected by the ops' Prev fields, which
// name the winner the author replaced; it never influences a winner.
type Conflict struct {
	Register string    `json:"register"`
	Winner   string    `json:"winner"` // op id
	Loser    string    `json:"loser"`  // op id
	At       time.Time `json:"at"`
}

const maxConflicts = 64

// HeldOp is an op that is not applied (received) or not sent (withheld). Ops are
// held, never skipped: the stream of their origin waits behind them (§8.3, §8.5,
// §9.6).
type HeldOp struct {
	Op       string `json:"op"` // "origin:seq"
	Origin   string `json:"origin"`
	Seq      int64  `json:"seq"`
	Register string `json:"register"`
	// Reason: "clock" (stamped further in the future than
	// BINVAULT_CLUSTER_MAX_CLOCK_SKEW), "protocol" (created by a newer peer
	// protocol), "sealed" (sealed under a master key that cannot be opened) or
	// "invalid" (malformed or not canonical).
	Reason string `json:"reason"`
	Detail string `json:"detail,omitempty"`
	// Direction: "in" (received, not applied), "out" (not sent to Peer) or
	// "withheld" (Peer holds it back from this node).
	Direction string `json:"direction"`
	// Peer is the node id of the sender (in, withheld) or the receiver (out).
	Peer  string    `json:"peer,omitempty"`
	Since time.Time `json:"since"`
}

// Clone is a URL that answers under this node's id with another boot nonce, or
// several processes answering under one id: a data dir was copied (§8.3).
type Clone struct {
	URL    string `json:"url"`
	NodeID string `json:"node_id"`
	Detail string `json:"detail"`
}

// Mismatch is a setting that must be the same on every node and is not (§8.3):
// "master_key_ids", "region", "domain", "pipeline_before_total_timeout", or a
// "node_name" shared by two nodes.
type Mismatch struct {
	Setting string `json:"setting"`
	NodeID  string `json:"node_id"`
	Node    string `json:"node"`
	Ours    string `json:"ours"`
	Theirs  string `json:"theirs"`
}

// Alarms is the `alarms` object of GET /cluster (spec §6.9).
type Alarms struct {
	Conflicts  []Conflict `json:"conflicts"`
	Orphans    []Orphan   `json:"orphans"`
	HeldOps    []HeldOp   `json:"held_ops"`
	Clones     []Clone    `json:"clones"`
	Missing    []Missing  `json:"missing"`
	Mismatches []Mismatch `json:"mismatches"`
	// CompactionBlockedBy names the URLs or nodes whose silence keeps the op log
	// from being compacted (§8.5).
	CompactionBlockedBy []string `json:"compaction_blocked_by"`
}

// Alarms gathers everything GET /cluster reports as an alarm. The orphan and
// missing lists need Options.LocalBuckets.
func (n *Node) Alarms(ctx context.Context) (Alarms, error) {
	a := Alarms{
		Conflicts: n.Conflicts(), HeldOps: n.HeldOps(), Clones: n.Clones(), Mismatches: n.Mismatches(),
		CompactionBlockedBy: n.CompactionBlockedBy(),
		Orphans:             []Orphan{}, Missing: []Missing{},
	}
	if n.local != nil {
		lbs, err := n.local(ctx)
		if err != nil {
			return a, err
		}
		if a.Orphans, err = n.OrphansOf(ctx, lbs); err != nil {
			return a, err
		}
	}
	var err error
	if a.Missing, err = n.MissingBuckets(ctx); err != nil {
		return a, err
	}
	if a.Missing == nil {
		a.Missing = []Missing{}
	}
	return a, nil
}

// Conflicts lists the most recent concurrent register writes this node has seen.
func (n *Node) Conflicts() []Conflict {
	n.mu.Lock()
	defer n.mu.Unlock()
	return append([]Conflict{}, n.conflict...)
}

// HeldOps lists the ops that are held: received but not applied, and withheld
// from a peer that cannot open the key that sealed them.
func (n *Node) HeldOps() []HeldOp {
	n.mu.Lock()
	defer n.mu.Unlock()
	out := []HeldOp{}
	for _, h := range n.heldIn {
		out = append(out, h)
	}
	for _, m := range n.heldOut {
		for _, h := range m {
			out = append(out, h)
		}
	}
	for _, p := range n.peers {
		out = append(out, p.withheld...)
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Op != out[j].Op {
			return out[i].Op < out[j].Op
		}
		return out[i].Direction < out[j].Direction
	})
	return out
}

// Clones lists the URLs that answer as clones of this node or of another one.
func (n *Node) Clones() []Clone {
	n.mu.Lock()
	defer n.mu.Unlock()
	out := []Clone{}
	for _, u := range n.urls {
		s := n.us[u]
		switch s.class {
		case classClone:
			out = append(out, Clone{URL: u, NodeID: s.id, Detail: "answers with this node's id but another boot nonce: its data dir was copied from ours; remove it so it generates a new id (sync with it is refused)"})
		case classAmbiguous:
			out = append(out, Clone{URL: u, NodeID: s.id, Detail: "several processes answer under this node id: a data dir was copied; remove the copy so it generates a new id (sync with them is refused)"})
		}
	}
	return out
}

// Mismatches compares the settings that must be the same on every node with
// what each reachable peer reported in hello (§8.3).
func (n *Node) Mismatches() []Mismatch {
	n.mu.Lock()
	defer n.mu.Unlock()
	ours := n.keyIDStrings()
	out := []Mismatch{}
	seen := map[string]bool{}
	for _, u := range n.urls {
		s := n.us[u]
		if !s.up || s.hello == nil || s.id == n.id || seen[s.id] || n.retiredLocked(s.id) {
			continue
		}
		seen[s.id] = true
		h := s.hello
		add := func(setting, o, t string) {
			out = append(out, Mismatch{Setting: setting, NodeID: s.id, Node: h.Name, Ours: o, Theirs: t})
		}
		if !sameKeyIDs(ours, h.KeyIDs) {
			add("master_key_ids", joinIDs(ours), joinIDs(h.KeyIDs))
		}
		if h.Region != n.cfg.Region {
			add("region", n.cfg.Region, h.Region)
		}
		if h.Domain != n.cfg.Domain {
			add("domain", n.cfg.Domain, h.Domain)
		}
		if h.BeforeTimeoutMS != n.cfg.PipelineBeforeTotalTimeout.Milliseconds() {
			add("pipeline_before_total_timeout", n.cfg.PipelineBeforeTotalTimeout.String(), (time.Duration(h.BeforeTimeoutMS) * time.Millisecond).String())
		}
	}
	for id, why := range n.dupName {
		name := ""
		if k := n.known[id]; k != nil {
			name = k.name
		}
		out = append(out, Mismatch{Setting: "node_name", NodeID: id, Node: name, Ours: n.name, Theirs: strings.TrimPrefix(why, "duplicate node name ")})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Setting != out[j].Setting {
			return out[i].Setting < out[j].Setting
		}
		return out[i].NodeID < out[j].NodeID
	})
	return out
}

// sameKeyIDs reports whether two nodes can open the same master keys with the
// same one current. During the three-step key roll this is briefly false by
// design (§4.7); a standing mismatch means ops sealed under a key are held.
func sameKeyIDs(a, b []string) bool {
	if len(a) != len(b) || (len(a) > 0 && a[0] != b[0]) {
		return false
	}
	x, y := append([]string(nil), a...), append([]string(nil), b...)
	sort.Strings(x)
	sort.Strings(y)
	for i := range x {
		if x[i] != y[i] {
			return false
		}
	}
	return true
}

// recordConflict remembers a concurrent write (most recent maxConflicts).
func (n *Node) recordConflict(c Conflict) {
	n.mu.Lock()
	n.conflict = append(n.conflict, c)
	if len(n.conflict) > maxConflicts {
		n.conflict = append([]Conflict(nil), n.conflict[len(n.conflict)-maxConflicts:]...)
	}
	n.mu.Unlock()
	n.log.Warn("concurrent writes to one register; the later (hlc, origin) won everywhere", "register", c.Register, "winner", c.Winner, "loser", c.Loser)
}

func (h HeldOp) String() string {
	return fmt.Sprintf("%s %s (%s %s)", h.Direction, h.Op, h.Reason, h.Detail)
}
