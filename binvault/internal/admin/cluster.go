package admin

import (
	"context"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// This file is the admin API's part of cluster mode (spec §6.9, §8.2, §8.6): the
// catalog writes that go with creating and deleting buckets and tokens, the
// guards that keep a node from changing a bucket it is not the home of, and the
// /cluster endpoints. Everything that sends a call to another node lives in
// package clusteradmin; this file only touches this node's own state.

// catalogTimeout bounds a catalog write that follows a local change.
const catalogTimeout = 30 * time.Second

// clusterErr turns the errors of the cluster package into API errors; an
// *APIError passes through, anything else is an internal error.
func clusterErr(err error) error {
	var ae *APIError
	switch {
	case err == nil:
		return nil
	case errors.As(err, &ae):
		return ae
	case errors.Is(err, cluster.ErrNotReady):
		return unavailable("this node is starting: the cluster start-up fence has not ended")
	case errors.Is(err, cluster.ErrStopped):
		return unavailable("this node is shutting down")
	case errors.Is(err, cluster.ErrExists):
		return conflict("the cluster catalog already lists this name")
	case errors.Is(err, cluster.ErrNotFound):
		return notFound("the cluster catalog does not list it")
	}
	return internalErr(err)
}

// clusterCanCreate refuses, before any local change, a bucket the catalog already
// lists or a node that may not write the catalog yet.
func (s *Server) clusterCanCreate(name string) error {
	if s.Cluster == nil {
		return nil
	}
	if !s.Cluster.Ready() {
		return unavailable("this node is starting: the cluster start-up fence has not ended")
	}
	if rec, ok := s.Cluster.Bucket(name); ok {
		return conflict(fmt.Sprintf("bucket %q already exists (homed on %s)", name, s.homeName(rec.Home)))
	}
	return nil
}

func (s *Server) homeName(id string) string {
	if n := s.Cluster.NodeName(id); n != "" {
		return n
	}
	return id
}

// existsErr is the answer to a name this node already has locally: 409, with the
// way out when the local bucket is an orphan the catalog no longer gives to it.
func (s *Server) existsErr(rc *Ctx, name string) error {
	if s.Cluster != nil {
		if b, err := s.Eng.DB.Read().GetBucket(rc.Ctx, name); err == nil {
			if orphan, why, _ := s.Cluster.IsOrphan(rc.Ctx, cluster.LocalBucket{Name: name, Generation: b.Generation}); orphan {
				return conflict(fmt.Sprintf("bucket %q exists on this node as an orphan (%s): delete its data with DELETE /cluster/orphans/%s first", name, why, b.Generation))
			}
		}
	}
	return conflict(fmt.Sprintf("bucket %q already exists", name))
}

// rollbackBucket removes a bucket that was created a moment ago, when the step
// after it failed: a bucket the catalog does not know is not served.
func (s *Server) rollbackBucket(rc *Ctx, b *meta.Bucket) {
	ctx := context.WithoutCancel(rc.Ctx)
	err := s.Eng.DB.Update(ctx, func(tx *meta.Tx) error {
		cur, err := tx.GetBucket(ctx, b.Name)
		if err != nil || cur.Generation != b.Generation {
			return err
		}
		if err := tx.KVDelete(ctx, meta.PublishPendingKey(b.Name)); err != nil {
			return err
		}
		return tx.DeleteBucket(ctx, b.Name)
	})
	if err != nil {
		s.Log.Error("rolling back a bucket creation failed; the next start-up publishes it", "bucket", b.Name, "error", err)
	}
}

// publishBucket writes the bucket/<name> register of a bucket this node just
// created (spec §8.2): home = this node, epoch 0, the bucket's own generation.
// It rolls the creation back when the catalog refuses it.
func (s *Server) publishBucket(rc *Ctx, b *meta.Bucket) error {
	if s.Cluster == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(rc.Ctx), catalogTimeout)
	defer cancel()
	op, err := s.Cluster.CreateBucket(ctx, b.Name, cluster.BucketEntry{
		Home: s.Cluster.ID(), Epoch: 0, Generation: b.Generation, CreatedAt: b.CreatedAt.UnixMilli(), Pipelines: []string{},
	})
	if err != nil {
		s.rollbackBucket(rc, b)
		if errors.Is(err, cluster.ErrExists) {
			return conflict(fmt.Sprintf("bucket %q already exists", b.Name))
		}
		return clusterErr(err)
	}
	rc.AddOps(op)
	// published: the marker has done its job (a failure to remove it only means
	// the next start looks at the bucket once more)
	_ = s.Eng.DB.Update(ctx, func(tx *meta.Tx) error { return tx.KVDelete(ctx, meta.PublishPendingKey(b.Name)) })
	return nil
}

