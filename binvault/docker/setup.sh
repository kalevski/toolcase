#!/bin/sh
# One-shot configuration for docker/compose.yml (runs inside the curl image).
set -eu
A=http://binvault:9001/_admin/v1
H="Authorization: Bearer ${ADMIN}"

# wait for the node
for i in $(seq 1 60); do
  curl -fsS -H "$H" "$A/status" >/dev/null 2>&1 && break
  sleep 1
done

post() { curl -fsS -X "$1" -H "$H" -H 'Content-Type: application/json' -d "$3" "$A$2"; }

post POST /buckets '{"name":"demo","versioning":"enabled"}' >/dev/null || true

post POST /pipelines "{
  \"name\": \"content-gate\", \"stage\": \"before\",
  \"events\": [\"object.created\", \"object.updated\"],
  \"match\": {\"keys\": [\"uploads/**\"]},
  \"service\": {\"url\": \"http://sample-service:8080/hooks/binvault\", \"signing_secret\": \"${SIGNING_SECRET}\", \"timeout\": \"10s\"},
  \"token\": {\"grants\": [{\"actions\": [\"read\"], \"keys\": [\"{key}\"]}]},
  \"on_error\": \"reject\"
}" >/dev/null || true

post POST /pipelines "{
  \"name\": \"tag-hash\", \"stage\": \"after\",
  \"events\": [\"object.created\", \"object.updated\"],
  \"match\": {\"keys\": [\"uploads/**\"]},
  \"service\": {\"url\": \"http://sample-service:8080/hooks/binvault\", \"signing_secret\": \"${SIGNING_SECRET}\"},
  \"token\": {\"grants\": [{\"actions\": [\"read\", \"tag\"], \"keys\": [\"{key}\"]}]}
}" >/dev/null || true

post PUT /buckets/demo/pipelines '{"items":[{"pipeline":"content-gate","enabled":true},{"pipeline":"tag-hash","enabled":true}]}' >/dev/null

echo "---- bucket demo is ready; credentials for the S3 API (shown once):"
post POST /buckets/demo/tokens '{"name":"demo-app","grants":[{"actions":["read","write","list","delete","tag"]}]}'
echo
