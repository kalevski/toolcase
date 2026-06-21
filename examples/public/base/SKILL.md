---
name: base
description: Use when reaching for @toolcase/base — zero-dep TypeScript helpers + data structures (Cache, PriorityQueue, RingBuffer, Stack, Deque, VectorClock, State, AdjacencyMatrix, ObjectPool, WeightedRandom, BiMap, MultiMap), events (EventEmitter, Broadcast), pathfinding (Dijkstra, AStar — class-based, step()-controlled, event-emitting), rectangle/atlas packing (Packing.Packer + MaxRects/Guillotine/Shelf/Skyline/BinaryTree algorithms, multi-page, POT, trim/extrude), spatial partitioning (Spatial.SpatialHash grid + Spatial.Quadtree — insert/remove/update/range-query/nearest-neighbour), async utilities (Deferred, Semaphore, Mutex, pLimit, withTimeout, sleep, debounce, throttle, AsyncQueue — backpressure-aware producer/consumer channel), utilities (generateId, retry, hex/byte/range helpers), JSONSchema validation, LSystem, Color palette, and HTTP REST primitives.
---

# base — API Reference

Zero-dependency TypeScript helpers and data structures. Isomorphic (Node + browser). Single import:

```ts
import {
    HTTP,     // { Status, RESTError, RESTResponse }
    Packing,  // { Packer, MaxRects, Guillotine, Shelf, Skyline, BinaryTree, MultiPagePlanner, Sorter, Trimmer, Rotator, Algorithm, potCeil }
    Spatial,  // { SpatialHash, Quadtree }
    Async,    // { Deferred, Semaphore, Mutex, pLimit, withTimeout, sleep, debounce, throttle, AsyncQueue }
    VectorClock, EventEmitter, Broadcast,
    LSystem, ObjectPool, PriorityQueue, RingBuffer, Stack, Deque,
    generateId, ulid, toHex, formatByteSize,
    bufferToHex, hexToBuffer,
    Color, JSONSchema, getNumberInRange,
    Cache, AdjacencyMatrix, State, retry,
    WeightedRandom, Dijkstra, AStar,
    DisjointSet, Trie,
    BiMap, MultiMap
} from '@toolcase/base'
```

---

## Table of Contents

