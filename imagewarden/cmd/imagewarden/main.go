package main

import (
	"fmt"
	"log/slog"
	"os"
	"strings"
)

// version is injected at build time via -ldflags "-X main.version=...".
var version = "dev"

const usage = `imagewarden — local image content classification REST API

Usage:
  imagewarden [run] [flags]          run the API server (default)
  imagewarden validate [flags]       config + model load + self-test inference
  imagewarden classify <file...>     one-shot local classification, JSON to stdout
  imagewarden schema                 print the API schema JSON
  imagewarden healthcheck [--url U]   GET /healthz, exit 0/1 (Docker HEALTHCHECK helper)
  imagewarden version                print build info

Common flags:
  --config PATH        config file (default /etc/imagewarden/config.yml)
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
	case "classify":
		code = cmdClassify(args)
	case "schema":
		code = cmdSchema(args)
	case "healthcheck":
		code = cmdHealthcheck(args)
	case "version":
		fmt.Printf("imagewarden %s\n", version)
	case "help", "--help", "-h":
		fmt.Print(usage)
	default:
		fmt.Fprintf(os.Stderr, "unknown subcommand %q\n\n%s", sub, usage)
		code = 2
	}
	os.Exit(code)
}

// newLogger builds the slog logger: JSON (JSONHandler) by default so every
// imagewarden log line is machine-parseable; logfmt (TextHandler) remains
// available via --log-format for interactive terminal use.
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
