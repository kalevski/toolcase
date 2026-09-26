package admin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"strings"
	"testing"
)

const validLogDestFragment = `log_destinations:
  - name: audit-file
    type: file
    path: /var/log/nginxpilot/access-5xx.ndjson
    filter:
      status: [">=500"]
`

func logDestReq(env sitesEnv, method, path, body string) *httptest.ResponseRecorder {
	var req *http.Request
	if body == "" {
		req = httptest.NewRequest(method, path, nil)
	} else {
		req = httptest.NewRequest(method, path, strings.NewReader(body))
	}
	rec := httptest.NewRecorder()
	env.h.ServeHTTP(rec, req)
	return rec
}

func TestCreateLogDestWritesFragmentAndReloads(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := logDestReq(env, http.MethodPost, "/log-destinations", validLogDestFragment)
	if rec.Code != http.StatusCreated {
		t.Fatalf("want 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	written, err := os.ReadFile(filepath.Join(env.sitesDir, "logdest-audit-file.yml"))
	if err != nil {
		t.Fatalf("fragment not written: %v", err)
	}
	if string(written) != validLogDestFragment {
		t.Errorf("on-disk fragment differs from request body:\n%s", written)
	}
	if *env.reloads != 1 {
		t.Errorf("want exactly one reload, got %d", *env.reloads)
	}
}

func TestCreateLogDestRejectsBadName(t *testing.T) {
	env := newSitesEnv(t, "")
	bad := strings.Replace(validLogDestFragment, "audit-file", "../../etc/cron.d/pwn", 1)
	rec := logDestReq(env, http.MethodPost, "/log-destinations", bad)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d (%s)", rec.Code, rec.Body.String())
	}
}

func TestCreateLogDestRejectsInvalidDestination(t *testing.T) {
	env := newSitesEnv(t, "")
	cases := map[string]string{
		"bad filter field": `log_destinations:
  - name: x
    type: stdout
    filter:
      remote_addr: ["1.2.3.4"]
`,
		"plain http url": `log_destinations:
  - name: x
    type: http
    url: http://collector.example.com/ingest
`,
		"two destinations": validLogDestFragment + `  - name: second
    type: stdout
`,
		"wrong kind": validFragment,
	}
	for name, frag := range cases {
		t.Run(name, func(t *testing.T) {
			rec := logDestReq(env, http.MethodPost, "/log-destinations", frag)
			if rec.Code != http.StatusBadRequest {
				t.Fatalf("want 400, got %d (%s)", rec.Code, rec.Body.String())
			}
		})
	}
	entries, _ := os.ReadDir(env.sitesDir)
	if len(entries) != 0 {
		t.Errorf("rejected fragments must never land on disk: %v", entries)
	}
}

func TestCreateLogDestStoresInlineCredentials(t *testing.T) {
	env := newSitesEnv(t, "")
	frag := `log_destinations:
  - name: x
    type: loki
    url: https://loki.example.com/push
    auth:
      method: header
      header_name: X-Api-Key
      header_value: inline-secret
`
	rec := logDestReq(env, http.MethodPost, "/log-destinations", frag)
	if rec.Code != http.StatusCreated {
		t.Fatalf("want 201, got %d (%s)", rec.Code, rec.Body.String())
	}
	written, err := os.ReadFile(filepath.Join(env.sitesDir, "logdest-x.yml"))
	if err != nil {
		t.Fatalf("fragment not written: %v", err)
	}
	if strings.Contains(string(written), "inline-secret") {
		t.Fatalf("the secret must not reach the fragment:\n%s", written)
	}
	path := filepath.Join(env.cfg.DataDir, "log-credentials", "x", "header-value")
	if !strings.Contains(string(written), "header_value_file: "+path) {
		t.Errorf("fragment should reference %s:\n%s", path, written)
	}
	info, err := os.Stat(path)
	if err != nil {
		t.Fatalf("credential file not written: %v", err)
	}
	if info.Mode().Perm() != 0o600 {
		t.Errorf("credential file mode = %v, want 0600", info.Mode().Perm())
	}

	rec = logDestReq(env, http.MethodDelete, "/log-destinations/x", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("delete: want 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Dir(path)); !os.IsNotExist(err) {
		t.Errorf("credential dir should be removed with the destination")
	}
}

func TestDeleteLogDest(t *testing.T) {
	env := newSitesEnv(t, "")
	if rec := logDestReq(env, http.MethodPost, "/log-destinations", validLogDestFragment); rec.Code != http.StatusCreated {
		t.Fatalf("setup write failed: %d", rec.Code)
	}
	rec := logDestReq(env, http.MethodDelete, "/log-destinations/audit-file", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "logdest-audit-file.yml")); !os.IsNotExist(err) {
		t.Error("fragment must be removed")
	}
	if rec := logDestReq(env, http.MethodDelete, "/log-destinations/audit-file", ""); rec.Code != http.StatusNotFound {
		t.Errorf("second delete: want 404, got %d", rec.Code)
	}
}

func TestListLogDestsAlwaysArray(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := logDestReq(env, http.MethodGet, "/log-destinations", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	var out map[string]json.RawMessage
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if string(out["log_destinations"]) != "[]" {
		t.Errorf("empty list must serialize as [], got %s", out["log_destinations"])
	}
}

func TestLogsStatusEndpoint(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := logDestReq(env, http.MethodGet, "/logs/status", "")
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d", rec.Code)
	}
	var out struct {
		Enabled      bool              `json:"enabled"`
		Destinations []json.RawMessage `json:"destinations"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out.Enabled {
		t.Error("access logging is not enabled in the test config")
	}
	if out.Destinations == nil {
		t.Error("destinations must serialize as an array")
	}
}

func TestTestLogDestCandidate(t *testing.T) {
	env := newSitesEnv(t, "")
	// A candidate that fails validation → 400 before any network activity.
	rec := logDestReq(env, http.MethodPost, "/log-destinations/test", `log_destinations:
  - name: x
    type: loki
    url: ftp://nope
`)
	if rec.Code != http.StatusBadRequest {
		t.Fatalf("want 400, got %d (%s)", rec.Code, rec.Body.String())
	}

	// A valid file candidate delivers the synthetic entry → 200 {ok:true}.
	dir := t.TempDir()
	rec = logDestReq(env, http.MethodPost, "/log-destinations/test", `log_destinations:
  - name: t
    type: file
    path: `+filepath.Join(dir, "t.ndjson")+`
`)
	if rec.Code != http.StatusOK {
		t.Fatalf("want 200, got %d (%s)", rec.Code, rec.Body.String())
	}
	var out struct {
		OK bool `json:"ok"`
	}
	_ = json.Unmarshal(rec.Body.Bytes(), &out)
	if !out.OK {
		t.Errorf("want ok:true, got %s", rec.Body.String())
	}
	data, err := os.ReadFile(filepath.Join(dir, "t.ndjson"))
	if err != nil || !strings.Contains(string(data), "nginxpilot_test") {
		t.Errorf("synthetic entry not delivered: %v %s", err, data)
	}
	if _, err := os.Stat(filepath.Join(env.sitesDir, "logdest-t.yml")); !os.IsNotExist(err) {
		t.Error("test endpoint must not persist anything")
	}
}

func TestTestSavedLogDestUnknown(t *testing.T) {
	env := newSitesEnv(t, "")
	rec := logDestReq(env, http.MethodPost, "/log-destinations/nope/test", "")
	if rec.Code != http.StatusNotFound {
		t.Fatalf("want 404, got %d", rec.Code)
	}
}
