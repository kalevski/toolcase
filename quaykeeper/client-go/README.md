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
```

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
