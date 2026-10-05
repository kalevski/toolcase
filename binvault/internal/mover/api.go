package mover

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"slices"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/admin"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// The admin API of moves and drains (spec §6.9, §6.10). Starting a move is a
// bucket-scoped call, so the admin router sends it to the bucket's home — the
// source — which is where it is answered; the moves are listed from every node and a
// cancel goes to the source (clusteradmin); a drain goes to the node it names.

// Routes is admin.Server.Moves.
func (m *Mover) Routes(rc *admin.Ctx) (bool, error) {
	segs, meth := rc.Segs, rc.R.Method
	info := httpx.From(rc.Ctx)
	switch {
	case len(segs) == 3 && segs[0] == "buckets" && segs[2] == "move" && meth == http.MethodPost:
		info.Op, info.Bucket = "AdminMoveBucket", segs[1]
		return true, m.apiStart(rc, segs[1])
	case len(segs) == 1 && segs[0] == "moves" && meth == http.MethodGet:
		info.Op = "AdminListMoves"
		return true, m.apiList(rc)
	case len(segs) == 2 && segs[0] == "moves" && meth == http.MethodGet:
		info.Op = "AdminGetMove"
		return true, m.apiGet(rc, segs[1])
	case len(segs) == 3 && segs[0] == "moves" && segs[2] == "cancel" && meth == http.MethodPost:
		info.Op = "AdminCancelMove"
		return true, m.apiCancel(rc, segs[1])
	case len(segs) == 4 && segs[0] == "cluster" && segs[1] == "nodes" && (segs[3] == "drain" || segs[3] == "undrain") && meth == http.MethodPost:
		info.Op = "AdminDrainNode"
		return true, m.apiDrain(rc, segs[2], segs[3] == "drain")
	}
	return false, nil
}

// ---- the move as the API shows it -----------------------------------------------------------------

type moveJSON struct {
	ID string `json:"id"`
	// Role is "source" on the old home and "target" on the new one.
	Role          string     `json:"role"`
	Bucket        string     `json:"bucket"`
	From          string     `json:"from"`
	To            string     `json:"to"`
	State         string     `json:"state"`
	Epoch         int64      `json:"epoch"`
	BytesTotal    int64      `json:"bytes_total"`
	BytesCopied   int64      `json:"bytes_copied"`
	ObjectsCopied int64      `json:"objects_copied"`
	MaxBPS        int64      `json:"max_bytes_per_second,omitempty"`
	CreatedAt     time.Time  `json:"created_at"`
	StartedAt     *time.Time `json:"started_at"`
	FinishedAt    *time.Time `json:"finished_at"`
	Error         *string    `json:"error"`
}

func (m *Mover) view(row *meta.Move) moveJSON {
	r := *row
	if r.Role == meta.MoveOut {
		m.mu.Lock()
		mv := m.outs[r.ID]
		m.mu.Unlock()
		if mv != nil {
			r = mv.snapshot()
		}
	}
	state := r.State
	if state == meta.MoveResuming {
		state = meta.MoveCutover // the cutover ending: the bucket is not served yet
	}
	out := moveJSON{
		ID: r.ID, Bucket: r.Bucket, State: state, Epoch: r.Epoch, BytesTotal: r.BytesTotal, BytesCopied: r.BytesCopied,
		ObjectsCopied: r.ObjectsCopied, MaxBPS: r.MaxBPS, CreatedAt: r.CreatedAt.UTC(), StartedAt: r.StartedAt, FinishedAt: r.FinishedAt,
	}
	if r.Error != "" {
		e := r.Error
		out.Error = &e
	}
	if r.Role == meta.MoveOut {
		out.Role, out.From, out.To = "source", m.nodeName(m.selfID()), m.nodeName(r.Peer)
	} else {
		out.Role, out.From, out.To = "target", m.nodeName(r.Peer), m.nodeName(m.selfID())
	}
	return out
}

// ---- POST /buckets/{name}/move ---------------------------------------------------------------

type startReq struct {
	To     string `json:"to"`
	MaxBPS int64  `json:"max_bytes_per_second"`
}

var errMoving = errors.New("the bucket is moving already")

