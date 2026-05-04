---
name: logging-feature
description: Add a new feature, reporter, level helper, or extension to `@toolcase/logging`. Triggers when the user asks to add/create/scaffold a new export inside `logging/src/` (e.g. "add a FileLogReporter", "ship a JSON-line reporter", "add structured logging context to @toolcase/logging"). Wires up the `.ts` file and updates the inventory + downstream SKILL.md.
---

# logging-feature

Scaffold a new feature in `@toolcase/logging`. Typical additions: new `LogReporter` subclasses (file, remote, ring buffer, OTel), new `LoggerFactory` extensions, new level helpers, structured-logging primitives.

## REQUIRED reading before generating any code

**You MUST read three files in this order before writing anything:**

1. **`.claude/skills/logging-feature/features.md`** (bundled with this skill) — inventory of every existing class/function in `@toolcase/logging`. Use this to confirm your feature isn't already covered or composable from existing primitives. **Reuse before reinvent.**
2. **`.claude/skills/logging-feature/conventions.md`** (bundled) — code style, file layout, reporter contract, factory wiring patterns.
3. **`examples/public/logging/SKILL.md`** — the user-facing API reference for `@toolcase/logging` published at `toolcase.kalevski.dev/logging/SKILL.md`. The downstream contract — anything you add must be appended here too in the same shape.

Do not paraphrase. Open all three. Match the exact section style when adding a new entry.

## REUSE rule (load-bearing)

Before adding a new export, scan `features.md`. Concrete checks:

- Need a transport? Subclass **existing** `LogReporter` — don't introduce a new base class.
- Need to dispatch to multiple sinks? Pass multiple reporters to **existing** `LoggerFactory` — don't write a fan-out wrapper.
- Need scoped loggers? Use **existing** `factory.getLogger(scope)` — scopes are deduped.
- Need a different threshold for one subsystem? Spawn a **new `LoggerFactory` instance** — don't subclass `LoggerFactory`.
- Need to format messages? Override `LogReporter.log()` in your reporter — don't add formatting helpers to `Logger`.
- Need to filter? Wrap an inner `LogReporter` (decorator pattern) — don't add filter args to the factory.

If your feature would duplicate >50% of an existing class, **stop and either subclass it or compose around it** instead of adding a new sibling.

## When to use

Trigger on requests like:

- "add a [File | Remote | Ring buffer | OTLP | Sentry] LogReporter"
- "add structured-logging support to @toolcase/logging"
- "implement [feature] for the logger"
- any request mentioning `logging/src/`, `@toolcase/logging`, or `LogReporter` / `LoggerFactory` extensions

Do NOT use for:

- Edits to existing files (just edit them — rules below still apply for export placement and inventory updates).
- Generic helpers that don't relate to logging (use `base-feature`).
- Anything that introduces a runtime dependency.

## Hard rules

These come from `logging/package.json` (zero deps, isomorphic, `engines.node >= 18`) and the conventions every existing file in `logging/src/` follows.

1. **Zero runtime dependencies.** No `winston`, no `pino`, no `bunyan`. The package's selling point is "tiny isomorphic". Vendor anything you need.
2. **Isomorphic by default.** Every file under `logging/src/` must run in Node 18+ and modern browsers. No `process`, no `Buffer`, no `fs`, no `window`, no `document`. If your reporter is Node-only (file appender), guard at runtime with `typeof process !== 'undefined'` and document the Node-only constraint in features.md + the published SKILL.md.
3. **One class per file.** PascalCase classname → `PascalCase.ts`. Filename matches export.
4. **Default export is the canonical export.** Named re-export at the bottom is fine.
5. **`main.ts` is the export gateway.** Add the named export. The default singleton (`logging`) only needs updating when the new feature is the *default reporter set* — most additions are just new exports for callers to wire up themselves.
6. **`LogReporter` subclasses must override `log(level, scope, time, messages)` exactly.** Same signature, no return value, never throw to the caller (wrap I/O so logging calls stay cheap).
7. **No async base class.** Reporters dispatch synchronously. If you need async I/O (HTTP, file), buffer internally + flush on a timer. Document the buffering behavior.
8. **Tests are mandatory.** Add `logging/test/<Name>.test.ts` (vitest). Cover: log dispatch, level filtering, scope routing, throw handling, async batching if applicable.
9. **Strict TypeScript.** No `any` in public surface. Match the precise types of `Logger`, `LoggerFactory`, `LogReporter` in the existing files.
10. **No code comments.** Match existing files (essentially comment-free).
11. **No semicolons.** Match style of `Logger.ts`, `LoggerFactory.ts`.
12. **4-space indent.** No tabs.
13. **Reporter never throws to call site.** Wrap I/O in try/catch. The factory's `onLog` calls reporters synchronously and a throw bubbles to whoever called `logger.<level>()`. Reporters absorb their own errors silently or via a fallback reporter.
14. **Update `examples/public/logging/SKILL.md`.** Append a section in the matching category (Levels / Logger / LoggerFactory / LogReporter / Patterns / Cross-library integration). Use the existing entries as templates.
15. **Update `features.md`.** Append an inventory entry following the existing pattern.
16. **Demo is mandatory.** Every new export ships with a runnable demo at `examples/src/logging/<Name>Demo.tsx` registered in `examples/src/logging/index.tsx`. No demo = feature not done.

## Files to create / modify per feature

For a new export named `<Name>`:

