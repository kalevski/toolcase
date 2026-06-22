---
name: logging
description: Use when wiring @toolcase/logging — tiny isomorphic logger with named loggers (scopes), level filtering (silent/error/warning/info/debug/verbose), and pluggable LogReporter sinks (console default, custom transports for remote/file/etc).
---

# logging — API Reference

Zero-dependency isomorphic logger. Default export is a pre-configured `LoggerFactory` with one `ConsoleLogReporter`.

```ts
import logging from '@toolcase/logging'

const log = logging.getLogger('boot')
log.info('starting')
log.error('crashed', err)
```

Also exports the factory class + reporter primitives for custom setups:

```ts
import {
    logging,                 // default LoggerFactory instance
    Logger,
    Level,                   // string-key map of level names
    LoggerFactory,
    LogReporter,             // base class for transports
    ConsoleLogReporter,
    JSONLineReporter,        // structured JSON-line transport
    BufferedReporter         // batching/debounce wrapper for slow sinks
} from '@toolcase/logging'

// Node-only transports live on the /node subpath (uses fs):
import { FileLogReporter } from '@toolcase/logging/node'
```

---

## Levels

```ts
type LoggerLevel = 'silent' | 'error' | 'warning' | 'info' | 'debug' | 'verbose'
```

> **Note:** the `LoggerLevel` *type* is **not** re-exported from the package root — `import { LoggerLevel } from '@toolcase/logging'` fails. Only the `Level` value (the string-key constant map) is exported. To type a level, inline the union above, or derive it: `type LoggerLevel = typeof Level[keyof typeof Level]`. The level methods accept these strings directly, so an explicit type annotation is rarely needed.

Order (lowest → highest verbosity):

| Order | Level     |
|-------|-----------|
| -1    | `silent`  |
| 0     | `error`   |
| 1     | `warning` |
| 2     | `info`    |
| 3     | `debug`   |
| 4     | `verbose` |

A message at level `L` is dispatched only when `factory.level >= L`. Default factory level is `'info'`. `silent` blocks everything.

```ts
logging.level = 'debug'   // setter
logging.level             // getter → 'debug'

import { Level } from '@toolcase/logging'
logging.level = Level.WARNING // 'warning'
```

`Level` constants: `SILENT ERROR WARNING INFO DEBUG VERBOSE`.

---

## Logger

Named log channel returned by `factory.getLogger(scope)`. Scopes are deduped — same name returns the same instance.

```ts
class Logger {
    error(...args: any[]): void
    warning(...args: any[]): void
    info(...args: any[]): void
    debug(...args: any[]): void
    verbose(...args: any[]): void
    log(level: LoggerLevel, ...args: any[]): void

    setLevel(level: LoggerLevel | null): void   // per-logger override; null = inherit factory
    getLevel(): LoggerLevel | null              // current override, or null
    withContext(ctx: Record<string, any>): Logger  // child logger that prepends ctx
}
```

Each call timestamps with `new Date().toISOString()` and forwards `(level, scope, time, args)` to every reporter (gated by per-logger override if set, otherwise factory level).

```ts
const auth = logging.getLogger('auth')
auth.warning('invalid token', { ip })
auth.log('debug', 'request payload', payload)
```

### Per-logger level override (`setLevel`)

`setLevel(level)` overrides the factory threshold for that logger only — and can both **narrow** (drop below-threshold) and **widen** (allow below-factory). `setLevel(null)` clears the override and defers back to the factory.

```ts
logging.level = 'warning'

const noisy = logging.getLogger('noisy')
noisy.setLevel('verbose')   // override factory; widens for this scope
noisy.debug('shown anyway')

const quiet = logging.getLogger('quiet')
quiet.setLevel('error')     // override factory; narrows for this scope
quiet.warning('dropped')

quiet.setLevel(null)        // back to factory threshold
```

The override is per-`Logger` instance — scopes do not share it.

### Structured context binding (`withContext`)

