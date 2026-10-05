package cluster

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net"
	"net/http"
	"net/url"
	"strconv"
	"sync"
	"time"
)

const (
	maxPullsPerRound = 200
	maxSnapshotBody  = 1 << 30
	snapshotTimeout  = 20 * time.Minute
	// deliveryWait is the longest a pull loop waits for the dispatcher before it
	// acknowledges: a subscriber that does not return must not stop the node from
	// replicating.
	deliveryWait = 10 * time.Second
)

// peerRef is a reachable peer and a URL to reach it at.
type peerRef struct{ id, url string }

// usablePeers lists the peers this node syncs with now: one per node id that
// answers, is not retired, is not a clone and does not share a name with another
// node.
func (n *Node) usablePeers() []peerRef {
	n.mu.Lock()
	defer n.mu.Unlock()
	var out []peerRef
	seen := map[string]bool{}
	for _, u := range n.urls {
		s := n.us[u]
		if !s.up || s.class != classPeer || seen[s.id] || n.retiredLocked(s.id) || n.dupName[s.id] != "" {
			continue
		}
		seen[s.id] = true
		out = append(out, peerRef{s.id, u})
	}
	return out
}

// startPullLoops starts a pull loop and a nudge loop for every peer that has none
// yet (once the node runs).
func (n *Node) startPullLoops() {
	n.lifeMu.Lock()
	defer n.lifeMu.Unlock()
	if n.stopping {
		return
	}
	n.mu.Lock()
	ctx := n.runCtx
	var todo []*peerState
	if ctx != nil && ctx.Err() == nil {
		for _, p := range n.peers {
			if !p.looping {
				p.looping = true
				todo = append(todo, p)
			}
		}
	}
	n.mu.Unlock()
	for _, p := range todo {
		n.wg.Add(2)
		go func(p *peerState) {
			defer n.wg.Done()
			n.pullLoop(ctx, p)
		}(p)
		go func(p *peerState) {
			defer n.wg.Done()
			n.nudgeLoop(ctx, p)
		}(p)
	}
}

// nudgeLoop tells one peer to pull now, whenever something asked for it; nudges
// that arrive while one is in flight coalesce into the next.
func (n *Node) nudgeLoop(ctx context.Context, p *peerState) {
	for {
		select {
		case <-ctx.Done():
			return
		case <-p.nudge:
		}
		u, _ := n.pullURL(p)
		if u == "" {
			continue
		}
		cctx, cancel := context.WithTimeout(ctx, 5*time.Second)
		_ = n.post(cctx, u+PeerPrefix+"notify", nil)
		cancel()
	}
}

// pullLoop pulls from one peer every BINVAULT_CLUSTER_PULL_INTERVAL and at once
// when the peer nudges (§8.5).
func (n *Node) pullLoop(ctx context.Context, p *peerState) {
	t := time.NewTicker(n.pullEvery)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		case <-p.kick:
		}
		_ = n.pullPeer(ctx, p)
	}
}

// kickPull makes the pull loop of a peer run now (all of them for an unknown
// caller).
func (n *Node) kickPull(id string) {
	n.mu.Lock()
	defer n.mu.Unlock()
	for pid, p := range n.peers {
		if id == "" || pid == id {
			select {
			case p.kick <- struct{}{}:
			default:
			}
		}
	}
}

var errNoURL = errors.New("no usable URL")

// pullURL picks the URL to pull from: the first configured URL that answers as
// the peer; "" with the reason when there is none.
func (n *Node) pullURL(p *peerState) (string, string) {
	n.mu.Lock()
	defer n.mu.Unlock()
	if n.retiredLocked(p.id) {
		return "", "retired"
	}
	if why := n.dupName[p.id]; why != "" {
		return "", why
	}
	for _, u := range n.urls {
		if s := n.us[u]; s.id == p.id && s.up && s.class == classPeer {
			return u, ""
		}
	}
	return "", "unreachable"
}

