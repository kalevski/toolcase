// Package clusteradmin is the admin API's routing in a cluster (spec §8.6). Any
// node accepts any admin call on its admin listener and checks the admin token
// itself; this package then decides, by what the call touches, whether this node
// runs it or sends it on:
//
//   - catalog calls (bucket listing, everything under /pipelines except /test)
//     are answered here — reads from the local copy of the catalog, writes as
//     catalog ops — and accept ?wait=replicated;
//   - bucket-scoped calls (everything under /buckets/{name}, POST /backfills,
//     POST /pipelines/{name}/test) are sent to the bucket's home as a peer
//     request, POST /_peer/v1/admin, authenticated by the cluster key, so the admin
//     token never crosses the peer link; POST /buckets places the new bucket first;
//   - fan-out calls (runs, backfills, calls by run or backfill id, bulk run calls,
//     GET /buckets?stats=true) go to every reachable node and the answers are
//     merged, with the nodes that did not answer named in `partial`;
//   - node-local calls (status, config, metrics) are answered by the node that
//     received them.
//
// A call that arrived as a peer request is never routed again: one hop.
package clusteradmin

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/admin"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/config"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
)

// Timeouts of the calls this package sends: a relayed call waits as long as the
// home may take (a pipeline test calls a service for up to its timeout), the
// fan-out reads are short.
const (
	relayTimeout   = 10 * time.Minute
	testTimeout    = 31 * time.Minute
	fanoutTimeout  = 30 * time.Second
	catalogSyncMax = 3 * time.Second
)

// Router routes the admin calls of one node (see the package comment).
type Router struct {
	Admin *admin.Server
	Node  *cluster.Node
	Cfg   *config.Config
	Log   *slog.Logger
	// Ready reports whether this node serves: the start-up fence has ended and the
	// node has caught up with its own catalog entries.
	Ready func() bool
}

// Route is admin.Server.Router. handled=false lets the local handlers answer.
func (r *Router) Route(rc *admin.Ctx) (bool, error) {
	segs, m := rc.Segs, rc.R.Method
	if len(segs) == 0 {
		return false, nil
	}
	if !r.Ready() {
		switch segs[0] {
		case "status", "config", "cluster":
			return false, nil
		}
		return true, admin.Unavailable("this node is starting: the cluster start-up fence has not ended")
	}
	switch segs[0] {
	case "buckets":
		return r.routeBuckets(rc)
	case "pipelines":
		if len(segs) == 3 && segs[2] == "test" && m == http.MethodPost {
			return r.byBody(rc)
		}
	case "backfills":
		switch {
		case len(segs) == 1 && m == http.MethodPost:
			return r.byBody(rc)
		case len(segs) == 1 && m == http.MethodGet:
			return true, r.mergeList(rc)
		case len(segs) == 2 && m == http.MethodGet, len(segs) == 3 && segs[2] == "cancel" && m == http.MethodPost:
			return true, r.byID(rc)
		}
	case "runs":
		switch {
		case len(segs) == 1 && m == http.MethodGet:
			return true, r.mergeList(rc)
		case len(segs) == 2 && (segs[1] == "retry" || segs[1] == "cancel") && m == http.MethodPost:
			return true, r.bulk(rc)
		case len(segs) == 2 && m == http.MethodGet, len(segs) == 3 && m == http.MethodPost:
			return true, r.byID(rc)
		}
	case "moves":
		switch {
		case len(segs) == 1 && m == http.MethodGet:
			return true, r.mergeList(rc)
		case len(segs) == 2 && m == http.MethodGet:
			return true, r.moveByID(rc)
		case len(segs) == 3 && segs[2] == "cancel" && m == http.MethodPost:
			return true, r.moveCancel(rc)
		}
	case "cluster":
		switch {
		case len(segs) == 3 && segs[1] == "orphans" && m == http.MethodDelete:
			return r.orphan(rc)
		case len(segs) == 4 && segs[1] == "nodes" && (segs[3] == "drain" || segs[3] == "undrain") && m == http.MethodPost:
			return r.toNode(rc, segs[2])
		}
	}
	return false, nil
}

