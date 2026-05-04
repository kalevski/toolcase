---
name: base
description: Use when reaching for @toolcase/base — zero-dep TypeScript helpers + data structures (Cache, PriorityQueue, VectorClock, State, AdjacencyMatrix, ObjectPool), events (EventEmitter, Broadcast), utilities (generateId, retry, hex/byte/range helpers), JSONSchema validation, LSystem, Color palette, HTTP REST primitives, and the Node-only env() loader.
---

# base — API Reference

Zero-dependency TypeScript helpers and data structures. Isomorphic (Node + browser). Single import:

```ts
import {
    HTTP, // { Status, RESTError, RESTResponse }
    VectorClock, EventEmitter, Broadcast,
    LSystem, ObjectPool, PriorityQueue,
    generateId, toHex, formatByteSize,
    bufferToHex, hexToBuffer,
    Color, JSONSchema, getNumberInRange,
    Cache, AdjacencyMatrix, State, retry
} from '@toolcase/base'
```

Node-only subpath:

```ts
import { env } from '@toolcase/base/node'
```

---

## Table of Contents

- [Data Structures](#data-structures)
  - [Cache](#cache)
  - [PriorityQueue](#priorityqueue)
  - [VectorClock](#vectorclock)
  - [State](#state)
  - [AdjacencyMatrix](#adjacencymatrix)
  - [ObjectPool](#objectpool)
  - [WeightedRandom](#weightedrandom)
- [Events](#events)
  - [EventEmitter](#eventemitter)
  - [Broadcast](#broadcast)
- [Utilities](#utilities)
  - [generateId](#generateid)
  - [getNumberInRange](#getnumberinrange)
  - [retry](#retry)
  - [toHex / bufferToHex / hexToBuffer](#hex-helpers)
  - [formatByteSize](#formatbytesize)
- [Validation](#validation)
  - [JSONSchema](#jsonschema)
- [Other](#other)
  - [LSystem](#lsystem)
  - [Color](#color)
- [HTTP](#http)
  - [Status](#status)
  - [RESTError](#resterror)
  - [RESTResponse](#restresponse)
- [Node-only](#node-only)
  - [env](#env)

---

## Data Structures

### Cache

Async memoization with TTL. Key is JSON-stringified args.

```ts
new Cache<T>(fetchFn: (...args: any[]) => T | Promise<T>, ms: number = 0)
```

- `get(...args): Promise<T | null>` — returns cached value if `now <= fetchedAt + ms`, else calls `fetchFn(...args)`, stores, returns.
- `setMS(ms: number)` — change TTL window.
- `invalidate(...args)` — drop one entry by argument hash.

```ts
const userCache = new Cache(async (id: string) => fetchUser(id), 60_000)
const u = await userCache.get('42')
userCache.invalidate('42')
```

`ms = 0` ⇒ effectively no caching across millisecond boundaries (entries expire when `now > fetchedAt`). Two calls within the same millisecond still share a result; in practice this means each call re-fetches. Use `setMS(0)` to force-stale a cache; use `invalidate(...args)` to drop a single entry. Constructor throws if `fetchFn` is not a function.

### PriorityQueue

Min-heap. Smallest priority dequeues first.

```ts
new PriorityQueue<T>(priorityFn: (node: T) => number, uniqueFn?: (node: T) => string | null)
```

- `length: number` — read-only count.
- `enqueue(value: T): true` — throws if `value === undefined`.
- `dequeue(): T | null` — remove + return root (lowest priority).
- `pop(): T | null` — remove last raw element (no heap restoration).
- `has(value: T): boolean | null` — only when `uniqueFn` provided; else `null`.

```ts
const pq = new PriorityQueue<{ id: string, weight: number }>(n => n.weight, n => n.id)
pq.enqueue({ id: 'a', weight: 5 })
pq.enqueue({ id: 'b', weight: 1 })
pq.dequeue() // { id: 'b', weight: 1 }
```

### VectorClock

Distributed-systems clock for causality tracking.

```ts
new VectorClock(nodeId: string, data?: Record<string, number>)
```

Instance:
- `setClock(clock)` / `getClock(): Record<string, number>` (copy).
- `setVersion(version, nodeId = this.nodeId)` / `getVersion(nodeId = this.nodeId): number`.
- `increment()` — bump own node.
- `update(other: VectorClock)` — pairwise max over union of node ids.
- `isAfter(other) / isConcurrent(other) / isBefore(other): boolean`.

Static:
- `VectorClock.getNodeIds(a, b): string[]`
- `VectorClock.isAfter(a, b) / isConcurrent(a, b) / isBefore(a, b): boolean`
- `VectorClock.compare(a, b): 1 | 0 | -1` — after / concurrent / before.

```ts
const a = new VectorClock('node-a'); a.increment()
const b = new VectorClock('node-b'); b.update(a); b.increment()
b.isAfter(a) // true
```

### State

Observable state (extends `Broadcast`). Deep-merge `set()` emits dotted-path events.

```ts
new State<T extends Record<string, any>>(data: Partial<T> = {})
```

- `get(): Partial<T>` — current data.
- `set(data: Partial<T>, emit = true): this` — deep-merge; throws on type mismatch between existing object/primitive vs incoming.
- `empty(emit = true): this` — wipe.

Events emitted on every nested key path: top-level event is `'state'`, then per property `'state.x'`, `'state.x.y'`, etc.

```ts
const state = new State({ player: { score: 0 } })
state.on('state.player.score', score => console.log(score))
state.set({ player: { score: 10 } }) // logs 10
```

### AdjacencyMatrix

Graph as `vertices[]` + `(P | N)[][]` matrix. Default `P = true`, `N = false`; pass typed defaults to store edge metadata.

```ts
new AdjacencyMatrix<P = boolean, N = boolean>(defaultPositive?: P, defaultNegative?: N)
```

- `vertices: string[]` (read-only).
- `addVertex(name): boolean` — false if exists.
- `removeVertex(name): boolean`.
- `addEdge(a, b, value = defaultPositive): boolean` — directed; false if either vertex missing.
- `removeEdge(a, b): boolean`.
- `getEdge(a, b): P | N` — defaults to `defaultNegative` when missing.
- `getEdges(vertex): string[]` — outgoing neighbors (where edge ≠ `defaultNegative`).
- `hasEdge(a, b): boolean`.

Weighted graph:

```ts
const g = new AdjacencyMatrix<number, null>(1, null)
g.addVertex('A'); g.addVertex('B')
g.addEdge('A', 'B', 7)
g.getEdge('A', 'B') // 7
```

### ObjectPool

Reuses class instances. Pool stores released instances; auto-creates on demand.

```ts
new ObjectPool<T>(
    objectClass: new () => T,
    resetFn?: (object: T) => void,
    instanceFn?: (Class: new () => T) => T
)
```

- `instances: number` — total instances ever created.
- `obtain(): T` — pop existing or create new. Each instance is auto-augmented with a `release()` method bound to the pool. Throws if the object already defines `release`.
- `release(object: T): this` — calls `resetFn`, returns to pool.
- `dispose()` — clear pool (does not destroy outstanding instances).

```ts
class Bullet { x = 0; y = 0 }
const pool = new ObjectPool(Bullet, b => { b.x = 0; b.y = 0 })
const b = pool.obtain()
b.release() // returns to pool
```

### WeightedRandom

Weighted random selection with O(log n) picks. Builds a cumulative-weight table once and binary-searches a uniform random sample on each pick.

```ts
new WeightedRandom<T>(
    items: Iterable<T>,
    weightFn: (item: T) => number,
    random: () => number = Math.random
)
```

- `length: number` — items kept (zero-weight items are dropped at construction).
- `totalWeight: number` — sum of positive weights.
- `pick(): T` — single weighted draw.
- `pickMany(count: number): T[]` — `count` independent draws (with replacement). Throws if `count` is not a non-negative integer.
- `probabilityOf(predicate: (item: T) => boolean): number` — share of total weight matching the predicate, in `[0, 1]`.

Constructor throws when `weightFn`/`random` are not functions, when any weight is negative or non-finite (`Infinity`/`NaN`), or when no item has a positive weight. Items with `weight === 0` are silently skipped.

```ts
const loot = new WeightedRandom(
    [
        { id: 'common', weight: 70 },
        { id: 'rare',   weight: 25 },
        { id: 'epic',   weight: 5  }
    ],
    (entry) => entry.weight
)

loot.pick().id            // probably 'common'
loot.pickMany(3)          // 3 independent draws
loot.probabilityOf(e => e.id === 'epic') // 0.05
```

Pass a seeded `random` for deterministic tests:

```ts
let s = 1
const seeded = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296 }
const wr = new WeightedRandom(['a', 'b'], (k) => k === 'a' ? 1 : 9, seeded)
```

---

## Events

### EventEmitter

Minimal typed emitter. Vendored — zero deps.

```ts
import { EventEmitter } from '@toolcase/base'
const ee = new EventEmitter()
ee.on(event, fn, context?)
ee.once(event, fn, context?)
ee.off(event, fn?, context?) // omit fn ⇒ remove all listeners for event
ee.emit(event, ...args): boolean
ee.removeAllListeners(event?): this
ee.listenerCount(event): number
ee.eventNames(): (string | symbol)[]
```

`event` is `string | symbol`. `context` defaults to the emitter itself.

### Broadcast

Base class wrapping `EventEmitter` with a **protected** `emit()` — extend it to expose only `on/off/once` to consumers while keeping emission internal.

```ts
class Service extends Broadcast {
    doWork() {
        this.emit('done', { ok: true })
    }
}
```

Public surface mirrors `EventEmitter` (`on/off/once/removeAllListeners/listenerCount/eventNames`).

---

## Utilities

### generateId

Crypto-random hex id.

```ts
generateId(length: number = 8): string
```

Uses `globalThis.crypto.getRandomValues`. `length` is the **string** length (rounded up to whole bytes internally, sliced).

### getNumberInRange

Parse-then-clamp.

```ts
getNumberInRange(value: string | number, defaultValue = 0, min = MIN_SAFE_INTEGER, max = MAX_SAFE_INTEGER): number
```

`parseInt(value, 10)` for strings; `NaN` ⇒ `defaultValue`. Result clamped via `min/max`.

### retry

Exponential-backoff retry for sync or async functions.

```ts
retry<T>(fn: () => T | Promise<T>, options?: Partial<RetryOptions>): Promise<T>

interface RetryOptions {
    retries: number    // default 3 (additional attempts after first)
    factor: number     // default 2 (clamped to ≥ 1)
    minTimeout: number // default 1000 ms
    maxTimeout: number // default Infinity
    randomize: boolean // default false; if true multiplies wait by [1, 2)
}
```

Wait between attempt N and N+1: `min(random * minTimeout * factor^(N-1), maxTimeout)`. Throws final error after `retries` exhausted. Throws synchronously if `minTimeout > maxTimeout`.

### Hex helpers

```ts
toHex(value: number, digits: number = 4): string
// → zero-padded from the right; 4-digit default. e.g. toHex(255) → "00ff"

bufferToHex(buffer: Uint8Array): string
// → contiguous lowercase hex string

hexToBuffer(hex: string): Uint8Array
// → expects even-length hex string; pairs every 2 chars
```

### formatByteSize

```ts
formatByteSize(bytes: number, decimals: number = 2): string
```

Returns `'0 Bytes'` when `bytes === 0`. Powers of 1024: `Bytes / KB / MB / GB / TB / PB / EB / ZB / YB`.

```ts
formatByteSize(1536) // "1.5 KB"
```

---

## Validation

### JSONSchema

Schema-driven validator. Throws on first violation.

```ts
new JSONSchema(schema: Schema)

interface Schema {
    type: string                          // built-ins: string|number|boolean|object|array|email|username|password|url
    required?: boolean
    properties?: Record<string, Schema>   // for type: 'object'
    items?: Partial<Schema>               // for type: 'array'
    flexible?: boolean                    // for type: 'object'; allow extra keys
}
```

- `validate(data): void` — throws `Error` with `property=...` context on failure.
- `register(type, validationFn)` — add custom type. Throws if type already registered. `validationFn(propertyName, schema, data)`.

Built-in regex validators:
- `email` — RFC-ish email regex
- `username` — `^[A-z][A-z0-9-_]{3,23}$`
- `password` — must contain lower + upper + digit + one of `!@#$%`, length 8–24
- `url` — `https?://...`

Object semantics:
- `flexible: false` (default) ⇒ unknown properties throw.
- Children defined with `required: false` may be omitted.

```ts
const schema = new JSONSchema({
    type: 'object',
    properties: {
        name: { type: 'string', required: true },
        age:  { type: 'number', required: false },
        tags: { type: 'array', items: { type: 'string' } }
    }
})
schema.validate({ name: 'a', tags: ['x'] })
```

---

## Other

### LSystem

Lindenmayer system for procedural string rewriting.

```ts
new LSystem({ axiom: string, rules: Record<string, string> })
```

- `state: string` (read-only; current sequence — initialized to `axiom`).
- `iteration: number` (read-only).
- `iterate(): string` — apply rules once, return new state. Symbols absent from `rules` pass through unchanged.

```ts
const ls = new LSystem({ axiom: 'A', rules: { A: 'AB', B: 'A' } })
ls.iterate() // 'AB'
ls.iterate() // 'ABA'
```

### Color

Material-design palette + helpers. Exported as a single object.

Static palette (uppercase keys, hex strings): `RED PINK PURPLE DEEP_PURPLE INDIGO BLUE LIGHT_BLUE CYAN TEAL GREEN LIGHT_GREEN LIME YELLOW AMBER ORANGE DEEP_ORANGE`.

- `Color.getHex(name): string | null` — name is lowercased palette key (e.g. `'red'`, `'deep_purple'`); returns `null` if unknown.
- `Color.toNumber(name): number` — hex parsed as integer (`0` if unknown).
- `Color.getRandomHex(): string` — random palette entry.

```ts
Color.getHex('teal')         // '#009688'
Color.toNumber('blue')       // 2201331
```

---

## HTTP

Grouped under `HTTP = { Status, RESTError, RESTResponse }`. Lightweight REST primitives — no transport included.

### Status

Object of status-code constants (e.g. `Status.OK = 200`, `Status.NOT_FOUND = 404`, `Status.INTERNAL_SERVER_ERROR = 500`). All standard 1xx–5xx codes covered, JSDoc-annotated. Includes typo `PARCIAL_CONTENT` (= 206) — preserve when matching by code.

### RESTError

```ts
class RESTError extends Error {
    readonly status: number
    constructor(status: number, message: string)
    toJSON(): { status: 'rejected', cause: string }
}

RESTError.notFound(message?)            // 404
RESTError.notImplemented(message?)      // 501
RESTError.internalServerError(message?) // 500
```

### RESTResponse

```ts
class RESTResponse<T = any> {
    readonly status: number
    readonly data: T
    readonly count: number | undefined  // omitted from JSON if not provided
    constructor(status: number, data: T, count: number | null = null)
    toJSON(): { status: 'OK', count?: number, data: T }
}
```

```ts
return new HTTP.RESTResponse(HTTP.Status.OK, users, users.length)
```

---

## Node-only

### env

Typed env-var reader. Subpath import: `@toolcase/base/node`.

```ts
env<T>(key: string, defaultValue?: T, type: 'string' | 'number' | 'boolean' = 'string'): T
```

- `'number'` — `parseInt(v, 10)`; falls back to `defaultValue` if the parsed integer's string form ≠ original.
- `'boolean'` — case-insensitive `'true' | 'false'`; otherwise `defaultValue`.
- `'string'` — passes through; `defaultValue` if undefined.

Throws `'env works only with NodeJS'` if `globalThis.process` is undefined. Keep this import out of browser bundles.

```ts
import { env } from '@toolcase/base/node'
const port  = env('PORT', 3000, 'number')
const debug = env('DEBUG', false, 'boolean')
```

---

## Recipes

End-to-end examples that combine multiple primitives.

### Cached + retried HTTP fetch

```ts
import { Cache, retry, HTTP } from '@toolcase/base'

const userCache = new Cache(async (id: string) => {
    return retry(async () => {
        const r = await fetch(`/api/users/${id}`)
        if (!r.ok) throw new HTTP.RESTError(r.status, `users/${id} ${r.statusText}`)
        return r.json()
    }, { retries: 4, minTimeout: 250, factor: 2, maxTimeout: 4000 })
}, 60_000)

const user = await userCache.get('42')
```

### Observable game state with `State` + `EventEmitter`

```ts
import { State } from '@toolcase/base'

const game = new State<{ score: number, lives: number }>({ score: 0, lives: 3 })
game.on('state.score', s => updateHUD('score', s))
game.on('state.lives', l => l <= 0 && gameOver())

game.set({ score: 100 })  // fires 'state.score'
game.set({ lives: 2 })    // fires 'state.lives'
```

### Throttled work via `PriorityQueue` + `retry`

```ts
import { PriorityQueue, retry } from '@toolcase/base'

interface Job { id: string, run: () => Promise<void>, weight: number }

const jobs = new PriorityQueue<Job>(j => j.weight, j => j.id)

async function pump() {
    const job = jobs.dequeue()
    if (job === null) return
    await retry(job.run, { retries: 3 })
    return pump()
}

jobs.enqueue({ id: 'a', weight: 1, run: () => sendBeacon() })
jobs.enqueue({ id: 'b', weight: 5, run: () => uploadCrash() })
pump()
```

### Distributed counter with `VectorClock`

```ts
import { VectorClock } from '@toolcase/base'

const a = new VectorClock('node-a')
const b = new VectorClock('node-b')

a.increment()           // a saw event
b.update(a)             // b learns of a
b.increment()           // b adds its own
VectorClock.compare(a, b)  // -1  → a is before b
VectorClock.compare(b, a)  //  1  → b is after a
```

### LSystem-driven procedural map seed

```ts
import { LSystem } from '@toolcase/base'

const ls = new LSystem({
    axiom: 'F',
    rules: { F: 'F[+F]F[-F]F' }   // branching tree
})
for (let i = 0; i < 4; i++) ls.iterate()
drawTurtle(ls.state)
```

### Build a REST handler with `RESTResponse` / `RESTError`

```ts
import { HTTP } from '@toolcase/base'

async function handler(req: Request) {
    try {
        const data = await getData(req)
        return Response.json(new HTTP.RESTResponse(HTTP.Status.OK, data, data.length))
    } catch (err) {
        if (err instanceof HTTP.RESTError) {
            return Response.json(err, { status: err.status })
        }
        const fallback = HTTP.RESTError.internalServerError(err.message)
        return Response.json(fallback, { status: fallback.status })
    }
}
```

`RESTResponse.toJSON()` always emits `status: 'OK'`; `RESTError.toJSON()` emits `status: 'rejected'` plus `cause`. Pair with `JSONSchema` on the request side:

```ts
import { JSONSchema, HTTP } from '@toolcase/base'

const createUser = new JSONSchema({
    type: 'object',
    properties: {
        email: { type: 'email', required: true },
        password: { type: 'password', required: true }
    }
})

async function POST(req: Request) {
    try { createUser.validate(await req.json()) }
    catch (err: any) {
        const e = new HTTP.RESTError(HTTP.Status.BAD_REQUEST, err.message)
        return Response.json(e, { status: e.status })
    }
    /* ... */
}
```

### Frame budgeting with `getNumberInRange` + `formatByteSize`

```ts
import { getNumberInRange, formatByteSize } from '@toolcase/base'

const fps = getNumberInRange(query.get('fps') ?? '60', 60, 15, 240)
console.log(`bandwidth budget: ${formatByteSize(fps * 1024)}/sec`)  // e.g. "60 KB/sec"
```

### `ObjectPool` for bullets / particles

```ts
import { ObjectPool } from '@toolcase/base'

class Particle {
    x = 0; y = 0; vx = 0; vy = 0; life = 0
    update(dt: number) { this.x += this.vx * dt; this.y += this.vy * dt; this.life -= dt }
}

const pool = new ObjectPool(Particle, p => { p.x = p.y = p.vx = p.vy = p.life = 0 })

function spawn(x: number, y: number) {
    const p = pool.obtain()
    p.x = x; p.y = y; p.vx = Math.random() * 2 - 1; p.vy = -1; p.life = 1
    return p
}

function tick(dt: number, list: Particle[]) {
    for (const p of list) {
        p.update(dt)
        if (p.life <= 0) (p as any).release()  // pool wires release() onto each instance
    }
}
```

### Color palette for tagging

```ts
import { Color } from '@toolcase/base'

const TAG_COLORS = ['red', 'blue', 'green', 'amber', 'purple']

function tagColor(name: string): string {
    const i = [...name].reduce((a, c) => a + c.charCodeAt(0), 0) % TAG_COLORS.length
    return Color.getHex(TAG_COLORS[i]) ?? '#888'
}
```

### Graph traversal with `AdjacencyMatrix`

```ts
import { AdjacencyMatrix } from '@toolcase/base'

const g = new AdjacencyMatrix<number, null>(1, null)
;['A', 'B', 'C', 'D'].forEach(v => g.addVertex(v))
g.addEdge('A', 'B', 2)
g.addEdge('B', 'C', 5)
g.addEdge('A', 'C', 9)
g.addEdge('C', 'D', 1)

// Naive BFS
function shortestHops(start: string, end: string): string[] | null {
    const visited = new Set<string>([start])
    const queue: { node: string, path: string[] }[] = [{ node: start, path: [start] }]
    while (queue.length > 0) {
        const { node, path } = queue.shift()!
        if (node === end) return path
        for (const next of g.getEdges(node)) {
            if (!visited.has(next)) {
                visited.add(next)
                queue.push({ node: next, path: [...path, next] })
            }
        }
    }
    return null
}

shortestHops('A', 'D') // ['A', 'B', 'C', 'D']  (or via 'A' → 'C' → 'D' depending on order)
```

### Hex helpers — cryptographic ids

```ts
import { generateId, bufferToHex, hexToBuffer } from '@toolcase/base'

const sessionId = generateId(32)               // 32-char hex
const bytes = hexToBuffer(sessionId)           // back to Uint8Array
const roundTrip = bufferToHex(bytes) === sessionId
```

### Env-driven config (Node)

```ts
import { env } from '@toolcase/base/node'
import { LoggerFactory, ConsoleLogReporter } from '@toolcase/logging'

const factory = new LoggerFactory([new ConsoleLogReporter()])
factory.level = env('LOG_LEVEL', 'info') as any
const port    = env('PORT', 3000, 'number')
const debug   = env('DEBUG', false, 'boolean')
```

---

## Notes

- Package is `sideEffects: false` — tree-shakable.
- Targets `node >= 18`; uses `globalThis.crypto` (Node 19+ exposes it globally; in Node 18 import `crypto.webcrypto` and assign).
- All public APIs are typed. Browser bundle is pure ESM/CJS dual; subpath `/node` is Node-only.
