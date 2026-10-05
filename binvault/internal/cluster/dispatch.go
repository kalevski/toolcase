package cluster

import (
	"context"
	"fmt"
	"log/slog"
	"runtime/debug"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/hlc"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// dispatcher delivers committed changes to the subscribers, in commit order, on
// its own goroutine: a slow or writing subscriber never blocks the catalog's
// writers. A pull request carries the version vector that acknowledges what this
// node has applied, and the pull loop sends it only once everything the vector
// covers has been delivered (Node.ackPoint), so a peer's acknowledgement of an
// op means the op has also reached this node's subscribers (the pipeline
// package materialises pipeline/<name> registers there): `?wait=replicated`
// returning means the change is usable on every node.
type dispatcher struct {
	log    *slog.Logger
	before func([]Change) // Tuning.BeforeDeliver

	mu     sync.Mutex
	queue  []batch // undelivered batches, oldest first; queue[0] may be in delivery
	subs   []func([]Change)
	enq    uint64 // tickets handed out
	done   uint64 // every ticket up to this one is delivered
	wake   chan struct{}
	doneCh chan struct{} // closed and replaced when done advances
	closed bool
}

type batch struct {
	ticket  uint64
	changes []Change
}

func newDispatcher(log *slog.Logger) *dispatcher {
	return &dispatcher{log: log, wake: make(chan struct{}, 1), doneCh: make(chan struct{})}
}

func (d *dispatcher) subscribe(fn func([]Change)) {
	d.mu.Lock()
	d.subs = append(d.subs, fn)
	d.mu.Unlock()
}

// enqueue schedules a batch and returns its ticket. Callers hold Node.wmu, so
// tickets follow commit order.
func (d *dispatcher) enqueue(changes []Change) uint64 {
	d.mu.Lock()
	defer d.mu.Unlock()
	d.enq++
	t := d.enq
	if d.closed || (len(d.queue) == 0 && (len(changes) == 0 || len(d.subs) == 0)) {
		d.setDone(t)
		return t
	}
	d.queue = append(d.queue, batch{ticket: t, changes: changes})
	select {
	case d.wake <- struct{}{}:
	default:
	}
	return t
}

// setDone marks every ticket up to t delivered. Callers hold d.mu.
func (d *dispatcher) setDone(t uint64) {
	if t > d.done {
		d.done = t
		close(d.doneCh)
		d.doneCh = make(chan struct{})
	}
}

// last is the ticket of the batch enqueued most recently (0: none yet).
func (d *dispatcher) last() uint64 {
	d.mu.Lock()
	defer d.mu.Unlock()
	return d.enq
}

// waitFor blocks until the ticket is delivered, the timeout passes or ctx ends.
func (d *dispatcher) waitFor(ctx context.Context, ticket uint64, timeout time.Duration) {
	timer := time.NewTimer(timeout)
	defer timer.Stop()
	for {
		d.mu.Lock()
		if d.done >= ticket || d.closed {
			d.mu.Unlock()
			return
		}
		ch := d.doneCh
		d.mu.Unlock()
		select {
		case <-ch:
		case <-ctx.Done():
			return
		case <-timer.C:
			return
		}
	}
}

func (d *dispatcher) run(ctx context.Context) {
	for {
		d.mu.Lock()
		if len(d.queue) == 0 {
			d.mu.Unlock()
			select {
			case <-ctx.Done():
				return
			case <-d.wake:
				continue
			}
		}
		b := d.queue[0]
		subs := append([]func([]Change){}, d.subs...)
		d.mu.Unlock()
		if d.before != nil {
			d.call(d.before, b.changes)
		}
		for _, fn := range subs {
			d.call(fn, b.changes)
		}
		d.mu.Lock()
		if len(d.queue) > 0 {
			d.queue = d.queue[1:]
		}
		d.setDone(b.ticket)
		d.mu.Unlock()
	}
}

func (d *dispatcher) call(fn func([]Change), changes []Change) {
	defer func() {
		if p := recover(); p != nil {
			d.log.Error("a catalog change subscriber panicked", "panic", fmt.Sprint(p), "stack", string(debug.Stack()))
		}
	}()
	fn(changes)
}

// stop releases every waiter; later batches are dropped.
func (d *dispatcher) stop() {
	d.mu.Lock()
	d.closed = true
	d.queue = nil
	d.setDone(d.enq)
	d.mu.Unlock()
}

// OnChange subscribes fn to the registers that change on this node: every
// register whose winner changes, whether the write was local (Change.Local) or
// replicated, is delivered once, after the transaction that changed it has
// committed, in commit order, on a goroutine of the node. fn may call any method
// of the node, the write methods included, but later changes queue behind a slow
// one, and Stop does not wait longer than ten seconds for one that never returns.
// The node does not acknowledge an op to its peers — so `?wait=replicated` does
// not return for it — before the op's change has been delivered here, and a
// subscriber that does not return holds the node's acknowledgements, and its
// pulls, back for up to ten seconds at a time. Subscribe before Start.
//
// This is how the application materialises remote changes: the pipeline package
// turns pipeline/<name> registers into its own tables, a home drops the
// attachments of a pipeline whose generation changed, and so on. Replay
// re-delivers the current state, for the changes that arrived while the
// application was down.
func (n *Node) OnChange(fn func([]Change)) { n.disp.subscribe(fn) }

// Replay delivers the current registers (tombstones included) of the given kinds
// to the subscribers as Change{Replayed: true}, in key order, in batches; with no
// kind it replays them all. Call it after Ready at start-up. It holds back
// other catalog writes while it reads, so no newer change can be overtaken by
// an older replayed value.
func (n *Node) Replay(ctx context.Context, kinds ...string) error {
	want := map[string]bool{}
	for _, k := range kinds {
		want[k] = true
	}
	n.wmu.Lock()
	defer n.wmu.Unlock()
	after := ""
	for {
		regs, err := n.db.Read().CatalogPageRegs(ctx, after, 500)
		if err != nil {
			return err
		}
		var changes []Change
		for i := range regs {
			r := &regs[i]
			after = r.Key
			if len(want) > 0 && !want[r.Kind] {
				continue
			}
			changes = append(changes, changeOf(r, false, true))
		}
		n.disp.enqueue(changes)
		if len(regs) < 500 {
			return nil
		}
	}
}

// changeOf builds the Change of a register row.
func changeOf(r *meta.CatalogReg, local, replayed bool) Change {
	c := Change{
		Kind: r.Kind, Name: r.Name, Key: r.Key, Deleted: r.Deleted, Local: local, Replayed: replayed,
		Op: OpRef{Origin: r.Origin, Seq: r.Seq, HLC: hlc.Timestamp(r.HLC)},
	}
	if !r.Deleted {
		c.Value = append([]byte(nil), r.Payload...)
	}
	return c
}

// coalesce keeps, per register, only the last change of a batch: later changes
// are the winners, and a subscriber has no use for the intermediate values of a
// transaction (a pipeline created and deleted in one batch was never there).
// The order is that of each register's last change.
func coalesce(changes []Change) []Change {
	if len(changes) < 2 {
		return changes
	}
	last := make(map[string]int, len(changes))
	for i, c := range changes {
		last[c.Key] = i
	}
	if len(last) == len(changes) {
		return changes
	}
	out := make([]Change, 0, len(last))
	for i, c := range changes {
		if last[c.Key] == i {
			out = append(out, c)
		}
	}
	return out
}
