import { describe, it, expect, vi } from 'vitest'
import { BaseRepository, BaseRepositoryOptions } from '../src/BaseRepository'

/** Minimal concrete subclass that exposes `time` for testing. */
class TestRepo extends BaseRepository<any, null> {
    constructor(options: BaseRepositoryOptions = {}) {
        super(null, 'test', 'id', options)
    }

    run_time<T>(label: string, fn: () => Promise<T>): Promise<T> {
        return this.time(label, fn)
    }
}

describe('BaseRepository.time — telemetry guard', () => {
    it('returns the fn value even when onOperation throws', async () => {
        const repo = new TestRepo({
            onOperation: () => { throw new Error('telemetry exploded') },
        })
        const result = await repo.run_time('op', async () => 42)
        expect(result).toBe(42)
    })

    it('rethrows the real DB error even when onOperation throws', async () => {
        const dbError = new Error('db failure')
        const repo = new TestRepo({
            onOperation: () => { throw new Error('telemetry exploded') },
        })
        await expect(repo.run_time('op', async () => { throw dbError })).rejects.toThrow('db failure')
    })

    it('returns the fn value even when logger.warn throws', async () => {
        const repo = new TestRepo({
            slowQueryMs: 0,
            logger: { warn: () => { throw new Error('logger blew up') } } as any,
        })
        const result = await repo.run_time('op', async () => 'ok')
        expect(result).toBe('ok')
    })

    it('returns the fn value even when logger.debug throws', async () => {
        const repo = new TestRepo({
            slowQueryMs: 9999,
            logger: { debug: () => { throw new Error('logger blew up') } } as any,
        })
        const result = await repo.run_time('op', async () => 'ok')
        expect(result).toBe('ok')
    })

    it('calls onOperation with the real db error even on success path', async () => {
        const hook = vi.fn()
        const repo = new TestRepo({ onOperation: hook })
        await repo.run_time('insert', async () => 1)
        expect(hook).toHaveBeenCalledOnce()
        expect(hook.mock.calls[0][0]).toMatchObject({ op: 'insert', source: 'test' })
        expect(hook.mock.calls[0][0].error).toBeUndefined()
    })

    it('passes the db error to onOperation when fn throws', async () => {
        const hook = vi.fn()
        const dbError = new Error('connection lost')
        const repo = new TestRepo({ onOperation: hook })
        await expect(repo.run_time('find', async () => { throw dbError })).rejects.toThrow('connection lost')
        expect(hook).toHaveBeenCalledOnce()
        expect(hook.mock.calls[0][0].error).toBe(dbError)
    })
})
