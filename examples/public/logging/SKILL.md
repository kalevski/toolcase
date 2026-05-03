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
    ConsoleLogReporter
} from '@toolcase/logging'
```

---

## Levels

```ts
type LoggerLevel = 'silent' | 'error' | 'warning' | 'info' | 'debug' | 'verbose'
```

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
}
```

Each call timestamps with `new Date().toISOString()` and forwards `(level, scope, time, args)` to every reporter (gated by factory level).

```ts
const auth = logging.getLogger('auth')
auth.warning('invalid token', { ip })
auth.log('debug', 'request payload', payload)
```

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

### Custom reporter

```ts
import { LogReporter, LoggerFactory, ConsoleLogReporter } from '@toolcase/logging'

class RemoteReporter extends LogReporter {
    log(level, scope, time, messages) {
        if (level === 'verbose') return
        fetch('/api/logs', {
            method: 'POST',
            body: JSON.stringify({ level, scope, time, messages })
        }).catch(() => {}) // never throw inside reporters
    }
}

const factory = new LoggerFactory([
    new ConsoleLogReporter(),
    new RemoteReporter()
])
factory.level = 'info'
const log = factory.getLogger('app')
```

Reporters run synchronously in order; throws inside a reporter will bubble up to the call site of `logger.<level>(...)`. Wrap I/O accordingly.

---

## Patterns

**Per-module loggers:**

```ts
// in each file
import logging from '@toolcase/logging'
const log = logging.getLogger('payments')
```

**Switch verbosity from env (Node):**

```ts
import logging from '@toolcase/logging'
import { env } from '@toolcase/base/node'
logging.level = env('LOG_LEVEL', 'info') as any
```

**Replace default reporter set:**

The default singleton ships with `ConsoleLogReporter`. To use a different transport, instantiate your own `LoggerFactory` and import that everywhere instead of the default.

---

## Notes

- Package is `sideEffects: false` and zero-dependency.
- Importing the default export instantiates one `LoggerFactory` + one `ConsoleLogReporter` — safe in both Node and browser.
- No async / no buffering — every `logger.x()` call dispatches synchronously.
- ISO timestamps are generated per call (one `new Date()` per log).
