#!/usr/bin/env bash
# suite rclone: rclone (Docker image rclone/rclone, or a native rclone) with provider "Other", configured through RCLONE_CONFIG_* variables -
# lsd/ls/lsjson, copy/sync/check/move/delete/purge, multipart with small chunks, --checksum / --size-only / --update, rcat, touch,
# --s3-no-check-bucket, listing versions 1 and 2, --fast-list, versions, anonymous access, quota and content rules, odd keys.
# Env (development): BV_IMG_RCLONE (image), RCLONE_GROUPS (space separated subset of: basic copy multi list ver anon rules odd tokens).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
. "$HERE/../../support/common.sh"

IMG="${BV_IMG_RCLONE:-rclone/rclone}"
W="$BV_SUITE_DIR/w"; mkdir -p "$W"
EP="$BV_TOOL_ENDPOINT"
PB="$BV_PLAIN_BUCKET"; VB="$BV_VERSIONED_BUCKET"; PUB="$BV_PUBLIC_BUCKET"; QB="$BV_QUOTA_BUCKET"; CB="$BV_CTYPE_BUCKET"
REGION="${BV_REGION:-us-east-1}"
GROUPS_ALL="basic copy multi list ver anon rules odd tokens flags"
GROUPS_RUN="${RCLONE_GROUPS:-$GROUPS_ALL}"
PROBE="python3 $HERE/s3probe.py"
TU="python3 $HERE/treeutil.py"
OK="python3 $HERE/oddkeys.py"
export BV_ENDPOINT

# ------------------------------------------------------------------------------------------------
# how to run rclone: a long-lived container (docker exec is much faster than docker run) or a native binary

MODE=""; CID=""
if [ "${BV_DOCKER:-0}" = 1 ]; then
    if ! bv_pull "$IMG"; then bv_skip "rclone/_setup" "cannot pull image $IMG (offline?)"; exit 0; fi
    MODE=docker
elif bv_have rclone; then
    MODE=native
else
    bv_skip "rclone/_setup" "neither Docker nor a native rclone is available"; exit 0
fi
cleanup() { [ -n "$CID" ] && docker rm -f "$CID" >/dev/null 2>&1; return 0; }
trap cleanup EXIT
if [ "$MODE" = docker ]; then
    CID="$(bv_docker -d -u "$(id -u):$(id -g)" -e HOME=/tmp --entrypoint sleep "$IMG" infinity 2>&1)" || { bv_skip "rclone/_setup" "cannot start the rclone container: $CID"; CID=""; exit 0; }
fi

# remotes: bv (plain) bvv (versioned) bvp (public) bvq (quota) bvc (ctype) bva (anonymous, public bucket)
REMOTE_ENV=()
add_remote() { # NAME AK SK
    local n="$1" N; N="$(printf '%s' "$1" | tr a-z A-Z)"
    REMOTE_ENV+=("RCLONE_CONFIG_${N}_TYPE=s3" "RCLONE_CONFIG_${N}_PROVIDER=Other" "RCLONE_CONFIG_${N}_ENDPOINT=$EP" "RCLONE_CONFIG_${N}_REGION=$REGION"
                 "RCLONE_CONFIG_${N}_ENV_AUTH=false" "RCLONE_CONFIG_${N}_ACCESS_KEY_ID=$2" "RCLONE_CONFIG_${N}_SECRET_ACCESS_KEY=$3")
}
add_remote bv "$BV_PLAIN_AK" "$BV_PLAIN_SK"
add_remote bvv "$BV_VERSIONED_AK" "$BV_VERSIONED_SK"
add_remote bvp "$BV_PUBLIC_AK" "$BV_PUBLIC_SK"
add_remote bvq "$BV_QUOTA_AK" "$BV_QUOTA_SK"
add_remote bvc "$BV_CTYPE_AK" "$BV_CTYPE_SK"
add_remote bva "" ""

# rclone ARGS...   - stdin comes from $RC_IN when set; EXTRA_ENV (array) adds variables for one call
EXTRA_ENV=()
rclone_run() {
    if [ "$MODE" = docker ]; then
        local -a fl=(); local e
        for e in "${REMOTE_ENV[@]}" ${EXTRA_ENV[@]+"${EXTRA_ENV[@]}"}; do fl+=(-e "$e"); done
        if [ -n "${RC_IN:-}" ]; then
            docker exec -i "${fl[@]}" -w "$BV_SUITE_DIR" "$CID" timeout -k 5 600 rclone --config /dev/null "$@" < "$RC_IN"
        else
            docker exec "${fl[@]}" -w "$BV_SUITE_DIR" "$CID" timeout -k 5 600 rclone --config /dev/null "$@" < /dev/null
        fi
    else
        if [ -n "${RC_IN:-}" ]; then env "${REMOTE_ENV[@]}" ${EXTRA_ENV[@]+"${EXTRA_ENV[@]}"} rclone --config /dev/null "$@" < "$RC_IN"
        else env "${REMOTE_ENV[@]}" ${EXTRA_ENV[@]+"${EXTRA_ENV[@]}"} rclone --config /dev/null "$@" < /dev/null; fi
    fi
}

