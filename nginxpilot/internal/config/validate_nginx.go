package config

import (
	"fmt"
	"regexp"
)

// streamNameRe restricts stream and stream-upstream names to a safe nginx
// identifier (same rule as http upstream names) so generated directives and the
// deterministic stream-<name>.conf filenames are unambiguous.
var streamNameRe = regexp.MustCompile(`^[A-Za-z0-9_]+$`)

// validateNginx checks the managed-mode block. Inert when manage is false.
func validateNginx(cfg *Config) error {
	n := cfg.Nginx
	if !n.Manage {
		return nil
	}
	if n.ConfDir == "" {
		return fmt.Errorf("nginx.conf_dir is required when nginx.manage is true")
	}
	if n.StreamConfDir == "" {
		return fmt.Errorf("nginx.stream_conf_dir is required when nginx.manage is true")
	}
	if n.ManagedIncludeDir == "" {
		return fmt.Errorf("nginx.managed_include_dir is required when nginx.manage is true")
	}
	if len(n.TestCmd) == 0 {
		return fmt.Errorf("nginx.test_cmd must not be empty")
	}
	if len(n.ReloadCmd) == 0 {
		return fmt.Errorf("nginx.reload_cmd must not be empty")
	}
	return nil
}

// validateTls checks the TLS cert-dir block. cert_dir and cert_dir_env are
// mutually exclusive; the path itself is resolved (and may be absent) at
// startup, not here, so `validate` works on a host without the certs present.
func validateTls(cfg *Config) error {
	t := cfg.Tls
	if t.CertDir != "" && t.CertDirEnv != "" {
		return fmt.Errorf("tls.cert_dir and tls.cert_dir_env are mutually exclusive")
	}
	if t.WatchInterval < 0 {
		return fmt.Errorf("tls.watch_interval must not be negative")
	}
	// If any resource opts into TLS, a cert source must be configured.
	if cfg.anyResourceWantsTLS() && t.CertDir == "" && t.CertDirEnv == "" {
		return fmt.Errorf("a resource sets tls: auto|required but neither tls.cert_dir nor tls.cert_dir_env is configured")
	}
	return nil
}

// anyResourceWantsTLS reports whether any site, proxy or stream opted into TLS.
func (cfg *Config) anyResourceWantsTLS() bool {
	for i := range cfg.Sites {
		if cfg.Sites[i].WantsTLS() {
			return true
		}
	}
	for i := range cfg.Proxies {
		if cfg.Proxies[i].WantsTLS() {
			return true
		}
	}
	for i := range cfg.Streams {
		if cfg.Streams[i].WantsTLS() {
			return true
		}
	}
	return false
}

// validateWebOptions enforces the per-host toggle rules shared by sites and
// proxies. force_ssl / http2 / hsts are meaningful only with TLS, so they are a
// clear error without it (rather than silently redirecting to a dead https).
func validateWebOptions(w *WebOptions) error {
	switch w.TLSMode() {
	case TLSOff, TLSAuto, TLSRequired:
	default:
		return fmt.Errorf("tls %q must be off | auto | required", w.TLS)
	}
	if !w.WantsTLS() {
		if w.ForceSSL {
			return fmt.Errorf("force_ssl requires tls: auto or required")
		}
		if w.HTTP2 {
			return fmt.Errorf("http2 requires tls: auto or required")
		}
		if w.HSTS.Enabled {
			return fmt.Errorf("hsts requires tls: auto or required")
		}
	}
	return nil
}

// validateCache checks the proxy cache block.
func validateCache(c Cache) error {
	if !c.Enabled {
		return nil
	}
	if c.ZoneSize != "" {
		if _, err := ParseByteSize(c.ZoneSize); err != nil {
			return fmt.Errorf("cache.zone_size: %w", err)
		}
	}
	return nil
}

