#!/usr/bin/env bash
# suite mc: the MinIO client. MinIO publishes neither images nor release binaries any more, so the client is built once with
# `go install github.com/minio/mc@latest` into the cache directory (an `mc` from PATH is used when it really is the MinIO client).
# Covers alias/ls/mb/cp/cat/stat/head/pipe/rm/find/tree/du/diff/mirror/mv/od/share/tag/version/encrypt/ilm/anonymous/event/retention,
# multipart uploads (minio-go signs the streaming payload itself), SSE-S3, versions, quota and content rules, odd keys.
# Env (development): MC_GROUPS (space separated subset of: basic xfer multi meta ver anon rules odd)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
. "$HERE/../../support/common.sh"
RCLONE_DIR="$HERE/../rclone"
PROBE="python3 $RCLONE_DIR/s3probe.py"
TU="python3 $RCLONE_DIR/treeutil.py"
OK="python3 $RCLONE_DIR/oddkeys.py"
CALC="python3 $HERE/../awscli/calc.py"

W="$BV_SUITE_DIR/w"; mkdir -p "$W"
export BV_ENDPOINT
PB="$BV_PLAIN_BUCKET"; VB="$BV_VERSIONED_BUCKET"; PUB="$BV_PUBLIC_BUCKET"; QB="$BV_QUOTA_BUCKET"; CB="$BV_CTYPE_BUCKET"
HOSTPORT="${BV_ENDPOINT#http://}"
GROUPS_ALL="basic xfer multi meta ver anon rules odd"
DENIED='AccessDenied|Access Denied|Insufficient permissions|not allowed|no access|Forbidden|403'
GROUPS_RUN="${MC_GROUPS:-$GROUPS_ALL}"

# ------------------------------------------------------------------------------------------------
# find or build the MinIO client

is_minio_mc() { "$1" --version 2>&1 | grep -qi 'minio'; }
MC=""
CACHE="${BV_CACHE_DIR:-${TMPDIR:-/tmp}/binvault-conformance-cache}/mc"
if bv_have mc && is_minio_mc "$(command -v mc)"; then
    MC="$(command -v mc)"
elif [ -x "$CACHE/bin/mc" ] && is_minio_mc "$CACHE/bin/mc"; then
    MC="$CACHE/bin/mc"
elif bv_have go; then
    bv_info "building the MinIO client with go install (cached in $CACHE/bin)"
    mkdir -p "$CACHE/bin"
    if (cd "${TMPDIR:-/tmp}" && GOBIN="$CACHE/bin" GOFLAGS=-mod=mod go install github.com/minio/mc@latest) >"$BV_SUITE_DIR/mc-install.log" 2>&1; then
        MC="$CACHE/bin/mc"
    else
        bv_skip "mc/_setup" "go install github.com/minio/mc@latest failed (offline?): $(tail -n 2 "$BV_SUITE_DIR/mc-install.log" | tr '\n' ' ')"; exit 0
    fi
else
    bv_skip "mc/_setup" "no MinIO client in PATH and no Go toolchain to build one"; exit 0
fi
bv_info "mc: $("$MC" --version 2>&1 | head -n 1)"

export MC_CONFIG_DIR="$W/mcconfig"; mkdir -p "$MC_CONFIG_DIR"
export MC_NO_COLOR=1 MC_DISABLE_PAGER=1 MC_QUIET=1
unset MC_JSON MC_DEBUG
mkalias() { export "MC_HOST_$1=http://$2:$3@$HOSTPORT"; }
mkalias bv "$BV_PLAIN_AK" "$BV_PLAIN_SK"
mkalias bvv "$BV_VERSIONED_AK" "$BV_VERSIONED_SK"
mkalias bvp "$BV_PUBLIC_AK" "$BV_PUBLIC_SK"
mkalias bvq "$BV_QUOTA_AK" "$BV_QUOTA_SK"
mkalias bvc "$BV_CTYPE_AK" "$BV_CTYPE_SK"
export "MC_HOST_bva=http://$HOSTPORT"      # no credentials: anonymous

