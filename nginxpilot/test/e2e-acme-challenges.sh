#!/usr/bin/env bash
# End-to-end test of per-request ACME challenges: ONE nginxpilot daemon allows
# `challenges: [http, dns]` and issues, side by side,
#   - a DNS-01 apex + wildcard certificate through zonewright
#     (certbot-dns-zonewright, with an acme-scoped zonewright API token), and
#   - an HTTP-01 certificate through its webroot,
# against Pebble (Let's Encrypt's test CA). It then force-renews both, which
# must replay each certificate's own challenge, and checks /status reports the
# daemon's ACME capabilities.
#
# The HTTP-01 name is already claimed by a managed vhost (a proxy with
# force_ssl and an access list that refuses the CA), so issuance and renewal
# only work because every vhost serves the ACME webroot (G-NP9), not just the
# catch-all. Redirects and dead hosts with access lists must answer 403 to a
# refused client and their code to an allowed one (G-NP10). Needs docker, curl
# and openssl.
#
#   nginxpilot/test/e2e-acme-challenges.sh
#   SKIP_BUILD=1 ...      reuse nginxpilot:e2e-acme and zonewright:e2e
#   KEEP=1 ...            leave the containers running afterwards (debugging)
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
NGINXPILOT="$(cd "$HERE/.." && pwd)"
TOOLCASE="$(cd "$NGINXPILOT/.." && pwd)"
PLUGIN="$TOOLCASE/zonewright/certbot-dns-zonewright"
NP_IMAGE=nginxpilot:e2e-acme
ZW_IMAGE=zonewright:e2e
PEBBLE_IMAGE="${PEBBLE_IMAGE:-ghcr.io/letsencrypt/pebble:latest}"
NET=np-acme-e2e
ZW_ADMIN=e2e-zw-admin
ZW_API=http://127.0.0.1:19091
WORK="$(mktemp -d)"
PASS=0
FAIL=0

cleanup() {
    if [ -n "${KEEP:-}" ]; then
        echo "KEEP=1: containers np-acme, zw-np-acme, pebble-np-acme left running (work dir $WORK)"
        return
    fi
    docker rm -f np-acme zw-np-acme pebble-np-acme >/dev/null 2>&1 || true
    docker network rm "$NET" >/dev/null 2>&1 || true
    rm -rf "$WORK"
}
trap cleanup EXIT

