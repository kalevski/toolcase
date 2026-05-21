---
name: serializer-feature
description: Add a new feature, helper, FieldType alias, codec wrapper, or extension to `@toolcase/serializer`. Triggers when the user asks to add/create/scaffold a new export inside `serializer/src/` (e.g. "add an opcode-tagged wrapper", "ship a cross-library codec adapter", "extend Serializer with X"). Wires up the implementation + test + downstream `examples/public/serializer/SKILL.md` + the demo at `examples/src/serializer/`.
---

# serializer-feature

Scaffold a new feature in `@toolcase/serializer`. Typical additions: opcode/router wrappers, codec-pipeline helpers, cross-library integration adapters around the underlying `protobufjs/light` runtime. Versioning, migrations, validation, chunking, safe encode/decode, enum/map/packed-array fields are **already built into `Serializer`** — wrap only for behaviour that isn't already covered.

## REQUIRED reading before generating any code

**You MUST read three files in this order:**

1. **`.claude/skills/serializer-feature/features.md`** (bundled) — inventory of every existing class/method/FieldType in `@toolcase/serializer`.
2. **`.claude/skills/serializer-feature/conventions.md`** (bundled) — code style, file layout, protobuf-light idioms.
3. **`examples/public/serializer/SKILL.md`** — the user-facing API reference at `toolcase.kalevski.dev/serializer/SKILL.md`. The downstream contract.

**REUSE before reinvent.**

## REUSE rule (load-bearing)

Before adding a new export, scan `features.md`. Concrete checks:

- Need to encode a custom shape? Use **existing** `define()` with `FieldType` constants — don't bypass protobuf and hand-roll bytes.
- Need versioning + migrations? **Existing** `version(major, minor)`, `migrate(key, fromMajor, fn)`, `encodeVersioned(key, msg)`, `decodeVersioned(key, buf)` already handle a 2-byte header + chained migrations. Don't add a second version registry.
- Need pre-encode validation? **Existing** `validate(key, message)` returns the protobufjs verify string (or `null` if ok). Don't add a parallel validator.
- Need throw-free encode/decode? **Existing** `safeEncode` / `safeDecode` return `{ ok, value?, error? }`. Don't add another result wrapper.
- Need chunked transport? **Existing** `fragment(buf, maxChunkSize)` / `reassemble(chunks)` already handle 8-byte framing (frameId/index/total). Don't reimplement.
- Need enum or map fields? **Existing** `FieldType.ENUM(values)` / `FieldType.MAP(keyType, valueType)` / `FieldType.PACKED_ARRAY(type)` markers in `define()` cover these. Don't add a parallel API.
- Need standalone enums? **Existing** `enum(name, values)` adds a named enum to the namespace.
- Need namespaces? **Existing** `new Serializer(id)` is the namespace mechanism (omit `id` to auto-generate a 16-char hex). Don't add a second one.
- Need introspection? **Existing** `types()` lists defined message names; `fields(key)` returns the FieldType[] for a message.
- Need plain-object decode? Use `(decoded as any).toJSON()` — don't add a `decodePlain()` method.
- Need batched encode? Compose with `for (const m of messages) buf.push(serializer.encode(...))` — don't add a `encodeMany()` API unless it adds value beyond a one-line loop.

If your feature would duplicate >50% of existing surface, **stop and either subclass `Serializer` or compose around it** instead of forking it.

## When to use

Trigger on requests like:

- "add an opcode-tagged wrapper to @toolcase/serializer"
- "ship a codec adapter for [transport]"
- "add a FieldType alias for [shape]"
- "extend Serializer with [feature]"
- any request mentioning `serializer/src/`, `@toolcase/serializer`, or runtime protobuf schemas

Do NOT use for:

- Edits to existing `serializer/src/main.ts` (just edit it — rules below still apply).
- Generic helpers unrelated to encoding (use `base-feature`).
- Anything that would introduce a new runtime dependency beyond `protobufjs`.
- Build-time `.proto` codegen tools (out of scope for this package; the whole point is runtime-defined schemas).

## Hard rules

