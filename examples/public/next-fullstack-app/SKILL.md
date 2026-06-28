---
name: next-fullstack-app
description: Use when scaffolding or extending a self-hosted full-stack Next.js App Router application with its own backend — a single-process app that owns auth, a SQLite system-of-record, REST API routes, and a tc-* web-components dashboard UI. This IS Next.js (the `next` package, App Router, RSC, route handlers, `next build`/`next dev`) — for a static prerendered marketing site use `next-static-app` instead, for a backend-only Node service use `node-service`. Defines the layered server (config → data/repositories → domain → infrastructure → services → web), the node:sqlite singleton + append-only migration runner, GitHub-OAuth + HMAC-cookie auth with a three-tier role model, the thin edge middleware + Node-layer guards split, the guard→parse→validate→service→audit→json route contract, thin server-component pages delegating to 'use client' components, the lib/tc.ts web-components interop, instrumentation boot hooks, and the monorepo Docker standalone build. Apply when adding an API route, a page, a repository/table + migration, a service, an env var, a background ticker, an auth/role check, or scaffolding a new full-stack app workspace.
---

# next-fullstack-app — Architecture Reference

Opinionated blueprint for self-hosted, single-process, full-stack Next.js applications: an internal tool or control panel that owns its **own** auth, its **own** database, and a real-time dashboard UI — all in one deployable. App Router does double duty as the web framework (pages + RSC) and the HTTP backend (route handlers). State persists in a single SQLite file via Node's built-in `node:sqlite`. No external DB server, no separate API process, no DI container.

This **is** Next.js. If you need a statically-prerendered marketing/content site (no server runtime, no auth, no DB) use `next-static-app`. If you need a headless backend with no UI use `node-service`. This skill is for the case where one Next.js process is the whole product.

The reference implementations are **perch** (a static-hosting control plane) and **taskforge** (a Claude Code task runner). They share the same skeleton almost file-for-file — `lib/tc.ts` is byte-identical, `server/data/db.ts` and `server/config.ts` are ported verbatim with only names changed. That shared skeleton is what this skill encodes. Deviation from it is a smell, not a style choice.

Stack baseline:

- **Next.js 16** (App Router), **React 19**, TypeScript `strict`. `output: 'standalone'`, `reactStrictMode: true`, `transpilePackages: ['@toolcase/base']`, `eslint.ignoreDuringBuilds: true`.
- **`node:sqlite`** (`DatabaseSync`) — synchronous, WAL journal, `foreign_keys = ON`, `busy_timeout = 5000`. Single connection cached on `globalThis` (survives dev hot-reload). Prepared-statement cache (`Map<string, StatementSync>`). Append-only `MIGRATIONS[]` runner.
- **`server-only`** import at the top of every server module — a build-time tripwire that fails the bundle if backend code is ever pulled into a client component.
- **`@/*`** path alias → repo root. `runtime = 'nodejs'` + `dynamic = 'force-dynamic'` on every route/page that touches the DB or session.
- **GitHub OAuth** code flow → signed `httpOnly` session cookie (`<base64url payload>.<base64url HMAC-SHA256 sig>`). Three-tier role model with a `ROLE_RANK` ordering. The access token is used only during callback, never persisted in the session.
- **`@toolcase/web-components`** for the UI — framework-free `tc-*` custom elements rendered into light DOM, driven from React via `lib/tc.ts`. `@toolcase/base` for helpers/data structures.
- **Node ≥ 22.5** (required for `node:sqlite`; flag-free on Node 24). Docker builds on `node:24-slim`, Next standalone output, monorepo-root build context.
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
├── Dockerfile              # multi-stage monorepo build → node:24-slim standalone
├── run-docker.sh           # local run: --user $(id -u), bind-mount the workspace volume
├── .env.example            # every env var with a placeholder (committed; .env.local gitignored)
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
    ├── domain/             # PURE logic + types.ts + co-located *.test.ts (vitest). No I/O.
    ├── infrastructure/     # adapters to the outside world — github, slack, git, nginx, agent, server-log
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
    for (let i = 0; i < MIGRATIONS.length; i++) {
        const version = i + 1
        if (applied.has(version)) continue
        db.exec('BEGIN')
        try { db.exec(MIGRATIONS[i]); insert.run(version, new Date().toISOString()); db.exec('COMMIT') }
        catch (err) { db.exec('ROLLBACK'); throw err }
    }
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
export function tx<T>(fn: () => T): T {                              // DatabaseSync is synchronous
    const { db } = wrap(); db.exec('BEGIN')
    try { const r = fn(); db.exec('COMMIT'); return r } catch (e) { db.exec('ROLLBACK'); throw e }
}
export function initDb(): void { wrap() }                            // eager open (called from instrumentation)
```

Rules:

- **All schema is migrations.** Adding a table or column = a new `MIGRATIONS[]` entry, never an edit to an existing one. Additive changes (`ADD COLUMN` nullable or with `DEFAULT`) so a running instance upgrades without data loss.
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

Pure, synchronous, I/O-free logic + shared types. This is the **only** layer with unit tests (vitest, co-located `*.test.ts`).

- `types.ts` — every shared type + constant (`Role`, `ROLE_RANK`, `SessionPayload`, `MeResponse`, entity shapes, enums). **It must not import anything server-only** (no `fs`, no `child_process`, no `node:*`) — it is imported from both server and client code. This is the contract between the two halves.
- Other files (`quota.ts`, `hostname.ts`, `plan-resolution.ts`, `deploy-machine.ts`, `account-lru.ts`, …) hold pure decisions: validation, state-machine transitions, derived values, comparisons. Given inputs, return outputs — no DB, no network, no clock-reading beyond a passed-in `now`.
- Every domain file has a sibling `*.test.ts`. If a function is hard to test because it does I/O, it belongs in a service, not the domain.

```ts
// server/domain/types.ts
export type Role = 'admin' | 'standard' | 'guest'        // or 'owner' | 'standard' | 'guest'
export const ROLE_RANK: Record<Role, number> = { guest: 0, standard: 1, admin: 2 }

export interface SessionPayload { sub: number; login: string; role: Role; iat: number; exp: number }
export interface MeResponse { githubId: number; login: string; name: string; avatarUrl?: string; role: Role }
```

---

## Infrastructure Layer — `server/infrastructure/`

Adapters to the outside world, one file per external system. Each wraps its I/O behind typed functions and throws **typed errors** the service/route layer can branch on:

- `github.ts` — GitHub REST/GraphQL calls (`fetch`, `cache: 'no-store'`).
- `git.ts`, `agent.ts` — child-process spawns with timeouts; `GitError { stderr }` etc.
- `slack.ts`, `notify.ts` — outbound webhooks.
- `server-log.ts` — an in-memory ring buffer for the health/log surface.
- `fs-workspace.ts` — guarded filesystem ops; `UnsafePathError` for path-traversal attempts.

Rules: infra never imports services (no upward calls); it never touches the DB (that's repositories); it owns timeouts, retries, and the typed-error vocabulary for its system. A hung external call must not be able to wedge a request forever — give every spawn/fetch a deadline.

---

## Services Layer — `server/services/`

Orchestration + policy. A service is the sole caller of the repositories beneath it; it composes `domain/` decisions with `data/` persistence and `infrastructure/` I/O. Import directly: `import * as sites from '@/server/services/sites'`.

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
- `httpOnly`, `sameSite: 'lax'`, `path: '/'`, `secure` iff the redirect URI is `https://`, `maxAge = sessionTtl`. A separate short-lived (`maxAge: 600`) HMAC state cookie guards the OAuth callback against CSRF.
- OAuth code flow: `buildAuthorizeUrl(state)` → GitHub → `/api/auth/github/callback` exchanges the code (`exchangeCodeForToken`), fetches the profile (`fetchGithubProfile`), runs the optional allow-list / org-membership gate (`checkAllowlist`), resolves the role, sets the session cookie. The GitHub access token is used during callback only and is **never** put in the session payload or the DB. (If a later flow needs it, give it its own short-lived `httpOnly` cookie — never the session.)
- **Role is re-read per request from the authoritative source**, not trusted from the cookie payload (which is an advisory hint). The authoritative source is either the `app_user.role` DB column (perch style — fold role resolution into `auth.ts`) or a `roles.json` file read by a separate `services/roles.ts` (taskforge style). Either way: change a role, it applies on the next request without re-login.

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

