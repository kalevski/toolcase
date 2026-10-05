#!/usr/bin/env bash
# suite s3cmd: s3cmd (a python venv in the cache dir, latest from PyPI) - a boto-free Python client with its own SigV4, multipart, sync and
# bucket-info code paths. SigV2 (signurl, --signature-v2) is refused by design (spec 4.5) and is checked as such.
# Env (development): S3CMD_GROUPS (space separated subset of: basic multi sync info rules odd)
set -uo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd -P)"
. "$HERE/../../support/common.sh"
RCLONE_DIR="$HERE/../rclone"
PROBE="python3 $RCLONE_DIR/s3probe.py"
TU="python3 $RCLONE_DIR/treeutil.py"
OK="python3 $RCLONE_DIR/oddkeys.py"
export BV_ENDPOINT
W="$BV_SUITE_DIR/w"; mkdir -p "$W"
PB="$BV_PLAIN_BUCKET"; PUB="$BV_PUBLIC_BUCKET"; QB="$BV_QUOTA_BUCKET"; CB="$BV_CTYPE_BUCKET"
HOSTPORT="${BV_ENDPOINT#http://}"
GROUPS_ALL="basic multi sync info rules odd"
GROUPS_RUN="${S3CMD_GROUPS:-$GROUPS_ALL}"

# ---- the client: pip install s3cmd into a cached venv ----------------------------------------------------
CACHE="${BV_CACHE_DIR:-${TMPDIR:-/tmp}/binvault-conformance-cache}"
VENV="$CACHE/venv-s3cmd"
S3CMD=""
if bv_have s3cmd && s3cmd --version 2>&1 | grep -q 's3cmd version'; then
    S3CMD="$(command -v s3cmd)"
else
    mkdir -p "$CACHE"
    if [ ! -x "$VENV/bin/s3cmd" ]; then
        bv_info "installing s3cmd (cached in $VENV)"
        rm -rf "$VENV"
        if ! python3 -m venv "$VENV" >&2 || ! "$VENV/bin/pip" install -q --disable-pip-version-check s3cmd >&2; then
            rm -rf "$VENV"; bv_skip "s3cmd/_setup" "pip install s3cmd failed (offline?)"; exit 0
        fi
    fi
    S3CMD="$VENV/bin/s3cmd"
fi
bv_info "$("$S3CMD" --version 2>&1 | head -n 1)"

mkcfg() { # NAME AK SK
    cat > "$W/$1.cfg" <<EOF
[default]
access_key = $2
secret_key = $3
host_base = $HOSTPORT
host_bucket = $HOSTPORT
use_https = False
signature_v2 = False
bucket_location = us-east-1
check_ssl_certificate = False
check_ssl_hostname = False
progress_meter = False
human_readable_sizes = False
multipart_chunk_size_mb = 5
EOF
}
mkcfg plain "$BV_PLAIN_AK" "$BV_PLAIN_SK"
mkcfg quota "$BV_QUOTA_AK" "$BV_QUOTA_SK"
mkcfg ctype "$BV_CTYPE_AK" "$BV_CTYPE_SK"
mkcfg public "$BV_PUBLIC_AK" "$BV_PUBLIC_SK"
mkcfg anon "" ""

