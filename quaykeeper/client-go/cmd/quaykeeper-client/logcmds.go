package main

import (
	"bufio"
	"context"
	"flag"
	"io"
	"log/slog"
	"os"
	"os/exec"
	"os/signal"
	"strings"
	"sync"
	"syscall"
	"time"

	quaykeeper "github.com/kalevski/quaykeeper-client"
	"github.com/kalevski/quaykeeper-client/internal/tail"
)

// maxLine caps a captured line (G23): a longer line is truncated so a pathological
// app can't allocate unbounded memory or blow a syslog/Loki entry.
const maxLine = 256 * 1024

// stderrLogger is the client's structured logger for the shipping core.
func stderrLogger() *slog.Logger {
	return slog.New(slog.NewTextHandler(os.Stderr, &slog.HandlerOptions{Level: slog.LevelInfo}))
}

// stringSlice is a repeatable string flag (e.g. --parse … --parse …).
type stringSlice []string

func (s *stringSlice) String() string     { return strings.Join(*s, ", ") }
func (s *stringSlice) Set(v string) error { *s = append(*s, v); return nil }

// startShipping builds a pipeline (shipper + parse templates), primes it from the
// first snapshot, and keeps destinations AND templates hot-reloaded via Watch (a
// filter/destination/parse change in Quaykeeper propagates within one poll — no
// restart, §5.2). `primeErr` is the first-fetch error, which the caller decides how
// to treat (fatal for `run`, which needs the env; non-fatal for `logs`).
func startShipping(
	ctx context.Context,
	c *quaykeeper.Client,
	log *slog.Logger,
	interval time.Duration,
	raw bool,
	parseTemplates []string,
) (p *quaykeeper.LogPipeline, snap quaykeeper.Snapshot, primeErr error) {
	p, err := quaykeeper.NewLogPipeline(log, raw, parseTemplates)
	if err != nil {
		die("parse template: " + err.Error()) // operator-typed flag — fail fast
	}
	snap, _, primeErr = c.FetchConfig(ctx)
	if primeErr == nil {
		p.Apply(snap.Logs, snap.Env)
	}
	go func() {
		_ = c.Watch(ctx, interval, func(s quaykeeper.Snapshot) {
			p.Apply(s.Logs, s.Env)
		})
	}()
	return p, snap, primeErr
}

// ── logs: tail files and ship them ─────────────────────────────────────────────

func cmdLogs(args []string) {
	fs := flag.NewFlagSet("logs", flag.ExitOnError)
	file := fs.String("file", "", "comma-separated file globs to tail (e.g. /var/log/app/*.log)")
	format := fs.String("format", "json", "line format: json (parse structured fields) | raw (opaque text)")
	stateDir := fs.String("state-dir", defaultStateDir(), "directory for rotation-safe tail offsets")
	interval := fs.Duration("interval", 30*time.Second, "config poll interval (hot-reload of destinations)")
	fromStart := fs.Bool("from-start", false, "tail matched files from the beginning (default: from end)")
	var parse stringSlice
	fs.Var(&parse, "parse", "parse template for plain-text lines, e.g. '{level} | {time} - {message}' (repeatable)")
	_ = fs.Parse(args)

	globs := splitList(*file)
	if len(globs) == 0 {
		die("logs: --file <glob>[,<glob>...] is required")
	}
	if *format != "json" && *format != "raw" {
		die("logs: --format must be json or raw")
	}

	log := stderrLogger()
	ctx, stop := signal.NotifyContext(context.Background(), syscall.SIGINT, syscall.SIGTERM)
	defer stop()

	c := quaykeeper.New(quaykeeper.FromEnv())
	pipeline, _, primeErr := startShipping(ctx, c, log, *interval, *format == "raw", parse)
	if primeErr != nil {
		// Non-fatal: shipping is never load-bearing. Watch will populate destinations
		// once the config API is reachable; until then lines are read and dropped.
		log.Warn("initial config fetch failed; shipping starts once reachable", "error", primeErr)
	}
	defer pipeline.Close()

	tailer, err := tail.New(tail.Options{Globs: globs, StateDir: *stateDir, FromStart: *fromStart})
	if err != nil {
		die("logs: " + err.Error())
	}
	log.Info("tailing", "globs", strings.Join(globs, ","), "state_dir", *stateDir)
	_ = tailer.Run(ctx, func(_ string, line []byte) { pipeline.Ingest(line, "") })
}

// ── run: supervise a child, capture + ship its stdout/stderr ────────────────────

