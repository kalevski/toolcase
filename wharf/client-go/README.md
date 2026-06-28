# wharf-client

The Go client (the "dockworker") that fetches resolved configuration from a Wharf
**Agent API** at container boot. Standard-library only; `CGO_ENABLED=0 go build`
produces a static binary. Cross-compiled (linux/amd64 + linux/arm64) by the Wharf
image's Dockerfile `client` stage and served by the Agent at `/v1/client/*`.

## Modes (planning §6.1)

```sh
wharf-client exec -- ./app --serve          # fetch once, inject as env, exec the process (PID-1 handoff)
wharf-client write --format json|dotenv --out /path/config   # materialize to a file
wharf-client serve --addr 127.0.0.1:9000 --interval 30s      # loopback sidecar; poll (ETag) + serve /env /flags /config
```

## Configuration (env vars)

| Var | Meaning |
|---|---|
| `WHARF_URL` | Agent-API base URL (e.g. `http://wharf-agent:4000`) |
| `WHARF_ENVIRONMENT` | the instance's environment name |
| `WHARF_INSTANCE_ID` | the instance id |
| `WHARF_SECRET` | the per-instance fetch secret (from a Docker/orchestrator secret, never baked in) |

## Library

```go
c := wharf.New(wharf.FromEnv())
env,   _ := c.FetchEnv(ctx)    // map[string]string (secrets already resolved server-side)
flags, _ := c.FetchFlags(ctx)  // map[string]wharf.Flag { Enabled, Value, Type }
c.Watch(ctx, 30*time.Second, func(s wharf.Snapshot) { /* fires only on change */ })
```

Fails **closed**: `exec`/`write` exit non-zero if the fetch fails, so a
misconfigured container never boots with empty config.
