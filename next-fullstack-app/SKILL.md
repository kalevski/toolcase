---
name: next-fullstack-app
description: Use when scaffolding or extending a self-hosted full-stack Next.js App Router application with its own backend — a single-process app that owns auth, a SQLite system-of-record, REST API routes, and a tc-* web-components dashboard UI. This IS Next.js (the `next` package, App Router, RSC, route handlers, `next build`/`next dev`) — for a static prerendered marketing site use `next-static-app` instead, for a backend-only Node service use `node-service`. Defines the layered server (config → data/repositories → domain → infrastructure → services → web), the node:sqlite singleton + reentrant tx + append-only migration runner, GitHub-OAuth + HMAC-cookie auth with a rank-ordered role model, the guard→parse→validate→service→audit→json route contract with typed service errors (httpErrorFor), thin server-component pages delegating to 'use client' components (server page-guards or a client AuthGate + MeProvider), the lib/tc.ts web-components interop + the shared client UI kit (DataTable/FormModal/fields/states/SubTabBar), the AES-256-GCM secret-at-rest cipher keyring, prefixed random IDs, typed external-API client factories, globalThis background tickers, instrumentation boot hooks, the root-vitest test layout, and the monorepo Docker standalone build — plus optional proven patterns: a second machine-facing HTTP listener, multi-realm (multi-daemon) tenancy, and cron-scheduled host jobs. Apply when adding an API route, a page, a repository/table + migration, a service, an env var, a background ticker, a scheduled job, an encrypted secret, an auth/role check, or scaffolding a new full-stack app workspace.
---

# next-fullstack-app — Architecture Reference

Opinionated blueprint for self-hosted, single-process, full-stack Next.js applications: an internal tool or control panel that owns its **own** auth, its **own** database, and a real-time dashboard UI — all in one deployable. App Router does double duty as the web framework (pages + RSC) and the HTTP backend (route handlers). State persists in a single SQLite file via Node's built-in `node:sqlite`. No external DB server, no separate API process, no DI container.

This **is** Next.js. If you need a statically-prerendered marketing/content site (no server runtime, no auth, no DB) use `next-static-app`. If you need a headless backend with no UI use `node-service`. This skill is for the case where one Next.js process is the whole product.

The reference implementations are **quaykeeper** (a static-hosting control plane) and **taskforge** (a Claude Code task runner). They share the same skeleton — `lib/tc.ts` is identical, `server/data/db.ts` and `server/config.ts` are ported with only names changed. That shared skeleton is what this skill encodes; deviation from it is a smell, not a style choice. quaykeeper is the larger reference: it layers the optional patterns (multi-realm tenancy, a machine-facing agent listener, cron jobs, the cipher keyring) onto the same skeleton, and where the two apps diverge (route guards, audit seam, page guards) this doc shows both variants and says when to pick which.

Stack baseline:

- **Next.js 16** (App Router), **React 19**, TypeScript `strict`. `output: 'standalone'`, `reactStrictMode: true`, `transpilePackages: ['@toolcase/base']`, `eslint.ignoreDuringBuilds: true`.
- **`node:sqlite`** (`DatabaseSync`) — synchronous, WAL journal, `foreign_keys = ON`, `busy_timeout = 5000`. Single connection cached on `globalThis` (survives dev hot-reload). Prepared-statement cache (`Map<string, StatementSync>`). Append-only `MIGRATIONS[]` runner. Reentrant `tx()` (a depth counter lets nested `tx()` calls join the open transaction).
- **`server-only`** import at the top of every server module — a build-time tripwire that fails the bundle if backend code is ever pulled into a client component.
- **`@/*`** path alias → repo root. `runtime = 'nodejs'` + `dynamic = 'force-dynamic'` on every route/page that touches the DB or session.
- **GitHub OAuth** code flow → signed `httpOnly` session cookie (`<base64url payload>.<base64url HMAC-SHA256 sig>`). Rank-ordered role model (`ROLE_RANK`) — three tiers (`admin | standard | guest`) or four (`owner | maintainer | standard | guest`). The access token is used during callback and never enters the session; if a later flow needs it, persist it only cipher-encrypted at rest.
- **Prefixed env vars** — every app-owned var carries the app's namespace (`QUAYKEEPER_*`, `TASKFORGE_*`); only shared infra knobs stay bare (`PORT`, `DB_PATH`, `WORKSPACE_DIR`, `HOSTNAME`).
- **`@toolcase/web-components`** for the UI — framework-free `tc-*` custom elements rendered into light DOM, driven from React via `lib/tc.ts`. `@toolcase/base` for helpers/data structures.
- **Node ≥ 22.5** (required for `node:sqlite`; flag-free on Node 24). Docker builds on `node:22-slim` / `node:24-slim`, Next standalone output, monorepo-root build context.
- Stateful singletons (DB handle, schedulers, execution engines) cached on `globalThis` rather than injected — they must survive Next.js dev hot-reload.

---

## Optional @toolcase Libraries

- **`@toolcase/web-components`** — primary UI primitives as framework-free `tc-*` Web Components (`tc-dashboard-layout`, `tc-side-nav`, `tc-brand`, `tc-user-panel`, `tc-table`, `tc-chart`, form inputs, overlays). `register()` once, **client-side only**, via a dynamic import inside a client `Providers` component — a static import evaluates `class … extends HTMLElement` during SSR where `HTMLElement` is undefined. See `web-components` skill for the catalog and `lib/tc.ts` below for the React interop.
- **`@toolcase/base`** — pure helpers + data structures (browser + Node). Listed in `transpilePackages` so Next resolves its named exports cleanly in the SSR build.
- **`@toolcase/logging`** — isomorphic logger when you need structured logs to a sink. Otherwise `console` + a small `server-log.ts` ring buffer (see infrastructure) is enough.
- **`@toolcase/node`** — reach for it when a feature wants the heavier backend helpers (Redis KV, OAuth2/OIDC, image transforms, the engine-agnostic repository contract). The baseline app deliberately does NOT use it — raw `node:sqlite` + hand-written repositories keep the dependency surface tiny. Add it per-feature, not by default.

The architecture is library-independent — you can swap the UI primitives — but pick **one** primitives library per app and drive every cosmetic through its theming contract.

---

## Workspace Layout

```
<app>/
├── package.json            # next dev -p <port> / build / start / lint / typecheck
├── next.config.mjs         # output: 'standalone', transpilePackages, (experimental.instrumentationHook)
├── tsconfig.json           # strict, "@/*": ["./*"], jsx: react-jsx, moduleResolution: bundler
├── instrumentation.ts      # boot hook — start background tickers once per server start
├── middleware.ts           # thin edge guard — session-cookie PRESENCE only (optional)
├── Dockerfile              # multi-stage monorepo build → node:22/24-slim standalone
├── run-docker.sh           # local run: --user $(id -u), bind-mount the workspace volume
├── .env.example            # every env var with a placeholder (committed; .env.local gitignored)
├── test/                   # unit + integration tests — run by the ROOT vitest config (no local config/script)
├── scripts/                # dev/codegen scripts (e.g. regenerate types from an external API's OpenAPI schema)
├── app/                    # App Router — pages + RSC + route handlers
│   ├── layout.tsx          # imports tc style.css + react JSX typings + globals.css; <Providers>
│   ├── globals.css
│   ├── providers.tsx       # 'use client' — dynamic register() web-components, gate UI behind it
│   ├── page.tsx            # dashboard home (thin server component → client component)
│   ├── not-found.tsx
│   ├── login/  no-access/  <feature>/page.tsx
│   └── api/<area>/route.ts # guard → parse → validate → service → audit → json
├── components/             # 'use client' UI — AppShell, modals, per-feature <Feature>Client.tsx
├── lib/                    # client glue — tc.ts (web-components interop), fetcher, contexts, toast, modal, icons
└── server/                 # 'server-only' backend — the layered core
    ├── config.ts           # validated env, fail-fast, NEXT_PHASE build deferral
    ├── data/
    │   ├── db.ts           # node:sqlite singleton + migrations + prep/getRow/allRows/exec/tx
    │   └── repositories/   # one file per table area — Raw (snake_case) + map() → camelCase domain type
    ├── domain/             # PURE logic + types.ts. No I/O. Unit-tested from test/.
    ├── infrastructure/     # adapters to the outside world — github, slack, git, daemon clients, cipher, ids, server-log
    ├── services/           # orchestration — compose repos + domain + infra; auth.ts, roles.ts
    └── web/                # http.ts (json/error/guard/audit), page-guards.ts, sse.ts
```

**Directionality is the whole point.** Dependencies point inward and down only:

```
app/api  app/page  →  server/web  →  server/services  →  server/infrastructure
                                          ↓                       ↓
                                     server/domain  ←  server/data/repositories
                                          ↓                       ↓
                                          └──── server/domain/types.ts ────┘  (pure, also client-importable)
```

