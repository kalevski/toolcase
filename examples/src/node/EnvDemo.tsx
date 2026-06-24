import { NodeDemoCard } from './_demo/NodeDemo'

const code = `// Server-side only — env reads from globalThis.process.env and throws
// 'env works only with NodeJS' when process is undefined (e.g. the browser).

import { env } from '@toolcase/node'

// ── Define a typed config schema ─────────────────────────────────────────────
// env is overloaded: the return type is narrowed by defaultValue + type.
// Pass null as the default to opt into a nullable result.
const config = {
    host:     env('HOST', 'localhost'),            // string  — passthrough, default if unset
    port:     env('PORT', 3000, 'number'),         // number  — parseInt(v, 10)
    debug:    env('DEBUG', false, 'boolean'),      // boolean — case-insensitive 'true' | 'false'
    sentry:   env('SENTRY_DSN'),                   // string | null — no default given
    workers:  env('WORKERS', null, 'number'),      // number | null — nullable numeric
    readonly: env('READ_ONLY', null, 'boolean'),   // boolean | null — nullable boolean
}

// Given this environment:
//   HOST=api.internal  PORT=8080  DEBUG=TRUE  WORKERS=4
// config resolves to:
//   { host: 'api.internal', port: 8080, debug: true,
//     sentry: null, workers: 4, readonly: null }

// ── Coercion rules ───────────────────────────────────────────────────────────
// 'number'  — parseInt(v, 10), then re-checked: kept only if String(n) === v.
// 'boolean' — lowercased; 'true' → true, 'false' → false; anything else → default.
// 'string'  — passed through unchanged; default used only when the var is unset.

// ── Validation-failure case ──────────────────────────────────────────────────
// A non-integer numeric value fails the round-trip check (String(n) !== v), so
// env warns and falls back to the default rather than returning a partial parse.
//
//   PORT=8080abc → parseInt → 8080, but String(8080) !== '8080abc'
//   console.warn: [env] PORT="8080abc" is not a valid integer; using default
const port = env('PORT', 3000, 'number')   // → 3000  (default; warning emitted)

// Floats and leading zeros are rejected the same way — only clean integers pass.
//   PORT=8080.5 → 3000   PORT=007 → 3000
//
// Booleans never warn: an unrecognised value silently yields the default.
//   DEBUG=yes → false   (default)
`

export const EnvDemo = () => (
    <NodeDemoCard
        title="env (typed loader)"
        description="Overloaded, typed environment-variable reader: TypeScript narrows the return from defaultValue + type ('string' | 'number' | 'boolean'), and a null default opts into a nullable result. 'number' uses parseInt(10) with a String(n) === v round-trip guard (warns + falls back on a non-integer), 'boolean' accepts case-insensitive 'true'/'false' (default otherwise). Server-side only — reads globalThis.process.env and throws 'env works only with NodeJS' in non-Node environments."
        code={code}
    />
)

export default EnvDemo