// pullPeer runs one pull exchange with a peer. Concurrent calls queue.
func (n *Node) pullPeer(ctx context.Context, p *peerState) error {
	p.pullMu.Lock()
	defer p.pullMu.Unlock()
	if ctx.Err() != nil {
		return ctx.Err()
	}
	u, why := n.pullURL(p)
	if u == "" {
		return fmt.Errorf("%w (%s)", errNoURL, why)
	}
	err := n.pullFrom(ctx, p, u)
	if err != nil && ctx.Err() == nil {
		n.notePullError(p, u, err)
	}
	return err
}

// pullAll pulls from every usable peer at once and waits (the start-up fence and
// SyncNow).
func (n *Node) pullAll(ctx context.Context) {
	n.mu.Lock()
	var ps []*peerState
	for _, p := range n.peers {
		ps = append(ps, p)
	}
	n.mu.Unlock()
	var wg sync.WaitGroup
	for _, p := range ps {
		wg.Add(1)
		go func(p *peerState) {
			defer wg.Done()
			_ = n.pullPeer(ctx, p)
		}(p)
	}
	wg.Wait()
}

// SyncNow pulls from every reachable peer at once and waits for the pulls, at
// most once a second: the forwarder calls it before it answers NoSuchBucket or
// InvalidAccessKeyId, because a bucket created a moment ago may not have
// replicated yet (§8.4). It reports whether it pulled (false: another sync ran
// within the last second; the caller just looks again).
func (n *Node) SyncNow(ctx context.Context) bool {
	if n.single {
		return false
	}
	n.mu.Lock()
	if time.Since(n.lastSync) < time.Second {
		n.mu.Unlock()
		return false
	}
	n.lastSync = time.Now()
	n.mu.Unlock()
	// the pulls outlive a caller that gives up (a client that disconnects), and a
	// pull already in flight (a big snapshot) must not hold the caller for long
	pctx, cancel := context.WithTimeout(context.WithoutCancel(ctx), 2*n.tune.RequestTimeout)
	done := make(chan struct{})
	go func() {
		defer cancel()
		defer close(done)
		n.pullAll(pctx)
	}()
	select {
	case <-done:
	case <-ctx.Done():
	case <-time.After(n.tune.RequestTimeout / 2):
	}
	return true
}

// notePullError records a failed exchange: a transport error marks the URL down
// (it is asked again with backoff); any other failure is just remembered.
func (n *Node) notePullError(p *peerState, u string, err error) {
	n.mu.Lock()
	p.pullErr = err.Error()
	if isTransportError(err) {
		if s := n.us[u]; s != nil && s.up {
			s.up, s.err = false, err.Error()
			s.fails++
			s.next = time.Now().Add(n.backoff(s.fails))
			n.log.Warn("a peer stopped answering", "peer", p.id, "url", u, "error", err)
		}
	}
	n.mu.Unlock()
	n.log.Debug("pull failed", "peer", p.id, "url", u, "error", err)
	n.kickDiscovery()
}

// isTransportError reports whether an error means the peer cannot be reached or
// the connection broke (as opposed to a peer that answered with something this
// node does not accept, or a failure of this node's own database).
func isTransportError(err error) bool {
	var ne net.Error
	return errors.As(err, &ne) || errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) || errors.Is(err, context.DeadlineExceeded)
}

