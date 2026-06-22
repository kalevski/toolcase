# @toolcase/logging

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/logging?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/logging)
[![npm downloads](https://img.shields.io/npm/dw/@toolcase/logging?label=downloads&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/logging)

🏷 Lightweight isomorphic logger for Node.js and the browser. **Zero runtime dependencies.** Scoped loggers, level filtering, structured context, multiple reporters, batching.

## Why

Pino is great on the server. `console.log` is fine for tiny scripts. In between, you want **scoped loggers**, **level control**, and **a way to ship logs somewhere** without dragging in 200KB of transport code. That's what this is.

## Install

```bash
npm install @toolcase/logging
```

## Quick start

```ts
import logging from '@toolcase/logging'

const log = logging.getLogger('users')

log.info('server started')
log.warning('disk space low')
log.error('connection failed', err)
log.debug('request payload', payload)
log.verbose('low-level trace info')
```

The default export is a singleton `LoggerFactory` pre-wired with one `ConsoleLogReporter`. Get a scoped logger by name with `logging.getLogger('scope')`.

## Log levels

Levels from least to most verbose:

```
error → warning → info → debug → verbose
```

Plus `silent` to disable everything.

```ts
logging.level = 'warning'   // only error + warning will be logged
logging.level = 'silent'    // turn off entirely
```

Per-logger level overrides:

```ts
const dbLog = logging.getLogger('db')
dbLog.setLevel('debug')   // 'db' logs debug; everything else uses factory default
dbLog.setLevel(null)      // remove override
```

Pattern-based overrides via `setLevel(pattern, level)` on the factory:

```ts
logging.setLevel('db:*', 'debug')    // any scope matching db:* → debug
logging.setLevel('db:pool', 'info')  // most-specific pattern wins
```

`*` matches any character sequence including `:`. The most specific pattern (fewest wildcards) wins when multiple match; last-registered wins on a tie. Per-logger `setLevel()` always beats pattern overrides.

## Scoped loggers

Each call to `getLogger(scope)` returns a stable logger for that scope — same name, same instance.

```ts
const apiLog = logging.getLogger('api')
const dbLog  = logging.getLogger('db')

apiLog.info('GET /users')   // [api] GET /users
dbLog.info('SELECT … ')     // [db]  SELECT …
```

Child loggers combine scopes with `:`:

```ts
const db   = logging.getLogger('db')
const pool = db.child('pool')   // scope: db:pool
pool.info('connected')          // [db:pool] connected
```

## Structured context

`Logger.withContext(obj)` returns a new logger that prepends a context object to every log call. Useful for request/correlation IDs.

```ts
const log = logging.getLogger('api')

function handle(req) {
    const reqLog = log.withContext({ requestId: req.id, userId: req.user?.id })
    reqLog.info('handling')      // logs include { requestId, userId }
    reqLog.error('boom', err)
}
```

## Lazy thunk arguments

Any argument that is a function is called only when the level is enabled; its return value is logged instead. Useful for expensive serialization.

```ts
log.debug(() => JSON.stringify(bigObject))
log.debug('prefix', () => computeExpensiveDiff(), 'suffix')
```

Or gate explicitly with `isEnabled`:

```ts
if (log.isEnabled('debug')) {
    log.debug('diff', computeExpensiveDiff())
}
```

## Env-driven configuration

`parseEnv(env)` reads `LOG_LEVEL` and `DEBUG` from any string record:

```ts
// Node
logging.parseEnv(process.env)

// Vite / ESM
logging.parseEnv(import.meta.env)
```

`LOG_LEVEL` sets the global factory level (silently ignored if unknown). `DEBUG` is a comma-or-space-separated list of scope patterns; each becomes `setLevel(pattern, 'debug')`.

## Reporters

A reporter receives every log line and decides what to do with it. Built-ins:

| Reporter | Where it works | What it does |
|----------|---------------|--------------|
| `ConsoleLogReporter` | Browser + Node | Pretty-prints to the console with colored output. Default. |
| `JSONLineReporter` | Browser + Node | Emits one JSON object per line. Good for log aggregators. |
| `BufferedReporter` | Browser + Node | Batches entries and flushes on a timer or when the buffer is full. |
| `RingBufferReporter` | Browser + Node | Fixed-capacity ring; oldest entries evicted. Snapshot for crash dumps or overlays. |
| `HTTPReporter` | Browser + Node | POSTs batches to an HTTP endpoint with automatic retry. |
| `OTLPReporter` | Browser + Node | POSTs batches to an OTLP HTTP endpoint in OpenTelemetry format. |
| `MemoryReporter` | Browser + Node | In-memory store designed for unit tests. Never drains on read. |
| `LevelFilterReporter` | Browser + Node | Decorator: forwards only entries at or above a minimum level. |
| `ScopeFilterReporter` | Browser + Node | Decorator: forwards only entries whose scope matches a glob. |
| `RedactionReporter` | Browser + Node | Decorator: replaces sensitive keys with `'[REDACTED]'` before forwarding. |
| `SamplingReporter` | Browser + Node | Decorator: forwards a random fraction of entries. |
| `FanoutReporter` | Browser + Node | Broadcasts to a list of inner reporters. `MultiReporter` is an alias. |
| `StreamReporter` | **Node only** | Writes to any `node:stream.Writable`. Imported from `@toolcase/logging/node`. |
| `FileLogReporter` | **Node only** | Writes to a file path with size-based rotation. Imported from `@toolcase/logging/node`. |
| `ContextualReporter` | **Node only** | Decorator: merges `AsyncLocalStorage` context into every entry. Imported from `@toolcase/logging/node`. |
| `BeaconReporter` | **Browser only** | Buffers entries and flushes via `navigator.sendBeacon`. Imported from `@toolcase/logging/browser`. |
| `IndexedDBReporter` | **Browser only** | Persists entries to IndexedDB; survives page reloads. Imported from `@toolcase/logging/browser`. |

### ConsoleLogReporter options

```ts
new ConsoleLogReporter(options?: ConsoleLogReporterOptions)
```

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `color` | `boolean` | auto | Force color on or off. Auto-enables on Node TTYs and in the browser; auto-disables under `NO_COLOR` or non-TTY Node output. |
| `timestamp` | `boolean` | `true` | Include the ISO timestamp in the default prefix. |
| `prefix` | `string \| (level, scope, time) => string` | — | Override the prefix. A string is used as-is; a function receives `(level, scope, time)` and must return the prefix string. When set, `timestamp` has no effect. |
| `objects` | `'compact' \| 'pretty'` | `'compact'` | How plain objects are formatted. `'compact'` passes values to `console` as-is (native expansion in devtools / `util.inspect` in Node). `'pretty'` serializes objects/arrays to indented JSON and errors to `name: message\nstack`. |

```ts
new ConsoleLogReporter()                        // auto-detect color, default prefix, compact objects
new ConsoleLogReporter({ color: true })         // force color on
new ConsoleLogReporter({ color: false })        // force color off
new ConsoleLogReporter({ timestamp: false })    // omit timestamp from prefix
new ConsoleLogReporter({ objects: 'pretty' })   // serialize objects as indented JSON
new ConsoleLogReporter({
    prefix: (level, scope) => `[${scope}] ${level.toUpperCase()}`
})
```

`NO_COLOR` (any value) in the environment disables color auto-detection — the reporter will not emit ANSI codes or `%c` browser styles. `{ color: true }` still overrides this.

### Multiple reporters

```ts
import { LoggerFactory, ConsoleLogReporter, JSONLineReporter } from '@toolcase/logging'

const logging = new LoggerFactory([
    new ConsoleLogReporter(),
    new JSONLineReporter({ extra: { service: 'api', env: 'prod' } })
])
```

### Batched / remote shipping

```ts
import { LoggerFactory, BufferedReporter, JSONLineReporter } from '@toolcase/logging'

const remote = new BufferedReporter(
    new JSONLineReporter({ write: line => navigator.sendBeacon('/logs', line) }),
    { maxSize: 50, flushInterval: 2000 }
)

const logging = new LoggerFactory([remote])
```

Or skip the inner reporter and handle the batch directly:

```ts
const reporter = new BufferedReporter(null, {
    maxSize: 50,
    flushInterval: 2000,
    onFlush: (entries) => fetch('/logs', {
        method: 'POST',
        body: JSON.stringify(entries)
    })
})
```

Both can be supplied at once — `onFlush` fires first (useful as a batch hook or for shipping the raw array), then every entry is forwarded individually to `inner`:

```ts
const reporter = new BufferedReporter(
    new ConsoleLogReporter(),           // sink: receives each entry one-by-one
    {
        maxSize: 50,
        flushInterval: 2000,
        onFlush: entries => ship(entries) // hook: also ships the whole batch
    }
)
```

### Ring buffer

`RingBufferReporter` keeps the last `N` entries in memory. Oldest entries are silently evicted when full. Ideal for crash dumps and debug overlays.

```ts
import { LoggerFactory, RingBufferReporter } from '@toolcase/logging'

const ring = new RingBufferReporter(100)
const logging = new LoggerFactory([ring])

const snap = ring.snapshot()   // LogEntry[], oldest → newest
ring.clear()                   // reset; capacity preserved
```

### HTTP reporter

`HTTPReporter` buffers entries internally and POSTs each batch as JSON to a URL. Retries on network errors or non-2xx responses with exponential back-off. Works in Node 18+ and modern browsers.

```ts
import { LoggerFactory, HTTPReporter } from '@toolcase/logging'

const reporter = new HTTPReporter({
    url: 'https://ingest.example.com/logs',
    headers: { Authorization: 'Bearer my-token' },
    maxSize: 100,
    flushInterval: 5000,
    retries: 3,
})

const logging = new LoggerFactory([reporter])

// On shutdown:
reporter.close()
```

Each POST body is `{ "entries": LogEntry[] }`. Inject a custom `transport` for testing:

```ts
import { HTTPReporter, type HTTPTransport } from '@toolcase/logging'

const transport: HTTPTransport = async (url, body, headers) => {
    const res = await myFetch(url, { method: 'POST', body, headers })
    return res.status
}
const reporter = new HTTPReporter({ url: '...', transport })
```

### OTLP reporter

`OTLPReporter` sends batches to an OpenTelemetry-compatible HTTP collector as `LogsData` JSON. Bridges `LoggerLevel` to OTLP severity numbers.

```ts
import { LoggerFactory, OTLPReporter } from '@toolcase/logging'

const reporter = new OTLPReporter({
    url: 'https://otel-collector.example.com/v1/logs',
    resource: { 'service.name': 'api', 'deployment.environment': 'prod' },
    maxSize: 100,
    flushInterval: 5000,
})

const logging = new LoggerFactory([reporter])
reporter.close()   // on shutdown
```

### Stream reporter (Node)

`StreamReporter` writes formatted log lines to any Node.js `Writable` stream — stdout, a TCP socket, a `PassThrough`, or any custom writable.

```ts
import { StreamReporter } from '@toolcase/logging/node'

const reporter = new StreamReporter(process.stdout, {
    formatter: (level, scope, time, _fields, messages) =>
        `${level} ${scope} ${messages.join(' ')}`,
    onError: err => console.error('stream error', err),
    maxBytes: 10 * 1024 * 1024,   // resets byte counter; no rotation on generic streams
})
```

### File reporter (Node)

```ts
import { LoggerFactory } from '@toolcase/logging'
import { FileLogReporter } from '@toolcase/logging/node'

const logging = new LoggerFactory([
    new FileLogReporter('./logs/app.log')
])
```

Size-based rotation is supported via `maxBytes` and `maxFiles`. When the active file reaches `maxBytes`, it is renamed to `.1` (shifting older files up to `.maxFiles`, dropping the oldest) and a fresh file is opened:

```ts
new FileLogReporter('./logs/app.log', {
    maxBytes: 10 * 1024 * 1024,  // rotate at 10 MB
    maxFiles: 5,                  // keep app.log.1 … app.log.5
})
```

### Composable wrapper reporters

Five decorator reporters each wrap one inner `LogReporter` and forward `flush()` and `close()`. Compose freely with `FanoutReporter` to build per-sink pipelines.

```ts
import {
    LevelFilterReporter, ScopeFilterReporter,
    RedactionReporter, SamplingReporter, FanoutReporter
} from '@toolcase/logging'
```

**`LevelFilterReporter`** — forwards only entries at or above `minLevel`:

```ts
new LevelFilterReporter(new ConsoleLogReporter(), 'error')
```

**`ScopeFilterReporter`** — forwards only entries whose scope matches a glob pattern:

```ts
new ScopeFilterReporter(auditSink, 'db:*')   // 'db:pool', 'db:pool:worker', …
```

**`RedactionReporter`** — replaces matching key values with `'[REDACTED]'` (supports string array or `RegExp`):

```ts
new RedactionReporter(jsonSink, ['password', 'token'])
new RedactionReporter(jsonSink, /password|secret|token/i)
```

**`SamplingReporter`** — forwards `rate` fraction of entries (0–1):

```ts
new SamplingReporter(traceSink, 0.1)   // forward ~10 %
```

**`FanoutReporter`** — broadcasts to a list of inner reporters (each isolated inside its own try/catch):

```ts
const fanout = new FanoutReporter([
    new LevelFilterReporter(new ConsoleLogReporter(), 'error'),
    new ScopeFilterReporter(auditSink, 'audit:*'),
    new RedactionReporter(jsonSink, ['password', 'token']),
    new SamplingReporter(traceSink, 0.05),
])
const logging = new LoggerFactory([fanout])
```

`MultiReporter` is an alias for `FanoutReporter`.

### Memory reporter (testing)

`MemoryReporter` accumulates entries without draining on read. Designed for unit tests.

```ts
import { LoggerFactory, MemoryReporter } from '@toolcase/logging'

const mem = new MemoryReporter()
const logging = new LoggerFactory([mem], () => 1_000_000)  // fixed clock

logging.getLogger('app').info('boot')
logging.getLogger('app').error('oops')

mem.entries()        // LogEntry[] — all entries, oldest → newest; never drained
mem.find('error')    // LogEntry[] — filtered to exact level
mem.clear()          // reset for the next test case
```

### Browser reporters (`@toolcase/logging/browser`)

**`BeaconReporter`** — buffers entries and flushes via `navigator.sendBeacon` (fire-and-forget, survives page unload). Optionally captures global errors.

```ts
import { BeaconReporter } from '@toolcase/logging/browser'
import { LoggerFactory } from '@toolcase/logging'

const reporter = new BeaconReporter({
    url: 'https://telemetry.example.com/logs',
    maxSize: 50,
    captureErrors: true,   // auto-capture window.onerror + unhandledrejection
})
const logging = new LoggerFactory([reporter])
```

**`IndexedDBReporter`** — persists entries to IndexedDB so they survive page reloads. Call `drain()` on next startup to retrieve and clear the stored entries.

```ts
import { IndexedDBReporter } from '@toolcase/logging/browser'
import { LoggerFactory } from '@toolcase/logging'

const reporter = new IndexedDBReporter({ maxEntries: 1000 })
const logging = new LoggerFactory([reporter])

// On next startup:
const buffered = await reporter.drain()
await fetch('/logs', { method: 'POST', body: JSON.stringify(buffered) })
```

### Async context (Node)

`AsyncContext` wraps `AsyncLocalStorage` to propagate fields across async call chains. Pair it with `ContextualReporter` to attach per-request context to every log call automatically.

```ts
import { AsyncContext, ContextualReporter } from '@toolcase/logging/node'
import { LoggerFactory, ConsoleLogReporter } from '@toolcase/logging'

const ctx = new AsyncContext()
const logging = new LoggerFactory([
    new ContextualReporter(new ConsoleLogReporter(), ctx)
])

ctx.run({ requestId: 'r1' }, async () => {
    await someAsyncWork()
    logging.getLogger('api').info('handled')   // fields includes requestId: 'r1'
})
```

### Formatters

Three named formatters are exported from `@toolcase/logging` and can be passed to any reporter that accepts a `formatter` option:

| Export | Output shape |
|--------|-------------|
| `textFormatter` | `LEVEL [ISO-time] \| scope: msg …` — human-readable; default for `StreamReporter`/`FileLogReporter` |
| `jsonFormatter` | Single-line JSON — default for `JSONLineReporter` |
| `logfmtFormatter` | `level=… scope=… ts=… msg=…` key-value pairs |

```ts
import { JSONLineReporter, logfmtFormatter } from '@toolcase/logging'
import { FileLogReporter } from '@toolcase/logging/node'

const reporter = new JSONLineReporter({ formatter: logfmtFormatter })
const file = new FileLogReporter('./app.log', { formatter: jsonFormatter })
```

### Graceful shutdown

`BufferedReporter` and `FileLogReporter` hold in-flight state that must be drained before the process exits.

**`BufferedReporter`** — call `close()` on shutdown. It flushes the pending batch synchronously and cancels the interval timer.

```ts
const remote = new BufferedReporter(inner, { flushInterval: 2000 })

process.on('SIGTERM', () => {
    remote.close()
    process.exit(0)
})
```

As a safety net, `BufferedReporter` also registers a `process.once('beforeExit', …)` listener on Node.js that flushes any remaining entries automatically when the event loop drains. This does not replace an explicit `close()` call.

**`FileLogReporter`** — call `await close()` on shutdown. It waits for any in-progress rotation to complete, then closes the underlying write stream.

```ts
const file = new FileLogReporter('./logs/app.log')

process.on('SIGTERM', async () => {
    await file.close()
    process.exit(0)
})
```

Or call `logging.close()` to drain all reporters at once:

```ts
process.on('SIGTERM', async () => {
    await logging.close()
    process.exit(0)
})
```

### Custom reporter

Extend `LogReporter` and implement `log(level, scope, time, fields, messages)`:

```ts
import { LoggerFactory, LogReporter } from '@toolcase/logging'

class SentryReporter extends LogReporter {
    log(level, scope, time, messages) {
        if (level === 'error') {
            Sentry.captureException(messages[0], { tags: { scope } })
        }
    }
}

const logging = new LoggerFactory()
logging.addReporter(new SentryReporter())
```

## API

### `logging` (default export)

A pre-configured `LoggerFactory` with a `ConsoleLogReporter`. Suitable for quick use; for production, build your own.

### `LoggerFactory(reporters?)`

| Member | Type | Description |
|--------|------|-------------|
| `getLogger(scope?)` | `(scope?: string) => Logger` | Get/create a scoped logger. |
| `level` | `LoggerLevel` | Global threshold. |
| `setLevel(pattern, level)` | `(pattern: string, level: LoggerLevel) => void` | Override threshold for all scopes matching a glob pattern. Throws `RangeError` for unknown levels. |
| `parseEnv(env)` | `(env: Record<string, string \| undefined>) => void` | Read `LOG_LEVEL` and `DEBUG` from a string record (e.g. `process.env`). |
| `addReporter(reporter)` | `(reporter: LogReporter) => void` | Attach a reporter after construction. |
| `removeReporter(reporter)` | `(reporter: LogReporter) => void` | Detach a previously added reporter. |
| `flush()` | `() => void` | Call `flush()` on every attached reporter. Errors are isolated per reporter. |
| `close()` | `() => Promise<void>` | Call `close()` on every attached reporter, awaiting any promises. Errors are isolated per reporter. |

### `Logger`

| Method | Description |
|--------|-------------|
| `error(...args)` | Log at `error` level. |
| `warning(...args)` | Log at `warning` level. |
| `info(...args)` | Log at `info` level. |
| `debug(...args)` | Log at `debug` level. |
| `verbose(...args)` | Log at `verbose` level. |
| `isEnabled(level)` | Returns `true` if the level would be logged (respects factory threshold and overrides). |
| `setLevel(level \| null)` | Per-logger override. |
| `getLevel()` | Returns override or `null`. |
| `withContext(obj)` | New logger that prepends `obj` to every message. |
| `child(scope)` | New logger whose scope is `parentScope:scope`, inheriting context and overrides. |

### `LoggerLevel`

```ts
'silent' | 'error' | 'warning' | 'info' | 'debug' | 'verbose'
```

Use `isKnownLevel(value)` and `KNOWN_LEVELS` (both exported from `@toolcase/logging`) to validate level strings at runtime.

### `LogReporter`

Base class. Override `log(level, scope, time, fields, messages)`, and optionally `flush()` and `close()`.

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)
