#!/usr/bin/env bash
# suite awscli: AWS CLI v2 (Docker image amazon/aws-cli, or a native aws) - s3 cp/mv/rm/sync/ls/presign, s3api, multipart, checksums, versioning, quota, content rules, odd keys, virtual-hosted style.
# Env (development): BV_IMG_AWSCLI (image), AWSCLI_GROUPS (space separated subset of: s3 sync api checks versioned quota ctype public odd errors vhost).
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
. "$HERE/../../support/common.sh"
CALC="python3 $HERE/calc.py"

IMG="${BV_IMG_AWSCLI:-amazon/aws-cli}"
W="$BV_SUITE_DIR/w"; mkdir -p "$W"
EP="$BV_TOOL_ENDPOINT"
PORT="${EP##*:}"
PB="$BV_PLAIN_BUCKET"; VB="$BV_VERSIONED_BUCKET"; PUB="$BV_PUBLIC_BUCKET"; QB="$BV_QUOTA_BUCKET"; CB="$BV_CTYPE_BUCKET"
REGION="${BV_REGION:-us-east-1}"
GROUPS_ALL="s3 sync api checks versioned quota ctype public odd errors vhost"
GROUPS_RUN="${AWSCLI_GROUPS:-$GROUPS_ALL}"

# ------------------------------------------------------------------------------------------------
# how to run aws: a long-lived container (docker exec is ~3x faster than docker run) or a native binary

MODE=""
CID=""
if [ "${BV_DOCKER:-0}" = 1 ]; then
    if ! bv_pull "$IMG"; then bv_skip "awscli/_setup" "cannot pull image $IMG (offline?)"; exit 0; fi
    MODE=docker
elif bv_have aws && aws --version 2>&1 | grep -q '^aws-cli/2'; then
    MODE=native
else
    bv_skip "awscli/_setup" "neither Docker nor a native aws-cli v2 is available"; exit 0
fi

cleanup() { [ -n "$CID" ] && docker rm -f "$CID" >/dev/null 2>&1; return 0; }
trap cleanup EXIT

if [ "$MODE" = docker ]; then
    CID="$(bv_docker -d -u "$(id -u):$(id -g)" -e HOME=/tmp \
        --add-host "$BV_DOMAIN:host-gateway" --add-host "$PB.$BV_DOMAIN:host-gateway" --add-host "$PUB.$BV_DOMAIN:host-gateway" \
        --entrypoint sleep "$IMG" infinity 2>&1)" || { bv_skip "awscli/_setup" "cannot start the aws-cli container: $CID"; CID=""; exit 0; }
fi

# AWS config: path-style addressing everywhere; named profiles select transfer settings per call
cat > "$W/aws_config" <<EOF
[default]
region = $REGION
s3 =
    addressing_style = path

[profile mp8]
region = $REGION
s3 =
    addressing_style = path
    multipart_threshold = 8MB
    multipart_chunksize = 8MB
    max_concurrent_requests = 4

[profile mp5]
region = $REGION
s3 =
    addressing_style = path
    multipart_threshold = 5MB
    multipart_chunksize = 5MB
    max_concurrent_requests = 4

[profile nomp]
region = $REGION
s3 =
    addressing_style = path
    multipart_threshold = 512MB
    multipart_chunksize = 512MB

[profile vhost]
region = $REGION
s3 =
    addressing_style = virtual

[profile noretry]
region = $REGION
retry_mode = standard
max_attempts = 1
s3 =
    addressing_style = path
    max_concurrent_requests = 12

[profile retry]
region = $REGION
retry_mode = standard
max_attempts = 12
s3 =
    addressing_style = path
    max_concurrent_requests = 12
EOF

_exec() { # NAME=VALUE... -- cmd args...  (stdin: $INFILE or /dev/null)
    local -a envs=()
    while [ "$1" != "--" ]; do envs+=("$1"); shift; done
    shift
    if [ "$MODE" = docker ]; then
        local -a flags=(); local e
        for e in "${envs[@]}"; do flags+=(-e "$e"); done
        if [ -n "${INFILE:-}" ]; then
            docker exec -i "${flags[@]}" "$CID" timeout -k 5 300 "$@" < "$INFILE"
        else
            docker exec "${flags[@]}" "$CID" timeout -k 5 300 "$@" < /dev/null
        fi
    else
        if [ -n "${INFILE:-}" ]; then env "${envs[@]}" "$@" < "$INFILE"; else env "${envs[@]}" "$@" < /dev/null; fi
    fi
}

# aws_as KIND [ENV:NAME=VALUE | EP:URL | NOEP]... aws-args...
#   KIND: plain versioned public quota ctype | anon (no credentials) | bad (wrong secret) | key:AK:SK
aws_as() {
    local kind="$1"; shift
    local ak="" sk="" ep="$EP" k
    local -a envs=("AWS_DEFAULT_REGION=$REGION" AWS_EC2_METADATA_DISABLED=true "AWS_CONFIG_FILE=$W/aws_config" AWS_SHARED_CREDENTIALS_FILE=/dev/null AWS_PAGER= HOME=/tmp)
    case "$kind" in
        anon) ;;
        bad) ak=$BV_PLAIN_AK; sk="not-the-secret-0123456789012345678901234567" ;;
        key:*) ak="${kind#key:}"; sk="${ak#*:}"; ak="${ak%%:*}" ;;
        *) k="$(printf '%s' "$kind" | tr 'a-z' 'A-Z')"; eval "ak=\${BV_${k}_AK}; sk=\${BV_${k}_SK}" ;;
    esac
    [ -n "$ak" ] && envs+=("AWS_ACCESS_KEY_ID=$ak" "AWS_SECRET_ACCESS_KEY=$sk")
    while [ $# -gt 0 ]; do
        case "$1" in
            ENV:*) envs+=("${1#ENV:}"); shift ;;
            EP:*) ep="${1#EP:}"; shift ;;
            NOEP) ep=""; shift ;;
            *) break ;;
        esac
    done
    if [ -n "$ep" ]; then _exec "${envs[@]}" -- aws --endpoint-url "$ep" "$@"; else _exec "${envs[@]}" -- aws "$@"; fi
}

# x CASE KIND args...   run aws; PASS when it exits 0.  Sets JOUT (stdout) JERR (stderr) JALL (both) JRC.
#                       CASE may be "" for a silent setup step.
x() {
    local name="$1"; shift
    local ef="$G_DIR/.err.$RANDOM$RANDOM"
    JOUT="$(aws_as "$@" 2>"$ef")"; JRC=$?
    JERR="$(cat "$ef" 2>/dev/null)"; rm -f "$ef"
    JALL="$JOUT
$JERR"
    if [ -n "$name" ]; then
        if [ "$JRC" -eq 0 ]; then bv_pass "$name"; else bv_fail "$name" "exit $JRC: $(printf '%s' "$JERR$JOUT" | tail -n 3)"; fi
    fi
    return 0
}
# xe CASE PATTERN KIND args...   PASS when aws exits non-zero and stdout+stderr match the regex PATTERN
xe() {
    local name="$1" pat="$2"; shift 2
    x "" "$@"
    if [ "$JRC" -eq 0 ]; then
        bv_fail "$name" "expected an error matching /$pat/ but the command succeeded: $(printf '%s' "$JALL" | tr '\n' ' ' | head -c 300)"
    elif printf '%s' "$JALL" | grep -Eq -- "$pat"; then
        bv_pass "$name"
    else
        bv_fail "$name" "exit $JRC but output does not match /$pat/: $(printf '%s' "$JALL" | tr '\n' ' ' | head -c 400)"
    fi
}
# xin CASE FILE KIND args...   like x, with FILE as stdin
xin() { local f="$2" n="$1"; shift 2; INFILE="$f" x "$n" "$@"; }

# jv PATH   value at PATH of the JSON in JOUT (empty when absent)
jv() { printf '%s' "$JOUT" | $CALC jget "$1" 2>/dev/null; }
# jl PATH   length of the list at PATH of JOUT
jl() { printf '%s' "$JOUT" | $CALC jlen "$1" 2>/dev/null; }
# is_empty STRING
nonblank() { printf '%s' "$1" | tr -d ' \n\t\r' ; }

# fetch URL [curl args...]  -> FSTATUS, FBODY (file path); connects to the node however the URL names it
FBODY="$W/.fetch.$$"
fetch() {
    local url="$1"; shift
    local -a res=()
    if [ "$MODE" = docker ]; then
        local hp; hp="$(printf '%s' "$url" | sed -E 's#^[a-z]+://([^/]+).*#\1#')"
        res=(--resolve "$hp:127.0.0.1")
        case "$hp" in *:*) ;; *) res=() ;; esac
        res=(--connect-to "$hp:127.0.0.1:$PORT")
    fi
    FSTATUS="$(curl -s -o "$FBODY.$$.$RANDOM" -D "$FBODY.hdr.$$" -w '%{http_code}' "${res[@]}" --max-time 60 "$@" "$url" 2>/dev/null)"
    FBODY_LAST="$(ls -t "$FBODY".$$.* 2>/dev/null | head -n 1)"
    FTEXT="$(cat "$FBODY_LAST" 2>/dev/null)"
    rm -f "$FBODY".$$.*
    FHDR="$(cat "$FBODY.hdr.$$" 2>/dev/null)"; rm -f "$FBODY.hdr.$$"
}

admin() { # METHOD PATH [JSON] -> prints body; non-zero on HTTP >= 400
    BV_ADMIN_URL="$BV_ADMIN_URL" BV_ADMIN_TOKEN="$BV_ADMIN_TOKEN" bv_admin "$@"
}

# ------------------------------------------------------------------------------------------------
# fixtures

FX="$W/fx"; mkdir -p "$FX"
mkfx() { [ -f "$FX/$1" ] || bv_mkfile "$FX/$1" "$2"; }
mkfx f_1m 1048576
mkfx f_100k 102400
mkfx f_200k 204800
mkfx f_5m1 5242881
mkfx f_12m 12582912
mkfx f_20m 20971520
mkfx f_40m 41943040
: > "$FX/f_0"
printf 'hello binvault\n' > "$FX/hello.txt"
$CALC png "$FX/pic.png"; $CALC jpeg "$FX/pic.jpg"; $CALC gif "$FX/pic.gif"; $CALC pdf "$FX/doc.pdf"; $CALC html "$FX/page.html"
cat "$FX/pic.png" "$FX/f_12m" > "$FX/png_big.bin"        # starts like a PNG, 12 MiB: multipart that passes the sniffer

