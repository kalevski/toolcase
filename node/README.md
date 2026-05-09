# @toolcase/node

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/node?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/node)
[![npm downloads](https://img.shields.io/npm/dw/@toolcase/node?label=downloads&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/node)

Node.js helpers for backend services. Dual ESM + CJS, TypeScript types, Node 18+.

Single entrypoint, peer-dep-driven so you only pay for what you import:

| Module group | Symbols | Peer deps |
|---|---|---|
| Errors | `LibError`, `NotFoundError`, `ConflictError`, `ValidationError`, `OptimisticLockError`, `LockNotAcquiredError`, `RateLimitedError`, `OAuth2*Error`, `errorMeta` | `@toolcase/base` |
| Utils | `createSanitizer`, `Sanitizer`, `applyWhere`, `applyOrderBy`, `normalizeOffsetLimit`, `parseFilters`, `parseSort` | `@toolcase/base` |
| RouteHandler | `RouteHandler`, `Router`, `RESTRouteHandler`, `HttpServer` | `@toolcase/base`, `fastify`, `@fastify/cors` |
| Repository | `BaseRepository`, `SoftDeleteRepository`, `EntityService` | `@toolcase/base`, `kysely` |
| KV | `KVService` (`.locker`, `.rateLimiter`, `.leaderboard`, `.objects`, `.versioned`, `.subscribers`) | `@toolcase/base`, `@toolcase/serializer`, `redis` |
| Imaging | `ImageProcessor`, `AtlasBuilder` (composes `@toolcase/base/packing`) | `@toolcase/base`, `sharp` |
| OAuth2 | Authorization Code / Client Credentials / Device flows; Bearer + Token Introspection; OIDC discovery + ID-token verify; PKCE + state + nonce | `jose` (optional, OIDC only) |

## Install

```bash
npm install @toolcase/node @toolcase/base
# Plus peers for what you use:
npm install fastify @fastify/cors          # route handler
npm install kysely                         # repository
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
} from '@toolcase/node'
```

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)
