#!/usr/bin/env bash
# End-to-end test of a three-node binvault cluster in Docker, with TLS on the peer
# link (spec §12), in the style of zonewright/test/e2e-cluster.sh. Needs docker with
# the compose plugin, curl (>= 8.1, for --aws-sigv4: it has to send x-amz-content-sha256) and openssl on the host.
#
#   binvault/test/e2e-cluster.sh              build the image and run
#   SKIP_BUILD=1 binvault/test/e2e-cluster.sh reuse the images of a previous run
#
# Topology (docker/cluster.compose.yml): the three nodes sit on the compose default
# network, which carries the published S3 and admin ports, so the host can always
# reach every node — and on a network called "peer" that carries ONLY the peer link
# (the peer-a/-b/-c names exist only there). Cutting "peer" partitions the nodes
# while each one stays reachable from the host: writes keep landing on both sides.
#
# Ports (override when taken): S3 on 19431..19433, admin on 19441..19443 of the host.
#
# SKIP_PARTITION=1 leaves out the partition, heal and lost-node sections. They cut a
# container off the "peer" network with `docker network disconnect`, which on Docker
# Desktop (macOS) also takes the container's published ports away, so the host cannot
# talk to it any more; the move and drain sections do not need them.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PROJECT="${PROJECT:-bvcl-e2e}"
S3_PORT_BASE="${S3_PORT_BASE:-19431}"
ADMIN_PORT_BASE="${ADMIN_PORT_BASE:-19441}"
WORK="$(mktemp -d)"
PASS=0
FAIL=0

export BINVAULT_ADMIN_TOKEN="$(openssl rand -hex 32)"
export BINVAULT_MASTER_KEY="$(openssl rand -base64 32)"
export BINVAULT_CLUSTER_KEY="$(openssl rand -hex 32)"
export BINVAULT_S3_PORT_A=$((S3_PORT_BASE)) BINVAULT_S3_PORT_B=$((S3_PORT_BASE + 1)) BINVAULT_S3_PORT_C=$((S3_PORT_BASE + 2))
export BINVAULT_ADMIN_PORT_A=$((ADMIN_PORT_BASE)) BINVAULT_ADMIN_PORT_B=$((ADMIN_PORT_BASE + 1)) BINVAULT_ADMIN_PORT_C=$((ADMIN_PORT_BASE + 2))

compose() { docker compose -p "$PROJECT" -f "$ROOT/docker/cluster.compose.yml" -f "$WORK/tls.override.yml" "$@"; }

cleanup() {
    if [ "${KEEP:-}" = 1 ]; then
        echo "KEEP=1: leaving the cluster up (project $PROJECT); remove it with: docker compose -p $PROJECT down -v"
    else
        compose down -v --remove-orphans >/dev/null 2>&1 || true
    fi
    rm -rf "$WORK"
}
trap cleanup EXIT

