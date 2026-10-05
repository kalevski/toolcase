#!/usr/bin/env bash
# suite sdkgo: aws-sdk-go-v2 (service/s3, feature/s3/manager, feature/s3/transfermanager) from the nested Go module test/sdkgo.
# Env: BV_GO_TEST_ARGS (extra `go test` args, e.g. "-run TestKeys"), BV_GO_TEST_TIMEOUT (default 10m).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
. "$HERE/../../support/common.sh"

MOD="$BV_TEST_DIR/sdkgo"

if ! bv_have go; then bv_skip "sdkgo/_setup" "go not found in PATH"; exit 0; fi
if ! bv_have python3; then bv_skip "sdkgo/_setup" "python3 not found (needed to convert go test output)"; exit 0; fi
if [ ! -f "$MOD/go.mod" ]; then bv_skip "sdkgo/_setup" "module $MOD is missing"; exit 0; fi
cd "$MOD" || { bv_skip "sdkgo/_setup" "cannot enter $MOD"; exit 0; }

# The client library must never pick up the developer's AWS configuration.
export AWS_EC2_METADATA_DISABLED=true AWS_SHARED_CREDENTIALS_FILE=/dev/null AWS_CONFIG_FILE=/dev/null
unset AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY AWS_SESSION_TOKEN AWS_PROFILE AWS_ENDPOINT_URL AWS_ENDPOINT_URL_S3
unset HTTP_PROXY HTTPS_PROXY http_proxy https_proxy ALL_PROXY all_proxy
export NO_PROXY='*' no_proxy='*'
# go.mod/go.sum are committed; never let a test run rewrite them.
export GOFLAGS="-mod=readonly"

# Make sure the SDK modules can be built (module cache or network); otherwise skip cleanly.
if ! go mod download >"${BV_SUITE_DIR:-/tmp}/go-mod-download.log" 2>&1; then
    bv_skip "sdkgo/_setup" "cannot download the AWS SDK modules (offline?): $(tail -n 2 "${BV_SUITE_DIR:-/tmp}/go-mod-download.log" | tr '\n' ' ')"
    exit 0
fi
bv_info "sdkgo: $(go version | cut -d' ' -f3); $(go list -m all 2>/dev/null | grep -E 'aws-sdk-go-v2(/service/s3|/feature/s3/[a-z]+|/config|/credentials)? |smithy-go ' | sed 's#github.com/aws/##' | tr '\n' ',' | sed 's/,$//')"

if ! go vet ./... >"${BV_SUITE_DIR:-/tmp}/go-vet.log" 2>&1; then
    # a compile error is a real failure of the suite itself, not of binvault
    bv_fail "sdkgo/_build" "go vet failed: $(head -n 5 "${BV_SUITE_DIR:-/tmp}/go-vet.log" | tr '\n' ' ')"
    exit 0
fi

# shellcheck disable=SC2086
go test -json -count=1 -timeout "${BV_GO_TEST_TIMEOUT:-10m}" -parallel 8 ${BV_GO_TEST_ARGS:-} ./... 2>&1 | python3 "$HERE/gotest2results.py"
exit 0
