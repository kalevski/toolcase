package app_test

import (
	"context"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/binvault/internal/app"
)

// A data dir belongs to one process (spec §3.1): a second node on a live one used
// to start, empty the first one's tmp/ and fail its uploads in flight, and `rekey`
// on it re-sealed everything under a key the running node did not know.
func TestALiveDataDirRefusesASecondProcess(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("held", nil)
	c := n.token("held", all, nil)
	n.must(c, 200, "PUT", "/held/a", []byte("before"))
	staging := filepath.Join(n.dir, "tmp", "in-flight-upload")
	if err := os.WriteFile(staging, []byte("a PUT is streaming into this file"), 0o600); err != nil {
		t.Fatal(err)
	}
	cfg := cfgFor(n.dir, n.app.Cfg.MasterKey)

	// a second node
	a2, err := newApp(t, cfg)
	if err == nil {
		a2.Close()
		t.Fatal("a second node started on a live data dir")
	}
	if !strings.Contains(err.Error(), "in use by another process") {
		t.Fatalf("the refusal must say why: %v", err)
	}
	if _, err := os.Stat(staging); err != nil {
		t.Fatalf("the refused node emptied the live node's tmp/: %v", err)
	}

	// `binvault rekey`
	if _, err := app.RekeyDataDir(context.Background(), cfg); err == nil || !strings.Contains(err.Error(), "in use by another process") {
		t.Fatalf("rekey on a live data dir must be refused: %v", err)
	}

	// validate only reads, so it keeps working on a live node's data dir
	if rep, err := app.Validate(context.Background(), cfg, true); err != nil || len(rep.Problems) != 0 {
		t.Fatalf("validate on a live data dir: %+v %v", rep, err)
	}
	// and the live node was not disturbed
	n.must(c, 200, "PUT", "/held/b", []byte("after"))
	if g := n.must(c, 200, "GET", "/held/a", nil); string(g.body) != "before" {
		t.Fatalf("%q", g.body)
	}
}

// The lock goes with the node: after Close (or after a start that failed) the data dir is free
// again, which is what a restart, `rekey` after stopping, and the tests of this package rely on.
func TestDataDirLockIsReleasedWhenTheNodeCloses(t *testing.T) {
	dir := t.TempDir()
	cfg := cfgFor(dir, key32())
	seed(t, cfg) // sealed values, so that a wrong master key is noticed below

	a, err := newApp(t, cfg)
	if err != nil {
		t.Fatal(err)
	}
	if _, err := newApp(t, cfg); err == nil {
		t.Fatal("a second node opened a data dir that is held")
	}
	a.Close()
	b, err := newApp(t, cfg)
	if err != nil {
		t.Fatalf("restart on the same data dir: %v", err)
	}
	b.Close()

	// rekey takes the lock for its run and gives it back
	if _, err := app.RekeyDataDir(context.Background(), cfg); err != nil {
		t.Fatal(err)
	}
	c, err := newApp(t, cfg)
	if err != nil {
		t.Fatalf("a node after rekey: %v", err)
	}
	c.Close()

	// a start that fails (wrong master key) must not keep the directory
	if _, err := newApp(t, cfgFor(dir, key32())); err == nil {
		t.Fatal("a wrong master key must refuse to boot")
	}
	d, err := newApp(t, cfg)
	if err != nil {
		t.Fatalf("a failed start kept the lock: %v", err)
	}
	d.Close()
}

// meta.db holds sealed secrets and every key of every bucket: like the rest of the data dir it
// is created private to the owner and group (SQLite alone would make it 0644, and its -wal and
// -shm files take the mode of the database).
func TestMetaDBIsNotWorldReadable(t *testing.T) {
	n := startNode(t, nil)
	n.bucket("private", nil)
	for _, name := range []string{"meta.db", "meta.db-wal", "meta.db-shm", "FORMAT", "LOCK"} {
		fi, err := os.Stat(filepath.Join(n.dir, name))
		if err != nil {
			if name == "meta.db-wal" || name == "meta.db-shm" {
				continue // not present between checkpoints
			}
			t.Fatal(err)
		}
		if fi.Mode().Perm()&0o007 != 0 {
			t.Errorf("%s is %v: world-accessible", name, fi.Mode().Perm())
		}
	}
}
