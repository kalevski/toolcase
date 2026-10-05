package cluster

import (
	"bufio"
	"context"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"sort"
	"strconv"
	"strings"
	"sync"

	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

// Limits of the peer API.
const (
	maxOpsBody      = 64 << 20
	maxPageBytes    = 8 << 20
	maxSinceOrigins = 1000
	maxAckEntries   = 64
)

// Mux is the router of the peer listener (spec §8.4, §8.5). It serves, with a
// valid cluster key only:
//
//   - a request carrying X-Binvault-Origin: a forwarded client request, whatever
//     its path (in virtual-hosted style a key may begin with "_peer/"); it goes
//     to the Forward handler;
//   - /_peer/v1/…: the peer API (hello, ops, notify, snapshot, buckets/{name}) and
//     whatever was added with RegisterPeer (the admin calls of §8.6, the move
//     protocol of §8.8);
//   - nothing else: 404.
//
// A request without a valid key is answered 401 whatever its path.
type Mux struct {
	n *Node

	mu      sync.RWMutex
	exact   map[string]http.Handler
	prefix  []prefixRoute
	forward http.Handler
}

type prefixRoute struct {
	prefix string
	h      http.Handler
}

func newMux(n *Node) *Mux { return &Mux{n: n, exact: map[string]http.Handler{}} }

// reservedPeerPaths are served by the node itself.
var reservedPeerPaths = []string{"hello", "ops", "notify", "snapshot", "buckets/"}

// RegisterPeer adds a handler for a path of the peer API. A path ending in "/"
// is a subtree (for example "/_peer/v1/moves/"), any other path matches exactly
// (for example "/_peer/v1/admin"). The mux has already checked the cluster key
// and that the request is not a forwarded one when the handler runs. It panics on
// a path outside /_peer/v1/ or one the node serves itself.
func (m *Mux) RegisterPeer(path string, h http.Handler) {
	if !strings.HasPrefix(path, PeerPrefix) || len(path) == len(PeerPrefix) || h == nil {
		panic("cluster: peer paths start with " + PeerPrefix + ": " + path)
	}
	rest := path[len(PeerPrefix):]
	for _, r := range reservedPeerPaths {
		if rest == r || strings.HasPrefix(rest, r) && strings.HasSuffix(r, "/") {
			panic("cluster: " + path + " is served by the cluster package itself")
		}
	}
	m.mu.Lock()
	defer m.mu.Unlock()
	if strings.HasSuffix(path, "/") {
		m.prefix = append(m.prefix, prefixRoute{path, h})
		sort.Slice(m.prefix, func(i, j int) bool { return len(m.prefix[i].prefix) > len(m.prefix[j].prefix) })
		return
	}
	if _, dup := m.exact[path]; dup {
		panic("cluster: peer path registered twice: " + path)
	}
	m.exact[path] = h
}

// SetForward sets the handler for forwarded S3 requests (§8.4): a request with
// a valid cluster key and an X-Binvault-Origin header. Until it is set such a
// request is answered 503.
func (m *Mux) SetForward(h http.Handler) {
	m.mu.Lock()
	m.forward = h
	m.mu.Unlock()
}

// ServeHTTP implements http.Handler.
func (m *Mux) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	n := m.n
	if !n.checkPeerKey(r.Header.Get(HeaderPeerKey)) {
		writeError(w, http.StatusUnauthorized, "unauthorized", "a valid "+HeaderPeerKey+" is required")
		return
	}
	// forwarded means marked, not named
	if _, forwarded := r.Header[HeaderOrigin]; forwarded {
		m.mu.RLock()
		h := m.forward
		m.mu.RUnlock()
		if h == nil {
			writeError(w, http.StatusServiceUnavailable, "unavailable", "this node does not accept forwarded requests")
			return
		}
		h.ServeHTTP(w, r)
		return
	}
	path := r.URL.Path
	if !strings.HasPrefix(path, PeerPrefix) {
		writeError(w, http.StatusNotFound, "not_found", "")
		return
	}
	switch rest := path[len(PeerPrefix):]; {
	case rest == "hello":
		n.handleHello(w, r)
		return
	case rest == "ops":
		n.handleOps(w, r)
		return
	case rest == "notify":
		n.handleNotify(w, r)
		return
	case rest == "snapshot":
		n.handleSnapshot(w, r)
		return
	case strings.HasPrefix(rest, "buckets/"):
		n.handleBucket(w, r, rest[len("buckets/"):])
		return
	}
	m.mu.RLock()
	h := m.exact[path]
	if h == nil {
		for _, p := range m.prefix {
			if strings.HasPrefix(path, p.prefix) {
				h = p.h
				break
			}
		}
	}
	m.mu.RUnlock()
	if h == nil {
		writeError(w, http.StatusNotFound, "not_found", "")
		return
	}
	h.ServeHTTP(w, r)
}