# m ARGS...    run mc; sets MOUT MERR MALL MRC.  mj ARGS... adds --json
m() {
    local ef="$G_DIR/.err.$RANDOM$RANDOM"
    MOUT="$("$MC" "$@" 2>"$ef")"; MRC=$?
    MERR="$(cat "$ef" 2>/dev/null)"; rm -f "$ef"
    MALL="$MOUT
$MERR"
    return 0
}
mx() { local n="$1"; shift; m "$@"; if [ "$MRC" -eq 0 ]; then bv_pass "$n"; else bv_fail "$n" "exit $MRC: $(printf '%s' "$MERR$MOUT" | tail -n 3)"; fi; }
# mxe CASE PATTERN ARGS...   mc must fail, and its --json error (the S3 error document) or text must match PATTERN
mxe() {
    local n="$1" pat="$2"; shift 2; m --json "$@"
    if [ "$MRC" -eq 0 ] && ! printf '%s' "$MALL" | grep -q '"status":"error"'; then bv_fail "$n" "expected failure but mc succeeded: $(printf '%s' "$MALL" | tail -n 2 | head -c 300)"
    elif printf '%s' "$MALL" | grep -Eqi -- "$pat"; then bv_pass "$n"
    else bv_fail "$n" "failed but the output does not match /$pat/: $(printf '%s' "$MALL" | tail -n 3 | head -c 500)"; fi
}
probe() { local k="$1"; shift; $PROBE --kind "$k" "$@"; }
keys_eq() {
    local n="$1" kind="$2" prefix="$3"; shift 3
    local got want
    got="$(probe "$kind" list "$prefix" | python3 -c 'import json,sys; print("\n".join(sorted(json.load(sys.stdin), key=lambda k: k.encode())))')"
    want="$(printf '%s\n' "$@" | python3 -c 'import sys; print("\n".join(sorted([l.rstrip("\n") for l in sys.stdin if l.strip()], key=lambda k: k.encode())))')"
    if [ "$got" = "$want" ]; then bv_pass "$n"; else bv_fail "$n" "stored keys differ. stored: $(printf '%s' "$got" | head -c 300 | tr '\n' ' ') | expected: $(printf '%s' "$want" | head -c 300 | tr '\n' ' ')"; fi
}
count_keys() { probe "$1" list "$2" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))'; }
head_hdr() { probe "$1" head "$2" | python3 -c 'import json,sys; print(json.load(sys.stdin)["headers"].get(sys.argv[1],""))' "$3"; }
# jl: number of JSON lines with "status":"success" and "type":"file" in MOUT
nfiles() { printf '%s\n' "$MOUT" | grep -c '"type":"file"'; }

mkfx() { [ -f "$W/$1" ] || bv_mkfile "$W/$1" "$2"; }
mkfx f_1m 1048576
mkfx f_5m 5242880
mkfx f_12m 12582912
mkfx f_40m 41943040
printf 'hello binvault\n' > "$W/hello.txt"
TREE="$W/tree"
if [ ! -d "$TREE" ]; then $TU gen "$TREE"; fi
$TU png "$W/pic.png"
printf '%%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%%%EOF\n' > "$W/doc.pdf"

G_DIR="$W"
m ls bv
if [ "$MRC" -ne 0 ]; then bv_skip "mc/_setup" "mc cannot reach the node at $BV_ENDPOINT: $(printf '%s' "$MERR" | tail -n 2)"; exit 0; fi

