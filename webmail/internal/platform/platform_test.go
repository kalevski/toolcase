package platform

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/kalevski/toolcase/webmail/internal/jmap"
)

func TestChangePassword(t *testing.T) {
	var got map[string]string
	var auth string
	srv := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		auth = r.Header.Get("Authorization")
		if r.URL.Path != PasswordPath || r.Method != http.MethodPost {
			w.WriteHeader(404)
			return
		}
		json.NewDecoder(r.Body).Decode(&got)
		w.Header().Set("Content-Type", "application/json")
		switch got["next"] {
		case "ok-password":
			w.WriteHeader(204)
		case "short":
			w.WriteHeader(422)
			w.Write([]byte(`{"error":"password_policy","message":"Too short."}`))
		case "ignored":
			w.WriteHeader(502)
			w.Write([]byte(`{"error":"password_not_applied"}`))
		case "bad-token":
			w.WriteHeader(401)
			w.Write([]byte(`{"error":"unauthorized"}`))
		default:
			w.WriteHeader(403)
			w.Write([]byte(`{"error":"invalid_credentials"}`))
		}
	}))
	defer srv.Close()
	c := New(srv.URL+"/", "token-123", time.Second)
	ctx := context.Background()

	if err := c.ChangePassword(ctx, "a@x.test", "old", "ok-password", ""); err != nil {
		t.Fatal(err)
	}
	if auth != "Bearer token-123" || got["address"] != "a@x.test" || got["current"] != "old" || got["next"] != "ok-password" {
		t.Fatalf("request: %q %v", auth, got)
	}
	if err := c.ChangePassword(ctx, "a@x.test", "wrong", "anything", ""); !errors.Is(err, jmap.ErrUnauthorized) {
		t.Fatalf("wrong current: %v", err)
	}
	var pe *jmap.PolicyError
	if err := c.ChangePassword(ctx, "a@x.test", "old", "short", ""); !errors.As(err, &pe) || pe.Message != "Too short." {
		t.Fatalf("policy: %v", err)
	}
	if err := c.ChangePassword(ctx, "a@x.test", "old", "ignored", ""); !errors.Is(err, jmap.ErrNotApplied) {
		t.Fatalf("not applied: %v", err)
	}
	if err := c.ChangePassword(ctx, "a@x.test", "old", "bad-token", ""); !errors.Is(err, jmap.ErrUnavailable) || errors.Is(err, jmap.ErrUnauthorized) {
		t.Fatalf("token refused must not look like a wrong password: %v", err)
	}
}
