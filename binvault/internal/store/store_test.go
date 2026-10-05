package store

import (
	"errors"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"testing"
	"time"
)

func TestStageCommitOpenRemove(t *testing.T) {
	s, err := Open(t.TempDir(), true)
	if err != nil {
		t.Fatal(err)
	}
	st, err := s.NewStaged()
	if err != nil {
		t.Fatal(err)
	}
	if _, err := st.File.WriteString("hello"); err != nil {
		t.Fatal(err)
	}
	id := st.ID
	if err := s.Commit(st); err != nil {
		t.Fatal(err)
	}
	if _, err := os.Stat(st.Path); !errors.Is(err, fs.ErrNotExist) {
		t.Fatal("staging file must be gone after commit")
	}
	f, err := s.Open(id)
	if err != nil {
		t.Fatal(err)
	}
	b, _ := io.ReadAll(f)
	if string(b) != "hello" {
		t.Fatalf("got %q", b)
	}
	// an open reader keeps reading an unlinked blob
	if err := s.Remove(id); err != nil {
		t.Fatal(err)
	}
	f.Seek(0, 0)
	b, _ = io.ReadAll(f)
	f.Close()
	if string(b) != "hello" {
		t.Fatal("open reader must survive unlink")
	}
	if _, err := s.Open(id); !errors.Is(err, fs.ErrNotExist) {
		t.Fatal("blob must be gone")
	}
	if err := s.Remove(id); err != nil {
		t.Fatal("remove must be idempotent")
	}
	if _, err := s.Open("../../etc/passwd"); err == nil {
		t.Fatal("path traversal must be impossible")
	}
}

func TestOpenClearsTmpAndChecksFormat(t *testing.T) {
	dir := t.TempDir()
	s, _ := Open(dir, false)
	st, _ := s.NewStaged()
	st.File.Close()
	s.Close() // a restart: the first process is gone
	s2, err := Open(dir, false)
	if err != nil {
		t.Fatal(err)
	}
	ents, _ := os.ReadDir(filepath.Join(dir, "tmp"))
	if len(ents) != 0 {
		t.Fatal("tmp/ must be emptied at boot")
	}
	if err := s2.CheckSameFilesystem(); err != nil {
		t.Fatal(err)
	}
	s2.Close()
	os.WriteFile(filepath.Join(dir, "FORMAT"), []byte("other\n"), 0o640)
	if _, err := Open(dir, false); err == nil {
		t.Fatal("unknown format must be refused")
	}
	// a refused open does not keep the lock
	os.WriteFile(filepath.Join(dir, "FORMAT"), []byte(FormatMarker), 0o640)
	s3, err := Open(dir, false)
	if err != nil {
		t.Fatalf("the lock of a refused open must be released: %v", err)
	}
	s3.Close()
}

func TestPartsAndWalk(t *testing.T) {
	s, _ := Open(t.TempDir(), false)
	p, err := s.NewPart("up1")
	if err != nil {
		t.Fatal(err)
	}
	p.File.WriteString("part")
	if err := s.FinishPart(p); err != nil {
		t.Fatal(err)
	}
	f, err := s.OpenPart("up1", p.ID)
	if err != nil {
		t.Fatal(err)
	}
	f.Close()
	dirs, _ := s.UploadDirs()
	if _, ok := dirs["up1"]; !ok {
		t.Fatal("upload dir not listed")
	}
	if err := s.RemoveUpload("up1"); err != nil {
		t.Fatal(err)
	}
	if err := s.RemoveUpload("../x"); err == nil {
		t.Fatal("bad upload id accepted")
	}
	// walk finds committed blobs
	st, _ := s.NewStaged()
	st.File.WriteString("x")
	id := st.ID
	if err := s.Commit(st); err != nil {
		t.Fatal(err)
	}
	var seen []string
	if err := s.WalkBlobs(func(i string, size int64, _ time.Time) error {
		seen = append(seen, i)
		if size != 1 {
			t.Fatalf("size %d", size)
		}
		return nil
	}); err != nil {
		t.Fatal(err)
	}
	if len(seen) != 1 || seen[0] != id {
		t.Fatalf("walk saw %v, want [%s]", seen, id)
	}
	if free, err := s.FreeBytes(); err != nil || free == 0 {
		t.Fatalf("free %d err %v", free, err)
	}
	if err := s.CheckWritable(); err != nil {
		t.Fatal(err)
	}
}

func TestPlaceMakesDirectoriesDurableOncePerProcess(t *testing.T) {
	s, err := Open(t.TempDir(), true)
	if err != nil {
		t.Fatal(err)
	}
	place := func() string {
		st, _ := s.NewStaged()
		st.File.WriteString("x")
		id := st.ID
		if err := s.Commit(st); err != nil {
			t.Fatal(err)
		}
		return id
	}
	id := place()
	dir := filepath.Dir(s.BlobPath(id))
	if _, ok := s.durable.Load(dir); !ok {
		t.Fatal("the new fan-out directory must be remembered as durable")
	}
	// a second blob in the same directory takes the fast path and still lands
	st, _ := s.NewStaged()
	st.File.WriteString("y")
	if err := s.Place(st.Path, id[:4]+"ffffffffffffffffffffffffff"); err != nil {
		t.Fatal(err)
	}
	st.File.Close()
	if _, err := os.Stat(filepath.Join(dir, id[:4]+"ffffffffffffffffffffffffff")); err != nil {
		t.Fatal(err)
	}
	// parts: the upload directory is created and remembered too
	p, err := s.NewPart("upload1")
	if err != nil {
		t.Fatal(err)
	}
	p.File.Close()
	if _, ok := s.durable.Load(filepath.Join(s.dir, "uploads", "upload1")); !ok {
		t.Fatal("the upload directory must be remembered")
	}
}

func TestRemovedUploadsAreForgotten(t *testing.T) {
	s, err := Open(t.TempDir(), true)
	if err != nil {
		t.Fatal(err)
	}
	for i := 0; i < 50; i++ {
		id := NewID()
		p, err := s.NewPart(id)
		if err != nil {
			t.Fatal(err)
		}
		p.File.Close()
		if err := s.RemoveUpload(id); err != nil {
			t.Fatal(err)
		}
	}
	n := 0
	s.durable.Range(func(k, _ any) bool { n++; return true })
	if n != 0 {
		t.Fatalf("%d removed upload directories are still remembered (unbounded growth)", n)
	}
}