AWS_VERSION="$(aws_as anon NOEP --version 2>&1 | head -n 1)"
bv_info "aws-cli ($MODE): $AWS_VERSION"
CRCOK=0; $CALC selftest >/dev/null 2>&1 && CRCOK=1

# ================================================================================================
# group: s3 - the high-level `aws s3` commands
# ================================================================================================
g_s3() {
    local d="$G_DIR" b="s3://$PB/s3h" p

    # --- buckets
    x "s3-mb/own-bucket-succeeds" plain s3 mb "s3://$PB"
    xe "s3-mb/other-bucket-denied" 'AccessDenied' plain s3 mb "s3://bvt-awscli-no-such-bucket"
    xe "s3-mb/foreign-existing-bucket-denied" 'AccessDenied' plain s3 mb "s3://$VB"
    xe "s3-rb/own-bucket-denied" 'AccessDenied' plain s3 rb "s3://$PB"
    x "" plain s3 ls
    bv_eq "s3-ls/lists-only-own-bucket" "1:$PB" "$(printf '%s\n' "$JOUT" | awk 'NF{c++; n=$3} END{print c ":" n}')"

    # --- cp: local -> s3 -> local
    x "s3-cp/upload-1mib" plain s3 cp "$FX/f_1m" "$b/up/f_1m" --no-progress
    mkdir -p "$d/dl"
    x "s3-cp/download-1mib" plain s3 cp "$b/up/f_1m" "$d/dl/f_1m" --no-progress
    bv_eq "s3-cp/roundtrip-1mib-sha256" "$(bv_sha256 "$FX/f_1m")" "$(bv_sha256 "$d/dl/f_1m" 2>/dev/null)"
    x "s3-cp/upload-zero-byte" plain s3 cp "$FX/f_0" "$b/up/zero" --no-progress
    x "" plain s3api head-object --bucket "$PB" --key s3h/up/zero
    bv_eq "s3-cp/zero-byte-size" "0" "$(jv ContentLength)"
    x "s3-cp/download-zero-byte" plain s3 cp "$b/up/zero" "$d/dl/zero" --no-progress
    bv_eq "s3-cp/zero-byte-roundtrip" "0" "$(bv_filesize "$d/dl/zero" 2>/dev/null)"
    x "s3-cp/s3-to-s3-same-bucket" plain s3 cp "$b/up/f_1m" "$b/up/f_1m.copy" --no-progress
    x "s3-cp/s3-to-s3-copy-etag-equal" plain s3api head-object --bucket "$PB" --key s3h/up/f_1m.copy
    local etag_copy; etag_copy="$(jv ETag)"
    bv_eq "s3-cp/s3-to-s3-etag-is-md5" "\"$($CALC md5hex "$FX/f_1m")\"" "$etag_copy"

    # --- cp with every header the CLI can set, then read them back
    x "s3-cp/upload-with-all-headers" plain s3 cp "$FX/hello.txt" "$b/hdr/h.txt" --no-progress \
        --metadata k1=v1,K2=V2 --content-type text/x-test --cache-control max-age=60 \
        --content-disposition 'attachment; filename="x.txt"' --content-encoding gzip --content-language de \
        --expires 2030-01-01T00:00:00Z --storage-class REDUCED_REDUNDANCY
    x "" plain s3api head-object --bucket "$PB" --key s3h/hdr/h.txt
    bv_eq "s3-cp/header-content-type" "text/x-test" "$(jv ContentType)"
    bv_eq "s3-cp/header-cache-control" "max-age=60" "$(jv CacheControl)"
    bv_eq "s3-cp/header-content-disposition" 'attachment; filename="x.txt"' "$(jv ContentDisposition)"
    bv_eq "s3-cp/header-content-encoding" "gzip" "$(jv ContentEncoding)"
    bv_eq "s3-cp/header-content-language" "de" "$(jv ContentLanguage)"
    bv_eq "s3-cp/header-expires" "Tue, 01 Jan 2030 00:00:00 GMT" "$(jv ExpiresString)"
    bv_eq "s3-cp/header-user-metadata-lowercased" "v1,V2" "$(jv Metadata.k1),$(jv Metadata.k2)"
    case "$(jv StorageClass)" in ""|STANDARD) bv_pass "s3-cp/storage-class-rrs-reported-as-standard" ;; *) bv_fail "s3-cp/storage-class-rrs-reported-as-standard" "StorageClass=$(jv StorageClass)" ;; esac
    x "s3-cp/storage-class-standard" plain s3 cp "$FX/hello.txt" "$b/hdr/std.txt" --no-progress --storage-class STANDARD
    xe "s3-cp/storage-class-glacier-rejected" 'InvalidStorageClass' plain s3 cp "$FX/hello.txt" "$b/hdr/glacier.txt" --no-progress --storage-class GLACIER
    xe "s3-cp/storage-class-standard-ia-rejected" 'InvalidStorageClass' plain s3 cp "$FX/hello.txt" "$b/hdr/ia.txt" --no-progress --storage-class STANDARD_IA
    x "s3-cp/sse-aes256-per-request" plain s3 cp "$FX/hello.txt" "$b/hdr/sse.txt" --no-progress --sse AES256
    x "" plain s3api head-object --bucket "$PB" --key s3h/hdr/sse.txt
    bv_eq "s3-cp/sse-aes256-reported" "AES256" "$(jv ServerSideEncryption)"
    xe "s3-cp/sse-kms-not-implemented" 'NotImplemented' plain s3 cp "$FX/hello.txt" "$b/hdr/kms.txt" --no-progress --sse aws:kms
    x "s3-cp/acl-private-accepted" plain s3 cp "$FX/hello.txt" "$b/hdr/acl-private.txt" --no-progress --acl private
    xe "s3-cp/acl-public-read-rejected" 'AccessControlListNotSupported' plain s3 cp "$FX/hello.txt" "$b/hdr/acl-public.txt" --no-progress --acl public-read

    # --- cp: stdin and stdout
    printf 'streamed through stdin\n' > "$d/stdin.txt"
    xin "s3-cp/stdin-upload" "$d/stdin.txt" plain s3 cp - "$b/stream/in.txt" --no-progress
    x "s3-cp/stdout-download" plain s3 cp "$b/stream/in.txt" -
    bv_eq "s3-cp/stdin-stdout-roundtrip" "streamed through stdin" "$JOUT"
    local big_in; big_in="$d/stdin_big"; bv_mkfile "$big_in" 3000000
    xin "s3-cp/stdin-upload-3mb" "$big_in" plain s3 cp - "$b/stream/big" --no-progress --expected-size 3000000
    x "" plain s3 cp "$b/stream/big" "$d/dl/stream_big" --no-progress
    bv_eq "s3-cp/stdin-3mb-roundtrip" "$(bv_sha256 "$big_in")" "$(bv_sha256 "$d/dl/stream_big" 2>/dev/null)"
    xe "s3-cp/directory-without-recursive-fails" '.' plain s3 cp "$FX" "$b/dir-no-recursive" --no-progress

    # --- cp --recursive with a small tree
    mkdir -p "$d/tree/sub/deeper" "$d/tree/with space" "$d/tree/ünï"
    printf 'a\n' > "$d/tree/a.txt"; head -c 100000 /dev/urandom > "$d/tree/sub/b.bin"; printf 'c\n' > "$d/tree/sub/deeper/c.txt"
    : > "$d/tree/empty.txt"; printf 'sp\n' > "$d/tree/with space/file name.txt"; printf 'uni\n' > "$d/tree/ünï/日本.txt"
    x "s3-cp/recursive-upload" plain s3 cp "$d/tree" "$b/tree/" --recursive --no-progress
    x "s3-ls/recursive-human-summarize" plain s3 ls "$b/tree/" --recursive --human-readable --summarize
    bv_contains "s3-ls/summarize-total-objects" "$JOUT" "Total Objects: 6"
    bv_contains "s3-ls/summarize-total-size-human" "$JOUT" "Total Size: 97.7 KiB"
    x "s3-ls/prefix-shows-pre-entries" plain s3 ls "$b/tree/"
    bv_contains "s3-ls/prefix-shows-pre-sub" "$JOUT" "PRE sub/"
    mkdir -p "$d/tree_dl"
    x "s3-cp/recursive-download" plain s3 cp "$b/tree/" "$d/tree_dl/" --recursive --no-progress
    if diff -r "$d/tree" "$d/tree_dl" >/dev/null 2>&1; then bv_pass "s3-cp/recursive-roundtrip-identical"; else bv_fail "s3-cp/recursive-roundtrip-identical" "$(diff -rq "$d/tree" "$d/tree_dl" 2>&1 | head -n 3)"; fi

    # --- mv (copy + delete) in all three directions
    cp "$FX/hello.txt" "$d/mv_local.txt"
    x "s3-mv/local-to-s3" plain s3 mv "$d/mv_local.txt" "$b/mv/one.txt" --no-progress
    [ ! -e "$d/mv_local.txt" ] && bv_pass "s3-mv/local-to-s3-removes-source" || bv_fail "s3-mv/local-to-s3-removes-source" "local file still exists"
    x "s3-mv/s3-to-s3" plain s3 mv "$b/mv/one.txt" "$b/mv/two.txt" --no-progress
    xe "s3-mv/s3-to-s3-removes-source" '404|Not Found' plain s3api head-object --bucket "$PB" --key s3h/mv/one.txt
    x "s3-mv/s3-to-local" plain s3 mv "$b/mv/two.txt" "$d/dl/mv_back.txt" --no-progress
    bv_eq "s3-mv/s3-to-local-content" "hello binvault" "$(cat "$d/dl/mv_back.txt" 2>/dev/null)"
    xe "s3-mv/s3-to-local-removes-source" '404|Not Found' plain s3api head-object --bucket "$PB" --key s3h/mv/two.txt

    # --- rm: single, recursive
    x "" plain s3 cp "$FX/hello.txt" "$b/rm/a.txt" --no-progress
    x "s3-rm/single" plain s3 rm "$b/rm/a.txt"
    xe "s3-rm/single-removed" '404|Not Found' plain s3api head-object --bucket "$PB" --key s3h/rm/a.txt
    x "s3-rm/missing-key-is-ok" plain s3 rm "$b/rm/never-existed.txt"
    x "s3-rm/recursive-small-prefix" plain s3 rm "$b/tree/" --recursive
    x "" plain s3 ls "$b/tree/" --recursive
    bv_eq "s3-rm/recursive-small-prefix-empty" "" "$(nonblank "$JOUT")"

    # --- 1,200 objects: listing across the 1000-key page boundary and DeleteObjects in two batches
    mkdir -p "$d/many"
    python3 - "$d/many" <<'PY'