# sc CFG ARGS...  run s3cmd; sets SOUT SERR SALL SRC
sc() {
    local cfg="$1"; shift
    local ef="$G_DIR/.err.$RANDOM$RANDOM"
    SOUT="$(HOME="$W" "$S3CMD" -c "$W/$cfg.cfg" --no-check-certificate "$@" 2>"$ef")"; SRC=$?
    SERR="$(grep -v 'python-magic' "$ef" 2>/dev/null)"; rm -f "$ef"
    SALL="$SOUT
$SERR"
    return 0
}
scx() { local n="$1" cfg="$2"; shift 2; sc "$cfg" "$@"; if [ "$SRC" -eq 0 ]; then bv_pass "$n"; else bv_fail "$n" "exit $SRC: $(printf '%s' "$SERR$SOUT" | tail -n 3)"; fi; }
scxe() {
    local n="$1" pat="$2" cfg="$3"; shift 3; sc "$cfg" "$@"
    if [ "$SRC" -eq 0 ]; then bv_fail "$n" "expected failure but s3cmd succeeded: $(printf '%s' "$SALL" | tail -n 2 | head -c 300)"
    elif printf '%s' "$SALL" | grep -Eqi -- "$pat"; then bv_pass "$n"
    else bv_fail "$n" "exit $SRC but output does not match /$pat/: $(printf '%s' "$SALL" | tail -n 3 | head -c 400)"; fi
}
probe() { local k="$1"; shift; $PROBE --kind "$k" "$@"; }
head_hdr() { probe "$1" head "$2" | python3 -c 'import json,sys; print(json.load(sys.stdin)["headers"].get(sys.argv[1],""))' "$3"; }
keys_eq() {
    local n="$1" kind="$2" prefix="$3"; shift 3
    local got want
    got="$(probe "$kind" list "$prefix" | python3 -c 'import json,sys; print("\n".join(sorted(json.load(sys.stdin), key=lambda k: k.encode())))')"
    want="$(printf '%s\n' "$@" | python3 -c 'import sys; print("\n".join(sorted([l.rstrip("\n") for l in sys.stdin if l.strip()], key=lambda k: k.encode())))')"
    if [ "$got" = "$want" ]; then bv_pass "$n"; else bv_fail "$n" "stored keys differ. stored: $(printf '%s' "$got" | head -c 300 | tr '\n' ' ') | expected: $(printf '%s' "$want" | head -c 300 | tr '\n' ' ')"; fi
}
count_keys() { probe "$1" list "$2" | python3 -c 'import json,sys; print(len(json.load(sys.stdin)))'; }
md5of() { python3 -c 'import hashlib,sys; print(hashlib.md5(open(sys.argv[1],"rb").read()).hexdigest())' "$1"; }

mkfx() { [ -f "$W/$1" ] || bv_mkfile "$W/$1" "$2"; }
mkfx f_100k 102400
mkfx f_12m 12582912
printf 'hello binvault\n' > "$W/hello.txt"
TREE="$W/tree"; [ -d "$TREE" ] || $TU gen "$TREE"
$TU png "$W/pic.png"
printf '%%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< /Root 1 0 R >>\n%%%%EOF\n' > "$W/doc.pdf"

G_DIR="$W"
sc plain ls
if [ "$SRC" -ne 0 ]; then bv_skip "s3cmd/_setup" "s3cmd cannot reach the node at $BV_ENDPOINT: $(printf '%s' "$SERR" | tail -n 2)"; exit 0; fi