- `domain/` imports nothing from `services/`, `infrastructure/`, `data/`, or `app/`. It is pure functions + types — the only layer with unit tests.
- `data/repositories/` import `domain/types` (for row shapes) and `data/db` (for `prep`/`getRow`/`allRows`/`tx`). Nothing else.
- `services/` are the **sole** callers of repositories. A route never imports a repository directly — it calls a service.
- `infrastructure/` wraps external systems (HTTP APIs, child processes, the filesystem) behind typed functions + typed errors. Services call infra; infra never calls services.
- `web/` + `app/` are the HTTP edge. They call services, format responses, and own nothing else.

---

## Data Layer — `server/data/db.ts`

The single owner of the `node:sqlite` handle. Copy it verbatim per app and change only the global name (`__<app>Db`), the DB-path resolution, and the `MIGRATIONS[]` array.

```ts
import 'server-only'
import { mkdirSync } from 'node:fs'
import path from 'node:path'
import type { DatabaseSync, StatementSync } from 'node:sqlite'   // type-only — erased at compile time
import { config } from '@/server/config'

interface DbWrap { db: DatabaseSync; stmts: Map<string, StatementSync> }
declare global { var __appDb: DbWrap | undefined }

// node:sqlite is a runtime built-in (Node ≥ 22.5). Load it via getBuiltinModule so
// importing this file on an older runtime doesn't crash at import — it fails fast,
// with an actionable message, only when the DB is first touched.
function loadDatabaseSync(): typeof DatabaseSync {
    const getBuiltin = (process as any).getBuiltinModule
    const mod = typeof getBuiltin === 'function' ? getBuiltin('node:sqlite') : undefined
    if (mod?.DatabaseSync) return mod.DatabaseSync
    throw new Error(`[app] node:sqlite unavailable on Node ${process.version}. Requires Node >= 22.5.`)
}

function open(): DbWrap {
    const DB = loadDatabaseSync()
    mkdirSync(path.dirname(config.dbPath), { recursive: true })
    const db = new DB(config.dbPath)
    db.exec('PRAGMA journal_mode = WAL;')   // concurrent readers + one writer, durable
    db.exec('PRAGMA foreign_keys = ON;')
    db.exec('PRAGMA busy_timeout = 5000;')
    migrate(db)
    return { db, stmts: new Map() }
}
function wrap(): DbWrap { return (globalThis.__appDb ??= open()) }
```

The migration runner — **ordered, append-only**. Each entry's `index + 1` is its version. Never reorder or rewrite an applied migration; only append:

```ts
const MIGRATIONS: string[] = [
    `CREATE TABLE app_user (
        github_id INTEGER PRIMARY KEY, login TEXT NOT NULL, name TEXT NOT NULL,
        avatar_url TEXT, role TEXT NOT NULL, added_at TEXT NOT NULL
    );
    CREATE TABLE audit (
        id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL,
        github_id INTEGER, login TEXT, action TEXT NOT NULL, detail TEXT
    );`,
    // v2 — additive change. Use ALTER TABLE ... ADD COLUMN; nullable or DEFAULT so existing rows survive.
    `ALTER TABLE app_user ADD COLUMN suspended INTEGER NOT NULL DEFAULT 0;`,
]

function migrate(db: DatabaseSync): void {
    db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, applied_at TEXT NOT NULL);`)
    const applied = new Set((db.prepare('SELECT version FROM schema_migrations').all() as any[]).map((r) => r.version))
    const insert = db.prepare('INSERT INTO schema_migrations (version, applied_at) VALUES (?, ?)')
    // FKs toggle OUTSIDE any transaction (the pragma is a no-op inside one). Off for the whole
    // run so table-REBUILD migrations (CREATE new → copy → DROP old → RENAME) don't trip references.
    db.exec('PRAGMA foreign_keys = OFF;')
    try {
        for (let i = 0; i < MIGRATIONS.length; i++) {
            const version = i + 1
            if (applied.has(version)) continue
            db.exec('BEGIN')
            try { db.exec(MIGRATIONS[i]); insert.run(version, new Date().toISOString()); db.exec('COMMIT') }
            catch (err) { db.exec('ROLLBACK'); throw err }
        }
    } finally { db.exec('PRAGMA foreign_keys = ON;') }
}
```

The only surface repositories use:

```ts
export function prep(sql: string): StatementSync {            // prepare once, cache by SQL text
    const w = wrap(); let s = w.stmts.get(sql)
    if (!s) { s = w.db.prepare(sql); w.stmts.set(sql, s) }
    return s
}
export function getRow<T>(sql: string, ...p: any[]): T | undefined { return prep(sql).get(...p) as T | undefined }
export function allRows<T>(sql: string, ...p: any[]): T[]            { return prep(sql).all(...p) as T[] }
export function exec(sql: string): void                             { wrap().db.exec(sql) }
let txDepth = 0
export function tx<T>(fn: () => T): T {                              // reentrant — DatabaseSync has no nested
    const { db } = wrap()                                            // transactions, so an inner tx() joins the
    if (txDepth > 0) return fn()                                     // outer one; only the outermost owns BEGIN/COMMIT
    txDepth++; db.exec('BEGIN')
    try { const r = fn(); db.exec('COMMIT'); return r }
    catch (e) { db.exec('ROLLBACK'); throw e }
    finally { txDepth-- }
}
export function initDb(): void { wrap() }                            // eager open (called from instrumentation)
```

Rules:

- **All schema is migrations.** Adding a table or column = a new `MIGRATIONS[]` entry, never an edit to an existing one. Additive changes (`ADD COLUMN` nullable or with `DEFAULT`) so a running instance upgrades without data loss.
- **Non-additive changes are rebuild migrations.** SQLite can't alter constraints/PKs in place — one migration entry does `CREATE TABLE <x>_new … ; INSERT INTO <x>_new SELECT … FROM <x>; DROP TABLE <x>; ALTER TABLE <x>_new RENAME TO <x>;` (the FK-off window above makes this safe).
- **`getRow<T>` / `allRows<T>` centralize the cast** from `node:sqlite`'s `Record<string, SQLOutputValue>` to the caller's row shape. Repos stay free of `as unknown as` noise.
- **Always parameterize** (`?` placeholders + bound args). Never interpolate values into SQL.
- Timestamps are ISO-8601 strings (`new Date().toISOString()`) in `TEXT` columns. SQLite has no native date type; string ISO sorts lexically.

### Repositories — `server/data/repositories/<area>-repo.ts`

One file per table (or tight cluster). A `Raw` interface mirrors the snake_case DB columns; a `map()` converts to the camelCase domain type. Named function exports, no class:

```ts
import 'server-only'
import { prep, getRow, allRows } from '@/server/data/db'
import type { Site } from '@/server/domain/types'

interface Raw { id: string; owner_id: number; hostname: string; status: string; created_at: string }
function map(r: Raw): Site {
    return { id: r.id, ownerId: r.owner_id, hostname: r.hostname, status: r.status as Site['status'], createdAt: r.created_at }
}

export function create(s: Site): void {
    prep(`INSERT INTO site (id, owner_id, hostname, status, created_at) VALUES (?, ?, ?, ?, ?)`)
        .run(s.id, s.ownerId, s.hostname, s.status, s.createdAt)
}
export function byId(id: string): Site | undefined {
    const r = getRow<Raw>(`SELECT * FROM site WHERE id = ?`, id); return r ? map(r) : undefined
}
export function listByOwner(ownerId: number): Site[] {
    return allRows<Raw>(`SELECT * FROM site WHERE owner_id = ? ORDER BY created_at DESC`, ownerId).map(map)
}
```

- The `Raw → map()` boundary is mandatory: SQL speaks snake_case, the rest of the app speaks camelCase. The mapping lives here and nowhere else.
- Repositories contain **only** SQL + mapping. No business rules, no validation, no orchestration — those live in `domain/` and `services/`.
- An optional `repositories/index.ts` documents the layer + the `server-only` convention; import repos directly (`import * as siteRepo from '@/server/data/repositories/site-repo'`).

---

## Domain Layer — `server/domain/`

Pure, synchronous, I/O-free logic + shared types. This is the **only** layer with unit tests (which live in `test/` — see Testing below).

- `types.ts` — every shared type + constant (`Role`, `ROLE_RANK`, `SessionPayload`, `MeResponse`, entity shapes, enums). **It must not import anything server-only** (no `fs`, no `child_process`, no `node:*`) — it is imported from both server and client code. This is the contract between the two halves.
- Other files (`quota.ts`, `hostname.ts`, `cron.ts`, `deploy-machine.ts`, `resource-state.ts`, `config-resolution.ts`, …) hold pure decisions: validation, state-machine transitions, diffing, derived values. Given inputs, return outputs — no DB, no network, no clock-reading beyond a passed-in `now`.
- If a function is hard to test because it does I/O, it belongs in a service, not the domain.
- A domain file that is **also imported client-side** (e.g. a validator shared with a form editor) must use only isomorphic APIs — `TextEncoder` for byte-length caps, never `Buffer`.

```ts
// server/domain/types.ts
export type Role = 'owner' | 'maintainer' | 'standard' | 'guest'   // or 3-tier: 'admin' | 'standard' | 'guest'
export const ROLE_RANK: Record<Role, number> = { guest: 0, standard: 1, maintainer: 2, owner: 3 }
// 'guest' is a runtime fallback for an unresolvable role — never stored, never assignable.