import sys
for i in range(1200):
    open("%s/m%04d.txt" % (sys.argv[1], i), "w").write("object %d\n" % i)
PY
    x "s3-cp/recursive-upload-1200-objects" plain s3 cp "$d/many" "$b/many/" --recursive --no-progress
    x "s3-ls/1200-objects-across-pages" plain s3 ls "$b/many/" --summarize
    bv_contains "s3-ls/1200-objects-total" "$JOUT" "Total Objects: 1200"
    x "s3-rm/recursive-1200-objects" plain s3 rm "$b/many/" --recursive
    bv_eq "s3-rm/recursive-1200-deleted-lines" "1200" "$(printf '%s\n' "$JOUT" | grep -c '^delete: ')"
    x "" plain s3 ls "$b/many/" --summarize
    bv_contains "s3-rm/recursive-1200-nothing-left" "$JOUT" "Total Objects: 0"

    # --- presign: fetch with curl, expiry, tampering
    x "" plain s3 cp "$FX/hello.txt" "$b/presign/h.txt" --no-progress
    x "s3-presign/default-expiry" plain s3 presign "$b/presign/h.txt"
    local url="$JOUT"
    bv_contains "s3-presign/is-sigv4" "$url" "X-Amz-Algorithm=AWS4-HMAC-SHA256"
    bv_contains "s3-presign/default-expires-3600" "$url" "X-Amz-Expires=3600"
    fetch "$url"
    if [ "$FSTATUS" = 200 ] && [ "$FTEXT" = "hello binvault" ]; then bv_pass "s3-presign/get-works"; else bv_fail "s3-presign/get-works" "HTTP $FSTATUS: $FTEXT"; fi
    x "" plain s3 presign "$b/presign/h.txt" --expires-in 60
    bv_contains "s3-presign/expires-in-60" "$JOUT" "X-Amz-Expires=60"
    fetch "$JOUT"
    [ "$FSTATUS" = 200 ] && bv_pass "s3-presign/get-works-expires-60" || bv_fail "s3-presign/get-works-expires-60" "HTTP $FSTATUS: $FTEXT"
    local sig; sig="${url##*X-Amz-Signature=}"
    local bad="${url%X-Amz-Signature=*}X-Amz-Signature=$(printf '%s' "$sig" | sed -E 's/^(.)(.*)$/0\2/; s/^00/01/')"
    [ "$bad" = "$url" ] && bad="${url%?}0"
    fetch "$bad"
    if [ "$FSTATUS" = 403 ] && printf '%s' "$FTEXT" | grep -q SignatureDoesNotMatch; then bv_pass "s3-presign/tampered-signature-rejected"; else bv_fail "s3-presign/tampered-signature-rejected" "HTTP $FSTATUS: $(printf '%s' "$FTEXT" | head -c 200)"; fi
    x "" plain s3 presign "$b/presign/h.txt" --expires-in 1
    local short="$JOUT"
    sleep 3
    fetch "$short"
    if [ "$FSTATUS" = 403 ] && printf '%s' "$FTEXT" | grep -q AccessDenied; then bv_pass "s3-presign/expired-url-rejected"; else bv_fail "s3-presign/expired-url-rejected" "HTTP $FSTATUS: $(printf '%s' "$FTEXT" | head -c 200)"; fi
    x "" plain s3 presign "$b/presign/missing.txt"
    fetch "$JOUT"
    if [ "$FSTATUS" = 404 ] && printf '%s' "$FTEXT" | grep -q NoSuchKey; then bv_pass "s3-presign/missing-key-404"; else bv_fail "s3-presign/missing-key-404" "HTTP $FSTATUS: $(printf '%s' "$FTEXT" | head -c 200)"; fi

    # --- multipart through the high-level commands
    x "s3-cp/multipart-40mib-upload" plain ENV:AWS_PROFILE=mp8 s3 cp "$FX/f_40m" "$b/mp/f_40m" --no-progress
    x "s3-cp/multipart-40mib-download" plain ENV:AWS_PROFILE=mp8 s3 cp "$b/mp/f_40m" "$d/dl/f_40m" --no-progress
    bv_eq "s3-cp/multipart-40mib-sha256" "$(bv_sha256 "$FX/f_40m")" "$(bv_sha256 "$d/dl/f_40m" 2>/dev/null)"
    x "" plain s3api head-object --bucket "$PB" --key s3h/mp/f_40m
    bv_eq "s3-cp/multipart-40mib-etag-parts" "$($CALC mp-etag "$FX/f_40m" 8388608)" "$(jv ETag | tr -d '"')"
    bv_eq "s3-cp/multipart-40mib-size" "41943040" "$(jv ContentLength)"
    x "s3-cp/multipart-default-20mib-upload" plain s3 cp "$FX/f_20m" "$b/mp/f_20m" --no-progress
    x "" plain s3api head-object --bucket "$PB" --key s3h/mp/f_20m
    bv_eq "s3-cp/multipart-default-20mib-etag" "$($CALC mp-etag "$FX/f_20m" 8388608)" "$(jv ETag | tr -d '"')"
    x "s3-cp/multipart-default-20mib-download" plain s3 cp "$b/mp/f_20m" "$d/dl/f_20m" --no-progress
    bv_eq "s3-cp/multipart-default-20mib-sha256" "$(bv_sha256 "$FX/f_20m")" "$(bv_sha256 "$d/dl/f_20m" 2>/dev/null)"
    x "s3-cp/multipart-server-side-copy-40mib" plain ENV:AWS_PROFILE=mp8 s3 cp "$b/mp/f_40m" "$b/mp/f_40m.copy" --no-progress
    x "s3-cp/multipart-copy-download" plain s3 cp "$b/mp/f_40m.copy" "$d/dl/f_40m.copy" --no-progress
    bv_eq "s3-cp/multipart-server-side-copy-sha256" "$(bv_sha256 "$FX/f_40m")" "$(bv_sha256 "$d/dl/f_40m.copy" 2>/dev/null)"
    x "s3-cp/multipart-5mib-parts-12mib-upload" plain ENV:AWS_PROFILE=mp5 s3 cp "$FX/f_12m" "$b/mp/f_12m" --no-progress
    x "" plain s3api head-object --bucket "$PB" --key s3h/mp/f_12m
    bv_eq "s3-cp/multipart-5mib-parts-etag" "$($CALC mp-etag "$FX/f_12m" 5242880)" "$(jv ETag | tr -d '"')"
    x "s3-cp/single-put-12mib-no-multipart" plain ENV:AWS_PROFILE=nomp s3 cp "$FX/f_12m" "$b/mp/f_12m.single" --no-progress
    x "" plain s3api head-object --bucket "$PB" --key s3h/mp/f_12m.single
    bv_eq "s3-cp/single-put-12mib-etag-is-md5" "$($CALC md5hex "$FX/f_12m")" "$(jv ETag | tr -d '"')"
    x "s3-cp/multipart-upload-5mib-plus-1-byte" plain ENV:AWS_PROFILE=mp5 s3 cp "$FX/f_5m1" "$b/mp/f_5m1" --no-progress
    x "s3-cp/multipart-upload-5mib-plus-1-download" plain s3 cp "$b/mp/f_5m1" "$d/dl/f_5m1" --no-progress
    bv_eq "s3-cp/multipart-5mib-plus-1-sha256" "$(bv_sha256 "$FX/f_5m1")" "$(bv_sha256 "$d/dl/f_5m1" 2>/dev/null)"
}

