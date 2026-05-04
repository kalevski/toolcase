# `@toolcase/base` Code Conventions

Authoritative style + structure contract for files under `base/src/` and `base/test/`. Match what already exists — when in doubt, open `PriorityQueue.ts`, `ObjectPool.ts`, `Cache.ts`, or `State.ts` and copy the shape.

---

## Indent & whitespace

- 4-space indent. No tabs.
- **No trailing semicolons.** Match existing files (`PriorityQueue.ts`, `ObjectPool.ts`). The eslint config does not enforce this, but every file in `base/src/` is semicolon-free.
- One blank line between top-level statements (imports → class → export).
- One blank line inside class body between method declarations.
- No trailing whitespace. No blank lines at EOF except a single trailing newline.

---

## File layout

- One class or one function per file.
- Filename matches export: `PascalCase.ts` → class `PascalCase`; `camelCase.ts` → function `camelCase`.
- `export default <Name>` at the end. Named re-export at the bottom is allowed when downstream code does `import { X } from '@toolcase/base'`.

```ts
class MyFeature {
    // ...
}

export default MyFeature
```

For functions:

```ts
function myHelper(input: string): string {
    return input.trim()
}

export default myHelper
```

---

## Imports

- Relative imports use no extension (`'./Other'`, not `'./Other.ts'` or `'./Other.js'`).
- Type-only imports: `import type { X } from './Y'` when `X` is a type.
- Order: external → internal grouped by folder → blank line → default export at bottom.

---

## TypeScript style

- **Generics where reasonable.** `class Cache<T>`, `class PriorityQueue<T>`. Avoid `unknown` in public surface unless you genuinely don't know.
- **Avoid `any` in public types.** ESLint config allows `any`, but the existing classes don't use it in declared public surface — match that.
- **Public absence is `null`, not `undefined`.** Match `PriorityQueue.dequeue(): T | null`, `Cache.get(): T | null`.
- **Constructor option fallbacks.** When a constructor takes optional callbacks, type them `Fn<T> | null = null` and check `typeof === 'function'` (see `PriorityQueue` constructor).
- **Strict mode is on.** No implicit `any`, no implicit `this`. Match the surrounding files.

---

## Class shape

```ts
class MyFeature<T> {

    private values: T[] = []

    private opts: Options

    readonly length: number = 0

    constructor(opts: Options) {
        if (typeof opts.callback !== 'function') {
            throw new Error('callback is required')
        }
        this.opts = opts
    }

    get state(): readonly T[] {
        return this.values
    }

    push(value: T): boolean {
        if (typeof value === 'undefined') {
            throw new Error('value can not be undefined')
        }
        this.values.push(value)
        ;(this as any).length++
        return true
    }

    private privateHelper(): void {
        // ...
    }

}

export default MyFeature
```

Notes from existing code:

- Private fields use `private` modifier (no `#` prefix).
- `readonly` on instance fields whose increment is internal — write via `(this as any).field++` like `ObjectPool.instances`.
- Public methods first, private last.
- One concern per method.

---

## Errors

- Plain `Error` only. No custom error classes inside `base/src/` (`HTTP.RESTError` is the documented exception).
- Synchronous throw on construction-time invalid input.
- Method-level: throw on contract violations (`undefined` value to a method that requires a value), return `null` for "absent" (not "error").
- Error messages are short, lower-case, factual. Match `'priorityFn is required'`, `'value can not be undefined'`. No periods at the end.

---

## No comments

Existing files are essentially comment-free. Match that.

- No `//` line comments.
- No `/* */` block comments.
- No JSDoc unless a parameter's type is genuinely insufficient (e.g. units, valid ranges, side effects). When you do write JSDoc, keep it one line and on the immediately preceding line.
- No SCSS-style `//` (not applicable here, but listing for parity with `gc-component`).

If you feel the urge to comment, rename the variable or extract a method instead.

---

## Test layout

`base/test/<Name>.test.ts` — one file per export. Use vitest.

```ts
import { describe, it, expect } from 'vitest'
import MyFeature from '../src/MyFeature'

describe('MyFeature', () => {

    it('throws when constructor input invalid', () => {
        expect(() => new MyFeature(null as any)).toThrow('callback is required')
    })

    it('handles happy path', () => {
        const f = new MyFeature({ callback: () => 1 })
        expect(f.length).toBe(0)
    })

    it('handles edge case: empty input', () => {
        // ...
    })
})
```

Required test cases per export:

- Constructor / argument validation (one `it()` per throw branch).
- Happy path (the most common usage example from `examples/public/base/SKILL.md`).
- One edge case per documented contract (empty, max bound, missing optional).
- Public method coverage — every method exposed should have at least one `it()`.

For subsystem groups, organize as `base/test/<group>/<Name>.test.ts` (mirrors `base/src/<group>/<Name>.ts`).

---

## Multi-class subsystems

Three or more related files? Group under a subfolder. Established examples: `base/src/http/`, `base/src/packing/`.

```
base/src/<group>/
  index.ts          ← namespace re-export
  TypeA.ts
  TypeB.ts
  utility.ts
  types.ts          ← shared types (interfaces, unions)
```

`base/src/<group>/index.ts`:

```ts
import TypeA from './TypeA'
import TypeB from './TypeB'
import utility from './utility'

export { TypeA, TypeB, utility }

export type { Foo, Bar } from './types'

const Group = {
    TypeA,
    TypeB,
    utility
}

export default Group
```

`base/src/main.ts`:

```ts
import Group from './<group>'

export {
    // ...,
    Group
}

const BASE = {
    // ...,
    Group
}
```

Tests live under `base/test/<group>/`.

`examples/public/base/SKILL.md` gets a top-level `## Group` section + one sub-section per public class/function. Match `## HTTP` or `## Packing` shape.

---

## Browser vs. Node

- Default surface lives in `base/src/main.ts` and must work in both.
- Node-only utilities go in `base/src/node.ts`. They throw at module load (or first call) if `globalThis.process` is undefined — see existing `env.ts`.
- The `tsup.config.js` builds both entries.

---

## Build + verify

Run after every change:

```bash
npx vitest run base                 # all base tests must pass
npm -w @toolcase/base run build     # tsup must succeed
npx publint base                    # exports must validate
```

If any fails, fix before reporting done.

---

## Style anti-patterns (do not write these)

- `const` named exports at top of file followed by `export { foo }` block at bottom — match the `export default` pattern.
- Trailing semicolons on every line.
- Tabs.
- 2-space indent.
- Custom error subclasses for normal validation failures.
- `undefined` in public return types where `null` would do.
- JSDoc on every method (only when the type alone is insufficient).
- Inline comments explaining what self-named code does.
- Importing anything from `node:*` in files reachable from `main.ts`.
- Importing third-party packages anywhere under `base/src/`.
