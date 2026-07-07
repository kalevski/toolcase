import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

// Bug 12: a failed COMMIT used to trigger a ROLLBACK on an already-resolved
// transaction, and that ROLLBACK's own failure replaced the original commit
// error — masking the real cause. Real `node:sqlite` DB (same pattern as
// jobs-exec.integration.test.ts).

let db: typeof import('@/server/data/db')

beforeAll(async () => {
    const dir = mkdtempSync(path.join(tmpdir(), 'qk-db-tx-test-'))
    process.env.QUAYKEEPER_DB_PATH = path.join(dir, 'test.db')
    db = await import('@/server/data/db')
    db.initDb()
})

describe('tx', () => {
    it('commits and returns fn()\'s result on the happy path', () => {
        const result = db.tx(() => 42)
        expect(result).toBe(42)
    })

    it('rolls back and rethrows the original error when fn() throws', () => {
        expect(() =>
            db.tx(() => {
                throw new Error('boom')
            }),
        ).toThrow('boom')
    })

    it('surfaces the original COMMIT error, not a masking ROLLBACK error', () => {
        // fn() commits the transaction itself (simulating whatever internal state
        // leads to a failed COMMIT) — tx()'s own COMMIT then has nothing to commit,
        // and its own ROLLBACK attempt (pre-fix) would fail too, previously masking
        // the original error.
        let caught: unknown
        try {
            db.tx(() => {
                db.exec('COMMIT')
                return 'unreachable-return-value'
            })
        } catch (err) {
            caught = err
        }
        expect(caught).toBeInstanceOf(Error)
        const message = (caught as Error).message
        expect(message).toMatch(/commit/i)
        expect(message).not.toMatch(/rollback/i)
    })

    it('nested tx() joins the outer transaction (reentrant)', () => {
        const result = db.tx(() => db.tx(() => 'inner'))
        expect(result).toBe('inner')
    })
})
