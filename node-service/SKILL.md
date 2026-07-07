---
name: node-service
description: Use when scaffolding OR modifying any Node.js + TypeScript backend (HTTP service, worker, real-time server) — both greenfield projects and changes to existing ones. Defines workspace layout, layering rules (routers → services → repositories → db), tsyringe DI conventions, Fastify wrapper, typed env loader, raw-SQL repository pattern (no ORM, no query builder) over either `pg` (Postgres) or native `node:sqlite`, domain errors, transactions, optional Rivalis real-time integration, and `@toolcase/serializer` binary wire format. Apply when creating a new backend project, adding/changing a domain (table + repo + service + router), adding/modifying an HTTP route, refactoring a layer, wiring auth, introducing real-time rooms, or touching env/boot/DI in an existing service. Trigger on any edit inside `services/<name>/` or `workers/<name>/` (or equivalent backend project directories). Scope boundary — this skill owns project structure, layering, DI, and boot wiring; for the exact `@toolcase/node` API surface (method signatures of `BaseRepository`, `HttpServer`, `RESTRouteHandler`, `KVService`, `env()`, etc.) use the `node` skill instead. (Vice-versa: the `node` skill documents the library API; when the question is where code lives, how layers depend on each other, or how a service boots, come here.)
---

# node-service — Architecture Reference

Opinionated blueprint for Node.js + TypeScript backends. Layered, DI-driven, single-bundle ESM. Applies to **two situations**:

1. **Scaffolding** a new project — follow the workspace layout and folder contracts top to bottom.
2. **Modifying an existing project** — every edit MUST conform to the layer rules and folder contracts below. Any pre-existing deviation is a latent bug; don't propagate it.

Stack baseline:

- Node 20+, ESM (`"type": "module"`), TypeScript `strict`.
- `fastify` v5 + `@fastify/cors` for HTTP.
- `tsyringe` v4 + `reflect-metadata` for DI (constructor injection).
- `tsup` (SWC transform) → single bundled ESM entry in `dist/`.
- Database via **raw SQL** — pick one driver: `pg` (`Pool`) for PostgreSQL, or native `node:sqlite` (`DatabaseSync`) for SQLite. Repositories built on `@toolcase/node` `BaseRepository` (engine-agnostic — you implement the verbs with hand-written parameterized SQL). **No ORM** (no Prisma, TypeORM, Sequelize, Drizzle) and **no query builder** (no Kysely, Knex).
- Schema migrations **out-of-tree** (e.g. goose against `<repo>/migrations/<db>/`). Never inside the project.
- One process = one HTTP server + one DB pool + at most one Rivalis instance.

---

## Optional @toolcase / @rivalis Libraries

Optional packages that slot into this scaffold. Use what fits.

- **`@toolcase/base`** — Zero-dep helpers + data structures. Mandatory uses:
  - `HTTP.RESTResponse` / `HTTP.RESTError` / `HTTP.Status` for every router response.
  Optional: `Cache`, `EventEmitter`, `Broadcast`, `generateId`, `retry`, `ObjectPool`, `JSONSchema` validation, `PriorityQueue`, `VectorClock`, `Color`, `Dijkstra`, `AStar`, `WeightedRandom`, `Packing.Packer`. Live in `util/` or `services/`.

- **`@toolcase/node`** — Backend helpers. Mandatory: `env(name, default, type)` for every env var read in `src/env.ts`. Recommended for the db layer: `BaseRepository` (engine-agnostic — ships no queries; you implement the verbs with raw SQL, see `db/`) + `EntityService` (before/after hooks) + `RESTRouteHandler` (auto-CRUD over an `EntityService`). Also: `HttpServer` wrapper, `KVService` (Redis), `NodeStore` + `BlockStore` (durable file-based key-value store: B+ tree index + append-mostly heap, no extra peer deps — useful for embedded caches or local worker state that must survive process restarts without a Redis dependency), `ImageProcessor` (sharp), `AtlasBuilder`, `OAuth2` helpers. Peer-deps `@toolcase/base`, `fastify`, `redis`, `sharp`, `jose` declared optional — install only what you use. `BaseRepository` is driver-free: pass it your query runner (the `pg` `Pool`/`PoolClient`, or the `node:sqlite` `DatabaseSync`); the driver stays the project's own dep.

- **`@toolcase/logging`** — Isomorphic logger. Mandatory. One named logger per class: `logging.getLogger('Database')`, `logging.getLogger('Http')`, `logging.getLogger('UserService')`. Configure level + reporters once at boot in `index.ts` (default reporter is console; swap via custom `LogReporter`, `JSONLineReporter`, `BufferedReporter`, or `FileLogReporter` from `@toolcase/logging/node`).

- **`@toolcase/serializer`** — Runtime-defined protobuf schemas, encode/decode to compact `Uint8Array`. No `.proto` build step. Use when the service speaks binary over WebSocket/IPC (paired with Rivalis topics) or persists compact buffers. Lives in `wire/` or `services/`. Skip for JSON HTTP payloads.

- **`@rivalis/core`** — Server-side real-time rooms (rooms, actors, ticket auth, heartbeats, rate limiting, WS transport). Use when the service needs shared room state, presence, or an authoritative tick loop. Do not hand-roll `ws` / `socket.io` / `colyseus`. Lives behind a `Realtime` injectable in `realtime/`. See the dedicated `rivalis` skill.

- **`@rivalis/browser`** — Typed browser `WSClient` with reconnect, JSON/bytes helpers, ticket-via-subprotocol. Pair with `@rivalis/core` server. Lives in the SPA workspace, not this backend — but the ticket-mint endpoint (`POST /v1/realtime/ticket`) lives here.

---

## Working in an Existing Project

When modifying an existing Node service, this skill is the contract every edit conforms to — even if surrounding code already deviates. Approach in this order:

### 1. Orient before editing

- Read `src/index.ts`, `src/container.ts`, `src/http.ts`, `src/env.ts`, `src/db/Database.ts`, `src/db/schema.ts` first. They tell you what's wired and what's optional.
- Identify which folders exist (`db/`, `realtime/`, `wire/`) — that determines which sections of this skill apply.
- Check `package.json` for which optional libs are installed (`@rivalis/core`, `@toolcase/serializer`, `pg`, etc.) and which DB driver the project uses (`pg` vs `node:sqlite`). Don't add a new dep without need.

### 2. Match existing conventions, then this skill

- If the project already follows the blueprint: extend in the same shape — new file in the right folder, registered in `container.ts`, wired through the right layer.
- If the project deviates from the blueprint in a small way (naming, ordering): match the local convention for the edit at hand. Don't refactor unrelated code in the same change.
- If the project deviates in a structural way (e.g. raw driver calls outside `Database.ts` / repositories, a router running SQL, multiple `pg.Pool`s / `DatabaseSync` instances, `console.log` instead of `logging`): **flag it to the user before adding more of the same**. Offer either a scoped fix or a follow-up cleanup. Don't silently propagate the deviation.

### 3. Where to add new code