export interface SessionPayload { sub: number; login: string; role: Role; iat: number; exp: number }
export interface MeResponse { githubId: number; login: string; name: string; avatarUrl?: string; role: Role }
```

### Testing — root vitest, `<app>/test/`

The app has **no vitest dependency, config, or `test` script** — the repo-root `vitest.config.ts` discovers `**/*.test.ts` across all workspaces and supplies two aliases that make server modules loadable under plain Node:

```ts
resolve: { alias: [
    { find: /^@\//, replacement: fileURLToPath(new URL('./<app>/', import.meta.url)) },   // the app's @/* paths
    // `server-only` throws outside a Next bundler; its own no-op `empty.js` lets server modules unit-test under Node.
    { find: /^server-only$/, replacement: fileURLToPath(new URL('./node_modules/server-only/empty.js', import.meta.url)) },
]},
test: { include: ['**/*.test.ts'], exclude: ['**/node_modules/**', '**/dist/**', '**/lib/**'], environment: 'node' },
```

- **Unit tests** (`test/<thing>.test.ts`) exercise `domain/` pure functions directly.
- **Integration tests** (`test/<flow>.integration.test.ts`) boot the real stack: set every required env var **before importing anything** (`config` reads env at import time), point the DB path at a temp file, then dynamic-`import()` and run real migrations against real `node:sqlite`:

```ts
process.env.APP_DB_PATH = path.join(mkdtempSync(path.join(tmpdir(), 'app-test-')), 'test.db')
process.env.APP_AUTH_SECRET = 'x'.repeat(32)            // …every required var, minLen-compliant
const db = await import('@/server/data/db'); db.initDb() // real migrations, real SQLite
const { runJob } = await import('@/server/services/jobs')
```

---

## Infrastructure Layer — `server/infrastructure/`

Adapters to the outside world, one file per external system. Each wraps its I/O behind typed functions and throws **typed errors** the service/route layer can branch on:

- `github.ts` — GitHub REST/GraphQL calls (`fetch`, `cache: 'no-store'`).
- `git.ts`, `agent.ts` — child-process spawns with timeouts; `GitError { stderr }` etc.
- `slack.ts`, `notify.ts` — outbound webhooks.
- `server-log.ts` — an in-memory ring buffer for the health/log surface.
- `fs-workspace.ts` — guarded filesystem ops; `UnsafePathError` for path-traversal attempts.
- `cipher.ts` — the AES-256-GCM secret-at-rest keyring (below).
- `ids.ts` — prefixed random IDs (below).

Rules: infra never imports services (no upward calls); it never touches the DB (that's repositories); it owns timeouts, retries, and the typed-error vocabulary for its system. A hung external call must not be able to wedge a request forever — give every spawn/fetch a deadline.

### `cipher.ts` — secret-at-rest keyring (AES-256-GCM)

Anything secret that must round-trip (third-party admin tokens, DB passwords, a user's OAuth token) is stored encrypted, never plaintext. Ciphertext format: `v<keyId>.<b64url iv>.<b64url ciphertext>.<b64url tag>` — 12-byte random IV, and `keyId` = first 8 hex of `sha256(secret)` stamps which ring key sealed it:

```ts
function keyring(): string[] {
    // Dedicated key + previous key (rotation window) when set; else derive one from AUTH_SECRET.
    if (config.secretKey) return [config.secretKey, config.secretKeyPrev].filter(Boolean) as string[]
    const derived = crypto.hkdfSync('sha256', Buffer.from(config.authSecret, 'utf8'),
        Buffer.alloc(0), Buffer.from('<app>-secrets-v1', 'utf8'), 32)
    return [Buffer.from(derived).toString('hex')]
}
// encrypt() always seals with ring[0]; decrypt() selects the ring key matching the v<keyId> stamp.
// AES key = sha256(ring entry) → always 32 bytes regardless of the secret string's length.
```

Rotation: set `<APP>_SECRET_KEY` to the new key and `<APP>_SECRET_KEY_PREV` to the old — existing ciphertext still decrypts, new writes re-seal with the new key. DTOs never expose the value; mask to `hasToken: boolean`.

### `ids.ts` — prefixed random IDs

```ts
export const ID = { site: 'site', job: 'job', run: 'run', secret: 'sec', instance: 'inst' } as const
const ALPHABET = '0123456789abcdefghijklmnopqrstuvwxyz'
export function newId(prefix: string): string {
    const bytes = crypto.randomBytes(11); let out = ''
    for (const b of bytes) out += ALPHABET[b % ALPHABET.length]
    return `${prefix}_${out}`          // self-describing: 'job_x8k2m…' reads in logs, audit rows, URLs
}
```

**One scheme per app** — register every entity's prefix on the `ID` object; don't grow a second unprefixed generator alongside it.

### Typed external-API client — factory over a connection

When the app drives a downstream daemon/REST API, wrap it in a **factory** that closes over the connection, so the same typed surface targets whichever tenant/realm the caller resolved:

```ts
export class DaemonError extends Error {
    constructor(msg: string, public status?: number, public detail?: string) { super(msg) }
}
export function daemonClient(conn: { baseUrl: string; token?: string }) {
    const authHeaders = () => (conn.token ? { Authorization: `Bearer ${conn.token}` } : {})
    async function adminFetch(method: string, apiPath: string, init: RequestInit = {}): Promise<Response> {
        try {
            return await fetch(new URL(apiPath, conn.baseUrl), { ...init, method, cache: 'no-store',
                headers: { ...authHeaders(), ...(init.headers ?? {}) }, signal: AbortSignal.timeout(15_000) })
        } catch (err) {
            const timedOut = err instanceof DOMException && err.name === 'TimeoutError'
            throw new DaemonError(timedOut ? 'daemon timed out' : 'daemon unreachable', timedOut ? 504 : 502)
        }
    }
    async function adminOk(method: string, apiPath: string, init: RequestInit = {}): Promise<Response> {
        const res = await adminFetch(method, apiPath, init)
        if (!res.ok) throw new DaemonError(`${method} ${apiPath} failed (${res.status})`, res.status,
            (await res.text().catch(() => '')).trim() || undefined)   // forward the daemon's body to operators
        return res
    }
    return { status: () => adminOk('GET', '/status').then((r) => r.json()) /* …one method per endpoint… */ }
}
export type DaemonClient = ReturnType<typeof daemonClient>
```

- Timeout → 504, transport error → 502, non-2xx → typed error carrying the daemon's `detail`. Long-running ops (cert issuance, builds) get their own larger timeout constant.
- `DELETE` treats the target's 404 as idempotent success.
- If the daemon serves an OpenAPI schema, add `scripts/generate-<daemon>-types.mjs` (fetch `GET /schema` → `npx openapi-typescript` → a checked-in `.d.ts`) behind a `typegen:<daemon>` npm script.

### Machine credentials — store the hash, never the key

Non-cookie callers (agents, CI, sidecars) authenticate with a minted fetch key. Mint once, show once, store only the hash:

```ts
const rawKey = crypto.randomBytes(32).toString('base64url')           // returned to the operator ONCE
repo.setKeyHash(id, crypto.createHash('sha256').update(rawKey).digest('hex'))
// Verify: hash the presented key, constant-time compare.
const a = Buffer.from(sha256Hex(presented)), b = Buffer.from(row.keyHash)
if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return { ok: false, status: 401 }
```

---

## Services Layer — `server/services/`

Orchestration + policy. A service is the sole caller of the repositories beneath it; it composes `domain/` decisions with `data/` persistence and `infrastructure/` I/O. Import directly: `import * as sites from '@/server/services/sites'`. An optional `services/index.ts` is a **doc-only layer marker** — `import 'server-only'` + `export {}` + a comment block naming each service and its responsibility; never a barrel.

Every service shares one error contract: typed error(s) carrying `{ code, status }` plus an `httpErrorFor(err)` mapper, so a route's `catch` is one line:

```ts
export class SiteError extends Error {
    constructor(public code: string, public status: number, msg?: string) { super(msg ?? code) }
}
export function httpErrorFor(err: unknown): { status: number; code: string } {
    if (err instanceof SiteError) return { status: err.status, code: err.code }
    if (err instanceof DaemonError) return { status: err.status === 504 ? 504 : 502, code: 'daemon_unreachable' }
    return { status: 500, code: 'internal' }
}
```

**Audit seam — pick ONE per app:** in the route after the service call (taskforge style, via `web/http.ts`'s `audit()`), or inside the service next to the mutation it describes (quaykeeper style, a local helper over `auditRepo.append`). Either way it is best-effort and never blocks the mutation.

Two services exist in every app:

### `auth.ts` — GitHub OAuth + HMAC session cookie

```ts
import 'server-only'
import crypto from 'node:crypto'
import { cookies } from 'next/headers'
import { config } from '@/server/config'
import { ROLE_RANK, type Role, type SessionPayload } from '@/server/domain/types'

