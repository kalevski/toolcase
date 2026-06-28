package admin

import (
	"net/http"
	"os"
	"path/filepath"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

const validStreamInline = `streams:
  - name: postgres
    listen: 5432
    pass: 10.0.0.9:5432
`

func TestCreateStreamWritesFragmentAndReloads(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := do(env, http.MethodPost, "/streams", validStreamInline, "")
	if rec.Code != http.StatusCreated {
		t.Fatalf("want 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "stream-postgres.yml")); err != nil {
		t.Fatalf("fragment not written: %v", err)
	}
	if *env.reloads != 1 {
		t.Errorf("want one reload, got %d", *env.reloads)
	}
}

func TestCreateStreamReferencingStreamUpstream(t *testing.T) {
	env := newSitesEnv(t, "")
	env.cfg.StreamUpstreams = []config.StreamUpstream{{
		Name: "db_pool", File: env.cfg.Path,
		Servers: []config.StreamUpstreamServer{{Address: "10.0.0.1:5432"}},
	}}
	stream := "streams:\n  - name: postgres\n    listen: 5432\n    upstream: db_pool\n"
	if rec := do(env, http.MethodPost, "/streams", stream, ""); rec.Code != http.StatusCreated {
		t.Fatalf("want 201, got %d (%s)", rec.Code, rec.Body.String())
	}
}

func TestCreateStreamUnknownUpstreamRejected(t *testing.T) {
	env := newSitesEnv(t, "")
	stream := "streams:\n  - name: postgres\n    listen: 5432\n    upstream: ghost\n"
	rec := do(env, http.MethodPost, "/streams", stream, "")
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d (%s)", rec.Code, rec.Body.String())
	}
}

func TestDeleteStreamUpstreamStillInUseIs409(t *testing.T) {
	env := newSitesEnv(t, "")
	env.cfg.StreamUpstreams = []config.StreamUpstream{{
		Name: "db_pool", File: filepath.Join(env.sitesDir, "stream-upstream-db_pool.yml"),
		Servers: []config.StreamUpstreamServer{{Address: "10.0.0.1:5432"}},
	}}
	env.cfg.Streams = []config.Stream{{
		Name: "postgres", Listen: 5432, Upstream: "db_pool",
		File: filepath.Join(env.sitesDir, "stream-postgres.yml"),
	}}
	// Drop a file so the delete handler has something to target.
	if err := os.WriteFile(env.cfg.StreamUpstreams[0].File, []byte("x"), 0o640); err != nil {
		t.Fatal(err)
	}
	rec := do(env, http.MethodDelete, "/stream-upstreams/db_pool", "", "")
	if rec.Code != http.StatusConflict {
		t.Fatalf("want 409 while referenced, got %d (%s)", rec.Code, rec.Body.String())
	}
}

func TestStreamRejectsMixedFragment(t *testing.T) {
	env := newSitesEnv(t, "")
	body := validStreamInline + "sites:\n  - domain: x.example.com\n    source: {type: git, url: https://github.com/a/b.git, branch: main}\n"
	if rec := do(env, http.MethodPost, "/streams", body, ""); rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d (%s)", rec.Code, rec.Body.String())
	}
}

// Managed mode is off in the test config, so /nginx/test reports 501.
func TestNginxTestNotManaged(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := do(env, http.MethodPost, "/nginx/test", "", "")
	if rec.Code != http.StatusNotImplemented {
		t.Fatalf("want 501 when managed off, got %d (%s)", rec.Code, rec.Body.String())
	}
}
