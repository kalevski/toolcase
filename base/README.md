# @toolcase/base

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/base?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/base)
[![npm downloads](https://img.shields.io/npm/dw/@toolcase/base?label=downloads&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/base)

🧬 A toolbox of TypeScript helper functions and data structures for everyday application code. **Zero runtime dependencies**, isomorphic (Node.js + browser), tree-shakeable, dual ESM + CJS.

## Why

Stop installing `lodash`, `nanoid`, `p-retry`, `mitt`, `lru-cache`, and a custom `EventEmitter` for every project. `@toolcase/base` bundles the small, common building blocks you keep re-implementing — typed, tested, no peer chain.

## Install

```bash
npm install @toolcase/base
```

## Import

```ts
import { Cache, retry, generateId } from '@toolcase/base'         // browser + Node
import { Packing } from '@toolcase/base'                           // sprite/atlas packing
```

---

## API

### Data structures

#### `Cache<T>(ttl: number)`
Time-based cache with automatic expiry. Use it for memoising expensive calls (DB lookups, API responses, parsed config) without pulling in a full LRU library.

```ts
import { Cache } from '@toolcase/base'

const users = new Cache<User>(60_000) // 60s TTL
users.set('u1', { id: 'u1', name: 'Ada' })
users.get('u1')   // User | null
users.has('u1')   // boolean
users.delete('u1')
users.clear()
```

#### `PriorityQueue<T>(compareFn)`
Ordered queue that dequeues the smallest item according to your comparator. Useful for job schedulers, A* `openSet`, or any "do the most important thing first" loop.

```ts
import { PriorityQueue } from '@toolcase/base'

const jobs = new PriorityQueue<Job>((a, b) => a.priority - b.priority)
jobs.enqueue({ priority: 5, name: 'flush' })
jobs.enqueue({ priority: 1, name: 'log' })
jobs.dequeue() // { priority: 1, name: 'log' }
```

#### `ObjectPool<T>(factory, reset, initialSize)`
Reuse instances instead of allocating. Handy in hot loops (game frame ticks, particle systems, websocket packet handlers) to keep GC pauses down.

```ts
import { ObjectPool } from '@toolcase/base'

const pool = new ObjectPool(
    () => ({ x: 0, y: 0 }),
    p => { p.x = 0; p.y = 0 },
    10
)

const v = pool.get()
v.x = 5
// … use it …
pool.release(v)
```

#### `State<T>(initialData)`
Plain observable state object — emits change events on property updates. Lighter than Zustand or MobX when all you need is "tell me when this changed".

```ts
import { State } from '@toolcase/base'

const state = new State({ score: 0, lives: 3 })
state.on('change', (key, value) => console.log(`${key} → ${value}`))
state.set({ score: 10 })
```

#### `AdjacencyMatrix`
Directed/undirected weighted graph. Use it for navmesh prototypes, dependency graphs, or any "what connects to what" model.

```ts
import { AdjacencyMatrix } from '@toolcase/base'

const g = new AdjacencyMatrix()
g.addVertex('A')
g.addVertex('B')
g.addEdge('A', 'B', 1)
g.getNeighbors('A')
```

#### `VectorClock`
Vector clock for distributed system causality. Useful for CRDT-style sync, multiplayer ordering, or distributed tracing.

```ts
import { VectorClock } from '@toolcase/base'

const clock = new VectorClock('node-1')
clock.increment()
clock.merge(otherClock)
```

#### `WeightedRandom<T>`
Random selection biased by per-item weights. Great for loot tables, A/B variant pickers, weighted retry strategies.

```ts
import { WeightedRandom } from '@toolcase/base'

const drops = new WeightedRandom<string>()
drops.add('common', 70)
drops.add('rare', 25)
drops.add('legendary', 5)
drops.pick() // 'common' | 'rare' | 'legendary'
```

### Events

#### `EventEmitter`
Minimal typed event emitter (no Node `events` shim, no peer deps). Drop-in for client and server.

```ts
import { EventEmitter } from '@toolcase/base'

const bus = new EventEmitter<{ ready: [string]; error: [Error] }>()
bus.on('ready', (msg) => console.log(msg))
bus.emit('ready', 'hello')
```

#### `Broadcast`
Base class — extend it to give any class pub/sub without composition boilerplate.

```ts
import { Broadcast } from '@toolcase/base'

class FileWatcher extends Broadcast<{ change: [string] }> {
    notify(path: string) { this.emit('change', path) }
}
```

### Async

#### `retry<T>(fn, options?): Promise<T>`
Retry an async function with backoff. For API calls, transient DB errors, etc.

```ts
import { retry } from '@toolcase/base'

const data = await retry(() => fetch('/api').then(r => r.json()), {
    retries: 3,
    delay: 250
})
```

### Utility functions

| Function | Description |
|----------|-------------|
| `generateId(length?)` | Cryptographically random hex ID. Default 8 chars. |
| `getNumberInRange(value, default?, min?, max?)` | Parse + clamp a number. |
| `toHex(value)` | Number → hex string. |
| `bufferToHex(buffer)` | `Uint8Array` → hex string. |
| `hexToBuffer(hex)` | Hex string → `Uint8Array`. |
| `formatByteSize(bytes)` | `1536` → `"1.5 KB"`. |

```ts
import { generateId, formatByteSize, retry } from '@toolcase/base'

generateId()                     // '3a7f2b1c'
generateId(16)                   // '3a7f2b1c9e4d8f01'
formatByteSize(1024 * 1024 * 3)  // '3.0 MB'
```

### Validation

#### `JSONSchema`
Schema-based JSON validation without Ajv-sized footprint. Define field rules, validate, get back errors.

```ts
import { JSONSchema } from '@toolcase/base'

const userSchema = new JSONSchema()
userSchema.define('email', { type: 'string', required: true })
userSchema.define('age', { type: 'number', required: false })

const result = userSchema.validate({ email: 'a@b.c', age: 30 })
```

### HTTP helpers

`HTTP.Status`, `HTTP.RESTError`, `HTTP.RESTResponse` — small primitives for building consistent REST responses across services.

```ts
import { HTTP } from '@toolcase/base'

throw new HTTP.RESTError(HTTP.Status.NOT_FOUND, 'user not found')
return new HTTP.RESTResponse(HTTP.Status.OK, { user })
```

### Sprite / rectangle packing

`Packing` — a full 2D rectangle packing toolkit (Skyline, MaxRects, Guillotine, Shelf, BinaryTree, multi-page planner, POT ceiling). Useful for **building texture atlases**, level layout, document layout, or any bin-packing problem.

```ts
import { Packing } from '@toolcase/base'

const result = Packing.Packer.pack(sprites, { algorithm: 'maxrects', pot: 'ceil' })
result.pages.forEach(page => {
    // page.width, page.height, page.placed[]
})
```

### Procedural / visual helpers

- `LSystem` — Lindenmayer system iterator for procedural generation (plants, fractals, dungeons).
- `Color` — Material design color palette constants.

---

## Common patterns

**Memoised fetch with retry:**

```ts
import { Cache, retry } from '@toolcase/base'

const cache = new Cache<Profile>(30_000)
const getProfile = (id: string) =>
    cache.get(id) ?? cache.set(id, await retry(() => api.profile(id)))
```

**Event-driven domain object:**

```ts
import { Broadcast } from '@toolcase/base'

class Cart extends Broadcast<{ added: [Item]; removed: [Item] }> {
    add(item: Item) { /* … */ this.emit('added', item) }
}
```

**Hot-loop pooling:**

```ts
const bullets = new ObjectPool(makeBullet, resetBullet, 256)

function fire() {
    const b = bullets.get()
    // … update / render …
    if (b.dead) bullets.release(b)
}
```

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)
