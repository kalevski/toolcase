package httpx

import (
	"encoding/json"
	"errors"
	"io"
	"net/http"
)

// APIError is the body of every error response:
// {"error":{"code":"...","message":"..."}} (plus optional extras).
type APIError struct {
	Code       string `json:"code"`
	Message    string `json:"message"`
	RetryAfter int    `json:"retryAfter,omitempty"` // seconds
}

// Error writes a JSON error and records its code for the access log.
func Error(w http.ResponseWriter, r *http.Request, status int, code, message string) {
	ErrorWith(w, r, status, APIError{Code: code, Message: message})
}

// ErrorWith writes a JSON error with extras.
func ErrorWith(w http.ResponseWriter, r *http.Request, status int, e APIError) {
	From(r.Context()).ErrCode = e.Code
	JSON(w, status, map[string]any{"error": e})
}

// JSON writes v with the given status. Responses are never cacheable.
func JSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	if w.Header().Get("Cache-Control") == "" {
		w.Header().Set("Cache-Control", "no-store")
	}
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(v)
}

// ErrBodyTooLarge is returned by ReadJSON for an oversized body.
var ErrBodyTooLarge = errors.New("httpx: request body too large")

// ReadJSON decodes one JSON value of at most max bytes into v. Unknown fields
// are ignored; trailing garbage is an error.
func ReadJSON(w http.ResponseWriter, r *http.Request, max int64, v any) error {
	r.Body = http.MaxBytesReader(w, r.Body, max)
	dec := json.NewDecoder(r.Body)
	if err := dec.Decode(v); err != nil {
		var mbe *http.MaxBytesError
		if errors.As(err, &mbe) {
			return ErrBodyTooLarge
		}
		return err
	}
	if _, err := dec.Token(); !errors.Is(err, io.EOF) {
		return errors.New("trailing data after JSON value")
	}
	return nil
}

// BadJSON answers a failed ReadJSON.
func BadJSON(w http.ResponseWriter, r *http.Request, err error) {
	if errors.Is(err, ErrBodyTooLarge) {
		Error(w, r, http.StatusRequestEntityTooLarge, "too_large", "The request is too large.")
		return
	}
	Error(w, r, http.StatusBadRequest, "bad_request", "The request is not valid JSON.")
}
