package app_test

import (
	"fmt"
	"net/http"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/admin"
)

// items returns the "items" of a list answer.
func items(t *testing.T, out map[string]any) []map[string]any {
	t.Helper()
	var res []map[string]any
	list, _ := out["items"].([]any)
	for _, it := range list {
		res = append(res, it.(map[string]any))
	}
	return res
}

func itemNames(t *testing.T, out map[string]any, key string) []string {
	t.Helper()
	var names []string
	for _, it := range items(t, out) {
		names = append(names, fmt.Sprint(it[key]))
	}
	return names
}

func contains(list []string, s string) bool {
	for _, x := range list {
		if x == s {
			return true
		}
	}
	return false
}

// Placement: `auto` and a named home; the node that receives the call asks the
// others whether the name exists; cordoned nodes take no new buckets (spec §8.6).
func TestClusterPlacement(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]

	// a named home, created through another node: the bucket is created there
	out := a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "onb", "home": "b"})
	if out["home"] != "b" {
		t.Fatalf("home: %v", out)
	}
	for _, n := range tc.nodes {
		l := n.mustAdmin(200, "GET", "/buckets", nil)
		var home string
		for _, it := range items(t, l) {
			if it["name"] == "onb" {
				home = fmt.Sprint(it["home"])
			}
		}
		if home != "b" {
			t.Fatalf("%s lists onb homed on %q: %v", n.name, home, l)
		}
	}
	// the bucket's data and settings live on b only
	if code, _ := a.admin("GET", "/buckets/onb", nil); code != 200 {
		t.Fatalf("GET through a: %d", code)
	}
	if _, err := b.app.DB.Read().GetBucket(b.ctx, "onb"); err != nil {
		t.Fatalf("b has no local bucket: %v", err)
	}
	for _, n := range []*cnode{a, c} {
		if _, err := n.app.DB.Read().GetBucket(n.ctx, "onb"); err == nil {
			t.Fatalf("%s holds a local row of a bucket homed on b", n.name)
		}
	}

	// a name that exists anywhere is 409, whichever node is asked and whichever home is named
	for _, n := range tc.nodes {
		for _, home := range []string{"a", "b", "c", "auto"} {
			if code, out := n.admin("POST", "/buckets", map[string]any{"name": "onb", "home": home}); code != 409 {
				t.Fatalf("duplicate create at %s home %s: %d %v", n.name, home, code, out)
			}
		}
	}
	// an unknown home is a validation error, a bad name too
	if code, out := a.admin("POST", "/buckets", map[string]any{"name": "nowhere", "home": "zzz"}); code != 400 || out["fields"] == nil {
		t.Fatalf("unknown home: %d %v", code, out)
	}
	if code, _ := a.admin("POST", "/buckets", map[string]any{"name": "Bad_Name", "home": "b"}); code != 400 {
		t.Fatalf("bad name: %d", code)
	}

	// auto skips cordoned nodes: with a and b cordoned every new bucket lands on c
	for _, n := range []*cnode{a, b} {
		if err := n.app.Cluster().SetCordoned(n.ctx, true); err != nil {
			t.Fatal(err)
		}
	}
	eventually(t, 5*time.Second, "the cordons to be known", func() bool {
		for _, p := range c.app.Cluster().Peers() {
			if !p.Cordoned {
				return false
			}
		}
		return true
	})
	for i := 0; i < 4; i++ {
		out := a.mustAdmin(201, "POST", "/buckets", map[string]any{"name": fmt.Sprintf("auto%d", i)})
		if out["home"] != "c" {
			t.Fatalf("auto placement with a and b cordoned: %v", out["home"])
		}
	}
	if code, out := b.admin("POST", "/buckets", map[string]any{"name": "named", "home": "a"}); code != 409 {
		t.Fatalf("a named, cordoned home: %d %v", code, out)
	}
	for _, n := range []*cnode{a, b} {
		_ = n.app.Cluster().SetCordoned(n.ctx, false)
	}
	eventually(t, 5*time.Second, "the cordons to lift", func() bool {
		for _, p := range c.app.Cluster().Peers() {
			if p.Cordoned {
				return false
			}
		}
		return true
	})
	// auto with everything open: one of the nodes, and the omitted `home` means auto
	out = b.mustAdmin(201, "POST", "/buckets", map[string]any{"name": "open1"})
	if !contains([]string{"a", "b", "c"}, fmt.Sprint(out["home"])) {
		t.Fatalf("auto home: %v", out["home"])
	}

	// creating on a node that is down fails; the name stays free
	c.crash()
	eventually(t, 5*time.Second, "a to see c down", func() bool {
		for _, p := range a.app.Cluster().Peers() {
			if p.Name == "c" && !p.Reachable {
				return true
			}
		}
		return false
	})
	if code, out := a.admin("POST", "/buckets", map[string]any{"name": "ghost", "home": "c"}); code != 503 || out["error"] != "unavailable" {
		t.Fatalf("create on a node that is down: %d %v", code, out)
	}
	a.mustAdmin(201, "POST", "/buckets", map[string]any{"name": "ghost", "home": "a"}) // the name was never taken
}

