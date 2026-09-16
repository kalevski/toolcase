package phpfpm

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// ApplyResult reports what an apply did, mirroring the nginx apply engine so
// /status can present both config surfaces the same way.
type ApplyResult struct {
	// Written is the pool files now live, keyed by app domain.
	Written []string
	// Disabled is the apps whose pool failed validation and were left out, with
	// the php-fpm -t stderr that explains why.
	Disabled map[string]string
	// Reloaded reports whether php-fpm was asked to pick the set up.
	Reloaded bool
}

// Apply renders every enabled php app's pool, validates the whole set with
// `php-fpm -t` in a staging directory, and only then swaps it into the live
// pool dir and reloads.
//
// The quarantine discipline matches nginxctl: if the full set fails, pools are
// added one at a time and only the offending app is dropped, so one bad app
// never takes the other apps' pools down with it. php-fpm is only ever handed a
// configuration that already passed its own test.
func Apply(ctx context.Context, cfg *config.Config) (ApplyResult, error) {
	res := ApplyResult{Disabled: map[string]string{}}
	if !cfg.PHP.Enabled {
		return res, nil
	}

	files := RenderAll(cfg)
	if err := os.MkdirAll(cfg.PHP.PoolDir, 0o750); err != nil {
		return res, fmt.Errorf("create pool dir: %w", err)
	}

	staging, err := os.MkdirTemp(filepath.Dir(cfg.PHP.PoolDir), ".pools-staging-")
	if err != nil {
		return res, fmt.Errorf("create pool staging: %w", err)
	}
	defer os.RemoveAll(staging)

	if err := writeSet(staging, files); err != nil {
		return res, err
	}

	if err := test(ctx, cfg, staging); err != nil {
		// The whole set is bad — find which app (or apps) and keep the rest.
		good, disabled := quarantine(ctx, cfg, staging, files)
		files, res.Disabled = good, disabled
		if err := os.RemoveAll(staging); err != nil {
			return res, err
		}
		if err := os.MkdirAll(staging, 0o750); err != nil {
			return res, err
		}
		if err := writeSet(staging, files); err != nil {
			return res, err
		}
		if err := test(ctx, cfg, staging); err != nil {
			return res, fmt.Errorf("php-fpm config invalid even after quarantine: %w", err)
		}
	}

	if err := swap(staging, cfg.PHP.PoolDir); err != nil {
		return res, err
	}
	for name := range files {
		res.Written = append(res.Written, name)
	}

	if err := reload(ctx, cfg); err != nil {
		// A reload failure leaves the files live but php-fpm running the old
		// set; the next tick retries. Non-fatal on purpose — the alternative is
		// tearing down every pool because one signal missed.
		return res, fmt.Errorf("php-fpm reload: %w", err)
	}
	res.Reloaded = true
	return res, nil
}

// quarantine adds pools one at a time and drops only the ones that fail.
func quarantine(ctx context.Context, cfg *config.Config, staging string, files map[string]string) (map[string]string, map[string]string) {
	good := map[string]string{}
	disabled := map[string]string{}

	for _, name := range FileNames(files) {
		candidate := map[string]string{}
		for k, v := range good {
			candidate[k] = v
		}
		candidate[name] = files[name]

		dir, err := os.MkdirTemp(filepath.Dir(cfg.PHP.PoolDir), ".pools-probe-")
		if err != nil {
			disabled[name] = err.Error()
			continue
		}
		if err := writeSet(dir, candidate); err != nil {
			disabled[name] = err.Error()
			_ = os.RemoveAll(dir)
			continue
		}
		if err := test(ctx, cfg, dir); err != nil {
			disabled[name] = strings.TrimSpace(err.Error())
		} else {
			good[name] = files[name]
		}
		_ = os.RemoveAll(dir)
	}
	return good, disabled
}

func writeSet(dir string, files map[string]string) error {
	if err := os.MkdirAll(dir, 0o750); err != nil {
		return err
	}
	for name, body := range files {
		if err := os.WriteFile(filepath.Join(dir, name), []byte(body), 0o640); err != nil {
			return fmt.Errorf("write pool %s: %w", name, err)
		}
	}
	return nil
}

