package api

import (
	"encoding/json"
	"net/http"
	"strings"
)

// GET /schema serves a self-describing OpenAPI 3.1 document of the API
// surface (spec §5, nginxpilot idiom mirrored from
// nginxpilot/internal/admin/schema.go): buildOpenAPI ranges over endpoints()
// so the document can never silently drift from the mux, and
// TestSchemaCoversEveryEndpoint pins that contract. Unauthenticated like
// /healthz — it describes the API; it contains no data.

// operationDoc is the hand-kept documentation for one endpoint, keyed
// "METHOD /pattern" in operationDocs.
type operationDoc struct {
	summary string
	// requestRef / responseRef name a components/schemas entry ("" = none/plain).
	requestRef  string
	responseRef string
}

// operationDocs documents every endpoint. The schema test fails when an
// endpoints() entry is missing here or an entry here has no matching route.
var operationDocs = map[string]operationDoc{
	"GET /healthz":      {summary: "Liveness probe: 200 ok once the model is loaded and warmed, else 503 (plain text)."},
	"GET /schema":       {summary: "This self-describing API document (JSON)."},
	"GET /version":      {summary: "Build info: {\"name\",\"version\"}.", responseRef: "Version"},
	"GET /status":       {summary: "Model info, uptime, request/decision counters, latency p50/p95/p99.", responseRef: "Status"},
	"POST /v1/classify": {summary: "Classify one image. Body: raw image bytes (Content-Type image/* advisory) OR multipart/form-data field \"image\".", requestRef: "ClassifyRequest", responseRef: "ClassifyResult"},
	"GET /metrics":      {summary: "Prometheus text exposition (text/plain; version=0.0.4)."},
}

// SchemaJSON builds the document from the endpoint table + operationDocs and
// marshals it. Exported: reused by the `imagewarden schema` subcommand (task
// 027) and by handleSchema, so both emit identical bytes.
func SchemaJSON() ([]byte, error) {
	doc := buildOpenAPI()
	return json.MarshalIndent(doc, "", "  ")
}

func (s *Server) handleSchema(w http.ResponseWriter, _ *http.Request) {
	b, err := SchemaJSON()
	if err != nil {
		writeErr(w, http.StatusInternalServerError, codeInternal, "schema build failed")
		return
	}
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	_, _ = w.Write(b)
}

// buildOpenAPI assembles the document from the endpoint table + operationDocs.
func buildOpenAPI() map[string]any {
	paths := map[string]any{}
	for _, e := range endpoints() {
		doc := operationDocs[e.method+" "+e.pattern]
		op := map[string]any{
			"summary":     doc.summary,
			"operationId": operationID(e.method, e.pattern),
			"responses":   responsesFor(e, doc),
		}
		if params := paramsFor(e.pattern); len(params) > 0 {
			op["parameters"] = params
		}
		if e.method == "POST" {
			op["requestBody"] = requestBodyFor(e, doc)
		}
		if e.auth {
			op["security"] = []map[string]any{{"bearerAuth": []string{}}}
		}
		path, ok := paths[e.pattern].(map[string]any)
		if !ok {
			path = map[string]any{}
			paths[e.pattern] = path
		}
		path[strings.ToLower(e.method)] = op
	}
	return map[string]any{
		"openapi": "3.1.0",
		"info": map[string]any{
			"title":       "imagewarden API",
			"description": "NSFW image classification daemon: liveness, self-description, build/status info, single-image classification, and Prometheus metrics.",
			"version":     "1.0.0",
		},
		"paths": paths,
		"components": map[string]any{
			"securitySchemes": map[string]any{
				"bearerAuth": map[string]any{"type": "http", "scheme": "bearer"},
			},
			"schemas": componentSchemas(),
		},
	}
}

// operationID derives a stable id: "POST /v1/classify" → "postV1Classify".
func operationID(method, pattern string) string {
	var b strings.Builder
	b.WriteString(strings.ToLower(method))
	for _, part := range strings.Split(pattern, "/") {
		part = strings.Trim(part, "{}")
		part = strings.ReplaceAll(part, "-", " ")
		for _, word := range strings.Fields(part) {
			b.WriteString(strings.ToUpper(word[:1]) + word[1:])
		}
	}
	return b.String()
}

// paramsFor extracts {param} path parameters. imagewarden's surface is flat
// (no path parameters), so this always returns nil — kept for parity with
// nginxpilot's schema.go rather than dropped.
func paramsFor(pattern string) []map[string]any {
	var out []map[string]any
	for _, part := range strings.Split(pattern, "/") {
		if strings.HasPrefix(part, "{") && strings.HasSuffix(part, "}") {
			out = append(out, map[string]any{
				"name":     strings.Trim(part, "{}"),
				"in":       "path",
				"required": true,
				"schema":   map[string]any{"type": "string"},
			})
		}
	}
	return out
}

