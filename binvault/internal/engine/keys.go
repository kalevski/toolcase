package engine

import (
	"context"
	"errors"
	"sync"

	"github.com/kalevski/toolcase/binvault/internal/apierr"
	"github.com/kalevski/toolcase/binvault/internal/crypt"
	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// SealBucketKey is the seal record type of a bucket data key.
const SealBucketKey = "bucketkey"

var keyMu sync.Mutex // serialises bucket data key creation (spec §3.11)

// BucketKey returns the opened data key of a bucket, creating and committing it
// first when the bucket has none. The key is committed (fsynced by the commit)
// before this returns, hence always before the first encrypted byte is written.
func (e *Engine) BucketKey(ctx context.Context, b *meta.Bucket) ([]byte, error) {
	if len(b.DataKey) > 0 {
		return e.openBucketKey(b)
	}
	keyMu.Lock()
	defer keyMu.Unlock()
	// another request may have created it while we waited
	cur, err := e.DB.Read().GetBucket(ctx, b.Name)
	if err != nil {
		return nil, bucketLookupError(b.Name, err)
	}
	if len(cur.DataKey) > 0 {
		return e.openBucketKey(cur)
	}
	key, err := crypt.NewBucketKey()
	if err != nil {
		return nil, internal(err)
	}
	sealed, err := e.Ring.Seal(SealBucketKey, cur.Name, key)
	if err != nil {
		return nil, internal(err)
	}
	var stored bool
	err = e.DB.Update(ctx, func(tx *meta.Tx) error {
		ok, err := tx.SetBucketDataKeyIfAbsent(ctx, cur.Name, sealed)
		stored = ok
		return err
	})
	if err != nil {
		return nil, wrapErr(err)
	}
	if !stored { // lost a race with another node-local writer: use theirs
		cur, err = e.DB.Read().GetBucket(ctx, b.Name)
		if err != nil {
			return nil, bucketLookupError(b.Name, err)
		}
		return e.openBucketKey(cur)
	}
	b.DataKey = sealed
	return key, nil
}

func (e *Engine) openBucketKey(b *meta.Bucket) ([]byte, error) {
	key, err := e.Ring.Open(SealBucketKey, b.Name, b.DataKey)
	if err != nil {
		// never replace a key we cannot open (spec §4.7)
		e.Log.Error("cannot open bucket data key", "bucket", b.Name, "error", err)
		return nil, apierr.Wrap("InternalError", "The bucket's encryption key cannot be opened.", err)
	}
	return key, nil
}

// bucketLookupError is what a failed read of a bucket row is to the client: NoSuchBucket
// only when the row is not there. A request that the freeze of its bucket (a move,
// spec §8.8) ended while it waited for the data key is a cancelled request — FrozenCause
// turns it into the SlowDown that SDKs retry, which NoSuchBucket would never be.
func bucketLookupError(name string, err error) error {
	if errors.Is(err, meta.ErrNotFound) {
		return noSuchBucket(name)
	}
	return wrapErr(err)
}
