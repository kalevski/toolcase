// Package cluster is binvault's cluster core (spec §8): node identity and
// membership, the peer API, and the replicated catalog — which node homes which
// bucket, the pipeline definitions and the access-key index — kept in sync by an
// op log, a hybrid logical clock and per-register last-writer-wins. It is
// adapted from zonewright's replication (zonewright/REPLICATION.md), with the
// registers of the catalog instead of the registers of a DNS zone.
//
// Everything a bucket's home does with its objects, tokens and attachments is
// outside this package: the catalog only says where a bucket lives (and under
// which epoch and generation), which pipelines exist and which bucket an access
// key belongs to. The integration code calls New, registers its hooks
// (OnChange), mounts Handler on the peer listener, calls Start and waits for
// Ready before it serves any bucket.
//
// # Convergence
//
// An op is (origin, seq, hlc, kind, key, payload). A register keeps the value of
// the op with the highest (hlc, origin) — a pure comparison, so any set of ops
// applied in any order, with duplicates, gives identical registers on every
// node. There is deliberately no per-op ownership check (§8.3): whether an op is
// applied never depends on which other ops have arrived. Ops are validated for
// shape and canonical form, held when stamped too far in the future, from a
// newer protocol or sealed under a key this node cannot open, and applied in
// batches, each in one SQLite transaction. The version vector says, per origin,
// up to which seq every op has been applied; a batch only ever extends it
// without gaps.
//
// # Integration
//
// Boot order: New; OnChange for every consumer of remote changes (the pipeline
// package turns pipeline/<name> registers into its own tables); Handler on the
// peer listener, with Mux().RegisterPeer for the admin and move calls and
// Mux().SetForward for forwarded S3 requests — the listener must already answer
// when Start runs, because the start-up fence asks every URL of the list, this
// node's own included, who it is; then Start, and wait for Ready (/_healthz says
// 503 starting meanwhile). After the fence: Replay (changes that arrived while
// the application was down), OrphansOf and MissingBuckets against the local
// buckets, then serve. Shutdown: SetDraining(true), stop the listeners, Stop.
//
// A register is last-writer-wins and peers are not checked, so a concurrent write
// can replace the entry the home wrote with a value that lacks its latest change
// (a hand-off that arrives after the new home attached a pipeline). The home owns
// the truth about its bucket: it treats a remote Change for a bucket it homes as
// news and republishes what differs (the attachment names are derived data).
//
// # Locking
//
// wmu serialises every writer of the op log and the registers (local writes,
// remote batches, snapshot merges, compaction). mu guards the in-memory
// membership state and is never held across SQL or network I/O. Hooks run on a
// dispatcher goroutine and may call any method, including the write methods.
package cluster

