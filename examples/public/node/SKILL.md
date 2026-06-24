---
name: node
description: Use when reaching for @toolcase/node — backend helpers for Node.js. Single entrypoint exposing Fastify endpoints (RouteHandler, RESTRouteHandler, Router, HttpServer), engine-agnostic repositories (BaseRepository, EntityService — you implement the verbs for your engine), Redis KV service (KVService — Locker, RateLimiter, Leaderboard, ValueStore, Versioned, SubscriberPool, KeyBuilder, LuaScriptCache), NodeStore + BlockStore (two-file persistent key-value store: B+ tree index + append-mostly heap), OAuth2/OIDC helpers, ImageProcessor + AtlasBuilder (sharp), typed env() loader, plus isomorphic sanitize / pagination / filter / sort / domain-error helpers and FieldSchema → JSON Schema derivation.
---

# @toolcase/node — API Reference

Backend helpers for Node.js. Dual ESM + CJS, TypeScript types, Node 18+. Single entrypoint — all surfaces re-exported from `@toolcase/node`. Peer deps are optional, install only the ones you import.

## Imports

```ts
import {
    // utils + errors (no extra peers beyond @toolcase/base)
    env, createSanitizer, deriveJsonSchema,
    NotFoundError, ConflictError, OptimisticLockError, ValidationError,
    RateLimitedError, LockNotAcquiredError,
    isLibError, errorMeta,
    // fastify peers: fastify, @fastify/cors
    RouteHandler, Router, RESTRouteHandler, HttpServer,
    // repository — engine-agnostic contract; you implement the verbs for your engine
    BaseRepository, EntityService, type TransactionClient,
    // engine-neutral query-description types + cursor codec
    type Filter, type Sort, FILTER_OP_SET, encodeCursor, decodeCursor,
    // redis peers: redis, @toolcase/serializer (serializer optional)
    KVService, KeyBuilder, LuaScriptCache, KV_LUA_SCRIPTS,
    // file store — no extra peers beyond node:fs (built-in)
    NodeStore, BlockStore, type NodeStoreOptions, type BlockRef,
    serializeBlockRef, deserializeBlockRef, BLOCK_REF_SIZE,
} from '@toolcase/node'
```

| Surface | Peer deps required |
|---|---|
| utils + errors (sanitize, pagination, filter, sort, domain errors), `env` | `@toolcase/base` |
| `RouteHandler`, `Router`, `HttpServer` | `@toolcase/base`, `fastify`, `@fastify/cors` |
| `BaseRepository`, `EntityService` | `@toolcase/base` — engine-agnostic; you implement the verbs against any driver |
| `KVService` (string surface only) | `@toolcase/base`, `redis` |
| `KVService.*Value*` methods (typed binary) | adds `@toolcase/serializer` |
| `NodeStore`, `BlockStore` | `@toolcase/base`, `node:fs` (Node built-in) |
| `ImageProcessor`, `AtlasBuilder` | `@toolcase/base`, `sharp` |

---

## env

Typed env-var reader. Node-only — throws `'env works only with NodeJS'` if `globalThis.process` is undefined.

```ts
env(key): string | null
env(key, defaultValue: string, type?: 'string'): string
env(key, defaultValue: number, type: 'number'): number
env(key, defaultValue: boolean, type: 'boolean'): boolean
env(key, defaultValue: null, type: 'number'): number | null
env(key, defaultValue: null, type: 'boolean'): boolean | null
```

Overloaded — TypeScript narrows the return based on `defaultValue` + `type`.

- `'number'` — `parseInt(v, 10)`; falls back to `defaultValue` if the parsed integer's string form ≠ original.
- `'boolean'` — case-insensitive `'true' | 'false'`; otherwise `defaultValue`.
- `'string'` — passes through; `defaultValue` if undefined.

```ts
import { env } from '@toolcase/node'
const port  = env('PORT', 3000, 'number')
const debug = env('DEBUG', false, 'boolean')
const host  = env('HOST', 'localhost')
```

---

## Errors

```ts
class LibError extends Error
class RepositoryError extends LibError
class NotFoundError extends RepositoryError    // resource, identifier
class ConflictError extends RepositoryError    // resource
class OptimisticLockError extends RepositoryError  // resource, expectedVersion, actualVersion
class KVServiceError extends LibError
class LockNotAcquiredError extends KVServiceError  // key
class RateLimitedError extends KVServiceError      // key, resetInSeconds
class EndpointError extends LibError               // statusCode, code
class ValidationError extends EndpointError       // details

class ImageProcessorError extends LibError    // reason, path
class AtlasBuildError extends LibError         // stage: 'decode' | 'pack' | 'compose' | 'write', path

function isLibError(e: unknown): e is LibError

interface ErrorMeta { code: string | null; status: number }
function errorMeta(e: unknown): ErrorMeta | null
//   EndpointError → { code: e.code, status: e.statusCode } (ValidationError → 400)
//   NotFoundError → 404 / 'NOT_FOUND'
//   ConflictError → 409 / 'CONFLICT'
//   OptimisticLockError → 409 / 'VERSION_MISMATCH'
//   RateLimitedError → 429 / 'RATE_LIMITED'
//   LockNotAcquiredError → 423 / 'LOCKED'
//   ImageProcessorError → 422 / null
//   AtlasBuildError → 500 / null
//   Returns null for unknown errors (callers map to 500 + opaque).
```

`new.target.name` is set as `error.name` so log lines / serialization carry the class name.

---

## Utils

### Pagination

```ts
const DEFAULT_OFFSET = 0
const DEFAULT_LIMIT = 25
const DEFAULT_MAX_LIMIT = 1000

interface PaginationInput { offset?: number; limit?: number }
interface PaginationOptions { defaultLimit?: number; maxLimit?: number; strict?: boolean }
interface PageInfo { offset: number; limit: number; count: number }
interface Page<T> { results: T[]; pagination: PageInfo }
interface OffsetLimit { offset: number; limit: number }
interface CursorParams { limit?: number; cursor?: string | null }
interface CursorPage<T> { results: T[]; nextCursor: string | null; hasMore: boolean }

function normalizeOffsetLimit(p?: PaginationInput, o?: PaginationOptions): OffsetLimit
function buildPage<T>(results: T[], count: number, offset: number, limit: number): Page<T>
```

`strict: true` makes `normalizeOffsetLimit` throw `ValidationError` on non-finite / negative inputs; default behavior coerces them to defaults.

### Filter / Sort

Engine-neutral query-description types. `@toolcase/node` ships **no SQL builder** — these describe *intent*; your `BaseRepository` subclass translates them for its engine (SQL predicate, Mongo filter, key scan, …).

```ts
type FilterOp = 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'like' | 'ilike'
              | 'in' | 'notIn' | 'isNull' | 'isNotNull'

type FilterCondition<V> =
    | { eq: V } | { ne: V }
    | { gt: NonNullable<V> } | { gte: NonNullable<V> }
    | { lt: NonNullable<V> } | { lte: NonNullable<V> }
    | { like: string } | { ilike: string }
    | { in: NonNullable<V>[] } | { notIn: NonNullable<V>[] }
    | { isNull: true } | { isNotNull: true }

type FilterValue<V> = V | V[] | null | FilterCondition<V> | FilterMultiCondition<V>
type Filter<T> = { [K in keyof T]?: FilterValue<T[K]> }

const FILTER_OP_SET: Set<string>   // the recognized operator keys — validate / translate against it

interface SortField<T> { field: keyof T & string; direction?: 'asc' | 'desc'; nulls?: 'first' | 'last' }
type Sort<T> = (keyof T & string) | SortField<T>
```

`Filter` admits a multi-op shape too (`FilterMultiCondition<V>`) — `{ age: { gte: 18, lt: 65 } }`. A bare value is `eq` (`{ status: 'active' }`), a bare array is membership (`{ id: [1, 2, 3] }`), `null` is an `isNull` test. `Sort` is a bare field name (ascending), a `SortField` object, or an array of either. **How each operator maps to a query is entirely your repository's choice** — the library no longer emits SQL.

### Cursor codec

```ts
function encodeCursor(value: unknown): string     // opaque base64url(`${kind}:${value}`), kind ∈ {s,n,b,d,g}
function decodeCursor(cursor: string): unknown     // round-trips Date, BigInt, number, boolean, string
```

Engine-neutral keyset-cursor helpers for a `paginateCursor` implementation — encode the ordering value of the last row of a page, decode it to resume on the next page.

### parseFilters / parseSort (internal — drives RESTRouteHandler query parsing)

These helpers live in `utils/` and are NOT re-exported from `@toolcase/node`. `RESTRouteHandler` uses them to translate bracket-form query strings into `Filter<T>` + `Sort<T>[]`. Documented here so callers know the URL syntax their endpoints accept.

```ts
type CoerceType = 'integer' | 'number' | 'boolean' | 'date'

interface ParseFiltersOptions<T> {
    schema?: FieldSchema<T>                                          // type info drives coercion
    allowedFields?: ReadonlyArray<keyof T & string>                  // unknown field → ValidationError
    coerceFields?: Partial<Record<keyof T & string, CoerceType>>     // explicit coercion (overrides schema)
    reservedKeys?: ReadonlyArray<string>                             // default ['offset','limit','sort','cursor']
}

function parseFilters<T>(query: Record<string, unknown>, options?: ParseFiltersOptions<T>): Filter<T>
```

Bracket-form query → `Filter<T>`:

