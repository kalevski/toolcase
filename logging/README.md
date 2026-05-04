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
| `ConsoleLogReporter` | Browser + Node | Pretty-prints to the developer console. Default. |
| `JSONLineReporter` | Browser + Node | Emits one JSON object per line. Good for log aggregators. |
| `BufferedReporter` | Browser + Node | Wraps any reporter (or an `onFlush` handler) and flushes in batches. |
| `FileLogReporter` | **Node only** | Writes to disk with optional rotation. Imported from `@toolcase/logging/node`. |

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

### File reporter (Node)

```ts
import { LoggerFactory } from '@toolcase/logging'
import { FileLogReporter } from '@toolcase/logging/node'

const logging = new LoggerFactory([
    new FileLogReporter({ filepath: './logs/app.log' })
])
```

### Custom reporter

Extend `LogReporter` and implement `log(level, scope, time, messages)`:

```ts
import { LogReporter } from '@toolcase/logging'

class SentryReporter extends LogReporter {
    log(level, scope, time, messages) {
        if (level === 'error') {
            Sentry.captureException(messages[0], { tags: { scope } })
        }
    }
}

logging.addReporter?.(new SentryReporter()) // or pass into the LoggerFactory ctor
```

## API

### `logging` (default export)

A pre-configured `LoggerFactory` with a `ConsoleLogReporter`. Suitable for quick use; for production, build your own.

### `LoggerFactory(reporters?)`

| Member | Type | Description |
|--------|------|-------------|
| `getLogger(scope?)` | `(scope?: string) => Logger` | Get/create a scoped logger. |
| `level` | `LoggerLevel` | Global threshold. |

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
