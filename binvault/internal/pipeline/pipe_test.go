package pipeline

import (
	"context"
	"crypto/rand"
	"errors"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/binvault/internal/meta"
	"github.com/kalevski/toolcase/binvault/internal/seal"
)

func testRing(t *testing.T, old ...[]byte) *seal.Keyring {
	t.Helper()
	key := make([]byte, 32)
	_, _ = rand.Read(key)
	r, err := seal.New(key, old...)
	if err != nil {
		t.Fatal(err)
	}
	return r
}

func testDB(t *testing.T) *meta.DB {
	t.Helper()
	db, err := meta.Open(context.Background(), filepath.Join(t.TempDir(), "meta.db"), meta.Options{})
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	return db
}

func storeDef(t *testing.T, db *meta.DB, ring *seal.Keyring, doc string, headers map[string]string, secret string) {
	t.Helper()
	d := def(t, doc)
	if f := d.Normalize(testEnv); len(f) > 0 {
		t.Fatal(f)
	}
	enc, err := encode(ring, d, headers, secret)
	if err != nil {
		t.Fatal(err)
	}
	rec := &meta.Pipeline{Name: d.Name, Generation: "g1", Stage: d.Stage, Definition: enc.definition, HeadersSealed: enc.headers, SigningSealed: enc.signing}
	if err := db.Update(context.Background(), func(tx *meta.Tx) error { return tx.CreatePipeline(context.Background(), rec) }); err != nil {
		t.Fatal(err)
	}
}

func TestEncodeOpenRoundTrip(t *testing.T) {
	ring := testRing(t)
	db := testDB(t)
	ctx := context.Background()
	storeDef(t, db, ring, `{"name":"rt","stage":"before","description":"d","events":["object.created"],"match":{"keys":["a/**"]},
		"service":{"url":"http://s/h","headers":{"Authorization":"Bearer x"},"timeout":"7s"},"retry":{"max_attempts":3,"backoff":["2s","3s"]},
		"limits":{"max_concurrency":4,"queue_timeout":"900ms"},"on_error":"continue"}`,
		map[string]string{"Authorization": "Bearer x"}, strings.Repeat("k", 32))
	rec, err := db.Read().GetPipeline(ctx, "rt")
	if err != nil {
		t.Fatal(err)
	}
	// the stored definition holds no secret
	if strings.Contains(rec.Definition, "Bearer x") || strings.Contains(rec.Definition, strings.Repeat("k", 32)) {
		t.Fatalf("a secret is stored in clear: %s", rec.Definition)
	}
	if len(rec.HeadersSealed) == 0 || len(rec.SigningSealed) == 0 {
		t.Fatal("secrets must be sealed")
	}
	p, err := open(ring, rec)
	if err != nil {
		t.Fatal(err)
	}
	if p.Headers["Authorization"] != "Bearer x" || p.Secret != strings.Repeat("k", 32) {
		t.Fatalf("secrets: %v %q", p.Headers, p.Secret)
	}
	if p.timeout != 7*time.Second || p.queueWait != 900*time.Millisecond || len(p.backoff) != 2 || p.backoff[1] != 3*time.Second {
		t.Fatalf("derived values: %v %v %v", p.timeout, p.queueWait, p.backoff)
	}
	if !p.Before() || p.Held() || !p.Subscribes("object.created") || p.Subscribes("object.updated") || p.MaxAttempts() != 3 {
		t.Fatalf("accessors: %+v", p.Def)
	}
	v := p.view()
	if v.Service.Headers["Authorization"] != "***" || !v.Service.HasSigningSecret || v.Revision != 1 || v.CreatedAt.IsZero() {
		t.Fatalf("view: %+v", v.Service)
	}
	// a different master key cannot open it
	if _, err := open(testRing(t), rec); err == nil {
		t.Fatal("the wrong key must fail")
	}
}

