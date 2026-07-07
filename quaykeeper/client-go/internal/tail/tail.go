// Package tail is a rotation-safe file tailer for `quaykeeper-client logs --file`
// (log_ides.md §5.2, G24). It identifies files by dev:inode (not path, so a
// logrotate rename is followed correctly), persists per-file byte offsets in a
// single JSON state file so a restart resumes rather than re-ships, and re-globs
// on an interval to pick up newly-created files. Standard library only.
package tail

import (
	"encoding/json"
	"os"
	"path/filepath"
	"sync"
	"time"

	"context"
	"fmt"
	"syscall"
)

// maxLine caps a single line; a longer line is truncated (with an ellipsis) so a
// pathological file can't allocate unbounded memory.
const maxLine = 256 * 1024

// Options configure a Tailer.
type Options struct {
	// Globs are filepath.Glob patterns; the union of matches is tailed.
	Globs []string
	// StateDir holds the offset store (offsets.json). Empty = offsets not persisted
	// (a restart re-reads whole files — noisy; a state dir is strongly recommended).
	StateDir string
	// PollInterval is how often each tracked file is read (default 1s).
	PollInterval time.Duration
	// ReglobInterval is how often the glob set is re-evaluated (default 10s).
	ReglobInterval time.Duration
	// FromStart tails matched files from offset 0 the first time they are seen
	// (default false: start at end-of-file, so an existing large log isn't replayed).
	FromStart bool
}

// fileState is one tracked file's persisted position.
type fileState struct {
	Offset int64  `json:"offset"`
	Path   string `json:"path"` // last-seen path (debugging only; identity is the key)

	// Partial/Truncated carry an in-progress over-long line across polls. They are
	// in-memory only (not persisted): if the process restarts mid-truncated-line,
	// the remainder is simply treated as a fresh line, which is an acceptable loss
	// compared to persisting unbounded partial state.
	Partial   []byte `json:"-"`
	Truncated bool   `json:"-"`
}

// Tailer follows a set of files and calls back with each complete line.
type Tailer struct {
	opts      Options
	statePath string

	mu      sync.Mutex
	offsets map[string]fileState // "dev:ino" -> state
	seen    map[string]bool      // keys observed this run (for FromStart bootstrap)
	dirty   bool
}

// New builds a Tailer, loading any persisted offsets.
func New(opts Options) (*Tailer, error) {
	if opts.PollInterval <= 0 {
		opts.PollInterval = time.Second
	}
	if opts.ReglobInterval <= 0 {
		opts.ReglobInterval = 10 * time.Second
	}
	t := &Tailer{opts: opts, offsets: map[string]fileState{}, seen: map[string]bool{}}
	if opts.StateDir != "" {
		if err := os.MkdirAll(opts.StateDir, 0o750); err != nil {
			return nil, fmt.Errorf("state dir: %w", err)
		}
		t.statePath = filepath.Join(opts.StateDir, "offsets.json")
		t.loadState()
	}
	return t, nil
}

// Run tails until ctx is cancelled, invoking onLine for every complete line. A
// per-file read error is skipped (the file may be mid-rotation); the loop
// continues so one bad file never stops the rest.
func (t *Tailer) Run(ctx context.Context, onLine func(path string, line []byte)) error {
	poll := time.NewTicker(t.opts.PollInterval)
	defer poll.Stop()
	reglob := time.NewTicker(t.opts.ReglobInterval)
	defer reglob.Stop()

	paths := t.glob()
	t.readAll(paths, onLine)
	for {
		select {
		case <-ctx.Done():
			t.saveState()
			return ctx.Err()
		case <-reglob.C:
			paths = t.glob()
		case <-poll.C:
			t.readAll(paths, onLine)
			t.saveState()
		}
	}
}

func (t *Tailer) glob() []string {
	seen := map[string]bool{}
	var out []string
	for _, g := range t.opts.Globs {
		matches, err := filepath.Glob(g)
		if err != nil {
			continue
		}
		for _, m := range matches {
			if !seen[m] {
				seen[m] = true
				out = append(out, m)
			}
		}
	}
	return out
}

func (t *Tailer) readAll(paths []string, onLine func(path string, line []byte)) {
	for _, path := range paths {
		t.readOne(path, onLine)
	}
}

func (t *Tailer) readOne(path string, onLine func(path string, line []byte)) {
	fi, err := os.Stat(path)
	if err != nil || fi.IsDir() {
		return
	}
	key := fileKey(fi)
	if key == "" {
		return
	}

	t.mu.Lock()
	st, tracked := t.offsets[key]
	firstSight := !t.seen[key]
	t.seen[key] = true
	t.mu.Unlock()

	if !tracked {
		// New inode. Start at EOF unless FromStart, so an existing large log isn't
		// replayed on first attach; a rotated-in file (fresh inode) starts at 0.
		start := int64(0)
		if firstSight && !t.opts.FromStart {
			start = fi.Size()
		}
		st = fileState{Offset: start, Path: path}
		// Persist immediately: otherwise a file with no new bytes hits the
		// early-return below without being stored, `seen` still flips firstSight to
		// false, and the next poll re-derives start=0 — replaying the whole file.
		t.storeState(key, st, false)
	}
	// Truncation (logrotate copytruncate): the file shrank below our offset → reset.
	if fi.Size() < st.Offset {
		st.Offset = 0
	}
	if fi.Size() == st.Offset {
		if st.Path != path { // path changed without new bytes — record the rename
			st.Path = path
			t.storeState(key, st, true)
		}
		return
	}

	f, err := os.Open(path)
	if err != nil {
		return
	}
	defer f.Close()
	if _, err := f.Seek(st.Offset, 0); err != nil {
		return
	}
	consumed, partial, truncated := scanFrom(f, st.Partial, st.Truncated, func(line []byte) { onLine(path, line) })
	st.Offset += consumed
	st.Path = path
	st.Partial = partial
	st.Truncated = truncated
	t.storeState(key, st, false)
}

