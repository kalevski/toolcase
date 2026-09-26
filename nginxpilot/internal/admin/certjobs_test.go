package admin

import (
	"io"
	"log/slog"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"
)

func TestCertJobStoreLifecycle(t *testing.T) {
	st := newCertJobStore()

	job := st.create("example.com", []string{"example.com", "www.example.com"}, "dns", true, false)
	if job.State != jobPending {
		t.Fatalf("new job state = %q, want pending", job.State)
	}
	if job.ID == "" {
		t.Fatal("job id is empty")
	}

	// The returned snapshot must be independent of later store mutations.
	job.Domains[0] = "mutated.com"
	if got := st.get(job.ID); got == nil || got.Domains[0] != "example.com" {
		t.Fatalf("snapshot not isolated from store: %+v", got)
	}

	st.update(job.ID, func(j *certJob) { j.State = jobRunning })
	if got := st.get(job.ID); got.State != jobRunning {
		t.Fatalf("state after update = %q, want running", got.State)
	}

	st.update(job.ID, func(j *certJob) {
		j.State = jobFailed
		j.Error = "certbot boom"
	})
	got := st.get(job.ID)
	if got.State != jobFailed || got.Error != "certbot boom" {
		t.Fatalf("failed job = %+v", got)
	}

	// Unknown id → nil; update on unknown id is a no-op (no panic).
	if st.get("nope") != nil {
		t.Fatal("get of unknown id should be nil")
	}
	st.update("nope", func(j *certJob) { j.State = jobSucceeded })
}

func TestCertJobStoreListNewestFirst(t *testing.T) {
	st := newCertJobStore()
	a := st.create("a.com", []string{"a.com"}, "dns", false, false)
	// Force a strictly-later CreatedAt for the second job (same-tick creates would
	// otherwise tie). Reaching into the store is fine — same-package test.
	st.jobs[a.ID].CreatedAt = time.Now().Add(-time.Minute)
	b := st.create("b.com", []string{"b.com"}, "dns", false, false)

	list := st.list()
	if len(list) != 2 || list[0].ID != b.ID || list[1].ID != a.ID {
		t.Fatalf("list not newest-first: %+v", list)
	}
}

func TestCertJobStorePrunesOldFinished(t *testing.T) {
	st := newCertJobStore()
	old := st.create("old.com", []string{"old.com"}, "dns", false, false)
	// Make it a finished job past the TTL.
	st.jobs[old.ID].State = jobSucceeded
	st.jobs[old.ID].UpdatedAt = time.Now().Add(-2 * certJobTTL)

	// A fresh create runs pruneLocked, which should evict the stale finished job.
	st.create("new.com", []string{"new.com"}, "dns", false, false)
	if st.get(old.ID) != nil {
		t.Fatal("stale finished job should have been pruned")
	}

	// A pending job past the TTL must NOT be pruned (still in flight).
	pend := st.create("pending.com", []string{"pending.com"}, "dns", false, false)
	st.jobs[pend.ID].UpdatedAt = time.Now().Add(-2 * certJobTTL)
	st.create("trigger.com", []string{"trigger.com"}, "dns", false, false)
	if st.get(pend.ID) == nil {
		t.Fatal("pending job must not be pruned even past the TTL")
	}
}

func quietLog() *slog.Logger { return slog.New(slog.NewTextHandler(io.Discard, nil)) }

// A persisted store survives a reopen: finished jobs come back as they were.
func TestCertJobStorePersists(t *testing.T) {
	path := filepath.Join(t.TempDir(), "acme", "jobs.json")
	st := openCertJobStore(path, quietLog(), nil)
	job := st.create("wmk-1-g1", []string{"example.com"}, "dns", false, false)
	st.update(job.ID, func(j *certJob) { j.State = jobFailed; j.Error = "certbot boom" })

	again := openCertJobStore(path, quietLog(), nil)
	got := again.get(job.ID)
	if got == nil || got.State != jobFailed || got.Error != "certbot boom" || got.CertName != "wmk-1-g1" {
		t.Fatalf("reopened job = %+v", got)
	}
}

// Jobs the restart interrupted are settled from the cert dir: a cert issued
// after the job started means success, anything else (and every dry run) fails
// with an explicit reason — never left pending forever.
func TestCertJobStoreSettlesInterrupted(t *testing.T) {
	path := filepath.Join(t.TempDir(), "jobs.json")
	st := openCertJobStore(path, quietLog(), nil)
	done := st.create("done.example", []string{"done.example"}, "http", false, false)
	lost := st.create("lost.example", []string{"lost.example"}, "http", false, false)
	dry := st.create("done.example", []string{"done.example"}, "http", false, true)
	st.update(done.ID, func(j *certJob) { j.State = jobRunning })

	fresh := time.Now().Add(time.Minute)
	issued := func(name string) *certInfo {
		if name == "done.example" {
			return &certInfo{Domain: name, Names: []string{name}, NotBefore: &fresh}
		}
		return nil
	}
	again := openCertJobStore(path, quietLog(), issued)

	if got := again.get(done.ID); got.State != jobSucceeded || got.Cert == nil {
		t.Errorf("interrupted job with a fresh cert must succeed: %+v", got)
	}
	if got := again.get(lost.ID); got.State != jobFailed || !strings.Contains(got.Error, "interrupted") {
		t.Errorf("interrupted job without a cert must fail as interrupted: %+v", got)
	}
	if got := again.get(dry.ID); got.State != jobFailed || got.Cert != nil {
		t.Errorf("an interrupted dry run never succeeds from the cert dir: %+v", got)
	}
}

// A corrupt file never takes the daemon down: the store starts empty and the
// next write replaces it.
func TestCertJobStoreCorruptFile(t *testing.T) {
	path := filepath.Join(t.TempDir(), "jobs.json")
	if err := os.WriteFile(path, []byte("{not json"), 0o640); err != nil {
		t.Fatal(err)
	}
	st := openCertJobStore(path, quietLog(), nil)
	if len(st.list()) != 0 {
		t.Fatalf("corrupt file should yield an empty store")
	}
	st.create("a.example", []string{"a.example"}, "http", false, false)
	if again := openCertJobStore(path, quietLog(), nil); len(again.list()) != 1 {
		t.Fatalf("store did not recover after a write")
	}
}

// The admin server persists jobs under data_dir/acme/jobs.json.
func TestIssueJobPersistedUnderDataDir(t *testing.T) {
	cfg := mixedAcmeConfig(t)
	h := newTestServer(t, cfg)
	rec := postCerts(h, `{"domains":["t.example.com"],"challenge":"http","dry_run":true}`)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("POST /certs: %d %s", rec.Code, rec.Body.String())
	}
	data, err := os.ReadFile(filepath.Join(cfg.DataDir, "acme", "jobs.json"))
	if err != nil || !strings.Contains(string(data), "t.example.com") {
		t.Fatalf("job not persisted: %v %s", err, data)
	}
}
