# Existing `@toolcase/node` API

Reference inventory for everything currently exported from `node/src/main.ts` (and the isomorphic subset from `node/src/main.iso.ts`). Use to pick the right primitive before scaffolding a new one. **Reuse before reinvent.**

Source of truth: `node/src/main.ts` exports + `examples/public/node/SKILL.md` documented API. If something listed here is missing from those, treat this doc as stale and refresh as part of your task.

Peer-dep matrix (from `node/package.json`):

| Surface | Required peers |
|---|---|
| utils + errors (sanitize, pagination, where, orderBy, domain errors), `env` | `@toolcase/base` |
| `RouteHandler`, `Router`, `HttpServer` | `@toolcase/base`, `fastify`, `@fastify/cors` |
| `BaseRepository`, `SoftDeleteRepository`, `EntityService` | `@toolcase/base`, `kysely` |
| `KVService` (and sub-classes) | `@toolcase/base`, `@toolcase/serializer`, `redis` |
| `ImageProcessor`, `AtlasBuilder` | `@toolcase/base`, `sharp` |
| `oauth2/*` (random, flow, grants, resource, profiles) | `@toolcase/base` |
| `oauth2/oidc` (`fetchOIDCDiscovery`, `verifyIdToken`, `oidcProvider`) | `@toolcase/base`, `jose` |

---

## env (Node-only)

### `env` — typed env-var reader

`env<T>(key, defaultValue?, type: 'string' | 'number' | 'boolean' = 'string'): T`. Throws `'env works only with NodeJS'` if `globalThis.process` is undefined.

| Type | Behavior |
|---|---|
| `'number'` | `parseInt(value, 10)`; falls back to `defaultValue` if parsed integer's string form ≠ original |
| `'boolean'` | case-insensitive `'true'`/`'false'`; otherwise `defaultValue` |
| `'string'` | passes through; `defaultValue` if undefined |

**Use when:** reading any `process.env.*` value with a typed fallback.
**Skip when:** you need a schema-validated env (no built-in here — compose with `JSONSchema` from `@toolcase/base`).

**File:** `node/src/env.ts` (Node-only — uses `globalThis.process`).

---

## Errors (isomorphic)

Single file: `node/src/errors.ts`. All error classes inherit from `LibError`. Pick the right parent when adding a new one.

### Tree

```
LibError
├── RepositoryError
│   ├── NotFoundError(resource, identifier)
│   ├── ConflictError(resource, message?)
│   └── OptimisticLockError(resource, expectedVersion, actualVersion)
├── KVServiceError
│   ├── LockNotAcquiredError(key)
│   └── RateLimitedError(key, resetInSeconds)
└── EndpointError(statusCode, code, message)
    └── ValidationError(message, details?)
```

### Helpers

| Function | Returns | Notes |
|---|---|---|
| `isLibError(e)` | `e is LibError` | runtime guard |
| `statusCodeFromError(e)` | `number \| null` | maps known errors → HTTP status |

`statusCodeFromError` mapping: `EndpointError` → `error.statusCode`; `NotFoundError` → 404; `ConflictError` / `OptimisticLockError` → 409; `RateLimitedError` → 429; `LockNotAcquiredError` → 423.

**Use when:** signaling domain-level failures from repos, KV, or endpoint handlers.
**Skip when:** the failure is a programmer bug (use plain `Error`) or framework-level (let Fastify handle).

---

## Utils (isomorphic — re-exported from `main.iso.ts`)

### `Logger` — logger interface contract

`interface Logger { debug?, info?, warn?, error? }`. Every method takes `(message: string, meta?: Record<string, unknown>) => void`.

**Use when:** typing a logger parameter on any class that wants to be logger-agnostic. Concrete reporters live in `@toolcase/logging`.
**Skip when:** you actually need a working logger — bring `@toolcase/logging`.

**File:** `node/src/utils/logger.ts`.

---

### Pagination — `Page<T>` / `CursorPage<T>` envelopes

```ts
const DEFAULT_OFFSET = 0
const DEFAULT_LIMIT = 25
const DEFAULT_MAX_LIMIT = 1000

interface PaginationInput { offset?: number; limit?: number }
interface PaginationOptions { defaultLimit?: number; maxLimit?: number; strict?: boolean }
interface Page<T> { results: T[]; pagination: { offset, limit, count } }
interface CursorPage<T> { results: T[]; nextCursor: string | null; hasMore: boolean }

function normalizeOffsetLimit(p?, o?): { offset, limit }
function buildPage<T>(results, count, offset, limit): Page<T>
```

