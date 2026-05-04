# `@toolcase/serializer` Code Conventions

Authoritative style + structure contract for files under `serializer/src/` and `serializer/test/`. The current package is a single file (`main.ts`); when you add a sibling, match its shape exactly.

---

## Indent & whitespace

- 4-space indent. No tabs.
- **No trailing semicolons.** Match `serializer/src/main.ts`.
- One blank line between top-level statements.

---

## File layout

- One class or one function per file when adding new exports beyond the core `Serializer`. Filename matches the export.
- The default export of `serializer/src/main.ts` stays as `Serializer`. New helpers re-export through `main.ts` as named exports only.

---

## Imports

- Only `protobufjs/light` is allowed as a runtime dep. No other external packages.
- Type imports: `import type { Type, Field, Message } from 'protobufjs/light'`.
- Relative imports use no extension.

---

## TypeScript style

- The current `decode()` returns `Message<Record<string, any>>` — propagate that shape when wrapping.
- Field options use the `FieldType` interface declared in `main.ts`. Re-export it from your file if you reuse it.
- Generics are useful for typed wrappers around `decode()` return values:

```ts
function decodeAs<T>(serializer: Serializer, key: string, buf: Uint8Array): T {
    return serializer.decode(key, buf) as unknown as T
}
```

---

## Error format

Throw shapes are public contract — match them exactly:

- Encode failures: `Serializer[<key>] encode error: <reason>` (matches existing `main.ts`).
- Decode failures: `decode error: <reason>` (matches existing `main.ts`).
- Definition lookup failures: `type key=<key> is not defined` (matches existing `getType()`).

When you add new error throwing in a wrapper, use plain `Error`. Mirror the existing prefix style so consumers can pattern-match.

---

## Schema invariants

- Field tag = array index + 1. Never expose APIs that allow callers to renumber tags.
- Removing a field from a previously-released schema breaks the wire — either keep it as a placeholder or bump the protobuf message name.
- One `Writer` per `Serializer` instance is reused for performance. Never share an instance across worker threads.
- `id` is the protobuf root namespace. Distinct instances live in distinct namespaces. When wrapping, carry the namespace through (don't allocate a fresh `Serializer()` for each call — reuse the one passed in by the caller).

---

## No comments

Match `serializer/src/main.ts` (effectively comment-free). No `//`, no `/* */`, no JSDoc unless types alone are insufficient.

---

## Tests

`serializer/test/<Name>.test.ts` — one file per export, vitest. The `serializer/test/` directory does not yet exist; create it for the first feature.

Required cases per export:

- Round-trip encode → decode for every code path.
- Error coverage: invalid input throws expected message format.
- Edge cases: zero-length payload, missing optional fields, max varint, repeated empty array.
- Append-only schema evolution (where applicable): old buffer decodes against new schema with the new optional field falling back to `default`.

```ts
import { describe, it, expect } from 'vitest'
import Serializer from '../src/main'

describe('Round-trip', () => {

    it('encodes and decodes a basic message', () => {
        const s = new Serializer('test')
        s.define('Move', [
            { key: 'x', type: Serializer.FieldType.SINT32, rule: 'required' },
            { key: 'y', type: Serializer.FieldType.SINT32, rule: 'required' }
        ])
        const buf = s.encode('Move', { x: 4, y: -2 })
        const decoded = s.decode('Move', buf) as any
        expect(decoded.x).toBe(4)
        expect(decoded.y).toBe(-2)
    })

})
```

---

## Build + verify

```bash
npx vitest run serializer
npm -w @toolcase/serializer run build
npx publint serializer
```

---

## Style anti-patterns

- Hand-rolled byte format (use `protobufjs/light`).
- Custom `FieldType` constants object parallel to `Serializer.FieldType`.
- API that lets callers reorder or renumber fields after `define()`.
- Throwing custom Error subclasses for encode/decode failures.
- Importing from `protobufjs` (full build) when `protobufjs/light` suffices.
- Mutating the input message inside `encode()`.
- Sharing one `Serializer` across worker threads.
- Code comments.
- Trailing semicolons.
