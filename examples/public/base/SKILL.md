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

`ms = 0` ⇒ every call re-fetches (cache always stale). Constructor throws if `fetchFn` is not a function.

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

## Notes

- Package is `sideEffects: false` — tree-shakable.
- Targets `node >= 18`; uses `globalThis.crypto` (Node 19+ exposes it globally; in Node 18 import `crypto.webcrypto` and assign).
- All public APIs are typed. Browser bundle is pure ESM/CJS dual; subpath `/node` is Node-only.