// pullFrom pulls from one peer until it has nothing new. The final (empty)
// request carries the version vector after the last batch, which is the peer's
// acknowledgement that this node holds its ops and has put them into effect —
// what ?wait=replicated waits for. Every request is preceded by ackPoint: what the
// vector covers has reached the subscribers.
func (n *Node) pullFrom(ctx context.Context, p *peerState, u string) error {
	snapshots := 0
	applied := false
	// ops that were new here may be news to the other peers as well (a relay): one
	// nudge when the exchange ends, not one per batch
	defer func() {
		if applied {
			n.nudgePeers(p.id)
		}
	}()
	for i := 0; i < maxPullsPerRound; i++ {
		vv, err := n.ackPoint(ctx)
		if err != nil {
			return err
		}
		resp, err := n.fetchOps(ctx, u, vv)
		var se *statusError
		if errors.As(err, &se) && se.code == http.StatusConflict {
			if snapshots >= 2 {
				return errors.New("a snapshot did not close the gap to the peer's op log")
			}
			snapshots++
			if err := n.snapshotFrom(ctx, p, u); err != nil {
				return fmt.Errorf("snapshot: %w", err)
			}
			continue
		}
		if err != nil {
			return err
		}
		n.notePulled(p, resp.VV, vv, resp.Held)
		if len(resp.Ops) == 0 {
			return nil
		}
		res, err := n.applyRemote(ctx, resp.Ops, p.id)
		if err != nil {
			return err
		}
		if res.Applied > 0 {
			n.log.Debug("catalog ops applied", "from", p.id, "ops", res.Applied)
			applied = true
		}
		if res.Applied == 0 && res.Dups == 0 {
			return nil // nothing applicable (held ops): wait for the next round
		}
	}
	return nil
}

// ackPoint returns the version vector the next pull request carries. A peer takes
// it for this node's acknowledgement — everything in it is in effect here — and
// ?wait=replicated returns on it, so it must not run ahead of the subscribers (the
// pipeline package, say, turns a pipeline/<name> register into the pipeline the
// admin API shows only when the dispatcher hands it the change). The vector in the
// database covers every op this node has applied, and that includes the ops that
// another pull loop (a relay from a third peer) applied and queued behind the
// dispatcher in the meantime, so waiting for this loop's own batch is not enough.
// The vector is read together with the last ticket, under wmu, which a write holds
// from its commit to the enqueueing of its change (and the update of the in-memory
// bucket and key views): every op in the vector has its change in the queue, or
// delivered, at that point. The request goes out once that ticket is delivered.
// Ops that arrive meanwhile are not in the vector: the peer sends them again and
// they count as duplicates. A subscriber that does not return holds replication
// back for deliveryWait only.
func (n *Node) ackPoint(ctx context.Context) (map[string]int64, error) {
	n.wmu.Lock()
	vv, err := n.db.Read().CatalogVV(ctx)
	ticket := n.disp.last()
	n.wmu.Unlock()
	if err != nil {
		return nil, err
	}
	n.disp.waitFor(ctx, ticket, deliveryWait)
	return vv, nil
}

// notePulled records a successful exchange and the lag it showed.
func (n *Node) notePulled(p *peerState, peerVV, ours map[string]int64, withheld []HeldOp) {
	var lag int64
	for o, top := range peerVV {
		if d := top - ours[o]; d > 0 {
			lag += d
		}
	}
	n.mu.Lock()
	p.lastPull, p.pullErr, p.vv, p.lag = n.now(), "", peerVV, lag
	p.withheld = nil
	for _, h := range withheld {
		h.Direction = "withheld"
		h.Peer = p.id
		p.withheld = append(p.withheld, h)
	}
	n.mu.Unlock()
}

func (n *Node) fetchOps(ctx context.Context, u string, since map[string]int64) (*opsResponse, error) {
	q := "ops?since=" + url.QueryEscape(encodeVV(since)) + "&limit=" + strconv.Itoa(n.tune.PageOps)
	var resp opsResponse
	if _, err := n.getJSON(ctx, u+PeerPrefix+q, maxOpsBody, &resp); err != nil {
		return nil, err
	}
	return &resp, nil
}