# rc ARGS...      run rclone; sets RCOUT RCERR RCALL RCRC (no result line)
rc() {
    local ef="$G_DIR/.err.$RANDOM$RANDOM"
    RCOUT="$(rclone_run "$@" 2>"$ef")"; RCRC=$?
    RCERR="$(cat "$ef" 2>/dev/null)"; rm -f "$ef"
    RCALL="$RCOUT
$RCERR"
    return 0
}
# rcx CASE ARGS...   PASS when rclone exits 0
rcx() { local n="$1"; shift; rc "$@"; if [ "$RCRC" -eq 0 ]; then bv_pass "$n"; else bv_fail "$n" "exit $RCRC: $(printf '%s' "$RCERR$RCOUT" | tail -n 4)"; fi; }
# rcxe CASE PATTERN ARGS...   PASS when rclone exits non-zero and its output matches PATTERN
rcxe() {
    local n="$1" pat="$2"; shift 2; rc "$@"
    if [ "$RCRC" -eq 0 ]; then bv_fail "$n" "expected failure but rclone succeeded: $(printf '%s' "$RCALL" | tail -n 3)"
    elif printf '%s' "$RCALL" | grep -Eqi -- "$pat"; then bv_pass "$n"
    else bv_fail "$n" "exit $RCRC but output does not match /$pat/: $(printf '%s' "$RCALL" | tail -n 4)"; fi
}
# probe KIND ARGS...   independent view of the bucket (the client under test is not trusted)
probe() { local k="$1"; shift; $PROBE --kind "$k" "$@"; }
# keys_eq CASE KIND PREFIX expected-key...   the bucket holds exactly these keys under PREFIX (sorted bytewise)
keys_eq() {
    local n="$1" kind="$2" prefix="$3"; shift 3
    local got want
    got="$(probe "$kind" list "$prefix" | python3 -c 'import json,sys; print("\n".join(sorted(json.load(sys.stdin), key=lambda k: k.encode())))')"
    want="$(printf '%s\n' "$@" | python3 -c 'import sys; print("\n".join(sorted([l.rstrip("\n") for l in sys.stdin if l.strip()], key=lambda k: k.encode())))')"
    if [ "$got" = "$want" ]; then bv_pass "$n"; else bv_fail "$n" "stored keys differ. stored: $(printf '%s' "$got" | head -c 300 | tr '\n' ' ') | expected: $(printf '%s' "$want" | head -c 300 | tr '\n' ' ')"; fi
}
count_keys() { probe "$1" list "$2" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))'; }
nonblank_str() { printf '%s' "$1" | tr -d ' \n\t\r'; }
# rc_log_count PATTERN   how many lines of RCALL match
rc_lines() { printf '%s\n' "$RCALL" | grep -Ec -- "$1"; }

# local fixtures
TREE="$W/tree"
if [ ! -d "$TREE" ]; then
    $TU gen "$TREE"
    # whole-second mtimes: S3 stores them as metadata and every filesystem round-trips them exactly
    python3 - "$TREE" <<'PY'
import os, sys
for dp, dn, fn in os.walk(sys.argv[1]):
    for f in fn:
        os.utime(os.path.join(dp, f), (1577836800, 1577836800))
PY
fi
mkfx() { [ -f "$W/$1" ] || bv_mkfile "$W/$1" "$2"; }
mkfx f_20m 20971520
mkfx f_12m 12582912
mkfx f_1m 1048576
printf 'hello binvault\n' > "$W/hello.txt"
$TU png "$W/pic.png"
python3 - "$W" <<'PY'
import sys, os
w = sys.argv[1]
open(os.path.join(w, "doc.pdf"), "wb").write(b"%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%EOF\n")
open(os.path.join(w, "page.html"), "wb").write(b"<!DOCTYPE html><html><body>hi</body></html>\n")
PY

bv_info "rclone ($MODE): $(rclone_run version 2>&1 | head -n 1)"
G_DIR="$W"
rc lsd bv:
if [ "$RCRC" -ne 0 ]; then bv_skip "rclone/_setup" "rclone cannot reach the node at $EP: $(printf '%s' "$RCERR" | tail -n 2)"; exit 0; fi

CNT=0
# ================================================================================================
# group: basic - buckets, listings, single objects
# ================================================================================================
g_basic() {
    local d="$G_DIR" b="bv:$PB/basic"
    rcx "basic/lsd-lists-the-token-bucket" lsd bv:
    bv_contains "basic/lsd-shows-the-bucket" "$RCOUT" "$PB"
    bv_eq "basic/lsd-shows-only-one-bucket" "1" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "basic/mkdir-existing-bucket" mkdir "bv:$PB"
    rcx "basic/mkdir-prefix" mkdir "$b/sub"
    rcxe "basic/mkdir-foreign-bucket-denied" 'AccessDenied|Forbidden|403|NoSuchBucket' mkdir "bv:bvt-rclone-brand-new-bucket"
    rcxe "basic/rmdir-bucket-denied" 'AccessDenied|Forbidden|403|BucketNotEmpty|directory not empty' rmdir "bv:$PB"
    RC_IN="$W/hello.txt" rcx "basic/rcat-small" rcat "$b/hello.txt"
    unset RC_IN
    rcx "basic/cat" cat "$b/hello.txt"; bv_eq "basic/cat-body" "hello binvault" "$RCOUT"
    rcx "basic/lsjson" lsjson "$b" --hash
    bv_eq "basic/lsjson-name" "hello.txt" "$(printf '%s' "$RCOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["Name"])')"
    bv_eq "basic/lsjson-size" "15" "$(printf '%s' "$RCOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0]["Size"])')"
    bv_eq "basic/lsjson-md5-is-the-etag" "$(python3 -c 'import hashlib;print(hashlib.md5(open("'"$W/hello.txt"'","rb").read()).hexdigest())')" "$(printf '%s' "$RCOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)[0].get("Hashes",{}).get("md5",""))')"
    rcx "basic/md5sum" md5sum "$b"
    bv_contains "basic/md5sum-line" "$RCOUT" "hello.txt"
    rcx "basic/size" size "$b" --json
    bv_eq "basic/size-count" "1" "$(printf '%s' "$RCOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["count"])')"
    rcx "basic/listing-a-missing-prefix-is-empty-not-an-error" lsf "$b/never-there-dir"
    bv_eq "basic/missing-prefix-output-empty" "" "$(nonblank_str "$RCOUT")"
    rcx "basic/touch-creates-an-empty-object" touch "$b/touched"
    bv_eq "basic/touched-size" "0" "$(probe plain head basic/touched | python3 -c 'import json,sys; print(json.load(sys.stdin)["headers"].get("content-length"))')"
    rcx "basic/touch-sets-the-mtime-with-a-self-copy" touch -t 2020-02-03T04:05:06 "$b/touched"
    rcx "basic/lsl-shows-the-new-mtime" lsl "$b/touched"
    bv_contains "basic/touched-mtime" "$RCOUT" "2020-02-03 04:05:06"
    rcx "basic/deletefile" deletefile "$b/touched"
    keys_eq "basic/deleted-is-gone" plain basic/ basic/hello.txt
    rcx "basic/delete-prefix" delete "$b"
    keys_eq "basic/prefix-empty" plain basic/
    rcx "basic/lsf-empty-prefix" lsf "$b"
}