```
?email=foo@bar.com               → { email: 'foo@bar.com' }
?age[gte]=18&age[lt]=65          → { age: { gte: 18, lt: 65 } }     (with schema { age: { type: 'integer' } })
?status[in]=active,pending       → { status: { in: ['active', 'pending'] } }
?deletedAt[isNull]=1             → { deletedAt: { isNull: true } }
?ids=1&ids=2                     → { ids: ['1', '2'] }
```

- Reserved keys (`offset`, `limit`, `sort`, `cursor`) are skipped.
- `allowedFields` set → unknown top-level key throws `ValidationError` (clean 400).
- Unknown op key (`?foo[bar]=`) → `ValidationError`.
- `[in]` / `[notIn]` csv-split string values; arrays passed as-is. Empty `[in]=` produces an empty array — your repository decides how to treat an empty membership set.
- Boolean ops (`isNull`, `isNotNull`): truthy (`'1'`, `'true'`) emits the op; falsy drops the clause. `isNull=0` ≠ `isNotNull` — by design, use the named op.

**Schema-less hazard.** Without `schema` (and no `coerceFields`), leaves stay strings. `?age[gte]=18` then compares lexicographically in most engines (`'9' >= '10'` is `true`). Always pass either `schema` (recommended) or `coerceFields` for any non-string column you want to filter on.

```ts
interface ParseSortOptions<T> {
    allowedFields?: ReadonlyArray<keyof T & string>                  // unknown field → ValidationError
}

function parseSort<T>(query: Record<string, unknown>, options?: ParseSortOptions<T>): Sort<T>[] | undefined
```

```
?sort=-createdAt,name   → [{ field: 'createdAt', direction: 'desc' }, { field: 'name', direction: 'asc' }]
?sort=+name             → [{ field: 'name', direction: 'asc' }]
```

- `-` prefix = `desc`, `+` or no prefix = `asc`. Whitespace tolerated. Empty tokens skipped.
- Returns `undefined` when `sort` is absent, so callers can fall back to a default.

### Sanitize

```ts
interface FieldRule {
    private?: boolean    // strip on output AND query
    writeOnly?: boolean  // strip on output (e.g. password hashes)
    readonly?: boolean   // strip on input (e.g. id, createdAt)
    required?: boolean
    type?: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'object' | 'array'
    pattern?: string; min?: number; max?: number; format?: string
    enum?: readonly (string | number | boolean | null)[]
    items?: FieldRule
}
type FieldSchema<T> = { [K in keyof T]?: FieldRule }

interface SanitizerVisitors<T> { input?: Visitor<T>[]; output?: Visitor<T>[]; query?: Visitor<T>[] }
interface SanitizerOptions<T> { sanitizers?: SanitizerVisitors<T> }
interface InputCallOptions  { strict?: boolean; restrictedFields?: readonly string[] }
interface OutputCallOptions { restrictedFields?: readonly string[] }
interface QueryCallOptions  { strict?: boolean; allowedKeys?: readonly string[] }

function createSanitizer<T>(schema: FieldSchema<T>, opts?: SanitizerOptions<T>): {
    input(data, opts?: InputCallOptions): unknown
    output(data, opts?: OutputCallOptions): unknown
    query(query, opts?: QueryCallOptions): unknown
}

type Sanitizer<T> = ReturnType<typeof createSanitizer<T>>

// Composable visitors
interface VisitorContext<T> { key, value, rule, schema, path }
interface VisitorActions { remove(): void; set(value): void }
type Visitor<T> = (ctx: VisitorContext<T>, actions: VisitorActions) => void

function pipe<T>(...visitors: Visitor<T>[]): Visitor<T>
function traverseEntity<T>(visitor, schema, data, parentPath?): unknown

// Built-in visitors
removePrivate, removeWriteOnly, removeReadonly, removeUnknown
removeRestricted(fields), allowOnly(fields)
coerceNumber, coerceBoolean, coerceDate, trimStrings, lowercaseStrings

// FieldSchema → JSON Schema (drafts the request-body schema you hand to Fastify)
interface JSONSchemaObject {
    type?: string | string[]
    properties?: Record<string, JSONSchemaObject>
    required?: string[]
    additionalProperties?: boolean
    items?: JSONSchemaObject
    pattern?: string; format?: string
    minLength?: number; maxLength?: number
    minimum?: number; maximum?: number
    enum?: readonly (string | number | boolean | null)[]
}
type DerivedSchemaMode = 'create' | 'update' | 'query'
interface DeriveOptions { strict?: boolean }   // strict → additionalProperties: false

function deriveJsonSchema<T>(schema: FieldSchema<T>, mode: DerivedSchemaMode, opts?): JSONSchemaObject
//   create → readonly fields stripped; required fields collected.
//   update → readonly fields stripped; nothing required.
//   query  → readonly fields stripped; nothing required.
//   private fields are always stripped from the derived schema.
//   `type: 'date'` becomes `type: 'string', format: 'date-time'`.
//   Result is cached per-(schema, mode, strict) via WeakMap.
```

When the sanitizer is constructed without custom `sanitizers`, calls take a per-key fast path that skips `traverseEntity` entirely. Schema compilation and `restrictedFields` / `allowedKeys` sets are memoized via `WeakMap`, so passing a stable array reference per request is faster than constructing a new one each time.

### Logger interface

```ts
interface Logger {
    debug?: (msg: string, meta?: Record<string, unknown>) => void
    info?: (msg, meta?) => void
    warn?: (msg, meta?) => void
    error?: (msg, meta?) => void
}
```

> **Adapter note — `@toolcase/logging`.** This `Logger` contract uses `warn`, but a `@toolcase/logging` logger exposes `warning` (not `warn`). `BaseRepository` emits slow-query reports via `logger?.warn?.()`, so if you pass a logging logger straight through, those warnings are silently dropped (the optional call is just `undefined`). Adapt the level name when bridging:
>
> ```ts
> const log = LoggerFactory.getLogger('repo')
> const adapted: Logger = {
>     debug: (m, meta) => log.debug(m, meta),
>     info:  (m, meta) => log.info(m, meta),
>     warn:  (m, meta) => log.warning(m, meta), // warning → warn
>     error: (m, meta) => log.error(m, meta),
> }
> ```

---

## Repository

Engine-agnostic repository **contract + toolbox**. `BaseRepository` ships **no queries and no driver/SQL code** — every data-access verb throws `not implemented` until you override it. You subclass it and implement the verbs for your engine (Postgres, MySQL, SQLite, MongoDB, DynamoDB, Redis, an HTTP API). What the base provides: the verb surface as the contract, the engine-neutral `Filter` / `Sort` / pagination types, observability (`logger`, `slowQueryMs`, `onOperation`) wired through `time()`, and transaction resolution via `run(trx)`.

```ts
// 2nd generic = the engine handle (Driver). Defaults to `unknown`; a real subclass
// pins it to its driver type (a pg Pool, a Kysely instance, a Mongo Db, …).
interface OperationEvent { source: string; op: string; durationMs: number; error?: unknown }
type OperationHook = (event: OperationEvent) => void

interface BaseRepositoryOptions {
    logger?: Logger
    slowQueryMs?: number          // default 250
    onOperation?: OperationHook   // fires after every operation wrapped in time() (success or failure)
}

interface ListOptions<T> {
    where?: Filter<T>
    orderBy?: Sort<T> | Sort<T>[]
    limit?: number
    offset?: number
}

type PageOptions<T> = Omit<ListOptions<T>, 'limit' | 'offset'> & PaginationInput & {
    pagination?: PaginationOptions
}

interface UpsertOptions {
    uniqueBy: readonly string[]      // unique-key fields a conflict is detected on
    update?: readonly string[]       // which fields to write on conflict
}

interface CursorOptions<T> {
    field: keyof T & string
    direction?: 'asc' | 'desc'
    where?: Filter<T>
    limit?: number             // default 25
    cursor?: string | null
}

abstract class BaseRepository<Entity = any, Driver = unknown> {
    protected constructor(driver: Driver, source: string, idField = 'id', opts?: BaseRepositoryOptions)

    get primaryKey(): string

    // Toolbox for your implementations:
    protected run(trx?: Driver): Driver                                  // trx if supplied, else the base driver
    protected byId(id: any): Filter<Entity>                              // { [idField]: id }
    protected time<T>(label: string, fn: () => Promise<T>): Promise<T>   // times → slow-log + onOperation

    // Leaf verbs — each throws 'BaseRepository.<verb>: not implemented' until you override it.
    insert(values, trx?): Promise<Entity>
    insertMany(values[], trx?): Promise<Entity[]>
    upsert(values, opts: UpsertOptions, trx?): Promise<Entity>
    findById(id, trx?): Promise<Entity | undefined>
    findByIdMany(ids[], trx?): Promise<Entity[]>
    findOne(where, trx?): Promise<Entity | undefined>
    findMany({ where?, orderBy?, limit?, offset? }, trx?): Promise<Entity[]>
    findManyWithCount(opts, trx?): Promise<{ results: Entity[]; total: number }>
    paginate({ where?, orderBy?, offset?, limit?, pagination? }, trx?): Promise<Page>
    paginateCursor({ field, direction?, where?, limit?, cursor? }, trx?): Promise<CursorPage>
    exists(where, trx?): Promise<boolean>
    count(where?, trx?): Promise<number>
    updateById(id, values, trx?): Promise<Entity | undefined>
    updateByIdAndVersion(id, expectedVersion, values, { versionColumn? }, trx?): Promise<Entity>
    updateOne(where, values, trx?): Promise<Entity | undefined>
    update(where, values, trx?): Promise<number>
    deleteById(id, trx?): Promise<number>
    delete(where, trx?): Promise<number>

    // Composition verbs — ALREADY implemented in terms of the leaf verbs. Do NOT re-stub;
    // they start working the moment the verbs they call are implemented.
    findByIdOrThrow(id, trx?): Promise<Entity>                     // findById → throws NotFoundError
    findOneOrThrow(where, trx?): Promise<Entity>                   // findOne → throws NotFoundError
    updateByIdOrThrow(id, values, trx?): Promise<Entity>           // updateById → throws NotFoundError
    updateMany(ids[], values, trx?): Promise<number>               // update via { idField: ids }
    deleteByIdOrThrow(id, trx?): Promise<void>                     // deleteById → throws NotFoundError
    deleteMany(ids[], trx?): Promise<number>                       // delete via { idField: ids }

    // values / where / id are loose: Record<string, any> / Filter<Entity> / any.
    // trx is an optional Driver — pass a transaction handle to enlist the call.
    // Slow reporting fires only when `logger.warn`/`logger.debug` exist or `onOperation` is set.
    // Elapsed >= slowQueryMs → logger.warn + onOperation; otherwise logger.debug + onOperation.
}
```

