package app

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/http"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/admin"
	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/clusteradmin"
	"github.com/kalevski/toolcase/binvault/internal/forward"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/mover"
)

// Options are the parts of a node that tests, and nothing else, need to control.
type Options struct {
	// PeerListener is an already bound socket for the peer listener of a cluster
	// node. An in-process cluster needs it: every node's peer URL must be known
	// before any node starts. Nil binds BINVAULT_CLUSTER_LISTEN.
	PeerListener net.Listener
	// ClusterTuning shrinks the cluster's timers (hello interval, fence poll, …).
	ClusterTuning cluster.Tuning
	// MoverTuning shrinks the timers of bucket moves (back-off, activation timeout, …).
	MoverTuning mover.Tuning
	// PeerWrap, when set, wraps the handler of the peer listener: tests use it to
	// delay, break or count peer calls.
	PeerWrap func(http.Handler) http.Handler
	// FreeDisk overrides the free bytes this node reports (hello, bucket moves): tests
	// make a node look full with it.
	FreeDisk func() int64
}

// reconcileEvery is how often a cluster node compares its local buckets, tokens
// and attachments with the catalog and publishes what is missing there (a
// publication that failed after the local change, spec §8.2).
const reconcileEvery = 2 * time.Minute

// clusterRT is the cluster side of a node (spec §8). It exists only when
// BINVAULT_CLUSTER_URLS is set; a node without it has none of this: no cluster
// node, no peer listener, no forwarding, the same behaviour as before clusters.
type clusterRT struct {
	a    *App
	node *cluster.Node
	fwd  *forward.Forwarder
	adm  *clusteradmin.Router
	peer *httpx.Server

	// booted is set once the start-up fence has ended and the boot sequence has
	// published what the catalog lacks: from then on the node serves buckets
	// (/_healthz says 503 starting until then, §9.3).
	booted atomic.Bool
	// mv moves buckets to and from this node (§8.8).
	mv *mover.Mover

	closeOnce sync.Once
}

// newCluster builds the cluster node and the objects that serve it. The listeners
// are created by buildServers, which wraps the handlers.
func (a *App) newCluster(opts Options) error {
	cfg := a.Cfg
	freeDisk := opts.FreeDisk
	if freeDisk == nil {
		freeDisk = func() int64 {
			free, err := a.Store.FreeBytes()
			if err != nil {
				return 0
			}
			return int64(free)
		}
	}
	c := &clusterRT{a: a}
	node, err := cluster.New(cluster.Options{
		Config: cfg, DB: a.DB, NodeID: a.NodeID, Ring: a.Ring, Log: a.Log, Registry: a.Registry, Version: a.Build.Version,
		FreeDisk:     freeDisk,
		LocalBuckets: a.localBuckets,
		Tuning:       opts.ClusterTuning,
	})
	if err != nil {
		return fmt.Errorf("cluster: %w", err)
	}
	c.node = node
	a.cl = c
	a.Pipes.SetCluster(node)
	node.OnChange(c.onChange)
	c.mv, err = mover.New(mover.Options{
		Cfg: cfg, DB: a.DB, Store: a.Store, Node: node, Gate: a.Eng.Gate, Ring: a.Ring, Pipes: a.Pipes, Log: a.Log,
		Registry: a.Registry, Ready: c.booted.Load, FreeDisk: freeDisk, BucketGone: a.bucketGone, Tuning: opts.MoverTuning,
	})
	if err != nil {
		return fmt.Errorf("cluster: %w", err)
	}
	return nil
}

// localBuckets lists the buckets this node holds, for the orphan and `missing`
// alarms (spec §6.9), each with the epoch of the local copy. A copy that a bucket
// move is still receiving, or has just handed over and is about to remove, is not
// listed: it is neither an orphan nor served, it belongs to the move.
func (a *App) localBuckets(ctx context.Context) ([]cluster.LocalBucket, error) {
	var out []cluster.LocalBucket
	for after := ""; ; {
		bs, err := a.DB.Read().ListBuckets(ctx, after, 500)
		if err != nil {
			return nil, err
		}
		for _, b := range bs {
			after = b.Name
			if a.cl != nil && a.cl.mv != nil && a.cl.mv.InMove(b.Name) {
				continue
			}
			out = append(out, cluster.LocalBucket{Name: b.Name, Generation: b.Generation, Epoch: b.Epoch})
		}
		if len(bs) < 500 {
			return out, nil
		}
	}
}

