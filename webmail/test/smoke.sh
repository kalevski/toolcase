#!/usr/bin/env bash
# Smoke test: builds the binary, starts the fake JMAP server and webmail,
# registers the domain through the admin API the way the platform does, then
# drives login -> session -> list -> read -> logout with curl.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d); trap 'kill $(jobs -p) 2>/dev/null || true; rm -rf "$TMP"' EXIT
go build -o "$TMP/webmail" ./cmd/webmail
go build -o "$TMP/fakes" ./test/fake-servers
"$TMP/fakes" -jmap 127.0.0.1:19102 2>"$TMP/fakes.log" &
export WEBMAIL_LISTEN=127.0.0.1:18080 WEBMAIL_ADMIN_LISTEN=127.0.0.1:18081 WEBMAIL_PUBLIC_URL=https://mail.example.test \
  WEBMAIL_JMAP_URL=http://127.0.0.1:19102 WEBMAIL_API_TOKEN=smoke-api-token-0123456789abcdef0123 \
  WEBMAIL_SESSION_KEY="$(head -c 32 /dev/urandom | base64)" WEBMAIL_DATA_DIR="$TMP/data"
"$TMP/webmail" validate
"$TMP/webmail" run 2>"$TMP/webmail.log" &
for i in $(seq 50); do "$TMP/webmail" healthcheck 2>/dev/null && break; sleep 0.1; done
B=http://127.0.0.1:18080; O='Origin: https://mail.example.test'; A='Authorization: Bearer smoke-api-token-0123456789abcdef0123'
echo "== unauthorized"; curl -sS -o /dev/null -w '%{http_code}\n' "$B/admin/v1/health"
echo "== register";   curl -fsS -H "$A" -d '{"domain":"example.test","displayName":"Example Co","theme":"ocean","accent":"#336699","mailboxCount":1}' "$B/admin/v1/brandings"; echo
echo "== list";       curl -fsS -H "$A" "$B/admin/v1/brandings?limit=10"; echo
echo "== branding";  curl -fsS "$B/api/branding?domain=example.test"; echo
echo "== bad login"; curl -sS -o /dev/null -w '%{http_code}\n' -H "$O" -d '{"email":"ann@example.test","password":"x"}' "$B/api/login"
echo "== login"
COOKIE=$(curl -fsS -D - -o /dev/null -H "$O" -d '{"email":"ann@example.test","password":"correct-horse"}' "$B/api/login" | tr -d '\r' | sed -n 's/^[Ss]et-[Cc]ookie: \([^;]*\);.*/\1/p')
test -n "$COOKIE"
S=$(curl -fsS -H "Cookie: $COOKIE" "$B/api/session"); echo "$S" | head -c 300; echo
CSRF=$(echo "$S" | sed -n 's/.*"csrf":"\([^"]*\)".*/\1/p')
call() { curl -fsS -H "Cookie: $COOKIE" -H "$O" -H "X-Webmail-CSRF: $CSRF" -H 'Content-Type: application/json' -d "$1" "$B/api/jmap"; }
U='"using":["urn:ietf:params:jmap:core","urn:ietf:params:jmap:mail"]'
echo "== list";  call "{$U,\"methodCalls\":[[\"Email/query\",{},\"a\"],[\"Email/get\",{\"#ids\":{\"resultOf\":\"a\",\"name\":\"Email/query\",\"path\":\"/ids\"},\"properties\":[\"subject\"]},\"b\"]]}" | head -c 400; echo
echo "== forbidden method"; curl -sS -o /dev/null -w '%{http_code}\n' -H "Cookie: $COOKIE" -H "$O" -H "X-Webmail-CSRF: $CSRF" -H 'Content-Type: application/json' -d "{$U,\"methodCalls\":[[\"Email/import\",{},\"a\"]]}" "$B/api/jmap"
echo "== read";  curl -fsS -H "Cookie: $COOKIE" "$B/api/message-html/e1" | head -c 600; echo
echo "== logout"; curl -fsS -H "Cookie: $COOKIE" -H "$O" -H "X-Webmail-CSRF: $CSRF" -X POST "$B/api/logout"; echo
echo "== after logout"; curl -sS -o /dev/null -w '%{http_code}\n' -H "Cookie: $COOKIE" "$B/api/session"
echo "== spa"; curl -fsS "$B/" | head -c 200; echo
echo "== metrics"; curl -fsS http://127.0.0.1:18081/_metrics | grep -E '^webmail_(logins|http_requests)_total' | head
echo "SMOKE OK"
