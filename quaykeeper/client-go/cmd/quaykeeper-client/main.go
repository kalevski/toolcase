// quaykeeper-client — fetches resolved config from a Quaykeeper instance-fetch API and
// either injects it as env (exec), materializes it to a file (write), or
// serves it on a loopback endpoint (serve). move_wharf_to_perch.md §9. Usable
// as a container entrypoint or downloaded at boot via the fetch API's
// install.sh bootstrap.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"net"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	quaykeeper "github.com/kalevski/quaykeeper-client"
)

// version is stamped at build time via -ldflags "-X main.version=...".
var version = "dev"

func main() {
	if len(os.Args) < 2 {
		usage()
		os.Exit(2)
	}
	switch os.Args[1] {
	case "exec":
		cmdExec(os.Args[2:])
	case "write":
		cmdWrite(os.Args[2:])
	case "serve":
		cmdServe(os.Args[2:])
	case "version", "--version", "-v":
		fmt.Println("quaykeeper-client", version)
	case "help", "--help", "-h":
		usage()
	default:
		fmt.Fprintln(os.Stderr, "unknown subcommand:", os.Args[1])
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `quaykeeper-client `+version+`

Usage:
  quaykeeper-client exec -- <command> [args...]      fetch config, inject as env, exec the process (PID-1 handoff)
  quaykeeper-client write --format json|dotenv --out <path>   materialize config to a file
  quaykeeper-client serve [--addr 127.0.0.1:9000] [--interval 30s]   poll + serve config on a loopback endpoint
  quaykeeper-client version

serve has NO authentication and exposes fully-resolved secrets; it refuses a
non-loopback --addr unless --allow-remote is set explicitly.

Connection (env vars, or via FromEnv):
  QUAYKEEPER_URL        agent-server base URL (the admin "Instance config URL" setting)
  QUAYKEEPER_INSTANCE   the instance name
  QUAYKEEPER_SECRET     the per-instance fetch secret
`)
}

func die(msg string) {
	fmt.Fprintln(os.Stderr, "quaykeeper-client: "+msg)
	os.Exit(1)
}

