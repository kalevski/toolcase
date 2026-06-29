package config

import "testing"

func TestParseProxyToggles(t *testing.T) {
	yaml := []byte(`
proxies:
  - domain: app.example.com
    pass: http://127.0.0.1:3000
    tls: auto
    force_ssl: true
    http2: true
    block_exploits: true
    websocket: true
    gzip: true
    cache:
      enabled: true
      valid: ["200 10m", "404 1m"]
      zone_size: 10m
    advanced: |
      add_header X-Frame-Options SAMEORIGIN;
`)
	frag, err := ParseFragment(yaml, "test")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	p := frag.Proxies[0]
	if p.TLS != "auto" || !p.ForceSSL || !p.HTTP2 || !p.BlockExploits || !p.Websocket || !p.Gzip {
		t.Errorf("toggles not parsed: %+v", p.WebOptions)
	}
	if !p.Cache.Enabled || len(p.Cache.Valid) != 2 || p.Cache.ZoneSize != "10m" {
		t.Errorf("cache not parsed: %+v", p.Cache)
	}
	if p.Advanced == "" {
		t.Error("advanced not parsed")
	}
}

func TestParseHSTSBool(t *testing.T) {
	frag, err := ParseFragment([]byte("proxies:\n  - domain: a.example.com\n    pass: http://1.2.3.4:1\n    tls: auto\n    hsts: true\n"), "test")
	if err != nil {
		t.Fatal(err)
	}
	h := frag.Proxies[0].HSTS
	if !h.Enabled {
		t.Error("hsts: true should enable")
	}
	if h.MaxAgeOrDefault() != DefaultHSTSMaxAge {
		t.Errorf("default max-age expected, got %d", h.MaxAgeOrDefault())
	}
	if !h.IncludesSubdomains() {
		t.Error("include_subdomains should default true")
	}
}

func TestParseHSTSStruct(t *testing.T) {
	yaml := []byte("proxies:\n  - domain: a.example.com\n    pass: http://1.2.3.4:1\n    tls: auto\n    hsts:\n      max_age: 100\n      include_subdomains: false\n      preload: true\n")
	frag, err := ParseFragment(yaml, "test")
	if err != nil {
		t.Fatal(err)
	}
	h := frag.Proxies[0].HSTS
	if !h.Enabled {
		t.Error("hsts mapping should imply enabled")
	}
	if h.MaxAge != 100 {
		t.Errorf("max_age = %d, want 100", h.MaxAge)
	}
	if h.IncludesSubdomains() {
		t.Error("include_subdomains:false should disable subdomains")
	}
	if !h.Preload {
		t.Error("preload should be true")
	}
}

func TestParseStreams(t *testing.T) {
	yaml := []byte(`
stream_upstreams:
  - name: db_pool
    balancer: least_conn
    servers:
      - address: 10.0.0.1:5432
streams:
  - name: postgres
    listen: 5432
    protocol: tcp
    upstream: db_pool
    timeout: 10m
`)
	frag, err := ParseFragment(yaml, "test")
	if err != nil {
		t.Fatalf("parse: %v", err)
	}
	if len(frag.StreamUpstreams) != 1 || frag.StreamUpstreams[0].Name != "db_pool" {
		t.Errorf("stream upstream not parsed: %+v", frag.StreamUpstreams)
	}
	if len(frag.Streams) != 1 || frag.Streams[0].Listen != 5432 {
		t.Errorf("stream not parsed: %+v", frag.Streams)
	}
}

func TestManagedDefaultsApplied(t *testing.T) {
	cfg := &Config{Nginx: Nginx{Manage: true}}
	applyDefaults(cfg)
	if cfg.Nginx.ConfDir != DefaultConfDir || cfg.Nginx.StreamConfDir != DefaultStreamConfDir {
		t.Errorf("managed dirs not defaulted: %+v", cfg.Nginx)
	}
	if len(cfg.Nginx.TestCmd) == 0 || len(cfg.Nginx.ReloadCmd) == 0 {
		t.Error("test/reload cmds not defaulted")
	}
	if cfg.Tls.WatchInterval == 0 {
		t.Error("watch interval not defaulted")
	}
}
