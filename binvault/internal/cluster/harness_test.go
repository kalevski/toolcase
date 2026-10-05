package cluster

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"reflect"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/hlc"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/obs"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

const testKey = "0123456789abcdef0123456789abcdef-cluster-test-key"

// fakeClock is a settable wall clock shared by the nodes of a test.
type fakeClock struct {
	mu sync.Mutex
	t  time.Time
}

func newFakeClock() *fakeClock {
	return &fakeClock{t: time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)}
}

func (c *fakeClock) Now() time.Time {
	c.mu.Lock()
	defer c.mu.Unlock()
	return c.t
}

func (c *fakeClock) Advance(d time.Duration) {
	c.mu.Lock()
	c.t = c.t.Add(d)
	c.mu.Unlock()
}

// fastTuning shrinks the timers so that tests running the node's own goroutines
// finish in milliseconds.
func fastTuning() Tuning {
	return Tuning{
		HelloInterval: 150 * time.Millisecond, HelloTimeout: time.Second,
		BackoffMin: 20 * time.Millisecond, BackoffMax: 150 * time.Millisecond,
		FencePoll: 20 * time.Millisecond, RequestTimeout: 3 * time.Second,
		CompactEvery: time.Hour,
	}
}

// spec describes a test node.
type spec struct {
	name   string
	dir    string // an existing data dir (restart, restore, clone); default: a new one
	urls   []string
	l      net.Listener
	ring   *seal.Keyring
	clock  *fakeClock
	cfg    func(*config.Config)
	tune   *Tuning
	start  bool // run Start (fence, discovery, pull loops, compaction)
	tls    *tls.Certificate
	caFile string
	local  func(ctx context.Context) ([]LocalBucket, error)
	reg    *obs.Registry
	keys   []string // cluster keys (default: testKey)
	bare   bool     // no listener: the node is fed by hand (convergence tests)
	// noStart leaves the node neither started nor marked ready: the test calls
	// tn.start() itself (fence tests).
	noStart bool
}

// tnode is one in-process node: a database, a Node and a real HTTP listener
// that the test can cut off.
type tnode struct {
	t    *testing.T
	dir  string
	db   *meta.DB
	node *Node
	srv  *httptest.Server
	url  string
	down atomic.Bool
	// reject, when set, cuts off the requests that carry that node id (HeaderNode):
	// a one-way block, for example a node that cannot reach its own URL.
	reject atomic.Pointer[string]
	cancel context.CancelFunc
	pctx   context.Context
	closed bool
}

func listener(t *testing.T) (net.Listener, string) {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	return l, "http://" + l.Addr().String()
}

func randomRing(t *testing.T) *seal.Keyring {
	t.Helper()
	return ringOf(t, 1)
}

