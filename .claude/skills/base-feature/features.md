# Existing `@toolcase/base` API

Reference inventory for everything currently exported from `base/src/main.ts` and `base/src/node.ts`. Use to pick the right primitive before scaffolding a new one. **Reuse before reinvent.**

Source of truth: `base/src/main.ts` exports + `examples/public/base/SKILL.md` documented API. If something listed here is missing from those, treat this doc as stale and refresh it as part of your task.

---

## Data Structures

### `Cache` — async memoization with TTL

`new Cache<T>(fetchFn, ms = 0)`. Key is JSON-stringified args.

| Method | Returns | Notes |
|---|---|---|
| `get(...args)` | `Promise<T \| null>` | re-fetches when `now > fetchedAt + ms` |
| `setMS(ms)` | `void` | adjust TTL |
| `invalidate(...args)` | `void` | drop one entry |

**Use when:** wrapping any pure async function with a TTL (HTTP fetches, expensive decodes).
**Skip when:** synchronous memoization (just use a `Map`), or when you need LRU eviction (Cache has no size cap — would need a new feature for that).

---

### `PriorityQueue` — min-heap with optional uniqueness

`new PriorityQueue<T>(priorityFn, uniqueFn?)`.

| Method | Returns |
|---|---|
| `enqueue(value)` | `true` (throws if `value === undefined`) |
| `dequeue()` | `T \| null` |
| `pop()` | `T \| null` (raw last; no heap fix) |
| `has(value)` | `boolean \| null` (only with `uniqueFn`) |
| `length` | `number` |

**Use when:** scheduling, A*-style frontiers, throttled job queues, lowest-priority-first dispatch.
**Skip when:** FIFO needed (just use an array), or you need stable order on equal priorities (this heap is not stable).

---

### `VectorClock` — distributed-systems clock

`new VectorClock(nodeId, data?)`.

Instance: `setClock`, `getClock`, `setVersion`, `getVersion`, `increment`, `update(other)`, `isAfter`, `isBefore`, `isConcurrent`.
Static: `getNodeIds(a, b)`, `isAfter`, `isBefore`, `isConcurrent`, `compare(a, b): 1 | 0 | -1`.

**Use when:** ordering events across multiple replicas (CRDTs, multi-master sync, concurrency tracking).
**Skip when:** single-node ordering (use `Date.now()` or a counter).

---

### `State` — observable deep-merge state

`new State<T>(data?)` extends `Broadcast`.

| Method | Notes |
|---|---|
| `get()` | current data (partial) |
| `set(data, emit = true)` | deep-merge; throws on object/primitive type mismatch |
| `empty(emit = true)` | wipe |

Emits `'state'`, `'state.<key>'`, `'state.<key>.<nested>'` per dotted path on `set`.

**Use when:** any reactive store with dotted-path subscriptions (UI state, game state).
**Skip when:** flat key/value enough (use `EventEmitter` directly), or you need immutable patches (this mutates).

**Reuses:** extends `Broadcast`.

---

### `AdjacencyMatrix` — graph as `vertices[]` + matrix

`new AdjacencyMatrix<P, N>(defaultPositive?, defaultNegative?)`.

| Method | Returns |
|---|---|
| `addVertex(name)` | `boolean` |
| `removeVertex(name)` | `boolean` |
| `addEdge(a, b, value?)` | `boolean` (directed) |
| `removeEdge(a, b)` | `boolean` |
| `getEdge(a, b)` | `P \| N` |
| `getEdges(vertex)` | `string[]` (outgoing where edge ≠ defaultNegative) |
| `hasEdge(a, b)` | `boolean` |
| `vertices` | `string[]` (read-only) |

**Use when:** small/medium graphs with edge metadata (weights, types, capacities).
**Skip when:** sparse very-large graphs (matrix wastes memory; use an adjacency list).

---

### `WeightedRandom` — weighted draws with O(log n) lookup

`new WeightedRandom<T>(items, weightFn, random = Math.random)`. Builds a cumulative-weight table at construction and binary-searches a uniform sample per `pick`.

| Method / Field | Returns |
|---|---|
| `length` | `number` (excludes zero-weight items) |
| `totalWeight` | `number` |
| `pick()` | `T` |
| `pickMany(count)` | `T[]` (with replacement; throws on non-integer or negative count) |
| `probabilityOf(predicate)` | `number` in `[0, 1]` |

Throws on negative / non-finite weights, on a non-function `weightFn` / `random`, and when no item has a positive weight. Zero-weight items are dropped silently.

**Use when:** loot tables, weighted spawn pools, A/B traffic splitters, NPC behavior selection, any sampling where outcomes have configurable probabilities.
**Skip when:** uniform sampling (just `arr[Math.floor(Math.random() * arr.length)]`), sampling without replacement of large sets (this is with-replacement; rebuild for without-replacement), or weights mutate every pick (cumulative table is built once — recreate the instance).