> **Small-app variant:** perch has no `server/web/` directory — its routes call `authorize()` directly and inline the `if (!authz.ok)` check. taskforge factors that into `web/http.ts`'s `guard()`. Prefer `web/` once you have more than a handful of routes; the DRY `guard`/`json`/`error`/`audit` helpers pay off fast.

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
- Map known domain/infra errors to status codes (`409` conflict, `422` unprocessable, `404` not found, `400` bad input); re-throw the unknown so Next returns 500.
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

- Auth lives server-side: the page server component runs `requireRole`/`requireSession` and `redirect`s before the client tree mounts. This is **not** weakened by the client-only UI — the RSC tree still executes on the server.
- `root layout.tsx` imports the web-components stylesheet + JSX typings + globals, sets `metadata` (title template), and wraps children in `<Providers>`.
- Per-page `generateMetadata` is async and `await`s `params`.

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

### `components/` — the UI

- `'use client'` everywhere. Naming: `AppShell.tsx` (the chrome), `<Feature>Client.tsx` per page, modals (`ConfirmModal`, `New*Modal`), shared bits.
- `AppShell` composes `tc-dashboard-layout` + `tc-brand` + `tc-side-nav` + `tc-user-panel`, derives the active nav item from `usePathname()`, gates admin-only sections on `me.role`, and routes via `useRouter().push` from the nav's `onItemClick`.
- `lib/fetcher.ts` — a typed `apiFetch<T>(url, opts)` with an `AbortController` timeout (default 10 s), a small `ApiErrorKind` union (`unauthorized | forbidden | notfound | server | timeout | network | parse`), an `ApiError` class, `describeApiError()` for user copy, and `isAuthError()` to decide a `/login` bounce. Every data view goes through it — no ad-hoc `fetch`.
- `lib/toast.ts`, `lib/modal.tsx`, `lib/icons.ts` — imperative toast spawner, modal registry, and a `tcIcon(name)` helper mapping icon names to inline SVG.

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

- **Fail-fast**: a missing required var throws at first import — except during `next build` (`NEXT_PHASE === 'phase-production-build'`), where the module graph is traced before env is provided. Defer those failures to runtime boot / first request.
- Secrets get a length floor (`AUTH_SECRET` ≥ 16). `publicOrigin` is a getter that prefers a trusted explicit value, else the redirect URI's origin.
- **Never import `config` (or anything under `server/`) from a client component** — `server-only` will fail the build if you do, which is the point.
- Mirror every var in `.env.example` with a placeholder. `.env.local` is gitignored.

---

## Boot Hooks — `instrumentation.ts`

Runs once per server start. Use it to launch background tickers (schedulers, reconcile loops) and harden state, so they run without any page/route being hit first. Guard on the Node runtime and **dynamic-import** the services (keeps them out of the Edge/middleware bundle):

```ts
export async function register(): Promise<void> {
    if (process.env.NEXT_RUNTIME !== 'nodejs') return
    const { ensureSchedulerStarted } = await import('@/server/services/scheduler')
    ensureSchedulerStarted()
}
```

Enable in `next.config.mjs` with `experimental: { instrumentationHook: true }` if your Next version requires the opt-in. Tickers themselves cache their interval handle on `globalThis` so a dev hot-reload doesn't start a second one.

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

## Docker — monorepo standalone build