// wire connects the cluster node to the servers: forwarding on the public
// listener, the peer listener's handlers, admin routing.
func (c *clusterRT) wire() {
	a := c.a
	c.fwd = forward.New(forward.Options{
		Node: c.node, S3: a.S3, Cfg: a.Cfg, Log: a.Log, Registry: a.Registry, Ready: c.booted.Load,
	})
	c.adm = &clusteradmin.Router{Admin: a.Admin, Node: c.node, Cfg: a.Cfg, Log: a.Log, Ready: c.booted.Load}
	// an orphan's data is kept as it is (spec §8.5), and so is a bucket this node
	// cannot place in the catalog yet: no run, backfill walk or upload expiry
	// touches it
	a.Pipes.SetServedBy(func(name string) bool { return c.booted.Load() && c.serves(name) })
	a.Eng.Skip = func(name string) bool { return !c.booted.Load() || !c.serves(name) }
	a.S3.Router = c.fwd.Route
	a.S3.Forwarded = c.fwd.Check
	a.S3.Gate = c.gate
	a.Admin.Cluster = c.node
	a.Admin.Router = c.adm.Route
	c.node.Mux().SetForward(http.HandlerFunc(c.fwd.Handle))
	c.node.Mux().RegisterPeer(clusteradmin.PeerAdminPath, http.HandlerFunc(c.adm.ServePeerAdmin))
	c.node.Mux().RegisterPeer(mover.PathPrefix, c.mv)
	pipesRoutes := a.Admin.Extra
	a.Admin.Extra = func(rc *admin.Ctx) (bool, error) {
		if handled, err := c.mv.Routes(rc); handled || err != nil {
			return handled, err
		}
		if pipesRoutes != nil {
			return pipesRoutes(rc)
		}
		return false, nil
	}
	pipesStatus := a.Admin.StatusExtra
	a.Admin.StatusExtra = func(rc *admin.Ctx, out map[string]any) {
		if pipesStatus != nil {
			pipesStatus(rc, out)
		}
		c.mv.StatusExtra(rc, out)
	}
}

// peerServer builds the peer listener (spec §8.3, §8.4): TLS from
// BINVAULT_CLUSTER_TLS_CERT_FILE / _KEY_FILE, plain HTTP only with
// BINVAULT_CLUSTER_INSECURE_HTTP (config checked that). Peer-API chatter is not
// logged; forwarded client requests and relayed admin calls are, under the id they
// carry from the entry node.
func (c *clusterRT) peerServer(ln net.Listener, wrap func(http.Handler) http.Handler, onDone func(*httpx.Info, time.Duration)) error {
	a := c.a
	var inner http.Handler = c.node.Handler()
	if wrap != nil {
		inner = wrap(inner)
	}
	h := httpx.Wrap(inner, httpx.Options{
		Log: a.Log, Node: a.nodeName(), IdleTimeout: a.Cfg.BodyIdleTimeout,
		RequestID: forward.PeerRequestID(c.node), ClientAddr: forward.PeerClientAddr(c.node),
		OnDone: func(i *httpx.Info, d time.Duration) {
			if i.Op != "" { // S3 and admin operations only, not the peer API's own calls
				onDone(i, d)
			}
		},
		Quiet: func(r *http.Request) bool {
			if _, forwarded := r.Header[cluster.HeaderOrigin]; forwarded {
				return false
			}
			p, _ := httpx.SplitRequestURI(r)
			return strings.HasPrefix(p, cluster.PeerPrefix) && p != clusteradmin.PeerAdminPath
		},
	})
	srv, err := httpx.NewServer(httpx.ServerConfig{
		Name: "peer", Addr: a.Cfg.ClusterListen, Listener: ln, Handler: h, HeaderTimeout: a.Cfg.HeaderTimeout,
		TLSCertFile: a.Cfg.ClusterTLSCertFile, TLSKeyFile: a.Cfg.ClusterTLSKeyFile, Log: a.Log,
	})
	if err != nil {
		return fmt.Errorf("peer listener: %w", err)
	}
	c.peer = srv
	return nil
}

