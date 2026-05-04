# Existing `@toolcase/logging` API

Reference inventory for everything currently exported from `logging/src/main.ts`. Use to pick the right primitive before scaffolding a new one. **Reuse before reinvent.**

Source of truth: `logging/src/main.ts` exports + `examples/public/logging/SKILL.md`. If something here is missing from those, treat this doc as stale.

---

## Default singleton

### `logging` (default export of `@toolcase/logging`)

Pre-configured `LoggerFactory` with one `ConsoleLogReporter` and `level = 'info'`. Use directly for typical apps:

```ts
import logging from '@toolcase/logging'
const log = logging.getLogger('boot')
log.info('starting')
```

**Use when:** any app that wants per-module loggers without configuring transport.
**Skip when:** need different reporters or thresholds — instantiate your own `LoggerFactory`.

---

## Levels

### `Level` — string-key constants

`Level.SILENT = 'silent'`, `Level.ERROR`, `Level.WARNING`, `Level.INFO`, `Level.DEBUG`, `Level.VERBOSE`.

Numeric order (low → high verbosity): silent (-1), error (0), warning (1), info (2), debug (3), verbose (4). A message at level `L` is dispatched only when `factory.level >= L`.

`silent` blocks everything (including `error`).

---

## Logger

### `Logger` — named log channel

Returned by `factory.getLogger(scope)`. Same scope returns the same instance.

| Method | Signature |
|---|---|
| `error(...args)` | dispatch at error level |
| `warning(...args)` | dispatch at warning level |
| `info(...args)` | dispatch at info level |
| `debug(...args)` | dispatch at debug level |
| `verbose(...args)` | dispatch at verbose level |
| `log(level, ...args)` | dynamic level dispatch |

Each call timestamps with `new Date().toISOString()` and forwards `(level, scope, time, args)` to every registered reporter (gated by factory level).

**Use when:** any module-scoped logging.
**Skip when:** you need to override how messages are formatted — that goes in a custom `LogReporter`, not on the `Logger`.

---

## LoggerFactory

### `LoggerFactory` — owns reporters + threshold

`new LoggerFactory(reporters?: LogReporter[])`.

| Member | Notes |
|---|---|
| `level: LoggerLevel` | get/set; setter writes underlying numeric order |
| `getLogger(scope = 'default'): Logger` | scopes deduped |

No `addReporter()` — reporters come in via the constructor. Spawn a separate factory for any subsystem that wants a different reporter set.

**Use when:** your app needs more than one reporter, or a different threshold from the default singleton.
**Skip when:** the default `logging` singleton is enough.

**Reuses:** `Logger`, `LogReporter`.

---

## LogReporter

### `LogReporter` — base class for transports

Override:

```ts
log(level: LoggerLevel, scope: string, time: string, messages: any[]): void
```

The default base does nothing. Reporters fire synchronously in registration order. **Never throw to the call site** — wrap I/O.

**Use when:** authoring a new transport (file, HTTP, ring buffer, OTel, Sentry, Datadog).

---

### `ConsoleLogReporter` — built-in console transport

`error → console.error`, `warning → console.warn`, others → `console.log`. Format: `<LEVEL> [<ISO time>] | <scope>: ...messages`.

Bound to the default `logging` singleton.

**Use when:** dev convenience or any browser app.
**Skip when:** want to ship logs to a backend (compose with a custom reporter alongside it, not instead of it — keeping console output during dev is usually correct).

---

## Decision quick map

| Need | Reach for |
|---|---|
| Per-module logger | `logging.getLogger(name)` |
| Different threshold for one subsystem | spawn `new LoggerFactory(...)` for that subsystem |
| Ship logs to a backend | new subclass of `LogReporter` (use buffered template) |
| Filter logs by scope | wrap `LogReporter` in a decorator subclass |
| Run two transports at once | pass both to a new `LoggerFactory(reporters)` |
| Swap from env | `logging.level = env('LOG_LEVEL', 'info')` (with `@toolcase/base/node` env) |
| Capture logs in tests | ring-buffer subclass of `LogReporter` |

---

## Composition examples

These already exist — copy the pattern.

- **Console + remote fan-out:** `new LoggerFactory([new ConsoleLogReporter(), new RemoteReporter()])`.
- **Per-subsystem audit factory:** `new LoggerFactory([new ConsoleLogReporter()])` with `level = 'verbose'`.
- **In-memory ring buffer for dev panels:** subclass of `LogReporter` storing last N events.

When you compose, document under "Reuses" in your new feature's `features.md` entry.
