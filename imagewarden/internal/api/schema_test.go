package api

import (
	"bytes"
	"encoding/json"
	"net/http/httptest"
	"strings"
	"testing"
)

// TestSchemaCoversEveryEndpoint pins the "generated, not hand-kept" contract
// (spec §5): every routed endpoint must carry an operationDocs entry and
// every entry must match a real route — the schema can never drift silently.
func TestSchemaCoversEveryEndpoint(t *testing.T) {
	routed := map[string]bool{}
	for _, e := range endpoints() {
		key := e.method + " " + e.pattern
		routed[key] = true
		if _, ok := operationDocs[key]; !ok {
			t.Errorf("endpoint %q has no operationDocs entry", key)
		}
	}
	for key := range operationDocs {
		if !routed[key] {
			t.Errorf("operationDocs entry %q matches no routed endpoint (stale)", key)
		}
	}
}

// TestSchemaSixEndpointsPresent asserts the full imagewarden surface (spec §5)
// shows up in the generated document.
func TestSchemaSixEndpointsPresent(t *testing.T) {
	b, err := SchemaJSON()
	if err != nil {
		t.Fatalf("SchemaJSON: %v", err)
	}
	var doc struct {
		Paths map[string]any `json:"paths"`
	}
	if err := json.Unmarshal(b, &doc); err != nil {
		t.Fatalf("SchemaJSON did not unmarshal: %v", err)
	}

	want := []string{"/healthz", "/schema", "/version", "/status", "/v1/classify", "/metrics"}
	for _, path := range want {
		if _, ok := doc.Paths[path]; !ok {
			t.Errorf("schema missing path %q", path)
		}
	}
	if len(doc.Paths) != len(want) {
		t.Errorf("schema has %d paths, want %d", len(doc.Paths), len(want))
	}
}

// TestSchemaAuthFlags drives the security-block assertion straight from
// endpoints()' auth field, so it can't fall out of sync with the routing table.
func TestSchemaAuthFlags(t *testing.T) {
	b, err := SchemaJSON()
	if err != nil {
		t.Fatalf("SchemaJSON: %v", err)
	}
	var doc struct {
		Paths map[string]map[string]map[string]any `json:"paths"`
	}
	if err := json.Unmarshal(b, &doc); err != nil {
		t.Fatalf("SchemaJSON did not unmarshal: %v", err)
	}

	for _, e := range endpoints() {
		op, ok := doc.Paths[e.pattern][strings.ToLower(e.method)]
		if !ok {
			t.Fatalf("schema missing operation %s %s", e.method, e.pattern)
		}
		_, hasSecurity := op["security"]
		if hasSecurity != e.auth {
			t.Errorf("%s %s: security block present=%v, want %v", e.method, e.pattern, hasSecurity, e.auth)
		}
	}
}

// TestHandleSchemaMatchesSchemaJSON asserts the HTTP handler and the exported
// SchemaJSON() emit byte-identical output, so the CLI subcommand (task 027)
// and the live endpoint can never diverge.
func TestHandleSchemaMatchesSchemaJSON(t *testing.T) {
	want, err := SchemaJSON()
	if err != nil {
		t.Fatalf("SchemaJSON: %v", err)
	}

	s := &Server{}
	rr := httptest.NewRecorder()
	s.handleSchema(rr, httptest.NewRequest("GET", "/schema", nil))

	if rr.Code != 200 {
		t.Fatalf("handleSchema status = %d, want 200", rr.Code)
	}
	if ct := rr.Header().Get("Content-Type"); ct != "application/json" {
		t.Errorf("Content-Type = %q, want application/json", ct)
	}
	if !bytes.Equal(rr.Body.Bytes(), want) {
		t.Errorf("handleSchema body != SchemaJSON() bytes")
	}
}

func TestOperationID(t *testing.T) {
	cases := map[string]string{
		"getHealthz":     operationID("GET", "/healthz"),
		"getSchema":      operationID("GET", "/schema"),
		"getVersion":     operationID("GET", "/version"),
		"getStatus":      operationID("GET", "/status"),
		"postV1Classify": operationID("POST", "/v1/classify"),
		"getMetrics":     operationID("GET", "/metrics"),
	}
	for want, got := range cases {
		if got != want {
			t.Errorf("operationID = %q, want %q", got, want)
		}
	}
}
