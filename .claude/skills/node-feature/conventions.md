# `@toolcase/node` Code Conventions

Authoritative style + structure contract for files under `node/src/` and `node/test/`. Match what already exists — when in doubt, open `errors.ts`, `RouteHandler.ts`, `HttpServer.ts`, `BaseRepository.ts`, `kv/KVService.ts`, or `utils/sanitize/index.ts` and copy the shape.

---

## Indent & whitespace

- **`node/src/`: tabs.** Existing files (`errors.ts`, `RouteHandler.ts`, `HttpServer.ts`, `BaseRepository.ts`, `EntityService.ts`, `kv/*`, `utils/*`) all use tab-indent. The lone outlier is `node/src/env.ts` (4 spaces) — do not propagate that style.
- **`node/test/`: 4 spaces.** Matches `test/env.test.ts` and the rest of the monorepo's vitest layout.
- **No trailing semicolons.** Project-wide via `.prettierrc` (`"semi": false`). Match the existing files.
- One blank line between top-level statements (imports → types → class → export).
- One blank line inside class body between method declarations.
- No trailing whitespace. No blank lines at EOF except a single trailing newline.

---

## File layout

- One primary export per file. Filename matches the export.
- `PascalCase.ts` → `class PascalCase` / `interface PascalCase`. `camelCase.ts` → `function camelCase`.
- Default export OR named export — match the surrounding module:
  - `node/src/errors.ts` uses **named exports only** (`export class …`). Stay there for new error classes.
  - `node/src/RouteHandler.ts`, `HttpServer.ts`, `BaseRepository.ts`, `kv/KVService.ts` all use **named exports** for their primary class.
  - `node/src/env.ts` uses `export default env`. Mirror this for new top-level free functions only when there is no other companion type to export from the same file.
- Subsystem `index.ts` files use `export * from './<Name>'` lines (see `node/src/kv/index.ts`, `node/src/utils/index.ts`, `node/src/utils/sanitize/index.ts`).

---

## Imports

- Relative imports use no extension (`'./Other'`, not `'./Other.ts'` or `'./Other.js'`).
- Type-only imports: `import type { X } from './Y'` when `X` is a type.
- Order: external (peer libs) → `@toolcase/*` → internal grouped by folder → blank line → file body.
- Peer-lib imports are gated by `node/package.json`'s `peerDependencies`. Allowed: `@toolcase/base`, `@toolcase/serializer`, `fastify`, `@fastify/cors`, `kysely`, `redis`. Anything else: vendor it in or push back.

---

## TypeScript style

- **Generics where reasonable.** `class BaseRepository<DB, TB, PK, ID>`, `class RouteHandler<T extends object>`. Avoid `unknown` in public surface unless you genuinely don't know.
- **`any` in public types is rare.** ESLint config allows `any` (`@typescript-eslint/no-explicit-any: off`), but the existing public surface avoids it — match that. The few escape-hatch casts in this package live inside method bodies (e.g. `as Whereable<Q>`), not in declared signatures.
- **Public absence is `null`, not `undefined`.** Match `statusCodeFromError(): number | null`, `Locker.tryWithLock(): Promise<T | null>`, `Versioned.versionedGet(): Promise<…| null>`.
- **Prefer `readonly` for fields the consumer should not mutate.** See `errors.ts`: `readonly resource`, `readonly key`, `readonly statusCode`. See `KVService`: `readonly client`, `readonly keys`, etc.
- **Interface over type for public option bags.** Match `RouteHandlerOptions`, `HttpServerOptions`, `KVServiceOptions`, `BaseRepositoryOptions`. Reach for `type` only for unions and mapped/conditional types (e.g. `WhereClause<T>`, `OrderBy<T>`).
- **Strict mode is on at the build root**, but `node/tsconfig.build.json` runs declarations with `"strict": false, "noImplicitAny": false` so `.d.ts` emit doesn't fail on edge ambiguities — write your code as if strict were on; just don't be surprised that the build looks lenient.

---

## Class shape

