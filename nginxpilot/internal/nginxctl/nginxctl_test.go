package nginxctl

import (
	"context"
	"errors"
	"io"
	"log/slog"
	"os"
	"path/filepath"
	"strings"
	"testing"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// fakeNginx simulates `nginx -t`: an isolated test (with -c) reads the synthetic
// conf's include globs and fails if any included file carries the # FAILTEST
// marker. The configured live test always passes; reload fails iff reloadErr.
type fakeNginx struct {
	reloadErr error
}

func (f *fakeNginx) run(_ context.Context, name string, args ...string) (string, error) {
	if has(args, "-c") {
		return f.isolatedTest(args)
	}
	if has(args, "reload") {
		if f.reloadErr != nil {
			return "reload failed", f.reloadErr
		}
		return "", nil
	}
	return "configuration file test is successful", nil // live -t
}

func (f *fakeNginx) isolatedTest(args []string) (string, error) {
	confPath := args[indexOf(args, "-c")+1]
	raw, err := os.ReadFile(confPath)
	if err != nil {
		return "", err
	}
	for _, line := range strings.Split(string(raw), "\n") {
		line = strings.TrimSpace(line)
		if !strings.HasPrefix(line, "include ") {
			continue
		}
		glob := strings.TrimSuffix(strings.TrimPrefix(line, "include "), ";")
		matches, _ := filepath.Glob(strings.TrimSpace(glob))
		for _, m := range matches {
			b, _ := os.ReadFile(m)
			if strings.Contains(string(b), "# FAILTEST") {
				return "nginx: [emerg] invalid directive in " + filepath.Base(m) + "\nconfiguration file test failed", errors.New("exit status 1")
			}
		}
	}
	return "configuration file test is successful", nil
}

func has(s []string, v string) bool { return indexOf(s, v) >= 0 }
func indexOf(s []string, v string) int {
	for i, x := range s {
		if x == v {
			return i
		}
	}
	return -1
}

func testEngine(t *testing.T, run RunFunc) (*Engine, *config.Config) {
	t.Helper()
	base := t.TempDir()
	cfg := &config.Config{
		Nginx: config.Nginx{
			Manage:            true,
			ConfDir:           filepath.Join(base, "conf.d"),
			StreamConfDir:     filepath.Join(base, "stream.d"),
			ManagedIncludeDir: filepath.Join(base, "conf.d"),
			TestCmd:           []string{"nginx", "-t"},
			ReloadCmd:         []string{"nginx", "-s", "reload"},
		},
	}
	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	return newEngine(cfg, log, run), cfg
}

// A single deliberately-broken proxy is disabled; the others stay active and
// nginx is still reloaded with the valid subset.
func TestApplyQuarantinesBadResource(t *testing.T) {
	fake := &fakeNginx{}
	eng, cfg := testEngine(t, fake.run)
	cfg.Proxies = []config.Proxy{
		{Domain: "good1.example.com", Pass: "http://127.0.0.1:9001"},
		{Domain: "bad.example.com", Pass: "http://127.0.0.1:9002",
			WebOptions: config.WebOptions{Advanced: "# FAILTEST this directive is broken"}},
		{Domain: "good2.example.com", Pass: "http://127.0.0.1:9003"},
	}

	res, err := eng.Apply(context.Background(), cfg, nil)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if !res.Reloaded {
		t.Fatal("expected reload")
	}

	state := map[string]string{}
	for _, r := range res.Resources {
		state[r.Key] = r.State
	}
	if state["bad.example.com"] != StateDisabled {
		t.Errorf("bad proxy should be disabled, got %q", state["bad.example.com"])
	}
	for _, good := range []string{"good1.example.com", "good2.example.com"} {
		if state[good] != StateActive {
			t.Errorf("%s should be active, got %q", good, state[good])
		}
	}

	// The live conf.d holds the two good files and not the bad one.
	if !fileExists(eng.confDir, "proxy-good1.example.com.conf") ||
		!fileExists(eng.confDir, "proxy-good2.example.com.conf") {
		t.Error("good proxy files missing from live dir")
	}
	if fileExists(eng.confDir, "proxy-bad.example.com.conf") {
		t.Error("bad proxy file must not be live")
	}
	// And the disabled one carries the nginx -t reason.
	for _, r := range res.Disabled() {
		if r.Key == "bad.example.com" && !strings.Contains(r.Reason, "emerg") {
			t.Errorf("disabled reason should carry nginx output, got %q", r.Reason)
		}
	}
}

// When everything is valid the whole set goes live in one shot (no quarantine).
func TestApplyAllValid(t *testing.T) {
	fake := &fakeNginx{}
	eng, cfg := testEngine(t, fake.run)
	cfg.Proxies = []config.Proxy{{Domain: "api.example.com", Pass: "http://127.0.0.1:9000"}}

	res, err := eng.Apply(context.Background(), cfg, nil)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if len(res.Disabled()) != 0 {
		t.Errorf("nothing should be disabled, got %v", res.Disabled())
	}
	if !fileExists(eng.confDir, "proxy-api.example.com.conf") {
		t.Error("proxy file should be live")
	}
}

// An explicitly disabled proxy (enabled: false) renders no file and is not
// reported as quarantined — it simply doesn't exist as far as nginx goes.
func TestApplySkipsDisabledProxy(t *testing.T) {
	fake := &fakeNginx{}
	eng, cfg := testEngine(t, fake.run)
	off := false
	cfg.Proxies = []config.Proxy{
		{Domain: "on.example.com", Pass: "http://127.0.0.1:9001"},
		{Domain: "off.example.com", Pass: "http://127.0.0.1:9002", Enabled: &off},
	}

	res, err := eng.Apply(context.Background(), cfg, nil)
	if err != nil {
		t.Fatalf("apply: %v", err)
	}
	if len(res.Disabled()) != 0 {
		t.Errorf("a config-disabled proxy is not a quarantine, got %v", res.Disabled())
	}
	if !fileExists(eng.confDir, "proxy-on.example.com.conf") {
		t.Error("enabled proxy file should be live")
	}
	if fileExists(eng.confDir, "proxy-off.example.com.conf") {
		t.Error("disabled proxy file must not be rendered")
	}
	for _, r := range res.Resources {
		if r.Key == "off.example.com" {
			t.Errorf("disabled proxy should not appear as a resource, got %v", r)
		}
	}
}

// A reload that fails after a passing -t rolls the live dir back to the previous
// snapshot so nginx keeps serving last-good.
func TestApplyReloadFailureRollsBack(t *testing.T) {
	// Seed a previous-good live dir with a sentinel file.
	fakeOK := &fakeNginx{}
	eng, cfg := testEngine(t, fakeOK.run)
	cfg.Proxies = []config.Proxy{{Domain: "v1.example.com", Pass: "http://127.0.0.1:9000"}}
	if _, err := eng.Apply(context.Background(), cfg, nil); err != nil {
		t.Fatalf("seed apply: %v", err)
	}

	// Now reload fails on the next apply.
	eng.run = (&fakeNginx{reloadErr: errors.New("exit status 1")}).run
	cfg.Proxies = []config.Proxy{{Domain: "v2.example.com", Pass: "http://127.0.0.1:9000"}}
	_, err := eng.Apply(context.Background(), cfg, nil)
	if err == nil {
		t.Fatal("expected reload error")
	}
	// Live dir must be rolled back to v1 (the last-good), not v2.
	if !fileExists(eng.confDir, "proxy-v1.example.com.conf") {
		t.Error("rollback should restore v1 live config")
	}
	if fileExists(eng.confDir, "proxy-v2.example.com.conf") {
		t.Error("v2 must not remain live after rollback")
	}
}

func fileExists(dir, name string) bool {
	_, err := os.Stat(filepath.Join(dir, name))
	return err == nil
}
