# Existing `@toolcase/serializer` API

Reference inventory for everything currently exported from `serializer/src/main.ts`. **Reuse before reinvent.**

Source of truth: `serializer/src/main.ts` exports + `examples/public/serializer/SKILL.md`. Stale ⇒ refresh as part of your task.

---

## Default + named export

### `Serializer` — runtime protobuf schema registry

`new Serializer(id?: string | null)`. `id` is the protobuf root namespace; auto-generated 16-char hex when omitted. Distinct instances live in distinct namespaces.

| Method | Signature | Notes |
|---|---|---|
| `define(key, fields)` | `(string, FieldType[]) => void` | tag = array index + 1 (1-indexed). Append-only safe. |
| `encode(key, message)` | `(string, Record<string, any>) => Uint8Array` | throws `Serializer[<key>] encode error: <reason>` |
| `decode(key, buffer)` | `(string, Uint8Array) => Message<Record<string, any>>` | returns protobufjs `Message` instance — `.toJSON()` for plain object |

**Use when:** any binary wire format you need to define at runtime (game netcode, websocket payloads, IPC, compact storage).
**Skip when:** you need a build-time `.proto` codegen tool (out of scope), or human-readable JSON (just use `JSON.stringify`).

---

## FieldType constants (`Serializer.FieldType`)

Static object on the class. Values are protobuf type-name string literals — passing the raw string also works.

| Constant | Wire type | Notes |
|---|---|---|
| `DOUBLE` | `double` | 64-bit float |
| `FLOAT` | `float` | 32-bit float |
| `INT32` | `int32` | varint signed (poor for negatives — prefer `SINT32`) |
| `UINT32` | `uint32` | varint unsigned |
| `SINT32` | `sint32` | ZigZag signed (compact for small negatives) |
| `FIXED32` | `fixed32` | 4-byte unsigned |
| `SFIXED32` | `sfixed32` | 4-byte signed |
| `INT64` | `int64` | varint signed; decodes to `Long` |
| `UINT64` | `uint64` | varint unsigned; decodes to `Long` |
| `SINT64` | `sint64` | ZigZag 64-bit; decodes to `Long` |
| `FIXED64` | `fixed64` | 8-byte unsigned |
| `SFIXED64` | `sfixed64` | 8-byte signed |
| `STRING` | `string` | UTF-8 |
| `BOOL` | `bool` | 1-byte varint |
| `BYTES` | `bytes` | arbitrary `Uint8Array` |

64-bit ints decode to `protobufjs/long` instances by default. Either install `long` (transitive via `protobufjs`) and let it pass through, or stay in 32-bit space.

---

## Field rules

`FieldType.rule`: `'required' | 'optional' | 'repeated'`.

- `'required'`: must be present on encode, present on decode.
- `'optional'`: may be omitted; falls back to `default` on decode (or `null` if `default` undefined).
- `'repeated'`: encoded as `T[]`. Numeric scalars are packed by protobufjs.

---

## Decision quick map

| Need | Reach for |
|---|---|
| Define a message schema at runtime | `serializer.define(key, fields)` |
| Encode a payload | `serializer.encode(key, msg)` |
| Decode bytes | `serializer.decode(key, buf)` |
| Get plain object out of decode | `(decoded as any).toJSON()` |
| Multiple unrelated wire formats in one process | one `new Serializer('namespace')` per format |
| Coordinates with both signs | `SINT32` |
| Pure positive counter | `UINT32` |
| Hash / id always 4 bytes | `FIXED32` |
| Arbitrary blob | `BYTES` |

---

## Schema evolution

Append-only is forwards/backwards compatible:

```ts
// v1
serializer.define('Move', [
    { key: 'x', type: 'sint32', rule: 'required' },
    { key: 'y', type: 'sint32', rule: 'required' }
])

// v2 — append optional field with default
serializer.define('Move', [
    { key: 'x', type: 'sint32', rule: 'required' },
    { key: 'y', type: 'sint32', rule: 'required' },
    { key: 'dz', type: 'sint32', rule: 'optional', default: 0 }
])
```

Removing or reordering fields silently corrupts decode. If a field is no longer used, leave the slot in place with a placeholder name + optional rule.

---

## Composition examples

These already exist — copy the pattern.

- **WebSocket netcode frame:** see `examples/public/serializer/SKILL.md` § Patterns → "WebSocket netcode frame".
- **Defensive decode:** wrap `decode()` in a try/catch returning `null` on malformed bytes; log via `@toolcase/logging`.
- **Cached decode of the same buffer:** memoize via `@toolcase/base` `Cache` keyed by `bufferToHex(buf)`.
- **Schema-validated payloads on top of protobuf:** post-decode validate with `@toolcase/base` `JSONSchema` for stricter range/format checks.

When you compose, document under "Reuses" in your new feature's `features.md` entry.
