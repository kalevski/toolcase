package mover

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/httpx"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
	"github.com/kalevski/toolcase/binvault/internal/store"
)

// The target's side of a move (spec §8.8): the handlers of the peer calls.
//
// A move on the target goes receiving → verified → activated, or ends abandoned.
// Blobs and part files arrive while the source keeps serving; each is placed on
// disk like a blob written here, with a row nobody references (so that neither the
// collector nor the orphan sweeper takes it), until the rows of the bucket arrive
// in one stream and are imported in one transaction. Only then does the target
// know it could serve the bucket, and only when the source asks to activate does it
// decide, once and durably: it either takes the bucket (and makes the catalog say
// so) or refuses for good.

// inMove is a move this node is receiving.
type inMove struct {
	// mu serialises the calls that change the move as a whole: rows, activate,
	// discard and the watchdog.
	mu   sync.Mutex
	id   string
	last atomic.Int64 // unix nanoseconds of the last call
	idle time.Duration
	// freeze is the source's freeze timeout: the rows stream may be silent that long
	// (the source reads its tables one after the other).
	freeze time.Duration

	upMu    sync.Mutex
	uploads map[string]struct{} // upload ids whose part files arrived
	// row mirrors the persisted state; guarded by mu.
	row meta.Move

	// completeOnce starts the completion of the activation, which runs detached from the
	// calls that ask for it (spec §8.8 step 5); completed is closed when it ends, and
	// completeErr (set before) says whether it was done.
	completeOnce sync.Once
	completed    chan struct{}
	completeErr  error
}

func (in *inMove) touch() { in.last.Store(time.Now().UnixNano()) }

// kvUploadKey is where the target records that part files of an upload arrived,
// so that an abandoned move can remove them whatever happens to the process.
func kvUploadKey(move, upload string) string { return "mv/" + move + "/u/" + upload }
func kvMovePrefix(move string) string        { return "mv/" + move + "/" }

func (m *Mover) in(id string) *inMove {
	m.mu.Lock()
	defer m.mu.Unlock()
	return m.ins[id]
}

// ProtectedUpload reports whether the directory of an upload holds part files of a
// move that is being received: the orphan sweeper must not remove it, however old,
// before the rows that make it an upload arrive.
func (m *Mover) ProtectedUpload(uploadID string) bool {
	m.mu.Lock()
	ins := make([]*inMove, 0, len(m.ins))
	for _, in := range m.ins {
		ins = append(ins, in)
	}
	m.mu.Unlock()
	for _, in := range ins {
		in.upMu.Lock()
		_, ok := in.uploads[uploadID]
		in.upMu.Unlock()
		if ok {
			return true
		}
	}
	return false
}

// ServeHTTP is the handler registered at /_peer/v1/moves/ (the mux has checked the
// cluster key).
func (m *Mover) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	rest := strings.TrimPrefix(r.URL.Path, PathPrefix)
	parts := strings.Split(rest, "/")
	id := parts[0]
	if !validMoveID(id) {
		writeReply(w, http.StatusNotFound, reply{Result: resultRefused, Detail: "no such move"})
		return
	}
	if !m.started.Load() || (m.o.Ready != nil && !m.o.Ready()) {
		writeReply(w, http.StatusServiceUnavailable, reply{Result: "unavailable", Detail: "this node is starting"})
		return
	}
	method := r.Method
	switch {
	case len(parts) == 2 && parts[1] == "prepare" && method == http.MethodPost:
		m.handlePrepare(w, r, id)
	case len(parts) == 3 && parts[1] == "blob" && method == http.MethodPut:
		m.handleBlob(w, r, id, parts[2])
	case len(parts) == 4 && parts[1] == "part" && method == http.MethodPut:
		m.handlePart(w, r, id, parts[2], parts[3])
	case len(parts) == 2 && parts[1] == "rows" && method == http.MethodPost:
		m.handleRows(w, r, id)
	case len(parts) == 2 && parts[1] == "activate" && method == http.MethodPost:
		m.handleActivate(w, r, id)
	case len(parts) == 2 && parts[1] == "discard" && method == http.MethodPost:
		m.handleDiscard(w, r, id)
	case len(parts) == 1 && method == http.MethodGet:
		m.handleStatus(w, r, id)
	default:
		writeReply(w, http.StatusNotFound, reply{Result: resultRefused, Detail: "no such move endpoint"})
	}
}

// ---- prepare ----------------------------------------------------------------------------------

