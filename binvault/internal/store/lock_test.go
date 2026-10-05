//go:build linux || darwin || freebsd || netbsd || openbsd || dragonfly

package store

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"syscall"
	"testing"
)

func statDev(fi os.FileInfo) uint64 { return uint64(fi.Sys().(*syscall.Stat_t).Dev) }

// A second process on a live data dir must fail instead of emptying the first one's
// tmp/ (spec §3.1). flock locks belong to the open file description, so a second Open
// in the same process conflicts exactly like a second process would.
func TestOpenLocksTheDataDir(t *testing.T) {
	dir := t.TempDir()
	s, err := Open(dir, false)
	if err != nil {
		t.Fatal(err)
	}
	staged, err := s.NewStaged()
	if err != nil {
		t.Fatal(err)
	}
	defer staged.Discard()

	_, err = Open(dir, false)
	var inUse *InUseError
	if !errors.As(err, &inUse) || inUse.Dir != dir {
		t.Fatalf("a second Open on a live data dir must fail with InUseError: %v", err)
	}
	if _, err := os.Stat(staged.Path); err != nil {
		t.Fatalf("the refused Open removed the live node's staging file: %v", err)
	}
	// maintenance commands that write take the same lock
	ins, err := Inspect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := ins.Lock(); !errors.As(err, &inUse) {
		t.Fatalf("Lock on a live data dir must fail with InUseError: %v", err)
	}
	// validate only looks: Inspect itself never conflicts
	if _, err := Inspect(dir); err != nil {
		t.Fatalf("Inspect must work on a live data dir: %v", err)
	}

	if err := s.Close(); err != nil {
		t.Fatal(err)
	}
	if err := s.Close(); err != nil {
		t.Fatalf("Close must be idempotent: %v", err)
	}
	if err := ins.Lock(); err != nil {
		t.Fatalf("the lock must be free once the store is closed: %v", err)
	}
	if _, err := Open(dir, false); !errors.As(err, &inUse) {
		t.Fatalf("Lock holds the directory like Open does: %v", err)
	}
	if err := ins.Close(); err != nil {
		t.Fatal(err)
	}
	s2, err := Open(dir, false)
	if err != nil {
		t.Fatalf("Open after Close: %v", err)
	}
	defer s2.Close()
	if _, err := os.Stat(filepath.Join(dir, lockName)); err != nil {
		t.Fatalf("the lock file is part of the data dir: %v", err)
	}
}

// On a fresh data dir tmp/ and uploads/ do not exist, so a blobs/ on another filesystem
// has to be compared with the data dir itself (`validate`, spec §2.1).
func TestCheckSameFilesystemComparesTheDataDirRoot(t *testing.T) {
	dir := t.TempDir()
	devOf := func(p string) uint64 {
		fi, err := os.Stat(p)
		if err != nil {
			t.Skipf("no %s: %v", p, err)
		}
		return uint64(statDev(fi))
	}
	if devOf(dir) == devOf("/dev") {
		t.Skip("the temp dir and /dev share a filesystem here")
	}
	ins, err := Inspect(dir)
	if err != nil {
		t.Fatal(err)
	}
	if err := ins.CheckSameFilesystem(); err != nil {
		t.Fatalf("an empty data dir is fine: %v", err)
	}
	if err := os.Symlink("/dev", filepath.Join(dir, "blobs")); err != nil {
		t.Skip(err)
	}
	err = ins.CheckSameFilesystem()
	if err == nil || !strings.Contains(err.Error(), "blobs/") || !strings.Contains(err.Error(), "the data dir") {
		t.Fatalf("a blobs/ on another filesystem must be caught on a fresh data dir: %v", err)
	}
}
