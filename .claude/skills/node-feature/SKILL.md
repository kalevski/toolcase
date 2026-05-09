---
name: node-feature
description: Add a new feature, helper, error class, repository, endpoint, KV primitive, or utility to `@toolcase/node`. Triggers when the user asks to add/create/scaffold a new export inside `node/src/` (e.g. "add a SoftDeleteRepository extension", "ship a TokenBucket helper to KVService", "new sanitize visitor", "add a Fastify pre-handler for X"). Wires up the `.ts` file, the test, the `main.ts` (and `main.iso.ts` if isomorphic) export, and updates the inventory + downstream skill doc.
---

# node-feature

Scaffold a new feature in `@toolcase/node`. Backend-only Node helpers — Fastify endpoints, Kysely repositories, Redis KV primitives, isomorphic sanitize / pagination / where / orderBy, typed `env`, and the domain-error tree. Single entrypoint (`@toolcase/node`) re-exporting every surface.

## REQUIRED reading before generating any code

**You MUST read three files in this order before writing anything:**

1. **`.claude/skills/node-feature/features.md`** (bundled with this skill) — inventory of every existing export under `node/src/`. Use to check whether your feature already exists or can be composed from existing primitives. **Reuse before reinvent.**
2. **`.claude/skills/node-feature/conventions.md`** (bundled) — code style (tabs vs spaces, no semicolons, error class shape), file layout, subsystem layout (`utils/`, `kv/`), how peer-dep gating works, how exports flow into `main.ts` and `main.iso.ts`.
3. **`examples/public/node/SKILL.md`** — user-facing API reference for `@toolcase/node` published at `toolcase.kalevski.dev/node/SKILL.md`. **Downstream contract.** Anything you add must be appended here in the matching surface section (utils / errors / repository / endpoint / kv).

Do not paraphrase. Open all three. Locate the section matching your feature category (env / errors / utils / repository / endpoint / kv). The shapes you write into the new file, the test, and the docs must follow the patterns visible in those files.

## REUSE rule (load-bearing)

Before adding a new export, scan `features.md` for any existing primitive that already covers part of your task. Concrete checks:

- Need a domain error? Extend the matching parent (`RepositoryError` / `KVServiceError` / `EndpointError`) — do not create a new top-level `LibError` sibling unless you are introducing a brand new subsystem.
- Need pagination shape? Use `Page<T>` / `CursorPage<T>` + `normalizeOffsetLimit` / `buildPage` — do not invent a new envelope.
- Need where/order helpers? Use `applyWhere` / `applyOrderBy` and the `WhereClause<T>` / `OrderBy<T>` types — do not write a new query DSL.
- Need a sanitize step? Compose `pipe(...)` over the built-in visitors (`removePrivate`, `removeWriteOnly`, `coerceNumber`, …). Add a new visitor only if the behavior is novel.
- Need a CRUD slice? Subclass `BaseRepository` (with `SoftDeleteRepository` if soft-delete) and wrap with `EntityService` — do not write a new repo base.
- Need a Fastify route surface? Subclass `RouteHandler`, compose with `Router`, mount via `HttpServer.add()`. Do not bypass — `HttpServer` owns the lifecycle and `/health`.
- Need a Redis primitive? Add it to `KVService` (or one of its sub-classes — `Locker`, `RateLimiter`, `Leaderboard`, `ValueStore`, `Versioned`, `SubscriberPool`). Use the existing `KeyBuilder` for namespacing and `LuaScriptCache` for atomic scripts. Do not call `client.eval` directly from a feature file.
- Need a typed env-var read? Use `env(key, default, type)` — do not roll a new parser.
- Need a logger contract? Use the `Logger` interface from `node/src/utils/logger.ts` — do not introduce a second one.

If your new feature would duplicate >50% of an existing one, **stop and either extend the existing class or compose around it** instead of adding a new one. If you must add a new one, document the divergence in `features.md` for the new feature ("Skip when" bullet citing the existing primitive).

## When to use

Trigger on requests like:

- "add a [helper / utility / error class / sanitize visitor / KV method] to node"
- "implement [SoftDeleteRepository / TokenBucket / SubscriberPool extension / …] in @toolcase/node"
- "I need a [Fastify pre-handler / RouteHandler subclass / Kysely repo helper] for the backend"
- any request mentioning `node/src/`, `@toolcase/node`, Fastify endpoint composition, Kysely repository helpers, Redis KV primitives

Do NOT use for:

- Edits to existing `node/src/` files (just edit them; the rules below still apply for export placement, peer-dep gating, and inventory updates).
- Anything that must run in the browser (it goes in `@toolcase/base`, or an isomorphic helper under `node/src/utils/` re-exported from `main.iso.ts`).
- Logging primitives (the `Logger` interface here is just a contract — actual reporters belong in `@toolcase/logging`; use the `logging-feature` skill).
- Serialization (use `serializer-feature` skill).
- Game runtime (use `phaser-plus-feature` skill).
- React UI (use `react-component` skill).

## Hard rules

These are non-negotiable. They come from `node/package.json` (`engines.node >= 18`, `sideEffects: false`, peer-dep map), `node/tsup.config.js` (Node platform, ESM + CJS, externals), and the patterns every existing file in `node/src/` follows.

1. **Node-only.** `node/src/` may freely use `process`, `Buffer`, `node:crypto`, `node:fs`, `node:path`, etc. Don't pretend to be isomorphic — that is what `@toolcase/base` is for.
2. **Peer-dep gated.** A new file may only `import` from a peer that is declared in `node/package.json` `peerDependencies`. Current allowed peers: `@toolcase/base`, `@toolcase/serializer`, `fastify`, `@fastify/cors`, `kysely`, `redis`. Anything else → vendor it under `node/src/` or push back to the user. Files importing optional peers (`fastify`, `kysely`, `redis`, `@toolcase/serializer`, `@fastify/cors`) must be reachable from `main.ts` only — consumers who don't install the peer will tree-shake them via `sideEffects: false` and named-import paths.
3. **Isomorphic-eligible code goes in `node/src/utils/` and re-exports from `main.iso.ts`.** If your file does not touch `process`/`Buffer`/`fs`/Node-only peers, place it under `node/src/utils/` and add it to `node/src/utils/index.ts` AND `node/src/main.iso.ts`. Sanitize / pagination / where / orderBy / errors / Logger interface are the existing examples. Anything Node-bound (Fastify, Kysely, Redis, `env`, anything calling `process.env`) only goes in `main.ts`.
4. **One export concern per file.** Filename matches the primary export. PascalCase class → `PascalCase.ts`. lowerCamelCase function → `lowerCamel.ts`. Subsystems (`kv/`, `utils/`, …) get a folder with an `index.ts` that re-exports.
5. **`main.ts` is the gateway. `main.iso.ts` mirrors only isomorphic surface.** Every public export from a `node/src/` file must be reachable through `node/src/main.ts`. If it is also isomorphic-safe, it must additionally be reachable through `node/src/main.iso.ts`. Both files are flat `export * from './…'` lines — keep them sorted into the existing groups (errors → utils → endpoint → repository → kv).
6. **Subsystems group three-or-more related files.** Existing examples: `node/src/utils/` (sanitize/pagination/where/orderBy/logger/types), `node/src/kv/` (Locker/RateLimiter/Leaderboard/ValueStore/Versioned/SubscriberPool/KVService/keys/scripts/types). Add a third file? Make a folder with `index.ts` `export *` re-exports and import via that folder from `main.ts`.
7. **Tests are mandatory.** Every new export ships with `node/test/<Name>.test.ts` (or `node/test/<group>/<Name>.test.ts`) using vitest. Tests must cover: happy path, contract violations (throws), and any peer-dep-mocked side effect. Use vitest mocks for `kysely`, `redis`, and `fastify` rather than spinning real services.
8. **Strict TypeScript.** Generics where it makes sense; precise return types; no `any` for public surface. Use `T | null` over `T | undefined` for "absent" in public APIs (matches `statusCodeFromError`, `Locker.tryWithLock`, `Versioned.versionedGet`).
9. **No code comments.** Self-documenting names only. Existing files contain almost zero `//`. JSDoc only when a parameter's contract is non-obvious from its type (units, valid ranges, atomicity guarantees, side effects). When you do use JSDoc, mirror the multi-line style from `RouteHandler.ts` / `HttpServer.ts` / `KVService.ts`.
10. **No semicolons.** Match the project-wide prettier config (`.prettierrc` `"semi": false`).
11. **Indent: tabs in `node/src/`, 4 spaces in `node/test/`.** The legacy outlier is `node/src/env.ts` (4 spaces). For NEW files, use **tabs** under `node/src/` (matches `errors.ts`, `RouteHandler.ts`, `HttpServer.ts`, `BaseRepository.ts`, `kv/*`, `utils/*`). Tests use 4 spaces (matches `test/env.test.ts` and the rest of the monorepo). Do NOT reformat tabs to spaces in existing files — that is a reformatting churn the project has not opted into.
12. **Errors extend the existing tree.** All new error classes must inherit (transitively) from `LibError` defined in `node/src/errors.ts`. Pick the right parent: `RepositoryError`, `KVServiceError`, `EndpointError`. Always set readonly fields for any data the consumer needs to handle the error (resource id, key, retry-after, etc.). If an error maps to an HTTP status, also wire it into `statusCodeFromError`.
13. **Update the published `SKILL.md`.** When you add a feature, append a section to `examples/public/node/SKILL.md` matching the existing surface (env / Errors / Utils / Repository / RouteHandler / KVService). The published doc is the contract Claude Code installs as a skill — keep it current.
14. **Update `features.md`.** Append a section to `.claude/skills/node-feature/features.md` matching the existing entries (heading, one-line description, "Use when" / "Skip when" bullets, public API table, "Reuses" line if it composes with another node export).
15. **No demo site requirement.** Unlike `base`, the `examples/` workspace does not host a node demo (it is a Vite SPA — Fastify/Kysely/Redis won't run there). The downstream contract is the published `SKILL.md` only.

## Files to create / modify per feature

For a new export named `<Name>`:

1. **`node/src/<Name>.ts`** — top-level helper or class (e.g. a new error subclass, a new RouteHandler mixin, a new top-level service).
   OR **`node/src/utils/<Name>.ts`** — isomorphic helper (sanitize visitor, pagination/where/orderBy variant, logger adapter shape).
   OR **`node/src/kv/<Name>.ts`** — Redis-backed KV primitive (pair with `KeyBuilder` and `LuaScriptCache`; export classes that the `KVService` constructor wires up).
   OR **`node/src/<group>/<Name>.ts`** — when introducing a new subsystem of three+ files, create the folder with `index.ts`.
2. **`node/test/<Name>.test.ts`** (or `node/test/<group>/<Name>.test.ts`) — vitest. Match the shape of `node/test/env.test.ts`. Mock peer libs with `vi.mock`.
3. **`node/src/main.ts`** — append `export * from './<Name>'` (or `'./<group>/<Name>'`) into the matching block (errors → utils → endpoint/server → repository/CRUD → kv). Keep within the existing grouping comments / ordering.
4. **`node/src/main.iso.ts`** — append `export * from './<Name>'` ONLY if the file has no Node-only imports. (Sanitize, pagination, where, orderBy, errors, the `Logger` interface qualify. Anything pulling `node:*`, `process`, `Buffer`, `fastify`, `kysely`, `redis` does NOT.)
5. **`examples/public/node/SKILL.md`** — append the API section. Same shape as existing entries. For new errors: extend the Errors fence. For new utils: extend the Utils block. For new repo/endpoint methods: append to the corresponding fenced block. For new KVService methods: append to the appropriate KVService section. For new subsystems: a new top-level `## <Group>` section.
6. **`.claude/skills/node-feature/features.md`** — append an inventory entry following the existing pattern (heading `### \`<Name>\` — <short tagline>`, one-line description, "Use when" / "Skip when" bullets, public API table, "Reuses" line if it composes with another node export).
7. **(Conditional)** If your feature changes the peer-dep matrix (e.g. adding a new optional peer), also update `node/package.json` (`peerDependencies` + `peerDependenciesMeta`), `node/tsup.config.js` `external` array, `node/README.md` peer table, and `examples/public/node/SKILL.md` peer-deps table.

## Component templates

### Error class (`node/src/errors.ts`)

Errors live in the single `node/src/errors.ts` file, NOT a per-class file. Append the new class to the existing tree:

```ts
export class WhateverError extends RepositoryError {

	readonly resource: string

	constructor(resource: string, message?: string) {
		super(message ?? `${resource} whatever`)
		this.resource = resource
	}
}
```

If the error maps to an HTTP status, extend `statusCodeFromError`:

```ts
if (error instanceof WhateverError) return Status.BAD_REQUEST
```

### Sanitize visitor (`node/src/utils/sanitize/<name>.ts`)

```ts
import type { Visitor } from './types'

const myVisitor: Visitor<unknown> = ({ value }, { set }) => {
	if (typeof value !== 'string') return
	set(value.replace(/\s+/g, ' '))
}

export default myVisitor
```

Then re-export from `node/src/utils/sanitize/index.ts` and ultimately surface through `node/src/main.ts` + `node/src/main.iso.ts`.

### KV primitive (`node/src/kv/<Name>.ts`)

Match the constructor surface of existing primitives — accept `RedisClient`, `KeyBuilder`, `LuaScriptCache` so it composes into `KVService`:

```ts
import { KeyBuilder } from './keys'
import { LuaScriptCache } from './scripts'
import type { RedisClient } from './types'

const NAMESPACE = 'mything'

export class MyThing {

	constructor(
		private readonly client: RedisClient,
		private readonly keys: KeyBuilder,
		private readonly scripts: LuaScriptCache,
	) {}

	private k(key: string): string {
		return this.keys.build(NAMESPACE, key)
	}

	async doThing(key: string): Promise<number> {
		return await this.client.incr(this.k(key))
	}
}
```

Then wire into `KVService` constructor as `readonly myThing: MyThing` and surface its public methods as delegating proxies if they belong on the `KVService` flat surface (most do — see `incrCapped`, `tokenBucket`).

### Repository extension (`node/src/<Name>Repository.ts`)

Extend `BaseRepository` (or `SoftDeleteRepository`); add domain-specific queries. Do not duplicate CRUD — that is `BaseRepository`'s job.

### RouteHandler subclass (`node/src/<Name>RouteHandler.ts`)

Extend `RouteHandler<T>`. Implement `register(fastify)` using the protected helpers (`path()`, `itemPath()`, `routeOptions()`, `parseId()`, `sanitize*()`, `ok()`, `created()`, `mapError()`). Don't reach for `fastify.register(cors)` etc. — that is `HttpServer`'s job.

## Test template (`node/test/<Name>.test.ts`)

```ts
import { describe, it, expect, vi } from 'vitest'
import MyFeature from '../src/MyFeature'

describe('MyFeature', () => {
    it('throws on invalid construction', () => {
        expect(() => new MyFeature(null as any)).toThrow()
    })

    it('happy path', async () => {
        const f = new MyFeature({ /* ... */ })
        await expect(f.doThing('x')).resolves.toBe(1)
    })
})
```

Required test cases per export:

- Constructor / argument validation (one `it()` per throw branch).
- Happy path (the most common usage example from `examples/public/node/SKILL.md`).
- Edge case per documented contract (empty input, max bound, missing optional, peer absent if relevant).
- For peer-dependent code (Fastify/Kysely/Redis), use `vi.mock` on the peer; do not require a live server.

## Workflow

1. **Read** `.claude/skills/node-feature/features.md` and check whether your feature is already covered or composable from existing primitives. If yes, **stop and reuse**. If no, continue.
2. **Read** `.claude/skills/node-feature/conventions.md` for current style + multi-class subsystem patterns.
3. **Read** `examples/public/node/SKILL.md` to confirm the section style you'll mirror when documenting.
4. **Decide isomorphic vs Node-only.** Touches `process`/`Buffer`/`fs`/Fastify/Kysely/Redis → Node-only, only in `main.ts`. Pure data shapes / pure functions → isomorphic, also in `main.iso.ts` via `node/src/utils/`.
5. **Decide peer-dep cost.** If the new file imports an optional peer, the import path must remain tree-shakable for consumers who don't install that peer.
6. **Create the source file** in the right folder (`node/src/<Name>.ts`, `node/src/utils/<Name>.ts`, `node/src/kv/<Name>.ts`, or a new subsystem). Apply Hard rules #1–#12.
7. **Create the test** (`node/test/...`). Cover happy path + edge cases + contract guarantees.
8. **Wire into `main.ts`** in the matching group.
9. **Wire into `main.iso.ts`** if isomorphic-safe.
10. **Append API section** to `examples/public/node/SKILL.md` in the matching group.
11. **Append inventory entry** to `.claude/skills/node-feature/features.md`.
12. **Verify** by running `npx vitest run node` from the repo root. Fix until green.
13. **Verify build** with `npm -w @toolcase/node run build` — tsup + tsc declarations must succeed.

## Anti-patterns

- Importing a third-party that is not in `peerDependencies`. Pick an existing peer or vendor it in.
- Creating a class that calls `client.eval` directly from `node/src/kv/`. Use `LuaScriptCache` so the script is cached and EVALSHA-fast.
- Adding a `BaseRepository` method that bypasses Kysely's transaction parameter. Every public method must accept an optional `trx?: Transaction<DB>` and pass it through.
- Adding an `RouteHandler` subclass that builds its own error envelope. Use `mapError` so the response shape stays uniform with `RESTError` / `RESTResponse` from `@toolcase/base`.
- Adding a domain error that does NOT extend `LibError`. The runtime check is `instanceof LibError`; siblings are invisible to it.
- Re-exporting a Node-only module from `main.iso.ts`. The whole point of `main.iso.ts` is "no `process`/`Buffer`/`fs`/peer-only code reachable here." Anything you put there will be importable from a browser bundle and must run.
- Duplicating CRUD methods in a service that should subclass `EntityService`. Override the `before*` / `after*` hooks instead.
- Mixing tabs into a 4-space file (or vice versa). Match the file you are editing. New files in `node/src/` use tabs.
- Code comments where a self-documenting name would do.
- Trailing semicolons (style mismatch with prettier config).
- Custom Error subclass for boring validation — use `ValidationError` from `node/src/errors.ts`.
