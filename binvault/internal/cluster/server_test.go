package cluster

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"testing"
	"time"
)

const secondKey = "second-key-0123456789abcdef0123456789abcdef"

func do(t *testing.T, method, url string, hdr map[string]string) (int, string) {
	t.Helper()
	req, err := http.NewRequest(method, url, nil)
	if err != nil {
		t.Fatal(err)
	}
	for k, v := range hdr {
		req.Header[http.CanonicalHeaderKey(k)] = []string{v}
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	defer resp.Body.Close()
	b, _ := io.ReadAll(resp.Body)
	return resp.StatusCode, string(b)
}

// The peer key: constant-time, several accepted during rotation, the first one
// sent (spec §8.3).
func TestPeerKeyAuthentication(t *testing.T) {
	tn := newTestNode(t, spec{keys: []string{testKey, secondKey}})
	for _, tc := range []struct {
		key  string
		want int
	}{
		{"", 401}, {"wrong", 401}, {testKey[:10], 401}, {testKey + "x", 401}, {strings.ToUpper(testKey), 401},
		{testKey, 200}, {secondKey, 200},
	} {
		hdr := map[string]string{}
		if tc.key != "" {
			hdr[HeaderPeerKey] = tc.key
		}
		if code, _ := do(t, "GET", tn.url+PeerPrefix+"hello", hdr); code != tc.want {
			t.Errorf("key %q: %d, want %d", tc.key, code, tc.want)
		}
	}
	// Authorization is the client's, not ours: it is not a peer credential
	if code, _ := do(t, "GET", tn.url+PeerPrefix+"hello", map[string]string{"Authorization": "Bearer " + testKey}); code != 401 {
		t.Errorf("Authorization as a peer credential: %d", code)
	}
	// a bad key is 401 on every path, so the surface of the listener is not probed
	for _, p := range []string{"/", "/photos/a.png", "/_peer/v1/nope", "/_admin/v1/buckets"} {
		if code, _ := do(t, "GET", tn.url+p, nil); code != 401 {
			t.Errorf("%s without a key: %d", p, code)
		}
	}
	// the node sends the first key
	other := newTestNode(t, spec{keys: []string{secondKey}})
	if code, _ := do(t, "GET", other.url+PeerPrefix+"hello", map[string]string{HeaderPeerKey: secondKey}); code != 200 {
		t.Fatal(code)
	}
	req, _ := http.NewRequest("GET", "http://x/", nil)
	tn.node.authRequest(req)
	if req.Header.Get(HeaderPeerKey) != testKey || req.Header.Get(HeaderNode) != tn.id() {
		t.Fatalf("%v", req.Header)
	}
	if !tn.node.CheckPeerKey(secondKey) || tn.node.CheckPeerKey("nope") {
		t.Fatal("CheckPeerKey")
	}
}

// A request is a forwarded S3 request when it carries X-Binvault-Origin,
// whatever its path; without the header it is a peer call or 404 (spec §8.4).
func TestMuxDispatch(t *testing.T) {
	tn := newTestNode(t, spec{})
	key := map[string]string{HeaderPeerKey: testKey}
	with := func(extra map[string]string) map[string]string {
		h := map[string]string{HeaderPeerKey: testKey}
		for k, v := range extra {
			h[k] = v
		}
		return h
	}

	// no forwarder yet
	if code, _ := do(t, "GET", tn.url+"/photos/a.png", with(map[string]string{HeaderOrigin: "n_entry"})); code != 503 {
		t.Fatalf("forwarded request without a forwarder: %d", code)
	}
	var mu sync.Mutex
	var forwarded []string
	tn.node.Mux().SetForward(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		mu.Lock()
		forwarded = append(forwarded, r.Method+" "+r.URL.RequestURI()+" origin="+r.Header.Get(HeaderOrigin))
		mu.Unlock()
		io.WriteString(w, "forwarded")
	}))
	for _, path := range []string{
		"/photos/a.png", "/", "/_peer/v1/hello", "/_peer/v1/ops?since=", "/_peer/v1/snapshot", "/_peer/v1/admin",
		"/_peer/anything", "/_peer/v1/", "/_admin/v1/buckets", "//double//slash",
	} {
		code, body := do(t, "GET", tn.url+path, with(map[string]string{HeaderOrigin: "n_entry"}))
		if code != 200 || body != "forwarded" {
			t.Errorf("%s with the origin header: %d %q, want it forwarded", path, code, body)
		}
	}
	// an empty value still marks the request
	if code, body := do(t, "GET", tn.url+"/_peer/v1/hello", with(map[string]string{HeaderOrigin: ""})); code != 200 || body != "forwarded" {
		t.Errorf("empty origin header: %d %q", code, body)
	}
	// a bad key never reaches the forwarder
	before := len(forwarded)
	if code, _ := do(t, "GET", tn.url+"/photos/a.png", map[string]string{HeaderOrigin: "n_entry"}); code != 401 {
		t.Errorf("forwarded without a key: %d", code)
	}
	if len(forwarded) != before {
		t.Error("the forwarder ran for a request without a key")
	}

	// without the header: the peer API, or 404
	code, body := do(t, "GET", tn.url+PeerPrefix+"hello", key)
	var h helloMsg
	if code != 200 || json.Unmarshal([]byte(body), &h) != nil || h.NodeID != tn.id() || h.Name != tn.node.Name() {
		t.Fatalf("hello: %d %s", code, body)
	}
	for _, path := range []string{"/", "/photos/a.png", "/_peer/v2/hello", "/_peer/v1/unknown", "/_peer/v1/", "/_peer/hello", "/_metrics", "/_healthz"} {
		if code, _ := do(t, "GET", tn.url+path, key); code != 404 {
			t.Errorf("%s without the origin header: %d, want 404", path, code)
		}
	}
	if code, _ := do(t, "POST", tn.url+PeerPrefix+"hello", key); code != 405 {
		t.Errorf("POST hello: %d", code)
	}
	if code, _ := do(t, "GET", tn.url+PeerPrefix+"notify", key); code != 405 {
		t.Errorf("GET notify: %d", code)
	}
	if code, _ := do(t, "POST", tn.url+PeerPrefix+"notify", key); code != 204 {
		t.Errorf("POST notify: %d", code)
	}

	// extension points for the admin routing and the move protocol of later stages
	var seen []string
	tn.node.Mux().RegisterPeer("/_peer/v1/admin", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, "admin "+r.Method)
		io.WriteString(w, "admin")
	}))
	tn.node.Mux().RegisterPeer("/_peer/v1/moves/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		seen = append(seen, "moves "+r.URL.Path)
		io.WriteString(w, "moves")
	}))
	if code, body := do(t, "POST", tn.url+"/_peer/v1/admin", key); code != 200 || body != "admin" {
		t.Errorf("admin: %d %q", code, body)
	}
	if code, body := do(t, "POST", tn.url+"/_peer/v1/admin/extra", key); code != 404 {
		t.Errorf("an exact path is not a prefix: %d %q", code, body)
	}
	if code, body := do(t, "POST", tn.url+"/_peer/v1/moves/mv1/blobs", key); code != 200 || body != "moves" {
		t.Errorf("moves: %d %q", code, body)
	}
	if code, _ := do(t, "POST", tn.url+"/_peer/v1/moves", key); code != 404 {
		t.Errorf("the subtree needs its slash: %d", code)
	}
	if strings.Join(seen, "|") != "admin POST|moves /_peer/v1/moves/mv1/blobs" {
		t.Errorf("%v", seen)
	}
	// and the origin header still wins over a registered path
	if code, body := do(t, "POST", tn.url+"/_peer/v1/admin", with(map[string]string{HeaderOrigin: "n_entry"})); code != 200 || body != "forwarded" {
		t.Errorf("a marked request on a registered path: %d %q", code, body)
	}
	for _, bad := range []string{"/not-peer", "/_peer/v1/", "/_peer/v1/hello", "/_peer/v1/ops", "/_peer/v1/snapshot", "/_peer/v1/notify", "/_peer/v1/buckets/x", "/_peer/v1/buckets/"} {
		func() {
			defer func() {
				if recover() == nil {
					t.Errorf("RegisterPeer(%q) should panic", bad)
				}
			}()
			tn.node.Mux().RegisterPeer(bad, http.NotFoundHandler())
		}()
	}
	func() {
		defer func() {
			if recover() == nil {
				t.Error("registering a path twice should panic")
			}
		}()
		tn.node.Mux().RegisterPeer("/_peer/v1/admin", http.NotFoundHandler())
	}()
}

