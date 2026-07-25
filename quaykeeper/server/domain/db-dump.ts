// Pure argv/env builders for the native dump + restore tools (the Databases tab's
// Export / Import buttons). Export runs `pg_dump` / `mysqldump` on the quaykeeper
// host and streams the SQL to the browser; import streams an uploaded .sql back
// through `psql` / `mysql` into a database on another server.
//
// Why the native tools rather than a hand-rolled dumper: the whole point of
// export/import is that a dump taken on server A restores faithfully on server
// B. Object ordering, dependency resolution, and the long tail of engine objects
// (identity sequences, matviews, routines, triggers, enums, extensions) are what
// pg_dump/mysqldump exist for.
//
// PURE: no I/O, no `server-only` — the argv/env shapes are unit-tested strings,
// exactly like the grant emitters in `db-access.ts`. `infrastructure/db-dump.ts`
// is the only module that spawns anything.
//
// SECURITY — the admin password NEVER reaches argv. `/proc/<pid>/cmdline` is
// world-readable on Linux, so a password in a flag leaks to every local account;
// `/proc/<pid>/environ` is owner-only. Hence `pgEnv`/`mysqlEnv` (PGPASSWORD /
// MYSQL_PWD) and the `--no-password` flag, which turns a missing password into
// an immediate failure instead of a prompt that hangs the request forever.

import type { DbServerKind, DbServerTls } from './types'

/** Connection facts a dump tool needs on its command line — the password is
 *  deliberately absent (it travels via {@link pgEnv} / {@link mysqlEnv}). */
export interface DumpTarget {
    kind: DbServerKind
    host: string
    port: number
    tls: DbServerTls
    user: string
}

export interface DumpOptions {
    /** `false` dumps structure only (`--schema-only` / `--no-data`). */
    includeData: boolean
}

/** Connect timeout for the child tools, in seconds. Mirrors the drivers'
 *  `CONNECT_TIMEOUT_MS` (that constant is server-only, this module is not). */
const CONNECT_TIMEOUT_SEC = 5

// ── postgres ─────────────────────────────────────────────────────────────────

export function pgDumpArgs(target: DumpTarget, database: string, opts: DumpOptions): string[] {
    const args = [
        '--host',
        target.host,
        '--port',
        String(target.port),
        '--username',
        target.user,
        // No TTY here: a password prompt would hang the request until the
        // timeout kill. Fail immediately instead.
        '--no-password',
        // Plain SQL, not the custom archive: it restores through psql, survives
        // inspection in a text editor, and needs no pg_restore on the far end.
        '--format=plain',
        '--encoding=UTF8',
        // Roles are per-server. Ownership/ACL statements would fail on a target
        // where the owning role doesn't exist — and quaykeeper re-applies access
        // itself from the Access tab, so grants are not the dump's job.
        '--no-owner',
        '--no-privileges',
        // Survives a target with different keyword/folding expectations.
        '--quote-all-identifiers',
    ]
    if (!opts.includeData) args.push('--schema-only')
    // No `--create`: the dump must be restorable into a database of ANY name,
    // since the import step chooses the target.
    args.push(`--dbname=${database}`)
    return args
}

export function psqlRestoreArgs(target: DumpTarget, database: string): string[] {
    return [
        '--host',
        target.host,
        '--port',
        String(target.port),
        '--username',
        target.user,
        '--no-password',
        '--quiet',
        // An operator's ~/.psqlrc must not change how a restore behaves.
        '--no-psqlrc',
        // Stop at the FIRST error and roll the whole restore back — a
        // half-restored database is worse than a failed import.
        '--set=ON_ERROR_STOP=1',
        '--single-transaction',
        `--dbname=${database}`,
        // The uploaded .sql arrives on stdin.
        '--file=-',
    ]
}

export function pgEnv(target: DumpTarget, password: string): Record<string, string> {
    return {
        PGPASSWORD: password,
        // Matches the pg driver's `ssl: { rejectUnauthorized: true }` (chain AND
        // hostname verified) / `ssl: false`.
        PGSSLMODE: target.tls === 'require' ? 'verify-full' : 'disable',
        PGCONNECT_TIMEOUT: String(CONNECT_TIMEOUT_SEC),
        PGCLIENTENCODING: 'UTF8',
    }
}