---

### `ObjectPool` — class-instance reuse

`new ObjectPool<T>(objectClass, resetFn?, instanceFn?)`.

`obtain(): T` (auto-attaches `release()` closure). `release(obj)` resets + returns to pool. `dispose()` clears.

**Use when:** hot allocation paths — bullets, particles, frame events, anything spawned per-frame.
**Skip when:** instance count is small/stable (overhead exceeds savings), or constructor has side effects you can't reset.

---

## Events

### `EventEmitter` — typed emitter

Vendored zero-dep emitter. `on / once / off / emit / removeAllListeners / listenerCount / eventNames`.

**Use when:** plain pub/sub, no inheritance needed.
**Skip when:** you want `emit()` to be private — use `Broadcast` instead.

---

### `Broadcast` — base class wrapping `EventEmitter` with protected `emit`

Subclass it to expose `on/off/once` to consumers while keeping `emit` internal.

**Use when:** building a class that needs to fire events without letting consumers fire them.
**Skip when:** consumer-side emission is fine (use `EventEmitter` directly).

**Reuses:** `EventEmitter`.

---

## Pathfinding

### `Dijkstra` — class-based shortest-path search (extends `EventEmitter`)

`new Dijkstra<N>(start, end, { neighbors, cost, hash? })`. Caller-supplied graph adapter. Manual cooperative iteration via `step()` plus a `run(maxSteps?)` helper. Static `Dijkstra.find(start, end, options)` for one-shot use. Designed to be subclassed (phaser-plus AI plugs a pooled-node frontier through `protected` hooks).

| Member | Returns |
|---|---|
| `start` / `end` | `N` (readonly) |
| `iterations` | `number` |
| `maxIterations` | `number` (cap; default `Infinity`) |
| `isComplete` | `boolean` |
| `getStatus()` | `'searching' \| 'found' \| 'failed'` |
| `step()` | `SearchStatus` after one expansion |
| `run(maxSteps?)` | `PathResult<N> \| null` |
| `getResult()` | `PathResult<N> \| null` |

| Event constant | Payload | Fires |
|---|---|---|
| `Dijkstra.VISIT` | `(node, gCost)` | each pop |
| `Dijkstra.OPEN` | `(node, gCost)` | each enqueue / improvement |
| `Dijkstra.FOUND` | `(PathResult)` | once |
| `Dijkstra.FAILED` | `('exhausted' \| 'max_iterations')` | once |

`protected` extension points: `priorityOf(neighbor, g)`, `relax`, `seed`, `reconstruct`, `fail`. Frontier uses `PriorityQueue<{ key, g, priority }>`.

**Use when:** lowest-cost path with non-negative edges; need step-by-step control or progress events; subclass for pooled / instrumented variants.
**Skip when:** negative weights (use Bellman-Ford — not in `base`); admissible heuristic available → use `AStar`.

**Reuses:** `PriorityQueue` (frontier), `EventEmitter` (events).

---

### `AStar` — A* search (extends `Dijkstra`)

`new AStar<N>(start, end, { neighbors, cost, heuristic, hash? })`. Same surface as `Dijkstra` plus `heuristic: (node, goal) => number`. Override `priorityOf` adds `h` to the g-cost so the frontier orders by `f = g + h`.

Throws on construction if `heuristic` is missing; throws during stepping if heuristic returns negative / non-finite or an edge cost is negative.

**Use when:** spatial / grid pathfinding where an admissible heuristic (Manhattan, Chebyshev, Euclidean) prunes the frontier; cooperative scheduling under a per-frame budget; subclass to plug octile heuristic + 8-connected mesh.
**Skip when:** no good heuristic exists (heuristic returning `0` reduces A* to Dijkstra at extra cost — just use `Dijkstra`).

**Reuses:** `Dijkstra` (full algorithm + events + step-loop).

---

## Utilities

### `generateId` — crypto-random hex

`generateId(length = 8): string`. Uses `globalThis.crypto.getRandomValues`.

**Use when:** session IDs, request IDs, deduplication keys (non-cryptographic uniqueness).
**Skip when:** you need RFC4122 UUIDs — this returns plain hex, not formatted.

---

### `getNumberInRange` — parse + clamp

`getNumberInRange(value, defaultValue = 0, min = MIN_SAFE_INTEGER, max = MAX_SAFE_INTEGER): number`.

**Use when:** parsing config / query strings / form input numbers with a fallback + bounds.

---

### `retry` — exponential-backoff retry

`retry<T>(fn, options?): Promise<T>`. Options: `retries: 3, factor: 2, minTimeout: 1000, maxTimeout: Infinity, randomize: false`.

**Use when:** wrapping flaky async operations.
**Skip when:** you need circuit-breaker / bulkhead semantics.

---

### `toHex` — number → zero-padded hex

