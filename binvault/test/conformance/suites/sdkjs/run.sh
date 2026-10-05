#!/usr/bin/env bash
# suite sdkjs: AWS SDK for JavaScript v3 (client-s3, lib-storage, s3-request-presigner; latest) on node 22 in Docker (or native node >= 18).
# Env: BV_JS_ONLY (regex of case ids to run, for development), BV_IMG_NODE (default node:22).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
. "$HERE/../../support/common.sh"

IMAGE="${BV_IMG_NODE:-node:22}"
CACHE="${BV_CACHE_DIR:-${TMPDIR:-/tmp}/binvault-conformance-cache}/sdkjs"
mkdir -p "$CACHE"
CACHE="$(cd "$CACHE" && pwd -P)"

# ---- how to run node: a container with the install dir mounted at /work, or the native node ----------
MODE=""
if bv_docker_ready && bv_pull "$IMAGE"; then
    MODE=docker
elif bv_have node && bv_have npm && [ "$(node -p 'process.versions.node.split(".")[0]' 2>/dev/null || echo 0)" -ge 18 ]; then
    MODE=native
fi
if [ -z "$MODE" ]; then
    bv_skip "sdkjs/_setup" "neither Docker ($IMAGE) nor a native node >= 18 with npm is available"
    exit 0
fi

# run_node CMD...  - run a command with the install dir as the working directory
run_node() {
    if [ "$MODE" = docker ]; then
        local envs="" v
        for v in BV_ENV_JSON BV_TOOL_ENDPOINT BV_DOMAIN BV_SUITE BV_JS_ONLY; do
            [ -n "${!v:-}" ] && envs="$envs -e $v=${!v}"
        done
        # shellcheck disable=SC2086
        bv_docker -u "$(id -u):$(id -g)" -e HOME=/tmp -e npm_config_cache=/tmp/.npm $envs \
            -v "$CACHE:/work" -w /work "$IMAGE" "$@"
    else
        (cd "$CACHE" && "$@")
    fi
}

# ---- install the SDK once (re-installed when package.json changes) -----------------------------------
STAMP="$(shasum -a 256 "$HERE/package.json" | cut -c1-16)"
if [ ! -d "$CACHE/node_modules/@aws-sdk/client-s3" ] || [ "$(cat "$CACHE/.stamp" 2>/dev/null)" != "$STAMP" ]; then
    bv_info "installing the AWS SDK for JavaScript v3 packages ($MODE, cached in $CACHE)"
    rm -rf "$CACHE/node_modules" "$CACHE/package-lock.json"
    cp "$HERE/package.json" "$CACHE/package.json"
    # --legacy-peer-deps: the packages are all "latest", and their dist-tags can be a release apart (lib-storage 3.1146 wants
    # client-s3 ^3.1146 while client-s3's latest is still 3.1145), which a strict peer resolution refuses
    if ! run_node npm install --no-audit --no-fund --loglevel=error --legacy-peer-deps >&2; then
        bv_skip "sdkjs/_setup" "npm install of the AWS SDK failed (offline?)"
        exit 0
    fi
    echo "$STAMP" > "$CACHE/.stamp"
fi

# ---- sources next to node_modules (ESM resolves bare imports relative to the importing file) -----------
rm -f "$CACHE"/*.mjs
cp "$HERE"/*.mjs "$CACHE"/
cp "$HERE/../../support/oddkeys.json" "$CACHE/oddkeys.json"

run_node node -p '["@aws-sdk/client-s3","@aws-sdk/lib-storage","@aws-sdk/s3-request-presigner","@aws-sdk/s3-presigned-post"].map(p=>p.split("/")[1]+" "+JSON.parse(require("fs").readFileSync("node_modules/"+p+"/package.json","utf8")).version).join(", ")+" / node "+process.version' >&2

# ---- resources that need the admin API: created here, on the host (the admin listener is loopback-only) --
python3 - "$BV_SUITE_DIR/extra.json" <<'PY' || bv_warn "could not create the rate-limited bucket; the retry cases will be skipped"
import json, os, sys, urllib.request, urllib.error

def admin(method, path, body=None):
    req = urllib.request.Request(os.environ["BV_ADMIN_URL"] + "/_admin/v1" + path, method=method,
                                 data=None if body is None else json.dumps(body).encode(),
                                 headers={"Authorization": "Bearer " + os.environ["BV_ADMIN_TOKEN"], "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            raw = r.read()
            return r.status, json.loads(raw) if raw else None
    except urllib.error.HTTPError as e:
        raw = e.read()
        return e.code, json.loads(raw) if raw else None

name = "bvt-%s-limited" % os.environ["BV_SUITE"]
limits = {"requests_per_second": 2, "burst": 2}
code, _ = admin("POST", "/buckets", {"name": name, "limits": limits})
if code == 409:
    admin("PUT", "/buckets/" + name, {"limits": limits})
elif code >= 300:
    sys.exit("bucket: HTTP %s" % code)
code, tok = admin("POST", "/buckets/%s/tokens" % name, {"name": "limited", "grants": [{"actions": ["read", "write", "list", "delete", "purge", "tag"]}]})
if code != 201:
    sys.exit("token: HTTP %s %s" % (code, tok))
json.dump({"limited": {"name": name, "access_key": tok["access_key_id"], "secret_key": tok["secret_access_key"], "limits": limits}}, open(sys.argv[1], "w"))
PY

# ---- run ---------------------------------------------------------------------------------------------
run_node node test.mjs
rc=$?
if [ "$rc" -ne 0 ]; then bv_fail "sdkjs/_runner" "node exited with status $rc"; fi
exit 0
