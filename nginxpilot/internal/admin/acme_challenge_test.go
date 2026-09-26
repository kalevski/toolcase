package admin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func mixedAcmeConfig(t *testing.T) *config.Config {
	return &config.Config{Acme: config.Acme{
		Enabled: true, Email: "ops@example.org", AgreeTOS: true, ConfigDir: t.TempDir(),
		Challenge: config.ChallengeDNS, Challenges: []string{config.ChallengeDNS, config.ChallengeHTTP},
		DNS: config.AcmeDNS{Provider: "digitalocean"}, HTTP: config.AcmeHTTP{Webroot: "/var/www/acme"},
	}}
}

func postCerts(h http.Handler, body string) *httptest.ResponseRecorder {
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/certs", strings.NewReader(body)))
	return rec
}

// Refusals happen before any job is created or certbot runs.
func TestIssueCertChallengeRefusals(t *testing.T) {
	cfg := mixedAcmeConfig(t)
	cfg.Acme.Challenges = []string{config.ChallengeDNS, config.ChallengeHTTP}
	h := newTestServer(t, cfg)

	cases := []struct{ body, want string }{
		{`{"domains":["example.com"],"challenge":"standalone"}`, "not allowed here"},
		{`{"domains":["example.com"],"challenge":"carrier-pigeon"}`, "not allowed here"},
		{`{"domains":["*.example.com"],"challenge":"http"}`, "requires challenge dns"},
		{`{"domains":["example.com"],"challenge":"http","provider":"zonewright"}`, "apply only to challenge dns"},
		{`{"domains":["example.com"],"challenge":"http","account":"webapp-mk"}`, "apply only to challenge dns"},
		{`{"domains":["example.com"],"cert_name":"--dry-run"}`, "invalid cert_name"},
		{`{"domains":["example.com"],"cert_name":"../../etc"}`, "invalid cert_name"},
		{`{"domains":["example.com"],"cert_name":"a/b"}`, "invalid cert_name"},
		{`{"domains":["example.com"],"cert_name":"a..b"}`, "invalid cert_name"},
		{`{"domains":["example.com"],"cert_name":".hidden"}`, "invalid cert_name"},
		{`{"domains":["example.com"],"cert_name":"*.example.com"}`, "invalid cert_name"},
		{`{"domains":["example.com"],"cert_name":"has space"}`, "invalid cert_name"},
		{`{"domains":["example.com"],"cert_name":"a_b"}`, "invalid cert_name"},
	}
	for _, c := range cases {
		rec := postCerts(h, c.body)
		if rec.Code != http.StatusBadRequest || !strings.Contains(rec.Body.String(), c.want) {
			t.Errorf("%s: %d %q, want 400 mentioning %q", c.body, rec.Code, rec.Body.String(), c.want)
		}
	}

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/certs/jobs", nil))
	if strings.Contains(rec.Body.String(), `"id"`) {
		t.Fatalf("a refused request created a job: %s", rec.Body.String())
	}
}

