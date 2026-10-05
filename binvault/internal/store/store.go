// Package store is the filesystem blob store (spec §3.1, §3.4): immutable
// object bodies named by random id under blobs/ab/cd/<id>, an uploads/ area for
// multipart parts and a tmp/ area for in-flight and staged files. tmp/,
// uploads/ and blobs/ live on one filesystem so a staged file is committed with
// an atomic rename.
package store

import (
	"crypto/rand"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"path/filepath"
	"strings"
	"sync"
	"syscall"
	"time"
)

// Store is a data directory.
type Store struct {
	dir   string
	fsync bool
	// lock is the open LOCK file while this process holds the data directory
	// (Open, Lock); nil for a store that does not.
	lock *os.File
	// durable remembers directories whose own entry (and their ancestors' up to
	// the data dir) has been fsynced, so steady-state blob placement costs one
	// directory sync instead of three.
	durable sync.Map
}

// FormatMarker is written to <dir>/FORMAT.
const FormatMarker = "binvault-data-v1\n"

// Open prepares the data directory: creates blobs/, uploads/ and tmp/, takes the
// directory's exclusive lock (a second process on a live data dir fails with
// *InUseError instead of emptying the first one's tmp/; spec §3.1), writes the
// FORMAT marker, and empties tmp/ (staging files never survive a restart). Close
// releases the lock.
func Open(dir string, fsync bool) (*Store, error) {
	s := &Store{dir: dir, fsync: fsync}
	for _, sub := range []string{"blobs", "uploads", "tmp"} {
		if err := os.MkdirAll(filepath.Join(dir, sub), 0o750); err != nil {
			return nil, err
		}
	}
	if err := s.Lock(); err != nil {
		return nil, err
	}
	marker := filepath.Join(dir, "FORMAT")
	if b, err := os.ReadFile(marker); err == nil {
		if string(b) != FormatMarker {
			s.Close()
			return nil, fmt.Errorf("store: %s has unknown on-disk format %q", dir, strings.TrimSpace(string(b)))
		}
	} else if errors.Is(err, fs.ErrNotExist) {
		if err := os.WriteFile(marker, []byte(FormatMarker), 0o640); err != nil {
			s.Close()
			return nil, err
		}
	} else {
		s.Close()
		return nil, err
	}
	// SQLite would create meta.db 0644 and give its -wal and -shm the same mode:
	// create the empty file first, so that all three are 0640 like the rest of the
	// data dir (an existing database keeps its mode)
	f, err := os.OpenFile(s.MetaPath(), os.O_CREATE|os.O_RDWR, 0o640)
	if err != nil {
		s.Close()
		return nil, err
	}
	f.Close()
	if err := s.ClearTmp(); err != nil {
		s.Close()
		return nil, err
	}
	return s, nil
}

// Inspect returns a Store for looking at a data directory without changing it
// (`binvault validate`, and `rekey` once it has called Lock): nothing is created,
// no format marker is written, no lock is taken, and tmp/ is left alone because a
// running node may be using it.
func Inspect(dir string) (*Store, error) {
	fi, err := os.Stat(dir)
	if err != nil {
		return nil, err
	}
	if !fi.IsDir() {
		return nil, fmt.Errorf("store: %s is not a directory", dir)
	}
	if b, err := os.ReadFile(filepath.Join(dir, "FORMAT")); err == nil && string(b) != FormatMarker {
		return nil, fmt.Errorf("store: %s has unknown on-disk format %q", dir, strings.TrimSpace(string(b)))
	}
	return &Store{dir: dir}, nil
}

// Dir returns the data directory.
func (s *Store) Dir() string { return s.dir }

// MetaPath is where meta.db lives.
func (s *Store) MetaPath() string { return filepath.Join(s.dir, "meta.db") }

// ClearTmp removes everything under tmp/ (boot; spec §3.9).
func (s *Store) ClearTmp() error {
	ents, err := os.ReadDir(filepath.Join(s.dir, "tmp"))
	if err != nil {
		return err
	}
	for _, e := range ents {
		if err := os.RemoveAll(filepath.Join(s.dir, "tmp", e.Name())); err != nil {
			return err
		}
	}
	return nil
}

// NewID returns a random 128-bit hex id (blob ids, part ids, staging ids).
func NewID() string {
	var b [16]byte
	if _, err := rand.Read(b[:]); err != nil {
		panic("store: no randomness: " + err.Error())
	}
	return hex.EncodeToString(b[:])
}

// ValidID reports whether id looks like an id from NewID.
func ValidID(id string) bool {
	if len(id) != 32 {
		return false
	}
	for i := 0; i < len(id); i++ {
		c := id[i]
		if !(c >= '0' && c <= '9' || c >= 'a' && c <= 'f') {
			return false
		}
	}
	return true
}

// BlobPath is the final location of a blob.
func (s *Store) BlobPath(id string) string {
	return filepath.Join(s.dir, "blobs", id[0:2], id[2:4], id)
}

