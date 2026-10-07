package config

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

func base(dataDir string) *Config {
	return &Config{DataDir: dataDir, LogLevel: "info", Defaults: Defaults{KeepReleases: 3}}
}

func TestAdminNonLoopbackNeedsToken(t *testing.T) {
	cases := []struct {
		listen string
		token  bool
		ok     bool
	}{
		{"127.0.0.1:9090", false, true},
		{"[::1]:9090", false, true},
		{"localhost:9090", false, true},
		{"0.0.0.0:9090", false, false},
		{":9090", false, false},
		{"10.0.0.5:9090", false, false},
		{"0.0.0.0:9090", true, true},
		{"", false, true},
	}
	for _, c := range cases {
		cfg := base(t.TempDir())
		l := c.listen
		cfg.Admin.Listen = &l
		if c.token {
			cfg.Admin.TokenEnv = "NGINXPILOT_TOKEN"
		}
		err := Validate(cfg)
		if (err == nil) != c.ok {
			t.Errorf("listen %q token=%v: err=%v, want ok=%v", c.listen, c.token, err, c.ok)
		}
	}
}

func TestProxyTargetPolicyInValidate(t *testing.T) {
	deny := []string{"http://127.0.0.1:9090", "http://localhost", "http://169.254.169.254", "http://unix:/run/nginxpilot/admin.sock:/"}
	for _, pass := range deny {
		cfg := base(t.TempDir())
		cfg.Proxies = []Proxy{{Domain: "p.example.com", Pass: pass}}
		if err := Validate(cfg); err == nil {
			t.Errorf("pass %q accepted", pass)
		}
	}
	cfg := base(t.TempDir())
	cfg.Proxies = []Proxy{{Domain: "p.example.com", Pass: "http://wmk-ab12cd:8080"}}
	cfg.Upstreams = []Upstream{{Name: "u", Servers: []UpstreamServer{{Address: "backend.internal:9000"}}}}
	cfg.StreamUpstreams = []StreamUpstream{{Name: "s", Servers: []StreamUpstreamServer{{Address: "db.internal:5432"}}}}
	if err := Validate(cfg); err != nil {
		t.Errorf("overlay hostnames must pass: %v", err)
	}

	cfg = base(t.TempDir())
	cfg.Upstreams = []Upstream{{Name: "u", Servers: []UpstreamServer{{Address: "unix:/run/apps/a.sock"}}}}
	if err := Validate(cfg); err == nil {
		t.Error("unix: upstream accepted with no proxy.unix_socket_dirs")
	}
	cfg.Proxy.UnixSocketDirs = []string{"/run/apps"}
	if err := Validate(cfg); err != nil {
		t.Errorf("unix: upstream under an allowed dir: %v", err)
	}
	cfg.Upstreams[0].Servers[0].Address = "unix:/run/nginxpilot/admin.sock"
	cfg.Proxy.UnixSocketDirs = []string{"/run"}
	if err := Validate(cfg); err == nil {
		t.Error("admin socket accepted even though /run is allowed")
	}

	cfg = base(t.TempDir())
	cfg.Proxy.DenyCIDRs = []string{"10.0.0.0/8"}
	cfg.Proxies = []Proxy{{Domain: "p.example.com", Pass: "http://10.1.2.3"}}
	if err := Validate(cfg); err == nil {
		t.Error("operator deny_cidrs ignored")
	}
}

func TestStreamAllowedPorts(t *testing.T) {
	mk := func(port int) *Config {
		cfg := base(t.TempDir())
		cfg.Stream.AllowedPorts = []string{"20000-29999", "5432"}
		cfg.Streams = []Stream{{Name: "s", Listen: port, Pass: "db.internal:5432"}}
		return cfg
	}
	for _, p := range []int{20000, 25000, 29999, 5432} {
		if err := Validate(mk(p)); err != nil {
			t.Errorf("port %d: %v", p, err)
		}
	}
	for _, p := range []int{80, 19999, 30000, 22} {
		if err := Validate(mk(p)); err == nil {
			t.Errorf("port %d accepted", p)
		}
	}
	cfg := base(t.TempDir())
	cfg.Stream.AllowedPorts = []string{"x"}
	if err := Validate(cfg); err == nil {
		t.Error("bad allowed_ports accepted")
	}
}