**Implementing a repository.** Override only the leaf verbs you use; the 6 composition verbs (`*OrThrow`, `updateMany`, `deleteMany`) are already written against the leaf verbs — they start working the moment those are implemented. Wrap data access in `this.time(label, fn)` so slow-query logging + the `onOperation` hook fire. Use `this.run(trx)` to pick the transaction handle when one is passed, else the base driver.

```ts
import { Pool } from 'pg'
import { BaseRepository, type Filter } from '@toolcase/node'

class UserRepository extends BaseRepository<User, Pool> {
    constructor(pool: Pool) { super(pool, 'users', 'id', { slowQueryMs: 100 }) }

    async insert(values: Record<string, any>, trx?: Pool): Promise<User> {
        return this.time('insert', async () => {
            const keys = Object.keys(values)
            const cols = keys.map((k) => `"${k}"`).join(', ')
            const ph = keys.map((_, i) => `$${i + 1}`).join(', ')
            const { rows } = await this.run(trx).query(
                `INSERT INTO "${this.source}" (${cols}) VALUES (${ph}) RETURNING *`,
                keys.map((k) => values[k]),
            )
            return rows[0]
        })
    }

    async findById(id: number, trx?: Pool): Promise<User | undefined> {
        const { rows } = await this.run(trx).query(
            `SELECT * FROM "${this.source}" WHERE "${this.idField}" = $1 LIMIT 1`, [id],
        )
        return rows[0]
    }
    // … findOne / findMany / paginate / update / delete / count: translate Filter & Sort to
    // your dialect. Quote identifiers; bind values as params, never interpolate.
}
```

```ts
interface HookContext<Driver> { trx?: Driver }

abstract class EntityService<Entity = any, Driver = unknown> {
    protected constructor(repo: BaseRepository<Entity, Driver>, db: TransactionClient<Driver>)

    get primaryKey(): string
    transaction<T>(cb: (trx: Driver) => Promise<T>): Promise<T>
    protected withTrx<T>(trx, fn): Promise<T>                       // reuse trx if provided, else open one

    // Hooks — override to inject before/after logic
    protected beforeInsert(values, ctx: HookContext<Driver>)
    protected afterInsert(row, ctx)
    protected beforeUpdate(values, ctx: HookContext<Driver> & { id? })
    protected afterUpdate(row, ctx)
    protected beforeDelete(ctx: HookContext<Driver> & { id?, where? })
    protected afterDelete(count, ctx)

    // Public surface — delegates to the repository, funneling through hooks where listed
    insert(values, trx?)                                            // before/after Insert hooks
    upsert(values, opts, trx?)                                      // before/after Insert hooks
    insertMany(values[], trx?)                                      // hooks parallel via Promise.all (skipped if not overridden)
    findById | findByIdOrThrow | findByIdMany | findOne | findOneOrThrow
    findMany | findManyWithCount | paginate | paginateCursor | exists | count
    updateById(id, values, trx?)                                    // before/after Update hooks
    updateByIdOrThrow(id, values, trx?)                             // before/after Update hooks
    update(where, values, trx?)                                     // beforeUpdate only (no row to fire afterUpdate on)
    updateOne(where, values, trx?)                                  // before/after Update hooks
    deleteById | deleteByIdOrThrow                                  // before/after Delete hooks
    deleteMany(ids[], trx?)                                         // hooks fire once with { where: { idField: ids } }
    delete(where, trx?)                                             // before/after Delete hooks with ctx.where
}
```

`TransactionClient<Driver>` (from `@toolcase/node`) is the neutral transaction contract `EntityService` needs — `{ transaction<T>(fn: (trx: Driver) => Promise<T>): Promise<T> }`. Your adapter implements it (a `pg` pool wrapper, a Kysely `db.transaction()`, an in-memory shim). `EntityService` is **never used standalone** — it always wraps a concrete `BaseRepository`; only the repository's verb bodies know your engine.

`insertMany` skips its hook walk when `beforeInsert` / `afterInsert` are not overridden (identity check against `EntityService.prototype`). `beforeInsert` / `beforeUpdate` MUST return the (possibly transformed) values — that's what the repository writes. `afterInsert` / `afterUpdate` MUST return the row.

---

## RouteHandler / HttpServer

```ts
import type { FastifyInstance, FastifyRequest, FastifyReply, RouteShorthandOptions } from 'fastify'
import type { FastifyCorsOptions } from '@fastify/cors'

interface Routable { register(fastify: FastifyInstance): void }
type PreHandler = (req, reply) => Promise<void> | void
type RouteIdType = 'string' | 'integer' | 'bigint'
type RestrictedFieldsResolver = readonly string[] | ((req: FastifyRequest) => readonly string[])

interface RouteHandlerOptions<T> {
    prefix?: string
    schema?: FieldSchema<T>
    resourceName?: string
    idParam?: 'id' | string
    idType?: RouteIdType                                         // 'string' | 'integer' | 'bigint'
    parseId?: (raw: string) => unknown                              // overrides idType-driven parser
    preHandlers?: PreHandler[]
    strictInput?: boolean
    strictQuery?: boolean
    allowedQueryKeys?: readonly string[]
    restrictedInputFields?: RestrictedFieldsResolver
    restrictedOutputFields?: RestrictedFieldsResolver
    pagination?: PaginationOptions
}

abstract class RouteHandler<T extends object = Record<string, unknown>> {
    constructor(options?: RouteHandlerOptions<T>)
    abstract register(fastify: FastifyInstance): void

    // Helpers (protected)
    protected path(suffix?: string): string
    protected itemPath(): string                                    // → `${prefix}/:id`
    protected routeOptions(specific?: PreHandler[], schema?): RouteShorthandOptions
    //   Combines class-level preHandlers with route-specific ones in order.

    protected sanitizeInput(data, req)
    protected sanitizeOutput(data, req)
    protected sanitizeQuery(query, req)

    protected parseId<ID>(req): ID                                  // throws ValidationError on bad input
    //   integer: `Number()` + Number.isInteger; bigint: `BigInt()` (catches throws);
    //   string: passthrough. `parseId` option overrides.

    protected ok<D>(data, count?)                                   // 200 RESTResponse
    protected created<D>(reply, data, status = 201)
    protected accepted<D>(reply, data)
    protected noContent(reply, status = 204): null

    mapError(error, reply): unknown                                 // public — EndpointError / Repo / KV → REST envelope
    //   ValidationError forwards `error.details` into the response body.
    //   Unknown errors → 500 + 'internal_error', forwarded to onError.
    protected onError(err): void                                    // hook — override to log unhandled errors
    protected resourceName(): string
    protected resolveRestricted(resolver, req): readonly string[] | undefined
}

class Router {
    add(handler: RouteHandler): this
    addAll(handlers: readonly RouteHandler[]): this
    register(fastify: FastifyInstance): void
}
```

### RESTRouteHandler

```ts
type RESTMethod = 'list' | 'get' | 'create' | 'update' | 'delete'

interface RESTRouteHandlerOptions<T> extends RouteHandlerOptions<T> {
    canList?: PreHandler | PreHandler[]
    canGet?: PreHandler | PreHandler[]
    canCreate?: PreHandler | PreHandler[]
    canUpdate?: PreHandler | PreHandler[]
    canDelete?: PreHandler | PreHandler[]
    canRead?: PreHandler | PreHandler[]                              // alias: list + get
    canWrite?: PreHandler | PreHandler[]                             // alias: create + update + delete

    methods?: ReadonlyArray<RESTMethod>                              // default: all 5
    filterableFields?: ReadonlyArray<keyof T & string>
    sortableFields?: ReadonlyArray<keyof T & string>
    defaultOrderBy?: Sort<T> | Sort<T>[]
    allowEmptyPatch?: boolean                                        // default false → empty PATCH body returns 400
}

class RESTRouteHandler<Row extends object = any> extends RouteHandler<Row> {
    constructor(service: EntityService<Row>, options?: RESTRouteHandlerOptions<Row>)
    register(fastify: FastifyInstance): void
}
```

Given a `EntityService`, registers full CRUD with sanitize + pagination + filter/sort + per-verb pre-handlers wired automatically:

