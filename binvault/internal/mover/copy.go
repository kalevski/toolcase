package mover

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"hash"
	"io"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// The copying of a move (spec §8.8 steps 2 and 4): blob passes while the bucket
// serves, the last blobs and the rows during the freeze.

// errGone: the file to send does not exist on this node.
var errGone = errors.New("the file is gone")

// errStalled: the target stopped taking what was sent, or stopped answering a blob:
// the connection made no progress for BINVAULT_BODY_IDLE_TIMEOUT. A move that has not
// reached its cutover fails with it, which frees the node's slot and thaws the bucket.
var errStalled = errors.New("the target node stopped taking data (no progress within the body idle timeout)")

// stallGuard watches one request of a move for a connection that makes no progress.
// The request body is read through it: the transport asks for more of the body as
// soon as it has written what it had, so the time between a read that returned and
// the next read is the time the connection took to accept the bytes — when that
// exceeds idle the target is not reading, and the request is cancelled with errStalled.
// A read that is in progress (a rate limit delaying it, an export producing its
// rows) is not a stall, and neither is the wait for the answer to a body whose end
// was read, unless answerWait is set: a blob or part is answered within answerWait
// of its last byte (the target has little to do with it but check and write it); the
// rows may take the target a long while to import, and are not watched there.
type stallGuard struct {
	idle       time.Duration
	answerWait time.Duration
	cancel     context.CancelCauseFunc
	timer      *time.Timer
}

// newStallGuard starts the watch; the request has idle to start moving. idle <= 0
// watches nothing.
func newStallGuard(idle, answerWait time.Duration, cancel context.CancelCauseFunc) *stallGuard {
	g := &stallGuard{idle: idle, answerWait: answerWait, cancel: cancel}
	if idle > 0 {
		g.timer = time.AfterFunc(idle, func() { cancel(errStalled) })
	}
	return g
}

// answerWaitFor is how long the target may take to answer a file of that size once it
// has all of it: it checks the digest and syncs the file, which takes longer for a
// bigger one (the idle time, plus a second for every 8 MiB).
func answerWaitFor(idle time.Duration, size int64) time.Duration {
	if idle <= 0 {
		return 0
	}
	return idle + time.Duration(size>>23)*time.Second
}

func (g *stallGuard) arm() {
	if g.timer != nil {
		g.timer.Reset(g.idle)
	}
}

func (g *stallGuard) pause() {
	if g.timer != nil {
		g.timer.Stop()
	}
}

// finish ends the watch: the answer is here, or the request is over.
func (g *stallGuard) finish() { g.pause() }

// wrap is the body reader the transport reads the request body from.
func (g *stallGuard) wrap(r io.Reader) io.Reader { return &guardedBody{g: g, r: r} }

type guardedBody struct {
	g *stallGuard
	r io.Reader
}

func (b *guardedBody) Read(p []byte) (int, error) {
	b.g.pause()
	n, err := b.r.Read(p)
	switch {
	case err == nil:
		b.g.arm() // the transport has these bytes now: it must come back for more
	case errors.Is(err, io.EOF) && b.g.answerWait > 0 && b.g.timer != nil:
		b.g.timer.Reset(b.g.answerWait) // ...or the answer must come
	}
	return n, err
}

// stalled turns the error of a request that the guard cancelled into errStalled.
func stalled(ctx context.Context, err error) error {
	if err != nil && errors.Is(context.Cause(ctx), errStalled) {
		return errStalled
	}
	return err
}

// refusedErr is the target saying no to a blob, a part or the rows: sending it again
// would not help.
type refusedErr struct{ detail string }

func (e *refusedErr) Error() string { return "the target node refused it: " + e.detail }

type work struct {
	blob *meta.MoveBlob
	part *meta.MovePart
}

func (w work) String() string {
	if w.blob != nil {
		return "blob " + w.blob.BlobID
	}
	return "part " + w.part.UploadID + "/" + w.part.PartID
}

type passResult struct {
	// watermark is the highest seq the bucket's version rows had when the pass
	// started: the next pass copies what was added after it.
	watermark int64
	// listed counts the blobs and part files the pass looked at, bytes the bytes it
	// actually had to send (a file the target already had costs none).
	listed int
	bytes  int64
}

