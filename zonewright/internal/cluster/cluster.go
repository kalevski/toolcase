// Package cluster replicates the zonewright store between servers
// (REPLICATION.md §8). Every node is configured with the same URL list;
// each node generates its own id, finds itself in the list by asking every
// URL who it is, and pulls the deltas it has not seen from every other node.
package cluster

import (
	"bytes"
	"context"
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/kalevski/toolcase/zonewright/internal/config"
	"github.com/kalevski/toolcase/zonewright/internal/hlc"
	"github.com/kalevski/toolcase/zonewright/internal/manager"
	"github.com/kalevski/toolcase/zonewright/internal/store"
)

// Protocol limits.
const (
	batchLimit       = 1000
	maxOpsBody       = 32 << 20
	maxSnapshotBody  = 256 << 20
	requestTimeout   = 20 * time.Second
	minKeyLen        = 32
	compactEvery     = time.Hour
	headerNode       = "X-Zonewright-Node"
	maxPullsPerRound = 200
)

// URLState is what this node knows about one configured URL.
type URLState struct {
	URL      string    `json:"url"`
	NodeID   string    `json:"node_id,omitempty"`
	Self     bool      `json:"self"`
	Alarm    string    `json:"alarm,omitempty"`
	LastOK   time.Time `json:"last_ok,omitzero"`
	LastPull time.Time `json:"last_pull,omitzero"`
	Error    string    `json:"error,omitempty"`
	// Lag is how many ops the peer holds that this node has not applied.
	Lag       int64  `json:"lag"`
	ClockSkew string `json:"clock_skew,omitempty"`

	nonce string
	skew  time.Duration
}

// Node is this server's replication agent.
type Node struct {
	log    *slog.Logger
	mgr    *manager.Manager
	st     *store.Store
	cfg    *config.Cluster
	keys   [][]byte
	client *http.Client
	nonce  string
	now    func() time.Time

	ready atomic.Bool
	kick  chan struct{}

	mu      sync.Mutex
	urls    map[string]*URLState
	order   []string                    // configured URL order; guarded by mu
	acks    map[string]map[string]int64 // peer node id → its version vector
	ackWake chan struct{}               // closed and replaced on every ack
	retired map[string]bool
	urlIDs  map[string]string // last id seen per URL (persisted)
	held    int
	lastErr string
}

// New builds the node: loads the cluster keys and the TLS client.
func New(cfg *config.Cluster, mgr *manager.Manager, log *slog.Logger) (*Node, error) {
	type ref struct{ env, file string }
	var refs []ref
	if cfg.KeyEnv != "" {
		refs = append(refs, ref{env: cfg.KeyEnv})
	}
	for _, f := range cfg.Keys() {
		refs = append(refs, ref{file: f})
	}
	var keys [][]byte
	for _, r := range refs {
		v, err := config.ResolveSecret(r.env, r.file)
		if err != nil {
			return nil, fmt.Errorf("cluster key: %w", err)
		}
		if len(v) < minKeyLen {
			return nil, fmt.Errorf("cluster key %s%s is %d bytes; need at least %d random bytes (e.g. openssl rand -hex 32)", r.env, r.file, len(v), minKeyLen)
		}
		keys = append(keys, []byte(v))
	}
	tlsCfg, err := clientTLS(cfg)
	if err != nil {
		return nil, err
	}
	b := make([]byte, 12)
	if _, err := rand.Read(b); err != nil {
		return nil, err
	}
	n := &Node{
		log: log, mgr: mgr, st: mgr.Store(), cfg: cfg, keys: keys, nonce: hex.EncodeToString(b), now: time.Now,
		client:  &http.Client{Timeout: requestTimeout, Transport: &http.Transport{TLSClientConfig: tlsCfg, MaxIdleConnsPerHost: 4}},
		kick:    make(chan struct{}, 1),
		urls:    map[string]*URLState{},
		acks:    map[string]map[string]int64{},
		ackWake: make(chan struct{}),
		retired: map[string]bool{},
		urlIDs:  map[string]string{},
	}
	n.order = append([]string(nil), cfg.URLs...)
	for _, u := range cfg.URLs {
		n.urls[u] = &URLState{URL: u}
	}
	loadJSONMeta(n.st, "cluster_retired", &n.retired)
	loadJSONMeta(n.st, "cluster_url_ids", &n.urlIDs)
	mgr.SetClusterHooks(n.onLocalWrite, n.ready.Load)
	return n, nil
}

