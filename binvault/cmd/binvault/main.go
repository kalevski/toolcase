// Command binvault is an S3-compatible object store with before/after-save
// pipelines. A single static binary: pure-Go SQLite for metadata, plain files
// for blobs. See the repository README and binvault.md.
package main

import (
	"fmt"
	"os"
	"runtime"
	"slices"
	"strings"
)

// version and commit are injected at build time via
// -ldflags "-X main.version=... -X main.commit=...".
var (
	version = "dev"
	commit  = ""
)

const usage = `binvault — S3-compatible object store with pipelines

Usage:
  binvault [run]                 serve the S3 and admin APIs (default)
  binvault validate [--deep]     check config, secrets, database and data dir; changes nothing
  binvault healthcheck           GET /_healthz on the local listen address (exit 0 or 1)
  binvault rekey                 re-seal every sealed secret under the current master key
  binvault version               print build info

Configuration is environment-only (BINVAULT_*); see the README for the table.
`

// parseCommand splits the command line into the subcommand (run when there is none)
// and its arguments; a request for help anywhere makes the subcommand "help".
func parseCommand(args []string) (sub string, rest []string) {
	sub, rest = "run", args
	if len(args) > 0 && !strings.HasPrefix(args[0], "-") {
		sub, rest = args[0], args[1:]
	}
	if slices.ContainsFunc(rest, isHelp) {
		sub = "help" // binvault --help, binvault -h, binvault <command> -h
	}
	return sub, rest
}

func main() {
	sub, args := parseCommand(os.Args[1:])
	var code int
	switch sub {
	case "run":
		code = cmdRun(args)
	case "validate":
		code = cmdValidate(args)
	case "healthcheck":
		code = cmdHealthcheck(args)
	case "rekey":
		code = cmdRekey(args)
	case "version":
		fmt.Printf("binvault %s (commit %s, %s)\n", version, orDash(commit), runtime.Version())
	case "help":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand %q\n\n%s", sub, usage)
		code = 2
	}
	os.Exit(code)
}

// isHelp reports whether an argument asks for the usage.
func isHelp(a string) bool { return a == "-h" || a == "--help" || a == "-help" }

func orDash(s string) string {
	if s == "" {
		return "-"
	}
	return s
}
