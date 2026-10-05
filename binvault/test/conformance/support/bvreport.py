#!/usr/bin/env python3
"""Collect suite results and print the final table.

  bvreport.py run SUITE RESULTS_TSV LOG TIMES_FILE TIMEOUT_SECS [--quiet|--verbose] -- command...
                                                    run a suite script in its own process group, enforce the
                                                    timeout, append its output to LOG; lines of the form
                                                    @@RESULT<TAB>STATUS<TAB>case<TAB>detail are appended to
                                                    RESULTS_TSV (suite<TAB>status<TAB>case<TAB>detail) and
                                                    shown as a one-line progress entry
  bvreport.py summary RESULTS_TSV KNOWN_TSV [--quiet] [--times FILE]
                                                    final per-suite and per-case tables; exit status 1 when any
                                                    case FAILed that is not a known failure

known-failures.tsv: suite<TAB>case-glob<TAB>id<TAB>reason  ('#' comments). A FAIL that matches becomes XFAIL
(expected, does not fail the run); a PASS that matches becomes XPASS (printed as a reminder to delete the entry).
"""
import fnmatch
import os
import sys

STATUSES = ("PASS", "FAIL", "XFAIL", "XPASS", "SKIP")


def color(code, s):
    if sys.stdout.isatty() and not os.environ.get("NO_COLOR"):
        return "\033[%sm%s\033[0m" % (code, s)
    return s


COLORS = {"PASS": "32", "FAIL": "31;1", "XFAIL": "33", "XPASS": "36", "SKIP": "2"}


class Live:
    """Console progress: 'dots' (default) prints one character per PASS and a line per FAIL/SKIP,
    'all' prints every line, 'fail' prints failures only."""

    def __init__(self, mode, out):
        self.mode, self.out, self.mid = mode, out, False

    def _nl(self):
        if self.mid:
            self.out.write("\n")
            self.mid = False

    def result(self, status, case, detail):
        if self.mode == "dots" and status == "PASS":
            self.out.write(".")
            self.mid = True
        elif self.mode == "all" or status == "FAIL" or (self.mode == "dots" and status == "SKIP"):
            self._nl()
            tag = color(COLORS[status], "%-5s" % status)
            msg = "  %s %s" % (tag, case)
            if status != "PASS" and detail:
                msg += "  -- " + detail[:200]
            self.out.write(msg + "\n")
        self.out.flush()

    def text(self, line):
        if self.mode == "all" or line.startswith(("==>", "warning:", "error:")):
            self._nl()
            self.out.write(line + "\n")
            self.out.flush()

    def done(self):
        self._nl()
        self.out.flush()


def handle_line(suite, line, res, live, counts):
    if line.startswith("@@RESULT\t"):
        parts = line.split("\t", 3)
        while len(parts) < 4:
            parts.append("")
        _, status, case, detail = parts
        status = status.upper()
        if status not in ("PASS", "FAIL", "SKIP"):
            status, detail = "FAIL", "unknown status in result line: " + line
        res.write("\t".join((suite, status, case, detail)) + "\n")
        res.flush()
        counts[status] = counts.get(status, 0) + 1
        live.result(status, case, detail)
        return True
    live.text(line)
    return False