func (r *Router) routeBuckets(rc *admin.Ctx) (bool, error) {
	segs, m := rc.Segs, rc.R.Method
	switch {
	case len(segs) == 1 && m == http.MethodGet:
		return true, r.listBuckets(rc)
	case len(segs) == 1 && m == http.MethodPost:
		return r.createBucket(rc)
	case len(segs) == 2 && m == http.MethodDelete && rc.R.URL.Query().Get("catalog_only") == "true":
		return true, r.catalogOnly(rc, segs[1])
	case len(segs) >= 2:
		return r.toHome(rc, segs[1], nil)
	}
	return false, nil
}

// ---- reading the request -----------------------------------------------------------------

// readBody reads the request body (bounded as every admin body is) and puts it
// back, so that the local handlers can still read it.
func readBody(rc *admin.Ctx) ([]byte, error) {
	if rc.R.Body == nil {
		return nil, nil
	}
	b, err := io.ReadAll(io.LimitReader(rc.R.Body, bodyLimit+1))
	if err != nil {
		return nil, admin.Invalid("could not read the request body", nil)
	}
	if len(b) > bodyLimit {
		return nil, &admin.APIError{Status: http.StatusRequestEntityTooLarge, Code: "payload_too_large", Detail: "request body exceeds 256 KiB"}
	}
	rc.R.Body = io.NopCloser(bytes.NewReader(b))
	return b, nil
}

// bucketOfCall names the bucket a bucket-scoped admin call is about ("" when it
// is about none): the path of /buckets/{name}…, the body of POST /backfills and
// of POST /pipelines/{name}/test.
func bucketOfCall(method string, segs []string, body []byte) string {
	if len(segs) == 0 {
		return ""
	}
	switch segs[0] {
	case "buckets":
		if len(segs) >= 2 {
			return segs[1]
		}
	case "backfills":
		if len(segs) == 1 && method == http.MethodPost {
			return bucketInBody(body)
		}
	case "pipelines":
		if len(segs) == 3 && segs[2] == "test" && method == http.MethodPost {
			return bucketInBody(body)
		}
	}
	return ""
}

func bucketInBody(body []byte) string {
	var b struct {
		Bucket string `json:"bucket"`
	}
	if json.Unmarshal(body, &b) != nil {
		return ""
	}
	return b.Bucket
}

// ---- bucket-scoped calls ---------------------------------------------------------------------

// lookup finds a bucket in the catalog; on a miss it pulls from the peers once
// (a bucket created a moment ago may not have replicated yet) and looks again.
func (r *Router) lookup(ctx context.Context, name string) (cluster.BucketRecord, bool) {
	if rec, ok := r.Node.Bucket(name); ok {
		return rec, true
	}
	sctx, cancel := context.WithTimeout(ctx, catalogSyncMax)
	defer cancel()
	if r.Node.SyncNow(sctx) {
		if rec, ok := r.Node.Bucket(name); ok {
			return rec, true
		}
	} else {
		time.Sleep(100 * time.Millisecond) // another call pulled a moment ago: let it land
		if rec, ok := r.Node.Bucket(name); ok {
			return rec, true
		}
	}
	// the pull may have been rate-limited, or replication may be slow: ask the peers
	// themselves, which is exact and cheap at admin rates, and route by their answer
	pctx, pcancel := context.WithTimeout(ctx, catalogSyncMax)
	defer pcancel()
	found, _ := r.Node.PeersKnowBucket(pctx, name)
	var best *cluster.BucketOnPeer
	for i := range found {
		if found[i].Home != "" && (best == nil || found[i].Epoch > best.Epoch) {
			best = &found[i]
		}
	}
	if best == nil {
		return r.Node.Bucket(name)
	}
	var rec cluster.BucketRecord
	rec.Name = name
	rec.Home, rec.Epoch, rec.Generation = best.Home, best.Epoch, best.Generation
	return rec, true
}

