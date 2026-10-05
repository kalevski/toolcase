package cluster

import (
	"context"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/hlc"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

// ---- views for the admin layer -----------------------------------------------

// PeerInfo describes one node of the cluster (GET /cluster, spec §6.9).
type PeerInfo struct {
	ID       string `json:"id"`
	Name     string `json:"name"`
	Endpoint string `json:"endpoint,omitempty"`
	Self     bool   `json:"self,omitempty"`
	// URLs are the configured peer-listener URLs last seen behind this node.
	URLs      []string  `json:"urls,omitempty"`
	Reachable bool      `json:"reachable"`
	LastSeen  time.Time `json:"last_seen,omitzero"`
	// LastPull is the last time ops were exchanged with this node successfully.
	LastPull time.Time `json:"last_pull,omitzero"`
	// Lag is how many ops this node holds that we have not applied.
	Lag int64 `json:"lag"`
	// PeerLag is how many ops we hold beyond what the node last acknowledged.
	PeerLag      int64         `json:"peer_lag"`
	ClockSkew    time.Duration `json:"clock_skew"`
	Version      string        `json:"version,omitempty"`
	Protocol     int           `json:"protocol,omitempty"`
	BucketsHomed int64         `json:"buckets_homed"`
	// Missing is how many of the buckets the catalog homes there the node says it
	// has no data for.
	Missing  int64    `json:"missing,omitempty"`
	FreeDisk int64    `json:"free_disk"`
	Cordoned bool     `json:"cordoned"`
	Draining bool     `json:"draining"`
	Ready    bool     `json:"ready"`
	KeyIDs   []string `json:"key_ids,omitempty"`
	Retired  bool     `json:"retired,omitempty"`
	// RetiredWhy says why: "redeployed: …" or "removed by an admin".
	RetiredWhy string `json:"retired_why,omitempty"`
	// Refused says why this node does not sync with it ("clone", "duplicate node
	// name …").
	Refused string `json:"refused,omitempty"`
	Error   string `json:"error,omitempty"`
}

// Self describes this node.
func (n *Node) Self() PeerInfo {
	n.mu.Lock()
	draining, cordoned := n.draining, n.cordoned
	n.mu.Unlock()
	cnt, _ := n.db.Read().CatalogCountByAux(context.Background(), KindBucket, n.id)
	return PeerInfo{
		ID: n.id, Name: n.name, Endpoint: n.cfg.EndpointURL, Self: true, Reachable: true,
		LastSeen: n.now(), Version: n.version, Protocol: ProtocolVersion, BucketsHomed: cnt, Missing: n.missingHere(context.Background()),
		FreeDisk: n.free(), Cordoned: cordoned, Draining: draining, Ready: n.Ready(), KeyIDs: n.keyIDStrings(),
	}
}

func (n *Node) free() int64 {
	if n.freeDisk == nil {
		return 0
	}
	return n.freeDisk()
}

// Peers lists the other nodes: one entry per node id seen behind the configured
// URLs (aliases are one entry), retired nodes included and flagged, and one
// entry without an id for every URL that has never answered.
func (n *Node) Peers() []PeerInfo {
	ours, _ := n.db.Read().CatalogVV(context.Background())
	n.mu.Lock()
	defer n.mu.Unlock()
	byID := map[string]*PeerInfo{}
	var out []*PeerInfo
	for _, u := range n.urls {
		s := n.us[u]
		id := s.id
		if id == "" {
			id = n.urlIDs[u]
		}
		if s.class == classSelf || id == n.id {
			continue
		}
		if id == "" {
			out = append(out, &PeerInfo{URLs: []string{u}, Error: orStr(s.err, "has not answered yet")})
			continue
		}
		pi := byID[id]
		if pi == nil {
			pi = &PeerInfo{ID: id}
			byID[id] = pi
			out = append(out, pi)
		}
		pi.URLs = append(pi.URLs, u)
		if s.up {
			pi.Reachable = true
		} else if pi.Error == "" {
			pi.Error = s.err
		}
		if s.lastOK.After(pi.LastSeen) {
			pi.LastSeen = s.lastOK
		}
		if s.hello != nil && (s.up || pi.Protocol == 0) {
			h := s.hello
			pi.Name, pi.Endpoint, pi.Version, pi.Protocol = h.Name, h.Endpoint, h.Version, h.Protocol
			pi.BucketsHomed, pi.Missing, pi.FreeDisk = h.Buckets, h.Missing, h.FreeDisk
			pi.Cordoned, pi.Draining, pi.Ready, pi.KeyIDs = h.Cordoned, h.Draining, h.Ready, h.KeyIDs
			pi.ClockSkew = s.skew
		}
		switch s.class {
		case classClone, classAmbiguous:
			pi.Refused = "clone: several processes answer under one node id"
		}
	}
	// retired nodes no URL answers for any more (a redeployed node's predecessor)
	for id, k := range n.known {
		if id != n.id && k.retired && byID[id] == nil {
			pi := &PeerInfo{ID: id}
			byID[id] = pi
			out = append(out, pi)
		}
	}
	for _, pi := range out {
		if pi.ID == "" {
			continue
		}
		if k := n.known[pi.ID]; k != nil {
			if pi.Name == "" {
				pi.Name = k.name
			}
			pi.Retired, pi.RetiredWhy = k.retired, k.retiredWhy
		}
		if why := n.dupName[pi.ID]; why != "" && pi.Refused == "" {
			pi.Refused = why
		}
		if p := n.peers[pi.ID]; p != nil {
			pi.LastPull, pi.Lag = p.lastPull, p.lag
			if p.pullErr != "" && pi.Error == "" {
				pi.Error = p.pullErr
			}
		}
		if ack, ok := n.acks[pi.ID]; ok {
			for o, top := range ours {
				if d := top - ack[o]; d > 0 {
					pi.PeerLag += d
				}
			}
		} else {
			for _, top := range ours {
				pi.PeerLag += top
			}
		}
	}
	res := make([]PeerInfo, 0, len(out))
	for _, pi := range out {
		sort.Strings(pi.URLs)
		res = append(res, *pi)
	}
	sort.SliceStable(res, func(i, j int) bool {
		if res[i].Name != res[j].Name {
			return res[i].Name < res[j].Name
		}
		return res[i].ID < res[j].ID
	})
	return res
}

func orStr(a, b string) string {
	if a != "" {
		return a
	}
	return b
}

// PeerByID returns the node with that id (this node included).
func (n *Node) PeerByID(id string) (PeerInfo, bool) {
	if id == n.id {
		return n.Self(), true
	}
	for _, p := range n.Peers() {
		if p.ID == id {
			return p, true
		}
	}
	return PeerInfo{}, false
}

// PeerByName returns the node with that name (this node included). A retired
// node is found only when no live node has the name.
func (n *Node) PeerByName(name string) (PeerInfo, bool) {
	if name == n.name {
		return n.Self(), true
	}
	var retired *PeerInfo
	for _, p := range n.Peers() {
		if p.Name != name || p.ID == "" {
			continue
		}
		if !p.Retired {
			return p, true
		}
		pp := p
		retired = &pp
	}
	if retired != nil {
		return *retired, true
	}
	return PeerInfo{}, false
}

// NodeName returns the name of a node id ("" when unknown): the catalog stores
// ids, the admin API shows names (§8.3).
func (n *Node) NodeName(id string) string {
	if id == n.id {
		return n.name
	}
	n.mu.Lock()
	defer n.mu.Unlock()
	if k := n.known[id]; k != nil {
		return k.name
	}
	return ""
}

// NodeID resolves a node name to its id (live nodes first; ok is false for an
// unknown name).
func (n *Node) NodeID(name string) (string, bool) {
	p, ok := n.PeerByName(name)
	return p.ID, ok
}

// PeerURL returns a peer-listener URL at which the node with that id answers,
// for the forwarder and the admin and move calls; ok is false for this node
// itself, an unknown or retired node and one that is not answering.
func (n *Node) PeerURL(id string) (string, bool) {
	n.mu.Lock()
	defer n.mu.Unlock()
	if id == n.id || n.retiredLocked(id) {
		return "", false
	}
	for _, u := range n.urls {
		if s := n.us[u]; s.up && s.id == id && s.class == classPeer {
			return u, true
		}
	}
	return "", false
}

// Retire marks a node that is gone for good (DELETE /cluster/nodes/{id}, §6.9):
// its catalog ops stay and keep replicating, but it no longer holds back
// compaction and `?wait=replicated` stops waiting for it. It fails with
// ErrHomesBuckets while the catalog still lists buckets homed on it. A retired
// node that answers again becomes a member again.
func (n *Node) Retire(ctx context.Context, id string) error {
	if id == n.id {
		return ErrSelf
	}
	n.mu.Lock()
	_, known := n.known[id]
	if !known {
		for _, u := range n.urls {
			if n.us[u].id == id || n.urlIDs[u] == id {
				known = true
			}
		}
	}
	n.mu.Unlock()
	if !known {
		return ErrUnknownNode
	}
	cnt, err := n.db.Read().CatalogCountByAux(ctx, KindBucket, id)
	if err != nil {
		return err
	}
	if cnt > 0 {
		return fmt.Errorf("%w (%d)", ErrHomesBuckets, cnt)
	}
	now := n.now()
	const why = "removed by an admin"
	n.mu.Lock()
	n.retireLocked(id, why, now)
	n.mu.Unlock()
	return n.db.Update(ctx, func(tx *meta.Tx) error { return tx.SetPeerRetired(ctx, id, true, why, now) })
}

// CountBucketsHomed counts the buckets the catalog homes on a node.
func (n *Node) CountBucketsHomed(ctx context.Context, nodeID string) (int64, error) {
	return n.db.Read().CatalogCountByAux(ctx, KindBucket, nodeID)
}

// hello builds this node's answer to GET /_peer/v1/hello.
func (n *Node) hello(ctx context.Context) helloMsg {
	n.mu.Lock()
	draining, cordoned := n.draining, n.cordoned
	n.mu.Unlock()
	q := n.db.Read()
	cnt, _ := q.CatalogCountByAux(ctx, KindBucket, n.id)
	vv, _ := q.CatalogVV(ctx)
	return helloMsg{
		NodeID: n.id, Name: n.name, Boot: n.boot, Protocol: ProtocolVersion, Version: n.version,
		KeyIDs: n.keyIDStrings(), Domain: n.cfg.Domain, Region: n.cfg.Region,
		BeforeTimeoutMS: n.cfg.PipelineBeforeTotalTimeout.Milliseconds(), Endpoint: n.cfg.EndpointURL,
		FreeDisk: n.free(), Buckets: cnt, Missing: n.missingHere(ctx), Cordoned: cordoned, Draining: draining,
		Ready: n.Ready(), Origin: n.Origin(), VV: vv, Time: n.now().UTC(), URLs: n.knownURLs(),
	}
}

// knownURLs maps every configured URL that answers to the node id behind it.
func (n *Node) knownURLs() map[string]string {
	n.mu.Lock()
	defer n.mu.Unlock()
	out := map[string]string{}
	for _, u := range n.urls {
		if s := n.us[u]; s.up && s.id != "" {
			out[u] = s.id
		}
	}
	return out
}

// ---- key ids -----------------------------------------------------------------

func parseKeyIDs(h http.Header) (ids map[seal.KeyID]bool, ok bool) {
	raw := h.Get(HeaderKeyIDs)
	if raw == "" {
		return nil, false
	}
	ids = map[seal.KeyID]bool{}
	for _, f := range strings.Split(raw, ",") {
		id, err := seal.ParseKeyID(strings.TrimSpace(f))
		if err != nil {
			return nil, false
		}
		ids[id] = true
	}
	return ids, true
}

// PeerRoute is what the forwarder needs to know about a node, without touching
// the database: where to send a request and whether to try at all.
type PeerRoute struct {
	ID   string
	Name string
	// URL is the peer-listener URL to forward to: one that answers if there is one,
	// otherwise the last known one ("" when the node has never been seen).
	URL string
	// Self: the route leads to this node itself.
	Self bool
	// Reachable: a URL of the node answered its last hello and pull. A request for
	// a bucket homed on a node that is not reachable fails fast with 503 (§8.4).
	Reachable bool
	// Draining: the node is shutting down; answer 503 at once (§9.4).
	Draining bool
	Cordoned bool
	Retired  bool
}

// Route describes how to reach a node id; ok is false when the id is unknown.
func (n *Node) Route(id string) (PeerRoute, bool) {
	if id == n.id {
		n.mu.Lock()
		defer n.mu.Unlock()
		return PeerRoute{ID: id, Name: n.name, Self: true, Reachable: true, Draining: n.draining, Cordoned: n.cordoned}, true
	}
	n.mu.Lock()
	defer n.mu.Unlock()
	r := PeerRoute{ID: id}
	found := false
	if k := n.known[id]; k != nil {
		r.Name, r.Retired, found = k.name, k.retired, true
	}
	for _, u := range n.urls {
		s := n.us[u]
		uid := s.id
		if uid == "" {
			uid = n.urlIDs[u]
		}
		if uid != id || s.class == classSelf {
			continue
		}
		found = true
		if r.URL == "" || (s.up && !r.Reachable) {
			r.URL = u
		}
		if s.up && s.class == classPeer && !n.retiredLocked(id) {
			r.Reachable = true
			if s.hello != nil {
				r.Draining, r.Cordoned, r.Name = s.hello.Draining, s.hello.Cordoned, s.hello.Name
			}
		}
	}
	return r, found
}

// Status is everything GET /cluster (spec §6.9) shows about the catalog side of
// the cluster; the admin layer adds the move and placement fields.
type Status struct {
	// Mode is "cluster", or "single" for a node without BINVAULT_CLUSTER_URLS.
	Mode   string     `json:"mode"`
	Ready  bool       `json:"ready"`
	Self   PeerInfo   `json:"self"`
	Peers  []PeerInfo `json:"nodes"`
	Alarms Alarms     `json:"alarms"`
	// Origin is the op stream this node writes to; VV what it has applied.
	Origin string           `json:"origin"`
	VV     map[string]int64 `json:"vv"`
	Log    LogStats         `json:"log"`
	// Fence says how the start-up fence ended: the URLs that stayed silent and the
	// new op stream, if one was started.
	Fence FenceStatus `json:"fence"`
}

// LogStats summarises the op log and the registers.
type LogStats struct {
	Ops        int64     `json:"ops"`
	OldestOp   time.Time `json:"oldest_op,omitzero"`
	Registers  int64     `json:"registers"`
	Tombstones int64     `json:"tombstones"`
}

// FenceStatus is the outcome of the start-up fence.
type FenceStatus struct {
	Done      bool     `json:"done"`
	Silent    []string `json:"silent,omitempty"`
	NewStream string   `json:"new_stream,omitempty"`
}

// Status gathers the cluster view for GET /cluster.
func (n *Node) Status(ctx context.Context) (Status, error) {
	st := Status{Mode: "cluster", Ready: n.Ready(), Self: n.Self(), Peers: n.Peers(), Origin: n.Origin()}
	if n.single {
		st.Mode = "single"
	}
	var err error
	if st.Alarms, err = n.Alarms(ctx); err != nil {
		return st, err
	}
	if st.VV, err = n.VersionVector(ctx); err != nil {
		return st, err
	}
	cs, err := n.db.Read().CatalogStats(ctx)
	if err != nil {
		return st, err
	}
	st.Log = LogStats{Ops: cs.Ops, Registers: cs.Registers, Tombstones: cs.Tombstones}
	if cs.OldestOpHLC > 0 {
		st.Log.OldestOp = hlc.Timestamp(cs.OldestOpHLC).Physical()
	}
	st.Fence.Done, st.Fence.Silent, st.Fence.NewStream = n.Fence()
	return st, nil
}

// Placement lists the nodes that may take a bucket now (spec §8.6), best first: the
// reachable, non-cordoned, non-draining nodes — this node included — with the most
// free disk according to the latest hello, ties to the lower name. A node that is
// retired, refused (clone, duplicate name) or still in its start-up fence is not a
// candidate.
func (n *Node) Placement() []PeerInfo {
	var out []PeerInfo
	consider := func(p PeerInfo) {
		if p.Retired || p.Refused != "" || !p.Reachable || p.Cordoned || p.Draining || !p.Ready || p.ID == "" {
			return
		}
		out = append(out, p)
	}
	consider(n.Self())
	for _, p := range n.Peers() {
		consider(p)
	}
	sort.SliceStable(out, func(i, j int) bool {
		if out[i].FreeDisk != out[j].FreeDisk {
			return out[i].FreeDisk > out[j].FreeDisk
		}
		return out[i].Name < out[j].Name
	})
	return out
}

// AutoPlacement picks the home for a new bucket that asked for `auto` (spec §8.6):
// the first of Placement. ok is false when nobody qualifies.
func (n *Node) AutoPlacement() (PeerInfo, bool) {
	if ps := n.Placement(); len(ps) > 0 {
		return ps[0], true
	}
	return PeerInfo{}, false
}
