package admin

import (
	"crypto/rand"
	"encoding/hex"
	"encoding/json"
	"errors"
	"log/slog"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"sync"
	"time"
)

// certJobState is the lifecycle of an async certbot issuance (POST /certs).
type certJobState string

const (
	jobPending   certJobState = "pending"
	jobRunning   certJobState = "running"
	jobSucceeded certJobState = "succeeded"
	jobFailed    certJobState = "failed"
)

// certJob tracks one async issuance. Issuance moved off the request path
// (certbot DNS-01 can take minutes); POST /certs returns this job's id
// immediately and the caller polls GET /certs/jobs/{id} until it is terminal.
type certJob struct {
	ID        string       `json:"id"`
	State     certJobState `json:"state"`
	CertName  string       `json:"cert_name"`
	Domains   []string     `json:"domains"`
	Challenge string       `json:"challenge"`
	Staging   bool         `json:"staging"`
	DryRun    bool         `json:"dry_run,omitempty"` // certbot --dry-run: nothing saved, Cert stays empty
	Error     string       `json:"error,omitempty"`   // set when State == failed (the certbot reason)
	Cert      *certInfo    `json:"cert,omitempty"`    // set when State == succeeded
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

// certJobStore is the registry of async issuance jobs. With a path it is
// persisted: every change is written atomically to that file, and a restart
// reloads it, so a control plane polling a job id across a daemon restart gets
// an answer instead of a 404. A job that was pending or running when the daemon
// stopped is settled on load (see settleInterrupted). Finished jobs are pruned
// after certJobTTL so the file cannot grow without bound. Without a path
// (tests, no data_dir) it is memory-only.
type certJobStore struct {
	mu   sync.Mutex
	jobs map[string]*certJob
	path string
	log  *slog.Logger
}

const certJobTTL = 24 * time.Hour

func newCertJobStore() *certJobStore {
	return &certJobStore{jobs: map[string]*certJob{}}
}

// openCertJobStore loads the persisted jobs at path (a missing file is an empty
// store; an unreadable or corrupt one is logged and replaced). issued looks up
// the cert a job would have produced, to settle jobs the restart interrupted.
func openCertJobStore(path string, log *slog.Logger, issued func(name string) *certInfo) *certJobStore {
	st := &certJobStore{jobs: map[string]*certJob{}, path: path, log: log}
	data, err := os.ReadFile(path)
	if err != nil {
		if !errors.Is(err, os.ErrNotExist) {
			log.Warn("cert job file unreadable, starting empty", "path", path, "error", err)
		}
		return st
	}
	var saved []*certJob
	if err := json.Unmarshal(data, &saved); err != nil {
		log.Warn("cert job file corrupt, starting empty", "path", path, "error", err)
		return st
	}
	st.mu.Lock()
	defer st.mu.Unlock()
	for _, j := range saved {
		if j == nil || j.ID == "" {
			continue
		}
		if j.State == jobPending || j.State == jobRunning {
			settleInterrupted(j, issued)
		}
		st.jobs[j.ID] = j
	}
	st.pruneLocked()
	st.persistLocked()
	return st
}

// settleInterrupted decides a job the daemon stopped in the middle of. certbot
// may still have finished before the process died, so the cert dir is the
// truth: a cert under the job's name whose validity starts after the job was
// created means it succeeded; anything else (or any dry run, which never saves)
// is failed, with an error that says why.
func settleInterrupted(j *certJob, issued func(name string) *certInfo) {
	now := time.Now()
	if !j.DryRun && issued != nil {
		if c := issued(j.CertName); c != nil && c.NotBefore != nil && !c.NotBefore.Before(j.CreatedAt.Add(-time.Minute)) {
			j.State = jobSucceeded
			j.Cert = c
			j.UpdatedAt = now
			return
		}
	}
	j.State = jobFailed
	j.Error = "interrupted: the daemon restarted before certbot finished; issue again"
	j.UpdatedAt = now
}

// persistLocked writes every job to the store file. Caller holds st.mu. A write
// failure is logged, never fatal: the in-memory state stays authoritative.
func (st *certJobStore) persistLocked() {
	if st.path == "" {
		return
	}
	out := make([]*certJob, 0, len(st.jobs))
	for _, j := range st.jobs {
		out = append(out, j)
	}
	sort.Slice(out, func(i, k int) bool { return out[i].CreatedAt.Before(out[k].CreatedAt) })
	data, err := json.Marshal(out)
	if err == nil {
		if err = os.MkdirAll(filepath.Dir(st.path), 0o750); err == nil {
			err = writeFileAtomic(st.path, data)
		}
	}
	if err != nil && st.log != nil {
		st.log.Warn("cert job file write failed", "path", st.path, "error", err)
	}
}

// create registers a new pending job and returns a snapshot copy.
func (st *certJobStore) create(name string, domains []string, challenge string, staging, dryRun bool) *certJob {
	st.mu.Lock()
	defer st.mu.Unlock()
	st.pruneLocked()
	now := time.Now()
	j := &certJob{
		ID:        newJobID(),
		State:     jobPending,
		CertName:  name,
		Domains:   domains,
		Challenge: challenge,
		Staging:   staging,
		DryRun:    dryRun,
		CreatedAt: now,
		UpdatedAt: now,
	}
	st.jobs[j.ID] = j
	st.persistLocked()
	return j.snapshot()
}

// update mutates a job under lock via fn and stamps UpdatedAt. No-op for an
// unknown id (a pruned job — the caller already has its result).
func (st *certJobStore) update(id string, fn func(*certJob)) {
	st.mu.Lock()
	defer st.mu.Unlock()
	j, ok := st.jobs[id]
	if !ok {
		return
	}
	fn(j)
	j.UpdatedAt = time.Now()
	st.persistLocked()
}

// get returns a snapshot copy of one job, or nil when unknown.
func (st *certJobStore) get(id string) *certJob {
	st.mu.Lock()
	defer st.mu.Unlock()
	if j, ok := st.jobs[id]; ok {
		return j.snapshot()
	}
	return nil
}

// list returns snapshot copies of every tracked job, newest first.
func (st *certJobStore) list() []*certJob {
	st.mu.Lock()
	defer st.mu.Unlock()
	out := make([]*certJob, 0, len(st.jobs))
	for _, j := range st.jobs {
		out = append(out, j.snapshot())
	}
	sort.Slice(out, func(i, k int) bool { return out[i].CreatedAt.After(out[k].CreatedAt) })
	return out
}

// pruneLocked drops finished jobs older than the TTL. Caller holds st.mu.
func (st *certJobStore) pruneLocked() {
	cutoff := time.Now().Add(-certJobTTL)
	for id, j := range st.jobs {
		if (j.State == jobSucceeded || j.State == jobFailed) && j.UpdatedAt.Before(cutoff) {
			delete(st.jobs, id)
		}
	}
}

// snapshot returns a copy safe to hand out without the store lock (the slice is
// cloned; certInfo is immutable once set, so its pointer is shared).
func (j *certJob) snapshot() *certJob {
	cp := *j
	if j.Domains != nil {
		cp.Domains = append([]string(nil), j.Domains...)
	}
	return &cp
}

// newJobID returns a short random hex id. A crypto/rand failure falls back to a
// time-based id so this never panics (uniqueness is best-effort in that case).
func newJobID() string {
	var b [8]byte
	if _, err := rand.Read(b[:]); err != nil {
		return "job-" + strconv.FormatInt(time.Now().UnixNano(), 36)
	}
	return hex.EncodeToString(b[:])
}