**Use when:** any list endpoint or repository method that needs offset/limit normalization or a consistent page envelope.
**Skip when:** you need full GraphQL Relay-style paging (this is offset+limit / opaque-cursor, no edges/pageInfo).

**File:** `node/src/utils/pagination.ts`.

---

### Where — `WhereClause<T>` + `applyWhere`

```ts
type WhereOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike' | 'in' | 'notIn' | 'isNull' | 'isNotNull'
type WhereValue<V> = V | V[] | null | { [op in WhereOp]?: ... }
type WhereClause<T> = { [K in keyof T]?: WhereValue<T[K]> }

function applyWhere<Q>(qb: Q, where: Record<string, unknown>): [Q, empty: boolean]
```

`empty === true` when `{col: []}` or `{col: {in: []}}` — short-circuit in caller.

**Use when:** translating a validated request filter into a Kysely (or any whereable QB) query.
**Skip when:** ad-hoc raw SQL — use `kysely.sql\`…\``.

**File:** `node/src/utils/where.ts`.

---

### OrderBy — `applyOrderBy`

```ts
interface OrderByColumn<T> { column: keyof T & string; direction?: 'asc' | 'desc'; nulls?: 'first' | 'last' }
type OrderBy<T> = (keyof T & string) | OrderByColumn<T>

function applyOrderBy<Q, T>(qb: Q, ord: OrderBy<T> | OrderBy<T>[]): Q
```

**Use when:** applying typed sort spec onto a query builder.
**Skip when:** sort is dynamic SQL fragments — use Kysely directly.

**File:** `node/src/utils/orderBy.ts`.

---

### Sanitize — pluggable input/output/query sanitizer

```ts
interface FieldRule {
    private?: boolean       // strip on output AND query
    writeOnly?: boolean     // strip on output (e.g. password hashes)
    readonly?: boolean      // strip on input (e.g. id, createdAt)
    required?: boolean
    type?: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'object' | 'array'
    pattern?: string; min?: number; max?: number; format?: string
    enum?: readonly (string | number | boolean | null)[]
    items?: FieldRule
}
type FieldSchema<T> = { [K in keyof T]?: FieldRule }

function createAPISanitizer<T>(schema, opts?): {
    input(data, { strict?, restrictedFields? }): unknown
    output(data, { restrictedFields? }): unknown
    query(query, { strict?, allowedKeys? }): unknown
}

type Visitor<T> = (ctx: { key, value, rule, schema, path }, actions: { remove, set }) => void
function pipe<T>(...visitors: Visitor<T>[]): Visitor<T>
function traverseEntity(visitor, schema, data): unknown

// Built-in visitors
removePrivate, removeWriteOnly, removeReadonly, removeUnknown
removeRestricted(fields), allowOnly(fields)
coerceNumber, coerceBoolean, coerceDate, trimStrings, lowercaseStrings

// FieldSchema → JSON Schema
function deriveJsonSchema<T>(schema, mode: 'create' | 'update' | 'query', opts?): JSONSchemaObject
```

**Use when:** any HTTP handler that needs to strip / coerce / validate input/output before persistence; any `RouteHandler` subclass (which calls these via the `protected sanitize*` helpers).
**Skip when:** you need draft-07 JSON Schema validation (compose with `JSONSchema` from `@toolcase/base` — sanitize is shape, not full validation).

**Files:** `node/src/utils/sanitize/{api.ts, sanitize.ts, visitors.ts, jsonSchema.ts, types.ts, index.ts}`.

---

## Repository (Kysely peer)

### `BaseRepository<DB, TB, PK, ID>` — generic CRUD repository on Kysely

`new BaseRepository(kysely, table, pkColumn, opts?: { logger?, slowQueryMs? })`.

| Method group | Methods |
|---|---|
| Insert | `insert`, `insertMany`, `upsert({ conflictColumns, updateColumns? })` |
| Find | `findById` / `findByIdOrThrow`, `findOne` / `findOneOrThrow`, `findFirst`, `list`, `findWithCount`, `findPage`, `findCursorPage`, `exists`, `count` |
| Update | `updateById` / `updateByIdOrThrow`, `updateByIdAndVersion` (throws `OptimisticLockError`), `updateOne`, `update(where, values)`, `updateMany` |
| Delete | `deleteById` / `deleteByIdOrThrow`, `deleteMany`, `delete(where)` |

