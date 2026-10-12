package nginxconf

import (
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func streamingProxy(websocket bool) *config.Config {
	off := false
	return &config.Config{
		Proxies: []config.Proxy{{
			Domain:           "php.example.com",
			Pass:             "http://wmk_app_1:8080",
			Resolve:          true,
			Websocket:        websocket,
			Buffering:        &off,
			RequestBuffering: &off,
			Keepalive:        8,
		}},
	}
}

func TestProxyBufferingToggles(t *testing.T) {
	out, err := VhostOpts(streamingProxy(false), "php.example.com", Options{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	for _, want := range []string{"proxy_buffering off;", "proxy_request_buffering off;"} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q\n%s", want, out)
		}
	}
}

func TestProxyKeepaliveWithUpstreamResolve(t *testing.T) {
	out, err := VhostOpts(streamingProxy(false), "php.example.com", Options{UpstreamResolve: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	name := keepaliveUpstreamName(&streamingProxy(false).Proxies[0], 0)
	for _, want := range []string{
		"upstream " + name + " {",
		"zone " + name + " 64k;",
		"server wmk_app_1:8080 resolve;",
		"keepalive 8;",
		"proxy_pass http://" + name + ";",
		`proxy_set_header Connection "";`,
	} {
		if !strings.Contains(out, want) {
			t.Errorf("missing %q\n%s", want, out)
		}
	}
	if strings.Contains(out, "$np_pass_") {
		t.Errorf("a pooled location must not use the variable proxy_pass\n%s", out)
	}
	if strings.Index(out, "upstream ") > strings.Index(out, "server {") {
		t.Errorf("the upstream block must precede the server block\n%s", out)
	}
}

func TestProxyKeepaliveFallsBackWithoutUpstreamResolve(t *testing.T) {
	out, err := VhostOpts(streamingProxy(false), "php.example.com", Options{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if strings.Contains(out, "upstream ") {
		t.Errorf("an nginx without upstream resolve must not get a pooled upstream\n%s", out)
	}
	if !strings.Contains(out, "proxy_pass $np_pass_0;") {
		t.Errorf("expected the per-request variable form\n%s", out)
	}
}

func TestProxyKeepaliveStaticTargetNeedsNoResolve(t *testing.T) {
	cfg := &config.Config{Proxies: []config.Proxy{{Domain: "a.example.com", Pass: "http://10.0.0.5:8080", Keepalive: 4}}}
	out, err := VhostOpts(cfg, "a.example.com", Options{})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "server 10.0.0.5:8080;") || strings.Contains(out, " resolve;") {
		t.Errorf("an IP target pools without resolve\n%s", out)
	}
}

func TestProxyKeepaliveWebsocketUsesMap(t *testing.T) {
	cfg := streamingProxy(true)
	out, err := VhostOpts(cfg, "php.example.com", Options{UpstreamResolve: true, Managed: true})
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if !strings.Contains(out, "proxy_set_header Connection $"+ConnectionUpgradeVar+";") {
		t.Errorf("pooled websocket location must use the Connection map\n%s", out)
	}
	if ConnectionUpgradeInclude(cfg, Options{UpstreamResolve: true}) == "" {
		t.Error("the managed map include must be written for a pooled websocket proxy")
	}
	if ConnectionUpgradeInclude(cfg, Options{}) != "" {
		t.Error("no map include when nothing is pooled")
	}
}

func TestProxyKeepaliveNamesStayDistinct(t *testing.T) {
	a := keepaliveUpstreamName(&config.Proxy{Domain: "a-b.example.com"}, 0)
	b := keepaliveUpstreamName(&config.Proxy{Domain: "a_b.example.com"}, 0)
	if a == b {
		t.Errorf("upstream names collide: %s", a)
	}
}