func (m *Mover) handlePrepare(w http.ResponseWriter, r *http.Request, id string) {
	var req prepareReq
	if err := decodeJSON(r, &req, 1<<16); err != nil {
		writeReply(w, http.StatusBadRequest, reply{Result: resultRefused, Detail: "the prepare request is not valid: " + err.Error()})
		return
	}
	if !cluster.ValidBucketName(req.Bucket) || req.Generation == "" || req.Epoch < 1 || req.Bytes < 0 || !cluster.ValidNodeID(req.From) {
		writeReply(w, http.StatusBadRequest, reply{Result: resultRefused, Detail: "the prepare request names no valid bucket, generation, epoch or source"})
		return
	}
	ctx := r.Context()
	// a repeated prepare (the answer got lost) is answered the same
	if row, err := m.loadMove(ctx, id); err == nil {
		switch {
		case row.Role == meta.MoveIn && (row.State == meta.MoveReceiving || row.State == meta.MoveVerified) && row.Bucket == req.Bucket && row.Epoch == req.Epoch:
			if in := m.in(id); in != nil {
				in.touch()
				// the source asks again after a "not yet" (its freeze was lifted for it): it is
				// not worth freezing the bucket again before the pipeline has arrived
				if row.State == meta.MoveReceiving {
					if p := m.missingPipeline(ctx, req.Bucket, 3*time.Second); p != "" {
						writeReply(w, http.StatusConflict, reply{Result: resultBusy, Detail: (&pipelineLag{pipeline: p}).Error()})
						return
					}
				}
				writeReply(w, http.StatusOK, reply{Result: resultOK})
				return
			}
		}
		refused(w, "this node already has a record of move %s (%s)", id, row.State)
		return
	} else if !errors.Is(err, meta.ErrNotFound) {
		writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: err.Error()})
		return
	}
	if why := m.refusal(ctx, &req); why != "" {
		m.met.refusals.Inc(refusalReason(why))
		m.log.Info("move: refused as target", "move", id, "bucket", req.Bucket, "from", m.nodeName(req.From), "why", why)
		refused(w, "%s", why)
		return
	}
	// a bucket attached to a pipeline whose register has not reached this node yet
	// cannot be received: not now, and nothing has been copied yet
	if p := m.missingPipeline(ctx, req.Bucket, 3*time.Second); p != "" {
		lag := &pipelineLag{pipeline: p}
		m.log.Info("move: the target waits for a pipeline", "move", id, "bucket", req.Bucket, "pipeline", p)
		writeReply(w, http.StatusConflict, reply{Result: resultBusy, Detail: lag.Error()})
		return
	}
	if !m.tryAcquire() {
		writeReply(w, http.StatusConflict, reply{Result: resultBusy, Detail: detailAnotherMove})
		return
	}
	keep := false
	defer func() {
		if !keep {
			m.release()
		}
	}()
	row := meta.Move{ID: id, Role: meta.MoveIn, Bucket: req.Bucket, Generation: req.Generation, Peer: req.From,
		State: meta.MoveReceiving, Epoch: req.Epoch, BytesTotal: req.Bytes, CreatedAt: m.now()}
	now := m.now()
	row.StartedAt = &now
	if err := m.update(ctx, func(tx *meta.Tx) error { return tx.InsertMove(ctx, &row) }); err != nil {
		writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: err.Error()})
		return
	}
	idle := m.tune.IdleTimeout + 2*time.Duration(req.FreezeTimeoutMS)*time.Millisecond
	in := &inMove{id: id, row: row, idle: idle, freeze: time.Duration(req.FreezeTimeoutMS) * time.Millisecond, uploads: map[string]struct{}{}}
	in.touch()
	m.mu.Lock()
	m.ins[id] = in
	m.owned[req.Bucket] = id
	m.mu.Unlock()
	m.met.active.Add(1)
	keep = true
	m.log.Info("move: receiving", "move", id, "bucket", req.Bucket, "from", m.nodeName(req.From), "bytes", req.Bytes, "epoch", req.Epoch)
	writeReply(w, http.StatusOK, reply{Result: resultOK})
}

// refusal says why this node cannot take the bucket ("" if it can).
func (m *Mover) refusal(ctx context.Context, req *prepareReq) string {
	n := m.o.Node
	switch {
	case n.Draining():
		return "the target node is shutting down"
	case n.Cordoned():
		return "the target node is cordoned: it takes no new buckets"
	}
	if _, err := m.o.DB.Read().GetBucket(ctx, req.Bucket); err == nil {
		return fmt.Sprintf("the target node already holds a bucket named %q (an orphan: delete it with DELETE /cluster/orphans first)", req.Bucket)
	}
	rec, ok := n.Bucket(req.Bucket)
	if !ok {
		sctx, cancel := context.WithTimeout(ctx, 3*time.Second)
		n.SyncNow(sctx)
		cancel()
		rec, ok = n.Bucket(req.Bucket)
	}
	switch {
	case !ok:
		return "the catalog of the target node does not list the bucket (yet)"
	case rec.Generation != req.Generation:
		return "the catalog of the target node lists another incarnation of the bucket"
	case rec.Home != req.From || rec.Epoch+1 != req.Epoch:
		return fmt.Sprintf("the catalog of the target node does not list the bucket as homed on the source at epoch %d (home %s, epoch %d)", req.Epoch-1, m.nodeName(rec.Home), rec.Epoch)
	}
	if free := m.o.FreeDisk(); free < req.Bytes+m.tune.Margin {
		return fmt.Sprintf("not enough free disk on the target node: %d bytes free, %d needed (the bucket's bytes plus a margin)", free, req.Bytes+m.tune.Margin)
	}
	for _, s := range req.KeyIDs {
		id, err := seal.ParseKeyID(s)
		if err != nil {
			return fmt.Sprintf("the key id %q is not valid", s)
		}
		if m.o.Ring == nil || !m.o.Ring.Can(id) {
			return fmt.Sprintf("the target node cannot open the master key %s that the bucket's sealed values use", id)
		}
	}
	return ""
}