# ================================================================================================
# group: sync
# ================================================================================================
g_sync() {
    local d="$G_DIR" b="s3://$PB/sync"
    mkdir -p "$d/src"
    python3 - "$d/src" <<'PY'
import os, sys
root = sys.argv[1]
n = 0
for i in range(300):
    p = os.path.join(root, "d%d" % (i % 10), "sub%d" % (i % 3))
    os.makedirs(p, exist_ok=True)
    size = (i * 37) % 2048
    open(os.path.join(p, "file%03d.dat" % i), "wb").write(bytes((i + j) % 256 for j in range(size)))
for rel, data in (("with space/file name.txt", b"space\n"), ("ünï/日本語.txt", b"unicode\n"), ("empty.txt", b""),
                  ("deep/a/b/c/d/e/f.txt", b"deep\n"), ("plus+sign/a+b.txt", b"plus\n"), ("keep.log", b"log\n")):
    p = os.path.join(root, rel)
    os.makedirs(os.path.dirname(p), exist_ok=True)
    open(p, "wb").write(data)
PY
    local total; total="$(find "$d/src" -type f | wc -l | tr -d ' ')"
    bv_age_files "$d/src"   # whole-second S3 timestamps: a file written in the second of its upload would look newer to sync
    x "s3-sync/local-to-s3-tree" plain s3 sync "$d/src" "$b/" --no-progress
    x "" plain s3 ls "$b/" --recursive --summarize
    bv_contains "s3-sync/local-to-s3-object-count" "$JOUT" "Total Objects: $total"
    x "s3-sync/second-run-transfers-nothing" plain s3 sync "$d/src" "$b/" --no-progress
    bv_eq "s3-sync/second-run-output-empty" "" "$(nonblank "$JOUT")"
    mkdir -p "$d/dst"
    x "s3-sync/s3-to-local-tree" plain s3 sync "$b/" "$d/dst" --no-progress
    if diff -r "$d/src" "$d/dst" >/dev/null 2>&1; then bv_pass "s3-sync/s3-to-local-identical"; else bv_fail "s3-sync/s3-to-local-identical" "$(diff -rq "$d/src" "$d/dst" 2>&1 | head -n 3)"; fi
    x "s3-sync/s3-to-local-second-run-transfers-nothing" plain s3 sync "$b/" "$d/dst" --no-progress
    bv_eq "s3-sync/s3-to-local-second-run-output-empty" "" "$(nonblank "$JOUT")"
    x "s3-sync/s3-to-local-exact-timestamps-transfers-nothing" plain s3 sync "$b/" "$d/dst" --exact-timestamps --no-progress
    bv_eq "s3-sync/exact-timestamps-listing-matches-last-modified" "" "$(nonblank "$JOUT")"
    x "s3-sync/local-after-download-transfers-nothing" plain s3 sync "$d/dst" "$b/" --no-progress
    bv_eq "s3-sync/local-after-download-output-empty" "" "$(nonblank "$JOUT")"

    # modified file -> exactly one upload
    sleep 1.1
    printf 'changed content, longer\n' > "$d/src/d1/sub1/file001.dat"
    x "s3-sync/modified-file-uploads-once" plain s3 sync "$d/src" "$b/" --no-progress
    bv_eq "s3-sync/modified-file-one-upload-line" "1" "$(printf '%s\n' "$JOUT" | grep -c '^upload: ')"
    x "" plain s3 cp "$b/d1/sub1/file001.dat" -
    bv_eq "s3-sync/modified-file-content-updated" "changed content, longer" "$JOUT"

    # --size-only: same size, newer mtime must NOT transfer
    sleep 1.1
    printf 'CHANGED CONTENT, LONGER\n' > "$d/src/d1/sub1/file001.dat"
    x "s3-sync/size-only-ignores-same-size-change" plain s3 sync "$d/src" "$b/" --size-only --no-progress
    bv_eq "s3-sync/size-only-output-empty" "" "$(nonblank "$JOUT")"
    x "s3-sync/default-detects-same-size-newer-mtime" plain s3 sync "$d/src" "$b/" --no-progress
    bv_eq "s3-sync/same-size-newer-mtime-one-upload" "1" "$(printf '%s\n' "$JOUT" | grep -c '^upload: ')"

    # --exclude/--include
    mkdir -p "$d/filt"; printf 'a\n' > "$d/filt/a.txt"; printf 'b\n' > "$d/filt/b.log"; printf 'c\n' > "$d/filt/c.txt"
    x "s3-sync/exclude-include-filters" plain s3 sync "$d/filt" "s3://$PB/sync-filt/" --exclude '*' --include '*.txt' --no-progress
    x "" plain s3 ls "s3://$PB/sync-filt/"
    bv_eq "s3-sync/exclude-include-uploaded-only-txt" "a.txt,c.txt" "$(printf '%s\n' "$JOUT" | awk 'NF{print $4}' | paste -sd, -)"

    # --delete
    rm -f "$d/src/keep.log" "$d/src/d2/sub2/file002.dat"
    x "s3-sync/delete-flag-removes-extraneous" plain s3 sync "$d/src" "$b/" --delete --no-progress
    bv_eq "s3-sync/delete-flag-two-deletes" "2" "$(printf '%s\n' "$JOUT" | grep -c '^delete: ')"
    xe "s3-sync/delete-flag-object-gone" '404|Not Found' plain s3api head-object --bucket "$PB" --key sync/keep.log
    # without --delete the objects of a vanished file stay
    x "" plain s3 cp "$FX/hello.txt" "$b/zz-extra.txt" --no-progress
    x "s3-sync/without-delete-keeps-extraneous" plain s3 sync "$d/src" "$b/" --no-progress
    x "" plain s3api head-object --bucket "$PB" --key sync/zz-extra.txt
    bv_eq "s3-sync/without-delete-extra-object-kept" "15" "$(jv ContentLength)"

    # s3 -> s3 sync (server-side copies)
    x "s3-sync/s3-to-s3" plain s3 sync "$b/d3/" "s3://$PB/sync-copy/d3/" --no-progress
    x "" plain s3 ls "s3://$PB/sync-copy/d3/" --recursive --summarize
    x "" plain s3 ls "$b/d3/" --recursive --summarize
    local srcsum="$(printf '%s' "$JOUT" | grep 'Total')"
    x "" plain s3 ls "s3://$PB/sync-copy/d3/" --recursive --summarize
    bv_eq "s3-sync/s3-to-s3-same-totals" "$srcsum" "$(printf '%s' "$JOUT" | grep 'Total')"
    x "s3-sync/s3-to-s3-second-run-transfers-nothing" plain s3 sync "$b/d3/" "s3://$PB/sync-copy/d3/" --no-progress
    bv_eq "s3-sync/s3-to-s3-second-run-output-empty" "" "$(nonblank "$JOUT")"
}