func clientTLS(cfg *config.Cluster) (*tls.Config, error) {
	t := &tls.Config{MinVersion: tls.VersionTLS12}
	switch {
	case cfg.Fingerprint != "":
		want := cfg.Fingerprint
		// Pinning replaces chain verification: the peer is trusted iff its
		// leaf certificate hashes to the configured fingerprint.
		t.InsecureSkipVerify = true
		t.VerifyConnection = func(cs tls.ConnectionState) error {
			if len(cs.PeerCertificates) == 0 {
				return errors.New("peer presented no certificate")
			}
			sum := sha256.Sum256(cs.PeerCertificates[0].Raw)
			if subtle.ConstantTimeCompare([]byte(hex.EncodeToString(sum[:])), []byte(want)) != 1 {
				return errors.New("peer certificate does not match the pinned fingerprint")
			}
			return nil
		}
	case cfg.CAFile != "":
		pem, err := os.ReadFile(cfg.CAFile)
		if err != nil {
			return nil, fmt.Errorf("cluster ca_file: %w", err)
		}
		pool := x509.NewCertPool()
		if !pool.AppendCertsFromPEM(pem) {
			return nil, fmt.Errorf("cluster ca_file %s: no certificates found", cfg.CAFile)
		}
		t.RootCAs = pool
	}
	return t, nil
}

// Ready reports whether the startup fence has passed.
func (n *Node) Ready() bool { return n.ready.Load() }

// Run performs the startup fence, then replicates until ctx is cancelled.
func (n *Node) Run(ctx context.Context) {
	n.fence(ctx)
	pull := time.NewTicker(n.cfg.PullInterval.Duration())
	defer pull.Stop()
	compact := time.NewTicker(compactEvery)
	defer compact.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-pull.C:
			n.round(ctx)
		case <-n.kick:
			n.round(ctx)
		case <-compact.C:
			n.compact()
		}
	}
}

// fence holds local writes until every URL has been reached once (or the
// fence times out): a node restored from an old backup first pulls back its
// own ops, so it never reuses a sequence number (§8.4).
func (n *Node) fence(ctx context.Context) {
	deadline := n.now().Add(n.cfg.StartupFence.Duration())
	for {
		n.round(ctx)
		if n.allReached() {
			n.log.Info("cluster startup fence passed", "node_id", n.st.NodeID())
			break
		}
		if n.now().After(deadline) || ctx.Err() != nil {
			n.log.Warn("cluster startup fence timed out; accepting writes without hearing from every server", "node_id", n.st.NodeID())
			break
		}
		select {
		case <-ctx.Done():
		case <-time.After(time.Second):
		}
	}
	n.ready.Store(true)
}

func (n *Node) allReached() bool {
	n.mu.Lock()
	defer n.mu.Unlock()
	for _, u := range n.urls {
		if u.Self || u.Alarm != "" {
			continue
		}
		if u.LastPull.IsZero() {
			return false
		}
	}
	return true
}

// round: discover who is behind every URL, then pull from every peer.
func (n *Node) round(ctx context.Context) {
	n.discover(ctx)
	for _, u := range n.peers() {
		if err := n.pullFrom(ctx, u); err != nil {
			n.setURL(u, func(s *URLState) { s.Error = err.Error() })
			n.log.Debug("pull failed", "url", u, "error", err)
		}
	}
}

type helloResponse struct {
	NodeID    string           `json:"node_id"`
	BootNonce string           `json:"boot_nonce"`
	VV        map[string]int64 `json:"vv"`
	Time      time.Time        `json:"time"`
}

