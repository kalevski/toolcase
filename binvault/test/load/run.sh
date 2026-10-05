#!/usr/bin/env bash
# load: binvault's load and robustness test (spec 12), run against nodes of its own:
#   - a 1 GiB object by multipart upload, downloaded again, server RSS sampled throughout (it must stay far below the object size)
#   - 20,000 small objects with 16 workers (throughput and latency are printed), all read back
#   - 20,000 keys listed with delimiter paging at 1000, count and raw UTF-8 byte order verified
#   - kill -9 during a large PUT, an overwrite, a part upload, a multipart Complete and a storm of small PUTs: restart on the same data
#     dir and verify that no partial object is visible, acknowledged writes survived and `binvault validate --deep` passes
# It prints numbers (lines starting with '#') and asserts only functional properties.
#
#   test/load/run.sh                      full size (needs about 6 GiB of free disk space, about 3 minutes)
#   BV_LOAD_SCALE=0.1 test/load/run.sh    a quick smoke run
#   BV_LOAD_ONLY=small,kill  BV_BIN=/path/to/binvault  BV_LOAD_DIR=/big/disk/tmp  BV_LOAD_NO_KILL=1
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
. "$HERE/../conformance/support/common.sh"

bv_have go || { bv_skip "load/_setup" "go not found in PATH"; exit 0; }
TMP="$(mktemp -d "${TMPDIR:-/tmp}/binvault-load-build.XXXXXX")"
trap 'rm -rf "$TMP"' EXIT
if [ -z "${BV_BIN:-}" ]; then
    bv_info "building binvault"
    BV_BIN="$TMP/binvault"
    bv_build "$BV_BIN"
fi
export BV_BIN
if ! (cd "$HERE" && go build -o "$TMP/bvload" .) 2>"$TMP/build.log"; then
    bv_fail "load/_build" "go build of test/load failed: $(head -n 5 "$TMP/build.log" | tr '\n' ' ')"
    exit 0
fi
OUT="$TMP/out.txt"
"$TMP/bvload" -bin "$BV_BIN" | tee "$OUT"
rc=${PIPESTATUS[0]}
if [ -z "${BV_SUITE:-}" ]; then      # run by hand: a summary
    echo >&2
    echo "load: $(grep -c '^@@RESULT	PASS' "$OUT") pass, $(grep -c '^@@RESULT	FAIL' "$OUT") fail, $(grep -c '^@@RESULT	SKIP' "$OUT") skip" >&2
    exit "$rc"
fi
exit 0
