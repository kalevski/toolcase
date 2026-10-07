package phpfpm

import (
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

func TestResolveUser(t *testing.T) {
	old := userExists
	t.Cleanup(func() { userExists = old })
	app := &config.App{Domain: "shop.example.com", Runtime: config.RuntimePHP}

	userExists = func(name string) bool { return name == "app-shop.example.com" }
	if u, err := ResolveUser(&config.Config{}, app); err != nil || u != "app-shop.example.com" {
		t.Fatalf("own user: %q, %v", u, err)
	}

	userExists = func(string) bool { return false }
	if _, err := ResolveUser(&config.Config{}, app); err == nil || !strings.Contains(err.Error(), "app-shop.example.com") {
		t.Fatalf("missing user must fail with a clear error, got %v", err)
	}
	if u, err := ResolveUser(&config.Config{PHP: config.PHP{RunAs: "www"}}, app); err != nil || u != "www" {
		t.Fatalf("explicit run_as: %q, %v", u, err)
	}
	if u, err := ResolveUser(&config.Config{PHP: config.PHP{AllowSharedUser: true}}, app); err != nil || u != sharedFallbackUser {
		t.Fatalf("allow_shared_user: %q, %v", u, err)
	}

	cfg := &config.Config{DataDir: "/d", PHP: config.PHP{Enabled: true, PoolDir: "/p", SocketDir: "/s"}, Apps: []config.App{*app}}
	files, failed := RenderAllChecked(cfg)
	if len(files) != 0 || len(failed) != 1 {
		t.Fatalf("an app with no user must get no pool: files=%v failed=%v", files, failed)
	}
}

func TestPoolDisablesFileAndEnvFunctions(t *testing.T) {
	cfg := &config.Config{DataDir: "/d", PHP: config.PHP{Enabled: true, PoolDir: "/p", SocketDir: "/s", RunAs: "nobody"}}
	out := RenderPool(cfg, &config.App{Domain: "a.example.com", Runtime: config.RuntimePHP})
	for _, fn := range []string{"symlink", "link", "putenv", "exec", "proc_open"} {
		if !strings.Contains(out, fn) {
			t.Errorf("disable_functions lacks %s", fn)
		}
	}
	if strings.Contains(out, ",mail") {
		t.Error("mail must stay enabled (WordPress notifications)")
	}
}