// mergeEnv overlays fetched config onto the current environment (fetched wins).
func mergeEnv(base []string, add map[string]string) []string {
	idx := map[string]int{}
	out := make([]string, len(base))
	copy(out, base)
	for i, kv := range out {
		if eq := strings.IndexByte(kv, '='); eq >= 0 {
			idx[kv[:eq]] = i
		}
	}
	keys := make([]string, 0, len(add))
	for k := range add {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	for _, k := range keys {
		entry := k + "=" + add[k]
		if i, ok := idx[k]; ok {
			out[i] = entry
		} else {
			out = append(out, entry)
		}
	}
	return out
}

// ── exec: fetch once, inject, hand off (12-factor entrypoint) ──────────────────

func cmdExec(args []string) {
	sep := -1
	for i, a := range args {
		if a == "--" {
			sep = i
			break
		}
	}
	if sep < 0 || sep+1 >= len(args) {
		die("usage: quaykeeper-client exec -- <command> [args...]")
	}
	cmd := args[sep+1:]

	c := quaykeeper.New(quaykeeper.FromEnv())
	env, err := c.FetchEnv(context.Background())
	if err != nil {
		die("fetch env: " + err.Error()) // fail closed — do not boot with empty config
	}
	path, err := exec.LookPath(cmd[0])
	if err != nil {
		die("lookup " + cmd[0] + ": " + err.Error())
	}
	if err := syscall.Exec(path, cmd, mergeEnv(os.Environ(), env)); err != nil {
		die("exec: " + err.Error())
	}
}

// ── write: fetch once, materialize to a file ───────────────────────────────────

func cmdWrite(args []string) {
	fs := flag.NewFlagSet("write", flag.ExitOnError)
	format := fs.String("format", "dotenv", "output format: json | dotenv")
	out := fs.String("out", "", "output file path (required)")
	_ = fs.Parse(args)
	if *out == "" {
		die("write: --out <path> is required")
	}

	c := quaykeeper.New(quaykeeper.FromEnv())
	env, err := c.FetchEnv(context.Background())
	if err != nil {
		die("fetch env: " + err.Error())
	}

	var data []byte
	switch *format {
	case "json":
		data, _ = json.MarshalIndent(env, "", "  ")
		data = append(data, '\n')
	case "dotenv":
		data = []byte(dotenv(env))
	default:
		die("write: --format must be json or dotenv")
	}
	if err := os.WriteFile(*out, data, 0o600); err != nil {
		die("write file: " + err.Error())
	}
}

func dotenv(env map[string]string) string {
	keys := make([]string, 0, len(env))
	for k := range env {
		keys = append(keys, k)
	}
	sort.Strings(keys)
	var b strings.Builder
	for _, k := range keys {
		v := env[k]
		if strings.ContainsAny(v, " \t\n\"#=") || v == "" {
			v = "\"" + strings.NewReplacer("\\", "\\\\", "\"", "\\\"", "\n", "\\n").Replace(v) + "\""
		}
		b.WriteString(k)
		b.WriteByte('=')
		b.WriteString(v)
		b.WriteByte('\n')
	}
	return b.String()
}

// isLoopbackAddr reports whether a listen address binds only to loopback
// ("127.0.0.1:9000", "[::1]:9000", "localhost:9000"). An empty or wildcard
// host binds every interface and is NOT loopback.
func isLoopbackAddr(addr string) bool {
	host, _, err := net.SplitHostPort(addr)
	if err != nil || host == "" {
		return false
	}
	if host == "localhost" {
		return true
	}
	ip := net.ParseIP(host)
	return ip != nil && ip.IsLoopback()
}

// ── serve: long-lived loopback sidecar; poll w/ ETag, serve current values ─────

func cmdServe(args []string) {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	addr := fs.String("addr", "127.0.0.1:9000", "loopback listen address")
	interval := fs.Duration("interval", 30*time.Second, "poll interval")
	allowRemote := fs.Bool("allow-remote", false, "permit a non-loopback --addr (the endpoint has NO auth — anyone who can reach it reads all resolved secrets)")
	_ = fs.Parse(args)

	// The sidecar serves fully-resolved secrets with no authentication; binding
	// beyond loopback publishes them to the network, so it must be an explicit,
	// flagged decision.
	if !*allowRemote && !isLoopbackAddr(*addr) {
		die("serve: --addr " + *addr + " is not loopback; the endpoint is unauthenticated. Use 127.0.0.1/[::1], or pass --allow-remote if you really mean it")
	}

	c := quaykeeper.New(quaykeeper.FromEnv())

	var mu sync.RWMutex
	var current quaykeeper.Snapshot

	// Prime once (fail closed if the very first fetch fails).
	first, _, err := c.FetchConfig(context.Background())
	if err != nil {
		die("initial fetch: " + err.Error())
	}
	current = first

	go func() {
		_ = c.Watch(context.Background(), *interval, func(s quaykeeper.Snapshot) {
			mu.Lock()
			current = s
			mu.Unlock()
		})
	}()

	writeJSON := func(w http.ResponseWriter, v any) {
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(v)
	}
	mux := http.NewServeMux()
	mux.HandleFunc("/env", func(w http.ResponseWriter, _ *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		writeJSON(w, current.Env)
	})
	mux.HandleFunc("/flags", func(w http.ResponseWriter, _ *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		writeJSON(w, current.Flags)
	})
	mux.HandleFunc("/config", func(w http.ResponseWriter, _ *http.Request) {
		mu.RLock()
		defer mu.RUnlock()
		writeJSON(w, current)
	})

	fmt.Fprintf(os.Stderr, "quaykeeper-client serve: listening on %s (poll %s)\n", *addr, *interval)
	srv := &http.Server{Addr: *addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	if err := srv.ListenAndServe(); err != nil {
		die("serve: " + err.Error())
	}
}
