package cluster

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"log/slog"
	"net"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"reflect"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/bindctl"
	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/hlc"
	"github.com/kalevski/toolcase/zonewright/internal/manager"
	"github.com/kalevski/toolcase/zonewright/internal/state"
	"github.com/kalevski/toolcase/zonewright/internal/store"
)

const testKey = "0123456789abcdef0123456789abcdef-test-key"

// tnode is one in-process zonewright server: store + manager + cluster node
// behind a real HTTP listener that the test can cut off (partition).
type tnode struct {
	t    *testing.T
	dir  string
	st   *store.Store
	mgr  *manager.Manager
	node *Node
	down atomic.Bool
	srv  *httptest.Server
	url  string
}

func listener(t *testing.T) (net.Listener, string) {
	t.Helper()
	l, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	return l, "http://" + l.Addr().String()
}

// newCluster starts n nodes that all know every URL (themselves included).
// Nodes start past the startup fence (tests drive rounds by hand); tests of
// the fence itself use newFencedCluster / startFencedNode and node.Run.
func newCluster(t *testing.T, n int) []*tnode {
	nodes := newFencedCluster(t, n)
	for _, tn := range nodes {
		tn.node.ready.Store(true)
	}
	return nodes
}

func newFencedCluster(t *testing.T, n int) []*tnode {
	t.Helper()
	ls := make([]net.Listener, n)
	urls := make([]string, n)
	for i := range ls {
		ls[i], urls[i] = listener(t)
	}
	nodes := make([]*tnode, n)
	for i := range nodes {
		nodes[i] = startFencedNode(t, t.TempDir(), ls[i], urls)
	}
	return nodes
}

func startNode(t *testing.T, dir string, l net.Listener, urls []string) *tnode {
	t.Helper()
	tn := startFencedNode(t, dir, l, urls)
	tn.node.ready.Store(true)
	return tn
}

func startFencedNode(t *testing.T, dir string, l net.Listener, urls []string) *tnode {
	t.Helper()
	keyFile := filepath.Join(dir, "cluster.key")
	if err := os.WriteFile(keyFile, []byte(testKey), 0o600); err != nil {
		t.Fatal(err)
	}
	cc := &config.Cluster{KeyFile: keyFile, URLs: append([]string(nil), urls...), Listen: l.Addr().String(), AllowInsecureHTTP: true}
	cfg := &config.Config{DataDir: dir, Cluster: cc}
	cfg.Defaults.Nameservers = []string{"ns1.example.net"}
	cfg.Bind.CheckZoneCmd, cfg.Bind.CheckConfCmd, cfg.Bind.ReloadCmd = []string{}, []string{}, []string{}
	config.ApplyDefaults(cfg)
	if err := config.Validate(cfg); err != nil {
		t.Fatal(err)
	}
	st, err := store.Open(filepath.Join(dir, "zonewright.db"), nil)
	if err != nil {
		t.Fatal(err)
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	mgr := manager.New(cfg, state.NewMemoryStore(), st, bindctl.NewWithRunner(log, nil, time.Now), log)
	node, err := New(cc, mgr, log)
	if err != nil {
		t.Fatal(err)
	}
	tn := &tnode{t: t, dir: dir, st: st, mgr: mgr, node: node}
	h := node.Handler()
	tn.srv = &httptest.Server{Listener: l, Config: &http.Server{Handler: http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if tn.down.Load() {
			http.Error(w, "partitioned", http.StatusServiceUnavailable)
			return
		}
		h.ServeHTTP(w, r)
	})}}
	tn.srv.Start()
	tn.url = tn.srv.URL
	t.Cleanup(func() { tn.srv.Close(); st.Close() })
	return tn
}

func (tn *tnode) put(zone string, recs ...config.Record) {
	tn.t.Helper()
	_, err := tn.mgr.Mutate(context.Background(), zone, func(cur manager.Current) (*config.Zone, error) {
		z := cur.Zone
		z.Records = append(z.Records, recs...)
		return &z, nil
	})
	if err != nil {
		tn.t.Fatal(err)
	}
}

func (tn *tnode) zones() []store.Zone {
	z, err := tn.st.Zones()
	if err != nil {
		tn.t.Fatal(err)
	}
	return z
}

// settle runs replication rounds on every node until nothing moves.
func settle(nodes ...*tnode) {
	for i := 0; i < 4; i++ {
		for _, n := range nodes {
			n.node.round(context.Background())
		}
	}
}

