package admin

import (
	"crypto/rand"
	"encoding/hex"
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
	Staging   bool         `json:"staging"`
	Error     string       `json:"error,omitempty"` // set when State == failed (the certbot reason)
	Cert      *certInfo    `json:"cert,omitempty"`  // set when State == succeeded
	CreatedAt time.Time    `json:"created_at"`
	UpdatedAt time.Time    `json:"updated_at"`
}

// certJobStore is an in-memory registry of async issuance jobs. Jobs are
// ephemeral — a daemon restart drops them (issuance either finished and wrote a
// cert to disk, or it didn't). Finished jobs are pruned after a TTL so the map
// can't grow without bound.
type certJobStore struct {
	mu   sync.Mutex
	jobs map[string]*certJob
}

const certJobTTL = time.Hour

func newCertJobStore() *certJobStore {
	return &certJobStore{jobs: map[string]*certJob{}}
}

// create registers a new pending job and returns a snapshot copy.
func (st *certJobStore) create(name string, domains []string, staging bool) *certJob {
	st.mu.Lock()
	defer st.mu.Unlock()
	st.pruneLocked()
	now := time.Now()
	j := &certJob{
		ID:        newJobID(),
		State:     jobPending,
		CertName:  name,
		Domains:   domains,
		Staging:   staging,
		CreatedAt: now,
		UpdatedAt: now,
	}
	st.jobs[j.ID] = j
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
