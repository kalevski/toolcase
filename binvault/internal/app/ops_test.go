package app_test

import (
	"bytes"
	"context"
	"crypto/rand"
	"io"
	"log/slog"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/config"
)

func key32() []byte {
	k := make([]byte, 32)
	_, _ = rand.Read(k)
	return k
}

func cfgFor(dir string, master []byte, old ...[]byte) *config.Config {
	return config.ForTest(func(c *config.Config) {
		c.DataDir = dir
		c.Listen, c.AdminListen = "127.0.0.1:0", "127.0.0.1:0"
		c.Fsync = false
		c.MasterKey, c.MasterKeyOld = master, old
	})
}

func newApp(t *testing.T, cfg *config.Config) (*app.App, error) {
	t.Helper()
	return app.New(context.Background(), cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), app.Build{Version: "test"})
}

// seed creates a bucket with SSE and a token, and stores one encrypted object.
func seed(t *testing.T, cfg *config.Config) (ak, sk string) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	a, err := app.New(ctx, cfg, slog.New(slog.NewTextHandler(io.Discard, nil)), app.Build{})
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() { _ = a.Run(ctx); close(done) }()
	n := &node{t: t, app: a, adminURL: "http://" + a.AdminAddr(), s3URL: "http://" + a.PublicAddr(), adminTok: cfg.AdminToken[0]}
	n.bucket("sec", map[string]any{"encryption": "sse-s3"})
	c := n.token("sec", all, nil)
	n.must(c, 200, "PUT", "/sec/doc", []byte("sealed data"))
	cancel()
	<-done
	return c.ak, c.sk
}

func TestWrongMasterKeyRefusesToBoot(t *testing.T) {
	dir := t.TempDir()
	k1 := key32()
	seed(t, cfgFor(dir, k1))

	_, err := newApp(t, cfgFor(dir, key32()))
	if err == nil || !strings.Contains(err.Error(), "cannot open") {
		t.Fatalf("boot with the wrong master key must fail naming the problem: %v", err)
	}
	rep, verr := app.Validate(context.Background(), cfgFor(dir, key32()), false)
	if verr != nil || len(rep.Problems) == 0 {
		t.Fatalf("validate must report it: %+v %v", rep, verr)
	}
	// the right key (or the old key listed) is fine
	if rep, _ := app.Validate(context.Background(), cfgFor(dir, k1), false); len(rep.Problems) != 0 {
		t.Fatalf("%+v", rep)
	}
	a, err := newApp(t, cfgFor(dir, key32(), k1))
	if err != nil {
		t.Fatalf("old key as decrypt-only must boot: %v", err)
	}
	a.Close()
}

func TestKeyRotationWithRekey(t *testing.T) {
	dir := t.TempDir()
	k1, k2 := key32(), key32()
	ak, sk := seed(t, cfgFor(dir, k1))

	// step 1: new key current, old key decrypt-only: everything still opens
	cfg2 := cfgFor(dir, k2, k1)
	if rep, _ := app.Validate(context.Background(), cfg2, false); len(rep.Problems) != 0 {
		t.Fatalf("%+v", rep)
	}
	// step 2: rekey re-seals the token secret and the bucket data key under k2
	n, err := app.RekeyDataDir(context.Background(), cfg2)
	if err != nil || n != 2 {
		t.Fatalf("rekey rewrote %d values: %v", n, err)
	}
	if again, _ := app.RekeyDataDir(context.Background(), cfg2); again != 0 {
		t.Fatalf("a second rekey must be a no-op, rewrote %d", again)
	}
	// step 3: the old key can be dropped, and the data (encrypted under the bucket key) still reads
	cfg3 := cfgFor(dir, k2)
	if rep, _ := app.Validate(context.Background(), cfg3, true); len(rep.Problems) != 0 {
		t.Fatalf("%+v", rep)
	}
	ctx, cancel := context.WithCancel(context.Background())
	a, err := app.New(ctx, cfg3, slog.New(slog.NewTextHandler(io.Discard, nil)), app.Build{})
	if err != nil {
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() { _ = a.Run(ctx); close(done) }()
	defer func() { cancel(); <-done }()
	nd := &node{t: t, app: a, adminURL: "http://" + a.AdminAddr(), s3URL: "http://" + a.PublicAddr(), adminTok: cfg3.AdminToken[0]}
	if g := nd.must(cred{ak, sk}, 200, "GET", "/sec/doc", nil); !bytes.Equal(g.body, []byte("sealed data")) {
		t.Fatalf("%q", g.body)
	}
}

func TestValidateDeepFindsMissingBlob(t *testing.T) {
	dir := t.TempDir()
	cfg := cfgFor(dir, key32())
	seed(t, cfg)
	if rep, _ := app.Validate(context.Background(), cfg, true); len(rep.Problems) != 0 {
		t.Fatalf("%+v", rep)
	}
	removeAllBlobs(t, dir)
	rep, _ := app.Validate(context.Background(), cfg, true)
	if len(rep.Problems) == 0 || !strings.Contains(strings.Join(rep.Problems, "\n"), "missing") {
		t.Fatalf("a deleted blob must be reported: %+v", rep)
	}
	// and it names the object that needs it, so the damage can be restored by name
	if p := strings.Join(rep.Problems, "\n"); !strings.Contains(p, `bucket sec, key "doc", version `) {
		t.Fatalf("the missing blob must be reported with its bucket and key: %s", p)
	}
	// without --deep the check is skipped
	if rep, _ := app.Validate(context.Background(), cfg, false); len(rep.Problems) != 0 {
		t.Fatalf("%+v", rep)
	}
}