# ================================================================================================
# group: copy - trees in both directions, sync, check, update modes
# ================================================================================================
g_copy() {
    local d="$G_DIR" b="bv:$PB/tree" n files
    files="$($TU count "$TREE")"
    rcx "copy/upload-tree" copy "$TREE" "$b" --transfers 8 --checkers 8
    bv_eq "copy/remote-key-count" "$files" "$(count_keys plain tree/)"
    python3 - "$TREE" > "$d/expected.keys" <<'PY'
import os, sys
root = sys.argv[1]
for dp, dn, fn in os.walk(root):
    for f in fn:
        print("tree/" + os.path.relpath(os.path.join(dp, f), root).replace(os.sep, "/"))
PY
    got="$(probe plain list tree/ | python3 -c 'import json,sys; print("\n".join(sorted(json.load(sys.stdin), key=lambda k: k.encode())))')"
    want="$(LC_ALL=C sort "$d/expected.keys")"
    if [ "$got" = "$want" ]; then bv_pass "copy/remote-keys-exact-set"; else bv_fail "copy/remote-keys-exact-set" "$(diff <(printf '%s\n' "$got") <(printf '%s\n' "$want") | head -n 6 | tr '\n' ' ')"; fi
    rcx "copy/check-after-upload" check "$TREE" "$b"
    rcx "copy/check-download-after-upload" check "$TREE" "$b" --download
    rcx "copy/second-copy-transfers-nothing" copy "$TREE" "$b" -vv --stats 0
    bv_eq "copy/second-copy-copied-nothing" "0" "$(rc_lines ': Copied \(')"
    rcx "copy/size-and-count" size "$b" --json
    bv_eq "copy/size-bytes" "$($TU bytes "$TREE")" "$(printf '%s' "$RCOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["bytes"])')"
    mkdir -p "$d/down"
    rcx "copy/download-tree" copy "$b" "$d/down" --transfers 8
    if diff -r "$TREE" "$d/down" >/dev/null 2>&1; then bv_pass "copy/download-identical"; else bv_fail "copy/download-identical" "$(diff -rq "$TREE" "$d/down" 2>&1 | head -n 3)"; fi
    rcx "copy/download-again-transfers-nothing" copy "$b" "$d/down" -vv --stats 0
    bv_eq "copy/download-again-copied-nothing" "0" "$(rc_lines ': Copied \(')"
    rcx "copy/ls-recursive" ls "$b"
    bv_eq "copy/ls-line-count" "$files" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "copy/lsf-recursive-dirs" lsf -R --dirs-only "$b"
    bv_contains "copy/lsf-has-nested-dir" "$RCOUT" "a/b/c/"

    # --- change detection: size+mtime (default), --checksum, --size-only, --update, --ignore-existing
    cp -Rp "$TREE" "$d/work"
    printf 'xxx\n' > "$d/work/one.txt"                      # the same 4 bytes as "one\n", other content ...
    $TU setmtime "$d/work/one.txt" "$($TU mtime "$TREE/one.txt")"   # ... and the very same mtime
    rcx "copy/default-misses-a-same-size-same-mtime-change" copy "$d/work" "$b" -vv --stats 0
    bv_eq "copy/default-copied-nothing" "0" "$(rc_lines ': Copied \(')"
    rcx "copy/checksum-finds-it" copy "$d/work" "$b" --checksum -vv --stats 0
    bv_eq "copy/checksum-copied-one-file" "1" "$(rc_lines ': Copied \(')"
    rcx "" cat "$b/one.txt"; bv_eq "copy/checksum-content-updated" "xxx" "$RCOUT"
    printf 'sizechange-longer\n' > "$d/work/one.txt"
    rcx "copy/size-change-is-detected" copy "$d/work" "$b" -vv --stats 0
    bv_eq "copy/size-change-copied-one" "1" "$(rc_lines ': Copied \(')"
    printf 'SAMESIZE-LONGER!!\n' > "$d/work/one.txt"
    rcx "copy/size-only-ignores-it" copy "$d/work" "$b" --size-only -vv --stats 0
    bv_eq "copy/size-only-copied-nothing" "0" "$(rc_lines ': Copied \(')"
    rcx "copy/update-newer-local-wins" copy "$d/work" "$b" --update -vv --stats 0
    bv_eq "copy/update-copied-one" "1" "$(rc_lines ': Copied \(')"
    printf 'ignored change\n' > "$d/work/one.txt"
    rcx "copy/ignore-existing" copy "$d/work" "$b" --ignore-existing -vv --stats 0
    bv_eq "copy/ignore-existing-copied-nothing" "0" "$(rc_lines ': Copied \(')"

    # --- sync removes what is gone locally; --dry-run touches nothing
    rm -rf "$d/work/many" "$d/work/a"
    rcx "copy/sync-dry-run" sync "$d/work" "$b" --dry-run
    bv_eq "copy/dry-run-changed-nothing" "$files" "$(count_keys plain tree/)"
    rcx "copy/sync-deletes-extraneous" sync "$d/work" "$b" --transfers 8
    bv_eq "copy/sync-remote-count" "$($TU count "$d/work")" "$(count_keys plain tree/)"
    rcx "copy/check-after-sync" check "$d/work" "$b"
    rcx "copy/sync-delete-before" sync "$d/work" "$b" --delete-before
    rcx "copy/purge-prefix" purge "$b"
    bv_eq "copy/purge-removed-everything" "0" "$(count_keys plain tree/)"

    # --- single files and moves
    rcx "copy/copyto" copyto "$W/hello.txt" "bv:$PB/mv/a.txt"
    rcx "copy/copyto-server-side" copyto "bv:$PB/mv/a.txt" "bv:$PB/mv/b.txt"
    rcx "copy/moveto-server-side" moveto "bv:$PB/mv/b.txt" "bv:$PB/mv/c.txt"
    keys_eq "copy/moveto-left-only-the-target" plain mv/ mv/a.txt mv/c.txt
    cp "$W/hello.txt" "$d/tomove.txt"
    rcx "copy/move-local-to-remote-removes-the-source" move "$d/tomove.txt" "bv:$PB/mv/"
    [ ! -e "$d/tomove.txt" ] && bv_pass "copy/move-removed-the-local-file" || bv_fail "copy/move-removed-the-local-file" "still there"
    rcx "copy/sync-remote-to-remote-same-bucket" sync "bv:$PB/mv" "bv:$PB/mv2"
    keys_eq "copy/remote-to-remote-keys" plain mv2/ mv2/a.txt mv2/c.txt mv2/tomove.txt
    rcx "copy/check-remote-to-remote" check "bv:$PB/mv" "bv:$PB/mv2"
    rcx "copy/purge-mv" purge "bv:$PB/mv"
    rcx "copy/purge-mv2" purge "bv:$PB/mv2"
}