// copy runs the online blob passes (spec §8.8 step 2): everything the bucket's
// version rows reference and every part file of its open uploads, then what was
// added since, until the passes are five, or a pass is small, or a pass is no
// smaller than the one before. The bucket serves reads and writes throughout.
func (mv *outMove) copy() error {
	m := mv.m
	if err := mv.save(meta.MoveCopying, ""); err != nil {
		return err
	}
	prev := int64(-1)
	for i := 1; i <= m.tune.MaxPasses; i++ {
		if err := context.Cause(mv.ctx); err != nil {
			return err
		}
		r, err := mv.pass(mv.ctx, mv.afterSeq, false)
		if err != nil {
			return err
		}
		mv.afterSeq = r.watermark
		mv.passes = i
		m.met.passes.Inc()
		m.log.Info("move: blob pass done", "move", mv.id, "bucket", mv.row.Bucket, "pass", i, "files", r.listed, "bytes", r.bytes)
		if r.bytes <= m.tune.SmallPassBytes && r.listed <= m.tune.SmallPassBlobs {
			break
		}
		if prev >= 0 && r.bytes >= prev {
			break
		}
		prev = r.bytes
	}
	return nil
}

// pass sends the blobs the version rows with a seq above `after` reference and the
// part files not sent yet, over up to BINVAULT_MOVE_STREAMS streams. A file that no
// longer exists here is skipped in an online pass (a version was removed meanwhile)
// and fails the final one.
func (mv *outMove) pass(ctx context.Context, after int64, final bool) (passResult, error) {
	m := mv.m
	q := m.o.DB.Read()
	// the watermark is taken before the listing, so that a row committed during the
	// pass is copied by this one or the next, never by neither
	wm, err := q.BucketMaxSeq(ctx, mv.row.Bucket)
	if err != nil {
		return passResult{}, err
	}
	wm = max(wm, after)
	res := passResult{watermark: wm}

	pctx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)
	streams := max(1, m.cfg.MoveStreams)
	feed := make(chan work, streams*2)
	var (
		mu       sync.Mutex
		firstErr error
		once     sync.Once
	)
	fail := func(err error) {
		once.Do(func() {
			firstErr = err
			cancel(err)
		})
	}
	var wg sync.WaitGroup
	for i := 0; i < streams; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for w := range feed {
				if pctx.Err() != nil {
					continue
				}
				n, err := mv.transfer(pctx, w, final)
				if err != nil {
					fail(err)
					continue
				}
				mu.Lock()
				res.bytes += n
				mu.Unlock()
			}
		}()
	}
	listed, perr := mv.produce(pctx, feed, after)
	close(feed)
	wg.Wait()
	res.listed = listed
	switch {
	case firstErr != nil:
		return res, firstErr
	case perr != nil:
		return res, perr
	}
	if err := context.Cause(ctx); err != nil {
		return res, err
	}
	return res, nil
}

// produce lists the files to send.
func (mv *outMove) produce(ctx context.Context, feed chan<- work, after int64) (int, error) {
	q := mv.m.o.DB.Read()
	listed := 0
	send := func(w work) error {
		select {
		case feed <- w:
			listed++
			return nil
		case <-ctx.Done():
			return context.Cause(ctx)
		}
	}
	cursor := after
	seen := map[string]struct{}{} // blobs shared by several versions are sent once
	for {
		blobs, err := q.BucketBlobRowsAfter(ctx, mv.row.Bucket, cursor, 500)
		if err != nil {
			return listed, err
		}
		for i := range blobs {
			if _, dup := seen[blobs[i].BlobID]; dup {
				continue
			}
			if len(seen) >= 1<<20 {
				clear(seen) // a bound on the memory of a bucket of millions of blobs; a repeat is a cheap `exists`
			}
			seen[blobs[i].BlobID] = struct{}{}
			if err := send(work{blob: &blobs[i]}); err != nil {
				return listed, err
			}
		}
		if len(blobs) < 500 {
			break
		}
		cursor = blobs[len(blobs)-1].Seq
	}
	parts, err := q.BucketParts(ctx, mv.row.Bucket)
	if err != nil {
		return listed, err
	}
	for i := range parts {
		mv.mu.Lock()
		_, done := mv.sentParts[parts[i].UploadID+"/"+parts[i].PartID]
		mv.mu.Unlock()
		if done {
			continue
		}
		if err := send(work{part: &parts[i]}); err != nil {
			return listed, err
		}
	}
	return listed, nil
}

