#!/usr/bin/env bash
# support/common.sh - helpers shared by run.sh and every suite script.
# Source it; it targets bash 3.2 (the macOS default) and Linux alike.
#
# Result protocol: a suite reports each case as one stdout line
#     @@RESULT<TAB>STATUS<TAB>case-id<TAB>detail
# with STATUS one of PASS, FAIL, SKIP. run.sh collects those lines (support/bvreport.py);
# known failures (known-failures.tsv) are re-labelled XFAIL/XPASS there, not in the suites.

if [ -n "${BV_COMMON_LOADED:-}" ]; then return 0; fi
BV_COMMON_LOADED=1

BV_SUPPORT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
BV_CONF_DIR="$(cd "$BV_SUPPORT_DIR/.." && pwd -P)"
BV_TEST_DIR="$(cd "$BV_CONF_DIR/.." && pwd -P)"
BV_REPO_DIR="$(cd "$BV_TEST_DIR/.." && pwd -P)"
export BV_SUPPORT_DIR BV_CONF_DIR BV_TEST_DIR BV_REPO_DIR

# ---------------------------------------------------------------------------
# logging

if [ -t 2 ]; then
    BV_C_RED=$'\033[31m'; BV_C_GREEN=$'\033[32m'; BV_C_YELLOW=$'\033[33m'; BV_C_DIM=$'\033[2m'; BV_C_OFF=$'\033[0m'
else
    BV_C_RED=''; BV_C_GREEN=''; BV_C_YELLOW=''; BV_C_DIM=''; BV_C_OFF=''
fi

bv_log()  { printf '%s\n' "$*" >&2; }
bv_info() { printf '==> %s\n' "$*" >&2; }
bv_warn() { printf '%swarning:%s %s\n' "$BV_C_YELLOW" "$BV_C_OFF" "$*" >&2; }
bv_die()  { printf '%serror:%s %s\n' "$BV_C_RED" "$BV_C_OFF" "$*" >&2; exit 1; }

bv_have() { command -v "$1" >/dev/null 2>&1; }

# ---------------------------------------------------------------------------
# results (stdout protocol)

bv__clean() { # one line, no tabs, at most 700 bytes
    printf '%s' "$*" | tr '\t\r\n' '   ' | head -c 700
}

bv_result() { # STATUS CASE [DETAIL]
    printf '@@RESULT\t%s\t%s\t%s\n' "$1" "$(bv__clean "$2")" "$(bv__clean "${3:-}")"
}
bv_pass() { bv_result PASS "$1" "${2:-}"; }
bv_fail() { bv_result FAIL "$1" "${2:-}"; }
bv_skip() { bv_result SKIP "$1" "${2:-}"; }

# bv_run CASE cmd args...   PASS when the command exits 0, FAIL otherwise.
# Output is left in $BV_OUT and the exit status in $BV_RC. Always returns 0.
bv_run() {
    local name="$1"; shift
    BV_OUT="$("$@" 2>&1)"; BV_RC=$?
    if [ "$BV_RC" -eq 0 ]; then
        bv_pass "$name"
    else
        bv_fail "$name" "exit $BV_RC: $(printf '%s' "$BV_OUT" | tail -n 4)"
    fi
    return 0
}

# bv_run_fails CASE PATTERN cmd args...  PASS when the command exits non-zero and its output matches
# the extended regex PATTERN (use '.' to accept any output).
bv_run_fails() {
    local name="$1" pat="$2"; shift 2
    BV_OUT="$("$@" 2>&1)"; BV_RC=$?
    if [ "$BV_RC" -eq 0 ]; then
        bv_fail "$name" "expected failure, command succeeded: $(printf '%s' "$BV_OUT" | tail -n 3)"
    elif printf '%s' "$BV_OUT" | grep -Eq -- "$pat"; then
        bv_pass "$name"
    else
        bv_fail "$name" "failed (exit $BV_RC) but output does not match /$pat/: $(printf '%s' "$BV_OUT" | tail -n 4)"
    fi
    return 0
}

bv_eq() { # CASE EXPECTED ACTUAL
    if [ "$2" = "$3" ]; then bv_pass "$1"; else bv_fail "$1" "expected [$2] got [$3]"; fi
}
bv_contains() { # CASE HAYSTACK NEEDLE
    case "$2" in
        *"$3"*) bv_pass "$1" ;;
        *) bv_fail "$1" "missing [$3] in [$(printf '%s' "$2" | head -c 400)]" ;;
    esac
}
bv_not_contains() { # CASE HAYSTACK NEEDLE
    case "$2" in
        *"$3"*) bv_fail "$1" "unexpected [$3] in [$(printf '%s' "$2" | head -c 400)]" ;;
        *) bv_pass "$1" ;;
    esac
}

# ---------------------------------------------------------------------------
# small portable utilities