func a(name, ip string) config.Record { return config.Record{Name: name, Type: "A", Value: ip} }

func TestReplicatesBothWays(t *testing.T) {
	c := newCluster(t, 2)
	c[0].put("example.com", a("www", "192.0.2.1"))
	settle(c...)
	c[1].put("example.com", a("api", "192.0.2.2"))
	settle(c...)
	za, zb := c[0].zones(), c[1].zones()
	if len(za) != 1 || len(za[0].Records) != 2 || !reflect.DeepEqual(za, zb) {
		t.Fatalf("not converged:\n a=%+v\n b=%+v", za, zb)
	}
	// Both servers publish the same serial.
	if c[0].mgr.Serial("example.com") != c[1].mgr.Serial("example.com") {
		t.Fatal("serials differ")
	}
}

func TestSelfDiscoveryAndAliases(t *testing.T) {
	c := newCluster(t, 2)
	// A second URL that reaches node B (an alias / other DNS name).
	l, alias := listener(t)
	aliasSrv := &httptest.Server{Listener: l, Config: &http.Server{Handler: c[1].node.Handler()}}
	aliasSrv.Start()
	defer aliasSrv.Close()
	c[0].node.SetURLs([]string{c[0].url, c[1].url, alias})

	c[0].node.discover(context.Background())
	st := c[0].node.Status()
	var self int
	for _, u := range st.URLs {
		if u.Self {
			self++
			if u.URL != c[0].url {
				t.Errorf("wrong URL flagged as self: %s", u.URL)
			}
		}
	}
	if self != 1 {
		t.Fatalf("self flagged %d times", self)
	}
	if peers := c[0].node.peers(); len(peers) != 1 {
		t.Fatalf("alias URLs for one server must de-duplicate, got %v", peers)
	}
}

// Both sides keep accepting writes while cut off from each other, and merge
// to identical zones and serials when the link returns.
func TestPartitionAndHeal(t *testing.T) {
	c := newCluster(t, 2)
	c[0].put("example.com", a("www", "192.0.2.1"))
	settle(c...)

	c[0].down.Store(true)
	c[1].down.Store(true)
	c[0].put("example.com", a("left", "192.0.2.10"))
	c[1].put("example.com", a("right", "192.0.2.20"))
	c[1].put("other.com", a("x", "192.0.2.30"))
	// Same RRset edited on both sides: later write wins everywhere.
	_, _ = c[0].mgr.Mutate(context.Background(), "example.com", setA("www", "192.0.2.100"))
	_, _ = c[1].mgr.Mutate(context.Background(), "example.com", setA("www", "192.0.2.200"))
	settle(c...)
	if reflect.DeepEqual(c[0].zones(), c[1].zones()) {
		t.Fatal("partition did not isolate the nodes")
	}

	c[0].down.Store(false)
	c[1].down.Store(false)
	settle(c...)
	za, zb := c[0].zones(), c[1].zones()
	if !reflect.DeepEqual(za, zb) {
		t.Fatalf("not converged after heal:\n a=%+v\n b=%+v", za, zb)
	}
	if len(za) != 2 {
		t.Fatalf("zones lost: %+v", za)
	}
	names := map[string]string{}
	for _, r := range za[0].Records {
		names[r.Name] = r.Value
	}
	if names["left"] == "" || names["right"] == "" || names["www"] != "192.0.2.200" {
		t.Fatalf("merge result: %+v (www must be the later write)", names)
	}
}

func setA(name, ip string) func(manager.Current) (*config.Zone, error) {
	return func(cur manager.Current) (*config.Zone, error) {
		z := cur.Zone
		out := z.Records[:0:0]
		for _, r := range z.Records {
			if r.Name != name {
				out = append(out, r)
			}
		}
		z.Records = append(out, a(name, ip))
		return &z, nil
	}
}

// A copied data dir answers with our id: detected, alarmed, never synced.
func TestCloneDetected(t *testing.T) {
	c := newCluster(t, 1)
	c[0].put("example.com", a("www", "192.0.2.1"))
	cloneDir := t.TempDir()
	if err := c[0].st.Backup(filepath.Join(cloneDir, "zonewright.db")); err != nil {
		t.Fatal(err)
	}
	l, cloneURL := listener(t)
	clone := startNode(t, cloneDir, l, []string{c[0].url, cloneURL})
	if clone.st.NodeID() != c[0].st.NodeID() {
		t.Fatal("test setup: clone should share the id")
	}
	c[0].node.SetURLs([]string{c[0].url, cloneURL})
	c[0].node.discover(context.Background())
	var alarm string
	for _, u := range c[0].node.Status().URLs {
		if u.URL == cloneURL {
			alarm = u.Alarm
		}
	}
	if !strings.Contains(alarm, "clone detected") {
		t.Fatalf("clone not detected: %+v", c[0].node.Status().URLs)
	}
	if len(c[0].node.peers()) != 0 {
		t.Fatal("must not sync with a clone")
	}
}