ok()    { PASS=$((PASS + 1)); printf '  \033[32mPASS\033[0m %s\n' "$1"; }
bad()   { FAIL=$((FAIL + 1)); printf '  \033[31mFAIL\033[0m %s\n' "$1"; }
check() { if [ "$2" = "$3" ]; then ok "$1"; else bad "$1 (got '$2', want '$3')"; fi; }
np()    { # np METHOD PATH [BODY] — nginxpilot admin API, from inside the container (loopback)
    if [ $# -ge 3 ]; then
        docker exec np-acme curl -s -X "$1" "http://127.0.0.1:9090$2" --data-binary "$3"
    else
        docker exec np-acme curl -s -X "$1" "http://127.0.0.1:9090$2"
    fi
}
npcode() {
    if [ $# -ge 3 ]; then
        docker exec np-acme curl -s -o /dev/null -w '%{http_code}' -X "$1" "http://127.0.0.1:9090$2" --data-binary "$3"
    else
        docker exec np-acme curl -s -o /dev/null -w '%{http_code}' -X "$1" "http://127.0.0.1:9090$2"
    fi
}
wait_job() { # wait_job JOB_ID → prints the final state
    local state=""
    for _ in $(seq 120); do
        state="$(np GET "/certs/jobs/$1" | sed -n 's/.*"state": *"\([a-z]*\)".*/\1/p' | head -1)"
        case "$state" in succeeded | failed) break ;; esac
        sleep 1
    done
    echo "$state"
}
job_of() { sed -n 's/.*"job_id": *"\([^"]*\)".*/\1/p' | head -1; }
check_job() { # check_job DESCRIPTION JOB_ID — on failure, show certbot's reason
    local state
    state="$(wait_job "$2")"
    check "$1" "$state" succeeded
    if [ "$state" != succeeded ]; then
        np GET "/certs/jobs/$2" | sed -n 's/.*"error": *"\(.*\)".*/    error: \1/p' | sed 's/\\n/\n    /g' | tail -25
    fi
}
# The image has no openssl: copy the leaf out and read it on the host.
leaf() { docker exec np-acme cat "/etc/letsencrypt/live/$1/cert.pem" 2>/dev/null || true; }
sans() { { leaf "$1" | openssl x509 -noout -ext subjectAltName 2>/dev/null || true; } | tail -1 | tr -d ' ' | tr ',' '\n' | sort | paste -sd, -; }
serial() { leaf "$1" | openssl x509 -noout -serial 2>/dev/null || true; }

echo "== setup"
if [ -z "${SKIP_BUILD:-}" ]; then
    # Built the way CI builds it: the plugin comes in as a named build context.
    docker build -q --build-arg PHP_VERSION="" --build-arg CERTBOT_DNS_PLUGINS="certbot-dns-cloudflare" \
        --build-context certbot-dns-zonewright="$PLUGIN" -t "$NP_IMAGE" "$NGINXPILOT" >/dev/null
    docker build -q -t "$ZW_IMAGE" "$TOOLCASE/zonewright" >/dev/null
fi
docker network create "$NET" >/dev/null

cid="$(docker create "$PEBBLE_IMAGE")"
docker cp "$cid:/test/certs/pebble.minica.pem" "$WORK/pebble-ca.pem"
docker rm "$cid" >/dev/null
chmod 0644 "$WORK/pebble-ca.pem"

cat >"$WORK/zonewright.yml" <<'EOF'
data_dir: /var/lib/zonewright
admin:
  listen: 0.0.0.0:9053
  token_env: ZONEWRIGHT_TOKEN
  allow_insecure_http: true
defaults:
  ttl: 5m
  nameservers: [ns1.example.net, ns2.example.net]
EOF
docker run -d --name zw-np-acme --network "$NET" --network-alias zw -p 127.0.0.1:19091:9053 \
    -e ZONEWRIGHT_TOKEN="$ZW_ADMIN" -v "$WORK/zonewright.yml:/etc/zonewright/config.yml:ro" "$ZW_IMAGE" >/dev/null

cat >"$WORK/nginxpilot.yml" <<'EOF'
data_dir: /var/lib/nginxpilot
admin:
  listen: 127.0.0.1:9090
nginx:
  manage: true
  conf_dir: /etc/nginx/nginxpilot/conf.d
  stream_conf_dir: /etc/nginx/nginxpilot/stream.d
  managed_include_dir: /etc/nginx/nginxpilot/conf.d
tls:
  cert_dir: /etc/letsencrypt/live
access_lists:
  - name: staff
    rules:
      - allow: 10.255.0.0/16
  - name: local
    rules:
      - allow: 127.0.0.1
redirects:
  - domain: old.example.test
    to: example.test
    access_list: staff
  - domain: moved.example.test
    to: example.test
    access_list: local
dead_hosts:
  - domain: parked.example.test
    code: 410
    access_list: staff
  - domain: open.example.test
    code: 410
    access_list: local
proxies:
  - domain: www.example.test
    pass: http://127.0.0.1:9
    access_list: staff
    tls: auto
    force_ssl: true
acme:
  enabled: true
  email: e2e@example.test
  agree_tos: true
  server: https://pebble:14000/dir
  config_dir: /etc/letsencrypt
  challenge: http
  challenges: [http, dns]
  http:
    webroot: /var/www/acme
  dns:
    provider: zonewright
    propagation_seconds: 1
EOF
docker run -d --name np-acme --network "$NET" \
    -e REQUESTS_CA_BUNDLE=/etc/pebble-ca.pem \
    -v "$WORK/pebble-ca.pem:/etc/pebble-ca.pem:ro" \
    -v "$WORK/nginxpilot.yml:/etc/nginxpilot/config.yml:ro" \
    "$NP_IMAGE" >/dev/null
for _ in $(seq 30); do curl -sf "$ZW_API/healthz" >/dev/null && docker exec np-acme curl -sf http://127.0.0.1:9090/status >/dev/null 2>&1 && break; sleep 1; done
ip_of() { docker inspect -f "{{(index .NetworkSettings.Networks \"$NET\").IPAddress}}" "$1"; }
NP_IP="$(ip_of np-acme)"
ZW_IP="$(ip_of zw-np-acme)"

printf '{"pebble":{"listenAddress":"0.0.0.0:14000","managementListenAddress":"0.0.0.0:15000","certificate":"test/certs/localhost/cert.pem","privateKey":"test/certs/localhost/key.pem","httpPort":80,"tlsPort":443,"ocspResponderURL":"","externalAccountBindingRequired":false}}\n' \
    >"$WORK/pebble.json"
docker run -d --name pebble-np-acme --network "$NET" --network-alias pebble \
    -e PEBBLE_VA_NOSLEEP=1 -e PEBBLE_WFE_NONCEREJECT=0 \
    -v "$WORK/pebble.json:/pebble.json:ro" \
    "$PEBBLE_IMAGE" -config /pebble.json -dnsserver "$ZW_IP:53" >/dev/null
for _ in $(seq 30); do docker exec np-acme curl -sf https://pebble:14000/dir >/dev/null 2>&1 && break; sleep 1; done

zone="{\"zones\":[{\"name\":\"example.test\",\"records\":[{\"name\":\"@\",\"type\":\"A\",\"value\":\"$NP_IP\"},{\"name\":\"www\",\"type\":\"A\",\"value\":\"$NP_IP\"}]}]}"
check "zonewright holds example.test" \
    "$(curl -s -o /dev/null -w '%{http_code}' -X POST -H "Authorization: Bearer $ZW_ADMIN" "$ZW_API/zones" --data-binary "$zone")" 201
ACME="$(curl -s -X POST -H "Authorization: Bearer $ZW_ADMIN" "$ZW_API/tokens" \
    --data-binary '{"name":"np-e2e","scope":"acme","zones":["example.test"]}' |
    sed -n 's/^  "token": "\(zwt_[0-9a-f]*\)",*$/\1/p')"
