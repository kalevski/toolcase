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

- `Serializer.encode[<key>] failed: <protobuf verification message>` when validation fails.
- `Serializer.encode[<key>] failed: <error.message>` for other encoding errors.
- `Serializer: type key=<key> is not defined. known types: [...]` when the key was never defined.

Internally reuses a single `Writer`; thread-safe per-instance only if no concurrent encodes overlap on the same `Serializer`.

### `decode(key, buffer): Message`

```ts
serializer.decode(key: string, buffer: Uint8Array): Message<Record<string, any>>
```

Returns a `protobufjs` `Message` instance (object-like; spread or `.toJSON()` to convert to a plain object). On malformed buffers throws `Serializer.decode[<key>] failed: <reason> (bytes=<size>, offset=<pos>)`.

### `validate(key, message): string | null`

Pre-encode validation. Returns `null` on success or a human-readable field-level error string on failure. Use to surface field errors before paying for the encode.

```ts
const err = serializer.validate('Player', payload)
if (err !== null) throw new Error(`bad payload: ${err}`)
```

### `safeEncode(key, message)` / `safeDecode(key, buffer)`

Non-throwing variants. Return a `{ ok, value, error }` envelope:

```ts
const r = serializer.safeDecode('Player', buf)
if (!r.ok) {
    log.warning('drop frame', r.error.message)
    return
}
const player = r.value
```

### `types(): string[]`, `fields(key): FieldType[]`

Runtime introspection — list every defined type, or get the field metadata for one type.

```ts
serializer.types()              // → ['Player', 'Inventory']
serializer.fields('Player')     // → [{ key: 'id', type: 'string', rule: 'required', default: null }, …]
```

### Versioning — `version()`, `migrate()`, `encodeVersioned()`, `decodeVersioned()`

Stamps a 2-byte version header (`major`, `minor`) onto encoded frames and dispatches per-type migrations on decode when the frame is older than current. Both `major` and `minor` are byte-sized (0–255).

```ts
const s = new Serializer()
s.version(2, 0)                                           // current schema is v2.0
s.define('Player', [
    { key: 'name', type: 'string', rule: 'required' },
    { key: 'level', type: 'int32', rule: 'optional', default: 1 }
])
s.migrate('Player', 1, msg => ({ name: msg.name, level: 1 }))   // hop v1 → v2

const frame = s.encodeVersioned('Player', { name: 'Alice', level: 7 })
// frame[0] = 2, frame[1] = 0, frame[2..] = protobuf body

const out = s.decodeVersioned('Player', incomingV1Frame)
// out.version = { major: 1, minor: 0 }
// out.message = { name: '...', level: 1 }   // migrated
```

Decode rules:
- `major === current.major` → no migration, just decode.
- `major < current.major` → walk single-step migrations from `major` → `major+1` → … → `current.major`. Throws if any hop is missing.
- `major > current.major` → throws (frame is from the future).

`getVersion(): { major, minor }` returns the current marker.

### Streaming — `fragment()`, `reassemble()`

Split an encoded buffer into transport-sized chunks and reassemble out-of-order on the receiving side. Each chunk carries an 8-byte header: 4-byte random `frameId`, 2-byte `index`, 2-byte `total`. Up to 65535 chunks per frame.

```ts
const buf = serializer.encode('Snapshot', big)            // e.g. 80 KB
const chunks = serializer.fragment(buf, 16384)            // payload bytes per chunk; default 16384

for (const chunk of chunks) ws.send(chunk)                // each chunk has the 8-byte header

// on the receiver — total lives at bytes [6,7] of every chunk header:
const peekTotal = (chunk: Uint8Array) => (chunk[6] << 8) | chunk[7]

const incoming: Uint8Array[] = []
ws.addEventListener('message', e => {
    incoming.push(new Uint8Array(e.data))
    if (incoming.length === peekTotal(incoming[0])) {
        const buf = serializer.reassemble(incoming)
        const snapshot = serializer.decode('Snapshot', buf)
        incoming.length = 0
    }
})
```

