#!/usr/bin/env bash
# run.sh - real-client conformance suite for binvault (S3 clients against one live node).
# Builds the binary, starts a node on free ports in a temp data dir, bootstraps buckets and tokens
# through the admin API, runs the selected client suites and prints a PASS/FAIL/SKIP table.
# See ../README.md for the suites and their requirements. Prerequisites in short: bash, curl, openssl, python3 and a binvault
# binary (--bin, or Go to build one) are always needed; every suite is optional and is reported as SKIP, with the reason, when its
# tool is missing: boto3/s3cmd (python3 venv + pip), sdkgo/load (Go 1.25+), sdkjs (Docker node:22 or Node 18+), awscli (Docker
# amazon/aws-cli or aws v2), rclone (Docker rclone/rclone or rclone), mc (Go once, or mc on PATH). "load" is never in the default run.
set -euo pipefail

SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
# shellcheck source=support/common.sh
. "$SELF_DIR/support/common.sh"

DEFAULT_SUITES="boto3 sdkgo sdkjs awscli rclone mc s3cmd"
SELF_HOSTED_SUITES="load"        # start their own nodes; never part of the default run
KNOWN_SUITES="$DEFAULT_SUITES $SELF_HOSTED_SUITES"
DOCKER_SUITES="awscli rclone sdkjs mc"   # suites that prefer Docker when it is available

usage() {
    cat <<EOF
usage: run.sh [--only SUITE[,SUITE...]] [--keep] [--docker | --no-docker] [--bin PATH] [--jobs N]
              [--quiet | --verbose] [--timeout SECONDS] [--no-cache] [--list]

  --only LIST     run only these suites (comma separated). Suites: $DEFAULT_SUITES
                  and "load" (the load/robustness tests; never part of the default run)
  --keep          leave the node running and keep the temp data dir (paths are printed)
  --docker        require Docker for the CLI/JS suites (fail early when it is unavailable)
  --no-docker     never use Docker; use aws/rclone/mc/node from PATH, skip the suite when absent
  --bin PATH      use this binvault binary instead of building one (also: BINVAULT_BIN)
  --jobs N        run up to N client suites at the same time (default 4; 1 = one after the other).
                  Output is then shown per suite when it finishes. --verbose implies --jobs 1.
  --timeout N     per-suite timeout in seconds (default 900; the load suite gets 4x)
  --quiet         print only failures while running and skip the per-case table
  --verbose       print every case and all suite output while running
  --no-cache      discard the cached python venv / npm install before running
  --list          list the suites and exit
EOF
}

ONLY=""; KEEP=0; DOCKER_MODE=auto; BIN="${BINVAULT_BIN:-}"; QUIET=0; VERBOSE=0; SUITE_TIMEOUT=900; NO_CACHE=0; JOBS=4
while [ $# -gt 0 ]; do
    case "$1" in
        --only) [ $# -ge 2 ] || bv_die "--only needs a value"; ONLY="${ONLY:+$ONLY,}$2"; shift 2 ;;
        --only=*) ONLY="${ONLY:+$ONLY,}${1#--only=}"; shift ;;
        --keep) KEEP=1; shift ;;
        --docker) DOCKER_MODE=yes; shift ;;
        --no-docker) DOCKER_MODE=no; shift ;;
        --bin) [ $# -ge 2 ] || bv_die "--bin needs a value"; BIN="$2"; shift 2 ;;
        --jobs|-j) [ $# -ge 2 ] || bv_die "--jobs needs a value"; JOBS="$2"; shift 2 ;;
        --timeout) [ $# -ge 2 ] || bv_die "--timeout needs a value"; SUITE_TIMEOUT="$2"; shift 2 ;;
        --quiet|-q) QUIET=1; shift ;;
        --verbose|-v) VERBOSE=1; JOBS=1; shift ;;
        --no-cache) NO_CACHE=1; shift ;;
        --list) echo "$KNOWN_SUITES" | tr ' ' '\n'; exit 0 ;;
        -h|--help) usage; exit 0 ;;
        *) usage >&2; bv_die "unknown argument: $1" ;;
    esac
