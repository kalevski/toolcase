import { describe, it, expect } from 'vitest'
import AsyncQueue from '../../src/async/AsyncQueue'

describe('AsyncQueue', () => {

    it('throws when capacity is not a positive integer', () => {
        expect(() => new AsyncQueue(0)).toThrow('capacity must be a positive integer')
        expect(() => new AsyncQueue(-1)).toThrow('capacity must be a positive integer')
        expect(() => new AsyncQueue(1.5)).toThrow('capacity must be a positive integer')
    })

    it('accepts Infinity capacity (unbounded)', () => {
        expect(() => new AsyncQueue(Infinity)).not.toThrow()
        expect(() => new AsyncQueue()).not.toThrow()
    })

    it('push throws when item is undefined', () => {
        const q = new AsyncQueue<number>()
        expect(() => q.push(undefined as any)).toThrow('item can not be undefined')
    })

    it('push throws when queue is closed', async () => {
        const q = new AsyncQueue<number>()
        q.close()
        expect(() => q.push(1)).toThrow('queue is closed')
    })

    it('pull rejects when queue is closed and empty', async () => {
        const q = new AsyncQueue<number>()
        q.close()
        await expect(q.pull()).rejects.toThrow('queue is closed')
    })

    it('size reflects current buffer length', async () => {
        const q = new AsyncQueue<number>()
        expect(q.size).toBe(0)
        await q.push(1)
        expect(q.size).toBe(1)
        await q.push(2)
        expect(q.size).toBe(2)
        await q.pull()
        expect(q.size).toBe(1)
    })

    it('closed reflects the closed state', () => {
        const q = new AsyncQueue<number>()
        expect(q.closed).toBe(false)
        q.close()
        expect(q.closed).toBe(true)
    })

    it('push and pull maintain FIFO order', async () => {
        const q = new AsyncQueue<number>()
        await q.push(1)
        await q.push(2)
        await q.push(3)
        expect(await q.pull()).toBe(1)
        expect(await q.pull()).toBe(2)
        expect(await q.pull()).toBe(3)
    })

    it('pull blocks until an item is pushed', async () => {
        const q = new AsyncQueue<string>()
        let received = ''
        const consumer = q.pull().then(v => { received = v })
        expect(received).toBe('')
        await q.push('hello')
        await consumer
        expect(received).toBe('hello')
    })

    it('push resolves immediately when a puller is waiting', async () => {
        const q = new AsyncQueue<number>()
        const consume = q.pull()
        await q.push(42)
        expect(await consume).toBe(42)
    })

    it('bounded queue blocks push when full and unblocks on pull', async () => {
        const q = new AsyncQueue<number>(2)
        await q.push(1)
        await q.push(2)

        let pushed = false
        const p = q.push(3).then(() => { pushed = true })
        expect(pushed).toBe(false)

        await q.pull()
        await p
        expect(pushed).toBe(true)
        expect(q.size).toBe(2)
    })

    it('bounded push rejects when closed while waiting', async () => {
        const q = new AsyncQueue<number>(1)
        await q.push(1)

        const p = q.push(2)
        q.close()
        await expect(p).rejects.toThrow('queue is closed')
    })

    it('close is idempotent', () => {
        const q = new AsyncQueue<number>()
        q.close()
        expect(() => q.close()).not.toThrow()
        expect(q.closed).toBe(true)
    })

    it('close rejects all pending pullers', async () => {
        const q = new AsyncQueue<number>()
        const p1 = q.pull()
        const p2 = q.pull()
        q.close()
        await expect(p1).rejects.toThrow('queue is closed')
        await expect(p2).rejects.toThrow('queue is closed')
    })

    it('drain resolves immediately when empty', async () => {
        const q = new AsyncQueue<number>()
        await expect(q.drain()).resolves.toBeUndefined()
    })

    it('drain resolves after all buffered items are consumed', async () => {
        const q = new AsyncQueue<number>()
        await q.push(1)
        await q.push(2)

        let drained = false
        const drainP = q.drain().then(() => { drained = true })

        expect(drained).toBe(false)
        await q.pull()
        expect(drained).toBe(false)
        await q.pull()
        await drainP
        expect(drained).toBe(true)
    })

    it('drain resolves after close empties pending pushers', async () => {
        const q = new AsyncQueue<number>(1)
        await q.push(1)
        const pushP = q.push(2)

        const drainP = q.drain()
        q.close()
        await expect(pushP).rejects.toThrow('queue is closed')

        await q.pull()
        await drainP
    })

    it('Symbol.asyncIterator yields items in order and terminates on close', async () => {
        const q = new AsyncQueue<number>()
        const results: number[] = []

        const consume = (async () => {
            for await (const item of q) {
                results.push(item)
            }
        })()

        await q.push(10)
        await q.push(20)
        await q.push(30)
        q.close()
        await consume

        expect(results).toEqual([10, 20, 30])
    })

    it('async iterator drains remaining buffered items after close', async () => {
        const q = new AsyncQueue<number>()
        await q.push(1)
        await q.push(2)
        q.close()

        const results: number[] = []
        for await (const item of q) {
            results.push(item)
        }
        expect(results).toEqual([1, 2])
    })

    it('unbounded queue buffers many items without blocking', async () => {
        const q = new AsyncQueue<number>()
        for (let i = 0; i < 100; i++) {
            await q.push(i)
        }
        expect(q.size).toBe(100)
        for (let i = 0; i < 100; i++) {
            expect(await q.pull()).toBe(i)
        }
        expect(q.size).toBe(0)
    })

})
