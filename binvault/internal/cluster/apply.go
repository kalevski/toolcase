package cluster

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"strconv"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/hlc"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// maxHeld bounds the table of held streams.
const maxHeld = 256

// applyResult summarises one applyRemote call.
type applyResult struct {
	Applied int // ops that were new and are now applied
	Dups    int // ops that were already applied
	Held    []HeldOp
}

// applyRemote applies ops received from a peer in ONE SQLite transaction (spec
// §8.5). Per origin the ops must arrive in seq order with no gap: an op that
// would leave a gap stops its origin for this batch (the next pull resumes). An
// op that is held — malformed or not canonical, from a newer protocol, stamped
// further ahead than BINVAULT_CLUSTER_MAX_CLOCK_SKEW, sealed under a key this
// node cannot open — is not applied and stops its origin too: held, never
// skipped, because the version vector means "applied up to here". The other
// origins of the batch go on.
//
// The batch is applied in HLC order, so that when a late relay delivers an op's
// cause after its effect in one batch, the cause is still seen first (conflict
// detection looks at what each op replaced).
//
// There is deliberately no check of who wrote an op (§8.3): whether an op is
// applied never depends on which other ops have arrived.
func (n *Node) applyRemote(ctx context.Context, ops []Op, from string) (applyResult, error) {
	var res applyResult
	if len(ops) == 0 {
		return res, nil
	}
	sorted := append([]Op(nil), ops...)
	sort.SliceStable(sorted, func(i, j int) bool { return sorted[i].HLC < sorted[j].HLC })
	now := n.now()
	limit := hlc.FromTime(now.Add(n.maxSkew))

	n.wmu.Lock()
	defer n.wmu.Unlock()
	var (
		changes   []Change
		conflicts []Conflict
		held      map[string]HeldOp
		vvAfter   map[string]int64
		maxHLC    hlc.Timestamp
	)
	err := n.db.Update(ctx, func(tx *meta.Tx) error {
		changes, conflicts, held, maxHLC = nil, nil, map[string]HeldOp{}, 0
		res.Applied, res.Dups = 0, 0
		vv, err := tx.CatalogVV(ctx)
		if err != nil {
			return err
		}
		stopped := map[string]bool{}
		for i := range sorted {
			op := &sorted[i]
			if stopped[op.Origin] {
				continue
			}
			if op.Seq <= vv[op.Origin] && originRe.MatchString(op.Origin) {
				res.Dups++
				continue
			}
			if op.Seq != vv[op.Origin]+1 {
				stopped[op.Origin] = true // a gap: wait for the ops in between
				continue
			}
			hold := func(reason, detail string) {
				stopped[op.Origin] = true
				key := clip(op.Origin)
				if _, dup := held[key]; !dup {
					held[key] = HeldOp{
						Op: key + ":" + strconv.FormatInt(op.Seq, 10), Origin: key, Seq: op.Seq, Register: clip(op.Kind) + "/" + clip(op.Key),
						Reason: reason, Detail: detail, Direction: "in", Peer: from, Since: now,
					}
				}
			}
			if op.V > ProtocolVersion {
				hold("protocol", fmt.Sprintf("created by peer protocol %d, this node speaks %d: upgrade it", op.V, ProtocolVersion))
				continue
			}
			if err := validateOp(op); err != nil {
				hold("invalid", err.Error())
				continue
			}
			if op.HLC > limit {
				hold("clock", fmt.Sprintf("stamped %s, %s ahead of this node's clock (limit %s)",
					op.HLC.Physical().Format(time.RFC3339), op.HLC.Physical().Sub(now).Round(time.Second), n.maxSkew))
				continue
			}
			if why := n.cannotOpen(op); why != "" {
				hold("sealed", why)
				continue
			}
			mop := op.toMeta()
			fresh, err := tx.CatalogAppendOp(ctx, &mop)
			if err != nil {
				return err
			}
			vv[op.Origin] = op.Seq
			if !fresh {
				res.Dups++
				if err := tx.CatalogRaiseVV(ctx, op.Origin, op.Seq); err != nil {
					return err
				}
				continue
			}
			res.Applied++
			maxHLC = max(maxHLC, op.HLC)
			cur, err := tx.CatalogGetReg(ctx, op.Reg())
			if errors.Is(err, meta.ErrNotFound) {
				cur, err = nil, nil
			}
			if err != nil {
				return err
			}
			reg := regOf(op)
			won, err := tx.CatalogUpsertReg(ctx, reg)
			if err != nil {
				return err
			}
			if won {
				changes = append(changes, changeOf(reg, false, false))
			}
			// Two writes of one value are no conflict whoever wrote them first: nothing is
			// lost, whichever wins, the register says the same. The old home and the new
			// home of a moved bucket both write the hand-off (spec §8.8 step 5), and it is
			// the same entry.
			if cur != nil && cur.WinnerID() != op.ID() && op.Prev != cur.WinnerID() && cur.Prev != op.ID() && !bytes.Equal(cur.Payload, reg.Payload) {
				w, l := op.ID(), cur.WinnerID()
				if !won {
					w, l = l, w
				}
				conflicts = append(conflicts, Conflict{Register: op.Reg(), Winner: w, Loser: l, At: now})
			}
		}
		vvAfter = vv
		return nil
	})
	if err != nil {
		return applyResult{}, err
	}
	if maxHLC > 0 {
		n.clock.Observe(maxHLC)
	}
	changes = coalesce(changes)
	n.bm.apply(changes)
	n.disp.enqueue(changes)
	for _, c := range conflicts {
		n.recordConflict(c)
	}
	n.noteHeld(from, vvAfter, held)
	for _, h := range held {
		res.Held = append(res.Held, h)
	}
	return res, nil
}