ok()    { PASS=$((PASS + 1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad()   { FAIL=$((FAIL + 1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (got '$2', want '$3')"; fi; }
wait_for() { # wait_for <seconds> <cmd...>: retry until cmd succeeds
    local t=$1; shift
    for _ in $(seq "$t"); do "$@" && return 0; sleep 1; done
    return 1
}
die() { echo "e2e: $*" >&2; compose logs --tail 40 >&2 || true; exit 1; }

port() { # port s3|admin <a|b|c>
    local i; case "$2" in a) i=0 ;; b) i=1 ;; c) i=2 ;; esac
    if [ "$1" = s3 ]; then echo $((S3_PORT_BASE + i)); else echo $((ADMIN_PORT_BASE + i)); fi
}
adm() { # adm <a|b|c> METHOD PATH [BODY]: the admin API of one node, body printed
    curl -s -m 60 -X "$2" -H "Authorization: Bearer $BINVAULT_ADMIN_TOKEN" "http://127.0.0.1:$(port admin "$1")/_admin/v1$3" ${4:+--data-binary "$4"}
}
admcode() { # like adm, prints only the HTTP status
    curl -s -m 60 -o /dev/null -w '%{http_code}' -X "$2" -H "Authorization: Bearer $BINVAULT_ADMIN_TOKEN" "http://127.0.0.1:$(port admin "$1")/_admin/v1$3" ${4:+--data-binary "$4"}
}
s3() { # s3 <a|b|c> <ak> <sk> curl-args-after-the-path...  ->  s3 b $AK $SK /photos/x -X PUT --data-binary @f
    local node=$1 ak=$2 sk=$3 path=$4; shift 4
    curl -s -m "${S3_MAX:-60}" --aws-sigv4 "aws:amz:us-east-1:s3" --user "$ak:$sk" "$@" "http://127.0.0.1:$(port s3 "$node")$path"
}
s3code() { local node=$1 ak=$2 sk=$3 path=$4; shift 4; s3 "$node" "$ak" "$sk" "$path" -o /dev/null -w '%{http_code}' "$@"; }
s3hdr() { # s3hdr <node> <ak> <sk> <path> <header-name>: the value of one response header of a GET
    local node=$1 ak=$2 sk=$3 path=$4 name=$5
    s3 "$node" "$ak" "$sk" "$path" -D - -o /dev/null | tr -d '\r' | awk -F': ' -v n="$(echo "$name" | tr 'A-Z' 'a-z')" 'tolower($1)==n {print $2}'
}
json() { # json <field>: the first string value of a field in a JSON document on stdin
    grep -o "\"$1\":\"[^\"]*\"" | head -1 | cut -d'"' -f4
}
cid() { compose ps -q "node-$1"; }
peer_net() { echo "${PROJECT}_peer"; }
healthy() { curl -fs "http://127.0.0.1:$(port s3 "$1")/_healthz" >/dev/null 2>&1; }
names_homes() { # the catalog as seen by one node: "name:home" lines, sorted
    adm "$1" GET '/buckets?limit=500' | grep -o '"name":"[^"]*","home":"[^"]*"' | sed 's/"name":"\([^"]*\)","home":"\([^"]*\)"/\1:\2/' | sort | tr '\n' ' '
}

echo "== setup: three containers, TLS on the peer link"
command -v docker >/dev/null || die "docker is required"
command -v openssl >/dev/null || die "openssl is required"
mkdir -p "$WORK/tls"
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 1 \
    -subj /CN=binvault-e2e -addext "subjectAltName=DNS:peer-a,DNS:peer-b,DNS:peer-c" \
    -keyout "$WORK/tls/peer.key" -out "$WORK/tls/peer.crt" 2>/dev/null
chmod 0755 "$WORK/tls"
chmod 0644 "$WORK/tls/peer.key" "$WORK/tls/peer.crt" # throwaway test key, readable by the container's nonroot user
{
    echo "services:"
    for n in a b c; do
        cat <<EOF
  node-$n:
    environment:
      BINVAULT_CLUSTER_INSECURE_HTTP: "false"
      BINVAULT_CLUSTER_URLS: https://peer-a:9100,https://peer-b:9100,https://peer-c:9100
      BINVAULT_CLUSTER_TLS_CERT_FILE: /etc/binvault/tls/peer.crt
      BINVAULT_CLUSTER_TLS_KEY_FILE: /etc/binvault/tls/peer.key
      BINVAULT_CLUSTER_CA_FILE: /etc/binvault/tls/peer.crt
      BINVAULT_CLUSTER_PULL_INTERVAL: 1s
      BINVAULT_CLUSTER_STARTUP_FENCE: 20s
    volumes:
      - $WORK/tls:/etc/binvault/tls:ro
EOF
    done
} > "$WORK/tls.override.yml"

if [ -z "${SKIP_BUILD:-}" ]; then
    compose build -q || die "image build failed"
fi
compose up -d --remove-orphans >/dev/null || die "compose up failed"
wait_for 90 sh -c "curl -fs http://127.0.0.1:$(port s3 a)/_healthz >/dev/null && curl -fs http://127.0.0.1:$(port s3 b)/_healthz >/dev/null && curl -fs http://127.0.0.1:$(port s3 c)/_healthz >/dev/null" \
    || die "the nodes did not become healthy"
ok "three nodes healthy (a /_healthz was 503 starting until the start-up fence ended)"

echo "== discovery"
for n in a b c; do
    st="$(adm "$n" GET /cluster)"
    check "node $n sees three reachable nodes over TLS" "$(echo "$st" | grep -o '"reachable":true' | wc -l | tr -d ' ')" "3"
    check "node $n reports cluster mode and its own name" "$(echo "$st" | json name)-$(echo "$st" | json mode)" "$n-cluster"
done

echo "== a bucket homed on b, created through a; a token; upload through c, read through a"
resp="$(adm a POST '/buckets?wait=replicated' '{"name":"photos","home":"b"}')"
check "created, homed on b, replicated everywhere before the answer" "$(echo "$resp" | json home)$(echo "$resp" | grep -c '"pending"' || true)" "b0"
tok="$(adm a POST /buckets/photos/tokens '{"name":"e2e","grants":[{"actions":["read","write","list","delete"]}]}')"
AK="$(echo "$tok" | json access_key_id)"; SK="$(echo "$tok" | json secret_access_key)"
[ -n "$AK" ] && [ -n "$SK" ] || die "no credentials in the token answer: $tok"
head -c 3000000 /dev/urandom > "$WORK/blob.bin"
check "PUT through c" "$(s3code c "$AK" "$SK" /photos/blob.bin -X PUT --data-binary "@$WORK/blob.bin")" "200"
s3 a "$AK" "$SK" /photos/blob.bin -o "$WORK/back.bin"
if cmp -s "$WORK/blob.bin" "$WORK/back.bin"; then ok "read through a returns the bytes written through c"; else bad "bytes differ"; fi
check "the response comes from the home (x-binvault-node)" "$(s3hdr a "$AK" "$SK" /photos/blob.bin x-binvault-node)" "b"
check "a range read through c" "$(s3 c "$AK" "$SK" /photos/blob.bin -H 'Range: bytes=10-19' | wc -c | tr -d ' ')" "10"
check "ListBuckets with the token through c is routed by its key" "$(s3 c "$AK" "$SK" / | grep -c '<Name>photos</Name>')" "1"
check "listing the bucket through a" "$(s3 a "$AK" "$SK" '/photos?list-type=2' | grep -c '<Key>blob.bin</Key>')" "1"
check "an unknown bucket is NoSuchBucket whichever node is asked" "$(s3 c "$AK" "$SK" /nosuchbucket/x | grep -c NoSuchBucket)" "1"
check "the bucket's data lives on b only (bucket counts of a and b)" "$(adm a GET /status | grep -o '"buckets":[0-9]*')/$(adm b GET /status | grep -o '"buckets":[0-9]*')" '"buckets":0/"buckets":1'

resp="$(adm a POST '/buckets?wait=replicated' '{"name":"other","home":"c"}')"
tok2="$(adm a POST /buckets/other/tokens '{"name":"e2e","grants":[{"actions":["read","write","list","delete"]}]}')"
AK2="$(echo "$tok2" | json access_key_id)"; SK2="$(echo "$tok2" | json secret_access_key)"
check "a second bucket, homed on c" "$(echo "$resp" | json home)" "c"
check "PUT into it through a" "$(s3code a "$AK2" "$SK2" /other/hello.txt -X PUT --data-binary 'hello from c')" "200"

echo "== kill b: its bucket answers 503 everywhere else, the others keep working"
compose kill -s SIGKILL node-b >/dev/null
down503() { [ "$(S3_MAX=8 s3code a "$AK" "$SK" /photos/blob.bin)" = 503 ] && [ "$(S3_MAX=8 s3code c "$AK" "$SK" /photos/blob.bin)" = 503 ]; }
if wait_for 30 down503; then ok "photos answers 503 through a and c"; else bad "photos did not answer 503 with its home down"; fi
check "ServiceUnavailable with Retry-After: 5" "$(s3 a "$AK" "$SK" /photos/blob.bin -D - -o /dev/null | tr -d '\r' | awk -F': ' 'tolower($1)=="retry-after"{print $2}')" "5"
check "the other bucket keeps working through a" "$(s3 a "$AK2" "$SK2" /other/hello.txt)" "hello from c"
check "the other bucket keeps working through c" "$(s3 c "$AK2" "$SK2" /other/hello.txt)" "hello from c"
check "a bucket-scoped admin call for photos answers 503 unavailable" "$(admcode a GET /buckets/photos) $(adm a GET /buckets/photos | json error)" "503 unavailable"
check "the catalog still lists it (reads are local)" "$(adm a GET '/buckets?limit=10' | grep -c '"name":"photos"')" "1"
check "creating a bucket on the dead node fails" "$(admcode a POST /buckets '{"name":"ghost","home":"b"}')" "503"

echo "== restart b: it recovers from its volume"
compose start node-b >/dev/null
wait_for 90 healthy b || die "b did not become healthy again"
back() { s3 a "$AK" "$SK" /photos/blob.bin -o "$WORK/back2.bin" -w '%{http_code}' | grep -q 200 && cmp -s "$WORK/blob.bin" "$WORK/back2.bin"; }
if wait_for 60 back; then ok "photos is readable through a again, byte for byte"; else bad "photos did not come back"; fi
check "x-binvault-node is b again" "$(s3hdr c "$AK" "$SK" /photos/blob.bin x-binvault-node)" "b"

if [ -z "${SKIP_PARTITION:-}" ]; then
echo "== partition: cut node c off the peer network, write on both sides"
docker network disconnect "$(peer_net)" "$(cid c)" || die "disconnect failed"
check "left side: a bucket homed on a is created through a" "$(admcode a POST /buckets '{"name":"left","home":"a"}')" "201"
check "right side: a bucket homed on c is created through c" "$(admcode c POST /buckets '{"name":"right","home":"c"}')" "201"
# the buckets of the other side are unreachable from here, the buckets of this side are not
cut503() { [ "$(S3_MAX=8 s3code c "$AK" "$SK" /photos/blob.bin)" = 503 ] && [ "$(S3_MAX=8 s3code a "$AK2" "$SK2" /other/hello.txt)" = 503 ]; }
if wait_for 30 cut503; then ok "c cannot reach photos (home b) and a cannot reach other (home c): 503 both ways"; else bad "no 503 across the partition"; fi
check "a still serves photos" "$(s3code a "$AK" "$SK" /photos/blob.bin)" "200"
check "c still serves its own bucket" "$(s3 c "$AK2" "$SK2" /other/hello.txt)" "hello from c"
check "the catalogs differ while cut" "$([ "$(names_homes a)" != "$(names_homes c)" ] && echo different || echo same)" "different"

echo "== heal"
docker network connect --alias peer-c "$(peer_net)" "$(cid c)" || die "reconnect failed"
converged() { [ "$(names_homes a)" = "$(names_homes b)" ] && [ "$(names_homes b)" = "$(names_homes c)" ] && [ "$(names_homes a)" = "left:a other:c photos:b right:c " ]; }
if wait_for 60 converged; then ok "all three catalogs converged: $(names_homes a)"; else bad "no convergence after heal: a='$(names_homes a)' b='$(names_homes b)' c='$(names_homes c)'"; fi
check "photos through c works again" "$(s3code c "$AK" "$SK" /photos/blob.bin)" "200"
check "other through a works again" "$(s3 a "$AK2" "$SK2" /other/hello.txt)" "hello from c"
for n in a b c; do
    al="$(adm "$n" GET /cluster)"
    check "node $n: no orphans, no held ops, all peers reachable" "$(echo "$al" | grep -o '"orphans":\[\]' | wc -l | tr -d ' ')$(echo "$al" | grep -o '"held_ops":\[\]' | wc -l | tr -d ' ')$(echo "$al" | grep -o '"reachable":true' | wc -l | tr -d ' ')" "113"
done

echo "== a lost node: DELETE ?catalog_only=true works with the home down, the data becomes an orphan"
compose kill -s SIGKILL node-b >/dev/null
wait_for 30 down503 || bad "b not seen down"
check "an ordinary delete is refused (503, the home is down)" "$(admcode a DELETE /buckets/photos)" "503"
check "catalog_only drops the entry through a" "$(admcode a DELETE '/buckets/photos?catalog_only=true')" "204"
check "gone from the catalog of c" "$(adm c GET '/buckets?limit=10' | grep -c '"name":"photos"')" "0"
compose start node-b >/dev/null
wait_for 90 healthy b || die "b did not become healthy again"
orph() { adm b GET /cluster | grep -q '"reason":"deleted"'; }
if wait_for 30 orph; then ok "b reports its data as an orphan"; else bad "no orphan alarm on b"; fi
gen="$(adm b GET /cluster | sed -n 's/.*"orphans":\[{[^]]*"generation":"\([^"]*\)".*/\1/p')"
check "a request for the dropped bucket is NoSuchBucket on b" "$(s3 b "$AK" "$SK" /photos/blob.bin | grep -c NoSuchBucket)" "1"
check "the orphan is deleted through a, naming b" "$(admcode a DELETE "/cluster/orphans/$gen?node=b")" "204"
check "the name can be used again" "$(admcode a POST /buckets '{"name":"photos","home":"b"}')" "201"
fi

home_of() { # home_of <node> <bucket>: the home of a bucket in the catalog of one node
    adm "$1" GET '/buckets?limit=500' | grep -o "\"name\":\"$2\",\"home\":\"[^\"]*\"" | sed 's/.*"home":"\([^"]*\)"/\1/'
}
mk_bucket() { # mk_bucket <name> <home>: a bucket, its token in AKX/SKX
    adm a POST '/buckets?wait=replicated' "{\"name\":\"$1\",\"home\":\"$2\"}" >/dev/null
    local t; t="$(adm a POST "/buckets/$1/tokens" '{"name":"e2e","grants":[{"actions":["read","write","list","delete"]}]}')"
    AKX="$(echo "$t" | json access_key_id)"; SKX="$(echo "$t" | json secret_access_key)"
}

echo "== move a bucket online (spec §8.8): mvdata, homed on c, goes to a"
mk_bucket mvdata c; AK4="$AKX"; SK4="$SKX"
head -c 3000000 /dev/urandom > "$WORK/big.bin"
check "a small and a 3 MB object are written into mvdata through b" "$(s3code b "$AK4" "$SK4" /mvdata/hello.txt -X PUT --data-binary 'hello from c')$(s3code b "$AK4" "$SK4" /mvdata/big.bin -X PUT --data-binary "@$WORK/big.bin")" "200200"
buckets_c_before="$(adm c GET /status | grep -o '"buckets":[0-9]*' | cut -d: -f2)"
# the request goes to a, which sends it to the bucket's home, c: the call is answered where the bucket lives
mv="$(adm a POST /buckets/mvdata/move '{"to":"a"}')"
MOVE_ID="$(echo "$mv" | json id)"
check "the move is accepted as a move of mvdata from c to a, as its source shows it" "$(echo "$mv" | json bucket)/$(echo "$mv" | json from)/$(echo "$mv" | json to)/$(echo "$mv" | json role)" "mvdata/c/a/source"
mv_done() { [ "$(adm b GET "/moves/$MOVE_ID" | json state)" = done ]; }
if wait_for 90 mv_done; then ok "the move is done (seen through b)"; else bad "the move did not finish: $(adm b GET "/moves/$MOVE_ID")"; fi
check "a bucket that already lives on a cannot be moved there" "$(admcode a POST /buckets/mvdata/move '{"to":"a"}')" "409"
moved() { [ "$(home_of a mvdata)$(home_of b mvdata)$(home_of c mvdata)" = aaa ]; }
if wait_for 60 moved; then ok "all three catalogs say mvdata is on a"; else bad "catalogs disagree: a=$(home_of a mvdata) b=$(home_of b mvdata) c=$(home_of c mvdata)"; fi
for n in a b c; do
    check "through $n: the small object, with the token made before the move" "$(s3 "$n" "$AK4" "$SK4" /mvdata/hello.txt)" "hello from c"
    s3 "$n" "$AK4" "$SK4" /mvdata/big.bin -o "$WORK/moved-$n.bin"
    if cmp -s "$WORK/big.bin" "$WORK/moved-$n.bin"; then ok "through $n: the 3 MB object is byte for byte the one written"; else bad "through $n: the moved object differs"; fi
done
check "the response now comes from a (x-binvault-node)" "$(s3hdr c "$AK4" "$SK4" /mvdata/hello.txt x-binvault-node)" "a"
check "c holds one bucket less" "$(adm c GET /status | grep -o '"buckets":[0-9]*' | cut -d: -f2)" "$((buckets_c_before - 1))"
check "the cluster lists the move once, as done" "$(adm c GET '/moves?limit=10' | grep -o '"id":"'"$MOVE_ID"'"' | wc -l | tr -d ' ')/$(adm c GET "/moves/$MOVE_ID" | json state)" "1/done"
check "a write after the move lands on a" "$(s3code c "$AK4" "$SK4" /mvdata/after.txt -X PUT --data-binary 'after the move')" "200"
check "the source counted the move" "$(curl -s -H "Authorization: Bearer $BINVAULT_ADMIN_TOKEN" "http://127.0.0.1:$(port admin c)/_metrics" | grep -c '^binvault_moves_total{outcome="done"} 1')" "1"

echo "== drain node c: its buckets move away, auto placement skips it, undrain lifts the cordon"
mk_bucket drain1 c; AK5="$AKX"; SK5="$SKX"
mk_bucket drain2 c; AK6="$AKX"; SK6="$SKX"
check "objects are written into drain1 and drain2 (homed on c)" "$(s3code a "$AK5" "$SK5" /drain1/note.txt -X PUT --data-binary 'drained one')$(s3code a "$AK6" "$SK6" /drain2/note.txt -X PUT --data-binary 'drained two')" "200200"
check "drain is accepted and cordons c" "$(admcode a POST /cluster/nodes/c/drain)" "202"
empty_c() { [ "$(names_homes a | grep -c ':c')" = 0 ] && [ "$(names_homes b | grep -c ':c')" = 0 ]; }
if wait_for 90 empty_c; then ok "no bucket is homed on c any more: $(names_homes a)"; else bad "buckets are still homed on c: $(names_homes a)"; fi
# (the other nodes learn the count from c's next hello, at most 30 s later)
drained() { adm b GET /cluster | grep -q '"drain":{"state":"done","remaining":0}'; }
if wait_for 60 drained; then ok "c reports its drain done (seen through b)"; else bad "the drain did not finish: $(adm b GET /cluster | grep -o '"drain":{[^}]*}')"; fi
check "the drained buckets are readable through every node" "$(s3 a "$AK5" "$SK5" /drain1/note.txt)/$(s3 b "$AK6" "$SK6" /drain2/note.txt)/$(s3 c "$AK5" "$SK5" /drain1/note.txt)" "drained one/drained two/drained one"
check "c is cordoned" "$(adm a GET /cluster | grep -o '"cordoned":true' | wc -l | tr -d ' ')" "1"
placed_on_c=0
for i in 1 2 3 4; do
    h="$(adm a POST '/buckets?wait=replicated' "{\"name\":\"auto$i\"}" | json home)"
    [ "$h" = c ] && placed_on_c=$((placed_on_c + 1))
done
check "auto placement skipped the cordoned node (four buckets)" "$placed_on_c" "0"
check "a bucket named onto the cordoned node is refused" "$(admcode a POST /buckets '{"name":"named-c","home":"c"}')" "409"
check "undrain lifts the cordon" "$(adm a POST /cluster/nodes/c/undrain | grep -o '"cordoned":false' | wc -l | tr -d ' ')" "1"
uncordoned() { [ "$(admcode a POST /buckets '{"name":"named-c","home":"c"}')" = 201 ]; }
if wait_for 30 uncordoned; then ok "c takes buckets again"; else bad "c still refuses buckets after undrain"; fi

echo
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" -eq 0 ]
