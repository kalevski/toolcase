# JSONSchema bugs

Path: `base/src/JSONSchema.ts`

Severity: **H** = correctness/security, **M** = wrong behavior in edge case, **L** = cosmetic / minor.

---

## H1 — `USERNAME_REGEX` accepts non-letters in first char
Line 85: `/^[A-z][A-z0-9-_]{3,23}$/`

`[A-z]` is an ASCII range from `A` (65) to `z` (122). It includes `[`, `\`, `]`, `^`, `_`, `` ` ``. Username `[abcd` passes.

Fix: `[A-Za-z]`.

---

## H2 — `[A-z0-9-_]` second char class: dash interpreted as range
Line 85, same regex.

`9-_` is a code-point range `0x39..0x5F`, which sweeps in `:`, `;`, `<`, `=`, `>`, `?`, `@`, `[`, `\`, `]`, `^`. So usernames like `aaa@@@` validate.

Fix: put `-` last (or escape): `[A-Za-z0-9_-]`.

---

## H3 — `EMAIL_REGEX` not anchored
Line 87.

No `^...$`. `RegExp.test()` returns true on substring match. `' not an email foo@bar.com leftover '` passes.

Fix: wrap pattern in `^(?: ... )$`.

---

## H4 — `URL_REGEX` not anchored
Line 88. Same problem as H3. `'garbage https://x.com garbage'` passes.

Fix: anchor with `^...$`.

---

## H5 — `propSchema = null` masquerades as “unknown property” because `typeof null === 'object'`
Lines 205–211:

```ts
const propSchema = typeof schemaProperties[propName] === 'object' ? schemaProperties[propName] : null
if (propSchema === null && isStrict) {
    throw new Error(`property=${childPath} is not expected`)
}
```

If a user writes `{ properties: { name: null as any } }`, `typeof null === 'object'` so the ternary keeps the value (`null`). Then `propSchema === null` triggers “is not expected” for a key that *is* declared. Misleading error.

Fix: also reject `null`: `const v = schemaProperties[propName]; const propSchema = (v !== null && typeof v === 'object') ? v : null`.

---

## H6 — Missing required property does not produce a “required” error
`validateObject` (lines 202–223) iterates the union of schema keys + data keys. For a missing required key:
- key comes from `schemaProperties` (data has none).
- `data[propName]` is `undefined`.
- branch `if (typeof dataRecord[propName] === 'undefined' && !required) continue` skipped because `required === true`.
- Falls through to validator. For primitives, throws `must be a string, value=undefined type=undefined provided`.

User sees a *type* error instead of a *required* error. Should explicitly throw `property=X is required` when missing.

---

## M7 — `validateSchema` silently accepts mismatched-shape schemas
Lines 143–166. `validateSchema` happily walks `properties` on a `{ type: 'string' }` and `items` on a `{ type: 'object' }`. Garbage like `{ type: 'string', properties: { x: { type: 'number' } } }` doesn’t throw at construction even though `properties` is meaningless for primitives.

Fix: reject `properties` outside `object`/custom; reject `items` outside `array`/custom.

---

## M8 — Top-level `required` ignored
`validate()` (line 135) calls the validator directly. `schema.required = true` on the root has no effect because `required` is only consulted from `validateObject`’s parent loop. Defining a root schema with `required: true` and calling `schema.validate(undefined)` does not throw a “required” error — just whatever the leaf validator says.

Either: enforce required at the root, or document that `required` is property-level only.

---

## M9 — `register()` is a dead API for new schema types
Constructor runs `validateSchema(schema)` (line 114) using only built-ins + the `customValidators` ctor arg. Calling `instance.register('foo', fn)` *afterwards* never re-validates. So if a user’s schema references `'foo'`, construction throws unless `foo` was passed in `customValidators` — `register()` becomes useful only for `data` validation paths reached through nested types not seen at construction time. Confusing.

Fix: lazy-validate sub-schemas on first use, or expose `register()` before schema-fix-up, or have the constructor accept registrations as the first step.

---

## M10 — `validate()` passes `'@'` literal as `propertyName`
Line 140:
```ts
validator('@', this.schema as RawSchema, data)
```
`ValidationFn` signature is `(propertyName: string | null, ...)`. Inner code uses `propertyName ?? '@'` to compute `here`, implying `null` is the canonical root marker. Top-level should pass `null`, not `'@'`. Cosmetic, but breaks convention — and any custom validator that distinguishes root vs. named property cannot tell them apart.

---

## M11 — `Object.keys(data)` skips symbol/prototype keys
Line 200. Strict-mode rejection of unexpected props relies on `Object.keys`, which returns own enumerable string keys only. Inherited / `__proto__`-set keys slip past strict mode. Marginal in practice but worth noting if validating untrusted input.

---

## L12 — Typo: `is to weak for password`
Line 280. Should read `is too weak for password` (or `password is too weak`).

---

## L13 — Typo: `is must be a valid URL`
Line 290. Drop `is`: `property=X must be a valid URL`.

---

## L14 — Typo (carried from prior fix): error grammar `must contain letter`
Line 269: `must contain letter and the length must be between 3 and 23 characters`. Reads awkwardly; also length range is wrong (see L15).

---

## L15 — Username length range mismatch with regex
Regex enforces `1 + {3,23}` = **4 to 24** characters total. Error message says “between 3 and 23”. Pick one:
- regex `^[A-Za-z][A-Za-z0-9_-]{2,22}$` for 3–23, or
- update the message to say 4–24.

---

## L16 — `Schema` is not defensively cloned
Line 115: `this.schema = schema`. Caller mutating their schema object after construction affects all subsequent `validate()` calls. Cheap fix: structured clone or shallow copy at construction.

---

## L17 — `Record<string, never>` for empty `object` schema may surprise users at type-level
`InferSchema<{type:'object'}>` resolves to `Record<string, never>` (strict, properties absent). Runtime accepts only `{}`. If users intend “any object”, they must mark `flexible: true`. Documentation gap, not a code bug.

---

## L18 — Recursion in `validateSchema` doesn’t cap depth
A pathological self-referencing schema (constructed via shared object refs) would stack-overflow at construction. Edge case.

---

## Quick-fix checklist
- [ ] H1, H2: rewrite `USERNAME_REGEX` → `^[A-Za-z][A-Za-z0-9_-]{2,22}$` (also fixes L15).
- [ ] H3, H4: anchor `EMAIL_REGEX` and `URL_REGEX` with `^...$`.
- [ ] H5: null-guard `propSchema` lookup.
- [ ] H6: dedicated `is required` branch in `validateObject`.
- [ ] M7: reject mismatched `properties` / `items` in `validateSchema`.
- [ ] M8: clarify or enforce root-level `required`.
- [ ] M9: redesign `register()` lifecycle.
- [ ] M10: pass `null` as root `propertyName`.
- [ ] L12, L13, L14: error-message typos.
- [ ] L16: defensive schema clone.