// cannotOpen says why this node cannot take the op's sealed values ("" when it
// can): an op carrying a value sealed under a master key that is not in this
// node's ring is held, not skipped (§4.7).
func (n *Node) cannotOpen(op *Op) string {
	ids, err := sealedKeyIDs(op.Kind, op.Payload)
	if err != nil {
		return err.Error()
	}
	for _, id := range ids {
		if !n.ring.Can(id) {
			return fmt.Sprintf("sealed under master key %s, which this node does not have", id)
		}
	}
	return ""
}

// noteHeld refreshes the table of held streams after a batch: a stream whose
// vv moved past its held op is released, and the ops held now are recorded (the
// time an op was first held is kept).
func (n *Node) noteHeld(from string, vv map[string]int64, now map[string]HeldOp) {
	n.mu.Lock()
	defer n.mu.Unlock()
	for o, h := range n.heldIn {
		if vv != nil && vv[o] >= h.Seq {
			delete(n.heldIn, o)
		}
	}
	for o, h := range now {
		if _, known := n.heldIn[o]; !known && len(n.heldIn) >= maxHeld {
			continue // a faulty peer cannot make this table grow without bound
		}
		if old, ok := n.heldIn[o]; ok && old.Op == h.Op && old.Reason == h.Reason {
			h.Since = old.Since
		} else {
			n.log.Warn("a catalog op is held, not applied", "op", h.Op, "register", h.Register, "reason", h.Reason, "detail", h.Detail, "from", from)
		}
		n.heldIn[o] = h
	}
}

// ---- snapshots ------------------------------------------------------------------

// wireReg is a register as it travels in a snapshot: the value (or the tombstone)
// with the identity of the op that wrote it, so the receiver merges it with the
// same winner rule ops use.
type wireReg struct {
	Kind    string          `json:"kind"`
	Name    string          `json:"name"`
	Deleted bool            `json:"deleted,omitempty"`
	Payload json.RawMessage `json:"payload"`
	Prev    string          `json:"prev,omitempty"`
	HLC     hlc.Timestamp   `json:"hlc"`
	Origin  string          `json:"origin"`
	Seq     int64           `json:"seq"`
}

func wireOf(r *meta.CatalogReg) wireReg {
	return wireReg{Kind: r.Kind, Name: r.Name, Deleted: r.Deleted, Payload: r.Payload, Prev: r.Prev, HLC: hlc.Timestamp(r.HLC), Origin: r.Origin, Seq: r.Seq}
}

