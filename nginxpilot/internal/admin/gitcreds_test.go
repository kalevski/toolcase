package admin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func TestGitCredentialsLifecycle(t *testing.T) {
	h := newTestServer(t, &config.Config{})

	// PUT a new credential → 201 created with the on-disk path.
	rec := httptest.NewRecorder()
	req := httptest.NewRequest(http.MethodPut, "/git-credentials/perch-abc123", strings.NewReader(`{"token":"ghs_secret"}`))
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusCreated {
		t.Fatalf("PUT want 201, got %d: %s", rec.Code, rec.Body.String())
	}
	var put struct {
		Status string `json:"status"`
		Name   string `json:"name"`
		Path   string `json:"path"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &put); err != nil {
		t.Fatalf("PUT body: %v", err)
	}
	if put.Status != "created" || put.Name != "perch-abc123" || put.Path == "" {
		t.Fatalf("PUT result = %+v", put)
	}
	raw, err := os.ReadFile(put.Path)
	if err != nil {
		t.Fatalf("token file not written: %v", err)
	}
	if string(raw) != "ghs_secret\n" {
		t.Errorf("token file content = %q", raw)
	}

	// Replace → 200 replaced, same path.
	rec = httptest.NewRecorder()
	req = httptest.NewRequest(http.MethodPut, "/git-credentials/perch-abc123", strings.NewReader(`{"token":"ghs_rotated"}`))
	h.ServeHTTP(rec, req)
	if rec.Code != http.StatusOK {
		t.Fatalf("PUT replace want 200, got %d", rec.Code)
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &put)
	if put.Status != "replaced" {
		t.Errorf("replace status = %q", put.Status)
	}

	// GET lists metadata only — never the token.
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/git-credentials", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("GET want 200, got %d", rec.Code)
	}
	body := rec.Body.String()
	if !strings.Contains(body, "perch-abc123") {
		t.Errorf("GET body missing name: %s", body)
	}
	if strings.Contains(body, "ghs_rotated") {
		t.Errorf("GET body leaks the token: %s", body)
	}

	// DELETE → gone; a second DELETE is a 404.
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/git-credentials/perch-abc123", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("DELETE want 200, got %d", rec.Code)
	}
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodDelete, "/git-credentials/perch-abc123", nil))
	if rec.Code != http.StatusNotFound {
		t.Fatalf("second DELETE want 404, got %d", rec.Code)
	}
}

func TestGitCredentialsRejectsBadInput(t *testing.T) {
	h := newTestServer(t, &config.Config{})

	// Traversal-shaped names never reach the filesystem. A slash in the path
	// doesn't match the {name} route (404); a dot-prefixed name is caught by
	// the validator (400).
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPut, "/git-credentials/.hidden", strings.NewReader(`{"token":"x"}`)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("dot name want 400, got %d", rec.Code)
	}

	// Empty token → 400.
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPut, "/git-credentials/ok", strings.NewReader(`{"token":""}`)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("empty token want 400, got %d", rec.Code)
	}

	// Bad JSON → 400.
	rec = httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPut, "/git-credentials/ok", strings.NewReader(`{`)))
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("bad JSON want 400, got %d", rec.Code)
	}
}
