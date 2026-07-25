// LIVE round-trip smoke test for database export/import: dump a seeded database
// off one server with the native tools and restore it into a DIFFERENT server,
// then assert the objects and rows actually arrived. This is the only test that
// proves the flags in `domain/db-dump.ts` work against real engines — the unit
// test can only prove the argv shape.
//
// Skipped unless QUAYKEEPER_LIVE_DB_TESTS=1, because it needs throwaway servers:
//
//   docker run -d --name qk-pg-src -e POSTGRES_PASSWORD=qkpass -p 55432:5432 postgres:16
//   docker run -d --name qk-pg-dst -e POSTGRES_PASSWORD=qkpass -p 55433:5432 postgres:17
//   docker run -d --name qk-my-src -e MYSQL_ROOT_PASSWORD=qkpass -p 33306:3306 mysql:8.0
//   docker run -d --name qk-my-dst -e MYSQL_ROOT_PASSWORD=qkpass -p 33307:3306 mysql:8.4
//   QUAYKEEPER_LIVE_DB_TESTS=1 npx vitest run quaykeeper/test/db-dump.live.test.ts
//
// The pairs are deliberately cross-version (16→17, 8.0→8.4): moving a database
// between servers of the same major is the easy case.
//
// `pg_dump`/`psql` must be on PATH. The MySQL clients are usually NOT installed
// on a dev machine, so the test writes tiny wrapper scripts that run them inside
// the `mysql:8.4` image and points QUAYKEEPER_MYSQLDUMP_BIN/QUAYKEEPER_MYSQL_BIN
// at those — which doubles as a check that the config overrides work. Those
// wrappers reach the servers as `host.docker.internal`, hence the separate
// "driver" (host-side, 127.0.0.1) and "tool" (container-side) connections below.

import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { Readable } from 'node:stream'
import { Client } from 'pg'
import mysql from 'mysql2/promise'
import { beforeAll, describe, expect, it } from 'vitest'
import type { DbConnInfo } from '@/server/infrastructure/db-drivers/types'

const LIVE = process.env.QUAYKEEPER_LIVE_DB_TESTS === '1'

// `server/config.ts` fails fast on missing env at import time, and reads the
// dump-tool overrides once — so both must be set before the dynamic import below.
if (LIVE) {
    process.env.QUAYKEEPER_GITHUB_CLIENT_ID ??= 'live-test'
    process.env.QUAYKEEPER_GITHUB_CLIENT_SECRET ??= 'live-test'
    process.env.QUAYKEEPER_OAUTH_REDIRECT_URI ??= 'http://127.0.0.1:4100/api/auth/callback'
    process.env.QUAYKEEPER_AUTH_SECRET ??= 'live-test-secret-that-is-long-enough-32'

    const bin = mkdtempSync(path.join(tmpdir(), 'qk-mysql-bin-'))
    for (const tool of ['mysqldump', 'mysql']) {
        const file = path.join(bin, tool)
        // -i keeps stdin open for the restore; MYSQL_PWD is forwarded explicitly
        // because `docker run` does not inherit the parent environment.
        writeFileSync(file, `#!/bin/sh\nexec docker run --rm -i -e MYSQL_PWD mysql:8.4 ${tool} "$@"\n`)
        chmodSync(file, 0o755)
    }
    process.env.QUAYKEEPER_MYSQLDUMP_BIN = path.join(bin, 'mysqldump')
    process.env.QUAYKEEPER_MYSQL_BIN = path.join(bin, 'mysql')
}

// Imported dynamically and ONLY when live: the module pulls in `server/config.ts`,
// which throws on missing auth env at import time — that would fail the whole file
// during a plain `npm test` instead of skipping it.
type DumpModule = typeof import('@/server/infrastructure/db-dump')
const { startDump, runRestore }: DumpModule = LIVE
    ? await import('@/server/infrastructure/db-dump')
    : ({} as DumpModule)

/** Host-side connection (the drivers, and this test's own seeding/asserting). */
const pgConn = (port: number): DbConnInfo => ({
    kind: 'postgres',
    host: '127.0.0.1',
    port,
    tls: 'off',
    user: 'postgres',
    password: 'qkpass',
})