# ================================================================================================
# group: api - the low-level `aws s3api` commands
# ================================================================================================
g_api() {
    local d="$G_DIR" B="$PB" etag uid i
    mkdir -p "$d/out"

    # --- put-object with every option, then read everything back
    x "api-put/all-options" plain s3api put-object --bucket "$B" --key api/obj1 --body "$FX/hello.txt" --content-type text/x-api \
        --cache-control no-cache --content-disposition inline --content-encoding identity --content-language en \
        --metadata a=1,b=2 --tagging 'x=1&y=2' --storage-class STANDARD
    bv_eq "api-put/etag-is-md5" "\"$($CALC md5hex "$FX/hello.txt")\"" "$(jv ETag)"
    x "api-head/headers" plain s3api head-object --bucket "$B" --key api/obj1
    bv_eq "api-head/content-length" "15" "$(jv ContentLength)"
    bv_eq "api-head/content-type" "text/x-api" "$(jv ContentType)"
    bv_eq "api-head/cache-control" "no-cache" "$(jv CacheControl)"
    bv_eq "api-head/content-language" "en" "$(jv ContentLanguage)"
    bv_eq "api-head/metadata" "1,2" "$(jv Metadata.a),$(jv Metadata.b)"
    x "api-get/to-file" plain s3api get-object --bucket "$B" --key api/obj1 "$d/out/obj1"
    bv_eq "api-get/body" "hello binvault" "$(cat "$d/out/obj1" 2>/dev/null)"
    x "api-get/range" plain s3api get-object --bucket "$B" --key api/obj1 --range bytes=6-12 "$d/out/range"
    bv_eq "api-get/range-body" "binvaul" "$(cat "$d/out/range" 2>/dev/null)"
    bv_eq "api-get/range-content-range" "bytes 6-12/15" "$(jv ContentRange)"
    xe "api-get/range-not-satisfiable" 'InvalidRange|416|not satisfiable' plain s3api get-object --bucket "$B" --key api/obj1 --range bytes=100- "$d/out/none"
    xe "api-get/missing-key" 'NoSuchKey' plain s3api get-object --bucket "$B" --key api/missing "$d/out/none"
    xe "api-head/missing-key" '404|Not Found' plain s3api head-object --bucket "$B" --key api/missing

    # --- conditional reads
    x "" plain s3api head-object --bucket "$B" --key api/obj1; etag="$(jv ETag)"
    x "api-get/if-match-ok" plain s3api get-object --bucket "$B" --key api/obj1 --if-match "$etag" "$d/out/c1"
    xe "api-get/if-match-fails" 'PreconditionFailed|412' plain s3api get-object --bucket "$B" --key api/obj1 --if-match '"nope"' "$d/out/c2"
    xe "api-get/if-none-match-304" '304|Not Modified' plain s3api get-object --bucket "$B" --key api/obj1 --if-none-match "$etag" "$d/out/c3"
    x "api-put/create-only-succeeds-on-a-new-key" plain s3api put-object --bucket "$B" --key api/once --body "$FX/hello.txt" --if-none-match '*'
    xe "api-put/create-only-fails-on-an-existing-key" 'PreconditionFailed|412' plain s3api put-object --bucket "$B" --key api/once --body "$FX/hello.txt" --if-none-match '*'

    # --- tagging
    x "api-tagging/get-from-put" plain s3api get-object-tagging --bucket "$B" --key api/obj1
    bv_eq "api-tagging/two-tags" "2" "$(jl TagSet)"
    x "api-tagging/put" plain s3api put-object-tagging --bucket "$B" --key api/obj1 --tagging 'TagSet=[{Key=env,Value=prod},{Key="sp ace",Value="v w"}]'
    x "" plain s3api get-object-tagging --bucket "$B" --key api/obj1
    bv_eq "api-tagging/replaced" "2" "$(jl TagSet)"
    x "api-tagging/delete" plain s3api delete-object-tagging --bucket "$B" --key api/obj1
    x "" plain s3api get-object-tagging --bucket "$B" --key api/obj1
    bv_eq "api-tagging/empty-after-delete" "0" "$(jl TagSet)"
    xe "api-tagging/too-many-tags" 'InvalidTag' plain s3api put-object-tagging --bucket "$B" --key api/obj1 \
        --tagging 'TagSet=[{Key=a,Value=1},{Key=b,Value=1},{Key=c,Value=1},{Key=d,Value=1},{Key=e,Value=1},{Key=f,Value=1},{Key=g,Value=1},{Key=h,Value=1},{Key=i,Value=1},{Key=j,Value=1},{Key=k,Value=1}]'

    # --- copy-object
    x "api-copy/copy" plain s3api copy-object --bucket "$B" --key api/copy1 --copy-source "$B/api/obj1"
    bv_eq "api-copy/etag" "\"$($CALC md5hex "$FX/hello.txt")\"" "$(jv CopyObjectResult.ETag)"
    x "api-copy/replace-metadata" plain s3api copy-object --bucket "$B" --key api/copy2 --copy-source "$B/api/obj1" --metadata-directive REPLACE --metadata z=9 --content-type text/x-replaced
    x "" plain s3api head-object --bucket "$B" --key api/copy2
    bv_eq "api-copy/replaced-content-type" "text/x-replaced" "$(jv ContentType)"
    bv_eq "api-copy/replaced-metadata" "9" "$(jv Metadata.z)"
    xe "api-copy/self-copy-is-invalid" 'InvalidRequest|copy request is illegal' plain s3api copy-object --bucket "$B" --key api/obj1 --copy-source "$B/api/obj1"
    xe "api-copy/other-bucket-denied" 'AccessDenied' plain s3api copy-object --bucket "$B" --key api/x --copy-source "$VB/anything"
    xe "api-copy/missing-source" 'NoSuchKey' plain s3api copy-object --bucket "$B" --key api/x --copy-source "$B/api/never"

    # --- delete-object(s)
    for i in 1 2 3 4 5; do x "" plain s3api put-object --bucket "$B" --key "api/del/$i" --body "$FX/hello.txt"; done
    printf '{"Objects":[{"Key":"api/del/1"},{"Key":"api/del/2"},{"Key":"api/del/never"}],"Quiet":false}' > "$d/del.json"
    x "api-delete-objects/batch" plain s3api delete-objects --bucket "$B" --delete "file://$d/del.json"
    bv_eq "api-delete-objects/reports-every-key" "3" "$(jl Deleted)"
    printf '{"Objects":[{"Key":"api/del/3"},{"Key":"api/del/4"}],"Quiet":true}' > "$d/delq.json"
    x "api-delete-objects/quiet" plain s3api delete-objects --bucket "$B" --delete "file://$d/delq.json"
    bv_eq "api-delete-objects/quiet-no-output" "" "$(nonblank "$JOUT")"
    x "api-delete/single" plain s3api delete-object --bucket "$B" --key api/del/5
    x "" plain s3api list-objects-v2 --bucket "$B" --prefix api/del/
    bv_eq "api-delete/all-gone" "0" "$(jl Contents 2>/dev/null || echo 0)"

    # --- listing
    for i in 1 2 3 4 5 6 7; do x "" plain s3api put-object --bucket "$B" --key "api/list/dir$((i % 3))/f$i" --body "$FX/hello.txt"; done
    x "api-list/v2-prefix" plain s3api list-objects-v2 --bucket "$B" --prefix api/list/
    bv_eq "api-list/v2-count" "7" "$(jl Contents)"
    x "api-list/v2-delimiter" plain s3api list-objects-v2 --bucket "$B" --prefix api/list/ --delimiter /
    bv_eq "api-list/v2-common-prefixes" "3" "$(jl CommonPrefixes)"
    x "api-list/v2-paged-by-3" plain s3api list-objects-v2 --bucket "$B" --prefix api/list/ --page-size 3
    bv_eq "api-list/v2-paged-total" "7" "$(jl Contents)"
    x "api-list/v1" plain s3api list-objects --bucket "$B" --prefix api/list/ --page-size 2
    bv_eq "api-list/v1-total" "7" "$(jl Contents)"
    x "api-list/max-items-with-token" plain s3api list-objects-v2 --bucket "$B" --prefix api/list/ --max-items 4
    bv_eq "api-list/max-items-4" "4" "$(jl Contents)"
    local tok; tok="$(jv NextToken)"
    if [ -n "$tok" ]; then
        x "api-list/starting-token" plain s3api list-objects-v2 --bucket "$B" --prefix api/list/ --max-items 100 --starting-token "$tok"
        bv_eq "api-list/rest-after-token" "3" "$(jl Contents)"
    else
        bv_fail "api-list/starting-token" "no NextToken after --max-items 4 over 7 keys"
    fi
    x "api-list/start-after" plain s3api list-objects-v2 --bucket "$B" --prefix api/list/ --start-after api/list/dir1/f4
    bv_eq "api-list/start-after-count" "3" "$(jl Contents)"
    x "api-list/max-keys-0" plain s3api list-objects-v2 --bucket "$B" --prefix api/list/ --max-keys 0 --no-paginate
    bv_eq "api-list/max-keys-0-key-count" "0" "$(jv KeyCount)"

    # --- low-level multipart, 3 parts + abort
    local pdir="$d/parts"; rm -rf "$pdir"; mkdir -p "$pdir"
    head -c 5242880 /dev/urandom > "$pdir/part1"; head -c 5242880 /dev/urandom > "$pdir/part2"; head -c 123456 /dev/urandom > "$pdir/part3"
    cat "$pdir/part1" "$pdir/part2" "$pdir/part3" > "$d/whole"
    x "api-mpu/create" plain s3api create-multipart-upload --bucket "$B" --key api/mpu --content-type text/x-mpu --metadata m=1
    uid="$(jv UploadId)"
    local -a tags=()
    for i in 1 2 3; do
        x "api-mpu/upload-part-$i" plain s3api upload-part --bucket "$B" --key api/mpu --upload-id "$uid" --part-number "$i" --body "$pdir/part$i"
        bv_eq "api-mpu/part-$i-etag" "\"$($CALC md5hex "$pdir/part$i")\"" "$(jv ETag)"
        tags+=("$(jv ETag)")
    done
    x "api-mpu/list-parts" plain s3api list-parts --bucket "$B" --key api/mpu --upload-id "$uid"
    bv_eq "api-mpu/list-parts-count" "3" "$(jl Parts)"
    x "api-mpu/list-parts-paged" plain s3api list-parts --bucket "$B" --key api/mpu --upload-id "$uid" --page-size 1
    bv_eq "api-mpu/list-parts-paged-count" "3" "$(jl Parts)"
    x "api-mpu/list-uploads" plain s3api list-multipart-uploads --bucket "$B" --prefix api/
    bv_eq "api-mpu/list-uploads-has-ours" "$uid" "$(jv Uploads[0].UploadId)"
    $CALC completejson "${tags[@]}" > "$d/complete.json"
    x "api-mpu/complete" plain s3api complete-multipart-upload --bucket "$B" --key api/mpu --upload-id "$uid" --multipart-upload "file://$d/complete.json"
    bv_eq "api-mpu/complete-etag" "\"$($CALC mp-etag "$d/whole" 5242880)\"" "$(jv ETag)"
    x "api-mpu/download" plain s3api get-object --bucket "$B" --key api/mpu "$d/out/mpu"
    bv_eq "api-mpu/content-sha256" "$(bv_sha256 "$d/whole")" "$(bv_sha256 "$d/out/mpu" 2>/dev/null)"
    bv_eq "api-mpu/content-type-from-create" "text/x-mpu" "$(jv ContentType)"
    x "api-mpu/get-part-number-2" plain s3api get-object --bucket "$B" --key api/mpu --part-number 2 "$d/out/p2"
    bv_eq "api-mpu/part-number-2-body" "$(bv_sha256 "$pdir/part2")" "$(bv_sha256 "$d/out/p2" 2>/dev/null)"
    bv_eq "api-mpu/part-number-2-parts-count" "3" "$(jv PartsCount)"
    x "api-mpu/object-attributes" plain s3api get-object-attributes --bucket "$B" --key api/mpu --object-attributes ETag ObjectSize ObjectParts StorageClass
    bv_eq "api-mpu/attributes-size" "$(( 5242880 * 2 + 123456 ))" "$(jv ObjectSize)"
    bv_eq "api-mpu/attributes-parts" "3" "$(jv ObjectParts.TotalPartsCount)"
    x "api-mpu/abort-setup" plain s3api create-multipart-upload --bucket "$B" --key api/mpu-abort
    uid="$(jv UploadId)"
    x "" plain s3api upload-part --bucket "$B" --key api/mpu-abort --upload-id "$uid" --part-number 1 --body "$pdir/part3"
    x "api-mpu/abort" plain s3api abort-multipart-upload --bucket "$B" --key api/mpu-abort --upload-id "$uid"
    xe "api-mpu/abort-then-no-such-upload" 'NoSuchUpload' plain s3api list-parts --bucket "$B" --key api/mpu-abort --upload-id "$uid"

    # --- bucket level
    x "api-bucket/list-buckets" plain s3api list-buckets
    bv_eq "api-bucket/list-buckets-only-own" "$PB" "$(jv Buckets[0].Name)"
    x "api-bucket/head-bucket" plain s3api head-bucket --bucket "$B"
    xe "api-bucket/head-bucket-other" '403|Forbidden' plain s3api head-bucket --bucket "$VB"
    x "api-bucket/location" plain s3api get-bucket-location --bucket "$B"
    x "api-bucket/versioning-off" plain s3api get-bucket-versioning --bucket "$B"
    bv_eq "api-bucket/versioning-has-no-status" "" "$(jv Status)"
    xe "api-bucket/lifecycle-none" 'NoSuchLifecycleConfiguration' plain s3api get-bucket-lifecycle-configuration --bucket "$B"
    xe "api-bucket/encryption-none" 'ServerSideEncryptionConfigurationNotFoundError' plain s3api get-bucket-encryption --bucket "$B"
    xe "api-bucket/cors-none" 'NoSuchCORSConfiguration' plain s3api get-bucket-cors --bucket "$B"
    xe "api-bucket/policy-none" 'NoSuchBucketPolicy' plain s3api get-bucket-policy --bucket "$B"
    x "api-bucket/acl" plain s3api get-bucket-acl --bucket "$B"
    bv_eq "api-bucket/acl-full-control" "FULL_CONTROL" "$(jv Grants[0].Permission)"
    x "api-bucket/object-acl" plain s3api get-object-acl --bucket "$B" --key api/obj1
    x "api-bucket/put-acl-private" plain s3api put-object-acl --bucket "$B" --key api/obj1 --acl private
    xe "api-bucket/put-acl-public-read-refused" 'AccessControlListNotSupported' plain s3api put-object-acl --bucket "$B" --key api/obj1 --acl public-read
    xe "api-bucket/put-versioning-refused" 'AccessDenied' plain s3api put-bucket-versioning --bucket "$B" --versioning-configuration Status=Enabled
    xe "api-bucket/delete-bucket-refused" 'AccessDenied' plain s3api delete-bucket --bucket "$B"
    xe "api-bucket/put-lifecycle-refused" 'AccessDenied' plain s3api put-bucket-lifecycle-configuration --bucket "$B" --lifecycle-configuration '{"Rules":[{"ID":"r","Status":"Enabled","Filter":{"Prefix":""},"Expiration":{"Days":1}}]}'
    xe "api-bucket/restore-object-not-implemented" 'NotImplemented' plain s3api restore-object --bucket "$B" --key api/obj1 --restore-request Days=1
}