Every method accepts an optional `trx?: Transaction<DB>` as last arg.

**Use when:** any Kysely-backed table accessor. Subclass to add domain queries (e.g. `findByEmail`).
**Skip when:** you need cross-table joins or non-CRUD reporting queries — use Kysely directly.

**File:** `node/src/BaseRepository.ts`.

---

### `SoftDeleteRepository<DB, TB, PK, ID>` extends `BaseRepository`

`new SoftDeleteRepository(kysely, table, pkColumn, opts?: { deletedAtColumn?: 'deleted_at' })`.

Adds active-only variants and soft-delete/restore:

`findActiveById` / `findActiveByIdOrThrow`, `listActive`, `findManyActive`, `findActivePage`, `countActive`, `existsActive`, `softDeleteById` / `softDeleteByIdOrThrow`, `softDelete(where)`, `restoreById(id)`, `restore(where)`.

**Use when:** tables that carry a `deleted_at TIMESTAMP NULL` column.
**Skip when:** hard-delete semantics are fine.

**Reuses:** `BaseRepository` (full CRUD surface), `applyWhere` (active-where merge).

**File:** `node/src/SoftDeleteRepository.ts`.

---

### `EntityService<DB, TB, PK, ID>` — repository wrapper with hooks

`new EntityService(repo: BaseRepository, kysely)`.

`transaction<T>(cb: trx => Promise<T>): Promise<T>`.

Override hooks:

- `protected beforeInsert(values, ctx)`
- `protected afterInsert(row, ctx)`
- `protected beforeUpdate(values, ctx & { id? })`
- `protected afterUpdate(row, ctx & { id? })`
- `protected beforeDelete(ctx & { id?, where? })`
- `protected afterDelete(count, ctx & { id?, where? })`

Public surface mirrors `BaseRepository` (insert/find\*/update\*/delete\*) — every call funnels through hooks.

`insertMany` runs `beforeInsert` + `afterInsert` concurrently via `Promise.all` — hooks must be parallel-safe (no serial side effects).

**Use when:** layering uniqueness checks, audit fields, domain validation, or external side effects on top of a repository.
**Skip when:** you only need a thin repo (just use `BaseRepository`).

**Reuses:** `BaseRepository` (delegated), Kysely transactions.

**File:** `node/src/EntityService.ts`.

---

## RouteHandler / HttpServer (Fastify peer)

### `RouteHandler<T extends object>` — abstract Fastify route container

`new RouteHandler(options?: RouteHandlerOptions<T>)`. Subclass implements `register(fastify)` using protected helpers.

Options:

```ts
prefix?, schema?, resourceName?, idParam?, idType?: 'string' | 'integer' | 'bigint',
parseId?, preHandlers?, strictInput?, strictQuery?, allowedQueryKeys?,
restrictedInputFields?, restrictedOutputFields?, pagination?
```

Protected helpers:

| Group | Methods |
|---|---|
| Path / route | `path(suffix?)`, `itemPath()` (= `${prefix}/:id`), `routeOptions(specific?, schema?)` |
| Sanitization | `sanitizeInput`, `sanitizeOutput`, `sanitizeQuery` |
| ID parsing | `parseId<ID>(req)` (throws `ValidationError`) |
| Responses | `ok(data, count?)` (200), `created(reply, data, status=201)`, `accepted(reply, data)`, `noContent(reply, status=204)` |
| Errors | `mapError(err, reply)` (`EndpointError` / `Repository` / `KV` errors → REST envelope), `onError(err)` (override hook) |
| Misc | `resourceName()` |

**Use when:** any Fastify route surface that should share sanitize / id-parsing / error-envelope behavior across an app.
**Skip when:** route is a one-off (just call `fastify.get(...)` directly).

**Reuses:** `createAPISanitizer` (sanitize), `HTTP.RESTResponse` / `HTTP.RESTError` from `@toolcase/base`, `statusCodeFromError`, `ValidationError`.

**File:** `node/src/RouteHandler.ts`.

---

### `Router` + `chain` — endpoint composition

