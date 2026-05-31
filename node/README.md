# @toolcase/node

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/node?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/node)
[![npm downloads](https://img.shields.io/npm/dw/@toolcase/node?label=downloads&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/node)

Node.js helpers for backend services. Dual ESM + CJS, TypeScript types, Node 18+.

Single entrypoint, peer-dep-driven so you only pay for what you import:

| Module group | Symbols | Peer deps |
|---|---|---|
| Errors | `LibError`, `NotFoundError`, `ConflictError`, `ValidationError`, `OptimisticLockError`, `LockNotAcquiredError`, `RateLimitedError`, `OAuth2*Error`, `errorMeta` | `@toolcase/base` |
| Utils | `createSanitizer`, `Sanitizer`, `buildWhere`, `buildOrderBy`, `quoteIdent`, `normalizeOffsetLimit`, `parseFilters`, `parseSort` | `@toolcase/base` |
| RouteHandler | `RouteHandler`, `Router`, `RESTRouteHandler`, `HttpServer` | `@toolcase/base`, `fastify`, `@fastify/cors` |
| Repository | `BaseRepository`, `EntityService`, `SqlExecutor`, `SqlClient` | `@toolcase/base` + a raw-SQL `{ query }` executor (e.g. `pg`) you supply |
| KV | `KVService` (`.locker`, `.rateLimiter`, `.leaderboard`, `.objects`, `.versioned`, `.subscribers`) | `@toolcase/base`, `@toolcase/serializer`, `redis` |
| Imaging | `ImageProcessor`, `AtlasBuilder` (composes `@toolcase/base/packing`) | `@toolcase/base`, `sharp` |
| OAuth2 | Authorization Code / Client Credentials / Device flows; Bearer + Token Introspection; OIDC discovery + ID-token verify; PKCE + state + nonce | `jose` (optional, OIDC only) |

The repositories speak raw **Postgres** SQL (`$N` placeholders, `RETURNING *`, `ON CONFLICT … EXCLUDED`, `= ANY`, `COUNT(*)`) over a tiny `{ query }` executor — no query builder, no bundled driver. Bring your own `pg` pool (or anything matching `SqlExecutor` / `SqlClient`).

## Install

```bash
npm install @toolcase/node @toolcase/base
# Plus peers for what you use:
npm install fastify @fastify/cors          # route handler
npm install pg                             # repository (or any { query } executor)
npm install redis @toolcase/serializer     # kv
npm install sharp                          # imaging
npm install jose                           # oauth2 / oidc
```

## Usage

```ts
import {
    createSanitizer,
    normalizeOffsetLimit,
    RouteHandler,
    HttpServer,
    BaseRepository,
    EntityService,
    KVService,
    NotFoundError,
    ValidationError,
    type SqlClient,
} from '@toolcase/node'
import { Pool } from 'pg'

const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Wrap a pg Pool as a SqlClient (executor + transaction).
const db: SqlClient = {
    query: (sql, params) => pool.query(sql, params),
    transaction: async (fn) => {
        const c = await pool.connect()
        try {
            await c.query('BEGIN')
            const result = await fn(c)
            await c.query('COMMIT')
            return result
        } catch (e) {
            await c.query('ROLLBACK')
            throw e
        } finally {
            c.release()
        }
    },
}
```

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)