# ================================================================================================
g_basic() {
    local d="$G_DIR" b="bv/$PB/basic" id
    mx "basic/alias-set-validates-the-credentials" alias set bvx "http://$HOSTPORT" "$BV_PLAIN_AK" "$BV_PLAIN_SK"
    mxe "basic/alias-set-with-a-wrong-secret-fails" 'SignatureDoesNotMatch|signature' alias set bvbad "http://$HOSTPORT" "$BV_PLAIN_AK" "wrong-secret-0123456789012345678901234567"
    mx "basic/ls-buckets" ls bv
    bv_contains "basic/ls-shows-the-bucket" "$MOUT" "$PB"
    bv_eq "basic/ls-shows-one-bucket" "1" "$(printf '%s\n' "$MOUT" | grep -c .)"
    mx "basic/mb-own-bucket-is-a-no-op" mb --ignore-existing "bv/$PB"
    mxe "basic/mb-new-name-denied" 'AccessDenied|Access Denied|use the admin API' mb "bv/bvt-mc-brand-new-bucket"
    mxe "basic/rb-denied" 'AccessDenied|Access Denied|admin API' rb "bv/$PB"
    mx "basic/cp-upload" cp "$W/hello.txt" "$b/hello.txt"
    mx "basic/cat" cat "$b/hello.txt"; bv_eq "basic/cat-body" "hello binvault" "$MOUT"
    mx "basic/head" head -n 1 "$b/hello.txt"; bv_eq "basic/head-body" "hello binvault" "$MOUT"
    m --json stat "$b/hello.txt"
    bv_eq "basic/stat-size" "15" "$(printf '%s' "$MOUT" | python3 -c 'import json,sys; print(json.loads(sys.stdin.readline())["size"])')"
    bv_eq "basic/stat-etag" "$(python3 -c 'import hashlib;print(hashlib.md5(open("'"$W/hello.txt"'","rb").read()).hexdigest())')" "$(printf '%s' "$MOUT" | python3 -c 'import json,sys; print(json.loads(sys.stdin.readline())["etag"].strip(chr(34)).split("-")[0])')"
    mx "basic/get" get "$b/hello.txt" "$d/got.txt"; bv_eq "basic/get-body" "hello binvault" "$(cat "$d/got.txt" 2>/dev/null)"
    mx "basic/put" put "$W/hello.txt" "$b/put.txt"
    mx "basic/cp-download" cp "$b/hello.txt" "$d/dl.txt"; bv_eq "basic/cp-download-body" "hello binvault" "$(cat "$d/dl.txt" 2>/dev/null)"
    mxe "basic/stat-missing" 'does not exist|Object does not exist|NoSuchKey|not found' stat "$b/never"
    mxe "basic/cat-missing" 'does not exist|NoSuchKey|not found' cat "$b/never"
    mx "basic/ls-prefix" ls "$b/"; bv_contains "basic/ls-prefix-lists-the-keys" "$MOUT" "hello.txt"
    m --json ls "$b/"; bv_eq "basic/ls-json-count" "2" "$(nfiles)"
    mx "basic/find" find "$b/" --name '*.txt'
    bv_eq "basic/find-count" "2" "$(printf '%s\n' "$MOUT" | grep -c .)"
    mx "basic/tree" tree "bv/$PB"
    mx "basic/du" du "$b/"
    mx "basic/rm" rm "$b/put.txt"
    keys_eq "basic/rm-removed-it" plain basic/ basic/hello.txt
    mx "basic/pipe" pipe "$b/piped.txt" < "$W/hello.txt"
    mx "basic/pipe-roundtrip" cat "$b/piped.txt"; bv_eq "basic/pipe-body" "hello binvault" "$MOUT"
    mx "basic/pipe-big-stream" pipe "$b/piped-big" < "$W/f_12m"
    bv_eq "basic/pipe-big-size" "12582912" "$(head_hdr plain basic/piped-big content-length)"
    mx "basic/rm-recursive" rm --recursive --force "$b/"
    keys_eq "basic/rm-recursive-emptied-the-prefix" plain basic/
}