bv_sha256() { # FILE -> hex digest
    if bv_have sha256sum && sha256sum "$1" >/dev/null 2>&1; then sha256sum "$1" | cut -d' ' -f1
    else shasum -a 256 "$1" | cut -d' ' -f1; fi
}

bv_mkfile() { # PATH BYTES  - random content
    head -c "$2" /dev/urandom > "$1"
}

bv_filesize() { wc -c < "$1" | tr -d ' '; }

# bv_age_files DIR [SECONDS]  - set the mtime of every file under DIR to SECONDS (default 60) ago.
# S3 timestamps (AWS's and binvault's) are whole seconds, so a file written in the same second as its
# upload looks "newer than the object" to `aws s3 sync` and `mc diff`, which compare its mtime with the
# object's LastModified; files that are sync'ed or diffed twice must be older than that, as real ones are.
bv_age_files() {
    python3 - "$1" "${2:-60}" <<'PY'
import os, sys, time
t = time.time() - float(sys.argv[2])
for dp, dn, fn in os.walk(sys.argv[1]):
    for f in fn:
        try:
            os.utime(os.path.join(dp, f), (t, t), follow_symlinks=False)
        except OSError:
            pass
PY
}

bv_now() { python3 -c 'import time; print(int(time.time()*1000))'; }

# bv_free_port - a TCP port that is free on loopback right now
bv_free_port() {
    python3 - <<'PY'
import socket
s = socket.socket()
s.bind(("127.0.0.1", 0))
print(s.getsockname()[1])
s.close()
PY
}

# bv_wait_http URL [SECONDS] [PID]  - wait for a 2xx answer; stop early when PID has died
bv_wait_http() {
    local url="$1" secs="${2:-30}" pid="${3:-}" i=0 max
    max=$((secs * 10))
    while [ "$i" -lt "$max" ]; do
        if curl -fsS -o /dev/null --max-time 2 "$url" 2>/dev/null; then return 0; fi
        if [ -n "$pid" ] && ! kill -0 "$pid" 2>/dev/null; then return 1; fi
        sleep 0.1
        i=$((i + 1))
    done
    return 1
}

# ---------------------------------------------------------------------------
# build

# bv_build OUTPUT  - go build the binary; retried because other people edit internal/ at the same time
bv_build() {
    local out="$1" tries="${BV_BUILD_RETRIES:-6}" wait="${BV_BUILD_RETRY_WAIT:-20}" n=1
    bv_have go || bv_die "go not found (install Go, or pass --bin /path/to/binvault)"
    mkdir -p "$(dirname "$out")"
    while :; do
        if (cd "$BV_REPO_DIR" && go build -o "$out" ./cmd/binvault) 2>"$out.build.log"; then
            rm -f "$out.build.log"
            return 0
        fi
        if [ "$n" -ge "$tries" ]; then
            cat "$out.build.log" >&2
            bv_die "go build failed $n times (see above)"
        fi
        bv_warn "go build failed (attempt $n/$tries), retrying in ${wait}s: $(head -n 3 "$out.build.log" | tr '\n' ' ')"
        sleep "$wait"
        n=$((n + 1))
    done
}

# ---------------------------------------------------------------------------
# node lifecycle
#
# bv_node_start DATA_DIR [NAME=VALUE ...]
#   Starts one node on free ports and waits until it is healthy. Extra NAME=VALUE arguments are
#   exported to the node (BINVAULT_* overrides). Sets BV_NODE_PID, BV_S3_PORT, BV_ADMIN_PORT,
#   BV_ENDPOINT, BV_ADMIN_URL, BV_NODE_LOG. Needs BV_BIN, BV_ADMIN_TOKEN and BV_MASTER_KEY.
#   BV_BIND_ALL=1 binds the S3 listener to 0.0.0.0 (needed by Docker clients on Linux).

bv_gen_secrets() {
    : "${BV_ADMIN_TOKEN:=$(openssl rand -hex 32)}"
    : "${BV_MASTER_KEY:=$(openssl rand -base64 32)}"
    export BV_ADMIN_TOKEN BV_MASTER_KEY
}

