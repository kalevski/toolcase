package credstore

import (
	"os"
	"strings"
	"testing"
)

func TestBuildConvenience(t *testing.T) {
	tests := []struct {
		provider string
		req      Request
		want     string
		wantErr  bool
	}{
		{"digitalocean", Request{Token: "abc"}, "dns_digitalocean_token = abc\n", false},
		{"cloudflare", Request{Token: "cf"}, "dns_cloudflare_api_token = cf\n", false},
		{"route53", Request{AccessKey: "K", SecretKey: "S"}, "aws_secret_access_key = S", false},
		{"google", Request{ServiceAccountJSON: `{"x":1}`}, `{"x":1}`, false},
		{"digitalocean", Request{}, "", true},                          // missing token
		{"route53", Request{AccessKey: "K"}, "", true},                 // missing secret
		{"unknownprov", Request{Token: "x"}, "", true},                 // no convenience form
		{"unknownprov", Request{Raw: "raw body"}, "raw body\n", false}, // raw passthrough
		{"BAD_NAME", Request{Raw: "x"}, "", true},                      // invalid provider
	}
	for _, tt := range tests {
		got, err := Build(tt.provider, tt.req)
		if tt.wantErr {
			if err == nil {
				t.Errorf("Build(%s, %+v): expected error", tt.provider, tt.req)
			}
			continue
		}
		if err != nil {
			t.Errorf("Build(%s): %v", tt.provider, err)
			continue
		}
		if !strings.Contains(string(got), tt.want) {
			t.Errorf("Build(%s) = %q, want contains %q", tt.provider, got, tt.want)
		}
	}
}

func TestStoreSetGetListDelete(t *testing.T) {
	dir := t.TempDir()
	s := New(dir)

	if s.Has("digitalocean") {
		t.Fatal("empty store should not have digitalocean")
	}
	if _, ok := s.Get("digitalocean"); ok {
		t.Fatal("Get on empty store should be ok=false")
	}

	if err := s.Set("digitalocean", []byte("dns_digitalocean_token = SECRET\n")); err != nil {
		t.Fatal(err)
	}
	if !s.Has("digitalocean") {
		t.Fatal("Has should be true after Set")
	}

	r, ok := s.Get("digitalocean")
	if !ok {
		t.Fatal("Get should succeed")
	}
	if r.Mechanism != MechanismFlag {
		t.Errorf("mechanism = %q, want flag", r.Mechanism)
	}
	fi, err := os.Stat(r.Path)
	if err != nil {
		t.Fatal(err)
	}
	if fi.Mode().Perm() != 0o600 {
		t.Errorf("perm = %o, want 600", fi.Mode().Perm())
	}

	list := s.List()
	if len(list) != 1 || list[0].Provider != "digitalocean" {
		t.Fatalf("List = %+v", list)
	}
	// metadata only — no secret material on the Info type (compile-time guarantee)
	if list[0].Mechanism != MechanismFlag {
		t.Errorf("list mechanism = %q", list[0].Mechanism)
	}

	if err := s.Delete("digitalocean"); err != nil {
		t.Fatal(err)
	}
	if s.Has("digitalocean") {
		t.Fatal("Has should be false after Delete")
	}
	if err := s.Delete("digitalocean"); !os.IsNotExist(err) {
		t.Errorf("Delete on absent = %v, want os.ErrNotExist", err)
	}
}

func TestMechanism(t *testing.T) {
	cases := map[string]string{
		"digitalocean": MechanismFlag,
		"cloudflare":   MechanismFlag,
		"route53":      MechanismAWS,
		"google":       MechanismGoogle,
	}
	for p, want := range cases {
		if got := Mechanism(p); got != want {
			t.Errorf("Mechanism(%s) = %q, want %q", p, got, want)
		}
	}
}