# ================================================================================================
g_basic() {
    local d="$G_DIR" b="s3://$PB/sc"
    scx "basic/ls-buckets" plain ls
    bv_contains "basic/ls-shows-the-bucket" "$SOUT" "s3://$PB"
    bv_eq "basic/ls-one-bucket" "1" "$(printf '%s\n' "$SOUT" | grep -c .)"
    scx "basic/mb-own-bucket" plain mb "s3://$PB"
    scxe "basic/mb-new-bucket-denied" 'AccessDenied|Access Denied|403' plain mb "s3://bvt-s3cmd-brand-new-bucket"
    scxe "basic/rb-denied" 'AccessDenied|Access Denied|403' plain rb "s3://$PB"
    scx "basic/put" plain put "$W/hello.txt" "$b/hello.txt"
    scx "basic/ls-prefix" plain ls "$b/"; bv_contains "basic/ls-shows-the-key" "$SOUT" "hello.txt"
    scx "basic/get" plain get --force "$b/hello.txt" "$d/got.txt"
    bv_eq "basic/get-body" "hello binvault" "$(cat "$d/got.txt" 2>/dev/null)"
    scx "basic/info" plain info "$b/hello.txt"
    bv_contains "basic/info-md5" "$SOUT" "$(md5of "$W/hello.txt")"
    bv_contains "basic/info-storage" "$SOUT" "STANDARD"
    scx "basic/du" plain du "s3://$PB/sc"
    scx "basic/cat" plain get --force "$b/hello.txt" -; bv_contains "basic/cat-body" "$SOUT" "hello binvault"
    scx "basic/cp-server-side" plain cp "$b/hello.txt" "$b/copy.txt"
    scx "basic/mv-server-side" plain mv "$b/copy.txt" "$b/moved.txt"
    keys_eq "basic/mv-left-only-the-target" plain sc/ sc/hello.txt sc/moved.txt
    scx "basic/del" plain del "$b/moved.txt"
    keys_eq "basic/del-removed-it" plain sc/ sc/hello.txt
    scxe "basic/get-missing" '404|NoSuchKey|does not exist|Not Found' plain get --force "$b/never" "$d/never"
    scx "basic/put-with-headers" plain put --mime-type text/x-s3cmd --add-header "Cache-Control: max-age=77" --add-header "x-amz-meta-owner: me" "$W/hello.txt" "$b/hdr.txt"
    bv_eq "basic/header-content-type" "text/x-s3cmd" "$(head_hdr plain sc/hdr.txt content-type)"
    bv_eq "basic/header-cache-control" "max-age=77" "$(head_hdr plain sc/hdr.txt cache-control)"
    bv_eq "basic/header-user-metadata" "me" "$(head_hdr plain sc/hdr.txt x-amz-meta-owner)"
    scx "basic/modify-headers" plain modify --add-header "Cache-Control: max-age=5" "$b/hdr.txt"
    bv_eq "basic/modify-cache-control" "max-age=5" "$(head_hdr plain sc/hdr.txt cache-control)"
    scx "basic/put-sse-s3" plain put --server-side-encryption "$W/hello.txt" "$b/sse.txt"
    bv_eq "basic/sse-s3-reported" "AES256" "$(head_hdr plain sc/sse.txt x-amz-server-side-encryption)"
    scxe "basic/put-sse-kms-refused" 'NotImplemented|not implemented|501' plain put --server-side-encryption --server-side-encryption-kms-id=alias/x "$W/hello.txt" "$b/kms.txt"
    scx "basic/put-acl-private" plain put --acl-private "$W/hello.txt" "$b/private.txt"
    scxe "basic/put-acl-public-refused" 'AccessControlListNotSupported|ACL|400' plain put --acl-public "$W/hello.txt" "$b/public.txt"
    scx "basic/setacl-private" plain setacl --acl-private "$b/hello.txt"
    scxe "basic/setacl-public-refused" 'AccessControlListNotSupported|ACL|400' plain setacl --acl-public "$b/hello.txt"
    scxe "basic/signurl-is-sigv2-and-refused" '403|400|SignatureDoesNotMatch|AccessDenied|InvalidRequest' plain get --force --signature-v2 "$b/hello.txt" "$d/v2.txt"
    scx "basic/signurl-prints-a-v2-url" plain signurl "$b/hello.txt" +300
    local url; url="$(printf '%s' "$SOUT" | head -n 1)"
    if [ "$(curl -s -o /dev/null -w '%{http_code}' "$url")" != 200 ]; then bv_pass "basic/signurl-v2-url-is-refused"; else bv_fail "basic/signurl-v2-url-is-refused" "a Signature V2 URL was accepted: $url"; fi
    scx "basic/del-recursive" plain del --recursive --force "s3://$PB/sc/"
    keys_eq "basic/del-recursive-emptied-it" plain sc/
}