# ================================================================================================
# group: checks - checksums as the CLI sends and verifies them
# ================================================================================================
g_checks() {
    local d="$G_DIR" b="s3://$PB/ck" alg ALG field want
    mkdir -p "$d/dl"
    if [ "$CRCOK" != 1 ]; then bv_skip "checks/_setup" "calc.py CRC self-test failed on this machine"; return 0; fi

    # --- the default: every upload carries a CRC32
    # (AWS CLI v2 defaults to CRC64NVME, a full-object checksum, for single-part and multipart uploads alike)
    x "checks-default/upload-single-part" plain s3 cp "$FX/f_100k" "$b/default1" --no-progress
    x "" plain s3api head-object --bucket "$PB" --key ck/default1 --checksum-mode ENABLED
    bv_eq "checks-default/crc64nvme-stored-single-part" "$($CALC crc64nvme "$FX/f_100k")" "$(jv ChecksumCRC64NVME)"
    x "checks-default/upload-multipart" plain ENV:AWS_PROFILE=mp5 s3 cp "$FX/f_12m" "$b/default12" --no-progress
    x "" plain s3api head-object --bucket "$PB" --key ck/default12 --checksum-mode ENABLED
    bv_eq "checks-default/crc64nvme-full-object-multipart" "$($CALC crc64nvme "$FX/f_12m")" "$(jv ChecksumCRC64NVME)"
    x "checks-default/download-validates" plain s3 cp "$b/default1" "$d/dl/default1" --no-progress
    bv_eq "checks-default/download-content" "$(bv_sha256 "$FX/f_100k")" "$(bv_sha256 "$d/dl/default1" 2>/dev/null)"

    # --- every algorithm, single part and multipart
    for alg in crc32 crc32c crc64nvme sha1 sha256; do
        ALG="$(printf '%s' "$alg" | tr a-z A-Z)"
        field="Checksum$ALG"
        x "checks-$alg/upload-single" plain s3 cp "$FX/f_200k" "$b/$alg-single" --no-progress --checksum-algorithm "$ALG"
        x "" plain s3api head-object --bucket "$PB" --key "ck/$alg-single" --checksum-mode ENABLED
        bv_eq "checks-$alg/stored-single" "$($CALC "$alg" "$FX/f_200k")" "$(jv "$field")"
        x "checks-$alg/upload-multipart" plain ENV:AWS_PROFILE=mp5 s3 cp "$FX/f_12m" "$b/$alg-multi" --no-progress --checksum-algorithm "$ALG"
        x "" plain s3api head-object --bucket "$PB" --key "ck/$alg-multi" --checksum-mode ENABLED
        if [ "$alg" = crc64nvme ]; then want="$($CALC crc64nvme "$FX/f_12m")"; else want="$($CALC mp-checksum "$alg" "$FX/f_12m" 5242880)"; fi
        bv_eq "checks-$alg/stored-multipart" "$want" "$(jv "$field")"
        x "checks-$alg/download" plain s3 cp "$b/$alg-multi" "$d/dl/$alg-multi" --no-progress
        bv_eq "checks-$alg/download-content" "$(bv_sha256 "$FX/f_12m")" "$(bv_sha256 "$d/dl/$alg-multi" 2>/dev/null)"
    done

    # --- when the SDK is told not to send one
    x "checks-required/upload" plain ENV:AWS_REQUEST_CHECKSUM_CALCULATION=when_required s3 cp "$FX/f_100k" "$b/required" --no-progress
    x "" plain s3api head-object --bucket "$PB" --key ck/required --checksum-mode ENABLED
    bv_eq "checks-required/no-checksum-stored" "" "$(jv ChecksumCRC32)$(jv ChecksumCRC64NVME)"

    # --- s3api put-object with explicit values
    x "checks-api/put-with-correct-sha256" plain s3api put-object --bucket "$PB" --key ck/api1 --body "$FX/hello.txt" --checksum-sha256 "$($CALC sha256 "$FX/hello.txt")"
    xe "checks-api/put-with-wrong-sha256" 'BadDigest' plain s3api put-object --bucket "$PB" --key ck/api2 --body "$FX/hello.txt" --checksum-sha256 "$($CALC sha256 "$FX/f_100k")"
    xe "checks-api/wrong-sha256-stored-nothing" '404|Not Found' plain s3api head-object --bucket "$PB" --key ck/api2
    x "checks-api/put-with-correct-md5" plain s3api put-object --bucket "$PB" --key ck/api3 --body "$FX/hello.txt" --content-md5 "$($CALC md5b64 "$FX/hello.txt")"
    xe "checks-api/put-with-wrong-md5" 'BadDigest' plain s3api put-object --bucket "$PB" --key ck/api4 --body "$FX/hello.txt" --content-md5 "$($CALC md5b64 "$FX/f_100k")"
    xe "checks-api/put-with-malformed-md5" 'InvalidDigest' plain s3api put-object --bucket "$PB" --key ck/api5 --body "$FX/hello.txt" --content-md5 'not-base64-@@'
    x "checks-api/attributes-checksum" plain s3api get-object-attributes --bucket "$PB" --key ck/api1 --object-attributes Checksum ETag
    bv_eq "checks-api/attributes-sha256" "$($CALC sha256 "$FX/hello.txt")" "$(jv Checksum.ChecksumSHA256)"
}

# ================================================================================================
# group: versioned - the bucket with versioning + SSE-S3 default encryption
# ================================================================================================
g_versioned() {
    local d="$G_DIR" B="$VB" b="s3://$VB/ver" v1 v2 v3 marker
    mkdir -p "$d/out"
    printf 'one\n' > "$d/v1"; printf 'two two\n' > "$d/v2"; printf 'three three three\n' > "$d/v3"

    x "ver-put/first" versioned s3api put-object --bucket "$B" --key ver/k --body "$d/v1"; v1="$(jv VersionId)"
    bv_eq "ver-put/reports-sse" "AES256" "$(jv ServerSideEncryption)"
    x "ver-put/second" versioned s3api put-object --bucket "$B" --key ver/k --body "$d/v2"; v2="$(jv VersionId)"
    x "ver-put/third-through-s3-cp" versioned s3 cp "$d/v3" "$b/k" --no-progress
    if [ -n "$v1" ] && [ -n "$v2" ] && [ "$v1" != "$v2" ]; then bv_pass "ver-put/distinct-version-ids"; else bv_fail "ver-put/distinct-version-ids" "v1=[$v1] v2=[$v2]"; fi
    x "ver-list/versions" versioned s3api list-object-versions --bucket "$B" --prefix ver/k
    bv_eq "ver-list/three-versions" "3" "$(jl Versions)"
    bv_eq "ver-list/newest-first-is-latest" "true" "$(jv Versions[0].IsLatest)"
    bv_eq "ver-list/oldest-is-v1" "$v1" "$(jv Versions[2].VersionId)"
    v3="$(jv Versions[0].VersionId)"
    x "ver-get/latest" versioned s3 cp "$b/k" - ; bv_eq "ver-get/latest-body" "three three three" "$JOUT"
    x "ver-get/old-version" versioned s3api get-object --bucket "$B" --key ver/k --version-id "$v1" "$d/out/old"
    bv_eq "ver-get/old-version-body" "one" "$(cat "$d/out/old" 2>/dev/null)"
    bv_eq "ver-get/reports-sse" "AES256" "$(jv ServerSideEncryption)"
    x "ver-head/by-version" versioned s3api head-object --bucket "$B" --key ver/k --version-id "$v2"
    bv_eq "ver-head/length-v2" "8" "$(jv ContentLength)"

    x "ver-delete/rm-adds-a-marker" versioned s3 rm "$b/k"
    xe "ver-delete/head-after-marker-is-404" '404|Not Found' versioned s3api head-object --bucket "$B" --key ver/k
    x "ver-delete/marker-listed" versioned s3api list-object-versions --bucket "$B" --prefix ver/k
    bv_eq "ver-delete/one-marker" "1" "$(jl DeleteMarkers)"
    bv_eq "ver-delete/versions-kept" "3" "$(jl Versions)"
    marker="$(jv DeleteMarkers[0].VersionId)"
    xe "ver-delete/get-marker-by-id-is-405" '405|MethodNotAllowed' versioned s3api get-object --bucket "$B" --key ver/k --version-id "$marker" "$d/out/none"
    x "ver-delete/purge-the-marker" versioned s3api delete-object --bucket "$B" --key ver/k --version-id "$marker"
    x "ver-delete/key-is-back" versioned s3 cp "$b/k" - ; bv_eq "ver-delete/key-is-back-body" "three three three" "$JOUT"
    x "ver-delete/purge-one-version" versioned s3api delete-object --bucket "$B" --key ver/k --version-id "$v2"
    x "" versioned s3api list-object-versions --bucket "$B" --prefix ver/k
    bv_eq "ver-delete/two-versions-left" "2" "$(jl Versions)"
    xe "ver-delete/purged-version-is-gone" 'NoSuchVersion|404' versioned s3api get-object --bucket "$B" --key ver/k --version-id "$v2" "$d/out/none"

    x "ver-copy/restore-old-version" versioned s3api copy-object --bucket "$B" --key ver/k --copy-source "$B/ver/k?versionId=$v1"
    x "ver-copy/restored-is-latest" versioned s3 cp "$b/k" - ; bv_eq "ver-copy/restored-body" "one" "$JOUT"
    x "ver-copy/s3-cp-server-side" versioned s3 cp "$b/k" "$b/k-copy" --no-progress
    x "" versioned s3api head-object --bucket "$B" --key ver/k-copy
    bv_eq "ver-copy/copy-is-encrypted" "AES256" "$(jv ServerSideEncryption)"

    x "ver-sync/upload-tree" versioned s3 sync "$d/out" "$b/sync/" --no-progress
    mkdir -p "$d/empty"
    x "ver-sync/delete-flag-adds-markers" versioned s3 sync "$d/empty" "$b/sync/" --delete --no-progress
    x "ver-multipart/upload-12mib" versioned ENV:AWS_PROFILE=mp5 s3 cp "$FX/f_12m" "$b/big" --no-progress
    x "" versioned s3api head-object --bucket "$B" --key ver/big
    bv_eq "ver-multipart/reports-sse" "AES256" "$(jv ServerSideEncryption)"
    bv_eq "ver-multipart/has-version-id" "yes" "$([ -n "$(jv VersionId)" ] && echo yes || echo no)"
    x "ver-multipart/download" versioned s3 cp "$b/big" "$d/out/big" --no-progress
    bv_eq "ver-multipart/content" "$(bv_sha256 "$FX/f_12m")" "$(bv_sha256 "$d/out/big" 2>/dev/null)"
    x "ver-rm/recursive-leaves-markers-and-versions" versioned s3 rm "$b/" --recursive
    x "" versioned s3api list-object-versions --bucket "$B" --prefix ver/
    bv_eq "ver-rm/history-is-kept" "yes" "$([ "$(jl Versions)" -gt 0 ] && echo yes || echo no)"
}