func (m *Mover) apiStart(rc *admin.Ctx, bucket string) error {
	var req startReq
	if err := rc.Decode(&req); err != nil {
		return err
	}
	if req.MaxBPS < 0 {
		return admin.Invalid("invalid move", map[string]string{"max_bytes_per_second": "must not be negative"})
	}
	if !m.started.Load() {
		return admin.Unavailable("this node is starting: bucket moves are not available yet")
	}
	ctx := rc.Ctx
	b, err := m.o.DB.Read().GetBucket(ctx, bucket)
	if err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return admin.NotFound(fmt.Sprintf("bucket %q does not exist on this node", bucket))
		}
		return admin.Internal(err)
	}
	rec, ok := m.o.Node.Bucket(bucket)
	if !ok || rec.Home != m.selfID() || rec.Generation != b.Generation || rec.Epoch != b.Epoch {
		return admin.Unavailable(fmt.Sprintf("bucket %q is not served by this node", bucket))
	}
	target, err := m.resolveTarget(ctx, req.To, b)
	if err != nil {
		return err
	}
	row, err := m.enqueue(ctx, b, target.ID, req.MaxBPS)
	switch {
	case errors.Is(err, errMoving):
		return admin.Conflict(fmt.Sprintf("bucket %q is being moved already (%s)", bucket, err.Error()))
	case err != nil:
		return admin.Internal(err)
	}
	m.log.Info("move: requested", "move", row.ID, "bucket", bucket, "to", target.Name)
	admin.WriteJSON(rc.W, http.StatusAccepted, m.view(row))
	return nil
}

// enqueue records a new queued move of the bucket to the target (it fails with
// errMoving while the bucket has an unfinished move) and wakes the worker.
func (m *Mover) enqueue(ctx context.Context, b *meta.Bucket, target string, maxBPS int64) (*meta.Move, error) {
	row := &meta.Move{
		ID: newMoveID(), Role: meta.MoveOut, Bucket: b.Name, Generation: b.Generation, Peer: target, State: meta.MoveQueued,
		Epoch: b.Epoch + 1, MaxBPS: maxBPS, BytesTotal: m.bucketBytes(ctx, b), CreatedAt: m.now(),
	}
	err := m.o.DB.Update(ctx, func(tx *meta.Tx) error {
		open, err := tx.ListMoves(ctx, meta.MoveFilter{Bucket: b.Name, Open: true, Limit: 1})
		if err != nil {
			return err
		}
		if len(open) > 0 {
			return fmt.Errorf("%w: %s", errMoving, open[0].ID)
		}
		return tx.InsertMove(ctx, row)
	})
	if err != nil {
		if strings.Contains(err.Error(), errMoving.Error()) {
			return nil, err
		}
		return nil, err
	}
	m.poke()
	return row, nil
}

// bucketBytes is the disk space a node needs to receive the bucket (spec §8.8 step 1):
// the stored bytes of the blobs and part files that travel, each blob once. The
// logical counters of the bucket are the fallback (a counter is not what the disk
// holds: versions that share a blob count it once on disk, encrypted blobs are a
// little bigger than their plaintext).
func (m *Mover) bucketBytes(ctx context.Context, b *meta.Bucket) int64 {
	// the sum reads every blob row of the bucket: the answer is kept while the bucket's own
	// counters say it has not changed (the drain asks again at every poll)
	key := fmt.Sprintf("%s/%s/%d/%d/%d/%d/%d", b.Name, b.Generation, b.Objects, b.Versions, b.DeleteMarkers, b.Bytes, b.UploadBytes)
	m.mu.Lock()
	if c, ok := m.bytesCache[b.Name]; ok && c.key == key {
		m.mu.Unlock()
		return c.bytes
	}
	m.mu.Unlock()
	n, err := m.o.DB.Read().BucketStoredBytes(ctx, b.Name)
	if err != nil {
		m.log.Warn("move: cannot sum the stored bytes of the bucket; using its logical size", "bucket", b.Name, "error", err)
		return b.Bytes + b.UploadBytes
	}
	m.mu.Lock()
	if len(m.bytesCache) >= 1024 {
		clear(m.bytesCache)
	}
	m.bytesCache[b.Name] = cachedBytes{key: key, bytes: n}
	m.mu.Unlock()
	return n
}

// cachedBytes is a bucket's stored bytes with the counters of the bucket they were summed under.
type cachedBytes struct {
	key   string
	bytes int64
}

// targetProblem says why a node cannot take a bucket of `need` bytes whose sealed
// values use the given master keys now ("" if it can); invalid is true for a node
// that is not a member at all.
func (m *Mover) targetProblem(p cluster.PeerInfo, need int64, keyIDs []string) (why string, invalid bool) {
	switch {
	case p.ID == "":
		return "no such node", true
	case p.ID == m.selfID():
		return "the bucket is homed on this node already", false
	case p.Retired:
		return fmt.Sprintf("node %q was retired", p.Name), true
	case p.Refused != "":
		return fmt.Sprintf("node %q is refused by this cluster: %s", p.Name, p.Refused), false
	case !p.Reachable:
		return fmt.Sprintf("node %q is not reachable", p.Name), false
	case p.Draining:
		return fmt.Sprintf("node %q is shutting down", p.Name), false
	case p.Cordoned:
		return fmt.Sprintf("node %q is cordoned: it takes no new buckets", p.Name), false
	case !p.Ready:
		return fmt.Sprintf("node %q is still starting", p.Name), false
	case p.FreeDisk < need+m.tune.Margin:
		return fmt.Sprintf("node %q has %d bytes free, the bucket needs %d plus a margin", p.Name, p.FreeDisk, need), false
	}
	for _, k := range keyIDs {
		if !slices.Contains(p.KeyIDs, k) {
			return fmt.Sprintf("node %q cannot open master key %s, which the bucket's sealed values use", p.Name, k), false
		}
	}
	return "", false
}

