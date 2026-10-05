#!/usr/bin/env python3
"""Convert `go test -json` output on stdin into the harness protocol (@@RESULT lines on stdout).

One result per leaf test/subtest; a parent test is reported only when it failed or skipped by itself
(no failing child). Case ids: TestFooBar/sub_case -> foo_bar/sub_case. Anything that is not a JSON
event is passed through unchanged (build errors, panics).
"""
import json
import re
import sys

CAMEL = re.compile(r"(?<=[a-z0-9])(?=[A-Z])")


def case_id(name):
    parts = name.split("/")
    first = parts[0]
    if first.startswith("Test"):
        first = first[4:]
    first = CAMEL.sub("_", first).lower()
    return "/".join([first] + [p.lower() for p in parts[1:]])


def clean_output(lines):
    keep = []
    for ln in lines:
        s = ln.rstrip("\n")
        t = s.strip()
        if not t or t.startswith(("=== RUN", "=== PAUSE", "=== CONT", "--- PASS", "--- FAIL", "--- SKIP", "=== NAME")):
            continue
        if t in ("PASS", "FAIL"):
            continue
        keep.append(t)
    return keep


def emit(status, name, detail=""):
    detail = " | ".join(detail.split("\n")) if detail else ""
    detail = detail.replace("\t", " ")[:600]
    sys.stdout.write("@@RESULT\t%s\t%s\t%s\n" % (status, case_id(name), detail))
    sys.stdout.flush()


def main():
    out = {}         # test -> list of output lines
    children = {}    # parent -> set(children)
    failed_child = set()
    done = set()
    started = []
    pkg_failed = False
    any_fail = False
    pkg_out = []
    for raw in sys.stdin:
        raw = raw.rstrip("\n")
        try:
            ev = json.loads(raw)
        except ValueError:
            sys.stdout.write(raw + "\n")
            pkg_out.append(raw)
            continue
        action, test = ev.get("Action"), ev.get("Test")
        if not test:
            if action == "output":
                pkg_out.append(ev.get("Output", "").rstrip("\n"))
                sys.stdout.write(ev.get("Output", ""))
            elif action == "fail":
                pkg_failed = True
            elif action in ("build-output",):
                sys.stdout.write(ev.get("Output", ""))
                pkg_out.append(ev.get("Output", "").rstrip("\n"))
            continue
        if action in ("run", "start"):
            started.append(test)
            out.setdefault(test, [])
            if "/" in test:
                children.setdefault(test.rsplit("/", 1)[0], set()).add(test)
        elif action == "output":
            out.setdefault(test, []).append(ev.get("Output", ""))
        elif action in ("pass", "fail", "skip"):
            done.add(test)
            kids = children.get(test, set())
            if action == "fail":
                if "/" in test:
                    pass
                if not any(k in failed_child for k in kids):
                    emit("FAIL", test, " ".join(clean_output(out.get(test, []))[:4]))
                    any_fail = True
                failed_child.add(test)
            elif action == "skip":
                if not kids:
                    emit("SKIP", test, " ".join(clean_output(out.get(test, []))[:2]))
            else:  # pass
                if not kids:
                    emit("PASS", test)
    # tests that never finished (panic, timeout, os.Exit)
    for t in started:
        if t not in done and not children.get(t):
            emit("FAIL", t, "no result: the test binary crashed, hit the timeout or exited")
            any_fail = True
    if pkg_failed and not any_fail:
        tail = [l for l in pkg_out if l.strip()][-6:]
        sys.stdout.write("@@RESULT\tFAIL\t_package\t%s\n" % (" | ".join(x.strip() for x in tail)[:600].replace("\t", " ")))
    sys.stdout.flush()


if __name__ == "__main__":
    main()
