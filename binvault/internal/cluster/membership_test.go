package cluster

import (
	"context"
	"crypto/ecdsa"
	"crypto/elliptic"
	"crypto/rand"
	"crypto/tls"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"io"
	"math/big"
	"net"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/config"
)

func rebind(t *testing.T, addr string) net.Listener {
	t.Helper()
	var l net.Listener
	var err error
	for i := 0; i < 100; i++ {
		if l, err = net.Listen("tcp", addr); err == nil {
			return l
		}
		time.Sleep(20 * time.Millisecond)
	}
	t.Skipf("could not rebind %s: %v", addr, err)
	return nil
}

// A copied data dir answers with this node's id and another boot nonce: sync
// with it is refused and alarmed (spec §8.3).
func TestCloneDetected(t *testing.T) {
	la, ua := listener(t)
	lc, uc := listener(t)
	urls := []string{ua, uc}
	ctx := ctxT()
	a := newTestNode(t, spec{name: "alpha", l: la, urls: urls})
	op := must(a.node.CreateBucket(ctx, "photos", BucketEntry{Home: a.id()}))

	cloneDir := t.TempDir()
	if err := a.db.Backup(ctx, filepath.Join(cloneDir, "meta.db")); err != nil {
		t.Fatal(err)
	}
	clone := newTestNode(t, spec{name: "alpha", dir: cloneDir, l: lc, urls: urls})
	if clone.id() != a.id() {
		t.Fatal("test setup: the clone should share the id")
	}

	a.node.discover(ctx, true)
	clones := a.node.Clones()
	if len(clones) != 1 || clones[0].URL != uc || clones[0].NodeID != a.id() {
		t.Fatalf("clones %+v", clones)
	}
	if peers := a.node.Peers(); len(peers) != 0 {
		t.Fatalf("a clone is not a peer: %+v", peers)
	}
	if up := a.node.usablePeers(); len(up) != 0 {
		t.Fatalf("must not sync with a clone: %+v", up)
	}
	// the other side sees it the same way
	clone.node.discover(ctx, true)
	if cl := clone.node.Clones(); len(cl) != 1 || cl[0].URL != ua {
		t.Fatalf("clones seen by the copy: %+v", cl)
	}
	// what the clone writes does not reach the original, and the other way round
	must(clone.node.CreateBucket(ctx, "cloned", BucketEntry{Home: clone.id()}))
	must(a.node.CreateBucket(ctx, "original", BucketEntry{Home: a.id()}))
	settle(a, clone)
	if _, ok := a.node.Bucket("cloned"); ok {
		t.Fatal("synced with a clone")
	}
	if _, ok := clone.node.Bucket("original"); ok {
		t.Fatal("the clone synced with the original")
	}
	// a clone is not waited for, and the fence counts it as silent: it may hold ops
	// of this node's stream
	if p := a.node.WaitReplicated(ctx, []Op{op}, 100*time.Millisecond); len(p) != 0 {
		t.Fatalf("waiting for a clone: %v", p)
	}
	if silent := a.node.silentURLs(); len(silent) != 1 || silent[0] != uc {
		t.Fatalf("silent %v", silent)
	}
}

