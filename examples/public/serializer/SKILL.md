---
name: serializer
description: Use when reaching for @toolcase/serializer — runtime-defined protobuf message schemas, encode/decode to compact binary Uint8Array buffers via protobufjs/light. Good for game netcode, websocket payloads, IPC, and any compact wire format that doesn't need a .proto build step.
---

# serializer — API Reference

Schema-driven binary encode/decode built on top of `protobufjs/light`. Define message types at runtime, encode to `Uint8Array`, decode back to plain objects. No `.proto` files, no codegen.

```ts
import Serializer from '@toolcase/serializer'

const serializer = new Serializer()

serializer.define('Player', [
    { key: 'name',  type: Serializer.FieldType.STRING, rule: 'required' },
    { key: 'score', type: Serializer.FieldType.INT32,  rule: 'optional', default: 0 },
    { key: 'alive', type: Serializer.FieldType.BOOL,   rule: 'optional', default: true }
])

const buffer = serializer.encode('Player', { name: 'Alice', score: 42 })
const player = serializer.decode('Player', buffer)
// → { name: 'Alice', score: 42, alive: true }
```

Named export also available: `import { Serializer } from '@toolcase/serializer'`.

---

## Constructor

```ts
new Serializer(id?: string | null)
```

`id` is the protobuf root namespace. When omitted, a 16-char random hex id is generated. Distinct instances live in distinct namespaces — types defined on one are invisible to another.

---

## API

### `define(key, fields)`

Register a message type.

```ts
serializer.define(key: string, fields: FieldType[]): void

interface FieldType {
    key: string
    type: string                                // one of Serializer.FieldType.*
    rule: 'required' | 'optional' | 'repeated'
    default?: any
}
```

- Field tags are auto-assigned by array order (1-indexed). **Order matters** — once data is on the wire, reordering fields will break decoding for old buffers. Append-only is safe.
- `default` is applied on decode when the field is absent. `null` is used internally if `default` is undefined.
- `'repeated'` ⇒ field is encoded as `T[]`.

### `encode(key, message): Uint8Array`

```ts
serializer.encode(key: string, message: Record<string, any>): Uint8Array
```

Throws if `key` is not defined or the payload fails verification:

- `Serializer[<key>] encode error: <protobuf verification message>` when validation fails.
- `Serializer[<key>] encode error: <error.message>` for other encoding errors.

Internally reuses a single `Writer`; thread-safe per-instance only if no concurrent encodes overlap on the same `Serializer`.

### `decode(key, buffer): Message`

```ts
serializer.decode(key: string, buffer: Uint8Array): Message<Record<string, any>>
```

Returns a `protobufjs` `Message` instance (object-like; spread or `.toJSON()` to convert to a plain object). Throws `decode error: ...` on malformed buffers.

---

## FieldType (`Serializer.FieldType`)

| Constant   | Protobuf wire type | Notes |
|------------|-------------------|-------|
| `DOUBLE`   | `double`          | 64-bit float |
| `FLOAT`    | `float`           | 32-bit float |
| `INT32`    | `int32`           | varint signed (poor for negatives — use `SINT32`) |
| `UINT32`   | `uint32`          | varint unsigned |
| `SINT32`   | `sint32`          | ZigZag signed (compact for small negatives) |
| `FIXED32`  | `fixed32`         | 4-byte unsigned |
| `SFIXED32` | `sfixed32`        | 4-byte signed |
| `INT64`    | `int64`           | varint signed (returns `Long` unless `protobufjs` is configured otherwise) |
| `UINT64`   | `uint64`          | |
| `SINT64`   | `sint64`          | ZigZag 64-bit |
| `FIXED64`  | `fixed64`         | 8-byte unsigned |
| `SFIXED64` | `sfixed64`        | 8-byte signed |
| `STRING`   | `string`          | UTF-8 |
| `BOOL`     | `bool`            | 1-byte varint |
| `BYTES`    | `bytes`           | arbitrary `Uint8Array` |

64-bit ints decode to `protobufjs/long` instances by default. Either install `long` and let it pass through, or stay in 32-bit space.

---

## Patterns

### Versioning a wire format

Append-only is forwards/backwards compatible:

```ts
// v1
serializer.define('Move', [
    { key: 'x', type: 'sint32', rule: 'required' },
    { key: 'y', type: 'sint32', rule: 'required' }
])

// v2 — add fields at the end with optional/default
serializer.define('Move', [
    { key: 'x', type: 'sint32', rule: 'required' },
    { key: 'y', type: 'sint32', rule: 'required' },
    { key: 'dz', type: 'sint32', rule: 'optional', default: 0 }
])
```

Removing a field or reordering will silently corrupt decode — pad with a placeholder instead.

### Repeated + bytes

```ts
serializer.define('Frame', [
    { key: 'tick',    type: 'uint32', rule: 'required' },
    { key: 'inputs',  type: 'bytes',  rule: 'repeated' }
])
serializer.encode('Frame', { tick: 1, inputs: [new Uint8Array([1,2]), new Uint8Array([3])] })
```

### Multiple namespaces in one process

```ts
const game   = new Serializer('game.v1')
const lobby  = new Serializer('lobby.v1')
game.define('State', [...])
lobby.define('Invite', [...])
```

### Plain-object output

`decode()` returns a `protobufjs` `Message`. Convert if you need a literal:

```ts
const decoded = serializer.decode('Player', buf)
const plain = (decoded as any).toJSON()
```

---

## Notes

- Depends on `protobufjs ^8.0.1` (uses the `light` build — no parser, no reflection roundtrip from `.proto`).
- `sideEffects: false`. Targets `node >= 18`; isomorphic.
- `Serializer.FieldType` values are **string** literals matching protobuf type names — passing the raw string (`'string'`, `'sint32'`, etc.) works too.
- One `Writer` is reused per `Serializer` instance for performance; do not share a single instance across worker threads.