# ================================================================================================
# group: multi - multipart upload and ranged download
# ================================================================================================
g_multi() {
    local d="$G_DIR" b="bv:$PB/multi" etag n
    rcx "multi/upload-20mib-5mib-chunks" copyto "$W/f_20m" "$b/f20" --s3-chunk-size 5M --s3-upload-cutoff 5M --s3-upload-concurrency 4
    etag="$(probe plain head multi/f20 | python3 -c 'import json,sys; print(json.load(sys.stdin)["headers"].get("etag",""))')"
    bv_eq "multi/etag-has-four-parts" "-4\"" "${etag: -3}"
    bv_eq "multi/etag-is-the-composite-md5" "\"$(python3 - "$W/f_20m" 5242880 <<'PY'
import hashlib, sys
ps = []
with open(sys.argv[1], "rb") as f:
    while True:
        c = f.read(int(sys.argv[2]))
        if not c:
            break
        ps.append(hashlib.md5(c).digest())
print("%s-%d" % (hashlib.md5(b"".join(ps)).hexdigest(), len(ps)))
PY
)\"" "$etag"
    rcx "multi/size-is-right" size "$b/f20" --json
    bv_eq "multi/size-bytes" "20971520" "$(printf '%s' "$RCOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["bytes"])')"
    mkdir -p "$d/dl"
    rcx "multi/download-single-stream" copyto "$b/f20" "$d/dl/f20_single" --multi-thread-streams 1
    bv_eq "multi/single-stream-sha256" "$(bv_sha256 "$W/f_20m")" "$(bv_sha256 "$d/dl/f20_single" 2>/dev/null)"
    rcx "multi/download-multi-thread" copyto "$b/f20" "$d/dl/f20_multi" --multi-thread-streams 4 --multi-thread-cutoff 1M --multi-thread-chunk-size 3M
    bv_eq "multi/multi-thread-sha256" "$(bv_sha256 "$W/f_20m")" "$(bv_sha256 "$d/dl/f20_multi" 2>/dev/null)"
    # the range is random binary: $(...) would drop its NUL bytes and trailing newlines, so it goes through a file
    rclone_run cat "$b/f20" --offset 1000000 --count 100 > "$d/range.bin" 2> "$d/range.err"; RCRC=$?
    if [ "$RCRC" -eq 0 ]; then bv_pass "multi/cat-a-range"; else bv_fail "multi/cat-a-range" "exit $RCRC: $(tail -n 4 "$d/range.err")"; fi
    bv_eq "multi/range-bytes" "100" "$(wc -c < "$d/range.bin" | tr -d ' ')"
    bv_eq "multi/range-content" "$(python3 -c 'import sys; sys.stdout.write(open("'"$W/f_20m"'","rb").read()[1000000:1000100].hex())')" "$(python3 -c 'import sys; sys.stdout.write(open(sys.argv[1],"rb").read().hex())' "$d/range.bin")"
    rcx "multi/upload-12mib-default-cutoff-raised" copyto "$W/f_12m" "$b/f12_single" --s3-upload-cutoff 200M
    bv_eq "multi/single-put-etag-is-md5" "\"$(python3 -c 'import hashlib;print(hashlib.md5(open("'"$W/f_12m"'","rb").read()).hexdigest())')\"" "$(probe plain head multi/f12_single | python3 -c 'import json,sys; print(json.load(sys.stdin)["headers"].get("etag",""))')"
    RC_IN="$W/f_12m" rcx "multi/rcat-13mib-stream" rcat "$b/streamed" --s3-chunk-size 5M --s3-upload-concurrency 3
    unset RC_IN
    rcx "multi/rcat-roundtrip-size" size "$b/streamed" --json
    bv_eq "multi/rcat-size" "12582912" "$(printf '%s' "$RCOUT" | python3 -c 'import json,sys; print(json.load(sys.stdin)["bytes"])')"
    rcx "multi/rcat-roundtrip-content" copyto "$b/streamed" "$d/dl/streamed"
    bv_eq "multi/rcat-sha256" "$(bv_sha256 "$W/f_12m")" "$(bv_sha256 "$d/dl/streamed" 2>/dev/null)"
    # how the client chooses to protect the payload
    rcx "multi/data-integrity-protections-on" copyto "$W/f_1m" "$b/dip-on" --s3-use-data-integrity-protections=true --s3-upload-cutoff 200M
    rcx "multi/data-integrity-protections-off" copyto "$W/f_1m" "$b/dip-off" --s3-use-data-integrity-protections=false --s3-upload-cutoff 200M
    rcx "multi/unsigned-payload" copyto "$W/f_1m" "$b/unsigned" --s3-use-unsigned-payload=true --s3-upload-cutoff 200M
    rcx "multi/presigned-single-part-upload" copyto "$W/f_1m" "$b/presigned" --s3-use-presigned-request --s3-upload-cutoff 200M
    rcx "multi/no-md5-metadata" copyto "$W/f_1m" "$b/no-md5" --s3-disable-checksum --s3-upload-cutoff 200M
    rcx "multi/no-head-after-upload" copyto "$W/f_1m" "$b/no-head" --s3-no-head --s3-upload-cutoff 200M
    rcx "multi/multipart-etag-verification" copyto "$W/f_12m" "$b/mp-etag" --s3-use-multipart-etag=true --s3-chunk-size 5M --s3-upload-cutoff 5M
    for n in dip-on dip-off unsigned presigned no-md5 no-head; do
        bv_eq "multi/$n-stored-intact" "$(python3 -c 'import hashlib;print(hashlib.md5(open("'"$W/f_1m"'","rb").read()).hexdigest())')" "$(probe plain head "multi/$n" | python3 -c 'import json,sys; print(json.load(sys.stdin)["headers"].get("etag","").strip(chr(34)))')"
    done
    rcx "multi/mp-etag-download" copyto "$b/mp-etag" "$d/dl/mp-etag"
    bv_eq "multi/mp-etag-sha256" "$(bv_sha256 "$W/f_12m")" "$(bv_sha256 "$d/dl/mp-etag" 2>/dev/null)"
    rcx "multi/no-open-uploads-left" backend list-multipart-uploads "bv:$PB"
    bv_eq "multi/probe-sees-no-open-uploads" "0" "$(probe plain mpu-list | python3 -c 'import json,sys; print(len([u for u in json.load(sys.stdin) if u["key"].startswith("multi/")]))')"
    rcx "multi/purge" purge "$b"
}

