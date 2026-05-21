---
name: base-feature
description: Add a new feature, helper, data structure, or utility to `@toolcase/base`. Triggers when the user asks to add/create/scaffold a new export inside `base/src/` (e.g. "add LRUCache to base", "implement Stack data structure", "new utility for X in @toolcase/base"). Wires up the `.ts` file, the test, the `main.ts` export, and updates the inventory + downstream skill doc.
---

# base-feature

Scaffold a new feature in `@toolcase/base`. Single-purpose helpers, data structures, utilities, validators, or any zero-dep building block consumed by the rest of the toolcase monorepo and downstream apps.

## REQUIRED reading before generating any code

**You MUST read three files in this order before writing anything:**

1. **`.claude/skills/base-feature/features.md`** (bundled with this skill) — inventory of every existing class/function in `@toolcase/base`. Use this to check if your feature already exists or can be composed from existing primitives. **Reuse before reinvent.**
2. **`.claude/skills/base-feature/conventions.md`** (bundled) — code style, file layout, test layout, multi-class subsystem layout, how exports flow into `main.ts`.
3. **`examples/public/base/SKILL.md`** — the user-facing API reference for `@toolcase/base` published at `toolcase.kalevski.dev/base/SKILL.md`. This is the **downstream contract**. Anything you add must be appended here too in the same shape (constructor → API → examples).

Open all three. Locate the section matching your feature category (data structure / event / utility / validation / HTTP / pathfinding / packing). The shapes you write into the new file, the test, and the docs must follow the patterns visible in those files.

## REUSE rule (load-bearing)

Before adding a new export, scan `features.md` for any existing primitive that already covers part of your task. Concrete checks:

- Need a typed event bus? Use `EventEmitter` or extend `Broadcast` — do not write a new emitter.
- Need observable state? Use `State` — do not write a new dotted-path emitter.
- Need async memoization? Use `Cache` — do not write a new TTL helper.
- Need pooling? Use `ObjectPool` — do not write a new free-list.
- Need a heap / priority queue? Use `PriorityQueue`.
- Need exponential-backoff retries? Use `retry`.
- Need ID generation? Use `generateId`.
- Need crypto-random hex / byte conversion? Use `bufferToHex` / `hexToBuffer` / `toHex`.
- Need a graph? Use `AdjacencyMatrix`.
- Need REST-shaped responses? Use `HTTP.RESTResponse` / `HTTP.RESTError`.
- Need rectangle packing? Use `Packing.Packer`.

If your new feature would duplicate >50% of an existing one, **stop and either extend the existing class or compose around it** instead of adding a new one. If you must add a new one because the existing primitive's contract doesn't fit, document the divergence in `features.md` for the new feature ("Skip when" bullet citing the existing primitive).

## When to use

Trigger on requests like:

- "add a [DataStructure | utility | helper] to base"
- "implement [Stack | Queue | LRUCache | …] in @toolcase/base"
- "I need a [feature] for the whole monorepo to share"
- any request mentioning `base/src/`, `@toolcase/base`, or zero-dep helpers/data structures

Do NOT use for:

- Edits to existing `base/src/` files (just edit them; the rules below still apply for export placement and inventory updates).
- Anything browser-specific that won't run in Node, or anything Node-specific that won't run in the browser. Node-only utilities live in the `@toolcase/node` workspace, not `@toolcase/base`.
- Logging (use `logging-feature` skill).
- Serialization (use `serializer-feature` skill).
- Game runtime (use `phaser-plus-feature` skill).
- React UI (use `react-component` skill).

## Hard rules

Derived from `base/package.json` (`sideEffects: false`, isomorphic, `engines.node >= 18`) and existing `base/src/` style. Non-negotiable.

