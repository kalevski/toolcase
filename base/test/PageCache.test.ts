import { describe, it, expect, afterEach } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { unlink } from 'node:fs/promises'
import { BPlusIndex, FsAdapter, MemoryAdapter, PageCache } from '../src/BPlusIndex'
import type { StorageAdapter } from '../src/BPlusIndex'

// ── spy adapter ───────────────────────────────────────────────────────────────

class SpyAdapter implements StorageAdapter {
    private inner = new MemoryAdapter()
    readCount = 0
    writeCount = 0

    async read(pageId: number): Promise<Uint8Array | null> {
        this.readCount++
        return this.inner.read(pageId)
    }

    async write(pageId: number, data: Uint8Array): Promise<void> {
        this.writeCount++
        return this.inner.write(pageId, data)
    }

    async truncate(pageCount: number): Promise<void> {
        return this.inner.truncate(pageCount)
    }

    async flush(): Promise<void> { return this.inner.flush() }
    async close(): Promise<void> { return this.inner.close() }
}

// ── helpers ───────────────────────────────────────────────────────────────────

function page(fill: number, size = 64): Uint8Array {
    return new Uint8Array(size).fill(fill)
}

let _counter = 0
function tmpPath(): string {
    return join(tmpdir(), `bplus-pagecache-test-${process.pid}-${++_counter}.idx`)
}

const strOpts = {
    ...BPlusIndex.keyPreset.string,
    serializeValue:   (v: string) => new TextEncoder().encode(v),
    deserializeValue: (b: Uint8Array) => new TextDecoder().decode(b),
}

const paths: string[] = []
function track(p: string): string { paths.push(p); return p }

afterEach(async () => {
    for (const p of paths.splice(0)) {
        await unlink(p).catch(() => { /* already gone */ })
    }
})

// ── cache hits avoid adapter reads ───────────────────────────────────────────

describe('PageCache — cache hits', () => {
    it('second read is served from cache without hitting the adapter', async () => {
        const spy = new SpyAdapter()
        const cache = new PageCache(spy)

        await spy.write(10, page(0xab))
        spy.readCount = 0

        const r1 = await cache.read(10)
        expect(r1).not.toBeNull()
        expect(r1![0]).toBe(0xab)
        expect(spy.readCount).toBe(1)

        const r2 = await cache.read(10)
        expect(r2).not.toBeNull()
        expect(r2![0]).toBe(0xab)
        expect(spy.readCount).toBe(1) // no second adapter read
    })

    it('missing page (null) is not cached — adapter is re-queried each time', async () => {
        const spy = new SpyAdapter()
        const cache = new PageCache(spy)

        expect(await cache.read(99)).toBeNull()
        expect(await cache.read(99)).toBeNull()
        expect(spy.readCount).toBe(2) // null not cached; both misses hit adapter
    })
})

// ── write-through ─────────────────────────────────────────────────────────────

describe('PageCache — write-through', () => {
    it('write populates the cache so the next read is a hit', async () => {
        const spy = new SpyAdapter()
        const cache = new PageCache(spy)

        spy.readCount = 0
        await cache.write(5, page(0xcc))
        expect(spy.writeCount).toBe(1) // went through to adapter

        const got = await cache.read(5)
        expect(got).not.toBeNull()
        expect(got![0]).toBe(0xcc)
        expect(spy.readCount).toBe(0) // served from cache, no adapter read
    })

    it('write updates an already-cached entry', async () => {
        const spy = new SpyAdapter()
        const cache = new PageCache(spy)

        await spy.write(3, page(0x11))
        await cache.read(3) // populate cache
        spy.readCount = 0

        await cache.write(3, page(0x22)) // overwrite via cache

        const got = await cache.read(3)
        expect(got![0]).toBe(0x22)
        expect(spy.readCount).toBe(0) // still no adapter read after the write
    })

    it('write does not mutate the cached copy when caller mutates the source', async () => {
        const spy = new SpyAdapter()
        const cache = new PageCache(spy)

        const src = page(0xaa)
        await cache.write(7, src)
        src[0] = 0xff // mutate after write

        const got = await cache.read(7)
        expect(got![0]).toBe(0xaa) // cache holds an independent copy
    })
})

// ── LRU eviction ─────────────────────────────────────────────────────────────