// A URL that now answers with another id is a redeployed node: the old id is
// retired, its ops stay, buckets homed on it stay assigned and are reported
// missing; restoring the old data dir revives it (spec §8.3).
func TestRedeployRetiresTheOldID(t *testing.T) {
	la, ua := listener(t)
	lb, ub := listener(t)
	urls := []string{ua, ub}
	ctx := ctxT()
	a := newTestNode(t, spec{name: "a", l: la, urls: urls})
	dirB := t.TempDir()
	b := newTestNode(t, spec{name: "b", dir: dirB, l: lb, urls: urls})
	must(b.node.CreateBucket(ctx, "onb", BucketEntry{Home: b.id()}))
	op := must(a.node.CreateBucket(ctx, "ona", BucketEntry{Home: a.id()}))
	settle(a, b)
	oldID := b.id()
	addr := lb.Addr().String()
	b.close()

	// a fresh volume takes the URL over: a new node, with the same name
	fresh := newTestNode(t, spec{name: "b", l: rebind(t, addr), urls: urls})
	if fresh.id() == oldID {
		t.Fatal("a fresh deployment must get a new id")
	}
	a.node.discover(ctx, true)
	var retired, live *PeerInfo
	for _, p := range a.node.Peers() {
		p := p
		if p.Retired {
			retired = &p
		} else {
			live = &p
		}
	}
	if retired == nil || retired.ID != oldID || !strings.HasPrefix(retired.RetiredWhy, "redeployed") {
		t.Fatalf("the old id must be retired: %+v", a.node.Peers())
	}
	if live == nil || live.ID != fresh.id() || live.Name != "b" {
		t.Fatalf("the new deployment is the peer: %+v", a.node.Peers())
	}
	// the old node's catalog entries stay, assigned to its id: reported missing
	if home, _, ok := a.node.Home("onb"); !ok || home != oldID {
		t.Fatalf("the bucket must stay assigned to the old id: %q %v", home, ok)
	}
	miss, err := a.node.MissingBuckets(ctx)
	if err != nil || len(miss) != 1 || miss[0].Name != "onb" || miss[0].Reason != "retired_home" {
		t.Fatalf("%+v %v", miss, err)
	}
	// a name shared with the retired node is no duplicate
	if m := a.node.Mismatches(); len(m) != 0 {
		t.Fatalf("%+v", m)
	}
	settle(a, fresh)
	if _, ok := fresh.node.Bucket("onb"); !ok {
		t.Fatal("the fresh node did not learn the catalog")
	}
	// the retired id holds nothing back
	pending := a.node.WaitReplicated(ctx, []Op{op}, time.Second)
	if len(pending) != 0 {
		t.Fatalf("pending %v", pending)
	}

	// the old data dir is restored at the URL: the old id is a member again and the
	// interim deployment is the one that was replaced
	fresh.close()
	restored := newTestNode(t, spec{name: "b", dir: dirB, l: rebind(t, addr), urls: urls})
	if restored.id() != oldID {
		t.Fatal("restore should keep the id")
	}
	a.node.discover(ctx, true)
	for _, p := range a.node.Peers() {
		switch p.ID {
		case oldID:
			if p.Retired {
				t.Fatalf("the restored node must be revived: %+v", p)
			}
		case fresh.id():
			if !p.Retired {
				t.Fatalf("the interim deployment must be retired: %+v", p)
			}
		}
	}
	if miss, _ := a.node.MissingBuckets(ctx); len(miss) != 0 {
		t.Fatalf("%+v", miss)
	}
}

// Two nodes sharing a name are refused and reported until one is renamed.
func TestDuplicateNameIsRefused(t *testing.T) {
	l1, u1 := listener(t)
	l2, u2 := listener(t)
	urls := []string{u1, u2}
	ctx := ctxT()
	a := newTestNode(t, spec{name: "same", l: l1, urls: urls})
	b := newTestNode(t, spec{name: "same", l: l2, urls: urls})
	must(a.node.CreateBucket(ctx, "photos", BucketEntry{Home: a.id()}))
	must(b.node.CreateBucket(ctx, "other", BucketEntry{Home: b.id()}))
	settle(a, b)
	if _, ok := b.node.Bucket("photos"); ok {
		t.Fatal("synced with a node that shares our name")
	}
	if _, ok := a.node.Bucket("other"); ok {
		t.Fatal("synced with a node that shares our name")
	}
	for _, n := range []*tnode{a, b} {
		m := n.node.Mismatches()
		if len(m) != 1 || m[0].Setting != "node_name" || !strings.Contains(m[0].Theirs, `"same"`) {
			t.Fatalf("%s: %+v", n.node.Name(), m)
		}
		if p := n.node.Peers(); len(p) != 1 || !strings.HasPrefix(p[0].Refused, "duplicate node name") {
			t.Fatalf("%+v", p)
		}
		if up := n.node.usablePeers(); len(up) != 0 {
			t.Fatalf("%+v", up)
		}
	}
	// a rename (and restart) ends it
	addr := l2.Addr().String()
	b.close()
	b2 := newTestNode(t, spec{name: "different", dir: b.dir, l: rebind(t, addr), urls: urls})
	if b2.id() != b.id() {
		t.Fatal("same data dir, same id")
	}
	settle(a, b2)
	if _, ok := b2.node.Bucket("photos"); !ok {
		t.Fatal("sync did not resume after the rename")
	}
	if m := a.node.Mismatches(); len(m) != 0 {
		t.Fatalf("%+v", m)
	}
}