bv_node_start() {
    local data="$1"; shift
    local tries=0 s3p ap bind kv log
    [ -x "${BV_BIN:-}" ] || bv_die "BV_BIN is not set to an executable"
    bv_gen_secrets
    mkdir -p "$data"
    bind=127.0.0.1
    [ "${BV_BIND_ALL:-0}" = 1 ] && bind=0.0.0.0
    log="${BV_NODE_LOG:-$data.log}"
    while [ "$tries" -lt 4 ]; do
        s3p="$(bv_free_port)"; ap="$(bv_free_port)"
        if [ "$s3p" = "$ap" ]; then continue; fi
        (
            export BINVAULT_ADMIN_TOKEN="$BV_ADMIN_TOKEN" BINVAULT_MASTER_KEY="$BV_MASTER_KEY"
            export BINVAULT_DATA_DIR="$data" BINVAULT_LISTEN="$bind:$s3p" BINVAULT_ADMIN_LISTEN="127.0.0.1:$ap"
            export BINVAULT_ENDPOINT_URL="http://127.0.0.1:$s3p" BINVAULT_MIN_FREE_MB="${BINVAULT_MIN_FREE_MB:-1}"
            [ -n "${BV_DOMAIN:-}" ] && export BINVAULT_DOMAIN="$BV_DOMAIN"
            for kv in "$@"; do export "${kv?}"; done
            exec nohup "$BV_BIN" run >>"$log" 2>&1
        ) &
        BV_NODE_PID=$!
        BV_S3_PORT="$s3p"; BV_ADMIN_PORT="$ap"
        BV_ENDPOINT="http://127.0.0.1:$s3p"; BV_ADMIN_URL="http://127.0.0.1:$ap"
        BV_NODE_LOG="$log"
        export BV_NODE_PID BV_S3_PORT BV_ADMIN_PORT BV_ENDPOINT BV_ADMIN_URL BV_NODE_LOG
        if bv_wait_http "$BV_ENDPOINT/_healthz" 30 "$BV_NODE_PID"; then return 0; fi
        if kill -0 "$BV_NODE_PID" 2>/dev/null; then
            kill "$BV_NODE_PID" 2>/dev/null; wait "$BV_NODE_PID" 2>/dev/null
            bv_die "node did not become healthy; log: $log"
        fi
        wait "$BV_NODE_PID" 2>/dev/null
        if grep -qi 'address already in use' "$log" 2>/dev/null; then
            tries=$((tries + 1)); continue   # lost the port race; pick new ports
        fi
        tail -n 20 "$log" >&2
        bv_die "node exited during start-up; log: $log"
    done
    bv_die "could not find free ports for the node"
}

# bv_node_stop [SIGNAL]  - default SIGTERM, then wait up to 20 s for the process to exit
bv_node_stop() {
    local sig="${1:-TERM}" i=0
    [ -n "${BV_NODE_PID:-}" ] || return 0
    if kill -0 "$BV_NODE_PID" 2>/dev/null; then
        kill "-$sig" "$BV_NODE_PID" 2>/dev/null
        while kill -0 "$BV_NODE_PID" 2>/dev/null && [ "$i" -lt 200 ]; do sleep 0.1; i=$((i + 1)); done
        if kill -0 "$BV_NODE_PID" 2>/dev/null; then kill -9 "$BV_NODE_PID" 2>/dev/null; fi
    fi
    wait "$BV_NODE_PID" 2>/dev/null
    BV_NODE_PID=""
    return 0
}

# bv_admin METHOD PATH [JSON]  - admin API call; prints the body, returns 1 on HTTP >= 400
bv_admin() {
    local method="$1" path="$2" body="${3:-}" out code
    if [ -n "$body" ]; then
        out="$(curl -sS -X "$method" -H "Authorization: Bearer $BV_ADMIN_TOKEN" -H 'Content-Type: application/json' \
            --data-binary "$body" -w '\n%{http_code}' "$BV_ADMIN_URL/_admin/v1$path")" || return 1
    else
        out="$(curl -sS -X "$method" -H "Authorization: Bearer $BV_ADMIN_TOKEN" \
            -w '\n%{http_code}' "$BV_ADMIN_URL/_admin/v1$path")" || return 1
    fi
    code="${out##*$'\n'}"
    printf '%s\n' "${out%$'\n'*}"
    [ "$code" -lt 400 ]
}

# ---------------------------------------------------------------------------
# Docker / native client tools
#
# BV_DOCKER_MODE is "auto" (default), "yes" or "no"; run.sh resolves it into BV_DOCKER=1|0 and exports
# BV_TOOL_ENDPOINT (the URL clients use: host.docker.internal from containers, 127.0.0.1 natively).

bv_docker_ready() {
    [ "${BV_DOCKER:-0}" = 1 ] && bv_have docker
}

# bv_docker ARGS...  - docker run --rm with the labels/add-host every client container needs.
# The working directory is mounted at the same absolute path so file arguments mean the same
# thing inside and outside the container.
bv_docker() {
    docker run --rm --label "bvt-run=${BV_RUN_ID:-none}" --add-host host.docker.internal:host-gateway \
        -v "$BV_SUITE_DIR:$BV_SUITE_DIR" -w "$BV_SUITE_DIR" "$@"
}

# bv_pull IMAGE  - make the image available; returns 1 when it cannot be pulled
bv_pull() {
    docker image inspect "$1" >/dev/null 2>&1 && return 0
    bv_info "pulling $1"
    docker pull -q "$1" >/dev/null 2>&1
}
