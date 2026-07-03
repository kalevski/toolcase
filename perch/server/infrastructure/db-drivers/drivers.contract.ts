// Live driver contract (perch_database_management.md §12): the full
// create → grant → classify → revoke → drop round-trip against real servers.
// Run via `npm run test:drivers` with PERCH_CONTRACT_PG / PERCH_CONTRACT_MYSQL
// URLs exported (see vitest.drivers.config.ts for the docker one-liners); an
// unset engine skips. Deliberately excluded from the default vitest run.

import { describe, it, expect, afterAll } from 'vitest'
import type { DbConnInfo, DbDriver } from '@/server/infrastructure/db-drivers/types'
import { postgresDriver } from '@/server/infrastructure/db-drivers/postgres'
import { mysqlDriver } from '@/server/infrastructure/db-drivers/mysql'
import type { DbServerKind } from '@/server/domain/types'

const DB = 'perch_contract_db'
const USER = 'perch_contract_user'
const PASSWORD = 'Contract!Pass#42'

function connFromUrl(kind: DbServerKind, raw: string): DbConnInfo {
    const url = new URL(raw)
    return {
        kind,
        host: url.hostname,
        port: Number(url.port) || (kind === 'postgres' ? 5432 : 3306),
        tls: 'off',
        user: decodeURIComponent(url.username),
        password: decodeURIComponent(url.password),
    }
}

function roundTrip(kind: DbServerKind, driver: DbDriver, conn: DbConnInfo) {
    // Best-effort cleanup so a crashed previous run never wedges the next one.
    const cleanup = async () => {
        await driver.dropDatabase(conn, DB).catch(() => {})
        await driver.dropUser(conn, USER).catch(() => {})
    }
    afterAll(cleanup)

    it('pings', async () => {
        await driver.ping(conn)
    })

    it('creates a database and lists it', async () => {
        await cleanup()
        await driver.createDatabase(conn, DB)
        const dbs = await driver.listDatabases(conn)
        expect(dbs.map((d) => d.name)).toContain(DB)
    })

    it('creates a user and lists it', async () => {
        await driver.createUser(conn, USER, PASSWORD)
        const users = await driver.listUsers(conn)
        const created = users.find((u) => u.name === USER)
        expect(created).toBeDefined()
        expect(created!.superuser).toBe(false)
    })

    it('classifies a fresh database with no explicit grants as none', async () => {
        // Regression: a fresh Postgres database has a NULL datacl, and empty
        // ACL arrays are zero-dimensional — the matrix query must not feed
        // either through aclexplode (`ACL arrays must be one-dimensional`, 22023).
        const grants = await driver.listGrants(conn, [DB], [USER])
        expect(grants).toEqual([{ user: USER, database: DB, level: 'none' }])
    })

    it('walks every access level and classifies each back', async () => {
        for (const level of ['read', 'readwrite', 'owner', 'none'] as const) {
            await driver.applyAccess(conn, USER, DB, level)
            const grants = await driver.listGrants(conn, [DB], [USER])
            expect(grants).toHaveLength(1)
            expect(grants[0]).toMatchObject({ user: USER, database: DB, level })
        }
    })

    it('resets the password', async () => {
        await driver.setPassword(conn, USER, `${PASSWORD}x`)
    })

    it('drops the user and database', async () => {
        await driver.dropUser(conn, USER)
        expect((await driver.listUsers(conn)).map((u) => u.name)).not.toContain(USER)
        await driver.dropDatabase(conn, DB)
        expect((await driver.listDatabases(conn)).map((d) => d.name)).not.toContain(DB)
    })
}

const pgUrl = process.env.PERCH_CONTRACT_PG
const myUrl = process.env.PERCH_CONTRACT_MYSQL

// A skipped describe still runs its factory at collection, so only parse the
// URL for an engine that is actually configured — with one env var set, the
// other suite must skip, not crash on `new URL(undefined)`.
describe.skipIf(!pgUrl)('postgres driver contract', () => {
    if (pgUrl) roundTrip('postgres', postgresDriver, connFromUrl('postgres', pgUrl))
})

describe.skipIf(!myUrl)('mysql driver contract', () => {
    if (myUrl) roundTrip('mysql', mysqlDriver, connFromUrl('mysql', myUrl))
})