# ================================================================================================
# group: quota - bucket with quota_bytes = 8 MiB
# ================================================================================================
g_quota() {
    local d="$G_DIR" B="$QB" b="s3://$QB/q" stats
    mkdir -p "$d/out"
    x "quota/upload-within" quota s3 cp "$FX/f_5m1" "$b/a" --no-progress
    xe "quota/upload-over" 'QuotaExceeded|storage quota' quota s3 cp "$FX/f_5m1" "$b/b" --no-progress
    xe "quota/refused-object-not-stored" '404|Not Found' quota s3api head-object --bucket "$B" --key q/b
    x "quota/small-still-fits" quota s3 cp "$FX/f_1m" "$b/c" --no-progress
    xe "quota/multipart-over" 'QuotaExceeded|storage quota' quota ENV:AWS_PROFILE=mp5 s3 cp "$FX/f_12m" "$b/mp" --no-progress
    xe "quota/failed-multipart-leaves-no-object" '404|Not Found' quota s3api head-object --bucket "$B" --key q/mp
    x "" quota s3api list-multipart-uploads --bucket "$B"
    bv_eq "quota/failed-multipart-was-aborted" "0" "$(jl Uploads 2>/dev/null || echo 0)"
    stats="$(admin GET "/buckets/$B" 2>/dev/null)"
    bv_eq "quota/no-upload-bytes-left-open" "0" "$(printf '%s' "$stats" | $CALC jget stats.upload_bytes 2>/dev/null)"
    x "quota/delete-frees-space" quota s3 rm "$b/a"
    x "quota/upload-after-delete" quota s3 cp "$FX/f_5m1" "$b/b" --no-progress
    xe "quota/sync-stops-at-the-quota" 'QuotaExceeded|storage quota' quota s3 sync "$FX" "$b/sync/" --no-progress
}

# ================================================================================================
# group: ctype - bucket that accepts image/png, image/jpeg and text/plain only
# ================================================================================================
g_ctype() {
    local d="$G_DIR" B="$CB" b="s3://$CB/t"
    mkdir -p "$d/out"
    x "ctype/png-accepted" ctype s3 cp "$FX/pic.png" "$b/pic.png" --no-progress
    x "ctype/jpeg-accepted" ctype s3 cp "$FX/pic.jpg" "$b/pic.jpg" --no-progress
    x "ctype/text-accepted" ctype s3 cp "$FX/hello.txt" "$b/hello.txt" --no-progress
    xe "ctype/pdf-refused" 'ContentTypeNotAllowed|415|not allowed' ctype s3 cp "$FX/doc.pdf" "$b/doc.pdf" --no-progress
    xe "ctype/gif-refused" 'ContentTypeNotAllowed|415|not allowed' ctype s3 cp "$FX/pic.gif" "$b/pic.gif" --no-progress
    xe "ctype/html-refused-even-when-declared-text-plain" 'ContentTypeNotAllowed|415|not allowed' ctype s3 cp "$FX/page.html" "$b/page.txt" --content-type text/plain --no-progress
    x "ctype/png-accepted-even-when-declared-html" ctype s3 cp "$FX/pic.png" "$b/sneaky.html" --content-type text/html --no-progress
    xe "ctype/random-binary-refused" 'ContentTypeNotAllowed|415|not allowed' ctype s3 cp "$FX/f_100k" "$b/blob.bin" --no-progress
    xe "ctype/refused-objects-not-stored" '404|Not Found' ctype s3api head-object --bucket "$B" --key t/doc.pdf
    x "ctype/multipart-png-accepted" ctype ENV:AWS_PROFILE=mp5 s3 cp "$FX/png_big.bin" "$b/big.png" --no-progress
    x "" ctype s3api head-object --bucket "$B" --key t/big.png
    bv_eq "ctype/multipart-png-size" "$(bv_filesize "$FX/png_big.bin")" "$(jv ContentLength)"
    cat "$FX/doc.pdf" "$FX/f_12m" > "$d/pdf_big.bin"
    xe "ctype/multipart-pdf-refused" 'ContentTypeNotAllowed|415|not allowed' ctype ENV:AWS_PROFILE=mp5 s3 cp "$d/pdf_big.bin" "$b/big.pdf" --no-progress
    xe "ctype/multipart-pdf-not-stored" '404|Not Found' ctype s3api head-object --bucket "$B" --key t/big.pdf
    x "" ctype s3api list-multipart-uploads --bucket "$B"
    bv_eq "ctype/multipart-pdf-leaves-no-open-upload" "0" "$(jl Uploads 2>/dev/null || echo 0)"
    mkdir -p "$d/mix"; cp "$FX/pic.png" "$d/mix/a.png"; cp "$FX/doc.pdf" "$d/mix/b.pdf"; cp "$FX/hello.txt" "$d/mix/c.txt"
    xe "ctype/sync-reports-the-refused-file" 'ContentTypeNotAllowed|415|not allowed' ctype s3 sync "$d/mix" "$b/mix/" --no-progress
    x "" ctype s3 ls "$b/mix/"
    bv_eq "ctype/sync-uploaded-the-allowed-ones" "a.png,c.txt" "$(printf '%s\n' "$JOUT" | awk 'NF{print $4}' | paste -sd, -)"
}

# ================================================================================================
# group: public - anonymous read and CORS
# ================================================================================================
g_public() {
    local d="$G_DIR" B="$PUB" b="s3://$PUB/pub" url="$EP/$PUB"
    mkdir -p "$d/out"
    x "public/put" public s3 cp "$FX/hello.txt" "$b/h.txt" --no-progress --cache-control 'public, max-age=60' --content-type text/html
    x "public/anonymous-get-through-the-cli" anon s3 cp "$b/h.txt" - --no-sign-request
    bv_eq "public/anonymous-body" "hello binvault" "$JOUT"
    x "public/anonymous-get-object" anon s3api get-object --bucket "$B" --key pub/h.txt --no-sign-request "$d/out/h"
    bv_eq "public/anonymous-cache-control" "public, max-age=60" "$(jv CacheControl)"
    xe "public/anonymous-list-denied" 'AccessDenied' anon s3 ls "s3://$B/" --no-sign-request
    xe "public/anonymous-list-objects-denied" 'AccessDenied' anon s3api list-objects-v2 --bucket "$B" --no-sign-request
    xe "public/anonymous-put-denied" 'AccessDenied' anon s3 cp "$FX/hello.txt" "$b/evil.txt" --no-sign-request --no-progress
    xe "public/anonymous-delete-denied" 'AccessDenied' anon s3 rm "$b/h.txt" --no-sign-request
    xe "public/anonymous-version-id-denied" 'AccessDenied' anon s3api get-object --bucket "$B" --key pub/h.txt --version-id null --no-sign-request "$d/out/none"
    xe "public/anonymous-tagging-denied" 'AccessDenied' anon s3api get-object-tagging --bucket "$B" --key pub/h.txt --no-sign-request
    xe "public/private-bucket-denies-anonymous" 'AccessDenied|Forbidden|403' anon s3 cp "s3://$PB/s3h/up/f_1m" - --no-sign-request
    fetch "$url/pub/h.txt"
    if [ "$FSTATUS" = 200 ] && [ "$FTEXT" = "hello binvault" ]; then bv_pass "public/curl-anonymous-get"; else bv_fail "public/curl-anonymous-get" "HTTP $FSTATUS"; fi
    bv_contains "public/curl-sandbox-header" "$(printf '%s' "$FHDR" | tr 'A-Z' 'a-z')" "content-security-policy: sandbox"
    bv_contains "public/curl-nosniff-header" "$(printf '%s' "$FHDR" | tr 'A-Z' 'a-z')" "x-content-type-options: nosniff"
    bv_contains "public/curl-cache-control-header" "$(printf '%s' "$FHDR" | tr 'A-Z' 'a-z')" "cache-control: public, max-age=60"
    fetch "$url/pub/h.txt" -X OPTIONS -H "Origin: https://app.example.com" -H "Access-Control-Request-Method: GET"
    if [ "$FSTATUS" = 200 ]; then bv_pass "public/cors-preflight-allowed"; else bv_fail "public/cors-preflight-allowed" "HTTP $FSTATUS"; fi
    bv_contains "public/cors-allow-origin" "$(printf '%s' "$FHDR" | tr 'A-Z' 'a-z')" "access-control-allow-origin: https://app.example.com"
    fetch "$url/pub/h.txt" -X OPTIONS -H "Origin: https://evil.example.com" -H "Access-Control-Request-Method: GET"
    if [ "$FSTATUS" = 403 ]; then bv_pass "public/cors-preflight-denied-for-other-origin"; else bv_fail "public/cors-preflight-denied-for-other-origin" "HTTP $FSTATUS"; fi
    x "public/get-bucket-cors-view" public s3api get-bucket-cors --bucket "$B"
    bv_eq "public/get-bucket-cors-origin" "https://app.example.com" "$(jv CORSRules[0].AllowedOrigins[0])"
}