def run_suite(suite, results_path, log_path, timeout, mode, cmd):
    """Run cmd in its own process group, merge stdout+stderr, collect @@RESULT lines, enforce the timeout."""
    import selectors
    import signal
    import subprocess
    import time

    out = sys.stdout
    counts = {}
    live = Live(mode, out)
    t0 = time.time()
    proc = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL,
                            start_new_session=True)
    sel = selectors.DefaultSelector()
    sel.register(proc.stdout, selectors.EVENT_READ)
    deadline = t0 + timeout
    buf = b""
    timed_out = False
    with open(results_path, "a", encoding="utf-8") as res, open(log_path, "ab") as log:
        def feed(chunk, final=False):
            nonlocal buf
            buf += chunk
            while b"\n" in buf:
                raw, buf = buf.split(b"\n", 1)
                log.write(raw + b"\n")
                handle_line(suite, raw.decode("utf-8", "replace").rstrip("\r"), res, live, counts)
            if final and buf:
                log.write(buf + b"\n")
                handle_line(suite, buf.decode("utf-8", "replace").rstrip("\r"), res, live, counts)
                buf = b""
            log.flush()

        eof = False
        while not eof:
            left = deadline - time.time()
            if left <= 0:
                timed_out = True
                break
            for key, _ in sel.select(min(left, 1.0)):
                chunk = os.read(key.fd, 65536)
                if not chunk:
                    eof = True
                else:
                    feed(chunk)
        if timed_out:
            for sig in (signal.SIGTERM, signal.SIGKILL):
                try:
                    os.killpg(proc.pid, sig)
                except ProcessLookupError:
                    break
                time.sleep(2 if sig == signal.SIGTERM else 0)
            try:
                while True:
                    chunk = os.read(proc.stdout.fileno(), 65536)
                    if not chunk:
                        break
                    feed(chunk)
            except OSError:
                pass
        feed(b"", final=True)
        rc = proc.wait()
        # kill stragglers of the group (backgrounded children keep the pipe open otherwise)
        try:
            os.killpg(proc.pid, signal.SIGKILL)
        except (ProcessLookupError, PermissionError):
            pass
        problem = None
        if timed_out:
            problem = "suite timed out after %ds" % timeout
        elif rc != 0:
            problem = "suite runner exited with status %d (see the suite log)" % rc
        elif not counts:
            problem = "suite reported no results"
        if problem:
            res.write("\t".join((suite, "FAIL", "_runner", problem)) + "\n")
            live.result("FAIL", "_runner", problem)
        live.done()
        out.write("  %s: %s\n" % (suite, ", ".join("%d %s" % (counts[k], k.lower()) for k in ("PASS", "FAIL", "SKIP") if counts.get(k))))
    return time.time() - t0


def load_known(path):
    rules = []
    if not os.path.exists(path):
        return rules
    with open(path, encoding="utf-8") as f:
        for ln in f:
            ln = ln.rstrip("\n")
            if not ln.strip() or ln.lstrip().startswith("#"):
                continue
            parts = ln.split("\t")
            if len(parts) < 3:
                continue
            while len(parts) < 4:
                parts.append("")
            rules.append(tuple(parts[:4]))
    return rules


def match_known(rules, suite, case):
    for s, glob, ident, reason in rules:
        if fnmatch.fnmatchcase(suite, s) and fnmatch.fnmatchcase(case, glob):
            return ident, reason
    return None


