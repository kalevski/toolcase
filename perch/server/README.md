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
  `app/api/github/**` routes (§9 step 1, §13).
