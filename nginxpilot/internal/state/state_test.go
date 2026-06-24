package state

import (
	"testing"
	"time"
)

func TestSaveLoadRoundTrip(t *testing.T) {
	dir := t.TempDir()
	store, err := NewStore(dir)
	if err != nil {
		t.Fatalf("NewStore: %v", err)
	}

	want := &SiteState{
		Domain:            "example.com",
		SourceFingerprint: "fp-abc123",
		DeployedRef:       "deadbeef",
		ETag:              `"etag-1"`,
		LastModified:      "Wed, 21 Jun 2026 00:00:00 GMT",
		ContentHash:       "sha256hash",
		LastSuccess:       time.Date(2026, 6, 21, 12, 0, 0, 0, time.UTC),
		LastError:         "previous error",
		LastErrorTime:     time.Date(2026, 6, 20, 8, 0, 0, 0, time.UTC),
		FailureStreak:     3,
	}

	if err := store.Save(want); err != nil {
		t.Fatalf("Save: %v", err)
	}

	got, err := store.Load(want.Domain)
	if err != nil {
		t.Fatalf("Load: %v", err)
	}

	if got.Domain != want.Domain {
		t.Errorf("Domain: got %q, want %q", got.Domain, want.Domain)
	}
	if got.SourceFingerprint != want.SourceFingerprint {
		t.Errorf("SourceFingerprint: got %q, want %q", got.SourceFingerprint, want.SourceFingerprint)
	}
	if got.DeployedRef != want.DeployedRef {
		t.Errorf("DeployedRef: got %q, want %q", got.DeployedRef, want.DeployedRef)
	}
	if got.ETag != want.ETag {
		t.Errorf("ETag: got %q, want %q", got.ETag, want.ETag)
	}
	if got.LastModified != want.LastModified {
		t.Errorf("LastModified: got %q, want %q", got.LastModified, want.LastModified)
	}
	if got.ContentHash != want.ContentHash {
		t.Errorf("ContentHash: got %q, want %q", got.ContentHash, want.ContentHash)
	}
	if !got.LastSuccess.Equal(want.LastSuccess) {
		t.Errorf("LastSuccess: got %v, want %v", got.LastSuccess, want.LastSuccess)
	}
	if got.LastError != want.LastError {
		t.Errorf("LastError: got %q, want %q", got.LastError, want.LastError)
	}
	if !got.LastErrorTime.Equal(want.LastErrorTime) {
		t.Errorf("LastErrorTime: got %v, want %v", got.LastErrorTime, want.LastErrorTime)
	}
	if got.FailureStreak != want.FailureStreak {
		t.Errorf("FailureStreak: got %d, want %d", got.FailureStreak, want.FailureStreak)
	}
}

func TestLoadMissing(t *testing.T) {
	dir := t.TempDir()
	store, err := NewStore(dir)
	if err != nil {
		t.Fatalf("NewStore: %v", err)
	}

	st, err := store.Load("nonexistent.com")
	if err != nil {
		t.Fatalf("Load of missing domain should not error: %v", err)
	}
	if st.Domain != "nonexistent.com" {
		t.Errorf("expected domain to be set, got %q", st.Domain)
	}
	if !st.NeverSynced() {
		t.Error("expected NeverSynced() == true for fresh state")
	}
}