func refusalReason(why string) string {
	switch {
	case strings.Contains(why, "free disk"):
		return "disk"
	case strings.Contains(why, "master key"):
		return "key"
	case strings.Contains(why, "already holds"):
		return "exists"
	case strings.Contains(why, "cordoned"), strings.Contains(why, "shutting down"):
		return "unavailable"
	}
	return "catalog"
}

// pipelineLag is the target's "not yet": its catalog does not hold a pipeline the
// bucket is attached to — the register is still on its way here (replication lags a
// little behind the node that made the change) — so it can neither keep nor drop the
// attachment. It is answered `busy`, which the source takes as "ask again later".
type pipelineLag struct{ pipeline string }

func (e *pipelineLag) Error() string {
	return fmt.Sprintf("pipeline %q has not reached the target node yet", e.pipeline)
}

// missingPipeline names a pipeline that the catalog says the bucket is attached to
// and that the catalog of this node does not hold yet ("" if there is none). It asks
// the peers for what is new once, for at most wait, before it says so.
func (m *Mover) missingPipeline(ctx context.Context, bucket string, wait time.Duration) string {
	n := m.o.Node
	find := func() string {
		rec, ok := n.Bucket(bucket)
		if !ok {
			return ""
		}
		for _, p := range rec.Pipelines {
			if _, _, exists := n.PipelineGeneration(p); !exists {
				return p
			}
		}
		return ""
	}
	if find() == "" {
		return ""
	}
	sctx, cancel := context.WithTimeout(ctx, wait)
	n.SyncNow(sctx)
	cancel()
	return find()
}

// answerLag tells the source that a pipeline of the bucket is not here yet.
func (m *Mover) answerLag(w http.ResponseWriter, id, bucket string, lag *pipelineLag) {
	m.log.Info("move: the rows wait for a pipeline that has not reached this node", "move", id, "bucket", bucket, "pipeline", lag.pipeline)
	// pull what is new now, so that the source's next attempt finds it
	go func() {
		ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
		defer cancel()
		m.o.Node.SyncNow(ctx)
	}()
	writeReply(w, http.StatusConflict, reply{Result: resultBusy, Detail: lag.Error()})
}

// receiving returns the live move a blob, part or rows call is for.
func (m *Mover) receiving(w http.ResponseWriter, id string) *inMove {
	in := m.in(id)
	if in != nil {
		in.mu.Lock()
		st := in.row.State
		in.mu.Unlock()
		if st == meta.MoveReceiving {
			in.touch()
			return in
		}
	}
	refused(w, "move %s is not receiving on this node", id)
	return nil
}

// ---- blobs and parts ---------------------------------------------------------------------

type fileHeaders struct {
	size, plain int64
	sse         bool
}

func parseFileHeaders(r *http.Request) (fileHeaders, error) {
	var h fileHeaders
	var err error
	if h.size, err = strconv.ParseInt(r.Header.Get(HeaderSize), 10, 64); err != nil || h.size < 0 {
		return h, fmt.Errorf("%s must be a size in bytes", HeaderSize)
	}
	h.plain = h.size
	if v := r.Header.Get(HeaderPlainSize); v != "" {
		if h.plain, err = strconv.ParseInt(v, 10, 64); err != nil || h.plain < 0 {
			return h, fmt.Errorf("%s must be a size in bytes", HeaderPlainSize)
		}
	}
	h.sse = r.Header.Get(HeaderSSE) == "1"
	return h, nil
}

// receiveFile stages the body, checks it against the announced size and the
// digest the sender puts in the trailer, and returns the staged file (closed and
// synced), or answers the request itself and returns nil.
func (m *Mover) receiveFile(w http.ResponseWriter, r *http.Request, size int64) *store.Staged {
	st, err := m.o.Store.NewStaged()
	if err != nil {
		writeReply(w, http.StatusInsufficientStorage, reply{Result: "error", Detail: "cannot stage the file: " + err.Error()})
		return nil
	}
	body := httpx.NewIdleReader(w, r.Body, m.cfg.BodyIdleTimeout, httpx.From(r.Context()))
	h := sha256.New()
	// one byte more than announced is read: a longer body is a mismatch, and reading
	// to the end of the body is what makes net/http parse the trailer
	n, err := io.Copy(io.MultiWriter(st.File, h), io.LimitReader(body, size+1))
	if err != nil {
		st.Discard()
		writeReply(w, http.StatusBadRequest, reply{Result: "error", Detail: "the body could not be read: " + err.Error()})
		return nil
	}
	if n != size {
		st.Discard()
		refused(w, "the body has %d bytes (or more), %s announced %d", n, HeaderSize, size)
		return nil
	}
	want := r.Trailer.Get(TrailerDigest)
	if want == "" {
		st.Discard()
		refused(w, "the sha256 trailer is missing (is something in front of the peer listener dropping HTTP trailers?)")
		return nil
	}
	if !strings.EqualFold(want, hex.EncodeToString(h.Sum(nil))) {
		st.Discard()
		refused(w, "the sha256 of the body is not the one in the trailer")
		return nil
	}
	if err := m.o.Store.Sync(st.File); err != nil {
		st.Discard()
		writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: "cannot sync the file: " + err.Error()})
		return nil
	}
	if err := st.File.Close(); err != nil {
		st.Discard()
		writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: err.Error()})
		return nil
	}
	st.File = nil
	return st
}