// resolveTarget turns the `to` of a move request — a node name, a node id or
// "auto" — into the node that takes the bucket, or an API error (spec §6.10).
func (m *Mover) resolveTarget(ctx context.Context, to string, b *meta.Bucket) (cluster.PeerInfo, error) {
	need := m.bucketBytes(ctx, b)
	keyIDs, err := m.sealedKeyIDs(ctx, b)
	if err != nil {
		return cluster.PeerInfo{}, admin.Internal(err)
	}
	if to == "" || to == "auto" {
		var whys []string
		for _, p := range m.o.Node.Placement() {
			if p.ID == m.selfID() {
				continue
			}
			why, _ := m.targetProblem(p, need, keyIDs)
			if why == "" {
				return p, nil
			}
			whys = append(whys, why)
		}
		detail := "no other node can take the bucket now"
		if len(whys) > 0 {
			detail += ": " + strings.Join(whys, "; ")
		}
		return cluster.PeerInfo{}, admin.Conflict(detail)
	}
	p, ok := m.o.Node.PeerByName(to)
	if !ok || p.ID == "" {
		if byID, found := m.o.Node.PeerByID(to); found {
			p, ok = byID, true
		}
	}
	if !ok || p.ID == "" {
		return p, admin.Invalid("unknown target node", map[string]string{"to": fmt.Sprintf("%q is not a node of this cluster", to)})
	}
	if why, invalid := m.targetProblem(p, need, keyIDs); why != "" {
		if invalid {
			return p, admin.Invalid("unknown target node", map[string]string{"to": why})
		}
		return p, admin.Conflict(why)
	}
	return p, nil
}

// ---- GET /moves, GET /moves/{id} -----------------------------------------------------------------

func (m *Mover) apiList(rc *admin.Ctx) error {
	limit, cursor, err := admin.PageParams(rc.R)
	if err != nil {
		return err
	}
	q := rc.R.URL.Query()
	f := meta.MoveFilter{Bucket: q.Get("bucket"), Before: cursor, Limit: limit + 1}
	switch role := q.Get("role"); role {
	case "":
	case "source":
		f.Role = meta.MoveOut
	case "target":
		f.Role = meta.MoveIn
	default:
		return admin.Invalid("invalid filter", map[string]string{"role": `must be "source" or "target"`})
	}
	if st := q.Get("state"); st != "" {
		f.States = strings.Split(st, ",")
		if slices.Contains(f.States, meta.MoveCutover) {
			f.States = append(f.States, meta.MoveResuming)
		}
	}
	rows, err := m.o.DB.Read().ListMoves(rc.Ctx, f)
	if err != nil {
		return admin.Internal(err)
	}
	var next any
	if len(rows) > limit {
		rows = rows[:limit]
		next = rows[len(rows)-1].ID
	}
	items := make([]moveJSON, len(rows))
	for i, r := range rows {
		items[i] = m.view(r)
	}
	admin.WriteJSON(rc.W, http.StatusOK, map[string]any{"items": items, "next_cursor": next})
	return nil
}

func (m *Mover) apiGet(rc *admin.Ctx, id string) error {
	row, err := m.o.DB.Read().GetMove(rc.Ctx, id)
	if err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return admin.NotFound(fmt.Sprintf("move %q does not exist on this node", id))
		}
		return admin.Internal(err)
	}
	admin.WriteJSON(rc.W, http.StatusOK, m.view(row))
	return nil
}

// ---- POST /moves/{id}/cancel -----------------------------------------------------------------