`reassemble()` validates: header length, matching `frameId` across all chunks, exact chunk count, no duplicate indexes. Use it as the membrane between unreliable transports and `decode()`.

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

### Composite helpers

`Serializer.FieldType` also exposes three function helpers for composite shapes. Pass the result as the `type` of a field — `define()` recognises them and configures the underlying protobuf field accordingly.

| Helper | Returns | Wire shape |
|--------|---------|------------|
| `ENUM(values)` | enum marker | protobuf `enum` (varint int) |
| `MAP(keyType, valueType)` | map marker | protobuf `map<K,V>` |
| `PACKED_ARRAY(type)` | packed marker | `repeated T [packed=true]` |

```ts
const F = Serializer.FieldType

s.define('Person', [
    { key: 'name', type: F.STRING, rule: 'required' },
    // inline enum — auto-registered as <Type>_<field>_E
    { key: 'role', type: F.ENUM(['admin', 'user', 'guest']), rule: 'optional', default: 1 },
    // map<string,int32> — rule is ignored
    { key: 'counts', type: F.MAP(F.STRING, F.INT32), rule: 'optional' },
    // packed repeated uint32 (explicit packed=true option)
    { key: 'ticks', type: F.PACKED_ARRAY(F.UINT32), rule: 'repeated' }
])
```

`ENUM(values)` accepts either `string[]` (auto-numbered from 0) or `Record<string, number>` (explicit values, useful for proto-compat).

For shared enums across multiple message types, register once with `s.enum(name, values)` then reference by name:

```ts
s.enum('Role', ['admin', 'user', 'guest'])
s.define('Account', [{ key: 'role', type: 'Role', rule: 'optional' }])
s.define('AuditEntry', [{ key: 'role', type: 'Role', rule: 'optional' }])
```

---

## Examples by FieldType

Pick the right encoding — it dominates wire size for high-frequency messages.

### Numbers — variable-width vs. fixed-width

```ts
// Coordinates centered around zero ⇒ ZigZag (small magnitude, both signs)
serializer.define('Position', [
    { key: 'x', type: Serializer.FieldType.SINT32, rule: 'required' },
    { key: 'y', type: Serializer.FieldType.SINT32, rule: 'required' }
])

// Pure unsigned counter ⇒ varint, smallest for low values
serializer.define('Counter', [
    { key: 'tick', type: Serializer.FieldType.UINT32, rule: 'required' }
])

// Hash / id always 4 bytes ⇒ FIXED32 (avoids varint overhead for large values)
serializer.define('Handle', [
    { key: 'id', type: Serializer.FieldType.FIXED32, rule: 'required' }
])
```

`INT32` for negatives is wasteful — always emits 10 bytes for `-1`. Use `SINT32` whenever values can be negative.

### Strings, bools, bytes

```ts
serializer.define('Chat', [
    { key: 'text', type: Serializer.FieldType.STRING, rule: 'required' },
    { key: 'whisper', type: Serializer.FieldType.BOOL, rule: 'optional', default: false },
    { key: 'attachment', type: Serializer.FieldType.BYTES, rule: 'optional' }
])

const payload = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF])
const buf = serializer.encode('Chat', { text: 'gg', attachment: payload })
```

`BYTES` round-trips a `Uint8Array` exactly — use it for binary blobs (compressed JSON, snapshots, cryptographic tokens).

### Repeated fields

```ts
serializer.define('Inventory', [
    { key: 'slots', type: Serializer.FieldType.UINT32, rule: 'repeated' },
    { key: 'tags',  type: Serializer.FieldType.STRING, rule: 'repeated' }
])

serializer.encode('Inventory', { slots: [1, 4, 16, 64], tags: ['legendary'] })
```

`'repeated'` numeric scalars are packed by protobufjs — efficient for arrays.

### 64-bit ints decoding to `Long`

By default `INT64`/`UINT64`/`SINT64` decode to a `protobufjs/long` instance, not a JS `bigint`/`number`.

