import { describe, it, expect, vi, beforeEach } from 'vitest'
import Cache from '../src/Cache.js'

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
})