// ringOf builds a keyring from fixed pseudo keys: ringOf(t, 1) opens key 1,
// ringOf(t, 2, 1) seals under key 2 and still opens key 1.
func ringOf(t *testing.T, cur byte, old ...byte) *seal.Keyring {
	t.Helper()
	key := func(b byte) []byte {
		k := make([]byte, seal.KeySize)
		for i := range k {
			k[i] = b + byte(i)
		}
		return k
	}
	var olds [][]byte
	for _, o := range old {
		olds = append(olds, key(o))
	}
	r, err := seal.New(key(cur), olds...)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func ensureNodeID(t *testing.T, db *meta.DB) string {
	t.Helper()
	ctx := context.Background()
	var id string
	err := db.Update(ctx, func(tx *meta.Tx) error {
		v, err := tx.KVGet(ctx, "node_id")
		if err == nil {
			id = v
			return nil
		}
		if !errors.Is(err, meta.ErrNotFound) {
			return err
		}
		var raw [12]byte
		_, _ = rand.Read(raw[:])
		id = "n_" + hex.EncodeToString(raw[:])
		return tx.KVSet(ctx, "node_id", id)
	})
	if err != nil {
		t.Fatal(err)
	}
	return id
}

// newTestNode opens (or creates) the data dir and builds the node. A started
// node answers on its listener right away; one that is not started is driven by
// hand with settle and past the fence.
func newTestNode(t *testing.T, sp spec) *tnode {
	t.Helper()
	if sp.dir == "" {
		sp.dir = t.TempDir()
	}
	if sp.l == nil && !sp.bare {
		sp.l, _ = listener(t)
	}
	scheme := "http"
	if sp.tls != nil {
		scheme = "https"
	}
	selfURL := "http://127.0.0.1:1"
	if sp.l != nil {
		selfURL = scheme + "://" + sp.l.Addr().String()
	}
	if sp.urls == nil {
		sp.urls = []string{selfURL}
	}
	ctx := context.Background()
	db, err := meta.Open(ctx, filepath.Join(sp.dir, "meta.db"), meta.Options{Synchronous: "NORMAL"})
	if err != nil {
		t.Fatal(err)
	}
	if sp.name == "" {
		sp.name = "n" + selfURL[len(selfURL)-4:]
	}
	if sp.ring == nil {
		sp.ring = randomRing(t)
	}
	keys := sp.keys
	if keys == nil {
		keys = []string{testKey}
	}
	cfg := config.ForTest(func(c *config.Config) {
		c.NodeName = sp.name
		c.ClusterURLs = append([]string(nil), sp.urls...)
		for _, k := range keys {
			c.ClusterKey = append(c.ClusterKey, []byte(k))
		}
		c.ClusterInsecureHTTP = true
		c.ClusterPullInterval = 25 * time.Millisecond
		c.ClusterStartupFence = 2 * time.Second
		c.EndpointURL = "http://" + sp.name + ".example.test:9000"
		c.ClusterCAFile = sp.caFile
		if sp.cfg != nil {
			sp.cfg(c)
		}
	})
	opt := Options{
		Config: cfg, DB: db, NodeID: ensureNodeID(t, db), Ring: sp.ring, Log: testLogger(t),
		Version: "test", FreeDisk: func() int64 { return 1 << 30 }, LocalBuckets: sp.local, Registry: sp.reg, Tuning: fastTuning(),
	}
	if sp.tune != nil {
		opt.Tuning = *sp.tune
	}
	if sp.clock != nil {
		opt.Now = sp.clock.Now
	}
	node, err := New(opt)
	if err != nil {
		db.Close()
		t.Fatal(err)
	}
	tn := &tnode{t: t, dir: sp.dir, db: db, node: node, url: selfURL}
	h := node.Handler()
	if sp.bare {
		pctx, cancel := context.WithCancel(context.Background())
		tn.cancel, tn.pctx = cancel, pctx
		node.setReady()
		go node.disp.run(pctx)
		t.Cleanup(tn.close)
		return tn
	}
	tn.srv = &httptest.Server{Listener: sp.l, Config: &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if p := tn.reject.Load(); tn.down.Load() || (p != nil && r.Header.Get(HeaderNode) == *p) {
			if hj, ok := w.(http.Hijacker); ok {
				if c, _, err := hj.Hijack(); err == nil {
					c.Close()
					return
				}
			}
			http.Error(w, "partitioned", http.StatusServiceUnavailable)
			return
		}
		h.ServeHTTP(w, r)
	})}}
	if sp.tls != nil {
		tn.srv.TLS = &tls.Config{Certificates: []tls.Certificate{*sp.tls}}
		tn.srv.StartTLS()
	} else {
		tn.srv.Start()
	}
	pctx, cancel := context.WithCancel(context.Background())
	tn.cancel = cancel
	tn.pctx = pctx
	switch {
	case sp.noStart:
		node.ready.Store(false)
	case sp.start:
		if err := node.Start(pctx); err != nil {
			t.Fatal(err)
		}
	default:
		node.setReady()
		go node.disp.run(pctx) // hooks, without the rest of Start
	}
	t.Cleanup(tn.close)
	return tn
}