// CheckPeerKey reports whether a header value is one of the accepted cluster
// keys (constant time).
func (n *Node) CheckPeerKey(got string) bool { return n.checkPeerKey(got) }

func (n *Node) checkPeerKey(got string) bool {
	h := sha256.Sum256([]byte(got))
	ok := 0
	for i := range n.keyHash {
		ok |= subtle.ConstantTimeCompare(h[:], n.keyHash[i][:])
	}
	return ok == 1
}

func writeJSON(w http.ResponseWriter, code int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(code)
	_ = json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, code int, err, detail string) {
	body := map[string]string{"error": err}
	if detail != "" {
		body["detail"] = detail
	}
	writeJSON(w, code, body)
}

func methodOnly(w http.ResponseWriter, r *http.Request, method string) bool {
	if r.Method == method {
		return true
	}
	w.Header().Set("Allow", method)
	writeError(w, http.StatusMethodNotAllowed, "method_not_allowed", "")
	return false
}

// callerID is the node id a peer request announces (HeaderNode), "" if it is
// missing or not a node id.
func callerID(r *http.Request) string {
	id := r.Header.Get(HeaderNode)
	if !nodeIDRe.MatchString(id) {
		return ""
	}
	return id
}

// ---- hello -----------------------------------------------------------------------

func (n *Node) handleHello(w http.ResponseWriter, r *http.Request) {
	if !methodOnly(w, r, http.MethodGet) {
		return
	}
	n.noteInbound(callerID(r))
	writeJSON(w, http.StatusOK, n.hello(r.Context()))
}

// ---- ops -------------------------------------------------------------------------

type opsResponse struct {
	Ops  []Op             `json:"ops"`
	More bool             `json:"more"`
	VV   map[string]int64 `json:"vv"`
	// Held lists the ops withheld from this caller because it cannot open the
	// master key that sealed them (§4.7).
	Held []HeldOp `json:"held,omitempty"`
	// SnapshotRequired: the ops the caller needs were compacted away.
	SnapshotRequired bool `json:"snapshot_required,omitempty"`
}

var errSnapshotRequired = errors.New("cluster: the requested ops were compacted away")

func (n *Node) handleOps(w http.ResponseWriter, r *http.Request) {
	if !methodOnly(w, r, http.MethodGet) {
		return
	}
	q := r.URL.Query()
	since, err := decodeVV(q.Get("since"))
	if err != nil {
		writeError(w, http.StatusBadRequest, "invalid_request", err.Error())
		return
	}
	limit := n.tune.PageOps
	if v := q.Get("limit"); v != "" {
		l, err := strconv.Atoi(v)
		if err != nil || l < 1 {
			writeError(w, http.StatusBadRequest, "invalid_request", "limit: a positive number")
			return
		}
		limit = min(l, n.tune.PageOps)
	}
	caller := callerID(r)
	n.noteInbound(caller)
	if caller != "" && caller != n.id {
		// the caller's version vector is its acknowledgement of everything in it
		n.recordAck(caller, since)
	}
	keys, haveKeys := parseKeyIDs(r.Header)
	if !haveKeys {
		keys, haveKeys = n.lastKeyIDs(caller)
	}
	resp, err := n.serveOps(r.Context(), since, limit, caller, keys, haveKeys)
	if errors.Is(err, errSnapshotRequired) {
		writeJSON(w, http.StatusConflict, opsResponse{SnapshotRequired: true})
		return
	}
	if err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	}
	writeJSON(w, http.StatusOK, resp)
}

// lastKeyIDs falls back to the key ids a peer announced in its last hello.
func (n *Node) lastKeyIDs(caller string) (map[seal.KeyID]bool, bool) {
	if caller == "" {
		return nil, false
	}
	n.mu.Lock()
	defer n.mu.Unlock()
	for _, u := range n.urls {
		s := n.us[u]
		if s.id != caller || s.hello == nil {
			continue
		}
		ids := map[seal.KeyID]bool{}
		for _, k := range s.hello.KeyIDs {
			if id, err := seal.ParseKeyID(k); err == nil {
				ids[id] = true
			}
		}
		return ids, true
	}
	return nil, false
}

// recordAck remembers the version vector a peer pulled with, and wakes the
// waiters of WaitReplicated.
func (n *Node) recordAck(id string, vv map[string]int64) {
	n.mu.Lock()
	defer n.mu.Unlock()
	if _, ok := n.acks[id]; !ok && len(n.acks) >= maxAckEntries {
		return
	}
	n.acks[id] = vv
	n.wakeAcksLocked()
}