1. **`logging/src/<Name>.ts`** — implementation. `export default <Name>`.
2. **`logging/test/<Name>.test.ts`** — vitest. Match the shape of any existing test in `logging/test/` (or add the first one if none exists).
3. **`logging/src/main.ts`** — append `import <Name> from './<Name>'` and add to the `export { … }` block. Keep grouping with related exports (Reporter classes near `LogReporter`, factory variants near `LoggerFactory`).
4. **`examples/public/logging/SKILL.md`** — append the API section.
5. **`.claude/skills/logging-feature/features.md`** — append the inventory entry.
6. **`examples/src/logging/<Name>Demo.tsx`** — runnable demo. Mirror existing demos (`BasicLoggingDemo.tsx`, `CustomReporterDemo.tsx`). Show level dispatch, scope routing, and any reporter-specific behavior the user should observe.
7. **`examples/src/logging/index.tsx`** — register the demo: `import <Name>Demo from './<Name>Demo'` then append `{ key: '<kebab>', label: '<Human label>', element: <<Name>Demo /> }` to `loggingExamples`.

## Reporter template

```ts
import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

class MyReporter extends LogReporter {

    constructor(private opts: MyOptions) {
        super()
    }

    log(level: LoggerLevel, scope: string, time: string, messages: any[]): void {
        try {
            // synchronous dispatch — for I/O, buffer + flush on timer instead
        } catch {
            // never propagate
        }
    }

}

export default MyReporter
```

For an async/buffered reporter (file, HTTP):

```ts
class BufferedReporter extends LogReporter {

    private queue: Array<{ level: LoggerLevel, scope: string, time: string, messages: any[] }> = []

    private flushTimer: ReturnType<typeof setTimeout> | null = null

    private capacity: number

    private flushMs: number

    constructor(opts: { capacity?: number, flushMs?: number }) {
        super()
        this.capacity = opts.capacity ?? 100
        this.flushMs = opts.flushMs ?? 500
    }

    log(level: LoggerLevel, scope: string, time: string, messages: any[]): void {
        this.queue.push({ level, scope, time, messages })
        if (this.queue.length >= this.capacity) {
            this.flush()
        } else if (this.flushTimer === null) {
            this.flushTimer = setTimeout(() => this.flush(), this.flushMs)
        }
    }

    private flush(): void {
        const batch = this.queue
        this.queue = []
        if (this.flushTimer !== null) {
            clearTimeout(this.flushTimer)
            this.flushTimer = null
        }
        this.dispatch(batch).catch(() => {})
    }

    private async dispatch(batch: typeof this.queue): Promise<void> {
        // your I/O here
    }

}

export default BufferedReporter
```

## Test template

```ts
import { describe, it, expect } from 'vitest'
import LoggerFactory from '../src/LoggerFactory'
import MyReporter from '../src/MyReporter'

describe('MyReporter', () => {

    it('dispatches log entries', () => {
        const calls: any[] = []
        const reporter = new MyReporter({ onCapture: (e: any) => calls.push(e) })
        const factory = new LoggerFactory([reporter])
        factory.level = 'debug'
        factory.getLogger('test').info('hello', { a: 1 })
        expect(calls.length).toBe(1)
        expect(calls[0].level).toBe('info')
        expect(calls[0].scope).toBe('test')
    })

    it('respects factory level filtering', () => {
        const calls: any[] = []
        const reporter = new MyReporter({ onCapture: (e: any) => calls.push(e) })
        const factory = new LoggerFactory([reporter])
        factory.level = 'warning'
        factory.getLogger('test').debug('skipped')
        expect(calls.length).toBe(0)
    })

    it('does not throw when inner I/O fails', () => {
        const reporter = new MyReporter({ onCapture: () => { throw new Error('boom') } })
        const factory = new LoggerFactory([reporter])
        factory.level = 'info'
        expect(() => factory.getLogger('t').info('x')).not.toThrow()
    })
})
```

## Workflow

1. **Read** `.claude/skills/logging-feature/features.md`, `conventions.md`, and `examples/public/logging/SKILL.md`.
2. **Decide** whether the request is a new reporter, a factory extension, a level helper, or a structured-logging primitive. Confirm via REUSE checks above.
3. **Create** `logging/src/<Name>.ts` from the appropriate template.
4. **Create** `logging/test/<Name>.test.ts` with the required test cases.
5. **Wire into `main.ts`.**
6. **Append API section** to `examples/public/logging/SKILL.md`.
7. **Append inventory entry** to `.claude/skills/logging-feature/features.md`.
8. **Create demo** at `examples/src/logging/<Name>Demo.tsx` and register it in `examples/src/logging/index.tsx`. Required.
9. **Verify** with `npx vitest run logging` and `npm -w @toolcase/logging run build`.
10. **Verify demo** with `npm -w @toolcase/examples run dev`.

## Anti-patterns

- Importing third-party packages anywhere under `logging/src/`.
- Returning a Promise from `LogReporter.log()` — the contract is synchronous.
- Letting reporter I/O errors bubble to `logger.<level>()` callers.
- Adding a new base class instead of subclassing `LogReporter`.
- Adding a `addReporter()` method to `LoggerFactory` (the factory takes reporters in the constructor by design — match that).
- Using `console.*` directly inside a reporter unless it is the explicit `ConsoleLogReporter`.
- Creating a parallel singleton (the package exports one default singleton via `logging/src/main.ts`; new factories are user-instantiated).
- Code comments where a self-named identifier would do.
- Trailing semicolons.
- Skipping tests, the demo, the published SKILL.md update, or the inventory update.