```ts
class Router {
    add(endpoint): this
    addAll(endpoints): this
    register(fastify): void
}
function chain(...endpoints): Routable
```

**Use when:** registering multiple endpoints behind a single mount point.
**Skip when:** you only have one endpoint.

**File:** `node/src/RouteHandler.ts`.

---

### `HttpServer` — Fastify lifecycle wrapper

`new HttpServer(options: HttpServerOptions)`. Owns `init` → `run` → `dispose`. Mounts `/health` automatically (always at root, never under prefix). Composition surface: `add(routable, { prefix? })` accepts anything with `register(fastify)`.

```ts
interface HttpServerOptions {
    port: number
    host?: '0.0.0.0' | string
    prefix?: string                     // e.g. '/api/v1'
    cors?: FastifyCorsOptions | false   // false → no CORS plugin
    trustProxy?: boolean                // default true
    healthCheck?: () => unknown | Promise<unknown>
    logger?: Logger
}
```

`/health`: when `healthCheck` resolves → 200 + resolved value; when it throws → 503 + `{ status: 'degraded' }`.

**Use when:** every backend in the monorepo. Single owner of Fastify setup.
**Skip when:** you need a custom Fastify instance with non-trivial plugin order — instantiate yourself, then call `endpoint.register(fastify)`.

**Reuses:** `@fastify/cors`, `HTTP.RESTError` (404 not-found handler), `Logger` interface.

**File:** `node/src/HttpServer.ts`.

---

## KV (Redis + Serializer peers)

Subsystem under `node/src/kv/`. The `KVService` class composes specialized sub-classes (`Locker`, `RateLimiter`, `Leaderboard`, `ValueStore`, `Versioned`, `SubscriberPool`) and exposes them both as `readonly` fields and as flat-surface methods.

### `KVService` — Redis facade

`new KVService(options: KVServiceOptions)`. Throws if the redis client doesn't support `withTypeMapping` (requires node-redis v5+).

```ts
interface KVServiceOptions {
    client: RedisClient
    namespace?: string
    separator?: string                  // default ':'
    serializer?: Serializer             // for *Value methods
    logger?: KVLogger
    onCommand?: (op, durationMs, err?) => void
    onSubscriberError?: (err, channel) => void
}
```

Readonly composed instances: `client`, `namespace`, `separator`, `serializer`, `keys: KeyBuilder`, `scripts: LuaScriptCache`, `locker: Locker`, `rateLimiter: RateLimiter`, `leaderboard: Leaderboard`, `values: ValueStore`, `versioned: Versioned`, `subscribers: SubscriberPool`.

Top-level methods: `key(...parts)`, `scoped(namespace, serializer?)`, `duplicate()`, `warmScripts()`, `ping()`, `close()`.

Flat-surface methods (categorized):

| Group | Methods |
|---|---|
| Strings | `get`, `set`, `setNX`, `getDel`, `getSet`, `del`, `exists`, `expire`, `pExpire`, `expireAt`, `persist`, `ttl`, `type`, `incr`, `incrBy`, `decr`, `decrBy`, `incrWithTTL`, `mGet`, `mSet`, `getAndTouch`, `compareAndSet`, `compareAndDel` |
| Hashes | `hSet`, `hGet`, `hGetAll`, `hDel`, `hExists`, `hIncrBy`, `hKeys`, `hVals`, `hLen` |
| Lists | `lPush`, `rPush`, `lPop`, `rPop`, `lRange`, `lLen`, `lTrim`, `lPushBinary`, `rPushBinary`, `popN` (atomic via Lua) |
| Sets / Sorted sets | `sAdd`, `sRem`, `sMembers`, `sIsMember`, `sCard`, `zAdd`, `zRem`, `zRange`, `zRangeByScore`, `zScore`, `zIncrBy`, `zCard` |
| Pub/sub | `publish` |
| Pattern delete | `scanKeys` (async generator), `delByPattern(pattern, { confirm? })` (refuses unnamespaced unless `confirm`) |
| Rate limiting | `rateLimit` (fixed window), `slidingWindow`, `tokenBucket`, `incrCapped` |
| Distributed lock | `tryWithLock`, `withLock`, `extendLock` |
| Leaderboard | `addScore`, `incrScore`, `addScoreAndRank`, `topN`, `rankOf` |
| Typed value store | `setValue`, `getValue`, `swapValue`, `mGetValue`, `rememberValue`, `enqueueValue`, `dequeueValue`, `dequeueValueBlocking`, `publishValue`, `subscribeValue`, `getAndTouchValue`, `popNValue` |
| Versioned writes | `versionedSet`, `versionedSetValue`, `versionedGet`, `versionedGetValue` |
| Manual encode/decode | `encode`, `decode` |