func TestBucketCheckEndpoint(t *testing.T) {
	tn := newTestNode(t, spec{})
	op := must(tn.node.CreateBucket(ctxT(), "photos", BucketEntry{Home: tn.id()}))
	key := map[string]string{HeaderPeerKey: testKey}
	_, body := do(t, "GET", tn.url+PeerPrefix+"buckets/photos", key)
	var a bucketAnswer
	if err := json.Unmarshal([]byte(body), &a); err != nil || !a.Exists || a.Home != tn.id() || a.Generation != op.ID() {
		t.Fatalf("%s", body)
	}
	_, body = do(t, "GET", tn.url+PeerPrefix+"buckets/nothing", key)
	a = bucketAnswer{}
	if err := json.Unmarshal([]byte(body), &a); err != nil || a.Exists || a.Name != "nothing" {
		t.Fatalf("%s", body)
	}
	for _, bad := range []string{"UPPER", "a%2Fb", "x"} {
		if code, _ := do(t, "GET", tn.url+PeerPrefix+"buckets/"+bad, key); code != 400 {
			t.Errorf("%s: %d", bad, code)
		}
	}
	// a deleted bucket does not exist
	must(tn.node.DeleteBucket(ctxT(), "photos"))
	_, body = do(t, "GET", tn.url+PeerPrefix+"buckets/photos", key)
	if strings.Contains(body, `"exists":true`) {
		t.Fatalf("%s", body)
	}
}