import (
	"context"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/hlc"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/obs"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

// Keys of the node-local key/value table the package uses.
const (
	kvOrigin   = "cluster_origin"
	kvCordoned = "cluster_cordoned"
)

// Options configure New.
type Options struct {
	// Config supplies the cluster settings (BINVAULT_CLUSTER_*, the node name,
	// region, domain, endpoint and the pipeline budget that hello compares). A
	// config without BINVAULT_CLUSTER_URLS makes a cluster of one: no peers, no
	// fence, every write allowed.
	Config *config.Config
	// DB is the node's metadata database (migration 2 applied).
	DB *meta.DB
	// NodeID is the node's id, created at first start and kept in the kv table
	// under "node_id" (§8.3); the cluster never generates or changes it.
	NodeID string
	// Ring is the master keyring: it says which sealed values this node can open
	// and goes into hello as key ids. A nil ring opens nothing.
	Ring *seal.Keyring
	Log  *slog.Logger
	// Registry, when set, receives the cluster metrics of §9.2.
	Registry *obs.Registry
	// Version is the binary version reported in hello.
	Version string
	// FreeDisk reports the free bytes of the data volume for hello (nil: 0).
	FreeDisk func() int64
	// LocalBuckets lists the buckets this node holds locally, for the orphan and
	// `missing` alarms (nil: those alarms are empty).
	LocalBuckets func(ctx context.Context) ([]LocalBucket, error)
	// Now overrides the wall clock of the hybrid clock, the clock guard and the
	// retention cut-off (tests).
	Now    func() time.Time
	Tuning Tuning
}

// Tuning holds the timers that the spec fixes but tests need to shrink, and a
// hook they use to open the windows that are otherwise a few microseconds wide.
// A zero field takes its default.
type Tuning struct {
	// HelloInterval is how often every URL is asked who it is (30s, §8.3).
	HelloInterval time.Duration
	// HelloTimeout bounds one hello call (5s), so that a URL that swallows
	// connections cannot stall a discovery round or the start-up fence.
	HelloTimeout time.Duration
	// BackoffMin and BackoffMax bound the retry delay of an unreachable URL
	// (1s, 30s).
	BackoffMin, BackoffMax time.Duration
	// FencePoll is the pause between rounds of the start-up fence (500ms).
	FencePoll time.Duration
	// RequestTimeout bounds one hello, ops, notify or bucket-check call (20s).
	RequestTimeout time.Duration
	// CompactEvery is how often compaction runs (1h).
	CompactEvery time.Duration
	// PageOps is the largest number of ops in one /ops response (1000).
	PageOps int
	// SnapshotChunk is how many registers one snapshot merge transaction
	// covers (1000).
	SnapshotChunk int
	// BeforeDeliver, when set, runs on the dispatcher's goroutine ahead of every
	// batch of changes that reaches the subscribers: a test holds a delivery back
	// with it, so that an op is applied and its effects are not there yet.
	BeforeDeliver func(changes []Change)
}

func (t Tuning) withDefaults() Tuning {
	def := func(p *time.Duration, v time.Duration) {
		if *p <= 0 {
			*p = v
		}
	}
	def(&t.HelloInterval, 30*time.Second)
	def(&t.HelloTimeout, 5*time.Second)
	def(&t.BackoffMin, time.Second)
	def(&t.BackoffMax, 30*time.Second)
	def(&t.FencePoll, 500*time.Millisecond)
	def(&t.RequestTimeout, 20*time.Second)
	def(&t.CompactEvery, time.Hour)
	if t.PageOps <= 0 {
		t.PageOps = 1000
	}
	if t.SnapshotChunk <= 0 {
		t.SnapshotChunk = 1000
	}
	return t
}

// Node is this server's cluster agent.
type Node struct {
	cfg  *config.Config
	db   *meta.DB
	log  *slog.Logger
	now  func() time.Time
	tune Tuning
	ring *seal.Keyring

	id       string
	name     string
	boot     string // boot nonce: changes at every start (§8.3)
	version  string
	freeDisk func() int64
	local    func(ctx context.Context) ([]LocalBucket, error)
	single   bool
	// the effective settings (a zero value in the config takes its §2.3 default)
	pullEvery, maxSkew, fenceFor, retention time.Duration
	urls                                    []string // BINVAULT_CLUSTER_URLS, in order
	keys                                    [][]byte // keys[0] is sent, all are accepted
	keyHash                                 [][sha256.Size]byte

	clock *hlc.Clock

	client *http.Client
	fwd    *http.Transport

	ready    atomic.Bool
	readyCh  chan struct{}
	readyOne sync.Once
	started  atomic.Bool
	stopped  atomic.Bool
	cancel   context.CancelFunc
	runCtx   context.Context // set by Start
	wg       sync.WaitGroup

	// wmu serialises every writer of the op log and the registers.
	wmu sync.Mutex
	// lifeMu guards Start and Stop against the goroutines that join the wait group.
	lifeMu   sync.Mutex
	stopping bool

	disp *dispatcher
	bm   *bucketMirror
	mux  *Mux

	discMu   sync.Mutex // one discovery round at a time
	discKick chan struct{}

	// mu guards everything below.
	mu       sync.Mutex
	origin   string                // the op stream this node writes to
	us       map[string]*urlState  // by configured URL
	peers    map[string]*peerState // by node id
	known    map[string]*knownPeer // the persisted peers table, by node id
	urlIDs   map[string]string     // persisted: the node id that answered at a URL last
	acks     map[string]map[string]int64
	ackWake  chan struct{}
	dupName  map[string]string // node id -> why we refuse it (duplicate name)
	conflict []Conflict
	heldIn   map[string]HeldOp            // by origin: the op a stream is stuck at
	heldOut  map[string]map[string]HeldOp // by caller node id, by origin
	draining bool
	cordoned bool
	fenceEnd time.Time
	fenceLog fenceOutcome
	lastSync time.Time
	compact  compactState
	// missCache caches the count of buckets homed here with no local data.
	missCache struct {
		at time.Time
		v  int64
	}
}

// New builds the node: it loads its persisted state and prepares the clients and
// the peer-API mux. It opens no listener and starts nothing; see Start.
func New(opt Options) (*Node, error) {
	cfg := opt.Config
	if cfg == nil {
		return nil, errors.New("cluster: no config")
	}
	if opt.DB == nil {
		return nil, errors.New("cluster: no database")
	}
	if !ValidNodeID(opt.NodeID) {
		return nil, fmt.Errorf("cluster: node id %q is not valid", opt.NodeID)
	}
	n := &Node{
		cfg: cfg, db: opt.DB, log: opt.Log, now: opt.Now, tune: opt.Tuning.withDefaults(), ring: opt.Ring,
		id: opt.NodeID, name: cfg.NodeName, version: opt.Version, freeDisk: opt.FreeDisk, local: opt.LocalBuckets,
		single: !cfg.ClusterEnabled(), urls: append([]string(nil), cfg.ClusterURLs...),
		readyCh: make(chan struct{}), discKick: make(chan struct{}, 1), ackWake: make(chan struct{}),
		us: map[string]*urlState{}, peers: map[string]*peerState{}, known: map[string]*knownPeer{},
		urlIDs: map[string]string{}, acks: map[string]map[string]int64{}, dupName: map[string]string{},
		heldIn: map[string]HeldOp{}, heldOut: map[string]map[string]HeldOp{},
		bm: newBucketMirror(),
	}
	if n.log == nil {
		n.log = slog.Default()
	}
	orDur := func(v, def time.Duration) time.Duration {
		if v <= 0 {
			return def
		}
		return v
	}
	n.pullEvery = orDur(cfg.ClusterPullInterval, 5*time.Second)
	n.maxSkew = orDur(cfg.ClusterMaxClockSkew, 2*time.Minute)
	n.fenceFor = orDur(cfg.ClusterStartupFence, 30*time.Second)
	n.retention = orDur(cfg.ClusterRetention, 720*time.Hour)
	if n.now == nil {
		n.now = time.Now
	}
	if n.name == "" {
		n.name = "local"
	}
	var nonce [12]byte
	if _, err := rand.Read(nonce[:]); err != nil {
		return nil, err
	}
	n.boot = hex.EncodeToString(nonce[:])
	for _, k := range cfg.ClusterKey {
		n.keys = append(n.keys, append([]byte(nil), k...))
		n.keyHash = append(n.keyHash, sha256.Sum256(k))
	}
	if !n.single && len(n.keys) == 0 {
		return nil, errors.New("cluster: BINVAULT_CLUSTER_URLS is set but there is no cluster key")
	}
	for _, u := range n.urls {
		if !cfg.ClusterInsecureHTTP && strings.HasPrefix(u, "http://") {
			return nil, fmt.Errorf("cluster: peer URL %s is plain HTTP: use https://, or set BINVAULT_CLUSTER_INSECURE_HTTP=true on a private network or VPN", u)
		}
		n.us[u] = &urlState{url: u}
	}
	var err error
	if n.client, n.fwd, err = newTransports(cfg, n.tune); err != nil {
		return nil, err
	}
	ctx := context.Background()
	max, err := n.db.Read().CatalogMaxHLC(ctx)
	if err != nil {
		return nil, fmt.Errorf("cluster: reading the catalog clock: %w", err)
	}
	n.clock = hlc.New(hlc.Timestamp(max), n.now)
	if err := n.loadState(ctx); err != nil {
		return nil, err
	}
	n.disp = newDispatcher(n.log)
	n.disp.before = n.tune.BeforeDeliver
	n.mux = newMux(n)
	if n.single {
		n.setReady() // a cluster of one has no fence
	}
	if opt.Registry != nil {
		n.registerMetrics(opt.Registry)
	}
	return n, nil
}

// loadState reads what survives a restart: the op stream, the cordon flag, the
// peers table and the URL -> node id memory; and fills the bucket mirror.
func (n *Node) loadState(ctx context.Context) error {
	q := n.db.Read()
	origin, err := q.KVGet(ctx, kvOrigin)
	switch {
	case err == nil && originRe.MatchString(origin) && NodeOf(origin) == n.id:
		n.origin = origin
	case err == nil || errors.Is(err, meta.ErrNotFound):
		n.origin = n.id
	default:
		return err
	}
	if v, err := q.KVGet(ctx, kvCordoned); err == nil {
		n.cordoned = v == "1"
	} else if !errors.Is(err, meta.ErrNotFound) {
		return err
	}
	rows, err := q.ListPeers(ctx)
	if err != nil {
		return err
	}
	for _, p := range rows {
		n.known[p.NodeID] = &knownPeer{name: p.Name, firstSeen: p.FirstSeen, retired: p.Retired, retiredWhy: p.RetiredWhy}
	}
	if n.urlIDs, err = q.PeerURLs(ctx); err != nil {
		return err
	}
	// a node always knows itself, so it can compare its own name with a peer's
	if err := n.db.Update(ctx, func(tx *meta.Tx) error { return tx.UpsertPeer(ctx, n.id, n.name, tx.Now()) }); err != nil {
		return err
	}
	if _, ok := n.known[n.id]; !ok {
		n.known[n.id] = &knownPeer{name: n.name, firstSeen: n.now()}
	}
	return n.bm.load(ctx, q)
}

// ID is this node's id.
func (n *Node) ID() string { return n.id }

// Name is this node's name (BINVAULT_NODE_NAME).
func (n *Node) Name() string { return n.name }

// Single reports whether the node runs without peers (no BINVAULT_CLUSTER_URLS).
func (n *Node) Single() bool { return n.single }

// Origin is the op stream this node currently writes to: its id, or a fresh
// "<id>.<hex>" after a start-up fence that ended with a silent peer.
func (n *Node) Origin() string {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.origin
}

// Ready reports whether the start-up fence has ended (§8.5): until then the node
// accepts no catalog write and the application must serve no bucket (503).
func (n *Node) Ready() bool { return n.ready.Load() }

// WaitReady blocks until the fence has ended, ctx is done or the node stopped.
func (n *Node) WaitReady(ctx context.Context) error {
	select {
	case <-n.readyCh:
		return nil
	case <-ctx.Done():
		return ctx.Err()
	}
}

func (n *Node) setReady() {
	n.ready.Store(true)
	n.readyOne.Do(func() { close(n.readyCh) })
}

// Start launches the node's goroutines and returns at once: peer discovery, the
// start-up fence (watch Ready), one pull loop per peer, compaction and the hook
// dispatcher. The peer listener must already serve Handler, because the fence
// asks every URL of the list, this node's own included, who it is. Start can be
// called once; cancelling ctx or calling Stop ends everything.
func (n *Node) Start(ctx context.Context) error {
	n.lifeMu.Lock()
	defer n.lifeMu.Unlock()
	if n.stopping {
		return ErrStopped
	}
	if !n.started.CompareAndSwap(false, true) {
		return errors.New("cluster: already started")
	}
	ctx, n.cancel = context.WithCancel(ctx)
	n.mu.Lock()
	n.runCtx = ctx
	n.mu.Unlock()
	n.wg.Add(2)
	go func() { defer n.wg.Done(); n.disp.run(ctx) }()
	go func() { defer n.wg.Done(); n.run(ctx) }()
	return nil
}

// Stop ends the goroutines, waits for them and drops idle peer connections. It
// does not close the database.
func (n *Node) Stop() {
	n.lifeMu.Lock()
	if n.stopping {
		n.lifeMu.Unlock()
		return
	}
	n.stopping = true
	n.stopped.Store(true)
	cancel := n.cancel
	n.lifeMu.Unlock()
	if cancel != nil {
		cancel()
	}
	n.disp.stop()
	done := make(chan struct{})
	go func() { n.wg.Wait(); close(done) }()
	select {
	case <-done:
	case <-time.After(10 * time.Second):
		// a subscriber of OnChange that does not return holds the dispatcher; do not
		// hold the shutdown with it
		n.log.Warn("the cluster node did not stop within 10s: a change subscriber or a peer call is still running")
	}
	n.client.CloseIdleConnections()
	n.fwd.CloseIdleConnections()
}

// Handler is the peer listener's handler (an alias of Mux).
func (n *Node) Handler() http.Handler { return n.mux }

// Mux returns the peer listener's router, with its extension points.
func (n *Node) Mux() *Mux { return n.mux }

// run is the node's main goroutine.
func (n *Node) run(ctx context.Context) {
	if n.single {
		n.setReady()
		<-ctx.Done()
		return
	}
	for _, u := range n.urls {
		if strings.HasPrefix(u, "http://") {
			n.log.Warn("the cluster peer link is plain HTTP (BINVAULT_CLUSTER_INSECURE_HTTP): the cluster key, forwarded object data and newly issued token secrets travel readable; use it on a private network or VPN only", "url", u)
			break
		}
	}
	n.wg.Add(1)
	go func() { defer n.wg.Done(); n.discoveryLoop(ctx) }()
	n.fence(ctx)
	n.wg.Add(1)
	go func() { defer n.wg.Done(); n.compactLoop(ctx) }()
	<-ctx.Done()
}

// SetDraining reports (to this node's peers, at once) that the node is shutting
// down: they answer 503 for its buckets without waiting for a timeout (§9.4).
func (n *Node) SetDraining(v bool) {
	n.mu.Lock()
	changed := n.draining != v
	n.draining = v
	n.mu.Unlock()
	if changed {
		n.announce()
	}
}

// Draining reports whether SetDraining(true) was called.
func (n *Node) Draining() bool {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.draining
}

// SetCordoned persists and announces the cordon flag: `auto` placement skips a
// cordoned node (§8.6, §8.8).
func (n *Node) SetCordoned(ctx context.Context, v bool) error {
	val := "0"
	if v {
		val = "1"
	}
	if err := n.db.Update(ctx, func(tx *meta.Tx) error { return tx.KVSet(ctx, kvCordoned, val) }); err != nil {
		return err
	}
	n.mu.Lock()
	changed := n.cordoned != v
	n.cordoned = v
	n.mu.Unlock()
	if changed {
		n.announce()
	}
	return nil
}

// Cordoned reports the cordon flag.
func (n *Node) Cordoned() bool {
	n.mu.Lock()
	defer n.mu.Unlock()
	return n.cordoned
}

// newStreamID returns a fresh op stream id for this node.
func (n *Node) newStreamID() (string, error) {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "", err
	}
	return n.id + "." + hex.EncodeToString(b[:]), nil
}

// keyIDStrings renders the master key ids this node can open, current first.
func (n *Node) keyIDStrings() []string {
	var out []string
	for _, id := range n.ring.IDs() {
		out = append(out, id.String())
	}
	return out
}

func joinIDs(ids []string) string { return strings.Join(ids, ",") }
