# webmail

A web mail client for mailboxes hosted by the Mail app. One static Go binary with the single-page app embedded; it
speaks JMAP (RFC 8620/8621) to the mail server on the browser's behalf and adds authentication. Spec: `new_apps.md`
Part 3.

- Browser holds only an opaque `__Host-` session cookie, never a mail credential.
- Sign-in forwards the password to the platform once; only the returned temporary **session credential** is kept
  (sealed AES-256-GCM under `WEBMAIL_SESSION_KEY`).
- State: SQLite in `WEBMAIL_DATA_DIR` (sessions, preferences, rate-limit counters). One instance only.
- Mail bodies are sanitised on the server and shown in a script-less sandboxed iframe.

## Quick start

```bash
cd web && npm install && npm run build && cd ..     # builds the SPA into internal/web/dist
go build -o webmail ./cmd/webmail

export WEBMAIL_PUBLIC_URL=https://webmail.example.com
export WEBMAIL_JMAP_URL=http://127.0.0.1:8090          # mail server, internal
export WEBMAIL_PLATFORM_URL=https://api.example.com
export WEBMAIL_PLATFORM_TOKEN=...                      # service key with mail.webmail.agent
export WEBMAIL_SESSION_KEY=$(openssl rand -base64 32)  # back it up
./webmail validate && ./webmail run
```

Local development without a mail server: `go run ./test/fake-servers` (fake platform :9101, fake JMAP :9102; mailbox
`ann@example.test` / `correct-horse`). Add `-stateful` and the fake JMAP server remembers read and starred state, folders, drafts and sent mail, so
the whole client can be tried by hand, or `docker compose -f docker/compose.yml up --build`. `test/smoke.sh` drives
login, list, read and logout with curl. Without a built SPA the binary serves a placeholder page.

Docker: `docker build -t webmail .` (builds the SPA in a node stage against the published
`@toolcase/web-components`, then the Go binary into distroless nonroot). Subcommands: `run` (default), `validate`,
`healthcheck`, `version`.

## Look

The SPA wears the platform dashboard's own look: the `blueprint` theme (`aurora` for readers who prefer dark) with
Space Grotesk, Chakra Petch and JetBrains Mono, a tinted ground with paper panels, and the same sign-in layout. A mail
domain's branding `theme` is one of the dashboard's theme variants (`ocean`, `forest`, `rose`, ...), applied as
`data-tc-variant`; its accent colour still overrides the variant's. `web/src/styles/blueprint.css` carries the
dashboard's component tokens, `skin.css` the layout of the mail screens.

## Configuration (environment only)

Unknown `WEBMAIL_*` variables warn (with a suggestion). `WEBMAIL_PLATFORM_TOKEN` and `WEBMAIL_SESSION_KEY` also accept
a `_FILE` form. All problems are reported at once.

| Variable | Default | Meaning |
|---|---|---|
| `WEBMAIL_LISTEN` | `:8080` | Public HTTP bind (TLS terminated by a proxy) |
| `WEBMAIL_ADMIN_LISTEN` | `127.0.0.1:8081` | Serves `/_metrics` only; keep it off the public network |
| `WEBMAIL_PUBLIC_URL` | required | External origin: cookies, `Origin` checks, HSTS |
| `WEBMAIL_JMAP_URL` | required | Internal base URL of the mail server |
| `WEBMAIL_PLATFORM_URL` | required | Platform API base URL |
| `WEBMAIL_PLATFORM_TOKEN` | required | Service key (`mail.webmail.agent`) |
| `WEBMAIL_SESSION_KEY` | required | Base64 of 32 random bytes |
| `WEBMAIL_DATA_DIR` | `/var/lib/webmail` | SQLite database |
| `WEBMAIL_SESSION_IDLE` / `WEBMAIL_SESSION_MAX` | `12h` / `720h` | Idle (30 days with remember-me) and absolute lifetime |
| `WEBMAIL_MAX_UPLOAD_MB` | `25` | Attachment upload cap |
| `WEBMAIL_LOGIN_FAIL_LIMIT` | `20` | Failed logins per IP per 15 min |
| `WEBMAIL_ADDRESS_FAIL_LIMIT` | `10` | Failed logins per address per 15 min (addition to the spec) |
| `WEBMAIL_TRUSTED_PROXIES` | none | CIDRs/IPs whose `X-Forwarded-For` is trusted |
| `WEBMAIL_BRANDING_TTL` | `60s` | Branding cache time |
| `WEBMAIL_UPSTREAM_TIMEOUT` | `30s` | Timeout for platform and JMAP calls (addition to the spec) |
| `WEBMAIL_LOG_FORMAT` / `WEBMAIL_LOG_LEVEL` | `logfmt` / `info` | As the other toolcase daemons |

