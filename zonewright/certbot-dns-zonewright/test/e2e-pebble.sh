#!/usr/bin/env bash
# End-to-end test of certbot-dns-zonewright: real certbot + this plugin
# publish DNS-01 challenges on a real zonewright (BIND) container through an
# acme-scoped token created over the API (POST /tokens), and Pebble (Let's Encrypt's test CA) validates them by
# querying that zonewright over DNS. Needs docker, curl, python3 and openssl.
#
#   zonewright/certbot-dns-zonewright/test/e2e-pebble.sh
#   IMAGE=zonewright:test SKIP_BUILD=1 ...       reuse an existing zonewright image
#   CERTBOT=/path/to/venv/bin/certbot ...        use a certbot that already has the plugin
set -euo pipefail

IMAGE="${IMAGE:-zonewright:e2e}"
PEBBLE_IMAGE="${PEBBLE_IMAGE:-ghcr.io/letsencrypt/pebble:latest}"
HERE="$(cd "$(dirname "$0")" && pwd)"
PLUGIN="$(cd "$HERE/.." && pwd)"
ZONEWRIGHT="$(cd "$PLUGIN/.." && pwd)"
WORK="$(mktemp -d)"
NET=zw-acme-e2e
ADMIN=e2e-admin-token
API=http://127.0.0.1:19071
PASS=0
FAIL=0

cleanup() {
    docker rm -f zw-acme pebble-acme >/dev/null 2>&1 || true
    docker network rm "$NET" >/dev/null 2>&1 || true
    rm -rf "$WORK"
}
trap cleanup EXIT

ok()    { PASS=$((PASS + 1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad()   { FAIL=$((FAIL + 1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (got '$2', want '$3')"; fi; }
code()  { # code TOKEN METHOD PATH [BODY]
    local args=(-s -o /dev/null -w '%{http_code}' -X "$2" -H "Authorization: Bearer $1" "$API$3")
    if [ $# -ge 4 ]; then args+=(--data-binary "$4"); fi
    curl "${args[@]}"
}

echo "== setup"
if [ -z "${SKIP_BUILD:-}" ]; then
    docker build -q -t "$IMAGE" "$ZONEWRIGHT" >/dev/null
fi
if [ -z "${CERTBOT:-}" ]; then
    python3 -m venv "$WORK/venv"
    "$WORK/venv/bin/pip" install -q "$PLUGIN" >/dev/null
    CERTBOT="$WORK/venv/bin/certbot"
fi

cat >"$WORK/config.yml" <<'EOF'
data_dir: /var/lib/zonewright
admin:
  listen: 0.0.0.0:9053
  token_env: ZONEWRIGHT_TOKEN
  allow_insecure_http: true
defaults:
  ttl: 5m
  nameservers: [ns1.example.net, ns2.example.net]
EOF

docker network create "$NET" >/dev/null
docker run -d --name zw-acme --network "$NET" \
    -p 127.0.0.1:19071:9053 \
    -e ZONEWRIGHT_TOKEN="$ADMIN" \
    -v "$WORK/config.yml:/etc/zonewright/config.yml:ro" \
    "$IMAGE" >/dev/null
for _ in $(seq 30); do curl -sf "$API/healthz" >/dev/null && break; sleep 1; done
ZW_IP="$(docker inspect -f "{{(index .NetworkSettings.Networks \"$NET\").IPAddress}}" zw-acme)"

docker run -d --name pebble-acme --network "$NET" -p 127.0.0.1:14000:14000 \
    -e PEBBLE_VA_NOSLEEP=1 -e PEBBLE_WFE_NONCEREJECT=0 \
    "$PEBBLE_IMAGE" -dnsserver "$ZW_IP:53" >/dev/null
for _ in $(seq 30); do curl -skf https://127.0.0.1:14000/dir >/dev/null && break; sleep 1; done

for zone in example.test other.test; do
    body="{\"zones\":[{\"name\":\"$zone\",\"records\":[{\"name\":\"@\",\"type\":\"A\",\"value\":\"192.0.2.10\"}]}]}"
    check "admin creates $zone" "$(code "$ADMIN" POST /zones "$body")" 201
done

echo "== scoped token, created over the API"
ACME="$(curl -s -X POST -H "Authorization: Bearer $ADMIN" "$API/tokens" \
    --data-binary '{"name":"e2e-acme","scope":"acme","zones":["example.test"]}' |
    sed -n 's/^  "token": "\(zwt_[0-9a-f]*\)",*$/\1/p')"
check "POST /tokens returns the secret" "${ACME:0:4}" "zwt_"
check "acme token may not write an A record" \
    "$(code "$ACME" POST /zones/example.test/records '{"name":"evil","type":"A","value":"203.0.113.66"}')" 403
check "acme token may not touch a zone outside its list" \
    "$(code "$ACME" POST /zones/other.test/records '{"name":"_acme-challenge","type":"TXT","value":"x"}')" 403
check "acme token may not list zones" "$(code "$ACME" GET /zones)" 403
check "acme token may not delete the zone" "$(code "$ACME" DELETE /zones/example.test)" 403

echo "== certbot issues apex + wildcard over DNS-01"
cat >"$WORK/zonewright.ini" <<EOF
dns_zonewright_url = $API
dns_zonewright_token = $ACME
dns_zonewright_wait_timeout = 10
EOF
chmod 600 "$WORK/zonewright.ini"
if "$CERTBOT" certonly --non-interactive --agree-tos -m e2e@example.test \
    --server https://127.0.0.1:14000/dir --no-verify-ssl \
    --config-dir "$WORK/cb/config" --work-dir "$WORK/cb/work" --logs-dir "$WORK/cb/logs" \
    -a dns-zonewright --dns-zonewright-credentials "$WORK/zonewright.ini" \
    --dns-zonewright-propagation-seconds 1 \
    -d example.test -d '*.example.test' >"$WORK/certbot.out" 2>&1; then
    ok "certbot certonly succeeded"
else
    bad "certbot certonly failed"
    sed 's/^/    /' "$WORK/certbot.out"
    tail -40 "$WORK/cb/logs/letsencrypt.log" | sed 's/^/    /'
fi

CERT="$WORK/cb/config/live/example.test/fullchain.pem"
if [ -f "$CERT" ]; then
    SANS="$(openssl x509 -in "$CERT" -noout -ext subjectAltName | tail -1 | tr -d ' ')"
    check "certificate covers apex and wildcard" "$SANS" "DNS:example.test,DNS:*.example.test"
else
    bad "no certificate at $CERT"
fi

LEFT="$(curl -s -H "Authorization: Bearer $ADMIN" "$API/zones/example.test/records?type=TXT")"
case "$LEFT" in
    *_acme-challenge*) bad "challenge TXT records left behind: $LEFT" ;;
    *) ok "challenge TXT records removed after issuance" ;;
esac

echo "== revoked token"
check "admin revokes the token" "$(code "$ADMIN" DELETE /tokens/e2e-acme)" 200
check "certbot's token no longer works" "$(code "$ACME" GET '/lookup?name=example.test')" 401

echo
echo "passed: $PASS  failed: $FAIL"
[ "$FAIL" -eq 0 ]