func cmdRun(args []string) {
	sep := -1
	for i, a := range args {
		if a == "--" {
			sep = i
			break
		}
	}
	if sep < 0 || sep+1 >= len(args) {
		die("usage: quaykeeper-client run [--interval 30s] -- <command> [args...]")
	}
	fs := flag.NewFlagSet("run", flag.ExitOnError)
	interval := fs.Duration("interval", 30*time.Second, "config poll interval (hot-reload of destinations)")
	var parse stringSlice
	fs.Var(&parse, "parse", "parse template for plain-text lines, e.g. '{level} | {time} - {message}' (repeatable)")
	_ = fs.Parse(args[:sep])
	cmdArgs := args[sep+1:]

	log := stderrLogger()
	c := quaykeeper.New(quaykeeper.FromEnv())

	// Reap orphaned children (G23): as PID 1 the supervisor must wait4 re-parented
	// zombies AND the child itself. Install the SIGCHLD handler BEFORE Start so an
	// instant-exiting child is never missed.
	sigchld := make(chan os.Signal, 8)
	signal.Notify(sigchld, syscall.SIGCHLD)

	// Fetch config once — fail closed, exactly like exec: the child needs its env,
	// so don't boot it with an empty environment.
	watchCtx, cancelWatch := context.WithCancel(context.Background())
	defer cancelWatch()
	pipeline, snap, primeErr := startShipping(watchCtx, c, log, *interval, false, parse)
	if primeErr != nil {
		die("fetch config: " + primeErr.Error())
	}
	defer pipeline.Close()

	// Pipe the child's stdout/stderr through us (NOT syscall.Exec — a PID-1 handoff
	// can't observe output). Own os.Pipe pair rather than cmd.StdoutPipe so we never
	// call cmd.Wait (the reaper owns child reaping).
	rOut, wOut, err := os.Pipe()
	if err != nil {
		die("pipe: " + err.Error())
	}
	rErr, wErr, err := os.Pipe()
	if err != nil {
		die("pipe: " + err.Error())
	}
	child := exec.Command(cmdArgs[0], cmdArgs[1:]...)
	child.Env = mergeEnv(os.Environ(), snap.Env)
	child.Stdin = os.Stdin
	child.Stdout = wOut
	child.Stderr = wErr
	if err := child.Start(); err != nil {
		die("run " + cmdArgs[0] + ": " + err.Error())
	}
	// The child holds its own dup of the write ends; drop ours so our readers see
	// EOF exactly when the child (and its stdout-inheriting descendants) exit.
	wOut.Close()
	wErr.Close()

	var wg sync.WaitGroup
	wg.Add(2)
	go func() { defer wg.Done(); pump(rOut, os.Stdout, "stdout", pipeline.Ingest) }()
	go func() { defer wg.Done(); pump(rErr, os.Stderr, "stderr", pipeline.Ingest) }()

	// Forward the usual termination/reconfig signals to the child (never SIGCHLD).
	fwd := make(chan os.Signal, 8)
	signal.Notify(fwd, syscall.SIGINT, syscall.SIGTERM, syscall.SIGHUP, syscall.SIGQUIT, syscall.SIGUSR1, syscall.SIGUSR2)
	go func() {
		for s := range fwd {
			_ = child.Process.Signal(s)
		}
	}()

	exitCode := reapUntil(child.Process.Pid, sigchld)

	// Child gone: stop polling, let the pipe readers drain to EOF, flush buffers.
	cancelWatch()
	wg.Wait()
	signal.Stop(fwd)
	pipeline.Close()
	os.Exit(exitCode)
}

// reapUntil waits for the main child to exit while reaping any orphaned zombies
// re-parented to this process (PID 1). Returns the child's exit code (128+signal
// when killed by a signal). Coalesced SIGCHLDs are handled by draining Wait4 in a
// loop each wake-up.
func reapUntil(mainPID int, sigchld chan os.Signal) int {
	for range sigchld {
		for {
			var ws syscall.WaitStatus
			wpid, err := syscall.Wait4(-1, &ws, syscall.WNOHANG, nil)
			if err == syscall.EINTR {
				continue
			}
			if wpid <= 0 {
				break // 0 = no reapable child right now; -1 = ECHILD
			}
			if wpid == mainPID {
				signal.Stop(sigchld)
				return exitCodeOf(ws)
			}
		}
	}
	return 0
}

func exitCodeOf(ws syscall.WaitStatus) int {
	if ws.Signaled() {
		return 128 + int(ws.Signal())
	}
	return ws.ExitStatus()
}

// pump reads complete lines from r, tees each verbatim to the real fd (so
// `docker logs` / journald still see the app's output unchanged) and hands the
// line to ingest for parsing + shipping. A trailing partial line at EOF is still
// flushed (G23); an over-long line is truncated.
func pump(r io.Reader, tee io.Writer, stream string, ingest func(line []byte, stream string)) {
	br := bufio.NewReaderSize(r, 64*1024)
	for {
		chunk, err := br.ReadBytes('\n')
		if len(chunk) > 0 {
			line := chunk
			if line[len(line)-1] == '\n' {
				line = line[:len(line)-1]
			}
			if len(line) > maxLine {
				line = append(line[:maxLine:maxLine], []byte("…[truncated]")...)
			}
			teeLine := make([]byte, len(line)+1)
			copy(teeLine, line)
			teeLine[len(line)] = '\n'
			_, _ = tee.Write(teeLine)
			ingest(line, stream)
		}
		if err != nil {
			return
		}
	}
}

// defaultStateDir is the blessed tail-offset location (G24): a host agent uses
// /var/lib/quaykeeper-client; in a container that path is writable too, and an
// operator can override with --state-dir.
func defaultStateDir() string {
	if d := os.Getenv("QUAYKEEPER_STATE_DIR"); d != "" {
		return d
	}
	return "/var/lib/quaykeeper-client"
}

func splitList(s string) []string {
	var out []string
	for _, p := range strings.Split(s, ",") {
		if t := strings.TrimSpace(p); t != "" {
			out = append(out, t)
		}
	}
	return out
}
