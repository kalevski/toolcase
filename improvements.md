# Toolcase — Proposed Improvements

## Critical

### 1. Remove duplicate `.js` files alongside `.ts` equivalents
Several source files exist as both `.js` (JSDoc-typed) and `.ts` (TypeScript) with identical logic. This bloats the build output and creates a maintenance burden where changes must be made in two places.

**Files to remove (keep `.ts` only):**
- `base/src/Cache.js`
- `base/src/State.js`
- `base/src/env.js`
- `base/src/generateId.js`
- `base/src/getNumberInRange.js`
- `base/src/JSONSchema.js`
- `logging/src/Level.js`

Update any imports referencing the `.js` versions to point to the `.ts` files.

---

### 2. Add tests for `@toolcase/serializer`
The serializer package has zero test coverage. `encode()` and `decode()` are core operations that must be verified.

**Tasks:**
- [ ] Create `serializer/test/serializer.test.js`
- [ ] Test `define()` with all `FieldType` values
- [ ] Test `encode()` → `decode()` roundtrip for each field type
- [ ] Test error cases (unknown key, malformed buffer)

---

### 3. Add tests for untested `@toolcase/base` utilities
6 source files in `base/src/` have no corresponding tests:

- [ ] `EventEmitter.ts` — on/off/once/emit, listener removal, typed events
- [ ] `Broadcast.ts` — pub/sub base class behavior
- [ ] `ObjectPool.ts` — acquire/release, pool growth, reset callback
- [ ] `retry.ts` — exponential backoff, max retries, abort, success on Nth attempt
- [ ] `LSystem.ts` — axiom, rules, iteration output
- [ ] `Color.ts` — color palette values, shade access

---

### 4. Add tests for `@toolcase/react-components`
90+ components with zero test coverage. Focus on high-value targets first.

**Tasks:**
- [ ] Set up a test environment with `@testing-library/react` and `vitest`
- [ ] Add tests for core layout components: `BasicLayout`, `DashboardLayout`, `Sidebar`
- [ ] Add tests for form components: `Input`, `Button`, `Select`, `Checkbox`, `Toggle`, `FormWizard`
- [ ] Add tests for the modal system: `ModalContext`, `ModalControl`, `useModal`
- [ ] Add tests for data display: `Table`, `Card`, `Badge`, `Avatar`
- [ ] Add snapshot tests for remaining components as a baseline

---

## Medium

### 5. Improve `@toolcase/react-components` README
The current README contains context notes rather than component documentation.

**Tasks:**
- [ ] List all exported components grouped by category (layout, form, data display, feedback, advanced)
- [ ] Add prop tables or TypeScript interface references for key components
- [ ] Add basic usage examples for top 10 most-used components
- [ ] Document theming/styling approach and CSS variable overrides

---

### 6. Improve `@toolcase/serializer` README
Currently only 3 lines with an incomplete example.

**Tasks:**
- [ ] Document all `FieldType` constants with descriptions
- [ ] Add a complete encode/decode example
- [ ] Document the `define()` field schema format
- [ ] Add error handling guidance

---

### 7. Update root README to list all packages
The root `README.md` mentions 3 packages but the monorepo contains 4 publishable packages.

**Tasks:**
- [ ] Add `@toolcase/react-components` to the packages table
- [ ] Add brief description and link for each package
- [ ] Add a "Getting Started" section with install commands

---

### 8. Clarify the purpose of `base/src/node.ts` entry point
`node.ts` only exports `env`. If this is intentional as a Node-specific entry, it should be documented. If other Node-only utilities exist or are planned, they should be routed through this entry.

**Tasks:**
- [ ] Document the `node` export in the base README
- [ ] Consider whether `http/Status.ts` or other server-side utilities belong in the node entry
- [ ] If `node.ts` is not needed, remove the separate entry point and export `env` from `main.ts`

---

### 9. Replace beta dependency `dropzone@6.0.0-beta.2`
`react-components` depends on a beta release of `dropzone`. Beta packages can introduce breaking changes without notice.

**Tasks:**
- [ ] Check if `dropzone` 6.x has reached stable release; upgrade if so
- [ ] If no stable release, evaluate alternatives or pin with a lockfile comment explaining the risk

---

## Low

### 10. Add a README for the `examples/` package
There is no README documenting how to run the example app.

**Tasks:**
- [ ] Create `examples/README.md` with dev server instructions (`npm run dev`)
- [ ] Document what each example demonstrates

---

### 11. Convert test files from `.js` to `.ts`
All test files are `.js` while source files are `.ts`. Converting tests to `.ts` would provide type checking in tests and catch regressions earlier.

---

### 12. Add CI pipeline configuration
No CI config was found (GitHub Actions, etc.). Automated checks would prevent regressions.

**Tasks:**
- [ ] Add a GitHub Actions workflow for lint, type-check, build, and test on push/PR
- [ ] Add a matrix for Node 18+ versions
- [ ] Add build status badge to root README

---

### 13. Add `exports` field validation
All packages use the `exports` field in `package.json` for dual CJS/ESM. Consider adding an automated check (e.g., `publint` or `arethetypeswrong`) to verify that exports resolve correctly for all consumers.

---

### 14. Clean up ESLint config ignore pattern
`eslint.config.js` ignores `examples/public/` but that directory does not exist. Remove the stale ignore entry.