1. **Zero runtime dependencies.** Nothing under `base/src/` may import from outside `@toolcase/base` itself. No `lodash`, no `rxjs`, no `protobufjs`, no `eventemitter3`. If you need a small utility, vendor it into `base/src/` and own it.
2. **Isomorphic, always.** Every file under `base/src/` must run in Node 18+ and modern browsers. Use only `globalThis.crypto`, standard ES2020+ APIs, `Map`, `Set`, `Uint8Array`. No `process`, no `Buffer`, no `fs`, no `window`, no `document`. Anything Node-only belongs in the `@toolcase/node` workspace, not here.
3. **One class / one function per file.** Filename matches the export. PascalCase classname → `PascalCase.ts`; lowerCamelCase function → `lowerCamel.ts`. The file's `export default` is the canonical export. Named re-export at the bottom is allowed.
4. **`main.ts` is the export gateway.** Every named runtime export from `base/src/main.ts` must also appear in the `BASE` default object. Type-only exports (`export type { … }`) go in their own block and are NOT mirrored into `BASE`. Subsystems (`http/`, `packing/`) expose a single namespace (`HTTP`, `Packing`) — both the namespace export and its `BASE` entry, no individual class re-exports.
5. **Subsystem groups go in subfolders with their own `index.ts`.** `http/` and `packing/` are the canonical examples. Three or more related files? Make a subfolder, give it `index.ts` with re-exports + a single namespace default object (e.g. `HTTP`, `Packing`), and import that namespace from `main.ts`.
6. **Tests are mandatory.** Every new export ships with `base/test/<Name>.test.ts` (or `base/test/<group>/<Name>.test.ts` for subsystems) using vitest. Tests must cover: happy path, error/edge cases (empty input, max bounds), and any contract guarantees the JSDoc claims.
7. **Strict TypeScript.** Generic types where it makes sense; precise return types; no `any` for public surface (the eslint config allows `any` but the existing classes avoid it in declarations — match that). Use `T | null` over `T | undefined` for "absent" in public APIs (matches `PriorityQueue.dequeue()`, `Cache.get()`, etc.).
8. **No code comments.** Self-documenting names only — existing files in `base/src/` are near-zero-comment. JSDoc only when a parameter's contract is non-obvious from its type (units, valid range, side effects).
9. **No semicolons.** Match the existing code style in `base/src/` (look at `PriorityQueue.ts`, `ObjectPool.ts`, `Cache.ts`).
10. **4-space indent.** No tabs.
11. **Constructor validation throws synchronously.** If a constructor receives invalid input (`null`/non-function/etc.), throw a plain `Error` immediately — match `PriorityQueue` (`throw new Error('priorityFn is required')`).
12. **Update the published `SKILL.md`.** When you add a feature, append a section to `examples/public/base/SKILL.md` matching the existing format: constructor signature → method list with types → minimal example. The published doc is the contract Claude Code installs as a skill — keep it current.
13. **Update `features.md`.** Append a section to `.claude/skills/base-feature/features.md` matching the existing entries (heading, one-line description, "Use when" / "Skip when" bullets, public API table). This file is what future runs of this skill will read first.
14. **Demo is mandatory.** Every new export ships with a runnable demo at `examples/src/base/<Name>Demo.tsx` registered in `examples/src/base/index.tsx` under the matching category. No demo = feature not done. The demo must exercise the public API in the demo site so users can see and copy it.

## Files to create / modify per feature

For a new export named `<Name>`:

1. **`base/src/<Name>.ts`** (or `base/src/<group>/<Name>.ts` if part of a subsystem) — the implementation. `export default <Name>`.
2. **`base/test/<Name>.test.ts`** (or `base/test/<group>/<Name>.test.ts`) — vitest. Match the shape of `base/test/PriorityQueue.test.ts`.
3. **`base/src/main.ts`** — append `import <Name> from './<Name>'`, then add to the `export { … }` block and the `BASE` default object. Keep both lists alphabetical-ish, matching the existing groupings.
   - For subsystems: import the namespace (`Packing`) from `./<group>` and add it once.
   - For new subsystem: create `base/src/<group>/index.ts` exporting both individual classes (named) and a default namespace object, then expose only the namespace from `main.ts`.
4. **`examples/public/base/SKILL.md`** — append the API section. Same shape as existing entries (`Cache`, `PriorityQueue`, `State`, `JSONSchema`, etc.). For namespace subsystems: top-level section + one sub-section per class.
5. **`.claude/skills/base-feature/features.md`** — append an inventory entry following the existing pattern (heading `### \`<Name>\` — <short tagline>`, one-line description, "Use when" / "Skip when" bullets, public API table, "Reuses" line if it composes with another base export).
6. **`examples/src/base/<Name>Demo.tsx`** — runnable demo. Mirror existing demos (`RetryDemo.tsx`, `CacheDemo.tsx`, etc.) — use `DemoSection` from `./_demo/ConsoleDemo` and `captureConsoleAsync` / sync equivalents to surface output. Cover the happy path + at least one edge case the user should see.
7. **`examples/src/base/index.tsx`** — register the demo: `import <Name>Demo from './<Name>Demo'` then append `{ key: '<kebab>', label: '<Name>', category: '<MatchingCategory>', element: <<Name>Demo /> }` to `baseExamples`. Pick the closest existing `BaseCategory` or extend it.
8. **(Conditional)** If your feature is large enough to warrant a published TypeDoc-style breakdown beyond `examples/public/base/SKILL.md`, also add it to `base/README.md`.

