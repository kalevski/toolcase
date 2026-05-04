---
name: serializer-feature
description: Add a new feature, helper, FieldType, or extension to `@toolcase/serializer`. Triggers when the user asks to add/create/scaffold a new export inside `serializer/src/` (e.g. "add packed-array helper", "ship a versioned schema wrapper", "extend Serializer with X"). Wires up the implementation and updates the inventory + downstream SKILL.md.
---

# serializer-feature

Scaffold a new feature in `@toolcase/serializer`. Typical additions: schema-wrapper helpers (versioning, migrations), batched encode/decode pipelines, additional convenience APIs around the underlying `protobufjs/light` runtime.

## REQUIRED reading before generating any code

**You MUST read three files in this order:**

1. **`.claude/skills/serializer-feature/features.md`** (bundled) — inventory of every existing class/method/FieldType in `@toolcase/serializer`.
2. **`.claude/skills/serializer-feature/conventions.md`** (bundled) — code style, file layout, protobuf-light idioms.
3. **`examples/public/serializer/SKILL.md`** — the user-facing API reference at `toolcase.kalevski.dev/serializer/SKILL.md`. The downstream contract.

**REUSE before reinvent.**

## REUSE rule (load-bearing)

Before adding a new export, scan `features.md`. Concrete checks:

- Need to encode a custom shape? Use **existing** `define()` with `FieldType` constants — don't bypass protobuf and hand-roll bytes.
- Need versioning? Append-only field changes preserve compatibility — see "Versioning a wire format" pattern in the published SKILL.md. Don't introduce a new "version registry" class unless you genuinely need migrations.
- Need namespaces? **Existing** `new Serializer(id)` is already the namespace mechanism. Don't add a second one.
- Need plain-object decode? Use `(decoded as any).toJSON()` — don't add a `decodePlain()` method.
- Need batched encode? Compose with `for (const m of messages) buf.push(serializer.encode(...))` — don't add a `encodeMany()` API unless it adds value beyond a one-line loop.

If your feature would duplicate >50% of existing surface, **stop and either subclass `Serializer` or compose around it** instead of forking it.

## When to use

Trigger on requests like:

- "add a versioned schema wrapper to @toolcase/serializer"
- "ship a migration helper between schema versions"
- "implement a batch encode pipeline"
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
7. **Tests are mandatory.** Add `serializer/test/<Name>.test.ts` (vitest). Currently no `serializer/test/` directory — create it for the first feature.
8. **Strict TypeScript.** No `any` in public surface. The current `Serializer` does use `any` in `decode()` return type (`Message<Record<string, any>>`) — match that for new methods that wrap protobufjs types, but don't propagate `any` further than necessary.
9. **No code comments.** Self-documenting names only.
10. **No semicolons. 4-space indent.** Match `serializer/src/main.ts`.
11. **Encode errors must use the existing format.** `Serializer[<key>] encode error: <reason>` — match the existing throw shape so callers can pattern-match consistently.
12. **Decode errors must throw `decode error: <reason>`.** Match the existing shape.
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

## Wrapper template (typical use case)

A class that composes `Serializer` for a higher-level pattern (e.g. versioned schemas):

```ts
import { Serializer, FieldType } from './main'

class VersionedSerializer {

    private readonly serializer: Serializer

    private readonly versionMap: Map<number, string>

    constructor(id: string) {
        this.serializer = new Serializer(id)
        this.versionMap = new Map()
    }

    register(key: string, version: number, fields: FieldType[]): void {
        const versionedKey = `${key}_v${version}`
        this.serializer.define(versionedKey, fields)
        this.versionMap.set(version, versionedKey)
    }

    encode(version: number, message: Record<string, any>): Uint8Array {
        const key = this.lookupKey(version)
        return this.serializer.encode(key, message)
    }

    decode(version: number, buffer: Uint8Array): Record<string, any> {
        const key = this.lookupKey(version)
        return this.serializer.decode(key, buffer)
    }

    private lookupKey(version: number): string {
        const key = this.versionMap.get(version)
        if (key === undefined) {
            throw new Error(`version=${version} not registered`)
        }
        return key
    }

}

export default VersionedSerializer
```

## Test template

```ts
import { describe, it, expect } from 'vitest'
import Serializer from '../src/main'
import VersionedSerializer from '../src/VersionedSerializer'

describe('VersionedSerializer', () => {

    it('round-trips a v1 message', () => {
        const v = new VersionedSerializer('test.v1')
        v.register('Move', 1, [
            { key: 'x', type: Serializer.FieldType.SINT32, rule: 'required' },
            { key: 'y', type: Serializer.FieldType.SINT32, rule: 'required' }
        ])
        const buf = v.encode(1, { x: 4, y: -2 })
        const decoded = v.decode(1, buf) as any
        expect(decoded.x).toBe(4)
        expect(decoded.y).toBe(-2)
    })

    it('throws on unknown version', () => {
        const v = new VersionedSerializer('t')
        expect(() => v.encode(99, {})).toThrow('version=99 not registered')
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