export const SESSION_COOKIE = 'app_session'
export const STATE_COOKIE = 'app_oauth_state'

const b64url = (i: Buffer | string) => Buffer.from(i).toString('base64url')
const hmac = (d: string) => crypto.createHmac('sha256', config.authSecret).update(d).digest('base64url')

function signToken(obj: unknown): string { const p = b64url(JSON.stringify(obj)); return `${p}.${hmac(p)}` }
function verifyToken<T>(token: string | undefined): T | null {
    if (!token) return null
    const dot = token.lastIndexOf('.'); if (dot <= 0) return null
    const payload = token.slice(0, dot), sig = token.slice(dot + 1)
    const a = Buffer.from(sig), b = Buffer.from(hmac(payload))
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null   // constant-time compare
    try { return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as T } catch { return null }
}

export async function getSession(): Promise<SessionPayload | null> {
    const p = verifyToken<SessionPayload>((await cookies()).get(SESSION_COOKIE)?.value)
    if (!p || typeof p.exp !== 'number' || p.exp * 1000 < Date.now()) return null   // verify expiry too
    return p
}

// The per-request authorization guard. Re-reads the role from the AUTHORITATIVE source
// (DB app_user.role or a roles.json file) so promotions/demotions take effect without re-login.
export type AuthzResult = { ok: true; session: SessionPayload; role: Role } | { ok: false; status: 401 | 403 }
export async function authorize(minRole: Role): Promise<AuthzResult> {
    const session = await getSession()
    if (!session) return { ok: false, status: 401 }
    const role = (await getRole(session.sub)) ?? 'guest'
    if (ROLE_RANK[role] < ROLE_RANK[minRole]) return { ok: false, status: 403 }
    return { ok: true, session, role }
}
```

Cookie + OAuth contract:

- Token = `<base64url(JSON payload)>.<base64url(HMAC-SHA256(payload, AUTH_SECRET))>`. Verify with `crypto.timingSafeEqual`. Check `exp` on every read.
- `httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure: true` in production, `maxAge = sessionTtl`. A separate short-lived (`maxAge: 600`) HMAC state cookie guards the OAuth callback against CSRF — and the state token is **single-use**: a consumed-nonce set on `globalThis` (self-sweeping) rejects replays within the TTL.
- OAuth code flow: `buildAuthorizeUrl(state)` → GitHub → `/api/auth/github/callback` exchanges the code (`exchangeCodeForToken`), fetches the profile (`fetchGithubProfile`), runs the optional allow-list / org-membership gate (`checkAllowlist`), resolves the role, sets the session cookie. The GitHub access token **never enters the session payload**. If a later flow genuinely needs it (private-repo access), seal it with the cipher keyring into its own table (`user_github_token`) and decrypt server-side per use — never plaintext, never client-visible.
- **First-login bootstrap** — the first user ever becomes the top role, decided inside `tx()` so two concurrent first logins can't both win:

```ts
const role: Role = tx(() => {
    const r: Role = userRepo.ownerCount() === 0 ? 'owner' : 'standard'
    userRepo.upsert({ ...profile, role: r }); return r
})
```

- **Role is re-read per request from the authoritative source**, not trusted from the cookie payload (which is an advisory hint). The authoritative source is either the `app_user.role` DB column (quaykeeper style — fold role resolution into `auth.ts`) or a `roles.json` file read by a separate `services/roles.ts` (taskforge style). Either way: change a role, it applies on the next request without re-login.

### `roles.ts` (optional) — authoritative role source

When roles live in a file rather than the DB, this service reads/writes `roles.json` and exposes `getRole(githubId)` + an owner-bootstrap rule (first login becomes owner/admin). When roles live in the DB, fold `getRole` into `auth.ts` and drop this file.

Other services are app-specific (`sites.ts`, `deploy.ts`, `quota.ts`, `projects.ts`, `scheduler.ts`, `execution-manager.ts`, …). Each: guards nothing (the route already authorized), validates via `domain/`, persists via repositories, drives I/O via `infrastructure/`, and exposes a small typed surface + a domain-error → HTTP mapping helper where useful.

---

## Web Layer — `server/web/`

The thin seam between route handlers and services. Three files:

### `http.ts` — route helpers

```ts
import 'server-only'
import { NextResponse } from 'next/server'
import { authorize, type AuthzResult } from '@/server/services/auth'
import * as auditRepo from '@/server/data/repositories/audit-repo'
import type { Role } from '@/server/domain/types'

export function json(data: unknown, status = 200) { return NextResponse.json(data, { status }) }
export function error(message: string, status: number) { return NextResponse.json({ error: message }, { status }) }

// Guard a route by minimum role. Returns the authorized result, or a ready-to-return 401/403.
export async function guard(minRole: Role): Promise<{ res: NextResponse } | Extract<AuthzResult, { ok: true }>> {
    const r = await authorize(minRole)
    if (!r.ok) return { res: error(r.status === 401 ? 'unauthorized' : 'forbidden', r.status) }
    return r
}

// Record who did what — best-effort; an audit failure never blocks the mutation it describes.
export function audit(auth: Extract<AuthzResult, { ok: true }>, action: string, detail?: string | null): void {
    try { auditRepo.append({ githubId: auth.session.sub, login: auth.session.login, action, detail }) } catch {}
}
```

### `page-guards.ts` — server-component guards

```ts
import 'server-only'
import { redirect } from 'next/navigation'
import { getSession } from '@/server/services/auth'
import { getUser } from '@/server/services/roles'
import { ROLE_RANK, type MeResponse, type Role } from '@/server/domain/types'

export async function requireSession(): Promise<MeResponse> {
    const session = await getSession()
    if (!session) redirect('/login')
    const user = await getUser(session.sub)
    return { githubId: session.sub, login: user?.login ?? session.login, name: user?.name ?? session.login, avatarUrl: user?.avatarUrl, role: user?.role ?? 'guest' }
}
export async function requireRole(minRole: Role): Promise<MeResponse> {
    const me = await requireSession()
    if (ROLE_RANK[me.role] < ROLE_RANK[minRole]) redirect(me.role === 'guest' ? '/no-access' : '/')
    return me
}
```

### `sse.ts` — Server-Sent Events (only if you stream live state)

A `ReadableStream` that (1) sends a snapshot, (2) replays a ring buffer tagged `replay: true` so late subscribers rebuild scrollback without re-firing toasts, (3) subscribes to a live event emitter, (4) sends a `: ping` heartbeat every ~25 s, and (5) tears down on `cancel()`. Response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache, no-transform`, `X-Accel-Buffering: no`.

> **Inline variant (quaykeeper):** no `server/web/` directory — every route inlines the same three steps and stays ~15 lines:
>
> ```ts
> const authz = await authorize('standard')
> if (!authz.ok) return NextResponse.json({ error: 'unauthorized' }, { status: authz.status })
> let body: unknown
> try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }) }
> try { return NextResponse.json(await svc.createSite(actor, body)) }
> catch (err) { const { status, code } = svc.httpErrorFor(err); return NextResponse.json({ error: code }, { status }) }
> ```
>
> Audit happens **inside the service** in this variant. taskforge instead factors `guard`/`json`/`error`/`audit` into `web/http.ts`. Both are valid — pick one and keep every route identical to its siblings.

---

## API Routes — `app/api/<area>/route.ts`

Every route handler follows the same contract: **declare runtime → guard → parse → validate → call service → audit → respond**, with domain errors mapped to HTTP status.

```ts
import { guard, json, error, audit } from '@/server/web/http'
import { getProjectSummaries } from '@/server/services/projects'
import { createProject, ProjectExistsError } from '@/server/services/provision'
import { GitError } from '@/server/infrastructure/git'

export const runtime = 'nodejs'            // node:sqlite + node:crypto need the Node runtime, not Edge
export const dynamic = 'force-dynamic'     // never statically cache an authed, DB-backed response
export const maxDuration = 300             // only when an operation legitimately runs long (clone, build)

export async function GET() {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res
    return json(await getProjectSummaries())
}

export async function POST(req: Request) {
    const auth = await guard('standard')
    if ('res' in auth) return auth.res

    const body = (await req.json().catch(() => ({}))) as { name?: string; gitUrl?: string }
    const name = (body.name ?? '').trim()
    if (!name) return error('name required', 400)

    try {
        await createProject({ name, gitUrl: body.gitUrl })
        audit(auth, 'project.create', name)
        return json({ name }, 201)
    } catch (e) {
        if (e instanceof ProjectExistsError) return error('project already exists', 409)
        if (e instanceof GitError) return error(`clone failed: ${e.message}`, 422)
        throw e                            // unknown → let Next return 500
    }
}
```