| Method + path | Status | Service call | Pre-handlers |
|---|---|---|---|
| `GET /` | 200 | `paginate({ where, orderBy, offset, limit, pagination })` | global + (`canList` ?? `canRead`) |
| `GET /:id` | 200 / 404 | `findById(id)` (→ 404 if missing) | global + (`canGet` ?? `canRead`) |
| `POST /` | 201 | `insert(sanitizedBody)` | global + (`canCreate` ?? `canWrite`) |
| `PATCH /:id` | 200 / 400 / 404 | `updateByIdOrThrow(id, sanitizedBody)` | global + (`canUpdate` ?? `canWrite`) |
| `DELETE /:id` | 204 / 404 | `deleteByIdOrThrow(id)` | global + (`canDelete` ?? `canWrite`) |

**Pre-handler resolution.** Per-verb keys win. Group aliases (`canRead` / `canWrite`) fill verbs only when no per-verb key is set on that verb. Both keys present → per-verb chosen, alias ignored for that verb.

**`filterableFields` / `sortableFields` defaulting.** When unset:
- with `schema` → derived from schema keys minus any field with `private` or `writeOnly` (`readonly` stays filterable/sortable).
- without `schema` → empty (no filters / no sort allowed). Forces explicit opt-in.

This guards against incidents like `?passwordHash[like]=%a%` — by default a schema-less RESTRouteHandler accepts no filters at all.

**Empty PATCH guard.** A PATCH whose sanitized body is `{}` returns `400` (`ValidationError('Empty patch')`) by default. Opt in with `allowEmptyPatch: true` to call `updateByIdOrThrow` with an empty patch instead — your repository implementation decides how to handle a no-op update.

**bigint ID JSON hazard.** `idType: 'bigint'` parses `:id` to a `BigInt`. If the row carries a bigint column, Fastify's default `JSON.stringify` throws `TypeError: Do not know how to serialize a BigInt`. Override Fastify's reply serializer or coerce bigint columns to string in your sanitize layer — RESTRouteHandler cannot fix this transparently.

**No endpoint-level success hooks.** Use `EntityService.afterInsert` / `afterUpdate` / `afterDelete` — they run inside the same transaction as the write, strictly stronger than a post-response endpoint hook.

```ts
// `db` is a TransactionClient<Pool>; UserRepo extends BaseRepository<User, Pool> and
// implements its verbs with SQL (see Repository → "Implementing a repository").
class UserService extends EntityService<User, Pool> {
    constructor(repo: UserRepo, db: TransactionClient<Pool>) { super(repo, db) }
}

class UserEndpoint extends RESTRouteHandler<User> {}

const endpoint = new UserEndpoint(new UserService(new UserRepo(pool), db), {
    prefix: '/users',
    schema: userSchema,
    resourceName: 'User',
    filterableFields: ['email', 'status', 'createdAt'],
    sortableFields: ['createdAt', 'name'],
    defaultOrderBy: { field: 'createdAt', direction: 'desc' },
    canWrite: requireAuth(['admin']),       // group alias: create + update + delete
    canList: rateLimit({ rpm: 60 }),        // per-verb override; alias still applies to other verbs
    restrictedOutputFields: ['passwordHash'],
})

endpoint.register(fastify)
```

`HttpServer` (below) accepts a `RESTRouteHandler` directly via `add(endpoint)`.

```ts
interface HttpServerOptions {
    port: number
    host?: '0.0.0.0' | string                                       // default '0.0.0.0'
    prefix?: string                                                 // e.g. '/api/v1'
    cors?: FastifyCorsOptions | false                               // false → CORS plugin not registered
    trustProxy?: boolean                                            // default true
    healthCheck?: () => unknown | Promise<unknown>
    logger?: Logger
}

class HttpServer {
    constructor(options: HttpServerOptions)
    get instance(): FastifyInstance                                 // populated after init()
    add(routable: Routable, opts?: { prefix?: string }): this
    init(): Promise<void>                                           // builds Fastify, mounts /health + routes + 404 handler
    run(): Promise<void>
    dispose(): Promise<void>
}
```

`/health` is always mounted at the root path (never under `prefix`). When `healthCheck` resolves the result becomes the body with HTTP 200; when it throws or rejects HTTP 503 + `{ status: 'degraded' }` is returned and the error is logged via `options.logger?.error`. With no `healthCheck`, `/health` returns `{ status: 'ok' }`.

The 404 fallback returns the `HTTP.RESTError` envelope (`{ status: 'rejected', cause: 'not_found' }`) at HTTP 404.

---

## KVService

```ts
import { createClient, type SetOptions } from 'redis'
import Serializer from '@toolcase/serializer'

type RedisClient = RedisClientType<RedisModules, RedisFunctions, RedisScripts>

interface KVServiceOptions {
    client: RedisClient
    namespace?: string                     // default ''
    separator?: string                     // default ':'
    serializer?: Serializer                // optional — only required for *Value methods
    logger?: KVLogger
    onCommand?: (op: string, durationMs: number, err?: unknown) => void
    onSubscriberError?: (err: unknown, channel: string) => void
    scripts?: LuaScriptCache               // share the cache across scoped() children
}

interface KVLogger { debug?, warn?, error? }

interface RateLimitResult {
    allowed: boolean
    count: number
    limit: number
    remaining: number
    resetInSeconds: number
}

interface LeaderboardEntry { member: string; score: number }
type SubscribeHandler<T> = (message: T, channel: string) => void | Promise<void>
interface Subscription { close(): Promise<void> }

class KVService {
    constructor(options: KVServiceOptions)
    //   Throws KVServiceError if the redis client lacks `withTypeMapping` (requires node-redis v5+).

    readonly client: RedisClient
    readonly namespace: string
    readonly separator: string
    readonly serializer?: Serializer
    readonly keys: KeyBuilder
    readonly scripts: LuaScriptCache
    readonly locker: Locker
    readonly rateLimiter: RateLimiter
    readonly leaderboard: Leaderboard
    readonly objects: ValueStore                                 // sub-store for typed binary values (*Value methods)
    readonly versioned: Versioned
    readonly subscribers: SubscriberPool

    key(...parts: (string | number)[]): string
    scoped(namespace: string, serializer?): KVService            // child with extended namespace; shares `scripts`
    duplicate(): RedisClient
    warmScripts(): Promise<void>                                 // eager-load Lua → EVALSHA fast path
    ping(): Promise<string>
    close(): Promise<void>                                       // closes subscriber pool + client.quit() if open
    multi(): ReturnType<RedisClient['multi']>                    // raw transaction pipeline

    // Strings
    get(key): Promise<string | null>
    set(key, value: string | number | Buffer, options?: SetOptions): Promise<string | null>
    setNX(key, value, ttlMs?): Promise<boolean>
    getDel(key): Promise<string | null>
    getSet(key, value): Promise<string | null>                   // SET ... GET
    del(key | string[]): Promise<number>
    exists(key | string[]): Promise<number>
    expire(key, seconds): Promise<boolean>
    pExpire(key, ms): Promise<boolean>
    expireAt(key, unixSeconds): Promise<boolean>
    persist(key): Promise<boolean>
    ttl(key): Promise<number>
    type(key): Promise<string>
    incr(key): Promise<number>
    incrBy(key, by): Promise<number>
    decr(key): Promise<number>
    decrBy(key, by): Promise<number>
    incrWithTTL(key, ttlSeconds): Promise<number>                // atomic INCR + EXPIRE on first hit
    mGet(keys: string[]): Promise<(string | null)[]>
    mSet(entries: Record<string, string | number>): Promise<string>
    getAndTouch(key, ttlSeconds): Promise<string | null>          // atomic GET + EXPIRE
    compareAndSet(key, expected, next: string | Buffer, ttlMs?): Promise<boolean>
    compareAndDel(key, expected): Promise<boolean>

    // Hashes
    hSet(key, field, value: string | number): Promise<number>
    hSet(key, values: Record<string, string | number>): Promise<number>
    hGet(key, field): Promise<string | null>
    hGetAll(key): Promise<Record<string, string>>
    hDel(key, field: string | string[]): Promise<number>
    hExists(key, field): Promise<boolean>
    hIncrBy(key, field, by): Promise<number>
    hKeys(key): Promise<string[]>
    hVals(key): Promise<string[]>
    hLen(key): Promise<number>

    // Lists
    lPush(key, values: string | string[]): Promise<number>
    rPush(key, values: string | string[]): Promise<number>
    lPushBinary(key, value: Buffer): Promise<number>
    rPushBinary(key, value: Buffer): Promise<number>
    lPop(key): Promise<string | null>
    rPop(key): Promise<string | null>
    lRange(key, start, stop): Promise<string[]>
    lLen(key): Promise<number>
    lTrim(key, start, stop): Promise<string>
    popN(key, count): Promise<string[]>                          // atomic LPOPs via Lua

    // Sets / Sorted sets
    sAdd | sRem | sMembers | sIsMember | sCard
    zAdd(key, members: { score, value } | { score, value }[])
    zRem | zRange | zRangeByScore | zScore | zIncrBy | zCard

    // Pub/sub
    publish(channel, message: string | Buffer): Promise<number>

    // Pattern delete (refuses unnamespaced unless { confirm: true })
    scanKeys(pattern, count?): AsyncGenerator<string>            // SCAN cursor, MATCH applies to namespaced key
    delByPattern(pattern, opts?: { confirm?: boolean }): Promise<number>
    //   Throws KVServiceError when called on a no-namespace KVService without confirm.

    // Rate limiting
    rateLimit(key, limit, windowSeconds): Promise<RateLimitResult>                    // fixed window
    slidingWindow(key, limit, windowMs): Promise<{ allowed, count, remaining }>
    tokenBucket(key, capacity, refillPerSecond, cost = 1): Promise<{ allowed, tokens }>
    incrCapped(key, delta, max, ttlSeconds?): Promise<{ allowed, current }>

    // Distributed lock (Lua-atomic, fenced via random UUID token)
    tryWithLock<T>(key, ttlMs, fn: (handle) => Promise<T>): Promise<T | null>
    withLock<T>(key, ttlMs, fn, options?: WithLockOptions): Promise<T>                // throws LockNotAcquiredError
    extendLock(key, token, ttlMs): Promise<boolean>

    // Leaderboard (sorted set helpers)
    addScore(boardKey, member, score): Promise<number>
    incrScore(boardKey, member, delta): Promise<number>
    addScoreAndRank(boardKey, member, score): Promise<{ rank: number | null; score: number }>
    topN(boardKey, count): Promise<LeaderboardEntry[]>
    rankOf(boardKey, member, descending = true): Promise<number | null>

    // Typed value store (uses Serializer for binary encode — requires `serializer` option)
    setValue(type, key, message, options?: SetOptions): Promise<string | null>
    getValue<T>(type, key): Promise<T | null>
    swapValue<T>(type, key, next): Promise<T | null>
    mGetValue<T>(type, keys[]): Promise<(T | null)[]>
    rememberValue<T extends object>(type, key, ttlSeconds, factory): Promise<T>        // get-or-compute
    enqueueValue(type, queueKey, message): Promise<number>
    dequeueValue<T>(type, queueKey): Promise<T | null>
    dequeueValueBlocking<T>(type, queueKey, timeoutSeconds): Promise<T | null>
    publishValue(type, channel, message): Promise<number>
    subscribeValue<T>(type, channel, handler): Promise<Subscription>                   // pooled SubscriberPool
    getAndTouchValue<T>(type, key, ttlSeconds): Promise<T | null>
    popNValue<T>(type, queueKey, count): Promise<T[]>

    // Optimistic-versioned writes (HSET-backed: { version, data })
    versionedSet(key, expectedVersion, data: string | Buffer, ttlSeconds?): Promise<{ ok, version }>
    versionedSetValue(type, key, expectedVersion, message, ttlSeconds?): Promise<{ ok, version }>
    versionedGet(key): Promise<{ version, data: string } | null>
    versionedGetValue<T>(type, key): Promise<{ version, data: T } | null>

    // Manual encode/decode (binary form used by *Value methods)
    encode(type, message): Buffer
    decode<T>(type, buf: Buffer | Uint8Array): T
}
```