// snapshotFrom fetches the peer's catalog and merges it (§8.5: for a new node
// and for one that fell behind compaction). The answer is read as a stream and
// merged in chunks, so a large catalog never sits in memory; the version vector
// is applied last, once every register is in.
func (n *Node) snapshotFrom(ctx context.Context, p *peerState, u string) error {
	ctx, cancel := context.WithTimeout(ctx, snapshotTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u+PeerPrefix+"snapshot", nil)
	if err != nil {
		return err
	}
	n.authRequest(req)
	resp, err := n.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		b, _ := io.ReadAll(io.LimitReader(resp.Body, 512))
		return &statusError{code: resp.StatusCode, body: clipBytes(b, 200)}
	}
	vv, count, err := n.readSnapshot(ctx, io.LimitReader(resp.Body, maxSnapshotBody), p.id)
	if err != nil {
		return err
	}
	if err := n.finishSnapshot(ctx, vv); err != nil {
		return err
	}
	n.log.Info("merged a catalog snapshot (the ops needed were compacted away, or this node is new)", "from", p.id, "registers", count)
	return nil
}

// readSnapshot parses a snapshot stream, merging chunks of registers as they
// arrive, and returns the version vector it carried and the number of registers.
func (n *Node) readSnapshot(ctx context.Context, r io.Reader, from string) (map[string]int64, int, error) {
	dec := json.NewDecoder(r)
	if t, err := dec.Token(); err != nil || t != json.Delim('{') {
		return nil, 0, errors.New("snapshot: not a JSON object")
	}
	var vv map[string]int64
	var chunk []wireReg
	count := 0
	for dec.More() {
		kt, err := dec.Token()
		if err != nil {
			return nil, 0, err
		}
		key, _ := kt.(string)
		switch key {
		case "vv":
			if err := dec.Decode(&vv); err != nil {
				return nil, 0, err
			}
			for o, s := range vv {
				if !originRe.MatchString(o) || s < 0 {
					return nil, 0, invalidf("snapshot version vector entry %q", clip(o))
				}
			}
		case "regs":
			if t, err := dec.Token(); err != nil || t != json.Delim('[') {
				return nil, 0, errors.New("snapshot: regs is not an array")
			}
			for dec.More() {
				var w wireReg
				if err := dec.Decode(&w); err != nil {
					return nil, 0, err
				}
				chunk = append(chunk, w)
				count++
				if len(chunk) >= n.tune.SnapshotChunk {
					if err := n.mergeRegs(ctx, chunk, from); err != nil {
						return nil, 0, err
					}
					chunk = chunk[:0]
				}
			}
			if _, err := dec.Token(); err != nil {
				return nil, 0, err
			}
		default:
			var skip json.RawMessage
			if err := dec.Decode(&skip); err != nil {
				return nil, 0, err
			}
		}
	}
	if t, err := dec.Token(); err != nil || t != json.Delim('}') {
		return nil, 0, errors.New("snapshot: truncated")
	}
	if vv == nil {
		return nil, 0, errors.New("snapshot: no version vector")
	}
	if err := n.mergeRegs(ctx, chunk, from); err != nil {
		return nil, 0, err
	}
	return vv, count, nil
}

// nudgePeers tells every reachable peer, except one, to pull now (POST
// /_peer/v1/notify): after a local write, and after ops were applied that other
// peers may not have yet.
func (n *Node) nudgePeers(except string) {
	if n.single || n.stopped.Load() {
		return
	}
	for _, r := range n.usablePeers() {
		if r.id == except {
			continue
		}
		n.mu.Lock()
		p := n.peers[r.id]
		n.mu.Unlock()
		if p == nil {
			continue
		}
		select {
		case p.nudge <- struct{}{}:
		default:
		}
	}
}

// ---- BucketExists: the create pre-check ---------------------------------------------

// BucketOnPeer is a peer's answer to "does your catalog know this bucket?".
type BucketOnPeer struct {
	NodeID     string `json:"node_id"`
	Node       string `json:"node"`
	Home       string `json:"home"`
	Epoch      int64  `json:"epoch"`
	Generation string `json:"generation"`
}

