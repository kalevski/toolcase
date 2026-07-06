# quaykeeper-client

The Go client that fetches resolved configuration from a Quaykeeper **instance
fetch API** at container boot (move_wharf_to_perch.md §9). Standard-library
only; `CGO_ENABLED=0 go build` produces a static binary. Cross-compiled
(linux/amd64 + linux/arm64) by quaykeeper's Dockerfile `client` build stage and
served at `/v1/client/*`.

## Modes

```sh
quaykeeper-client exec -- ./app --serve          # fetch once, inject as env, exec the process (PID-1 handoff)
quaykeeper-client write --format json|dotenv --out /path/config   # materialize to a file
quaykeeper-client serve --addr 127.0.0.1:9000 --interval 30s      # loopback sidecar; poll (ETag) + serve /env /flags /config
quaykeeper-client run -- ./app --serve           # supervise: inject env, capture + ship stdout/stderr (log_ides.md §5)
quaykeeper-client logs --file '/var/log/app/*.log' --format json|raw --state-dir /var/lib/quaykeeper-client   # tail files + ship
```

## Log collection (log_ides.md §5)

`run` and `logs` ship the instance's logs to the destinations delivered in the
`logs` section of `/v1/config` — set them in Quaykeeper (**Admin → Log
destinations**, `scope: instance`, targeting this instance). Destinations
hot-reload via the same ETag `Watch` that reloads env, so a filter/label change
propagates within one poll — no restart.

- **`run`** stays resident as a minimal supervisor (it does **not** `exec`-replace
  like `exec`): it injects the fetched env, spawns the child, forwards signals,
  reaps orphaned zombies as PID 1, propagates the exit code, and pipes the child's
  stdout/stderr through the shipper while **teeing every line verbatim** to the
  container's own stdout/stderr (so `docker logs` is unaffected). Log shipping is
  never load-bearing — if a destination is down the app is untouched.
  `CMD ["quaykeeper-client", "run", "--", "./app"]`.
- **`logs`** tails files (rotation-safe: files are tracked by dev:inode, byte
  offsets persist under `--state-dir`, and globs are re-evaluated periodically so
  new files are picked up). Use it as a sidecar or a host agent pointed at
  `/var/lib/docker/containers/*/*-json.log`.

Both parse each line as JSON (extracting `level`/`stream`/`message` + nginx access
fields for filtering and Loki labels), falling back to `{"raw":…,"parse_error":true}`
for non-JSON lines — never dropped. Levels are normalized to
`debug|info|warn|error|fatal`.

**Parse templates** turn plain-text logs into structured entries without an
external parser. A `"{field} literal {field}"` template compiles to an anchored
regex; a non-JSON line matching it becomes real JSON:

```sh
quaykeeper-client run --parse '{level} | {time} - {message}' -- ./app
# info | 12:20 - hello  →  {"level":"info","time":"12:20","message":"hello"}
```

Templates come from `--parse` (repeatable) and/or the destination's `parse` list in
Quaykeeper (instance scope) — the union is applied at intake, first match wins,
non-matching lines fall back to raw-wrap. Known field names (`level`/`status`/…)
also populate the typed fields, so `filter: { level: [error] }` and `$level` labels
work on template-parsed text. Secrets referenced by a destination's `auth`
(`password_env`/`token_env` / `*_file`) resolve from the **fetched instance env
first**, then the process env. Loki label values support `${VAR}` (env/instance
substitution, resolved once) and `$field` (per-log-line reference, dropped when the
field is missing).

## Configuration (env vars)

| Var | Meaning |
|---|---|
| `QUAYKEEPER_URL` | agent-server base URL — the "Instance config URL" from admin Settings (e.g. `https://config.example.com`) |
| `QUAYKEEPER_INSTANCE` | the instance name |
| `QUAYKEEPER_SECRET` | the per-instance fetch secret (from a Docker/orchestrator secret, never baked in) |

No environment tier (unlike wharf's `WHARF_ENVIRONMENT`) — the flat instance
model addresses everything by instance name alone.

## Library

```go
c := quaykeeper.New(quaykeeper.FromEnv())
env,   _ := c.FetchEnv(ctx)    // map[string]string (secrets already resolved server-side)
flags, _ := c.FetchFlags(ctx)  // map[string]quaykeeper.Flag { Enabled }
c.Watch(ctx, 30*time.Second, func(s quaykeeper.Snapshot) { /* fires only on change */ })
```

Fails **closed**: `exec`/`write` exit non-zero if the fetch fails, so a
misconfigured container never boots with empty config.