| You're adding... | Goes in... |
|---|---|
| A new HTTP endpoint on an existing domain | Existing `routers/<domain>Router.ts` + new method on existing service |
| A new domain (CRUD) | New schema entry → new repository → new service → new router → register in `container.ts` |
| A new query against an existing table | New method on the existing repository (not in the service, not inline in a router) |
| A new env var | `src/env.ts` only. Update `.env.example`. |
| A new external dependency (HTTP/SDK call) | New service that owns the gateway concern; never `fetch` from a domain service directly |
| A new background job / cron | New `@injectable` service with `init`/`dispose`, registered + booted in `index.ts` |
| Real-time rooms | `src/realtime/` (create the folder if it doesn't exist; see Recipes) |
| Binary wire format | `src/wire/` (create the folder if it doesn't exist) |
| A pure helper | `src/util/` — and check `@toolcase/base` first |
| Anything that doesn't fit the layers | Stop and ask. Don't invent a new top-level folder. |

### 4. Where to change existing code

- **Schema change** — SQL migration in the out-of-tree `migrations/<db>/` directory **and** the matching update to `src/db/schema.ts` go in the **same PR**. They drift = runtime errors.
- **Renaming a column / table** — raw SQL gets **no compile-time check** against `schema.ts`, so a rename won't surface as a TS error. Grep every repository for the old column/table name and fix each SQL string by hand. Update the `schema.ts` row interface in the same change. Don't skip the SQL migration.
- **Changing an env var** — update `src/env.ts` (typed default), `.env.example`, and any deploy manifests. Boot-time required-var check stays in `index.ts`.
- **Adding a constructor param to a service/repository** — every other site that constructs it manually (test, script) has to update. Prefer adding via `@inject(NewDep)` and registering in `container.ts`.
- **Removing code** — drop it cleanly. No backwards-compat shims, no `_unused` renames, no commented-out blocks. Git remembers.

### 5. Boundaries that are non-negotiable in any edit

- **`reflect-metadata` is the first import in `index.ts`.** Don't reorder.
- **One DB handle per process** — one `pg.Pool` (Postgres) or one `DatabaseSync` (SQLite), owned by `Database`. Adding a second is always wrong.
- **No migration call from the running process.** Migrations are a deploy step.
- **No new code path that bypasses the layer rules** (router → service → repository → db). Even for "just this once."
- **No `console.log` added to production paths.** Use `logging.getLogger('Component')`.
- **No `process.env.X` reads outside `src/env.ts`.**
- **No raw `Error` thrown from a service for a known business case.** Use an `AppError` subclass (or add one).
- **No `ws` / `socket.io` / `colyseus` introduced.** Real-time = Rivalis or nothing.

### 6. Verifying the change

After any non-trivial edit:

- `npm run build` (or `tsc --noEmit`) — typed schema changes surface here.
- `npm run dev` — boot reaches `listening on http://...` and `connected to <db>`.
- `GET /v1/health` returns `{ status: "ok" }`.
- For schema changes — run the migration locally first, **then** verify the build, **then** smoke the affected endpoint.
- For real-time changes — connect a `@rivalis/browser` client and confirm the close code on intentional kicks (4001 auth, 4002 rate, 4003 invalid, 4004 capacity, 4005 server kick).

---

## Workspace Layout

```
<project>/
├── package.json          # "type": "module"
├── tsconfig.json         # decorators on, strict on
├── tsup.config.ts        # single ESM bundle, createRequire banner
├── Dockerfile            # multi-stage node:20-alpine
├── .dockerignore
├── .gitignore
├── .env.example          # mirrors every key in src/env.ts
└── src/
    ├── index.ts          # boot: reflect-metadata → env check → resolve → init → run → SIGTERM
    ├── container.ts      # tsyringe child container, registerSingleton calls
    ├── env.ts            # typed env vars, one export const per var
    ├── http.ts           # Fastify wrapper class (init/run/dispose)
    ├── db/
    │   ├── Database.ts           # query-runner (pg.Pool | node:sqlite DatabaseSync) lifecycle
    │   ├── schema.ts             # snake_case Row interfaces + New/Update shapes — TS mirror of out-of-tree migrations
    │   └── repositories/         # one file per aggregate root
    │       └── <Domain>Repository.ts
    ├── services/                 # business logic — depends on repositories + other services
    │   └── <Domain>Service.ts
    ├── routers/                  # Fastify plugins — HTTP shape only
    │   ├── healthRouter.ts       # GET /v1/health (always)
    │   └── <domain>Router.ts
    ├── domain/                   # pure types, errors, value objects — no I/O
    │   └── errors.ts             # AppError + subclasses with HTTP status
    ├── realtime/                 # OPTIONAL — Rivalis integration
    │   ├── Realtime.ts           # @injectable wrapper around Rivalis<TActorData>
    │   ├── rooms/                # Room subclasses
    │   ├── auth/                 # AuthMiddleware subclasses
    │   └── rateLimiter.ts        # custom RateLimiter (optional)
    ├── wire/                     # OPTIONAL — @toolcase/serializer message schemas
    │   └── <topic>.ts
    └── util/                     # cross-cutting pure helpers
```

Each top-level `src/` dir is single-purpose. Adding a folder outside this set requires explicit justification. **`db/migrations/` and `db/migrate.ts` are forbidden** — schema lives in the out-of-tree migrations directory, applied as a deploy step.

Path inside `src/` is the layer; what's inside the file is its responsibility.

---

## Layer Rules

| Layer | May import from | May NOT import from |
|---|---|---|
| `routers/` | `services/`, `domain/`, `container` (`resolve` only), Fastify | `db/`, repositories directly |
| `services/` | `db/repositories/`, `domain/`, other `services/`, `wire/`, `realtime/` (publish-only API) | `routers/`, Fastify, `container` |
| `db/repositories/` | `db/Database`, `db/schema`, `domain/`, `@toolcase/node` (`BaseRepository`) | `services/`, `routers/` |
| `db/Database.ts` | `pg` **or** `node:sqlite`, `env` | anything app-specific |
| `domain/` | nothing app-specific | everything (innermost core) |
| `realtime/` | `services/`, `domain/`, `wire/`, `@rivalis/core` | `routers/`, `db/repositories/` directly |
| `wire/` | `@toolcase/serializer`, `domain/` | everything else |
| `container.ts` | every layer | nothing imports back except `index.ts`, `routers/*` |

Primary invariant: **a router never runs SQL, never imports a repository.** Routers translate the HTTP request into a service call and the result back into a response. Everything else is a service or a repository.

---

## Boot Sequence

`src/index.ts` — single entry. Order matters:

```ts
import 'reflect-metadata'                         // first — decorator metadata
import logging from '@toolcase/logging'
import container from './container'
import { Database } from './db/Database'
import { Http } from './http'
import { SERVICE_NAME } from './env'
// import { Realtime } from './realtime/Realtime' // when present

const logger = logging.getLogger('•')

const db = container.resolve(Database)
const http = container.resolve(Http)
// const realtime = container.resolve(Realtime)

await db.init()
await http.init()
// await realtime.init()                           // after http.init, before http.run
await http.run()

logger.info(`${SERVICE_NAME} started`)

let shuttingDown = false
const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return
    shuttingDown = true
    logger.info(`received ${signal}, shutting down`)
    try {
        // await realtime.dispose()                 // before http.dispose
        await http.dispose()
        await db.dispose()
    } catch (error) {
        logger.error('shutdown error', error as Error)
    }
    process.exit(0)
}

process.on('SIGTERM', () => { void shutdown('SIGTERM') })
process.on('SIGINT', () => { void shutdown('SIGINT') })
```

Constraints:

- `import 'reflect-metadata'` is the **first** statement. Without it tsyringe metadata is silently empty and DI resolves `undefined`.
- Required env vars without defaults must be checked here and `process.exit(1)` if missing.
- `init()` order: `db` → `http` → `realtime`. `realtime.init()` runs **after** `http.init()` (needs the `http.Server`) and **before** `http.run()` (so `WSTransport` attaches its `upgrade` listener before clients connect).
- `dispose()` order is reverse: `realtime` → `http` → `db`. Otherwise rooms see sockets vanish without close codes.
- Top-level `await` is fine — Node 20 + ESM.
- No migration call from `index.ts`. Concurrent boot of N replicas races the migration table.

---

## Folder Contracts

### env.ts

One `export const` per variable, all using the typed `env()` helper from `@toolcase/node`. Flat — no nested config objects. Group with comment headers.

```ts
import { env } from '@toolcase/node'

// Identity
export const SERVICE_NAME = env('SERVICE_NAME', '<service>')
export const ENVIRONMENT = env('ENVIRONMENT', 'dev')

// HTTP
export const HTTP_PORT = env('HTTP_PORT', 3000, 'number')
export const HTTP_ALLOWED_ORIGINS = env('HTTP_ALLOWED_ORIGINS', '')

// Database — Postgres (pg driver)
export const PG_HOST = env('PG_HOST', '127.0.0.1')
export const PG_PORT = env('PG_PORT', 5432, 'number')
export const PG_USER = env('PG_USER', '')
export const PG_PASSWORD = env('PG_PASSWORD', '')
export const PG_DATABASE = env('PG_DATABASE', '')
export const PG_SCHEMA = env('PG_SCHEMA', 'public')
export const PG_POOL_MAX = env('PG_POOL_MAX', 10, 'number')

// Database — SQLite (node:sqlite). Use this block INSTEAD of the PG_* block when on SQLite.
// export const SQLITE_PATH = env('SQLITE_PATH', './data/app.db')

// Real-time (when Rivalis is enabled)
// export const WS_PORT = env('WS_PORT', 3100, 'number')
// export const WS_TICKET_SECRET = env('WS_TICKET_SECRET', '')
```

`env(key, default, type?)`: omitted `type` defaults to `'string'`. Pass `'number'` or `'boolean'` for typed parsing. A `null` default is only overloaded for `'number'` and `'boolean'` (returns `number | null` / `boolean | null`); there is no `null`-default overload for `'string'`. To express an optional string, call `env(key)` with no default — the no-default overload returns `string | null`.

`.env.example` mirrors every key — empty for secrets, sensible defaults for tunables. Commit it.

### container.ts

Child of the global tsyringe container. `registerSingleton(Class, Class)` for everything. Alphabetized for diffability.

```ts
import 'reflect-metadata'
import { container as globalContainer } from 'tsyringe'
import { Database } from './db/Database'
import { Http } from './http'
import { UserRepository } from './db/repositories/UserRepository'
import { UserService } from './services/UserService'
// import { Realtime } from './realtime/Realtime'

const container = globalContainer.createChildContainer()

container.registerSingleton(Database, Database)
container.registerSingleton(Http, Http)
// container.registerSingleton(Realtime, Realtime)
container.registerSingleton(UserRepository, UserRepository)
container.registerSingleton(UserService, UserService)

export default container
```

Service classes use constructor injection — never `new`, never `container.resolve` from inside a service:

```ts
import { inject, injectable } from 'tsyringe'

@injectable()
export class UserService {
    constructor(
        @inject(UserRepository) private users: UserRepository
    ) {}
}
```

Only `index.ts` and `routers/*` call `container.resolve(X)`. Don't use `container.register(...)` value/factory forms unless you have a real reason — `registerSingleton` covers ~95% of cases.

### http.ts

A `@injectable` class with `init` / `run` / `dispose`. Routers register under `/v1`. CORS is opt-in via env.

```ts
import fastify, { FastifyInstance, FastifyReply } from 'fastify'
import cors from '@fastify/cors'
import { HTTP } from '@toolcase/base'
import logging, { Logger } from '@toolcase/logging'
import { injectable } from 'tsyringe'
import { HTTP_PORT, HTTP_ALLOWED_ORIGINS } from './env'
import { healthRouter } from './routers/healthRouter'

const v1Router = async (instance: FastifyInstance): Promise<void> => {
    await instance.register(healthRouter)
    // await instance.register(userRouter, { prefix: '/users' })
}

const defaultRoute = (_: unknown, reply: FastifyReply) => {
    const out = new HTTP.RESTError(HTTP.Status.NOT_FOUND, 'not_found')
    return reply.status(out.status).send(out.toJSON())
}

const parseOrigins = (raw: string): string[] =>
    raw.split(',').map(v => v.trim()).filter(v => v.length > 0)

@injectable()
export class Http {

    public server!: FastifyInstance
    public logger: Logger = logging.getLogger('Http')

    async init(): Promise<void> {
        this.server = fastify({ trustProxy: true })
        const origins = parseOrigins(HTTP_ALLOWED_ORIGINS)
        await this.server.register(cors, {
            origin: origins.length > 0 ? origins : false,
            credentials: false
        })
        await this.server.register(v1Router, { prefix: '/v1' })
        this.server.setNotFoundHandler(defaultRoute)
    }

    async run(): Promise<void> {
        await this.server.listen({ host: '0.0.0.0', port: HTTP_PORT })
        this.logger.info(`listening on http://0.0.0.0:${HTTP_PORT}`)
    }

    async dispose(): Promise<void> {
        await this.server?.close()
    }
}
```

When Rivalis shares the port, swap the Fastify constructor for the `serverFactory` shape — see Recipes → "Real-time on the same port".

### routers/

A router is a Fastify plugin that resolves the services it needs from the container and binds handlers. Handlers do three things only: extract input → call service → format response. **Every response goes through `HTTP.RESTResponse` / `HTTP.RESTError` from `@toolcase/base`.**

```ts
// src/routers/userRouter.ts
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { HTTP } from '@toolcase/base'
import container from '../container'
import { UserService } from '../services/UserService'
import { AppError } from '../domain/errors'

