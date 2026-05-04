# `@toolcase/logging` Code Conventions

Authoritative style + structure contract for files under `logging/src/` and `logging/test/`. Match what already exists — open `Logger.ts`, `LoggerFactory.ts`, `LogReporter.ts`, `ConsoleLogReporter.ts` and copy the shape.

---

## Indent & whitespace

- 4-space indent. No tabs.
- **No trailing semicolons.** Match existing files.
- One blank line between top-level statements (imports → class → export).
- One blank line inside class body between method declarations.

---

## File layout

- One class per file. Filename matches export.
- `export default <Name>` at the end. Named re-export at the bottom is fine.
- Types live at the top of the file (or in a sibling type file when shared).

```ts
import { LoggerLevel } from './Level'

class MyReporter extends LogReporter {
    log(level: LoggerLevel, scope: string, time: string, messages: any[]): void {
        // ...
    }
}

export default MyReporter
```

---

## Imports

- Relative imports use no extension.
- Type-only imports: `import type { LoggerLevel } from './Level'` when the symbol is a type.
- Order: external → internal → blank line → class declaration.

---

## TypeScript style

- Match the precise types of `Logger`, `LoggerFactory`, `LogReporter`. Do not loosen them.
- Public absence is `null` (matches `Cache.get()` style across the monorepo).
- `LogReporter.log(level, scope, time, messages)` signature is fixed — never override its types.
- `LoggerLevel` union: `'silent' | 'error' | 'warning' | 'info' | 'debug' | 'verbose'`. Use it as the level parameter type everywhere.

---

## Reporter contract

Every `LogReporter` subclass must:

1. Override `log()` with the exact same signature.
2. Return synchronously. Buffering for async I/O is internal.
3. Never throw to the caller. Wrap I/O in try/catch.
4. Never mutate the `messages` array.
5. Never call other reporters or the factory directly. Reporters are leaves.

Buffered/async reporter checklist:

- Internal queue + capacity cap.
- Flush triggered by capacity reached OR timer (one or the other; pick the larger of the two).
- Flush is fire-and-forget. Errors swallowed (or fall back to console as last resort).
- Provide a public `flush()` method for graceful shutdown.

---

## Class shape

```ts
class MyReporter extends LogReporter {

    private opts: MyOptions

    private state: SomeState

    constructor(opts: MyOptions = {}) {
        super()
        this.opts = opts
    }

    log(level: LoggerLevel, scope: string, time: string, messages: any[]): void {
        try {
            this.dispatch(level, scope, time, messages)
        } catch {
            // never propagate
        }
    }

    private dispatch(level: LoggerLevel, scope: string, time: string, messages: any[]): void {
        // implementation
    }

}

export default MyReporter
```

---

## Errors

- Plain `Error` only.
- Never throw from `log()` — caller is `factory.onLog`, which is invoked synchronously by `logger.<level>()`. A throw bubbles to the calling code path. Reporters absorb their own errors.
- Constructor throws are fine for invalid options (match `LoggerFactory` style).
- Error messages: short, lower-case, factual, no period.

---

## No comments

Match existing files. No `//`, no `/* */`, no JSDoc unless type alone is insufficient (units, valid range, side effects).

---

## Tests

`logging/test/<Name>.test.ts` — one file per export. vitest.

Required cases per reporter:

- Dispatches log entries (capture via spy or in-memory hook).
- Respects factory level filtering.
- Survives inner-I/O errors without throwing to caller.
- Buffered reporters: flushes when capacity reached, when timer fires, when `flush()` called.

```ts
import { describe, it, expect } from 'vitest'
import LoggerFactory from '../src/LoggerFactory'
import MyReporter from '../src/MyReporter'

describe('MyReporter', () => {
    it('dispatches to inner sink', () => {
        const captured: any[] = []
        const reporter = new MyReporter({ onCapture: (e: any) => captured.push(e) })
        const factory = new LoggerFactory([reporter])
        factory.level = 'info'
        factory.getLogger('t').info('hi')
        expect(captured).toHaveLength(1)
    })
})
```

---

## Build + verify

```bash
npx vitest run logging                  # all logging tests pass
npm -w @toolcase/logging run build      # tsup must succeed
npx publint logging                     # exports must validate
```

---

## Style anti-patterns

- Throwing from `log()`.
- Returning a `Promise` from `log()`.
- Calling `console.*` from a non-`ConsoleLogReporter` reporter without an explicit fallback purpose.
- Adding a new base class instead of subclassing `LogReporter`.
- Importing third-party packages.
- Trailing semicolons.
- 2-space indent.
- Code comments where a self-named identifier would do.
- Async `LogReporter` constructors.
- Tightly coupling reporters to a specific factory instance.