# ================================================================================================
g_xfer() {
    local d="$G_DIR" b="bv/$PB/xfer" files
    files="$($TU count "$TREE")"
    bv_age_files "$TREE"   # whole-second S3 timestamps: files written in the second of their upload would look newer to mc diff
    mx "xfer/cp-recursive-upload" cp --recursive "$TREE/" "$b/"
    bv_eq "xfer/remote-count" "$files" "$(count_keys plain xfer/)"
    python3 - "$TREE" > "$d/expected.keys" <<'PY'
import os, sys
root = sys.argv[1]
for dp, dn, fn in os.walk(root):
    for f in fn:
        print("xfer/" + os.path.relpath(os.path.join(dp, f), root).replace(os.sep, "/"))
PY
    got="$(probe plain list xfer/ | python3 -c 'import json,sys; print("\n".join(sorted(json.load(sys.stdin), key=lambda k: k.encode())))')"
    want="$(LC_ALL=C sort "$d/expected.keys")"
    if [ "$got" = "$want" ]; then bv_pass "xfer/remote-keys-exact-set"; else bv_fail "xfer/remote-keys-exact-set" "$(diff <(printf '%s\n' "$got") <(printf '%s\n' "$want") | head -n 6 | tr '\n' ' ')"; fi
    mx "xfer/diff-after-upload-is-empty" diff "$TREE/" "$b/"
    bv_eq "xfer/diff-output-empty" "" "$(printf '%s' "$MOUT" | tr -d ' \n')"
    mkdir -p "$d/down"
    mx "xfer/cp-recursive-download" cp --recursive "$b/" "$d/down/"
    if diff -r "$TREE" "$d/down" >/dev/null 2>&1; then bv_pass "xfer/download-identical"; else bv_fail "xfer/download-identical" "$(diff -rq "$TREE" "$d/down" 2>&1 | head -n 3)"; fi
    mx "xfer/ls-recursive-summarize" ls --recursive --summarize "$b/"
    bv_contains "xfer/summarize-object-count" "$MOUT" "Total Objects: $files"
    mx "xfer/du" du "$b/"
    mx "xfer/mirror-is-a-no-op-when-equal" mirror "$TREE/" "$b/"
    cp -R "$TREE" "$d/work"
    rm -rf "$d/work/many/f00"* "$d/work/a"
    printf 'new file\n' > "$d/work/new.txt"
    bv_age_files "$d/work"   # whole-second S3 timestamps: a file written in the second of its upload would look newer to mc diff
    mx "xfer/mirror-with-remove" mirror --overwrite --remove "$d/work/" "$b/"
    bv_eq "xfer/mirror-remote-count" "$($TU count "$d/work")" "$(count_keys plain xfer/)"
    mx "xfer/diff-finds-nothing-after-mirror" diff "$d/work/" "$b/"
    bv_eq "xfer/diff-empty" "" "$(printf '%s' "$MOUT" | tr -d ' \n')"
    printf 'changed\n' > "$d/work/new.txt"; printf 'extra\n' > "$d/work/extra.txt"
    m diff "$d/work/" "$b/"
    bv_contains "xfer/diff-reports-the-changed-file" "$MOUT" "new.txt"
    bv_contains "xfer/diff-reports-the-extra-file" "$MOUT" "extra.txt"
    mx "xfer/cp-server-side-copy" cp "$b/one.txt" "bv/$PB/xfer-copy/one.txt"
    mx "xfer/cp-server-side-recursive" cp --recursive "$b/many/" "bv/$PB/xfer-copy/many/"
    bv_eq "xfer/copy-count" "$(( $(count_keys plain xfer/many/) + 1 ))" "$(count_keys plain xfer-copy/)"
    mx "xfer/mv-remote-to-remote" mv "bv/$PB/xfer-copy/one.txt" "bv/$PB/xfer-moved.txt"
    keys_eq "xfer/mv-moved-the-key" plain xfer-moved xfer-moved.txt
    cp "$W/hello.txt" "$d/tomove.txt"
    mx "xfer/mv-local-to-remote" mv "$d/tomove.txt" "bv/$PB/xfer-moved2.txt"
    [ ! -e "$d/tomove.txt" ] && bv_pass "xfer/mv-removed-the-local-file" || bv_fail "xfer/mv-removed-the-local-file" "still there"
    mx "xfer/rm-recursive" rm --recursive --force "bv/$PB/xfer/"
    mx "xfer/rm-recursive-copies" rm --recursive --force "bv/$PB/xfer-copy/"
    mx "xfer/rm-moved" rm --force "bv/$PB/xfer-moved.txt" "bv/$PB/xfer-moved2.txt"
    keys_eq "xfer/clean" plain xfer
}