// Master key ids, region, domain and the `before` budget must match; a mismatch
// is reported (spec §8.3).
func TestSettingsMismatchAlarms(t *testing.T) {
	c := newManual(t, 3, func(i int, sp *spec) {
		switch i {
		case 0:
			sp.ring = ringOf(t, 1)
		case 1: // everything differs
			sp.ring = ringOf(t, 2, 1)
			sp.cfg = func(c *config.Config) {
				c.Region = "eu-west-1"
				c.Domain = "s3.example.com"
				c.PipelineBeforeTotalTimeout = 10 * time.Second
			}
		case 2: // like the first
			sp.ring = ringOf(t, 1)
		}
	})
	settle(c...)
	m := c[0].node.Mismatches()
	byNode := map[string][]string{}
	for _, x := range m {
		byNode[x.Node] = append(byNode[x.Node], x.Setting)
	}
	if len(byNode["node3"]) != 0 {
		t.Fatalf("node3 matches node1: %+v", m)
	}
	want := "domain,master_key_ids,pipeline_before_total_timeout,region"
	if got := strings.Join(byNode["node2"], ","); got != want {
		t.Fatalf("node2: %s, want %s", got, want)
	}
	for _, x := range m {
		switch x.Setting {
		case "region":
			if x.Ours != "us-east-1" || x.Theirs != "eu-west-1" {
				t.Fatalf("%+v", x)
			}
		case "pipeline_before_total_timeout":
			if x.Ours != "25s" || x.Theirs != "10s" {
				t.Fatalf("%+v", x)
			}
		case "master_key_ids":
			if x.Ours == x.Theirs || !strings.Contains(x.Theirs, ",") {
				t.Fatalf("%+v", x)
			}
		}
	}
	// the other side sees the same differences
	if m := c[1].node.Mismatches(); len(m) != 8 {
		t.Fatalf("node2 sees %d mismatches, want 4 per peer: %+v", len(m), m)
	}
	if al, err := c[0].node.Alarms(ctxT()); err != nil || len(al.Mismatches) != 4 {
		t.Fatalf("%+v %v", al, err)
	}
	// mismatches do not stop replication
	must(c[0].node.CreateBucket(ctxT(), "photos", BucketEntry{Home: c[0].id()}))
	settle(c...)
	if _, ok := c[1].node.Bucket("photos"); !ok {
		t.Fatal("a mismatch alarm must not stop the catalog")
	}
}

func selfSigned(t *testing.T) ([]byte, tls.Certificate) {
	t.Helper()
	key, err := ecdsa.GenerateKey(elliptic.P256(), rand.Reader)
	if err != nil {
		t.Fatal(err)
	}
	tmpl := &x509.Certificate{
		SerialNumber: big.NewInt(1), Subject: pkix.Name{CommonName: "binvault-test"},
		NotBefore: time.Now().Add(-time.Hour), NotAfter: time.Now().Add(time.Hour),
		KeyUsage: x509.KeyUsageDigitalSignature | x509.KeyUsageCertSign, ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		IPAddresses: []net.IP{net.ParseIP("127.0.0.1")}, DNSNames: []string{"localhost"},
		IsCA: true, BasicConstraintsValid: true,
	}
	der, err := x509.CreateCertificate(rand.Reader, tmpl, tmpl, &key.PublicKey, key)
	if err != nil {
		t.Fatal(err)
	}
	pemBytes := pem.EncodeToMemory(&pem.Block{Type: "CERTIFICATE", Bytes: der})
	return pemBytes, tls.Certificate{Certificate: [][]byte{der}, PrivateKey: key}
}