// serveOps returns the ops beyond since, from every origin this node holds, at
// most limit of them and maxPageBytes of payload, in a consistent read of the
// log. The origins that are behind share the page fairly, so an origin whose
// stream the caller cannot apply (a future-stamped op it holds) never starves
// the others. An op sealed under a master key the caller cannot open stops that
// origin's stream at that op (held, not skipped).
func (n *Node) serveOps(ctx context.Context, since map[string]int64, limit int, caller string, keys map[seal.KeyID]bool, haveKeys bool) (opsResponse, error) {
	resp := opsResponse{Ops: []Op{}}
	held := map[string]HeldOp{}
	err := n.db.ReadSnapshot(ctx, func(q meta.Q) error {
		vv, err := q.CatalogVV(ctx)
		if err != nil {
			return err
		}
		floors, err := q.CatalogFloors(ctx)
		if err != nil {
			return err
		}
		resp.VV = vv
		var behind []string
		for o, top := range vv {
			if top > since[o] {
				behind = append(behind, o)
			}
		}
		sort.Strings(behind)
		for _, o := range behind {
			if since[o] < floors[o] {
				return errSnapshotRequired
			}
		}
		if len(behind) == 0 {
			return nil
		}
		cursor := make(map[string]int64, len(behind))
		for _, o := range behind {
			cursor[o] = since[o]
		}
		stuck := map[string]bool{}
		share := max(1, limit/len(behind))
		total, size := 0, 0
		full := func() bool { return total >= limit || size >= maxPageBytes }
		for pass := 0; pass < 2 && !full(); pass++ {
			for _, o := range behind {
				if stuck[o] || cursor[o] >= vv[o] || full() {
					continue
				}
				want := min(share, limit-total)
				if pass == 1 {
					want = limit - total
				}
				rows, err := q.CatalogOpRange(ctx, o, cursor[o], want)
				if err != nil {
					return err
				}
				for _, row := range rows {
					op := opFromMeta(row)
					if why := n.withhold(&op, keys, haveKeys); why != "" {
						stuck[o] = true
						held[o] = HeldOp{
							Op: op.ID(), Origin: op.Origin, Seq: op.Seq, Register: op.Reg(), Reason: "sealed", Detail: why,
							Direction: "out", Peer: caller, Since: n.now(),
						}
						break
					}
					resp.Ops = append(resp.Ops, op)
					cursor[o] = op.Seq
					total++
					size += len(op.Payload) + 128
					if full() {
						break
					}
				}
			}
		}
		for _, o := range behind {
			if !stuck[o] && cursor[o] < vv[o] {
				resp.More = true
			}
		}
		return nil
	})
	if err != nil {
		return opsResponse{}, err
	}
	n.noteHeldOut(caller, held)
	for _, h := range held {
		resp.Held = append(resp.Held, h)
	}
	return resp, nil
}

// withhold says why an op must not be sent to a caller ("" to send it): it is
// sealed under a master key the caller did not announce (§4.7, §8.3). A caller
// that announced nothing is assumed to open nothing.
func (n *Node) withhold(op *Op, keys map[seal.KeyID]bool, haveKeys bool) string {
	ids, err := sealedKeyIDs(op.Kind, op.Payload)
	if err != nil {
		return err.Error()
	}
	for _, id := range ids {
		if !haveKeys || !keys[id] {
			return fmt.Sprintf("sealed under master key %s, which the receiving node has not announced", id)
		}
	}
	return ""
}

// noteHeldOut replaces what is withheld from one caller with what this response
// withheld.
func (n *Node) noteHeldOut(caller string, held map[string]HeldOp) {
	n.mu.Lock()
	defer n.mu.Unlock()
	old := n.heldOut[caller]
	for o, h := range held {
		if prev, ok := old[o]; ok && prev.Op == h.Op {
			h.Since = prev.Since
			held[o] = h
		} else {
			n.log.Warn("a catalog op is withheld from a peer that cannot open its sealed values", "op", h.Op, "peer", caller, "detail", h.Detail)
		}
	}
	if len(held) == 0 {
		delete(n.heldOut, caller)
		return
	}
	n.heldOut[caller] = held
}

// ---- notify, buckets, snapshot ------------------------------------------------------

func (n *Node) handleNotify(w http.ResponseWriter, r *http.Request) {
	if !methodOnly(w, r, http.MethodPost) {
		return
	}
	caller := callerID(r)
	if r.Header.Get(HeaderHello) != "" {
		n.refreshPeer(caller)
	} else {
		n.noteInbound(caller)
	}
	n.kickPull(caller)
	w.WriteHeader(http.StatusNoContent)
}

