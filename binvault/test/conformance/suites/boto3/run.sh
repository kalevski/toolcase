#!/usr/bin/env bash
# suite boto3: Python boto3/botocore (latest release) against the node - the broadest suite (pytest).
# Env: BV_PYTEST_ARGS (extra pytest args, e.g. "-k listing test_keys.py"), BV_TEST_TIMEOUT (per test, s).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
. "$HERE/../../support/common.sh"

CACHE="${BV_CACHE_DIR:-${TMPDIR:-/tmp}/binvault-conformance-cache}"
VENV="$CACHE/venv-boto3"
STAMP="$(cat "$HERE/requirements.txt" | shasum -a 256 | cut -c1-16)-$(python3 -c 'import sys; print("%d.%d" % sys.version_info[:2])')"

mkdir -p "$CACHE"
if [ ! -x "$VENV/bin/python" ] || [ "$(cat "$VENV/.stamp" 2>/dev/null)" != "$STAMP" ]; then
    bv_info "creating the python venv (cached in $VENV)"
    rm -rf "$VENV"
    if ! python3 -m venv "$VENV" >&2; then
        bv_skip "boto3/_setup" "python3 -m venv failed"; exit 0
    fi
    if ! "$VENV/bin/pip" install -q --disable-pip-version-check -r "$HERE/requirements.txt" >&2; then
        rm -rf "$VENV"
        bv_skip "boto3/_setup" "pip install of boto3/pytest failed (offline?)"; exit 0
    fi
    # CRC64NVME needs the AWS CRT; optional (those tests skip without it)
    "$VENV/bin/pip" install -q --disable-pip-version-check awscrt >&2 || bv_warn "awscrt is not installable here; CRC64NVME tests will be skipped"
    echo "$STAMP" > "$VENV/.stamp"
fi

"$VENV/bin/python" -c 'import boto3, botocore; print("boto3 %s / botocore %s" % (boto3.__version__, botocore.__version__))' >&2

# a private scratch dir for what the tests create (node data dirs, certificates); removed on exit
BV_SUITE_TMP="$(mktemp -d "${TMPDIR:-/tmp}/binvault-boto3.XXXXXX")"
export TMPDIR="$BV_SUITE_TMP"
trap 'rm -rf "$BV_SUITE_TMP"' EXIT

cd "$HERE" || exit 1
export PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 AWS_EC2_METADATA_DISABLED=true
export AWS_SHARED_CREDENTIALS_FILE=/dev/null AWS_CONFIG_FILE=/dev/null
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE
# shellcheck disable=SC2086
"$VENV/bin/python" -m pytest -p no:cacheprovider -s -q --timeout="${BV_TEST_TIMEOUT:-180}" --tb=short ${BV_PYTEST_ARGS:-.}
rc=$?
# exit status 1 only means "some tests failed": every failure is already reported as its own result line
[ "$rc" -eq 1 ] && exit 0
exit "$rc"
