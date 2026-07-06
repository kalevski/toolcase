package targetcheck

import (
	"context"
	"errors"
	"net"
	"strings"
	"testing"
	"time"
)

func TestParsePassValid(t *testing.T) {
	cases := []struct {
		in         string
		host, port string
	}{
		{"http://backend", "backend", ""},
		{"http://backend:8080", "backend", "8080"},
		{"https://api.example.com", "api.example.com", ""},
		{"http://10.0.0.1:9000", "10.0.0.1", "9000"},
		{"http://[::1]:8080", "::1", "8080"},
		{"http://backend:8080/api", "backend", "8080"},
		{"http://backend/api/", "backend", ""},
		{"http://my_service:3000", "my_service", "3000"},
	}
	for _, c := range cases {
		got, err := ParsePass(c.in)
		if err != nil {
			t.Errorf("ParsePass(%q): unexpected error %v", c.in, err)
			continue
		}
		if got.Host != c.host || got.Port != c.port {
			t.Errorf("ParsePass(%q) = host %q port %q, want %q %q", c.in, got.Host, got.Port, c.host, c.port)
		}
	}
}

func TestParsePassRejections(t *testing.T) {
	cases := []string{
		"",
		"backend:8080",                  // no scheme
		"ftp://backend",                 // wrong scheme
		"http://user:pw@backend",        // userinfo (charset)
		"http://backend?x=1",            // query (charset)
		"http://backend#frag",           // fragment (charset)
		"http://backend:99999",          // bad port
		"http://backend:0",              // bad port
		"http://",                       // empty host
		"http://x;drop",                 // ';' metachar
		"http://x martin",               // whitespace
		"http://x\nserver{",             // newline + brace
		"http://x/$var",                 // '$'
		"http://x/\"quote",              // '"'
		"http://x/../etc",               // dirty path
		"http://x/a//b",                 // dirty path
		"http://x/;}\nserver {",         // the injection regression from the plan
		"http://bad_label-.example.com", // label ends with '-'
		"http://[::1:8080",              // unclosed bracket
		"http://::1:8080",               // bare IPv6
	}
	for _, in := range cases {
		if _, err := ParsePass(in); err == nil {
			t.Errorf("ParsePass(%q): expected error, got none", in)
		}
	}
}

func TestParseAddr(t *testing.T) {
	valid := []string{
		"10.0.0.1:8080",
		"backend:9000",
		"backend",
		"[::1]:5432",
		"unix:/run/app.sock",
	}
	for _, in := range valid {
		if _, err := ParseAddr(in); err != nil {
			t.Errorf("ParseAddr(%q): unexpected error %v", in, err)
		}
	}
	invalid := []string{
		"",
		"host:port",          // non-numeric port
		"host:99999",         // out of range
		"unix:relative.sock", // not absolute
		"unix:/a/../b.sock",  // dot-dot
		"host/with/path",     // path on a plain address
		"a b:80",             // whitespace
		"x;y:80",             // metachar
		"::1:5432",           // bare IPv6
	}
	for _, in := range invalid {
		if _, err := ParseAddr(in); err == nil {
			t.Errorf("ParseAddr(%q): expected error, got none", in)
		}
	}
	if tgt, _ := ParseAddr("unix:/run/app.sock"); !tgt.IsUnix || tgt.Unix != "/run/app.sock" {
		t.Errorf("unix target not parsed: %+v", tgt)
	}
}

type fakeResolver struct {
	fail    bool
	calls   int
	lastCtx context.Context
}

func (f *fakeResolver) LookupHost(ctx context.Context, host string) ([]string, error) {
	f.calls++
	f.lastCtx = ctx
	if f.fail {
		return nil, errors.New("NXDOMAIN")
	}
	return []string{"10.0.0.1"}, nil
}

type fakeDialer struct{ fail bool }

func (f *fakeDialer) DialContext(_ context.Context, _, _ string) (net.Conn, error) {
	if f.fail {
		return nil, errors.New("connection refused")
	}
	c, s := net.Pipe()
	go func() { _ = s.Close() }()
	return c, nil
}

func TestCheckDNS(t *testing.T) {
	res := &fakeResolver{fail: true}
	c := &Checker{Resolver: res, Timeout: time.Second}

	tgt, _ := ParsePass("http://dead.internal")
	err := c.CheckDNS(context.Background(), tgt)
	if err == nil || !strings.Contains(err.Error(), "does not resolve") {
		t.Fatalf("expected resolve error, got %v", err)
	}

	// IP literal → resolver never called.
	res.calls = 0
	ipTgt, _ := ParsePass("http://10.1.2.3:80")
	if err := c.CheckDNS(context.Background(), ipTgt); err != nil {
		t.Fatalf("IP literal must skip DNS, got %v", err)
	}
	if res.calls != 0 {
		t.Fatalf("resolver called %d times for an IP literal", res.calls)
	}

	// unix socket → skipped too.
	unixTgt, _ := ParseAddr("unix:/run/x.sock")
	if err := c.CheckDNS(context.Background(), unixTgt); err != nil {
		t.Fatalf("unix target must skip DNS, got %v", err)
	}

	res.fail = false
	if err := c.CheckDNS(context.Background(), tgt); err != nil {
		t.Fatalf("resolvable host errored: %v", err)
	}
}

func TestCheckReachable(t *testing.T) {
	c := &Checker{Dialer: &fakeDialer{fail: true}, Timeout: time.Second}
	tgt, _ := ParsePass("http://backend:8080")
	if err := c.CheckReachable(context.Background(), tgt); err == nil {
		t.Fatal("expected unreachable error")
	}
	c.Dialer = &fakeDialer{}
	if err := c.CheckReachable(context.Background(), tgt); err != nil {
		t.Fatalf("reachable target errored: %v", err)
	}
}

func TestTargetAddrDefaults(t *testing.T) {
	httpT, _ := ParsePass("http://h")
	if httpT.Addr() != "h:80" {
		t.Errorf("http default port: got %q", httpT.Addr())
	}
	httpsT, _ := ParsePass("https://h")
	if httpsT.Addr() != "h:443" {
		t.Errorf("https default port: got %q", httpsT.Addr())
	}
	addrT, _ := ParseAddr("h")
	if addrT.Addr() != "h:80" {
		t.Errorf("plain addr default port: got %q", addrT.Addr())
	}
}