// ?wait=replicated answers 200 when every active peer applied the change and 202 with
// the pending peers otherwise (spec §6.1, §8.5).
func TestClusterWaitReplicated(t *testing.T) {
	old := admin.ReplicatedTimeout
	admin.ReplicatedTimeout = 700 * time.Millisecond
	defer func() { admin.ReplicatedTimeout = old }()

	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]

	// everybody applies: 200/201 and no pending list; the change is visible at once
	out := a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "wr1", "home": "b"})
	if out["pending"] != nil {
		t.Fatalf("pending with every node up: %v", out)
	}
	if _, ok := c.app.Cluster().Bucket("wr1"); !ok {
		t.Fatal("c does not know the bucket although the call waited for it")
	}
	if code, _ := c.admin("DELETE", "/buckets/wr1?wait=replicated", nil); code != 204 {
		t.Fatalf("delete with wait: %d", code)
	}
	if _, ok := a.app.Cluster().Bucket("wr1"); ok {
		t.Fatal("a still lists the deleted bucket")
	}

	// c is down: the call still succeeds but says 202 and names c
	c.crash()
	eventually(t, 5*time.Second, "a to see c down", func() bool {
		for _, p := range a.app.Cluster().Peers() {
			if p.Name == "c" && !p.Reachable {
				return true
			}
		}
		return false
	})
	start := time.Now()
	code, out, _ := a.adminWith("POST", "/buckets?wait=replicated", map[string]any{"name": "wr2", "home": "b"})
	if code != 202 {
		t.Fatalf("with c down: %d %v", code, out)
	}
	pend, _ := out["pending"].([]any)
	if len(pend) != 1 || fmt.Sprint(pend[0].(map[string]any)["name"]) != "c" || out["name"] != "wr2" {
		t.Fatalf("pending list / normal body: %v", out)
	}
	if time.Since(start) > 5*time.Second {
		t.Fatalf("the wait took %s", time.Since(start))
	}
	// without ?wait=replicated the same call is just 201, and other calls ignore the parameter
	a.mustAdmin(201, "POST", "/buckets", map[string]any{"name": "wr3", "home": "b"})
	a.mustAdmin(200, "GET", "/buckets/wr3?wait=replicated", nil)
	// a pipeline write waits as well
	code, out, _ = b.adminWith("POST", "/pipelines?wait=replicated", map[string]any{
		"name": "wrp", "stage": "after", "service": map[string]any{"url": "http://127.0.0.1:1/hook"},
	})
	if code != 202 || out["name"] != "wrp" || len(out["pending"].([]any)) != 1 {
		t.Fatalf("pipeline create with c down: %d %v", code, out)
	}
	_ = b
}

