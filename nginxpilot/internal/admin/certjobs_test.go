package admin

import (
	"testing"
	"time"
)

func TestCertJobStoreLifecycle(t *testing.T) {
	st := newCertJobStore()

	job := st.create("example.com", []string{"example.com", "www.example.com"}, true)
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
	a := st.create("a.com", []string{"a.com"}, false)
	// Force a strictly-later CreatedAt for the second job (same-tick creates would
	// otherwise tie). Reaching into the store is fine — same-package test.
	st.jobs[a.ID].CreatedAt = time.Now().Add(-time.Minute)
	b := st.create("b.com", []string{"b.com"}, false)

	list := st.list()
	if len(list) != 2 || list[0].ID != b.ID || list[1].ID != a.ID {
		t.Fatalf("list not newest-first: %+v", list)
	}
}

func TestCertJobStorePrunesOldFinished(t *testing.T) {
	st := newCertJobStore()
	old := st.create("old.com", []string{"old.com"}, false)
	// Make it a finished job past the TTL.
	st.jobs[old.ID].State = jobSucceeded
	st.jobs[old.ID].UpdatedAt = time.Now().Add(-2 * certJobTTL)

	// A fresh create runs pruneLocked, which should evict the stale finished job.
	st.create("new.com", []string{"new.com"}, false)
	if st.get(old.ID) != nil {
		t.Fatal("stale finished job should have been pruned")
	}

	// A pending job past the TTL must NOT be pruned (still in flight).
	pend := st.create("pending.com", []string{"pending.com"}, false)
	st.jobs[pend.ID].UpdatedAt = time.Now().Add(-2 * certJobTTL)
	st.create("trigger.com", []string{"trigger.com"}, false)
	if st.get(pend.ID) == nil {
		t.Fatal("pending job must not be pruned even past the TTL")
	}
}