`withContext(ctx)` returns a **new** child `Logger` (the parent is unchanged) that prepends `ctx` as the first message arg on every dispatch. Nested calls merge contexts; later keys win.

```ts
const log = logging.getLogger('http')
const req = log.withContext({ requestId: 'r-7', userId: 42 })

req.info('handler.start')
// → reporter receives messages: [{ requestId: 'r-7', userId: 42 }, 'handler.start']

const route = req.withContext({ route: 'GET /orders' })
route.warning('slow', { ms: 820 })
// → messages: [{ requestId: 'r-7', userId: 42, route: 'GET /orders' }, 'slow', { ms: 820 }]
```

Child loggers inherit the parent's `setLevel` override at creation time. Common pattern: bind a request-scoped context once at the start of the request, pass that logger down.

```ts
async function handle(req: Request) {
    const log = logging.getLogger('http').withContext({
        requestId: req.headers.get('x-request-id'),
        method: req.method,
        path: new URL(req.url).pathname
    })
    log.info('start')
    try {
        const r = await route(req, log)
        log.info('ok', { status: r.status })
        return r
    } catch (e) {
        log.error('fail', e)
        throw e
    }
}
```

`JSONLineReporter` will surface the context as the first entry of `messages` — pair with a custom reporter that promotes context keys to top-level fields if you want flat structured logs.

---

## LoggerFactory

```ts
class LoggerFactory {
    constructor(reporters?: LogReporter[])
    level: LoggerLevel               // get/set; setter writes underlying numeric order
    getLogger(scope: string = 'default'): Logger
}
```

Spawn a separate factory when you want a different reporter set or level threshold without affecting the default singleton:

```ts
import { LoggerFactory, ConsoleLogReporter } from '@toolcase/logging'

const audit = new LoggerFactory([new ConsoleLogReporter()])
audit.level = 'verbose'
audit.getLogger('audit').verbose('login', { userId })
```

There is **no** `addReporter()` method — pass reporters via the constructor. (To extend the default singleton, build your own factory.)

---

## LogReporter

Base class. Override `log()` to ship messages to any sink.

```ts
class LogReporter {
    log(level: LoggerLevel, scope: string, time: string, messages: any[]): void
}
```

The default base does nothing — subclass it.

### ConsoleLogReporter

Built-in transport bound to the default factory. Routes `error` → `console.error`, `warning` → `console.warn`, everything else → `console.log`. Default format: `<LEVEL> [<ISO time>] | <scope>: ...messages`.

```
INFO [2026-05-03T12:00:00.000Z] | boot: starting
ERROR [2026-05-03T12:00:01.123Z] | auth: invalid token { ip: '1.2.3.4' }
```

Constructor options (`ConsoleLogReporterOptions`):

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `color` | `boolean` | auto | Force color on/off. Auto-enables on Node TTYs and in browsers; honoured by `NO_COLOR`. |
| `timestamp` | `boolean` | `true` | Include the ISO timestamp in the default prefix. |
| `prefix` | `string \| (level, scope, time) => string` | — | Override the prefix entirely (string or function). |
| `objects` | `'compact' \| 'pretty'` | `'compact'` | `'compact'` passes values to console as-is; `'pretty'` serializes objects/arrays to indented JSON and errors to a string. |

```ts
new ConsoleLogReporter()                       // auto-detect color, default prefix
new ConsoleLogReporter({ color: false })       // no color
new ConsoleLogReporter({ timestamp: false })   // omit time from prefix
new ConsoleLogReporter({ objects: 'pretty' })  // serialize objects as indented JSON
new ConsoleLogReporter({
    prefix: (level, scope) => `[${scope}] ${level.toUpperCase()}`
})
```

Color uses ANSI escape codes on Node TTYs and `%c` CSS styling in the browser. Setting `NO_COLOR` in the environment disables auto-detection (explicit `{ color: true }` still overrides it).

### JSONLineReporter

Structured JSON-line transport. Emits one JSON object per log entry. Isomorphic — defaults to `console.log`, but accepts any `write(line)` sink.