# ================================================================================================
g_multi() {
    local d="$G_DIR" b="bv/$PB/multi" etag
    mx "multi/cp-40mib" cp "$W/f_40m" "$b/f40"
    bv_eq "multi/size" "41943040" "$(head_hdr plain multi/f40 content-length)"
    etag="$(head_hdr plain multi/f40 etag)"
    case "$etag" in *-[0-9]\") bv_pass "multi/etag-is-composite" ;; *) bv_fail "multi/etag-is-composite" "ETag $etag" ;; esac
    mx "multi/download-40mib" cp "$b/f40" "$d/f40"
    bv_eq "multi/download-sha256" "$(bv_sha256 "$W/f_40m")" "$(bv_sha256 "$d/f40" 2>/dev/null)"
    mx "multi/od-upload-parallel-parts" od if="$W/f_12m" of="$b/od12" size=12MiB parts=4
    bv_eq "multi/od-uploaded-size" "12582912" "$(head_hdr plain multi/od12 content-length)"
    mx "multi/cp-5mib-exactly" cp "$W/f_5m" "$b/f5"
    bv_eq "multi/5mib-size" "5242880" "$(head_hdr plain multi/f5 content-length)"
    m --json ls --incomplete "bv/$PB/"
    bv_eq "multi/no-incomplete-uploads-left" "0" "$(probe plain mpu-list | python3 -c 'import json,sys; print(len([u for u in json.load(sys.stdin) if u["key"].startswith("multi/")]))')"
    mx "multi/cp-recursive-mixed-sizes" cp --recursive "$W/" "bv/$PB/multi-w/"
    mx "multi/rm" rm --recursive --force "bv/$PB/multi/"
    mx "multi/rm-w" rm --recursive --force "bv/$PB/multi-w/"
}