done

# ---- suite selection --------------------------------------------------------------------------
SUITES=""
if [ -z "$ONLY" ]; then
    SUITES="$DEFAULT_SUITES"
else
    for s in $(echo "$ONLY" | tr ',' ' '); do
        case " $KNOWN_SUITES " in
            *" $s "*) SUITES="$SUITES $s" ;;
            all) SUITES="$SUITES $DEFAULT_SUITES" ;;
            *) bv_die "unknown suite '$s' (known: $KNOWN_SUITES)" ;;
        esac
    done
fi
NEEDS_NODE=0; WANTS_DOCKER=0
for s in $SUITES; do
    case " $SELF_HOSTED_SUITES " in *" $s "*) ;; *) NEEDS_NODE=1 ;; esac
    case " $DOCKER_SUITES " in *" $s "*) WANTS_DOCKER=1 ;; esac
done

# ---- preflight --------------------------------------------------------------------------------
bv_have curl    || bv_die "curl is required"
bv_have python3 || bv_die "python3 is required"
bv_have openssl || bv_die "openssl is required"

BV_DOCKER=0
if [ "$DOCKER_MODE" != no ] && [ "$WANTS_DOCKER" = 1 ]; then
    if bv_have docker && docker info >/dev/null 2>&1; then
        BV_DOCKER=1
    elif [ "$DOCKER_MODE" = yes ]; then
        bv_die "--docker given but the Docker daemon is not reachable"
    fi
fi
export BV_DOCKER

TMP_ROOT="${TMPDIR:-/tmp}"; TMP_ROOT="${TMP_ROOT%/}"
RUN_DIR="$(mktemp -d "$TMP_ROOT/binvault-conformance.XXXXXX")"
RUN_DIR="$(cd "$RUN_DIR" && pwd -P)"
BV_RUN_ID="$(basename "$RUN_DIR" | tr -c 'A-Za-z0-9\n' '-')"
BV_CACHE_DIR="${BV_CACHE_DIR:-$TMP_ROOT/binvault-conformance-cache}"
export RUN_DIR BV_RUN_ID BV_CACHE_DIR BV_DOCKER_MODE="$DOCKER_MODE"
[ "$NO_CACHE" = 1 ] && rm -rf "$BV_CACHE_DIR"
mkdir -p "$RUN_DIR/logs" "$RUN_DIR/suites" "$BV_CACHE_DIR"
RESULTS="$RUN_DIR/results.tsv"; TIMES="$RUN_DIR/times.txt"
: > "$RESULTS"; : > "$TIMES"
export BV_RESULTS="$RESULTS"

