# webmail

A web mail client for mailboxes hosted by the Mail app. One static Go binary with the single-page app embedded; it
speaks JMAP (RFC 8620/8621) to the mail server on the browser's behalf and adds authentication. Spec: `new_apps.md`
Part 3.

**The platform calls webmail, never the other way round.** The platform registers each mail domain by pushing its
branding to webmail's admin API (`/admin/v1`, authenticated with `WEBMAIL_API_TOKEN`, the same value the operator
pastes into the platform's Fleet → Webmail tab). Webmail keeps those brandings in its own SQLite and needs no
platform address or credential.

- **One webmail, several mail servers.** The platform sends each domain's mail server address (`jmapUrl`) with its
  branding. Sign-in and every later call of that domain go to that server (`internal/mailhost`); a domain with no
  `jmapUrl` uses `WEBMAIL_JMAP_URL`. When the platform moves a domain to another server it pushes the new address:
  the sessions of that domain fail their next upstream call and end, and the users sign in again.
- **The page wears the branding of the host it is served on.** The platform proxies each mail domain's webmail address
  (for example `mail.acme.com`) to this service and pushes it as the branding's `webmailHost`. `GET /api/branding` and the
  signed-in app pick the branding by that host (`X-Forwarded-Host` from a trusted proxy, else `Host`); a domain with no
  `webmailHost` is served on its own name; the shared `WEBMAIL_PUBLIC_URL` stays neutral. Typing an address never
  restyles the page. A branding's `signInScope` (`any`, the default, or `domain`) can keep its host for its own
  domain's addresses: others are refused with `domain_not_allowed` before the mail server is asked. The wordmark is
  `brandPrimary` and `brandSecondary` (else the display name split at its first space), with an optional `brandBadge`
  above it. Sign-in and every change also accept the `Origin` of a registered webmail host, on the public URL's
  scheme.
- Browser holds only an opaque `__Host-` session cookie, never a mail credential.
- Sign-in checks the password against the mail server over JMAP (HTTP Basic) and keeps it sealed (AES-256-GCM under
  `WEBMAIL_SESSION_KEY`) in the session for upstream calls. A domain the platform has not registered cannot sign in.
- State: SQLite in `WEBMAIL_DATA_DIR` (sessions, preferences, rate-limit counters, brandings). One
  instance only.
- Mail bodies are sanitised on the server and shown in a script-less sandboxed iframe.

## Quick start

```bash
cd web && npm install && npm run build && cd ..     # builds the SPA into internal/web/dist
go build -o webmail ./cmd/webmail

export WEBMAIL_PUBLIC_URL=https://webmail.example.com
export WEBMAIL_JMAP_URL=http://127.0.0.1:8090          # mail server, internal
export WEBMAIL_API_TOKEN=$(openssl rand -hex 32)       # the platform's Fleet -> Webmail tab gets the same value
export WEBMAIL_SESSION_KEY=$(openssl rand -base64 32)  # back it up
./webmail validate && ./webmail run
```

Register a domain the way the platform does (nobody can sign in for a domain that has no branding row):

```bash
curl -H "Authorization: Bearer $WEBMAIL_API_TOKEN" -d '{"domain":"example.com","displayName":"Example"}' \
  $WEBMAIL_PUBLIC_URL/admin/v1/brandings
```

Local development without a mail server: `go run ./test/fake-servers` (fake JMAP :9102; mailbox
`ann@example.test` / `correct-horse`; register `example.test` through the admin API first, see above). Add `-stateful` and the fake JMAP server remembers read and starred state, folders, drafts and sent mail, so
the whole client can be tried by hand, or `docker compose -f docker/compose.yml up --build`. `test/smoke.sh` drives
login, list, read and logout with curl. Without a built SPA the binary serves a placeholder page.

Docker: `docker build -t webmail .` (builds the SPA in a node stage against the published
`@toolcase/web-components`, then the Go binary into distroless nonroot). Subcommands: `run` (default), `validate`,
`healthcheck`, `version`.

## Look