def summary(results_path, known_path, quiet, times_path, order=()):
    rules = load_known(known_path)
    rows = []  # (suite, status, case, detail, known-id, reason)
    if os.path.exists(results_path):
        with open(results_path, encoding="utf-8") as f:
            for ln in f:
                p = ln.rstrip("\n").split("\t", 3)
                while len(p) < 4:
                    p.append("")
                suite, status, case, detail = p
                kid, reason = "", ""
                k = match_known(rules, suite, case)
                if k:
                    kid, reason = k
                    if status == "FAIL":
                        status = "XFAIL"
                    elif status == "PASS":
                        status = "XPASS"
                rows.append((suite, status, case, detail, kid, reason))

    times = {}
    if times_path and os.path.exists(times_path):
        with open(times_path, encoding="utf-8") as f:
            for ln in f:
                p = ln.split()
                if len(p) == 2:
                    times[p[0]] = p[1]

    suites = []
    for s in order:
        if s not in suites:
            suites.append(s)
    for r in rows:
        if r[0] not in suites:
            suites.append(r[0])
    for s in times:
        if s not in suites:
            suites.append(s)
    suites = [s for s in suites if any(r[0] == s for r in rows) or s in times]

    out = sys.stdout
    out.write("\n")
    if not quiet:
        out.write("=" * 78 + "\nPER-CASE RESULTS\n" + "=" * 78 + "\n")
        for s in suites:
            mine = [r for r in rows if r[0] == s]
            out.write("\n[%s]\n" % s)
            for _, status, case, detail, kid, reason in mine:
                tag = color(COLORS[status], "%-5s" % status)
                extra = ""
                if status in ("XFAIL", "XPASS"):
                    extra = "  [%s] %s" % (kid, reason)
                elif status in ("FAIL", "SKIP") and detail:
                    extra = "  -- " + detail[:160]
                out.write("  %s %s%s\n" % (tag, case, extra))

    out.write("\n" + "=" * 78 + "\nSUMMARY\n" + "=" * 78 + "\n")
    out.write("%-10s %6s %6s %6s %6s %6s %8s\n" % ("suite", "PASS", "FAIL", "XFAIL", "XPASS", "SKIP", "time"))
    tot = dict.fromkeys(STATUSES, 0)
    for s in suites:
        c = dict.fromkeys(STATUSES, 0)
        for r in rows:
            if r[0] == s:
                c[r[1]] += 1
        for k in STATUSES:
            tot[k] += c[k]
        line = "%-10s %6d %6d %6d %6d %6d %8s" % (s, c["PASS"], c["FAIL"], c["XFAIL"], c["XPASS"], c["SKIP"], times.get(s, "-"))
        out.write((color("31;1", line) if c["FAIL"] else line) + "\n")
    out.write("-" * 60 + "\n")
    out.write("%-10s %6d %6d %6d %6d %6d\n" % ("TOTAL", tot["PASS"], tot["FAIL"], tot["XFAIL"], tot["XPASS"], tot["SKIP"]))

    fails = [r for r in rows if r[1] == "FAIL"]
    xp = [r for r in rows if r[1] == "XPASS"]
    xf = [r for r in rows if r[1] == "XFAIL"]
    if fails:
        out.write("\nUNEXPECTED FAILURES (%d)\n" % len(fails))
        for suite, _, case, detail, _, _ in fails:
            out.write("  %s / %s\n      %s\n" % (suite, case, detail[:400]))
    if xf:
        out.write("\nKNOWN FAILURES (%d, tracked in known-failures.tsv)\n" % len(xf))
        for suite, _, case, detail, kid, reason in xf:
            out.write("  [%s] %s / %s -- %s\n" % (kid, suite, case, reason))
    if xp:
        out.write("\nKNOWN FAILURES THAT NOW PASS (%d): remove them from known-failures.tsv\n" % len(xp))
        for suite, _, case, _, kid, _ in xp:
            out.write("  [%s] %s / %s\n" % (kid, suite, case))
    out.flush()
    return 1 if fails else 0


def main():
    if len(sys.argv) < 2:
        sys.exit(__doc__)
    cmd = sys.argv[1]
    quiet = "--quiet" in sys.argv
    args = [a for a in sys.argv[2:] if a not in ("--quiet", "--verbose")]
    if cmd == "run":
        # run SUITE RESULTS LOG TIMES TIMEOUT [--quiet|--verbose] -- command...
        i = args.index("--")
        suite, results, log, times, timeout = args[:5]
        mode = "fail" if quiet else ("all" if "--verbose" in sys.argv else "dots")
        elapsed = run_suite(suite, results, log, int(timeout), mode, args[i + 1:])
        with open(times, "a") as f:
            f.write("%s %ds\n" % (suite, round(elapsed)))
    elif cmd == "summary":
        times = None
        if "--times" in args:
            i = args.index("--times")
            times = args[i + 1]
            del args[i:i + 2]
        order = []
        if "--order" in args:
            i = args.index("--order")
            order = [x for x in args[i + 1].split(",") if x]
            del args[i:i + 2]
        sys.exit(summary(args[0], args[1], quiet, times, order))
    else:
        sys.exit(__doc__)


if __name__ == "__main__":
    main()