```ts
import { LoggerFactory, JSONLineReporter } from '@toolcase/logging'

const factory = new LoggerFactory([
    new JSONLineReporter({
        // optional: where to write each line (default: console.log)
        write: line => process.stdout.write(line + '\n'),
        // optional: static fields merged into every record
        extra: { service: 'api', region: 'eu' }
    })
])
const log = factory.getLogger('auth')
log.info('login ok', { userId: 42 })
// {"service":"api","region":"eu","level":"info","scope":"auth","time":"…","messages":["login ok",{"userId":42}]}
```

Errors are serialized to `{ name, message, stack }`. Circular references fall back to `'<unserializable>'`.

### FileLogReporter (Node only)

Writes log lines to a file. Available from `@toolcase/logging/node`.

```ts
import { LoggerFactory } from '@toolcase/logging'
import { FileLogReporter } from '@toolcase/logging/node'

const reporter = new FileLogReporter('./app.log', {
    append: true,                      // false → truncate on open
    formatter: (level, scope, time, messages) =>
        `${level.toUpperCase()} [${time}] | ${scope}: ${messages.join(' ')}`
})

const factory = new LoggerFactory([reporter])
const log = factory.getLogger('app')
log.info('boot complete')

// On shutdown, await flush:
await reporter.close()
```

Size-based rotation: pass `maxBytes` and `maxFiles` to rotate when the active file exceeds the byte threshold. The current file is renamed to `.1`, older archives shift up, and any archive beyond `maxFiles` is dropped.

```ts
new FileLogReporter('./logs/app.log', {
    maxBytes: 10 * 1024 * 1024,  // rotate at 10 MB
    maxFiles: 5,                  // keep app.log.1 … app.log.5
})
```

Combine with `JSONLineReporter` to write JSON lines to disk:

```ts
import { LoggerFactory, JSONLineReporter } from '@toolcase/logging'
import { createWriteStream } from 'node:fs'

const file = createWriteStream('./app.jsonl', { flags: 'a' })
const reporter = new JSONLineReporter({ write: line => file.write(line + '\n') })
```

### RingBufferReporter

Keeps the last `N` log entries in a fixed-capacity ring buffer backed by a circular array. Oldest entries are silently evicted when the buffer is full. Isomorphic — works in both Node.js and the browser with no I/O. Ideal for crash dumps, debug overlays, and "attach recent logs to this error report" patterns.

```ts
import { LoggerFactory, RingBufferReporter } from '@toolcase/logging'

const ring = new RingBufferReporter(100)           // keep last 100 entries
const factory = new LoggerFactory([ring])
factory.level = 'debug'

const log = factory.getLogger('app')
log.info('boot complete')
log.warning('slow query', { ms: 420 })
log.error('connection lost', err)

// At any time — retrieve all buffered entries (oldest → newest):
const entries = ring.snapshot()    // LogEntry[]

// On crash:
reportError({ recentLogs: ring.snapshot() })
```

API:

```ts
class RingBufferReporter extends LogReporter {
    constructor(capacity: number)   // throws if capacity is not a positive integer
    readonly size: number           // current number of buffered entries (≤ capacity)
    readonly capacity: number       // fixed maximum entries
    snapshot(): LogEntry[]          // shallow copy, oldest → newest
    clear(): void                   // reset buffer (capacity is preserved)
}
```

`LogEntry` shape (also exported from `@toolcase/logging`):

```ts
type LogEntry = {
    level: LoggerLevel
    scope: string
    time: number          // epoch milliseconds
    fields: Record<string, any>
    messages: any[]
}
```

Compose with `ConsoleLogReporter` to log to console **and** retain the ring for diagnostics:

```ts
const ring = new RingBufferReporter(200)
const factory = new LoggerFactory([new ConsoleLogReporter(), ring])

// Later, attach to an error boundary or crash handler:
window.onerror = () => sendDiagnostics(ring.snapshot())
```

### BufferedReporter

