package git

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/source"
	"github.com/kalevski/toolcase/nginxpilot/internal/state"
)

// originRepo builds a local repository with two commits on main and returns
// its path and both SHAs. Local paths are fine here: New does not validate
// the URL, only config validation does.
func originRepo(t *testing.T) (dir, first, second string) {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git binary not found")
	}
	dir = t.TempDir()
	run := func(args ...string) string {
		t.Helper()
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		cmd.Env = append(os.Environ(),
			"GIT_CONFIG_GLOBAL=/dev/null", "GIT_CONFIG_NOSYSTEM=1",
			"GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t")
		out, err := cmd.CombinedOutput()
		if err != nil {
			t.Fatalf("git %v: %v: %s", args, err, out)
		}
		return strings.TrimSpace(string(out))
	}
	run("init", "-q", "-b", "main")
	run("config", "uploadpack.allowReachableSHA1InWant", "true")
	write := func(body string) {
		if err := os.WriteFile(filepath.Join(dir, "index.html"), []byte(body), 0o644); err != nil {
			t.Fatal(err)
		}
	}
	write("one")
	run("add", ".")
	run("commit", "-q", "-m", "one")
	first = run("rev-parse", "HEAD")
	write("two")
	run("commit", "-q", "-am", "two")
	second = run("rev-parse", "HEAD")
	return dir, first, second
}

func syncInto(t *testing.T, s *Syncer, st *state.SiteState) (changed bool, ref, body string) {
	t.Helper()
	staging := t.TempDir()
	res, err := s.Sync(context.Background(), st, staging)
	if err != nil {
		t.Fatalf("sync: %v", err)
	}
	if res.Changed {
		raw, err := os.ReadFile(filepath.Join(staging, "index.html"))
		if err != nil {
			t.Fatal(err)
		}
		body = string(raw)
	}
	return res.Changed, res.Ref, body
}

func newRefSyncer(t *testing.T, url, ref, dataDir string) *Syncer {
	return New("example.test", config.Source{Type: config.SourceGit, URL: "file://" + url, Branch: "main", Ref: ref},
		dataDir, slog.New(slog.NewTextHandler(io.Discard, nil)))
}

// TestSyncPinnedRefBuildsOlderCommit: a pin to a commit behind the branch head
// builds that commit, even though the shallow cache only fetched the head.
func TestSyncPinnedRefBuildsOlderCommit(t *testing.T) {
	origin, first, _ := originRepo(t)
	s := newRefSyncer(t, origin, first, t.TempDir())

	changed, ref, body := syncInto(t, s, &state.SiteState{})
	if !changed || ref != first || body != "one" {
		t.Fatalf("got changed=%v ref=%s body=%q, want the first commit", changed, ref, body)
	}
}

// TestSyncPinnedRefIgnoresBranchHead: once the pin is deployed, a sync is a
// no-op whatever the branch does.
func TestSyncPinnedRefIgnoresBranchHead(t *testing.T) {
	origin, first, _ := originRepo(t)
	s := newRefSyncer(t, origin, first, t.TempDir())

	changed, ref, _ := syncInto(t, s, &state.SiteState{DeployedRef: first})
	if changed || ref != first {
		t.Fatalf("got changed=%v ref=%s, want an unchanged pin", changed, ref)
	}
}

// TestSyncUnpinnedFollowsHead: clearing the pin goes back to the branch head.
func TestSyncUnpinnedFollowsHead(t *testing.T) {
	origin, first, second := originRepo(t)
	s := newRefSyncer(t, origin, "", t.TempDir())

	changed, ref, body := syncInto(t, s, &state.SiteState{DeployedRef: first})
	if !changed || ref != second || body != "two" {
		t.Fatalf("got changed=%v ref=%s body=%q, want the head", changed, ref, body)
	}
}

// TestSyncPinnedRefUnknownCommit: a pin to a commit the remote does not have
// fails the sync instead of silently building the head.
func TestSyncPinnedRefUnknownCommit(t *testing.T) {
	origin, _, _ := originRepo(t)
	s := newRefSyncer(t, origin, strings.Repeat("a", 40), t.TempDir())

	if _, err := s.Sync(context.Background(), &state.SiteState{}, t.TempDir()); err == nil {
		t.Fatal("want an error for an unknown pinned commit")
	}
}

// TestSyncOverSizeLimitIsLimitError: a tree over max_uncompressed_size fails
// as a *source.LimitError through the real git archive pipe, not as the
// SIGPIPE that git archive dies of once the reader stops.
func TestSyncOverSizeLimitIsLimitError(t *testing.T) {
	origin, _, _ := originRepo(t)
	big := strings.Repeat("x", 1<<20)
	if err := os.WriteFile(filepath.Join(origin, "big.bin"), []byte(big), 0o644); err != nil {
		t.Fatal(err)
	}
	for _, args := range [][]string{{"add", "."}, {"commit", "-q", "-m", "big"}} {
		cmd := exec.Command("git", args...)
		cmd.Dir = origin
		cmd.Env = append(os.Environ(), "GIT_CONFIG_GLOBAL=/dev/null", "GIT_CONFIG_NOSYSTEM=1",
			"GIT_AUTHOR_NAME=t", "GIT_AUTHOR_EMAIL=t@t", "GIT_COMMITTER_NAME=t", "GIT_COMMITTER_EMAIL=t@t")
		if out, err := cmd.CombinedOutput(); err != nil {
			t.Fatalf("git %v: %v: %s", args, err, out)
		}
	}
	s := New("example.test", config.Source{
		Type: config.SourceGit, URL: "file://" + origin, Branch: "main",
		Limits: config.Limits{MaxUncompressedSize: 64 << 10},
	}, t.TempDir(), slog.New(slog.NewTextHandler(io.Discard, nil)))

	_, err := s.Sync(context.Background(), &state.SiteState{}, t.TempDir())
	var limit *source.LimitError
	if !errors.As(err, &limit) {
		t.Fatalf("want a LimitError, got %v", err)
	}
	if limit.Limit != "max_uncompressed_size" || limit.Max != 64<<10 {
		t.Fatalf("got %+v", limit)
	}
}

// TestPinIsNotPartOfFingerprint: setting a pin must not count as a new source,
// or every pin would force a full resync.
func TestPinIsNotPartOfFingerprint(t *testing.T) {
	a := config.Source{Type: config.SourceGit, URL: "https://x/y.git", Branch: "main"}
	b := a
	b.Ref = strings.Repeat("b", 40)
	if a.Fingerprint() != b.Fingerprint() {
		t.Fatal("the pin changed the fingerprint")
	}
}