func (m *Mover) handleBlob(w http.ResponseWriter, r *http.Request, id, blobID string) {
	in := m.receiving(w, id)
	if in == nil {
		return
	}
	if !store.ValidID(blobID) {
		writeReply(w, http.StatusBadRequest, reply{Result: resultRefused, Detail: "not a blob id"})
		return
	}
	fh, err := parseFileHeaders(r)
	if err != nil {
		writeReply(w, http.StatusBadRequest, reply{Result: resultRefused, Detail: err.Error()})
		return
	}
	ctx := r.Context()
	placed := func() error {
		return m.update(ctx, func(tx *meta.Tx) error {
			return tx.InsertPlacedBlob(ctx, &meta.Blob{BlobID: blobID, Bucket: in.row.Bucket, Size: fh.size, PlainSize: fh.plain, SSE: fh.sse})
		})
	}
	// already here (an earlier pass, or a retry, or a blob that waits for the collector
	// from the time this node held the bucket): answered before the body is read, so that
	// a sender that waits for 100-continue does not send it again. The file is looked at
	// again inside the transaction that takes its row (back): the collector unlinks
	// inside its own, so one of the two sees the other and a row never points at a file
	// that was just collected.
	if n, err := m.o.Store.Size(blobID); err == nil && n == fh.size {
		here := false
		err := m.update(ctx, func(tx *meta.Tx) error {
			here = false
			if n, err := m.o.Store.Size(blobID); err != nil || n != fh.size {
				return nil
			}
			here = true
			return tx.InsertPlacedBlob(ctx, &meta.Blob{BlobID: blobID, Bucket: in.row.Bucket, Size: fh.size, PlainSize: fh.plain, SSE: fh.sse})
		})
		if err != nil {
			writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: err.Error()})
			return
		}
		if here {
			writeReply(w, http.StatusOK, reply{Result: resultExists})
			return
		}
	}
	st := m.receiveFile(w, r, fh.size)
	if st == nil {
		return
	}
	if err := m.o.Store.Place(st.Path, blobID); err != nil {
		st.Discard()
		writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: "cannot place the blob: " + err.Error()})
		return
	}
	if err := placed(); err != nil {
		writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: err.Error()})
		return
	}
	// a move that was abandoned while the blob arrived: the abandon has removed the
	// rows it knew of, so this blob is removed here
	if !m.stillReceiving(in) {
		_ = m.o.Store.Remove(blobID)
		_ = m.update(ctx, func(tx *meta.Tx) error { return tx.DeleteBlobRows(ctx, []string{blobID}) })
		refused(w, "move %s is not receiving on this node", id)
		return
	}
	in.touch()
	writeReply(w, http.StatusOK, reply{Result: resultOK})
}

func (m *Mover) stillReceiving(in *inMove) bool {
	in.mu.Lock()
	defer in.mu.Unlock()
	return in.row.State == meta.MoveReceiving
}

func (m *Mover) handlePart(w http.ResponseWriter, r *http.Request, id, uploadID, partID string) {
	in := m.receiving(w, id)
	if in == nil {
		return
	}
	if !store.ValidID(uploadID) || !store.ValidID(partID) {
		writeReply(w, http.StatusBadRequest, reply{Result: resultRefused, Detail: "not an upload or part id"})
		return
	}
	fh, err := parseFileHeaders(r)
	if err != nil {
		writeReply(w, http.StatusBadRequest, reply{Result: resultRefused, Detail: err.Error()})
		return
	}
	ctx := r.Context()
	// the upload directory is recorded before the first part is placed in it
	in.upMu.Lock()
	_, known := in.uploads[uploadID]
	in.uploads[uploadID] = struct{}{} // protected from the sweeper from now on
	in.upMu.Unlock()
	if !known {
		if err := m.update(ctx, func(tx *meta.Tx) error { return tx.KVSet(ctx, kvUploadKey(id, uploadID), "1") }); err != nil {
			writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: err.Error()})
			return
		}
	}
	if n, err := m.o.Store.PartSize(uploadID, partID); err == nil && n == fh.size {
		writeReply(w, http.StatusOK, reply{Result: resultExists})
		return
	}
	st := m.receiveFile(w, r, fh.size)
	if st == nil {
		return
	}
	if err := m.o.Store.PlacePart(st.Path, uploadID, partID); err != nil {
		st.Discard()
		writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: "cannot place the part file: " + err.Error()})
		return
	}
	if !m.stillReceiving(in) {
		m.o.Store.RemovePart(uploadID, partID)
		refused(w, "move %s is not receiving on this node", id)
		return
	}
	in.touch()
	writeReply(w, http.StatusOK, reply{Result: resultOK})
}

// ---- rows ----------------------------------------------------------------------------------------

