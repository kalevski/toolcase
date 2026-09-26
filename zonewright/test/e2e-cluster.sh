#!/usr/bin/env bash
# End-to-end test of a two-server zonewright cluster with real BIND, in Docker
# (REPLICATION.md §12.4). Needs docker, openssl, curl and dig on the host.
#
#   zonewright/test/e2e-cluster.sh            build the image and run
#   IMAGE=zonewright:test SKIP_BUILD=1 ...    reuse an existing image
#
# Topology: zw1 and zw2 each sit on the default bridge (published admin + DNS
# ports, so the host can always reach them) AND on a private network "zwnet"
# that carries ONLY the peer sync. Cutting zwnet partitions the servers while
# both stay reachable from the host — writes keep landing on both sides.
set -euo pipefail

IMAGE="${IMAGE:-zonewright:e2e}"
HERE="$(cd "$(dirname "$0")" && pwd)"
WORK="$(mktemp -d)"
NET=zw-e2e-net
TOKEN=e2e-admin-token
PASS=0
FAIL=0

cleanup() {
    docker rm -f zw1 zw2 >/dev/null 2>&1 || true
    docker volume rm zw1-data zw2-data >/dev/null 2>&1 || true
    docker network rm "$NET" >/dev/null 2>&1 || true
    rm -rf "$WORK"
}
trap cleanup EXIT

