package engine

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"

	"github.com/kalevski/toolcase/binvault/internal/meta"
)

// VerifyObject re-reads an object's blob (decrypting if needed) and compares
// its SHA-256 and size with the row (the scrubber, spec §3.9). It never
// repairs or deletes anything.
func (e *Engine) VerifyObject(ctx context.Context, b *meta.Bucket, o *meta.Object) error {
	body, err := e.OpenBody(ctx, b, o)
	if err != nil {
		return fmt.Errorf("open: %w", err)
	}
	defer body.Close()
	if body.Size() != o.Size {
		return fmt.Errorf("size on disk %d, expected %d", body.Size(), o.Size)
	}
	h := sha256.New()
	if _, err := body.WriteRange(h, 0, body.Size()); err != nil {
		return fmt.Errorf("read: %w", err)
	}
	if got := hex.EncodeToString(h.Sum(nil)); o.SHA256 != "" && got != o.SHA256 {
		return fmt.Errorf("sha256 %s, expected %s", got, o.SHA256)
	}
	return nil
}

// Scrub verifies every blob once and returns how many were checked and which
// failed. It stops early when ctx ends.
func (e *Engine) Scrub(ctx context.Context, onMismatch func(o *meta.Object, err error)) (checked, bad int, err error) {
	after := ""
	buckets := map[string]*meta.Bucket{}
	for {
		page, err := e.DB.Read().ScrubPage(ctx, after, 200)
		if err != nil {
			return checked, bad, err
		}
		for _, o := range page {
			if err := ctx.Err(); err != nil {
				return checked, bad, err
			}
			after = o.BlobID
			b := buckets[o.Bucket]
			if b == nil {
				if b, err = e.DB.Read().GetBucket(ctx, o.Bucket); err != nil {
					continue
				}
				buckets[o.Bucket] = b
			}
			checked++
			if verr := e.VerifyObject(ctx, b, o); verr != nil {
				bad++
				if onMismatch != nil {
					onMismatch(o, verr)
				}
			}
		}
		if len(page) < 200 {
			return checked, bad, nil
		}
	}
}

var _ = io.EOF
