package admin

import (
	"strings"
	"testing"
)

// TestSchemaCoversEveryEndpoint pins the "hand-kept but CI-linted" contract
// (better.md §5): every routed endpoint must carry an operationDocs entry and
// every entry must match a real route — the schema can never drift silently.
func TestSchemaCoversEveryEndpoint(t *testing.T) {
	routed := map[string]bool{}
	for _, e := range endpoints() {
		key := e.method + " " + e.pattern
		routed[key] = true
		if _, ok := operationDocs[key]; !ok {
			t.Errorf("endpoint %q has no operationDocs entry — document it in schema.go", key)
		}
	}
	for key := range operationDocs {
		if !routed[key] {
			t.Errorf("operationDocs entry %q matches no routed endpoint — stale doc", key)
		}
	}
}

// TestSchemaDocumentShape sanity-checks the assembled document: version, one
// path item per pattern, resolvable $refs.
func TestSchemaDocumentShape(t *testing.T) {
	doc := buildOpenAPI()
	if doc["openapi"] != "3.1.0" {
		t.Fatalf("openapi version = %v", doc["openapi"])
	}
	paths, ok := doc["paths"].(map[string]any)
	if !ok || len(paths) == 0 {
		t.Fatal("no paths in the document")
	}

	// Every $ref used anywhere must resolve to a components/schemas entry.
	schemas := doc["components"].(map[string]any)["schemas"].(map[string]any)
	var walk func(v any)
	walk = func(v any) {
		switch x := v.(type) {
		case map[string]any:
			if ref, ok := x["$ref"].(string); ok {
				name := strings.TrimPrefix(ref, "#/components/schemas/")
				if _, exists := schemas[name]; !exists {
					t.Errorf("$ref %q does not resolve", ref)
				}
			}
			for _, vv := range x {
				walk(vv)
			}
		case []any:
			for _, vv := range x {
				walk(vv)
			}
		}
	}
	walk(doc)

	// Spot-check the C1/C2 surface is present.
	if _, ok := paths["/access-lists"]; !ok {
		t.Error("schema missing /access-lists")
	}
	al := paths["/access-lists/{name}/users/{username}"].(map[string]any)
	if _, ok := al["put"]; !ok {
		t.Error("schema missing PUT /access-lists/{name}/users/{username}")
	}
	if _, ok := schemas["RealIPStatus"]; !ok {
		t.Error("schema missing RealIPStatus component")
	}
}

func TestOperationID(t *testing.T) {
	cases := map[string]string{
		"getAccessLists":                  operationID("GET", "/access-lists"),
		"putAccessListsNameUsersUsername": operationID("PUT", "/access-lists/{name}/users/{username}"),
		"postCertsDomainRenew":            operationID("POST", "/certs/{domain}/renew"),
	}
	for want, got := range cases {
		if got != want {
			t.Errorf("operationID = %q, want %q", got, want)
		}
	}
}
