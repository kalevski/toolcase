package mover

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"hash"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"path/filepath"
	"strings"
	"sync/atomic"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

func TestMoveIDs(t *testing.T) {
	id := newMoveID()
	if !validMoveID(id) || !strings.HasPrefix(id, "mv_") {
		t.Fatalf("a generated id is not valid: %q", id)
	}
	if id2 := newMoveID(); id2 <= id {
		t.Fatalf("ids do not sort by creation: %q then %q", id, id2)
	}
	for _, bad := range []string{"", "mv_", "mv_short", "xx_" + id[3:], id + "0", id[:len(id)-1] + "/", "../" + id[3:]} {
		if validMoveID(bad) {
			t.Fatalf("%q is taken for a move id", bad)
		}
	}
}

// The digest of a blob goes in the request's trailer at the end of the body, and only there.
func TestDigestBodyTrailer(t *testing.T) {
	const payload = "the bytes of a blob"
	var got struct{ body, trailer string }
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		raw, _ := io.ReadAll(r.Body)
		got.body, got.trailer = string(raw), r.Trailer.Get(TrailerDigest)
	}))
	defer srv.Close()
	body := &digestBody{r: strings.NewReader(payload), h: newSHA256(), trailer: http.Header{TrailerDigest: nil}}
	req, _ := http.NewRequest(http.MethodPut, srv.URL, io.NopCloser(body))
	req.ContentLength = -1
	req.Trailer = body.trailer
	res, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	res.Body.Close()
	if got.body != payload || len(got.trailer) != 64 {
		t.Fatalf("body %q, trailer %q", got.body, got.trailer)
	}
	if sum := sha256Hex(payload); got.trailer != sum {
		t.Fatalf("trailer %s, want %s", got.trailer, sum)
	}
}

func TestTuningDefaultsAndJitter(t *testing.T) {
	d := Tuning{}.withDefaults()
	if d.MaxPasses != 5 || d.RequeueDelay != 2*time.Second || d.ActivateTimeout != 30*time.Second || d.SmallPassBlobs != 1000 || d.SmallPassBytes != 64<<20 {
		t.Fatalf("defaults: %+v", d)
	}
	if k := (Tuning{MaxPasses: 2, ActivateBackoff: time.Millisecond}).withDefaults(); k.MaxPasses != 2 || k.ActivateBackoff != time.Millisecond {
		t.Fatalf("explicit values are kept: %+v", k)
	}
	for i := 0; i < 100; i++ {
		if j := jitter(time.Second); j < time.Second || j > 2*time.Second {
			t.Fatalf("jitter %v", j)
		}
	}
}

func TestSameCountsAndStates(t *testing.T) {
	a := meta.Counts{"objects": 3, "blobs": 2}
	if !sameCounts(a, meta.Counts{"blobs": 2, "objects": 3}) || sameCounts(a, meta.Counts{"objects": 3}) || sameCounts(a, meta.Counts{"objects": 3, "blobs": 1}) {
		t.Fatal("sameCounts")
	}
	for state, final := range map[string]bool{
		meta.MoveQueued: false, meta.MoveCutover: false, meta.MoveMoved: false, meta.MoveResuming: false, meta.MoveReceiving: false, meta.MoveVerified: false,
		meta.MoveDone: true, meta.MoveFailed: true, meta.MoveCancelled: true, meta.MoveActivated: true, meta.MoveAbandoned: true,
	} {
		if meta.IsFinalMoveState(state) != final {
			t.Fatalf("%s: final=%v", state, !final)
		}
	}
}

func newSHA256() hash.Hash { return sha256.New() }

func sha256Hex(s string) string {
	sum := sha256.Sum256([]byte(s))
	return hex.EncodeToString(sum[:])
}

