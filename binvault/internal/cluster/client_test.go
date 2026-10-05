package cluster

import (
	"errors"
	"net/http"
	"net/http/httptest"
	"sync/atomic"
	"testing"
)

// Every peer call carries the cluster key in X-Binvault-Peer-Key, and Go copies
// custom headers along when it follows a redirect: to wherever Location points,
// another host included. A peer never answers with a redirect, so the peer client
// does not follow one; the 3xx is the answer, and the callers take any status
// but 200 for a failure.
func TestPeerClientDoesNotFollowRedirects(t *testing.T) {
	var reached atomic.Value // the key the redirect's target received, if it was asked at all
	var hits atomic.Int32
	other := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		hits.Add(1)
		reached.Store(r.Header.Get(HeaderPeerKey))
		w.WriteHeader(http.StatusOK)
	}))
	defer other.Close()
	peer := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, other.URL+"/anything", http.StatusFound)
	}))
	defer peer.Close()
	tn := newTestNode(t, spec{})

	// the client itself: the redirect is the response
	req, _ := http.NewRequest(http.MethodGet, peer.URL+PeerPrefix+"hello", nil)
	tn.node.AuthRequest(req)
	res, err := tn.node.Client().Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if res.StatusCode != http.StatusFound {
		t.Fatalf("the peer client answered %d for a redirect, want the 302 itself", res.StatusCode)
	}

	// and the callers of the peer API see a failure
	var se *statusError
	var out struct{}
	if _, err := tn.node.getJSON(ctxT(), peer.URL+PeerPrefix+"hello", 1<<10, &out); !errors.As(err, &se) || se.code != http.StatusFound {
		t.Fatalf("a JSON call that was redirected: %v, want a statusError for 302", err)
	}
	se = nil
	if err := tn.node.post(ctxT(), peer.URL+PeerPrefix+"nudge", nil); !errors.As(err, &se) || se.code != http.StatusFound {
		t.Fatalf("a nudge that was redirected: %v, want a statusError for 302", err)
	}

	if n := hits.Load(); n != 0 {
		k, _ := reached.Load().(string)
		t.Fatalf("the peer client followed a redirect to another host (%s, %d requests) and sent it X-Binvault-Peer-Key: %q", other.URL, n, k)
	}
}