// dropLostBucket deletes the catalog entry of a bucket this node homes but holds
// no data for: the register and the access-key index entries of its tokens. Data
// of another incarnation of the name that the node may hold is left alone (it is
// an orphan, deleted with DELETE /cluster/orphans/{generation}).
func (s *Server) dropLostBucket(rc *Ctx, name string) error {
	ctx, cancel := context.WithTimeout(context.WithoutCancel(rc.Ctx), catalogTimeout)
	defer cancel()
	keys, err := s.Cluster.KeysOf(ctx, name)
	if err != nil {
		return internalErr(err)
	}
	ids := make([]string, 0, len(keys))
	for _, k := range keys {
		ids = append(ids, k.AccessKeyID)
	}
	if err := s.unpublishBucket(rc, name, ids); err != nil {
		return err
	}
	s.Log.Warn("a bucket's catalog entry was dropped: this node, its home, held no data for it", "bucket", name)
	rc.WriteReplicated(http.StatusNoContent, nil)
	return nil
}

// unpublishBucket tombstones a bucket's register and the access-key index
// entries of its tokens in one atomic write, after the local data is gone.
func (s *Server) unpublishBucket(rc *Ctx, name string, tokenIDs []string) error {
	if s.Cluster == nil {
		return nil
	}
	drafts := []cluster.Draft{cluster.DeleteBucketDraft(name)}
	for _, id := range tokenIDs {
		drafts = append(drafts, cluster.DeleteKeyDraft(id))
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(rc.Ctx), catalogTimeout)
	defer cancel()
	ops, err := s.Cluster.Write(ctx, drafts...)
	if err != nil {
		s.Log.Error("the bucket is deleted locally but its catalog entry could not be dropped: use DELETE /buckets/{name}?catalog_only=true", "bucket", name, "error", err)
		return clusterErr(err)
	}
	rc.AddOps(ops...)
	return nil
}

// publishToken writes key/<access key id> for a token this node just created
// (spec §8.2); a token the catalog cannot index is not created.
func (s *Server) publishToken(rc *Ctx, t *meta.Token) error {
	if s.Cluster == nil {
		return nil
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(rc.Ctx), catalogTimeout)
	defer cancel()
	if _, err := s.Cluster.PutKey(ctx, t.AccessKeyID, cluster.KeyEntry{Bucket: t.Bucket}); err != nil {
		if derr := s.Eng.DB.Update(ctx, func(tx *meta.Tx) error { return tx.DeleteToken(ctx, t.AccessKeyID) }); derr != nil {
			s.Log.Error("rolling back a token creation failed", "access_key_id", t.AccessKeyID, "error", derr)
		}
		s.Tokens.Invalidate(t.AccessKeyID)
		return clusterErr(err)
	}
	return nil
}

// unpublishToken drops a revoked token from the access-key index. A failure only
// leaves a stale index entry: a request that follows it reaches the home, which
// no longer knows the key.
func (s *Server) unpublishToken(rc *Ctx, id string) {
	if s.Cluster == nil {
		return
	}
	ctx, cancel := context.WithTimeout(context.WithoutCancel(rc.Ctx), catalogTimeout)
	defer cancel()
	if _, err := s.Cluster.DeleteKey(ctx, id); err != nil {
		s.Log.Warn("dropping a revoked token from the access-key index failed", "access_key_id", id, "error", err)
	}
}

// clusterHomes checks, in a cluster, that the catalog gives the bucket's current
// incarnation to this node before the node changes it.
func (s *Server) clusterHomes(name string, local *meta.Bucket) error {
	if s.Cluster == nil {
		return nil
	}
	rec, ok := s.Cluster.Bucket(name)
	switch {
	case !ok:
		return notFound(fmt.Sprintf("bucket %q does not exist", name))
	case rec.Home != s.Cluster.ID():
		return unavailable(fmt.Sprintf("bucket %q is homed on %s, not on this node", name, s.homeName(rec.Home)))
	case local != nil && rec.Generation != local.Generation:
		return unavailable(fmt.Sprintf("bucket %q: the catalog lists another incarnation of it; this node's copy is an orphan", name))
	case local != nil && rec.Epoch != local.Epoch:
		return unavailable(fmt.Sprintf("bucket %q is changing nodes (this node's copy is at epoch %d, the catalog's is at %d)", name, local.Epoch, rec.Epoch))
	}
	return nil
}

// ---- GET /cluster --------------------------------------------------------------

// nodeJSON is a node of GET /cluster: what the cluster package knows, and — for a
// cordoned node, which is one being drained — the progress of the drain, derived
// from the cordon flag and the buckets the catalog still homes on it (§6.9).
type nodeJSON struct {
	cluster.PeerInfo
	Drain *drainView `json:"drain,omitempty"`
}

