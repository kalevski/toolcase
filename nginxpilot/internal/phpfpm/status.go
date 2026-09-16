package phpfpm

import (
	"context"
	"net"
	"os/exec"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/kalevski/toolcase/nginxpilot/internal/config"
)

// PoolStatus is the health of one app's pool as /status reports it.
type PoolStatus struct {
	App         string `json:"app"`
	Socket      string `json:"socket"`
	Up          bool   `json:"up"`
	MaxChildren int    `json:"max_children"`
	Error       string `json:"error,omitempty"`
}

// Status is the `php` object in GET /status. A control plane reads it to decide
// whether a realm can serve a php app at all, and whether it carries the
// extensions a particular application needs — which is the difference between
// refusing a deploy up front and letting the user discover it from a 500 page.
type Status struct {
	Enabled    bool         `json:"enabled"`
	Version    string       `json:"version,omitempty"`
	Extensions []string     `json:"extensions,omitempty"`
	Pools      []PoolStatus `json:"pools"`
}

var (
	probeOnce sync.Once
	probedVer string
	probedExt []string
)

// Probe asks the local php binary what it is and what it carries. The answer
// never changes for the life of the container (the image decides), so it is
// resolved once and cached.
func Probe(ctx context.Context) (version string, extensions []string) {
	probeOnce.Do(func() {
		probedVer = probeVersion(ctx)
		probedExt = probeExtensions(ctx)
	})
	return probedVer, probedExt
}

func phpBinary() string {
	for _, name := range []string{"php83", "php82", "php81", "php"} {
		if p, err := exec.LookPath(name); err == nil {
			return p
		}
	}
	return ""
}

func probeVersion(ctx context.Context) string {
	bin := phpBinary()
	if bin == "" {
		return ""
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, bin, "-r", "echo PHP_MAJOR_VERSION.'.'.PHP_MINOR_VERSION;").Output()
	if err != nil {
		return ""
	}
	return strings.TrimSpace(string(out))
}

func probeExtensions(ctx context.Context) []string {
	bin := phpBinary()
	if bin == "" {
		return nil
	}
	ctx, cancel := context.WithTimeout(ctx, 5*time.Second)
	defer cancel()
	out, err := exec.CommandContext(ctx, bin, "-m").Output()
	if err != nil {
		return nil
	}
	var exts []string
	for _, line := range strings.Split(string(out), "\n") {
		line = strings.TrimSpace(line)
		if line == "" || strings.HasPrefix(line, "[") {
			continue
		}
		exts = append(exts, strings.ToLower(line))
	}
	sort.Strings(exts)
	return dedupe(exts)
}

// Report builds the /status php object, dialling each configured pool socket so
// "up" reflects reality rather than the fact that a file was written.
func Report(ctx context.Context, cfg *config.Config) Status {
	st := Status{Enabled: cfg.PHP.Enabled, Pools: []PoolStatus{}}
	if !cfg.PHP.Enabled {
		return st
	}

	version, extensions := Probe(ctx)
	st.Version = version
	if st.Version == "" {
		st.Version = cfg.PHP.Version
	}
	st.Extensions = extensions

	for i := range cfg.Apps {
		app := &cfg.Apps[i]
		if app.RuntimeMode() != config.RuntimePHP || !app.IsEnabled() {
			continue
		}
		socket := filepath.Join(socketDir(cfg), app.Domain+".sock")
		ps := PoolStatus{App: app.Domain, Socket: socket, MaxChildren: app.PHP.MaxChildrenOrDefault()}
		conn, err := net.DialTimeout("unix", socket, 2*time.Second)
		if err != nil {
			ps.Error = err.Error()
		} else {
			ps.Up = true
			_ = conn.Close()
		}
		st.Pools = append(st.Pools, ps)
	}
	return st
}

// PoolUp reports whether one app's pool socket accepts a connection. The apply
// path uses it to decide whether an app may be rendered at all: a pool that is
// down must disable the app, because falling back to the static handler would
// serve index.php as text and publish the application's credentials.
func PoolUp(cfg *config.Config, domain string) bool {
	conn, err := net.DialTimeout("unix", filepath.Join(socketDir(cfg), domain+".sock"), 2*time.Second)
	if err != nil {
		return false
	}
	_ = conn.Close()
	return true
}

// WaitForPools blocks until every enabled app's pool socket accepts a
// connection, or the deadline passes.
//
// Pool files are written by this daemon but php-fpm is reloaded by whoever owns
// the privileged signal, so there is a gap between "pool written" and "socket
// listening". Without this wait the nginx apply that follows would see every
// pool down and quarantine every app — correct behaviour, but it would take a
// reconcile cycle to heal something that is only a startup race.
func WaitForPools(ctx context.Context, cfg *config.Config, timeout time.Duration) bool {
	if !cfg.PHP.Enabled {
		return true
	}
	wanted := make([]string, 0, len(cfg.Apps))
	for i := range cfg.Apps {
		a := &cfg.Apps[i]
		if a.IsEnabled() && a.RuntimeMode() == config.RuntimePHP {
			wanted = append(wanted, a.Domain)
		}
	}
	if len(wanted) == 0 {
		return true
	}

	deadline := time.Now().Add(timeout)
	for {
		allUp := true
		for _, d := range wanted {
			if !PoolUp(cfg, d) {
				allUp = false
				break
			}
		}
		if allUp {
			return true
		}
		if time.Now().After(deadline) {
			return false
		}
		select {
		case <-ctx.Done():
			return false
		case <-time.After(500 * time.Millisecond):
		}
	}
}

func dedupe(in []string) []string {
	if len(in) == 0 {
		return nil
	}
	out := in[:1]
	for _, v := range in[1:] {
		if v != out[len(out)-1] {
			out = append(out, v)
		}
	}
	return out
}