// validateWire checks a snapshot register as strictly as an op.
func validateWire(w *wireReg) error {
	if !originRe.MatchString(w.Origin) || w.Seq < 1 || w.HLC == 0 {
		return invalidf("register %s/%s: bad writer (%s, %d, %d)", clip(w.Kind), clip(w.Name), clip(w.Origin), w.Seq, w.HLC)
	}
	if w.Deleted != isTombstone(w.Payload) {
		return invalidf("register %s/%s: deleted flag and payload disagree", clip(w.Kind), clip(w.Name))
	}
	return validateBody(w.Kind, w.Name, w.Prev, w.Payload)
}

var errFuture = errors.New("a register is stamped too far in the future")

// mergeRegs folds a chunk of a peer's snapshot into the registers with the winner
// rule (§8.5: merged, not swapped in, so local changes the sender has not seen
// survive). A register stamped past the clock guard aborts the merge: the
// snapshot's version vector is only applied once every register is in.
func (n *Node) mergeRegs(ctx context.Context, regs []wireReg, from string) error {
	if len(regs) == 0 {
		return nil
	}
	now := n.now()
	limit := hlc.FromTime(now.Add(n.maxSkew))
	rows := make([]*meta.CatalogReg, len(regs))
	var maxHLC hlc.Timestamp
	for i := range regs {
		w := &regs[i]
		if err := validateWire(w); err != nil {
			return err
		}
		if w.HLC > limit {
			n.noteHeld(from, nil, map[string]HeldOp{w.Origin: {
				Op: fmt.Sprintf("%s:%d", w.Origin, w.Seq), Origin: w.Origin, Seq: w.Seq, Register: w.Kind + "/" + w.Name,
				Reason: "clock", Detail: fmt.Sprintf("a snapshot register is stamped %s, past the clock guard", w.HLC.Physical().Format(time.RFC3339)),
				Direction: "in", Peer: from, Since: now,
			}})
			return fmt.Errorf("%w (%s/%s)", errFuture, w.Kind, w.Name)
		}
		if why := n.cannotOpen(&Op{Kind: w.Kind, Payload: w.Payload}); why != "" {
			return fmt.Errorf("register %s/%s: %s", w.Kind, w.Name, why)
		}
		del := w.Deleted
		rows[i] = &meta.CatalogReg{
			Key: w.Kind + "/" + w.Name, Kind: w.Kind, Name: w.Name, Deleted: del, Payload: []byte(w.Payload),
			Aux: auxOf(w.Kind, w.Payload, del), Prev: w.Prev, HLC: uint64(w.HLC), Origin: w.Origin, Seq: w.Seq,
		}
		maxHLC = max(maxHLC, w.HLC)
	}
	n.wmu.Lock()
	defer n.wmu.Unlock()
	var changes []Change
	err := n.db.Update(ctx, func(tx *meta.Tx) error {
		changes = nil
		for _, r := range rows {
			won, err := tx.CatalogUpsertReg(ctx, r)
			if err != nil {
				return err
			}
			if won {
				changes = append(changes, changeOf(r, false, false))
			}
		}
		return nil
	})
	if err != nil {
		return err
	}
	n.clock.Observe(maxHLC)
	n.bm.apply(changes)
	n.disp.enqueue(changes)
	return nil
}

// finishSnapshot applies the version vector of a snapshot whose registers have
// all been merged: for every origin the snapshot is ahead on, the vector and the
// floor rise to the snapshot's value — those ops are covered by the merged
// registers, but are not held individually, so they cannot be served to others.
func (n *Node) finishSnapshot(ctx context.Context, vv map[string]int64) error {
	n.wmu.Lock()
	defer n.wmu.Unlock()
	var after map[string]int64
	err := n.db.Update(ctx, func(tx *meta.Tx) error {
		local, err := tx.CatalogVV(ctx)
		if err != nil {
			return err
		}
		for o, s := range vv {
			if s <= local[o] {
				continue
			}
			if err := tx.CatalogRaiseVV(ctx, o, s); err != nil {
				return err
			}
			if err := tx.CatalogRaiseFloor(ctx, o, s); err != nil {
				return err
			}
			local[o] = s
		}
		after = local
		return nil
	})
	if err != nil {
		return err
	}
	n.noteHeld("", after, nil)
	return nil
}
