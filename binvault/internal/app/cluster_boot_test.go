package app_test

import (
	"bytes"
	"context"
	"fmt"
	"io"
	"log/slog"
	"net"
	"net/http"
	"path/filepath"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

// startSingle runs a node without cluster settings on a data dir, with the secrets of
// the test cluster, so that the dir can later join it.
func startSingle(t *testing.T, tc *tcluster, dir string) (*node, func()) {
	t.Helper()
	cfg := config.ForTest(func(c *config.Config) {
		c.AdminToken = []string{tc.adminTok}
		c.MasterKey = append([]byte(nil), tc.master...)
		c.DataDir = dir
		c.Listen, c.AdminListen = "127.0.0.1:0", "127.0.0.1:0"
		c.Fsync, c.MinFreeMB = false, 1
		c.ShutdownTimeout = 3 * time.Second
		c.EndpointURL = "http://127.0.0.1:9000"
	})
	ctx, cancel := context.WithCancel(context.Background())
	a, err := app.New(ctx, cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), app.Build{Version: "test"})
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() { _ = a.Run(ctx); close(done) }()
	var once sync.Once
	stop := func() { once.Do(func() { cancel(); <-done }) }
	t.Cleanup(stop)
	return &node{t: t, app: a, s3URL: "http://" + a.PublicAddr(), adminURL: "http://" + a.AdminAddr(), adminTok: tc.adminTok, dir: dir}, stop
}

// Until the start-up fence has ended a node serves no bucket and accepts no catalog
// write, and /_healthz says 503 starting (spec §8.5, §9.3); after it, with a peer that
// never answered, the node goes ahead with a new op stream.
func TestClusterStartupFence(t *testing.T) {
	tc := newCluster(t, 3)
	mod := func(i int, c *config.Config) { c.ClusterStartupFence = 1200 * time.Millisecond }
	tc.nodes[2].peerLn.Close() // c never starts: connections to it are refused at once
	a, b := tc.build(0, "", mod), tc.build(1, "", mod)
	a.run()
	b.run()

	healthz := func() (int, string) {
		res, err := http.Get(a.s3URL + "/_healthz")
		if err != nil {
			t.Fatal(err)
		}
		defer res.Body.Close()
		raw, _ := io.ReadAll(res.Body)
		return res.StatusCode, strings.TrimSpace(string(raw))
	}
	if code, body := healthz(); code != 503 || body != "starting" {
		t.Fatalf("healthz during the fence: %d %q", code, body)
	}
	// a data-plane request and a catalog write are refused too, the node-local calls answer
	req, _ := http.NewRequest("GET", a.s3URL+"/anybucket/k", nil)
	if r := httpDo(t, req); r.status != 503 || r.code() != "ServiceUnavailable" || r.header.Get("Retry-After") == "" {
		t.Fatalf("an S3 request during the fence: %d %s", r.status, r.code())
	}
	if code, out := a.admin("POST", "/buckets", map[string]any{"name": "toosoon"}); code != 503 || out["error"] != "unavailable" {
		t.Fatalf("a catalog write during the fence: %d %v", code, out)
	}
	if code, _ := a.admin("GET", "/status", nil); code != 200 {
		t.Fatalf("/status during the fence: %d", code)
	}
	if code, out := a.admin("GET", "/cluster", nil); code != 200 || out["ready"] != false {
		t.Fatalf("/cluster during the fence: %d %v", code, out)
	}

	// the fence ends without c: the node serves, and says so
	eventually(t, 10*time.Second, "the fence to end", func() bool { return a.app.ClusterReady() && b.app.ClusterReady() })
	if code, body := healthz(); code != 200 || body != "ok" {
		t.Fatalf("healthz after the fence: %d %q", code, body)
	}
	code, out := a.admin("GET", "/cluster", nil)
	fence, _ := out["fence"].(map[string]any)
	if code != 200 || out["ready"] != true || fence["done"] != true || len(fence["silent"].([]any)) != 1 || fence["new_stream"] == "" {
		t.Fatalf("/cluster after the fence: %d %v", code, out)
	}
	a.mustAdmin(201, "POST", "/buckets", map[string]any{"name": "afterfence", "home": "b"})
	if !strings.Contains(a.logs.String(), "start-up fence ended without hearing from every server") {
		t.Fatal("the node did not warn that it went ahead without a silent peer")
	}
}