// discover calls /peer/hello on every URL concurrently and classifies them.
func (n *Node) discover(ctx context.Context) {
	n.mu.Lock()
	urls := append([]string(nil), n.order...)
	n.mu.Unlock()
	var wg sync.WaitGroup
	results := make(map[string]*helloResponse, len(urls))
	errs := make(map[string]error, len(urls))
	var rmu sync.Mutex
	for _, u := range urls {
		wg.Add(1)
		go func(u string) {
			defer wg.Done()
			var h helloResponse
			err := n.get(ctx, u+"/peer/hello", 1<<16, &h)
			rmu.Lock()
			defer rmu.Unlock()
			if err != nil {
				errs[u] = err
			} else {
				results[u] = &h
			}
		}(u)
	}
	wg.Wait()

	self := n.st.NodeID()
	n.mu.Lock()
	defer n.mu.Unlock()
	nonces := map[string]map[string]bool{} // id → set of nonces seen this round
	for _, h := range results {
		if nonces[h.NodeID] == nil {
			nonces[h.NodeID] = map[string]bool{}
		}
		nonces[h.NodeID][h.BootNonce] = true
	}
	changedIDs := false
	for _, u := range urls {
		s := n.urls[u]
		if s == nil {
			continue // removed by a concurrent SetURLs
		}
		if err := errs[u]; err != nil {
			s.Error = err.Error()
			continue
		}
		h := results[u]
		s.Error, s.LastOK, s.NodeID, s.nonce, s.Alarm, s.Self = "", n.now(), h.NodeID, h.BootNonce, "", false
		s.skew = h.Time.Sub(n.now())
		s.ClockSkew = s.skew.Round(time.Millisecond).String()
		switch {
		case h.NodeID == self && h.BootNonce == n.nonce:
			s.Self = true
		case h.NodeID == self:
			s.Alarm = "clone detected: this server answers with OUR node id — its data dir was copied from ours. Remove its data dir so it generates a new id; sync with it is refused."
		case len(nonces[h.NodeID]) > 1:
			s.Alarm = "duplicate node id " + h.NodeID + " behind several URLs with different processes (a copied data dir); sync with them is refused."
		}
		if prev := n.urlIDs[u]; prev != h.NodeID {
			if prev != "" && prev != self && !n.retired[prev] {
				n.retired[prev] = true
				n.log.Info("server behind URL was redeployed; retiring its old id", "url", u, "old_id", prev, "new_id", h.NodeID)
				saveJSONMeta(n.st, "cluster_retired", n.retired)
			}
			n.urlIDs[u] = h.NodeID
			changedIDs = true
		}
		if abs(s.skew) > n.cfg.MaxClockSkew.Duration() {
			n.log.Warn("peer clock skew exceeds max_clock_skew; its future ops will be held", "url", u, "skew", s.ClockSkew)
		}
	}
	if changedIDs {
		saveJSONMeta(n.st, "cluster_url_ids", n.urlIDs)
	}
}

// peers returns one URL per distinct healthy peer id.
func (n *Node) peers() []string {
	n.mu.Lock()
	defer n.mu.Unlock()
	seen := map[string]bool{}
	var out []string
	for _, u := range n.order {
		s := n.urls[u]
		if s.NodeID == "" || s.Self || s.Alarm != "" || s.Error != "" || seen[s.NodeID] {
			continue
		}
		seen[s.NodeID] = true
		out = append(out, u)
	}
	return out
}

type opsResponse struct {
	Ops              []store.Op       `json:"ops"`
	More             bool             `json:"more"`
	VV               map[string]int64 `json:"vv"`
	SnapshotRequired bool             `json:"snapshot_required,omitempty"`
}

// pullFrom pulls until the peer has nothing new. The final (empty) request
// carries our updated version vector, which is the peer's acknowledgement
// that we hold its ops — what ?wait=replicated waits for.
func (n *Node) pullFrom(ctx context.Context, u string) error {
	for i := 0; i < maxPullsPerRound; i++ {
		vv, err := n.st.VV()
		if err != nil {
			return err
		}
		var resp opsResponse
		err = n.get(ctx, u+"/peer/ops?since="+encodeVV(vv), maxOpsBody, &resp)
		var se *statusError
		if errors.As(err, &se) && se.code == http.StatusConflict {
			if err := n.snapshotFrom(ctx, u); err != nil {
				return fmt.Errorf("snapshot: %w", err)
			}
			continue
		}
		if err != nil {
			return err
		}
		var lag int64
		for o, sq := range resp.VV {
			if d := sq - vv[o]; d > 0 {
				lag += d
			}
		}
		n.setURL(u, func(s *URLState) { s.Lag, s.LastPull, s.Error = lag, n.now(), "" })
		if len(resp.Ops) == 0 {
			return nil
		}
		res, err := n.mgr.ApplyRemote(ctx, resp.Ops, n.cfg.MaxClockSkew.Duration())
		if err != nil {
			n.setErr(err.Error())
			return err
		}
		n.mu.Lock()
		n.held = res.Held
		n.mu.Unlock()
		if res.Applied > 0 {
			n.log.Info("replicated ops applied", "from", u, "ops", res.Applied, "zones", strings.Join(res.Touched, ","))
		}
		if res.Applied == 0 && !resp.More {
			return nil // nothing applicable (held ops): stop until next round
		}
	}
	return nil
}