### Sub-class types (exported)

```ts
class KeyBuilder {
    constructor(public readonly namespace: string, public readonly separator: string)
    build(...parts: (string | number)[]): string
    scope(namespace: string): KeyBuilder
    stripNamespace(value: string): string
}
const KV_KEY_SEPARATOR = ':'

class LuaScript {
    readonly sha: string
    constructor(source, name?, onCommand?)
    run(client, options: { keys: string[]; arguments: string[] }): Promise<unknown>
    //   Tries EVALSHA, falls back to EVAL on NOSCRIPT.
}
class LuaScriptCache {
    constructor(onCommand?: KVCommandHook)
    get(name: keyof typeof KV_LUA_SCRIPTS): LuaScript
}
const KV_LUA_SCRIPTS: {
    compareAndSet, compareAndDel, extendLock, slidingWindow, tokenBucket, incrCapped,
    getAndTouch, versionedSet, addScoreAndRank, popN, incrWithTTL, rateLimit
}

interface LockHandle { token: string; extend: (ttlMs: number) => Promise<boolean> }
interface WithLockOptions { retries?: number; backoffMs?: number; keepAliveMs?: number }
//   retries default 5; backoffMs default 50 (exponential + jitter);
//   keepAliveMs > 0 starts a setInterval that calls extend for the lifetime of fn.

interface DelByPatternOptions { confirm?: boolean }
type SubscriberErrorHook = (error: unknown, channel: string) => void

class Locker { tryWithLock; withLock; extendLock }
class RateLimiter {
    fixedWindow(key, limit, windowSeconds): Promise<RateLimitResult>
    slidingWindow(key, limit, windowMs): Promise<{ allowed, count, remaining }>
    tokenBucket(key, capacity, refillPerSecond, cost?): Promise<{ allowed, tokens }>
    incrCapped(key, delta, max, ttlSeconds?): Promise<{ allowed, current }>
}
class Leaderboard { addScore; incrScore; addScoreAndRank; topN; rankOf }
class ValueStore { setValue; getValue; swapValue; mGetValue; rememberValue; enqueueValue;
                   dequeueValue; dequeueValueBlocking; publishValue; subscribeValue;
                   getAndTouchValue; popNValue; encode; decode }
class Versioned {
    set(key, expectedVersion, data, ttlSeconds?): Promise<{ ok, version }>
    setValue(type, key, expectedVersion, message, ttlSeconds?): Promise<{ ok, version }>
    get(key): Promise<{ version, data: string } | null>
    getValue<T>(type, key): Promise<{ version, data: T } | null>
}
class SubscriberPool {
    constructor(duplicate: () => RedisClient, onError?: SubscriberErrorHook)
    subscribeRaw(channel, handler: (message: Buffer, channel: Buffer) => void): Promise<Subscription>
    close(): Promise<void>
}
```

`subscribeValue` requires the parent `KVService` to have wired in a `SubscriberPool` (always true when constructed normally). The pool lazily opens a single duplicate connection on the first subscription, fan-outs to per-channel handler sets, and closes the connection when the last subscription is closed.

`versionedSet` semantics: missing key with `expectedVersion === 0` is a successful first write; missing key with non-zero expected fails. Existing key version mismatch → `{ ok: false, version: <current> }`. Success → `{ ok: true, version: expectedVersion + 1 }`.

---

## End-to-end Example

```ts
import { Pool } from 'pg'
import { createClient } from 'redis'
import Serializer from '@toolcase/serializer'

import {
    RouteHandler, Router, HttpServer,
    BaseRepository, EntityService, type TransactionClient, type Filter,
    KVService,
    ConflictError, NotFoundError, RateLimitedError,
} from '@toolcase/node'

// UserRepo implements the Postgres verbs over a pg Pool (see Repository → "Implementing a
// repository"); findByEmail builds on the findOne it implements.
class UserRepo extends BaseRepository<User, Pool> {
    constructor(pool: Pool) { super(pool, 'users', 'id') }
    findByEmail(email: string) { return this.findOne({ email } as Filter<User>) }
    // insert / findOne / paginate / update / … implemented here with SQL
}

class UserService extends EntityService<User, Pool> {
    constructor(repo: UserRepo, db: TransactionClient<Pool>, private kv: KVService) { super(repo, db) }

    protected async beforeInsert(values: Record<string, any>) {
        const taken = await (this.repository as UserRepo).findByEmail(values.email)
        if (taken) throw new ConflictError('User', `email taken: ${values.email}`)
        const rl = await this.kv.slidingWindow(`signup:${values.email}`, 5, 60_000)
        if (!rl.allowed) throw new RateLimitedError('signup', 60)
        return values
    }
}

class UsersEndpoint extends RouteHandler<UserDTO> {
    constructor(private svc: UserService) {
        super({
            prefix: '/users',
            idType: 'integer',
            schema: {
                id: { readonly: true, type: 'integer' },
                email: { required: true, type: 'string', format: 'email' },
                password: { writeOnly: true, type: 'string', min: 8 },
                role: { private: true, type: 'string' },
            },
            strictInput: true,
        })
    }
    register(fastify) {
        fastify.post(this.path(), this.routeOptions(), async (req, reply) => {
            try {
                const body = this.sanitizeInput(req.body, req)
                const created = await this.svc.insert(body as never)
                return this.created(reply, this.sanitizeOutput(created, req))
            } catch (e) { return this.mapError(e, reply) }
        })
    }
}

const kv = new KVService({ client: await createClient().connect(), namespace: 'app' })
await kv.warmScripts()

// `pool` is a pg Pool; `db` is your TransactionClient<Pool> adapter (a thin
// wrapper exposing `transaction(fn)` over `pool`).
const pool = new Pool()
const db: TransactionClient<Pool> = { transaction: (fn) => fn(pool) }
const svc = new UserService(new UserRepo(pool), db, kv)

const server = new HttpServer({ port: 3000, prefix: '/api/v1', healthCheck: () => kv.ping() })
    .add(new Router().add(new UsersEndpoint(svc)))

await server.init()
await server.run()
```

---

## Imaging

Sharp-backed image transforms plus an atlas builder that composes `Packer` from `@toolcase/base` with `sharp` and `node:fs`. Peer: `sharp` (optional, install only if you import these). `sharp` is loaded lazily — services that import `@toolcase/node` but never call `ImageProcessor` / `AtlasBuilder` skip the resolution entirely.

### ImageProcessor

Chainable wrapper around sharp. Transform methods queue operations on an immutable `ImageProcessor`; the underlying `sharp` pipeline is built fresh on each terminal call (`metadata`/`toBuffer`/`toFile`), so chains fork safely and the first call also triggers the lazy `import('sharp')`.