**Use when:** any Redis-backed primitive — caching, locking, rate limiting, pub/sub, leaderboards, optimistic concurrency.
**Skip when:** you need streams (`XADD`/`XREAD`) or modules — call `kv.client` directly. The flat surface intentionally does not chase every Redis command.

**Reuses:** `KeyBuilder` (namespacing), `LuaScriptCache` (atomic scripts), `@toolcase/serializer` (for `*Value` methods), `Locker` / `RateLimiter` / `Leaderboard` / `ValueStore` / `Versioned` / `SubscriberPool`.

**File:** `node/src/kv/KVService.ts`.

---

### `KeyBuilder` — namespace-aware key composer

`new KeyBuilder(namespace, separator)`. `build(...parts: string[])` joins with separator.

**Use when:** every key in a `kv/*` primitive. Never hand-build `${namespace}:${key}`.

**File:** `node/src/kv/keys.ts`.

---

### `LuaScriptCache` — registers + EVALSHAs cached Lua scripts

`new LuaScriptCache(onCommand?)`. Holds the registry of `KV_LUA_SCRIPTS`. `KVService.warmScripts()` eager-loads them.

**Use when:** any new atomic primitive that needs `EVAL`/`EVALSHA`. Add the script to `KV_LUA_SCRIPTS` and route through this cache — never call `client.eval` directly.

**File:** `node/src/kv/scripts.ts`.

---

### `Locker` — distributed lock (Lua-atomic, fenced)

`new Locker(client, keys, scripts)`.

```ts
interface LockHandle { token: string; extend: (ttlMs: number) => Promise<boolean> }
interface WithLockOptions { retries?, backoffMs?, keepAliveMs? }

tryWithLock<T>(key, ttlMs, fn): Promise<T | null>
withLock<T>(key, ttlMs, fn, options?): Promise<T>     // throws LockNotAcquiredError after retries
```

**Use when:** mutex around any non-idempotent cross-process operation.
**Skip when:** in-process mutex is enough (just use a queue).

**File:** `node/src/kv/Locker.ts`.

---

### `RateLimiter` — fixed window / sliding window / token bucket

`rateLimit(key, limit, windowSeconds)`, `slidingWindow(key, limit, windowMs)`, `tokenBucket(key, capacity, refillPerSecond, cost = 1)`, `incrCapped(key, delta, max, ttlSeconds?)`.

Every method returns `RateLimitResult { allowed, remaining, resetInSeconds }`.

**Use when:** any per-key / per-IP / per-user rate limit.
**Skip when:** in-memory token bucket is fine — go to `@toolcase/base`.

**Reuses:** `LuaScriptCache` (atomic check-and-decrement scripts).

**File:** `node/src/kv/RateLimiter.ts`.

---

### `Leaderboard` — sorted-set wrapper

`addScore`, `incrScore`, `addScoreAndRank`, `topN`, `rankOf`. Returns `LeaderboardEntry { member, score, rank }`.