func (n *Node) snapshotFrom(ctx context.Context, u string) error {
	var snap store.Snapshot
	if err := n.get(ctx, u+"/peer/snapshot", maxSnapshotBody, &snap); err != nil {
		return err
	}
	n.log.Info("merging snapshot (ops needed were already compacted)", "from", u, "zones", len(snap.Zones))
	return n.mgr.MergeSnapshot(ctx, &snap)
}

// onLocalWrite nudges every peer to pull right away.
func (n *Node) onLocalWrite(_ []store.Op) {
	for _, u := range n.peers() {
		go func(u string) {
			ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			defer cancel()
			req, _ := http.NewRequestWithContext(ctx, http.MethodPost, u+"/peer/notify", nil)
			n.auth(req)
			if resp, err := n.client.Do(req); err == nil {
				resp.Body.Close()
			}
		}(u)
	}
}

// WaitReplicated blocks until every active peer has acknowledged ops, or
// until timeout. It returns the URLs still pending.
func (n *Node) WaitReplicated(ctx context.Context, ops []store.Op, timeout time.Duration) []string {
	if len(ops) == 0 {
		return nil
	}
	last := ops[len(ops)-1]
	ctx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()
	for {
		n.mu.Lock()
		var pending []string
		for _, u := range n.order {
			s := n.urls[u]
			if s.Self || s.Alarm != "" || n.retired[s.NodeID] {
				continue
			}
			if s.NodeID == "" || n.acks[s.NodeID][last.Origin] < last.Seq {
				pending = append(pending, u)
			}
		}
		wake := n.ackWake
		n.mu.Unlock()
		if len(pending) == 0 {
			return nil
		}
		select {
		case <-ctx.Done():
			return pending
		case <-wake:
		}
	}
}

// Retire forgets a node id for good (its URL was removed from the list).
func (n *Node) Retire(id string) error {
	if id == n.st.NodeID() {
		return errors.New("cannot retire this node itself")
	}
	n.mu.Lock()
	defer n.mu.Unlock()
	n.retired[id] = true
	delete(n.acks, id)
	saveJSONMeta(n.st, "cluster_retired", n.retired)
	return nil
}

// compact deletes ops older than retention that every active peer holds.
func (n *Node) compact() {
	n.mu.Lock()
	var active []string
	for _, u := range n.order {
		s := n.urls[u]
		id := s.NodeID
		if id == "" {
			id = n.urlIDs[u]
		}
		if id == "" {
			n.mu.Unlock()
			n.log.Warn("compaction skipped: a configured URL has never answered", "url", u)
			return
		}
		if s.Self || id == n.st.NodeID() || n.retired[id] || s.Alarm != "" {
			continue
		}
		active = append(active, id)
	}
	vv, err := n.st.VV()
	if err != nil {
		n.mu.Unlock()
		return
	}
	safe := map[string]int64{}
	for o, sq := range vv {
		safe[o] = sq
		for _, id := range active {
			safe[o] = min(safe[o], n.acks[id][o])
		}
	}
	n.mu.Unlock()
	cutoff := hlc.FromTime(n.now().Add(-n.cfg.Retention.Duration()))
	deleted, err := n.st.Compact(cutoff, safe)
	if err != nil {
		n.log.Error("compaction failed", "error", err)
		return
	}
	if deleted > 0 {
		n.log.Info("compacted op log", "deleted_ops", deleted)
	}
}

