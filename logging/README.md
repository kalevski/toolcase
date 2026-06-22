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

## Scoped loggers

Each call to `getLogger(scope)` returns a stable logger for that scope — same name, same instance.

```ts
const apiLog = logging.getLogger('api')
const dbLog  = logging.getLogger('db')

apiLog.info('GET /users')   // [api] GET /users
dbLog.info('SELECT … ')     // [db]  SELECT …
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

## Reporters

A reporter receives every log line and decides what to do with it (print, ship to a server, write to a file, batch and flush, etc.). Built-ins:

| Reporter | Where it works | What it does |
|----------|---------------|--------------|
| `ConsoleLogReporter` | Browser + Node | Pretty-prints to the developer console with colored output. Default. |
| `JSONLineReporter` | Browser + Node | Emits one JSON object per line. Good for log aggregators. |
| `BufferedReporter` | Browser + Node | Wraps an inner reporter and/or an `onFlush` handler and flushes in batches. When both are supplied, `onFlush` is called first, then every entry is forwarded to `inner`. |
| `FileLogReporter` | **Node only** | Writes to disk (append by default) with optional size-based rotation. Imported from `@toolcase/logging/node`. |

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

### Graceful shutdown

`BufferedReporter` and `FileLogReporter` hold in-flight state (a pending batch and an open write stream respectively) that must be drained before the process exits.

**`BufferedReporter`** — call `close()` on shutdown. It flushes the pending batch synchronously and cancels the interval timer.

```ts
const remote = new BufferedReporter(inner, { flushInterval: 2000 })

process.on('SIGTERM', () => {
    remote.close()
    process.exit(0)
})
```

As a safety net, `BufferedReporter` also registers a `process.once('beforeExit', …)` listener on Node.js that flushes any remaining entries automatically when the event loop drains. This does not replace an explicit `close()` call — it is a last-resort guard for clean exits where no shutdown hook is wired up. The listener is browser-safe (the registration is guarded by `typeof process !== 'undefined'`).

**`FileLogReporter`** — call `await close()` on shutdown. It waits for any in-progress rotation to complete, then closes the underlying write stream.

```ts
const file = new FileLogReporter('./logs/app.log')

process.on('SIGTERM', async () => {
    await file.close()
    process.exit(0)
})
```

### Custom reporter

Extend `LogReporter` and implement `log(level, scope, time, messages)`:

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
| `setLevel(level \| null)` | Per-logger override. |
| `getLevel()` | Returns override or `null`. |
| `withContext(obj)` | New logger that prepends `obj` to every message. |

### `LoggerLevel`

```ts
'silent' | 'error' | 'warning' | 'info' | 'debug' | 'verbose'
```

### `LogReporter`

Base class. Override `log(level, scope, time, messages)`.

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)
