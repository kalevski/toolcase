package manager

import (
	"archive/zip"
	"bytes"
	"context"
	"io"
	"log/slog"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
	"github.com/kalevski/toolcase/nginxpilot/internal/deploy"
	"github.com/kalevski/toolcase/nginxpilot/internal/state"
)

// zipOf builds an in-memory zip with the given relative files.
func zipOf(t *testing.T, files map[string]string) []byte {
	t.Helper()
	var buf bytes.Buffer
	w := zip.NewWriter(&buf)
	for name, body := range files {
		f, err := w.Create(name)
		if err != nil {
			t.Fatal(err)
		}
		if _, err := io.WriteString(f, body); err != nil {
			t.Fatal(err)
		}
	}
	if err := w.Close(); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

// TestSyncAppDeploysAndKeepsPersistentData walks the real pipeline — fetch,
// excludes, gates, persistent relink, atomic swap — twice, and proves an upload
// written between the two deploys is still there afterwards. This is the
// end-to-end version of the claim §3 rests on.
func TestSyncAppDeploysAndKeepsPersistentData(t *testing.T) {
	dataDir := t.TempDir()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	payload := zipOf(t, map[string]string{"index.php": "<?php echo 'v1';"})
	var serve []byte = payload
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(serve)
	}))
	defer srv.Close()

	app := config.App{
		Domain:  "shop.example.com",
		Runtime: config.RuntimePHP,
		Source: config.Source{
			Type:          config.SourceHTTPZip,
			URL:           srv.URL + "/site.zip",
			AllowInsecure: true,
		},
		PHP: config.AppPHP{
			Routing:    config.PHPRoutingFrontController,
			Index:      "index.php",
			Persistent: []string{"wp-content/uploads"},
		},
	}
	defaults := config.Defaults{KeepReleases: 2}

	store, err := state.NewStore(filepath.Join(dataDir, "state"))
	if err != nil {
		t.Fatal(err)
	}
	dep := deploy.New(dataDir, log)

	if _, err := SyncApp(context.Background(), app, defaults, dataDir, store, dep, log); err != nil {
		t.Fatalf("first sync: %v", err)
	}
	if !dep.AppCurrentExists(app.Domain) {
		t.Fatal("app current does not exist after first sync")
	}

	// The running application writes an upload through the persistent symlink.
	upload := filepath.Join(dep.AppCurrentPath(app.Domain), "wp-content/uploads/photo.jpg")
	if err := os.WriteFile(upload, []byte("jpeg"), 0o640); err != nil {
		t.Fatalf("write upload: %v", err)
	}

	// New code ships; the source content changes so the sync is not a no-op.
	serve = zipOf(t, map[string]string{"index.php": "<?php echo 'v2';"})
	if _, err := SyncApp(context.Background(), app, defaults, dataDir, store, dep, log); err != nil {
		t.Fatalf("second sync: %v", err)
	}

	// New code is live.
	body, err := os.ReadFile(filepath.Join(dep.AppCurrentPath(app.Domain), "index.php"))
	if err != nil {
		t.Fatal(err)
	}
	if !bytes.Contains(body, []byte("v2")) {
		t.Fatalf("code was not redeployed: %q", body)
	}

	// And the upload survived it.
	got, err := os.ReadFile(upload)
	if err != nil {
		t.Fatalf("upload lost across redeploy: %v", err)
	}
	if string(got) != "jpeg" {
		t.Fatalf("upload corrupted: %q", got)
	}
}

// TestSyncAppRefusesEscapingPersistentPath proves the containment guard is on
// the real path, not only the unit-tested helper.
func TestSyncAppRefusesEscapingPersistentPath(t *testing.T) {
	dataDir := t.TempDir()
	log := slog.New(slog.NewTextHandler(io.Discard, nil))

	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/zip")
		_, _ = w.Write(zipOf(t, map[string]string{"index.php": "<?php"}))
	}))
	defer srv.Close()

	app := config.App{
		Domain:  "evil.example.com",
		Runtime: config.RuntimePHP,
		Source: config.Source{
			Type:          config.SourceHTTPZip,
			URL:           srv.URL + "/site.zip",
			AllowInsecure: true,
		},
		PHP: config.AppPHP{Index: "index.php", Persistent: []string{"../../etc"}},
	}

	store, err := state.NewStore(filepath.Join(dataDir, "state"))
	if err != nil {
		t.Fatal(err)
	}
	dep := deploy.New(dataDir, log)

	if _, err := SyncApp(context.Background(), app, config.Defaults{KeepReleases: 2}, dataDir, store, dep, log); err == nil {
		t.Fatal("an escaping persistent path must fail the sync")
	}
	// The failure must have happened before the swap: no release is live.
	if dep.AppCurrentExists(app.Domain) {
		t.Fatal("a failed sync must leave no live release")
	}
}
