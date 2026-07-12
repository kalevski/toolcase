package api

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"
)

func TestAuthMatrix(t *testing.T) {
	const tok = "s3cret-token"
	ok := func(w http.ResponseWriter, _ *http.Request) { w.WriteHeader(http.StatusOK) }
	s := &Server{token: tok}
	h := s.auth(ok)

	cases := []struct {
		name, header string
		want         int
	}{
		{"no header", "", http.StatusUnauthorized},
		{"wrong token", "Bearer nope", http.StatusUnauthorized},
		{"malformed (no Bearer prefix)", tok, http.StatusUnauthorized},
		{"correct token", "Bearer " + tok, http.StatusOK},
	}
	for _, c := range cases {
		t.Run(c.name, func(t *testing.T) {
			req := httptest.NewRequest("GET", "/status", nil)
			if c.header != "" {
				req.Header.Set("Authorization", c.header)
			}
			rr := httptest.NewRecorder()
			h(rr, req)
			if rr.Code != c.want {
				t.Fatalf("status = %d, want %d", rr.Code, c.want)
			}
			if c.want == http.StatusUnauthorized {
				var body errBody
				if err := json.Unmarshal(rr.Body.Bytes(), &body); err != nil {
					t.Fatalf("401 body not JSON: %v", err)
				}
				if body.Error != "unauthorized" {
					t.Fatalf("error code = %q, want %q", body.Error, "unauthorized")
				}
			}
		})
	}
}

func TestAuthTokenlessPassthrough(t *testing.T) {
	s := &Server{token: ""} // loopback dev
	called := false
	h := s.auth(func(w http.ResponseWriter, _ *http.Request) { called = true; w.WriteHeader(200) })
	rr := httptest.NewRecorder()
	h(rr, httptest.NewRequest("GET", "/status", nil)) // no Authorization header at all
	if !called || rr.Code != http.StatusOK {
		t.Fatalf("tokenless passthrough failed: called=%v code=%d", called, rr.Code)
	}
}