// Peer URLs are https, verified against the system roots plus
// BINVAULT_CLUSTER_CA_FILE (a pinned self-signed certificate works): a node that
// does not have it cannot talk to the others (spec §8.3).
func TestTLSWithPinnedCertificate(t *testing.T) {
	pemBytes, cert := selfSigned(t)
	caFile := filepath.Join(t.TempDir(), "ca.pem")
	if err := os.WriteFile(caFile, pemBytes, 0o600); err != nil {
		t.Fatal(err)
	}
	mk := func() (net.Listener, string) {
		l, err := net.Listen("tcp", "127.0.0.1:0")
		if err != nil {
			t.Fatal(err)
		}
		return l, "https://" + l.Addr().String()
	}
	l1, u1 := mk()
	l2, u2 := mk()
	l3, u3 := mk()
	urls := []string{u1, u2, u3}
	a := newTestNode(t, spec{name: "a", l: l1, urls: urls, tls: &cert, caFile: caFile})
	b := newTestNode(t, spec{name: "b", l: l2, urls: urls, tls: &cert, caFile: caFile})
	stranger := newTestNode(t, spec{name: "c", l: l3, urls: urls, tls: &cert}) // no CA file: system roots only
	ctx := ctxT()
	must(a.node.CreateBucket(ctx, "photos", BucketEntry{Home: a.id()}))
	settle(a, b)
	if _, ok := b.node.Bucket("photos"); !ok {
		t.Fatal("replication over TLS failed")
	}
	for _, p := range a.node.Peers() {
		if !p.Reachable {
			t.Fatalf("a trusts the pinned certificate: %+v", p)
		}
	}
	// the node without the certificate cannot verify anyone
	stranger.node.discover(ctx, true)
	for _, p := range stranger.node.Peers() {
		if p.Reachable || !strings.Contains(p.Error, "certificate") {
			t.Fatalf("a self-signed peer must be refused by default: %+v", p)
		}
	}
	// and the forwarder's transport carries the same trust
	req, _ := http.NewRequestWithContext(ctx, http.MethodGet, u2+PeerPrefix+"hello", nil)
	a.node.AuthRequest(req)
	resp, err := (&http.Client{Transport: a.node.ForwardTransport()}).Do(req)
	if err != nil {
		t.Fatal(err)
	}
	body, _ := io.ReadAll(resp.Body)
	resp.Body.Close()
	if resp.StatusCode != 200 || !strings.Contains(string(body), b.id()) {
		t.Fatalf("%d %s", resp.StatusCode, body)
	}
	// plain http against a TLS listener fails cleanly
	plain := strings.Replace(u2, "https://", "http://", 1)
	req, _ = http.NewRequestWithContext(ctx, http.MethodGet, plain+PeerPrefix+"hello", nil)
	a.node.AuthRequest(req)
	if resp, err := a.node.Client().Do(req); err == nil {
		resp.Body.Close()
		if resp.StatusCode == 200 {
			t.Fatal("hello answered over plain http on a TLS listener")
		}
	}
}