func (m *Mover) handleRows(w http.ResponseWriter, r *http.Request, id string) {
	in := m.receiving(w, id)
	if in == nil {
		return
	}
	in.mu.Lock()
	defer in.mu.Unlock()
	defer in.touch()
	if in.row.State != meta.MoveReceiving {
		refused(w, "the rows of move %s were received already", id)
		return
	}
	ctx := r.Context()
	// the stream is spooled to disk first: the writer of the database is held only
	// for the import itself, never while the network delivers (spec §8.8 step 4)
	spool, err := m.o.Store.NewStaged()
	if err != nil {
		writeReply(w, http.StatusInsufficientStorage, reply{Result: "error", Detail: "cannot spool the rows: " + err.Error()})
		return
	}
	defer spool.Discard()
	body := httpx.NewIdleReader(w, r.Body, max(m.cfg.BodyIdleTimeout, in.freeze), httpx.From(ctx))
	if _, err := io.Copy(spool.File, body); err != nil {
		writeReply(w, http.StatusBadRequest, reply{Result: "error", Detail: "the rows could not be read: " + err.Error()})
		return
	}
	// right before the import: a pipeline of the bucket that is not here yet makes it wait
	// (the import itself checks the attachments that really arrived; this is the cheap
	// look first, so that a big bucket is not imported to be rolled back)
	if p := m.missingPipeline(ctx, in.row.Bucket, time.Second); p != "" {
		m.answerLag(w, id, in.row.Bucket, &pipelineLag{pipeline: p})
		return
	}
	// nothing of the bucket may run on the target before it is activated: the runs and
	// backfills that arrive with the rows are held
	if err := m.o.Pipes.FreezeBucket(ctx, in.row.Bucket); err != nil {
		writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: err.Error()})
		return
	}
	var counts meta.Counts
	err = m.update(ctx, func(tx *meta.Tx) error {
		if _, err := spool.File.Seek(0, io.SeekStart); err != nil {
			return err
		}
		c, err := tx.ImportBucketWith(ctx, spool.File, meta.ImportOptions{Placed: true})
		if err != nil {
			return err
		}
		b, err := tx.GetBucket(ctx, in.row.Bucket)
		if err != nil {
			return err
		}
		if b.Generation != in.row.Generation {
			return fmt.Errorf("the rows are of another incarnation of the bucket (%s, not %s)", b.Generation, in.row.Generation)
		}
		// the pipelines are the catalog's: what was attached to one that has changed since the
		// rows were read does not move
		missing, err := m.o.Pipes.BucketImported(ctx, tx, in.row.Bucket)
		if err != nil {
			return err
		}
		if missing != "" {
			return &pipelineLag{pipeline: missing}
		}
		counts = c
		return nil
	})
	var lag *pipelineLag
	if errors.As(err, &lag) {
		m.answerLag(w, id, in.row.Bucket, lag)
		return
	}
	if err != nil {
		code := http.StatusUnprocessableEntity
		if errors.Is(err, meta.ErrExists) {
			code = http.StatusConflict
		}
		m.log.Warn("move: the rows were not accepted", "move", id, "bucket", in.row.Bucket, "error", err)
		writeReply(w, code, reply{Result: resultRefused, Detail: "importing the rows: " + err.Error()})
		return
	}
	if err := m.verifyFiles(ctx, in.row.Bucket); err != nil {
		m.log.Warn("move: a file of the copy is missing", "move", id, "bucket", in.row.Bucket, "error", err)
		writeReply(w, http.StatusUnprocessableEntity, reply{Result: resultRefused, Detail: err.Error()})
		return
	}
	var changed bool
	err = m.update(ctx, func(tx *meta.Tx) (err error) {
		changed, err = tx.MoveTransition(ctx, id, []string{meta.MoveReceiving}, meta.MoveVerified, "")
		return err
	})
	if err != nil || !changed {
		writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: "cannot record the verified copy"})
		return
	}
	in.row.State = meta.MoveVerified
	m.log.Info("move: the copy is verified", "move", id, "bucket", in.row.Bucket, "objects", counts["objects"], "blobs", counts["blobs"])
	writeReply(w, http.StatusOK, reply{Result: resultOK, Counts: counts})
}

// verifyFiles checks that every blob and part file the imported rows reference is
// on disk with the size the rows say (spec §8.8 step 4).
func (m *Mover) verifyFiles(ctx context.Context, bucket string) error {
	q := m.o.DB.Read()
	after := ""
	for {
		blobs, err := q.BucketBlobs(ctx, bucket, after, 1000)
		if err != nil {
			return err
		}
		for _, b := range blobs {
			after = b.BlobID
			if b.Refs <= 0 {
				continue
			}
			n, err := m.o.Store.Size(b.BlobID)
			switch {
			case err != nil:
				return fmt.Errorf("blob %s of the bucket's rows is not on the target node", b.BlobID)
			case n != b.Size:
				return fmt.Errorf("blob %s is %d bytes on the target node, %d in the rows", b.BlobID, n, b.Size)
			}
		}
		if len(blobs) < 1000 {
			break
		}
	}
	parts, err := q.BucketParts(ctx, bucket)
	if err != nil {
		return err
	}
	for _, p := range parts {
		n, err := m.o.Store.PartSize(p.UploadID, p.PartID)
		switch {
		case err != nil:
			return fmt.Errorf("part file %s/%s of the bucket's open uploads is not on the target node", p.UploadID, p.PartID)
		case n != p.StoredSize:
			return fmt.Errorf("part file %s/%s is %d bytes on the target node, %d in the rows", p.UploadID, p.PartID, n, p.StoredSize)
		}
	}
	return nil
}