`toHex(value, digits = 4): string`.

---

### `bufferToHex` / `hexToBuffer`

`bufferToHex(Uint8Array): string` / `hexToBuffer(hex): Uint8Array`. Pairs.

**Use when:** transporting binary as text (URL params, JSON-safe blobs).

---

### `formatByteSize`

`formatByteSize(bytes, decimals = 2): string`. Powers of 1024.

---

## Validation

### `JSONSchema` — type-driven validator

`new JSONSchema(schema)`. Built-in types: `string number boolean object array email username password url`. `validate(data)` throws on first violation. `register(type, fn)` extends.

**Use when:** runtime validation of inbound payloads with a tiny zero-dep validator.
**Skip when:** you need draft-07 JSON Schema compatibility (use `ajv` outside `base`).

---

## Other

### `LSystem` — Lindenmayer string rewriter

`new LSystem({ axiom, rules })`. `iterate()` advances state.

**Use when:** procedural generation (plants, fractals, dungeon layouts, music).

---

### `Color` — Material palette + helpers

Static palette of named colors. `getHex(name)`, `toNumber(name)`, `getRandomHex()`.

**Use when:** consistent UI palette across modules without importing a CSS framework.

---

## HTTP (`HTTP` namespace)

### `HTTP.Status`

Object of status-code constants (`OK = 200`, `NOT_FOUND = 404`, etc.).

### `HTTP.RESTError`

`new HTTP.RESTError(status, message)`. Static helpers `notFound`, `notImplemented`, `internalServerError`. `toJSON()` emits `{ status: 'rejected', cause }`.

### `HTTP.RESTResponse`

`new HTTP.RESTResponse(status, data, count?)`. `toJSON()` emits `{ status: 'OK', count?, data }`.

---

## Packing (`Packing` namespace)

Texture / rectangle packing.

| Export | Purpose |
|---|---|
| `Packing.Packer` | Facade — pass `PackerOptions`, get `PackResult` |
| `Packing.MaxRects` | Best general-purpose algorithm |
| `Packing.Skyline` | Best speed/quality compromise |
| `Packing.Guillotine` | Cut-based, faster but more fragmentation |
| `Packing.Shelf` | Cheapest, row-based |
| `Packing.BinaryTree` | BSP, didactic |
| `Packing.Sorter` | 5 sort strategies |
| `Packing.Trimmer` | Alpha-crop via `PixelGrid` adapter |
| `Packing.Rotator` | Swap source dims on rotated sprites |
| `Packing.MultiPagePlanner` | Multi-page + budget enforcement |
| `Packing.potCeil` | Round to next power of two |

Type aliases: `Sprite`, `PreparedSprite`, `PlacedSprite`, `PackedPage`, `PackResult`, `POTMode`, `MemoryBudget`, `AlgorithmOptions`, `PackerOptions`, `SortStrategy`, `MaxRectsHeuristic`, `SkylineHeuristic`, `GuillotineSplit`, `GuillotineChoice`, `ShelfFit`.

---

## Node-only (`@toolcase/base/node`)

### `env` — typed env-var reader

`env<T>(key, defaultValue?, type = 'string'): T`. Types: `'string' | 'number' | 'boolean'`. Throws when run in a non-Node environment.

**Use when:** Node services reading config from `process.env`.

---

## Decision quick map

| Need | Reach for |
|---|---|
| Cache an async result for N ms | `Cache` |
| Min-heap / priority frontier | `PriorityQueue` |
| Pub/sub (public emit) | `EventEmitter` |
| Pub/sub (private emit) | extend `Broadcast` |
| Reactive store | `State` |
| Pool reusable instances | `ObjectPool` |
| Random ID | `generateId` |
| Retry with backoff | `retry` |
| Validate JSON shape | `JSONSchema` |
| REST envelope | `HTTP.RESTResponse` / `HTTP.RESTError` |
| Bin-pack rectangles | `Packing.Packer` |
| Read env var (Node) | `env` from `@toolcase/base/node` |
| Distributed event order | `VectorClock` |
| Procedural string growth | `LSystem` |
| Named color palette | `Color` |
| Graph with edge metadata | `AdjacencyMatrix` |
| Weighted random pick | `WeightedRandom` |
| Shortest path (no heuristic) | `Dijkstra` |
| Shortest path (with heuristic) | `AStar` |
| Step-controlled / event-emitting search | `Dijkstra` / `AStar` instance API |

---

## Composition examples

These already exist — copy the pattern instead of reinventing.

- **Cached HTTP fetch with retry:** `Cache(args => retry(() => fetch(...)))` — see `examples/public/base/SKILL.md` § Recipes.
- **Observable game state:** `new State<T>().on('state.<path>', fn)`.
- **Throttled job queue:** `PriorityQueue` + `retry` per dequeue.

When you compose, document the composition in your new feature's `features.md` entry under "Reuses".