```ts
import Long from 'long'

serializer.define('Balance', [
    { key: 'cents', type: Serializer.FieldType.INT64, rule: 'required' }
])

const buf = serializer.encode('Balance', { cents: Long.fromString('9007199254740993') })
const out = serializer.decode('Balance', buf) as any
out.cents // Long { low, high, unsigned }
out.cents.toString()
```

If you don't need >2^53, stay in 32-bit and avoid the `long` dependency entirely.

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

### WebSocket netcode frame

```ts
import Serializer from '@toolcase/serializer'

const wire = new Serializer('netcode')
wire.define('Input', [
    { key: 'tick', type: 'uint32', rule: 'required' },
    { key: 'dx',   type: 'sint32', rule: 'required' },
    { key: 'dy',   type: 'sint32', rule: 'required' },
    { key: 'fire', type: 'bool',   rule: 'optional', default: false }
])

ws.binaryType = 'arraybuffer'
const send = (input: { tick: number, dx: number, dy: number, fire?: boolean }) => {
    ws.send(wire.encode('Input', input))
}
ws.addEventListener('message', e => {
    const buf = new Uint8Array(e.data)
    const msg = wire.decode('Input', buf)
    console.log(msg.tick, msg.dx, msg.dy, msg.fire)
})
```

### Multiple namespaces in one process

Different game subsystems shouldn't share a namespace — keeps tag numbering local to each schema.

```ts
const game  = new Serializer('game.v1')
const lobby = new Serializer('lobby.v1')
game.define('State',  [/* ... */])
lobby.define('Invite', [/* ... */])

// Same key 'State' could be redefined on `lobby` without collision.
```

### Plain-object output

`decode()` returns a `protobufjs` `Message`. Convert if you need a literal:

```ts
const decoded = serializer.decode('Player', buf)
const plain = (decoded as any).toJSON()
```

### Repeated + bytes (input replay buffers)

```ts
serializer.define('Frame', [
    { key: 'tick',   type: 'uint32', rule: 'required' },
    { key: 'inputs', type: 'bytes',  rule: 'repeated' }
])
serializer.encode('Frame', {
    tick: 1,
    inputs: [new Uint8Array([1,2]), new Uint8Array([3])]
})
```

### Defensive decode

Buffers from the network can be malformed. Use the built-in `safeDecode` instead of try/catching `decode()` directly — it returns `{ ok, value, error }` and never throws.

```ts
import logging from '@toolcase/logging'
const log = logging.getLogger('netcode')

ws.addEventListener('message', e => {
    const r = serializer.safeDecode('Input', new Uint8Array(e.data))
    if (!r.ok) {
        log.warning('dropped malformed frame', { byteLength: e.data.byteLength, reason: r.error?.message })
        return
    }
    apply(r.value)
})
```

---

## Cross-library integration

### With `@toolcase/base` Cache

Memoize a heavy decode of the same buffer (same hex hash → same parsed entity):

```ts
import { Cache, bufferToHex } from '@toolcase/base'

const decodeCache = new Cache(async (hex: string) => {
    return serializer.decode('Snapshot', hexToBuffer(hex))
}, 5_000)

await decodeCache.get(bufferToHex(buf))
```

### With `@toolcase/base` JSONSchema

Use protobuf for the wire and `JSONSchema` for stricter post-decode validation (e.g. ranges):

```ts
import { JSONSchema } from '@toolcase/base'

const moveBounds = new JSONSchema({
    type: 'object',
    properties: {
        tick: { type: 'number', required: true },
        dx:   { type: 'number', required: true },
        dy:   { type: 'number', required: true }
    }
})

const msg = serializer.decode('Input', buf) as any
moveBounds.validate(msg.toJSON())
```

---

## Notes

- Depends on `protobufjs ^8.0.1` (uses the `light` build — no parser, no reflection roundtrip from `.proto`).
- `sideEffects: false`. Targets `node >= 18`; isomorphic.
- `Serializer.FieldType` values are **string** literals matching protobuf type names — passing the raw string (`'string'`, `'sint32'`, etc.) works too.
- One `Writer` is reused per `Serializer` instance for performance; do not share a single instance across worker threads.
