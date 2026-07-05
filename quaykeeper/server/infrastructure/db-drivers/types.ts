// Driver contract for the database-management subsystem
// (quaykeeper_database_management.md §6). One implementation per engine; the service
// layer resolves a registry row into a `DbConnInfo` (decrypted, server-only) and
// dispatches through `DbDriver`. Drivers own connection handling and catalog
// queries ONLY — every GRANT/REVOKE statement they run comes from the pure
// emitters in `domain/db-access.ts`, and every identifier they interpolate has
// already passed `domain/db-identifiers.ts`.

import 'server-only'
import type {
    DbAccessLevel,
    DbDatabase,
    DbGrant,
    DbOperation,
    DbServerKind,
    DbServerTls,
    DbUser,
} from '@/server/domain/types'

/** A decrypted, server-only connection target (never a DTO, never logged whole). */
export interface DbConnInfo {
    kind: DbServerKind
    host: string
    port: number
    tls: DbServerTls
    user: string
    password: string
}

/** Connect timeout — a dead host must fail the request fast, not hang it (§6). */
export const CONNECT_TIMEOUT_MS = 5_000
/** Per-statement timeout. */
export const STATEMENT_TIMEOUT_MS = 10_000

/**
 * A driver failure with the engine's message sanitized for transport (the
 * routes map this to 502; the message lands in `db_server.last_error`, never a
 * credential). `code` carries the engine error code when one exists.
 */
export class DbDriverError extends Error {
    constructor(
        message: string,
        public code?: string,
    ) {
        super(message)
        this.name = 'DbDriverError'
    }
}

export interface DbDriver {
    /** Cheap liveness + credential check (SELECT 1). Throws `DbDriverError`. */
    ping(conn: DbConnInfo): Promise<void>
    /** Live database list, system databases filtered out. */
    listDatabases(conn: DbConnInfo): Promise<DbDatabase[]>
    /** Live login-capable users, system accounts filtered out. `isAdminAccount`
     *  is left `false` here — the service stamps it (it knows the registry row). */
    listUsers(conn: DbConnInfo): Promise<DbUser[]>
    /** The classified access matrix for the given users × databases. */
    listGrants(conn: DbConnInfo, databases: string[], users: string[]): Promise<DbGrant[]>
    createDatabase(conn: DbConnInfo, name: string): Promise<void>
    dropDatabase(conn: DbConnInfo, name: string): Promise<void>
    createUser(conn: DbConnInfo, name: string, password: string): Promise<void>
    dropUser(conn: DbConnInfo, name: string): Promise<void>
    setPassword(conn: DbConnInfo, name: string, password: string): Promise<void>
    /** Apply one simplified level for user × database (full reset + grant, §3). */
    applyAccess(
        conn: DbConnInfo,
        user: string,
        database: string,
        level: DbAccessLevel,
    ): Promise<void>
    /** Apply an explicit operation set for user × database — same full-reset
     *  semantics as `applyAccess`, but grants exactly the given operations (§3). */
    applyOperations(
        conn: DbConnInfo,
        user: string,
        database: string,
        operations: readonly DbOperation[],
    ): Promise<void>
}