# ================================================================================================
# group: list - listing modes and paging
# ================================================================================================
g_list() {
    local d="$G_DIR" b="bv:$PB/lst" i
    mkdir -p "$d/many"
    python3 - "$d/many" <<'PY'
import os, sys
for i in range(1450):
    p = os.path.join(sys.argv[1], "d%02d" % (i % 29))
    os.makedirs(p, exist_ok=True)
    open(os.path.join(p, "f%04d.txt" % i), "w").write("%d\n" % i)
PY
    rcx "list/upload-1450-files" copy "$d/many" "$b" --transfers 16 --checkers 16
    rcx "list/ls-v2" ls "$b" --s3-list-version 2
    bv_eq "list/ls-v2-count" "1450" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "list/ls-v1" ls "$b" --s3-list-version 1
    bv_eq "list/ls-v1-count" "1450" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "list/ls-small-pages" ls "$b" --s3-list-chunk 7
    bv_eq "list/ls-small-pages-count" "1450" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "list/ls-small-pages-v1" ls "$b" --s3-list-chunk 7 --s3-list-version 1
    bv_eq "list/ls-small-pages-v1-count" "1450" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "list/fast-list" ls "$b" --fast-list
    bv_eq "list/fast-list-count" "1450" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "list/lsf-dirs" lsf --dirs-only "$b"
    bv_eq "list/lsf-dirs-count" "29" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "list/lsf-one-dir" lsf "$b/d03"
    bv_eq "list/lsf-one-dir-count" "50" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "list/url-encoded-listings" ls "$b" --s3-list-url-encode=true
    bv_eq "list/url-encoded-count" "1450" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "list/lsjson-recursive" lsjson -R --files-only "$b"
    bv_eq "list/lsjson-count" "1450" "$(printf '%s' "$RCOUT" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')"
    rcx "list/lsjson-sorted-like-the-server" lsjson -R --files-only --no-mimetype --no-modtime "$b"
    bv_eq "list/server-order-is-bytewise" "yes" "$(probe plain list lst/ | python3 -c 'import json,sys; k=json.load(sys.stdin); print("yes" if k == sorted(k, key=lambda x: x.encode()) else "no")')"
    rcx "list/purge" purge "$b"
}