cleanup() {
    local rc=$?
    trap - EXIT INT TERM
    if [ "$KEEP" = 1 ] && [ "$NEEDS_NODE" = 1 ] && [ -n "${BV_NODE_PID:-}" ]; then
        echo >&2
        bv_info "kept (--keep): node pid $BV_NODE_PID, S3 $BV_ENDPOINT, admin $BV_ADMIN_URL"
        bv_log "    admin token : $BV_ADMIN_TOKEN"
        bv_log "    run dir     : $RUN_DIR   (per-suite credentials: $RUN_DIR/suites/<suite>/env.sh)"
        bv_log "    stop with   : kill $BV_NODE_PID; rm -rf $RUN_DIR"
    else
        bv_node_stop TERM
        if [ "$BV_DOCKER" = 1 ]; then
            docker ps -q --filter "label=bvt-run=$BV_RUN_ID" 2>/dev/null | xargs docker rm -f >/dev/null 2>&1 || true
        fi
        if [ "$KEEP" = 1 ]; then bv_info "kept (--keep): $RUN_DIR"; else rm -rf "$RUN_DIR"; fi
    fi
    exit "$rc"
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# ---- binary -------------------------------------------------------------------------------------
if [ -n "$BIN" ]; then
    [ -x "$BIN" ] || bv_die "--bin: $BIN is not an executable file"
    BV_BIN="$(cd "$(dirname "$BIN")" && pwd -P)/$(basename "$BIN")"
else
    bv_info "building binvault"
    BV_BIN="$RUN_DIR/bin/binvault"
    bv_build "$BV_BIN"
fi
export BV_BIN
bv_log "    $("$BV_BIN" version 2>&1 | head -n 1)"

# ---- domain for virtual-hosted style --------------------------------------------------------------
if [ "$(python3 -c 'import socket
try: print(socket.gethostbyname("probe.s3.localtest.me"))
except Exception: print("")' 2>/dev/null)" = "127.0.0.1" ]; then
    BV_DOMAIN="s3.localtest.me"; BV_DOMAIN_RESOLVES=1
else
    BV_DOMAIN="s3.bv.test"; BV_DOMAIN_RESOLVES=0   # suites map it to 127.0.0.1 themselves
fi
export BV_DOMAIN BV_DOMAIN_RESOLVES

# ---- the shared node ----------------------------------------------------------------------------
if [ "$NEEDS_NODE" = 1 ]; then
    # Docker Desktop (macOS) reaches a loopback listener through host.docker.internal; on Linux the
    # container needs the host's bridge address, so bind everywhere there.
    if [ "$BV_DOCKER" = 1 ] && [ "$(uname -s)" != Darwin ]; then BV_BIND_ALL=1; else BV_BIND_ALL=0; fi
    export BV_BIND_ALL
    bv_gen_secrets
    BV_NODE_LOG="$RUN_DIR/logs/node.log"; export BV_NODE_LOG
    bv_info "starting node"
    bv_node_start "$RUN_DIR/data" BINVAULT_AUTH_FAIL_LIMIT=1000000 BINVAULT_FSYNC=false   # fsync only slows the functional suites; durability is tested by the load suite
    bv_log "    S3 $BV_ENDPOINT   admin $BV_ADMIN_URL   domain $BV_DOMAIN"
    if [ "$BV_DOCKER" = 1 ]; then
        BV_TOOL_ENDPOINT="http://host.docker.internal:$BV_S3_PORT"
    else
        BV_TOOL_ENDPOINT="$BV_ENDPOINT"
    fi
    export BV_TOOL_ENDPOINT
fi

# ---- run the suites -----------------------------------------------------------------------------
QUIET_FLAG=""; [ "$QUIET" = 1 ] && QUIET_FLAG="--quiet"
LIVE_FLAG="$QUIET_FLAG"; [ "$VERBOSE" = 1 ] && LIVE_FLAG="--verbose"
case "$JOBS" in ''|*[!0-9]*|0) bv_die "--jobs needs a positive number" ;; esac

# prepare_suite S  - scratch dir + bootstrap; sets SUITE_ENV and SUITE_TMO, returns 1 when there is nothing to run
prepare_suite() {
    local s="$1" script="$SELF_DIR/suites/$1/run.sh" sdir="$RUN_DIR/suites/$1"
    mkdir -p "$sdir"
    SUITE_TMO="$SUITE_TIMEOUT"; SUITE_ENV=":"
    if [ ! -f "$script" ]; then
        printf '%s\tSKIP\t_runner\tsuite script %s not found\n' "$s" "suites/$s/run.sh" >> "$RESULTS"
        bv_warn "no script for suite $s"
        return 1
    fi
    case " $SELF_HOSTED_SUITES " in
        *" $s "*) SUITE_TMO=$((SUITE_TIMEOUT * 4)) ;;
        *)
            python3 "$SELF_DIR/support/bootstrap.py" --suite "$s" --admin-url "$BV_ADMIN_URL" --admin-token "$BV_ADMIN_TOKEN" \
                --endpoint "$BV_ENDPOINT" --tool-endpoint "$BV_TOOL_ENDPOINT" --domain "$BV_DOMAIN" --out "$sdir" \
                || bv_die "bootstrap for suite $s failed"
            SUITE_ENV="$sdir/env.sh" ;;
    esac
    return 0
}