// Staged is a file in tmp/ that will become a blob.
type Staged struct {
	ID   string // becomes the blob id on Commit
	Path string
	File *os.File
}

// NewStaged creates an empty staging file (mode 0600) for a future blob.
func (s *Store) NewStaged() (*Staged, error) {
	id := NewID()
	p := filepath.Join(s.dir, "tmp", id)
	f, err := os.OpenFile(p, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return nil, err
	}
	return &Staged{ID: id, Path: p, File: f}, nil
}

// Discard closes and removes a staging file.
func (st *Staged) Discard() {
	if st == nil {
		return
	}
	if st.File != nil {
		st.File.Close()
	}
	os.Remove(st.Path)
}

// Sync flushes the staged file to stable storage (if fsync is on).
func (s *Store) Sync(f *os.File) error {
	if !s.fsync {
		return nil
	}
	return f.Sync()
}

// Commit makes the staged file a blob: fsync the file, atomically rename it into
// blobs/ab/cd/<id>, fsync the directories. The file handle is closed.
func (s *Store) Commit(st *Staged) error {
	if err := s.Sync(st.File); err != nil {
		return err
	}
	if err := st.File.Close(); err != nil {
		return err
	}
	st.File = nil
	return s.Place(st.Path, st.ID)
}

// Place moves an existing file (same filesystem) into the blob tree as id.
func (s *Store) Place(srcPath, id string) error {
	dst := s.BlobPath(id)
	dir := filepath.Dir(dst)
	if err := s.ensureDir(dir); err != nil {
		return err
	}
	if err := os.Rename(srcPath, dst); err != nil {
		return err
	}
	if s.fsync {
		return syncDir(dir)
	}
	return nil
}

// ensureDir creates dir (and missing ancestors below the data dir) and, with
// fsync on, makes its directory entry durable once per process: the first
// writer into a directory syncs the parents; later writers skip it.
func (s *Store) ensureDir(dir string) error {
	if _, ok := s.durable.Load(dir); ok {
		return nil
	}
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	if s.fsync {
		// persist the new entries bottom-up: dir in its parent, that parent in
		// its own, ... up to (and including) the data dir's child
		for d := dir; d != s.dir && strings.HasPrefix(d, s.dir); d = filepath.Dir(d) {
			if err := syncDir(filepath.Dir(d)); err != nil {
				return err
			}
		}
	}
	s.durable.Store(dir, struct{}{})
	return nil
}

// Open opens a blob for reading.
func (s *Store) Open(id string) (*os.File, error) {
	if !ValidID(id) {
		return nil, fs.ErrNotExist
	}
	return os.Open(s.BlobPath(id))
}

// Size returns a blob's size on disk.
func (s *Store) Size(id string) (int64, error) {
	fi, err := os.Stat(s.BlobPath(id))
	if err != nil {
		return 0, err
	}
	return fi.Size(), nil
}

// Remove unlinks a blob (idempotent). Open readers keep reading (POSIX).
func (s *Store) Remove(id string) error {
	if !ValidID(id) {
		return nil
	}
	err := os.Remove(s.BlobPath(id))
	if errors.Is(err, fs.ErrNotExist) {
		return nil
	}
	return err
}

// ---- multipart parts -------------------------------------------------------

// PartPath is where one part file lives.
func (s *Store) PartPath(uploadID, partID string) string {
	return filepath.Join(s.dir, "uploads", uploadID, partID)
}

// NewPart creates an empty part file (and its upload directory).
func (s *Store) NewPart(uploadID string) (*Staged, error) {
	dir := filepath.Join(s.dir, "uploads", uploadID)
	if err := s.ensureDir(dir); err != nil {
		return nil, err
	}
	id := NewID()
	p := filepath.Join(dir, id)
	f, err := os.OpenFile(p, os.O_RDWR|os.O_CREATE|os.O_EXCL, 0o600)
	if err != nil {
		return nil, err
	}
	return &Staged{ID: id, Path: p, File: f}, nil
}

// FinishPart fsyncs and closes a part file.
func (s *Store) FinishPart(st *Staged) error {
	if err := s.Sync(st.File); err != nil {
		return err
	}
	err := st.File.Close()
	st.File = nil
	if err == nil && s.fsync {
		err = syncDir(filepath.Dir(st.Path))
	}
	return err
}

// OpenPart opens a part file.
func (s *Store) OpenPart(uploadID, partID string) (*os.File, error) {
	return os.Open(s.PartPath(uploadID, partID))
}

// PartSize returns the size of a part file on disk.
func (s *Store) PartSize(uploadID, partID string) (int64, error) {
	fi, err := os.Stat(s.PartPath(uploadID, partID))
	if err != nil {
		return 0, err
	}
	return fi.Size(), nil
}