// adminWith is admin that also returns the headers.
func (cn *cnode) adminWith(method, path string, body any) (int, map[string]any, http.Header) {
	cn.t.Helper()
	code, out := cn.admin(method, path, body)
	return code, out, nil
}

// DELETE /buckets/{name}?catalog_only=true is a catalog write the receiving node
// makes itself, so it works with the home down and is refused while the home
// answers; the home's data becomes an orphan when it returns (spec §6.3, §8.5, §8.9).
func TestClusterCatalogOnlyDeleteAndOrphans(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b := tc.nodes[0], tc.nodes[1]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "doomed", "home": "b"})
	cr := a.token("doomed", all, nil)
	a.must(cr, 200, "PUT", "/doomed/k", []byte("kept on b"))
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "healthy", "home": "c"})
	hr := a.token("healthy", all, nil)

	// while b answers, catalog_only is refused, whichever node is asked
	for _, n := range tc.nodes {
		if code, out := n.admin("DELETE", "/buckets/doomed?catalog_only=true", nil); code != 409 {
			t.Fatalf("catalog_only with the home up, at %s: %d %v", n.name, code, out)
		}
	}
	if code, _ := a.admin("DELETE", "/buckets/nonexistent?catalog_only=true", nil); code != 404 {
		t.Fatalf("catalog_only for an unknown bucket: %d", code)
	}

	b.crash()
	eventually(t, 5*time.Second, "a to see b down", func() bool {
		for _, p := range a.app.Cluster().Peers() {
			if p.Name == "b" && !p.Reachable {
				return true
			}
		}
		return false
	})
	if r := a.s3(cr, "GET", "/doomed/k", nil); r.status != 503 {
		t.Fatalf("home down: %d", r.status)
	}
	if code, _ := a.admin("DELETE", "/buckets/doomed", nil); code != 503 {
		t.Fatalf("an ordinary delete with the home down: %d", code)
	}
	// the home is down, so ?wait=replicated cannot be satisfied: the call succeeds as 202 naming b
	oldWait := admin.ReplicatedTimeout
	admin.ReplicatedTimeout = 600 * time.Millisecond
	code, out, _ := a.adminWith("DELETE", "/buckets/doomed?catalog_only=true&wait=replicated", nil)
	admin.ReplicatedTimeout = oldWait
	if p, _ := out["pending"].([]any); code != 202 || len(p) != 1 || fmt.Sprint(p[0].(map[string]any)["name"]) != "b" {
		t.Fatalf("catalog_only with wait and the home down: %d %v", code, out)
	}
	for _, n := range []*cnode{a, tc.nodes[2]} {
		if code, _ := n.admin("GET", "/buckets/doomed", nil); code != 404 {
			t.Fatalf("after catalog_only, %s still has the bucket: %d", n.name, code)
		}
		if r := n.s3(cr, "GET", "/doomed/k", nil); r.status != 404 || r.code() != "NoSuchBucket" {
			t.Fatalf("data-plane request for the dropped bucket at %s: %d %s", n.name, r.status, r.code())
		}
		if r := n.s3(cr, "GET", "/", nil); r.status != 404 && r.status != 403 {
			t.Fatalf("ListBuckets with a key of the dropped bucket at %s: %d", n.name, r.status)
		}
	}
	if r := tc.nodes[2].s3(hr, "GET", "/healthy/none", nil); r.status != 404 || r.code() != "NoSuchKey" {
		t.Fatalf("the other bucket: %d %s", r.status, r.code())
	}

	// b returns: its data is an orphan — not served, listed, kept — until deleted
	nb := tc.restart(1, nil)
	tc.waitReady(15 * time.Second)
	var gen string
	eventually(t, 10*time.Second, "b to report the orphan", func() bool {
		_, out := nb.admin("GET", "/cluster", nil)
		al, _ := out["alarms"].(map[string]any)
		orphans, _ := al["orphans"].([]any)
		if len(orphans) != 1 {
			return false
		}
		o := orphans[0].(map[string]any)
		gen = fmt.Sprint(o["generation"])
		return o["name"] == "doomed" && o["reason"] == "deleted"
	})
	if r := nb.s3(cr, "GET", "/doomed/k", nil); r.status != 404 || r.code() != "NoSuchBucket" {
		t.Fatalf("an orphan must not be served: %d %s", r.status, r.code())
	}
	if _, err := nb.app.DB.Read().GetBucket(nb.ctx, "doomed"); err != nil {
		t.Fatalf("the orphan's data must be kept: %v", err)
	}
	// the name can be created again elsewhere while the orphan sits on b
	if code, out := a.admin("POST", "/buckets", map[string]any{"name": "doomed", "home": "a"}); code != 201 {
		t.Fatalf("re-creating the dropped name: %d %v", code, out)
	}
	// ... and on b itself the orphan is in the way until it is deleted
	a.mustAdmin(204, "DELETE", "/buckets/doomed?wait=replicated", nil)
	if code, out := a.admin("POST", "/buckets", map[string]any{"name": "doomed", "home": "b"}); code != 409 || !strings.Contains(fmt.Sprint(out["detail"]), "orphan") {
		t.Fatalf("creating on top of an orphan: %d %v", code, out)
	}
	// the orphan is deleted on the node that holds it, asked through another node
	if code, _ := a.admin("DELETE", "/cluster/orphans/"+gen+"?node=zzz", nil); code != 400 {
		t.Fatalf("unknown node: %d", code)
	}
	if code, out := a.admin("DELETE", "/cluster/orphans/NOSUCHGENERATION?node=b", nil); code != 404 {
		t.Fatalf("unknown generation: %d %v", code, out)
	}
	a.mustAdmin(204, "DELETE", "/cluster/orphans/"+gen+"?node=b", nil)
	if _, err := nb.app.DB.Read().GetBucket(nb.ctx, "doomed"); err == nil {
		t.Fatal("the orphan's data was not deleted")
	}
	_, out = nb.admin("GET", "/cluster", nil)
	if o, _ := out["alarms"].(map[string]any)["orphans"].([]any); len(o) != 0 {
		t.Fatalf("orphans after the delete: %v", o)
	}
	a.mustAdmin(201, "POST", "/buckets", map[string]any{"name": "doomed", "home": "b"})
}

