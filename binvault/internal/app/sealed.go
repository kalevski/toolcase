package app

import (
	"context"
	"fmt"

	"github.com/kalevski/toolcase/binvault/internal/auth"
	"github.com/kalevski/toolcase/binvault/internal/cluster"
	"github.com/kalevski/toolcase/binvault/internal/engine"
	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/pipeline"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

// CheckSealed opens every sealed value in the database with the keyring and
// returns a description of each one that cannot be opened (spec §4.7): a wrong
// master key is caught here, at boot and in `validate`, and binvault never
// replaces a sealed value it cannot open.
func CheckSealed(ctx context.Context, db *meta.DB, ring *seal.Keyring) ([]string, int, error) {
	var problems []string
	total := 0
	q := db.Read()
	toks, err := q.AllTokens(ctx)
	if err != nil {
		return nil, 0, err
	}
	for _, t := range toks {
		total++
		if _, err := ring.Open(auth.SealToken, t.AccessKeyID, t.Secret); err != nil {
			problems = append(problems, fmt.Sprintf("token %s (bucket %s): %v", t.AccessKeyID, t.Bucket, err))
		}
	}
	after := ""
	for {
		bs, err := q.ListBuckets(ctx, after, 200)
		if err != nil {
			return nil, 0, err
		}
		for _, b := range bs {
			after = b.Name
			if len(b.DataKey) == 0 {
				continue
			}
			total++
			if _, err := ring.Open(engine.SealBucketKey, b.Name, b.DataKey); err != nil {
				problems = append(problems, fmt.Sprintf("bucket data key of %s: %v", b.Name, err))
			}
		}
		if len(bs) < 200 {
			break
		}
	}
	extra, n, err := checkPipelineSecrets(ctx, db, ring)
	if err != nil {
		return nil, 0, err
	}
	problems = append(problems, extra...)
	total += n
	// the catalog's pipeline registers and the ops still in the log carry sealed
	// values too (spec §4.7, §8.5)
	if v, err := db.Version(ctx); err != nil || v < 2 {
		return problems, total, err // a database from before the cluster tables has no catalog
	}
	cat, n, err := cluster.CheckSealed(ctx, db, ring)
	if err != nil {
		return nil, 0, err
	}
	return append(problems, cat...), total + n, nil
}

// Rekey re-seals every sealed value under the current key (spec §4.7).
// It returns how many values were rewritten.
func Rekey(ctx context.Context, db *meta.DB, ring *seal.Keyring) (int, error) {
	changed := 0
	err := db.Update(ctx, func(tx *meta.Tx) error {
		toks, err := tx.AllTokens(ctx)
		if err != nil {
			return err
		}
		for _, t := range toks {
			out, ch, err := ring.Reseal(auth.SealToken, t.AccessKeyID, t.Secret)
			if err != nil {
				return fmt.Errorf("token %s: %w", t.AccessKeyID, err)
			}
			if ch {
				if err := tx.SetTokenSecret(ctx, t.AccessKeyID, out); err != nil {
					return err
				}
				changed++
			}
		}
		after := ""
		for {
			bs, err := tx.ListBuckets(ctx, after, 200)
			if err != nil {
				return err
			}
			for _, b := range bs {
				after = b.Name
				if len(b.DataKey) == 0 {
					continue
				}
				out, ch, err := ring.Reseal(engine.SealBucketKey, b.Name, b.DataKey)
				if err != nil {
					return fmt.Errorf("bucket data key of %s: %w", b.Name, err)
				}
				if ch {
					if err := tx.SetBucketDataKey(ctx, b.Name, out); err != nil {
						return err
					}
					changed++
				}
			}
			if len(bs) < 200 {
				break
			}
		}
		n, err := rekeyPipelineSecrets(ctx, tx, ring)
		changed += n
		if err != nil {
			return err
		}
		// and the catalog: the pipeline registers and the ops of the log (spec §4.7)
		n, err = cluster.RekeyCatalog(ctx, tx, ring)
		changed += n
		return err
	})
	return changed, err
}

// pipeline secrets are sealed too (spec §4.7): service.headers values and
// service.signing_secret.
var (
	checkPipelineSecrets = pipeline.CheckSecrets
	rekeyPipelineSecrets = pipeline.RekeySecrets
)
