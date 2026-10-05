package clusteradmin

import (
	"encoding/json"
	"fmt"
	"net/http"
	"sort"
	"strings"
	"sync"

	"github.com/kalevski/toolcase/binvault/internal/admin"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
)

// target is a node a fan-out call goes to.
type target struct {
	id, name, url string
	self          bool
}

// nodeResult is one node's answer to a fan-out call.
type nodeResult struct {
	node target
	reply
	err error
}

// targets lists the nodes a fan-out call goes to — this node and every peer that
// answers — and names the peers that cannot be asked (spec §8.6: unreachable
// nodes are named in `partial`).
func (r *Router) targets() (ts []target, partial []string) {
	ts = append(ts, target{id: r.Node.ID(), name: r.Node.Name(), self: true})
	for _, p := range r.Node.Peers() {
		if p.Retired {
			continue
		}
		name := p.Name
		if name == "" {
			name = p.ID
		}
		if name == "" && len(p.URLs) > 0 {
			name = p.URLs[0]
		}
		url, ok := r.Node.PeerURL(p.ID)
		if p.ID == "" || !p.Reachable || p.Refused != "" || !ok {
			partial = append(partial, name)
			continue
		}
		ts = append(ts, target{id: p.ID, name: name, url: url})
	}
	return ts, partial
}

// fanout sends one admin call to every reachable node in parallel and returns
// the answers (this node's first) and the nodes it could not ask.
func (r *Router) fanout(rc *admin.Ctx, method, path, query string, body []byte) ([]nodeResult, []string) {
	ts, partial := r.targets()
	res := make([]nodeResult, len(ts))
	hdr := pickHeaders(rc.R.Header)
	reqID := httpx.From(rc.Ctx).ID
	var wg sync.WaitGroup
	for i, t := range ts {
		wg.Add(1)
		go func(i int, t target) {
			defer wg.Done()
			res[i].node = t
			if t.self {
				res[i].reply = r.callLocal(rc, method, path, query, body, hdr)
				return
			}
			env := envelope{Method: method, Path: path, Query: query, Headers: hdr, Body: body, RequestID: reqID}
			rep, ok, err := r.callPeer(rc.Ctx, t.url, env, fanoutTimeout)
			switch {
			case err != nil:
				res[i].err = err
			case !ok:
				res[i].err = fmt.Errorf("node %s refused the call (HTTP %d)", t.name, rep.status)
			default:
				res[i].reply = rep
			}
		}(i, t)
	}
	wg.Wait()
	info := httpx.From(rc.Ctx)
	for _, nr := range res {
		if nr.op != "" && info.Op == "" {
			info.Op = nr.op
		}
	}
	return res, partial
}

// mergeList answers a list call (GET /runs, GET /backfills) from every node:
// the items of all nodes, newest first by id — ids sort by time — cut at `limit`,
// with the next cursor being the id of the last item (every node pages by
// "id below the cursor", so one cursor serves them all). Nodes that did not
// answer are named in `partial`.
func (r *Router) mergeList(rc *admin.Ctx) error {
	limit, _, err := admin.PageParams(rc.R)
	if err != nil {
		return err
	}
	path := "/" + rc.Segs[0]
	results, partial := r.fanout(rc, http.MethodGet, path, rc.R.URL.RawQuery, nil)
	type item struct {
		id  string
		raw json.RawMessage
	}
	var items []item
	seen := map[string]int{}
	more := false
	for i, res := range results {
		if res.err == nil && res.status != http.StatusOK && i == 0 {
			// this node's own refusal (a bad filter) is every node's: relay it
			writeReply(rc.W, res.reply)
			return nil
		}
		if res.err != nil || res.status != http.StatusOK {
			partial = append(partial, res.node.name)
			continue
		}
		var page struct {
			Items []json.RawMessage `json:"items"`
			Next  any               `json:"next_cursor"`
		}
		if json.Unmarshal(res.body, &page) != nil {
			partial = append(partial, res.node.name)
			continue
		}
		if page.Next != nil {
			more = true
		}
		for _, raw := range page.Items {
			var id struct {
				ID   string `json:"id"`
				Role string `json:"role"`
			}
			_ = json.Unmarshal(raw, &id)
			// a move is listed by both its nodes: it is shown once, as the source
			// knows it
			if id.ID != "" && rc.Segs[0] == "moves" {
				if at, dup := seen[id.ID]; dup {
					if id.Role == "source" {
						items[at] = item{id: id.ID, raw: raw}
					}
					continue
				}
				seen[id.ID] = len(items)
			}
			items = append(items, item{id: id.ID, raw: raw})
		}
	}
	sort.SliceStable(items, func(i, j int) bool { return items[i].id > items[j].id })
	var next any
	if len(items) > limit {
		items = items[:limit]
		more = true
	}
	if more && len(items) > 0 {
		next = items[len(items)-1].id
	}
	out := make([]json.RawMessage, len(items))
	for i, it := range items {
		out[i] = it.raw
	}
	body := map[string]any{"items": out, "next_cursor": next}
	if partial = dedupe(partial); len(partial) > 0 {
		body["partial"] = partial
	}
	admin.WriteJSON(rc.W, http.StatusOK, body)
	return nil
}