// mustHome is the guard of a peer-run bucket call: the catalog must give the
// bucket to this node, and the local data must be the catalog's incarnation.
func (r *Router) mustHome(name string) error {
	rec, ok := r.Node.Bucket(name)
	if !ok {
		return admin.NotFound(fmt.Sprintf("bucket %q does not exist", name))
	}
	if rec.Home != r.Node.ID() {
		return admin.Unavailable(fmt.Sprintf("bucket %q is homed on %s, not on this node", name, r.nodeName(rec.Home)))
	}
	b, err := r.Admin.Eng.DB.Read().GetBucket(context.Background(), name)
	if err != nil || b.Generation != rec.Generation {
		return admin.Unavailable(fmt.Sprintf("bucket %q: this node has no data for the catalog's incarnation of it", name))
	}
	if b.Epoch != rec.Epoch {
		return admin.Unavailable(fmt.Sprintf("bucket %q is changing nodes: this node's copy is at epoch %d, the catalog's is at %d", name, b.Epoch, rec.Epoch))
	}
	return nil
}

// mustCatalogHome is mustHome for the delete of a bucket: the catalog must give
// the bucket to this node; whether the node holds its data is the handler's business
// (a home without data can still drop the catalog entry).
func (r *Router) mustCatalogHome(name string) error {
	rec, ok := r.Node.Bucket(name)
	if !ok {
		return admin.NotFound(fmt.Sprintf("bucket %q does not exist", name))
	}
	if rec.Home != r.Node.ID() {
		return admin.Unavailable(fmt.Sprintf("bucket %q is homed on %s, not on this node", name, r.nodeName(rec.Home)))
	}
	return nil
}

// isBucketDelete reports whether a call is DELETE /buckets/{name}.
func isBucketDelete(method string, segs []string) bool {
	return method == http.MethodDelete && len(segs) == 2 && segs[0] == "buckets"
}

func (r *Router) nodeName(id string) string {
	if n := r.Node.NodeName(id); n != "" {
		return n
	}
	return id
}

// toHome runs a bucket-scoped call: locally when this node homes the bucket,
// otherwise on the home, as a peer request. body is the request body when the
// caller has read it already.
func (r *Router) toHome(rc *admin.Ctx, name string, body []byte) (bool, error) {
	rec, ok := r.lookup(rc.Ctx, name)
	if !ok {
		return true, admin.NotFound(fmt.Sprintf("bucket %q does not exist", name))
	}
	if rec.Home == r.Node.ID() {
		// the catalog gives the bucket to this node: so must the local copy — of that
		// incarnation, at that epoch (a copy restored from an older backup is not changed)
		if isBucketDelete(rc.R.Method, rc.Segs) {
			return false, nil // the handler drops the entry when it holds no data for it
		}
		if b, err := r.Admin.Eng.DB.Read().GetBucket(rc.Ctx, name); err == nil && (b.Generation != rec.Generation || b.Epoch != rec.Epoch) {
			return true, admin.Unavailable(fmt.Sprintf("bucket %q: this node's copy is not the catalog's current one (epoch %d, the catalog's is %d): it is not served", name, b.Epoch, rec.Epoch))
		}
		return false, nil
	}
	if body == nil {
		var err error
		if body, err = readBody(rc); err != nil {
			return true, err
		}
	}
	timeout := relayTimeout
	if len(rc.Segs) == 3 && rc.Segs[0] == "pipelines" {
		timeout = testTimeout
	}
	return true, r.relay(rc, rec.Home, body, timeout)
}

// byBody routes a call whose bucket is named in its JSON body.
func (r *Router) byBody(rc *admin.Ctx) (bool, error) {
	body, err := readBody(rc)
	if err != nil {
		return true, err
	}
	bucket := bucketInBody(body)
	if bucket == "" {
		return false, nil // the local handler explains what is missing
	}
	return r.toHome(rc, bucket, body)
}