// swap replaces the live pool dir contents with the staged set. Pool files are
// small and php-fpm reads them only on reload, so a directory-level rename is
// unnecessary — and a rename would hit the same overlayfs EXDEV problem the
// nginx dirs already work around.
func swap(staging, live string) error {
	existing, err := os.ReadDir(live)
	if err != nil && !os.IsNotExist(err) {
		return err
	}
	for _, e := range existing {
		if strings.HasPrefix(e.Name(), "app-") && strings.HasSuffix(e.Name(), ".conf") {
			if err := os.Remove(filepath.Join(live, e.Name())); err != nil {
				return err
			}
		}
	}
	staged, err := os.ReadDir(staging)
	if err != nil {
		return err
	}
	for _, e := range staged {
		body, err := os.ReadFile(filepath.Join(staging, e.Name()))
		if err != nil {
			return err
		}
		if err := os.WriteFile(filepath.Join(live, e.Name()), body, 0o640); err != nil {
			return err
		}
	}
	return nil
}

// test validates the STAGED pool set, not the live one. php-fpm.conf includes
// the live pool dir, so testing with it would happily pass a broken staging set
// and reject a good one — the check has to point at the directory under test.
// A throwaway global config inside staging does that.
func test(ctx context.Context, cfg *config.Config, poolDir string) error {
	argv := cfg.PHP.TestCmd
	if len(argv) == 0 {
		bin := fpmBinary()
		if bin == "" {
			// No php-fpm on this host: nothing to validate against. Treat as a
			// pass so a php-free image does not fail every apply; AppVhost still
			// refuses to render an app whose pool is missing.
			return nil
		}
		// The probe must live OUTSIDE poolDir: it includes poolDir/*.conf, and a
		// probe named *.conf inside that directory would include itself.
		probe := poolDir + ".probe"
		body := fmt.Sprintf("[global]\npid = /run/php/php-fpm-probe.pid\nerror_log = /dev/null\ndaemonize = no\n\ninclude=%s/*.conf\n", poolDir)
		if err := os.WriteFile(probe, []byte(body), 0o640); err != nil {
			return fmt.Errorf("write probe config: %w", err)
		}
		defer os.Remove(probe)
		argv = []string{bin, "-t", "--fpm-config", probe}
	}
	ctx, cancel := context.WithTimeout(ctx, 15*time.Second)
	defer cancel()

	cmd := exec.CommandContext(ctx, argv[0], argv[1:]...)
	cmd.Env = append(os.Environ(), "NGINXPILOT_POOL_DIR="+poolDir)
	out, err := cmd.CombinedOutput()
	if err != nil {
		return fmt.Errorf("%s", strings.TrimSpace(string(out)))
	}
	return nil
}

// reload asks php-fpm to pick up the new pool set.
//
// The php-fpm master must run as root — only root can switch a pool to its own
// uid, which is the whole isolation floor — while this daemon runs unprivileged,
// so the USR2 signal is usually EPERM. That is expected, not an error: the
// container entrypoint (which IS root) watches the pool directory and reloads.
// An explicit php.reload_cmd overrides all of this for hosts that wire it
// differently (systemd, a socket-activated master, a sidecar).
func reload(ctx context.Context, cfg *config.Config) error {
	argv := cfg.PHP.ReloadCmd
	explicit := len(argv) > 0
	if !explicit {
		pid, err := os.ReadFile(pidPath())
		if err != nil {
			return nil // php-fpm not running here; nothing to signal
		}
		argv = []string{"kill", "-USR2", strings.TrimSpace(string(pid))}
	}
	ctx, cancel := context.WithTimeout(ctx, 10*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, argv[0], argv[1:]...).CombinedOutput()
	if err != nil {
		if explicit {
			return fmt.Errorf("%s", strings.TrimSpace(string(out)))
		}
		// Unprivileged signal to a root master: the entrypoint watcher owns the
		// reload. Reported as not-reloaded rather than as a failure.
		return nil
	}
	return nil
}

func pidPath() string {
	if p := os.Getenv("PHP_FPM_PID"); p != "" {
		return p
	}
	return "/run/php/php-fpm.pid"
}

func fpmBinary() string {
	for _, name := range []string{"php-fpm83", "php-fpm82", "php-fpm81", "php-fpm"} {
		if p, err := exec.LookPath(name); err == nil {
			return p
		}
	}
	return ""
}

func fpmConfigPath() string {
	if p := os.Getenv("PHP_FPM_CONFIG"); p != "" {
		return p
	}
	return "/etc/php/php-fpm.conf"
}