// A data dir that ran as a single node and now joins a cluster keeps everything it has:
// its buckets, tokens, pipelines and attachments are published to the catalog with their
// local generations. A bucket whose name the cluster has taken meanwhile is an orphan
// there (spec §8.5, Phase 7).
func TestClusterJoinPublishesExistingSingleNodeState(t *testing.T) {
	tc := newCluster(t, 3)
	svc := newFsvc(t)

	// 1. a single node with data
	dir := t.TempDir()
	single, stop := startSingle(t, tc, dir)
	single.bucket("solo", nil)
	single.bucket("dup", nil)
	soloTok, dupTok := single.token("solo", all, nil), single.token("dup", all, nil)
	single.must(soloTok, 200, "PUT", "/solo/k", []byte("solo data"))
	single.mustAdmin(201, "POST", "/pipelines", pipeDef("upg", "after", svc.url("upg"), single.s3URL, nil))
	single.mustAdmin(200, "PATCH", "/pipelines/upg", map[string]any{"description": "from the single node"})
	single.mustAdmin(200, "PUT", "/buckets/solo/pipelines", map[string]any{"items": []map[string]any{{"pipeline": "upg", "enabled": true}}})
	row, err := single.app.DB.Read().GetBucket(context.Background(), "solo")
	if err != nil {
		t.Fatal(err)
	}
	pipeRow, err := single.app.DB.Read().GetPipeline(context.Background(), "upg")
	if err != nil {
		t.Fatal(err)
	}
	dupRow, _ := single.app.DB.Read().GetBucket(context.Background(), "dup")
	stop()

	// 2. a and c form the cluster while b is away, and a creates `dup`
	mod := func(i int, c *config.Config) { c.ClusterStartupFence = time.Second }
	tc.nodes[1].peerLn.Close() // b is not there yet
	a, c := tc.build(0, "", mod), tc.build(2, "", mod)
	a.run()
	c.run()
	eventually(t, 15*time.Second, "a and c to start without b", func() bool { return a.app.ClusterReady() && c.app.ClusterReady() })
	a.mustAdmin(201, "POST", "/buckets", map[string]any{"name": "dup", "home": "a"})

	// 3. b joins with the old data dir
	ln, err := listenAgain(tc.nodes[1].peerURL)
	if err != nil {
		t.Fatal(err)
	}
	tc.nodes[1].peerLn = ln
	b := tc.build(1, dir, mod)
	b.run()
	eventually(t, 15*time.Second, "b to finish its start-up", func() bool { return b.app.ClusterReady() })

	if b.nodeID() != single.app.NodeID {
		t.Fatalf("the node id must survive joining a cluster: %s != %s", b.nodeID(), single.app.NodeID)
	}
	for _, n := range []*cnode{a, b, c} {
		n := n
		eventually(t, 10*time.Second, n.name+" to know the published state", func() bool {
			rec, ok := n.app.Cluster().Bucket("solo")
			_, keyOK := n.app.Cluster().LookupKey(soloTok.ak)
			p, pok := n.app.Cluster().Pipeline("upg")
			return ok && keyOK && pok && rec.Home == b.nodeID() && rec.Generation == row.Generation && rec.Epoch == 0 &&
				fmt.Sprint(rec.Pipelines) == "[upg]" && p.Generation == pipeRow.Generation && p.Revision == pipeRow.Revision
		})
		if _, ok := n.app.Cluster().LookupKey(dupTok.ak); ok {
			t.Fatalf("%s indexed the key of an orphaned bucket", n.name)
		}
	}
	// what b had works through the others, with the old token, and the pipeline fired for new work
	for _, n := range []*cnode{a, c} {
		if r := n.must(soloTok, 200, "GET", "/solo/k", nil); string(r.body) != "solo data" || r.header.Get("x-binvault-node") != "b" {
			t.Fatalf("the old object through %s: %q", n.name, r.body)
		}
	}
	for _, n := range []*cnode{a, c} {
		if got := n.mustAdmin(200, "GET", "/pipelines/upg", nil); got["description"] != "from the single node" || got["revision"].(float64) != 2 || fmt.Sprint(got["attached_to"]) != "[solo]" {
			t.Fatalf("the published pipeline at %s: %v", n.name, got)
		}
	}
	c.must(soloTok, 200, "PUT", "/solo/new", []byte("fresh"))
	eventually(t, 10*time.Second, "the after pipeline to run for the new object", func() bool { return len(svc.callsOf("upg")) > 0 })
	if l := items(t, a.mustAdmin(200, "GET", "/runs?bucket=solo", nil)); len(l) == 0 || l[0]["node"] != "b" {
		t.Fatalf("runs: %v", l)
	}

	// `dup` belongs to a now; b's copy is an orphan, kept, not served, listed
	rec, _ := b.app.Cluster().Bucket("dup")
	if rec.Home != a.nodeID() || rec.Generation == dupRow.Generation {
		t.Fatalf("the catalog's dup: %+v (b's local generation %s)", rec, dupRow.Generation)
	}
	_, out := b.admin("GET", "/cluster", nil)
	orphans, _ := out["alarms"].(map[string]any)["orphans"].([]any)
	if len(orphans) != 1 || orphans[0].(map[string]any)["name"] != "dup" || orphans[0].(map[string]any)["generation"] != dupRow.Generation {
		t.Fatalf("b's orphans: %v", orphans)
	}
	if r := b.s3(dupTok, "GET", "/dup/anything", nil); r.status != 403 {
		t.Fatalf("an orphan's old token must not work (it is a's bucket now): %d %s", r.status, r.code())
	}
	if _, err := b.app.DB.Read().GetBucket(context.Background(), "dup"); err != nil {
		t.Fatal("the orphan's data was dropped")
	}
	// its lifecycle does not run, its data is not served by anyone
	a.mustAdmin(200, "GET", "/buckets/dup", nil)
}