// PlacePart moves an existing file (same filesystem) in as the part file
// uploads/<uploadID>/<partID>, making the placement durable the way a part written
// here is (the bucket move receives part files this way, spec §8.8 step 2).
func (s *Store) PlacePart(srcPath, uploadID, partID string) error {
	dir := filepath.Join(s.dir, "uploads", uploadID)
	if err := s.ensureDir(dir); err != nil {
		return err
	}
	if err := os.Rename(srcPath, filepath.Join(dir, partID)); err != nil {
		return err
	}
	if s.fsync {
		return syncDir(dir)
	}
	return nil
}

// RemovePart deletes one part file.
func (s *Store) RemovePart(uploadID, partID string) {
	os.Remove(s.PartPath(uploadID, partID))
}

// RemoveUpload deletes an upload directory with all its parts.
func (s *Store) RemoveUpload(uploadID string) error {
	if uploadID == "" || strings.ContainsAny(uploadID, "/\\") || uploadID == "." || uploadID == ".." {
		return errors.New("store: bad upload id")
	}
	dir := filepath.Join(s.dir, "uploads", uploadID)
	s.durable.Delete(dir) // the memo must not outlive the directory: it would grow with every upload
	return os.RemoveAll(dir)
}

// NewTemp creates a scratch file in tmp/ (assembled multipart bodies etc.).
func (s *Store) NewTemp() (*Staged, error) { return s.NewStaged() }

// ---- disk space and maintenance -------------------------------------------

// FreeBytes reports free space on the data directory's filesystem.
func (s *Store) FreeBytes() (uint64, error) {
	var st syscall.Statfs_t
	if err := syscall.Statfs(s.dir, &st); err != nil {
		return 0, err
	}
	return uint64(st.Bavail) * uint64(st.Bsize), nil
}

// CheckSameFilesystem verifies the data dir, tmp/, uploads/ and blobs/ share a
// device so renames are atomic (`validate`, spec §2.1). The data dir itself is
// compared too: on a fresh one tmp/ and uploads/ do not exist yet, and a blobs/
// that is a mount of another filesystem would be compared with nothing, although
// `run` creates tmp/ and uploads/ next to meta.db and then refuses it.
func (s *Store) CheckSameFilesystem() error {
	var dev uint64
	var first string
	for _, sub := range []string{"", "tmp", "uploads", "blobs"} {
		name := sub + "/"
		if sub == "" {
			name = "the data dir"
		}
		fi, err := os.Stat(filepath.Join(s.dir, sub))
		if errors.Is(err, fs.ErrNotExist) {
			continue // a fresh data dir: nothing to compare yet
		}
		if err != nil {
			return err
		}
		sys, ok := fi.Sys().(*syscall.Stat_t)
		if !ok {
			return nil // platform without device ids
		}
		d := uint64(sys.Dev)
		if first == "" {
			dev, first = d, name
		} else if d != dev {
			return fmt.Errorf("store: %s is on a different filesystem than %s; the data dir, tmp/, uploads/ and blobs/ must share one so staged files commit with an atomic rename", name, first)
		}
	}
	return nil
}

// CheckWritable proves the directory accepts writes (health check).
func (s *Store) CheckWritable() error {
	p := filepath.Join(s.dir, ".probe-"+NewID())
	if err := os.WriteFile(p, []byte("x"), 0o600); err != nil {
		return err
	}
	return os.Remove(p)
}

// WalkBlobs calls fn for every file under blobs/ (id, size, modtime).
func (s *Store) WalkBlobs(fn func(id string, size int64, mod time.Time) error) error {
	root := filepath.Join(s.dir, "blobs")
	return filepath.WalkDir(root, func(path string, d fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if d.IsDir() {
			return nil
		}
		if !ValidID(d.Name()) {
			return nil
		}
		fi, err := d.Info()
		if err != nil {
			return nil // vanished
		}
		return fn(d.Name(), fi.Size(), fi.ModTime())
	})
}

// UploadDirs lists the upload directories under uploads/ with their mod times.
func (s *Store) UploadDirs() (map[string]time.Time, error) {
	ents, err := os.ReadDir(filepath.Join(s.dir, "uploads"))
	if err != nil {
		return nil, err
	}
	out := map[string]time.Time{}
	for _, e := range ents {
		if !e.IsDir() {
			continue
		}
		if fi, err := e.Info(); err == nil {
			out[e.Name()] = fi.ModTime()
		}
	}
	return out, nil
}

func syncDir(path string) error {
	d, err := os.Open(path)
	if err != nil {
		return err
	}
	defer d.Close()
	if err := d.Sync(); err != nil && !errors.Is(err, syscall.EINVAL) {
		return err
	}
	return nil
}

// CopyN copies n bytes using a pooled buffer; a helper for streaming code.
func CopyN(dst io.Writer, src io.Reader, n int64) (int64, error) {
	buf := bufPool.Get().(*[]byte)
	defer bufPool.Put(buf)
	return io.CopyBuffer(dst, io.LimitReader(src, n), *buf)
}
