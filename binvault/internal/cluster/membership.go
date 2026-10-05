package cluster

import (
	"context"
	"errors"
	"fmt"
	"regexp"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// urlClass is what the node has concluded about one configured URL (§8.3).
type urlClass int

const (
	classUnknown   urlClass = iota // never answered, or the answer was not usable
	classSelf                      // answers with this node's id and boot nonce
	classPeer                      // answers with another node's id
	classClone                     // answers with this node's id but another boot nonce
	classAmbiguous                 // several processes answer under one id
)

// urlState is what the node knows about one URL of BINVAULT_CLUSTER_URLS.
type urlState struct {
	url        string
	id         string // the node id that answered last
	nonce      string
	class      urlClass
	up         bool // the last hello succeeded
	err        string
	fails      int
	lastOK     time.Time
	next       time.Time // the next hello is due
	hello      *helloMsg
	skew       time.Duration
	skewWarned bool
}

// peerState is the replication state of one other node, by id.
type peerState struct {
	id     string
	kick   chan struct{} // pull now
	nudge  chan struct{} // tell the peer to pull now
	pullMu sync.Mutex
	// guarded by Node.mu
	lastPull time.Time // the last successful ops exchange
	pullErr  string
	vv       map[string]int64 // the peer's version vector at its last answer
	lag      int64            // ops the peer holds that this node has not applied
	withheld []HeldOp         // ops the peer reports it holds back from this node
	looping  bool
}

// knownPeer mirrors a row of the peers table.
type knownPeer struct {
	name       string
	firstSeen  time.Time
	retired    bool
	retiredWhy string
}

// helloMsg is the answer to GET /_peer/v1/hello (spec §8.3).
type helloMsg struct {
	NodeID          string           `json:"node_id"`
	Name            string           `json:"name"`
	Boot            string           `json:"boot_nonce"`
	Protocol        int              `json:"protocol"`
	Version         string           `json:"version"`
	KeyIDs          []string         `json:"key_ids"` // current first
	Domain          string           `json:"domain"`
	Region          string           `json:"region"`
	BeforeTimeoutMS int64            `json:"pipeline_before_total_timeout_ms"`
	Endpoint        string           `json:"endpoint"`
	FreeDisk        int64            `json:"free_disk"`
	Buckets         int64            `json:"buckets_homed"`
	Missing         int64            `json:"missing"`
	Cordoned        bool             `json:"cordoned"`
	Draining        bool             `json:"draining"`
	Ready           bool             `json:"ready"`
	Origin          string           `json:"origin"`
	VV              map[string]int64 `json:"vv"`
	Time            time.Time        `json:"time"`
	// URLs says which node id answers at each configured URL this node reaches
	// (itself included). A node that cannot reach one of its own URLs (NAT
	// without hairpinning) learns from its peers that it is that node.
	URLs map[string]string `json:"urls,omitempty"`
}

var (
	bootRe  = regexp.MustCompile(`^[0-9a-f]{8,64}$`)
	keyIDRe = regexp.MustCompile(`^[0-9a-f]{8}$`)
)

// validHello checks a peer's answer for shape.
func validHello(h *helloMsg) error {
	switch {
	case !nodeIDRe.MatchString(h.NodeID):
		return fmt.Errorf("hello: node id %q is not valid", clip(h.NodeID))
	case !nodeNameRe.MatchString(h.Name):
		return fmt.Errorf("hello: node name %q is not valid", clip(h.Name))
	case !bootRe.MatchString(h.Boot):
		return errors.New("hello: boot nonce is not valid")
	case h.Protocol < 1:
		return fmt.Errorf("hello: protocol version %d", h.Protocol)
	case len(h.Endpoint) > 512 || len(h.Domain) > 253 || len(h.Region) > 64 || len(h.Version) > 64:
		return errors.New("hello: a field is too long")
	case len(h.KeyIDs) > 64:
		return errors.New("hello: too many key ids")
	case len(h.URLs) > 256:
		return errors.New("hello: too many urls")
	}
	for u, id := range h.URLs {
		if len(u) > 512 || !nodeIDRe.MatchString(id) {
			return errors.New("hello: bad url entry")
		}
	}
	for _, k := range h.KeyIDs {
		if !keyIDRe.MatchString(k) {
			return fmt.Errorf("hello: key id %q is not valid", clip(k))
		}
	}
	return nil
}

// ---- discovery ---------------------------------------------------------------

type helloResult struct {
	h   *helloMsg
	err error
	rtt time.Duration
}

// discoveryLoop asks every URL who it is, every HelloInterval; an unreachable
// URL is retried with backoff (§8.3).
func (n *Node) discoveryLoop(ctx context.Context) {
	for {
		n.discover(ctx, false)
		wait := n.untilNextHello()
		t := time.NewTimer(wait)
		select {
		case <-ctx.Done():
			t.Stop()
			return
		case <-n.discKick:
			t.Stop()
		case <-t.C:
		}
	}
}

func (n *Node) kickDiscovery() {
	select {
	case n.discKick <- struct{}{}:
	default:
	}
}

// untilNextHello is the time to the earliest URL whose hello is due.
func (n *Node) untilNextHello() time.Duration {
	n.mu.Lock()
	defer n.mu.Unlock()
	now := time.Now() // scheduling runs on real time, whatever clock the hybrid clock reads
	wait := n.tune.HelloInterval
	for _, s := range n.us {
		if d := s.next.Sub(now); d < wait {
			wait = d
		}
	}
	if wait < 20*time.Millisecond {
		wait = 20 * time.Millisecond
	}
	return wait
}

// backoff is the delay before an unreachable URL is asked again.
func (n *Node) backoff(fails int) time.Duration {
	d := n.tune.BackoffMin
	for i := 1; i < fails && d < n.tune.BackoffMax; i++ {
		d *= 2
	}
	return min(d, n.tune.BackoffMax)
}

// discover calls hello on the URLs that are due (all of them with force) and
// classifies the answers. Rounds are serialised.
func (n *Node) discover(ctx context.Context, force bool) {
	n.discMu.Lock()
	defer n.discMu.Unlock()
	urls := n.dueURLs(force)
	if len(urls) == 0 || ctx.Err() != nil {
		return
	}
	res := make(map[string]helloResult, len(urls))
	var rmu sync.Mutex
	var wg sync.WaitGroup
	for _, u := range urls {
		wg.Add(1)
		go func(u string) {
			defer wg.Done()
			var h helloMsg
			start := time.Now()
			hctx, cancel := context.WithTimeout(ctx, n.tune.HelloTimeout)
			defer cancel()
			_, err := n.getJSON(hctx, u+PeerPrefix+"hello", 1<<16, &h)
			r := helloResult{rtt: time.Since(start)}
			if err == nil {
				if err = validHello(&h); err == nil {
					r.h = &h
				}
			}
			r.err = err
			rmu.Lock()
			res[u] = r
			rmu.Unlock()
		}(u)
	}
	wg.Wait()
	if ctx.Err() != nil {
		return
	}
	n.classify(ctx, urls, res)
}

// dueURLs returns the URLs to ask now: those whose hello is due, plus every URL
// that was last seen behind the same node id as one of them, so that a restarted
// node reachable under two names is judged on fresh answers from both.
func (n *Node) dueURLs(force bool) []string {
	n.mu.Lock()
	defer n.mu.Unlock()
	now := time.Now()
	due := map[string]bool{}
	ids := map[string]bool{}
	for _, u := range n.urls {
		if s := n.us[u]; force || !now.Before(s.next) {
			due[u] = true
			if s.id != "" {
				ids[s.id] = true
			}
		}
	}
	var out []string
	for _, u := range n.urls {
		if due[u] || (n.us[u].id != "" && ids[n.us[u].id]) {
			out = append(out, u)
		}
	}
	return out
}

// classify applies a round of hello answers: it decides which URL is this node,
// which are peers, which are clones, which node was redeployed, who shares a
// name; it persists what must survive a restart and starts pull loops for new
// peers (§8.3).
func (n *Node) classify(ctx context.Context, urls []string, res map[string]helloResult) {
	now := n.now()
	type mut func(ctx context.Context, tx *meta.Tx) error
	var muts []mut
	var logs []func()
	fresh := map[string]bool{}

	n.mu.Lock()
	for _, u := range urls {
		s := n.us[u]
		r := res[u]
		if r.err != nil {
			wasUp := s.up
			s.up, s.err = false, r.err.Error()
			s.fails++
			s.next = time.Now().Add(n.backoff(s.fails))
			if s.class == classClone || s.class == classAmbiguous {
				s.class = classUnknown // nothing answers there any more: nothing to refuse
			}
			if wasUp {
				uu, e := u, r.err
				logs = append(logs, func() { n.log.Warn("cluster URL stopped answering", "url", uu, "error", e) })
			}
			continue
		}
		h := r.h
		wasUp := s.up
		s.up, s.err, s.fails = true, "", 0
		s.lastOK, s.next = now, time.Now().Add(n.tune.HelloInterval)
		s.id, s.nonce, s.hello = h.NodeID, h.Boot, h
		s.skew = h.Time.Sub(now.Add(-r.rtt / 2))
		fresh[u] = true
		if !wasUp && h.NodeID != n.id && n.peerKnownLocked(h.NodeID) {
			uu, id, nm := u, h.NodeID, h.Name
			logs = append(logs, func() { n.log.Info("cluster URL answers again", "url", uu, "node", nm, "node_id", id) })
		}
		if abs := absDur(s.skew); abs > n.maxSkew && !s.skewWarned {
			s.skewWarned = true
			uu, sk := u, s.skew.Round(time.Millisecond)
			logs = append(logs, func() {
				n.log.Warn("a peer's clock is far from ours; its ops stamped in the future will be held", "url", uu, "skew", sk, "max", n.maxSkew)
			})
		} else if abs <= n.maxSkew {
			s.skewWarned = false
		}
	}

	// self, clone, peer
	for u := range fresh {
		s := n.us[u]
		switch {
		case s.id == n.id && s.nonce == n.boot:
			s.class = classSelf
		case s.id == n.id:
			if s.class != classClone {
				uu := u
				logs = append(logs, func() {
					n.log.Error("clone detected: a server answers with this node's id but another boot nonce; its data dir was copied from ours. Remove its data dir so it generates a new id; sync with it is refused", "url", uu)
				})
			}
			s.class = classClone
		default:
			s.class = classPeer
		}
	}
	// one id behind several URLs: fine (aliases), unless different processes answer
	byID := map[string][]*urlState{}
	for _, u := range n.urls {
		s := n.us[u]
		if s.up && s.id != "" && s.id != n.id {
			byID[s.id] = append(byID[s.id], s)
		}
	}
	for id, group := range byID {
		nonces := map[string]bool{}
		for _, s := range group {
			nonces[s.nonce] = true
		}
		if len(nonces) <= 1 {
			continue
		}
		stale := false
		for _, s := range group {
			if !fresh[s.url] {
				s.next = time.Now() // judge it on a fresh answer before alarming
				stale = true
			}
		}
		if stale {
			continue
		}
		for _, s := range group {
			if s.class != classAmbiguous {
				uu, ii := s.url, id
				logs = append(logs, func() {
					n.log.Error("several processes answer under one node id (a copied data dir); sync with them is refused", "url", uu, "node_id", ii)
				})
			}
			s.class = classAmbiguous
		}
	}

	// redeployed: a URL that answers with another id than before
	for _, u := range n.urls {
		if !fresh[u] {
			continue
		}
		s := n.us[u]
		prev := n.urlIDs[u]
		if prev == s.id {
			continue
		}
		if prev != "" && prev != n.id && !n.retiredLocked(prev) && !n.visibleElsewhereLocked(prev, u) {
			why := fmt.Sprintf("redeployed: %s now answers as %s", u, s.id)
			n.retireLocked(prev, why, now)
			uu, pp, id := u, prev, s.id
			logs = append(logs, func() {
				n.log.Info("the server behind a cluster URL was redeployed; retiring its old id (its catalog ops stay)", "url", uu, "old_id", pp, "new_id", id)
			})
			p, w := prev, why
			muts = append(muts, func(ctx context.Context, tx *meta.Tx) error { return tx.SetPeerRetired(ctx, p, true, w, now) })
		}
		n.urlIDs[u] = s.id
		uu, id := u, s.id
		muts = append(muts, func(ctx context.Context, tx *meta.Tx) error { return tx.SetPeerURL(ctx, uu, id) })
	}

	// names, revival
	for _, u := range n.urls {
		s := n.us[u]
		if !fresh[u] || (s.class != classPeer && s.class != classAmbiguous) {
			continue
		}
		k := n.known[s.id]
		if k == nil {
			k = &knownPeer{name: s.hello.Name, firstSeen: now}
			n.known[s.id] = k
		}
		if k.name != s.hello.Name {
			k.name = s.hello.Name
		}
		id, nm := s.id, s.hello.Name
		muts = append(muts, func(ctx context.Context, tx *meta.Tx) error { return tx.UpsertPeer(ctx, id, nm, now) })
		if k.retired && s.class == classPeer {
			k.retired, k.retiredWhy = false, ""
			logs = append(logs, func() { n.log.Info("a retired node answers again; it is a member again", "node_id", id, "node", nm) })
			muts = append(muts, func(ctx context.Context, tx *meta.Tx) error { return tx.SetPeerRetired(ctx, id, false, "", now) })
		}
	}
	for _, u := range n.urls {
		if s := n.us[u]; fresh[u] && s.class == classPeer && n.peers[s.id] == nil {
			n.peers[s.id] = newPeerState(s.id)
		}
	}

	// URLs this node cannot reach itself: believe what a peer that can reach them
	// says (a node behind NAT without hairpinning never sees its own URL)
	for _, u := range n.urls {
		s := n.us[u]
		if !fresh[u] || s.class != classPeer {
			continue
		}
		for url, id := range s.hello.URLs {
			t := n.us[url]
			if t == nil || t.up || t.id != "" || n.urlIDs[url] != "" {
				continue
			}
			n.urlIDs[url] = id
			uu, ii, via := url, id, s.hello.Name
			logs = append(logs, func() {
				n.log.Info("a peer reports which node answers at a URL this node cannot reach", "url", uu, "node_id", ii, "peer", via)
			})
			muts = append(muts, func(ctx context.Context, tx *meta.Tx) error { return tx.SetPeerURL(ctx, uu, ii) })
		}
	}
	n.recomputeDupNamesLocked(&logs)
	n.mu.Unlock()

	if len(muts) > 0 {
		err := n.db.Update(ctx, func(tx *meta.Tx) error {
			for _, m := range muts {
				if err := m(ctx, tx); err != nil {
					return err
				}
			}
			return nil
		})
		if err != nil {
			n.log.Error("saving the cluster membership failed", "error", err)
		}
	}
	for _, l := range logs {
		l()
	}
	n.startPullLoops()
}

func newPeerState(id string) *peerState {
	return &peerState{id: id, kick: make(chan struct{}, 1), nudge: make(chan struct{}, 1), vv: map[string]int64{}}
}

func absDur(d time.Duration) time.Duration {
	if d < 0 {
		return -d
	}
	return d
}

func (n *Node) retiredLocked(id string) bool {
	k := n.known[id]
	return k != nil && k.retired
}

func (n *Node) peerKnownLocked(id string) bool { return n.known[id] != nil }

// visibleElsewhereLocked reports whether a node id currently answers at a URL
// other than except.
func (n *Node) visibleElsewhereLocked(id, except string) bool {
	for _, u := range n.urls {
		if s := n.us[u]; u != except && s.up && s.id == id {
			return true
		}
	}
	return false
}

func (n *Node) retireLocked(id, why string, at time.Time) {
	k := n.known[id]
	if k == nil {
		k = &knownPeer{firstSeen: at}
		n.known[id] = k
	}
	k.retired, k.retiredWhy = true, why
	delete(n.acks, id)
	delete(n.dupName, id)
	n.wakeAcksLocked()
}

func (n *Node) wakeAcksLocked() {
	close(n.ackWake)
	n.ackWake = make(chan struct{})
}

// recomputeDupNamesLocked refuses every node that shares a name with another
// live node (§8.3): the duplicate is reported and nothing is synced with it. The
// check looks only at nodes that answer now, and a retired node does not count.
func (n *Node) recomputeDupNamesLocked(logs *[]func()) {
	names := map[string]map[string]bool{n.name: {n.id: true}}
	for _, u := range n.urls {
		s := n.us[u]
		if !s.up || s.hello == nil || s.id == n.id || n.retiredLocked(s.id) {
			continue
		}
		if names[s.hello.Name] == nil {
			names[s.hello.Name] = map[string]bool{}
		}
		names[s.hello.Name][s.id] = true
	}
	next := map[string]string{}
	for name, ids := range names {
		if len(ids) < 2 {
			continue
		}
		for id := range ids {
			if id != n.id {
				next[id] = fmt.Sprintf("duplicate node name %q", name)
			}
		}
	}
	for id, why := range next {
		if n.dupName[id] != why {
			i, w := id, why
			*logs = append(*logs, func() {
				n.log.Error("two nodes share a name; sync with it is refused until one of them is renamed (BINVAULT_NODE_NAME)", "node_id", i, "reason", w)
			})
		}
	}
	n.dupName = next
}

// refreshPeer schedules an immediate hello for the URLs last seen behind id (all
// URLs that are not answering when the id is unknown).
func (n *Node) refreshPeer(id string) {
	n.mu.Lock()
	now := time.Now()
	hit := false
	for _, u := range n.urls {
		s := n.us[u]
		if (id != "" && s.id == id) || (!s.up && (id == "" || s.id == "")) {
			s.next = now
			hit = true
		}
	}
	n.mu.Unlock()
	if hit {
		n.kickDiscovery()
	}
}

// noteInbound is called for an authenticated request from node id: whoever
// reaches us is alive, so a URL we still think is down is asked again at once.
func (n *Node) noteInbound(id string) {
	if id == "" || id == n.id {
		return
	}
	n.mu.Lock()
	down := false
	for _, u := range n.urls {
		if s := n.us[u]; !s.up && (s.id == id || n.urlIDs[u] == id) {
			down = true
		}
	}
	n.mu.Unlock()
	if down {
		n.refreshPeer(id)
	}
}

// announce tells every reachable peer to run hello against this node now.
func (n *Node) announce() {
	for _, p := range n.usablePeers() {
		go func(u string) {
			ctx, cancel := context.WithTimeout(context.Background(), n.tune.RequestTimeout)
			defer cancel()
			_ = n.post(ctx, u+PeerPrefix+"notify", map[string]string{HeaderHello: "1"})
		}(p.url)
	}
}
