package app_test

import (
	"bytes"
	"encoding/json"
	"encoding/xml"
	"fmt"
	"io"
	"net/http"
	"os"
	"sort"
	"strings"
	"sync"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/cluster"
)

// ---- faults on the peer listener ------------------------------------------------------------------

// faultRule decides what a node's peer listener does with one call of the bucket-move
// protocol: n is how many calls of that kind there have been (1 for the first); it
// either answers itself or lets the call through with next.
type faultRule func(n int, w http.ResponseWriter, r *http.Request, next http.Handler)

// faults is a wrapper for the peer listener of one node (app.Options.PeerWrap): rules
// per verb of the move protocol — prepare, blob, part, rows, activate, discard — that
// delay, break or counterfeit the node's answers.
type faults struct {
	mu    sync.Mutex
	rules map[string]faultRule
	calls map[string]int
}

func newFaults() *faults { return &faults{rules: map[string]faultRule{}, calls: map[string]int{}} }

func (f *faults) set(verb string, r faultRule) {
	f.mu.Lock()
	defer f.mu.Unlock()
	if r == nil {
		delete(f.rules, verb)
		return
	}
	f.rules[verb] = r
}

func (f *faults) count(verb string) int {
	f.mu.Lock()
	defer f.mu.Unlock()
	return f.calls[verb]
}

func (f *faults) wrap(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		const prefix = "/_peer/v1/moves/"
		if !strings.HasPrefix(r.URL.Path, prefix) {
			next.ServeHTTP(w, r)
			return
		}
		parts := strings.Split(strings.TrimPrefix(r.URL.Path, prefix), "/")
		if len(parts) < 2 {
			next.ServeHTTP(w, r)
			return
		}
		verb := parts[1]
		f.mu.Lock()
		f.calls[verb]++
		n := f.calls[verb]
		rule := f.rules[verb]
		f.mu.Unlock()
		if rule == nil {
			next.ServeHTTP(w, r)
			return
		}
		rule(n, w, r, next)
	})
}

// faultGarbage answers like a proxy that has lost its upstream: HTTP 200 and an HTML page.
func faultGarbage(w http.ResponseWriter) {
	w.Header().Set("Content-Type", "text/html")
	w.WriteHeader(http.StatusOK)
	_, _ = io.WriteString(w, "<html><body>Bad gateway</body></html>")
}

// faultKill drops the connection without an answer.
func faultKill(w http.ResponseWriter) {
	conn, _, err := http.NewResponseController(w).Hijack()
	if err == nil {
		conn.Close()
	}
}

// ---- calling the peer API by hand ---------------------------------------------------------------

// peerCall sends a request to a node's peer listener with the cluster key, as another
// node would.
func (tc *tcluster) peerCall(n *cnode, method, path string, body any) (int, http.Header, []byte) {
	tc.t.Helper()
	var rd io.Reader
	switch b := body.(type) {
	case nil:
	case []byte:
		rd = bytes.NewReader(b)
	default:
		raw, _ := json.Marshal(b)
		rd = bytes.NewReader(raw)
	}
	req, err := http.NewRequest(method, n.peerURL+path, rd)
	if err != nil {
		tc.t.Fatal(err)
	}
	req.Header.Set(cluster.HeaderPeerKey, tc.key)
	if body != nil {
		req.Header.Set("Content-Type", "application/json")
	}
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		tc.t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	return res.StatusCode, res.Header, raw
}

// ---- listing a bucket ---------------------------------------------------------------------------

type vrec struct {
	Key, Version, ETag, Modified string
	Latest, Marker               bool
	Size                         int64
}

func (v vrec) String() string {
	return fmt.Sprintf("%s@%s etag=%s size=%d latest=%v marker=%v at=%s", v.Key, v.Version, v.ETag, v.Size, v.Latest, v.Marker, v.Modified)
}

