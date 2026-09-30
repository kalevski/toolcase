package admin

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func TestStatusReportsDiskAndFeatures(t *testing.T) {
	h := newTestServer(t, &config.Config{})
	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/status", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status: %d %s", rec.Code, rec.Body.String())
	}
	var out struct {
		Disk struct {
			Path           string `json:"path"`
			TotalBytes     uint64 `json:"total_bytes"`
			UsedBytes      uint64 `json:"used_bytes"`
			AvailableBytes uint64 `json:"available_bytes"`
			Error          string `json:"error"`
		} `json:"disk"`
		Features map[string]bool `json:"features"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &out); err != nil {
		t.Fatal(err)
	}
	if out.Disk.Error != "" || out.Disk.Path == "" || out.Disk.TotalBytes == 0 {
		t.Fatalf("disk not reported: %s", rec.Body.String())
	}
	for _, f := range []string{"source_ref", "disk", "error_codes"} {
		if !out.Features[f] {
			t.Fatalf("features.%s should be true: %s", f, rec.Body.String())
		}
	}
}

func TestDiskStatusReportsError(t *testing.T) {
	d := diskStatus("/definitely/not/here/nginxpilot")
	if d["error"] == nil || d["path"] != "/definitely/not/here/nginxpilot" {
		t.Fatalf("want path and error, got %v", d)
	}
}