type drainView struct {
	// State is "running" while buckets are still homed on the node, "done" once none is.
	State     string `json:"state"`
	Remaining int64  `json:"remaining"`
}

func nodeView(p cluster.PeerInfo) nodeJSON {
	out := nodeJSON{PeerInfo: p}
	if p.Cordoned {
		out.Drain = &drainView{State: "done", Remaining: p.BucketsHomed}
		if p.BucketsHomed > 0 {
			out.Drain.State = "running"
		}
	}
	return out
}

type clusterJSON struct {
	ID    string `json:"id"`
	Name  string `json:"name"`
	Mode  string `json:"mode"`
	Ready bool   `json:"ready"`
	// Nodes are every node of the cluster, this one first.
	Nodes  []nodeJSON     `json:"nodes"`
	Alarms cluster.Alarms `json:"alarms"`
	// Origin and VV describe the catalog op log; Log summarises it.
	Origin string               `json:"origin,omitempty"`
	VV     map[string]int64     `json:"vv,omitempty"`
	Log    *cluster.LogStats    `json:"log,omitempty"`
	Fence  *cluster.FenceStatus `json:"fence,omitempty"`
}

func (s *Server) clusterStatus(rc *Ctx) error {
	if s.Cluster == nil {
		q := s.Eng.DB.Read()
		n, _ := q.CountBuckets(rc.Ctx)
		free, _ := s.Eng.Store.FreeBytes()
		self := cluster.PeerInfo{
			ID: s.NodeID, Name: s.NodeName, Endpoint: s.Cfg.EndpointURL, Self: true, Reachable: true, Ready: true,
			LastSeen: time.Now().UTC(), Version: s.Version, BucketsHomed: n, FreeDisk: int64(free),
		}
		WriteJSON(rc.W, http.StatusOK, clusterJSON{
			ID: s.NodeID, Name: s.NodeName, Mode: "single", Ready: true, Nodes: []nodeJSON{nodeView(self)},
			Alarms: cluster.Alarms{
				Conflicts: []cluster.Conflict{}, Orphans: []cluster.Orphan{}, HeldOps: []cluster.HeldOp{}, Clones: []cluster.Clone{},
				Missing: []cluster.Missing{}, Mismatches: []cluster.Mismatch{}, CompactionBlockedBy: []string{},
			},
		})
		return nil
	}
	st, err := s.Cluster.Status(rc.Ctx)
	if err != nil {
		return internalErr(err)
	}
	nonNilAlarms(&st.Alarms)
	nodes := []nodeJSON{nodeView(st.Self)}
	for _, p := range st.Peers {
		nodes = append(nodes, nodeView(p))
	}
	WriteJSON(rc.W, http.StatusOK, clusterJSON{
		ID: s.NodeID, Name: s.NodeName, Mode: st.Mode, Ready: st.Ready, Nodes: nodes, Alarms: st.Alarms,
		Origin: st.Origin, VV: st.VV, Log: &st.Log, Fence: &st.Fence,
	})
	return nil
}

// nonNilAlarms makes every alarm list a JSON array, never null.
func nonNilAlarms(a *cluster.Alarms) {
	if a.Conflicts == nil {
		a.Conflicts = []cluster.Conflict{}
	}
	if a.Orphans == nil {
		a.Orphans = []cluster.Orphan{}
	}
	if a.HeldOps == nil {
		a.HeldOps = []cluster.HeldOp{}
	}
	if a.Clones == nil {
		a.Clones = []cluster.Clone{}
	}
	if a.Missing == nil {
		a.Missing = []cluster.Missing{}
	}
	if a.Mismatches == nil {
		a.Mismatches = []cluster.Mismatch{}
	}
	if a.CompactionBlockedBy == nil {
		a.CompactionBlockedBy = []string{}
	}
}

// routeCluster answers /cluster… on this node (spec §6.9).
func (s *Server) routeCluster(rc *Ctx) error {
	segs, m := rc.Segs, rc.R.Method
	info := httpx.From(rc.Ctx)
	switch {
	case len(segs) == 1 && m == http.MethodGet:
		info.Op = "AdminCluster"
		return s.clusterStatus(rc)
	case len(segs) == 3 && segs[1] == "nodes" && m == http.MethodDelete:
		info.Op = "AdminRetireNode"
		return s.retireNode(rc, segs[2])
	case len(segs) == 4 && segs[1] == "nodes" && (segs[3] == "drain" || segs[3] == "undrain") && m == http.MethodPost:
		info.Op = "AdminDrainNode"
		return s.routeMoves(rc)
	case len(segs) == 3 && segs[1] == "orphans" && m == http.MethodDelete:
		info.Op = "AdminDeleteOrphan"
		return s.deleteOrphan(rc, segs[2])
	}
	return notFound("no such admin endpoint")
}