// listVersions lists every version and delete marker of a bucket through node n.
func listVersions(t *testing.T, n *cnode, cr cred, bucket string) []vrec {
	t.Helper()
	r := n.must(cr, 200, "GET", "/"+bucket+"?versions&max-keys=1000", nil)
	var res struct {
		Versions []struct {
			Key, VersionId, ETag, LastModified string
			IsLatest                           bool
			Size                               int64
		} `xml:"Version"`
		Markers []struct {
			Key, VersionId, LastModified string
			IsLatest                     bool
		} `xml:"DeleteMarker"`
		Truncated bool `xml:"IsTruncated"`
	}
	if err := xml.Unmarshal(r.body, &res); err != nil {
		t.Fatalf("ListObjectVersions: %v: %s", err, r.body)
	}
	if res.Truncated {
		t.Fatal("the listing is truncated: raise max-keys")
	}
	var out []vrec
	for _, v := range res.Versions {
		out = append(out, vrec{Key: v.Key, Version: v.VersionId, ETag: v.ETag, Modified: v.LastModified, Latest: v.IsLatest, Size: v.Size})
	}
	for _, m := range res.Markers {
		out = append(out, vrec{Key: m.Key, Version: m.VersionId, Modified: m.LastModified, Latest: m.IsLatest, Marker: true})
	}
	sort.Slice(out, func(i, j int) bool {
		if out[i].Key != out[j].Key {
			return out[i].Key < out[j].Key
		}
		return out[i].Version < out[j].Version
	})
	return out
}

// listKeys lists the visible keys of a bucket (ListObjectsV2) through node n.
func listKeys(t *testing.T, n *cnode, cr cred, bucket string) []string {
	t.Helper()
	r := n.must(cr, 200, "GET", "/"+bucket+"?list-type=2&max-keys=1000", nil)
	var res struct {
		Contents []struct{ Key string } `xml:"Contents"`
	}
	if err := xml.Unmarshal(r.body, &res); err != nil {
		t.Fatalf("ListObjectsV2: %v", err)
	}
	var keys []string
	for _, c := range res.Contents {
		keys = append(keys, c.Key)
	}
	return keys
}

// moveRecords lists the move records a node holds, by role.
func moveRecords(t *testing.T, n *cnode, role string) []map[string]any {
	t.Helper()
	out := n.mustAdmin(200, "GET", "/moves?limit=500&role="+role, nil)
	return items(t, out)
}

func waitFor(t *testing.T, d time.Duration, what string, cond func() bool) {
	t.Helper()
	eventually(t, d, what, cond)
}

// adminHdr is admin that also returns the response headers.
func (cn *cnode) adminHdr(method, path string, body any) (int, map[string]any, http.Header) {
	cn.t.Helper()
	var rd io.Reader
	if body != nil {
		raw, _ := json.Marshal(body)
		rd = bytes.NewReader(raw)
	}
	req, _ := http.NewRequest(method, cn.adminURL+"/_admin/v1"+path, rd)
	req.Header.Set("Authorization", "Bearer "+cn.adminTok)
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		cn.t.Fatal(err)
	}
	defer res.Body.Close()
	raw, _ := io.ReadAll(res.Body)
	var out map[string]any
	_ = json.Unmarshal(raw, &out)
	return res.StatusCode, out, res.Header
}

// logMoves logs the lines of the nodes' logs about moves, drains and failures, when the test fails or
// MOVE_LOGS is set.
func (tc *tcluster) logMoves() {
	tc.t.Cleanup(func() {
		if !tc.t.Failed() && os.Getenv("MOVE_LOGS") == "" {
			return
		}
		for _, cn := range tc.nodes {
			if cn == nil || cn.logs == nil {
				continue
			}
			for _, l := range strings.Split(cn.logs.String(), "\n") {
				if strings.Contains(l, "move:") || strings.Contains(l, "drain:") || strings.Contains(l, "level=ERROR") || strings.Contains(l, "level=WARN") && !strings.Contains(l, "plain HTTP") {
					tc.t.Logf("[%s] %s", cn.name, l)
				}
			}
		}
	})
}

// noAlarms checks that no node reports an orphan, a missing bucket, a conflict or a held op.
func (tc *tcluster) noAlarms() {
	tc.t.Helper()
	for _, cn := range tc.nodes {
		cn := cn
		eventually(tc.t, 10*time.Second, cn.name+" to report no alarms", func() bool {
			_, out := cn.admin("GET", "/cluster", nil)
			al, _ := out["alarms"].(map[string]any)
			for _, k := range []string{"orphans", "missing", "conflicts", "held_ops", "clones", "mismatches"} {
				if l, _ := al[k].([]any); len(l) != 0 {
					return false
				}
			}
			return true
		})
	}
}
