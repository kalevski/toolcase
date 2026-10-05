package app_test

import (
	"context"
	"database/sql"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"
	"time"

	_ "modernc.org/sqlite"

	"github.com/kalevski/toolcase/binvault/internal/app"
	"github.com/kalevski/toolcase/binvault/internal/config"
)

// runNode starts a node on cfg with its log captured, and returns it with a stop func.
func runNode(t *testing.T, cfg *config.Config, w io.Writer) (*node, func()) {
	t.Helper()
	ctx, cancel := context.WithCancel(context.Background())
	a, err := app.New(ctx, cfg, slog.New(slog.NewTextHandler(w, nil)), app.Build{Version: "test"})
	if err != nil {
		cancel()
		t.Fatal(err)
	}
	done := make(chan struct{})
	go func() { _ = a.Run(ctx); close(done) }()
	n := &node{t: t, app: a, s3URL: "http://" + a.PublicAddr(), adminURL: "http://" + a.AdminAddr(), adminTok: cfg.AdminToken[0], dir: cfg.DataDir}
	var once bool
	stop := func() {
		if !once {
			once = true
			cancel()
			<-done
		}
	}
	t.Cleanup(stop)
	return n, stop
}

// Lifecycle and the scrubber run once shortly after boot, then every interval (spec §3.9): with
// intervals of an hour a node that restarts daily would otherwise never expire or verify anything.
// The scrubber stays off at interval 0.
func TestLifecycleAndScrubberRunSoonAfterBoot(t *testing.T) {
	dir := t.TempDir()
	cfg := cfgFor(dir, key32())
	cfg.MinFreeMB = 1
	cfg.EndpointURL = "http://127.0.0.1:9000"
	cfg.LifecycleInterval, cfg.ScrubInterval = time.Hour, time.Hour

	// a first node, whose jobs do not fire, holds an expired object and a damaged blob
	restore := app.SetJobStartDelay(time.Hour)
	t.Cleanup(restore)
	n, stop := runNode(t, cfg, io.Discard)
	n.bucket("tmp", map[string]any{"lifecycle": []map[string]any{{"id": "r", "expire_days": 1}}})
	n.bucket("keep", nil)
	n.must(n.token("tmp", all, nil), 200, "PUT", "/tmp/old", []byte("old data"))
	n.must(n.token("keep", all, nil), 200, "PUT", "/keep/x", []byte("precious"))
	stop()
	_ = filepath.Walk(filepath.Join(dir, "blobs"), func(p string, fi os.FileInfo, err error) error {
		if err == nil && !fi.IsDir() {
			if err := os.WriteFile(p, []byte("damaged"), 0o600); err != nil {
				t.Fatal(err)
			}
		}
		return nil
	})
	db, err := sql.Open("sqlite", "file:"+filepath.Join(dir, "meta.db"))
	if err != nil {
		t.Fatal(err)
	}
	if _, err := db.Exec(`UPDATE objects SET created_at = created_at - 3*24*3600*1000`); err != nil { // both are three days old
		t.Fatal(err)
	}
	db.Close()

	// the second node runs both at about 150 ms
	restore()
	t.Cleanup(app.SetJobStartDelay(150 * time.Millisecond))
	logs := &syncBuf{}
	n2, stop2 := runNode(t, cfg, logs)
	deadline := time.Now().Add(10 * time.Second)
	for {
		_, b := n2.admin("GET", "/buckets/tmp", nil)
		objects := b["stats"].(map[string]any)["objects"].(float64)
		if objects == 0 && strings.Contains(logs.String(), "scrubber: integrity mismatch") && strings.Contains(logs.String(), "scrubber finished") {
			break
		}
		if time.Now().After(deadline) {
			t.Fatalf("after boot the bucket holds %v objects, the log says:\n%s", objects, logs.String())
		}
		time.Sleep(50 * time.Millisecond)
	}
	stop2()

	// scrub interval 0: no scrubber
	cfg.ScrubInterval = 0
	logs3 := &syncBuf{}
	_, stop3 := runNode(t, cfg, logs3)
	time.Sleep(600 * time.Millisecond)
	stop3()
	if strings.Contains(logs3.String(), "scrubber") {
		t.Fatalf("the scrubber ran with BINVAULT_SCRUB_INTERVAL=0:\n%s", logs3.String())
	}
}