```ts
export class MyService {

	readonly something: string

	private readonly opts: MyServiceOptions

	constructor(options: MyServiceOptions) {
		if (typeof options.client === 'undefined') {
			throw new MyServiceError('client is required')
		}
		this.opts = options
		this.something = options.namespace ?? ''
	}

	async doThing(key: string): Promise<number> {
		return await this.opts.client.incr(key)
	}

	private k(key: string): string {
		return `${this.something}:${key}`
	}
}
```

Notes from existing code:

- Private fields use `private readonly` modifiers (no `#` prefix). Match `KVService`, `Locker`, `RateLimiter`.
- `readonly` on every field whose value never changes after construction.
- Constructor parameter properties (`constructor(private readonly x)`) are used in `EntityService`, `Router`, `Locker`, `BaseRepository`. Use them when the parameter is the field — saves a `this.x = x` line.
- Public methods first, private last.
- One concern per method.

---

## Errors

All error classes live in **`node/src/errors.ts`** (single file). Do not split. The runtime tree:

```
LibError
├── RepositoryError
│   ├── NotFoundError
│   ├── ConflictError
│   └── OptimisticLockError
├── KVServiceError
│   ├── LockNotAcquiredError
│   └── RateLimitedError
└── EndpointError
    └── ValidationError
```

When adding a new error:

- Pick the right parent. Adding a new sibling to `LibError` is reserved for whole-new-subsystem additions.
- Set readonly fields for any data callers might handle (resource id, key, retry-after, expected version, …).
- If the error maps to an HTTP status, extend `statusCodeFromError` accordingly. The existing mapping:
  - `EndpointError` → `error.statusCode` (subclass-defined)
  - `NotFoundError` → 404
  - `ConflictError` / `OptimisticLockError` → 409
  - `RateLimitedError` → 429
  - `LockNotAcquiredError` → 423
- Throw plain `Error` (no `LibError` subclass) ONLY for impossible / programmer-bug states (e.g. unreachable defaults). Any error a caller might catch must be a `LibError` subclass.
- Error messages are short, factual, lowercase-ish. Match `'Lock not acquired: ${key}'`, `'Rate limit exceeded for ${key}, retry in ${resetInSeconds}s'`. No periods at the end.

---

## No comments

Existing files have only JSDoc on public surface where the type alone is insufficient (see `RouteHandler.mapError`, `KVService.scoped`, `HttpServer` class JSDoc).

