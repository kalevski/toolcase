# @toolcase/serializer

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/serializer?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/serializer)

Protobuf-based binary serializer built on [protobufjs](https://github.com/protobufjs/protobuf.js). Define message schemas at runtime — no `.proto` files, no codegen — and encode/decode compact binary buffers.

## Why

Use this when you need to send **structured, type-checked, compact** payloads over the wire (WebSocket, WebRTC datachannel, IPC, savegames, IndexedDB blobs) without committing to a build step or losing the ability to evolve the schema in JS.

## Install

```bash
npm install @toolcase/serializer
```

## Quick start

```ts
import Serializer from '@toolcase/serializer'

const serializer = new Serializer()

serializer.define('Player', [
    { key: 'name', type: Serializer.FieldType.STRING, rule: 'required' },
    { key: 'score', type: Serializer.FieldType.INT32, rule: 'optional', default: 0 },
    { key: 'alive', type: Serializer.FieldType.BOOL, rule: 'optional', default: true }
])

const buffer = serializer.encode('Player', { name: 'Alice', score: 42 })
const player = serializer.decode('Player', buffer)
// → { name: 'Alice', score: 42, alive: true }
```

## Real-world usage

### WebSocket multiplayer

```ts
const proto = new Serializer('game')

proto.define('Move', [
    { key: 'x', type: Serializer.FieldType.FLOAT, rule: 'required' },
    { key: 'y', type: Serializer.FieldType.FLOAT, rule: 'required' },
    { key: 'dt', type: Serializer.FieldType.UINT32, rule: 'required' }
])

socket.binaryType = 'arraybuffer'
socket.send(proto.encode('Move', { x: 12.4, y: 8.1, dt: 16 }))

socket.onmessage = (event) => {
    const move = proto.decode('Move', new Uint8Array(event.data))
}
```

### Savegame on disk / localStorage

```ts
const save = new Serializer('save')

save.define('Save', [
    { key: 'level', type: Serializer.FieldType.UINT32, rule: 'required' },
    { key: 'inventory', type: Serializer.FieldType.PACKED_ARRAY('uint32'), rule: 'repeated' },
    { key: 'flags', type: Serializer.FieldType.MAP('string', 'bool') }
])

localStorage.setItem('save', btoa(String.fromCharCode(...save.encode('Save', state))))
```

## API

### `new Serializer(id?)`

Create a serializer instance. Optional `id` becomes the protobuf namespace name; if omitted, a random 16-char ID is used.

### `serializer.define(key, fields)`

Define a message type.

| Field property | Type | Description |
|----------------|------|-------------|
| `key` | `string` | Field name. |
| `type` | `string \| EnumMarker \| MapMarker \| PackedMarker` | One of `Serializer.FieldType.*` (or marker helpers — see below). |
| `rule` | `'required' \| 'optional' \| 'repeated'` | Cardinality. |
| `default` | `any` | Optional default value. |

### `serializer.enum(name, values)`

Register a top-level enum that can be referenced from multiple types.

```ts
serializer.enum('Tier', ['BRONZE', 'SILVER', 'GOLD'])
```

### `serializer.encode(key, message): Uint8Array`

Encode a message to a `Uint8Array`. Throws with a descriptive error if validation fails.

### `serializer.decode(key, buffer): Message`

Decode a `Uint8Array` back into a message object.

### `serializer.safeEncode(key, message)` / `safeDecode(key, buffer)`

Non-throwing variants that return `{ ok: true, value }` or `{ ok: false, error }`.

```ts
const result = serializer.safeDecode('Player', buffer)
if (!result.ok) console.error(result.error)
else useIt(result.value)
```

### `serializer.validate(key, message): string | null`

Run protobuf validation only — returns an error message string, or `null` if valid.

### `serializer.types()` / `serializer.fields(key)`

Introspect the schema. Useful for debug tooling.

## Field types

```ts
Serializer.FieldType.{ DOUBLE, FLOAT,
                       INT32, UINT32, SINT32, FIXED32, SFIXED32,
                       INT64, UINT64, SINT64, FIXED64, SFIXED64,
                       STRING, BOOL, BYTES }
```

### Composite markers

```ts
Serializer.FieldType.ENUM(['DRAFT', 'PUBLISHED'])
Serializer.FieldType.ENUM({ DRAFT: 0, PUBLISHED: 1 })

Serializer.FieldType.MAP('string', 'int32')

Serializer.FieldType.PACKED_ARRAY('uint32') // packed encoding for repeated scalars
```

| Constant | Protobuf type | Description |
|----------|---------------|-------------|
| `DOUBLE` / `FLOAT` | `double` / `float` | 64- / 32-bit float. |
| `INT32` / `INT64` | `int32` / `int64` | Variable-length signed. |
| `UINT32` / `UINT64` | `uint32` / `uint64` | Variable-length unsigned. |
| `SINT32` / `SINT64` | `sint32` / `sint64` | ZigZag-encoded signed (efficient for negatives). |
| `FIXED32` / `FIXED64` | `fixed32` / `fixed64` | Fixed-width unsigned. |
| `SFIXED32` / `SFIXED64` | `sfixed32` / `sfixed64` | Fixed-width signed. |
| `STRING` | `string` | UTF-8 string. |
| `BOOL` | `bool` | Boolean. |
| `BYTES` | `bytes` | Raw byte buffer. |

## Schema versioning + migrations

Tag each frame with a 2-byte version header and migrate older frames forward when decoding.

```ts
const proto = new Serializer('game')

proto.define('Save', [
    { key: 'level', type: Serializer.FieldType.UINT32, rule: 'required' },
    { key: 'energy', type: Serializer.FieldType.UINT32, rule: 'required' }
])

proto.version(2, 0) // current is v2

// frames written under v1 only had `level`
proto.migrate('Save', 1, (msg) => ({ ...msg, energy: 100 }))

const buffer = proto.encodeVersioned('Save', { level: 5, energy: 80 })
const { version, message } = proto.decodeVersioned('Save', buffer)
```

`major` and `minor` are each in `[0, 255]`. Decoding a frame newer than the current major version throws.

## Fragmenting large payloads

For UDP-like transports with size limits (WebRTC datachannel ~ 16 KB), split a buffer into ordered chunks and reassemble on the other side.

```ts
const buffer = serializer.encode('Snapshot', huge)
const chunks = serializer.fragment(buffer, 16384)

chunks.forEach(chunk => transport.send(chunk))

// receiving side
const reassembled = serializer.reassemble(receivedChunks)
const snap = serializer.decode('Snapshot', reassembled)
```

Each chunk has an 8-byte header: 4-byte frame ID, 2-byte index, 2-byte total. The reassembler validates frame ID, indices, and counts — it throws on mismatched/duplicate/missing chunks.

## License

[MIT](https://github.com/kalevski/toolcase/blob/main/LICENSE)