// byID runs a call that names a run or a backfill by id on the node that owns it
// (spec §8.6): this node first, then every other reachable node; the answer of
// the first node that has the object is the answer. When no node has it and some
// node could not be asked, the object may live there: 503, not 404.
func (r *Router) byID(rc *admin.Ctx) error {
	body, err := readBody(rc)
	if err != nil {
		return err
	}
	path := "/" + strings.Join(rc.Segs, "/")
	method, query := rc.R.Method, rc.R.URL.RawQuery
	hdr := pickHeaders(rc.R.Header)

	local := r.callLocal(rc, method, path, query, body, hdr)
	if local.status != http.StatusNotFound {
		writeReply(rc.W, local)
		return nil
	}
	ts, partial := r.targets()
	var (
		wg    sync.WaitGroup
		mu    sync.Mutex
		found *reply
	)
	reqID := httpx.From(rc.Ctx).ID
	for _, t := range ts {
		if t.self {
			continue
		}
		wg.Add(1)
		go func(t target) {
			defer wg.Done()
			env := envelope{Method: method, Path: path, Query: query, Headers: hdr, Body: body, RequestID: reqID}
			rep, ok, err := r.callPeer(rc.Ctx, t.url, env, fanoutTimeout)
			mu.Lock()
			defer mu.Unlock()
			switch {
			case err != nil || !ok:
				partial = append(partial, t.name)
			case rep.status != http.StatusNotFound && found == nil:
				found = &rep
			}
		}(t)
	}
	wg.Wait()
	switch {
	case found != nil:
		writeReply(rc.W, *found)
	case len(partial) > 0:
		return admin.Unavailable("no reachable node has it, and these nodes could not be asked: " + strings.Join(dedupe(partial), ", "))
	default:
		writeReply(rc.W, local)
	}
	return nil
}

// bulk is POST /runs/retry and POST /runs/cancel: every node applies the call to
// its own runs and the counts are added up (`skipped` too: the runs of buckets that
// are frozen or paused for a move are left alone). A `limit` in the body is shared:
// each node gets what the previous ones left.
func (r *Router) bulk(rc *admin.Ctx) error {
	body, err := readBody(rc)
	if err != nil {
		return err
	}
	var doc map[string]json.RawMessage
	if json.Unmarshal(body, &doc) != nil {
		// not an object: the local handler's validation says so
		writeReply(rc.W, r.callLocal(rc, rc.R.Method, "/"+strings.Join(rc.Segs, "/"), rc.R.URL.RawQuery, body, pickHeaders(rc.R.Header)))
		return nil
	}
	limit := 0
	if raw, ok := doc["limit"]; ok {
		_ = json.Unmarshal(raw, &limit)
	}
	field := "requeued"
	if rc.Segs[1] == "cancel" {
		field = "cancelled"
	}
	path := "/" + strings.Join(rc.Segs, "/")
	ts, partial := r.targets()
	hdr := pickHeaders(rc.R.Header)
	reqID := httpx.From(rc.Ctx).ID
	total, skipped := 0, 0
	remaining := limit
	for i, t := range ts {
		b := body
		if limit > 0 {
			if remaining <= 0 {
				break
			}
			doc["limit"], _ = json.Marshal(remaining)
			b, _ = json.Marshal(doc)
		}
		var rep reply
		if t.self {
			rep = r.callLocal(rc, rc.R.Method, path, rc.R.URL.RawQuery, b, hdr)
		} else {
			env := envelope{Method: rc.R.Method, Path: path, Query: rc.R.URL.RawQuery, Headers: hdr, Body: b, RequestID: reqID}
			var ok bool
			var err error
			rep, ok, err = r.callPeer(rc.Ctx, t.url, env, relayTimeout)
			if err != nil || !ok {
				partial = append(partial, t.name)
				continue
			}
		}
		if rep.status != http.StatusOK {
			if i == 0 {
				writeReply(rc.W, rep) // this node's own refusal (a bad filter) is every node's
				return nil
			}
			partial = append(partial, t.name)
			continue
		}
		var counts map[string]int
		_ = json.Unmarshal(rep.body, &counts)
		total += counts[field]
		skipped += counts["skipped"]
		remaining -= counts[field]
	}
	out := map[string]any{field: total}
	if skipped > 0 {
		// runs of buckets that were frozen or paused for a move on their node: left alone
		out["skipped"] = skipped
	}
	if partial = dedupe(partial); len(partial) > 0 {
		out["partial"] = partial
	}
	admin.WriteJSON(rc.W, http.StatusOK, out)
	return nil
}