func TestSourceSecretConfinement(t *testing.T) {
	dir := t.TempDir()
	creds := filepath.Join(dir, "git-credentials")
	if err := os.MkdirAll(creds, 0o700); err != nil {
		t.Fatal(err)
	}
	src := func(a Auth) Source {
		return Source{Type: SourceHTTPZip, URL: "https://x.example.com/a.zip", Auth: a}
	}
	try := func(a Auth, adminTokenFile string) error {
		cfg := base(dir)
		cfg.Admin.TokenFile = adminTokenFile
		cfg.Sites = []Site{{Domain: "a.example.com", Source: src(a)}}
		return Validate(cfg)
	}

	if err := try(Auth{Method: AuthBearer, TokenFile: filepath.Join(creds, "site-1.token")}, ""); err != nil {
		t.Errorf("git-credentials file refused: %v", err)
	}
	if err := try(Auth{Method: AuthBearer, TokenEnv: "NP_SECRET_X"}, ""); err != nil {
		t.Errorf("prefixed env refused: %v", err)
	}
	for _, a := range []Auth{
		{Method: AuthBearer, TokenEnv: "NGINXPILOT_TOKEN"},
		{Method: AuthBearer, TokenEnv: "PATH"},
		{Method: AuthBearer, TokenFile: "/etc/letsencrypt/live/x/privkey.pem"},
		{Method: AuthBearer, TokenFile: filepath.Join(creds, "..", "tmp", "x")},
		{Method: AuthBasic, Username: "u", PasswordFile: "/etc/passwd"},
		{Method: AuthHeader, Name: "X-K", ValueFile: filepath.Join(dir, "acme", "credentials.json")},
	} {
		if err := try(a, ""); err == nil {
			t.Errorf("auth %+v accepted", a)
		}
	}

	secrets := filepath.Join(dir, "secrets")
	if err := os.MkdirAll(secrets, 0o700); err != nil {
		t.Fatal(err)
	}
	if err := try(Auth{Method: AuthBearer, TokenFile: filepath.Join(secrets, "admin.token")}, filepath.Join(secrets, "admin.token")); err == nil {
		t.Error("the admin token file must never be a source secret")
	}

	outside := t.TempDir()
	if err := os.WriteFile(filepath.Join(outside, "k"), []byte("x"), 0o600); err != nil {
		t.Fatal(err)
	}
	link := filepath.Join(creds, "evil.token")
	if err := os.Symlink(filepath.Join(outside, "k"), link); err != nil {
		t.Fatal(err)
	}
	if err := try(Auth{Method: AuthBearer, TokenFile: link}, ""); err == nil {
		t.Error("a symlink out of git-credentials was followed")
	}
}

func TestAuthResolveUnderPolicy(t *testing.T) {
	dir := t.TempDir()
	cfg := base(dir)
	cfg.Sites = []Site{{Domain: "a.example.com", Source: Source{Type: SourceHTTPZip, URL: "https://x.example.com/a.zip",
		Auth: Auth{Method: AuthBearer, TokenEnv: "NP_SECRET_T"}}}}
	t.Setenv("NP_SECRET_T", "tok")
	t.Setenv("OTHER", "nope")
	if err := Validate(cfg); err != nil {
		t.Fatal(err)
	}
	a := cfg.Sites[0].Source.Auth
	if v, err := a.Resolve("NP_SECRET_T", ""); err != nil || v != "tok" {
		t.Errorf("Resolve = %q, %v", v, err)
	}
	if _, err := a.Resolve("OTHER", ""); err == nil {
		t.Error("runtime Resolve must refuse an unprefixed env var")
	}
}