# ================================================================================================
g_multi() {
    local d="$G_DIR" b="s3://$PB/scm" etag
    scx "multi/put-12mib-5mib-chunks" plain put --multipart-chunk-size-mb=5 "$W/f_12m" "$b/f12"
    etag="$(head_hdr plain scm/f12 etag)"
    case "$etag" in *-3\") bv_pass "multi/etag-has-three-parts" ;; *) bv_fail "multi/etag-has-three-parts" "ETag $etag" ;; esac
    bv_eq "multi/etag-is-the-composite-md5" "\"$(python3 - "$W/f_12m" 5242880 <<'PY'
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
    bv_eq "multi/size" "12582912" "$(head_hdr plain scm/f12 content-length)"
    scx "multi/get" plain get --force "$b/f12" "$d/f12"
    bv_eq "multi/get-sha256" "$(bv_sha256 "$W/f_12m")" "$(bv_sha256 "$d/f12" 2>/dev/null)"
    scx "multi/put-single-part-with-a-big-chunk-size" plain put --multipart-chunk-size-mb=50 "$W/f_12m" "$b/f12_single"
    bv_eq "multi/single-put-etag-is-md5" "\"$(md5of "$W/f_12m")\"" "$(head_hdr plain scm/f12_single etag)"
    scx "multi/get-with-md5-check" plain get --force "$b/f12_single" "$d/f12_single"
    bv_eq "multi/no-open-uploads-left" "0" "$(probe plain mpu-list | python3 -c 'import json,sys; print(len([u for u in json.load(sys.stdin) if u["key"].startswith("scm/")]))')"
    scx "multi/multipart-listing" plain multipart "s3://$PB"
    scx "multi/cp-server-side-of-a-multipart-object" plain cp "$b/f12" "$b/f12_copy"
    scx "multi/del-recursive" plain del --recursive --force "$b/"
}

# ================================================================================================
g_sync() {
    local d="$G_DIR" b="s3://$PB/scs" files
    files="$($TU count "$TREE")"
    scx "sync/upload-tree" plain sync "$TREE/" "$b/"
    bv_eq "sync/remote-count" "$files" "$(count_keys plain scs/)"
    scx "sync/second-run-transfers-nothing" plain sync "$TREE/" "$b/"
    bv_not_contains "sync/second-run-no-upload-lines" "$SOUT" "upload:"
    mkdir -p "$d/down"
    scx "sync/download-tree" plain sync "$b/" "$d/down/"
    if diff -r "$TREE" "$d/down" >/dev/null 2>&1; then bv_pass "sync/download-identical"; else bv_fail "sync/download-identical" "$(diff -rq "$TREE" "$d/down" 2>&1 | head -n 3)"; fi
    cp -R "$TREE" "$d/work"; rm -rf "$d/work/many/f00"* "$d/work/a"; printf 'new\n' > "$d/work/new.txt"
    scx "sync/delete-removed" plain sync --delete-removed "$d/work/" "$b/"
    bv_eq "sync/remote-count-after-delete-removed" "$($TU count "$d/work")" "$(count_keys plain scs/)"
    scx "sync/skip-existing" plain sync --skip-existing "$d/work/" "$b/"
    scx "sync/list-1200-keys-across-pages" plain ls --recursive "$b/"
    bv_eq "sync/ls-recursive-count" "$($TU count "$d/work")" "$(printf '%s\n' "$SOUT" | grep -c 's3://')"
    scx "sync/put-recursive" plain put --recursive "$d/work/many" "s3://$PB/scs2/"
    scx "sync/del-recursive-1" plain del --recursive --force "$b/"
    scx "sync/del-recursive-2" plain del --recursive --force "s3://$PB/scs2/"
    keys_eq "sync/clean" plain scs
}

