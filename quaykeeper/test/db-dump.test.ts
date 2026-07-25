// Pure argv/env builders for the native dump + restore tools
// (`server/domain/db-dump.ts`). These strings ARE the contract with pg_dump /
// psql / mysqldump / mysql, and a wrong flag is a failed export rather than a
// compile error — so the shapes are asserted here rather than trusted.

import { describe, expect, it } from 'vitest'
import {
    databaseNameFromDumpFileName,
    dumpFileName,
    mysqlDumpArgs,
    mysqlEnv,
    mysqlRestoreArgs,
    pgDumpArgs,
    pgEnv,
    psqlRestoreArgs,
    type DumpTarget,
} from '@/server/domain/db-dump'

const PG: DumpTarget = { kind: 'postgres', host: 'db.example', port: 5432, tls: 'require', user: 'quaykeeper_admin' }
const MY: DumpTarget = { kind: 'mysql', host: 'db.example', port: 3306, tls: 'off', user: 'quaykeeper_admin' }

const PASSWORD = 'sup3r-s3cret'

describe('pgDumpArgs', () => {
    it('emits a plain, portable dump with no ownership or ACL statements', () => {
        const args = pgDumpArgs(PG, 'app_db', { includeData: true })
        expect(args).toContain('--format=plain')
        expect(args).toContain('--no-owner')
        expect(args).toContain('--no-privileges')
        expect(args).toContain('--quote-all-identifiers')
        // `--create` would pin the dump to its original database name, defeating
        // "export from one server, import into a differently named database".
        expect(args).not.toContain('--create')
        expect(args.at(-1)).toBe('--dbname=app_db')
    })

    it('never prompts for a password (a prompt would hang the request)', () => {
        expect(pgDumpArgs(PG, 'app_db', { includeData: true })).toContain('--no-password')
        expect(psqlRestoreArgs(PG, 'app_db')).toContain('--no-password')
    })

    it('adds --schema-only only when data is excluded', () => {
        expect(pgDumpArgs(PG, 'app_db', { includeData: true })).not.toContain('--schema-only')
        expect(pgDumpArgs(PG, 'app_db', { includeData: false })).toContain('--schema-only')
    })

    it('passes host/port/user on argv', () => {
        const args = pgDumpArgs(PG, 'app_db', { includeData: true })
        expect(args.join(' ')).toContain('--host db.example')
        expect(args.join(' ')).toContain('--port 5432')
        expect(args.join(' ')).toContain('--username quaykeeper_admin')
    })
})

describe('psqlRestoreArgs', () => {
    it('aborts and rolls back on the first error, reading the dump from stdin', () => {
        const args = psqlRestoreArgs(PG, 'app_db')
        expect(args).toContain('--set=ON_ERROR_STOP=1')
        expect(args).toContain('--single-transaction')
        expect(args).toContain('--no-psqlrc')
        expect(args).toContain('--dbname=app_db')
        expect(args).toContain('--file=-')
    })
})

describe('pgEnv', () => {
    it('carries the password and maps tls to a sslmode matching the pg driver', () => {
        expect(pgEnv(PG, PASSWORD)).toMatchObject({ PGPASSWORD: PASSWORD, PGSSLMODE: 'verify-full' })
        expect(pgEnv({ ...PG, tls: 'off' }, PASSWORD).PGSSLMODE).toBe('disable')
    })
})

describe('mysqlDumpArgs', () => {
    it('emits a consistent, restore-portable dump', () => {
        const args = mysqlDumpArgs(MY, 'app_db', { includeData: true })
        expect(args).toContain('--single-transaction')
        expect(args).toContain('--routines')
        expect(args).toContain('--triggers')
        expect(args).toContain('--events')
        expect(args).toContain('--hex-blob')
        // Replication state in a dump breaks a restore into a different server.
        expect(args).toContain('--set-gtid-purged=OFF')
        expect(args).toContain('--no-tablespaces')
    })

    it('names the database positionally (--databases would emit CREATE DATABASE/USE)', () => {
        expect(mysqlDumpArgs(MY, 'app_db', { includeData: true }).at(-1)).toBe('app_db')
        expect(mysqlDumpArgs(MY, 'app_db', { includeData: true })).not.toContain('--databases')
    })

    it('keeps --no-data ahead of the positional database name', () => {
        const args = mysqlDumpArgs(MY, 'app_db', { includeData: false })
        expect(args.indexOf('--no-data')).toBeLessThan(args.indexOf('app_db'))
    })

    it('maps tls to an ssl-mode', () => {
        expect(mysqlDumpArgs(MY, 'app_db', { includeData: true })).toContain('--ssl-mode=DISABLED')
        expect(mysqlDumpArgs({ ...MY, tls: 'require' }, 'app_db', { includeData: true })).toContain(
            '--ssl-mode=VERIFY_IDENTITY',
        )
    })
})

describe('mysqlRestoreArgs', () => {
    it('runs non-interactively against the target database', () => {
        const args = mysqlRestoreArgs(MY, 'app_db')
        expect(args).toContain('--batch')
        expect(args).toContain('--database=app_db')
        // `--force` would carry on past a failed statement, leaving a partial
        // restore behind.
        expect(args).not.toContain('--force')
    })
})

describe('credentials never reach argv', () => {
    it('keeps the password out of every command line (/proc/<pid>/cmdline is world-readable)', () => {
        const lines = [
            pgDumpArgs(PG, 'app_db', { includeData: true }),
            psqlRestoreArgs(PG, 'app_db'),
            mysqlDumpArgs(MY, 'app_db', { includeData: true }),
            mysqlRestoreArgs(MY, 'app_db'),
        ]
        for (const args of lines) expect(args.join(' ')).not.toContain(PASSWORD)
        // …and only ever the environment.
        expect(pgEnv(PG, PASSWORD).PGPASSWORD).toBe(PASSWORD)
        expect(mysqlEnv(PASSWORD).MYSQL_PWD).toBe(PASSWORD)
    })
})

describe('dumpFileName', () => {
    const at = new Date(2026, 6, 25, 9, 4, 5) // local time — the name is for a human

    it('slugs the free-text server name and stamps the clock', () => {
        expect(dumpFileName('Prod PG (eu-west)', 'app_db', at)).toBe(
            'quaykeeper-prod-pg-eu-west-app_db-20260725-090405.sql',
        )
    })

    it('survives a server name with no usable characters', () => {
        expect(dumpFileName('!!!', 'app_db', at)).toBe('quaykeeper-server-app_db-20260725-090405.sql')
    })
})

describe('databaseNameFromDumpFileName', () => {
    it('round-trips a name this app produced', () => {
        const name = dumpFileName('Prod PG (eu-west)', 'app_db', new Date(2026, 6, 25, 9, 4, 5))
        expect(databaseNameFromDumpFileName(name)).toBe('app_db')
    })

    it('is not fooled by hyphens in the server slug', () => {
        expect(databaseNameFromDumpFileName('quaykeeper-a-b-c-my_db-20260725-090405.sql')).toBe('my_db')
    })

    it('returns null for anything else rather than guessing a write target', () => {
        expect(databaseNameFromDumpFileName('backup.sql')).toBeNull()
        expect(databaseNameFromDumpFileName('quaykeeper-srv-app_db.sql')).toBeNull()
        expect(databaseNameFromDumpFileName('pg_dump-app_db-20260725-090405.sql')).toBeNull()
    })
})