// ---- serving a bucket -----------------------------------------------------------------

// gate is s3.Server.Gate: wherever the node resolves a local bucket it asks the
// catalog whether this node serves exactly this incarnation of it (spec §8.5). A
// bucket the catalog does not list is NoSuchBucket, local data or not; one the
// catalog homes here without matching local data answers 503, never NoSuchBucket
// (the `missing` alarm tells the operator). The local copy must also be at the
// epoch the catalog gives the bucket (spec §8.8): the old home of a move has
// recorded the new epoch the moment it handed the bucket over, so it stops serving
// at once, before the catalog's hand-off has replicated, and a copy that is behind
// the catalog (restored from an older backup) is never served. A bucket paused or
// frozen for a move is refused by engine.Gate, after this check.
func (c *clusterRT) gate(ctx context.Context, name string, local *meta.Bucket) error {
	rec, ok := c.node.Bucket(name)
	switch {
	case !ok:
		return apierr.New("NoSuchBucket", "The specified bucket does not exist.").WithExtra("BucketName", name)
	case rec.Home != c.node.ID():
		return apierr.New("ServiceUnavailable", "The bucket moved to another node; retry.").WithHeader("Retry-After", "1")
	case local == nil || local.Generation != rec.Generation:
		return apierr.New("ServiceUnavailable", "This node has no data for the bucket the catalog gives it; retry later.").WithHeader("Retry-After", "5")
	case local.Epoch != rec.Epoch:
		return apierr.New("ServiceUnavailable", "The bucket is changing nodes; retry.").WithHeader("Retry-After", "1")
	}
	return nil
}

// serves reports whether this node serves a local bucket: the catalog lists it
// with this node as home, and the local data is that incarnation at that epoch, and
// nothing is freezing it. Background jobs that act on local buckets (lifecycle)
// leave the others alone — a bucket being moved is not changed under the move.
func (c *clusterRT) serves(name string) bool {
	rec, ok := c.node.Bucket(name)
	if !ok || rec.Home != c.node.ID() {
		return false
	}
	b, err := c.a.DB.Read().GetBucket(context.Background(), name)
	return err == nil && b.Generation == rec.Generation && b.Epoch == rec.Epoch && !c.a.Eng.Gate.Frozen(name)
}

// PauseBucket makes this node answer 503 SlowDown for the bucket, reads included,
// until ResumeBucket: it is engine.Gate.Pause, which a bucket move uses (§8.8).
func (a *App) PauseBucket(name string) { a.Eng.Gate.Pause(name) }

// ResumeBucket lifts PauseBucket.
func (a *App) ResumeBucket(name string) { a.Eng.Gate.Thaw(name) }

// bucketGone drops what the node caches about a bucket whose rows have left it (a
// move's cleanup, spec §8.8 step 6).
func (a *App) bucketGone(name string) {
	a.Tokens.InvalidateBucket(name)
	if a.limiters != nil {
		a.limiters.ForgetBucket(name)
	}
}

// Cluster is this node's cluster agent; nil on a single node.
func (a *App) Cluster() *cluster.Node {
	if a.cl == nil {
		return nil
	}
	return a.cl.node
}

// ClusterReady reports whether the node has finished its cluster start-up (true
// on a single node).
func (a *App) ClusterReady() bool { return a.cl == nil || a.cl.booted.Load() }

// PeerAddr is the bound address of the peer listener ("" on a single node).
func (a *App) PeerAddr() string {
	if a.cl == nil || a.cl.peer == nil {
		return ""
	}
	return a.cl.peer.Addr().String()
}

// ---- start-up ---------------------------------------------------------------------------

