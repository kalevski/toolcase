package api

import (
	"encoding/json"
	"net/http"
)

// Machine-stable error codes (spec §5). Handlers and the auth middleware
// reference these constants rather than string literals so the vocabulary
// can't drift from the table below.
const (
	codeBadRequest        = "bad_request"        // 400 generic malformed request
	codeEmptyBody         = "empty_body"         // 400 zero-length image body (POST /v1/classify)
	codeUnauthorized      = "unauthorized"       // 401 missing/invalid bearer token
	codeTooLarge          = "too_large"          // 413 body exceeds limits.max_body_mb
	codeUnsupportedFormat = "unsupported_format" // 415 undecodable image type
	codeUnprocessable     = "unprocessable"      // 422 corrupt image / over limits.max_pixels
	codeBusy              = "busy"               // 429 inference semaphore full past limits.queue_timeout
	codeModelUnavailable  = "model_unavailable"  // 503 model not loaded/warmed
	codeInternal          = "internal"           // 500 unexpected server error
)

// errBody is the uniform JSON error envelope (spec §5): {"error","detail"}.
type errBody struct {
	Error  string `json:"error"`  // stable machine code, e.g. "too_large"
	Detail string `json:"detail"` // human-readable, safe to surface to caller
}

// writeErr writes the uniform JSON error envelope. This is the only place
// that formats error responses for JSON endpoints; handlers must call it
// instead of http.Error. /healthz may stay plain text.
//
// code -> HTTP status pairing (spec §5):
//
//	bad_request         400  generic malformed request
//	empty_body          400  zero-length image body (POST /v1/classify)
//	unauthorized        401  missing/invalid bearer token
//	too_large           413  body exceeds limits.max_body_mb (MaxBytesReader trip)
//	unsupported_format  415  imaging.ErrUnsupportedFormat — undecodable image type
//	unprocessable       422  imaging.ErrCorrupt / over limits.max_pixels (ErrTooLarge)
//	busy                429  inference semaphore full past limits.queue_timeout
//	model_unavailable   503  model not loaded/warmed
//	internal            500  unexpected server error
func writeErr(w http.ResponseWriter, status int, code, detail string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	// Non-indented is fine for errors; body is tiny. Ignore the encode error —
	// the header/status are already committed and there is nothing left to do.
	_ = json.NewEncoder(w).Encode(errBody{Error: code, Detail: detail})
}

// writeJSON writes a success body (/status, /schema, /version, /classify).
// The encode error is swallowed for the same reason as writeErr: the status
// line is already flushed and a partial body can't be recalled. Callers that
// want a log line on encode failure should add one at the call site.
func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	enc := json.NewEncoder(w)
	enc.SetIndent("", "  ") // human-readable success bodies
	_ = enc.Encode(v)
}
