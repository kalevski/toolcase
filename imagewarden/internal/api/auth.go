package api

import (
	"crypto/subtle"
	"net/http"
	"strings"
)

// auth enforces the optional bearer token (api.token_env). Empty token = loopback
// dev mode (config validation, task 003, guarantees this only on a loopback listen).
func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
	if s.token == "" {
		return next // tokenless passthrough
	}
	return func(w http.ResponseWriter, r *http.Request) {
		// The scheme prefix is required: a header carrying the bare token
		// without "Bearer " is malformed and must not authenticate, so a
		// missing prefix yields got = "" rather than the raw header value.
		// The scheme itself is case-insensitive (RFC 7235 §2.1) — "bearer x"
		// authenticates — but the token comparison stays exact.
		const scheme = "Bearer "
		var got string
		if h := r.Header.Get("Authorization"); len(h) >= len(scheme) && strings.EqualFold(h[:len(scheme)], scheme) {
			got = h[len(scheme):]
		}
		// ConstantTimeCompare handles differing lengths; run it unconditionally —
		// no early return on empty/missing/malformed header — so timing can't
		// leak whether a token was sent.
		if subtle.ConstantTimeCompare([]byte(got), []byte(s.token)) != 1 {
			writeErr(w, http.StatusUnauthorized, codeUnauthorized, "missing or invalid bearer token")
			return
		}
		next(w, r)
	}
}