# ================================================================================================
# group: ver - the versioned bucket
# ================================================================================================
g_ver() {
    local d="$G_DIR" b="bvv:$VB/rv"
    printf 'v1\n' > "$d/f.txt"
    rcx "ver/upload-first" copyto "$d/f.txt" "$b/f.txt"
    sleep 1.1
    printf 'version two\n' > "$d/f.txt"
    rcx "ver/upload-second" copyto "$d/f.txt" "$b/f.txt"
    bv_eq "ver/server-has-two-versions" "2" "$(probe versioned versions rv/f.txt | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')"
    rcx "ver/versions-flag-lists-both" lsf --s3-versions "$b"
    bv_eq "ver/lsf-versions-count" "2" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "ver/delete-adds-a-marker" deletefile "$b/f.txt"
    bv_eq "ver/marker-on-the-server" "1" "$(probe versioned versions rv/f.txt | python3 -c 'import json,sys; print(len([v for v in json.load(sys.stdin) if v["marker"]]))')"
    rcx "ver/key-is-hidden-from-a-plain-listing" lsf "$b"
    bv_eq "ver/plain-listing-is-empty" "" "$(nonblank_str "$RCOUT")"
    rcx "ver/versions-flag-shows-the-old-versions" lsf --s3-versions "$b"
    bv_eq "ver/two-old-versions" "2" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "ver/version-deleted-flag-adds-the-marker" lsf --s3-versions --s3-version-deleted "$b"
    bv_eq "ver/history-has-three-entries" "3" "$(printf '%s\n' "$RCOUT" | grep -c .)"
    rcx "ver/sse-bucket-roundtrip" copyto "$W/f_1m" "$b/sse.bin"
    rcx "ver/sse-download" copyto "$b/sse.bin" "$d/sse.bin"
    bv_eq "ver/sse-sha256" "$(bv_sha256 "$W/f_1m")" "$(bv_sha256 "$d/sse.bin" 2>/dev/null)"
    rcx "ver/multipart-into-versioned-bucket" copyto "$W/f_12m" "$b/mp.bin" --s3-chunk-size 5M --s3-upload-cutoff 5M
    bv_eq "ver/multipart-has-a-version-id" "yes" "$(probe versioned versions rv/mp.bin | python3 -c 'import json,sys; v=json.load(sys.stdin); print("yes" if v and v[0]["version"] else "no")')"
    rcx "ver/cleanup" purge "$b"
}

# ================================================================================================
# group: anon - anonymous access with an empty credential set
# ================================================================================================
g_anon() {
    local d="$G_DIR"
    rcx "anon/seed" copyto "$W/hello.txt" "bvp:$PUB/anon/h.txt"
    rcxe "anon/cat-needs-a-listing-which-is-denied" 'AccessDenied|Forbidden|403' cat "bva:$PUB/anon/h.txt"
    rcx "anon/copy-download" copyto "bva:$PUB/anon/h.txt" "$d/h.txt"
    bv_eq "anon/downloaded-body" "hello binvault" "$(cat "$d/h.txt" 2>/dev/null)"
    rcxe "anon/list-is-denied" 'AccessDenied|Forbidden|403' lsf "bva:$PUB/anon"
    rcxe "anon/upload-is-denied" 'AccessDenied|Forbidden|403' copyto "$W/hello.txt" "bva:$PUB/anon/evil.txt"
    rcxe "anon/delete-is-denied" 'AccessDenied|Forbidden|403' deletefile "bva:$PUB/anon/h.txt"
    rcx "anon/cleanup" purge "bvp:$PUB/anon"
}

# ================================================================================================
# group: rules - quota and content-type rules through rclone
# ================================================================================================
g_rules() {
    local d="$G_DIR"
    mkdir -p "$d/q"; head -c 3000000 /dev/urandom > "$d/q/a.bin"; head -c 3000000 /dev/urandom > "$d/q/b.bin"; head -c 3000000 /dev/urandom > "$d/q/c.bin"
    rc copy "$d/q" "bvq:$QB/q" --retries 1 --low-level-retries 1
    if [ "$RCRC" -ne 0 ]; then bv_pass "rules/quota-copy-fails-when-over"; else bv_fail "rules/quota-copy-fails-when-over" "9 MB went into an 8 MiB quota bucket"; fi
    bv_contains "rules/quota-error-is-reported" "$RCALL" "QuotaExceeded"
    bv_eq "rules/quota-two-files-fit" "2" "$(count_keys quota q/)"
    # (the 5 MiB part is refused before its body is read and the connection is closed: rclone then shows either the S3 error or
    # "request send failed", depending on which it notices first - BV-19)
    rcxe "rules/quota-multipart-fails" 'QuotaExceeded|request send failed|connection reset|broken pipe|EPIPE' copyto "$W/f_12m" "bvq:$QB/q/big" --s3-chunk-size 5M --s3-upload-cutoff 5M --retries 1 --low-level-retries 1
    bv_eq "rules/quota-failed-multipart-aborted" "0" "$(probe quota mpu-list | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))')"
    rcx "rules/quota-purge" purge "bvq:$QB/q"
    rcx "rules/ctype-png-ok" copyto "$W/pic.png" "bvc:$CB/r/pic.png"
    rcx "rules/ctype-text-ok" copyto "$W/hello.txt" "bvc:$CB/r/hello.txt"
    rcxe "rules/ctype-pdf-refused" 'ContentTypeNotAllowed' copyto "$W/doc.pdf" "bvc:$CB/r/doc.pdf" --retries 1 --low-level-retries 1
    rcxe "rules/ctype-html-refused" 'ContentTypeNotAllowed' copyto "$W/page.html" "bvc:$CB/r/page.html" --retries 1 --low-level-retries 1
    keys_eq "rules/ctype-only-the-allowed-ones" ctype r/ r/pic.png r/hello.txt
    rcx "rules/ctype-purge" purge "bvc:$CB/r"
}