Rules:

- `export const runtime = 'nodejs'` and `export const dynamic = 'force-dynamic'` on **every** route that touches the DB or session. The default Edge runtime has no `node:sqlite`/`node:crypto`; the default caching would serve one user's authed response to another.
- **Guard first, before reading the body.** `const auth = await guard(minRole); if ('res' in auth) return auth.res`. (Direct-`authorize` variant: `const authz = await authorize(minRole); if (!authz.ok) return error(...)`.)
- Parse the body defensively: `await req.json().catch(() => ({}))`, then validate each field → `error(msg, 400)`. Never trust shape.
- Push all real work into a service. The route is glue: it authorizes, validates, delegates, audits, and shapes the response.
- Map known domain/infra errors to status codes (`409` conflict, `422` unprocessable, `404` not found, `400` bad input); re-throw the unknown so Next returns 500. At scale, replace per-route `instanceof` chains with the service's `httpErrorFor(err)` mapper — one `catch` line per route.
- `audit(auth, 'verb.noun', detail)` after every mutation. Audit is best-effort and never blocks the mutation.
- Dynamic segments: `{ params }: { params: Promise<{ id: string }> }` — `params` is a **Promise** in Next 15+; `await` it.

---

## Pages — `app/<feature>/page.tsx`

Pages are thin **server components**. They declare runtime, optionally guard + fetch, then delegate all rendering to a `'use client'` component. The UI is client-only because `tc-*` elements register in the browser.

```tsx
import { OverviewClient } from '@/components/project/OverviewClient'
import type { Metadata } from 'next'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function generateMetadata(ctx: { params: Promise<{ project: string }> }): Promise<Metadata> {
    return { title: (await ctx.params).project }
}

export default function RepoOverviewPage() {
    return <OverviewClient />
}
```

For a guarded, server-data page, call `requireRole()`/`requireSession()` (which `redirect()` on failure) and pass the result down:

```tsx
export default async function UsersPage() {
    const me = await requireRole('admin')          // redirects guests/standard before any render
    return <AppShell me={me}><UsersClient /></AppShell>
}
```

- `root layout.tsx` imports the web-components stylesheet + JSX typings + globals, sets `metadata` (title template), and wraps children in `<Providers>`.
- Per-page `generateMetadata` is async and `await`s `params`.

### Two page-guard models — pick one

- **Server page-guards (taskforge):** every page RSC calls `requireSession()`/`requireRole()`, which `redirect()` before the client tree mounts. Best when pages render server data.
- **Client AuthGate (quaykeeper):** authenticated pages are unguarded RSC shells rendering `<AuthGate><FeatureClient/></AuthGate>`. `AuthGate` fetches `GET /api/me` once via the typed fetcher, shows loading / error+retry, bounces `isAuthError` to `/login`, then mounts the whole authenticated tree: `<MeProvider me={me}><ToastProvider><AppShell>…`. Every descendant reads `useMe()` from context instead of re-fetching. Per-area hooks additionally `router.replace('/')` for under-ranked roles.

Either way the **security boundary is `authorize()` in every `/api` route** — page redirects and client gates are UX only, and the code should say so in a comment. One server-side guard stays mandatory in the AuthGate model: `/login` must bounce already-authed users using the **same** gate `/api/me` uses (`if ((await authorize('standard')).ok) redirect('/')`), otherwise an unprovisioned `guest` session ping-pongs between `/login` and `/`.

---

## Frontend — `app/providers.tsx`, `lib/tc.ts`, `components/`

### Providers — register web-components client-side only

```tsx
'use client'
import { useEffect, useState, type ReactNode } from 'react'

export function Providers({ children }: { children: ReactNode }) {
    const [registered, setRegistered] = useState(false)
    useEffect(() => {
        let active = true
        void import('@toolcase/web-components').then((m) => { if (active) { m.register(); setRegistered(true) } })
        return () => { active = false }
    }, [])
    if (!registered) return null     // gate children until elements are defined — see note
    return <>{children}</>
}
```

