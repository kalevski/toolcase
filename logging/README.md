# @toolcase/logging


[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/logging?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/logging)
[![npm downloads](https://img.shields.io/npm/dw/@toolcase/logging?label=downloads&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/logging)

🏷 Lightweight logger for Node.js and Browser. **Zero runtime dependencies.**

## Install

```bash
npm install @toolcase/logging
```

## Usage

```ts
import logging from '@toolcase/logging'

const logger = logging.getLogger('my-app')

logger.info('Server started')
logger.warn('Disk space low')
logger.error('Connection failed', err)
logger.debug('Request payload:', data)
```

## Log Levels

Levels from most to least verbose: `error` → `warn` → `info` → `debug` → `trace`

```ts
logging.setLevel('warn') // only error and warn messages will be logged
```

## Custom Reporters

Extend `LogReporter` to send logs to external services:

```ts
import { LogReporter } from '@toolcase/logging'

class RemoteReporter extends LogReporter {
    log(level, scope, time, messages) {
        fetch('/api/logs', {
            method: 'POST',
            body: JSON.stringify({ level, scope, time, messages })
        })
    }
}

logging.addReporter(new RemoteReporter())
```

## License

The project is licensed under [MIT License](https://github.com/kalevski/toolcase/blob/main/LICENSE)