# ================================================================================================
g_meta() {
    local d="$G_DIR" b="bv/$PB/meta" share
    mx "meta/cp-with-attributes" cp --attr "Cache-Control=max-age=60;Content-Disposition=inline;x-amz-meta-owner=me" "$W/hello.txt" "$b/attr.txt"
    bv_eq "meta/cache-control" "max-age=60" "$(head_hdr plain meta/attr.txt cache-control)"
    bv_eq "meta/user-metadata" "me" "$(head_hdr plain meta/attr.txt x-amz-meta-owner)"
    mx "meta/cp-with-content-type" cp --attr "Content-Type=text/x-mc" "$W/hello.txt" "$b/ct.txt"
    bv_eq "meta/content-type" "text/x-mc" "$(head_hdr plain meta/ct.txt content-type)"
    mx "meta/cp-with-tags" cp --tags "env=prod&team=core" "$W/hello.txt" "$b/tagged.txt"
    mx "meta/tag-list" tag list "$b/tagged.txt"
    bv_contains "meta/tag-list-has-env" "$MOUT" "env"
    mx "meta/tag-set" tag set "$b/tagged.txt" "a=1&b=2&c=3"
    m --json tag list "$b/tagged.txt"
    bv_contains "meta/tag-set-took-effect" "$MOUT" '"c"'
    mx "meta/tag-remove" tag remove "$b/tagged.txt"
    m tag list "$b/tagged.txt"
    bv_eq "meta/tags-removed" "0" "$(printf '%s\n' "$MOUT" | grep -c '[a-z]=')"
    mx "meta/storage-class-standard" cp --storage-class STANDARD "$W/hello.txt" "$b/sc.txt"
    mxe "meta/storage-class-glacier-refused" 'InvalidStorageClass|storage class' cp --storage-class GLACIER "$W/hello.txt" "$b/sc2.txt"
    mx "meta/sse-s3-header" cp --enc-s3 "bv/$PB/meta/" "$W/hello.txt" "$b/sse.txt"
    bv_eq "meta/sse-s3-reported" "AES256" "$(head_hdr plain meta/sse.txt x-amz-server-side-encryption)"
    mxe "meta/sse-kms-refused" 'NotImplemented|not implemented|501' cp --enc-kms "bv/$PB/meta/=my-key" "$W/hello.txt" "$b/kms.txt"
    m encrypt info "bv/$PB"
    if [ "$MRC" -ne 0 ] && printf '%s' "$MALL" | grep -qi 'encryption configuration was not found'; then bv_pass "meta/encrypt-info-none-configured"; else bv_fail "meta/encrypt-info-none-configured" "exit $MRC: $MALL"; fi
    mx "meta/encrypt-info-on-the-sse-bucket" encrypt info "bvv/$VB"
    bv_contains "meta/encrypt-info-says-sse-s3" "$MOUT" "sse-s3"
    m ilm rule ls "bv/$PB"
    if [ "$MRC" -eq 0 ] || printf '%s' "$MALL" | grep -qi 'lifecycle\|no rules\|not found'; then bv_pass "meta/ilm-rule-ls-without-rules"; else bv_fail "meta/ilm-rule-ls-without-rules" "$MALL"; fi
    mx "meta/event-list" event list "bv/$PB"
    mx "meta/version-info" version info "bv/$PB"
    m cors get "bv/$PB"
    if [ "$MRC" -eq 0 ] || printf '%s' "$MALL" | grep -qi 'cors\|no such\|not found'; then bv_pass "meta/cors-get-without-rules"; else bv_fail "meta/cors-get-without-rules" "$MALL"; fi
    mxe "meta/version-enable-is-admin-only" 'AccessDenied|Access Denied|admin API' version enable "bv/$PB"
    mxe "meta/ilm-rule-add-is-admin-only" 'AccessDenied|Access Denied|admin API' ilm rule add --expire-days 1 "bv/$PB"
    mxe "meta/anonymous-set-is-not-supported" 'AccessDenied|Access Denied|NotImplemented|not implemented|admin API' anonymous set public "bv/$PB"
    mx "meta/anonymous-get" anonymous get "bv/$PB"
    m retention info --default "bv/$PB"
    if printf '%s' "$MALL" | grep -qi 'ObjectLockConfigurationNotFound\|not found\|object lock\|does not support locking'; then bv_pass "meta/retention-info-not-configured"; else bv_fail "meta/retention-info-not-configured" "$MALL"; fi
    # --- presigned download and upload forms
    mx "meta/share-download" share download --expire 5m "$b/attr.txt"
    share="$(printf '%s\n' "$MOUT" | sed -n 's/^Share: *//p' | head -n 1)"
    if [ -n "$share" ]; then
        if [ "$(curl -s -o /dev/null -w '%{http_code}' "$share")" = 200 ] && [ "$(curl -s "$share")" = "hello binvault" ]; then bv_pass "meta/share-download-url-works"; else bv_fail "meta/share-download-url-works" "$share"; fi
    else bv_fail "meta/share-download-url-works" "no URL in: $MOUT"; fi
    mx "meta/share-upload-form" share upload --recursive --expire 5m "bv/$PB/meta/form/"
    share="$(printf '%s\n' "$MOUT" | sed -n 's/^Share: *\(curl .*\)$/\1/p' | head -n 1)"
    if [ -n "$share" ]; then
        echo "form upload through the POST policy" > "$d/form.txt"
        share="${share//<FILE>/$d/form.txt}"; share="${share//<NAME>/form.txt}"
        if eval "$share" >/dev/null 2>&1; then bv_pass "meta/share-upload-form-curl"; else bv_fail "meta/share-upload-form-curl" "$(eval "$share" 2>&1 | tail -n 3)"; fi
        keys_eq "meta/share-upload-stored-the-file" plain meta/form/ meta/form/form.txt
    else bv_fail "meta/share-upload-form-curl" "no curl line in: $(printf '%s' "$MOUT" | head -c 300)"; fi
    mx "meta/rm" rm --recursive --force "bv/$PB/meta/"
}

