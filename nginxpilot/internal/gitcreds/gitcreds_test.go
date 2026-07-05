package gitcreds

import (
	"errors"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func TestValidName(t *testing.T) {
	valid := []string{"quaykeeper-abc123", "site_1", "a", "A.b-c_d", "quaykeeper-aB3_x-Y9"}
	for _, n := range valid {
		if !ValidName(n) {
			t.Errorf("ValidName(%q) = false, want true", n)
		}
	}
	invalid := []string{"", ".hidden", "-dash", "a/b", "../etc", "a b", strings.Repeat("x", 129)}
	for _, n := range invalid {
		if ValidName(n) {
			t.Errorf("ValidName(%q) = true, want false", n)
		}
	}
}

func TestStoreSetListDelete(t *testing.T) {
	s := New(filepath.Join(t.TempDir(), "git-credentials"))

	if got := s.List(); len(got) != 0 {
		t.Fatalf("empty store List() = %v, want []", got)
	}

	path, err := s.Set("quaykeeper-abc", "ghs_secret\n")
	if err != nil {
		t.Fatalf("Set: %v", err)
	}
	if path != s.Path("quaykeeper-abc") {
		t.Errorf("Set path = %q, want %q", path, s.Path("quaykeeper-abc"))
	}

	// 0600 perms, trimmed content + trailing newline.
	fi, err := os.Stat(path)
	if err != nil {
		t.Fatalf("stat: %v", err)
	}
	if fi.Mode().Perm() != 0o600 {
		t.Errorf("perm = %04o, want 0600", fi.Mode().Perm())
	}
	raw, _ := os.ReadFile(path)
	if string(raw) != "ghs_secret\n" {
		t.Errorf("content = %q, want %q", raw, "ghs_secret\n")
	}

	if !s.Has("quaykeeper-abc") {
		t.Error("Has = false after Set")
	}

	// Replace keeps a single entry with new content.
	if _, err := s.Set("quaykeeper-abc", "ghs_rotated"); err != nil {
		t.Fatalf("Set replace: %v", err)
	}
	raw, _ = os.ReadFile(path)
	if string(raw) != "ghs_rotated\n" {
		t.Errorf("rotated content = %q", raw)
	}

	list := s.List()
	if len(list) != 1 || list[0].Name != "quaykeeper-abc" || list[0].Path != path {
		t.Fatalf("List = %+v", list)
	}

	if err := s.Delete("quaykeeper-abc"); err != nil {
		t.Fatalf("Delete: %v", err)
	}
	if err := s.Delete("quaykeeper-abc"); !errors.Is(err, os.ErrNotExist) {
		t.Errorf("second Delete err = %v, want os.ErrNotExist", err)
	}
}

func TestStoreRejectsBadInput(t *testing.T) {
	s := New(t.TempDir())
	if _, err := s.Set("../evil", "tok"); err == nil {
		t.Error("Set with traversal name succeeded")
	}
	if _, err := s.Set("ok", "   "); err == nil {
		t.Error("Set with blank token succeeded")
	}
	if s.Has("../evil") {
		t.Error("Has with traversal name = true")
	}
}
