// Command zonewright is a small daemon that owns a set of authoritative zones
// for BIND 9: it renders zone files and the named.conf zone list from YAML
// config (or its HTTP API), gates every change through named-checkzone /
// named-checkconf, and reloads named. Sibling of nginxpilot.
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

const usage = `zonewright — manage BIND 9 zones and records over an HTTP API

Usage:
  zonewright [run] [flags]          run the daemon (default)
  zonewright validate [flags]       parse + validate the merged config, then named-checkzone every zone
  zonewright print-zone <zone>      print the rendered zone file
  zonewright print-include          print the named.conf zone list
  zonewright status [--json]        show per-zone (and cluster) status from the daemon
  zonewright backup <file>          consistent online copy of the replicated store
  zonewright version                print build info

Common flags:
  --config PATH        config file (default /etc/zonewright/config.yml)
  --log-format FORMAT  logfmt | json (default json)
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
	case "print-zone":
		code = cmdPrintZone(args)
	case "print-include":
		code = cmdPrintInclude(args)
	case "status":
		code = cmdStatus(args)
	case "backup":
		code = cmdBackup(args)
	case "version":
		fmt.Printf("zonewright %s\n", version)
	case "help", "--help", "-h":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand %q\n\n%s", sub, usage)
		code = 2
	}
	os.Exit(code)
}

// parseWithPositional parses a flag set that takes exactly one positional
// argument, accepting flags before or after it.
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

// newLogger builds the slog logger: JSON by default so every line is
// machine-parseable; logfmt via --log-format for interactive use.
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
	if format == "json" {
		return slog.New(slog.NewJSONHandler(os.Stdout, opts))
	}
	return slog.New(slog.NewTextHandler(os.Stdout, opts))
}
