# @toolcase/base

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/base?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/base)
[![npm downloads](https://img.shields.io/npm/dw/@toolcase/base?label=downloads&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/base)

🧬 Collection of TypeScript helper functions and data structures. **Zero runtime dependencies.** Works in both Node.js and browsers.

## Install

```bash
npm install @toolcase/base
```

## API

### Data Structures

#### `Cache<T>(ttl: number)`
Time-based cache with automatic expiry.
```ts
import { Cache } from '@toolcase/base'
const cache = new Cache<string>(5000) // 5 second TTL
cache.set('key', 'value')
cache.get('key') // 'value'
```

#### `PriorityQueue<T>(compareFn)`
Ordered queue that dequeues by priority.
```ts
import { PriorityQueue } from '@toolcase/base'
const pq = new PriorityQueue<number>((a, b) => a - b)
pq.enqueue(3)
pq.enqueue(1)
pq.dequeue() // 1
```

#### `VectorClock`
Vector clock for distributed system synchronization.
```ts
import { VectorClock } from '@toolcase/base'
const clock = new VectorClock('node-1')
clock.increment()
clock.merge(otherClock)
```

#### `State<T>(initialData)`
Observable state object that emits events on property changes.
```ts
import { State } from '@toolcase/base'
const state = new State({ score: 0 })
state.on('change', (key, value) => console.log(key, value))
state.set({ score: 10 })
```

#### `AdjacencyMatrix`
Graph representation using an adjacency matrix.
```ts
import { AdjacencyMatrix } from '@toolcase/base'
const graph = new AdjacencyMatrix()
graph.addVertex('A')
graph.addVertex('B')
graph.addEdge('A', 'B', 1)
```

#### `ObjectPool<T>(factory, reset, initialSize)`
Object pool for reusing instances and reducing GC pressure.
```ts
import { ObjectPool } from '@toolcase/base'
const pool = new ObjectPool(() => ({ x: 0, y: 0 }), obj => { obj.x = 0; obj.y = 0 }, 10)
const obj = pool.get()
pool.release(obj)
```

### Events

#### `EventEmitter`
Minimal typed event emitter (vendored, zero deps).
```ts
import { EventEmitter } from '@toolcase/base'
const emitter = new EventEmitter()
emitter.on('event', (data) => console.log(data))
emitter.emit('event', 'hello')
```

#### `Broadcast`
Base class providing a pub/sub interface. Extend it to add events to your classes.
```ts
import { Broadcast } from '@toolcase/base'
class MyService extends Broadcast {
  doWork() { this.emit('done', result) }
}
```

### Utility Functions

#### `generateId(length?: number): string`
Generate a cryptographically random hex ID.
```ts
import { generateId } from '@toolcase/base'
generateId()   // '3a7f2b1c' (8 chars default)
generateId(16) // '3a7f2b1c9e4d8f01'
```

#### `getNumberInRange(value, defaultValue?, min?, max?): number`
Parse and clamp a number within a range.
```ts
import { getNumberInRange } from '@toolcase/base'
getNumberInRange('42', 0, 0, 100)  // 42
getNumberInRange('999', 0, 0, 100) // 100
```

#### `retry<T>(fn, options?): Promise<T>`
Retry an async function with exponential backoff.
```ts
import { retry } from '@toolcase/base'
const result = await retry(() => fetch('/api'), { retries: 3 })
```

#### `toHex(value: number): string`
Convert a number to a hexadecimal string.

#### `bufferToHex(buffer: Uint8Array): string`
Convert a byte array to a hex string.

#### `hexToBuffer(hex: string): Uint8Array`
Convert a hex string to a byte array.

#### `formatByteSize(bytes: number): string`
Format byte count to human-readable string (e.g. `"1.5 KB"`).

### Validation

#### `JSONSchema`
Schema-based JSON object validation.
```ts
import { JSONSchema } from '@toolcase/base'
const schema = new JSONSchema()
schema.define('name', { type: 'string', required: true })
schema.validate({ name: 'test' })
```

### Other

#### `LSystem`
Lindenmayer system for procedural generation.

#### `Color`
Material design color palette constants.

#### `HTTP` (Status, RESTError, RESTResponse)
HTTP utilities for REST APIs.

### Node.js-only

These utilities are available via the separate `@toolcase/base/node` subpath import, keeping Node-specific APIs out of the browser bundle.

#### `env(key, defaultValue?, type?): T`
Read environment variables with type coercion (supports `'string'`, `'number'`, `'boolean'`).
```ts
import { env } from '@toolcase/base/node'
const port = env('PORT', 3000, 'number')   // number
const debug = env('DEBUG', false, 'boolean') // boolean
const host = env('HOST', 'localhost')        // string
```

## License

The project is licensed under [MIT License](https://github.com/kalevski/toolcase/blob/main/LICENSE)