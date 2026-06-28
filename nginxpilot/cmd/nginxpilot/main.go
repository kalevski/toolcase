// Command nginxpilot is a daemon that keeps directories of static
// files in sync with remote sources (git repositories or HTTP zip archives)
// for nginx to serve. See the design spec in the repository root.
package main

import (
	"flag"
	"fmt"
	"log/slog"
	"os"
	"strings"
)

// version is injected at build time via -ldflags "-X main.version=...".
var version = "dev"

const usage = `nginxpilot — keep nginx static site directories in sync with remote sources

Usage:
  nginxpilot [run] [flags]         run the daemon (default)
  nginxpilot validate [flags]      parse + validate the merged config (managed mode also runs nginx -t)
  nginxpilot sync <domain> [flags] one-shot sync for one site
  nginxpilot print-vhost <domain>  print an nginx snippet (static site or reverse proxy)
  nginxpilot print-include         print the nginx.conf include snippet for managed mode
  nginxpilot status [--json]       show per-site status from the daemon
  nginxpilot version               print build info

Common flags:
  --config PATH        config file (default /etc/nginxpilot/config.yml)
  --log-format FORMAT  logfmt | json (default logfmt)

Run flags:
  --prune-orphans      delete on-disk content for sites no longer in config
`

func main() {
	args := os.Args[1:]
	sub := "run"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		sub = args[0]
		args = args[1:]
	}

	var code int
	switch sub {
	case "run":
		code = cmdRun(args)
	case "validate":
		code = cmdValidate(args)
	case "sync":
		code = cmdSync(args)
	case "print-vhost":
		code = cmdPrintVhost(args)
	case "print-include":
		code = cmdPrintInclude(args)
	case "status":
		code = cmdStatus(args)
	case "version":
		fmt.Printf("nginxpilot %s\n", version)
	case "help", "--help", "-h":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand %q\n\n%s", sub, usage)
		code = 2
	}
	os.Exit(code)
}

// parseWithPositional parses a flag set that takes exactly one positional
// argument, accepting flags before or after it (Go's flag package stops at
// the first non-flag argument on its own).
func parseWithPositional(fs *flag.FlagSet, args []string, usage string) (string, bool) {
	_ = fs.Parse(args)
	rest := fs.Args()
	if len(rest) == 0 {
		fmt.Fprintln(os.Stderr, usage)
		return "", false
	}
	positional := rest[0]
	_ = fs.Parse(rest[1:])
	if fs.NArg() != 0 {
		fmt.Fprintln(os.Stderr, usage)
		return "", false
	}
	return positional, true
}

// newLogger builds the slog logger: logfmt (TextHandler) by default,
// JSON for shippers (spec Q25).
func newLogger(format, level string) *slog.Logger {
	var lvl slog.Level
	switch level {
	case "debug":
		lvl = slog.LevelDebug
	case "warn":
		lvl = slog.LevelWarn
	case "error":
		lvl = slog.LevelError
	default:
		lvl = slog.LevelInfo
	}
	opts := &slog.HandlerOptions{Level: lvl}
	var handler slog.Handler
	if format == "json" {
		handler = slog.NewJSONHandler(os.Stdout, opts)
	} else {
		handler = slog.NewTextHandler(os.Stdout, opts)
	}
	return slog.New(handler)
}