func TestOpsEndpoint(t *testing.T) {
	tn := newTestNode(t, spec{})
	n := tn.node
	for i := 0; i < 5; i++ {
		must(n.CreateBucket(ctxT(), fmt.Sprintf("bucket%d", i), BucketEntry{Home: n.ID()}))
	}
	key := map[string]string{HeaderPeerKey: testKey, HeaderKeyIDs: joinIDs(n.keyIDStrings())}
	get := func(q string) (int, opsResponse) {
		code, body := do(t, "GET", tn.url+PeerPrefix+"ops"+q, key)
		var r opsResponse
		_ = json.Unmarshal([]byte(body), &r)
		return code, r
	}
	code, r := get("?since=&limit=2")
	if code != 200 || len(r.Ops) != 2 || !r.More || r.VV[n.ID()] != 5 || r.Ops[0].Seq != 1 {
		t.Fatalf("%d %+v", code, r)
	}
	code, r = get("?since=" + n.ID() + ":4")
	if code != 200 || len(r.Ops) != 1 || r.More || r.Ops[0].Seq != 5 {
		t.Fatalf("%d %+v", code, r)
	}
	code, r = get("?since=" + n.ID() + ":5")
	if code != 200 || len(r.Ops) != 0 || r.More {
		t.Fatalf("%d %+v", code, r)
	}
	for _, bad := range []string{"?since=garbage", "?since=a:-1", "?since=a:x", "?since=:3", "?since=a:1&limit=0", "?since=a:1&limit=abc", "?since=bad%20origin:1"} {
		if code, _ := get(bad); code != 400 {
			t.Errorf("%s: %d", bad, code)
		}
	}
	// an unknown origin in since is ignored
	if code, r := get("?since=ghost:9"); code != 200 || len(r.Ops) != 5 {
		t.Fatalf("%d %d", code, len(r.Ops))
	}
	// the page is capped by the server
	n.tune.PageOps = 3
	if _, r := get("?since=&limit=1000"); len(r.Ops) != 3 || !r.More {
		t.Fatalf("%d %v", len(r.Ops), r.More)
	}
}

// The origins that are behind share a page, so a stream the caller cannot
// advance (a held op) never starves the others.
func TestOpsPagesAreFairAcrossOrigins(t *testing.T) {
	tn, _ := single(t)
	n := tn.node
	var many, few []Op
	for i := int64(1); i <= 50; i++ {
		many = append(many, keyOp(t, "bigorigin", i, at(time.Duration(i)*time.Second), fmt.Sprintf("BVKM%04d", i), "photos"))
	}
	for i := int64(1); i <= 3; i++ {
		few = append(few, keyOp(t, "smallorigin", i, at(time.Duration(i)*time.Second), fmt.Sprintf("BVKS%04d", i), "photos"))
	}
	apply(t, n, append(many, few...)...)
	resp, err := n.serveOps(ctxT(), map[string]int64{}, 10, "n_x", keyIDsOf(n), true)
	if err != nil {
		t.Fatal(err)
	}
	counts := map[string]int{}
	for _, op := range resp.Ops {
		counts[op.Origin]++
	}
	if len(resp.Ops) != 10 || counts["smallorigin"] != 3 || counts["bigorigin"] != 7 || !resp.More {
		t.Fatalf("page %v more=%v", counts, resp.More)
	}
	// a page continues exactly where the caller's vector says
	resp, _ = n.serveOps(ctxT(), map[string]int64{"bigorigin": 7, "smallorigin": 3}, 10, "n_x", keyIDsOf(n), true)
	if len(resp.Ops) != 10 || resp.Ops[0].Seq != 8 {
		t.Fatalf("%d ops from seq %d", len(resp.Ops), resp.Ops[0].Seq)
	}
}
