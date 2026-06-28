package nginxconf

import (
	"errors"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func TestStreamUpstreamBlock(t *testing.T) {
	u := &config.StreamUpstream{
		Name:     "db_pool",
		Balancer: config.StreamBalancerLeastConn,
		Servers: []config.StreamUpstreamServer{
			{Address: "10.0.0.1:5432"},
			{Address: "10.0.0.2:5432", Backup: true},
		},
	}
	out := StreamUpstreamBlock(u)
	for _, want := range []string{"upstream db_pool {", "least_conn;", "server 10.0.0.1:5432;", "server 10.0.0.2:5432 backup;"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q\n%s", want, out)
		}
	}
}

func TestStreamUpstreamHash(t *testing.T) {
	u := &config.StreamUpstream{Name: "h", Balancer: config.StreamBalancerHash, Servers: []config.StreamUpstreamServer{{Address: "1.2.3.4:80"}}}
	if !strings.Contains(StreamUpstreamBlock(u), "hash $remote_addr;") {
		t.Error("hash balancer should emit hash $remote_addr")
	}
}

func TestStreamBlockTCPUpstream(t *testing.T) {
	s := &config.Stream{Name: "postgres", Listen: 5432, Protocol: "tcp", Upstream: "db_pool", Timeout: config.Duration(600e9)}
	out, err := StreamBlock(s, Options{})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{"listen 5432;", "proxy_pass db_pool;", "proxy_timeout 10m0s;"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q\n%s", want, out)
		}
	}
	if strings.Contains(out, "udp") || strings.Contains(out, "ssl") {
		t.Errorf("tcp non-tls stream should have neither udp nor ssl\n%s", out)
	}
}

func TestStreamBlockUDPInlinePass(t *testing.T) {
	s := &config.Stream{Name: "dns", Listen: 53, Protocol: "udp", Pass: "10.0.0.9:53"}
	out, _ := StreamBlock(s, Options{})
	if !strings.Contains(out, "listen 53 udp;") || !strings.Contains(out, "proxy_pass 10.0.0.9:53;") {
		t.Errorf("udp inline pass render wrong\n%s", out)
	}
}

func TestStreamBlockTLS(t *testing.T) {
	s := &config.Stream{Name: "secure", Listen: 9443, Protocol: "tcp", Upstream: "p", TLS: config.TLSAuto, TLSDomain: "svc.example.com"}
	opts := Options{Managed: true, Certs: fakeCerts{"svc.example.com": {"/c/f.pem", "/c/k.pem"}}}
	out, err := StreamBlock(s, opts)
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "listen 9443 ssl;") || !strings.Contains(out, "ssl_certificate     /c/f.pem;") {
		t.Errorf("tls stream render wrong\n%s", out)
	}
}

func TestStreamBlockTLSRequiredNoCert(t *testing.T) {
	s := &config.Stream{Name: "secure", Listen: 9443, Upstream: "p", TLS: config.TLSRequired, TLSDomain: "svc.example.com"}
	_, err := StreamBlock(s, Options{Managed: true})
	if !errors.Is(err, ErrCertRequired) {
		t.Fatalf("want ErrCertRequired, got %v", err)
	}
}

func TestStreamBlockProxyProtocol(t *testing.T) {
	s := &config.Stream{Name: "pp", Listen: 7000, Upstream: "p", ProxyProtocol: true}
	out, _ := StreamBlock(s, Options{})
	if !strings.Contains(out, "listen 7000 proxy_protocol;") {
		t.Errorf("proxy_protocol listen param missing\n%s", out)
	}
}