const myConn = (port: number, host = '127.0.0.1'): DbConnInfo => ({
    kind: 'mysql',
    host,
    port,
    tls: 'off',
    user: 'root',
    password: 'qkpass',
})

const READY_TIMEOUT_MS = 90_000

async function waitFor(label: string, probe: () => Promise<void>): Promise<void> {
    const deadline = Date.now() + READY_TIMEOUT_MS
    let last: unknown
    while (Date.now() < deadline) {
        try {
            await probe()
            return
        } catch (err) {
            last = err
            await new Promise((r) => setTimeout(r, 1000))
        }
    }
    throw new Error(`${label} never became ready: ${String(last)}`)
}

async function pg<T = any>(conn: DbConnInfo, database: string, sql: string): Promise<T[]> {
    const client = new Client({ ...conn, database })
    await client.connect()
    try {
        const res = await client.query(sql)
        return res.rows as T[]
    } finally {
        await client.end().catch(() => {})
    }
}

async function my<T = any>(conn: DbConnInfo, database: string | undefined, sql: string): Promise<T[]> {
    const c = await mysql.createConnection({
        host: conn.host,
        port: conn.port,
        user: conn.user,
        password: conn.password,
        database,
    })
    try {
        const [rows] = await c.query(sql)
        return rows as T[]
    } finally {
        await c.end().catch(() => {})
    }
}

/**
 * Seed statement-by-statement, NOT through one `multipleStatements` batch. A
 * trigger created inside a multi-statement packet has its trailing `;` captured
 * into the stored body, and mysqldump then emits that body inside a version-gated
 * comment where the stray `;` terminates the CREATE before the comment closes —
 * an unrestorable dump. A MySQL quirk on the seeding side, but a fine trap.
 */
async function mySeed(conn: DbConnInfo, database: string, statements: string[]): Promise<void> {
    for (const sql of statements) await my(conn, database, sql)
}

/** Drain a dump to a string and assert the tool exited cleanly. */
async function collectDump(conn: DbConnInfo, database: string): Promise<string> {
    const run = await startDump(conn, database, { includeData: true })
    const chunks: Buffer[] = []
    for await (const chunk of run.stdout) chunks.push(chunk as Buffer)
    await run.finished
    return Buffer.concat(chunks).toString('utf8')
}

const PG_SEED = `
CREATE TYPE app_status AS ENUM ('draft', 'live');
CREATE TABLE authors (id serial PRIMARY KEY, name text NOT NULL UNIQUE);
CREATE TABLE posts (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    author_id int NOT NULL REFERENCES authors (id) ON DELETE CASCADE,
    title text NOT NULL,
    status app_status NOT NULL DEFAULT 'draft',
    body bytea,
    CONSTRAINT title_not_blank CHECK (length(title) > 0)
);
CREATE INDEX posts_status_idx ON posts (status);
CREATE VIEW live_posts AS
    SELECT p.id, p.title, a.name AS author FROM posts p JOIN authors a ON a.id = p.author_id
    WHERE p.status = 'live';
CREATE FUNCTION post_count() RETURNS bigint LANGUAGE sql STABLE AS $$ SELECT count(*) FROM posts $$;
CREATE FUNCTION trim_title() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN NEW.title := btrim(NEW.title); RETURN NEW; END $$;
CREATE TRIGGER posts_trim BEFORE INSERT ON posts FOR EACH ROW EXECUTE FUNCTION trim_title();
COMMENT ON TABLE posts IS 'moved between servers by quaykeeper';
INSERT INTO authors (name) VALUES ('ada'), ('linus');
INSERT INTO posts (author_id, title, status, body)
VALUES (1, '  first  ', 'live', '\\xdeadbeef'), (2, 'second', 'draft', NULL);
`

