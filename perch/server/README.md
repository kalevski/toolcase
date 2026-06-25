# server/

Server-side layering for Perch (mirrors TaskForge). Request flow, top to bottom:

```
app/api/**/route.ts   thin HTTP handlers — authorize(minRole) then call a service
  └─ server/services/        policy / business rules (server-only)
       └─ server/data/repositories/   raw-SQL access, one file per table (server-only)
            └─ server/data/db.ts       single cached node:sqlite connection (WAL + migrations)
server/domain/         pure shared types — safe to import from client AND server
```

Rules:

- Every module under `services/` and `data/` begins with `import 'server-only'` so
  it can never be bundled into a client component.
- `domain/` holds **pure** shared types and pure decision helpers — no
  `server-only`, no I/O — so client code may import them and the rules are
  unit-testable in isolation. `domain/plan-resolution.ts` (the sponsorship → plan
  bucketing) is the first such helper, wrapped by `services/plan.ts`.
- `data/db.ts` is the single owner of the `node:sqlite` `DatabaseSync` handle
  (cached on `globalThis`, WAL mode, append-only ordered `MIGRATIONS[]`), ported
  from TaskForge with a fresh §12 schema as migration `v1`.
- `data/repositories/` holds one raw-SQL module per §12 table — `userRepo`,
  `baseDomainRepo`, `siteRepo`, `sponsorshipRepo`, `planTierRepo`, `auditRepo` —
  each a namespace of prepared-statement helpers over `db.ts` that map snake_case
  rows to the camelCase `domain/types.ts` shapes. Import directly
  (`import * as siteRepo from '@/server/data/repositories/site-repo'`) or via the
  `repositories/index.ts` barrels.
- `config.ts` is the single, validated read of `process.env` (fail-fast on a
  missing required var). Server-only; the GitHub OAuth credentials, the
  `PERCH_AUTH_SECRET` cookie key, and the session TTL all live here.
- `services/auth.ts` is the first service: GitHub OAuth2 code flow, the
  HMAC-signed `httpOnly` session cookie, owner-bootstrap role resolution
  (`resolveOnLogin`), and the per-request `authorize(minRole)` guard. The OAuth
  routes live under `app/api/auth/**`. See
  `notes/static-hosting-app-design.md` §3, §5, §7, §12 for the architecture.
- `services/plan.ts` computes a user's effective plan and quota limits — never
  stored on the user — from their `sponsorship` row bucketed through the
  owner-editable `plan_tier` mapping (`resolvePlan` / `resolveLimits`), so a tier
  change applies immediately. The pure bucketing rules live in
  `domain/plan-resolution.ts` and the `PLAN_LIMITS` defaults in `domain/types.ts`
  (§6, §8, §15).
- `infrastructure/` holds server-only adapters to external systems (no DB, no
  policy). `infrastructure/github.ts` is a fetch-based GitHub REST helper —
  `gh()` plus `listRepos`/`listBranches` — reused with the *caller's* OAuth
  access token (read from the `perch_gh_token` `httpOnly` cookie set at login).
  The create-site wizard's repo/branch pickers call it through the
  `app/api/github/**` routes (§9 step 1, §13). `infrastructure/github-sponsors.ts`
  is its GraphQL sibling — `fetchSponsorshipsAsMaintainer` pages the owner's
  `viewer.sponsorshipsAsMaintainer` connection with a dedicated owner PAT.
  `infrastructure/server-log.ts` is the `[perch]` structured stdout logger.
  `infrastructure/nginxpilot.ts` is the deploy-engine seam (§4): two channels —
  Channel A writes/removes YAML site fragments atomically into the shared `sites.d/`
  dir under a deterministic, server-generated filename (`writeFragment` /
  `removeFragment`); Channel B is the read/operate REST admin API (`status`, `sync`,
  `vhost`, `healthz`) with an optional `Authorization: Bearer` from nginxpilot's
  `admin.token_env`. `reload()` tries `POST /reload` and otherwise falls back to the
  file-drop + reload-sidecar trigger — isolated in one function so M4 can drop the
  fallback once nginxpilot ships the endpoint (§17). The pure fragment *rendering* —
  exact §4 schema, secrets by env-var name only, never inlined — lives in the
  unit-tested `domain/nginxpilot-fragment.ts` (`renderFragment` / `fragmentFilename`).
  Note: nginxpilot's `github-token` auth validates `token_env` (not the §4 doc's
  `key_env`, which is the `ssh-key` method's key), so the renderer emits `token_env`.
- `services/sponsors-reconcile.ts` + `app/api/webhooks/github-sponsors/route.ts`
  drive sponsorship state (§8). The webhook verifies the `X-Hub-Signature-256`
  HMAC (constant-time, 401 on mismatch) and upserts `created`/`tier_changed`/
  `cancelled`/`pending_cancellation` events; the reconcile service is a 60s cron
  ticker (mirroring TaskForge's `scheduler.ts`, started from `instrumentation.ts`)
  that re-reads the authoritative GraphQL state and overrides stale rows. The pure
  signature/parse/reconcile rules live in `domain/sponsorship-events.ts` and the
  cron grammar in `domain/cron.ts`, both unit-tested.