# ================================================================================================
g_info() {
    local d="$G_DIR" b="s3://$PB"
    scx "info/bucket-info" plain info "$b"
    bv_contains "info/bucket-location" "$SOUT" "Location"
    sc plain getlifecycle "$b"
    if [ "$SRC" -ne 0 ] && printf '%s' "$SALL" | grep -qi 'NoSuchLifecycleConfiguration\|no lifecycle\|404'; then bv_pass "info/lifecycle-none-configured"; else bv_fail "info/lifecycle-none-configured" "exit $SRC: $SALL"; fi
    scxe "info/setlifecycle-refused" 'AccessDenied|Access Denied|403|NotImplemented' plain setlifecycle "$W/hello.txt" "$b"
    scxe "info/setpolicy-refused" 'NotImplemented|AccessDenied|501|403' plain setpolicy "$W/hello.txt" "$b"
    scxe "info/setcors-refused" 'AccessDenied|Access Denied|403' plain setcors "$W/hello.txt" "$b"
    scxe "info/setversioning-refused" 'AccessDenied|Access Denied|403' plain setversioning "$b" enable
    scx "info/getacl-bucket" plain info "$b"
    scx "info/public-bucket-cors-view" public info "s3://$PUB"
}

# ================================================================================================
g_rules() {
    local d="$G_DIR"
    head -c 3000000 /dev/urandom > "$d/3m"
    scx "rules/quota-first" quota put "$d/3m" "s3://$QB/q/a"
    scx "rules/quota-second" quota put "$d/3m" "s3://$QB/q/b"
    scxe "rules/quota-third-refused" 'QuotaExceeded|quota|403' quota put "$d/3m" "s3://$QB/q/c"
    scxe "rules/quota-multipart-refused" 'QuotaExceeded|quota|403' quota put --multipart-chunk-size-mb=5 "$W/f_12m" "s3://$QB/q/big"
    keys_eq "rules/quota-two-objects" quota q/ q/a q/b
    scx "rules/quota-cleanup" quota del --recursive --force "s3://$QB/q/"
    scx "rules/ctype-png" ctype put "$W/pic.png" "s3://$CB/r/pic.png"
    scx "rules/ctype-text" ctype put "$W/hello.txt" "s3://$CB/r/hello.txt"
    scxe "rules/ctype-pdf-refused" 'ContentTypeNotAllowed|not allowed|415' ctype put "$W/doc.pdf" "s3://$CB/r/doc.pdf"
    scxe "rules/ctype-declared-type-not-trusted" 'ContentTypeNotAllowed|not allowed|415' ctype put --mime-type image/png "$W/doc.pdf" "s3://$CB/r/fake.png"
    keys_eq "rules/ctype-allowed-only" ctype r/ r/pic.png r/hello.txt
    scx "rules/ctype-cleanup" ctype del --recursive --force "s3://$CB/r/"
}

# ================================================================================================
g_odd() {
    local d="$G_DIR" id key
    for id in $($OK ids); do
        case "$id" in
            leading-slash|double-slash|dot-segment|dotdot-segment|trailing-slash|len-1024|len-1024-multibyte|combining|nfc|tab-in-key|backslash|query-chars) continue ;;   # s3cmd's own path handling / shell quoting
        esac
        key="$($OK key "$id")"
        printf 'body of %s\n' "$id" > "$d/body"
        scx "odd-$id/put" plain put "$d/body" "s3://$PB/odd/$key"
        if probe plain list odd/ | python3 -c 'import json,sys; k=json.load(sys.stdin); sys.exit(0 if sys.argv[1] in k else 1)' "odd/$key"; then bv_pass "odd-$id/stored-byte-exact"; else bv_fail "odd-$id/stored-byte-exact" "the key is not in the independent listing"; fi
        scx "odd-$id/get" plain get --force "s3://$PB/odd/$key" "$d/got"
        bv_eq "odd-$id/body" "body of $id" "$(cat "$d/got" 2>/dev/null)"
        scx "odd-$id/del" plain del "s3://$PB/odd/$key"
    done
}

# ================================================================================================
for g in $GROUPS_RUN; do
    case " $GROUPS_ALL " in *" $g "*) ;; *) bv_warn "unknown s3cmd group '$g'"; continue ;; esac
    G_DIR="$W/g_$g"; rm -rf "$G_DIR"; mkdir -p "$G_DIR"
    "g_$g"
done
exit 0