const MY_SEED = [
    `CREATE TABLE authors (id INT AUTO_INCREMENT PRIMARY KEY, name VARCHAR(64) NOT NULL UNIQUE) ENGINE=InnoDB`,
    `CREATE TABLE posts (
        id BIGINT AUTO_INCREMENT PRIMARY KEY,
        author_id INT NOT NULL,
        title VARCHAR(200) NOT NULL,
        status ENUM('draft','live') NOT NULL DEFAULT 'draft',
        body BLOB NULL,
        KEY posts_status_idx (status),
        CONSTRAINT posts_author_fk FOREIGN KEY (author_id) REFERENCES authors (id) ON DELETE CASCADE
    ) ENGINE=InnoDB`,
    `CREATE VIEW live_posts AS
        SELECT p.id, p.title, a.name AS author FROM posts p JOIN authors a ON a.id = p.author_id
        WHERE p.status = 'live'`,
    `CREATE TRIGGER posts_trim BEFORE INSERT ON posts FOR EACH ROW SET NEW.title = TRIM(NEW.title)`,
    `CREATE FUNCTION post_count() RETURNS BIGINT DETERMINISTIC READS SQL DATA
        RETURN (SELECT COUNT(*) FROM posts)`,
    `INSERT INTO authors (name) VALUES ('ada'), ('linus')`,
    `INSERT INTO posts (author_id, title, status, body)
        VALUES (1, '  first  ', 'live', UNHEX('deadbeef')), (2, 'second', 'draft', NULL)`,
]

describe.skipIf(!LIVE)('postgres export → import into another server', () => {
    const src = pgConn(55432)
    const dst = pgConn(55433)

    beforeAll(async () => {
        await waitFor('postgres:16 source', () => pg(src, 'postgres', 'SELECT 1').then(() => undefined))
        await waitFor('postgres:17 target', () => pg(dst, 'postgres', 'SELECT 1').then(() => undefined))
        await pg(src, 'postgres', `DROP DATABASE IF EXISTS app_db`)
        await pg(src, 'postgres', `CREATE DATABASE app_db`)
        await pg(src, 'app_db', PG_SEED)
        await pg(dst, 'postgres', `DROP DATABASE IF EXISTS app_db_copy`)
        await pg(dst, 'postgres', `CREATE DATABASE app_db_copy`)
    }, READY_TIMEOUT_MS * 2)

    it('moves schema, data, and behaviour to a database with a different name', async () => {
        const sql = await collectDump(src, 'app_db')
        // No ownership/ACL statements — the target has no `quaykeeper_*` roles.
        expect(sql).not.toMatch(/^ALTER TABLE .* OWNER TO/m)
        expect(sql).not.toMatch(/^GRANT /m)
        // Not pinned to the source database name.
        expect(sql).not.toMatch(/^CREATE DATABASE /m)

        await runRestore(dst, 'app_db_copy', Readable.from(sql))

        const rows = await pg(dst, 'app_db_copy', `SELECT title, status, octet_length(body) AS len FROM posts ORDER BY id`)
        expect(rows).toEqual([
            { title: 'first', status: 'live', len: 4 },
            { title: 'second', status: 'draft', len: null },
        ])

        // The view, the function, the enum type, the index, and the comment.
        expect(await pg(dst, 'app_db_copy', `SELECT author FROM live_posts`)).toEqual([{ author: 'ada' }])
        expect(await pg(dst, 'app_db_copy', `SELECT post_count() AS n`)).toEqual([{ n: '2' }])
        expect(await pg(dst, 'app_db_copy', `SELECT 'live'::app_status AS s`)).toEqual([{ s: 'live' }])
        expect(
            await pg(dst, 'app_db_copy', `SELECT indexname FROM pg_indexes WHERE indexname = 'posts_status_idx'`),
        ).toHaveLength(1)
        expect(
            await pg(dst, 'app_db_copy', `SELECT obj_description('posts'::regclass) AS c`),
        ).toEqual([{ c: 'moved between servers by quaykeeper' }])

        // The trigger and the FK are live, not just present in the catalog.
        await pg(dst, 'app_db_copy', `INSERT INTO posts (author_id, title) VALUES (1, '  third  ')`)
        expect(await pg(dst, 'app_db_copy', `SELECT title FROM posts WHERE id = 3`)).toEqual([{ title: 'third' }])
        await expect(
            pg(dst, 'app_db_copy', `INSERT INTO posts (author_id, title) VALUES (99, 'orphan')`),
        ).rejects.toThrow(/foreign key/i)
    }, 120_000)

    it('dumps structure only when data is excluded', async () => {
        const run = await startDump(src, 'app_db', { includeData: false })
        const chunks: Buffer[] = []
        for await (const chunk of run.stdout) chunks.push(chunk as Buffer)
        await run.finished
        const sql = Buffer.concat(chunks).toString('utf8')
        expect(sql).toContain('CREATE TABLE')
        expect(sql).not.toContain('COPY public."posts"')
        expect(sql).not.toContain('ada')
    }, 60_000)

    it('reports a missing database as an error instead of an empty dump', async () => {
        await expect(collectDump(src, 'no_such_db')).rejects.toThrow(/does not exist/i)
    }, 60_000)
})

