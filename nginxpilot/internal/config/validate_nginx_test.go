package config

import (
	"strings"
	"testing"
)

func baseCfg() *Config {
	return &Config{LogLevel: "info", Defaults: Defaults{KeepReleases: 1}}
}

func mustFail(t *testing.T, cfg *Config, substr string) {
	t.Helper()
	err := Validate(cfg)
	if err == nil {
		t.Fatalf("expected error containing %q, got nil", substr)
	}
	if !strings.Contains(err.Error(), substr) {
		t.Fatalf("expected error containing %q, got %q", substr, err.Error())
	}
}

func TestValidateForceSSLRequiresTLS(t *testing.T) {
	cfg := baseCfg()
	cfg.Proxies = []Proxy{{Domain: "a.example.com", Pass: "http://127.0.0.1:1", WebOptions: WebOptions{ForceSSL: true}}}
	mustFail(t, cfg, "force_ssl requires tls")
}

func TestValidateHTTP2RequiresTLS(t *testing.T) {
	cfg := baseCfg()
	cfg.Proxies = []Proxy{{Domain: "a.example.com", Pass: "http://127.0.0.1:1", WebOptions: WebOptions{HTTP2: true}}}
	mustFail(t, cfg, "http2 requires tls")
}

func TestValidateTLSWantedButNoCertDir(t *testing.T) {
	cfg := baseCfg()
	cfg.Proxies = []Proxy{{Domain: "a.example.com", Pass: "http://127.0.0.1:1", WebOptions: WebOptions{TLS: TLSAuto}}}
	mustFail(t, cfg, "neither tls.cert_dir nor tls.cert_dir_env")
}

func TestValidateTLSWithCertDirOK(t *testing.T) {
	cfg := baseCfg()
	cfg.Tls = Tls{CertDir: "/etc/certs"}
	cfg.Proxies = []Proxy{{Domain: "a.example.com", Pass: "http://127.0.0.1:1", WebOptions: WebOptions{TLS: TLSAuto, ForceSSL: true, HTTP2: true, HSTS: HSTS{Enabled: true}}}}
	if err := Validate(cfg); err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
}

func TestValidateBadTLSMode(t *testing.T) {
	cfg := baseCfg()
	cfg.Tls = Tls{CertDir: "/etc/certs"}
	cfg.Proxies = []Proxy{{Domain: "a.example.com", Pass: "http://127.0.0.1:1", WebOptions: WebOptions{TLS: "maybe"}}}
	mustFail(t, cfg, "must be off | auto | required")
}

func TestValidateStreamDuplicateName(t *testing.T) {
	cfg := baseCfg()
	cfg.Streams = []Stream{
		{Name: "a", Listen: 5432, Pass: "1.2.3.4:5432"},
		{Name: "a", Listen: 5433, Pass: "1.2.3.4:5433"},
	}
	mustFail(t, cfg, "duplicate stream")
}

func TestValidateStreamPortCollision(t *testing.T) {
	cfg := baseCfg()
	cfg.Streams = []Stream{
		{Name: "a", Listen: 5432, Protocol: "tcp", Pass: "1.2.3.4:5432"},
		{Name: "b", Listen: 5432, Protocol: "tcp", Pass: "5.6.7.8:5432"},
	}
	mustFail(t, cfg, "collides")
}

func TestValidateStreamTCPandUDPSamePortOK(t *testing.T) {
	cfg := baseCfg()
	cfg.Streams = []Stream{
		{Name: "a", Listen: 5432, Protocol: "tcp", Pass: "1.2.3.4:5432"},
		{Name: "b", Listen: 5432, Protocol: "udp", Pass: "5.6.7.8:5432"},
	}
	if err := Validate(cfg); err != nil {
		t.Fatalf("tcp and udp on the same port should be allowed: %v", err)
	}
}

func TestValidateStreamUnknownUpstream(t *testing.T) {
	cfg := baseCfg()
	cfg.Streams = []Stream{{Name: "a", Listen: 5432, Upstream: "nope"}}
	mustFail(t, cfg, "unknown stream_upstream")
}

func TestValidateStreamMissingBackend(t *testing.T) {
	cfg := baseCfg()
	cfg.Streams = []Stream{{Name: "a", Listen: 5432}}
	mustFail(t, cfg, "upstream or pass is required")
}

func TestValidateStreamTLSNeedsDomain(t *testing.T) {
	cfg := baseCfg()
	cfg.Tls = Tls{CertDir: "/etc/certs"}
	cfg.Streams = []Stream{{Name: "a", Listen: 9443, Pass: "1.2.3.4:9443", TLS: TLSAuto}}
	mustFail(t, cfg, "requires tls_domain")
}

func TestValidateStreamUpstreamBadBalancer(t *testing.T) {
	cfg := baseCfg()
	cfg.StreamUpstreams = []StreamUpstream{{Name: "p", Balancer: "ip_hash", Servers: []StreamUpstreamServer{{Address: "1.2.3.4:5432"}}}}
	mustFail(t, cfg, "round_robin | least_conn | hash")
}

// http and stream upstream namespaces are separate — the same name in each does
// not collide.
func TestValidateUpstreamNamespacesSeparate(t *testing.T) {
	cfg := baseCfg()
	cfg.Upstreams = []Upstream{{Name: "x", Servers: []UpstreamServer{{Address: "1.2.3.4:80"}}}}
	cfg.StreamUpstreams = []StreamUpstream{{Name: "x", Servers: []StreamUpstreamServer{{Address: "1.2.3.4:5432"}}}}
	cfg.Streams = []Stream{{Name: "s", Listen: 5432, Upstream: "x"}}
	cfg.Proxies = []Proxy{{Domain: "a.example.com", Upstream: "x"}}
	if err := Validate(cfg); err != nil {
		t.Fatalf("same name in http and stream upstreams should be fine: %v", err)
	}
}

func TestValidateManagedRequiresStreamModuleDirs(t *testing.T) {
	// With manage:true but the dirs blanked (bypassing applyDefaults), validation
	// flags the missing required field.
	cfg := baseCfg()
	cfg.Nginx = Nginx{Manage: true, TestCmd: []string{"nginx", "-t"}, ReloadCmd: []string{"nginx", "-s", "reload"}, StreamConfDir: "/s", ManagedIncludeDir: "/i"}
	mustFail(t, cfg, "nginx.conf_dir is required")
}