ok()   { PASS=$((PASS + 1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad()  { FAIL=$((FAIL + 1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (got '$2', want '$3')"; fi; }

api()  { # api <1|2> METHOD PATH [BODY]
    local port=$((19060 + $1))
    curl -s -X "$2" -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:$port$3" ${4:+--data-binary "$4"}
}
code() { # like api, prints only the HTTP status
    local port=$((19060 + $1))
    curl -s -o /dev/null -w '%{http_code}' -X "$2" -H "Authorization: Bearer $TOKEN" "http://127.0.0.1:$port$3" ${4:+--data-binary "$4"}
}
q()    { dig @127.0.0.1 -p $((15360 + $1)) +short +norec "$2" "$3" | sort | tr '\n' ' ' | sed 's/ $//'; }
serial() { dig @127.0.0.1 -p $((15360 + $1)) +short +norec "$2" SOA | awk '{print $3}'; }
wait_for() { # wait_for <seconds> <cmd...>: retry until cmd succeeds
    local t=$1; shift
    for _ in $(seq "$t"); do "$@" && return 0; sleep 1; done
    return 1
}

echo "== setup"
if [ -z "${SKIP_BUILD:-}" ]; then
    docker build -q -t "$IMAGE" "$HERE/.." >/dev/null
fi
openssl req -x509 -newkey ec -pkeyopt ec_paramgen_curve:prime256v1 -nodes -days 1 \
    -subj /CN=zonewright-e2e -addext "subjectAltName=DNS:zw1,DNS:zw2" \
    -keyout "$WORK/peer.key" -out "$WORK/peer.crt" 2>/dev/null
chmod 0644 "$WORK/peer.key" "$WORK/peer.crt" # throwaway test key, readable by the container user
CLUSTER_KEY="$(openssl rand -hex 32)"

for n in 1 2; do
    mkdir -p "$WORK/etc$n/tls"
    cp "$WORK/peer.crt" "$WORK/peer.key" "$WORK/etc$n/tls/"
    cat > "$WORK/etc$n/config.yml" <<EOF
data_dir: /var/lib/zonewright
admin: {listen: 0.0.0.0:9053, token_env: ZONEWRIGHT_TOKEN, allow_insecure_http: true}
defaults:
  nameservers: [ns1.example.test, ns2.example.test]
  soa: {admin_email: hostmaster@example.test}
include: [/var/lib/zonewright/zones.d/*.yml]
cluster:
  key_env: ZONEWRIGHT_CLUSTER_KEY
  listen: 0.0.0.0:9153
  tls: {cert_file: /etc/zonewright/tls/peer.crt, key_file: /etc/zonewright/tls/peer.key}
  ca_file: /etc/zonewright/tls/peer.crt
  pull_interval: 2s
  startup_fence: 15s
  urls: [https://zw1:9153, https://zw2:9153]
EOF
    chmod -R a+rX "$WORK/etc$n"
done

docker network create "$NET" >/dev/null
start() {
    docker run -d --name "zw$1" -e ZONEWRIGHT_TOKEN=$TOKEN -e ZONEWRIGHT_CLUSTER_KEY="$CLUSTER_KEY" \
        -p "127.0.0.1:$((19060 + $1)):9053" -p "127.0.0.1:$((15360 + $1)):53/udp" -p "127.0.0.1:$((15360 + $1)):53/tcp" \
        -v "$WORK/etc$1:/etc/zonewright:ro" -v "zw$1-data:/var/lib/zonewright" "$IMAGE" >/dev/null
    docker network connect --alias "zw$1" "$NET" "zw$1"
}
start 1
start 2
wait_for 30 sh -c "curl -sf http://127.0.0.1:19061/healthz >/dev/null && curl -sf http://127.0.0.1:19062/healthz >/dev/null" \
    || { docker logs zw1 | tail -20; exit 1; }
wait_for 30 sh -c "curl -s -H 'Authorization: Bearer $TOKEN' http://127.0.0.1:19061/cluster/status | grep -q '\"ready\": true'" \
    || { docker logs zw1 | tail -20; exit 1; }

echo "== discovery"
st1="$(api 1 GET /cluster/status)"
check "zw1 found itself" "$(echo "$st1" | grep -c '"self": true')" "1"
id1="$(echo "$st1" | sed -n 's/^  "node_id": "\(.*\)",/\1/p')"
id2="$(api 2 GET /cluster/status | sed -n 's/^  "node_id": "\(.*\)",/\1/p')"
[ -n "$id1" ] && [ "$id1" != "$id2" ] && ok "each deployment generated its own id ($id1 / $id2)" || bad "node ids: '$id1' '$id2'"

echo "== write on zw1, read from both"
resp="$(api 1 POST '/zones?wait=replicated' 'zones:
  - name: example.test
    records:
      - {name: "@", type: A, value: 192.0.2.1}
      - {name: ns1, type: A, value: 192.0.2.53}
      - {name: ns2, type: A, value: 192.0.2.54}
      - {name: www, type: CNAME, value: "@"}')"
check "create replicated before responding" "$(echo "$resp" | grep -c '"replicated": true')" "1"
check "zw1 answers" "$(q 1 www.example.test A)" "192.0.2.1 example.test."
check "zw2 answers (replicated)" "$(q 2 www.example.test A)" "192.0.2.1 example.test."

echo "== write on zw2, read from zw1"
check "record add on zw2" "$(code 2 POST '/zones/example.test/records?wait=replicated' '{"name":"api","type":"A","value":"192.0.2.2"}')" "201"
check "zw1 sees zw2's record" "$(q 1 api.example.test A)" "192.0.2.2"
check "SOA serials identical" "$(serial 1 example.test)" "$(serial 2 example.test)"

echo "== ACME DNS-01 shape: TXT must be on BOTH before the call returns"
code 1 PUT '/zones/example.test/records/_acme-challenge/TXT?wait=replicated' '{"records":[{"value":"tok-123","ttl":60}]}' >/dev/null
check "TXT on zw1 immediately" "$(q 1 _acme-challenge.example.test TXT)" '"tok-123"'
check "TXT on zw2 immediately" "$(q 2 _acme-challenge.example.test TXT)" '"tok-123"'

echo "== partition: cut the peer network, write on both sides"
docker network disconnect "$NET" zw2
check "wait=replicated reports the unreachable peer (202)" \
    "$(code 1 PUT '/zones/example.test/records/www/CNAME?wait=replicated&timeout=3s' '{"records":[{"value":"left.example.net"}]}')" "202"
check "zw2 still accepts writes while cut off" \
    "$(code 2 POST /zones/example.test/records '{"name":"right","type":"A","value":"192.0.2.20"}')" "201"
code 2 PUT /zones/split.test '{"records":[{"name":"@","type":"A","value":"192.0.2.99"}]}' >/dev/null
check "zw1 does not see zw2's change yet" "$(q 1 right.example.test A)" ""
check "zw2 does not see zw1's change yet" "$(q 2 www.example.test CNAME)" "example.test."

echo "== heal"
docker network connect --alias zw2 "$NET" zw2
converged() { [ "$(q 1 right.example.test A)" = "192.0.2.20" ] && [ "$(q 2 www.example.test CNAME)" = "left.example.net." ] \
    && [ "$(q 1 split.test A)" = "192.0.2.99" ] && [ "$(serial 1 example.test)" = "$(serial 2 example.test)" ]; }
if wait_for 30 converged; then ok "both sides merged after heal"; else bad "no convergence after heal"; fi
check "zw1 has zw2's partition write" "$(q 1 right.example.test A)" "192.0.2.20"
check "zw2 has zw1's partition write" "$(q 2 www.example.test CNAME)" "left.example.net."
check "zone created on zw2 during the split reached zw1" "$(q 1 split.test A)" "192.0.2.99"
check "serials identical after heal" "$(serial 1 example.test)" "$(serial 2 example.test)"

echo "== BIND rejection is not committed, not replicated"
check "in-zone NS without address → 422" "$(code 1 POST /zones/example.test/records '{"name":"@","type":"NS","value":"ns9"}')" "422"
sleep 3
check "zw2 never received it" "$(q 2 example.test NS)" "ns1.example.test. ns2.example.test."

echo "== restart keeps identity and state"
docker restart zw2 >/dev/null
wait_for 30 sh -c "curl -sf http://127.0.0.1:19062/healthz >/dev/null" || true
id2b="$(api 2 GET /cluster/status | sed -n 's/^  "node_id": "\(.*\)",/\1/p')"
check "node id survives restart" "$id2b" "$id2"
wait_for 20 sh -c "[ \"\$(dig @127.0.0.1 -p 15362 +short api.example.test A)\" = 192.0.2.2 ]" && ok "zw2 serves after restart" || bad "zw2 not serving after restart"

echo "== delete replicates"
code 1 DELETE '/zones/split.test?wait=replicated' >/dev/null
check "zone deleted on zw2" "$(dig @127.0.0.1 -p 15362 +norec split.test A | grep -oE 'status: [A-Z]+')" "status: REFUSED"

echo "== API tokens replicate: created on zw1, used on zw2, revoked from zw2"
tcode() { # tcode <1|2> TOKEN METHOD PATH [BODY]
    local port=$((19060 + $1))
    local args=(-s -o /dev/null -w '%{http_code}' -X "$3" -H "Authorization: Bearer $2" "http://127.0.0.1:$port$4")
    if [ $# -ge 5 ]; then args+=(--data-binary "$5"); fi
    curl "${args[@]}"
}
acme="$(api 1 POST '/tokens?wait=replicated' '{"name":"e2e-acme","zones":["example.test"]}' | sed -n 's/^  "token": "\(zwt_[0-9a-f]*\)",*$/\1/p')"
check "zw1 returns the new token's secret once" "${acme:0:4}" "zwt_"
check "zw2 accepts it for a challenge" \
    "$(tcode 2 "$acme" POST '/zones/example.test/records?wait=replicated' '{"name":"_acme-challenge","type":"TXT","value":"api-tok","ttl":60}')" "201"
check "zw2 refuses it for an A record" \
    "$(tcode 2 "$acme" POST /zones/example.test/records '{"name":"evil","type":"A","value":"203.0.113.66"}')" "403"
check "zw1 serves the challenge written through zw2" "$(q 1 _acme-challenge.example.test TXT | grep -o api-tok)" "api-tok"
check "the secret is never listed" "$(api 2 GET /tokens | grep -c "$acme")" "0"
check "revoke on zw2" "$(code 2 DELETE '/tokens/e2e-acme?wait=replicated')" "200"
check "zw1 refuses the revoked token" "$(tcode 1 "$acme" GET '/lookup?name=example.test')" "401"

echo
echo "passed: $PASS, failed: $FAIL"
[ "$FAIL" -eq 0 ]
