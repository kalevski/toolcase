package nginxconf

import (
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func accessCfg() *config.Config {
	return &config.Config{
		DataDir: "/var/lib/nginxpilot",
		AccessLists: []config.AccessList{{
			Name:    "office",
			Satisfy: "any",
			Users: []config.AccessListUser{
				{Username: "alice", PasswordHash: "$apr1$abcdefgh$EfExgQSMBXioDhIVk8IOb1"},
				{Username: "pending"}, // no hash yet — must not break anything
			},
			Rules: []config.AccessRule{{Allow: "10.0.0.0/8"}, {Deny: "203.0.113.7"}},
		}},
	}
}

func TestProxyAccessListDirectives(t *testing.T) {
	cfg := accessCfg()
	p := &config.Proxy{Domain: "api.example.com", Pass: "http://127.0.0.1:9000", AccessList: "office"}
	out, err := ProxyVhost(cfg, p, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"satisfy any;",
		"allow 10.0.0.0/8;",
		"deny 203.0.113.7;",
		"deny all;",
		`auth_basic "Restricted";`,
		"auth_basic_user_file /var/lib/nginxpilot/access/office.htpasswd;",
		// pass_auth false + users → the edge consumes the Authorization header.
		`proxy_set_header Authorization "";`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("proxy vhost missing %q:\n%s", want, out)
		}
	}
	// Order: rules before deny all, deny all before auth_basic.
	if strings.Index(out, "allow 10.0.0.0/8;") > strings.Index(out, "deny all;") {
		t.Error("rules must render before the closing deny all")
	}
}

func TestProxyAccessListPassAuthKeepsHeader(t *testing.T) {
	cfg := accessCfg()
	cfg.AccessLists[0].PassAuth = true
	p := &config.Proxy{Domain: "api.example.com", Pass: "http://127.0.0.1:9000", AccessList: "office"}
	out, err := ProxyVhost(cfg, p, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, `proxy_set_header Authorization "";`) {
		t.Error("pass_auth: true must forward the Authorization header")
	}
}

func TestAccessListRulesOnlyNoAuthBasic(t *testing.T) {
	cfg := accessCfg()
	cfg.AccessLists[0].Users = nil
	p := &config.Proxy{Domain: "api.example.com", Pass: "http://127.0.0.1:9000", AccessList: "office"}
	out, err := ProxyVhost(cfg, p, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "auth_basic") {
		t.Error("a users-less list must not emit auth_basic (it would lock everyone out)")
	}
	if !strings.Contains(out, "deny all;") {
		t.Error("rules must still close with deny all")
	}
}

func TestAccessListPendingOnlyUsersNoAuthBasic(t *testing.T) {
	cfg := accessCfg()
	cfg.AccessLists[0].Users = []config.AccessListUser{{Username: "pending"}}
	p := &config.Proxy{Domain: "api.example.com", Pass: "http://127.0.0.1:9000", AccessList: "office"}
	out, err := ProxyVhost(cfg, p, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if strings.Contains(out, "auth_basic") {
		t.Error("users without hashes must not emit auth_basic against an empty htpasswd")
	}
}

func TestRedirectAndDeadHostAccessList(t *testing.T) {
	cfg := accessCfg()
	r := &config.Redirect{Domain: "old.example.com", To: "new.example.com", AccessList: "office"}
	out, err := RedirectVhost(cfg, r, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "satisfy any;") || !strings.Contains(out, "auth_basic_user_file") {
		t.Errorf("redirect vhost missing access-list directives:\n%s", out)
	}

	d := &config.DeadHost{Domain: "gone.example.com", AccessList: "office"}
	out, err = DeadHostVhost(cfg, d, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "deny all;") {
		t.Errorf("dead-host vhost missing access-list rules:\n%s", out)
	}
}

func TestHtpasswdContentSkipsPendingUsers(t *testing.T) {
	cfg := accessCfg()
	content := HtpasswdContent(&cfg.AccessLists[0])
	if !strings.Contains(content, "alice:$apr1$abcdefgh$EfExgQSMBXioDhIVk8IOb1\n") {
		t.Errorf("missing alice line:\n%s", content)
	}
	if strings.Contains(content, "pending") {
		t.Errorf("password-pending user must be skipped:\n%s", content)
	}
}

func TestNoAccessListNoDirectives(t *testing.T) {
	cfg := accessCfg()
	p := &config.Proxy{Domain: "api.example.com", Pass: "http://127.0.0.1:9000"}
	out, err := ProxyVhost(cfg, p, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	for _, banned := range []string{"satisfy", "auth_basic", "deny all;"} {
		if strings.Contains(out, banned) {
			t.Errorf("unreferenced access list leaked %q into the vhost:\n%s", banned, out)
		}
	}
}

func TestRealIPInclude(t *testing.T) {
	cfg := &config.Config{}
	cfg.Nginx.RealIP = config.RealIP{
		Enabled:     true,
		Header:      "CF-Connecting-IP",
		StaticCidrs: []string{"192.0.2.0/24"},
	}
	out := RealIPInclude(cfg, []string{"103.21.244.0/22", "2400:cb00::/32"})
	for _, want := range []string{
		"set_real_ip_from 192.0.2.0/24;",
		"set_real_ip_from 103.21.244.0/22;",
		"set_real_ip_from 2400:cb00::/32;",
		"real_ip_header CF-Connecting-IP;",
		"real_ip_recursive on;",
	} {
		if !strings.Contains(out, want) {
			t.Errorf("real-ip include missing %q:\n%s", want, out)
		}
	}

	cfg.Nginx.RealIP.Enabled = false
	if RealIPInclude(cfg, nil) != "" {
		t.Error("disabled real_ip must render nothing")
	}
}

func TestRealIPIncludeDefaults(t *testing.T) {
	cfg := &config.Config{}
	cfg.Nginx.RealIP = config.RealIP{Enabled: true}
	out := RealIPInclude(cfg, nil)
	if !strings.Contains(out, "real_ip_header X-Forwarded-For;") {
		t.Errorf("default header must be X-Forwarded-For:\n%s", out)
	}
	recursiveOff := false
	cfg.Nginx.RealIP.Recursive = &recursiveOff
	if !strings.Contains(RealIPInclude(cfg, nil), "real_ip_recursive off;") {
		t.Error("recursive: false must render off")
	}
}