The SPA is the platform dashboard (webapp.mk/web) applied to mail: the `blueprint` theme (`aurora` for readers
who prefer dark) with Space Grotesk, Chakra Petch and JetBrains Mono, the dashboard's type scale and component
tokens, a tinted canvas with paper panels, dashed rules between rows, mono metadata, and the same sign-in layout
(a white card, a dark stage in the tone of the domain's accent). Phones get one `tc-mobile-shell` frame: bar,
search band, pane, dock; wider screens get a 52px bar, a folder column and the list and reading panes, centred
and hairline-framed past 1400px. A mail domain's branding `theme` is one of the dashboard's theme variants
(`ocean`, `forest`, `rose`, ...), applied as `data-tc-variant`; its accent colour still overrides the variant's.

`web/src/styles/` is one file per concern: `tokens.css` (the `--wm-*` tokens, resolved from the theme's `--bp-*`
with `--tc-*` fallbacks, the dashboard's `--m-font-*` scale and the `--bs-*` component theming), `chrome.css`
(both frames, sheets, toasts), `mail.css` (folders, search, list, reading pane), `compose.css`, `settings.css`
and `login.css`.

## Configuration (environment only)

Unknown `WEBMAIL_*` variables warn (with a suggestion). `WEBMAIL_API_TOKEN` and `WEBMAIL_SESSION_KEY` also accept
a `_FILE` form. All problems are reported at once.

| Variable | Default | Meaning |
|---|---|---|
| `WEBMAIL_LISTEN` | `:8080` | Public HTTP bind (TLS terminated by a proxy) |
| `WEBMAIL_ADMIN_LISTEN` | `127.0.0.1:8081` | Serves `/_metrics` only; keep it off the public network |
| `WEBMAIL_PUBLIC_URL` | required | External origin: cookies, `Origin` checks, HSTS |
| `WEBMAIL_JMAP_URL` | required | Internal base URL of the mail server; the default for a domain whose branding names none |
| `WEBMAIL_API_TOKEN` | required | Bearer token of the platform's calls to `/admin/v1`; at least 32 characters |
| `WEBMAIL_SESSION_KEY` | required | Base64 of 32 random bytes |
| `WEBMAIL_DATA_DIR` | `/var/lib/webmail` | SQLite database |
| `WEBMAIL_SESSION_IDLE` / `WEBMAIL_SESSION_MAX` | `12h` / `720h` | Idle (30 days with remember-me) and absolute lifetime |
| `WEBMAIL_MAX_UPLOAD_MB` | `25` | Attachment upload cap |
| `WEBMAIL_LOGIN_FAIL_LIMIT` | `20` | Failed logins per IP per 15 min |
| `WEBMAIL_ADDRESS_FAIL_LIMIT` | `10` | Failed logins per address per 15 min (addition to the spec) |
| `WEBMAIL_TRUSTED_PROXIES` | none | CIDRs/IPs whose `X-Forwarded-For` is trusted |
| `WEBMAIL_UPSTREAM_TIMEOUT` | `30s` | Timeout for JMAP calls (addition to the spec) |
| `WEBMAIL_LOG_FORMAT` / `WEBMAIL_LOG_LEVEL` | `logfmt` / `info` | As the other toolcase daemons |

## HTTP API

Public: `GET /_healthz`, `GET /_version`, `GET /api/branding` (by host), `POST /api/login`.
Authenticated (cookie; mutating requests also need `X-Webmail-CSRF` and a matching `Origin`): `GET /api/session`,
`POST /api/logout`, `GET /api/sessions`, `DELETE /api/sessions/{id}`, `PUT /api/prefs`, `POST /api/password`,
`POST /api/jmap`, `GET /api/download/{accountId}/{blobId}/{name}`, `POST /api/upload/{accountId}`,
`GET /api/eventsource`, `GET /api/message-html/{emailId}?images=1`. Errors are `{"error":{"code","message"}}`.

### Admin API (platform → webmail)

`Authorization: Bearer <WEBMAIL_API_TOKEN>` on every call, no cookies or CSRF; wrong tokens are throttled per address.
A **branding** is `{domain, displayName, theme, accent, loginTitle, loginMessage, supportEmail, supportUrl,
footerLinks[{label,url}], defaultLocale, allowUserAccent, mailboxCount}` plus the read-only `updatedAt`. A domain's mark is its display name, set as text: there are no logo images.
Every field is validated on write and a bad one is refused (`422 invalid_branding`, the message names the field);
nothing is silently dropped, and raw CSS or HTML is never stored.

| Call | Meaning |
|---|---|
| `GET /admin/v1/health` | `{ok, version, domains}` |
| `GET /admin/v1/brandings?limit=&cursor=&q=` | `{items, total, nextCursor}`, by domain; `limit` 1-100 (25); `q` filters on the domain |
| `POST /admin/v1/brandings` | register a domain (`201`; `409 exists`); `jmapUrl` is the mail server of its mailboxes (an http(s) base, no credentials), empty for the default |
| `GET` / `PUT` / `DELETE /admin/v1/brandings/{domain}` | read; replace every editable field (`404 not_found`); remove (`204`, idempotent) |

## Architecture

```
cmd/webmail          subcommands
internal/config      env-only config, all problems at once, secrets masked in Applied()
internal/server      wiring, listeners, auth handlers, admin API (manage.go), SPA, headers, metrics, reaper
internal/gateway     /api/jmap, session doc, download, upload, eventsource, message-html
internal/jmap        upstream client, allow-lists, session rewrite; quirks.go = mail-server seam
internal/sanitize    HTML+CSS allow-list sanitiser (x/net/html tokenizer)
internal/session     sealed passwords, cookie, expiry, CSRF/Origin
internal/branding    branding validation (rejecting), admin and public (browser) forms
internal/ratelimit   SQLite-backed failure/window limiters; window limiter refuses blocked keys from memory
internal/mailhost     the JMAP client of a domain: its branding's mail server, else the default; cached 30 s, dropped when the branding is written
internal/store       SQLite (WAL, writer pool of 1, append-only migrations): sessions, prefs, rate limits, brandings; 5 s in-process session cache
internal/fakes       fake JMAP server for tests and local runs
web/                 React 19 + tc-* SPA, built into internal/web/dist
```

## Security notes

- Allow-lists: capabilities `core, mail, submission, vacationresponse, quota`; no `Email/copy`, `Email/import`, `Blob/*`.
  `accountId` is overwritten in every call; 1 MiB body, 32 calls.
- Rate limits: the branding and admin-API window limiters refuse a key already over its limit from memory (no SQLite
  write) until that window ends. Memory only repeats a decision the store made; it is bounded (10k keys), and after
  eviction or restart the store decides again. Login/password failure limiters read the store on every check.
- Sessions are cached in memory for 5 s (`store.DefaultSessionCacheTTL`). Every session write in the process (logout,
  end session, password change, upstream 401, reaper, touch) drops the entry at once, expiry is always checked against
  the clock, and callers get copies. Only a writer outside this process (a second process on the same file) can be
  seen up to 5 s late; run one instance.
- An upstream 401 ends the session (a password change anywhere takes effect on the next call).
- The mailbox password lives only sealed in the session row and is never logged; ending the session deletes it.
  There are no temporary credentials, so a stolen database plus `WEBMAIL_SESSION_KEY` yields live passwords: protect
  both, keep the data directory private, and prefer short idle lifetimes.
- Sign-in for a domain with no branding row fails like a wrong password without asking the mail server.
- Admin API: constant-time token comparison, per-address window limit and failure throttle, 1 MiB body cap.
- Sign-in failures answer identically for unknown address and wrong password, with a minimum response time.
- Remote images, fonts and `@import` are never loaded unless the reader asks per message; there is no image proxy.
- cid images are inlined as `data:` URIs by the server (a sandboxed iframe cannot send the cookie).
- Downloads are `attachment` except raster images (never SVG), with `nosniff` and a sandbox CSP.
- Every response carries CSP, `Referrer-Policy: no-referrer`, `nosniff`, `X-Frame-Options: DENY`; HSTS when
  `WEBMAIL_PUBLIC_URL` is https.
- Back up `WEBMAIL_SESSION_KEY`; without it all users must sign in again.
- Mail-server specifics (Stalwart) are unverified against a real server; they live in `internal/jmap/quirks.go` and
  `web/src/jmap/quirks.ts`. Password change posts `[{"type":"changePassword","password":...}]` to
  `/api/account/auth` on the JMAP base URL with the current password as Basic auth: unverified, and Stalwart 0.16
  removed parts of that management API.
- Mailbox invites are not handled here: the platform owns that state and webmail cannot call it.
