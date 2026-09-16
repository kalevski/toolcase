package phpfpm

import (
	"os"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// TestEmitPoolForValidation writes a rendered pool to POOL_OUT when set, so the
// build can hand it to a real `php-fpm -t`. Skipped in normal runs.
func TestEmitPoolForValidation(t *testing.T) {
	out := os.Getenv("POOL_OUT")
	if out == "" {
		t.Skip("POOL_OUT not set")
	}
	cfg := &config.Config{
		DataDir: "/var/lib/nginxpilot",
		PHP:     config.PHP{Enabled: true, PoolDir: "/etc/php/pool.d", SocketDir: "/run/php", RunAs: "nobody", SocketOwner: "nobody"},
	}
	app := &config.App{
		Domain:  "shop.example.com",
		Runtime: config.RuntimePHP,
		PHP:     config.AppPHP{Index: "index.php", Persistent: []string{"wp-content/uploads"}},
	}
	if err := os.WriteFile(out, []byte(RenderPool(cfg, app)), 0o644); err != nil {
		t.Fatal(err)
	}
}