export const userRouter = async (instance: FastifyInstance): Promise<void> => {
    const users = container.resolve(UserService)

    instance.get('/:id', async (req: FastifyRequest<{ Params: { id: string } }>, reply: FastifyReply) => {
        try {
            const user = await users.getById(req.params.id)
            const ok = new HTTP.RESTResponse(HTTP.Status.OK, user)
            return reply.status(ok.status).send(ok.toJSON())
        } catch (error) {
            return sendError(reply, error)
        }
    })
}

const sendError = (reply: FastifyReply, error: unknown): FastifyReply => {
    if (error instanceof AppError) {
        const out = new HTTP.RESTError(error.status, error.code)
        return reply.status(out.status).send(out.toJSON())
    }
    reply.log.error(error)
    const out = new HTTP.RESTError(HTTP.Status.INTERNAL_SERVER_ERROR, 'internal')
    return reply.status(out.status).send(out.toJSON())
}
```

Conventions:

- One router file per domain. Mounted under a sub-prefix in `v1Router`: `register(userRouter, { prefix: '/users' })`.
- Routers never `await` a DB query. They `await` services.
- Validate request bodies via Fastify JSON Schema OR a hand-written guard inside the handler — pick one and stick with it project-wide.
- The `sendError` helper is the **only** place `AppError` → HTTP mapping happens.

### domain/

Pure types, errors, value objects. No I/O, no React, no Fastify, no SQL. The innermost layer.

```ts
// src/domain/errors.ts
export class AppError extends Error {
    constructor(public readonly status: number, public readonly code: string, message?: string) {
        super(message ?? code)
    }
}