// ---- activate ---------------------------------------------------------------------------------

func writeActivate(w http.ResponseWriter, id, result, reason string) {
	w.Header().Set("Content-Type", "application/json")
	w.Header().Set("Cache-Control", "no-store")
	w.WriteHeader(http.StatusOK)
	_ = jsonEncode(w, activateReply{Move: id, Result: result, Reason: reason})
}

// handleActivate is the one decision of the move (spec §8.8 step 5). It answers OK
// when this node holds the verified copy and has not abandoned the move — it then
// makes "home of the bucket at epoch + 1" durable, tells the catalog and starts
// serving — and REFUSED otherwise, for good: a refused move can never be activated
// afterwards. Activating twice is the same as activating once. Anything that is not
// one of those two answers is no answer at all to the source, which asks again.
func (m *Mover) handleActivate(w http.ResponseWriter, r *http.Request, id string) {
	ctx := r.Context()
	for attempt := 0; attempt < 3; attempt++ {
		row, err := m.loadMove(ctx, id)
		switch {
		case errors.Is(err, meta.ErrNotFound) || (err == nil && row.Role != meta.MoveIn):
			writeActivate(w, id, activateRefused, "this node has no record of the move")
			return
		case err != nil:
			writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: err.Error()})
			return
		}
		switch row.State {
		case meta.MoveActivated:
			if err := m.awaitActivation(ctx, row); err != nil {
				m.log.Warn("move: the activation is not complete yet", "move", id, "bucket", row.Bucket, "error", err)
				writeReply(w, http.StatusServiceUnavailable, reply{Result: "unavailable", Detail: err.Error()})
				return
			}
			writeActivate(w, id, activateOK, "")
			return
		case meta.MoveAbandoned:
			writeActivate(w, id, activateRefused, orDefault(row.Error, "the move was abandoned"))
			return
		case meta.MoveReceiving:
			m.abandonByID(ctx, id, "the source asked to activate before the rows were verified")
			continue
		case meta.MoveVerified:
			decided, why, err := m.decide(ctx, row)
			if err != nil {
				writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: err.Error()})
				return
			}
			if why != "" {
				writeActivate(w, id, activateRefused, why)
				return
			}
			if !decided {
				continue // the state changed under us: look again
			}
			continue // answered by the activated branch
		default:
			writeActivate(w, id, activateRefused, "the move is "+row.State)
			return
		}
	}
	writeReply(w, http.StatusServiceUnavailable, reply{Result: "unavailable", Detail: "the move keeps changing state"})
}

func orDefault(s, d string) string {
	if s == "" {
		return d
	}
	return s
}

// decide takes the decision for a verified move: refusal (why != "", the move
// abandoned) or activation (decided).
func (m *Mover) decide(ctx context.Context, row *meta.Move) (decided bool, why string, err error) {
	in := m.in(row.ID)
	if in != nil {
		in.mu.Lock()
		defer in.mu.Unlock()
		in.touch()
	}
	// the catalog must still say what the move assumed
	rec, ok := m.o.Node.Bucket(row.Bucket)
	if !ok || rec.Generation != row.Generation || rec.Epoch+1 != row.Epoch {
		why = "the catalog no longer lists the bucket at the epoch the move started from"
		m.abandonLocked(ctx, row, why, in)
		return false, why, nil
	}
	err = m.update(ctx, func(tx *meta.Tx) error {
		decided = false
		changed, err := tx.MoveTransition(ctx, row.ID, []string{meta.MoveVerified}, meta.MoveActivated, "")
		if err != nil || !changed {
			return err
		}
		set, err := tx.SetBucketEpoch(ctx, row.Bucket, row.Generation, row.Epoch)
		if err != nil {
			return err
		}
		if !set {
			return errNoCopy
		}
		decided = true
		return tx.KVDeletePrefix(ctx, kvMovePrefix(row.ID))
	})
	if errors.Is(err, errNoCopy) {
		why = "the copy of the bucket is gone from this node"
		m.abandonLocked(ctx, row, why, in)
		return false, why, nil
	}
	if err != nil {
		return false, "", err
	}
	if decided {
		if in != nil {
			in.row.State = meta.MoveActivated // the watchdog leaves it alone
		}
		m.log.Info("move: activated", "move", row.ID, "bucket", row.Bucket, "epoch", row.Epoch)
	}
	return decided, "", nil
}

var errNoCopy = errors.New("mover: no copy of the bucket")

// awaitActivation answers an activate call for a move that was activated: it is
// complete — the catalog says this node is the home, the pipelines run, the slot is
// free — before the answer is OK. The completion itself does not belong to the call:
// it runs on its own until it has been done, so that a source that never asks again
// (it crashed, or was retired) does not leave the bucket unserved and this node's
// slot taken.
func (m *Mover) awaitActivation(ctx context.Context, row *meta.Move) error {
	in := m.complete(row)
	if in == nil {
		// no live move: the activation was completed already (this is a replay) or this
		// node has restarted since, which wrote the hand-off if it was missing; make sure
		return m.ensureHandoff(ctx, row.Bucket, row.Generation, m.selfID(), row.Epoch, 0)
	}
	select {
	case <-in.completed:
		return in.completeErr
	case <-ctx.Done():
		return ctx.Err()
	}
}

