// Native dump/restore runner (Databases → Export / Import). Spawns `pg_dump` /
// `mysqldump` (export) or `psql` / `mysql` (import) on the QUAYKEEPER HOST and
// wires the child's stdio straight to the HTTP request: the dump streams out
// without ever being buffered whole, and an uploaded .sql streams into the
// client's stdin. Nothing touches disk.
//
// Argv and env come from the pure builders in `domain/db-dump.ts`; this module
// owns only process lifecycle — spawn, timeout kill, bounded stderr, exit-code
// mapping — and translates failures into the errors the routes already know:
// `DbDriverError` → 502 with the tool's own message.
//
// SECURITY:
//   • The admin password travels in the child ENV (PGPASSWORD / MYSQL_PWD),
//     never argv — see the header of `domain/db-dump.ts`.
//   • The child env is REPLACED, not extended: only PATH plus the tool's own
//     variables are passed, so quaykeeper's own secrets (auth secret, realm key,
//     OAuth client secret) are not inherited by a process that prints
//     diagnostics to a stream the browser downloads.

import 'server-only'
import { spawn, type ChildProcess } from 'node:child_process'
import type { Readable } from 'node:stream'
import { config } from '@/server/config'
import {
    mysqlDumpArgs,
    mysqlEnv,
    mysqlRestoreArgs,
    pgDumpArgs,
    pgEnv,
    psqlRestoreArgs,
    type DumpOptions,
} from '@/server/domain/db-dump'
import { DbDriverError, type DbConnInfo } from '@/server/infrastructure/db-drivers'

/** How much of a failing tool's stderr is kept for the error message. The FIRST
 *  bytes, not the last: psql stops at the first error (ON_ERROR_STOP), and for
 *  pg_dump/mysqldump the opening line is the whole story. */
const STDERR_CAP_BYTES = 16 * 1024

/** The tool isn't installed on the quaykeeper host (spawn ENOENT). A deployment
 *  problem, not a database problem — the service maps it to its own code so the
 *  UI can say "install postgresql-client" instead of blaming the server. */
export class DumpToolMissingError extends Error {
    constructor(public readonly bin: string) {
        super(`"${bin}" was not found on the quaykeeper host`)
        this.name = 'DumpToolMissingError'
    }
}

/** The upload exceeded `QUAYKEEPER_DB_IMPORT_MAX_BYTES`. */
export class ImportTooLargeError extends Error {
    constructor(public readonly maxBytes: number) {
        super(`the uploaded dump exceeds the ${maxBytes}-byte import limit`)
        this.name = 'ImportTooLargeError'
    }
}

interface ToolSpec {
    bin: string
    args: string[]
    env: Record<string, string>
}

function dumpSpec(conn: DbConnInfo, database: string, opts: DumpOptions): ToolSpec {
    return conn.kind === 'postgres'
        ? { bin: config.pgDumpBin, args: pgDumpArgs(conn, database, opts), env: pgEnv(conn, conn.password) }
        : { bin: config.mysqlDumpBin, args: mysqlDumpArgs(conn, database, opts), env: mysqlEnv(conn.password) }
}

function restoreSpec(conn: DbConnInfo, database: string): ToolSpec {
    return conn.kind === 'postgres'
        ? { bin: config.psqlBin, args: psqlRestoreArgs(conn, database), env: pgEnv(conn, conn.password) }
        : { bin: config.mysqlBin, args: mysqlRestoreArgs(conn, database), env: mysqlEnv(conn.password) }
}

/**
 * The child's environment: PATH so the tool resolves, plus its own variables.
 * Deliberately NOT `{ ...process.env }` — quaykeeper's auth secret, realm key, and
 * OAuth client secret have no business inside a process whose stderr is quoted
 * back to the browser.
 */
function childEnv(toolEnv: Record<string, string>): NodeJS.ProcessEnv {
    // NODE_ENV is carried only because Next's ProcessEnv augmentation declares it
    // required; the dump tools ignore it.
    return { PATH: process.env.PATH ?? '', NODE_ENV: process.env.NODE_ENV, ...toolEnv }
}

/** Collector for a child's stderr, capped at the first {@link STDERR_CAP_BYTES}. */
function captureStderr(child: ChildProcess): () => string {
    const chunks: Buffer[] = []
    let bytes = 0
    child.stderr?.on('data', (d: Buffer) => {
        if (bytes >= STDERR_CAP_BYTES) return
        const slice = d.subarray(0, STDERR_CAP_BYTES - bytes)
        chunks.push(slice)
        bytes += slice.length
    })
    // Decode ONCE at the end: a per-chunk toString splits multibyte UTF-8 at
    // chunk boundaries and litters the message with U+FFFD.
    return () => Buffer.concat(chunks).toString('utf8').trim()
}

/**
 * Wait for the spawn to succeed or fail. `spawn()` itself is synchronous and
 * never throws for a missing binary — ENOENT arrives later as an 'error' event —
 * so a route that streamed a 200 immediately would emit an empty download
 * instead of an error. Settling here keeps "tool missing / host unreachable"
 * inside the response-status window.
 */
function awaitSpawn(child: ChildProcess, bin: string): Promise<void> {
    return new Promise((resolve, reject) => {
        child.once('spawn', resolve)
        child.once('error', (err: NodeJS.ErrnoException) => {
            reject(err.code === 'ENOENT' ? new DumpToolMissingError(bin) : new DbDriverError(String(err.message)))
        })
    })
}