These come from `serializer/package.json` and the existing single-file design.

1. **One runtime dep only: `protobufjs ^8.x`.** Use the `light` build (`protobufjs/light`) — no `.proto` parser, no reflection roundtrip. Don't add other deps.
2. **Isomorphic.** Must run in Node 18+ and modern browsers. No `process`, `Buffer`, `fs`, `window`. `Uint8Array` is the buffer type for input/output.
3. **One class per file when adding new public types.** The current package is a single `Serializer` class — for a sibling helper, place it in `serializer/src/<Name>.ts` and re-export from `main.ts`.
4. **`main.ts` is the export gateway.** Default export remains `Serializer`. Named exports add up.
5. **Keep `Serializer.FieldType` as the canonical type-name source.** Don't add a parallel constants object.
6. **Field-tag stability is sacred.** Never change tag assignment logic in `define()`. Never introduce a feature that reorders fields after definition. Append-only is the only safe schema evolution.
7. **Tests are mandatory.** Add `serializer/test/<Name>.test.ts` (vitest). The `serializer/test/` directory already exists (`serializer.test.ts`).
8. **Strict TypeScript.** No `any` in public surface. The current `Serializer` does use `any` in `decode()` return type (`Message<Record<string, any>>`) — match that for new methods that wrap protobufjs types, but don't propagate `any` further than necessary.
9. **No code comments.** Self-documenting names only.
10. **No semicolons. 4-space indent.** Match `serializer/src/main.ts`.
11. **Encode errors must use the existing format.** `Serializer.encode[<key>] failed: <reason>` — match the existing throw shape so callers can pattern-match consistently.
12. **Decode errors must use `Serializer.decode[<key>] failed: <reason> (bytes=<n>[, offset=<o>])`.** Match the existing shape.
13. **Update `examples/public/serializer/SKILL.md`.** Append in the matching section (Constructor / API / FieldType / Examples by FieldType / Patterns / Cross-library integration).
14. **Update `features.md`.** Append the inventory entry.
15. **Demo is mandatory.** Every new export ships with a runnable demo at `examples/src/serializer/<Name>Demo.tsx` registered in `examples/src/serializer/index.tsx`. No demo = feature not done.

## Files to create / modify per feature

For a new export named `<Name>`:

1. **`serializer/src/<Name>.ts`** — implementation. `export default <Name>` (and named re-export).
2. **`serializer/test/<Name>.test.ts`** — vitest. Cover encode/decode round-trip, error paths, edge cases (zero-length payloads, missing optional fields, max varint size).
3. **`serializer/src/main.ts`** — append `import <Name> from './<Name>'`, add named export. The default `Serializer` export stays untouched.
4. **`examples/public/serializer/SKILL.md`** — append the API section.
5. **`.claude/skills/serializer-feature/features.md`** — append the inventory entry.
6. **`examples/src/serializer/<Name>Demo.tsx`** — runnable demo. Mirror existing demos (`BasicDemo.tsx`, `FieldTypesDemo.tsx`). Show encode → bytes → decode round-trip and at least one error path if relevant.
7. **`examples/src/serializer/index.tsx`** — register the demo: `import <Name>Demo from './<Name>Demo'` then append `{ key: '<kebab>', label: '<Human label>', element: <<Name>Demo /> }` to `serializerExamples`.

## Wrapper template

A class that composes `Serializer` for a higher-level pattern that isn't already built in. Example: opcode-tagged multiplexed framing (1-byte opcode prefix selects which message type to decode). Versioning/migrations/fragmentation/validation are **already on `Serializer`** — wrap only for genuinely new behaviour.

