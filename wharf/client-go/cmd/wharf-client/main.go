// wharf-client — fetches resolved config from a Wharf Agent API and either
// injects it as env (exec), materializes it to a file (write), or serves it on a
// loopback endpoint (serve). Planning §6. Usable as a container entrypoint or
// downloaded at boot via the Agent's install.sh bootstrap.
package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"sort"
	"strings"
	"sync"
	"syscall"
	"time"

	wharf "github.com/kalevski/wharf-client"
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
		fmt.Println("wharf-client", version)
	case "help", "--help", "-h":
		usage()
	default:
		fmt.Fprintln(os.Stderr, "unknown subcommand:", os.Args[1])
		usage()
		os.Exit(2)
	}
}

func usage() {
	fmt.Fprint(os.Stderr, `wharf-client `+version+`

Usage:
  wharf-client exec -- <command> [args...]      fetch config, inject as env, exec the process (PID-1 handoff)
  wharf-client write --format json|dotenv --out <path>   materialize config to a file
  wharf-client serve [--addr 127.0.0.1:9000] [--interval 30s]   poll + serve config on a loopback endpoint
  wharf-client version

Connection (env vars, or via FromEnv):
  WHARF_URL           Agent-API base URL (e.g. http://wharf-agent:4000)
  WHARF_ENVIRONMENT   the instance's environment name
  WHARF_INSTANCE_ID   the instance id
  WHARF_SECRET        the per-instance fetch secret
`)
}

func die(msg string) {
	fmt.Fprintln(os.Stderr, "wharf-client: "+msg)
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
		die("usage: wharf-client exec -- <command> [args...]")
	}
	cmd := args[sep+1:]

	c := wharf.New(wharf.FromEnv())
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

	c := wharf.New(wharf.FromEnv())
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

// ── serve: long-lived loopback sidecar; poll w/ ETag, serve current values ─────

func cmdServe(args []string) {
	fs := flag.NewFlagSet("serve", flag.ExitOnError)
	addr := fs.String("addr", "127.0.0.1:9000", "loopback listen address")
	interval := fs.Duration("interval", 30*time.Second, "poll interval")
	_ = fs.Parse(args)

	c := wharf.New(wharf.FromEnv())

	var mu sync.RWMutex
	var current wharf.Snapshot

	// Prime once (fail closed if the very first fetch fails).
	first, _, err := c.FetchConfig(context.Background())
	if err != nil {
		die("initial fetch: " + err.Error())
	}
	current = first

	go func() {
		_ = c.Watch(context.Background(), *interval, func(s wharf.Snapshot) {
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

	fmt.Fprintf(os.Stderr, "wharf-client serve: listening on %s (poll %s)\n", *addr, *interval)
	srv := &http.Server{Addr: *addr, Handler: mux, ReadHeaderTimeout: 5 * time.Second}
	if err := srv.ListenAndServe(); err != nil {
		die("serve: " + err.Error())
	}
}