export class NotFoundError extends AppError {
    constructor(code = 'not_found') { super(404, code) }
}

export class ValidationError extends AppError {
    constructor(code = 'invalid_input') { super(400, code) }
}

export class UnauthorizedError extends AppError {
    constructor(code = 'unauthorized') { super(401, code) }
}

export class ForbiddenError extends AppError {
    constructor(code = 'forbidden') { super(403, code) }
}

export class ConflictError extends AppError {
    constructor(code = 'conflict') { super(409, code) }
}
```

Services throw `AppError` subclasses. Plain `Error` becomes a 500 every time — reserve that for unexpected failures.

### services/

Business logic. `@injectable` class per domain. Depends on repositories + other services via constructor injection. Returns domain DTOs (not raw DB rows). Throws `AppError` subclasses. Never imports `routers/`, `http.ts`, or `container`.

```ts
// src/services/UserService.ts
import { inject, injectable } from 'tsyringe'
import logging, { Logger } from '@toolcase/logging'
import { UserRepository } from '../db/repositories/UserRepository'
import { NotFoundError } from '../domain/errors'

@injectable()
export class UserService {

    public logger: Logger = logging.getLogger('UserService')

    constructor(@inject(UserRepository) private users: UserRepository) {}

    async getById(id: string) {
        const row = await this.users.findById(id)
        if (row === undefined) throw new NotFoundError('user_not_found')
        // map snake_case DB row → camelCase domain DTO (no auto case-conversion with raw SQL)
        return { id: row.id, email: row.email, displayName: row.display_name }
    }
}
```

Rules:

- Never call `container.resolve` from a service. Constructor injection only.
- Never call `fetch` directly — wrap external HTTP in a sibling service that owns the gateway concern.
- Map repository rows to a domain shape before returning. Don't leak `created_at`, internal flags, etc.

### db/

Raw SQL, with repositories built on `@toolcase/node` `BaseRepository`. **No ORM, no query builder.** Pick one driver per service: `pg` (`Pool`) for PostgreSQL, or native `node:sqlite` (`DatabaseSync`) for SQLite. The examples below are **pg-primary**; a `node:sqlite` variant follows each. Three things live here:

1. `Database.ts` — owns the query runner (`pg.Pool` or `DatabaseSync`) and exposes a `transaction()` (it doubles as the `TransactionClient` for `EntityService`).
2. `schema.ts` — the TypeScript mirror of the out-of-tree SQL schema (plain row interfaces, **snake_case** columns).
3. `repositories/<Domain>Repository.ts` — one per aggregate root, each `extends BaseRepository<Row, QueryRunner>`.

**`db/migrations/`, `db/migrate.ts`, `migrate:up` script — all forbidden.** Schema is owned by the out-of-tree `migrations/<db>/` directory (managed via goose or your team's chosen tool) and is applied as a deploy step. When the SQL changes, update `schema.ts` here in the same PR.

#### db/Database.ts (pg)

```ts
import { Pool, type PoolClient } from 'pg'
import { injectable } from 'tsyringe'
import logging, { Logger } from '@toolcase/logging'
import {
    PG_DATABASE, PG_HOST, PG_PASSWORD, PG_POOL_MAX,
    PG_PORT, PG_SCHEMA, PG_USER,
} from '../env'

// What repositories run queries against. Both Pool and a checked-out PoolClient
// expose the same `.query(text, params)` — so a verb works inside or outside a transaction.
export type QueryRunner = Pool | PoolClient

@injectable()
export class Database {

    public logger: Logger = logging.getLogger('Database')
    public pool!: Pool

    async init(): Promise<void> {
        this.pool = new Pool({
            host: PG_HOST,
            port: PG_PORT,
            user: PG_USER,
            password: PG_PASSWORD,
            database: PG_DATABASE,
            max: PG_POOL_MAX,
            idleTimeoutMillis: 30_000,
            options: PG_SCHEMA.length > 0 ? `-c search_path=${PG_SCHEMA},public` : undefined,
        })

        this.pool.on('error', (error) => {
            this.logger.error('idle pool client error', error)
        })

        await this.pool.query('SELECT 1')
        this.logger.info(`connected to ${PG_HOST}:${PG_PORT}/${PG_DATABASE} (schema=${PG_SCHEMA})`)
    }

    async dispose(): Promise<void> {
        await this.pool?.end()
    }

    // Checks out one client, wraps the body in BEGIN/COMMIT/ROLLBACK, hands the client
    // to repository verbs as `trx`. Hand the Database itself to EntityService as its TransactionClient.
    async transaction<T>(fn: (trx: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.pool.connect()
        try {
            await client.query('BEGIN')
            const result = await fn(client)
            await client.query('COMMIT')
            return result
        } catch (error) {
            await client.query('ROLLBACK')
            throw error
        } finally {
            client.release()
        }
    }
}
```

#### db/Database.ts (node:sqlite variant)

`node:sqlite` is **synchronous** and ships with Node (20.6+ behind `--experimental-sqlite`, stable in newer releases). One `DatabaseSync` instance is the runner; there is no pool. Env: `SQLITE_PATH` instead of the `PG_*` block.

```ts
import { DatabaseSync } from 'node:sqlite'
import { injectable } from 'tsyringe'
import logging, { Logger } from '@toolcase/logging'
import { SQLITE_PATH } from '../env'

// Repositories run queries via DatabaseSync.prepare(sql).all/get/run(...). Synchronous API.
export type QueryRunner = DatabaseSync

@injectable()
export class Database {

    public logger: Logger = logging.getLogger('Database')
    public db!: DatabaseSync

    async init(): Promise<void> {
        this.db = new DatabaseSync(SQLITE_PATH)
        this.db.exec('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;')
        this.db.prepare('SELECT 1').get()                 // fail fast on a bad path
        this.logger.info(`connected to ${SQLITE_PATH}`)
    }

    async dispose(): Promise<void> {
        this.db?.close()
    }

