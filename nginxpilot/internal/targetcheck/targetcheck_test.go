package targetcheck

import (
	"context"
	"errors"
	"net"
	"net/netip"
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
		{"http://[2001:db8::1]:8080", "2001:db8::1", "8080"},
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
		"[2001:db8::1]:5432",
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
	pol := Policy{UnixDirs: []string{"/run/apps"}}
	if tgt, err := ParseAddrPolicy("unix:/run/apps/app.sock", pol); err != nil || !tgt.IsUnix || tgt.Unix != "/run/apps/app.sock" {
		t.Errorf("unix target not parsed: %+v %v", tgt, err)
	}
}

func TestPolicyDenials(t *testing.T) {
	pol := DefaultPolicy()
	pol.UnixDirs = []string{"/run/apps", "/run"}
	pol.AdminAddr = netip.MustParseAddrPort("0.0.0.0:9090")
	pass := []string{
		"http://wmk-ab12cd:8080",
		"http://web.internal:3000/api/",
		"https://10.0.0.5:8443",
		"http://[2001:db8::1]",
	}
	for _, in := range pass {
		if _, err := ParsePassPolicy(in, pol); err != nil {
			t.Errorf("ParsePassPolicy(%q): unexpected error %v", in, err)
		}
	}
	deny := []string{
		"http://127.0.0.1:9090",
		"http://127.1.2.3",
		"http://[::1]:80",
		"http://[::ffff:127.0.0.1]:80",
		"http://169.254.169.254/latest",
		"http://0.0.0.0:80",
		"http://localhost:8080",
		"http://foo.localhost",
		"http://2130706433",
		"http://0x7f.1",
		"http://10.0.0.5:9090",
		"http://unix:/run/apps/x.sock:/",
		"http://unix:/run/nginxpilot/admin.sock:/",
	}
	for _, in := range deny {
		if _, err := ParsePassPolicy(in, pol); err == nil {
			t.Errorf("ParsePassPolicy(%q): expected denial", in)
		}
	}
	denyAddr := []string{
		"127.0.0.1:5432",
		"unix:/run/nginxpilot/admin.sock",
		"unix:/run/apps/../nginxpilot/admin.sock",
		"unix:/var/run/docker.sock",
		"unix:/run/docker.sock",
		"unix:/etc/app.sock",
	}
	for _, in := range denyAddr {
		if _, err := ParseAddrPolicy(in, pol); err == nil {
			t.Errorf("ParseAddrPolicy(%q): expected denial", in)
		}
	}
	if _, err := ParseAddr("unix:/run/apps/app.sock"); err == nil {
		t.Errorf("default policy must refuse unix: targets")
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

// unsortedResolver answers with a deliberately unsorted address list, the way
// a round-robin DNS server rotates its answer between queries.
type unsortedResolver struct{ addrs []string }

func (u *unsortedResolver) LookupHost(context.Context, string) ([]string, error) {
	return u.addrs, nil
}

func TestResolveHostSorts(t *testing.T) {
	c := &Checker{Resolver: &unsortedResolver{addrs: []string{"10.0.0.3", "10.0.0.1", "10.0.0.2"}}, Timeout: time.Second}
	tgt, _ := ParsePass("http://backend:8080")

	got, err := c.ResolveHost(context.Background(), tgt)
	if err != nil {
		t.Fatalf("ResolveHost: %v", err)
	}
	want := []string{"10.0.0.1", "10.0.0.2", "10.0.0.3"}
	for i := range want {
		if got[i] != want[i] {
			t.Fatalf("ResolveHost() = %v, want %v (sorted, so a rotated answer compares equal)", got, want)
		}
	}
}

func TestResolveHostSkipsIPLiteralAndReportsFailure(t *testing.T) {
	res := &fakeResolver{}
	c := &Checker{Resolver: res, Timeout: time.Second}

	ipTgt, _ := ParsePass("http://10.1.2.3:80")
	addrs, err := c.ResolveHost(context.Background(), ipTgt)
	if err != nil || addrs != nil {
		t.Fatalf("IP literal must resolve to (nil, nil), got (%v, %v)", addrs, err)
	}
	if res.calls != 0 {
		t.Fatalf("IP literal must skip DNS, got %d calls", res.calls)
	}

	res.fail = true
	tgt, _ := ParsePass("http://dead.internal")
	if _, err := c.ResolveHost(context.Background(), tgt); err == nil || !strings.Contains(err.Error(), "does not resolve") {
		t.Fatalf("expected resolve error, got %v", err)
	}
}
