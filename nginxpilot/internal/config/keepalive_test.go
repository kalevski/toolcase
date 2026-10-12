package config

import (
	"strings"
	"testing"
)

func TestCheckKeepaliveRejectsPassPath(t *testing.T) {
	p := &Proxy{Domain: "a.example.com", Pass: "http://app:8080/sub", Keepalive: 4}
	err := checkKeepalive(p, ProxyLocation{Path: "/"})
	if err == nil || !strings.Contains(err.Error(), "keepalive_pass_path") {
		t.Fatalf("want keepalive_pass_path, got %v", err)
	}
	p.Pass = "http://app:8080"
	if err := checkKeepalive(p, ProxyLocation{Path: "/"}); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	p.Pass, p.Keepalive = "http://app:8080/sub", 0
	if err := checkKeepalive(p, ProxyLocation{Path: "/"}); err != nil {
		t.Fatalf("no keepalive, no check: %v", err)
	}
}