/** Arm the wall-clock cap. SIGKILL, not SIGTERM: psql traps SIGTERM mid-copy. */
function armTimeout(child: ChildProcess): { timedOut: () => boolean; clear: () => void } {
    let fired = false
    const timer = setTimeout(() => {
        fired = true
        child.kill('SIGKILL')
    }, config.dbDumpTimeoutMs)
    // Never hold the event loop open on quaykeeper's account.
    timer.unref?.()
    return { timedOut: () => fired, clear: () => clearTimeout(timer) }
}

function exitError(bin: string, code: number | null, stderr: string, timedOut: boolean): DbDriverError {
    if (timedOut) {
        return new DbDriverError(
            `${bin} was killed after ${Math.round(config.dbDumpTimeoutMs / 1000)}s ` +
                `(QUAYKEEPER_DB_DUMP_TIMEOUT_MS)`,
        )
    }
    return new DbDriverError(stderr || `${bin} exited with code ${code ?? 'null'}`)
}

export interface DumpRun {
    /** The dump bytes. Destroyed if the tool exits non-zero, so a truncated
     *  download surfaces as a broken response rather than a silently short file. */
    stdout: Readable
    /** Resolves on a clean exit, rejects with `DbDriverError` otherwise. The
     *  route has already responded by then — this is what probe bookkeeping and
     *  the server log hang off. */
    finished: Promise<void>
}

/**
 * Start a dump. Resolves once the tool is running (so a missing binary or an
 * immediate refusal is still an HTTP error); the caller streams `stdout` to the
 * client and watches `finished` for the outcome.
 */
export async function startDump(conn: DbConnInfo, database: string, opts: DumpOptions): Promise<DumpRun> {
    const { bin, args, env } = dumpSpec(conn, database, opts)
    // Annotated as ChildProcess: the stdio tuple makes TS pick an overload whose
    // stream types conflict, collapsing the result to `never`.
    const child: ChildProcess = spawn(bin, args, {
        env: childEnv(env),
        stdio: ['ignore', 'pipe', 'pipe'],
    })
    const stderr = captureStderr(child)
    await awaitSpawn(child, bin)
    const timeout = armTimeout(child)

    const finished = new Promise<void>((resolve, reject) => {
        child.once('close', (code) => {
            timeout.clear()
            if (code === 0 && !timeout.timedOut()) {
                resolve()
                return
            }
            const err = exitError(bin, code, stderr(), timeout.timedOut())
            // Break the response body: the client must not mistake a partial
            // dump for a complete one.
            child.stdout?.destroy(err)
            reject(err)
        })
    })

    return { stdout: child.stdout!, finished }
}

/**
 * Restore an uploaded .sql into `database`. Streams `sql` into the client's
 * stdin, enforcing the byte cap as it goes, and resolves only on a clean exit.
 */
export async function runRestore(conn: DbConnInfo, database: string, sql: Readable): Promise<void> {
    const { bin, args, env } = restoreSpec(conn, database)
    const child: ChildProcess = spawn(bin, args, {
        env: childEnv(env),
        stdio: ['pipe', 'pipe', 'pipe'],
    })
    const stderr = captureStderr(child)
    // psql --quiet still reports NOTICEs on stdout; keep them for the message
    // when stderr is empty.
    const stdout = (() => {
        const chunks: Buffer[] = []
        let bytes = 0
        child.stdout?.on('data', (d: Buffer) => {
            if (bytes >= STDERR_CAP_BYTES) return
            const slice = d.subarray(0, STDERR_CAP_BYTES - bytes)
            chunks.push(slice)
            bytes += slice.length
        })
        return () => Buffer.concat(chunks).toString('utf8').trim()
    })()

    await awaitSpawn(child, bin)
    const timeout = armTimeout(child)

    let tooLarge = false
    let uploaded = 0
    const stdin = child.stdin!
    // A client that stops at the first error (ON_ERROR_STOP / mysql --batch)
    // closes stdin while we are still writing. That EPIPE is EXPECTED: the real
    // diagnosis is the exit code + stderr, so swallow it here and let 'close'
    // below produce the error.
    stdin.on('error', () => {})

    const piped = new Promise<void>((resolve, reject) => {
        sql.on('data', (chunk: Buffer | string) => {
            uploaded += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length
            if (uploaded > config.dbImportMaxBytes && !tooLarge) {
                tooLarge = true
                sql.destroy()
                child.kill('SIGKILL')
            }
        })
        sql.on('error', (err) => {
            // A dropped upload (browser navigated away, connection reset) would
            // otherwise reach the client as a truncated script — which
            // `--single-transaction` could still COMMIT if the cut happened to
            // land on a statement boundary. Kill it instead of half-restoring.
            child.kill('SIGKILL')
            reject(err)
        })
        stdin.on('close', resolve)
        sql.pipe(stdin)
    })

    const closed = new Promise<void>((resolve, reject) => {
        child.once('close', (code) => {
            timeout.clear()
            if (tooLarge) {
                reject(new ImportTooLargeError(config.dbImportMaxBytes))
                return
            }
            if (code === 0 && !timeout.timedOut()) {
                resolve()
                return
            }
            reject(exitError(bin, code, stderr() || stdout(), timeout.timedOut()))
        })
    })

    // The child's exit is authoritative; the pipe promise only surfaces a broken
    // upload (a dropped connection mid-POST), which `closed` would otherwise
    // report as a confusing SQL syntax error.
    await Promise.all([closed, piped.catch(() => {})])
}