func TestLimitsClampToDaemonCeiling(t *testing.T) {
	cfg := base(t.TempDir())
	cfg.Limits = Limits{MaxArchiveSize: 100 << 20, MaxEntries: 1000, MaxGitRepoSize: 50 << 20}
	cfg.Sites = []Site{{Domain: "a.example.com", Source: Source{Type: SourceHTTPZip, URL: "https://x.example.com/a.zip",
		Limits: Limits{MaxArchiveSize: 5 << 30, MaxCompressionRatio: 5000}}}}
	if err := Validate(cfg); err != nil {
		t.Fatal(err)
	}
	l := cfg.Sites[0].Source.Limits.Effective()
	if l.MaxArchiveSize != 100<<20 || l.MaxEntries != 1000 || l.MaxCompressionRatio != CeilingRatio || l.MaxGitRepoSize != 50<<20 {
		t.Errorf("limits not clamped: %+v", l)
	}
	e := Limits{}.Effective()
	if e.MaxArchiveSize != DefaultMaxArchiveSize || e.MaxGitRepoSize != DefaultMaxGitRepoSize {
		t.Errorf("defaults changed: %+v", e)
	}
	c := Limits{MaxArchiveSize: 2 << 30}.Clamp(Limits{})
	if c.MaxArchiveSize != CeilingMaxArchiveSize {
		t.Errorf("default ceiling not applied: %v", c.MaxArchiveSize)
	}
}

func TestFileLogDestinationConfined(t *testing.T) {
	dir := t.TempDir()
	cases := map[string]bool{
		filepath.Join(dir, "logs", "a.ndjson"):         true,
		filepath.Join(dir, "logs", "sub", "a.ndjson"):  true,
		filepath.Join(dir, "sites.d", "evil.yml"):      false,
		filepath.Join(dir, "logs", "..", "state.json"): false,
		filepath.Join(dir, "logs"):                     false,
		"/etc/cron.d/x":                                false,
		filepath.Join(dir, "logsx", "a.ndjson"):        false,
	}
	for path, ok := range cases {
		cfg := base(dir)
		cfg.LogDestinations = []LogDestination{{Name: "f", Type: LogDestFile, Path: path}}
		err := Validate(cfg)
		if (err == nil) != ok {
			t.Errorf("path %q: err=%v want ok=%v", path, err, ok)
		}
	}
}

func TestPHPEnvReserved(t *testing.T) {
	mk := func(env map[string]string) *Config {
		cfg := base(t.TempDir())
		cfg.PHP = PHP{Enabled: true, PoolDir: "/etc/php/pool.d", SocketDir: "/run/php"}
		cfg.Apps = []App{{Domain: "a.example.com", Runtime: RuntimePHP,
			Source: Source{Type: SourceHTTPZip, URL: "https://x.example.com/a.zip"},
			PHP:    AppPHP{Env: env}}}
		return cfg
	}
	if err := Validate(mk(map[string]string{"WORDPRESS_DB_HOST": "db", "APP_ENV": "prod"})); err != nil {
		t.Errorf("plain env refused: %v", err)
	}
	for _, k := range []string{"PHP_VALUE", "PHP_ADMIN_VALUE", "SCRIPT_FILENAME", "DOCUMENT_ROOT", "HTTP_PROXY", "PATH_INFO", "REQUEST_URI", "QUERY_STRING", "CONTENT_TYPE", "REMOTE_ADDR", "SERVER_NAME", "GATEWAY_INTERFACE", "REDIRECT_STATUS", "php_value"} {
		if err := Validate(mk(map[string]string{k: "x"})); err == nil {
			t.Errorf("env key %s accepted", k)
		}
	}
	for _, v := range []string{"a$b", "${x}", "a\nb"} {
		if err := Validate(mk(map[string]string{"APP_X": v})); err == nil || !strings.Contains(err.Error(), "php.env") {
			t.Errorf("env value %q accepted (%v)", v, err)
		}
	}
}