// listenAgain binds the address of a peer URL again (its first listener was closed).
func listenAgain(url string) (net.Listener, error) {
	var err error
	for try := 0; try < 50; try++ {
		var ln net.Listener
		if ln, err = net.Listen("tcp", strings.TrimPrefix(url, "http://")); err == nil {
			return ln, nil
		}
		time.Sleep(20 * time.Millisecond)
	}
	return nil, err
}

// Two nodes that create the same name at the same moment: the catalog's last writer
// wins everywhere, the loser's local bucket is an orphan (not served, kept) and no node
// ever serves two homes for one name (spec §8.5).
func TestClusterSimultaneousCreationOfOneName(t *testing.T) {
	for round := 0; round < 6; round++ {
		tc := startCluster(t, 3, nil)
		a, b := tc.nodes[0], tc.nodes[1]
		name := fmt.Sprintf("race%d", round)
		var wg sync.WaitGroup
		var okA, okB atomic.Bool
		for _, x := range []struct {
			n    *cnode
			home string
			ok   *atomic.Bool
		}{{a, "a", &okA}, {b, "b", &okB}} {
			wg.Add(1)
			go func() {
				defer wg.Done()
				code, _ := x.n.admin("POST", "/buckets", map[string]any{"name": name, "home": x.home})
				x.ok.Store(code == 201)
			}()
		}
		wg.Wait()
		if !okA.Load() && !okB.Load() {
			t.Fatalf("round %d: neither creation succeeded", round)
		}
		t.Logf("round %d: a created %v, b created %v", round, okA.Load(), okB.Load())
		// let the catalogs settle, then every node must agree on one home
		var home string
		eventually(t, 10*time.Second, "the catalogs to agree", func() bool {
			homes := map[string]bool{}
			for _, n := range tc.nodes {
				rec, ok := n.app.Cluster().Bucket(name)
				if !ok {
					return false
				}
				homes[rec.Home] = true
				home = rec.Home
			}
			return len(homes) == 1
		})
		winner := a
		if home == b.nodeID() {
			winner = b
		}
		loser := a
		if winner == a {
			loser = b
		}
		// if both creations were accepted, the loser's data is an orphan and says so
		if okA.Load() && okB.Load() {
			eventually(t, 10*time.Second, "the loser to report its orphan", func() bool {
				_, out := loser.admin("GET", "/cluster", nil)
				orphans, _ := out["alarms"].(map[string]any)["orphans"].([]any)
				return len(orphans) == 1 && orphans[0].(map[string]any)["name"] == name
			})
		}
		tok := winner.token(name, all, nil)
		for _, n := range tc.nodes {
			if r := n.s3(tok, "PUT", "/"+name+"/k", []byte("v")); r.status != 200 || r.header.Get("x-binvault-node") != winner.name {
				t.Fatalf("round %d: PUT through %s: %d %s node=%q (winner %s)", round, n.name, r.status, r.code(), r.header.Get("x-binvault-node"), winner.name)
			}
		}
		for _, n := range tc.nodes {
			n.stop()
		}
	}
}