// bucketAnswer is the answer to GET /_peer/v1/buckets/{name}.
type bucketAnswer struct {
	Name       string `json:"name"`
	Exists     bool   `json:"exists"`
	Home       string `json:"home,omitempty"`
	Epoch      int64  `json:"epoch,omitempty"`
	Generation string `json:"generation,omitempty"`
}

func (n *Node) handleBucket(w http.ResponseWriter, r *http.Request, name string) {
	if !methodOnly(w, r, http.MethodGet) {
		return
	}
	if !ValidBucketName(name) {
		writeError(w, http.StatusBadRequest, "invalid_request", "bucket name")
		return
	}
	a := bucketAnswer{Name: name}
	if rec, ok := n.Bucket(name); ok {
		a.Exists, a.Home, a.Epoch, a.Generation = true, rec.Home, rec.Epoch, rec.Generation
	}
	writeJSON(w, http.StatusOK, a)
}

// handleSnapshot streams the whole catalog: the version vector, then every
// register, tombstones included, from one consistent read. The receiver merges
// it with the winner rule; an error after the first byte aborts the connection,
// so a truncated snapshot is never mistaken for a complete one.
func (n *Node) handleSnapshot(w http.ResponseWriter, r *http.Request) {
	if !methodOnly(w, r, http.MethodGet) {
		return
	}
	caller := callerID(r)
	n.noteInbound(caller)
	// the snapshot carries every sealed pipeline value: a caller that cannot open
	// one would have to refuse the whole thing (held, not skipped), so tell it so
	// before the megabytes go out
	keys, haveKeys := parseKeyIDs(r.Header)
	if !haveKeys {
		keys, haveKeys = n.lastKeyIDs(caller)
	}
	if why, err := n.snapshotWithheld(r.Context(), keys, haveKeys); err != nil {
		writeError(w, http.StatusInternalServerError, "internal", err.Error())
		return
	} else if why != "" {
		writeError(w, http.StatusConflict, "held", why)
		return
	}
	started := false
	err := n.db.ReadSnapshot(r.Context(), func(q meta.Q) error {
		vv, err := q.CatalogVV(r.Context())
		if err != nil {
			return err
		}
		w.Header().Set("Content-Type", "application/json")
		w.Header().Set("Cache-Control", "no-store")
		started = true
		bw := bufio.NewWriterSize(w, 64<<10)
		head, _ := json.Marshal(vv)
		fmt.Fprintf(bw, `{"node_id":%q,"vv":%s,"regs":[`, n.id, head)
		after, first := "", true
		for {
			regs, err := q.CatalogPageRegs(r.Context(), after, 500)
			if err != nil {
				return err
			}
			for i := range regs {
				row, err := json.Marshal(wireOf(&regs[i]))
				if err != nil {
					return err
				}
				if !first {
					bw.WriteByte(',')
				}
				first = false
				bw.Write(row)
				after = regs[i].Key
			}
			if len(regs) < 500 {
				break
			}
		}
		bw.WriteString("]}")
		return bw.Flush()
	})
	if err != nil {
		if !started {
			writeError(w, http.StatusInternalServerError, "internal", err.Error())
			return
		}
		n.log.Warn("sending a snapshot failed", "error", err)
		panic(http.ErrAbortHandler)
	}
}

// snapshotWithheld says why the snapshot cannot go to a caller ("" when it can):
// some pipeline register is sealed under a master key the caller did not announce.
func (n *Node) snapshotWithheld(ctx context.Context, keys map[seal.KeyID]bool, haveKeys bool) (string, error) {
	after := ""
	for {
		regs, err := n.db.Read().CatalogListRegs(ctx, KindPipeline, after, 200, false)
		if err != nil {
			return "", err
		}
		for i := range regs {
			after = regs[i].Name
			op := Op{Kind: KindPipeline, Key: regs[i].Name, Payload: regs[i].Payload}
			if why := n.withhold(&op, keys, haveKeys); why != "" {
				return "pipeline " + regs[i].Name + ": " + why, nil
			}
		}
		if len(regs) < 200 {
			return "", nil
		}
	}
}

// ---- version vectors on the wire -------------------------------------------------------

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
	if len(parts) > maxSinceOrigins {
		return nil, errors.New("since: too many origins")
	}
	for _, p := range parts {
		o, num, ok := strings.Cut(p, ":")
		v, err := strconv.ParseInt(num, 10, 64)
		if !ok || err != nil || v < 0 || !originRe.MatchString(o) {
			return nil, fmt.Errorf("since: bad entry %q", clip(p))
		}
		out[o] = v
	}
	return out, nil
}