// ── mysql / mariadb ──────────────────────────────────────────────────────────

/**
 * `mysqldump` flags. These are MySQL-8-client flags — `--column-statistics` and
 * `--set-gtid-purged` do not exist in MariaDB's dumper, so a host whose
 * `mysqldump` is MariaDB's needs `QUAYKEEPER_MYSQLDUMP_BIN` pointed at a MySQL
 * one. Dumping a MariaDB *server* with the MySQL client is fine: both flags are
 * client-side.
 */
export function mysqlDumpArgs(target: DumpTarget, database: string, opts: DumpOptions): string[] {
    const args = [
        '--host',
        target.host,
        '--port',
        String(target.port),
        '--user',
        target.user,
        `--ssl-mode=${target.tls === 'require' ? 'VERIFY_IDENTITY' : 'DISABLED'}`,
        // Consistent snapshot from one transaction instead of locking the server.
        '--single-transaction',
        '--skip-lock-tables',
        // Everything a schema needs to work on the far end.
        '--routines',
        '--triggers',
        '--events',
        // Binary columns as hex literals — the dump stays valid UTF-8 text.
        '--hex-blob',
        // GTID_PURGED statements are replication state; they break a restore
        // into a different server.
        '--set-gtid-purged=OFF',
        // Avoids needing the PROCESS privilege just to dump tables.
        '--no-tablespaces',
        // An 8.x client dumping a 5.7 server otherwise queries
        // information_schema.column_statistics, which doesn't exist there.
        '--column-statistics=0',
        '--default-character-set=utf8mb4',
    ]
    if (!opts.includeData) args.push('--no-data')
    // Bare database name (not `--databases`): that form would emit CREATE
    // DATABASE / USE, pinning the dump to its original name.
    args.push(database)
    return args
}

export function mysqlRestoreArgs(target: DumpTarget, database: string): string[] {
    return [
        '--host',
        target.host,
        '--port',
        String(target.port),
        '--user',
        target.user,
        `--ssl-mode=${target.tls === 'require' ? 'VERIFY_IDENTITY' : 'DISABLED'}`,
        // Non-interactive: tab-separated output, no pager, stop on error.
        '--batch',
        '--default-character-set=utf8mb4',
        `--database=${database}`,
    ]
}

export function mysqlEnv(password: string): Record<string, string> {
    return { MYSQL_PWD: password }
}

// ── file naming ──────────────────────────────────────────────────────────────

/** Filename-safe form of a registry server name (which is free text). */
function slug(value: string): string {
    return (
        value
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'server'
    )
}

function stamp(at: Date): string {
    const p = (n: number, w = 2) => String(n).padStart(w, '0')
    return (
        `${at.getFullYear()}${p(at.getMonth() + 1)}${p(at.getDate())}` +
        `-${p(at.getHours())}${p(at.getMinutes())}${p(at.getSeconds())}`
    )
}

/** `quaykeeper-<server>-<database>-<YYYYMMDD-HHMMSS>.sql` — the Content-Disposition
 *  name, and the shape {@link databaseNameFromDumpFileName} reads back. */
export function dumpFileName(serverName: string, database: string, at: Date): string {
    return `quaykeeper-${slug(serverName)}-${database}-${stamp(at)}.sql`
}

/**
 * Recover the source database name from a filename {@link dumpFileName} produced,
 * so the import modal can prefill its target. Returns `null` for any other name —
 * a wrong guess would be worse than an empty field, since the value picks which
 * database gets written to. The greedy `.+` cannot swallow the database name: db
 * identifiers are snake_case (`db-identifiers.ts`) and so never contain `-`.
 */
export function databaseNameFromDumpFileName(fileName: string): string | null {
    const m = /^quaykeeper-.+-([a-z][a-z0-9_]*)-\d{8}-\d{6}\.sql$/.exec(fileName.trim())
    return m ? m[1] : null
}
