---
name: logging-feature
description: Add a new feature, reporter, level helper, or extension to `@toolcase/logging`. Triggers when the user asks to add/create/scaffold a new export inside `logging/src/` (e.g. "add a RingBufferReporter", "add an OTLP reporter", "add a scope-filter decorator", "add structured-logging context to @toolcase/logging"). Wires up the `.ts` file and updates the inventory + downstream SKILL.md.
---

# logging-feature

Scaffold a new feature in `@toolcase/logging`. Typical additions: new `LogReporter` subclasses (remote, ring buffer, OTLP, Sentry), `LoggerFactory` extensions, level helpers, structured-logging primitives.

Already shipped (verify before reinventing): `Logger`, `LoggerFactory`, `Level`, `LogReporter`, `ConsoleLogReporter`, `JSONLineReporter`, `BufferedReporter`, and (Node-only, via `@toolcase/logging/node`) `FileLogReporter`.

## REQUIRED reading before generating any code

**You MUST read three files in this order before writing anything:**

1. **`.claude/skills/logging-feature/features.md`** — inventory of every existing class/function in `@toolcase/logging`. Use this to confirm your feature isn't already covered or composable from existing primitives. **Reuse before reinvent.**
2. **`.claude/skills/logging-feature/conventions.md`** — code style, file layout, reporter contract, factory wiring patterns.
3. **`examples/public/logging/SKILL.md`** — user-facing API reference published at `toolcase.kalevski.dev/logging/SKILL.md`. Downstream contract — anything you add must be appended here too in the same shape.

Do not paraphrase. Open all three. Match the exact section style when adding a new entry.

## REUSE rule (load-bearing)

Before adding a new export, scan `features.md`. Concrete checks:

- Need a transport? Subclass **existing** `LogReporter` — don't introduce a new base class.
- Need batched / async dispatch? Wrap your synchronous reporter in **existing** `BufferedReporter(inner, { maxSize, flushInterval })`. Don't reimplement a buffer/timer pair.
- Need JSON wire format? Compose **existing** `JSONLineReporter({ write })` with your transport's write callback.
- Need a file sink? Use **existing** `FileLogReporter` from `@toolcase/logging/node` (Node-only, `import FileLogReporter from '@toolcase/logging/node'`).
- Need to dispatch to multiple sinks? Pass multiple reporters to **existing** `LoggerFactory` — don't write a fan-out wrapper.
- Need scoped loggers? Use **existing** `factory.getLogger(scope)` — scopes are deduped.
- Need a different threshold for one subsystem? Spawn a **new `LoggerFactory` instance** — don't subclass `LoggerFactory`.
- Need a per-logger override? Use **existing** `logger.setLevel(level)` — don't add another threshold layer.
- Need per-call context fields? Use **existing** `logger.withContext({...})` — don't add a context arg to `log()`.
- Need to filter? Wrap an inner `LogReporter` (decorator pattern) — don't add filter args to the factory.

If your feature would duplicate >50% of an existing class, **stop and either subclass it or compose around it** instead of adding a new sibling.

## When to use

Trigger on requests like:

- "add a [Remote | Ring buffer | OTLP | Sentry | Datadog | HTTP] LogReporter"
- "add a scope-filter / level-filter LogReporter decorator"
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
2. **Isomorphic by default for `main.ts` exports.** Every file re-exported from `logging/src/main.ts` must run in Node 18+ and modern browsers — no `process`, `Buffer`, `fs`, `window`, or `document`. **Node-only reporters** (file appenders, OS log socket, etc.) live in `logging/src/<Name>.ts` but are re-exported **only** from `logging/src/node.ts` (the `@toolcase/logging/node` subpath). Pattern to copy: `FileLogReporter.ts` + `node.ts`. Guard the Node API at runtime (`declare const require: ...; if (typeof require !== 'function') throw new Error('<Name> is only available in Node.js')`).
3. **One class per file.** PascalCase classname → `PascalCase.ts`. Filename matches export.
4. **Default export is the canonical export.** Named re-export at the bottom is fine.
5. **Export gateways: `main.ts` for isomorphic, `node.ts` for Node-only.** Add the named export to whichever applies. The default singleton (`logging`) only needs updating when the new feature is the *default reporter set* — most additions are just new exports for callers to wire up themselves.
6. **`LogReporter` subclasses must override `log(level, scope, time, messages)` exactly.** Same signature, no return value, never throw to the caller (wrap I/O so logging calls stay cheap).
7. **No async base class.** Reporters dispatch synchronously. If you need async I/O (HTTP, file), wrap in `BufferedReporter` or do your own buffer + timer (BufferedReporter is preferred — don't reinvent it).
8. **Tests are mandatory.** Append cases to the existing `logging/test/logging.test.ts` (single combined vitest file is the convention — don't create per-class test files). Cover: log dispatch, level filtering, scope routing, throw handling, async batching if applicable.
9. **Strict TypeScript.** No `any` in public surface. Match the precise types of `Logger`, `LoggerFactory`, `LogReporter` in the existing files.
10. **No code comments.** Match existing files (essentially comment-free).
11. **No semicolons.** Match style of `Logger.ts`, `LoggerFactory.ts`, `BufferedReporter.ts`.
12. **4-space indent.** No tabs.
13. **Reporter never throws to call site.** Wrap I/O in try/catch. The factory's `onLog` calls reporters synchronously and a throw bubbles to whoever called `logger.<level>()`. Reporters absorb their own errors silently or via a fallback reporter.
14. **Update `examples/public/logging/SKILL.md`.** Append a section in the matching category (Levels / Logger / LoggerFactory / LogReporter / Patterns / Cross-library integration). Use the existing entries as templates.
15. **Update `features.md`.** Append an inventory entry following the existing pattern.
16. **Demo is mandatory.** Every new export ships with a runnable demo at `examples/src/logging/<Name>Demo.tsx` registered in `examples/src/logging/index.tsx`. No demo = feature not done.

## Files to create / modify per feature

For a new export named `<Name>`:

1. **`logging/src/<Name>.ts`** — implementation. `export default <Name>`.
2. **`logging/test/logging.test.ts`** — append a `describe('<Name>', () => { ... })` block with the required cases. (Do not create a new test file — the package uses one combined file.)
3. **`logging/src/main.ts`** — append `import <Name> from './<Name>'` and add to the `export { ... }` block. Keep grouping with related exports (Reporter classes near `LogReporter`). **Node-only reporters go in `logging/src/node.ts` instead** — pattern: `import <Name>, { type <Name>Options } from './<Name>'; export { <Name> }; export type { <Name>Options }`.
4. **`examples/public/logging/SKILL.md`** — append the API section.
5. **`.claude/skills/logging-feature/features.md`** — append the inventory entry.
6. **`examples/src/logging/<Name>Demo.tsx`** — runnable demo. Mirror existing demos (`BasicLoggingDemo.tsx`, `CustomReporterDemo.tsx`, `LogLevelsDemo.tsx`, `MultipleScopesDemo.tsx`) and use the shared `_demo/LoggingDemo.tsx` shell. Show level dispatch, scope routing, and any reporter-specific behavior the user should observe.
7. **`examples/src/logging/index.tsx`** — register: `import <Name>Demo from './<Name>Demo'` then append `{ key: '<kebab>', label: '<Human label>', element: <<Name>Demo /> }` to `loggingExamples`.

## Reporter template

```ts
import { LoggerLevel } from './Level'
import LogReporter from './LogReporter'

export interface MyReporterOptions {
    // your config
}

class MyReporter extends LogReporter {

    constructor(private options: MyReporterOptions) {
        super()
    }

    log(level: LoggerLevel, scope: string, time: string, messages: any[]): void {
        try {
            // synchronous dispatch only
        } catch {
            // never propagate
        }
    }

}

export default MyReporter
```

For batched / async transports, **do not roll your own buffer**. Compose:

```ts
import { LoggerFactory, BufferedReporter } from '@toolcase/logging'
const factory = new LoggerFactory([
    new BufferedReporter(new MyReporter(opts), { maxSize: 50, flushInterval: 1000 })
])
```

For Node-only sinks, follow `FileLogReporter.ts` — guard `require` at construction time and re-export from `logging/src/node.ts`.

## Test template

Append to `logging/test/logging.test.ts` alongside the existing `describe('Level', ...)`, `describe('LoggerFactory', ...)`, etc.:

```ts
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
2. **Decide** whether the request is a new reporter (isomorphic or Node-only), a factory extension, a level helper, or a structured-logging primitive. Confirm via REUSE checks above.
3. **Create** `logging/src/<Name>.ts` from the template.
4. **Append cases** to `logging/test/logging.test.ts`.
5. **Wire into the export gateway** — `main.ts` (isomorphic) or `node.ts` (Node-only).
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
- Reimplementing buffer + flush timer instead of wrapping the inner reporter in `BufferedReporter`.
- Re-exporting a Node-only reporter from `main.ts` (breaks the browser build — use `node.ts`).
- Creating a new per-feature test file under `logging/test/` (convention is one combined `logging.test.ts`).
- Adding an `addReporter()` method to `LoggerFactory` (the factory takes reporters in the constructor by design — match that).
- Using `console.*` directly inside a reporter unless it is the explicit `ConsoleLogReporter`.
- Creating a parallel default singleton (one default singleton ships via `logging/src/main.ts`; additional factories are user-instantiated).
- Code comments where a self-named identifier would do.
- Trailing semicolons.
- Skipping tests, the demo, the published SKILL.md update, or the inventory update.
