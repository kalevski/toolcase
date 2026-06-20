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

Built-in transport bound to the default factory.

```ts
class ConsoleLogReporter extends LogReporter {
    log(level, scope, time, messages) {
        // 'error'   → console.error
        // 'warning' → console.warn
        // others    → console.log
        // Format:   "<LEVEL> [<ISO time>] | <scope>: ...messages"
    }
}
```

Example output:

```
INFO [2026-05-03T12:00:00.000Z] | boot: starting
ERROR [2026-05-03T12:00:01.123Z] | auth: invalid token { ip: '1.2.3.4' }
```

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

## Notes

- Package is `sideEffects: false` and zero-dependency.
- Importing the default export instantiates one `LoggerFactory` + one `ConsoleLogReporter` — safe in both Node and browser.
- No async / no buffering — every `logger.x()` call dispatches synchronously.
- ISO timestamps are generated per call (one `new Date()` per log).