- No `//` line comments in code.
- No `/* */` block comments.
- JSDoc is encouraged on public-facing classes when the contract has subtleties (`HttpServer`'s `/health` semantics, `RouteHandler.mapError`'s envelope shape, `EntityService.insertMany`'s parallelism note). One line is fine; multi-line is fine when the contract really has multiple subclauses.
- Inline `// ...` comments inside method bodies should be eliminated by extracting a method or renaming a variable.

If you feel the urge to comment, rename the variable or extract a method instead.

---

## Test layout

`node/test/<Name>.test.ts` — one file per export. Use vitest. **4-space indent in tests** (matches `test/env.test.ts`).

```ts
import { describe, it, expect, vi } from 'vitest'
import MyFeature from '../src/MyFeature'

describe('MyFeature', () => {

    it('throws when constructor input invalid', () => {
        expect(() => new MyFeature(null as any)).toThrow()
    })

    it('happy path', async () => {
        const f = new MyFeature({ /* ... */ })
        await expect(f.doThing('x')).resolves.toBe(1)
    })

    it('edge case: empty key', async () => {
        const f = new MyFeature({ /* ... */ })
        await expect(f.doThing('')).rejects.toThrow()
    })
})
```

Required test cases per export:

- Constructor / argument validation (one `it()` per throw branch).
- Happy path (the most common usage example from `examples/public/node/SKILL.md`).
- One edge case per documented contract (empty input, max bound, missing optional, peer absent if relevant).
- Public method coverage — every method exposed should have at least one `it()`.

For peer-dependent code:

- Mock `kysely`, `redis`, `fastify`, `@fastify/cors` with `vi.mock(...)` rather than spinning real servers.
- For Redis: build a fake `RedisClient` shape (object with the `set`, `get`, `eval`, `evalSha`, `incr`, etc. methods you actually call). Vitest's `vi.fn()` is enough — there is no real-Redis test suite expected.
- For Kysely: build a chainable mock that returns `{ executeTakeFirst, execute }` from each method you exercise. Or build a thin in-memory adapter. Either is acceptable; match what other tests in this package do once they exist.
- For Fastify: pass a stub `FastifyInstance` shape to `register(fastify)` and assert the routes / handlers were attached.

For subsystem groups, organize as `node/test/<group>/<Name>.test.ts` (mirrors `node/src/<group>/<Name>.ts`).

---

## Multi-class subsystems

Three or more related files? Group under a subfolder. Established examples: `node/src/utils/`, `node/src/kv/`, `node/src/utils/sanitize/`.

```
node/src/<group>/
  index.ts          ← `export * from './<Each>'` (re-export)
  TypeA.ts
  TypeB.ts
  utility.ts
  types.ts          ← shared types (interfaces, unions)
```

`node/src/<group>/index.ts`:

```ts
export * from './types'
export * from './TypeA'
export * from './TypeB'
export * from './utility'
```

`node/src/main.ts`:

```ts
export * from './<group>/index'
```

If isomorphic-safe, also add to `node/src/main.iso.ts`. Do NOT add Node-bound subsystems (`kv/`, anything Fastify, anything Kysely) to `main.iso.ts`.

Tests live under `node/test/<group>/`.

`examples/public/node/SKILL.md` gets a top-level `## <Group>` section with sub-sections per public class/function — match the existing `## KVService`, `## Repository`, `## RouteHandler / HttpServer`, `## Utils`, `## Errors` shapes.

---

## Isomorphic vs Node-only

- **`main.ts`** — every export. Re-exports from every file under `node/src/`.
- **`main.iso.ts`** — ONLY exports from files that have no `process`, `Buffer`, `node:*`, `fastify`, `kysely`, `redis`, `@fastify/cors`, `@toolcase/serializer` import.
- Current isomorphic surface: `errors`, `utils/logger`, `utils/where`, `utils/orderBy`, `utils/pagination`, `utils/sanitize`. Note `utils/where.ts` does reference `Buffer` in a type guard; the project ships it through `main.iso.ts` anyway because the reference is `typeof Buffer !== 'undefined'`-guarded. Match that pattern only when you need the same guard.
- If your file is part-isomorphic / part-Node, **split it**. Pure types and pure functions to one `*.iso.ts`-eligible file; Node-bound runtime behavior to a separate one.

---

## Build + verify

Run after every change:

```bash
npx vitest run node                       # all node tests must pass
npm -w @toolcase/node run build           # tsup + tsc declarations must succeed
npx publint node                          # exports must validate (or `npm run lint:exports` from root)
```

Note that `node/package.json` build is `tsup && tsc -p tsconfig.build.json || true` — the `|| true` swallows tsc declaration failures intentionally (because of the lenient `noImplicitAny: false`). Don't rely on that; if `tsc` warns on your file, fix the warning.

If any check fails, fix before reporting done.

---

## Style anti-patterns (do not write these)

- Mixing tabs and spaces in the same file.
- Trailing semicolons on every line.
- 2-space indent.
- Custom error subclasses that don't extend `LibError` (or one of its descendants).
- `undefined` in public return types where `null` would do.
- `// comments` explaining what self-named code does.
- Importing a third-party package not in `peerDependencies`.
- Calling `client.eval` directly inside `kv/*` instead of going through `LuaScriptCache`.
- Adding a method to `BaseRepository` that ignores `Transaction<DB>`.
- Re-exporting Node-bound code from `main.iso.ts`.
- Adding a Fastify route surface that bypasses `HttpServer.add()`.
- Hardcoding `process.env` inside business logic — go through `env(...)` so the override / type-coerce contract stays uniform.