Batching/debounce wrapper. Buffers entries and flushes them either when `maxSize` is reached or after `flushInterval` ms — whichever comes first. Use it to wrap any slow sink (HTTP, database, filesystem) so per-call cost stays cheap.

```ts
import { LoggerFactory, BufferedReporter, ConsoleLogReporter } from '@toolcase/logging'

// Wrap an inner reporter — entries are replayed individually on flush.
const buffered = new BufferedReporter(new ConsoleLogReporter(), {
    maxSize: 100,           // default 50
    flushInterval: 2000     // ms; default 1000. 0 disables the timer.
})

// Or skip the inner reporter and ship a whole batch yourself.
const remote = new BufferedReporter(null, {
    maxSize: 50,
    flushInterval: 1000,
    onFlush: entries => {
        // entries: { level, scope, time, messages }[]
        fetch('/api/logs', {
            method: 'POST',
            body: JSON.stringify(entries)
        }).catch(() => {})
    }
})

const factory = new LoggerFactory([remote])
factory.getLogger('app').info('boot complete')

// On shutdown, flush + clear the timer:
remote.close()
```

API:

```ts
class BufferedReporter extends LogReporter {
    constructor(
        inner: LogReporter | null,
        options?: {
            maxSize?: number          // default 50
            flushInterval?: number    // default 1000ms; 0 disables the timer
            onFlush?: (entries: LogEntry[]) => void
        }
    )
    flush(): void                     // drain buffer immediately
    close(): void                     // flush + cancel timer (call on shutdown)
    size(): number                    // current buffered count
}
```

Either `inner` or `onFlush` must be provided. When both are present, `onFlush` wins (the inner reporter is bypassed). A throw inside `onFlush` (or the wrapped `inner`) propagates out of `flush()` — but **where** depends on what triggered the flush: a `maxSize`-overflow flush runs synchronously from the `logger.<level>(...)` call, so the throw reaches that call site; a `flushInterval` timer flush runs from a `setTimeout` callback, so the throw becomes an **unhandled exception** (no call-site to catch it). Always wrap your I/O.