// complete starts the completion of an activation, once, and returns the live move
// that carries its outcome (nil if there is none: see awaitActivation).
func (m *Mover) complete(row *meta.Move) *inMove {
	in := m.in(row.ID)
	if in == nil {
		return nil
	}
	in.completeOnce.Do(func() {
		in.completed = make(chan struct{})
		m.wg.Add(1)
		go func() {
			defer m.wg.Done()
			defer close(in.completed)
			for backoff := 100 * time.Millisecond; ; backoff = min(backoff*2, 5*time.Second) {
				err := m.completeActivation(m.ctx, row)
				if err == nil || m.closing() {
					in.completeErr = err
					return
				}
				m.log.Warn("move: the activation is not complete yet; trying again", "move", row.ID, "bucket", row.Bucket, "error", err)
				if !m.sleep(m.ctx, backoff) {
					in.completeErr = m.ctx.Err()
					return
				}
			}
		}()
	})
	return in
}

// completeActivation is everything that follows the durable decision, and is safe
// to repeat: the catalog says this node is the home (written here, before the
// answer: a node that answers OK serves at once, whatever the old home does next),
// the bucket's pipelines start, the node's slot is free again.
func (m *Mover) completeActivation(ctx context.Context, row *meta.Move) error {
	if m.tune.CrashPoint != nil && m.tune.CrashPoint("activated") {
		<-ctx.Done() // a test seam: the target died right after its decision
		return ctx.Err()
	}
	if err := m.ensureHandoff(ctx, row.Bucket, row.Generation, m.selfID(), row.Epoch, 0); err != nil {
		return err
	}
	// Only the first completion of the activation acts on this node's gate and
	// pipelines: the move holds the node's slot until finishIn, so while the move is
	// still registered nothing else can have started on this node. A later call is a
	// replay (the source asks again until an answer reaches it) and only answers: by
	// then the bucket may have moved on, this node may be freezing it for a move of
	// its own, and nothing a replay does may reopen it.
	if m.in(row.ID) == nil {
		return nil
	}
	// ...and only while the local copy is still the one this move activated.
	b, err := m.o.DB.Read().GetBucket(ctx, row.Bucket)
	switch {
	case errors.Is(err, meta.ErrNotFound) || (err == nil && (b.Generation != row.Generation || b.Epoch != row.Epoch)):
		m.finishIn(row.ID) // moved on or deleted since: nothing is left to start
		return nil
	case err != nil:
		return err
	}
	m.o.Gate.Thaw(row.Bucket)
	if err := m.o.Pipes.BucketArrived(ctx, row.Bucket); err != nil {
		m.log.Warn("move: starting the bucket's pipelines failed", "move", row.ID, "bucket", row.Bucket, "error", err)
	}
	m.finishIn(row.ID)
	return nil
}

// finishIn forgets a move that has reached a final state on the target and frees
// the node's slot.
func (m *Mover) finishIn(id string) {
	m.mu.Lock()
	in := m.ins[id]
	delete(m.ins, id)
	if in != nil && m.owned[in.row.Bucket] == id {
		delete(m.owned, in.row.Bucket)
	}
	m.mu.Unlock()
	if in != nil {
		m.met.active.Add(-1)
		m.release()
	}
}

// ---- abandoning ---------------------------------------------------------------------------------

func (m *Mover) handleDiscard(w http.ResponseWriter, r *http.Request, id string) {
	ctx := r.Context()
	row, err := m.loadMove(ctx, id)
	if errors.Is(err, meta.ErrNotFound) {
		// A discard that is the first this node hears of the move overtook its prepare (a
		// slow call, one that was sent again): the id is remembered as abandoned, so that the
		// prepare that comes after it is refused and does not start a move nobody ends.
		now := m.now()
		tomb := meta.Move{ID: id, Role: meta.MoveIn, Peer: r.Header.Get(cluster.HeaderNode), State: meta.MoveAbandoned,
			Error: "the source ended the move before it was prepared", CreatedAt: now, FinishedAt: &now}
		switch ierr := m.update(ctx, func(tx *meta.Tx) error { return tx.InsertMove(ctx, &tomb) }); {
		case ierr == nil:
			writeReply(w, http.StatusOK, reply{Result: resultOK, Detail: "no such move here: it is remembered as ended", State: meta.MoveAbandoned})
			return
		case errors.Is(ierr, meta.ErrExists):
			row, err = m.loadMove(ctx, id) // a prepare got there first: it is ended like any other
		default:
			writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: ierr.Error()})
			return
		}
	}
	switch {
	case errors.Is(err, meta.ErrNotFound):
		writeReply(w, http.StatusOK, reply{Result: resultOK, Detail: "no such move here", State: "unknown"})
		return
	case err != nil:
		writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: err.Error()})
		return
	case row.Role != meta.MoveIn:
		refused(w, "move %s is not an incoming move of this node", id)
		return
	case row.State == meta.MoveActivated:
		refused(w, "the move was activated: it is not discarded")
		return
	}
	m.abandonByID(ctx, id, "the source ended the move")
	writeReply(w, http.StatusOK, reply{Result: resultOK, State: meta.MoveAbandoned})
}

