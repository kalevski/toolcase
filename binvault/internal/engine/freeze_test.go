package engine

import (
	"context"
	"errors"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

func (v *env) putCtx(ctx context.Context, b *meta.Bucket, key, body string) (*PutResult, error) {
	v.t.Helper()
	return v.e.Put(ctx, &PutRequest{Bucket: v.reload(b.Name), Key: key, Body: strings.NewReader(body), Size: int64(len(body)),
		Actor: Actor{Kind: "token", ID: "BVKTEST"}})
}

// A frozen bucket refuses writes and keeps serving reads; a paused one refuses
// both; thawing opens it again.
func TestFreezeRefusesWritesNotReads(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("photos", nil)
	v.mustPut(b, "a", "one")
	g := v.e.Gate

	if err := g.Freeze(v.ctx, "photos"); err != nil {
		t.Fatal(err)
	}
	if _, _, err := g.Begin(v.ctx, "photos", true); !errors.Is(err, ErrFrozen) {
		t.Fatalf("a write to a frozen bucket: %v", err)
	}
	if _, end, err := g.Begin(v.ctx, "photos", false); err != nil {
		t.Fatalf("a read of a frozen bucket: %v", err)
	} else {
		end()
	}
	if got, _, err := v.get(b, "a", ""); err != nil || got != "one" {
		t.Fatalf("read while frozen: %q %v", got, err)
	}
	if _, _, err := g.Begin(v.ctx, "other", true); err != nil {
		t.Fatalf("another bucket is not affected: %v", err)
	}

	g.Pause("photos")
	if _, _, err := g.Begin(v.ctx, "photos", false); !errors.Is(err, ErrFrozen) {
		t.Fatalf("a read of a paused bucket: %v", err)
	}
	g.Thaw("photos")
	wctx, end, err := g.Begin(v.ctx, "photos", true)
	if err != nil {
		t.Fatalf("after thaw: %v", err)
	}
	defer end()
	if _, err := v.putCtx(wctx, b, "b", "two"); err != nil {
		t.Fatalf("a write after thaw: %v", err)
	}
	if ErrFrozen.Status != 503 || ErrFrozen.Header.Get("Retry-After") != "1" {
		t.Fatalf("the freeze answer: %d %v", ErrFrozen.Status, ErrFrozen.Header)
	}
}

// A write that has not reached its commit transaction is ended by the freeze,
// whatever it is waiting for, and Freeze does not wait for it.
func TestFreezeEndsWritesThatHaveNotCommitted(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("photos", nil)
	inChain := make(chan struct{})
	v.e.Before = func(ctx context.Context, c *BeforeCall) (*BeforeOutcome, error) {
		close(inChain)
		<-ctx.Done() // a before chain waiting for its service
		return nil, ctx.Err()
	}
	wctx, end, err := v.e.Gate.Begin(v.ctx, "photos", true)
	if err != nil {
		t.Fatal(err)
	}
	defer end()
	done := make(chan error, 1)
	go func() {
		_, err := v.putCtx(wctx, b, "k", "body")
		done <- err
	}()
	<-inChain
	frozen := make(chan error, 1)
	go func() { frozen <- v.e.Gate.Freeze(v.ctx, "photos") }()
	select {
	case err := <-frozen:
		if err != nil {
			t.Fatal(err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("Freeze waited for a write that is not committing")
	}
	select {
	case err := <-done:
		if err = FrozenCause(wctx, err); !errors.Is(err, ErrFrozen) {
			t.Fatalf("the write ended with %v, want the freeze answer", err)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("the write was not ended")
	}
	if _, _, err := v.get(b, "k", ""); err == nil {
		t.Fatal("a refused write left an object behind")
	}
	if got := v.counters(b).Objects; got != 0 {
		t.Fatalf("objects: %d", got)
	}
}

// Freeze waits for a commit that is running, and what that commit wrote is
// durable when Freeze returns.
func TestFreezeWaitsForARunningCommit(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("photos", nil)
	inCommit := make(chan struct{})
	release := make(chan struct{})
	v.e.Hooks.Outbox = func(ctx context.Context, tx *meta.Tx, ev *Event) error {
		close(inCommit)
		<-release
		return nil
	}
	wctx, end, err := v.e.Gate.Begin(v.ctx, "photos", true)
	if err != nil {
		t.Fatal(err)
	}
	defer end()
	put := make(chan error, 1)
	go func() {
		_, err := v.putCtx(wctx, b, "k", "body")
		put <- err
	}()
	<-inCommit
	frozen := make(chan error, 1)
	go func() { frozen <- v.e.Gate.Freeze(v.ctx, "photos") }()
	select {
	case <-frozen:
		t.Fatal("Freeze returned while a commit was running")
	case <-time.After(300 * time.Millisecond):
	}
	close(release)
	if err := <-put; err != nil {
		t.Fatalf("a commit that was running completes: %v", err)
	}
	if err := <-frozen; err != nil {
		t.Fatal(err)
	}
	if got, _, err := v.get(b, "k", ""); err != nil || got != "body" {
		t.Fatalf("what the running commit wrote: %q %v", got, err)
	}
}

// A write already queued behind the freeze is refused by the committer.
func TestFreezeRefusesAQueuedWrite(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("photos", nil)
	hold := make(chan struct{})
	started := make(chan struct{})
	go func() { // keeps the committer busy so that the write below queues up
		_ = v.db.Update(v.ctx, func(*meta.Tx) error {
			close(started)
			<-hold
			return nil
		})
	}()
	<-started
	wctx, end, err := v.e.Gate.Begin(v.ctx, "photos", true)
	if err != nil {
		t.Fatal(err)
	}
	defer end()
	// the context outlives the freeze here: only the committer's gate can stop the write
	detached := meta.WithBucket(context.WithoutCancel(wctx), "photos")
	put := make(chan error, 1)
	go func() {
		_, err := v.putCtx(detached, b, "k", "body")
		put <- err
	}()
	time.Sleep(200 * time.Millisecond) // queued behind the stalled writer
	frozen := make(chan error, 1)
	go func() { frozen <- v.e.Gate.Freeze(v.ctx, "photos") }()
	time.Sleep(100 * time.Millisecond)
	close(hold)
	if err := <-put; !errors.Is(err, ErrFrozen) {
		t.Fatalf("a queued write: %v", err)
	}
	if err := <-frozen; err != nil {
		t.Fatal(err)
	}
	if got := v.counters(b).Objects; got != 0 {
		t.Fatalf("objects: %d", got)
	}
}

// The first encrypted write to a bucket creates its data key: it waits behind the writes that are
// doing the same, and when the bucket freezes meanwhile it is a cancelled request. The client must be
// told SlowDown, which SDKs retry, not that the bucket does not exist (which they never retry): only a
// bucket row that is not there is NoSuchBucket.
func TestFreezeDuringTheFirstEncryptedWriteIsSlowDownNotNoSuchBucket(t *testing.T) {
	v := newEnv(t)
	b := v.bucket("photos", nil)
	if len(b.DataKey) != 0 {
		t.Fatal("the setup needs a bucket without a data key")
	}
	wctx, end, err := v.e.Gate.Begin(v.ctx, "photos", true)
	if err != nil {
		t.Fatal(err)
	}
	defer end()
	// the write is waiting for the data key when the freeze comes: it holds a cancelled context
	if err := v.e.Gate.Freeze(v.ctx, "photos"); err != nil {
		t.Fatal(err)
	}
	_, err = v.e.Put(wctx, &PutRequest{Bucket: b, Key: "k", Body: strings.NewReader("body"), Size: 4, SSE: true,
		Actor: Actor{Kind: "token", ID: "BVKTEST"}})
	if err == nil {
		t.Fatal("a write of a frozen bucket succeeded")
	}
	if got := FrozenCause(wctx, err); !errors.Is(got, ErrFrozen) {
		t.Fatalf("the write was answered %v, want the freeze answer (SlowDown)", got)
	}

	// a bucket that is not there is still NoSuchBucket
	_, err = v.e.BucketKey(v.ctx, &meta.Bucket{Name: "gone"})
	var ae interface{ Error() string }
	if ae = err; err == nil || !strings.Contains(ae.Error(), "does not exist") {
		t.Fatalf("a bucket that is not there: %v", err)
	}
}