// start launches the cluster node: the peer listener must already answer, because
// the start-up fence asks every URL of the list, this node's own included, who it
// is (§8.5). The boot sequence runs once the fence has ended.
func (c *clusterRT) start(ctx context.Context, errc chan<- error) error {
	if err := c.node.Start(ctx); err != nil {
		return err
	}
	go func() {
		if err := c.boot(ctx); err != nil && ctx.Err() == nil {
			errc <- fmt.Errorf("cluster start-up: %w", err)
		}
	}()
	return nil
}

// boot is what a node does between the end of the fence and serving buckets
// (spec §8.5, §9.3): materialise the catalog's pipelines (what changed while the
// node was down), publish the buckets, tokens and pipelines the catalog lacks (a
// single node's data dir joining a cluster keeps everything it has), and only then
// open for business.
func (c *clusterRT) boot(ctx context.Context) error {
	a := c.a
	if err := c.node.WaitReady(ctx); err != nil {
		return err
	}
	if err := a.Pipes.SyncCatalog(ctx); err != nil {
		return fmt.Errorf("pipelines: %w", err)
	}
	if err := c.publishLocal(ctx); err != nil {
		return fmt.Errorf("publishing local state: %w", err)
	}
	// what a restart means for the bucket moves on disk: a bucket in its cutover stays
	// out of service, a copy that was never activated goes (spec §8.8, §9.4)
	if err := c.mv.Recover(ctx); err != nil {
		return fmt.Errorf("bucket moves: %w", err)
	}
	c.booted.Store(true)
	if err := a.Pipes.Start(ctx); err != nil {
		return fmt.Errorf("pipelines: %w", err)
	}
	c.mv.Start(ctx)
	done, silent, stream := c.node.Fence()
	a.Log.Info("cluster node ready", "node", a.nodeName(), "fence_done", done, "silent", silent, "stream", stream)
	go c.reconcileLoop(ctx)
	return nil
}

func (c *clusterRT) reconcileLoop(ctx context.Context) {
	t := time.NewTicker(reconcileEvery)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
		}
		if err := c.publishLocal(ctx); err != nil && ctx.Err() == nil {
			c.a.Log.Warn("reconciling the local state with the catalog failed", "error", err)
		}
	}
}

// publishLocal makes the catalog know what this node holds (spec §8.2, §8.5): a
// bucket with no register at all — a single node joining a cluster, or a creation
// whose catalog write failed — is published with its local generation, attachment
// names and creation time; so are the access keys of the buckets the catalog homes
// here. A register that exists, live or a tombstone, is the catalog's decision: a
// bucket the catalog gives to another home, generation or epoch, or has dropped
// (a `catalog_only` delete), is an orphan and is never published. The names of the
// attached pipelines are refreshed for every bucket this node homes.
func (c *clusterRT) publishLocal(ctx context.Context) error {
	a := c.a
	published := 0
	// the first publication of a node is the single-node upgrade: every local bucket
	// is new to the catalog. After it a bucket without a register is an orphan —
	// say, one dropped with catalog_only whose tombstone was compacted away — unless
	// its creation left the "to be published" marker (a crash before the write)
	_, ferr := a.DB.Read().KVGet(ctx, meta.ClusterPublishedKey)
	first := errors.Is(ferr, meta.ErrNotFound)
	if ferr != nil && !first {
		return ferr
	}
	for after := ""; ; {
		bs, err := a.DB.Read().ListBuckets(ctx, after, 200)
		if err != nil {
			return err
		}
		for _, b := range bs {
			after = b.Name
			homed := false
			reg, err := c.node.Register(ctx, cluster.KindBucket, b.Name)
			switch {
			case errors.Is(err, cluster.ErrNotFound):
				if !first {
					if pending, perr := a.DB.Read().KVGet(ctx, meta.PublishPendingKey(b.Name)); perr != nil || pending != b.Generation {
						continue // an orphan the catalog does not know (spec §8.5)
					}
				}
				names, err := a.Pipes.AttachmentNames(ctx, b.Name)
				if err != nil {
					return err
				}
				_, err = c.node.CreateBucket(ctx, b.Name, cluster.BucketEntry{
					Home: c.node.ID(), Epoch: b.Epoch, Generation: b.Generation, CreatedAt: b.CreatedAt.UnixMilli(), Pipelines: names,
				})
				switch {
				case err == nil:
					homed = true
					published++
					_ = a.DB.Update(ctx, func(tx *meta.Tx) error { return tx.KVDelete(ctx, meta.PublishPendingKey(b.Name)) })
				case errors.Is(err, cluster.ErrExists):
					// created elsewhere in the meantime: the catalog decides
				default:
					return fmt.Errorf("bucket %s: %w", b.Name, err)
				}
			case err != nil:
				return err
			default:
				rec, ok := c.node.Bucket(b.Name)
				homed = ok && !reg.Deleted && rec.Home == c.node.ID() && rec.Generation == b.Generation && rec.Epoch == b.Epoch
			}
			if !homed {
				continue
			}
			if err := a.Pipes.PublishAttachments(ctx, b.Name); err != nil {
				return fmt.Errorf("bucket %s: %w", b.Name, err)
			}
			if err := c.publishKeys(ctx, b.Name); err != nil {
				return fmt.Errorf("bucket %s: %w", b.Name, err)
			}
		}
		if len(bs) < 200 {
			break
		}
	}
	if first {
		if err := a.DB.Update(ctx, func(tx *meta.Tx) error { return tx.KVSet(ctx, meta.ClusterPublishedKey, "1") }); err != nil {
			return err
		}
	}
	if published > 0 {
		a.Log.Info("published local buckets to the cluster catalog", "buckets", published)
	}
	return nil
}