Multi-stage, `node:24-slim`, Next `output: 'standalone'`. In a monorepo the build context is the **repo root** (the app's `@toolcase/*` deps are `file:../` siblings consumed from their built `lib/`):

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
- Non-root `app` user owns `/workspace`. `run-docker.sh` runs with `--user $(id -u)` and bind-mounts the SQLite/workspace volume, so the WAL DB survives restarts and files are host-owned.
- `/api/health` (exact path) is the public liveness probe for `HEALTHCHECK`; detailed health stays admin-gated.

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
2. If guarded: `const me = await requireRole(minRole)` (redirects on failure).
3. Render `<AppShell me={me}><FeatureClient/></AppShell>`; put all UI in the `'use client'` `FeatureClient`.
4. Add the nav entry in `AppShell` (gate on `me.role` if admin-only).

### Add a service + domain logic

1. Pure decisions → `server/domain/<thing>.ts` + a co-located `<thing>.test.ts`.
2. Orchestration (compose repos + domain + infra) → `server/services/<thing>.ts` (`import 'server-only'`).
3. External I/O → `server/infrastructure/<system>.ts` with typed errors.

### Add an env var

1. Add to `server/config.ts` via `required`/`optional`/`num`/`bool`/`csv` (secrets via `requiredSecret`).
2. Mirror in `.env.example` with a placeholder; set in `.env.local`.
3. Read only through `config.*` — never `process.env` scattered across the app.

### Add a background ticker

1. Write `server/services/<x>.ts` exposing `ensure<X>Started()` that caches its interval on `globalThis`.
2. Dynamic-import + call it from `instrumentation.ts` inside the `NEXT_RUNTIME === 'nodejs'` guard.

### Scaffold a new full-stack-app workspace

- `package.json` — `next dev -p <port>` / `build` / `start` / `lint` / `typecheck`; deps `next ^16`, `react`/`react-dom ^19`, `server-only`, `@toolcase/base`, `@toolcase/web-components`; `"engines": { "node": ">=22.5" }`.
- `next.config.mjs` — `output: 'standalone'`, `reactStrictMode: true`, `transpilePackages: ['@toolcase/base']`, `eslint.ignoreDuringBuilds: true`, `experimental.instrumentationHook` if you boot tickers.
- `tsconfig.json` — `strict`, `"paths": { "@/*": ["./*"] }`, `jsx: "react-jsx"`, `moduleResolution: "bundler"`, the `next` TS plugin.
- `app/layout.tsx` (import tc `style.css` + `react` JSX typings + `globals.css`, wrap in `<Providers>`), `app/providers.tsx`, `app/globals.css`, `app/page.tsx`, `app/login/`, `app/not-found.tsx`.
- `server/config.ts`, `server/data/db.ts` (v1 migration with `app_user` + `audit`), `server/domain/types.ts`, `server/services/auth.ts`, `server/web/http.ts` + `page-guards.ts`.
- `lib/tc.ts` (verbatim), `lib/fetcher.ts`, `components/AppShell.tsx`.
- `instrumentation.ts`, optional `middleware.ts`, `Dockerfile`, `run-docker.sh`, `.env.example`.

---

## Anti-Patterns

- ❌ Calling a repository from a route handler or page. Routes call services; services call repositories. The layering is the contract.
- ❌ Business rules or validation inside a repository. Repos are SQL + `Raw → map()` only. Decisions live in `domain/`, orchestration in `services/`.
- ❌ Editing or reordering an applied `MIGRATIONS[]` entry. It's append-only — a deployed instance has already run it. Add a new entry.
- ❌ Interpolating values into SQL. Always `?` placeholders + bound params.
- ❌ Trusting the role in the session cookie payload. It's an advisory hint — re-read the authoritative role (DB/roles.json) per request via `authorize()`.
- ❌ Putting the GitHub access token in the session payload or the DB. It's used during callback only; if a flow needs it later, give it its own short-lived `httpOnly` cookie.
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