// Node-local calls are answered by the node that received them; GET /cluster shows
// every node; retiring a node is refused while the catalog homes buckets on it.
func TestClusterNodeLocalAndClusterEndpoints(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	for _, n := range tc.nodes {
		out := n.mustAdmin(200, "GET", "/status", nil)
		node, _ := out["node"].(map[string]any)
		if node["name"] != n.name || node["mode"] != "cluster" || node["id"] != n.nodeID() {
			t.Fatalf("/status at %s: %v", n.name, node)
		}
		if cfg := n.mustAdmin(200, "GET", "/config", nil); cfg["cluster"] != true {
			t.Fatalf("/config at %s: %v", n.name, cfg)
		}
		if m := n.metric(t, "binvault_cluster_peer_up"); strings.Count(m, "\n") != 1 || !strings.Contains(m, "} 1") {
			t.Fatalf("peer_up at %s: %q", n.name, m)
		}
	}
	out := a.mustAdmin(200, "GET", "/cluster", nil)
	if out["id"] != a.nodeID() || out["name"] != "a" || out["mode"] != "cluster" {
		t.Fatalf("GET /cluster: %v", out)
	}
	nodes := items2(out["nodes"])
	if len(nodes) != 3 || nodes[0]["self"] != true {
		t.Fatalf("nodes: %v", nodes)
	}
	names := []string{}
	for _, nd := range nodes {
		names = append(names, fmt.Sprint(nd["name"]))
		if nd["reachable"] != true || nd["endpoint"] == "" || nd["free_disk"] == nil || nd["cordoned"] != false {
			t.Fatalf("a node entry: %v", nd)
		}
	}
	if !contains(names, "a") || !contains(names, "b") || !contains(names, "c") {
		t.Fatalf("node names: %v", names)
	}
	al, _ := out["alarms"].(map[string]any)
	for _, k := range []string{"conflicts", "orphans", "held_ops", "clones", "missing", "mismatches"} {
		if l, ok := al[k].([]any); !ok || len(l) != 0 {
			t.Fatalf("alarm %s: %v", k, al[k])
		}
	}

	// the move and drain endpoints answer in a cluster (the moves themselves are tested in
	// cluster_move_test.go): nothing to list yet, unknown ids are 404, the checks of a
	// move request come before anything starts
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "mvb", "home": "b"})
	if out := a.mustAdmin(200, "GET", "/moves", nil); len(items2(out["items"])) != 0 {
		t.Fatalf("GET /moves: %v", out)
	}
	for _, call := range [][2]string{{"GET", "/moves/x"}, {"POST", "/moves/x/cancel"}} {
		if code, out := a.admin(call[0], call[1], nil); code != 404 {
			t.Fatalf("%s %s: %d %v", call[0], call[1], code, out)
		}
	}
	if code, out := a.admin("POST", "/buckets/mvb/move", map[string]any{"to": "nosuch"}); code != 400 {
		t.Fatalf("a move to an unknown node: %d %v", code, out)
	}
	if code, out := a.admin("POST", "/buckets/mvb/move", map[string]any{"to": "b"}); code != 409 {
		t.Fatalf("a move to the node that homes the bucket: %d %v", code, out)
	}
	if code, out := a.admin("POST", "/buckets/mvb/move", map[string]any{"to": "c", "bogus": 1}); code != 400 {
		t.Fatalf("an unknown field: %d %v", code, out)
	}
	if code, out := a.admin("POST", "/buckets/nosuchbucket/move", map[string]any{"to": "c"}); code != 404 {
		t.Fatalf("a move of an unknown bucket: %d %v", code, out)
	}
	if code, out := a.admin("POST", "/cluster/nodes/nosuchnode/drain", nil); code != 404 {
		t.Fatalf("draining an unknown node: %d %v", code, out)
	}
	// draining a node that homes nothing: cordoned, nothing to move, done; undrain lifts it
	out = a.mustAdmin(202, "POST", "/cluster/nodes/c/drain", nil)
	if out["cordoned"] != true || out["state"] != "done" || out["remaining"].(float64) != 0 {
		t.Fatalf("drain of an empty node: %v", out)
	}
	eventually(t, 5*time.Second, "the cordon to show in GET /cluster", func() bool {
		for _, nd := range items2(a.mustAdmin(200, "GET", "/cluster", nil)["nodes"]) {
			if nd["name"] == "c" {
				d, _ := nd["drain"].(map[string]any)
				return nd["cordoned"] == true && d["state"] == "done"
			}
		}
		return false
	})
	out = a.mustAdmin(200, "POST", "/cluster/nodes/c/undrain", nil)
	if out["cordoned"] != false || out["state"] != "" {
		t.Fatalf("undrain: %v", out)
	}

	// retiring: not the node itself, not an unknown one, not while it homes buckets
	if code, _ := a.admin("DELETE", "/cluster/nodes/"+a.nodeID(), nil); code != 409 {
		t.Fatalf("retire self: %d", code)
	}
	if code, _ := a.admin("DELETE", "/cluster/nodes/n_nosuchnode", nil); code != 404 {
		t.Fatalf("retire unknown: %d", code)
	}
	if code, out := a.admin("DELETE", "/cluster/nodes/"+b.nodeID(), nil); code != 409 {
		t.Fatalf("retire a node that homes a bucket: %d %v", code, out)
	}
	// c homes nothing: retiring it is allowed (and it is reachable, so it comes back as a member
	// at its next hello — the call only marks it)
	if code, out := a.admin("DELETE", "/cluster/nodes/"+c.nodeID(), nil); code != 204 {
		t.Fatalf("retire a node without buckets: %d %v", code, out)
	}
}

