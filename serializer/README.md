# @toolcase/serializer

[![GitHub](https://img.shields.io/github/license/kalevski/toolcase?style=for-the-badge)](https://github.com/kalevski/toolcase/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/@toolcase/serializer?color=teal&label=VERSION&style=for-the-badge)](https://www.npmjs.com/package/@toolcase/serializer)

Protobuf-based binary serializer built on top of [protobufjs](https://github.com/protobufjs/protobuf.js). Define message schemas at runtime and encode/decode to compact binary buffers.

## Install

```bash
npm install @toolcase/serializer
```

## Usage

```ts
import Serializer from '@toolcase/serializer'

const serializer = new Serializer()

// Define a message schema
serializer.define('Player', [
    { key: 'name', type: Serializer.FieldType.STRING, rule: 'required' },
    { key: 'score', type: Serializer.FieldType.INT32, rule: 'optional', default: 0 },
    { key: 'alive', type: Serializer.FieldType.BOOL, rule: 'optional', default: true }
])

// Encode to binary
const buffer = serializer.encode('Player', { name: 'Alice', score: 42 })

// Decode back to object
const player = serializer.decode('Player', buffer)
console.log(player) // { name: 'Alice', score: 42, alive: true }
```

## API

### `new Serializer(id?)`

Create a new serializer instance. An optional `id` string is used as the protobuf namespace. If omitted, a random ID is generated.

### `serializer.define(key, fields)`

Define a message type.

- `key` — unique name for the message type
- `fields` — array of field definitions:

| Property | Type | Description |
|----------|------|-------------|
| `key` | `string` | Field name |
| `type` | `string` | One of `Serializer.FieldType.*` |
| `rule` | `'required' \| 'optional' \| 'repeated'` | Field cardinality |
| `default` | `any` | Default value (optional) |

### `serializer.encode(key, message): Uint8Array`

Encode a message object to a binary `Uint8Array`. Throws if the key is not defined or the message fails validation.

### `serializer.decode(key, buffer): Message`

Decode a `Uint8Array` back into a message object. Throws if the key is not defined or the buffer is malformed.

## Field Types

| Constant | Protobuf Type | Description |
|----------|--------------|-------------|
| `DOUBLE` | `double` | 64-bit floating point |
| `FLOAT` | `float` | 32-bit floating point |
| `INT32` | `int32` | Variable-length signed 32-bit integer |
| `UINT32` | `uint32` | Variable-length unsigned 32-bit integer |
| `SINT32` | `sint32` | ZigZag-encoded signed 32-bit integer |
| `FIXED32` | `fixed32` | Fixed-width unsigned 32-bit integer |
| `SFIXED32` | `sfixed32` | Fixed-width signed 32-bit integer |
| `INT64` | `int64` | Variable-length signed 64-bit integer |
| `UINT64` | `uint64` | Variable-length unsigned 64-bit integer |
| `SINT64` | `sint64` | ZigZag-encoded signed 64-bit integer |
| `FIXED64` | `fixed64` | Fixed-width unsigned 64-bit integer |
| `SFIXED64` | `sfixed64` | Fixed-width signed 64-bit integer |
| `STRING` | `string` | UTF-8 string |
| `BOOL` | `bool` | Boolean |
| `BYTES` | `bytes` | Arbitrary byte buffer |

## License

The project is licensed under [MIT License](https://github.com/kalevski/toolcase/blob/main/LICENSE)