    // node:sqlite is synchronous, so the "trx" handed to verbs is the same DatabaseSync —
    // the BEGIN/COMMIT wrapping is what makes the body atomic. No nested transactions.
    async transaction<T>(fn: (trx: DatabaseSync) => Promise<T>): Promise<T> {
        this.db.exec('BEGIN')
        try {
            const result = await fn(this.db)
            this.db.exec('COMMIT')
            return result
        } catch (error) {
            this.db.exec('ROLLBACK')
            throw error
        }
    }
}
```

Conventions:

- **One DB handle per process** — one `pg.Pool` or one `DatabaseSync`, owned by `Database`. Don't construct a second elsewhere. If a `worker_threads` child needs DB access, give it its own handle — neither `pg.Pool` nor `DatabaseSync` is safe across thread boundaries.
- **No auto case-conversion.** Without a query builder there's no `CamelCasePlugin` — SQL columns stay `snake_case` through the repository, and the **service** maps a row to a camelCase DTO (see `services/`). Don't sprinkle case-mapping across repos.
- **`PG_SCHEMA` defaults to `public`** (pg only). For a multi-service shared cluster, give each service its own schema and set `search_path` here.
- `init()` does a `SELECT 1` to fail fast. pg: no reconnect logic — `pg.Pool` reconnects automatically; if the DB is down at boot, let the supervisor restart the process. sqlite: a bad path throws here.

#### db/schema.ts

The single source of truth (in TypeScript) for what tables exist and what columns they have. Mirrors the out-of-tree SQL. With raw SQL there are **no Kysely helper types** — just plain interfaces with `snake_case` keys matching the columns, plus narrow insert/update shapes the repository accepts.

```ts
export interface UserRow {
    id: string
    email: string
    display_name: string
    created_at: Date
    updated_at: Date
}

// What the repo's insert/update verbs accept — omit DB-managed columns (id, timestamps).
export type NewUser = { email: string; display_name: string }
export type UserUpdate = Partial<Pick<UserRow, 'email' | 'display_name'>>
```

Rules:

- **snake_case keys** matching the SQL columns exactly. No magic translation — what you `SELECT` is what the row has.
- **Row type = read shape.** A separate `New*` type lists the columns an insert supplies; `*Update` is the patchable subset. DB-managed columns (serial/uuid PKs, `created_at`, `updated_at`) are not in the insert type.
- **JSON columns** — pg `jsonb` returns a parsed object from `pg` already; type it as the parsed shape (`type Prefs = {...}`). sqlite stores JSON as `TEXT` — type it `string` and `JSON.parse` in the service, or store the parsed shape and stringify on write. Be explicit; there's no round-trip helper.
- **Dates** — pg returns `Date` for `timestamptz`. sqlite has no date type; store epoch millis (`INTEGER`) or ISO `TEXT` and type the column accordingly.

#### db/repositories/

One repository per aggregate root. `@injectable`. One job: turn a business-meaningful method call into a parameterized SQL statement and return a row or domain type.

```ts
// src/db/repositories/UserRepository.ts (pg)
import { inject, injectable } from 'tsyringe'
import { BaseRepository, type Filter } from '@toolcase/node'
import { Database, type QueryRunner } from '../Database'
import type { NewUser, UserRow, UserUpdate } from '../schema'

// Driver = QueryRunner (pg Pool | PoolClient). `run(trx)` returns the trx the service
// passes (a PoolClient inside a transaction), else the base Pool. Implement the verbs
// you use with parameterized SQL; the composition verbs
// (findByIdOrThrow, updateMany, deleteMany, …) are inherited from BaseRepository.
@injectable()
export class UserRepository extends BaseRepository<UserRow, QueryRunner> {

    constructor(@inject(Database) database: Database) {
        super(database.pool, 'users', 'id')
    }

    async insert(values: NewUser, trx?: QueryRunner): Promise<UserRow> {
        return this.time('insert', async () => {
            const { rows } = await this.run(trx).query<UserRow>(
                `INSERT INTO users (email, display_name) VALUES ($1, $2) RETURNING *`,
                [values.email, values.display_name],
            )
            return rows[0]
        })
    }

    async findById(id: string, trx?: QueryRunner): Promise<UserRow | undefined> {
        const { rows } = await this.run(trx).query<UserRow>(
            `SELECT * FROM users WHERE id = $1`, [id],
        )
        return rows[0]
    }

    async updateById(id: string, patch: UserUpdate, trx?: QueryRunner): Promise<UserRow | undefined> {
        // Column names come from a fixed allow-list (the patch keys are typed), NEVER raw input.
        const cols = Object.keys(patch) as (keyof UserUpdate)[]
        if (cols.length === 0) return this.findById(id, trx)
        const sets = cols.map((c, i) => `${c} = $${i + 2}`).join(', ')
        const { rows } = await this.run(trx).query<UserRow>(
            `UPDATE users SET ${sets}, updated_at = now() WHERE id = $1 RETURNING *`,
            [id, ...cols.map(c => patch[c])],
        )
        return rows[0]
    }

    async deleteById(id: string, trx?: QueryRunner): Promise<number> {
        const result = await this.run(trx).query(`DELETE FROM users WHERE id = $1`, [id])
        return result.rowCount ?? 0
    }

    // findOne translates the engine-neutral Filter into a parameterized WHERE. Support only
    // the operators you expose; allow-list columns — never interpolate a field name from input.
    async findOne(where: Filter<UserRow>, trx?: QueryRunner): Promise<UserRow | undefined> {
        const cols = Object.keys(where)
        const clause = cols.map((c, i) => `${c} = $${i + 1}`).join(' AND ')   // eq-only example
        const { rows } = await this.run(trx).query<UserRow>(
            `SELECT * FROM users${clause ? ` WHERE ${clause}` : ''} LIMIT 1`,
            cols.map(c => (where as any)[c]),
        )
        return rows[0]
    }

