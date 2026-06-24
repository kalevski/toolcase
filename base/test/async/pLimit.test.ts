import { describe, it, expect } from 'vitest'
import pLimit from '../../src/async/pLimit'

describe('pLimit', () => {

    it('throws when concurrency is not a positive integer', () => {
        expect(() => pLimit(0)).toThrow('concurrency must be a positive integer')
        expect(() => pLimit(-1)).toThrow('concurrency must be a positive integer')
        expect(() => pLimit(1.5)).toThrow('concurrency must be a positive integer')
    })

    it('returns a function', () => {
        expect(typeof pLimit(1)).toBe('function')
    })

    it('runs a single task and returns its result', async () => {
        const limit = pLimit(1)
        const result = await limit(() => Promise.resolve(42))
        expect(result).toBe(42)
    })

    it('limits concurrency to the specified count', async () => {
        const limit = pLimit(2)
        let concurrent = 0
        let maxConcurrent = 0

        const task = (n: number) => limit(async () => {
            concurrent++
            maxConcurrent = Math.max(maxConcurrent, concurrent)
            await new Promise<void>(resolve => setTimeout(resolve, n))
            concurrent--
            return concurrent
        })

        await Promise.all([task(10), task(10), task(10), task(10)])
        expect(maxConcurrent).toBeLessThanOrEqual(2)
    })

    it('propagates rejection from the task', async () => {
        const limit = pLimit(1)
        await expect(limit(() => Promise.reject(new Error('bad')))).rejects.toThrow('bad')
    })

    it('limit(1) serialises tasks', async () => {
        const limit = pLimit(1)
        const order: number[] = []
        await Promise.all([
            limit(async () => { await Promise.resolve(); order.push(1) }),
            limit(async () => { order.push(2) }),
        ])
        expect(order[0]).toBe(1)
    })

})