// A URL that starts answering with a new id means that server was
// redeployed: the old id is retired automatically.
func TestRedeployRetiresOldID(t *testing.T) {
	c := newCluster(t, 2)
	settle(c...)
	oldID := c[1].st.NodeID()
	addr := c[1].srv.Listener.Addr().String()
	c[1].srv.Close()

	l, err := net.Listen("tcp", addr)
	if err != nil {
		t.Skip("could not rebind the port:", err)
	}
	fresh := startNode(t, t.TempDir(), l, []string{c[0].url, c[1].url})
	if fresh.st.NodeID() == oldID {
		t.Fatal("a fresh deployment must get a new id")
	}
	c[0].node.discover(context.Background())
	st := c[0].node.Status()
	if len(st.Retired) != 1 || st.Retired[0] != oldID {
		t.Fatalf("old id not retired: %+v", st.Retired)
	}
}

func TestWaitReplicated(t *testing.T) {
	c := newFencedCluster(t, 2)
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	for _, n := range c {
		go n.node.Run(ctx)
	}
	waitReady(t, c...)

	out, err := c[0].mgr.Mutate(ctx, "example.com", setA("www", "192.0.2.1"))
	if err != nil {
		t.Fatal(err)
	}
	if pending := c[0].node.WaitReplicated(ctx, out.Ops, 5*time.Second); len(pending) != 0 {
		t.Fatalf("not replicated in time: %v", pending)
	}
	if _, ok, _ := c[1].st.Zone("example.com"); !ok {
		t.Fatal("acknowledged but not present on the peer")
	}

	// With the peer cut off, the wait times out and names it.
	c[1].down.Store(true)
	out, _ = c[0].mgr.Mutate(ctx, "example.com", setA("api", "192.0.2.2"))
	pending := c[0].node.WaitReplicated(ctx, out.Ops, 1500*time.Millisecond)
	if len(pending) != 1 || pending[0] != c[1].url {
		t.Fatalf("pending: %v", pending)
	}
}

func waitReady(t *testing.T, nodes ...*tnode) {
	t.Helper()
	deadline := time.Now().Add(10 * time.Second)
	for _, n := range nodes {
		for !n.node.Ready() {
			if time.Now().After(deadline) {
				t.Fatal("startup fence never passed")
			}
			time.Sleep(20 * time.Millisecond)
		}
	}
}

// A node restored from an old backup must pull its own lost ops back before
// writing, so it never reuses a sequence number.
func TestRestoreFromBackupFence(t *testing.T) {
	c := newCluster(t, 2)
	c[0].put("example.com", a("a", "192.0.2.1"))
	backup := filepath.Join(t.TempDir(), "old.db")
	if err := c[0].st.Backup(backup); err != nil {
		t.Fatal(err)
	}
	c[0].put("example.com", a("b", "192.0.2.2"))
	c[0].put("example.com", a("c", "192.0.2.3"))
	settle(c...) // b holds everything
	id := c[0].st.NodeID()
	lost, _ := c[0].st.VV()

	// Restore: same id, older data, new process.
	addr := c[0].srv.Listener.Addr().String()
	c[0].srv.Close()
	dir := t.TempDir()
	raw, _ := os.ReadFile(backup)
	_ = os.WriteFile(filepath.Join(dir, "zonewright.db"), raw, 0o600)
	l, err := net.Listen("tcp", addr)
	if err != nil {
		t.Skip("could not rebind the port:", err)
	}
	restored := startFencedNode(t, dir, l, []string{c[0].url, c[1].url})
	if restored.st.NodeID() != id {
		t.Fatal("restore should keep the id")
	}
	ctx, cancel := context.WithCancel(context.Background())
	defer cancel()
	go restored.node.Run(ctx)
	waitReady(t, restored)

	vv, _ := restored.st.VV()
	if vv[id] != lost[id] {
		t.Fatalf("fence did not recover own ops: have seq %d, lost up to %d", vv[id], lost[id])
	}
	out, err := restored.mgr.Mutate(ctx, "example.com", setA("d", "192.0.2.4"))
	if err != nil {
		t.Fatal(err)
	}
	if out.Ops[0].Seq != lost[id]+1 {
		t.Fatalf("reused a sequence number: %d", out.Ops[0].Seq)
	}
}