// publishKeys writes key/<access key id> for the tokens of a bucket the catalog
// has no entry for.
func (c *clusterRT) publishKeys(ctx context.Context, bucket string) error {
	for after := ""; ; {
		ts, err := c.a.DB.Read().ListTokens(ctx, bucket, after, 200)
		if err != nil {
			return err
		}
		var drafts []cluster.Draft
		for _, t := range ts {
			after = t.AccessKeyID
			if _, err := c.node.Register(ctx, cluster.KindKey, t.AccessKeyID); errors.Is(err, cluster.ErrNotFound) {
				drafts = append(drafts, cluster.PutKeyDraft(t.AccessKeyID, cluster.KeyEntry{Bucket: bucket}))
			} else if err != nil {
				return err
			}
		}
		if len(drafts) > 0 {
			if _, err := c.node.Write(ctx, drafts...); err != nil {
				return err
			}
		}
		if len(ts) < 200 {
			return nil
		}
	}
}

// onChange is the catalog subscriber (cluster.Node.OnChange): pipeline registers
// become local pipelines (the pipeline package), and a bucket register another
// node wrote for a bucket this node homes is checked against the local truth. A
// register is last-writer-wins, so a concurrent write — a hand-off that arrives
// after the new home attached a pipeline — can leave the entry with stale
// attachment names; the home republishes what differs (§8.5).
func (c *clusterRT) onChange(changes []cluster.Change) {
	c.a.Pipes.OnCatalogChange(changes)
	for _, ch := range changes {
		if ch.Kind != cluster.KindBucket || ch.Local || ch.Deleted {
			continue
		}
		if err := c.a.Pipes.PublishAttachments(context.Background(), ch.Name); err != nil {
			c.a.Log.Warn("republishing a bucket's attachment names failed", "bucket", ch.Name, "error", err)
		}
	}
}

// ---- shutdown --------------------------------------------------------------------------------

// drain tells the peers that this node is shutting down, so that they answer 503
// for its buckets at once instead of waiting for a timeout (spec §9.4).
func (c *clusterRT) drain() { c.node.SetDraining(true) }

// shutdown stops the peer listener — requests peers forwarded here finish within
// the grace period — and the cluster node.
func (c *clusterRT) shutdown(ctx context.Context) {
	if c.peer != nil {
		_ = c.peer.Shutdown(ctx)
	}
}

// close ends the cluster node and drops what it holds open.
func (c *clusterRT) close() {
	c.closeOnce.Do(func() {
		if c.peer != nil {
			_ = c.peer.Close()
		}
		if c.fwd != nil {
			c.fwd.Close()
		}
		c.node.Stop()
	})
}
