# perch-client

The Go client that fetches resolved configuration from a Perch **instance
fetch API** at container boot (move_wharf_to_perch.md §9). Standard-library
only; `CGO_ENABLED=0 go build` produces a static binary. Cross-compiled
(linux/amd64 + linux/arm64) by perch's Dockerfile `client` build stage and
served at `/api/agent/v1/client/*`.

## Modes

```sh
perch-client exec -- ./app --serve          # fetch once, inject as env, exec the process (PID-1 handoff)
perch-client write --format json|dotenv --out /path/config   # materialize to a file
perch-client serve --addr 127.0.0.1:9000 --interval 30s      # loopback sidecar; poll (ETag) + serve /env /flags /config
```

## Configuration (env vars)

| Var | Meaning |
|---|---|
| `PERCH_URL` | fetch-API base URL (e.g. `https://perch.example.com`) |
| `PERCH_INSTANCE` | the instance name |
| `PERCH_SECRET` | the per-instance fetch secret (from a Docker/orchestrator secret, never baked in) |

No environment tier (unlike wharf's `WHARF_ENVIRONMENT`) — the flat instance
model addresses everything by instance name alone.

## Library

```go
c := perch.New(perch.FromEnv())
env,   _ := c.FetchEnv(ctx)    // map[string]string (secrets already resolved server-side)
flags, _ := c.FetchFlags(ctx)  // map[string]perch.Flag { Enabled }
c.Watch(ctx, 30*time.Second, func(s perch.Snapshot) { /* fires only on change */ })
```

Fails **closed**: `exec`/`write` exit non-zero if the fetch fails, so a
misconfigured container never boots with empty config.