**Use when:** any ranked list (gameplay, social, analytics).
**Skip when:** rank is computed via DB query (don't dual-source).

**File:** `node/src/kv/Leaderboard.ts`.

---

### `ValueStore` — typed binary value store via `@toolcase/serializer`

Encodes messages with the configured `Serializer`, stores bytes in Redis, decodes on read. Surface: `setValue`, `getValue`, `swapValue`, `mGetValue`, `rememberValue` (get-or-compute), `enqueueValue`, `dequeueValue`, `dequeueValueBlocking`, `publishValue`, `subscribeValue`, `getAndTouchValue`, `popNValue`.

**Use when:** structured payloads where text JSON is wasteful (game state, multi-field user objects).
**Skip when:** you only have strings (use `kv.set` / `kv.get`) or you don't have a Serializer (the peer is optional).

**Reuses:** `@toolcase/serializer` (encode/decode), `SubscriberPool` (for `subscribeValue`).

**File:** `node/src/kv/ValueStore.ts`.

---

### `Versioned` — optimistic-concurrency wrapper

`versionedSet(key, expectedVersion, data, ttlSeconds?)`, `versionedSetValue(type, key, expectedVersion, message, ttlSeconds?)`, `versionedGet(key)`, `versionedGetValue<T>(type, key)`. Throws `OptimisticLockError` on mismatch.

**Use when:** any cache entry where stale write would corrupt state (multi-writer counters, session updates).
**Skip when:** last-write-wins is acceptable (just `kv.set`).

**Reuses:** `LuaScriptCache` (CAS script), `OptimisticLockError`.

**File:** `node/src/kv/Versioned.ts`.

---

## Imaging (sharp peer)

### `ImageProcessor` — sharp-backed image transforms

Chainable wrapper around `sharp`. Each transform method clones the underlying pipeline so a single instance can be forked into multiple downstream chains.

| Method | Purpose |
|---|---|
| `static fromBuffer(buf)` / `static fromPath(p)` | construct from in-memory bytes or disk path |
| `resize({ width?, height?, fit?, withoutEnlargement?, background? })` | scale / fit transforms |
| `crop({ left, top, width, height })` | extract sub-rect (validates non-negative bounds eagerly; throws `ImageProcessorError('crop-out-of-bounds')` lazily on bad bounds at encode time) |
| `format({ format: 'png' \| 'jpeg' \| 'webp' \| 'avif', quality?, lossless?, progressive? })` | re-encode |
| `optimize({ quality?, palette?, effort?, stripMetadata? })` | format-aware encoder hints (mozjpeg, png palette, webp/avif effort) |
| `metadata()` | `Promise<ImageMetadata>` |
| `toBuffer()` | encoded bytes |
| `toFile(path)` | write to disk; returns `ImageMetadata` |

**Use when:** any per-image transform — upload thumbnails, format conversion, resize/crop pipelines.
**Skip when:** you need raw `sharp.Sharp` access (multi-input composition, custom filters) — drop down to `sharp` directly.

**Reuses:** `ImageProcessorError` (status 422 via `statusCodeFromError`).

**File:** `node/src/ImageProcessor.ts`.

---

### `AtlasBuilder` — sprite-atlas builder over `Packer`

Decodes images from disk, hands a `Sprite[]` to `Packer` from `@toolcase/base/packing`, composites each `PackedPage` into a single atlas image with `sharp`, and writes pages + JSON manifest to an output directory.

| Public surface | Notes |
|---|---|
| `new AtlasBuilder(options: AtlasBuilderOptions)` | options: `output: { directory, baseName?, format?, quality? }`, `packer?: Partial<PackingPackerOptions>`, `background?`, `writeManifest?`, `optimize?`, `useAlphaTrimming?` |
| `build(inputs: AtlasInput[]): Promise<AtlasResult>` | per-input `{ id, path }`. Result: `pages: AtlasPageFile[]`, `unpacked: AtlasUnpacked[]`, `manifestPath: string \| null`, `pack: PackingResult` |
| `AtlasFrame` / `AtlasPageFile` / `AtlasResult` types | absolute paths in the returned object; manifest stores paths relative to the manifest directory for portability |

Defaults forwarded into `Packer`: `algorithm: 'max-rects'`, `sort: 'max-side-desc'`, `maxWidth/maxHeight: 2048`, `padding: 2`, `pot: 'page'`, `budget: { maxPagePixels: 2048², maxPages: 16 }`. `trim` is owned by `AtlasBuilder` (`useAlphaTrimming`, default true) — not by `Packer`. Rotation uses sharp's `rotate(-90)` (CCW-in-output, TexturePacker-compatible).

Failure modes:

- `AtlasBuildError({ stage: 'decode' \| 'pack' \| 'compose' \| 'write' })` — fatal stage failure.
- Sprites that don't fit surface in `result.unpacked` (no throw) — caller decides whether unpacked frames are fatal.

**Use when:** you need to produce sprite atlases (and a manifest) at build time or during a content pipeline — game assets, icon sheets, animation frames.
**Skip when:** you need a TexturePacker-format `.atlas`/`.plist`/`.json` exact replica — this writes a custom v1 manifest. Map at the consumer if you need a specific format.

**Reuses:** `Packing.Packer` from `@toolcase/base`, `ImageProcessor` (encode + optimize), `AtlasBuildError`.

**File:** `node/src/AtlasBuilder.ts`.

---

### `SubscriberPool` — pooled pub/sub subscribers

`new SubscriberPool(duplicateFn, onError?)`. Owns a map of channel → subscriber connection so each `subscribe()` doesn't open a new TCP connection.

**Use when:** any module that needs Redis pub/sub. Don't call `client.duplicate` per-subscription.

**File:** `node/src/kv/SubscriberPool.ts`.

---

## Decision quick map

| Need | Reach for |
|---|---|
| Read env-var with type | `env(key, default, type)` |
| Domain failure → HTTP status | extend the right `*Error` + `statusCodeFromError` |
| Strip / coerce request body / response | `createAPISanitizer` + `RouteHandler` `sanitize*` helpers |
| Custom sanitize step | new `Visitor` composed via `pipe(...)` |
| Validate offset/limit | `normalizeOffsetLimit` + `Page<T>` envelope |
| Build an offset-paged response | `buildPage` |
| Translate request filter to query | `applyWhere` + `WhereClause<T>` |
| Translate request sort to query | `applyOrderBy` + `OrderBy<T>` |
| CRUD on a Kysely table | subclass `BaseRepository` (or `SoftDeleteRepository`) |
| Hooks around CRUD | wrap repo with `EntityService` |
| Bundle Fastify routes | subclass `RouteHandler`, compose with `Router` |
| Mount + run a server | `HttpServer.add(...).init().run()` |
| Cache string with TTL | `kv.set(key, value, { EX })` |
| Cache typed object with TTL | `kv.values.rememberValue(type, key, ttl, factory)` |
| Distributed mutex | `kv.withLock` / `kv.tryWithLock` |
| Rate limit | `kv.rateLimit` / `kv.slidingWindow` / `kv.tokenBucket` |
| Leaderboard / ranked list | `kv.leaderboard.*` |
| Optimistic concurrency on cache | `kv.versionedSet` / `kv.versionedSetValue` |
| Pub/sub | `kv.publish` + `kv.subscribers.*` (or `kv.values.subscribeValue`) |
| Image transform (resize/crop/format/optimize) | `ImageProcessor.fromPath(...).resize(...).format(...).toFile(...)` |
| Build sprite atlas from on-disk images | `new AtlasBuilder({ output, packer }).build(inputs)` |

---

## Composition examples

These already exist — copy the pattern instead of reinventing.

- **RouteHandler with sanitize + repo:** subclass `RouteHandler`, hold a `EntityService`, call `sanitizeInput` → `svc.insert` → `created(reply, sanitizeOutput)`. See `examples/public/node/SKILL.md` § End-to-end Example.
- **Rate-limited write hook:** `EntityService.beforeInsert` calls `kv.slidingWindow(key, limit, windowMs)` and throws `RateLimitedError` on `!allowed`.
- **Lock + versioned write:** `kv.withLock(key, ttlMs, async () => kv.versionedSet(key, expected, next))` to combine cross-process mutex with intra-process CAS.
- **Sanitize → JSON Schema:** `deriveJsonSchema(schema, 'create')` → pass into Fastify `routeOptions({ body: schema })` so Fastify validates _and_ RouteHandler sanitizes.

When you compose, document the composition in your new feature's `features.md` entry under "Reuses".

---

## OAuth2

Generic, IDP-agnostic OAuth2 / OIDC helpers under `node/src/oauth2/`. Pure stateless protocol toolkit — no per-IDP factories in code (paste-snippets in SKILL.md cookbook). Provider configs are data; flows are functions over data.

Errors live in `node/src/errors.ts`: `OAuth2Error` (base, extends `EndpointError`), `OAuth2CallbackError` (400 `OAUTH2_CALLBACK_ERROR`), `OAuth2TokenError` (502 `OAUTH2_TOKEN_ERROR` w/ `upstreamStatus` + `upstreamBody`), `OAuth2ProtocolError` (400 `OAUTH2_PROTOCOL_ERROR`), `OIDCVerificationError` (401 `OIDC_VERIFICATION_FAILED`), `TokenIntrospectionError` (401 `TOKEN_INTROSPECTION_FAILED`).

Shared HTTP plumbing in `node/src/http/options.ts`: `HttpOptions` ({ fetchImpl, userAgent, timeoutMs, headers, retry }) + `fetchWithOptions` — applies `AbortController` timeout, wraps `@toolcase/base` `retry` on 5xx when `opts.retry` is truthy.

### Random helpers — `node/src/oauth2/random.ts`

`generatePKCE(method='S256')`, `generateState(byteLength=32)`, `generateNonce(byteLength=32)`. Pure, `node:crypto` only. byteLength<16 throws.

### Flow — `node/src/oauth2/flow.ts`

`buildAuthorizeURL(provider, input)` — Authorization Code URL string. PKCE + nonce + prompt + login_hint + extraParams (sorted, can't override reserved keys). `exchangeCode`, `refreshToken`, `revokeToken`, `fetchUserinfo` — all take optional `HttpOptions` for fetch injection / retry / timeout.

### Grants — `node/src/oauth2/grants.ts`

`clientCredentialsToken(provider, input?, opts?)` — RFC 6749 §4.4. `requestDeviceCode(provider, input?, opts?)` + `pollDeviceToken(provider, input, opts?)` — RFC 8628. Poll honors `slow_down` (+5s interval), `authorization_pending` (continue), terminal errors throw `OAuth2TokenError`. Accepts optional `events: EventEmitter` (`@toolcase/base`) — emits `'pending'` / `'slow_down'` / `'interval_changed'`. Honors `abortSignal`.

### Resource server — `node/src/oauth2/resource.ts`

`extractBearerToken(authorizationHeader)` — case-insensitive, returns `null` on missing/malformed. `introspectToken(provider, input, opts?)` — RFC 7662. `active: false` is a normal response, not an error. Maps `exp`/`iat`/`nbf` numerics to `Date`, splits `scope`.

### OIDC — `node/src/oauth2/oidc.ts`

`fetchOIDCDiscovery(issuer, opts?)` — discovery doc cached in module-level `@toolcase/base` `Cache<OIDCDiscoveryDocument>` with 24h default TTL. `clearDiscoveryCache(issuer?)`. `verifyIdToken(idToken, options, ctx?)` — uses `jose.jwtVerify` with `createRemoteJWKSet` (cached in module-level `Cache`); checks signature, iss, aud, exp/nbf, alg whitelist, then nonce, max_age via auth_time, requiredAcr, requiredAmr (all-of), at_hash, c_hash. Tests can pass `options.jwks` (a `createLocalJWKSet` result) instead of `jwksUri` to bypass the network. `clearJwksCache(jwksUri?)`. `oidcProvider({ issuer, clientId, clientSecret, … })` — async factory: resolves discovery, returns full `OAuth2ProviderConfig`.

### Profiles — `node/src/oauth2/profiles.ts`

Pure mappers over already-fetched data. `parseStandardOIDCProfile({ tokens, userinfo? })` — picks sub/email/email_verified/name/picture (id_token claims override userinfo). `parseGitHubProfile({ user, emails })` — picks primary verified email. `parseDiscordProfile({ user })` — builds `cdn.discordapp.com` avatar URL with `.gif` for animated (`a_*`) hashes.

### Provider builder — `node/src/oauth2/types.ts`

`oauth2Provider(opts)` — validates required fields, normalizes trailing slashes, defaults `clientAuthMethod` (`client_secret_basic` if `clientSecret` else `none`). Leaves `pkceMethod` undefined unless caller sets it (so `exchangeCode`'s missing-verifier guard only fires when caller opted in). Shapes: `OAuth2ProviderConfig`, `OAuth2Tokens`, `OAuth2Profile`, `OAuth2FlowState`.

**Use when:** wiring login with any RFC 6749/8628/7519/OIDC provider — Google, GitHub, Discord, Auth0, Okta, Keycloak, Authentik, Cognito, Zitadel.
**Skip when:** the use case needs DPoP (RFC 9449), PAR (RFC 9126), mTLS, FAPI, or OAuth 1.0a — out of scope for v1.

**Reuses:** `Cache` (oidc discovery + JWKS), `EventEmitter` (device-poll events), `retry` (transient 5xx in `fetchWithOptions`), `HTTP.Status` (error class status codes), `@toolcase/base`-wide error envelope via `EndpointError`.

**Files:** `node/src/oauth2/{index,types,random,flow,grants,resource,oidc,profiles,wire}.ts`, `node/src/http/options.ts`. IDP-specific config snippets live in `examples/public/node/SKILL.md` cookbook, NOT in `node/src/`.