// relay sends the call to a node as a peer request and writes its answer.
func (r *Router) relay(rc *admin.Ctx, nodeID string, body []byte, timeout time.Duration) error {
	route, found := r.Node.Route(nodeID)
	name := route.Name
	if name == "" {
		name = nodeID
	}
	switch {
	case !found || route.Retired:
		return admin.Unavailable(fmt.Sprintf("node %s is not part of this cluster any more; its buckets answer 503 until its data returns or they are dropped (DELETE /buckets/{name}?catalog_only=true)", name))
	case !route.Reachable || route.URL == "":
		return admin.Unavailable(fmt.Sprintf("node %s is not reachable; the buckets it homes answer 503 until it returns", name))
	}
	env := envelope{
		Method: rc.R.Method, Path: "/" + strings.Join(rc.Segs, "/"), Query: rc.R.URL.RawQuery,
		Headers: pickHeaders(rc.R.Header), Body: body, RequestID: httpx.From(rc.Ctx).ID,
	}
	rep, ok, err := r.callPeer(rc.Ctx, route.URL, env, timeout)
	if err != nil {
		if rc.Ctx.Err() != nil {
			return rc.Ctx.Err()
		}
		return admin.Unavailable(fmt.Sprintf("node %s did not answer: %v", name, err))
	}
	if !ok {
		return admin.Unavailable(fmt.Sprintf("node %s refused the call (HTTP %d): %s", name, rep.status, strings.TrimSpace(clip(string(rep.body), 200))))
	}
	// the call is counted and logged under the operation the home ran, for the
	// bucket it concerns
	info := httpx.From(rc.Ctx)
	if rep.op != "" {
		info.Op = rep.op
	}
	if b := bucketOfCall(rc.R.Method, rc.Segs, body); b != "" {
		info.Bucket = b
	}
	writeReply(rc.W, rep)
	return nil
}

func pickHeaders(h http.Header) map[string]string {
	out := map[string]string{}
	for _, k := range relayedHeaders {
		if v := h.Get(k); v != "" {
			out[k] = v
		}
	}
	return out
}

func writeReply(w http.ResponseWriter, rep reply) {
	h := w.Header()
	for _, k := range []string{"Content-Type", "Content-Length", "Retry-After", "Www-Authenticate"} {
		if v := rep.header.Get(k); v != "" {
			h.Set(k, v)
		}
	}
	w.WriteHeader(rep.status)
	if len(rep.body) > 0 {
		_, _ = w.Write(rep.body)
	}
}

func clip(s string, n int) string {
	if len(s) > n {
		return s[:n] + "…"
	}
	return s
}

// ---- placement ----------------------------------------------------------------------------------

// createBucket is POST /buckets in a cluster (spec §8.6, Placement): ask every
// reachable peer whether the name exists, resolve `home`, and have the chosen
// node create the bucket and write its catalog entry.
func (r *Router) createBucket(rc *admin.Ctx) (bool, error) {
	body, err := readBody(rc)
	if err != nil {
		return true, err
	}
	var req struct {
		Name string `json:"name"`
		Home string `json:"home"`
	}
	if json.Unmarshal(body, &req) != nil || req.Name == "" || engine.ValidateBucketName(req.Name, r.Cfg.Domain != "") != nil {
		return false, nil // the local handler answers 400 with the field problems
	}
	if rec, ok := r.Node.Bucket(req.Name); ok {
		return true, admin.Conflict(fmt.Sprintf("bucket %q already exists (homed on %s)", req.Name, r.nodeName(rec.Home)))
	}
	ctx, cancel := context.WithTimeout(rc.Ctx, 10*time.Second)
	found, _ := r.Node.PeersKnowBucket(ctx, req.Name)
	cancel()
	if len(found) > 0 {
		return true, admin.Conflict(fmt.Sprintf("bucket %q already exists (known to node %s)", req.Name, found[0].Node))
	}
	target, err := r.place(req.Home)
	if err != nil {
		return true, err
	}
	if target.ID == r.Node.ID() {
		return false, nil // this node creates it: the local handler
	}
	return true, r.relay(rc, target.ID, body, relayTimeout)
}

// place resolves the `home` of a new bucket to a node that can take it.
func (r *Router) place(home string) (cluster.PeerInfo, error) {
	if home == "" || home == "auto" {
		p, ok := r.Node.AutoPlacement()
		if !ok {
			return p, admin.Unavailable("no node can take a new bucket now: every node is unreachable, cordoned, draining or still starting")
		}
		return p, nil
	}
	p, ok := r.Node.PeerByName(home)
	switch {
	case !ok || p.ID == "":
		return p, admin.Invalid("unknown home node", map[string]string{"home": fmt.Sprintf("%q is not a node of this cluster", home)})
	case p.Retired:
		return p, admin.Invalid("unknown home node", map[string]string{"home": fmt.Sprintf("node %q was retired", home)})
	case p.Refused != "":
		return p, admin.Conflict(fmt.Sprintf("node %q is refused by this cluster: %s", home, p.Refused))
	case !p.Reachable:
		return p, admin.Unavailable(fmt.Sprintf("node %q is not reachable: a bucket cannot be created on it now", home))
	case p.Draining:
		return p, admin.Unavailable(fmt.Sprintf("node %q is shutting down", home))
	case p.Cordoned:
		return p, admin.Conflict(fmt.Sprintf("node %q is cordoned: it takes no new buckets", home))
	}
	return p, nil
}

