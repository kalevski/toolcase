package app_test

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/mover"
)

// This file is an in-process multi-node harness (spec §12, cluster tests): every
// node is a whole app.App with real listeners on 127.0.0.1:0, a shared admin
// token, master key and cluster key, and the peer link over plain HTTP.

// cnode is one node of a test cluster.
type cnode struct {
	*node
	name    string
	peerURL string
	peerLn  net.Listener
	cfg     *config.Config
	ctx     context.Context
	cancel  context.CancelFunc
	done    chan struct{}
	stopMu  sync.Mutex
	stopped bool
	logs    *syncBuf
}

// tcluster is a set of nodes that know each other.
type tcluster struct {
	t        *testing.T
	nodes    []*cnode
	urls     []string
	adminTok string
	master   []byte
	key      string
	// optMod, when set, adjusts the options node i is started with (peer wrapper,
	// mover timers, ...); it is applied on restarts too.
	optMod func(i int, o *app.Options)
}

func testTuning() cluster.Tuning {
	return cluster.Tuning{
		HelloInterval: 150 * time.Millisecond, HelloTimeout: 4 * time.Second,
		BackoffMin: 20 * time.Millisecond, BackoffMax: 150 * time.Millisecond,
		FencePoll: 20 * time.Millisecond, RequestTimeout: 5 * time.Second,
	}
}

// testMoverTuning shrinks the timers of bucket moves.
func testMoverTuning() mover.Tuning {
	return mover.Tuning{
		RequeueDelay: 100 * time.Millisecond, ActivateTimeout: 2 * time.Second, ActivateBackoff: 50 * time.Millisecond,
		ActivateBackoffMax: 200 * time.Millisecond, ControlTimeout: 5 * time.Second, DrainPoll: 100 * time.Millisecond,
	}
}

// startCluster starts n nodes named a, b, c, … that all list one another, and
// waits until every node has finished its start-up. mod adjusts each node's
// configuration.
func startCluster(t *testing.T, n int, mod func(i int, c *config.Config)) *tcluster {
	t.Helper()
	return startClusterWith(t, n, mod, nil)
}

// startClusterWith is startCluster with a hook on the options of every node.
func startClusterWith(t *testing.T, n int, mod func(i int, c *config.Config), optMod func(i int, o *app.Options)) *tcluster {
	t.Helper()
	tc := newCluster(t, n)
	tc.optMod = optMod
	for i := 0; i < n; i++ {
		tc.nodes[i] = tc.build(i, "", mod)
	}
	for _, cn := range tc.nodes {
		cn.run()
	}
	tc.waitReady(15 * time.Second)
	tc.settle()
	tc.logMoves()
	return tc
}

// settle waits until every running node sees every other node as reachable and ready (the
// hello of a node that has just started says it is not ready yet).
func (tc *tcluster) settle() {
	tc.t.Helper()
	for _, cn := range tc.nodes {
		cn := cn
		cn.stopMu.Lock()
		stopped := cn.stopped
		cn.stopMu.Unlock()
		if stopped {
			continue
		}
		eventually(tc.t, 15*time.Second, "node "+cn.name+" to see its peers ready", func() bool {
			for _, p := range cn.app.Cluster().Peers() {
				if p.Retired {
					continue
				}
				if !p.Reachable || !p.Ready {
					return false
				}
			}
			return true
		})
	}
}

// newCluster allocates the peer listeners, so that the URL list is known before
// any node starts.
func newCluster(t *testing.T, n int) *tcluster {
	t.Helper()
	tc := &tcluster{t: t, nodes: make([]*cnode, n), master: make([]byte, 32)}
	tok := make([]byte, 24)
	_, _ = rand.Read(tok)
	tc.adminTok = hex.EncodeToString(tok)
	_, _ = rand.Read(tc.master)
	k := make([]byte, 32)
	_, _ = rand.Read(k)
	tc.key = hex.EncodeToString(k)
	lns := make([]net.Listener, n)
	for i := range lns {
		ln, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			t.Fatal(err)
		}
		lns[i] = ln
		tc.urls = append(tc.urls, "http://"+ln.Addr().String())
	}
	for i, ln := range lns {
		tc.nodes[i] = &cnode{name: string(rune('a' + i)), peerURL: tc.urls[i], peerLn: ln}
	}
	return tc
}