func TestStatusReportsAcmeCapabilities(t *testing.T) {
	h := newTestServer(t, mixedAcmeConfig(t))
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/status", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Acme struct {
			Enabled      bool      `json:"enabled"`
			Challenge    string    `json:"challenge"`
			Challenges   []string  `json:"challenges"`
			DNSProvider  string    `json:"dns_provider"`
			DNSProviders *[]string `json:"dns_providers"`
			RenewBefore  string    `json:"renew_before"`
		} `json:"acme"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	a := out.Acme
	if !a.Enabled || a.Challenge != "dns" || strings.Join(a.Challenges, ",") != "dns,http" || a.DNSProvider != "digitalocean" || a.RenewBefore == "" {
		t.Fatalf("acme status: %+v", a)
	}
	// The plugin probe only runs on a running daemon, so here it is unknown (null).
	if a.DNSProviders != nil {
		t.Fatalf("dns_providers should be null before the probe: %v", *a.DNSProviders)
	}

	off := newTestServer(t, &config.Config{})
	rec = httptest.NewRecorder()
	off.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/status", nil))
	if !strings.Contains(rec.Body.String(), `"acme": {`) || !strings.Contains(rec.Body.String(), `"enabled": false`) {
		t.Fatalf("disabled acme should still be reported: %s", rec.Body.String())
	}
}

// A valid cert_name is accepted and normalized to what the {domain} routes use,
// so the lineage stays addressable: case folds, a single label is fine.
func TestNormalizeCertName(t *testing.T) {
	ok := map[string]string{
		"wmk-3f9a12c0d1e2-g1": "wmk-3f9a12c0d1e2-g1",
		"Example.COM":         "example.com",
		"shop.example.com":    "shop.example.com",
		"bücher.example":      "xn--bcher-kva.example",
	}
	for in, want := range ok {
		got, err := normalizeCertName(in)
		if err != nil || got != want {
			t.Errorf("normalizeCertName(%q) = %q, %v; want %q", in, got, err, want)
		}
	}
	for _, bad := range []string{"-x", "x.", "x/y", "x\\y", "x y", "", strings.Repeat("a", 254)} {
		if got, err := normalizeCertName(bad); err == nil {
			t.Errorf("normalizeCertName(%q) = %q, want an error", bad, got)
		}
	}
}

// dry_run is accepted, echoed on the 202 and recorded on the job, so a caller
// polling GET /certs/jobs/{id} knows a success saved nothing.
func TestIssueCertDryRunAccepted(t *testing.T) {
	h := newTestServer(t, mixedAcmeConfig(t))
	rec := postCerts(h, `{"domains":["t.example.com"],"challenge":"http","dry_run":true,"staging":true}`)
	if rec.Code != http.StatusAccepted {
		t.Fatalf("dry run: %d %s", rec.Code, rec.Body.String())
	}
	var accepted struct {
		JobID  string `json:"job_id"`
		DryRun bool   `json:"dry_run"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &accepted); err != nil || !accepted.DryRun || accepted.JobID == "" {
		t.Fatalf("202 body: %v %s", err, rec.Body.String())
	}
	job := httptest.NewRecorder()
	h.ServeHTTP(job, httptest.NewRequest(http.MethodGet, "/certs/jobs/"+accepted.JobID, nil))
	var out struct {
		DryRun bool            `json:"dry_run"`
		Cert   json.RawMessage `json:"cert"`
	}
	if err := json.Unmarshal(job.Body.Bytes(), &out); err != nil || !out.DryRun {
		t.Fatalf("job: %v %s", err, job.Body.String())
	}
	if len(out.Cert) != 0 {
		t.Errorf("a dry run job must never carry a cert: %s", job.Body.String())
	}
}

// POST /certs/{domain}/revoke refuses before certbot runs: a bad reason is 400,
// an unknown cert 404, a flat upload 409, and ACME off 501.
func TestRevokeCertRefusals(t *testing.T) {
	cfg := mixedAcmeConfig(t)
	certDir := t.TempDir()
	cfg.Tls = config.Tls{CertDir: certDir}
	writeFlatCert(t, certDir, "flat.example", []string{"flat.example"}, time.Now().Add(time.Hour))
	h := newTestServer(t, cfg)

	post := func(path, body string) *httptest.ResponseRecorder {
		rec := httptest.NewRecorder()
		h.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, path, strings.NewReader(body)))
		return rec
	}
	if rec := post("/certs/flat.example/revoke", `{"reason":"because"}`); rec.Code != http.StatusBadRequest {
		t.Errorf("bad reason: want 400, got %d %s", rec.Code, rec.Body.String())
	}
	if rec := post("/certs/missing.example/revoke", ""); rec.Code != http.StatusNotFound {
		t.Errorf("unknown cert: want 404, got %d %s", rec.Code, rec.Body.String())
	}
	if rec := post("/certs/flat.example/revoke", `{"reason":"superseded"}`); rec.Code != http.StatusConflict {
		t.Errorf("flat cert: want 409, got %d %s", rec.Code, rec.Body.String())
	}

	off := newTestServer(t, &config.Config{})
	rec := httptest.NewRecorder()
	off.ServeHTTP(rec, httptest.NewRequest(http.MethodPost, "/certs/flat.example/revoke", nil))
	if rec.Code != http.StatusNotImplemented {
		t.Errorf("acme off: want 501, got %d", rec.Code)
	}
}