// routeMoves answers the move and drain endpoints (spec §6.9, §6.10): in a cluster
// the mover registered with Extra does (package mover), a single node refuses them
// as the spec says.
func (s *Server) routeMoves(rc *Ctx) error {
	httpx.From(rc.Ctx).Op = "AdminMoves"
	if s.Cluster == nil {
		return conflict("bucket moves and node drains exist only in a cluster")
	}
	if s.Extra != nil {
		if handled, err := s.Extra(rc); handled || err != nil {
			return err
		}
	}
	return notFound("no such admin endpoint")
}

// movesUnavailable is the name admin.go routes /moves… to: the moves are answered
// by routeMoves.
func (s *Server) movesUnavailable(rc *Ctx) error { return s.routeMoves(rc) }

// retireNode implements DELETE /cluster/nodes/{id} (spec §6.9).
func (s *Server) retireNode(rc *Ctx, ref string) error {
	if s.Cluster == nil {
		return conflict("a single node has no other nodes to retire")
	}
	id := ref
	if p, ok := s.Cluster.PeerByID(ref); ok {
		id = p.ID
	} else if nid, ok := s.Cluster.NodeID(ref); ok && nid != "" {
		id = nid
	}
	err := s.Cluster.Retire(rc.Ctx, id)
	switch {
	case errors.Is(err, cluster.ErrSelf):
		return conflict("this node cannot retire itself: ask another node")
	case errors.Is(err, cluster.ErrUnknownNode):
		return notFound(fmt.Sprintf("node %q is not known to this cluster", ref))
	case errors.Is(err, cluster.ErrHomesBuckets):
		return conflict("the catalog still lists buckets homed on this node: " + err.Error() +
			" (drop each with DELETE /buckets/{name}?catalog_only=true, or move it away first)")
	case err != nil:
		return internalErr(err)
	}
	rc.W.WriteHeader(http.StatusNoContent)
	return nil
}

// deleteOrphan implements DELETE /cluster/orphans/{generation} on this node
// (spec §6.9): the local data of a bucket the catalog gives to another home,
// epoch or generation, or no longer lists. The catalog is not touched: its entry
// for the name, if any, belongs to someone else.
func (s *Server) deleteOrphan(rc *Ctx, generation string) error {
	if s.Cluster == nil {
		return conflict("a single node has no orphans")
	}
	var found *meta.Bucket
	for after := ""; found == nil; {
		bs, err := s.Eng.DB.Read().ListBuckets(rc.Ctx, after, 500)
		if err != nil {
			return internalErr(err)
		}
		for _, b := range bs {
			after = b.Name
			if b.Generation == generation {
				found = b
				break
			}
		}
		if len(bs) < 500 {
			break
		}
	}
	if found == nil {
		return notFound(fmt.Sprintf("this node holds no bucket with generation %q", generation))
	}
	orphan, why, err := s.Cluster.IsOrphan(rc.Ctx, cluster.LocalBucket{Name: found.Name, Generation: found.Generation})
	if err != nil {
		return internalErr(err)
	}
	if !orphan {
		return conflict(fmt.Sprintf("bucket %q (generation %s) is served by this node, not an orphan: delete it with DELETE /buckets/%s", found.Name, generation, found.Name))
	}
	name := found.Name
	var uploads []string
	err = s.Eng.DB.Update(rc.Ctx, func(tx *meta.Tx) error {
		uploads = nil
		b, err := tx.GetBucket(rc.Ctx, name)
		if err != nil {
			return err
		}
		if b.Generation != generation {
			return meta.ErrNotFound // replaced meanwhile
		}
		us, _ := tx.ListUploads(rc.Ctx, name, "", "", "", 1_000_000)
		for _, u := range us {
			uploads = append(uploads, u.UploadID)
		}
		if err := tx.ReleaseBucketBlobs(rc.Ctx, name); err != nil {
			return err
		}
		if s.OnBucketDeleteTx != nil {
			if err := s.OnBucketDeleteTx(rc.Ctx, tx, name); err != nil {
				return err
			}
		}
		return tx.DeleteBucket(rc.Ctx, name)
	})
	switch {
	case errors.Is(err, meta.ErrNotFound):
		return notFound(fmt.Sprintf("this node holds no bucket with generation %q any more", generation))
	case err != nil:
		return internalErr(err)
	}
	for _, id := range uploads {
		_ = s.Eng.Store.RemoveUpload(id)
	}
	s.Tokens.InvalidateBucket(name)
	if s.OnBucketDeleted != nil {
		s.OnBucketDeleted(name)
	}
	s.Log.Warn("deleted the local data of an orphaned bucket", "bucket", name, "generation", generation, "reason", why)
	rc.W.WriteHeader(http.StatusNoContent)
	return nil
}