// A node joining after the log was compacted bootstraps from a snapshot.
func TestSnapshotBootstrap(t *testing.T) {
	c := newCluster(t, 2)
	c[0].put("example.com", a("www", "192.0.2.1"))
	settle(c...)
	vv, _ := c[0].st.VV()
	if n, err := c[0].st.Compact(hlc.FromTime(time.Now().Add(time.Hour)), vv); err != nil || n == 0 {
		t.Fatalf("compact: %d %v", n, err)
	}
	l, url := listener(t)
	joiner := startNode(t, t.TempDir(), l, []string{c[0].url, url})
	joiner.node.round(context.Background())
	if !reflect.DeepEqual(joiner.zones(), c[0].zones()) {
		t.Fatalf("snapshot bootstrap failed:\n j=%+v\n a=%+v", joiner.zones(), c[0].zones())
	}
}

func TestPeerAPIRequiresKey(t *testing.T) {
	c := newCluster(t, 1)
	for _, auth := range []string{"", "Bearer wrong", "Bearer " + testKey[:10], testKey} {
		req, _ := http.NewRequest("GET", c[0].url+"/peer/hello", nil)
		if auth != "" {
			req.Header.Set("Authorization", auth)
		}
		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			t.Fatal(err)
		}
		resp.Body.Close()
		if resp.StatusCode != http.StatusUnauthorized {
			t.Errorf("auth %q: want 401, got %d", auth, resp.StatusCode)
		}
	}
}

func TestShortKeyRefused(t *testing.T) {
	dir := t.TempDir()
	kf := filepath.Join(dir, "k")
	_ = os.WriteFile(kf, []byte("short"), 0o600)
	st, _ := store.Open(filepath.Join(dir, "z.db"), nil)
	defer st.Close()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	mgr := manager.New(&config.Config{}, state.NewMemoryStore(), st, bindctl.NewWithRunner(log, nil, time.Now), log)
	if _, err := New(&config.Cluster{KeyFile: kf, URLs: []string{"https://x"}}, mgr, log); err == nil {
		t.Fatal("a short cluster key must be refused")
	}
}

// Fingerprint pinning: the right pin connects, a wrong one is refused.
func TestTLSFingerprintPinning(t *testing.T) {
	srv := httptest.NewTLSServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) { _, _ = w.Write([]byte("{}")) }))
	defer srv.Close()
	sum := sha256.Sum256(srv.Certificate().Raw)
	for pin, wantOK := range map[string]bool{hex.EncodeToString(sum[:]): true, strings.Repeat("0", 64): false} {
		tlsCfg, err := clientTLS(&config.Cluster{Fingerprint: pin})
		if err != nil {
			t.Fatal(err)
		}
		cl := &http.Client{Transport: &http.Transport{TLSClientConfig: tlsCfg}}
		resp, err := cl.Get(srv.URL)
		if err == nil {
			resp.Body.Close()
		}
		if (err == nil) != wantOK {
			t.Errorf("pin %s…: err=%v, wantOK=%v", pin[:8], err, wantOK)
		}
	}
	// Default (system roots) must refuse the self-signed test cert.
	tlsCfg, _ := clientTLS(&config.Cluster{})
	if _, err := (&http.Client{Transport: &http.Transport{TLSClientConfig: tlsCfg}}).Get(srv.URL); err == nil {
		t.Error("an unverified self-signed peer must be refused by default")
	}
}

// Three nodes: a change on one reaches the third through the second even
// when the first cannot reach the third directly (transitive relay).
func TestTransitiveRelay(t *testing.T) {
	c := newCluster(t, 3)
	settle(c...)
	c[0].node.SetURLs([]string{c[0].url, c[1].url}) // A only talks to B
	c[2].node.SetURLs([]string{c[1].url, c[2].url}) // C only talks to B
	c[0].put("example.com", a("www", "192.0.2.1"))
	settle(c...)
	if !reflect.DeepEqual(c[2].zones(), c[0].zones()) || len(c[2].zones()) != 1 {
		t.Fatalf("C did not get A's change via B: %+v", c[2].zones())
	}
}