## HTTP API

Public: `GET /_healthz`, `GET /_version`, `GET /api/branding?domain=`, `POST /api/login`, `POST /api/invite`.
Authenticated (cookie; mutating requests also need `X-Webmail-CSRF` and a matching `Origin`): `GET /api/session`,
`POST /api/logout`, `GET /api/sessions`, `DELETE /api/sessions/{id}`, `PUT /api/prefs`, `POST /api/password`,
`POST /api/jmap`, `GET /api/download/{accountId}/{blobId}/{name}`, `POST /api/upload/{accountId}`,
`GET /api/eventsource`, `GET /api/message-html/{emailId}?images=1`. Errors are `{"error":{"code","message"}}`.

## Architecture

```
cmd/webmail          subcommands
internal/config      env-only config, all problems at once, secrets masked in Applied()
internal/server      wiring, listeners, auth handlers, SPA, headers, metrics, reaper
internal/gateway     /api/jmap, session doc, download, upload, eventsource, message-html
internal/jmap        upstream client, allow-lists, session rewrite; quirks.go = mail-server seam
internal/sanitize    HTML+CSS allow-list sanitiser (x/net/html tokenizer)
internal/session     sealed credentials, cookie, expiry, CSRF/Origin
internal/platform    agent client + branding cache + public-branding validation
internal/ratelimit   SQLite-backed failure/window limiters; window limiter refuses blocked keys from memory
internal/store       SQLite (WAL, writer pool of 1, append-only migrations); 5 s in-process session cache
internal/fakes       fake platform + JMAP for tests and local runs
web/                 React 19 + tc-* SPA, built into internal/web/dist
```

## Security notes

- Allow-lists: capabilities `core, mail, submission, vacationresponse, quota`; no `Email/copy`, `Email/import`, `Blob/*`.
  `accountId` is overwritten in every call; 1 MiB body, 32 calls.
- Rate limits: the branding and invite window limiters refuse a key already over its limit from memory (no SQLite
  write) until that window ends. Memory only repeats a decision the store made; it is bounded (10k keys), and after
  eviction or restart the store decides again. Login/password failure limiters read the store on every check.
- Sessions are cached in memory for 5 s (`store.DefaultSessionCacheTTL`). Every session write in the process (logout,
  end session, password change, upstream 401, reaper, touch) drops the entry at once, expiry is always checked against
  the clock, and callers get copies. Only a writer outside this process (a second process on the same file) can be
  seen up to 5 s late; run one instance.
- An upstream 401 ends the session (password change or revocation takes effect on the next call).
- Sign-in failures answer identically for unknown address and wrong password, with a minimum response time.
- Remote images, fonts and `@import` are never loaded unless the reader asks per message; there is no image proxy.
- cid images are inlined as `data:` URIs by the server (a sandboxed iframe cannot send the cookie).
- Downloads are `attachment` except raster images (never SVG), with `nosniff` and a sandbox CSP.
- Every response carries CSP, `Referrer-Policy: no-referrer`, `nosniff`, `X-Frame-Options: DENY`; HSTS when
  `WEBMAIL_PUBLIC_URL` is https.
- Back up `WEBMAIL_SESSION_KEY`; without it all users must sign in again.
- Mail-server specifics (Stalwart) are unverified against a real server; they live in `internal/jmap/quirks.go` and
  `web/src/jmap/quirks.ts`.