## Component template

Single-class feature (`base/src/MyFeature.ts`):

```ts
class MyFeature<T> {

    private state: T

    constructor(initial: T) {
        if (initial === undefined) {
            throw new Error('initial is required')
        }
        this.state = initial
    }

    get(): T {
        return this.state
    }

    set(next: T): this {
        this.state = next
        return this
    }

}

export default MyFeature
```

Single-function feature (`base/src/myHelper.ts`):

```ts
function myHelper(input: string): string {
    return input.trim()
}

export default myHelper
```

Subsystem entry (`base/src/mySystem/index.ts`):

```ts
import MyA from './MyA'
import MyB from './MyB'

export { MyA, MyB }

export type { MyAOptions } from './types'

const MySystem = {
    MyA,
    MyB
}

export default MySystem
```

## Test template (`base/test/<Name>.test.ts`)

```ts
import { describe, it, expect } from 'vitest'
import MyFeature from '../src/MyFeature'

describe('MyFeature', () => {
    it('throws if initial is undefined', () => {
        expect(() => new MyFeature(undefined as any)).toThrow('initial is required')
    })

    it('returns and sets state', () => {
        const f = new MyFeature(0)
        expect(f.get()).toBe(0)
        f.set(5)
        expect(f.get()).toBe(5)
    })
})
```

## Workflow

1. **Read** `.claude/skills/base-feature/features.md` and check whether your feature is already covered or composable from existing primitives. If yes, **stop and reuse**. If no, continue.
2. **Read** `.claude/skills/base-feature/conventions.md` for current style + multi-class subsystem patterns.
3. **Read** `examples/public/base/SKILL.md` to confirm the section style you'll mirror when documenting.
4. **Create the source file** (`base/src/<Name>.ts` or `base/src/<group>/<Name>.ts`). Apply Hard rules #1-#11.
5. **Create the test** (`base/test/...`). Cover happy path + edge cases + contract guarantees.
6. **Wire into `main.ts`** — both named export and `BASE` object. For subsystems, wire via the namespace.
7. **Append API section** to `examples/public/base/SKILL.md` in the matching category.
8. **Append inventory entry** to `.claude/skills/base-feature/features.md`.
9. **Create demo** at `examples/src/base/<Name>Demo.tsx` mirroring an existing demo (`RetryDemo.tsx`, `CacheDemo.tsx`). Register it in `examples/src/base/index.tsx` under the matching `BaseCategory`. Required — feature is not done without it.
10. **Verify** by running `npx vitest run base` from the repo root. Fix until green.
11. **Verify build** with `npm -w @toolcase/base run build` — tsup must succeed and emit `.d.ts`.
12. **Verify exports** with `npx publint base` (or `npm run lint:exports` from root).
13. **Verify demo** with `npm -w @toolcase/examples run dev` and load the demo route.

## Anti-patterns

- Importing anything outside `@toolcase/base` from `base/src/`. Zero deps means zero deps.
- Touching `process`, `Buffer`, `fs`, `window`, `document` anywhere under `base/src/`. Those belong in `@toolcase/node`.
- Adding a feature that duplicates >50% of an existing export instead of extending it.
- Forgetting to mirror named exports into the `BASE` default object in `main.ts`.
- Adding a feature without a test file.
- Adding a feature without a runnable demo in `examples/src/base/` registered in `examples/src/base/index.tsx`.
- Adding a feature without updating `examples/public/base/SKILL.md` and `.claude/skills/base-feature/features.md`.
- Code comments (`//`, `/* */`, `/** */`) where a self-documenting name would do.
- Trailing semicolons (style mismatch with existing files).
- Throwing a custom Error subclass when `Error` is enough (existing code uses plain `Error`).
- Returning `undefined` from public methods that mean "absent" — return `null` to match existing patterns.
- Bundling Node-only code into `@toolcase/base`. It goes in `@toolcase/node`.