# ================================================================================================
# group: odd - odd keys uploaded with rcat and read back
# ================================================================================================
g_odd() {
    local d="$G_DIR" id key
    mkdir -p "$d/odd"
    for id in $($OK ids); do
        case "$id" in
            leading-slash|double-slash|dot-segment|dotdot-segment|trailing-slash|len-1024|len-1024-multibyte|combining|nfc) continue ;;   # rclone normalises these paths itself
        esac
        key="$($OK key "$id")"
        printf 'body of %s\n' "$id" > "$d/odd/body"
        RC_IN="$d/odd/body" rcx "odd-$id/rcat" rcat "bv:$PB/odd/$key"
        unset RC_IN
        if probe plain list odd/ | python3 -c 'import json,sys; k=json.load(sys.stdin); sys.exit(0 if sys.argv[1] in k else 1)' "odd/$key"; then bv_pass "odd-$id/stored-byte-exact"; else bv_fail "odd-$id/stored-byte-exact" "the key is not in the independent listing"; fi
        case "$id" in
            tab-in-key) ;;     # rclone maps control characters to visible ones in its own namespace and cannot cat them back
            *) rc cat "bv:$PB/odd/$key"; bv_eq "odd-$id/cat" "body of $id" "$RCOUT" ;;
        esac
        rcx "odd-$id/deletefile" deletefile "bv:$PB/odd/$key"
        if probe plain list odd/ | python3 -c 'import json,sys; k=json.load(sys.stdin); sys.exit(1 if sys.argv[1] in k else 0)' "odd/$key"; then bv_pass "odd-$id/deleted"; else bv_fail "odd-$id/deleted" "still listed"; fi
    done
    key="$($OK toolong)"
    RC_IN="$W/hello.txt" rcxe "odd-too-long/refused" 'KeyTooLongError|too long|InvalidArgument|400' rcat "bv:$PB/$key" --retries 1 --low-level-retries 1
    unset RC_IN
}