check "acme token for the nginxpilot node" "${ACME:0:4}" "zwt_"
creds="{\"credentials\":\"dns_zonewright_url = http://zw:9053\\ndns_zonewright_allow_insecure_http = true\\ndns_zonewright_token = $ACME\\n\"}"
check "zonewright credentials stored on nginxpilot" "$(npcode PUT /acme/credentials/zonewright/e2e "$creds")" 201

echo "== /status reports what the daemon can issue"
status="$(np GET /status)"
check "challenge default" "$(echo "$status" | tr -d ' \n' | grep -o '"acme":{[^}]*' | grep -o '"challenge":"[a-z]*"')" '"challenge":"http"'
check "allowed challenges" "$(echo "$status" | tr -d ' \n' | grep -o '"challenges":\[[^]]*\]')" '"challenges":["http","dns"]'
providers=""
for _ in $(seq 30); do
    providers="$(np GET /status | tr -d ' \n' | grep -o '"dns_providers":\[[^]]*\]' || true)"
    [ -n "$providers" ] && break
    sleep 1
done
case "$providers" in *'"zonewright"'*) ok "installed DNS plugins include zonewright ($providers)" ;; *) bad "dns_providers: '$providers'" ;; esac

echo "== one daemon, two challenges"
check "a challenge outside the allowed set is refused" \
    "$(npcode POST /certs '{"domains":["example.test"],"challenge":"standalone"}')" 400
check "a wildcard over http is refused" \
    "$(npcode POST /certs '{"domains":["*.example.test"],"challenge":"http"}')" 400

h80()  { docker exec np-acme curl -s -o /dev/null -w '%{http_code}' -H 'Host: www.example.test' "http://127.0.0.1$1"; }
h443() { docker exec np-acme curl -sk -o /dev/null -w '%{http_code}' --resolve www.example.test:443:127.0.0.1 "https://www.example.test$1"; }
for _ in $(seq 30); do [ "$(h80 /)" = 403 ] && break; sleep 1; done
check "www.example.test is claimed by the guarded proxy (access list refuses us)" "$(h80 /)" 403
httpjob="$(np POST /certs '{"domains":["www.example.test"]}' | job_of)"
check_job "HTTP-01 (webroot, the default) issued through the guarded vhost" "$httpjob"
check "no managed resource was quarantined by nginx -t" \
    "$(np GET /status | tr -d ' \n' | grep -o '"disabled_count":[0-9]*')" '"disabled_count":0'