// start runs Start on a node built with noStart.
func (tn *tnode) start() {
	tn.t.Helper()
	if err := tn.node.Start(tn.pctx); err != nil {
		tn.t.Fatal(err)
	}
}

// serve starts an extra listener with a handler (an alias URL, a fake peer).
func serve(t *testing.T, l net.Listener, h http.Handler) {
	t.Helper()
	srv := &httptest.Server{Listener: l, Config: &http.Server{Handler: h}}
	srv.Start()
	t.Cleanup(func() { srv.CloseClientConnections(); srv.Close() })
}

func (tn *tnode) close() {
	if tn.closed {
		return
	}
	tn.closed = true
	tn.cancel()
	tn.node.Stop()
	if tn.srv != nil {
		tn.srv.CloseClientConnections()
		tn.srv.Close()
	}
	tn.db.Close()
}

// id is the node id.
func (tn *tnode) id() string { return tn.node.ID() }

func testLogger(t *testing.T) *slog.Logger {
	if testing.Verbose() {
		return slog.New(slog.NewTextHandler(testWriter{t}, &slog.HandlerOptions{Level: slog.LevelDebug}))
	}
	return slog.New(slog.NewTextHandler(io.Discard, nil))
}

type testWriter struct{ t *testing.T }

func (w testWriter) Write(p []byte) (int, error) {
	w.t.Log(string(p))
	return len(p), nil
}

// newManual builds n nodes that all know every URL, driven by hand (settle).
func newManual(t *testing.T, n int, mod func(i int, sp *spec)) []*tnode {
	t.Helper()
	ls := make([]net.Listener, n)
	urls := make([]string, n)
	for i := range ls {
		ls[i], urls[i] = listener(t)
	}
	nodes := make([]*tnode, n)
	for i := range nodes {
		sp := spec{name: fmt.Sprintf("node%d", i+1), l: ls[i], urls: urls}
		if mod != nil {
			mod(i, &sp)
		}
		nodes[i] = newTestNode(t, sp)
	}
	return nodes
}

// settle runs discovery and pull rounds on every node until nothing moves. A node
// that is cut off (down) takes no part: a partition holds in both directions.
func settle(nodes ...*tnode) {
	ctx := context.Background()
	for i := 0; i < 4; i++ {
		for _, n := range nodes {
			if n.down.Load() {
				continue
			}
			n.node.discover(ctx, true)
			n.node.pullAll(ctx)
		}
	}
}

// ---- catalog comparison ------------------------------------------------------

type regView struct {
	Key     string
	Deleted bool
	Payload string
	HLC     hlc.Timestamp
	Origin  string
	Seq     int64
	Aux     string
}