// ---- catalog calls ---------------------------------------------------------------------------------

// bucketItem is a bucket as the catalog lists it (GET /buckets, spec §6.3).
type bucketItem struct {
	Name       string    `json:"name"`
	Home       string    `json:"home"`
	HomeID     string    `json:"home_id"`
	Epoch      int64     `json:"epoch"`
	Generation string    `json:"generation"`
	CreatedAt  time.Time `json:"created_at"`
	Pipelines  []string  `json:"pipelines"`
}

// listBuckets is GET /buckets: the catalog, with `home`. With ?stats=true the
// home nodes are asked for the details and stats of their buckets (the
// buckets of an unreachable home keep their catalog entry only, and the node is
// named in `partial`).
func (r *Router) listBuckets(rc *admin.Ctx) error {
	limit, cursor, err := admin.PageParams(rc.R)
	if err != nil {
		return err
	}
	recs, err := r.Node.ListBuckets(rc.Ctx, cursor, limit+1)
	if err != nil {
		return admin.Internal(err)
	}
	var next any
	if len(recs) > limit {
		recs = recs[:limit]
		next = recs[len(recs)-1].Name
	}
	items := make([]any, len(recs))
	for i, rec := range recs {
		items[i] = bucketItem{
			Name: rec.Name, Home: r.nodeName(rec.Home), HomeID: rec.Home, Epoch: rec.Epoch, Generation: rec.Generation,
			CreatedAt: rec.Created(), Pipelines: append([]string{}, rec.Pipelines...),
		}
	}
	out := map[string]any{"items": items, "next_cursor": next}
	if rc.R.URL.Query().Get("stats") == "true" && len(recs) > 0 {
		partial := r.overlayStats(rc, recs, items, cursor)
		if len(partial) > 0 {
			out["partial"] = partial
		}
	}
	admin.WriteJSON(rc.W, http.StatusOK, out)
	return nil
}

// overlayStats asks every reachable node for its local bucket list with stats
// and replaces the catalog items by the home's full representation, keeping the
// catalog's epoch, generation and attached pipeline names. It returns the nodes
// that did not answer.
func (r *Router) overlayStats(rc *admin.Ctx, recs []cluster.BucketRecord, items []any, cursor string) []string {
	q := "stats=true&limit=500"
	if cursor != "" {
		q += "&cursor=" + cursor
	}
	results, partial := r.fanout(rc, http.MethodGet, "/buckets", q, nil)
	full := map[string]map[string]json.RawMessage{} // "node id\x00bucket name" -> the home's representation
	for _, res := range results {
		if res.err != nil || res.status != http.StatusOK {
			partial = append(partial, res.node.name)
			continue
		}
		var page struct {
			Items []map[string]json.RawMessage `json:"items"`
		}
		if json.Unmarshal(res.body, &page) != nil {
			partial = append(partial, res.node.name)
			continue
		}
		for _, it := range page.Items {
			var name string
			_ = json.Unmarshal(it["name"], &name)
			full[res.node.id+"\x00"+name] = it
		}
	}
	for i, rec := range recs {
		it, ok := full[rec.Home+"\x00"+rec.Name]
		if !ok {
			continue
		}
		base := items[i].(bucketItem)
		merged := map[string]any{}
		for k, v := range it {
			merged[k] = v
		}
		merged["epoch"], merged["generation"], merged["pipelines"] = base.Epoch, base.Generation, base.Pipelines
		items[i] = merged
	}
	return dedupe(partial)
}

func dedupe(in []string) []string {
	seen := map[string]bool{}
	var out []string
	for _, s := range in {
		if !seen[s] {
			seen[s] = true
			out = append(out, s)
		}
	}
	return out
}