// transfer sends one file, trying again after a failure that may be transient.
func (mv *outMove) transfer(ctx context.Context, w work, final bool) (int64, error) {
	var last error
	for attempt := 0; attempt < 3; attempt++ {
		if attempt > 0 && !mv.m.sleep(ctx, time.Duration(attempt)*300*time.Millisecond) {
			return 0, context.Cause(ctx)
		}
		sent, size, err := mv.sendFile(ctx, w)
		var ref *refusedErr
		switch {
		case err == nil:
			mv.bytesCopied.Add(size)
			mv.objects.Add(1)
			mv.m.met.bytes.Add(float64(sent))
			if w.part != nil {
				mv.mu.Lock()
				mv.sentParts[w.part.UploadID+"/"+w.part.PartID] = struct{}{}
				mv.mu.Unlock()
			}
			return sent, nil
		case errors.Is(err, errGone):
			if final {
				return 0, fmt.Errorf("%s is referenced by the bucket but its file is missing on this node", w)
			}
			return 0, nil
		case errors.As(err, &ref), errors.Is(err, errStalled):
			return 0, fmt.Errorf("%s: %w", w, err)
		case ctx.Err() != nil:
			return 0, context.Cause(ctx)
		}
		last = err
	}
	return 0, fmt.Errorf("%s: %w", w, last)
}

// digestBody hashes what is read from it and, at the end of the body, puts the digest
// in the request's trailer.
type digestBody struct {
	r       io.Reader
	h       hash.Hash
	trailer http.Header
}

func (d *digestBody) Read(p []byte) (int, error) {
	n, err := d.r.Read(p)
	d.h.Write(p[:n])
	if err == io.EOF {
		d.trailer.Set(TrailerDigest, hex.EncodeToString(d.h.Sum(nil)))
	}
	return n, err
}

// sendFile sends one blob or part file: chunked, with Expect: 100-continue (a file
// the target has is not sent) and its SHA-256 as the trailer. It returns the bytes
// sent (0 for a file the target had) and the file's size.
func (mv *outMove) sendFile(ctx context.Context, w work) (sent, size int64, err error) {
	m := mv.m
	var (
		f    *os.File
		path string
		hdrs = http.Header{}
	)
	switch {
	case w.blob != nil:
		f, err = m.o.Store.Open(w.blob.BlobID)
		path = "/blob/" + w.blob.BlobID
		hdrs.Set(HeaderPlainSize, strconv.FormatInt(w.blob.PlainSize, 10))
		if w.blob.SSE {
			hdrs.Set(HeaderSSE, "1")
		}
	default:
		f, err = m.o.Store.OpenPart(w.part.UploadID, w.part.PartID)
		path = "/part/" + w.part.UploadID + "/" + w.part.PartID
	}
	if err != nil {
		if errors.Is(err, os.ErrNotExist) {
			return 0, 0, errGone
		}
		return 0, 0, err
	}
	defer f.Close()
	fi, err := f.Stat()
	if err != nil {
		return 0, 0, err
	}
	size = fi.Size()
	if want := w.size(); want != size {
		return 0, 0, fmt.Errorf("its file is %d bytes, its row says %d", size, want)
	}
	hdrs.Set(HeaderSize, strconv.FormatInt(size, 10))
	base, err := mv.url()
	if err != nil {
		return 0, 0, err
	}
	var src io.Reader = f
	if mv.limiter != nil {
		src = mv.limiter.WrapReader(ctx, f)
	}
	body := &digestBody{r: src, h: sha256.New(), trailer: http.Header{TrailerDigest: nil}}
	rctx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)
	guard := newStallGuard(m.cfg.BodyIdleTimeout, answerWaitFor(m.cfg.BodyIdleTimeout, size), cancel)
	defer guard.finish()
	req, err := http.NewRequestWithContext(rctx, http.MethodPut, base+PathPrefix+mv.id+path, io.NopCloser(guard.wrap(body)))
	if err != nil {
		return 0, 0, err
	}
	req.ContentLength = -1 // chunked: the digest follows the body
	req.Trailer = body.trailer
	for k, v := range hdrs {
		req.Header[k] = v
	}
	req.Header.Set("Expect", "100-continue")
	m.o.Node.AuthRequest(req)
	resp, err := m.stream.Do(req)
	if err != nil {
		return 0, 0, stalled(rctx, err)
	}
	guard.finish()
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<16))
	res := decodeCall(resp, raw)
	switch {
	case res.Status == http.StatusOK && res.JSON && res.Reply.Result == resultOK:
		return size, size, nil
	case res.Status == http.StatusOK && res.JSON && res.Reply.Result == resultExists:
		return 0, size, nil
	case res.JSON && res.Reply.Result == resultRefused && res.Status != http.StatusBadRequest:
		// a body that was damaged on the way is worth another try; the rest is not
		if strings.Contains(res.Reply.Detail, "sha256 of the body") || strings.Contains(res.Reply.Detail, "the body has") {
			return 0, 0, errors.New(res.Reply.Detail)
		}
		return 0, 0, &refusedErr{res.Reply.Detail}
	}
	return 0, 0, fmt.Errorf("the target node answered %s", res.detail())
}