func TestCheckSecretsNamesWhatCannotBeOpened(t *testing.T) {
	ring := testRing(t)
	db := testDB(t)
	storeDef(t, db, ring, minAfter, map[string]string{"A": "1"}, strings.Repeat("s", 40))
	storeDef(t, db, ring, `{"name":"plain","stage":"after","service":{"url":"http://s/h"}}`, nil, "")
	ctx := context.Background()
	problems, n, err := CheckSecrets(ctx, db, ring)
	if err != nil || len(problems) != 0 || n != 2 {
		t.Fatalf("healthy: %v %d %v", problems, n, err)
	}
	problems, _, err = CheckSecrets(ctx, db, testRing(t))
	if err != nil || len(problems) != 2 || !strings.Contains(problems[0], "pipeline p ") {
		t.Fatalf("wrong key: %v %v", problems, err)
	}
}

func TestRekeySecrets(t *testing.T) {
	oldKey := make([]byte, 32)
	_, _ = rand.Read(oldKey)
	oldRing, _ := seal.New(oldKey)
	db := testDB(t)
	ctx := context.Background()
	storeDef(t, db, oldRing, minAfter, map[string]string{"A": "1"}, strings.Repeat("s", 40))
	newKey := make([]byte, 32)
	_, _ = rand.Read(newKey)
	newRing, _ := seal.New(newKey, oldKey)

	var changed int
	if err := db.Update(ctx, func(tx *meta.Tx) (err error) {
		changed, err = RekeySecrets(ctx, tx, newRing)
		return err
	}); err != nil {
		t.Fatal(err)
	}
	if changed != 2 {
		t.Fatalf("changed = %d", changed)
	}
	// now openable with the new key alone
	onlyNew, _ := seal.New(newKey)
	if problems, _, err := CheckSecrets(ctx, db, onlyNew); err != nil || len(problems) != 0 {
		t.Fatalf("after rekey: %v %v", problems, err)
	}
	// a second pass changes nothing
	if err := db.Update(ctx, func(tx *meta.Tx) (err error) {
		changed, err = RekeySecrets(ctx, tx, newRing)
		return err
	}); err != nil || changed != 0 {
		t.Fatalf("idempotent: %d %v", changed, err)
	}
	// a value that cannot be opened is reported, never replaced
	other := testRing(t)
	err := db.Update(ctx, func(tx *meta.Tx) error { _, err := RekeySecrets(ctx, tx, other); return err })
	if err == nil || !errors.Is(err, seal.ErrUnknownKey) {
		t.Fatalf("unopenable value: %v", err)
	}
}

func TestPipeCache(t *testing.T) {
	c := newPipeCache()
	mk := func(n string) *Pipe { return &Pipe{Def: Definition{Name: n}} }
	c.set(mk("b"))
	c.set(mk("a"))
	if c.get("a") == nil || c.get("zz") != nil {
		t.Fatal("get")
	}
	all := c.all()
	if len(all) != 2 || all[0].Name() != "a" {
		t.Fatalf("all: %v", all)
	}
	c.remove("a")
	if c.get("a") != nil {
		t.Fatal("remove")
	}
}

func TestSettleHold(t *testing.T) {
	ctx := context.Background()
	db, err := meta.Open(ctx, filepath.Join(t.TempDir(), "meta.db"), meta.Options{})
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	t0 := time.Date(2026, 1, 1, 0, 0, 0, 0, time.UTC)
	settle := func(held bool, at time.Time) (d time.Duration) {
		t.Helper()
		if err := db.Update(ctx, func(tx *meta.Tx) (err error) {
			d, err = settleHold(ctx, tx, "hold/p/p", held, at)
			return err
		}); err != nil {
			t.Fatal(err)
		}
		return d
	}
	if d := settle(false, t0); d != 0 {
		t.Fatal("never held")
	}
	settle(true, t0)
	settle(true, t0.Add(time.Hour)) // still held: the start stays
	if d := settle(false, t0.Add(3*time.Hour)); d != 3*time.Hour {
		t.Fatalf("held for %v", d)
	}
	if d := settle(false, t0.Add(4*time.Hour)); d != 0 {
		t.Fatal("released once")
	}
	// the start is stored: a new process reads it back
	settle(true, t0.Add(5*time.Hour))
	if d := settle(false, t0.Add(30*time.Hour)); d != 25*time.Hour {
		t.Fatalf("held for %v", d)
	}
}
