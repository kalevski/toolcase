package nginxconf

import (
	"errors"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func phpApp(domain string) (*config.Config, *config.App) {
	cfg := &config.Config{
		DataDir: "/var/lib/nginxpilot",
		PHP: config.PHP{
			Enabled:   true,
			Version:   "8.3",
			PoolDir:   "/etc/php/pool.d",
			SocketDir: "/run/php",
		},
	}
	app := &config.App{
		Domain:  domain,
		Runtime: config.RuntimePHP,
		Source:  config.Source{Type: config.SourceGit, URL: "https://example.com/a.git", Branch: "main"},
		PHP: config.AppPHP{
			Routing:    config.PHPRoutingFrontController,
			Index:      "index.php",
			Persistent: []string{"wp-content/uploads"},
		},
	}
	return cfg, app
}

// TestAppVhostNeverBlanketPassesPHP is the anti-RCE guard. A blanket
// `location ~ \.php$ { fastcgi_pass }` executes an uploaded JPEG through
// PATH_INFO, and §3 deliberately gives the app a writable directory inside its
// own document root — so this must never regress.
func TestAppVhostNeverBlanketPassesPHP(t *testing.T) {
	cfg, app := phpApp("shop.example.com")
	out, err := AppVhost(cfg, app, Options{Managed: true})
	if err != nil {
		t.Fatalf("render: %v", err)
	}

	if !strings.Contains(out, "location ~ \\.php$ { return 404; }") {
		t.Fatal("the catch-all .php location must 404, not execute")
	}
	// The only fastcgi_pass must be inside the front-controller location.
	if n := strings.Count(out, "fastcgi_pass"); n != 1 {
		t.Fatalf("expected exactly one fastcgi_pass (the front controller), got %d", n)
	}
	if !strings.Contains(out, "location ~ ^/index\\.php(/|$) {") {
		t.Fatalf("front controller location missing or unescaped:\n%s", out)
	}
	if !strings.Contains(out, "internal;") {
		t.Fatal("the front controller must be internal; so it is only reachable via try_files")
	}
}

// TestAppVhostUsesRealpathRoot guards the opcache-staleness trap: with
// $document_root the symlinked root makes php keep executing the previous
// release after an atomic swap.
func TestAppVhostUsesRealpathRoot(t *testing.T) {
	cfg, app := phpApp("shop.example.com")
	out, err := AppVhost(cfg, app, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "fastcgi_param SCRIPT_FILENAME $realpath_root$fastcgi_script_name;") {
		t.Fatal("SCRIPT_FILENAME must use $realpath_root")
	}
	if strings.Contains(out, "SCRIPT_FILENAME $document_root") {
		t.Fatal("$document_root makes opcache serve the previous release")
	}
}

// TestAppVhostDeniesSensitivePaths covers the deny rules that replace .htaccess.
func TestAppVhostDeniesSensitivePaths(t *testing.T) {
	cfg, app := phpApp("shop.example.com")
	out, err := AppVhost(cfg, app, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	for _, want := range []string{
		"location ~ /\\. { deny all; }",
		"location ~ ^/(vendor|node_modules)/ { deny all; }",
	} {
		if !strings.Contains(out, want) {
			t.Fatalf("missing deny rule %q in:\n%s", want, out)
		}
	}
}

// TestAppVhostRefusesWithoutPool is the highest-severity failure mode: a pool
// that is not available must error so the apply engine quarantines the app,
// never fall through to a static handler that would serve index.php as text.
func TestAppVhostRefusesWithoutPool(t *testing.T) {
	cfg, app := phpApp("shop.example.com")
	cfg.PHP.Enabled = false
	if _, err := AppVhost(cfg, app, Options{Managed: true}); !errors.Is(err, ErrPoolMissing) {
		t.Fatalf("expected ErrPoolMissing, got %v", err)
	}
}

// TestAppVhostRouting covers both request-routing strategies.
func TestAppVhostRouting(t *testing.T) {
	cfg, app := phpApp("shop.example.com")

	out, err := AppVhost(cfg, app, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "try_files $uri $uri/ /index.php?$query_string;") {
		t.Fatalf("front-controller routing missing:\n%s", out)
	}

	app.PHP.Routing = config.PHPRoutingStaticFirst
	out, err = AppVhost(cfg, app, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "try_files $uri $uri/ =404;") {
		t.Fatalf("static-first routing missing:\n%s", out)
	}
}

// TestAppVhostExposeAddsOneLocation proves php.expose widens execution by
// exactly the scripts named, and that each is escaped for the location regex.
func TestAppVhostExposeAddsOneLocation(t *testing.T) {
	cfg, app := phpApp("shop.example.com")
	app.PHP.Expose = []string{"wp-admin/admin-ajax.php"}
	out, err := AppVhost(cfg, app, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if n := strings.Count(out, "fastcgi_pass"); n != 2 {
		t.Fatalf("expected 2 fastcgi_pass (index + exposed), got %d", n)
	}
	if !strings.Contains(out, `location ~ ^/wp-admin/admin-ajax\.php(/|$) {`) {
		t.Fatalf("exposed script not escaped correctly:\n%s", out)
	}
	// An exposed script is directly reachable, so it must NOT be internal.
	exposed := out[strings.Index(out, "wp-admin/admin-ajax"):]
	blockEnd := strings.Index(exposed, "}")
	if strings.Contains(exposed[:blockEnd], "internal;") {
		t.Fatal("an exposed script must be directly reachable, not internal")
	}
}

// TestAppVhostBodySize checks the upload ceiling reaches nginx in its own units.
func TestAppVhostBodySize(t *testing.T) {
	cfg, app := phpApp("shop.example.com")
	app.PHP.MaxBodySize = config.ByteSize(64 << 20)
	out, err := AppVhost(cfg, app, Options{Managed: true})
	if err != nil {
		t.Fatal(err)
	}
	if !strings.Contains(out, "client_max_body_size 64m;") {
		t.Fatalf("body size missing:\n%s", out)
	}
}

func TestNginxSize(t *testing.T) {
	cases := map[int64]string{
		32 << 20:  "32m",
		1 << 30:   "1g",
		512 << 10: "512k",
		1234:      "1234",
	}
	for in, want := range cases {
		if got := nginxSize(in); got != want {
			t.Errorf("nginxSize(%d) = %q, want %q", in, got, want)
		}
	}
}

func TestAppPHPEnvRendersFastcgiParams(t *testing.T) {
	cfg, app := phpApp("shop.example.com")
	app.PHP.Env = map[string]string{"APP_ENV": "production", "DB_HOST": "db.internal"}

	out, err := AppVhost(cfg, app, Options{Managed: true})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if !strings.Contains(out, `fastcgi_param APP_ENV "production";`) {
		t.Errorf("APP_ENV missing from:\n%s", out)
	}
	if !strings.Contains(out, `fastcgi_param DB_HOST "db.internal";`) {
		t.Errorf("DB_HOST missing from:\n%s", out)
	}
	if strings.Index(out, "APP_ENV") > strings.Index(out, "DB_HOST") {
		t.Error("env params are not sorted, so the same map would render two ways")
	}
}

func TestAppPHPEnvQuotesSpecials(t *testing.T) {
	cfg, app := phpApp("shop.example.com")
	app.PHP.Env = map[string]string{"SECRET": `a $b "c" d`}

	out, err := AppVhost(cfg, app, Options{Managed: true})
	if err != nil {
		t.Fatalf("render: %v", err)
	}
	if !strings.Contains(out, `fastcgi_param SECRET "a \$b \"c\" d";`) {
		t.Errorf("value not escaped in:\n%s", out)
	}
}