// catalogOnly is DELETE /buckets/{name}?catalog_only=true (spec §6.3, §8.9): the
// node that receives it drops the catalog entry — and the access-key index
// entries of the bucket — itself, without contacting the home, for a bucket whose
// home is down or retired. It is 409 while the home answers.
func (r *Router) catalogOnly(rc *admin.Ctx, name string) error {
	rec, ok := r.lookup(rc.Ctx, name)
	if !ok {
		return admin.NotFound(fmt.Sprintf("bucket %q does not exist", name))
	}
	if rec.Home == r.Node.ID() {
		return admin.Conflict(fmt.Sprintf("this node is the home of bucket %q and answers: delete it without catalog_only", name))
	}
	if rt, found := r.Node.Route(rec.Home); found && !rt.Retired && rt.URL != "" && r.answers(rc.Ctx, rt.URL) {
		return admin.Conflict(fmt.Sprintf("node %s, the home of bucket %q, answers: delete the bucket without catalog_only", r.nodeName(rec.Home), name))
	}
	keys, err := r.Node.KeysOf(rc.Ctx, name)
	if err != nil {
		return admin.Internal(err)
	}
	drafts := []cluster.Draft{cluster.DeleteBucketDraft(name)}
	for _, k := range keys {
		drafts = append(drafts, cluster.DeleteKeyDraft(k.AccessKeyID))
	}
	ops, err := r.Node.Write(rc.Ctx, drafts...)
	switch {
	case errors.Is(err, cluster.ErrNotReady):
		return admin.Unavailable("this node is starting: the cluster start-up fence has not ended")
	case err != nil:
		return admin.Internal(err)
	}
	r.Log.Warn("a bucket's catalog entry was dropped without contacting its home", "bucket", name, "home", r.nodeName(rec.Home))
	rc.AddOps(ops...)
	rc.WriteReplicated(http.StatusNoContent, nil)
	return nil
}

// answers asks a node, right now and not from the last hello, whether it answers
// on the peer link: catalog_only is for homes that are down, so a node that just
// crashed must not be taken for a live one because the bookkeeping has not caught up.
func (r *Router) answers(ctx context.Context, url string) bool {
	ctx, cancel := context.WithTimeout(ctx, 2*time.Second)
	defer cancel()
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url+cluster.PeerPrefix+"hello", nil)
	if err != nil {
		return false
	}
	r.Node.AuthRequest(req)
	resp, err := r.Node.Client().Do(req)
	if err != nil {
		return false
	}
	defer resp.Body.Close()
	_, _ = io.Copy(io.Discard, io.LimitReader(resp.Body, 1<<16))
	return resp.StatusCode == http.StatusOK
}

// orphan is DELETE /cluster/orphans/{generation}?node=<name>: the data of an
// orphaned bucket is deleted on the node that holds it (default: this one).
func (r *Router) orphan(rc *admin.Ctx) (bool, error) {
	node := rc.R.URL.Query().Get("node")
	if node == "" || node == r.Node.Name() {
		return false, nil
	}
	p, ok := r.Node.PeerByName(node)
	if !ok || p.ID == "" {
		return true, admin.Invalid("unknown node", map[string]string{"node": fmt.Sprintf("%q is not a node of this cluster", node)})
	}
	return true, r.relay(rc, p.ID, nil, relayTimeout)
}

// ---- the local call --------------------------------------------------------------------------------

// capture is a ResponseWriter that keeps what a handler wrote.
type capture struct {
	h      http.Header
	status int
	buf    bytes.Buffer
}

func newCapture() *capture                     { return &capture{h: http.Header{}, status: http.StatusOK} }
func (c *capture) Header() http.Header         { return c.h }
func (c *capture) WriteHeader(code int)        { c.status = code }
func (c *capture) Write(p []byte) (int, error) { return c.buf.Write(p) }