Why dynamic + gated: a static `import '@toolcase/web-components'` evaluates `class … extends HTMLElement` during SSR/prerender where `HTMLElement` is undefined. Importing inside `useEffect` defers it to the browser. **Gating children behind `registered`** removes a race: React sets JS *properties* on `tc-*` elements at attach time (via `lib/tc.ts`); if the element isn't upgraded yet, those land as own data properties that later *shadow* the class's prototype setters — the component renders empty on a hard refresh. Return `null` until registered (matches the server's `null`, so no hydration mismatch).

### `lib/tc.ts` — React ↔ web-components interop (copy verbatim)

React 18/19 through JSX can't set object/array values as DOM **properties** (it stringifies to attributes) and can't subscribe to **CustomEvents**. `tc-*` needs both. `useTc(props, handlers)` returns a **callback ref** you attach to the element:

```tsx
const ref = useTcProps<HTMLElement>({ sections, onItemClick })   // object props applied as element properties
const ref2 = useTcEvents<HTMLElement>({ 'tc-change': (e) => setValue(detailValue(e)) })   // CustomEvent listeners
return <tc-side-nav ref={ref} />
```

- A **callback ref** (not `useRef`) is essential: it fires on attach (with the node) and detach (with `null`), so it works for elements that mount *after* first render (conditional JSX) and pairs correctly under StrictMode's dev remount.
- `useMemo` array/object prop values at the call site so identity changes only when data does (the hook re-applies props when their values change).
- Helpers: `escapeHtml(v)` (for `tc-table` `render` cells, which return HTML strings — escape user data), `targetValue(e)`, `targetChecked(e)`, `detailValue(e)` (reads `detail.value` off a `tc-change`).

### `components/` — the shared UI kit

`'use client'` everywhere. Naming: `AppShell.tsx` (the chrome), `<Feature>Client.tsx` per page, per-area subdirs. A small kit of generic wrappers keeps feature code declarative — copy these into any new app:

- `DataTable.tsx` — wraps `tc-table` (columns + rows set as element **properties**; relocation-safe). Row actions render as HTML strings inside a column `render(row)` (escape user data with `escapeHtml`); clicks route through ONE delegated host listener — `closest('[data-action]')` → `onAction(action, el.dataset, event)` — bound for both `click` **and** `change` so `<select>`s in cells work too. The same delegation idiom drives `tc-advanced-table` when rows are an injected escaped-HTML string.
- `FormModal.tsx` — wraps `tc-modal` (`title/busy/submitLabel/onSubmit/onClose`, optional `secondary`). **Remount per open, keyed on the edit target** (`key={editing?.id ?? 'new'}`) — tc-modal captures children at connect. A hidden submit button makes Enter submit; `busy` sets `static-backdrop`; every close path (X/Esc/backdrop) lands in `onClose` via `tc-hidden`.
- `ConfirmDialog.tsx` — declarative `open` prop; never self-closes — the caller flips state on `tc-confirm`/`tc-cancel`. For destructive deletes, a `TypeToConfirmModal` (type the resource name to arm the button) built on FormModal.
- `Toast.tsx` — context provider + `useToast().show(message, { variant, title })`; returns a **no-op outside the provider**; renders a fixed stack of `tc-toast` (autohide), each removing itself from state on `tc-hidden`.
- `fields.tsx` — `TextField`/`TextAreaField`/`SelectField`/`CheckField`/`SwitchField` over the tc inputs; controlled `value`/`onValue` (or `checked`/`onChecked`); shared `state`/`error`/`help` validation props. `SelectField` keys on the joined option values so a changed option set forces a clean remount (tc-select snapshots its `<option>` children at connect).
- `states.tsx` — `LoadingState` (skeleton silhouettes by `shape`), `ErrorState` (banner + in-place Retry; pair with `describeApiError`), `EmptyState` (icon + title + CTA). Every data view renders exactly one of these or its content — never a bare "Loading…".
- `SubTabBar.tsx` — `tc-tab-bar` over route hrefs; active tab = **longest href prefix** of `pathname` (so `/admin/users` beats `/admin`); click = `router.push`.
- `CommandPalette.tsx` — `tc-command-palette` toggled by a window `keydown` (⌘K/Ctrl-K); items = a role-gated navigation list mirroring the side nav; `tc-select` reads `detail.item` and pushes the route.
- `lib/action-icons.tsx` — one `ACTION_ICONS` map (semantic name → lucide-static SVG string, size-stripped so CSS owns sizing) with two render forms: `iconBtnHtml({ icon, label, data, danger })` (escaped HTML string for injected table cells, carries `data-*` for delegation) and `<IconBtn/>` (JSX). Add icons to the map — never inline a raw SVG.
- `lib/fetcher.ts` — a typed `apiFetch<T>(url, opts)` with an `AbortController` timeout (default 10 s), a small `ApiErrorKind` union (`unauthorized | forbidden | notfound | server | timeout | network | parse`), an `ApiError` class, `describeApiError()` for user copy, and `isAuthError()` to decide a `/login` bounce. **One fetch stack per app** — quaykeeper drifted into a second result-object `callApi` helper alongside the throwing `apiFetch`; wrap one over the other, don't fork.
- `lib/me-context.tsx` — `MeProvider({ me })` + `useMe()` (throws outside the provider). AuthGate fetches `/api/me` once; AppShell, CommandPalette, and every gate hook read from context.

### `AppShell` — the chrome

Composes `tc-dashboard-layout` via named slots (`brand`, `sidebar-menu`, `sidebar-panel`) + a skip-link + `<CommandPalette/>`. Nav is **data**: `sections: SideNavSection[]` built in `useMemo` from `ROLE_RANK[me.role]` — base section always, higher-rank sections `push()`ed by rank, admin section owner-only. Active item derives per-item from `usePathname()`; clicks stay client-side (`event.preventDefault(); router.push(item.href)`). Sign-out = `POST /api/auth/logout` → `router.push('/login')`, wired to the user-panel's trailing icon. Wrap the brand slot content in a plain `<div slot="brand">` — the layout relocates it once at connect, so its contents must be stable.

### Per-area `shared.tsx` + the gate hook

Each feature area gets a `shared.tsx` holding (1) a role-gate data hook and (2) a page frame. Write the hook **once**, parameterized by `minRole` — don't fork a copy per role:

```tsx
export function useAreaData<T>(fetcher: () => Promise<T | null>, minRole: Role = 'maintainer') {
    const me = useMe(); const router = useRouter()
    const [state, setState] = useState<{ phase: 'loading' | 'forbidden' | 'error' | 'ready'; data?: T }>({ phase: 'loading' })
    useEffect(() => {
        if (ROLE_RANK[me.role] < ROLE_RANK[minRole]) { setState({ phase: 'forbidden' }); router.replace('/'); return }
        let cancelled = false
        void fetcher().then((data) => { if (!cancelled) setState(data ? { phase: 'ready', data } : { phase: 'error' }) })
        return () => { cancelled = true }
    }, [me.role, router])   // fetcher deliberately omitted — callers pass a useCallback-stable fetcher
    return state
}
```

The page frame (`<AreaPage title=… state=…>`) renders `tc-rich-page-header` + the phase switch (`LoadingState`/`ErrorState`/children). A feature client then reduces to: stable `useCallback` fetcher → gate hook → frame → table + modals, with `reload()` + `toast.show()` after every mutation. This gate is a **UX nicety, not the security boundary** — the API routes authorize independently.

### Detail pages with tab sub-routes

No nested `layout.tsx`. Each tab is its own `page.tsx` — an RSC that awaits `params` and renders the SAME client shell with a literal `tab` prop:

```tsx
export default async function DbServerUsersPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params
    return <AuthGate><DbServerDetail serverId={id} tab="users" /></AuthGate>
}
```

The shell fetches the parent resource, renders header + back link + `<SubTabBar tabs={…}/>`, then switches `{tab === 'users' && <UsersTab server={server}/>}`. The bare `[id]/page.tsx` just `redirect()`s to the default tab. Tab navigation remounts the shell (re-fetches the parent) — acceptable for a control panel; each tab owns its own live reads.

### Branding / theming — `lib/branding-context.tsx`

`BrandingProvider` fetches the **public** `GET /api/settings` once (initial state = `DEFAULT_SETTINGS` from pure `domain/settings.ts`, so no flash), exposes `useBranding()` + `refresh()` (the admin settings page calls `refresh()` after save for a live re-skin). Theme applies as `data-tc-theme` / `data-tc-variant` attributes on `document.documentElement`; the `default` theme **removes** the attribute (it's the bare `:root` voice). Source of truth is server settings, not localStorage. **Provider order matters:** `BrandingProvider` wraps `Providers` (the register gate) in `layout.tsx`, so theme attributes exist before elements upgrade; `MeProvider`/`ToastProvider` live inside AuthGate.

---

## Config — `server/config.ts`

One validated, fail-fast config object. Reads `process.env` once at first import. Copy the helper set verbatim:

```ts
import 'server-only'

function required(name: string): string {
    const v = process.env[name]
    if (!v || !v.trim()) {
        if (process.env.NEXT_PHASE === 'phase-production-build') return ''   // env absent during build tracing
        throw new Error(`[app] Missing required env var: ${name}. See .env.example.`)
    }
    return v
}
function requiredSecret(name: string, minLen: number): string {
    const v = required(name)
    if (v && v.length < minLen) throw new Error(`[app] ${name} must be >= ${minLen} chars. e.g. \`openssl rand -hex 32\``)
    return v
}
const optional = (name: string, fb: string) => process.env[name]?.trim() || fb
const num = (name: string, fb: number) => { const r = process.env[name]; const n = Number(r); return r && Number.isFinite(n) ? n : fb }
const bool = (name: string, fb: boolean) => { const r = process.env[name]; return r ? r === '1' || r.toLowerCase() === 'true' : fb }
const csv = (name: string) => (process.env[name] ?? '').split(',').map((s) => s.trim()).filter(Boolean)

export const config = {
    githubClientId: required('GITHUB_CLIENT_ID'),
    githubClientSecret: required('GITHUB_CLIENT_SECRET'),
    oauthRedirectUri: required('OAUTH_REDIRECT_URI'),
    authSecret: requiredSecret('AUTH_SECRET', 16),
    sessionTtl: num('SESSION_TTL', 86400),
    allowedLogins: csv('GITHUB_ALLOWED_LOGINS'),    // empty = open
    allowedOrg: optional('GITHUB_ALLOWED_ORG', ''),
    // Public origin the browser actually talks to. Behind a proxy, req.url carries the
    // internal listen host — derive from the (trusted) redirect URI to avoid leaking it.
    get publicOrigin(): string {
        const e = process.env.PUBLIC_ORIGIN?.trim()
        if (e) return e.replace(/\/+$/, '')
        try { return new URL(this.oauthRedirectUri).origin } catch { return '' }
    },
    get dbPath() { return process.env.DB_PATH?.trim() || `${optional('WORKSPACE_DIR', '/workspace')}/app.db` },
    port: num('PORT', 3000),
}
export type Config = typeof config
```

- **Prefix every app-owned var** with the app's namespace (`QUAYKEEPER_GITHUB_CLIENT_ID`, not `GITHUB_CLIENT_ID`) so several apps can share a host/env file; only shared infra knobs (`PORT`, `DB_PATH`, `WORKSPACE_DIR`) stay bare. The snippet above shows bare names for brevity.
- **Fail-fast**: a missing required var throws at first import — except during `next build` (`NEXT_PHASE === 'phase-production-build'`), where the module graph is traced before env is provided. Defer those failures to runtime boot / first request.
- Secrets get a length floor (`AUTH_SECRET` ≥ 16). `publicOrigin` is a getter that prefers a trusted explicit value, else the redirect URI's origin.
- **Never import `config` (or anything under `server/`) from a client component** — `server-only` will fail the build if you do, which is the point.
- Mirror every var in `.env.example` with a placeholder. `.env.local` is gitignored.

---

## Boot Hooks — `instrumentation.ts`

Runs once per server start. Use it to open the DB, seed idempotently, and launch background tickers, so nothing depends on a page/route being hit first. Guard on the Node runtime and **dynamic-import** the services (keeps them out of the Edge/middleware bundle):

```ts
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return
    const { initDb } = await import('@/server/data/db')
    initDb()                                                    // eager open + migrate
    const { ensureSeed } = await import('@/server/services/realms')
    ensureSeed()                                                // idempotent boot-seed (default rows from env)
    const { ensureQuotaSweepStarted } = await import('@/server/services/quota-sweep')
    const { ensureStatusPollStarted } = await import('@/server/services/status-poll')
    const { ensureJobSchedulerStarted } = await import('@/server/services/job-scheduler')
    ensureQuotaSweepStarted(); ensureStatusPollStarted(); ensureJobSchedulerStarted()
}
```

Enable in `next.config.mjs` with `experimental: { instrumentationHook: true }` if your Next version requires the opt-in (Next 16 doesn't).

### The ticker triad

Every background ticker has the same three-part shape — `globalThis` singleton (survives dev hot-reload), `unref()`d interval (never keeps the process alive), and the tick body exported separately so tests drive it without timers:

```ts
const POLL_INTERVAL_MS = 60_000
declare global { var __appStatusPoll: { timer: ReturnType<typeof setInterval> } | undefined }

