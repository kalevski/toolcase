import { describe, it, expect, vi } from 'vitest'
import Cache from '../src/Cache'

describe('Cache', () => {
    it('throws if fetchFn is not a function', () => {
        expect(() => new Cache(null)).toThrow('fetchFn must be a function')
    })

    it('calls fetchFn on first get', async () => {
        const fn = vi.fn(() => 'data')
        const cache = new Cache(fn)
        const result = await cache.get('key')
        expect(result).toBe('data')
        expect(fn).toHaveBeenCalledWith('key')
    })

    it('returns cached data within TTL', async () => {
        const fn = vi.fn(() => 'data')
        const cache = new Cache(fn, 10000)
        await cache.get('key')
        await cache.get('key')
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('refetches after cache entry has expired', async () => {
        let counter = 0
        const fn = vi.fn(() => ++counter)
        const cache = new Cache(fn, 1)

        const first = await cache.get('key')
        // wait just enough to expire the 1ms TTL
        await new Promise(r => setTimeout(r, 5))
        const second = await cache.get('key')

        expect(first).toBe(1)
        expect(second).toBe(2)
    })

    it('invalidate clears cache for specific args', async () => {
        const fn = vi.fn(() => 'data')
        const cache = new Cache(fn, 60000)
        await cache.get('key')
        cache.invalidate('key')
        await cache.get('key')
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('caches different args separately', async () => {
        const fn = vi.fn((x) => x)
        const cache = new Cache(fn, 60000)
        const a = await cache.get('a')
        const b = await cache.get('b')
        expect(a).toBe('a')
        expect(b).toBe('b')
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('setMS updates TTL', () => {
        const cache = new Cache(() => {}, 1000)
        cache.setMS(5000)
        expect(() => cache.setMS('invalid')).toThrow('ms must be a number')
    })

    it('handles async fetchFn', async () => {
        const fn = vi.fn(async () => 'async-data')
        const cache = new Cache(fn)
        const result = await cache.get()
        expect(result).toBe('async-data')
    })

    it('maxEntries caps the number of stored entries (LRU eviction)', async () => {
        const fn = vi.fn((x: number) => x)
        const cache = new Cache(fn, 60000, 2)

        await cache.get(1) // cache: {1}
        await cache.get(2) // cache: {1, 2}
        await cache.get(3) // evicts 1 (LRU), cache: {2, 3}
        await cache.get(1) // evicts 2 (LRU), cache: {3, 1}
        expect(fn).toHaveBeenCalledTimes(4)

        // 3 and 1 are both live; accessing them should not call fetchFn
        await cache.get(3) // cache: {1, 3}
        await cache.get(1) // cache: {3, 1}
        expect(fn).toHaveBeenCalledTimes(4)

        // 2 was evicted; getting it again must trigger fetchFn and evict 3
        await cache.get(2) // evicts 3, cache: {1, 2}
        expect(fn).toHaveBeenCalledTimes(5)
    })

    it('concurrent stale get calls invoke fetchFn only once', async () => {
        let resolver!: (v: string) => void
        const fn = vi.fn(() => new Promise<string>(r => { resolver = r }))

        const cache = new Cache(fn, 0)

        const p1 = cache.get('key')
        const p2 = cache.get('key')

        // fn is called once; the second get reuses the inflight promise
        expect(fn).toHaveBeenCalledTimes(1)

        resolver('value')
        const [a, b] = await Promise.all([p1, p2])

        expect(fn).toHaveBeenCalledTimes(1)
        expect(a).toBe('value')
        expect(b).toBe('value')
    })
})