describe('PageCache — LRU eviction', () => {
    it('evicts the least-recently-used page when maxSize is reached', async () => {
        const spy = new SpyAdapter()
        const cache = new PageCache(spy, 2)

        // Populate two pages
        await spy.write(1, page(0x01))
        await spy.write(2, page(0x02))
        await spy.write(3, page(0x03))

        await cache.read(1) // MRU order: [1]
        await cache.read(2) // MRU order: [1, 2]
        spy.readCount = 0

        // Reading page 3 evicts LRU (page 1)
        await cache.read(3)
        expect(spy.readCount).toBe(1) // page 3 was a miss

        // Page 1 was evicted; re-reading it should go to the adapter
        await cache.read(1)
        expect(spy.readCount).toBe(2) // page 1 re-fetched
    })

    it('touching a cached page refreshes its LRU position', async () => {
        const spy = new SpyAdapter()
        const cache = new PageCache(spy, 2)

        await spy.write(1, page(0x01))
        await spy.write(2, page(0x02))
        await spy.write(3, page(0x03))

        await cache.read(1) // [1]
        await cache.read(2) // [1, 2]
        await cache.read(1) // touch 1 → [2, 1]; 2 is now LRU
        spy.readCount = 0

        // Reading page 3 should evict 2 (LRU), not 1
        await cache.read(3)
        expect(spy.readCount).toBe(1)

        // Page 2 was evicted
        await cache.read(2)
        expect(spy.readCount).toBe(2)

        // Page 1 is still cached
        await cache.read(1)
        expect(spy.readCount).toBe(2)
    })
})

// ── truncate eviction ─────────────────────────────────────────────────────────

describe('PageCache — truncate', () => {
    it('evicts cached pages at or beyond pageCount', async () => {
        const spy = new SpyAdapter()
        const cache = new PageCache(spy)

        await spy.write(0, page(0x00))
        await spy.write(1, page(0x01))
        await spy.write(2, page(0x02))

        // Populate cache for all three pages
        await cache.read(0)
        await cache.read(1)
        await cache.read(2)
        spy.readCount = 0

        await cache.truncate(2) // keep pages 0..1; evict 2

        // Page 0 and 1 still cached
        await cache.read(0)
        await cache.read(1)
        expect(spy.readCount).toBe(0)

        // Page 2 was evicted; adapter returns null after truncate
        expect(await cache.read(2)).toBeNull()
        expect(spy.readCount).toBe(1) // cache miss → adapter re-queried
    })
})

// ── constructor guard ─────────────────────────────────────────────────────────

describe('PageCache — constructor', () => {
    it('throws when maxSize is less than 1', () => {
        const spy = new SpyAdapter()
        expect(() => new PageCache(spy, 0)).toThrow('maxSize must be at least 1')
    })
})

// ── transparent composition with FsAdapter ───────────────────────────────────

describe('PageCache + FsAdapter — transparent composition', () => {
    it('BPlusIndex works correctly through a PageCache wrapping an FsAdapter', async () => {
        const path = track(tmpPath())

        const idx = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new PageCache(new FsAdapter(path)),
        })

        for (let i = 0; i < 20; i++) {
            await idx.set(`key-${String(i).padStart(3, '0')}`, `value-${i}`)
        }
        expect(idx.size).toBe(20)
        for (let i = 0; i < 20; i++) {
            expect(await idx.get(`key-${String(i).padStart(3, '0')}`)).toBe(`value-${i}`)
        }

        await idx.close()
    })

    it('persists data across reopen when using PageCache(FsAdapter)', async () => {
        const path = track(tmpPath())

        const idx1 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new PageCache(new FsAdapter(path)),
        })
        await idx1.set('hello', 'world')
        await idx1.set('foo', 'bar')
        await idx1.close()

        const idx2 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new PageCache(new FsAdapter(path)),
        })
        expect(await idx2.get('hello')).toBe('world')
        expect(await idx2.get('foo')).toBe('bar')
        expect(idx2.size).toBe(2)
        await idx2.close()
    })

    it('cache reduces adapter reads on repeated lookups', async () => {
        const spy = new SpyAdapter()
        const cache = new PageCache(spy, 32)

        const idx = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: cache,
        })

        for (let i = 0; i < 10; i++) {
            await idx.set(`k${i}`, `v${i}`)
        }

        // First pass: cold reads
        spy.readCount = 0
        for (let i = 0; i < 10; i++) {
            await idx.get(`k${i}`)
        }
        const coldReads = spy.readCount

        // Second pass: all pages should now be cached
        spy.readCount = 0
        for (let i = 0; i < 10; i++) {
            await idx.get(`k${i}`)
        }
        const hotReads = spy.readCount

        expect(hotReads).toBeLessThan(coldReads)
    })
})