export function ensureStatusPollStarted(): void {
    if (globalThis.__appStatusPoll) return
    const timer = setInterval(() => { void pollNow().catch((e) => slog('error', 'poll', String(e))) }, POLL_INTERVAL_MS)
    timer.unref?.()
    globalThis.__appStatusPoll = { timer }
}
export async function pollNow(): Promise<void> { /* the actual work — tests and "run now" call this directly */ }
```

Per-item failures inside a tick are logged and skipped, never allowed to kill the loop. A cron-style scheduler ticks **sub-minute** (30 s, so minute boundaries aren't missed) and dedupes with a minute key so a job fires at most once per matching minute — `const key = Math.floor(now.getTime() / 60000)`, skip when `lastFired.get(job.id) === key` — plus a `globalThis` running-set so a still-running job is skipped, not stacked.

---

## Middleware — `middleware.ts` (optional, thin)

Edge middleware does **presence only** — it checks that the session cookie *exists* and redirects anonymous visitors. The cryptographic verification (HMAC + expiry) and the authoritative role re-read happen in the Node layer (`authorize()` / page-guards), where `crypto` and the DB/`fs` are available.

```ts
import { NextResponse, type NextRequest } from 'next/server'
const SESSION_COOKIE = 'app_session'
const PUBLIC = ['/login', '/api/auth/github']