// A move that waits for its target (queued, with a delay in retryAt) and is cancelled leaves the
// queue without the worker running it; the delay must not stay behind: an entry in the past
// shortens the worker's sleep to 10 ms for ever.
func TestMoverQueueDelaysOfMovesThatLeftTheQueueAreForgotten(t *testing.T) {
	ctx := context.Background()
	db, err := meta.Open(ctx, filepath.Join(t.TempDir(), "meta.db"), meta.Options{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	m := &Mover{o: Options{DB: db}, ctx: ctx, retryAt: map[string]time.Time{}}
	row := func(bucket string) *meta.Move {
		return &meta.Move{ID: newMoveID(), Role: meta.MoveOut, Bucket: bucket, Generation: "g", Peer: "peer", State: meta.MoveQueued, Epoch: 1, CreatedAt: time.Now()}
	}
	waiting, cancelled := row("waiting"), row("cancelled")
	if err := db.Update(ctx, func(tx *meta.Tx) error {
		if err := tx.InsertMove(ctx, waiting); err != nil {
			return err
		}
		return tx.InsertMove(ctx, cancelled)
	}); err != nil {
		t.Fatal(err)
	}
	// both wait for their target; then one is cancelled, as an admin does
	m.retryAt[waiting.ID] = time.Now().Add(time.Hour)
	m.retryAt[cancelled.ID] = time.Now().Add(-time.Second)
	if err := db.Update(ctx, func(tx *meta.Tx) error {
		_, err := tx.MoveTransition(ctx, cancelled.ID, []string{meta.MoveQueued}, meta.MoveCancelled, "cancelled by an admin")
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if got := m.nextOut(); got != nil {
		t.Fatalf("the worker was handed %s while the only queued move waits", got.ID)
	}
	if _, ok := m.retryAt[cancelled.ID]; ok {
		t.Fatal("the delay of the cancelled move is still there")
	}
	if _, ok := m.retryAt[waiting.ID]; !ok {
		t.Fatal("the delay of the move that is still waiting was dropped")
	}
	if w := m.nextWait(); w != 2*time.Second {
		t.Fatalf("the worker sleeps %s: a delay that is over keeps it from sleeping", w)
	}
	// a delay that is over for a move that is still queued hands it out, once
	m.retryAt[waiting.ID] = time.Now().Add(-time.Millisecond)
	if got := m.nextOut(); got == nil || got.ID != waiting.ID {
		t.Fatalf("the move whose delay is over was not handed out: %v", got)
	}
	if len(m.retryAt) != 0 {
		t.Fatalf("delays left: %v", m.retryAt)
	}
}

// zeroes is an endless source of bytes.
type zeroes struct{}

func (zeroes) Read(p []byte) (int, error) { clear(p); return len(p), nil }

// laggard returns its bytes after a pause, once.
type laggard struct {
	delay time.Duration
	done  bool
}

func (l *laggard) Read(p []byte) (int, error) {
	if l.done {
		return 0, io.EOF
	}
	time.Sleep(l.delay)
	l.done = true
	return copy(p, "late but there"), nil
}

// A target that stops reading a request body ends the request at once (the guard cancels it with
// errStalled); a read that is slow in producing its bytes, or an answer that takes long after the
// whole body went, is no stall unless the guard was told to watch the answer.
func TestMoverStallGuardCancelsARequestTheTargetStopsReading(t *testing.T) {
	var mode atomic.Value // what the server does with a request: "ignore" the body, or "read" it and answer late
	mode.Store("ignore")
	release := make(chan struct{})
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if mode.Load() == "read" {
			_, _ = io.Copy(io.Discard, r.Body)
			time.Sleep(700 * time.Millisecond) // the answer takes long
		} else {
			<-release // never reads (and a server that has not read the body does not see the client go away)
		}
		w.WriteHeader(http.StatusNoContent)
	}))
	t.Cleanup(func() { close(release); srv.CloseClientConnections(); srv.Close() })
	do := func(guardIdle time.Duration, answer bool, body io.Reader, give time.Duration) (time.Duration, error) {
		var answerWait time.Duration
		if answer {
			answerWait = answerWaitFor(guardIdle, int64(len("blob")))
		}
		ctx, cancel := context.WithCancelCause(context.Background())
		defer cancel(nil)
		stop := time.AfterFunc(give, func() { cancel(errors.New("the test gave up")) })
		defer stop.Stop()
		g := newStallGuard(guardIdle, answerWait, cancel)
		defer g.finish()
		req, _ := http.NewRequestWithContext(ctx, http.MethodPost, srv.URL, g.wrap(body))
		req.ContentLength = -1
		start := time.Now()
		resp, err := http.DefaultClient.Do(req)
		if err == nil {
			g.finish()
			resp.Body.Close()
		}
		return time.Since(start), stalled(ctx, err)
	}

	// 64 MiB cannot disappear into the socket buffers: the writes block when the server does not read
	if took, err := do(300*time.Millisecond, false, io.LimitReader(zeroes{}, 64<<20), 10*time.Second); !errors.Is(err, errStalled) || took > 5*time.Second {
		t.Fatalf("a body the server does not read: %v after %s", err, took)
	}
	mode.Store("read")
	if got := answerWaitFor(time.Minute, 1<<30); got != time.Minute+128*time.Second {
		t.Fatalf("the answer to a 1 GiB file may take %s", got)
	}
	if got := answerWaitFor(0, 1<<30); got != 0 {
		t.Fatalf("a guard that is off waits %s for an answer", got)
	}
	// a read that takes longer than the idle time is the sender's own slowness
	if _, err := do(300*time.Millisecond, false, &laggard{delay: 800 * time.Millisecond}, 10*time.Second); err != nil {
		t.Fatalf("a body that is slow to be produced: %v", err)
	}
	// the answer is not watched for the rows...
	if _, err := do(300*time.Millisecond, false, strings.NewReader("rows"), 10*time.Second); err != nil {
		t.Fatalf("a late answer, not watched: %v", err)
	}
	// ...but is for a blob
	if _, err := do(300*time.Millisecond, true, strings.NewReader("blob"), 10*time.Second); !errors.Is(err, errStalled) {
		t.Fatalf("a late answer to a blob: %v", err)
	}
	// and a guard with no idle time watches nothing
	if _, err := do(0, true, strings.NewReader("blob"), 10*time.Second); err != nil {
		t.Fatalf("a guard that is off: %v", err)
	}
}

// What a bucket takes on disk is a sum over its blob rows: it is kept while the counters of the bucket
// say nothing was written, and summed again when they change.
func TestMoverBucketBytesIsRememberedWhileTheBucketIsUnchanged(t *testing.T) {
	ctx := context.Background()
	db, err := meta.Open(ctx, filepath.Join(t.TempDir(), "meta.db"), meta.Options{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	m := &Mover{o: Options{DB: db}, log: slog.Default(), bytesCache: map[string]cachedBytes{}}
	if err := db.Update(ctx, func(tx *meta.Tx) error {
		if err := tx.CreateBucket(ctx, &meta.Bucket{Name: "sized", Generation: "g"}); err != nil {
			return err
		}
		return tx.InsertBlob(ctx, &meta.Blob{BlobID: "b1", Bucket: "sized", Size: 100, PlainSize: 100, Refs: 2}) // two versions share it
	}); err != nil {
		t.Fatal(err)
	}
	b := &meta.Bucket{Name: "sized", Generation: "g", Counters: meta.Counters{Objects: 2, Versions: 2, Bytes: 200}} // the counters count both versions
	if got := m.bucketBytes(ctx, b); got != 100 {
		t.Fatalf("a blob shared by two versions: %d bytes, want 100 (the versions count %d)", got, b.Bytes)
	}
	// a blob row added behind the counters' back: the counters are the same, so is the answer
	if err := db.Update(ctx, func(tx *meta.Tx) error {
		return tx.InsertBlob(ctx, &meta.Blob{BlobID: "b2", Bucket: "sized", Size: 50, PlainSize: 50, Refs: 1})
	}); err != nil {
		t.Fatal(err)
	}
	if got := m.bucketBytes(ctx, b); got != 100 {
		t.Fatalf("the sum was made again for a bucket whose counters did not change: %d", got)
	}
	// a write changes the counters: the sum is made again
	b.Versions, b.Objects, b.Bytes = 3, 3, 250
	if got := m.bucketBytes(ctx, b); got != 150 {
		t.Fatalf("after a write: %d bytes, want 150", got)
	}
}