func catalogOf(t *testing.T, n *Node) []regView {
	t.Helper()
	regs, err := n.db.Read().CatalogAllRegs(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	out := make([]regView, len(regs))
	for i, r := range regs {
		out[i] = regView{Key: r.Key, Deleted: r.Deleted, Payload: string(r.Payload), HLC: hlc.Timestamp(r.HLC), Origin: r.Origin, Seq: r.Seq, Aux: r.Aux}
	}
	return out
}

func sameCatalog(t *testing.T, label string, a, b []regView) {
	t.Helper()
	if reflect.DeepEqual(a, b) {
		return
	}
	t.Fatalf("%s: catalogs differ\n a (%d): %s\n b (%d): %s", label, len(a), brief(a), len(b), brief(b))
}

func brief(v []regView) string {
	s := ""
	for _, r := range v {
		del := ""
		if r.Deleted {
			del = " DEL"
		}
		s += fmt.Sprintf("\n   %s%s @%d %s:%d", r.Key, del, r.HLC, r.Origin, r.Seq)
	}
	return s
}

func vvOf(t *testing.T, n *Node) map[string]int64 {
	t.Helper()
	vv, err := n.db.Read().CatalogVV(context.Background())
	if err != nil {
		t.Fatal(err)
	}
	return vv
}

// ---- building ops and entries ------------------------------------------------------

// ts builds an hlc timestamp from milliseconds since the Unix epoch and a counter.
func ts(ms int64, counter uint64) hlc.Timestamp { return hlc.Timestamp(uint64(ms)<<16 | counter) }

var testBase = time.Date(2026, 10, 2, 12, 0, 0, 0, time.UTC)

// at is an hlc timestamp d after testBase (the fake clock's start).
func at(d time.Duration) hlc.Timestamp { return hlc.FromTime(testBase.Add(d)) }

func canon(t testing.TB, kind string, v any) json.RawMessage {
	t.Helper()
	raw, err := json.Marshal(v)
	if err != nil {
		t.Fatal(err)
	}
	out, err := canonicalPayload(kind, raw)
	if err != nil {
		t.Fatalf("canonical %s: %v", kind, err)
	}
	return out
}

func bucketOp(t testing.TB, origin string, seq int64, h hlc.Timestamp, name, home, gen string, epoch int64, pipes ...string) Op {
	t.Helper()
	return Op{Origin: origin, Seq: seq, HLC: h, V: 1, Kind: KindBucket, Key: name,
		Payload: canon(t, KindBucket, BucketEntry{Home: home, Epoch: epoch, Generation: gen, CreatedAt: 1, Pipelines: pipes})}
}

func keyOp(t testing.TB, origin string, seq int64, h hlc.Timestamp, id, bucket string) Op {
	t.Helper()
	return Op{Origin: origin, Seq: seq, HLC: h, V: 1, Kind: KindKey, Key: id, Payload: canon(t, KindKey, KeyEntry{Bucket: bucket})}
}

func delOp(origin string, seq int64, h hlc.Timestamp, kind, key string) Op {
	return Op{Origin: origin, Seq: seq, HLC: h, V: 1, Kind: kind, Key: key, Payload: tombstonePayload}
}

func pipelineOp(t testing.TB, origin string, seq int64, h hlc.Timestamp, name, gen string, rev int64, sealed map[string]SealedValue) Op {
	t.Helper()
	return Op{Origin: origin, Seq: seq, HLC: h, V: 1, Kind: KindPipeline, Key: name,
		Payload: canon(t, KindPipeline, PipelineEntry{Definition: json.RawMessage(`{"name":"` + name + `","stage":"after"}`), Revision: rev, Generation: gen, Sealed: sealed})}
}

// apply feeds ops to a node as if a peer had sent them.
func apply(t *testing.T, n *Node, ops ...Op) applyResult {
	t.Helper()
	res, err := n.applyRemote(context.Background(), ops, "test")
	if err != nil {
		t.Fatal(err)
	}
	return res
}

// must returns v, or panics (which fails the test with the line that asked) when
// err is set: it lets a test write op := must(n.CreateBucket(...)).
func must[T any](v T, err error) T {
	if err != nil {
		panic(err)
	}
	return v
}

func ctxT() context.Context { return context.Background() }

// eventually polls cond until it holds or the time runs out.
func eventually(t *testing.T, d time.Duration, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(d)
	for !cond() {
		if time.Now().After(deadline) {
			t.Fatalf("timed out after %s waiting for %s", d, what)
		}
		time.Sleep(10 * time.Millisecond)
	}
}

// changeLog records what a node's subscribers receive.
type changeLog struct {
	mu  sync.Mutex
	all []Change
}

func (c *changeLog) add(ch []Change) {
	c.mu.Lock()
	c.all = append(c.all, ch...)
	c.mu.Unlock()
}

func (c *changeLog) snapshot() []Change {
	c.mu.Lock()
	defer c.mu.Unlock()
	return append([]Change(nil), c.all...)
}