// Status is GET /cluster/status.
type Status struct {
	NodeID    string             `json:"node_id"`
	Ready     bool               `json:"ready"`
	URLs      []URLState         `json:"urls"`
	Retired   []string           `json:"retired,omitempty"`
	HeldOps   int                `json:"held_ops"`
	Conflicts []manager.Conflict `json:"conflicts"`
	Log       store.Stats        `json:"log"`
	VV        map[string]int64   `json:"vv"`
	LastError string             `json:"last_error,omitempty"`
}

// ClusterStatus is Status for the admin API.
func (n *Node) ClusterStatus() any { return n.Status() }

// SetURLs replaces the server list (SIGHUP). URLs keep their known state;
// removed ones are forgotten (retire their id with DELETE /cluster/peers/{id}
// once the server is gone for good).
func (n *Node) SetURLs(urls []string) {
	n.mu.Lock()
	defer n.mu.Unlock()
	next := map[string]*URLState{}
	for _, u := range urls {
		if s, ok := n.urls[u]; ok {
			next[u] = s
		} else {
			next[u] = &URLState{URL: u}
		}
	}
	n.urls = next
	n.order = append([]string(nil), urls...)
}

// Status snapshots the cluster view.
func (n *Node) Status() Status {
	vv, _ := n.st.VV()
	n.mu.Lock()
	defer n.mu.Unlock()
	st := Status{NodeID: n.st.NodeID(), Ready: n.ready.Load(), HeldOps: n.held, Log: n.st.Stats(), VV: vv, LastError: n.lastErr}
	for _, u := range n.order {
		st.URLs = append(st.URLs, *n.urls[u])
	}
	for id := range n.retired {
		st.Retired = append(st.Retired, id)
	}
	sort.Strings(st.Retired)
	st.Conflicts = n.mgr.Conflicts()
	if st.Conflicts == nil {
		st.Conflicts = []manager.Conflict{}
	}
	return st
}

// ─── peer server ──────────────────────────────────────────────────────────

// Handler serves the peer API. Every route requires the cluster key.
func (n *Node) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /peer/hello", n.handleHello)
	mux.HandleFunc("GET /peer/ops", n.handleOps)
	mux.HandleFunc("GET /peer/snapshot", n.handleSnapshot)
	mux.HandleFunc("POST /peer/notify", n.handleNotify)
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !n.checkKey(r.Header.Get("Authorization")) {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		mux.ServeHTTP(w, r)
	})
}

func (n *Node) checkKey(header string) bool {
	got, ok := strings.CutPrefix(header, "Bearer ")
	if !ok {
		return false
	}
	match := 0
	for _, k := range n.keys {
		match |= subtle.ConstantTimeCompare([]byte(got), k)
	}
	return match == 1
}

func (n *Node) handleHello(w http.ResponseWriter, _ *http.Request) {
	vv, _ := n.st.VV()
	writeJSON(w, http.StatusOK, helloResponse{NodeID: n.st.NodeID(), BootNonce: n.nonce, VV: vv, Time: n.now().UTC()})
}

func (n *Node) handleOps(w http.ResponseWriter, r *http.Request) {
	since, err := decodeVV(r.URL.Query().Get("since"))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		return
	}
	if peer := r.Header.Get(headerNode); peer != "" && peer != n.st.NodeID() && len(peer) <= 64 {
		n.mu.Lock()
		n.acks[peer] = since
		close(n.ackWake)
		n.ackWake = make(chan struct{})
		n.mu.Unlock()
	}
	ops, more, err := n.st.OpsSince(since, batchLimit)
	if errors.Is(err, store.ErrSnapshotRequired) {
		writeJSON(w, http.StatusConflict, opsResponse{SnapshotRequired: true})
		return
	}
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	vv, _ := n.st.VV()
	if ops == nil {
		ops = []store.Op{}
	}
	writeJSON(w, http.StatusOK, opsResponse{Ops: ops, More: more, VV: vv})
}

func (n *Node) handleSnapshot(w http.ResponseWriter, _ *http.Request) {
	snap, err := n.st.Snapshot()
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, map[string]string{"error": err.Error()})
		return
	}
	writeJSON(w, http.StatusOK, snap)
}