```ts
import Serializer from './main'
import type { FieldType } from './main'

class TaggedSerializer {

    private readonly serializer: Serializer

    private readonly keyByOp: Map<number, string>

    private readonly opByKey: Map<string, number>

    constructor(id: string | null = null) {
        this.serializer = new Serializer(id)
        this.keyByOp = new Map()
        this.opByKey = new Map()
    }

    register(opcode: number, key: string, fields: FieldType[]): void {
        if (!Number.isInteger(opcode) || opcode < 0 || opcode > 255) {
            throw new Error(`TaggedSerializer.register: opcode must be an integer in [0,255], got ${opcode}`)
        }
        this.serializer.define(key, fields)
        this.keyByOp.set(opcode, key)
        this.opByKey.set(key, opcode)
    }

    encode(key: string, message: Record<string, any>): Uint8Array {
        const op = this.opByKey.get(key)
        if (op === undefined) {
            throw new Error(`TaggedSerializer.encode[${key}] failed: opcode not registered`)
        }
        const body = this.serializer.encode(key, message)
        const out = new Uint8Array(body.byteLength + 1)
        out[0] = op
        out.set(body, 1)
        return out
    }

    decode(buffer: Uint8Array): { key: string, message: Record<string, any> } {
        if (!buffer || buffer.byteLength < 1) {
            throw new Error('TaggedSerializer.decode failed: empty buffer')
        }
        const op = buffer[0]
        const key = this.keyByOp.get(op)
        if (key === undefined) {
            throw new Error(`TaggedSerializer.decode failed: opcode=${op} not registered`)
        }
        const body = buffer.subarray(1)
        return { key, message: this.serializer.decode(key, body) as any }
    }

}

export default TaggedSerializer
```

## Test template

`serializer/test/<Name>.test.ts` — copy the layout of the existing `serializer/test/serializer.test.ts`.

```ts
import { describe, it, expect } from 'vitest'
import Serializer from '../src/main'
import TaggedSerializer from '../src/TaggedSerializer'

describe('TaggedSerializer', () => {

    it('round-trips a tagged message', () => {
        const t = new TaggedSerializer('test')
        t.register(1, 'Move', [
            { key: 'x', type: Serializer.FieldType.SINT32, rule: 'required' },
            { key: 'y', type: Serializer.FieldType.SINT32, rule: 'required' }
        ])
        const buf = t.encode('Move', { x: 4, y: -2 })
        expect(buf[0]).toBe(1)
        const { key, message } = t.decode(buf)
        expect(key).toBe('Move')
        expect((message as any).x).toBe(4)
        expect((message as any).y).toBe(-2)
    })

    it('throws on unknown opcode', () => {
        const t = new TaggedSerializer()
        expect(() => t.decode(new Uint8Array([99]))).toThrow('opcode=99 not registered')
    })
})
```

## Workflow

1. **Read** `features.md`, `conventions.md`, and `examples/public/serializer/SKILL.md`.
2. **Decide** whether the new feature is a wrapper, helper, or extension. Confirm via REUSE checks above. If it's a one-liner, recommend a documentation note in the published SKILL.md instead of code.
3. **Create** `serializer/src/<Name>.ts`.
4. **Create** `serializer/test/<Name>.test.ts`. Round-trip + error coverage required.
5. **Wire into `main.ts`.**
6. **Append API section** to `examples/public/serializer/SKILL.md`.
7. **Append inventory entry** to `.claude/skills/serializer-feature/features.md`.
8. **Create demo** at `examples/src/serializer/<Name>Demo.tsx` and register in `examples/src/serializer/index.tsx`. Required.
9. **Verify** with `npx vitest run serializer` and `npm -w @toolcase/serializer run build`.
10. **Verify demo** with `npm -w @toolcase/examples run dev`.

## Anti-patterns

- Writing a hand-rolled byte format (use protobufjs).
- Adding a parallel `FieldType` constants object — extend `Serializer.FieldType` if you need new aliases.
- Reordering fields in `define()`. Append-only.
- Removing a field from a defined schema in production wire formats — reserve a placeholder slot instead.
- Throwing custom Error subclasses for encode/decode failures — match existing `Error` shape.
- Importing decoders from outside `protobufjs` (e.g. flatbuffers, msgpack).
- Sharing one `Serializer` instance across worker threads (the internal `Writer` is reused per-instance).
- Adding non-isomorphic dependencies.
- Code comments.
- Trailing semicolons.
- Skipping the test, the demo, the SKILL.md update, or the inventory update.