// PeersKnowBucket asks every reachable peer whether its catalog has a live
// entry for the bucket name (GET /_peer/v1/buckets/{name}): `POST /buckets`
// answers 409 when any does, which closes the window of a duplicate creation
// except for a simultaneous race or a partition (§8.5). It returns the peers
// that know the name and the ones that could not be asked.
func (n *Node) PeersKnowBucket(ctx context.Context, name string) (found []BucketOnPeer, unreachable []string) {
	peers := n.usablePeers()
	type answer struct {
		a   bucketAnswer
		err error
	}
	res := make([]answer, len(peers))
	var wg sync.WaitGroup
	for i, p := range peers {
		wg.Add(1)
		go func(i int, p peerRef) {
			defer wg.Done()
			cctx, cancel := context.WithTimeout(ctx, 3*time.Second)
			defer cancel()
			_, res[i].err = n.getJSON(cctx, p.url+PeerPrefix+"buckets/"+url.PathEscape(name), 1<<16, &res[i].a)
		}(i, p)
	}
	wg.Wait()
	for i, p := range peers {
		switch {
		case res[i].err != nil:
			unreachable = append(unreachable, orStr(n.NodeName(p.id), p.id))
		case res[i].a.Exists:
			found = append(found, BucketOnPeer{NodeID: p.id, Node: n.NodeName(p.id), Home: res[i].a.Home, Epoch: res[i].a.Epoch, Generation: res[i].a.Generation})
		}
	}
	return found, unreachable
}

// ---- WaitReplicated -------------------------------------------------------------------

// PendingPeer names a peer that has not yet applied an op.
type PendingPeer struct {
	ID   string `json:"id,omitempty"`
	Name string `json:"name,omitempty"`
	URL  string `json:"url,omitempty"`
}

// String is the name, or the id, or the URL.
func (p PendingPeer) String() string { return orStr(p.Name, orStr(p.ID, p.URL)) }

// WaitReplicated blocks until every active peer has applied all of the ops, or
// until the timeout (or ctx) ends, and returns the peers that have not: the
// admin API answers 200 when it is empty and 202 naming them otherwise (§8.5,
// §6.1). A peer's acknowledgement is the version vector it pulls with, so a peer
// has applied an op when its last pull's vector covers it; the pull loop pulls
// again at once after every batch to send that acknowledgement, and sends a
// vector only after the op's change has been delivered to the peer's subscribers
// (ackPoint), so what the op does there — the pipeline it defines, the key it
// indexes — is visible through that peer once it is acknowledged. Active peers are
// the nodes behind the configured URLs that are not this node, not retired and
// not clones; a URL that has never answered is pending until it does.
func (n *Node) WaitReplicated(ctx context.Context, ops []Op, timeout time.Duration) []PendingPeer {
	need := map[string]int64{}
	for _, op := range ops {
		if op.Seq > need[op.Origin] {
			need[op.Origin] = op.Seq
		}
	}
	if len(need) == 0 || n.single {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	for {
		n.mu.Lock()
		pending := n.pendingLocked(need)
		wake := n.ackWake
		n.mu.Unlock()
		if len(pending) == 0 {
			return nil
		}
		select {
		case <-ctx.Done():
			return pending
		case <-wake:
		}
	}
}

func (n *Node) pendingLocked(need map[string]int64) []PendingPeer {
	var pending []PendingPeer
	seen := map[string]bool{}
	for _, u := range n.urls {
		s := n.us[u]
		id := s.id
		if id == "" {
			id = n.urlIDs[u]
		}
		switch {
		case s.class == classSelf || id == n.id && s.class != classClone:
			continue
		case s.class == classClone:
			continue
		case id == "":
			pending = append(pending, PendingPeer{URL: u})
			continue
		case seen[id] || n.retiredLocked(id) || s.class == classAmbiguous:
			continue
		}
		seen[id] = true
		behind := false
		for o, seq := range need {
			if n.acks[id][o] < seq {
				behind = true
				break
			}
		}
		if behind {
			name := ""
			if k := n.known[id]; k != nil {
				name = k.name
			}
			pending = append(pending, PendingPeer{ID: id, Name: name, URL: u})
		}
	}
	return pending
}