    // Custom domain finder — builds on findOne.
    findByEmail(email: string, trx?: QueryRunner) {
        return this.findOne({ email } as Filter<UserRow>, trx)
    }
}
```

**node:sqlite variant** — same structure, `DatabaseSync` runner, `?` placeholders, synchronous `prepare().get/all/run`:

```ts
// super(database.db, 'users', 'id')   ← runner is the DatabaseSync

async insert(values: NewUser, trx?: QueryRunner): Promise<UserRow> {
    return this.time('insert', async () =>
        this.run(trx).prepare(
            `INSERT INTO users (email, display_name) VALUES (?, ?) RETURNING *`,
        ).get(values.email, values.display_name) as UserRow)
}

async findById(id: string, trx?: QueryRunner): Promise<UserRow | undefined> {
    return this.run(trx).prepare(`SELECT * FROM users WHERE id = ?`).get(id) as UserRow | undefined
}

async deleteById(id: string, trx?: QueryRunner): Promise<number> {
    const info = this.run(trx).prepare(`DELETE FROM users WHERE id = ?`).run(id)
    return Number(info.changes)
}
```

Rules:

- **Extend `BaseRepository<Row, QueryRunner>`.** Pass the runner (`database.pool` for pg, `database.db` for sqlite) as the driver in `super(...)`. Implement the leaf verbs you use (`insert`, `findById`, `findOne`, `updateById`, `deleteById`, plus `findMany`/`paginate` for list endpoints). The 6 composition verbs (`findByIdOrThrow`, `findOneOrThrow`, `updateByIdOrThrow`, `updateMany`, `deleteByIdOrThrow`, `deleteMany`) are inherited — **never re-implement them.**
- **`run(trx)` resolves the handle** — the `trx` the service passes (a `PoolClient` mid-transaction, or the same `DatabaseSync`), else the base runner. Every verb takes the optional `trx: QueryRunner` last. No AsyncLocalStorage, no ambient-transaction tricks.
- **Parameterize every value.** pg uses `$1, $2, …`; sqlite uses `?`. NEVER string-concatenate a value into SQL — that's an injection. Column/table names are not parameterizable, so they must come from a fixed allow-list in code, never from request input.
- **Wrap verbs in `this.time(label, fn)`** so slow-query logging + the `onOperation` hook fire (configure `slowQueryMs` / `logger` / `onOperation` via the options arg of `super(...)`).
- **Translate `Filter` / `Sort` to SQL** inside `findOne` / `findMany` / `paginate`. Support only the operators you expose; a shared `buildWhere(where)` / `buildOrder(orderBy)` helper that returns `{ clause, params }` keeps it DRY and keeps the allow-list in one place. These are the same `Filter` / `Sort` that `RESTRouteHandler` parses from the query string — implement them and a domain gets CRUD+list endpoints for free.
- **Return materialized rows** — `rows[0]` / `rows` (pg), `.get()` / `.all()` (sqlite). Never return a half-built query string or a statement handle.
- **No business logic.** "If admin then X" belongs in the service.
- **Return `undefined` for not-found** from the leaf verbs; the service maps it to a domain `AppError` (the blueprint pattern). The inherited `*OrThrow` verbs raise `@toolcase/node`'s `NotFoundError` instead — if you call them, teach the router's `sendError` to map `@toolcase/node` errors via `errorMeta`, or stick to the non-throwing verbs.
- **`RETURNING *` on insert/update** (both pg and modern sqlite support it) so the verb returns the full row in one round-trip. For inserts assert non-null (`rows[0]` / `as UserRow`) — `INSERT ... RETURNING *` always yields a row.
- **Joins** — write the SQL and declare a return-type alias next to the method (raw rows aren't inferred). `SELECT u.*, o.name AS org_name ...` → type the alias to match the projection.
- **No `SELECT *` in hot paths.** `SELECT *` reads well but an explicit column list is faster, narrower, and makes future column additions opt-in. No compile-time check ties SQL to `schema.ts` — keep column names in sync by hand.

### realtime/ (optional)

Present only when the service needs real-time. The Rivalis instance is wrapped in a `@injectable` class so the boot script can sequence it.

Two integration shapes:

- **Same port as Fastify** — REST under `/v1/*` + WS under `/realtime` on `HTTP_PORT`. Build Fastify on top of an existing `http.createServer()` and hand that same `http.Server` to `Transports.WSTransport`. See Recipes.
- **Separate port** — `WS_PORT` runs its own `http.createServer()`. Use when REST and WS have very different scaling needs.

```ts
// src/realtime/Realtime.ts (same-port shape)
import { inject, injectable } from 'tsyringe'
import { Rivalis, Transports } from '@rivalis/core'
import logging, { Logger } from '@toolcase/logging'
import { Http } from '../http'
import { ChatAuth } from './auth/ChatAuth'
import { ChatRoom } from './rooms/ChatRoom'

type ActorData = { userId: string; name: string }

@injectable()
export class Realtime {

    public logger: Logger = logging.getLogger('Realtime')
    private rivalis!: Rivalis<ActorData>

    constructor(@inject(Http) private http: Http) {}

    async init(): Promise<void> {
        // NOTE: `this.http.httpServer` only exists in the same-port `http.ts` shape — the
        // `serverFactory` variant in Recipes → "Real-time on the same port" exposes the raw
        // `http.Server`. The default `http.ts` contract above exposes only `this.server`
        // (the FastifyInstance), not `httpServer`. Switch `http.ts` to the same-port shape first.
        this.rivalis = new Rivalis<ActorData>({
            transports: [new Transports.WSTransport(
                { server: this.http.httpServer, path: '/realtime' },
                null,
                { ticketSource: 'protocol' }
            )],
            authMiddleware: new ChatAuth(),
        })
        this.rivalis.rooms.define('chat', ChatRoom)
        this.rivalis.rooms.create('chat', 'global')
    }

    async dispose(): Promise<void> {
        await this.rivalis?.shutdown()
    }
}
```

Rules pulled from the `rivalis` skill — apply unconditionally:

- **One Rivalis instance per process.** Multiple instances fight over the shared `http.Server`'s `upgrade` event. Define multiple rooms on the one instance instead.
- **Always `define` then `create`.** No auto-creation. Authentication's `roomId` must match a created room id.
- **Tickets via `Sec-WebSocket-Protocol`** in production. `ticketSource: 'protocol'` on both server `WSTransportOptions` and client `WSClientOptions`. URL-bearer tickets land in access logs.
- **Constant-time ticket comparison** — `crypto.timingSafeEqual`. Never `===` or `Buffer.compare`.
- **Default rate limiter is opt-out.** `new Rivalis({...})` ships with a `TokenBucket` (30 cap / 30 refill/sec). Pass `rateLimiter: null` only with a reason.
- **Topic prefix `__` is reserved.** Pick app topics that don't start with `__`. The framework owns `__presence:join` / `__presence:leave`.
- **Throwing from a handler does not kick.** Validate inputs explicitly and call `actor.kick(KickReason.INVALID_MESSAGE)` when appropriate.
- **`path` is mandatory in same-port shape.** Without it, the WS transport tries to upgrade *every* request and Fastify routes can't reach the handler.

For room patterns (presence chat, server-authoritative state, turn-based, fixed-rate tick), `AuthMiddleware` shapes, custom `RateLimiter`, close codes, and the typed browser `WSClient` API: invoke the `rivalis` skill.

### wire/ (optional)

`@toolcase/serializer` schemas — runtime-defined protobuf, no `.proto` build step. Use when the wire format is binary (paired with Rivalis topics) or persisted as compact bytes. Skip for JSON HTTP payloads.

```ts
// src/wire/serializer.ts
import Serializer from '@toolcase/serializer'

export interface ChatMessage {
    userId: string
    text: string
    sentAt: number
}

export const wire = new Serializer('app')

wire.define('ChatMessage', [
    { key: 'userId', type: Serializer.FieldType.STRING, rule: 'optional' },
    { key: 'text', type: Serializer.FieldType.STRING, rule: 'optional' },
    { key: 'sentAt', type: Serializer.FieldType.UINT64, rule: 'optional' },
])

// encode/decode at call sites:
//   const bytes = wire.encode('ChatMessage', message)
//   const decoded = wire.decode('ChatMessage', bytes) as unknown as ChatMessage
```

Rules:

- Tag ids are assigned by `define()` insertion order (1, 2, 3…). Adding a field = append; never reorder, never remove.
- One `Serializer` instance per project (or per wire surface). Field tag uniqueness is per-type, not per-instance — but mixing many unrelated types in one instance gets unwieldy.
- For versioned wire surfaces: `wire.version(major, minor)` + `wire.encodeVersioned` / `decodeVersioned` + `wire.migrate(key, fromMajor, handler)`. The 2-byte version header is prepended on encode, parsed and migrated forward on decode.
- For fragmented transport (over rate-limited or MTU-bound channels): `wire.fragment(buffer, maxChunkSize)` → `Uint8Array[]` with an 8-byte header per chunk, `wire.reassemble(chunks)` on the receive side.
- The serializer is for **compact bytes**, not validation. Validate semantics in the service layer (or call `wire.validate(key, message)` for a structural check).

### util/

Cross-cutting pure helpers. No I/O, no `inject`. Reach for `@toolcase/base` first (`generateId`, `retry`, `Cache`, hex/byte/range helpers, `JSONSchema`) before writing your own. Examples: `parseDuration.ts`, `clock.ts`, `hash.ts`.

---

## Cross-Cutting Patterns

### Logging

One named logger per class, declared as a public field. Name = the class:

```ts
public logger: Logger = logging.getLogger('UserService')
```

Configure level + reporters once at boot if defaults aren't enough — in `index.ts` before resolving services. No `console.log` in production paths. Pass `Error` instances to `logger.error('context', error)`, not stringified.

**`warning` vs `warn` mismatch when wiring a `@toolcase/logging` logger into `@toolcase/node`.** `@toolcase/logging`'s `Logger` exposes `warning(...)` — there is no `.warn`. But `@toolcase/node`'s `BaseRepository` (slow-query log) and `HttpServer` call `logger.warn?.(...)`. Passing a raw `@toolcase/logging` logger as the repository/server `logger` option means every `warn` call no-ops silently (warnings drop). Adapt the surface when wiring: pass an object that maps `warn` → the logging logger's `warning` (e.g. `{ ...logger, warn: (...a) => logger.warning(...a) }`), or a thin wrapper exposing `warn`/`debug`/`error`. Don't assume the two `.warn`/`.warning` names line up.

### Env loading

Every env access goes through `env<T>(name, default, type)` from `@toolcase/node` in `src/env.ts`. Never read `process.env.X` ad-hoc from a service or repository — it bypasses the type and the default and makes test harnessing impossible.

### Errors

- Service throws `AppError` subclass.
- Router's `sendError` maps it to `HTTP.RESTError`.
- Plain `Error` from a service = 500 + log. That's correct behavior for unexpected failures; don't silence it.
- Repositories don't throw `AppError` — they return `undefined` for not-found, let the driver throw on actual DB errors.

### Transactions

The clean pattern: repositories accept an optional `trx?: QueryRunner` last; services compose a transaction and pass `trx` through. No ambient/AsyncLocalStorage tricks.

```ts
@injectable()
export class SignupService {
    constructor(
        @inject(Database) private database: Database,
        @inject(UserRepository) private users: UserRepository,
        @inject(AuditRepository) private audits: AuditRepository,
    ) {}

    async signUp(input: SignupInput) {
        return this.database.transaction(async (trx) => {       // trx: PoolClient (pg) | DatabaseSync (sqlite)
            const user = await this.users.insert(input, trx)
            await this.audits.recordSignup(user.id, trx)
            return user
        })
    }
}
```

**pg** default isolation is `read committed`. For read-then-write-based-on-the-read (decrement-and-check, conditional insert), raise it inside the transaction body — issue `SET TRANSACTION ISOLATION LEVEL SERIALIZABLE` as the first statement after `BEGIN`:

```ts
await this.database.transaction(async (trx) => {
    await trx.query('SET TRANSACTION ISOLATION LEVEL SERIALIZABLE')
    // ...read, then write based on the read
})
```

**sqlite** is single-writer (one `DatabaseSync`, serialized writes), so there's no isolation level to set — a `BEGIN`-wrapped body is already atomic. For read-then-write under WAL, use `BEGIN IMMEDIATE` to take the write lock up front and avoid a mid-transaction `SQLITE_BUSY`.

### Real-time auth

The standard ticket flow:

1. Browser calls a small REST endpoint (`POST /v1/realtime/ticket`) on the Fastify side, authenticated however the rest of the API is.
2. Server mints a short-lived ticket (signed JWT or HMAC of `{userId, roomId, exp}`), returns it.
3. Browser opens WS and sends the ticket via `Sec-WebSocket-Protocol` (the `@rivalis/browser` `WSClient` does this when configured with `ticketSource: 'protocol'`).
4. Server `AuthMiddleware.authenticate(ticket)` verifies, returns `{ data: { userId, name }, roomId }`.

Make the ticket single-use friendly with an LRU cache of seen JTIs in the auth middleware.

### Health endpoint (always)

Every service exposes `GET /v1/health`. The DB check is a `SELECT 1`. Don't add deeper readiness checks until ops asks.

```ts
// src/routers/healthRouter.ts
import type { FastifyInstance } from 'fastify'
import container from '../container'
import { Database } from '../db/Database'
import { ENVIRONMENT, SERVICE_NAME } from '../env'

export const healthRouter = async (instance: FastifyInstance): Promise<void> => {
    const db = container.resolve(Database)
    instance.get('/health', async (_req, reply) => {
        let dbOk = true
        try { await db.pool.query('SELECT 1') }          // sqlite: db.db.prepare('SELECT 1').get()
        catch { dbOk = false }
        return reply
            .status(dbOk ? 200 : 503)
            .send({ status: dbOk ? 'ok' : 'db_unavailable', service: SERVICE_NAME, environment: ENVIRONMENT })
    })
}
```

### Layering call flow

```
HTTP request
  → router (validate shape, resolve service)
    → service (business rule, throw AppError, compose transaction)
      → repository (parameterized SQL, return materialized row)
        → Database (pg.Pool | node:sqlite DatabaseSync)
```

Skipping a layer is a smell. Routers don't import repositories. Services don't import Fastify. Repositories don't import services.

---

## Recipes

### Add a new domain (table + repo + service + router)

1. **Migration first** — write the SQL in `<repo>/migrations/<db>/`. Apply it (deploy step / local goose).
2. **Schema mirror** — add the `snake_case` `Row` interface + the `New*` / `*Update` shapes to `src/db/schema.ts`.
3. **Repository** — `src/db/repositories/<Domain>Repository.ts`, `extends BaseRepository<Row, QueryRunner>`. Implement the verbs you use (`insert`, `findById`, `findOne`, `updateById`, `deleteById`, plus `findMany`/`paginate` for list endpoints) with parameterized SQL; the composition verbs are inherited. Add any business-meaningful query (`findActiveSince`, `listByOwner`). Each accepts optional `trx: QueryRunner`.
4. **Domain types/errors** — if the domain has its own errors (e.g. `QuotaExceededError`), add to `domain/errors.ts`.
5. **Service** — `src/services/<Domain>Service.ts`. `@injectable`, constructor-injects the repo, throws `AppError` subclasses, returns mapped DTOs.
6. **Router** — `src/routers/<domain>Router.ts`. Register inside `v1Router` with `{ prefix: '/<domain>' }`.
7. **Container** — register the new repo + service in `container.ts` (alphabetized).

### Add an HTTP route to an existing domain

1. Add the method to the existing service (don't proliferate services per route).
2. Add the handler to the existing router file. Same `extract → call → respond` shape.
3. Use `HTTP.RESTResponse` for success and let the existing `sendError` handle failures.

### Add real-time to an existing service

1. Add `@rivalis/core` to deps (and an env var or two: `WS_TICKET_SECRET`, optionally `WS_PORT`).
2. Pick the integration shape — same port (use `serverFactory` in `http.ts`) or separate port.
3. Create `src/realtime/Realtime.ts`, `src/realtime/rooms/<Name>Room.ts`, `src/realtime/auth/<Name>Auth.ts`.
4. Register `Realtime` in `container.ts`.
5. Wire `realtime.init()` between `http.init()` and `http.run()` in `index.ts`. Wire `realtime.dispose()` first in `shutdown()`.
6. Add `POST /v1/realtime/ticket` to a Fastify router for ticket minting.
7. Read `rivalis/SKILL.md` (and `auth-and-security.md`, `protocol-and-codes.md`) for the room/auth shapes.

### Add a binary wire format

1. Create `src/wire/serializer.ts` with `new Serializer('app')` and one `wire.define(key, fields)` call per message type.
2. Encode in the service or room before `actor.send(topic, bytes)` (or `actor.broadcast(topic, bytes)`); decode on receipt.
3. Append new fields at the end of the field array. Tags are positional — never reorder or remove. For breaking changes, use `wire.version(...)` + `encodeVersioned` / `migrate`.

### Scaffold a new project

1. Decide placement (your repo's `services/<name>/` for user-facing APIs, `workers/<name>/` for jobs/integrations — adapt to your monorepo convention).
2. Create the workspace files: `package.json` (`"type": "module"`, scripts `build`/`dev`), `tsconfig.json` (decorators on, strict on), `tsup.config.ts` (single ESM entry, `createRequire` banner), `Dockerfile` (multi-stage `node:20-alpine`), `.dockerignore`, `.gitignore`, `.env.example`.
3. `npm install` — deps: `@fastify/cors`, `fastify`, `reflect-metadata`, `tsyringe`, `@toolcase/base`, `@toolcase/logging`, plus **one DB driver**: `pg` (+ devDep `@types/pg`) for Postgres, or nothing for `node:sqlite` (built into Node). devDeps: `@swc/core`, `tsup`, `typescript`. Optional: `@rivalis/core`, `@toolcase/serializer`, `jose`, `@aws-sdk/client-s3`.
4. Create `src/env.ts` with all required env vars.
5. Decide the database (existing or new). If new: create the out-of-tree `migrations/<db>/` set and apply the initial schema **before** writing repositories.
6. Create `src/db/schema.ts` mirroring the SQL.
7. Create `src/db/Database.ts`, `src/http.ts`, `src/routers/healthRouter.ts`.
8. Create `src/container.ts` (Database + Http registered).
9. Create `src/index.ts` with the boot sequence.
10. `npm run build && npm run dev`. Hit `GET /v1/health` to confirm DB connectivity.
11. Then add the first domain via "Add a new domain". Don't merge layers.

### Real-time on the same port (Fastify + Rivalis)

Modify `http.ts` to expose the underlying `http.Server` so `WSTransport` can attach to it:

```ts
import http from 'node:http'
import fastify, { FastifyInstance } from 'fastify'
import { injectable } from 'tsyringe'
import { HTTP_PORT } from './env'

@injectable()
export class Http {
    public server!: FastifyInstance
    public httpServer!: http.Server

    async init(): Promise<void> {
        this.httpServer = http.createServer()
        this.server = fastify({
            serverFactory: (handler) => {
                this.httpServer.on('request', handler)
                return this.httpServer
            },
            trustProxy: true,
        })
        // ...register cors + v1Router as usual
    }

    async run(): Promise<void> {
        await this.server.ready()
        await new Promise<void>((resolve, reject) => {
            this.httpServer.listen(HTTP_PORT, '0.0.0.0', (err?: Error) => {
                if (err) reject(err); else resolve()
            })
        })
    }
}
```

Boot order: `http.init()` → `realtime.init()` (attaches `upgrade` listener to `http.httpServer`) → `http.run()`.

---

## Anti-Patterns

- ❌ `import 'reflect-metadata'` missing or not first in `index.ts`. → DI silently broken.
- ❌ Service calling `container.resolve(...)`. → Use constructor injection. `resolve` is for `index.ts` and routers only.
- ❌ Service instantiating `new XxxRepository()`. → Inject it.
- ❌ Router running SQL / importing a repository. → Push to a service.
- ❌ Returning raw DB row types from a router. → Map to a DTO in the service.
- ❌ Throwing raw `Error` from a service when the situation is a known business case. → Use an `AppError` subclass.
- ❌ Migrations inside the project (`db/migrations/`, `migrate.ts`, `migrate:up`). → Out-of-tree only.
- ❌ Calling `migrator.migrateToLatest()` from `index.ts`. → Concurrent boot races the version table. Migrate as a deploy step.
- ❌ Multiple `pg.Pool` / `DatabaseSync` instances in one process. → One handle, owned by `Database`.
- ❌ Sharing a `pg.Pool` / `DatabaseSync` across `worker_threads`. → Each worker owns its own handle.
- ❌ Running the driver (`pool.query` / `db.prepare`) outside `Database.ts` or a repository. → SQL lives in repositories; the raw handle lives in `Database.ts`.
- ❌ String-concatenating a value into SQL. → Parameterize (`$1`/`?`). Column/table names from a fixed allow-list only.
- ❌ Expecting camelCase rows. → Raw SQL has no `CamelCasePlugin`; rows are `snake_case`, the service maps to a camelCase DTO.
- ❌ `synchronize: true`-style auto-schema. → ORM concept; doesn't exist here.
- ❌ Reading `process.env.X` outside `src/env.ts`. → All env access goes through the typed helper.
- ❌ `console.log` for diagnostics. → `logging.getLogger('Component')`.
- ❌ Hand-rolling `ws` / `socket.io` / `colyseus`. → Rivalis when the surface is rooms/presence/tick. Plain Fastify SSE / `@fastify/websocket` only for one-way streams.
- ❌ Multiple Rivalis instances in one process. → One instance, many rooms.
- ❌ `ticketSource: 'query'` (URL ticket) in production. → `'protocol'` only.
- ❌ Constant-time ticket compare with `===` / `Buffer.compare`. → `crypto.timingSafeEqual`.
- ❌ Topics starting with `__`. → Reserved by the framework.
- ❌ Adding a top-level `src/` folder beyond the documented set without justification.
- ❌ Returning a query string / statement handle from a repository. → Materialize inside the verb (`rows[0]` / `.get()` / `.all()`).
- ❌ Re-implementing `BaseRepository`'s composition verbs (`findByIdOrThrow`, `updateMany`, `deleteMany`, …). → Inherited; implement only the leaf verbs they call.
- ❌ A repository that doesn't extend `BaseRepository`. → Repositories are `BaseRepository<Row, QueryRunner>` subclasses — that's how they plug into `EntityService` / `RESTRouteHandler`.
- ❌ Dropping the `RETURNING *` on an insert and re-`SELECT`ing for the new row. → One round-trip with `RETURNING *`.
- ❌ `WHERE` clauses in services. → Push down into a named repository method.
- ❌ Forgetting that pg `jsonb` reads back as a parsed object but sqlite JSON-as-`TEXT` does not. → Type the column for the driver; `JSON.parse`/`stringify` explicitly in the service for sqlite.