# exec_suite S ENV TMO  - run the suite under the supervisor (own process group, timeout, result collection)
exec_suite() {
    local s="$1" envf="$2" tmo="$3"
    # shellcheck disable=SC2086
    python3 "$SELF_DIR/support/bvreport.py" run "$s" "$RESULTS" "$RUN_DIR/logs/$s.log" "$TIMES" "$tmo" $LIVE_FLAG -- \
        env BV_SUITE="$s" BV_SUITE_DIR="$RUN_DIR/suites/$s" \
        bash -c 'set -a; [ "$1" = : ] || . "$1"; set +a; exec bash "$2"' _ "$envf" "$SELF_DIR/suites/$s/run.sh" || true
}

PARALLEL_SUITES=""; SERIAL_SUITES=""
for s in $SUITES; do
    case " $SELF_HOSTED_SUITES " in *" $s "*) SERIAL_SUITES="$SERIAL_SUITES $s" ;; *) PARALLEL_SUITES="$PARALLEL_SUITES $s" ;; esac
done

if [ "$JOBS" -le 1 ]; then
    for s in $PARALLEL_SUITES; do
        echo >&2; bv_info "suite: $s"
        prepare_suite "$s" && exec_suite "$s" "$SUITE_ENV" "$SUITE_TMO"
    done
else
    pids=(); names=(); open=0
    # reap_jobs: print the output of every finished job once
    reap_jobs() {
        local i
        for i in "${!pids[@]}"; do
            [ -n "${pids[$i]}" ] || continue
            if ! kill -0 "${pids[$i]}" 2>/dev/null; then
                wait "${pids[$i]}" 2>/dev/null || true
                echo >&2; bv_info "suite: ${names[$i]}"
                cat "$RUN_DIR/logs/${names[$i]}.console"
                pids[$i]=""; open=$((open - 1))
            fi
        done
    }
    for s in $PARALLEL_SUITES; do
        prepare_suite "$s" || continue
        while [ "$open" -ge "$JOBS" ]; do reap_jobs; [ "$open" -ge "$JOBS" ] && sleep 0.3; done
        bv_log "    started: $s"
        exec_suite "$s" "$SUITE_ENV" "$SUITE_TMO" > "$RUN_DIR/logs/$s.console" 2>&1 &
        pids+=("$!"); names+=("$s"); open=$((open + 1))
    done
    while [ "$open" -gt 0 ]; do reap_jobs; [ "$open" -gt 0 ] && sleep 0.3; done
fi
for s in $SERIAL_SUITES; do
    echo >&2; bv_info "suite: $s"
    prepare_suite "$s" && exec_suite "$s" "$SUITE_ENV" "$SUITE_TMO"
done

# ---- report -------------------------------------------------------------------------------------
rc=0
python3 "$SELF_DIR/support/bvreport.py" summary "$RESULTS" "$SELF_DIR/known-failures.tsv" ${QUIET_FLAG:+$QUIET_FLAG} --times "$TIMES" --order "$(echo $SUITES | tr ' ' ',')" || rc=$?
LOG_ROOT="${BV_LOG_DIR:-$TMP_ROOT/binvault-conformance-logs}"
rm -rf "$LOG_ROOT"; mkdir -p "$LOG_ROOT"
cp -R "$RUN_DIR/logs" "$LOG_ROOT/logs" 2>/dev/null || true
cp "$RESULTS" "$LOG_ROOT/results.tsv" 2>/dev/null || true
echo >&2
bv_log "suite logs and results.tsv: $LOG_ROOT"
exit "$rc"