# ================================================================================================
g_ver() {
    local d="$G_DIR" b="bvv/$VB/mv" v1 v2 vm
    mx "ver/info-says-enabled" version info "bvv/$VB"
    bv_contains "ver/info-enabled" "$MOUT" "enabled"
    printf 'one\n' > "$d/f"; mx "ver/put-1" cp "$d/f" "$b/k"
    printf 'two two\n' > "$d/f"; mx "ver/put-2" cp "$d/f" "$b/k"
    m --json ls --versions "$b/k"
    bv_eq "ver/ls-versions-count" "2" "$(nfiles)"
    v2="$(printf '%s\n' "$MOUT" | python3 -c 'import json,sys; print(json.loads(sys.stdin.readline())["versionId"])')"
    v1="$(printf '%s\n' "$MOUT" | python3 -c 'import json,sys; l=sys.stdin.readlines(); print(json.loads(l[1])["versionId"])')"
    mx "ver/cat-old-version" cat --version-id "$v1" "$b/k"; bv_eq "ver/old-version-body" "one" "$MOUT"
    mx "ver/stat-by-version" stat --version-id "$v2" "$b/k"
    mx "ver/rm-adds-a-marker" rm "$b/k"
    mxe "ver/cat-after-delete-fails" 'does not exist|NoSuchKey|not found|delete marker' cat "$b/k"
    m --json ls --versions "$b/k"
    bv_contains "ver/marker-listed" "$MOUT" '"isDeleteMarker":true'
    vm="$(printf '%s\n' "$MOUT" | python3 -c 'import json,sys
for l in sys.stdin:
    j = json.loads(l)
    if j.get("isDeleteMarker"): print(j["versionId"]); break')"
    mx "ver/rm-the-marker-restores-the-key" rm --version-id "$vm" "$b/k"
    mx "ver/key-is-back" cat "$b/k"; bv_eq "ver/key-is-back-body" "two two" "$MOUT"
    mx "ver/rm-a-single-version" rm --version-id "$v1" "$b/k"
    bv_eq "ver/one-version-left" "1" "$(probe versioned versions mv/k | python3 -c 'import json,sys; print(len([v for v in json.load(sys.stdin) if not v["marker"]]))')"
    mx "ver/sse-bucket-upload" cp "$W/f_1m" "$b/enc"
    bv_eq "ver/sse-reported" "AES256" "$(head_hdr versioned mv/enc x-amz-server-side-encryption)"
    mx "ver/multipart-into-a-versioned-bucket" cp "$W/f_40m" "$b/big"
    bv_eq "ver/multipart-has-a-version-id" "yes" "$(probe versioned versions mv/big | python3 -c 'import json,sys; v=json.load(sys.stdin); print("yes" if v and v[0]["version"] else "no")')"
    mx "ver/rm-versions-recursive" rm --recursive --versions --force "$b/"
    bv_eq "ver/nothing-left-at-all" "0" "$(probe versioned versions mv/ | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')"
}

# ================================================================================================
g_anon() {
    local d="$G_DIR"
    mx "anon/seed" cp --attr "Cache-Control=public, max-age=60" "$W/hello.txt" "bvp/$PUB/anon/h.txt"
    mx "anon/anonymous-cat" cat "bva/$PUB/anon/h.txt"; bv_eq "anon/anonymous-body" "hello binvault" "$MOUT"
    mx "anon/anonymous-get" cp "bva/$PUB/anon/h.txt" "$d/h.txt"; bv_eq "anon/anonymous-download" "hello binvault" "$(cat "$d/h.txt" 2>/dev/null)"
    mxe "anon/anonymous-ls-denied" "$DENIED" ls "bva/$PUB/anon/"
    mxe "anon/anonymous-put-denied" "$DENIED" cp "$W/hello.txt" "bva/$PUB/anon/evil.txt"
    mxe "anon/anonymous-rm-denied" "$DENIED" rm "bva/$PUB/anon/h.txt"
    mxe "anon/private-bucket-denied" "$DENIED" cat "bva/$PB/basic/hello.txt"
    mx "anon/cleanup" rm --recursive --force "bvp/$PUB/anon/"
}