# ================================================================================================
# group: odd - the odd-keys table through the CLI
# ================================================================================================
g_odd() {
    local d="$G_DIR" B="$PB" id key kf n=0
    mkdir -p "$d/keys" "$d/out"
    python3 - "$BV_CONF_DIR/support/oddkeys.json" "$d/keys" <<'PY'
import json, sys, os
doc = json.load(open(sys.argv[1], encoding="utf-8"))
for e in doc["keys"]:
    k = e.get("key")
    if k is None:
        k = e["gen"]["char"] * e["gen"]["count"]
    open(os.path.join(sys.argv[2], e["id"] + ".key"), "wb").write(k.encode("utf-8"))
g = doc["too_long"]
open(os.path.join(sys.argv[2], "_too_long.key"), "wb").write((g["char"] * g["count"]).encode("utf-8"))
PY
    for kf in "$d"/keys/*.key; do
        id="$(basename "$kf" .key)"; [ "$id" = _too_long ] && continue
        key="$(cat "$kf")"
        printf 'body of %s\n' "$id" > "$d/body"
        x "odd-$id/put" plain s3api put-object --bucket "$B" --key "$key" --body "$d/body"
        x "odd-$id/head" plain s3api head-object --bucket "$B" --key "$key"
        bv_eq "odd-$id/length" "$(bv_filesize "$d/body")" "$(jv ContentLength)"
        x "odd-$id/get" plain s3api get-object --bucket "$B" --key "$key" "$d/out/got"
        bv_eq "odd-$id/body" "$(cat "$d/body")" "$(cat "$d/out/got" 2>/dev/null)"
        x "" plain s3api list-objects-v2 --bucket "$B" --prefix "$key"
        if printf '%s' "$JOUT" | $CALC jhaskey "$kf" 2>/dev/null; then bv_pass "odd-$id/listed"; else bv_fail "odd-$id/listed" "key not in the listing: $(printf '%s' "$JOUT" | head -c 200)"; fi
        case "$key" in
            */) ;;                                                       # `aws s3 cp` treats a trailing slash as a prefix
            *)
                x "odd-$id/s3-cp-download" plain s3 cp "s3://$B/$key" "$d/out/cp" --no-progress
                bv_eq "odd-$id/s3-cp-body" "$(cat "$d/body")" "$(cat "$d/out/cp" 2>/dev/null)"
                x "odd-$id/s3-cp-server-side-copy" plain s3 cp "s3://$B/$key" "s3://$B/odd-copy/$id" --no-progress
                x "odd-$id/s3-rm" plain s3 rm "s3://$B/$key"
                ;;
        esac
        x "odd-$id/delete-object" plain s3api delete-object --bucket "$B" --key "$key"
        xe "odd-$id/gone" '404|Not Found' plain s3api head-object --bucket "$B" --key "$key"
        n=$((n + 1))
    done
    key="$(cat "$d/keys/_too_long.key")"
    xe "odd-too-long/put" 'KeyTooLongError|too long' plain s3api put-object --bucket "$B" --key "$key" --body "$FX/hello.txt"
    mkdir -p "$d/odd-tree"
    n=0
    for kf in plain space plus percent cyrillic cjk emoji; do
        key="$(cat "$d/keys/$kf.key")"
        mkdir -p "$d/odd-tree/$(dirname "$key")" 2>/dev/null && printf 'sync %s\n' "$kf" > "$d/odd-tree/$key" && n=$((n + 1))
    done
    bv_age_files "$d/odd-tree"   # whole-second S3 timestamps: a file written in the second of its upload would look newer to sync
    x "odd-sync/upload" plain s3 sync "$d/odd-tree" "s3://$B/odd-sync/" --no-progress
    x "odd-sync/second-run-is-a-no-op" plain s3 sync "$d/odd-tree" "s3://$B/odd-sync/" --no-progress
    bv_eq "odd-sync/second-run-output-empty" "" "$(nonblank "$JOUT")"
    mkdir -p "$d/odd-dl"
    x "odd-sync/download" plain s3 sync "s3://$B/odd-sync/" "$d/odd-dl" --no-progress
    if diff -r "$d/odd-tree" "$d/odd-dl" >/dev/null 2>&1; then bv_pass "odd-sync/roundtrip-identical"; else bv_fail "odd-sync/roundtrip-identical" "$(diff -rq "$d/odd-tree" "$d/odd-dl" 2>&1 | head -n 3)"; fi
    x "odd-sync/cleanup" plain s3 rm "s3://$B/odd-sync/" --recursive
}

# ================================================================================================
# group: errors - what the CLI prints for the failures users meet
# ================================================================================================
g_errors() {
    local d="$G_DIR" B="$PB" lim ak sk
    mkdir -p "$d/out"
    xe "err/ls-missing-bucket" 'NoSuchBucket' plain s3 ls "s3://bvt-awscli-does-not-exist"
    xe "err/get-missing-bucket" 'NoSuchBucket' plain s3api get-object --bucket bvt-awscli-does-not-exist --key k "$d/out/none"
    xe "err/cp-missing-key" '404|Not Found|does not exist' plain s3 cp "s3://$B/err/never" "$d/out/none" --no-progress
    xe "err/wrong-secret" 'SignatureDoesNotMatch' bad s3 ls "s3://$B/"
    xe "err/unknown-access-key" 'InvalidAccessKeyId' key:BVKAAAAAAAAAAAAAAAAA:0123456789012345678901234567890123456789 s3 ls "s3://$B/"
    xe "err/no-credentials" 'Unable to locate credentials|AccessDenied' anon s3 ls "s3://$B/"
    xe "err/other-buckets-token" 'AccessDenied' versioned s3 ls "s3://$B/"
    xe "err/other-buckets-cp" 'AccessDenied|403|Forbidden' plain s3 cp "$FX/hello.txt" "s3://$VB/err/x" --no-progress
    xe "err/mb-new-name" 'AccessDenied' plain s3 mb "s3://bvt-awscli-brand-new-bucket"
    xe "err/rb-own" 'AccessDenied' plain s3 rb "s3://$B"
    xe "err/website-not-implemented" 'NotImplemented|NoSuchWebsiteConfiguration' plain s3api put-bucket-website --bucket "$B" --website-configuration '{"IndexDocument":{"Suffix":"index.html"}}'
    xe "err/storage-class-glacier" 'InvalidStorageClass' plain s3 cp "$FX/hello.txt" "s3://$B/err/g" --storage-class GLACIER --no-progress
    xe "err/sse-c-refused" 'NotImplemented|InvalidArgument|InvalidRequest' plain s3api put-object --bucket "$B" --key err/ssec --body "$FX/hello.txt" --sse-customer-algorithm AES256 --sse-customer-key 01234567890123456789012345678901
    xe "err/kms-refused" 'NotImplemented' plain s3api put-object --bucket "$B" --key err/kms --body "$FX/hello.txt" --server-side-encryption aws:kms
    xe "err/object-lock-refused" 'NotImplemented|InvalidRequest|InvalidArgument' plain s3api put-object --bucket "$B" --key err/lock --body "$FX/hello.txt" --object-lock-mode GOVERNANCE --object-lock-retain-until-date 2040-01-01T00:00:00Z
    xe "err/website-redirect-refused" 'NotImplemented|InvalidArgument|InvalidRequest' plain s3api put-object --bucket "$B" --key err/redir --body "$FX/hello.txt" --website-redirect-location /elsewhere

    # --- a throttled bucket: the CLI's own retries ride out SlowDown, no retries show it
    lim="bvt-awscli-limited"
    admin POST /buckets "{\"name\":\"$lim\",\"limits\":{\"requests_per_second\":4,\"burst\":4}}" >/dev/null 2>&1 || admin PUT "/buckets/$lim" '{"limits":{"requests_per_second":4,"burst":4}}' >/dev/null 2>&1
    local tok; tok="$(admin POST "/buckets/$lim/tokens" '{"name":"cli","grants":[{"actions":["read","write","list","delete","purge","tag"]}]}' 2>/dev/null)"
    ak="$(printf '%s' "$tok" | $CALC jget access_key_id 2>/dev/null)"; sk="$(printf '%s' "$tok" | $CALC jget secret_access_key 2>/dev/null)"
    if [ -z "$ak" ]; then
        bv_skip "err-throttle/_setup" "could not create the rate-limited bucket through the admin API"
    else
        mkdir -p "$d/many"; local i
        for i in $(seq 1 30); do printf 'f%d\n' "$i" > "$d/many/f$i.txt"; done
        xe "err-throttle/no-retries-shows-slowdown" 'SlowDown|Slow Down|503' key:$ak:$sk ENV:AWS_PROFILE=noretry s3 cp "$d/many" "s3://$lim/m/" --recursive --no-progress
        x "err-throttle/retries-ride-it-out" key:$ak:$sk ENV:AWS_PROFILE=retry s3 cp "$d/many" "s3://$lim/m2/" --recursive --no-progress
        x "" key:$ak:$sk ENV:AWS_PROFILE=retry s3 ls "s3://$lim/m2/" --summarize
        bv_contains "err-throttle/all-30-arrived" "$JOUT" "Total Objects: 30"
    fi
}

# ================================================================================================
# group: vhost - virtual-hosted-style addressing through the CLI
# ================================================================================================
g_vhost() {
    local d="$G_DIR" B="$PB" b="s3://$PB/vh" vep="http://$BV_DOMAIN:$PORT"
    mkdir -p "$d/out"
    x "vhost/put" plain ENV:AWS_PROFILE=vhost EP:"$vep" s3 cp "$FX/hello.txt" "$b/h.txt" --no-progress
    x "vhost/ls" plain ENV:AWS_PROFILE=vhost EP:"$vep" s3 ls "$b/"
    bv_contains "vhost/ls-shows-the-key" "$JOUT" "h.txt"
    x "vhost/get" plain ENV:AWS_PROFILE=vhost EP:"$vep" s3 cp "$b/h.txt" - ; bv_eq "vhost/get-body" "hello binvault" "$JOUT"
    x "vhost/path-style-sees-the-same-key" plain s3 cp "$b/h.txt" - ; bv_eq "vhost/path-style-body" "hello binvault" "$JOUT"
    x "vhost/underscore-key" plain ENV:AWS_PROFILE=vhost EP:"$vep" s3 cp "$FX/hello.txt" "$b/_next/app.js" --no-progress
    x "vhost/underscore-key-via-path-style" plain s3 cp "$b/_next/app.js" - ; bv_eq "vhost/underscore-key-body" "hello binvault" "$JOUT"
    x "vhost/head-object" plain ENV:AWS_PROFILE=vhost EP:"$vep" s3api head-object --bucket "$B" --key vh/h.txt
    x "vhost/multipart-20mib" plain ENV:AWS_PROFILE=vhost EP:"$vep" s3 cp "$FX/f_20m" "$b/big" --no-progress
    x "vhost/multipart-download" plain ENV:AWS_PROFILE=vhost EP:"$vep" s3 cp "$b/big" "$d/out/big" --no-progress
    bv_eq "vhost/multipart-content" "$(bv_sha256 "$FX/f_20m")" "$(bv_sha256 "$d/out/big" 2>/dev/null)"
    x "vhost/sync" plain ENV:AWS_PROFILE=vhost EP:"$vep" s3 sync "$FX" "$b/sync/" --exclude '*' --include 'f_1*' --no-progress
    x "vhost/rm-recursive" plain ENV:AWS_PROFILE=vhost EP:"$vep" s3 rm "$b/" --recursive
    x "vhost/presign" plain ENV:AWS_PROFILE=vhost EP:"$vep" s3 presign "$b/h.txt"
    bv_contains "vhost/presign-names-the-bucket-host" "$JOUT" "$PB.$BV_DOMAIN"
    x "vhost/public-anonymous" anon ENV:AWS_PROFILE=vhost EP:"$vep" s3 cp "s3://$PUB/pub/h.txt" - --no-sign-request
}

# ================================================================================================
# main
# ================================================================================================
# the node must be reachable from where the CLI runs
G_DIR="$W"
x "" plain s3api head-bucket --bucket "$PB"
if [ "$JRC" -ne 0 ]; then
    bv_skip "awscli/_setup" "the CLI cannot reach the node at $EP: $(printf '%s' "$JERR" | tail -n 2)"
    exit 0
fi

for g in $GROUPS_RUN; do
    case " $GROUPS_ALL " in *" $g "*) ;; *) bv_warn "unknown awscli group '$g'"; continue ;; esac
    G_DIR="$W/g_$g"; rm -rf "$G_DIR"; mkdir -p "$G_DIR"
    "g_$g"
done
exit 0