func TestNewRejectsBadSetups(t *testing.T) {
	ctx := context.Background()
	tn := newTestNode(t, spec{})
	if _, err := New(Options{DB: tn.db, NodeID: "n_x"}); err == nil {
		t.Error("no config")
	}
	if _, err := New(Options{Config: config.ForTest(nil), NodeID: "n_x"}); err == nil {
		t.Error("no database")
	}
	if _, err := New(Options{Config: config.ForTest(nil), DB: tn.db, NodeID: "bad id"}); err == nil {
		t.Error("a bad node id")
	}
	cfg := config.ForTest(func(c *config.Config) { c.ClusterURLs = []string{"http://127.0.0.1:1"} }) // no cluster key
	if _, err := New(Options{Config: cfg, DB: tn.db, NodeID: "n_x"}); err == nil {
		t.Error("a cluster without a key")
	}
	cfg = config.ForTest(func(c *config.Config) {
		c.ClusterURLs = []string{"http://127.0.0.1:1"}
		c.ClusterKey = [][]byte{[]byte(testKey)}
	}) // plain HTTP without BINVAULT_CLUSTER_INSECURE_HTTP
	if _, err := New(Options{Config: cfg, DB: tn.db, NodeID: "n_x"}); err == nil || !strings.Contains(err.Error(), "plain HTTP") {
		t.Errorf("plain-http peer URLs need the opt-in: %v", err)
	}
	cfg = config.ForTest(func(c *config.Config) { c.ClusterCAFile = filepath.Join(t.TempDir(), "missing.pem") })
	if _, err := New(Options{Config: cfg, DB: tn.db, NodeID: "n_x"}); err == nil {
		t.Error("a missing CA file")
	}
	bad := filepath.Join(t.TempDir(), "bad.pem")
	_ = os.WriteFile(bad, []byte("not a certificate"), 0o600)
	cfg = config.ForTest(func(c *config.Config) { c.ClusterCAFile = bad })
	if _, err := New(Options{Config: cfg, DB: tn.db, NodeID: "n_x"}); err == nil {
		t.Error("a CA file without certificates")
	}
	// a single node: no peers, ready at once, writes work
	solo, err := New(Options{Config: config.ForTest(nil), DB: tn.db, NodeID: tn.id()})
	if err != nil || !solo.Single() || !solo.Ready() {
		t.Fatalf("%v", err)
	}
	if err := solo.Start(ctx); err != nil {
		t.Fatal(err)
	}
	if err := solo.Start(ctx); err == nil {
		t.Error("Start twice")
	}
	if _, err := solo.CreateBucket(ctx, "photos", BucketEntry{Home: solo.ID()}); err != nil {
		t.Fatal(err)
	}
	if solo.SyncNow(ctx) || len(solo.Peers()) != 0 {
		t.Error("a single node has no peers")
	}
	if p := solo.WaitReplicated(ctx, []Op{{Origin: solo.ID(), Seq: 1}}, time.Second); p != nil {
		t.Error("nothing to wait for on a single node")
	}
	solo.Stop()
}

// An unreachable URL is asked again with a growing delay, not at every round.
func TestUnreachableURLsBackOff(t *testing.T) {
	tn := newTestNode(t, spec{tune: func() *Tuning {
		x := fastTuning()
		x.BackoffMin, x.BackoffMax = 40*time.Millisecond, 160*time.Millisecond
		return &x
	}()})
	n := tn.node
	var got []time.Duration
	for i := 1; i <= 6; i++ {
		got = append(got, n.backoff(i))
	}
	want := []time.Duration{40, 80, 160, 160, 160, 160}
	for i := range want {
		if got[i] != want[i]*time.Millisecond {
			t.Fatalf("backoff(%d) = %s, want %s", i+1, got[i], want[i]*time.Millisecond)
		}
	}
	// a URL in backoff is not asked again until its time has come; force asks anyway
	l, dead := listener(t)
	l.Close()
	n2 := newTestNode(t, spec{urls: []string{tn.url, dead}, tune: func() *Tuning {
		x := fastTuning()
		x.BackoffMin, x.BackoffMax = 150*time.Millisecond, 150*time.Millisecond
		return &x
	}()}).node
	n2.discover(ctxT(), true)
	for _, u := range n2.dueURLs(false) {
		if u == dead {
			t.Fatalf("%s is in backoff but due", u)
		}
	}
	time.Sleep(200 * time.Millisecond)
	found := false
	for _, u := range n2.dueURLs(false) {
		found = found || u == dead
	}
	if !found {
		t.Fatal("the URL should be due again once the backoff has passed")
	}
	if all := n2.dueURLs(true); len(all) != 2 {
		t.Fatalf("%v", all)
	}
}
