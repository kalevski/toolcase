package httpzip

import (
	"bytes"
	"crypto/sha256"
	"encoding/hex"
	"log/slog"
	"os"
	"sync"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// TestDownloadConcurrentDistinctPaths verifies that two concurrent download
// calls for the same domain write to distinct temp files and produce the
// correct hash for the content each received.
func TestDownloadConcurrentDistinctPaths(t *testing.T) {
	t.Parallel()

	content := buildZip(t)
	h := sha256.Sum256(content)
	wantHash := hex.EncodeToString(h[:])

	syncer := &Syncer{
		domain:  "example.com",
		dataDir: t.TempDir(),
		limits:  config.Limits{}.Effective(),
		log:     slog.Default(),
	}

	type result struct {
		path string
		hash string
		err  error
	}

	var wg sync.WaitGroup
	ch := make(chan result, 2)

	for range 2 {
		wg.Add(1)
		go func() {
			defer wg.Done()
			path, hash, _, err := syncer.download(bytes.NewReader(content))
			if path != "" {
				t.Cleanup(func() { os.Remove(path) })
			}
			ch <- result{path: path, hash: hash, err: err}
		}()
	}

	wg.Wait()
	close(ch)

	var results []result
	for r := range ch {
		results = append(results, r)
	}

	if len(results) != 2 {
		t.Fatalf("expected 2 results, got %d", len(results))
	}
	for i, r := range results {
		if r.err != nil {
			t.Errorf("goroutine %d: download error: %v", i, r.err)
		}
		if r.hash != wantHash {
			t.Errorf("goroutine %d: hash mismatch: got %s, want %s", i, r.hash, wantHash)
		}
	}
	if results[0].path == results[1].path {
		t.Errorf("concurrent downloads wrote to the same path: %s", results[0].path)
	}
}