func requestBodyFor(e endpoint, doc operationDoc) map[string]any {
	if e.pattern == "/v1/classify" {
		return map[string]any{
			"required":    true,
			"description": "Raw image bytes, or multipart/form-data with a single file field named \"image\". Content-Type is advisory only — the decoder sniffs the real format. Capped at limits.max_body_mb.",
			"content": map[string]any{
				"image/*": map[string]any{
					"schema": map[string]any{"type": "string", "format": "binary"},
				},
				"multipart/form-data": map[string]any{
					"schema": map[string]any{"$ref": "#/components/schemas/" + doc.requestRef},
				},
			},
		}
	}
	schema := map[string]any{"type": "object"}
	if doc.requestRef != "" {
		schema = map[string]any{"$ref": "#/components/schemas/" + doc.requestRef}
	}
	return map[string]any{
		"required": true,
		"content":  map[string]any{"application/json": map[string]any{"schema": schema}},
	}
}

func responsesFor(e endpoint, doc operationDoc) map[string]any {
	ok := map[string]any{"description": "Success"}
	if doc.responseRef != "" {
		ok["content"] = map[string]any{
			"application/json": map[string]any{
				"schema": map[string]any{"$ref": "#/components/schemas/" + doc.responseRef},
			},
		}
	}
	out := map[string]any{"200": ok}
	if e.auth {
		out["401"] = errResponse("Missing/invalid bearer token", codeUnauthorized)
	}
	switch e.pattern {
	case "/healthz":
		out["503"] = errResponse("Model not loaded/warmed", codeModelUnavailable)
	case "/v1/classify":
		out["400"] = errResponse("Empty request body", codeEmptyBody)
		out["413"] = errResponse("Body exceeds limits.max_body_mb", codeTooLarge)
		out["415"] = errResponse("Undecodable image format", codeUnsupportedFormat)
		out["422"] = errResponse("Corrupt image, or over limits.max_pixels", codeUnprocessable)
		out["429"] = errResponse("Inference queue full past limits.queue_timeout", codeBusy)
		out["503"] = errResponse("Model not loaded/warmed", codeModelUnavailable)
	}
	return out
}

func errResponse(description, code string) map[string]any {
	return map[string]any{
		"description": description,
		"content": map[string]any{
			"application/json": map[string]any{
				"schema":  map[string]any{"$ref": "#/components/schemas/Error"},
				"example": map[string]any{"error": code, "detail": description},
			},
		},
	}
}

// componentSchemas holds the hand-kept entity schemas the operations
// reference. Shapes mirror the JSON bodies documented in spec §5.
func componentSchemas() map[string]any {
	str := func() map[string]any { return map[string]any{"type": "string"} }
	number := func() map[string]any { return map[string]any{"type": "number"} }
	integer := func() map[string]any { return map[string]any{"type": "integer"} }
	ref := func(name string) map[string]any { return map[string]any{"$ref": "#/components/schemas/" + name} }
	obj := func(props map[string]any, required ...string) map[string]any {
		out := map[string]any{"type": "object", "properties": props}
		if len(required) > 0 {
			out["required"] = required
		}
		return out
	}
	strEnum := func(values ...string) map[string]any {
		return map[string]any{"type": "string", "enum": values}
	}
	mapOf := func(values map[string]any) map[string]any {
		return map[string]any{"type": "object", "additionalProperties": values}
	}

	modelInfo := obj(map[string]any{
		"name":         str(),
		"version":      str(),
		"quantization": str(),
	}, "name", "version", "quantization")

	return map[string]any{
		"Error": obj(map[string]any{
			"error":  str(),
			"detail": str(),
		}, "error", "detail"),

		"Version": obj(map[string]any{
			"name":    str(),
			"version": str(),
		}, "name", "version"),

		"ModelInfo": modelInfo,

		"Status": obj(map[string]any{
			"model":          ref("ModelInfo"),
			"uptime_s":       number(),
			"requests_total": integer(),
			"decisions":      mapOf(integer()),
			"latency_ms": obj(map[string]any{
				"p50": number(),
				"p95": number(),
				"p99": number(),
			}),
		}, "model", "uptime_s", "requests_total", "decisions", "latency_ms"),

		"ClassifyRequest": obj(map[string]any{
			"image": map[string]any{
				"type":        "string",
				"format":      "binary",
				"description": "The multipart/form-data file field. Raw-bytes requests carry the image as the entire body instead.",
			},
		}),

		"ClassifyResult": obj(map[string]any{
			"decision":     strEnum("allow", "review", "block"),
			"unsafe_score": number(),
			"scores":       mapOf(number()),
			"model":        ref("ModelInfo"),
			"latency_ms":   integer(),
		}, "decision", "unsafe_score", "scores", "model", "latency_ms"),
	}
}