func items2(v any) []map[string]any {
	var out []map[string]any
	list, _ := v.([]any)
	for _, it := range list {
		out = append(out, it.(map[string]any))
	}
	return out
}

// Bucket-scoped admin calls sent to a node that is not the bucket's home run on the
// home: settings, tokens, deletion, If-Match, validation errors (spec §8.6).
func TestClusterBucketScopedAdminCalls(t *testing.T) {
	tc := startCluster(t, 3, nil)
	a, b, c := tc.nodes[0], tc.nodes[1], tc.nodes[2]
	a.mustAdmin(201, "POST", "/buckets?wait=replicated", map[string]any{"name": "scoped", "home": "b"})

	// detail, PATCH, PUT, If-Match — all through c, all on b
	out := c.mustAdmin(200, "PATCH", "/buckets/scoped", map[string]any{"quota_bytes": 1000})
	rev := int(out["revision"].(float64))
	if out["home"] != "b" || out["quota_bytes"].(float64) != 1000 {
		t.Fatalf("PATCH through c: %v", out)
	}
	if code, _ := c.admin("PATCH", "/buckets/scoped", map[string]any{"max_objects": 3}, "If-Match", fmt.Sprintf(`"%d"`, rev-1)); code != 412 {
		t.Fatalf("a stale If-Match must be relayed as 412: %d", code)
	}
	if code, out := a.admin("PATCH", "/buckets/scoped", map[string]any{"bogus": 1}); code != 400 {
		t.Fatalf("validation errors are relayed: %d %v", code, out)
	}
	if code, _ := a.admin("PUT", "/buckets/scoped", map[string]any{"versioning": "enabled"}); code != 200 {
		t.Fatalf("PUT through a: %d", code)
	}
	if code, _ := a.admin("PUT", "/buckets/missing", map[string]any{}); code != 404 {
		t.Fatalf("PUT of a bucket that does not exist: %d", code)
	}
	// the settings are applied where the data is
	lb, err := b.app.DB.Read().GetBucket(b.ctx, "scoped")
	if err != nil || lb.Versioning != "enabled" || lb.QuotaBytes != nil { // the PUT replaced the PATCHed quota
		t.Fatalf("b's bucket: %+v %v", lb, err)
	}

	// tokens: create through c, list through a, patch and delete through c, use through a
	tok := c.mustAdmin(201, "POST", "/buckets/scoped/tokens", map[string]any{"name": "t", "grants": all})
	id, secret := tok["access_key_id"].(string), tok["secret_access_key"].(string)
	cr := cred{id, secret}
	if len(itemNames(t, a.mustAdmin(200, "GET", "/buckets/scoped/tokens", nil), "access_key_id")) != 1 {
		t.Fatal("token list")
	}
	a.must(cr, 200, "PUT", "/scoped/k", []byte("v"))
	c.mustAdmin(200, "PATCH", "/buckets/scoped/tokens/"+id, map[string]any{"name": "renamed"})
	if code, _ := a.admin("DELETE", "/buckets/scoped", nil); code != 409 {
		t.Fatalf("non-empty delete: %d", code)
	}
	c.mustAdmin(204, "DELETE", "/buckets/scoped/tokens/"+id, nil)
	if r := a.s3(cr, "GET", "/scoped/k", nil); r.status != 403 || r.code() != "InvalidAccessKeyId" {
		t.Fatalf("a revoked token must stop working at once, through any node: %d %s", r.status, r.code())
	}
	// delete with force through a node that is not the home, then the name is free
	c.mustAdmin(204, "DELETE", "/buckets/scoped?force=true&wait=replicated", nil)
	if code, _ := b.admin("GET", "/buckets/scoped", nil); code != 404 {
		t.Fatalf("after the delete: %d", code)
	}
	if _, ok := a.app.Cluster().Bucket("scoped"); ok {
		t.Fatal("a still lists the bucket")
	}
	a.mustAdmin(201, "POST", "/buckets", map[string]any{"name": "scoped", "home": "c"})
}