// Sealed values in the catalog are opened by boot and validate and re-sealed by rekey
// (spec §4.7, §8.5).
func TestClusterSealedValuesInTheCatalog(t *testing.T) {
	tc := startCluster(t, 2, nil)
	a := tc.nodes[0]
	svc := newFsvc(t)
	a.mustAdmin(201, "POST", "/pipelines?wait=replicated", pipeDef("sealed", "after", svc.url("sealed"), a.s3URL, map[string]any{
		"service": map[string]any{"url": svc.url("sealed"), "s3_endpoint": a.s3URL, "headers": map[string]any{"Authorization": "Bearer service-secret"},
			"signing_secret": "a-signing-secret-of-at-least-32-characters"},
	}))
	// the secrets replicated sealed; the other node can use them
	got := tc.nodes[1].mustAdmin(200, "GET", "/pipelines/sealed", nil)
	hdrs := got["service"].(map[string]any)["headers"].(map[string]any)
	if hdrs["Authorization"] != "***" || got["service"].(map[string]any)["has_signing_secret"] != true {
		t.Fatalf("the replicated pipeline: %v", got)
	}
	dir := a.dir
	tc.nodes[0].stop()
	tc.nodes[1].stop()

	ctx := context.Background()
	db, err := meta.OpenReadOnly(ctx, filepath.Join(dir, "meta.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	ring, _ := seal.New(tc.master)
	problems, n, err := app.CheckSealed(ctx, db, ring)
	if err != nil || len(problems) != 0 || n < 4 {
		t.Fatalf("the right key must open every value, catalog included (checked %d): %v %v", n, problems, err)
	}
	wrong, _ := seal.New(bytes.Repeat([]byte{7}, 32))
	problems, _, _ = app.CheckSealed(ctx, db, wrong)
	cat := 0
	for _, p := range problems {
		if strings.Contains(p, "catalog") {
			cat++
		}
	}
	if cat == 0 {
		t.Fatalf("a wrong key must be caught in the catalog too: %v", problems)
	}

	// rekey under a new master key re-seals the catalog as well, so the old key can go
	newKey := bytes.Repeat([]byte{9}, 32)
	cfg := config.ForTest(func(c *config.Config) {
		c.DataDir = dir
		c.MasterKey = newKey
		c.MasterKeyOld = [][]byte{tc.master}
	})
	if changed, err := app.RekeyDataDir(ctx, cfg); err != nil || changed < 4 {
		t.Fatalf("rekey: %d %v", changed, err)
	}
	db2, err := meta.OpenReadOnly(ctx, filepath.Join(dir, "meta.db"))
	if err != nil {
		t.Fatal(err)
	}
	defer db2.Close()
	onlyNew, _ := seal.New(newKey)
	if problems, _, err := app.CheckSealed(ctx, db2, onlyNew); err != nil || len(problems) != 0 {
		t.Fatalf("after the rekey the new key alone must open everything: %v %v", problems, err)
	}
}

// binvault validate checks the cluster settings without contacting peers.
func TestValidateChecksClusterSettings(t *testing.T) {
	dir := t.TempDir()
	cfg := config.ForTest(func(c *config.Config) {
		c.DataDir = dir
		c.NodeName = "a"
		c.ClusterURLs = []string{"http://127.0.0.1:1", "http://127.0.0.1:2"}
		c.ClusterKey = [][]byte{bytes.Repeat([]byte("k"), 40)}
		c.ClusterInsecureHTTP = true
	})
	rep, err := app.Validate(context.Background(), cfg, false)
	if err != nil || len(rep.Problems) != 0 {
		t.Fatalf("validate: %v %v", err, rep.Problems)
	}
	if !strings.Contains(strings.Join(rep.Info, "\n"), `cluster mode: node "a", 2 peer URL(s)`) {
		t.Fatalf("the cluster is not reported: %v", rep.Info)
	}
	cfg.ClusterInsecureHTTP = false
	cfg.ClusterTLSCertFile, cfg.ClusterTLSKeyFile = filepath.Join(dir, "no.crt"), filepath.Join(dir, "no.key")
	cfg.ClusterCAFile = filepath.Join(dir, "no-ca.pem")
	rep, _ = app.Validate(context.Background(), cfg, false)
	probs := strings.Join(rep.Problems, "\n")
	if !strings.Contains(probs, "certificate and key do not load") || !strings.Contains(probs, "BINVAULT_CLUSTER_CA_FILE") || !strings.Contains(probs, "plain HTTP") {
		t.Fatalf("validate problems: %v", rep.Problems)
	}
	// and a single node is not asked about any of it
	single := config.ForTest(func(c *config.Config) { c.DataDir = dir })
	if rep, _ := app.Validate(context.Background(), single, false); strings.Contains(strings.Join(rep.Info, "\n"), "cluster mode") {
		t.Fatalf("a single node reports a cluster: %v", rep.Info)
	}
}