// callLocal runs an admin call on this node's own handlers, as a peer would run
// it, and returns what it answered.
func (r *Router) callLocal(rc *admin.Ctx, method, path, query string, body []byte, hdr map[string]string) reply {
	outer := httpx.From(rc.Ctx)
	ctx := httpx.With(rc.Ctx, &httpx.Info{ID: outer.ID, Client: outer.Client, Start: outer.Start})
	req, err := http.NewRequestWithContext(ctx, method, "http://local/_admin/v1"+path, bytes.NewReader(body))
	if err != nil {
		return reply{status: http.StatusBadRequest, body: []byte(`{"error":"invalid_request"}`)}
	}
	req.URL.RawQuery = query
	req.RequestURI = "/_admin/v1" + path
	if query != "" {
		req.RequestURI += "?" + query
	}
	for k, v := range hdr {
		req.Header.Set(k, v)
	}
	cw := newCapture()
	r.Admin.ServePeer(cw, req, path, query)
	return reply{status: cw.status, header: cw.h, body: cw.buf.Bytes(), op: httpx.From(ctx).Op}
}

// ---- node calls and moves ---------------------------------------------------------------------

// toNode runs a call that names a node ({id} of /cluster/nodes/{id}/drain) on that
// node: here when it is this one, otherwise as a peer request.
func (r *Router) toNode(rc *admin.Ctx, ref string) (bool, error) {
	if ref == r.Node.Name() || ref == r.Node.ID() {
		return false, nil
	}
	p, ok := r.Node.PeerByName(ref)
	if !ok || p.ID == "" {
		p, ok = r.Node.PeerByID(ref)
	}
	if !ok || p.ID == "" {
		return true, admin.NotFound(fmt.Sprintf("node %q is not known to this cluster", ref))
	}
	if p.ID == r.Node.ID() {
		return false, nil
	}
	return true, r.relay(rc, p.ID, nil, relayTimeout)
}

// findMove asks every reachable node for a move and returns the answers: the one of
// the move's source if there is one (it owns the move), else any. A node that has no
// such move says 404; a node that could not be asked is named in partial.
func (r *Router) findMove(rc *admin.Ctx) (found *nodeResult, role string, partial []string) {
	path := "/" + strings.Join(rc.Segs[:2], "/")
	results, partial := r.fanout(rc, http.MethodGet, path, "", nil)
	for i := range results {
		res := &results[i]
		if res.err != nil || (res.status != http.StatusOK && res.status != http.StatusNotFound) {
			partial = append(partial, res.node.name)
			continue
		}
		if res.status != http.StatusOK {
			continue
		}
		var v struct {
			Role string `json:"role"`
		}
		_ = json.Unmarshal(res.body, &v)
		if found == nil || v.Role == "source" {
			found, role = res, v.Role
		}
	}
	return found, role, dedupe(partial)
}

// moveByID is GET /moves/{id}: the record of the node that owns the move — the
// source — when it answers, the target's otherwise.
func (r *Router) moveByID(rc *admin.Ctx) error {
	found, _, partial := r.findMove(rc)
	switch {
	case found != nil:
		writeReply(rc.W, found.reply)
	case len(partial) > 0:
		return admin.Unavailable("no reachable node has the move, and these nodes could not be asked: " + strings.Join(partial, ", "))
	default:
		return admin.NotFound(fmt.Sprintf("move %q does not exist", rc.Segs[1]))
	}
	return nil
}

// moveCancel is POST /moves/{id}/cancel: only the source node decides, so the call
// goes to it (spec §6.10).
func (r *Router) moveCancel(rc *admin.Ctx) error {
	found, role, partial := r.findMove(rc)
	switch {
	case found == nil && len(partial) > 0:
		return admin.Unavailable("no reachable node has the move, and these nodes could not be asked: " + strings.Join(partial, ", "))
	case found == nil:
		return admin.NotFound(fmt.Sprintf("move %q does not exist", rc.Segs[1]))
	case role != "source":
		// only the target answered: the source is down or unreachable
		return admin.Unavailable(fmt.Sprintf("move %q can be cancelled only by its source node, which did not answer", rc.Segs[1]))
	}
	if found.node.self {
		writeReply(rc.W, r.callLocal(rc, rc.R.Method, "/"+strings.Join(rc.Segs, "/"), rc.R.URL.RawQuery, nil, pickHeaders(rc.R.Header)))
		return nil
	}
	return r.relay(rc, found.node.id, nil, relayTimeout)
}