for _ in $(seq 20); do [ "$(h80 /)" = 301 ] && break; sleep 1; done
check "with its certificate, the vhost redirects plain HTTP" "$(h80 /)" 301
check "and guards HTTPS with the access list" "$(h443 /)" 403
# As the daemon user: a root-owned challenge dir would stop certbot (which runs
# as nginxpilot) from writing its own files there later.
docker exec -u nginxpilot np-acme sh -c 'mkdir -p /var/www/acme/.well-known/acme-challenge && echo probe-ok > /var/www/acme/.well-known/acme-challenge/probe'
check "a challenge path on :80 is served, not redirected" \
    "$(docker exec np-acme curl -s -H 'Host: www.example.test' http://127.0.0.1/.well-known/acme-challenge/probe)" probe-ok
check "a challenge path on :443 is served despite the access list" \
    "$(docker exec np-acme curl -sk --resolve www.example.test:443:127.0.0.1 https://www.example.test/.well-known/acme-challenge/probe)" probe-ok
check "a missing challenge file is a plain 404" "$(h80 /.well-known/acme-challenge/nope)" 404

echo "== access lists guard redirects and dead hosts"
hcode() { docker exec np-acme curl -s -o /dev/null -w '%{http_code}' -H "Host: $1" "http://127.0.0.1$2"; }
check "guarded dead host refuses a client outside its list" "$(hcode parked.example.test /)" 403
check "guarded redirect refuses a client outside its list" "$(hcode old.example.test /x)" 403
check "dead host answers its code to an allowed client" "$(hcode open.example.test /)" 410
check "redirect redirects an allowed client" "$(hcode moved.example.test /x)" 301
check "and keeps the path" \
    "$(docker exec np-acme curl -s -o /dev/null -w '%{redirect_url}' -H 'Host: moved.example.test' http://127.0.0.1/x)" "http://example.test/x"
check "the challenge path stays open on a guarded dead host" \
    "$(docker exec np-acme curl -s -H 'Host: parked.example.test' http://127.0.0.1/.well-known/acme-challenge/probe)" probe-ok
docker exec -u nginxpilot np-acme rm -f /var/www/acme/.well-known/acme-challenge/probe
dnsjob="$(np POST /certs '{"domains":["example.test","*.example.test"],"challenge":"dns","provider":"zonewright","account":"e2e"}' | job_of)"
check_job "DNS-01 (zonewright) apex + wildcard issued" "$dnsjob"
check "the DNS job recorded its challenge" "$(np GET "/certs/jobs/$dnsjob" | tr -d ' \n' | grep -o '"challenge":"[a-z]*"')" '"challenge":"dns"'

check "DNS-01 certificate names" "$(sans example.test)" "DNS:*.example.test,DNS:example.test"
check "HTTP-01 certificate names" "$(sans www.example.test)" "DNS:www.example.test"
auth() { docker exec np-acme sed -n 's/^authenticator = //p' "/etc/letsencrypt/renewal/$1.conf" 2>/dev/null || true; }
check "certbot stored dns-zonewright for the DNS-01 cert" "$(auth example.test)" "dns-zonewright"
check "certbot stored webroot for the HTTP-01 cert" "$(auth www.example.test)" "webroot"
left="$(curl -s -H "Authorization: Bearer $ZW_ADMIN" "$ZW_API/zones/example.test/records?type=TXT")"
case "$left" in *_acme-challenge*) bad "challenge records left in the zone" ;; *) ok "DNS-01 challenge records cleaned up" ;; esac

echo "== renewals replay each certificate's own challenge"
before_dns="$(serial example.test)"
before_http="$(serial www.example.test)"
check "renew the DNS-01 certificate" "$(npcode POST /certs/example.test/renew)" 200
check "renew the HTTP-01 certificate (vhost live, force_ssl, access list)" "$(npcode POST /certs/www.example.test/renew)" 200
[ "$(serial example.test)" != "$before_dns" ] && ok "DNS-01 certificate replaced" || bad "DNS-01 certificate not replaced"
[ "$(serial www.example.test)" != "$before_http" ] && ok "HTTP-01 certificate replaced" || bad "HTTP-01 certificate not replaced"

echo
echo "passed: $PASS  failed: $FAIL"
if [ "$FAIL" -ne 0 ]; then
    echo "--- nginxpilot logs"; docker logs np-acme 2>&1 | tail -40
fi
[ "$FAIL" -eq 0 ]
