package httpx

import (
	"net/http"
	"net/http/httptest"
	"net/netip"
	"testing"
)

func TestClientIP(t *testing.T) {
	trusted := []netip.Prefix{netip.MustParsePrefix("10.0.0.0/8")}
	mk := func(remote string, xff ...string) *http.Request {
		r := httptest.NewRequest("GET", "/", nil)
		r.RemoteAddr = remote
		for _, x := range xff {
			r.Header.Add("X-Forwarded-For", x)
		}
		return r
	}
	cases := []struct {
		name string
		r    *http.Request
		want string
	}{
		{"direct", mk("203.0.113.9:1000"), "203.0.113.9"},
		{"untrusted peer spoofing xff", mk("203.0.113.9:1000", "1.2.3.4"), "203.0.113.9"},
		{"trusted proxy", mk("10.0.0.5:1000", "198.51.100.7"), "198.51.100.7"},
		{"chain, rightmost untrusted wins", mk("10.0.0.5:1", "6.6.6.6, 198.51.100.7, 10.0.0.9"), "198.51.100.7"},
		{"garbage", mk("10.0.0.5:1", "not-an-ip"), "10.0.0.5"},
		{"no xff", mk("10.0.0.5:1"), "10.0.0.5"},
	}
	for _, c := range cases {
		if got := ClientIP(c.r, trusted); got != c.want {
			t.Errorf("%s: %s != %s", c.name, got, c.want)
		}
	}
	if got := ClientIP(mk("10.0.0.5:1", "1.1.1.1"), nil); got != "10.0.0.5" {
		t.Errorf("no trusted configured: %s", got)
	}
}

func TestRequestHostTrustsForwardedHostOnlyFromAProxy(t *testing.T) {
	proxy := []netip.Prefix{netip.MustParsePrefix("10.0.0.0/8")}
	r := httptest.NewRequest("GET", "/", nil)
	r.Host = "webmail.internal:8080"
	r.Header.Set("X-Forwarded-Host", "Mail.Acme.com, other.test")
	r.RemoteAddr = "10.1.2.3:5555"
	if got := RequestHost(r, proxy); got != "mail.acme.com" {
		t.Fatalf("from the proxy: %q", got)
	}
	r.RemoteAddr = "203.0.113.9:5555"
	if got := RequestHost(r, proxy); got != "webmail.internal" {
		t.Fatalf("a direct client cannot pick the host: %q", got)
	}
	if got := RequestHost(r, nil); got != "webmail.internal" {
		t.Fatalf("no trusted proxies: %q", got)
	}
}