func (m *Mover) handleStatus(w http.ResponseWriter, r *http.Request, id string) {
	row, err := m.loadMove(r.Context(), id)
	switch {
	case errors.Is(err, meta.ErrNotFound):
		writeReply(w, http.StatusNotFound, reply{Result: resultRefused, Detail: "no such move"})
	case err != nil:
		writeReply(w, http.StatusInternalServerError, reply{Result: "error", Detail: err.Error()})
	default:
		writeReply(w, http.StatusOK, reply{Result: resultOK, State: row.State, Detail: row.Error})
	}
}

// abandonByID gives a move up if it has not been activated.
func (m *Mover) abandonByID(ctx context.Context, id, why string) {
	row, err := m.loadMove(ctx, id)
	if err != nil {
		return
	}
	in := m.in(id)
	if in != nil {
		in.mu.Lock()
		defer in.mu.Unlock()
	}
	m.abandonLocked(ctx, row, why, in)
}

// abandonLocked ends a move that was not activated: the rows of the partial copy and
// the files received for it go, the decision is recorded. The caller holds in.mu.
func (m *Mover) abandonLocked(ctx context.Context, row *meta.Move, why string, in *inMove) {
	if err := m.abandonStored(ctx, row, why); err != nil {
		m.log.Error("move: cannot abandon the move", "move", row.ID, "bucket", row.Bucket, "error", err)
		return
	}
	if in != nil {
		in.row.State = meta.MoveAbandoned
	}
}

// abandonStored records the decision "abandoned" — only if the move is not
// activated, which is checked in the same transaction — and removes the partial
// copy. It is the boot's path as well (there is no inMove then).
func (m *Mover) abandonStored(ctx context.Context, row *meta.Move, why string) error {
	var changed bool
	err := m.update(ctx, func(tx *meta.Tx) (err error) {
		changed = false
		if changed, err = tx.MoveTransition(ctx, row.ID, []string{meta.MoveReceiving, meta.MoveVerified}, meta.MoveAbandoned, why); err != nil || !changed {
			return err
		}
		if b, gerr := tx.GetBucket(ctx, row.Bucket); gerr == nil && b.Generation == row.Generation {
			if err := tx.DiscardBucket(ctx, row.Bucket); err != nil {
				return err
			}
		}
		return tx.ReleaseBucketBlobs(ctx, row.Bucket) // the placed blobs, whether or not the rows came
	})
	if err != nil {
		return err
	}
	if !changed {
		return nil
	}
	m.log.Info("move: abandoned", "move", row.ID, "bucket", row.Bucket, "why", why)
	m.met.refusals.Inc("abandoned")
	m.purgeCopy(ctx, row)
	m.o.Pipes.ForgetBucket(row.Bucket)
	m.finishIn(row.ID)
	return nil
}

// purgeCopy removes what an abandoned move left on disk: the blob files (this node
// never served them: no grace is needed) and the upload directories.
func (m *Mover) purgeCopy(ctx context.Context, row *meta.Move) {
	q := m.o.DB.Read()
	for {
		blobs, err := q.BucketBlobs(ctx, row.Bucket, "", 500)
		if err != nil || len(blobs) == 0 {
			break
		}
		ids := make([]string, 0, len(blobs))
		for _, b := range blobs {
			if b.Refs > 0 {
				return // a live bucket's rows: not ours to remove
			}
			_ = m.o.Store.Remove(b.BlobID)
			ids = append(ids, b.BlobID)
		}
		if err := m.update(ctx, func(tx *meta.Tx) error { return tx.DeleteBlobRows(ctx, ids) }); err != nil {
			break
		}
	}
	keys, _ := q.KVKeys(ctx, kvMovePrefix(row.ID))
	for _, k := range keys {
		if upload := strings.TrimPrefix(k, kvMovePrefix(row.ID)+"u/"); upload != k {
			_ = m.o.Store.RemoveUpload(upload)
		}
	}
	_ = m.update(ctx, func(tx *meta.Tx) error { return tx.KVDeletePrefix(ctx, kvMovePrefix(row.ID)) })
}

// watchdog gives up the moves whose source went silent before the activation
// (a source that crashed and will not come back; spec §8.8): the copy would
// otherwise hold this node's slot and disk for ever.
func (m *Mover) watchdog() {
	t := time.NewTicker(time.Second)
	defer t.Stop()
	for {
		select {
		case <-m.ctx.Done():
			return
		case <-t.C:
		}
		m.mu.Lock()
		var stale []string
		for id, in := range m.ins {
			if time.Since(time.Unix(0, in.last.Load())) > in.idle {
				stale = append(stale, id)
			}
		}
		m.mu.Unlock()
		for _, id := range stale {
			if in := m.in(id); in != nil && in.mu.TryLock() {
				st := in.row.State
				in.mu.Unlock()
				if st == meta.MoveReceiving || st == meta.MoveVerified {
					m.log.Warn("move: the source has been silent for too long: the copy is dropped", "move", id)
					m.abandonByID(m.ctx, id, "the source was silent for too long")
				}
			}
		}
	}
}