Reporters run synchronously in registration order; a throw inside a synchronous reporter bubbles up to the call site of `logger.<level>(...)`. The exception is a reporter that flushes off a timer (e.g. `BufferedReporter`'s `flushInterval` path) — a throw there fires from a `setTimeout` callback and surfaces as an **unhandled exception**, not at the call site. Either way, wrap your I/O. See worked custom-reporter examples below.

---

## Examples per level

Each level method forwards `...args` to every reporter. Mix strings, objects, errors freely — the reporter decides formatting.

```ts
import logging from '@toolcase/logging'
const log = logging.getLogger('checkout')

log.error('payment rejected', new Error('card_declined'), { userId: 17 })
log.warning('retry budget exhausted', { attempts: 3 })
log.info('order placed', { orderId: 'o_42', total: 99.5 })
log.debug('cart snapshot', cart)
log.verbose('per-line trace', { step: 'reserve_inventory', took: 12 })
```

`log.log(level, ...args)` is the dynamic form — useful when the level is data-driven:

```ts
const level = response.ok ? 'info' : 'warning'
log.log(level, 'http response', { status: response.status, url })
```

Cap verbosity globally — anything above `factory.level` is silently dropped:

```ts
logging.level = 'warning'
log.info('skipped')   // not dispatched
log.error('shown')    // dispatched
```

`'silent'` blocks every level (including `error`). Use it for tests where logs should be absent.

---

## Examples — Logger scopes

Scopes give you per-subsystem prefixes without juggling instances. Same name returns the same logger.

```ts
const a1 = logging.getLogger('auth')
const a2 = logging.getLogger('auth')
console.log(a1 === a2) // true
```

Pattern: one logger per file, scope == module name.

```ts
// payments.ts
import logging from '@toolcase/logging'
const log = logging.getLogger('payments')

export async function charge(card: Card) {
    log.debug('charge.start', { card: card.last4 })
    try {
        const r = await api.charge(card)
        log.info('charge.ok', { id: r.id })
        return r
    } catch (err) {
        log.error('charge.fail', err)
        throw err
    }
}
```

Hierarchical scopes — naming convention only, no real nesting in the API:

```ts
logging.getLogger('http')
logging.getLogger('http.request')
logging.getLogger('http.response')
```

A reporter can branch on `scope` (see "Filter by scope" below) to route or filter by subsystem.

---

## Examples — `LoggerFactory`

### Multiple reporters, fan-out

```ts
const factory = new LoggerFactory([
    new ConsoleLogReporter(),  // dev convenience
    new RemoteReporter(),      // ship to backend
    new InMemoryRingBuffer()   // surface in dev panel
])
factory.level = 'info'
```

### No console output, just a buffer

```ts
class RingBuffer extends LogReporter {
    private events: any[] = []
    log(level: any, scope: string, time: string, messages: any[]) {
        this.events.push({ level, scope, time, messages })
        if (this.events.length > 500) this.events.shift()
    }
    snapshot() { return this.events.slice() }
}

const buffer = new RingBuffer()
const factory = new LoggerFactory([buffer])
factory.getLogger('app').info('hello')
buffer.snapshot() // last 500 events
```

---

## Examples — `LogReporter`

For Node file output, prefer the built-in `FileLogReporter` (or `JSONLineReporter` over `fs.createWriteStream`) shown above — extend `LogReporter` directly only when you need custom routing/filtering/transformation.

### Remote reporter (batched)

For network I/O, wrap a sink with `BufferedReporter` (see API above) — `onFlush` ships the whole batch:

```ts
new BufferedReporter(null, {
    maxSize: 50,
    flushInterval: 500,
    onFlush: entries => {
        fetch('/api/logs', { method: 'POST', body: JSON.stringify(entries) }).catch(() => {})
    }
})
```

### Filter by scope

```ts
class ScopedReporter extends LogReporter {
    constructor(private prefix: string, private inner: LogReporter) { super() }
    log(level, scope, time, messages) {
        if (!scope.startsWith(this.prefix)) return
        this.inner.log(level, scope, time, messages)
    }
}

new LoggerFactory([new ScopedReporter('http.', new ConsoleLogReporter())])
```

### Browser console with `console.group` per scope

```ts
class GroupedReporter extends LogReporter {
    log(level, scope, time, messages) {
        const fn = level === 'error' ? console.error
            : level === 'warning' ? console.warn : console.log
        console.groupCollapsed(`${level.toUpperCase()} ${scope} ${time}`)
        fn(...messages)
        console.groupEnd()
    }
}
```

---

## Scope-pattern level control

`setLevel(pattern, level)` overrides the threshold for all scopes matching a glob pattern. The most-specific pattern (fewest wildcards) wins when multiple patterns match; last-registered wins on a tie.

```ts
const factory = new LoggerFactory([reporter])
factory.level = 'warning'          // global default

factory.setLevel('db:*', 'debug') // any db:* scope → debug
factory.setLevel('db:pool', 'info') // exact match is more specific → info for db:pool

factory.getLogger('db:pool').debug('dropped — db:pool exact pattern requires ≥ info')
factory.getLogger('db:pool').info('shown')
factory.getLogger('db:query').debug('shown — matched by db:*')
factory.getLogger('auth').debug('dropped — no pattern, global is warning')
```

Pattern syntax: `*` matches any sequence of characters (including `:` separators).

```ts
factory.setLevel('auth*', 'debug')    // auth, auth:login, authentication, …
factory.setLevel('db:pool:*', 'info') // db:pool:worker, db:pool:idle, …
factory.setLevel('*', 'debug')        // every scope
```

Throws `RangeError` for an unknown level string (same as the `level` setter).

### Hierarchical scopes via `child()`

`logger.child(childScope)` returns a new logger whose scope is `parentScope:childScope`. Useful for building nested namespaces without repeating the parent prefix.

```ts
const db     = factory.getLogger('db')
const pool   = db.child('pool')           // scope: db:pool
const worker = pool.child('worker')       // scope: db:pool:worker

// Matches factory.setLevel('db:*', 'debug'):
pool.debug('shown')
worker.debug('shown')
```

The child inherits the parent's `withContext` fields and `setLevel` override at creation time. It dispatches through the same factory reporters.

```ts
const req = factory.getLogger('http').withContext({ requestId: 'r1' })
const handler = req.child('orders')   // scope: http:orders, carries requestId context
handler.info('start')
```

### Env-driven configuration (`parseEnv`)

`parseEnv(env)` reads `LOG_LEVEL` and `DEBUG` from a plain key-value object (pass `process.env` in Node, `import.meta.env` in Vite, or your own record).

```ts
factory.parseEnv(process.env)
// LOG_LEVEL=debug    → factory.level = 'debug'
// DEBUG=auth*,db:*   → factory.setLevel('auth*', 'debug'); factory.setLevel('db:*', 'debug')
```

`LOG_LEVEL` must be one of the six known level tokens; unknown values are silently ignored. `DEBUG` is comma-or-space-separated and each token becomes a scope pattern at level `debug`. Unknown `LOG_LEVEL` tokens are silently skipped (the factory level is unchanged).

```ts
// Node
import logging from '@toolcase/logging'
logging.parseEnv(process.env)

// Vite / ESM
import logging from '@toolcase/logging'
logging.parseEnv(import.meta.env)
```

---

## Patterns

**Switch verbosity from env (Node):**

```ts
import logging from '@toolcase/logging'
import { env } from '@toolcase/node'
logging.level = env('LOG_LEVEL', 'info') as any
```

**Bind once, log error+rethrow helper:**

```ts
const log = logging.getLogger('jobs')

export function loud<T>(name: string, fn: () => Promise<T>): Promise<T> {
    log.debug(name + '.start')
    return fn().then(
        v => { log.info(name + '.ok'); return v },
        e => { log.error(name + '.fail', e); throw e }
    )
}

await loud('reindex', () => reindexUsers())
```

**Replace default reporter set:**

The default singleton ships with `ConsoleLogReporter`. To use a different transport, instantiate your own `LoggerFactory` and import that everywhere instead of the default.

---

## Cross-library integration

### With `@toolcase/base` retry

```ts
import { retry } from '@toolcase/base'
import logging from '@toolcase/logging'
const log = logging.getLogger('http')

await retry(async () => {
    const r = await fetch('/api/data')
    if (!r.ok) {
        log.warning('retry.attempt.fail', { status: r.status })
        throw new Error(`HTTP ${r.status}`)
    }
    return r.json()
}, { retries: 5, factor: 2, minTimeout: 500 })
```

### With `@toolcase/base` Broadcast

`Broadcast` events are silent by default — pipe them into a logger when debugging:

```ts
import { Broadcast } from '@toolcase/base'

class Service extends Broadcast {
    work() { this.emit('done', { ok: true }) }
}

const log = logging.getLogger('svc')
const svc = new Service()
svc.on('done', payload => log.info('done', payload))
```

### With `@toolcase/phaser-plus` Engine

`Engine.getLogger(scope)` returns a `Logger` — the engine wires its own factory but the public API is identical.

---

## Composable wrapper reporters

Five decorator reporters that each wrap one inner `LogReporter` and forward the single-method SPI. Compose them freely with `FanoutReporter` to build per-sink pipelines.

```ts
import {
    LevelFilterReporter, ScopeFilterReporter,
    RedactionReporter, SamplingReporter,
    FanoutReporter, MultiReporter,
} from '@toolcase/logging'
```

### `LevelFilterReporter`

Forwards only entries whose level is at or above `minLevel`. Lets you attach a stricter threshold to one specific sink without changing the factory's global level.

```ts
class LevelFilterReporter extends LogReporter {
    constructor(inner: LogReporter, minLevel: LoggerLevel)
}
```

```ts
// Console receives only errors; the ring buffer still gets everything.
const factory = new LoggerFactory([
    new LevelFilterReporter(new ConsoleLogReporter(), 'error'),
    new RingBufferReporter(200),
])
factory.level = 'verbose'
```

### `ScopeFilterReporter`

Forwards only entries whose scope matches a glob `pattern`. `*` matches any sequence of characters, including `:` separators (same syntax as `factory.setLevel(pattern, level)`).

```ts
class ScopeFilterReporter extends LogReporter {
    constructor(inner: LogReporter, pattern: string)
}
```

```ts
// Ship only db:* logs to the audit sink.
const auditSink = new ScopeFilterReporter(new JSONLineReporter({ write }), 'db:*')
const factory = new LoggerFactory([new ConsoleLogReporter(), auditSink])
```

Pattern examples:

```ts
'db:*'          // db:pool, db:pool:worker, …
'http*'         // http, http:request, httpClient, …
'*'             // every scope
'auth'          // exact match only
```

### `RedactionReporter`

Walks every entry's `fields` and each element of `messages` and replaces values whose key matches `keys` with the string `'[REDACTED]'`. Handles nested objects, arrays, and circular references. `Error` instances are passed through unchanged.

```ts
type RedactionKeys = string[] | RegExp

class RedactionReporter extends LogReporter {
    constructor(inner: LogReporter, keys: RedactionKeys)
}
```

```ts
// Scrub well-known sensitive keys before shipping to a remote sink.
const safe = new RedactionReporter(new JSONLineReporter({ write }), [
    'password', 'authorization', 'token', 'secret',
])

// Or use a regex for broader matching.
const safe2 = new RedactionReporter(sink, /password|secret|token/i)

const factory = new LoggerFactory([safe])
factory.getLogger('auth').info('login', { user: 'alice', password: 'hunter2' })
// → messages: [{ user: 'alice', password: '[REDACTED]' }]
```

The original messages array is never mutated.

### `SamplingReporter`

Forwards each entry to `inner` with probability `rate` (0–1). Useful for high-throughput trace-level logs where you want a statistical sample rather than every entry.

```ts
class SamplingReporter extends LogReporter {
    constructor(inner: LogReporter, rate: number)   // throws RangeError if rate ∉ [0, 1]
}
```

```ts
// Forward ~10 % of verbose traces to the remote sink.
const sampled = new SamplingReporter(remoteSink, 0.1)

// rate=1 → all entries pass; rate=0 → all entries drop.
new SamplingReporter(sink, 1)   // equivalent to no sampling
new SamplingReporter(sink, 0)   // effectively mutes the sink
```

### `FanoutReporter` / `MultiReporter`

Broadcasts every log entry to a list of inner reporters. Each reporter is called in a try/catch so a throw in one reporter does not skip the others. `flush()` and `close()` are forwarded to all inner reporters (errors isolated individually). `MultiReporter` is an alias.

```ts
class FanoutReporter extends LogReporter {
    constructor(reporters: LogReporter[])
}
const MultiReporter = FanoutReporter
```

```ts
// Per-sink policies via composition.
const fanout = new FanoutReporter([
    new LevelFilterReporter(new ConsoleLogReporter(), 'error'),   // errors only to console
    new ScopeFilterReporter(auditSink, 'audit:*'),                // audit scope to remote
    new RedactionReporter(jsonSink, ['password', 'token']),       // scrubbed JSON lines
    new SamplingReporter(traceSink, 0.05),                        // 5 % trace sampling
])

const factory = new LoggerFactory([fanout])
factory.level = 'verbose'
```

Because each wrapper forwards `flush()` and `close()`, calling `factory.close()` drains the entire pipeline correctly.

---

## Notes

- Package is `sideEffects: false` and zero-dependency.
- Importing the default export instantiates one `LoggerFactory` + one `ConsoleLogReporter` — safe in both Node and browser.
- No async / no buffering — every `logger.x()` call dispatches synchronously.
- ISO timestamps are generated per call (one `new Date()` per log).