// build creates node i's app (a new data dir unless dir is given) without
// running it.
func (tc *tcluster) build(i int, dir string, mod func(i int, c *config.Config)) *cnode {
	t := tc.t
	t.Helper()
	cn := tc.nodes[i]
	if dir == "" {
		dir = t.TempDir()
	}
	cfg := config.ForTest(func(c *config.Config) {
		c.AdminToken = []string{tc.adminTok}
		c.MasterKey = append([]byte(nil), tc.master...)
		c.DataDir = dir
		c.Listen, c.AdminListen = "127.0.0.1:0", "127.0.0.1:0"
		c.Fsync = false
		c.MinFreeMB = 1
		c.ShutdownTimeout = 3 * time.Second
		c.NodeName = cn.name
		c.EndpointURL = "http://" + cn.name + ".test:9000"
		c.ClusterURLs = append([]string(nil), tc.urls...)
		c.ClusterKey = [][]byte{[]byte(tc.key)}
		c.ClusterInsecureHTTP = true
		c.ClusterPullInterval = 25 * time.Millisecond
		c.ClusterStartupFence = 3 * time.Second
		if mod != nil {
			mod(i, c)
		}
	})
	cn.cfg = cfg
	cn.logs = &syncBuf{}
	cn.done = make(chan struct{})
	cn.stopped = false
	cn.node = &node{t: t, adminTok: tc.adminTok, dir: dir}
	ctx, cancel := context.WithCancel(context.Background())
	cn.ctx, cn.cancel = ctx, cancel
	log := slog.New(slog.NewTextHandler(io.MultiWriter(cn.logs), &slog.HandlerOptions{Level: slog.LevelDebug}))
	opts := app.Options{PeerListener: cn.peerLn, ClusterTuning: testTuning(), MoverTuning: testMoverTuning()}
	if tc.optMod != nil {
		tc.optMod(i, &opts)
	}
	a, err := app.NewWithOptions(ctx, cfg, log, app.Build{Version: "test"}, opts)
	if err != nil {
		cancel()
		t.Fatalf("node %s: %v", cn.name, err)
	}
	cn.app = a
	cn.s3URL, cn.adminURL = "http://"+a.PublicAddr(), "http://"+a.AdminAddr()
	t.Cleanup(func() { cn.stop() })
	return cn
}

// run starts the built app.
func (cn *cnode) run() {
	a, done, ctx := cn.app, cn.done, cn.ctx
	go func() { _ = a.Run(ctx); close(done) }()
}

// stop shuts the node down gracefully: it tells its peers it is draining, lets
// requests finish and closes everything.
func (cn *cnode) stop() {
	cn.stopMu.Lock()
	defer cn.stopMu.Unlock()
	if cn.stopped {
		return
	}
	cn.stopped = true
	cn.cancel()
	select {
	case <-cn.done:
	case <-time.After(15 * time.Second):
		cn.t.Errorf("node %s did not stop", cn.name)
	}
}

// crash takes the node down without telling anybody: listeners and database are
// closed at once, as when a process is killed.
func (cn *cnode) crash() {
	cn.stopMu.Lock()
	defer cn.stopMu.Unlock()
	if cn.stopped {
		return
	}
	cn.stopped = true
	cn.app.Close()
	cn.cancel()
	select {
	case <-cn.done:
	case <-time.After(15 * time.Second):
		cn.t.Errorf("node %s did not stop", cn.name)
	}
}

// restart builds and runs a new app on the data dir of a stopped node.
func (tc *tcluster) restart(i int, mod func(i int, c *config.Config)) *cnode {
	t := tc.t
	t.Helper()
	old := tc.nodes[i]
	old.stop()
	// the old peer listener is closed with the app: bind the same address again
	var ln net.Listener
	var err error
	for try := 0; try < 50; try++ {
		if ln, err = net.Listen("tcp", old.peerURL[len("http://"):]); err == nil {
			break
		}
		time.Sleep(20 * time.Millisecond)
	}
	if err != nil {
		t.Fatal(err)
	}
	tc.nodes[i] = &cnode{name: old.name, peerURL: old.peerURL, peerLn: ln}
	cn := tc.build(i, old.dir, mod)
	cn.run()
	return cn
}

// waitReady waits until every running node has finished its cluster start-up.
func (tc *tcluster) waitReady(d time.Duration) {
	tc.t.Helper()
	for _, cn := range tc.nodes {
		cn := cn
		eventually(tc.t, d, "node "+cn.name+" to finish its start-up", func() bool { return cn.app.ClusterReady() })
	}
}

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

// byName returns the node with that name.
func (tc *tcluster) byName(name string) *cnode {
	for _, cn := range tc.nodes {
		if cn.name == name {
			return cn
		}
	}
	tc.t.Fatalf("no node %q", name)
	return nil
}

// nodeID is the node's id.
func (cn *cnode) nodeID() string { return cn.app.NodeID }

// getJSON reads a JSON admin answer into a generic map.
func (cn *cnode) get(path string) (int, map[string]any) { return cn.admin("GET", path, nil) }

// converged reports whether every running node lists the same buckets.
func (tc *tcluster) bucketNames(cn *cnode) []string {
	_, out := cn.admin("GET", "/buckets?limit=500", nil)
	var names []string
	for _, it := range out["items"].([]any) {
		names = append(names, it.(map[string]any)["name"].(string))
	}
	return names
}

func b64(b []byte) string { return base64.StdEncoding.EncodeToString(b) }

func httpOK(url string) bool {
	res, err := http.Get(url)
	if err != nil {
		return false
	}
	res.Body.Close()
	return res.StatusCode == 200
}

var _ = fmt.Sprintf
