// Command webmail is a web mail client for mailboxes hosted by the Mail app:
// one static binary with the SPA embedded, a JMAP gateway, SQLite sessions.
// See the README and new_apps.md Part 3.
package main

import (
	"fmt"
	"os"
	"runtime"
	"strings"
)

// version and commit are injected with -ldflags "-X main.version=... -X main.commit=...".
var (
	version = "dev"
	commit  = ""
)

const usage = `webmail - web mail client (JMAP gateway + SPA)

Usage:
  webmail [run]          serve the web app and API (default)
  webmail validate       check config, data dir, database and JMAP server; changes nothing
  webmail healthcheck    GET /_healthz on the local listen address (exit 0 or 1)
  webmail version        print build info

Configuration is environment-only (WEBMAIL_*); see the README for the table.
`

func main() {
	args := os.Args[1:]
	sub := "run"
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		sub, args = args[0], args[1:]
	}
	var code int
	switch sub {
	case "run":
		code = cmdRun(args)
	case "validate":
		code = cmdValidate(args)
	case "healthcheck":
		code = cmdHealthcheck(args)
	case "version":
		fmt.Printf("webmail %s (commit %s, %s)\n", version, orDash(commit), runtime.Version())
	case "help", "--help", "-h":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand %q\n\n%s", sub, usage)
		code = 2
	}
	os.Exit(code)
}

func orDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}