- [Data Structures](#data-structures)
  - [Cache](#cache)
  - [PriorityQueue](#priorityqueue)
  - [RingBuffer](#ringbuffer)
  - [Stack](#stack)
  - [Deque](#deque)
  - [VectorClock](#vectorclock)
  - [State](#state)
  - [AdjacencyMatrix](#adjacencymatrix)
  - [ObjectPool](#objectpool)
  - [WeightedRandom](#weightedrandom)
  - [DisjointSet](#disjointset)
  - [Trie](#trie)
  - [BiMap](#bimap)
  - [MultiMap](#multimap)
- [Events](#events)
  - [EventEmitter](#eventemitter)
  - [Broadcast](#broadcast)
- [Pathfinding](#pathfinding)
  - [Dijkstra](#dijkstra)
  - [AStar](#astar)
- [Utilities](#utilities)
  - [generateId](#generateid)
  - [ulid](#ulid)
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
- [Packing](#packing)
  - [Packer](#packer)
  - [Algorithms](#algorithms)
  - [Helpers (Trimmer / Sorter / Rotator / MultiPagePlanner / potCeil)](#packing-helpers)
- [Spatial](#spatial)
  - [SpatialHash](#spatialhash)
  - [Quadtree](#quadtree)
- [Async](#async)
  - [Deferred](#deferred)
  - [Semaphore](#semaphore)
  - [Mutex](#mutex)
  - [pLimit](#plimit)
  - [withTimeout](#withtimeout)
  - [sleep](#sleep)
  - [debounce](#debounce)
  - [throttle](#throttle)
  - [AsyncQueue](#asyncqueue)

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
new PriorityQueue<T>(priorityFn: (node: T) => number, uniqueFn?: (node: T) => string)
```

- `length: number` — read-only count.
- `enqueue(value: T): boolean` — returns `true`; throws if `value === undefined`.
- `dequeue(): T | null` — remove + return root (lowest priority).
- `pop(): T | null` — remove last raw element (no heap restoration).
- `has(value: T): boolean | null` — only when `uniqueFn` provided; else `null`.

```ts
const pq = new PriorityQueue<{ id: string, weight: number }>(n => n.weight, n => n.id)
pq.enqueue({ id: 'a', weight: 5 })
pq.enqueue({ id: 'b', weight: 1 })
pq.dequeue() // { id: 'b', weight: 1 }
```

### RingBuffer

Fixed-capacity circular buffer. Oldest entry is overwritten when the buffer is full. Zero allocations after construction.

```ts
new RingBuffer<T>(capacity: number)
```

- `capacity: number` — (readonly) maximum number of items.
- `size: number` — current item count.
- `push(item: T): this` — append an item; overwrites the oldest when full. Throws if `item === undefined`. Chainable.
- `peek(): T | null` — the oldest item without removing it; `null` when empty.
- `tail(n: number): T[]` — the last `n` items in insertion order (newest last); clamped to `size`. Returns `[]` when `n <= 0` or buffer is empty.
- `clear(): this` — reset to empty; capacity is preserved.
- `[Symbol.iterator]` — iterate all items in insertion order (oldest → newest).

Constructor throws if `capacity` is not a positive integer.

```ts
import { RingBuffer } from '@toolcase/base'

const rb = new RingBuffer<number>(3)
rb.push(1).push(2).push(3)
rb.peek()        // 1 (oldest)
rb.tail(2)       // [2, 3]
[...rb]          // [1, 2, 3]

rb.push(4)       // overwrites 1
rb.peek()        // 2
[...rb]          // [2, 3, 4]

rb.clear()
rb.size          // 0
```

### Stack

LIFO stack backed by a plain array.

```ts
new Stack<T>()
```

- `size: number` — current item count.
- `push(item: T): this` — push to the top. Throws if `item === undefined`. Chainable.
- `pop(): T | null` — remove and return the top item; `null` when empty.
- `peek(): T | null` — top item without removing it; `null` when empty.
- `isEmpty(): boolean` — true when `size === 0`.
- `clear(): this` — reset to empty. Chainable.
- `[Symbol.iterator]` — iterate all items in insertion order (bottom → top).

```ts
import { Stack } from '@toolcase/base'

const history = new Stack<string>()
history.push('login').push('dashboard').push('settings')

history.peek()   // 'settings'  (top, not removed)
history.pop()    // 'settings'
history.size     // 2
[...history]     // ['login', 'dashboard']  (insertion order)
history.clear()
history.isEmpty() // true
```

### Deque

Double-ended queue backed by a doubly-linked list. O(1) push and pop at both ends.

```ts
new Deque<T>()
```

- `size: number` — current item count.
- `pushFront(item: T): this` — insert at the front. Throws if `item === undefined`. Chainable.
- `pushBack(item: T): this` — insert at the back. Throws if `item === undefined`. Chainable.
- `popFront(): T | null` — remove and return the front item; `null` when empty.
- `popBack(): T | null` — remove and return the back item; `null` when empty.
- `peekFront(): T | null` — front item without removing it; `null` when empty.
- `peekBack(): T | null` — back item without removing it; `null` when empty.
- `isEmpty(): boolean` — true when `size === 0`.
- `clear(): this` — reset to empty. Chainable.
- `[Symbol.iterator]` — iterate all items front to back.

```ts
import { Deque } from '@toolcase/base'

const d = new Deque<number>()
d.pushBack(2).pushBack(3).pushFront(1)

d.peekFront()  // 1
d.peekBack()   // 3
[...d]         // [1, 2, 3]

d.popFront()   // 1
d.popBack()    // 3
d.size         // 1

d.clear()
d.isEmpty()    // true
```

Use as a FIFO queue: `pushBack` + `popFront`. Use as a LIFO stack: `pushBack` + `popBack` (or `pushFront` + `popFront`). Sliding-window algorithms use both ends simultaneously.

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

### DisjointSet

Union-Find with path compression and union-by-rank. Tracks disjoint sets identified by string keys.

```ts
new DisjointSet()
```

- `count: number` — (readonly getter) number of disjoint sets currently tracked.
- `makeSet(id: string): this` — register `id` as a new singleton set. No-op if `id` already exists. Chainable.
- `find(id: string): string | null` — return the representative (root) of the set containing `id`; `null` if `id` was never registered. Applies path compression on every call.
- `union(a: string, b: string): boolean` — merge the sets containing `a` and `b`. Returns `true` if they were in different sets (a merge happened), `false` if they were already in the same set or either id is unknown.
- `connected(a: string, b: string): boolean` — `true` if `a` and `b` share a representative (same set); `false` otherwise or if either is unknown.

```ts
import { DisjointSet } from '@toolcase/base'

const ds = new DisjointSet()

ds.makeSet('a').makeSet('b').makeSet('c').makeSet('d')
ds.count           // 4

ds.union('a', 'b') // true  — merged
ds.union('c', 'd') // true  — merged
ds.count           // 2

ds.union('a', 'c') // true  — one group now
ds.count           // 1

ds.connected('b', 'd') // true
ds.connected('a', 'z') // false (z unknown)
ds.find('b')           // same root as find('d')
```

### Trie

Prefix tree for O(m) insert, lookup, and delete (m = word length) and O(m + k) prefix enumeration (k = number of matches).

```ts
new Trie()
```

- `size: number` — number of distinct words currently stored.
- `insert(word: string): this` — add `word` to the trie. No-op if already present. Chainable.
- `has(word: string): boolean` — `true` only when `word` was inserted and not deleted (exact match, not prefix match).
- `delete(word: string): boolean` — remove `word`; returns `true` if it existed, `false` otherwise. Prunes nodes that are no longer on any other path.
- `startsWith(prefix: string): string[]` — all inserted words that begin with `prefix` (including `prefix` itself if it was inserted). Empty prefix returns every word. Returns `[]` when no match exists.
- `clear(): this` — remove all words. Chainable.

```ts
import { Trie } from '@toolcase/base'

const t = new Trie()
t.insert('apple').insert('app').insert('application').insert('apt')

t.has('apple')          // true
t.has('app')            // true
t.has('ap')             // false — not a terminal word

t.startsWith('app')     // ['app', 'apple', 'application'] (order unspecified)
t.startsWith('apt')     // ['apt']
t.startsWith('xyz')     // []
t.startsWith('')        // all four words

t.delete('app')
t.has('app')            // false
t.has('apple')          // true  — sharing prefix is unaffected
t.size                  // 3
```

### BiMap

Bidirectional map enforcing a strict 1-to-1 (bijective) relationship between keys and values. Both directions are stored as `Map`s, so all lookups are O(1). Assigning a key to a new value (or a value to a new key) automatically displaces the existing pair.

```ts
new BiMap<K, V>()
```

- `size: number` — number of key-value pairs.
- `set(key: K, value: V): this` — insert or replace the pair. If `value` was already mapped to a different key, that old key is removed. If `key` was already mapped to a different value, that old value is removed. Chainable.
- `get(key: K): V | null` — forward lookup; `null` when key not present.
- `getKey(value: V): K | null` — reverse lookup; `null` when value not present.
- `has(key: K): boolean` — `true` when key exists.
- `hasValue(value: V): boolean` — `true` when value exists.
- `delete(key: K): boolean` — remove the pair by key; `true` if found.
- `deleteByValue(value: V): boolean` — remove the pair by value; `true` if found.
- `clear(): this` — remove all pairs. Chainable.
- `[Symbol.iterator]` — iterate `[K, V]` pairs in insertion order.

```ts
import { BiMap } from '@toolcase/base'

const ports = new BiMap<string, number>()
ports.set('http', 80).set('https', 443).set('ftp', 21)

ports.get('https')       // 443
ports.getKey(80)         // 'http'
ports.hasValue(443)      // true

// Reassigning a value auto-removes the old key
ports.set('alt-http', 80)
ports.has('http')        // false
ports.getKey(80)         // 'alt-http'
ports.size               // 3

ports.delete('ftp')
ports.size               // 2

for (const [svc, port] of ports) {
    console.log(svc, '->', port)
}
```

### MultiMap

Maps each key to a `Set` of values. `size` counts total values across all keys. Adding the same key-value pair twice is a no-op (set semantics per key). Supports per-value removal or bulk removal of all values under a key.

```ts
new MultiMap<K, V>()
```

- `size: number` — total number of values across all keys.
- `set(key: K, value: V): this` — add `value` to the set under `key`. No-op if the pair already exists. Chainable.
- `get(key: K): ReadonlySet<V> | undefined` — the set of values under `key`; `undefined` when key not present.
- `has(key: K, value?: V): boolean` — with only `key`: `true` when any values exist under it. With `value`: `true` when that specific pair exists.
- `delete(key: K, value?: V): boolean` — with only `key`: remove all values under it (returns `true` if key existed). With `value`: remove that specific value (returns `true` if found; removes the key when its set becomes empty).
- `keys(): IterableIterator<K>` — iterate all keys that have at least one value.
- `clear(): this` — remove all entries. Chainable.
- `[Symbol.iterator]` — iterate `[K, ReadonlySet<V>]` pairs.

```ts
import { MultiMap } from '@toolcase/base'

const tags = new MultiMap<string, string>()
tags.set('post:1', 'typescript').set('post:1', 'react')
tags.set('post:2', 'typescript').set('post:2', 'css')

tags.size                          // 4
tags.get('post:1')                 // Set { 'typescript', 'react' }
tags.has('post:1', 'react')        // true
tags.has('post:1', 'vue')          // false

tags.delete('post:1', 'react')
tags.get('post:1')                 // Set { 'typescript' }
tags.size                          // 3

tags.delete('post:2')
tags.has('post:2')                 // false
tags.size                          // 1

for (const [postId, tagSet] of tags) {
    console.log(postId, [...tagSet])
}
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

## Pathfinding

Two graph-search **classes** that work on any caller-supplied graph adapter (no coupling to `AdjacencyMatrix`). Pass a `neighbors` iterable + a `cost` function; for `AStar`, also a `heuristic`. Non-string nodes need a `hash` to deduplicate visits.

Both extend `EventEmitter`, expose a manual `step()` for cooperative scheduling (one expansion per call — game loops, web workers, time-budgeted ticks), and emit lifecycle events. `AStar extends Dijkstra` — same surface plus the heuristic. Both reuse `PriorityQueue` internally; costs must be non-negative and finite.

```ts
type Neighbors<N> = (node: N) => Iterable<N>
type EdgeCost<N>  = (from: N, to: N) => number
type NodeHash<N>  = (node: N) => string

interface PathResult<N> {
    path: N[]
    cost: number
}

type SearchStatus = 'searching' | 'found' | 'failed'
type FailReason   = 'exhausted' | 'max_iterations'
```

### Shared API

| Member | Description |
|---|---|
| `start: N` / `end: N` | (readonly) inputs |
| `iterations: number` | nodes visited so far |
| `maxIterations: number` | cap; default `Infinity`. Set to bound work per query |
| `isComplete: boolean` | true once status is `found` or `failed` |
| `getStatus(): SearchStatus` | current state |
| `step(): SearchStatus` | run one expansion; returns new status |
| `run(maxSteps?): PathResult<N> \| null` | step until complete or `maxSteps` reached |
| `getResult(): PathResult<N> \| null` | final path (only after `'found'`) |

### Events (mirrored on both classes)

| Constant | Payload | Fires |
|---|---|---|
| `Dijkstra.VISIT` | `(node, gCost)` | each time a node is popped from the frontier |
| `Dijkstra.OPEN` | `(node, gCost)` | each time a neighbor is enqueued or its cost improved |
| `Dijkstra.FOUND` | `(PathResult)` | once, when goal reached |
| `Dijkstra.FAILED` | `(FailReason)` | once, when frontier exhausts or `maxIterations` exceeded |

`AStar.FOUND === Dijkstra.FOUND`, etc. Listeners subscribe via `.on(Dijkstra.FOUND, fn)` / `.once(...)`. Subclass-friendly: `priorityOf`, `relax`, `seed`, `reconstruct`, `fail` are all `protected` so phaser-plus AI modules can override (e.g. plug a pooled-node frontier).

### Dijkstra

Lowest-cost path on a weighted directed graph. Optimal when all edge costs are non-negative.

```ts
class Dijkstra<N> extends EventEmitter {
    constructor(start: N, end: N, options: DijkstraOptions<N>)
    static find<N>(start, end, options): PathResult<N> | null
}

interface DijkstraOptions<N> {
    neighbors: Neighbors<N>
    cost: EdgeCost<N>
    hash?: NodeHash<N>          // default: String(node)
}
```

Throws when `neighbors`/`cost` are missing or when an edge cost is negative / non-finite (the throw happens during `step()` / `run()`, not at construction — only the option callbacks are checked up front).

```ts
import { Dijkstra } from '@toolcase/base'

const edges: Record<string, [string, number][]> = {
    A: [['B', 1], ['C', 4]],
    B: [['C', 2], ['D', 5]],
    C: [['D', 1]],
    D: []
}

// One-shot
const result = Dijkstra.find('A', 'D', {
    neighbors: (n) => (edges[n] ?? []).map(([t]) => t),
    cost: (from, to) => edges[from].find(([t]) => t === to)![1]
})
result?.path  // ['A', 'B', 'C', 'D']
result?.cost  // 4

// Manual stepping with events
const search = new Dijkstra('A', 'D', {
    neighbors: (n) => (edges[n] ?? []).map(([t]) => t),
    cost: (from, to) => edges[from].find(([t]) => t === to)![1]
})
search.on(Dijkstra.VISIT, (node, g) => console.log('visit', node, 'g=', g))
search.on(Dijkstra.FOUND, (path) => console.log('done', path))
while (!search.isComplete) search.step()
```

### AStar

A* — Dijkstra plus a `heuristic` lower bound on remaining cost. Optimal when the heuristic is **admissible** (never overestimates true remaining cost). Faster than Dijkstra on grids / spatial graphs because it expands toward the goal first.

```ts
class AStar<N> extends Dijkstra<N> {
    constructor(start: N, end: N, options: AStarOptions<N>)
    static find<N>(start, end, options): PathResult<N> | null
}

interface AStarOptions<N> extends DijkstraOptions<N> {
    heuristic: (node: N, goal: N) => number
}
```

Throws when `heuristic` is missing at construction; throws during stepping if the heuristic returns negative / non-finite or if an edge cost is negative.

```ts
import { AStar } from '@toolcase/base'

type Cell = { x: number, y: number }
const SIZE = 5
const inBounds = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < SIZE && c.y < SIZE

const result = AStar.find({ x: 0, y: 0 }, { x: 4, y: 4 }, {
    neighbors: (n) => [
        { x: n.x + 1, y: n.y },
        { x: n.x - 1, y: n.y },
        { x: n.x,     y: n.y + 1 },
        { x: n.x,     y: n.y - 1 }
    ].filter(inBounds),
    cost: () => 1,
    heuristic: (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y),  // Manhattan
    hash: (n) => `${n.x},${n.y}`
})

result?.cost            // 8
result?.path.length     // 9 (start + 8 steps)
```

Time-budgeted scheduling (e.g. game loops / phaser-plus AI modules):

```ts
const search = new AStar(start, end, opts)
const BUDGET_MS = 2

function tick() {
    const t0 = performance.now()
    while (!search.isComplete && performance.now() - t0 < BUDGET_MS) {
        search.step()
    }
    if (search.isComplete) emitFinalPath(search.getResult())
}
```

Common admissible heuristics: Manhattan (4-connected grid), Chebyshev (8-connected grid), Euclidean (any-angle / continuous). A heuristic that returns `0` reduces A* to Dijkstra — just use `Dijkstra` instead.

---

## Utilities

### generateId

Crypto-random hex id.

```ts
generateId(length: number = 8): string
```

Uses `globalThis.crypto.getRandomValues`. `length` is the **string** length (rounded up to whole bytes internally, sliced).

### ulid

Monotonic sortable ID. 26-character Crockford Base32 string: 10-char millisecond timestamp prefix + 16-char random suffix. Lexicographic sort equals time order. Within the same millisecond the random suffix is incremented, guaranteeing strict monotonicity even under rapid-fire generation.

```ts
ulid(): string
```

Uses `globalThis.crypto.getRandomValues` for the random component. Throws `Error('ulid overflow: too many ids within the same millisecond')` if 32^16 IDs are generated in a single millisecond (unreachable in practice).

```ts
import { ulid } from '@toolcase/base'

ulid()  // '01HWPEMZRQ8T3K4J5N6M7P8Q9R'  (example)
ulid()  // '01HWPEMZRQ8T3K4J5N6M7P8Q9S'  (monotonically greater)

// IDs sort in insertion order — safe to use as event-log keys
const ids = [ulid(), ulid(), ulid()]
ids.slice().sort() // same order as ids
```

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

Schema-driven validator. `validate()` returns a boolean and accumulates issues — it does **not** throw on a validation failure (it only throws for a structurally invalid *schema*).

```ts
new JSONSchema(schema: Schema, customValidators?: Record<string, ValidationFn>)
```

The optional 2nd argument registers extra type validators up front (same as calling `register()` for each).

`Schema` is a discriminated union on `type` (not a single flat shape):

```ts
type Schema =
    | { type: PrimitiveTypeName; required?: boolean }                                   // primitives
    | { type: 'object'; required?: boolean; flexible?: boolean; properties?: Record<string, Schema> }
    | { type: 'array';  required?: boolean; items?: Schema }
    | { type: string; required?: boolean; flexible?: boolean; properties?: Record<string, Schema>; items?: Schema }  // custom

type ValidationFn = (
    propertyName: string | null,
    schema: RawSchema,
    data: any,
    issues: ValidationIssue[]
) => void

interface ValidationIssue { path: string; message: string }
interface ValidationError { issues: ValidationIssue[] }
```

> Note: `Schema`, `ValidationFn`, `ValidationError`, and `ValidationIssue` are **not** re-exported from `@toolcase/base` — `import type { Schema }` will fail. Annotate inline or pass the literal directly to the constructor.

- `validate(data): boolean` — `true` when `data` passes; `false` otherwise (collecting issues). Throws only when the *schema* itself is malformed.
- `getLatestError(): ValidationError | null` — the issues from the last `validate()` call (`null` when the last call passed).
- `register(type, validationFn)` — add a custom type. Throws if the type is already registered. The validator signature is `(propertyName, schema, data, issues)` — push `{ path, message }` onto `issues` to report a problem.

Built-in types:
- Core: `string`, `boolean`, `number`, `integer`, `object`, `array`
- `email` — RFC-ish email regex
- `username` — `^[A-Za-z][A-Za-z0-9_-]{2,22}$` (starts with a letter; 3–23 chars total)
- `password` — must contain lower + upper + digit + one of `!@#$%`, length 8–24
- `url` — `https?://...`
- `uuid` — RFC 4122 v1–v5
- `date` — ISO date `YYYY-MM-DD`
- `datetime` — ISO 8601 datetime with timezone (`Z` or `±HH:MM`)
- `ipv4` — dotted-quad
- `ipv6` — full or compressed
- `hex` — color hex `#RGB`, `#RGBA`, `#RRGGBB`, `#RRGGBBAA`
- `slug` — lowercase alphanumerics joined by single dashes
- `semver` — semantic version (`MAJOR.MINOR.PATCH` + optional pre-release/build)
- `base64` — RFC 4648 base64 (length multiple of 4)

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

if (!schema.validate({ name: 'a', tags: ['x'] })) {
    console.error(schema.getLatestError()?.issues)  // [{ path, message }, ...]
}
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

> The `ColorType` union also type-accepts `'white'`, `'brown'`, `'grey'`, `'blue_grey'`, and `'black'`, but those have no palette entry — `getHex` resolves them to `null` and `toNumber` to `0`.

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

## Packing

Rectangle / sprite-atlas packing. Exported as a single namespace `Packing` (also as a default-export object). Five 2D bin-packing algorithms behind a uniform `Algorithm` interface, plus a high-level `Packer` that wires up trimming, sorting, multi-page planning, rotation, and POT (power-of-two) sizing.

```ts
import { Packing } from '@toolcase/base'
// Packing = { Packer, MaxRects, Guillotine, Shelf, Skyline, BinaryTree,
//             MultiPagePlanner, Sorter, Trimmer, Rotator, Algorithm, potCeil }
```

Public types (importable from `@toolcase/base`):

```ts
import type {
    PackingSize, PackingRect, PackingPlacedRect,
    PackingSprite, PackingPreparedSprite, PackingPlacedSprite,
    PackingPackedPage, PackingResult, PackingPOTMode,
    PackingAlgorithmOptions, PackingAlgorithmKind,
    PackingMemoryBudget, PackingSortStrategy, PackingPackerOptions
} from '@toolcase/base'
```

### Packer

End-to-end pipeline: input `Sprite[]` → optional alpha-trim → sort → multi-page place via the chosen algorithm → rotation fix-up → optional POT page size → `PackResult`.

```ts
new Packing.Packer(options: PackerOptions)

interface PackerOptions {
    algorithm: 'max-rects' | 'guillotine' | 'shelf' | 'skyline' | 'binary-tree'
    maxWidth: number
    maxHeight: number
    allowRotation: boolean
    padding: number          // gutter between sprites (px)
    extrude: number          // edge-pixel duplication around each sprite (px)
    pot: 'none' | 'page' | 'square'   // 'page' → ceil each axis to POT; 'square' → POT square
    sort: SortStrategy | 'none'        // 'area-desc' | 'max-side-desc' | 'height-desc' | 'width-desc' | 'perimeter-desc' | 'none'
    trim: boolean             // trim transparent borders if sprite.pixels provided
    alphaThreshold: number    // alpha > threshold counts as opaque
    budget: MemoryBudget      // { maxPagePixels?, maxPages?, maxSinglePagePixels? }
}

packer.pack(inputs: Sprite[]): PackResult

interface Sprite { id: string; width: number; height: number; pixels?: PixelGrid }
interface PixelGrid { width: number; height: number; alphaAt(x: number, y: number): number }

interface PackResult {
    pages: PackedPage[]            // each: { width, height, sprites: PlacedSprite[], occupancy }
    unpacked: PreparedSprite[]     // sprites that didn't fit under the budget
}

interface PlacedSprite extends PreparedSprite {
    rect: { x: number; y: number; width: number; height: number }
    page: number
}
```

```ts
const packer = new Packing.Packer({
    algorithm: 'max-rects',
    maxWidth: 1024, maxHeight: 1024,
    allowRotation: true,
    padding: 2, extrude: 1,
    pot: 'square',
    sort: 'max-side-desc',
    trim: false, alphaThreshold: 0,
    budget: { maxPages: 4 }
})

const result = packer.pack([
    { id: 'hero',   width: 64,  height: 96 },
    { id: 'enemy',  width: 32,  height: 32 },
    { id: 'panel',  width: 256, height: 128 }
])

for (const page of result.pages) {
    console.log(page.width, page.height, page.occupancy)
    for (const s of page.sprites) console.log(s.id, s.rect, s.rotated)
}
```

### Algorithms

All extend the abstract `Algorithm` class with the same surface:

```ts
abstract class Algorithm {
    constructor(options: AlgorithmOptions)
    abstract insert(size: Size): PlacedRect | null   // null when no fit
    abstract reset(): void
    abstract occupancy(): number                     // [0, 1]
    abstract usedBounds(): Size
}

interface AlgorithmOptions {
    maxWidth: number; maxHeight: number
    allowRotation: boolean
    padding: number; extrude: number
    pot: POTMode
}
```

Concrete classes — pick by trade-off:

| Class | Strategy | Best for |
|---|---|---|
| `Packing.MaxRects` | Tracks all maximal free rectangles; heuristic choice per insert | Highest occupancy, slower |
| `Packing.Guillotine` | Splits free space with axis-aligned cuts | Good occupancy, fast |
| `Packing.Skyline` | Bottom-left skyline contour | Fast, ideal for similar-height sprites |
| `Packing.Shelf` | Fixed-height horizontal rows | Fastest, good for uniform sizes |
| `Packing.BinaryTree` | Classic growing binary partition tree | Simple, good for incremental packing |

Use an algorithm directly when you want a single page and full control:

```ts
const algo = new Packing.MaxRects({
    maxWidth: 512, maxHeight: 512,
    allowRotation: false, padding: 1, extrude: 0, pot: 'none'
})
const placed = algo.insert({ width: 64, height: 64 })  // PlacedRect | null
algo.occupancy()   // fill ratio so far
algo.usedBounds()  // tight bounding box of placements
```

### Packing helpers

- `Packing.MultiPagePlanner(factory, { padding, extrude }, budget?)` — orchestrates page-by-page placement across an `AlgorithmFactory` while honoring `MemoryBudget` caps. `Packer` uses this internally; reach for it directly when you want a custom pipeline.
- `Packing.Trimmer(alphaThreshold = 0)` — `.trim(sprite)` scans `sprite.pixels` and returns a `PreparedSprite` with cropped width/height + source-offset metadata. Sprites without `pixels` pass through unchanged.
- `Packing.Sorter(strategy)` — `.sort(prepared)` returns a stable-sorted copy by `area-desc | max-side-desc | height-desc | width-desc | perimeter-desc`.
- `Packing.Rotator()` — `.apply(placedSprites)` swaps `sourceWidth/sourceHeight` and source offsets for any sprite where `rotated === true`. Run after placement to normalize metadata for atlas writers.
- `Packing.potCeil(value)` — round a positive integer up to the next power of two; `value <= 1 → 1`.

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
    if (!createUser.validate(await req.json())) {
        const issues = createUser.getLatestError()?.issues ?? []
        const message = issues.map(i => `${i.path}: ${i.message}`).join('; ')
        const e = new HTTP.RESTError(HTTP.Status.BAD_REQUEST, message)
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

### Pathfinding on top of `AdjacencyMatrix`

```ts
import { AdjacencyMatrix, Dijkstra, AStar } from '@toolcase/base'

const g = new AdjacencyMatrix<number, null>(1, null)
;['A', 'B', 'C', 'D'].forEach(v => g.addVertex(v))
g.addEdge('A', 'B', 2)
g.addEdge('B', 'C', 5)
g.addEdge('A', 'C', 9)
g.addEdge('C', 'D', 1)

const cheapest = Dijkstra.find('A', 'D', {
    neighbors: (v) => g.getEdges(v),
    cost: (from, to) => g.getEdge(from, to) as number
})
cheapest?.path  // ['A', 'B', 'C', 'D']
cheapest?.cost  // 8
```

For grid worlds, swap `Dijkstra` for `AStar` and supply a Manhattan / Chebyshev heuristic — fewer nodes expanded for the same path. Use the instance API (`new AStar(...)` + `step()`) when you need to spread search across frames or react to `VISIT` / `OPEN` events for debug overlays.

### Hex helpers — cryptographic ids

```ts
import { generateId, bufferToHex, hexToBuffer } from '@toolcase/base'

const sessionId = generateId(32)               // 32-char hex
const bytes = hexToBuffer(sessionId)           // back to Uint8Array
const roundTrip = bufferToHex(bytes) === sessionId
```

### Env-driven config (Node)

> Requires the sibling packages `@toolcase/node` (for `env`) and `@toolcase/logging` — neither ships in `@toolcase/base`.

```ts
import { env } from '@toolcase/node'
import { LoggerFactory, ConsoleLogReporter } from '@toolcase/logging'

const factory = new LoggerFactory([new ConsoleLogReporter()])
factory.level = env('LOG_LEVEL', 'info') as any
const port    = env('PORT', 3000, 'number')
const debug   = env('DEBUG', false, 'boolean')
```

### Random

Seedable pseudo-random number generator (mulberry32). Deterministic: identical seeds produce identical sequences. Zero dependencies, isomorphic.

```ts
new Random(seed: number)
```

- `next(): number` — uniform float in `[0, 1)`. Usable as `RandomFn` for `WeightedRandom`.
- `int(min: number, max: number): number` — inclusive integer in `[min, max]`. Throws if `min`/`max` are not integers or `min > max`.
- `float(min: number, max: number): number` — float in `[min, max)`. Throws if bounds are non-finite or `min > max`.
- `bool(p: number = 0.5): boolean` — `true` with probability `p`. Throws if `p` is outside `[0, 1]`.
- `pick<T>(arr: T[]): T` — uniformly random element. Throws on empty or non-array.
- `shuffle<T>(arr: T[]): T[]` — Fisher-Yates shuffle; returns a new array without mutating the original.
- `weighted<T>(entries: Array<{ item: T, weight: number }>): T` — weighted pick. Throws if entries is empty, any weight is negative/non-finite, or total weight is zero.

```ts
import { Random } from '@toolcase/base'

const rng = new Random(42)

rng.next()           // 0.7837119...
rng.int(1, 6)        // 1–6 inclusive (dice roll)
rng.float(0, 1)      // 0.something
rng.bool(0.3)        // true ~30% of the time
rng.pick(['a', 'b', 'c'])       // one of the three
rng.shuffle([1, 2, 3, 4, 5])   // [3, 1, 5, 2, 4] (or similar)
rng.weighted([
    { item: 'common', weight: 7 },
    { item: 'rare',   weight: 3 }
])  // 'common' ~70% of the time
```

Inject into `WeightedRandom` for reproducible loot tables:

```ts
import { Random, WeightedRandom } from '@toolcase/base'

const rng = new Random(seed)
const loot = new WeightedRandom(entries, (e) => e.weight, () => rng.next())
loot.pick() // deterministic given same seed
```

---

## Async

Zero-dependency async toolkit. Exported as the `Async` namespace.

```ts
import { Async } from '@toolcase/base'
// Async = { Deferred, Semaphore, Mutex, pLimit, withTimeout, sleep, debounce, throttle, AsyncQueue }
```

### Deferred

Promise with externally controlled resolve/reject. Useful for bridging callback-based APIs, coordinating between unrelated code paths, or creating one-shot gates.

```ts
new Async.Deferred<T>()
```

- `promise: Promise<T>` — the underlying promise (readonly).
- `resolve(value: T): void` — settle with a value. Subsequent calls are no-ops (native Promise behaviour).
- `reject(reason?: unknown): void` — settle with a rejection. Subsequent calls are no-ops.

```ts
const gate = new Async.Deferred<boolean>()

// consumer
gate.promise.then(ok => console.log('gate opened:', ok))

// producer (from anywhere)
gate.resolve(true)
```

### Semaphore

Limits concurrent access. At most `permits` callers may hold the semaphore at once; excess callers queue and are admitted in FIFO order when a slot is released.

```ts
new Async.Semaphore(permits: number)
```

Throws if `permits` is not a positive integer.

- `available: number` — current free permit count.
- `acquire(): Promise<void>` — waits for a permit.
- `release(): void` — returns a permit (or wakes the next queued waiter).
- `run<T>(fn: () => T | Promise<T>): Promise<T>` — acquire → run → release (releases even on error).

```ts
const sem = new Async.Semaphore(3)

const fetchPage = (url: string) => sem.run(() => fetch(url).then(r => r.json()))

// fires at most 3 fetches at a time
const pages = await Promise.all(urls.map(fetchPage))
```

### Mutex

Mutual exclusion — one caller at a time. Thin wrapper around `Semaphore(1)` with a caller-held release function.

```ts
new Async.Mutex()
```

- `locked: boolean` — true when a caller holds the lock.
- `acquire(): Promise<() => void>` — wait for the lock; the resolved value is the release function. Calling release more than once is a no-op.
- `run<T>(fn: () => T | Promise<T>): Promise<T>` — acquire → run → release (releases even on error).

```ts
const mutex = new Async.Mutex()

async function updateCounter() {
    const release = await mutex.acquire()
    try {
        counter++
    } finally {
        release()
    }
}
```

### pLimit

Concurrency gate. Returns a runner function that queues tasks and ensures at most `concurrency` run in parallel.

```ts
Async.pLimit(concurrency: number): <T>(fn: () => T | Promise<T>) => Promise<T>
```

Throws if `concurrency` is not a positive integer.

```ts
const limit = Async.pLimit(5)

const results = await Promise.all(
    urls.map(url => limit(() => fetch(url).then(r => r.json())))
)
```

### withTimeout

Races a promise against a deadline. Rejects with `Error('timed out after Nms')` if `fn` has not settled within `ms` milliseconds.

```ts
Async.withTimeout<T>(fn: () => T | Promise<T>, ms: number): Promise<T>
```

Throws synchronously if `ms <= 0`.

Composes with `retry` — pass `withTimeout` inside the retry callback for per-attempt deadlines:

```ts
import { retry, Async } from '@toolcase/base'

const result = await retry(
    () => Async.withTimeout(() => fetch('/api/data').then(r => r.json()), 3_000),
    { retries: 4, minTimeout: 500, factor: 2 }
)
```

### sleep

Resolves after `ms` milliseconds. Throws synchronously if `ms < 0`.

```ts
Async.sleep(ms: number): Promise<void>
```

```ts
await Async.sleep(1_000)  // pause 1 second
```

### debounce

Returns a debounced version of `fn` that fires only after `ms` have elapsed since the last call. The returned function also has a `cancel()` method to drop any pending invocation.

```ts
Async.debounce<T extends (...args: any[]) => void>(fn: T, ms: number): ((...args: Parameters<T>) => void) & { cancel(): void }
```

Throws if `fn` is not a function or `ms < 0`.

```ts
const onSearch = Async.debounce((query: string) => {
    fetchSuggestions(query)
}, 300)

input.addEventListener('input', e => onSearch(e.currentTarget.value))

// Cancel the pending call (e.g. on component unmount)
onSearch.cancel()
```

### throttle

Returns a throttled version of `fn` that fires at most once per `ms` window. Fires on the leading edge and again at the trailing edge if called during the window. The returned function also has a `cancel()` method to drop the pending trailing call.

```ts
Async.throttle<T extends (...args: any[]) => void>(fn: T, ms: number): ((...args: Parameters<T>) => void) & { cancel(): void }
```

Throws if `fn` is not a function or `ms < 0`.

```ts
const onScroll = Async.throttle(() => {
    updateNavHighlight()
}, 100)

window.addEventListener('scroll', onScroll)

// Drop trailing call (e.g. on unmount)
onScroll.cancel()
```

### AsyncQueue

Backpressure-aware producer/consumer channel. Async `push`/`pull`, `AsyncIterable` consumption, optional bounded capacity with backpressure, and close/drain semantics.

```ts
new Async.AsyncQueue<T>(capacity?: number)
```

- `capacity` — maximum number of buffered items. Default `Infinity` (unbounded). Pass a positive integer to enable backpressure. Constructor throws if `capacity` is not a positive integer.

**Properties:**
- `size: number` — current number of buffered items (readonly getter).
- `closed: boolean` — `true` after `close()` is called (readonly getter).

**Methods:**
- `push(item: T): Promise<void>` — add an item. When bounded and full, blocks until a slot is freed. Throws synchronously if `item === undefined` or if the queue is closed.
- `pull(): Promise<T>` — remove and return the next item. Blocks when the buffer is empty. Rejects with `Error('queue is closed')` when closed and empty.
- `close(): void` — close the queue. Idempotent. Wakes all pending `pull()` callers with a rejection and all blocked `push()` callers with a rejection. Items already buffered can still be consumed after close.
- `drain(): Promise<void>` — resolves when the buffer is empty (all buffered items have been consumed). Resolves immediately if already empty.
- `[Symbol.asyncIterator](): AsyncIterator<T>` — iterate items via `for await...of`; terminates when the queue is closed and empty.

```ts
import { Async } from '@toolcase/base'

// --- Unbounded (no backpressure) ---
const q = new Async.AsyncQueue<string>()

// Producer
await q.push('hello')
await q.push('world')
q.close()

// Consumer via for-await-of (terminates on close + empty)
for await (const msg of q) {
    console.log(msg)  // 'hello', 'world'
}

// --- Bounded with backpressure ---
const bounded = new Async.AsyncQueue<number>(2)

// push blocks when full until a consumer pulls
const producer = (async () => {
    for (let i = 0; i < 5; i++) {
        await bounded.push(i)   // blocks at i=2, i=3, i=4 until consumer pulls
    }
    bounded.close()
})()

const consumer = (async () => {
    for await (const n of bounded) {
        console.log(n)          // 0, 1, 2, 3, 4
    }
})()

await Promise.all([producer, consumer])

// --- Drain: wait for all items to be consumed ---
const channel = new Async.AsyncQueue<string>()
await channel.push('a')
await channel.push('b')
channel.close()

const drainP = channel.drain()          // resolves when buffer empties
for await (const _ of channel) { /* consume */ }
await drainP                            // already empty by now
```

---

## Spatial

2D broad-phase spatial partitioning. Exported as a single namespace `Spatial` with two structures behind a shared `SpatialRect` / `SpatialPoint` contract.

```ts
import { Spatial, type SpatialPoint, type SpatialRect } from '@toolcase/base'
// Spatial = { SpatialHash, Quadtree }
```

Both structures store arbitrary items (`T`) keyed by their axis-aligned bounding rectangle (`SpatialRect`). Nearest-neighbour distance is measured from the query point to the nearest edge of an item's bounding rect (distance = 0 if the point is inside the rect).

### SpatialHash

Uniform-grid spatial hash. O(1) amortised insert/remove; query cost scales with the number of occupied cells the query rect touches. Best when objects are roughly uniform in size and the cell size is tuned to ~2× the average object diameter.

```ts
new Spatial.SpatialHash<T>(cellSize: number)
```

Constructor throws if `cellSize` is not a positive finite number.

- `size: number` — read-only item count.
- `insert(item: T, bounds: SpatialRect): void` — no-op if item is already inserted. Throws if `item === undefined`.
- `remove(item: T): boolean` — returns `true` if removed; `false` if not present.
- `update(item: T, bounds: SpatialRect): void` — remove + reinsert (for moving objects).
- `query(bounds: SpatialRect): T[]` — all items whose bounds overlap the query rect; no duplicates.
- `nearest(point: SpatialPoint, maxDist?: number): T | null` — item with the smallest distance to `point`; respects `maxDist` (default `Infinity`).
- `clear(): this` — remove all items. Chainable.

```ts
import { Spatial, type SpatialRect } from '@toolcase/base'

type Entity = { id: string }

const hash = new Spatial.SpatialHash<Entity>(64)

const player: Entity = { id: 'player' }
hash.insert(player, { x: 100, y: 100, width: 32, height: 32 })

const enemy: Entity = { id: 'enemy' }
hash.insert(enemy, { x: 300, y: 300, width: 32, height: 32 })

// Broad-phase range query
const nearby = hash.query({ x: 80, y: 80, width: 100, height: 100 })
// → [player]

// Move player
hash.update(player, { x: 280, y: 280, width: 32, height: 32 })

// Nearest neighbour
hash.nearest({ x: 0, y: 0 }) // → enemy (player moved away)
```

### Quadtree

Recursive quadrant tree. Insert cost is O(log n) amortised; query prunes by bounding box; nearest-neighbour uses branch-and-bound pruning. Best when object density is uneven (sparse large regions + dense clusters).

```ts
new Spatial.Quadtree<T>(bounds: SpatialRect, capacity?: number, maxDepth?: number)
```

- `bounds` — the world rectangle this tree covers. Items outside it are rejected by `insert`.
- `capacity` — max items per node before subdivision (default `8`).
- `maxDepth` — max tree depth; nodes at max depth store all items regardless of count (default `8`).

Constructor throws if `bounds` is null/undefined, `capacity < 1`, or `maxDepth < 0`.

- `size: number` — read-only item count.
- `insert(item: T, bounds: SpatialRect): boolean` — returns `true` if inserted; `false` if item was already present or its bounds don't intersect the tree bounds. Throws if `item === undefined`.
- `remove(item: T): boolean` — returns `true` if removed; `false` if not present.
- `update(item: T, bounds: SpatialRect): void` — remove + reinsert.
- `query(bounds: SpatialRect): T[]` — all items whose bounds overlap the query rect.
- `nearest(point: SpatialPoint, maxDist?: number): T | null` — nearest item to `point` (branch-and-bound). Returns `null` when empty or nothing within `maxDist`.
- `clear(): this` — remove all items, preserve root bounds. Chainable.

```ts
import { Spatial } from '@toolcase/base'

const world = { x: 0, y: 0, width: 1024, height: 1024 }
const qt = new Spatial.Quadtree<string>(world, 4, 6)

qt.insert('A', { x: 10, y: 10, width: 20, height: 20 })
qt.insert('B', { x: 500, y: 500, width: 20, height: 20 })
qt.insert('C', { x: 15, y: 15, width: 10, height: 10 })

qt.query({ x: 0, y: 0, width: 100, height: 100 })
// → ['A', 'C']  (B is outside the query rect)

qt.nearest({ x: 0, y: 0 })
// → 'A'  (closest bounding rect to origin)

qt.update('A', { x: 600, y: 600, width: 20, height: 20 })
qt.size // → 3

qt.clear().size // → 0
```

---

## Notes

- Package is `sideEffects: false` — tree-shakable.
- Targets `node >= 18`; uses `globalThis.crypto` (Node 19+ exposes it globally; in Node 18 import `crypto.webcrypto` and assign).
- All public APIs are typed. The package ships a single ESM/CJS dual entry point (`.`) — there is no `/node` subpath.