func (n *Node) handleNotify(w http.ResponseWriter, _ *http.Request) {
	select {
	case n.kick <- struct{}{}:
	default:
	}
	w.WriteHeader(http.StatusNoContent)
}

// Serve runs the peer listener until ctx is cancelled.
func (n *Node) Serve(ctx context.Context) error {
	srv := &http.Server{
		Addr: n.cfg.Listen, Handler: n.Handler(),
		ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 30 * time.Second,
		WriteTimeout: 2 * time.Minute, IdleTimeout: 2 * time.Minute, MaxHeaderBytes: 64 << 10,
	}
	errCh := make(chan error, 1)
	go func() {
		if n.cfg.TLS.Enabled() {
			errCh <- srv.ListenAndServeTLS(n.cfg.TLS.CertFile, n.cfg.TLS.KeyFile)
		} else {
			if n.cfg.AllowInsecureHTTP {
				n.log.Warn("cluster peer listener is plain HTTP (allow_insecure_http): the cluster key travels readable", "listen", n.cfg.Listen)
			}
			errCh <- srv.ListenAndServe()
		}
	}()
	n.log.Info("cluster peer listener started", "listen", n.cfg.Listen, "tls", n.cfg.TLS.Enabled(), "node_id", n.st.NodeID())
	select {
	case <-ctx.Done():
		sctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		_ = srv.Shutdown(sctx)
		return nil
	case err := <-errCh:
		if errors.Is(err, http.ErrServerClosed) {
			return nil
		}
		return err
	}
}

// ─── helpers ──────────────────────────────────────────────────────────────

type statusError struct {
	code int
	body string
}

func (e *statusError) Error() string { return fmt.Sprintf("HTTP %d: %s", e.code, e.body) }

func (n *Node) auth(req *http.Request) {
	req.Header.Set("Authorization", "Bearer "+string(n.keys[0]))
	req.Header.Set(headerNode, n.st.NodeID())
}

func (n *Node) get(ctx context.Context, url string, limit int64, out any) error {
	ctx, cancel := context.WithTimeout(ctx, requestTimeout)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	n.auth(req)
	resp, err := n.client.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, limit+1))
	if err != nil {
		return err
	}
	if int64(len(body)) > limit {
		return fmt.Errorf("response from %s exceeds %d bytes", url, limit)
	}
	if resp.StatusCode != http.StatusOK {
		return &statusError{resp.StatusCode, strings.TrimSpace(string(body))}
	}
	return json.NewDecoder(bytes.NewReader(body)).Decode(out)
}

func (n *Node) setURL(u string, fn func(*URLState)) {
	n.mu.Lock()
	defer n.mu.Unlock()
	if s := n.urls[u]; s != nil {
		fn(s)
	}
}

func (n *Node) setErr(msg string) {
	n.mu.Lock()
	defer n.mu.Unlock()
	n.lastErr = msg
}

func encodeVV(vv map[string]int64) string {
	parts := make([]string, 0, len(vv))
	for o, s := range vv {
		parts = append(parts, o+":"+strconv.FormatInt(s, 10))
	}
	sort.Strings(parts)
	return strings.Join(parts, ",")
}

func decodeVV(s string) (map[string]int64, error) {
	out := map[string]int64{}
	if s == "" {
		return out, nil
	}
	parts := strings.Split(s, ",")
	if len(parts) > 1000 {
		return nil, errors.New("since: too many origins")
	}
	for _, p := range parts {
		o, n, ok := strings.Cut(p, ":")
		v, err := strconv.ParseInt(n, 10, 64)
		if !ok || err != nil || o == "" || len(o) > 64 || v < 0 {
			return nil, fmt.Errorf("since: bad entry %q", p)
		}
		out[o] = v
	}
	return out, nil
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func loadJSONMeta(st *store.Store, key string, out any) {
	if raw, _ := st.GetMeta(key); raw != "" {
		_ = json.Unmarshal([]byte(raw), out)
	}
}

func saveJSONMeta(st *store.Store, key string, v any) {
	raw, _ := json.Marshal(v)
	_ = st.SetMeta(key, string(raw))
}

func abs(d time.Duration) time.Duration {
	if d < 0 {
		return -d
	}
	return d
}