// apiCancel cancels a move before its final transfer (spec §6.10): only the source
// decides, and only until the bucket is frozen.
func (m *Mover) apiCancel(rc *admin.Ctx, id string) error {
	ctx := rc.Ctx
	row, err := m.o.DB.Read().GetMove(ctx, id)
	if err != nil {
		if errors.Is(err, meta.ErrNotFound) {
			return admin.NotFound(fmt.Sprintf("move %q does not exist on this node", id))
		}
		return admin.Internal(err)
	}
	if row.Role != meta.MoveOut {
		return admin.Conflict(fmt.Sprintf("this node is the target of move %q: only the source node cancels a move (%s)", id, m.nodeName(row.Peer)))
	}
	// still queued: nothing has happened yet — or the move waits for its target, which may
	// hold a copy of what it was sent (the note the move carries says it waits): the row is
	// read in the transaction that cancels it, so that the answer is the row that was cancelled
	var changed bool
	var prev *meta.Move
	if err := m.o.DB.Update(ctx, func(tx *meta.Tx) (err error) {
		changed, prev = false, nil
		if prev, err = tx.GetMove(ctx, id); err != nil {
			return err
		}
		changed, err = tx.MoveTransition(ctx, id, []string{meta.MoveQueued}, meta.MoveCancelled, errCancelled.Error())
		return err
	}); err != nil {
		return admin.Internal(err)
	}
	if changed {
		m.met.moves.Inc(meta.MoveCancelled)
		m.mu.Lock()
		delete(m.retryAt, id) // the worker has nothing to wait for any more
		m.mu.Unlock()
		// a move that waited for a busy target holds nothing there; one that waited for
		// anything else was in touch with it (a pipeline that had not arrived stopped it
		// after the blobs were sent): that copy goes
		if prev.Error != "" && prev.Error != "waiting: "+errBusy.Error() {
			m.wg.Add(1)
			go func() {
				defer m.wg.Done()
				m.sendDiscard(m.ctx, prev)
			}()
		}
		m.poke()
		return m.answerMove(rc, id)
	}
	m.mu.Lock()
	mv := m.outs[id]
	m.mu.Unlock()
	switch {
	case mv != nil && mv.requestCancel():
		// the move ends as `cancelled` as soon as its step notices
		deadline := time.Now().Add(5 * time.Second)
		for time.Now().Before(deadline) {
			if cur, err := m.o.DB.Read().GetMove(ctx, id); err == nil && cur.Final() {
				break
			}
			time.Sleep(20 * time.Millisecond)
		}
		return m.answerMove(rc, id)
	case row.Final():
		return admin.Conflict(fmt.Sprintf("move %q has ended already (%s)", id, row.State))
	}
	return admin.Conflict(fmt.Sprintf("move %q cannot be cancelled any more: the bucket is frozen (%s)", id, row.State))
}

func (m *Mover) answerMove(rc *admin.Ctx, id string) error {
	row, err := m.o.DB.Read().GetMove(rc.Ctx, id)
	if err != nil {
		return admin.Internal(err)
	}
	admin.WriteJSON(rc.W, http.StatusOK, m.view(row))
	return nil
}

// ---- drain ---------------------------------------------------------------------------------------

type drainJSON struct {
	Node     string `json:"node"`
	ID       string `json:"id"`
	Cordoned bool   `json:"cordoned"`
	// State is "running" while buckets are still homed on the node, "done" once none
	// is, "" when the node is not cordoned.
	State     string `json:"state"`
	Remaining int64  `json:"remaining"`
}

func (m *Mover) apiDrain(rc *admin.Ctx, ref string, drain bool) error {
	n := m.o.Node
	if ref != n.Name() && ref != n.ID() {
		return admin.Invalid("this node is "+n.Name(), map[string]string{"id": fmt.Sprintf("%q is not this node: the call goes to the node it names", ref)})
	}
	if err := n.SetCordoned(rc.Ctx, drain); err != nil {
		return admin.Internal(err)
	}
	if drain {
		m.log.Warn("drain: this node is cordoned; its buckets move away one at a time")
		select {
		case m.drain <- struct{}{}:
		default:
		}
	} else {
		m.log.Info("drain: the cordon is lifted")
	}
	code := http.StatusOK
	if drain {
		code = http.StatusAccepted
	}
	admin.WriteJSON(rc.W, code, m.drainState(rc.Ctx))
	return nil
}

// DrainState describes the drain of this node: the cordon flag and the buckets the
// catalog still homes here. It is derived, so it survives restarts.
func (m *Mover) drainState(ctx context.Context) drainJSON {
	n := m.o.Node
	remaining, _ := n.CountBucketsHomed(ctx, n.ID())
	out := drainJSON{Node: n.Name(), ID: n.ID(), Cordoned: n.Cordoned(), Remaining: remaining}
	switch {
	case !out.Cordoned:
	case remaining > 0:
		out.State = "running"
	default:
		out.State = "done"
	}
	return out
}

// StatusExtra adds the move counts to GET /status.
func (m *Mover) StatusExtra(rc *admin.Ctx, out map[string]any) {
	counts, err := m.o.DB.Read().CountMoves(rc.Ctx)
	if err != nil {
		return
	}
	var queued, running, incoming int64
	for k, n := range counts {
		role, state := k[0], k[1]
		switch {
		case role == meta.MoveOut && state == meta.MoveQueued:
			queued += n
		case role == meta.MoveOut && !meta.IsFinalMoveState(state):
			running += n
		case role == meta.MoveIn && !meta.IsFinalMoveState(state):
			incoming += n
		}
	}
	out["moves"] = map[string]int64{"queued": queued, "running": running, "incoming": incoming}
}
