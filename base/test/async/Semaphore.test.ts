import { describe, it, expect } from 'vitest'
import Semaphore from '../../src/async/Semaphore'

describe('Semaphore', () => {

    it('throws when permits is not a positive integer', () => {
        expect(() => new Semaphore(0)).toThrow('permits must be a positive integer')
        expect(() => new Semaphore(-1)).toThrow('permits must be a positive integer')
        expect(() => new Semaphore(1.5)).toThrow('permits must be a positive integer')
    })

    it('available reflects the permit count', () => {
        const s = new Semaphore(3)
        expect(s.available).toBe(3)
    })

    it('acquire decrements available and release increments it', async () => {
        const s = new Semaphore(2)
        await s.acquire()
        expect(s.available).toBe(1)
        await s.acquire()
        expect(s.available).toBe(0)
        s.release()
        expect(s.available).toBe(1)
    })

    it('acquire blocks when permits are exhausted and unblocks on release', async () => {
        const s = new Semaphore(1)
        await s.acquire()
        let resolved = false
        const p = s.acquire().then(() => { resolved = true })
        expect(resolved).toBe(false)
        s.release()
        await p
        expect(resolved).toBe(true)
    })

    it('run() acquires, runs fn, and releases even on error', async () => {
        const s = new Semaphore(1)
        await expect(s.run(() => Promise.reject(new Error('fail')))).rejects.toThrow('fail')
        expect(s.available).toBe(1)
    })

    it('run() limits concurrency to the permit count', async () => {
        const s = new Semaphore(2)
        let concurrent = 0
        let maxConcurrent = 0

        const task = () => s.run(async () => {
            concurrent++
            maxConcurrent = Math.max(maxConcurrent, concurrent)
            await Promise.resolve()
            concurrent--
        })

        await Promise.all([task(), task(), task(), task()])
        expect(maxConcurrent).toBeLessThanOrEqual(2)
    })

    it('run() returns the fn result', async () => {
        const s = new Semaphore(1)
        const result = await s.run(() => 'hello')
        expect(result).toBe('hello')
    })

})
