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
		got := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
		// ConstantTimeCompare handles differing lengths; run it unconditionally —
		// no early return on empty/missing header — so timing can't leak whether a
		// token was sent.
		if subtle.ConstantTimeCompare([]byte(got), []byte(s.token)) != 1 {
			writeErr(w, http.StatusUnauthorized, codeUnauthorized, "missing or invalid bearer token")
			return
		}
		next(w, r)
	}
}