# ================================================================================================
# group: tokens - restricted tokens and --s3-no-check-bucket
# ================================================================================================
g_tokens() {
    local d="$G_DIR" ak sk name="bvt-rclone-restricted" tok
    mkdir -p "$d/in"; printf 'a\n' > "$d/in/a.txt"; printf 'b\n' > "$d/in/b.txt"
    admin() { BV_ADMIN_URL="$BV_ADMIN_URL" BV_ADMIN_TOKEN="$BV_ADMIN_TOKEN" bv_admin "$@"; }
    admin POST /buckets "{\"name\":\"$name\"}" >/dev/null 2>&1 || admin PUT "/buckets/$name" '{}' >/dev/null 2>&1
    # write-once token: may create keys, never replace them
    tok="$(admin POST "/buckets/$name/tokens" '{"name":"wo","grants":[{"actions":["create","read","list"]}]}' 2>/dev/null)"
    ak="$(printf '%s' "$tok" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_key_id"])')"; sk="$(printf '%s' "$tok" | python3 -c 'import json,sys; print(json.load(sys.stdin)["secret_access_key"])')"
    add_remote bvwo "$ak" "$sk"
    rcx "tokens/write-once-creates" copy "$d/in" "bvwo:$name/wo" --s3-no-check-bucket
    keys_eq "tokens/write-once-stored" "$(true; echo plain)" wo/ 2>/dev/null || true
    printf 'changed\n' > "$d/in/a.txt"
    rcxe "tokens/write-once-cannot-replace" 'AccessDenied|Forbidden|403' copy "$d/in" "bvwo:$name/wo" --s3-no-check-bucket --ignore-times --retries 1 --low-level-retries 1
    rcx "tokens/write-once-can-read" cat "bvwo:$name/wo/b.txt"
    # read+list only
    tok="$(admin POST "/buckets/$name/tokens" '{"name":"ro","grants":[{"actions":["read","list"]}]}' 2>/dev/null)"
    ak="$(printf '%s' "$tok" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_key_id"])')"; sk="$(printf '%s' "$tok" | python3 -c 'import json,sys; print(json.load(sys.stdin)["secret_access_key"])')"
    add_remote bvro "$ak" "$sk"
    rcx "tokens/read-only-lists" lsf "bvro:$name/wo"
    mkdir -p "$d/out"; rcx "tokens/read-only-downloads" copy "bvro:$name/wo" "$d/out"
    rcxe "tokens/read-only-cannot-upload" 'AccessDenied|Forbidden|403' copyto "$W/hello.txt" "bvro:$name/ro.txt" --s3-no-check-bucket --retries 1 --low-level-retries 1
    rcxe "tokens/read-only-cannot-delete" 'AccessDenied|Forbidden|403' deletefile "bvro:$name/wo/b.txt" --retries 1 --low-level-retries 1
    # prefix-restricted token
    tok="$(admin POST "/buckets/$name/tokens" '{"name":"pfx","grants":[{"actions":["read","write","list","delete"],"keys":["mine/*"]}]}' 2>/dev/null)"
    ak="$(printf '%s' "$tok" | python3 -c 'import json,sys; print(json.load(sys.stdin)["access_key_id"])')"; sk="$(printf '%s' "$tok" | python3 -c 'import json,sys; print(json.load(sys.stdin)["secret_access_key"])')"
    add_remote bvpf "$ak" "$sk"
    # (rclone probes "mine" as a possible file with HEAD, which a pattern token cannot do: a trailing slash avoids the probe)
    rcx "tokens/prefix-token-uploads-inside" copy "$d/in" "bvpf:$name/mine/" --s3-no-check-bucket
    rcx "tokens/prefix-token-lists-inside" lsf "bvpf:$name/mine/"
    rcxe "tokens/prefix-token-cannot-list-outside" 'AccessDenied|Forbidden|403' lsf "bvpf:$name/other/" --retries 1 --low-level-retries 1
    rcxe "tokens/prefix-token-cannot-write-outside" 'AccessDenied|Forbidden|403' copyto "$W/hello.txt" "bvpf:$name/other/x.txt" --s3-no-check-bucket --retries 1 --low-level-retries 1
    rcx "tokens/prefix-token-purge-inside" purge "bvpf:$name/mine/"
    # a revoked token stops working at once
    admin DELETE "/buckets/$name?force=true" >/dev/null 2>&1 || true
}

# ================================================================================================
# group: flags - headers rclone can be told to send
# ================================================================================================
g_flags() {
    local d="$G_DIR" b="bv:$PB/flags"
    rcx "flags/sse-aes256" copyto "$W/hello.txt" "$b/sse" --s3-server-side-encryption AES256
    bv_eq "flags/sse-aes256-reported" "AES256" "$(probe plain head flags/sse | python3 -c 'import json,sys; print(json.load(sys.stdin)["headers"].get("x-amz-server-side-encryption",""))')"
    rcxe "flags/sse-kms-not-implemented" 'NotImplemented|not implemented|501' copyto "$W/hello.txt" "$b/kms" --s3-server-side-encryption aws:kms --retries 1 --low-level-retries 1
    rcxe "flags/sse-c-refused" 'NotImplemented|InvalidArgument|InvalidRequest|not implemented|501|400' copyto "$W/hello.txt" "$b/ssec" --s3-sse-customer-algorithm AES256 --s3-sse-customer-key 01234567890123456789012345678901 --retries 1 --low-level-retries 1
    rcx "flags/acl-private" copyto "$W/hello.txt" "$b/acl-private" --s3-acl private
    rcxe "flags/acl-public-read-refused" 'AccessControlListNotSupported' copyto "$W/hello.txt" "$b/acl-public" --s3-acl public-read --retries 1 --low-level-retries 1
    rcx "flags/storage-class-standard" copyto "$W/hello.txt" "$b/sc-standard" --s3-storage-class STANDARD
    rcxe "flags/storage-class-ia-refused" 'InvalidStorageClass' copyto "$W/hello.txt" "$b/sc-ia" --s3-storage-class STANDARD_IA --retries 1 --low-level-retries 1
    rcxe "flags/signature-v2-is-refused-by-design" 'SignatureDoesNotMatch|AccessDenied|InvalidRequest|Forbidden|403|400|Unsupported' lsf "$b" --s3-v2-auth --retries 1 --low-level-retries 1
    rcx "flags/directory-markers" mkdir "$b/markers/sub" --s3-directory-markers
    keys_eq "flags/directory-markers-are-zero-byte-objects" plain flags/markers/ flags/markers/sub/
    rcx "flags/directory-markers-listing" lsf "$b/markers" --s3-directory-markers
    mkdir -p "$d/dl"
    rcx "flags/no-head-object" copy "$b" "$d/dl" --include sse --s3-no-head-object
    bv_eq "flags/no-head-object-body" "hello binvault" "$(cat "$d/dl/sse" 2>/dev/null)"
    rcx "flags/accept-encoding-gzip" cat "$b/sse" --s3-use-accept-encoding-gzip=true
    bv_eq "flags/accept-encoding-body" "hello binvault" "$RCOUT"
    rcx "flags/might-gzip" cat "$b/sse" --s3-might-gzip=true
    rcx "flags/upload-with-metadata" copyto "$W/hello.txt" "$b/meta" --metadata-set content-type=text/x-rclone --metadata-set owner=me --metadata
    bv_eq "flags/metadata-content-type" "text/x-rclone" "$(probe plain head flags/meta | python3 -c 'import json,sys; print(json.load(sys.stdin)["headers"].get("content-type",""))')"
    bv_eq "flags/metadata-user-key" "me" "$(probe plain head flags/meta | python3 -c 'import json,sys; print(json.load(sys.stdin)["headers"].get("x-amz-meta-owner",""))')"
    rcx "flags/header-upload" copyto "$W/hello.txt" "$b/hdr" --header-upload "Cache-Control: max-age=77" --header-upload "x-amz-meta-viaheader: yes"
    bv_eq "flags/header-upload-cache-control" "max-age=77" "$(probe plain head flags/hdr | python3 -c 'import json,sys; print(json.load(sys.stdin)["headers"].get("cache-control",""))')"
    bv_eq "flags/header-upload-metadata" "yes" "$(probe plain head flags/hdr | python3 -c 'import json,sys; print(json.load(sys.stdin)["headers"].get("x-amz-meta-viaheader",""))')"
    rcx "flags/purge" purge "$b"
}

# ================================================================================================
for g in $GROUPS_RUN; do
    case " $GROUPS_ALL " in *" $g "*) ;; *) bv_warn "unknown rclone group '$g'"; continue ;; esac
    G_DIR="$W/g_$g"; rm -rf "$G_DIR"; mkdir -p "$G_DIR"
    "g_$g"
done
exit 0