# ================================================================================================
g_rules() {
    local d="$G_DIR"
    head -c 3000000 /dev/urandom > "$d/3m"
    mx "rules/quota-first-3mb" cp "$d/3m" "bvq/$QB/m/a"
    mx "rules/quota-second-3mb" cp "$d/3m" "bvq/$QB/m/b"
    mxe "rules/quota-third-3mb-refused" 'QuotaExceeded' cp "$d/3m" "bvq/$QB/m/c"
    mxe "rules/quota-multipart-refused" 'QuotaExceeded' cp "$W/f_40m" "bvq/$QB/m/big"
    bv_eq "rules/quota-refused-multipart-aborted" "0" "$(probe quota mpu-list | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')"
    keys_eq "rules/quota-only-two-stored" quota m/ m/a m/b
    mx "rules/quota-rm" rm --recursive --force "bvq/$QB/m/"
    mx "rules/ctype-png-ok" cp "$W/pic.png" "bvc/$CB/r/pic.png"
    mx "rules/ctype-text-ok" cp "$W/hello.txt" "bvc/$CB/r/hello.txt"
    mxe "rules/ctype-pdf-refused" 'ContentTypeNotAllowed' cp "$W/doc.pdf" "bvc/$CB/r/doc.pdf"
    mxe "rules/ctype-declared-type-is-not-trusted" 'ContentTypeNotAllowed' cp --attr "Content-Type=image/png" "$W/doc.pdf" "bvc/$CB/r/fake.png"
    keys_eq "rules/ctype-only-the-allowed-ones" ctype r/ r/pic.png r/hello.txt
    mx "rules/ctype-rm" rm --recursive --force "bvc/$CB/r/"
}

# ================================================================================================
g_odd() {
    local d="$G_DIR" id key
    for id in $($OK ids); do
        case "$id" in
            leading-slash|double-slash|dot-segment|dotdot-segment|trailing-slash|len-1024|len-1024-multibyte|combining|nfc) continue ;;   # the client cleans these paths itself
        esac
        key="$($OK key "$id")"
        printf 'body of %s\n' "$id" > "$d/body"
        mx "odd-$id/pipe" pipe "bv/$PB/odd/$key" < "$d/body"
        if probe plain list odd/ | python3 -c 'import json,sys; k=json.load(sys.stdin); sys.exit(0 if sys.argv[1] in k else 1)' "odd/$key"; then bv_pass "odd-$id/stored-byte-exact"; else bv_fail "odd-$id/stored-byte-exact" "the key is not in the independent listing"; fi
        m cat "bv/$PB/odd/$key"; bv_eq "odd-$id/cat" "body of $id" "$MOUT"
        mx "odd-$id/stat" stat "bv/$PB/odd/$key"
        mx "odd-$id/rm" rm "bv/$PB/odd/$key"
        if probe plain list odd/ | python3 -c 'import json,sys; k=json.load(sys.stdin); sys.exit(1 if sys.argv[1] in k else 0)' "odd/$key"; then bv_pass "odd-$id/deleted"; else bv_fail "odd-$id/deleted" "still listed"; fi
    done
}

# ================================================================================================
for g in $GROUPS_RUN; do
    case " $GROUPS_ALL " in *" $g "*) ;; *) bv_warn "unknown mc group '$g'"; continue ;; esac
    G_DIR="$W/g_$g"; rm -rf "$G_DIR"; mkdir -p "$G_DIR"
    "g_$g"
done
exit 0