// truncatedMarker is appended to a line that exceeded maxLine.
var truncatedMarker = []byte("…[truncated]")

// scanFrom reads complete newline-terminated lines from f, invoking onLine for
// each, and returns the number of bytes consumed (up to and including the last
// newline), plus any in-progress over-long line carried into the next call.
// `partial`/`truncated` are the carry from the previous call (zero value if
// none); a trailing partial line that is *not* over-long is left unconsumed in
// the file itself (the offset isn't advanced past it) so the next poll simply
// re-reads it — no carry needed for that case.
//
// A line longer than maxLine is capped at maxLine bytes: once the cap is hit,
// further bytes are discarded (not accumulated) and the offset is still
// advanced past them, so memory stays bounded regardless of how long the line
// actually is. The capped prefix plus an ellipsis marker is emitted once the
// line's terminating newline is finally seen, even if that happens on a later
// poll.
func scanFrom(f *os.File, partial []byte, truncated bool, onLine func(line []byte)) (consumed int64, outPartial []byte, outTruncated bool) {
	buf := make([]byte, 0, 64*1024)
	tmp := make([]byte, 32*1024)
	line := append([]byte(nil), partial...)
	for {
		n, err := f.Read(tmp)
		if n > 0 {
			buf = append(buf, tmp[:n]...)
			for {
				idx := indexByte(buf, '\n')
				if idx < 0 {
					break
				}
				raw := buf[:idx]
				buf = buf[idx+1:]
				consumed += int64(idx + 1)

				if !truncated {
					remaining := maxLine - len(line)
					take := raw
					if len(take) > remaining {
						take = take[:remaining]
						truncated = true
					}
					line = append(line, take...)
				}

				emit := line
				if truncated {
					e := make([]byte, 0, len(line)+len(truncatedMarker))
					e = append(e, line...)
					e = append(e, truncatedMarker...)
					emit = e
				}
				out := make([]byte, len(emit))
				copy(out, emit)
				onLine(out)

				line = line[:0]
				truncated = false
			}
			// Cap the accumulator instead of growing it: keep only enough bytes to
			// fill `line` to maxLine, discard the rest, and mark the line truncated.
			// The offset still advances past the discarded bytes (they're gone for
			// good) so buf itself never grows unbounded while waiting for a newline.
			if len(buf) > maxLine {
				if !truncated {
					remaining := maxLine - len(line)
					take := buf
					if len(take) > remaining {
						take = take[:remaining]
					}
					line = append(line, take...)
					truncated = true
				}
				consumed += int64(len(buf))
				buf = buf[:0]
			}
		}
		if err != nil {
			break
		}
	}
	outPartial = append([]byte(nil), line...)
	outTruncated = truncated
	return consumed, outPartial, outTruncated
}

func indexByte(b []byte, c byte) int {
	for i := 0; i < len(b); i++ {
		if b[i] == c {
			return i
		}
	}
	return -1
}

// fileKey identifies a file by device + inode so a rename (logrotate) is followed.
func fileKey(fi os.FileInfo) string {
	sys, ok := fi.Sys().(*syscall.Stat_t)
	if !ok {
		return ""
	}
	return fmt.Sprintf("%d:%d", uint64(sys.Dev), uint64(sys.Ino))
}

func (t *Tailer) storeState(key string, st fileState, fsyncNow bool) {
	t.mu.Lock()
	t.offsets[key] = st
	t.dirty = true
	t.mu.Unlock()
	if fsyncNow {
		t.saveState()
	}
}

func (t *Tailer) loadState() {
	b, err := os.ReadFile(t.statePath)
	if err != nil {
		return
	}
	var m map[string]fileState
	if json.Unmarshal(b, &m) == nil && m != nil {
		t.offsets = m
	}
}

func (t *Tailer) saveState() {
	if t.statePath == "" {
		return
	}
	t.mu.Lock()
	if !t.dirty {
		t.mu.Unlock()
		return
	}
	snapshot := make(map[string]fileState, len(t.offsets))
	for k, v := range t.offsets {
		snapshot[k] = v
	}
	t.dirty = false
	t.mu.Unlock()

	b, err := json.MarshalIndent(snapshot, "", "  ")
	if err != nil {
		return
	}
	tmp := t.statePath + ".tmp"
	if os.WriteFile(tmp, b, 0o640) == nil {
		_ = os.Rename(tmp, t.statePath)
	}
}
