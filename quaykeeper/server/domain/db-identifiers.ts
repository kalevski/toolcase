// Pure validation + quoting for database identifiers (quaykeeper_database_management.md
// §5, §10) — the SQL-injection choke point. DDL cannot take bind parameters for
// identifiers, so every database/user name a request supplies must pass the
// allow-list here, and every emitted statement must quote through these helpers —
// belt and braces. No I/O; engine-specific rules keyed by `DbServerKind`.

import type { DbServerKind } from '@/server/domain/types'

/** Identifier shape: lowercase letter first, then lowercase alnum/underscore.
 *  Deliberately far stricter than what the engines allow — quaykeeper-created objects
 *  are plain snake_case names; anything fancier is created outside quaykeeper. */
export const DB_IDENT_PATTERN = /^[a-z][a-z0-9_]*$/

/** Engine identifier length caps. The pattern is ASCII-only, so chars == bytes. */
const DB_NAME_MAX: Record<DbServerKind, number> = { postgres: 63, mysql: 64 }
const USER_NAME_MAX: Record<DbServerKind, number> = { postgres: 63, mysql: 32 }

/** System databases — never valid create/drop/grant targets (either engine). */
export const RESERVED_DB_NAMES: ReadonlySet<string> = new Set([
    // postgres
    'postgres',
    'template0',
    'template1',
    // mysql / mariadb
    'mysql',
    'information_schema',
    'performance_schema',
    'sys',
])

/** Account names quaykeeper refuses to create, drop, or re-password (§10). The
 *  registry's own admin account is additionally locked by name in the service. */
export const RESERVED_USER_NAMES: ReadonlySet<string> = new Set([
    'postgres',
    'root',
    'mysql',
    'admin',
])

export type DbIdentResult = { ok: true; name: string } | { ok: false; error: string }

/**
 * Validate + normalize a request-supplied database name for `kind`. Trims and
 * lowercases (both engines fold unquoted identifiers anyway; quaykeeper normalizes so
 * the stored/emitted name is always the folded one), then applies the allow-list
 * pattern, the engine length cap, the reserved-name set, and the postgres `pg_`
 * prefix rule (reserved for system objects).
 */
export function validateDatabaseName(kind: DbServerKind, raw: unknown): DbIdentResult {
    return validate(kind, raw, DB_NAME_MAX[kind], RESERVED_DB_NAMES, 'database name')
}

/** Validate + normalize a request-supplied user/role name for `kind`. */
export function validateUserName(kind: DbServerKind, raw: unknown): DbIdentResult {
    return validate(kind, raw, USER_NAME_MAX[kind], RESERVED_USER_NAMES, 'user name')
}

function validate(
    kind: DbServerKind,
    raw: unknown,
    max: number,
    reserved: ReadonlySet<string>,
    label: string,
): DbIdentResult {
    if (typeof raw !== 'string') return { ok: false, error: `${label} is required` }
    const name = raw.trim().toLowerCase()
    if (name === '') return { ok: false, error: `${label} is required` }
    if (name.length > max) {
        return { ok: false, error: `${label} exceeds ${max} characters` }
    }
    if (!DB_IDENT_PATTERN.test(name)) {
        return {
            ok: false,
            error: `${label} must be lowercase snake_case (letter first, then letters/digits/underscores)`,
        }
    }
    if (reserved.has(name)) return { ok: false, error: `"${name}" is a reserved ${label}` }
    if (kind === 'postgres' && name.startsWith('pg_')) {
        return { ok: false, error: `the "pg_" prefix is reserved by postgres` }
    }
    return { ok: true, name }
}

// ── quoting ──────────────────────────────────────────────────────────────────
// Only validated names ever reach these, so the escaping is defense in depth,
// not the primary control.

/** Quote an identifier for `kind`: `"…"` with doubling (postgres), `` `…` ``
 *  with doubling (mysql). */
export function quoteIdent(kind: DbServerKind, name: string): string {
    if (kind === 'postgres') return `"${name.replace(/"/g, '""')}"`
    return `\`${name.replace(/`/g, '``')}\``
}

/**
 * Quote a string literal for `kind` — needed only where the engine refuses bind
 * parameters (postgres `ALTER ROLE … PASSWORD`). Postgres runs with
 * `standard_conforming_strings = on`, so doubling single quotes suffices; mysql
 * treats backslash as an escape character by default, so it is escaped too.
 */
export function quoteLiteral(kind: DbServerKind, value: string): string {
    if (kind === 'postgres') return `'${value.replace(/'/g, "''")}'`
    return `'${value.replace(/\\/g, '\\\\').replace(/'/g, "''")}'`
}

/** Quote a mysql account (`'user'@'host'`). The user is a validated identifier;
 *  the host is operator data (`%` in v1) and literal-escaped regardless. */
export function quoteAccount(user: string, host: string): string {
    return `${quoteLiteral('mysql', user)}@${quoteLiteral('mysql', host)}`
}

// ── passwords ─────────────────────────────────────────────────────────────────

export const DB_PASSWORD_MIN = 8
export const DB_PASSWORD_MAX = 128

/**
 * Validate a caller-supplied password (generated ones always pass). Printable
 * ASCII only — engine password DDL is the one place a value travels as a quoted
 * literal, so control characters and non-ASCII are refused outright rather than
 * escaped (§10).
 */
export function validateDbPassword(raw: unknown): DbIdentResult {
    if (typeof raw !== 'string') return { ok: false, error: 'password is required' }
    if (raw.length < DB_PASSWORD_MIN || raw.length > DB_PASSWORD_MAX) {
        return {
            ok: false,
            error: `password must be ${DB_PASSWORD_MIN}–${DB_PASSWORD_MAX} characters`,
        }
    }
    if (!/^[\x21-\x7e]+$/.test(raw)) {
        return { ok: false, error: 'password must be printable ASCII without spaces' }
    }
    return { ok: true, name: raw }
}
