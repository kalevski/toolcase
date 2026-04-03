# Toolcase Modernization Tasks

## Build & Packaging

### 1. Convert source to TypeScript
Source files are plain JS with JSDoc type annotations. Convert all `.js` files in `base/src/` and `logging/src/` to `.ts` with proper type annotations, interfaces, and generics. The existing JSDoc comments map almost 1:1 to TypeScript syntax, making migration mechanical. Remove the separate `build:tsd` step since `tsup` (or `tsc`) will emit declarations directly from `.ts` source.

### 2. Add `exports` field to package.json
Both `@toolcase/base` and `@toolcase/logging` only declare legacy `main` and `module` fields. Modern Node.js (16+) and bundlers (Vite, webpack 5, Rollup) resolve packages through the `exports` map. Add conditional exports to each package:
```jsonc
"exports": {
  ".": {
    "import": "./lib/module.js",
    "require": "./lib/main.js",
    "types": "./lib/main.d.ts"
  }
}
```
Keep `main`/`module`/`types` fields for backward compatibility with older tools.

### 3. Replace Parcel with tsup
Parcel generates verbose wrapper code with `$parcel$defineInteropFlag` and `$parcel$export` helpers in the output bundles. Replace it with [tsup](https://github.com/egoist/tsup) (esbuild-based) which produces clean ESM + CJS dual output with `.d.ts` generation in a single command. This also eliminates the need for the separate `build:tsd` TypeScript step.

Per-package `tsup.config.ts`:
```ts
import { defineConfig } from 'tsup'
export default defineConfig({
  entry: ['src/main.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  outDir: 'lib',
})
```
Update each package's `build` script to just `tsup` and remove `parcel`, `typescript` (as direct dep), and the `targets` config from package.json.

### 4. Add tsconfig.json files
No `tsconfig.json` exists; types are currently generated via inline CLI flags (`tsc -d --allowJs --emitDeclarationOnly ...`). Create a root `tsconfig.json` with shared strict settings and per-package `tsconfig.json` files that extend it:
```jsonc
// root tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2020",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "declaration": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  }
}
```
Each package extends this with its own `include` and `outDir`.

### 5. Add `sideEffects: false` for tree-shaking
Neither package declares `sideEffects` in its `package.json`. Bundlers like webpack and Rollup need this flag to safely tree-shake unused exports — critical for a utility library where consumers may only use one or two functions. Add `"sideEffects": false` to both `base/package.json` and `logging/package.json`.

### 6. Add `engines` field to package.json
No minimum Node.js version is declared. Consumers have no signal about compatibility. Add to root and per-package `package.json`:
```json
"engines": {
  "node": ">=18"
}
```
Node 18 is the oldest active LTS and guarantees `crypto.getRandomValues`, `structuredClone`, `EventTarget`, and stable ESM support.

---

## Bug Fixes

### 7. Fix `getNumberInRange` broken logic
**File:** `base/src/getNumberInRange.js`

The control flow is inverted. When `value` is already a `number`, the code falls into the `else` branch which throws an error. When `value` is a valid string, the parsed result is assigned back to `value` but `number` remains `null`, so the clamp at the end operates on `null`.

**Fix:**
```js
const getNumberInRange = (value, defaultValue = 0, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER) => {
  let number = defaultValue

  if (typeof value === 'string') {
    const parsed = parseInt(value, 10)
    number = Number.isNaN(parsed) ? defaultValue : parsed
  } else if (typeof value === 'number') {
    number = Number.isNaN(value) ? defaultValue : value
  }

  return Math.min(Math.max(number, min), max)
}
```

### 8. Fix `State.set` null crash
**File:** `base/src/State.js`, line 39

`typeof null === 'object'` passes the guard, then `Object.keys(null)` throws a `TypeError` inside `setProperties`.

**Fix:** Change the guard to explicitly reject null and arrays:
```js
set(data, emit = true) {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`data=(${data}) must be a plain object`)
  }
  // ...
}
```
Apply the same pattern in the `constructor`.

### 9. Fix `JSONSchema.validateObject` null crash
**File:** `base/src/JSONSchema.js`, line 165

Same root cause — `null` passes `typeof data !== 'object'`, then `Object.keys(data)` throws.

**Fix:**
```js
validateObject = (propertyName, schema, data) => {
  if (data === null || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`property=${propertyName} must be an object, value=${data} type=${typeof data} provided`)
  }
  // ...
}
```

### 10. Fix `getLevelOrder` falsy-zero bug
**File:** `logging/src/Level.js`, line 32

`LevelOrder['error']` is `0`, which is falsy. The expression `LevelOrder[level] || null` treats it as missing and returns `-1` (silent).

**Fix:** Use nullish coalescing or an explicit check:
```js
const getLevelOrder = (level) => {
  const order = LevelOrder[level] ?? null
  if (typeof order !== 'number') {
    return -1
  }
  return order
}
```

### 11. Fix Cache typo: `entiries` → `entries`
**File:** `base/src/Cache.js`

The private `Map` property is misspelled as `entiries` (lines 21, 75, 101, 104). Rename all occurrences to `entries`. Not a runtime bug, but it breaks subclassing and is confusing.

### 12. Fix `env()` empty string falsy behavior
**File:** `base/src/env.js`, line 28

`return value ? value : defaultValue` treats an explicitly-set empty string `""` as missing. An env var set to `""` should return `""`, not the default.

**Fix:**
```js
return value !== undefined ? value : defaultValue
```

### 13. Fix `RESTError` shared mutable singletons
**File:** `base/src/http/RESTError.js`, lines 31-33

`RESTError.NOT_FOUND`, `RESTError.NOT_IMPLEMENTED`, and `RESTError.INTERNAL_SERVER_ERROR` are shared mutable `Error` instances. If a consumer reads `.stack` or modifies `.message`, it contaminates all future uses. Stack traces also point to module-load time, not the actual throw site.

**Fix:** Replace static instances with factory methods:
```js
RESTError.notFound = (message = 'resource not found') => new RESTError(Status.NOT_FOUND, message)
RESTError.notImplemented = (message = 'not implemented') => new RESTError(Status.NOT_IMPLEMENTED, message)
RESTError.internalServerError = (message = 'internal server error') => new RESTError(Status.INTERNAL_SERVER_ERROR, message)
```

---

## Security / Correctness

### 14. Use `crypto.getRandomValues` in `generateId`
**File:** `base/src/generateId.js`, line 22

`Math.random()` is not cryptographically secure and can produce collisions. `crypto.getRandomValues` is available in Node 16+ and all modern browsers.

**Important:** Use `globalThis.crypto.getRandomValues()` (not `require('crypto')`) so the same code works in both Node.js and browsers without any conditional imports.

**Fix:**
```js
const generateId = (length = 8) => {
  const bytes = new Uint8Array(Math.ceil(length / 2))
  globalThis.crypto.getRandomValues(bytes)
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('').slice(0, length)
}
```
For cases where a full UUID is acceptable, `globalThis.crypto.randomUUID()` is even simpler (Node 19+ / all browsers).

---

## Testing & CI

### 15. Add vitest test framework + unit tests
Zero test files exist in the repository. Install [vitest](https://vitest.dev/) at the root and add a `test` script to each package. Start with tests for the utility functions (`getNumberInRange`, `env`, `generateId`, `formatByteSize`, `toHex`, `bufferToHex`, `hexToBuffer`) and data structures (`Cache`, `PriorityQueue`, `State`, `VectorClock`). Each module is pure/deterministic and easy to cover.

```bash
npm install -D vitest
```
Root `package.json`:
```json
"scripts": {
  "test": "vitest run --workspace"
}
```
Target: 80%+ coverage on `base` and `logging` packages.

### 16. Add ESLint + Prettier config
No linting or formatting configuration exists. Add `eslint` with `@typescript-eslint` and `prettier` at the root. Use flat config (`eslint.config.js`). This catches logic bugs (like the `getNumberInRange` inversion) statically and enforces consistent code style.

```bash
npm install -D eslint @eslint/js typescript-eslint prettier eslint-config-prettier
```

---

## Architecture

### 17. Split Serializer into its own package
`protobufjs` (~380 KB) is a dependency of `@toolcase/base` solely because of `Serializer`. Consumers who only need `Cache` or `PriorityQueue` still pull it in. Create a new `@toolcase/serializer` workspace package, move `Serializer.js` there, and make `protobufjs` its dependency. This makes `@toolcase/base` dependency-free (after also removing `eventemitter3`).

Steps:
1. Create `serializer/` directory with its own `package.json`, `tsconfig.json`, and `tsup.config.ts`.
2. Move `Serializer.js` (and the `generateId` import it uses) into `serializer/src/`.
3. Remove `protobufjs` from `base/package.json`.
4. Remove `Serializer` from `base/src/main.js` exports.
5. Add `serializer` to root `workspaces`.

### 18. Replace eventemitter3 with a vendored minimal typed emitter
`EventTarget` is available natively but its API (`addEventListener`/`dispatchEvent`/`CustomEvent`) is significantly different from eventemitter3's `on`/`off`/`emit` — switching to it would break the existing `Broadcast` and `State` APIs and lose features like the `context` parameter on `on()`.

Instead, vendor a minimal typed emitter (~30 lines, zero dependencies) that preserves the current API contract. This removes the `eventemitter3` runtime dependency while keeping full browser + Node.js compatibility with no API changes for consumers.

**Sketch:**
```ts
export class EventEmitter {
  private listeners = new Map<string, Set<Function>>()

  on(event: string, fn: Function, context?: any) {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set())
    const bound = context ? fn.bind(context) : fn
    this.listeners.get(event)!.add(bound)
    return this
  }

  off(event: string, fn: Function) {
    this.listeners.get(event)?.delete(fn)
    return this
  }

  emit(event: string, ...args: any[]) {
    const fns = this.listeners.get(event)
    if (!fns) return false
    fns.forEach(fn => fn(...args))
    return true
  }

  removeAllListeners(event?: string) {
    if (event) this.listeners.delete(event)
    else this.listeners.clear()
    return this
  }

  listenerCount(event: string) {
    return this.listeners.get(event)?.size ?? 0
  }

  eventNames() {
    return [...this.listeners.keys()]
  }
}
```

### 21. Isolate Node-only code behind a subpath export
`env()` throws `Error('env works only with NodeJS')` when `globalThis.process` is undefined, which crashes browser bundles at call time. Tree-shaking cannot always eliminate it since it's a function call, not a static side-effect.

Move `env()` out of the main entrypoint and expose it through a dedicated subpath export so browsers never import it.

**Steps:**
1. Create `base/src/node.ts` that exports `env` (and any future Node-only utilities).
2. Remove `env` from `base/src/main.ts` exports.
3. Add the subpath to `base/package.json`:
```jsonc
"exports": {
  ".": {
    "import": "./lib/module.js",
    "require": "./lib/main.js",
    "types": "./lib/main.d.ts"
  },
  "./node": {
    "import": "./lib/node.js",
    "require": "./lib/node.cjs",
    "types": "./lib/node.d.ts"
  }
}
```
4. Consumers use `import { env } from '@toolcase/base/node'` explicitly.
5. Optionally, instead of throwing in `env()`, return `defaultValue` silently when `process` is absent — this makes accidental browser imports non-fatal.

---

## Documentation & DX

### 19. Add GitHub Actions CI workflow
No CI pipeline exists. Create `.github/workflows/ci.yml` that runs on push/PR:
```yaml
name: CI
on: [push, pull_request]
jobs:
  build:
    runs-on: ubuntu-latest
    strategy:
      matrix:
        node-version: [18, 20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ matrix.node-version }}
      - run: npm ci
      - run: npm run build
      - run: npm test
```

### 20. Improve README with API documentation
The base README lists feature names but has zero usage examples or API signatures. For each exported module, add:
- A one-line description
- A minimal code example (import + usage)
- Constructor/function signature with parameter types

Consider generating API docs from TypeScript source with [typedoc](https://typedoc.org/) after the TS migration.

---

## Suggested Priority Order

1. **Bug fixes** (tasks 7–13) — broken behavior shipping today
2. **Build modernization** (tasks 2–6, 3) — unlocks tree-shaking and proper ESM
3. **Add tests** (task 15) — safety net before further refactoring
4. **Convert to TypeScript** (task 1) — strict types, better DX
5. **Architecture** (tasks 17–18, 21) — reduce bundle size for consumers, isolate Node-only code
6. **Linting & CI** (tasks 16, 19) — protect against regressions
7. **Documentation** (task 20) — improve adoption