```ts
type ImageFormat = 'png' | 'jpeg' | 'webp' | 'avif'

interface ResizeOptions {
    width?: number
    height?: number
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside'
    withoutEnlargement?: boolean
    background?: string
}

interface CropOptions { left: number; top: number; width: number; height: number }

interface FormatOptions {
    format: ImageFormat
    quality?: number       // 1–100, default 80
    lossless?: boolean     // webp/avif
    progressive?: boolean  // jpeg/png
}

interface OptimizeOptions {
    format?: ImageFormat   // optimize for one encoder; if omitted, ALL encoders
                           //   (jpeg+png+webp+avif) are configured (legacy, wasteful)
    quality?: number       // default 80
    palette?: boolean      // png palette quantization, default true
    effort?: number        // 0–9 webp/avif compute budget, default 6
    stripMetadata?: boolean // default true
}

interface ImageMetadata {
    format: string; width: number; height: number
    channels: number; hasAlpha: boolean; size: number
}

class ImageProcessor {
    static fromBuffer(buffer: Buffer): ImageProcessor
    static fromPath(path: string): ImageProcessor

    resize(options: ResizeOptions): ImageProcessor
    crop(options: CropOptions): ImageProcessor
    format(options: FormatOptions): ImageProcessor
    optimize(options?: OptimizeOptions): ImageProcessor

    metadata(): Promise<ImageMetadata>
    toBuffer(): Promise<Buffer>
    toFile(path: string): Promise<ImageMetadata>
}
```

```ts
import { ImageProcessor } from '@toolcase/node'

const meta = await ImageProcessor.fromPath('./avatar.png')
    .resize({ width: 256, height: 256, fit: 'cover' })
    .format({ format: 'webp', quality: 80 })
    .optimize({ stripMetadata: true })
    .toFile('./avatar.webp')
```

Errors funnel through `ImageProcessorError` (`reason: 'invalid-buffer' | 'invalid-path' | 'crop-invalid' | 'crop-out-of-bounds' | 'decode-failed' | 'metadata-failed' | 'encode-failed' | 'write-failed'`). `invalid-buffer` / `invalid-path` / `crop-invalid` are thrown eagerly from the builder methods; the rest are produced lazily on the terminal call (`metadata` → `metadata-failed`, `toBuffer` → `encode-failed`, `toFile` → `write-failed`), with sharp's underlying message reclassified to `crop-out-of-bounds` / `decode-failed` when it matches.

### AtlasBuilder

Reads images from disk, packs them via `Packer` (from `@toolcase/base/packing`), composites each page into a single atlas image, writes pages + JSON manifest to disk.

```ts
import { AtlasBuilder } from '@toolcase/node'

interface AtlasInput { id: string; path: string }

interface AtlasBuilderOptions {
    output: {
        directory: string
        baseName?: string         // default 'atlas'
        format?: ImageFormat      // default 'png'
        quality?: number
    }
    packer?: Partial<PackingPackerOptions>  // forwarded to Packer
    background?: string                      // canvas fill (default transparent)
    writeManifest?: boolean                  // default true
    optimize?: boolean                       // run ImageProcessor.optimize on each page
    useAlphaTrimming?: boolean               // default true → trims transparent borders before packing
    continueOnError?: boolean                // default false → skip inputs that fail at the
                                             //   `decode` stage and collect them in result.failures
                                             //   instead of throwing. pack/compose/write errors
                                             //   still throw (whole-atlas concerns).
}

interface AtlasFrame {
    id: string
    page: number
    file: string                  // absolute path of atlas page
    rect: { x: number; y: number; width: number; height: number }
    rotated: boolean
    source: { path: string; width: number; height: number; offsetX: number; offsetY: number }
}

interface AtlasPageFile {
    page: number
    file: string                  // absolute path
    width: number; height: number
    occupancy: number
    frames: AtlasFrame[]
}

interface AtlasBuildFailure {
    input: AtlasInput
    stage: 'decode' | 'pack' | 'compose' | 'write'   // 'decode' in practice — see continueOnError
    error: Error
}

interface AtlasResult {
    pages: AtlasPageFile[]
    unpacked: Array<{ id: string; sourcePath: string; width: number; height: number }>
    manifestPath: string | null   // null if writeManifest === false
    pack: PackingResult           // raw Packer result for advanced introspection
    failures: AtlasBuildFailure[] // decode-stage failures skipped via continueOnError; [] otherwise.
                                  //   If every input fails to decode, build() still throws.
}

class AtlasBuilder {
    constructor(options: AtlasBuilderOptions)
    build(inputs: AtlasInput[]): Promise<AtlasResult>
}
```

Defaults applied to `Packer` when not overridden: `algorithm: 'max-rects'`, `sort: 'max-side-desc'`, `maxWidth: 2048`, `maxHeight: 2048`, `padding: 2`, `pot: 'page'`, `budget: { maxPagePixels: 2048*2048, maxPages: 16 }`. `trim` is owned by `AtlasBuilder` (via `useAlphaTrimming`), not by `Packer`.

```ts
const result = await new AtlasBuilder({
    output: { directory: './dist/atlases', baseName: 'characters', format: 'webp' },
    packer: { algorithm: 'max-rects', allowRotation: true, padding: 2, pot: 'page' },
    optimize: true
}).build([
    { id: 'hero-idle-0', path: './sprites/hero-idle-0.png' },
    { id: 'hero-idle-1', path: './sprites/hero-idle-1.png' },
    { id: 'hero-run-0',  path: './sprites/hero-run-0.png' }
])

console.log(result.pages[0].file)       // absolute path to characters.webp
console.log(result.pages[0].frames)      // per-sprite rects in atlas
console.log(result.manifestPath)         // absolute path to characters.json
```

Manifest shape (paths inside the manifest are relative to the manifest directory for portability):

```json
{
    "version": 1,
    "format": "webp",
    "pages": [
        {
            "page": 0,
            "file": "characters.webp",
            "width": 1024,
            "height": 512,
            "occupancy": 0.81,
            "frames": [
                {
                    "id": "hero-idle-0",
                    "rect": { "x": 0, "y": 0, "width": 64, "height": 96 },
                    "rotated": false,
                    "source": { "path": "../sprites/hero-idle-0.png", "width": 64, "height": 96, "offsetX": 0, "offsetY": 0 }
                }
            ]
        }
    ],
    "unpacked": []
}
```

Errors:

- `AtlasBuildError` with `stage: 'decode' | 'pack' | 'compose' | 'write'` for fatal stage failures.
- Sprites that exceed the page bounds end up in `result.unpacked` (no throw — caller decides if fatal).
- Rotated sprites use a 90° clockwise rotation (sharp's `rotate(-90)` in the source-buffer frame, which produces the standard CCW-in-output convention used by phaser-plus / TexturePacker).

Sharp ships ~30 MB of prebuilt binaries; install it only when you reach for these helpers.


## OAuth2 / OIDC

Generic OAuth2 / OpenID Connect helpers — Authorization Code (with PKCE), Client Credentials, Device Authorization, Refresh, Revoke, Token Introspection, OIDC discovery + ID-token verification. IDP-agnostic: provider configs are data, helpers are pure functions over them. No baked-in IDPs, no state machines, no framework coupling.

Peer deps: `@toolcase/base` (`Cache`, `EventEmitter`, `retry`, `HTTP.Status`). `jose ^5` is required only for `oidc.ts` (id_token verify + discovery isn't covered by jose, but JWKS is). Pure OAuth2 (Authorization Code, Client Credentials, Device, Refresh, Revoke, Introspection, Bearer extraction) does NOT pull `jose`.

### Errors

| Class | Status | Code | Use |
|---|---|---|---|
| `OAuth2CallbackError(upstreamError, description?)` | 400 | `OAUTH2_CALLBACK_ERROR` | upstream redirected with `error=` param (public fields: `upstreamError`, `upstreamDescription`) |
| `OAuth2TokenError(upstreamStatus, message, body?)` | 502 | `OAUTH2_TOKEN_ERROR` | non-2xx from token / userinfo / device-poll |
| `OAuth2ProtocolError(reason)` | 400 | `OAUTH2_PROTOCOL_ERROR` | shape violation (missing access_token, etc.) |
| `OIDCVerificationError(reason)` | 401 | `OIDC_VERIFICATION_FAILED` | id_token signature / claims rejected |
| `TokenIntrospectionError(reason)` | 401 | `TOKEN_INTROSPECTION_FAILED` | introspection request failed (active:false is NOT an error) |

All extend `OAuth2Error` → `EndpointError`. `errorMeta` maps via `EndpointError.statusCode` + `EndpointError.code`.

### `defineOAuth2Provider(opts)` / `oidcProvider(opts)`

`OAuth2ProviderConfig` (input + return shape of `defineOAuth2Provider`):

| Field | Type | Notes |
|---|---|---|
| `clientId` | `string` | required |
| `authorizationEndpoint` | `string` | required; trailing slash stripped |
| `tokenEndpoint` | `string` | required; trailing slash stripped |
| `clientSecret` | `string?` | drives the default `clientAuthMethod` |
| `clientAuthMethod` | `'client_secret_basic' \| 'client_secret_post' \| 'none'?` | explicit value always wins (incl. `'none'` with a secret set); else `client_secret_basic` if `clientSecret` present, else `none` |
| `pkceMethod` | `'S256' \| 'plain'?` | preferred PKCE challenge method |
| `revocationEndpoint` | `string?` | trailing slash stripped |
| `introspectionEndpoint` | `string?` | trailing slash stripped |
| `deviceAuthorizationEndpoint` | `string?` | trailing slash stripped |
| `userinfoEndpoint` | `string?` | trailing slash stripped |
| `endSessionEndpoint` | `string?` | trailing slash stripped (RP-initiated logout) |
| `jwksUri` | `string?` | trailing slash stripped |
| `issuer` | `string?` | OIDC issuer |
| `defaultScope` | `readonly string[]?` | default scopes |
| `id` | `string?` | caller-chosen identifier (passed through) |

`OidcProviderInput` (input to `oidcProvider`, which fetches discovery then calls `defineOAuth2Provider`):

| Field | Type | Notes |
|---|---|---|
| `issuer` | `string` | required; discovery is fetched from `{issuer}/.well-known/openid-configuration` |
| `clientId` | `string` | required |
| `clientSecret` | `string?` | |
| `clientAuthMethod` | `ClientAuthMethod?` | forwarded to `defineOAuth2Provider` |
| `defaultScope` | `readonly string[]?` | |
| `id` | `string?` | |
| `fetchImpl` | `typeof fetch?` | override for the discovery fetch |

All endpoints (`authorization`/`token`/`revocation`/`introspection`/`device`/`userinfo`/`endSession`/`jwksUri`) + `issuer` are filled from the discovery doc — you only supply credentials and scope.

```ts
const github = defineOAuth2Provider({
    id: 'github',
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    clientId, clientSecret,
    clientAuthMethod: 'client_secret_post',
    defaultScope: ['read:user', 'user:email']
})

const google = await oidcProvider({
    issuer: 'https://accounts.google.com',
    clientId, clientSecret,
    defaultScope: ['openid', 'email', 'profile']
})
```

`defineOAuth2Provider` validates required fields, normalizes trailing slashes, defaults `clientAuthMethod` (`client_secret_basic` if `clientSecret` else `none`). `oidcProvider` resolves the discovery doc and fills endpoints + `jwksUri` + `issuer`.

### `random.ts`

```ts
const pkce = generatePKCE()                  // { codeVerifier, codeChallenge, method: 'S256' }
const state = generateState()                // base64url, 32 bytes
const nonce = generateNonce()                // base64url, 32 bytes
```

`byteLength < 16` throws. `generatePKCE('plain')` returns `codeChallenge === codeVerifier`.

### `callback.ts` — CSRF state verification

```ts
import { verifyCallback, type VerifyCallbackInput } from '@toolcase/node'

interface VerifyCallbackInput {
    stored: string    // state your server generated and saved before the authorize redirect
    received: string  // state returned by the authorization server in the callback URL
}

// Constant-time CSRF guard.
// Throws OAuth2CallbackError('state mismatch') when lengths differ or values do not match.
function verifyCallback(input: VerifyCallbackInput): void
```

`state` is the CSRF token for the Authorization Code flow. A naive `===` check is vulnerable to timing side-channels: an attacker who can measure response latency may infer characters of the stored value one byte at a time. `verifyCallback` wraps Node's `crypto.timingSafeEqual` to close that window.

Call it as the first action inside the callback handler — before `exchangeCode` — so a forged `state` is rejected before any token request is made.

```ts
// authorize handler — store state inside the session blob alongside the rest of the flow data
const state = generateState()
const nonce = generateNonce()
const pkce  = generatePKCE()

await kv.set(`oauth2:session:${sessionId}`, JSON.stringify({
    state, nonce, codeVerifier: pkce.codeVerifier, redirectUri
}), { EX: 600 })

reply.redirect(303, buildAuthorizeURL(provider, {
    state, nonce,
    codeChallenge: pkce.codeChallenge, codeChallengeMethod: pkce.method,
    redirectUri, scope: ['openid', 'email', 'profile']
}))

// callback handler
const { code, state: receivedState, error, error_description } = req.query
if (error) throw new OAuth2CallbackError(error, error_description)

const raw = await kv.getDel(`oauth2:session:${sessionId}`)
if (!raw) throw new OAuth2ProtocolError('session_missing_or_expired')
const flow = JSON.parse(raw)

verifyCallback({ stored: flow.state, received: receivedState })   // CSRF guard — before exchangeCode

const tokens = await exchangeCode(provider, { code, codeVerifier: flow.codeVerifier, redirectUri: flow.redirectUri })
// then verifyIdToken(..., { nonce: flow.nonce, ... })
```

> **Nonce replay protection.** `verifyCallback` guards only `state`. Always also pass `nonce` to `verifyIdToken` — omitting it silently skips the nonce check and leaves the OIDC flow open to replay attacks.

### `flow.ts` — Authorization Code

```ts
import { buildAuthorizeURL, exchangeCode, refreshToken, revokeToken, fetchUserinfo } from '@toolcase/node'

const url = buildAuthorizeURL(provider, {
    state, nonce,
    codeChallenge: pkce.codeChallenge, codeChallengeMethod: pkce.method,
    redirectUri,
    scope: ['openid', 'email', 'profile'],
    extraParams: { access_type: 'offline', prompt: 'consent' }
})

const tokens = await exchangeCode(provider, { code, redirectUri, codeVerifier: pkce.codeVerifier })
const refreshed = await refreshToken(provider, { refreshToken: tokens.refreshToken!, scope: ['openid'] })
await revokeToken(provider, tokens.refreshToken!, 'refresh_token')
const userinfo = await fetchUserinfo(provider, tokens.accessToken)
```

`extraParams` is sorted before append and cannot override reserved keys (`response_type`, `client_id`, `redirect_uri`, `scope`, `state`, `code_challenge`, `code_challenge_method`, `nonce`, `prompt`, `login_hint`, `response_mode`) — collision throws.

### `grants.ts` — Client Credentials + Device

```ts
import { clientCredentialsToken, requestDeviceCode, pollDeviceToken } from '@toolcase/node'
import { EventEmitter } from '@toolcase/base'

// S2S
const ccTokens = await clientCredentialsToken(serviceProvider, { scope: ['api:read'], audience: 'https://api.test' })

// CLI device flow
const code = await requestDeviceCode(provider, { scope: ['openid'] })
console.log(`Visit ${code.verificationUri} and enter ${code.userCode}`)

const events = new EventEmitter()
events.on('pending', e => spinner.tick())
events.on('slow_down', e => spinner.text = `Slowing to ${e.newIntervalSeconds}s…`)

const tokens = await pollDeviceToken(provider, {
    deviceCode: code.deviceCode,
    intervalSeconds: code.intervalSeconds,
    abortSignal: cancelController.signal,
    events
})
```

`pollDeviceToken` honors `slow_down` (+5s interval), `authorization_pending` (continue), `expired_token` / `access_denied` (throw `OAuth2TokenError`). Aborts via `abortSignal` throw `Error('aborted')`.

### `resource.ts` — Resource server

```ts
import { extractBearerToken, introspectToken } from '@toolcase/node'

app.addHook('preHandler', async (req, reply) => {
    const token = extractBearerToken(req.headers.authorization)
    if (!token) throw new EndpointError(401, 'UNAUTHORIZED', 'missing bearer token')

    const intro = await introspectToken(provider, { token, tokenTypeHint: 'access_token' })
    if (!intro.active) throw new EndpointError(401, 'UNAUTHORIZED', 'token not active')
    if (intro.expiresAt && intro.expiresAt.getTime() < Date.now()) throw new EndpointError(401, 'UNAUTHORIZED', 'token expired')

    req.auth = intro
})
```

`active: false` is a normal `IntrospectionResponse`, not an error — only network / non-2xx / shape failures throw `TokenIntrospectionError`.

### `oidc.ts` — Discovery + ID-token verify

```ts
import { fetchOIDCDiscovery, verifyIdToken, oidcProvider, clearJwksCache } from '@toolcase/node'

const verified = await verifyIdToken(tokens.idToken!, {
    issuer: provider.issuer!,
    audience: provider.clientId,
    jwksUri: provider.jwksUri!
}, {
    nonce: flow.nonce,
    accessToken: tokens.accessToken,
    authorizationCode: code,
    maxAgeSeconds: 3600,
    requiredAmr: ['mfa']
})
```

Default allowed algorithms: `['RS256', 'ES256', 'EdDSA']`. Default clock tolerance: 30s. Default JWKS TTL: 600s (jose handles per-key freshness inside that envelope). Discovery doc cached 24h — `clearDiscoveryCache(issuer?)` invalidates one or all entries; `clearJwksCache(jwksUri?)` is the JWKS analogue.

### `profiles.ts` — Profile shape helpers

```ts
import { parseStandardOIDCProfile, parseGitHubProfile, parseDiscordProfile } from '@toolcase/node'

// Standard OIDC (Google, Auth0, Okta, Keycloak, …)
const profile = parseStandardOIDCProfile({ tokens, userinfo })

// GitHub — fetch /user + /user/emails yourself, then map
const headers = { Authorization: `token ${tokens.accessToken}`, Accept: 'application/vnd.github+json' }
const [user, emails] = await Promise.all([
    fetch('https://api.github.com/user', { headers }).then(r => r.json()),
    fetch('https://api.github.com/user/emails', { headers }).then(r => r.json())
])
const ghProfile = parseGitHubProfile({ user, emails })

// Discord — fetch /users/@me yourself, then map
const dcUser = await fetch('https://discord.com/api/users/@me', { headers: { Authorization: `Bearer ${tokens.accessToken}` } }).then(r => r.json())
const dcProfile = parseDiscordProfile({ user: dcUser })
```

Pure functions over already-fetched data. They never make HTTP calls — fetch is the caller's job.

### Cookbook — Authorization Code in Fastify

```ts
import { generatePKCE, generateState, generateNonce, buildAuthorizeURL, exchangeCode, fetchUserinfo, verifyIdToken, parseStandardOIDCProfile, oidcProvider, OAuth2CallbackError, OAuth2ProtocolError } from '@toolcase/node'

const provider = await oidcProvider({ issuer: 'https://accounts.google.com', clientId, clientSecret })
const STATE_TTL = 600

app.get('/auth/login', async (req, reply) => {
    const pkce = generatePKCE()
    const state = generateState()
    const nonce = generateNonce()
    const redirectUri = `${origin(req)}/auth/callback`

    await kv.set(`oauth2:state:${state}`, JSON.stringify({
        codeVerifier: pkce.codeVerifier, nonce, redirectUri, returnTo: req.query.return_to, createdAt: Date.now()
    }), { EX: STATE_TTL })

    reply.redirect(303, buildAuthorizeURL(provider, {
        state, nonce,
        codeChallenge: pkce.codeChallenge, codeChallengeMethod: pkce.method,
        redirectUri,
        scope: ['openid', 'email', 'profile']
    }))
})

app.get('/auth/callback', async (req, reply) => {
    const { code, state, error, error_description } = req.query
    if (error) throw new OAuth2CallbackError(error, error_description)

    const raw = await kv.getDel(`oauth2:state:${state}`)
    if (!raw) throw new OAuth2ProtocolError('state_missing_or_expired')
    const flow = JSON.parse(raw)

    const tokens = await exchangeCode(provider, { code, codeVerifier: flow.codeVerifier, redirectUri: flow.redirectUri })

    let idTokenClaims
    if (tokens.idToken) {
        const verified = await verifyIdToken(tokens.idToken, {
            issuer: provider.issuer!, audience: provider.clientId, jwksUri: provider.jwksUri!
        }, { nonce: flow.nonce, accessToken: tokens.accessToken, authorizationCode: code })
        idTokenClaims = verified.payload
    }

    const userinfo = await fetchUserinfo(provider, tokens.accessToken).catch(() => undefined)
    const profile = parseStandardOIDCProfile({ tokens: { ...tokens, raw: { ...tokens.raw, ...idTokenClaims } }, userinfo })

    const userId = await upsertUserBySubject(profile.subject, profile)
    reply.setCookie('session', await jwt.sign({ userId }, '15m'), { httpOnly: true, secure: true, sameSite: 'lax', path: '/' })
    reply.redirect(303, flow.returnTo ?? '/')
})
```

### Cookbook — IDP snippets

```ts
// Google
const google = await oidcProvider({ issuer: 'https://accounts.google.com', clientId, clientSecret, defaultScope: ['openid', 'email', 'profile'] })

// Auth0
const auth0 = await oidcProvider({ issuer: 'https://tenant.us.auth0.com', clientId, clientSecret })

// Okta
const okta = await oidcProvider({ issuer: 'https://tenant.okta.com', clientId, clientSecret })

// Keycloak
const kc = await oidcProvider({ issuer: 'https://kc.test/realms/myrealm', clientId, clientSecret })

// Authentik / Cognito / Zitadel — all OIDC, use oidcProvider with the issuer URL.

// GitHub — non-OIDC
const github = defineOAuth2Provider({
    id: 'github',
    authorizationEndpoint: 'https://github.com/login/oauth/authorize',
    tokenEndpoint: 'https://github.com/login/oauth/access_token',
    clientId, clientSecret,
    clientAuthMethod: 'client_secret_post',
    defaultScope: ['read:user', 'user:email']
})

// Discord — non-OIDC
const discord = defineOAuth2Provider({
    id: 'discord',
    authorizationEndpoint: 'https://discord.com/api/oauth2/authorize',
    tokenEndpoint: 'https://discord.com/api/oauth2/token',
    revocationEndpoint: 'https://discord.com/api/oauth2/token/revoke',
    clientId, clientSecret,
    clientAuthMethod: 'client_secret_post',
    defaultScope: ['identify', 'email']
})
```

---

## Store

Two-file persistent key-value store backed by a B+ tree index and an append-mostly data heap. Node-only (uses `FileHandle` from `node:fs/promises`). No extra peer deps beyond `@toolcase/base`. Storage is split across:

- `<path>.idx` — `BPlusIndex<K, BlockRef>` from `@toolcase/base` (managed by `FsAdapter`), maps keys to 12-byte `BlockRef` pointers.
- `<path>.dat.N` — append-mostly heap segments; each block is a raw serialised value blob.

### BlockRef / helpers

```ts
interface BlockRef {
    segment: number   // uint32 — which .dat.N segment file
    offset:  number   // uint32 — byte offset within that segment
    length:  number   // uint32 — byte length of the block
}

const BLOCK_REF_SIZE = 12   // bytes (fixed-size struct)

function serializeBlockRef(ref: BlockRef): Uint8Array
function deserializeBlockRef(buf: Uint8Array): BlockRef
```

### NodeStoreOptions<K, V>

```ts
interface NodeStoreOptions<K, V> {
    path:              string                         // base path; .idx and .dat.N are appended
    compare:           (a: K, b: K) => number        // key ordering function
    serializeKey:      (k: K) => Uint8Array
    deserializeKey:    (b: Uint8Array) => K
    serializeValue:    (v: V) => Uint8Array
    deserializeValue:  (b: Uint8Array) => V
    keyEncoding?:      string                        // forwarded to BPlusIndex for guard checks
    pageSize?:         number                        // B+ tree page size in bytes (default 4096)
}
```

`BPlusIndex.keyPreset` from `@toolcase/base` supplies pre-wired `{ compare, serializeKey, deserializeKey, keyEncoding }` bundles for `'string'`, `'number'`, and `'bigint'` key types — spread one into the options to skip the boilerplate:

```ts
const store = await NodeStore.open({
    path: '/data/mystore',
    ...BPlusIndex.keyPreset.string,
    serializeValue:   v => new TextEncoder().encode(v),
    deserializeValue: b => new TextDecoder().decode(b),
})
```

### NodeStore<K, V>

```ts
class NodeStore<K, V> {
    static open<K, V>(opts: NodeStoreOptions<K, V>): Promise<NodeStore<K, V>>

    // Accessors
    get size(): number        // live entry count
    get liveRatio(): number   // live heap bytes / total heap bytes; 1.0 = no dead space

    // CRUD
    get(key: K): Promise<V | undefined>
    set(key: K, value: V): Promise<void>
    delete(key: K): Promise<boolean>

    // Iteration — all in B+ tree key order
    entries(): AsyncGenerator<[K, V]>
    range(opts?: RangeOptions<K>): AsyncGenerator<[K, V]>   // bounded scan; RangeOptions<K> from @toolcase/base
    keys(): AsyncGenerator<K>
    values(): AsyncGenerator<V>

    // Maintenance
    optimize(): Promise<void>   // compact: copy live blocks to new segment, reclaim dead space
    flush(): Promise<void>      // fsync both heap and index
    close(): Promise<void>
}
```

`RangeOptions<K>` from `@toolcase/base`: `{ gte?, gt?, lte?, lt? }` compared with the store's `compare` function.

```ts
import { NodeStore } from '@toolcase/node'
import { BPlusIndex } from '@toolcase/base'

const store = await NodeStore.open({
    path: '/data/mystore',
    ...BPlusIndex.keyPreset.string,
    serializeValue:   v => new TextEncoder().encode(v),
    deserializeValue: b => new TextDecoder().decode(b),
})

await store.set('hello', 'world')
const v = await store.get('hello')    // 'world'
await store.delete('hello')

// Bounded range scan
for await (const [key, value] of store.range({ gte: 'a', lte: 'z' })) {
    console.log(key, value)
}

// Compaction metrics and maintenance
console.log(store.liveRatio)   // < 1 means dead heap space; run optimize() to reclaim
await store.optimize()
await store.flush()
await store.close()
```

**Crash safety.** `set()` fsyncs the heap segment before committing the index entry — a crash between the two steps leaves at most a harmless orphan block in `.dat.N`. The index stays consistent. On the next `open()`, segment files not referenced by the index are detected as crash orphans and deleted automatically.

**Compaction (`optimize()`).** Copies all live blocks to a fresh segment in key order, atomically updates the index with a single `setMany` call (one superblock commit), then deletes the old segments. A crash before the `setMany` leaves the new segment as an orphan, cleaned up on `open()`. A crash after `setMany` but before old-segment deletion leaves extra files that are cleaned up on `open()` — both paths are safe.

**`NodeStore` vs `KVService`.** Use `NodeStore` for durable file-based storage with no infrastructure dependency (embedded caches, local feature stores, offline-capable worker state). Use `KVService` (Redis) for distributed in-memory state with TTL, pub/sub, and horizontal scale.

### BlockStore

Append-mostly heap manager that `NodeStore` wraps internally. Exported as a public API for advanced use cases that need raw segment-level access (e.g. a standalone append-only log).

```ts
class BlockStore {
    constructor(basePath: string)

    segmentPath(segId: number): string

    get activeSegment(): number
    get activeOffset():  number

    // Discovery — returns { segId → file size } for all .dat.N files found on disk
    scanSegments(): Promise<Map<number, number>>
    setActive(segId: number, writeOffset: number): void
    nextSegmentId(): number   // returns activeSegment + 1 (for a fresh compaction segment)

    // I/O
    append(data: Uint8Array): Promise<BlockRef>                        // write to active segment
    read(ref: BlockRef): Promise<Uint8Array>                           // read any block by ref
    writeAt(segId: number, offset: number, data: Uint8Array): Promise<void>  // used during compaction

    // Durability
    fsyncActive(): Promise<void>
    fsyncSegment(segId: number): Promise<void>

    // Lifecycle
    deleteSegment(segId: number): Promise<void>   // closes handle + unlinks file; unlink errors swallowed
    close(): Promise<void>
}
```