describe.skipIf(!LIVE)('mysql export → import into another server', () => {
    const srcDriver = myConn(33306)
    const dstDriver = myConn(33307)
    // The dump/restore clients run inside a container, so they address the
    // published ports through the docker host alias.
    const srcTool = myConn(33306, 'host.docker.internal')
    const dstTool = myConn(33307, 'host.docker.internal')

    beforeAll(async () => {
        await waitFor('mysql:8.0 source', () => my(srcDriver, undefined, 'SELECT 1').then(() => undefined))
        await waitFor('mysql:8.4 target', () => my(dstDriver, undefined, 'SELECT 1').then(() => undefined))
        await my(srcDriver, undefined, `DROP DATABASE IF EXISTS app_db`)
        await my(srcDriver, undefined, `CREATE DATABASE app_db`)
        await mySeed(srcDriver, 'app_db', MY_SEED)
        await my(dstDriver, undefined, `DROP DATABASE IF EXISTS app_db_copy`)
        await my(dstDriver, undefined, `CREATE DATABASE app_db_copy`)
    }, READY_TIMEOUT_MS * 2)

    it('moves schema, data, and behaviour to a database with a different name', async () => {
        const sql = await collectDump(srcTool, 'app_db')
        expect(sql).not.toMatch(/^CREATE DATABASE/m)
        expect(sql).not.toMatch(/^USE /m)
        expect(sql).not.toContain('GTID_PURGED')
        // Routines and triggers came along — the reason `--routines --triggers`
        // and a client that understands DELIMITER are non-negotiable.
        expect(sql).toContain('post_count')
        expect(sql).toContain('posts_trim')

        await runRestore(dstTool, 'app_db_copy', Readable.from(sql))

        const rows = await my(
            dstDriver,
            'app_db_copy',
            `SELECT title, status, LENGTH(body) AS len FROM posts ORDER BY id`,
        )
        expect(rows.map((r) => ({ ...r }))).toEqual([
            { title: 'first', status: 'live', len: 4 },
            { title: 'second', status: 'draft', len: null },
        ])

        expect(await my(dstDriver, 'app_db_copy', `SELECT author FROM live_posts`)).toEqual([{ author: 'ada' }])
        expect(await my(dstDriver, 'app_db_copy', `SELECT post_count() AS n`)).toEqual([{ n: 2 }])

        await my(dstDriver, 'app_db_copy', `INSERT INTO posts (author_id, title) VALUES (1, '  third  ')`)
        expect(await my(dstDriver, 'app_db_copy', `SELECT title FROM posts WHERE id = 3`)).toEqual([
            { title: 'third' },
        ])
        await expect(
            my(dstDriver, 'app_db_copy', `INSERT INTO posts (author_id, title) VALUES (99, 'orphan')`),
        ).rejects.toThrow(/foreign key/i)
    }, 180_000)

    it('dumps structure only when data is excluded', async () => {
        const run = await startDump(srcTool, 'app_db', { includeData: false })
        const chunks: Buffer[] = []
        for await (const chunk of run.stdout) chunks.push(chunk as Buffer)
        await run.finished
        const sql = Buffer.concat(chunks).toString('utf8')
        expect(sql).toContain('CREATE TABLE')
        expect(sql).not.toContain('INSERT INTO')
    }, 60_000)

    it('fails the restore instead of half-applying a broken dump', async () => {
        await my(dstDriver, undefined, `DROP DATABASE IF EXISTS app_db_broken`)
        await my(dstDriver, undefined, `CREATE DATABASE app_db_broken`)
        const broken = `CREATE TABLE ok_first (id INT PRIMARY KEY);\nTHIS IS NOT SQL;\n`
        await expect(runRestore(dstTool, 'app_db_broken', Readable.from(broken))).rejects.toThrow(/syntax/i)
    }, 60_000)
})