func (w work) size() int64 {
	if w.blob != nil {
		return w.blob.Size
	}
	return w.part.StoredSize
}

// ---- the rows --------------------------------------------------------------------------------------

var errRowsEnded = errors.New("the rows request has ended")

// sendRows streams all the bucket's rows to the target (spec §8.8 step 4) and
// returns the number of rows per table once the target has imported and verified
// them. The stream is read from one consistent snapshot of the database, so it is
// the bucket as it was when the writes stopped.
func (mv *outMove) sendRows(ctx context.Context) (meta.Counts, error) {
	m := mv.m
	base, err := mv.url()
	if err != nil {
		return nil, err
	}
	pr, pw := io.Pipe()
	var counts meta.Counts
	done := make(chan error, 1)
	go func() {
		c, err := m.o.DB.ExportBucket(ctx, mv.row.Bucket, pw)
		counts = c
		pw.CloseWithError(err)
		done <- err
	}()
	// the freeze timeout bounds the whole of it, the import's time included; what the
	// guard adds is that a target that stops reading the rows ends the move at once
	// (the answer is not watched: importing a big bucket takes the target a long while)
	rctx, cancel := context.WithCancelCause(ctx)
	defer cancel(nil)
	guard := newStallGuard(m.cfg.BodyIdleTimeout, 0, cancel)
	defer guard.finish()
	req, err := http.NewRequestWithContext(rctx, http.MethodPost, base+PathPrefix+mv.id+"/rows", guard.wrap(pr))
	if err != nil {
		pr.CloseWithError(errRowsEnded)
		<-done
		return nil, err
	}
	req.ContentLength = -1
	req.Header.Set("Content-Type", "application/x-ndjson")
	m.o.Node.AuthRequest(req)
	resp, httpErr := m.stream.Do(req)
	pr.CloseWithError(errRowsEnded)
	exportErr := <-done
	httpErr = stalled(rctx, httpErr)
	if exportErr != nil && !errors.Is(exportErr, errRowsEnded) {
		if resp != nil {
			resp.Body.Close()
		}
		return nil, fmt.Errorf("reading the rows: %w", exportErr)
	}
	if httpErr != nil {
		return nil, httpErr
	}
	defer resp.Body.Close()
	raw, _ := io.ReadAll(io.LimitReader(resp.Body, 1<<20))
	res := decodeCall(resp, raw)
	switch {
	case res.Status == http.StatusOK && res.JSON && res.Reply.Result == resultOK:
		if !sameCounts(counts, res.Reply.Counts) {
			return nil, fmt.Errorf("the target imported %v rows, this node sent %v", res.Reply.Counts, counts)
		}
		return counts, nil
	case res.JSON && res.Reply.Result == resultBusy:
		return nil, busy(res.Reply.Detail)
	case res.JSON && res.Reply.Result == resultRefused:
		return nil, fmt.Errorf("the target node did not accept the rows: %s", res.Reply.Detail)
	}
	return nil, fmt.Errorf("the target node answered the rows with %s", res.detail())
}

func sameCounts(a, b meta.Counts) bool {
	if len(a) != len(b) {
		return false
	}
	for k, v := range a {
		if b[k] != v {
			return false
		}
	}
	return true
}
