package main

import (
	"context"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"time"

	"github.com/kalevski/toolcase/imagewarden/internal/config"
)

// modelBlock is the "model" object of a verdict line. It mirrors — field for
// field, tag for tag — the api package's classifyResp/modelBlock (spec §5), so
// `imagewarden classify` and `POST /v1/classify` emit byte-identical verdict
// shapes. The api types are unexported, so the shape is duplicated here rather
// than imported; keep the three in sync.
type modelBlock struct {
	Name         string `json:"name"`
	Version      string `json:"version"`
	Quantization string `json:"quantization"`
}

// verdict mirrors the api package's classifyResp: the spec §5 verdict fields in
// the exact order and with the exact json tags the HTTP endpoint uses.
type verdict struct {
	Decision    string             `json:"decision"`
	UnsafeScore float32            `json:"unsafe_score"`
	Scores      map[string]float32 `json:"scores"`
	Model       modelBlock         `json:"model"`
	LatencyMs   int                `json:"latency_ms"`
}

// fileVerdict is one stdout JSONL line: the source filename followed by the
// §5 verdict fields (embedded, so they marshal inline after "file").
type fileVerdict struct {
	File string `json:"file"`
	verdict
}

// fileError is one stderr JSONL line for a per-file failure. It mirrors the API
// {"error","detail"} envelope (errors.go) and adds a "file" key first so a
// caller aggregating over a directory can correlate the failure to its input.
type fileError struct {
	File   string `json:"file"`
	Error  string `json:"error"`  // stage that failed: "read" | "classify"
	Detail string `json:"detail"` // human-readable cause
}

// cmdClassify implements `imagewarden classify <file...>` (spec §7): the
// offline, server-less classification path. It loads the same config and model
// as `run`, wires the same classify.Service via buildService (so policy
// thresholds and pixel/queue limits shape the verdict identically), then
// classifies each file, printing one JSON verdict per line to stdout.
//
// Output is JSONL — exactly one JSON object per line, successes to stdout and
// failures to stderr — so it pipes and aggregates cleanly over a labeled
// sample dir for accuracy/threshold tuning (spec §11):
//
//	imagewarden classify sample/*.jpg | jq -r '[.file, .decision] | @tsv'
//
// A per-file read/decode error is reported and skipped rather than aborting the
// run; the process exit code is non-zero if any file failed (partial success is
// still a failure), so it doubles as an operator smoke test.
func cmdClassify(args []string) int {
	fs := flag.NewFlagSet("classify", flag.ExitOnError)
	configPath := fs.String("config", config.DefaultPath, "config file path")
	logFormat := fs.String("log-format", "json", "logfmt | json")
	_ = fs.Parse(args)

	files := fs.Args() // positional file paths
	if len(files) == 0 {
		fmt.Fprintln(os.Stderr, "usage: imagewarden classify [--config PATH] [--log-format FORMAT] <file...>")
		fmt.Fprintln(os.Stderr, "  classifies local files with no server; prints one JSON verdict per line")
		fmt.Fprintln(os.Stderr, "  (JSONL) to stdout, one JSON error per line to stderr; exits non-zero if")
		fmt.Fprintln(os.Stderr, "  any file failed. Pipe over a labeled dir for accuracy/threshold tuning.")
		return 2
	}

	res, err := config.Load(*configPath)
	if err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return 1
	}
	cfg := res.Config
	if err := cfg.Validate(); err != nil {
		fmt.Fprintf(os.Stderr, "config error: %v\n", err)
		return 1
	}

	// Warnings and logs go to stderr so stdout stays pure JSONL. Log at error
	// level: model.Load emits an info line on success (suppressed here) and
	// returns bootstrap failures as errors (surfaced below), so nothing pollutes
	// the machine-readable stream.
	for _, w := range res.Warnings {
		fmt.Fprintf(os.Stderr, "warning: %s\n", w)
	}
	for _, o := range res.EnvOverrides {
		fmt.Fprintf(os.Stderr, "env override: %s\n", o)
	}
	log := newLogger(*logFormat, "error")

	// Same wiring as `run`: load + verify + warm up the model, build the service.
	// A bootstrap failure is fatal and non-zero (needs CGO / libonnxruntime.so).
	m, svc, err := buildService(cfg, log)
	if err != nil {
		fmt.Fprintf(os.Stderr, "model load: %v\n", err)
		return 1
	}
	defer func() { _ = m.Close() }()

	enc := json.NewEncoder(os.Stdout)    // one Encode == one line == one JSONL record
	errEnc := json.NewEncoder(os.Stderr) // per-file failures, correlatable by "file"
	info := m.Info()

	exit := 0
	for _, path := range files {
		data, rerr := os.ReadFile(path)
		if rerr != nil {
			_ = errEnc.Encode(fileError{File: path, Error: "read", Detail: rerr.Error()})
			exit = 1
			continue
		}

		start := time.Now()
		v, cerr := svc.Do(context.Background(), data)
		if cerr != nil {
			// Never surface the image bytes — only the error (spec §8).
			_ = errEnc.Encode(fileError{File: path, Error: "classify", Detail: cerr.Error()})
			exit = 1
			continue
		}

		_ = enc.Encode(fileVerdict{
			File: path,
			verdict: verdict{
				Decision:    string(v.Decision),
				UnsafeScore: float32(v.UnsafeScore),
				Scores:      v.Scores,
				Model: modelBlock{
					Name:         info.Name,
					Version:      info.Version,
					Quantization: info.Quantization,
				},
				LatencyMs: int(time.Since(start).Milliseconds()),
			},
		})
	}
	return exit
}