// validateStreamUpstreams checks every stream upstream and returns the set of
// declared names for stream reference resolution. Stream and http upstream
// namespaces are separate — a name may exist in both without collision.
func validateStreamUpstreams(cfg *Config) (map[string]bool, error) {
	names := map[string]string{} // name -> file
	for i := range cfg.StreamUpstreams {
		u := &cfg.StreamUpstreams[i]
		if u.Name == "" {
			return nil, fmt.Errorf("stream_upstream (%s): name is required", u.File)
		}
		if !streamNameRe.MatchString(u.Name) {
			return nil, fmt.Errorf("stream_upstream %q (%s): name must match [A-Za-z0-9_]+", u.Name, u.File)
		}
		if prev, dup := names[u.Name]; dup {
			return nil, fmt.Errorf("duplicate stream_upstream %q declared in %s and %s", u.Name, prev, u.File)
		}
		names[u.Name] = u.File

		switch u.Balancer {
		case "", StreamBalancerRoundRobin, StreamBalancerLeastConn, StreamBalancerHash:
		default:
			return nil, fmt.Errorf("stream_upstream %q: balancer %q must be round_robin | least_conn | hash", u.Name, u.Balancer)
		}
		if len(u.Servers) == 0 {
			return nil, fmt.Errorf("stream_upstream %q: at least one server is required", u.Name)
		}
		for j := range u.Servers {
			s := u.Servers[j]
			if s.Address == "" {
				return nil, fmt.Errorf("stream_upstream %q: server[%d].address is required", u.Name, j)
			}
			if s.Weight < 0 {
				return nil, fmt.Errorf("stream_upstream %q: server %q weight must be >= 0", u.Name, s.Address)
			}
			if s.MaxFails != nil && *s.MaxFails < 0 {
				return nil, fmt.Errorf("stream_upstream %q: server %q max_fails must be >= 0", u.Name, s.Address)
			}
		}
	}
	out := make(map[string]bool, len(names))
	for n := range names {
		out[n] = true
	}
	return out, nil
}

// validateStreams checks L4 stream resources: identity (name), listen port,
// protocol, exactly-one backend, stream-upstream references, and listen
// port+protocol uniqueness across streams.
func validateStreams(cfg *Config, streamUpstreams map[string]bool) error {
	names := map[string]string{}     // name -> file
	listeners := map[string]string{} // "port/proto" -> name
	for i := range cfg.Streams {
		s := &cfg.Streams[i]
		if s.Name == "" {
			return fmt.Errorf("stream (%s): name is required", s.File)
		}
		if !streamNameRe.MatchString(s.Name) {
			return fmt.Errorf("stream %q (%s): name must match [A-Za-z0-9_]+", s.Name, s.File)
		}
		if prev, dup := names[s.Name]; dup {
			return fmt.Errorf("duplicate stream %q declared in %s and %s", s.Name, prev, s.File)
		}
		names[s.Name] = s.File

		if s.Listen < 1 || s.Listen > 65535 {
			return fmt.Errorf("stream %q: listen %d must be 1..65535", s.Name, s.Listen)
		}
		switch s.ProtocolOrTCP() {
		case ProtocolTCP, ProtocolUDP:
		default:
			return fmt.Errorf("stream %q: protocol %q must be tcp or udp", s.Name, s.Protocol)
		}
		key := fmt.Sprintf("%d/%s", s.Listen, s.ProtocolOrTCP())
		if prev, dup := listeners[key]; dup {
			return fmt.Errorf("stream %q: listen %s collides with stream %q", s.Name, key, prev)
		}
		listeners[key] = s.Name

		switch {
		case s.Upstream != "" && s.Pass != "":
			return fmt.Errorf("stream %q: upstream and pass are mutually exclusive", s.Name)
		case s.Upstream != "":
			if !streamUpstreams[s.Upstream] {
				return fmt.Errorf("stream %q: references unknown stream_upstream %q", s.Name, s.Upstream)
			}
		case s.Pass != "":
			// inline host:port — accepted verbatim (validated at apply time by nginx -t)
		default:
			return fmt.Errorf("stream %q: upstream or pass is required", s.Name)
		}

		switch s.TLSMode() {
		case TLSOff, TLSAuto, TLSRequired:
		default:
			return fmt.Errorf("stream %q: tls %q must be off | auto | required", s.Name, s.TLS)
		}
		if s.WantsTLS() && s.TLSDomain == "" {
			return fmt.Errorf("stream %q: tls %s requires tls_domain (the cert name to use; L4 has no SNI)", s.Name, s.TLSMode())
		}
	}
	return nil
}