export function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl
    if (pathname === '/api/health' || PUBLIC.some((p) => pathname === p || pathname.startsWith(p + '/'))) return NextResponse.next()
    if (req.cookies.has(SESSION_COOKIE)) return NextResponse.next()
    if (pathname.startsWith('/api/')) return NextResponse.json({ error: 'unauthorized' }, { status: 401 })
    // Build the login redirect from a TRUSTED origin (PUBLIC_ORIGIN / redirect-URI origin), not
    // attacker-controllable x-forwarded-* headers — otherwise it's an open redirect.
    const base = process.env.PUBLIC_ORIGIN || (process.env.OAUTH_REDIRECT_URI ? new URL(process.env.OAUTH_REDIRECT_URI).origin : req.url)
    return NextResponse.redirect(new URL('/login', base))
}
export const config = { matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)'] }
```

Middleware is an **optimization, never the security boundary** — every authed route and page still calls `authorize()` / `requireRole()`. An app can skip middleware entirely and rely on the Node-layer guards.

---

## Optional Patterns

Proven in quaykeeper; add per-feature, never by default.

### Companion machine-facing listener (`server/agent-server.ts`)

Still **one OS process** — a second, cookieless `node:http` listener on its own port (`<APP>_AGENT_PORT`) carries the machine-facing surface (agent config fetch with ETag/304, client-binary download, `install.sh` bootstrap, `/healthz`), so operators can expose it independently of the human UI port. Started from `instrumentation.ts` via an idempotent `ensureAgentServerStarted()` (`globalThis` singleton, same idiom as the tickers). The listener owns **no logic** — it parses the request and re-enters the service layer.

- Machine auth: `X-<App>-Instance: <name>` header + `Authorization: Bearer <fetch key>`; the key is minted once and only its sha256 hash is stored (see Machine credentials above). Unknown instance → 404, bad key → 401.
- Config responses carry an ETag = sha256 of **key-sorted** (canonical) JSON, truncated; `If-None-Match` answers 304 so polling agents are cheap.
- Any path parameter that reaches the filesystem (`/v1/client/{os}/{arch}`) is allowlisted (`/^[a-z0-9]+$/`) before use — never joined raw.
- Dockerfile `EXPOSE`s both ports; `run-docker.sh` maps both (or neither, in proxy/`--network` mode).

### Multi-realm tenancy (one control plane, N downstream daemons)

A `realm` table (`id, name, admin_url, token_enc, is_default`) registers each downstream daemon. Admin tokens are cipher-keyring-encrypted at rest; DTOs mask them to `hasToken: boolean`. Exactly one default enforced by a partial unique index: `CREATE UNIQUE INDEX idx_realm_one_default ON realm(is_default) WHERE is_default = 1`.

- The active realm is a signed httpOnly cookie **hint**, re-validated against the DB per request. Top-role users may switch (`POST /api/realms/active`); standard users get an owner-assigned realm from a `user_realm` table.
- Services resolve a bound daemon client three ways: `clientFor(realmId)`, `clientForActive(githubId, role)` (realm-*selected* ops — admin pages), `clientForSite(site)` (realm-*scoped* ops — the row's own `realm_id`). The decrypted token never leaves the server.
- Admin URLs pass SSRF checks before persisting: reject cloud-metadata hosts and private/loopback IP literals, best-effort DNS pre-resolve, optional host-glob allowlist env (`<APP>_REALM_URL_ALLOWLIST`).
- An idempotent `ensureSeed()` registers the env-configured daemon as the default realm at boot, recording (not throwing) a `lastSeedError` so "seed failed" is distinguishable from "nothing configured".

### Cron-scheduled host jobs (owner-only)

Owner-defined shell/node scripts run on the app host — on a 5-field cron schedule, on demand, or both.

- `domain/cron.ts` — pure parser/matcher (`min hour dom mon dow`; `*`, lists, ranges, `*/n`; dow `7≡0`; standard dom+dow OR semantics when both are restricted). `nextRun` walks minute-by-minute under a horizon cap so an unsatisfiable spec (Feb 30) returns `null` instead of looping.
- `domain/job.ts` — validation returning a discriminated `{ ok: true, input } | { ok: false, error: { field, … } }`; client-shared (the editor uses it too), hence `TextEncoder` for byte caps.
- Executor (`services/jobs.ts`) — writes the script to a `mkdtemp` throwaway file, spawns `detached: true` (own process group) so the timeout kill sweeps grandchildren: `process.kill(-child.pid, 'SIGKILL')`. Output capped per stream (256 KB + `truncated` flag); exit → `success | failed | timeout | error`; runs persisted and pruned to the newest N; overlap guarded by a `globalThis` running-set. A missing interpreter surfaces as a failed run, never a crash.
- Scheduler (`services/job-scheduler.ts`) — the sub-minute ticker + minute-key dedupe from the triad above; fires without awaiting.
- **This runs arbitrary code as the app's user.** Gate every route at the TOP role, audit every create/update/delete/run.

---

## Docker — monorepo standalone build

Multi-stage, `node:22-slim` or `node:24-slim` (anything ≥ 22.5), Next `output: 'standalone'`. In a monorepo the build context is the **repo root** (the app's `@toolcase/*` deps are `file:../` siblings consumed from their built `lib/`):

```dockerfile
FROM node:24-slim AS builder
WORKDIR /repo
COPY package.json package-lock.json ./
COPY base/package.json base/package.json
COPY web-components/package.json web-components/package.json
COPY <app>/package.json <app>/package.json
RUN npm ci
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build --workspace=@toolcase/base \
 && npm run build --workspace=@toolcase/web-components \
 && npm run build --workspace=@toolcase/<app>

FROM node:24-slim AS runner
WORKDIR /app
ENV NODE_ENV=production PORT=3000 WORKSPACE_DIR=/workspace
RUN useradd -m -u 10001 app && mkdir -p /workspace && chown -R app:app /workspace
# Next nests the app under its workspace path inside the standalone tree — mirror it exactly.
COPY --from=builder --chown=app:app /repo/<app>/.next/standalone ./
COPY --from=builder --chown=app:app /repo/<app>/.next/static ./<app>/.next/static
COPY --from=builder --chown=app:app /repo/<app>/public ./<app>/public
# .next/cache must be writable by an arbitrary host uid (run-docker.sh runs --user $(id -u)).
RUN mkdir -p /app/<app>/.next/cache && chmod -R 0777 /app/<app>/.next/cache
USER app
EXPOSE 3000
CMD ["node", "<app>/server.js"]
```

- Manifests-first `COPY` + `npm ci` so the deps layer caches across source-only changes. Build `base` → `web-components` → `<app>` in order (web-components imports base's built `lib/`).
- The standalone tree nests the app under `./<app>/` — `server.js`, `static`, and `public` all live there. Mirror that layout in the runner.
- Non-root `app` user owns `/workspace`. `run-docker.sh` runs with `--user $(id -u)` and bind-mounts the SQLite/workspace volume, so the WAL DB survives restarts and files are host-owned. A `--tmpfs /app/<app>/.next/cache` mount is a cleaner alternative to the chmod-0777 cache dir.
- `/api/health` (exact path) is the public liveness probe for `HEALTHCHECK`; detailed health stays admin-gated.
- Shipping a companion binary (a Go agent client, a CLI)? Add a **lead `golang:*` stage** that cross-compiles static binaries per os/arch and `COPY` them into the runner (`./<app>/client-bin`); the app serves them from `config.clientDir`. Still one image, one CMD — the agent listener starts in-process via instrumentation, so `EXPOSE` both ports but keep the single `CMD ["node", "<app>/server.js"]`.

---

## Recipes

### Add a table + repository

1. Append a new `MIGRATIONS[]` entry in `server/data/db.ts` (additive — new table, or `ADD COLUMN` nullable/`DEFAULT`). Never edit an applied migration.
2. Add the entity type to `server/domain/types.ts`.
3. Create `server/data/repositories/<area>-repo.ts` — `Raw` interface + `map()` + named SQL functions via `prep`/`getRow`/`allRows`.
4. Call it only from a service.

### Add an API route

1. Create `app/api/<area>/route.ts` with `export const runtime = 'nodejs'` + `dynamic = 'force-dynamic'`.
2. `const auth = await guard(minRole); if ('res' in auth) return auth.res`.
3. Parse defensively (`req.json().catch(() => ({}))`), validate → `error(msg, 400)`.
4. Call a service; map domain errors to status; `audit(auth, 'verb.noun', detail)` on mutations; `return json(data, status)`.

### Add a page

1. Create `app/<feature>/page.tsx` — `runtime`/`dynamic` exports, optional `generateMetadata`.
2. Server-guard model: `const me = await requireRole(minRole)` then `<AppShell me={me}><FeatureClient/></AppShell>`. AuthGate model: render `<AuthGate><FeatureClient/></AuthGate>` and gate data via `useAreaData(fetcher, minRole)` in the client.
3. Put all UI in the `'use client'` `FeatureClient` — gate hook → page frame → table + modals.
4. Add the nav entry in `AppShell` (rank-gate the section on `me.role`); mirror it in `CommandPalette`'s item list if present.

### Add a service + domain logic

1. Pure decisions → `server/domain/<thing>.ts` + a unit test at `test/<thing>.test.ts` (the root vitest picks it up).
2. Orchestration (compose repos + domain + infra) → `server/services/<thing>.ts` (`import 'server-only'`), with its typed error(s) + `httpErrorFor(err)`.
3. External I/O → `server/infrastructure/<system>.ts` with typed errors.

### Add an encrypted secret at rest

1. Store `encrypt(value)` from `infrastructure/cipher.ts` in a `*_enc TEXT` column; decrypt server-side only, at the moment of use.
2. Never return it in a DTO — expose `hasToken: boolean` (or similar); updates accept a new value or keep the old.
3. Rotation is env-only: move the old key to `<APP>_SECRET_KEY_PREV`, set the new one — old ciphertext keeps decrypting, writes re-seal.

### Add an env var

1. Add to `server/config.ts` via `required`/`optional`/`num`/`bool`/`csv` (secrets via `requiredSecret`).
2. Mirror in `.env.example` with a placeholder; set in `.env.local`.
3. Read only through `config.*` — never `process.env` scattered across the app.

### Add a background ticker

1. Write `server/services/<x>.ts` following the ticker triad: `ensure<X>Started()` (globalThis singleton, `unref()`d interval) + an exported `pollNow()`/`tick()` body tests call directly.
2. Dynamic-import + call it from `instrumentation.ts` inside the `NEXT_RUNTIME === 'nodejs'` guard.
3. Log-and-skip per-item failures inside the tick; never let one bad row kill the loop.

### Scaffold a new full-stack-app workspace

- `package.json` — `next dev -p <port>` / `build` / `start` / `lint` / `typecheck`; deps `next ^16`, `react`/`react-dom ^19`, `server-only`, `@toolcase/base`, `@toolcase/web-components`; `"engines": { "node": ">=22.5" }`.
- `next.config.mjs` — `output: 'standalone'`, `reactStrictMode: true`, `transpilePackages: ['@toolcase/base']`, `eslint.ignoreDuringBuilds: true`, `experimental.instrumentationHook` if you boot tickers.
- `tsconfig.json` — `strict`, `"paths": { "@/*": ["./*"] }`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, the `next` TS plugin.
- `app/layout.tsx` (import tc `style.css` + `react` JSX typings + `globals.css`, wrap in `<Providers>`), `app/providers.tsx`, `app/globals.css`, `app/page.tsx`, `app/login/`, `app/not-found.tsx`.
- `server/config.ts` (every var `<APP>_`-prefixed), `server/data/db.ts` (v1 migration with `app_user` + `audit`), `server/domain/types.ts`, `server/services/auth.ts`, and the guard seam you chose: `server/web/http.ts` + `page-guards.ts` (taskforge) or inline `authorize()` + `components/AuthGate.tsx` + `lib/me-context.tsx` (quaykeeper).
- `lib/tc.ts` (verbatim), `lib/fetcher.ts`, `lib/action-icons.tsx`, `components/AppShell.tsx` + the UI kit (`DataTable`, `FormModal`, `ConfirmDialog`, `Toast`, `fields`, `states`, `SubTabBar`).
- `instrumentation.ts`, `test/` (root vitest discovers it — no local config), optional `middleware.ts`, `Dockerfile`, `run-docker.sh`, `.env.example`.

---

## Anti-Patterns

- ❌ Calling a repository from a route handler or page. Routes call services; services call repositories. The layering is the contract.
- ❌ Business rules or validation inside a repository. Repos are SQL + `Raw → map()` only. Decisions live in `domain/`, orchestration in `services/`.
- ❌ Editing or reordering an applied `MIGRATIONS[]` entry. It's append-only — a deployed instance has already run it. Add a new entry.
- ❌ Interpolating values into SQL. Always `?` placeholders + bound params.
- ❌ Trusting the role in the session cookie payload. It's an advisory hint — re-read the authoritative role (DB/roles.json) per request via `authorize()`.
- ❌ Putting the GitHub access token in the session payload, or storing any secret in plaintext. Callback-only by default; if a flow needs a secret later, seal it with the cipher keyring into its own table (`*_enc` column) and decrypt at use.
- ❌ Omitting `runtime = 'nodejs'` / `dynamic = 'force-dynamic'` on a DB- or session-touching route/page. Edge has no `node:sqlite`; default caching leaks authed responses across users.
- ❌ A static `import '@toolcase/web-components'` (top-level or in a server component). It evaluates `extends HTMLElement` during SSR and crashes. Dynamic-import inside a client `Providers` effect, and gate children behind `registered`.
- ❌ Setting object/array props on `tc-*` through JSX, or `onClick={...}` for a CustomEvent. JSX stringifies props and can't bind CustomEvents — use `useTcProps` / `useTcEvents` from `lib/tc.ts`.
- ❌ Importing anything under `server/` (incl. `config`) from a client component. `server-only` will (correctly) fail the build.
- ❌ Server-only imports (`fs`, `child_process`, `node:*`) in `server/domain/types.ts`. It's shared with the client — keep it pure.
- ❌ Treating edge `middleware.ts` as the security boundary. It checks cookie *presence* only; real authorization is the Node-layer `authorize()`/`requireRole()`. Never drop those because "middleware already checks".
- ❌ Building the login/redirect URL from `x-forwarded-host`/`req.url` behind a proxy. Use the trusted `PUBLIC_ORIGIN` / redirect-URI origin — forwarded headers are attacker-controllable (open-redirect / internal-host leak).
- ❌ Scattering `process.env` reads across the app. One validated `config` object; read `config.*` everywhere else.
- ❌ Skipping the `audit()` call on a mutation. Who-did-what is part of the contract; it's best-effort and never blocks.
- ❌ A second background ticker per hot-reload. Cache the interval handle on `globalThis` and start it from `instrumentation.ts`, not from a route.
- ❌ Reaching for an ORM, Prisma, or a separate Postgres server. The blueprint is one process + one `node:sqlite` file + hand-written repositories. If you genuinely outgrow SQLite, that's a different architecture — don't half-migrate.
- ❌ Two parallel client fetch stacks (a throwing `apiFetch` AND a result-object `callApi`, plus per-area one-offs). One convention; wrap it, don't fork it.
- ❌ Forking the role-gate hook per role (`useOwnerData` / `useMaintainerData` / `useConfigData`). One `useAreaData(fetcher, minRole)` subsumes them all.
- ❌ A second ID scheme. Every entity gets `newId(ID.<entity>)` from `infrastructure/ids.ts`; don't grow a parallel unprefixed generator.
- ❌ A per-app vitest config or `test` npm script. The root `vitest.config.ts` (with the `@/` and `server-only` aliases) is the single runner; put tests in `<app>/test/`.
- ❌ Splitting audit between routes AND services. Pick one seam (route-level `audit()` helper, or service-internal next to the mutation) and hold it app-wide.
