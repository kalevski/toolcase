import { describe, it, expect, afterEach } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { rm } from 'node:fs/promises'
import { BPlusIndex } from '@toolcase/base'
import { NodeStore } from '../src/store/NodeStore'
import { BlockStore } from '../src/store/BlockStore'
import type { NodeStoreOptions } from '../src/store/NodeStore'

// ── helpers ──────────────────────────────────────────────────────────────────

const ENC = new TextEncoder()
const DEC = new TextDecoder()

let _counter = 0
function tmpBase(): string {
    return join(tmpdir(), `node-store-test-${process.pid}-${++_counter}`)
}

function strOpts(base: string): NodeStoreOptions<string, string> {
    return {
        path:             base,
        ...BPlusIndex.keyPreset.string,
        serializeValue:   v => ENC.encode(v),
        deserializeValue: b => DEC.decode(b),
    }
}

// Cast to access private fields in tests (avoids any as unknown dance in every test).
type InternalStore = {
    _blocks: BlockStore
}

const bases: string[] = []
function track(base: string): string { bases.push(base); return base }

afterEach(async () => {
    for (const b of bases.splice(0)) {
        await rm(`${b}.idx`, { force: true })
        for (let i = 0; i < 20; i++) {
            await rm(`${b}.dat.${i}`, { force: true })
        }
    }
})

// ── basic CRUD ────────────────────────────────────────────────────────────────

describe('NodeStore — basic CRUD', () => {
    it('set and get a value', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        await store.set('hello', 'world')
        expect(await store.get('hello')).toBe('world')
        expect(store.size).toBe(1)
        await store.close()
    })

    it('get returns undefined for missing key', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        expect(await store.get('nope')).toBeUndefined()
        await store.close()
    })

    it('overwrite updates the value', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        await store.set('k', 'first')
        await store.set('k', 'second')
        expect(await store.get('k')).toBe('second')
        expect(store.size).toBe(1)
        await store.close()
    })

    it('delete removes the entry', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        await store.set('a', 'A')
        expect(await store.delete('a')).toBe(true)
        expect(await store.get('a')).toBeUndefined()
        expect(store.size).toBe(0)
        await store.close()
    })

    it('delete returns false for a missing key', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        expect(await store.delete('ghost')).toBe(false)
        await store.close()
    })

    it('size tracks insertions and deletions', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        for (let i = 0; i < 20; i++) await store.set(`k${i}`, `v${i}`)
        expect(store.size).toBe(20)
        await store.delete('k0')
        await store.delete('k1')
        expect(store.size).toBe(18)
        await store.close()
    })
})

// ── persistence ───────────────────────────────────────────────────────────────

describe('NodeStore — persistence across close / reopen', () => {
    it('all entries survive a reopen', async () => {
        const base   = track(tmpBase())
        const store1 = await NodeStore.open(strOpts(base))
        for (let i = 0; i < 30; i++) await store1.set(`key-${i}`, `val-${i}`)
        expect(store1.size).toBe(30)
        await store1.close()

        const store2 = await NodeStore.open(strOpts(base))
        expect(store2.size).toBe(30)
        for (let i = 0; i < 30; i++) {
            expect(await store2.get(`key-${i}`)).toBe(`val-${i}`)
        }
        await store2.close()
    })

    it('updates and deletes are durable', async () => {
        const base   = track(tmpBase())
        const store1 = await NodeStore.open(strOpts(base))
        await store1.set('a', 'first')
        await store1.set('b', 'keep')
        await store1.close()

        const store2 = await NodeStore.open(strOpts(base))
        await store2.set('a', 'updated')
        await store2.delete('b')
        await store2.close()

        const store3 = await NodeStore.open(strOpts(base))
        expect(await store3.get('a')).toBe('updated')
        expect(await store3.get('b')).toBeUndefined()
        expect(store3.size).toBe(1)
        await store3.close()
    })
})

// ── iteration ─────────────────────────────────────────────────────────────────

describe('NodeStore — iteration', () => {
    it('entries() yields all [key, value] pairs in key order', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        await store.set('c', 'C')
        await store.set('a', 'A')
        await store.set('b', 'B')

        const result: [string, string][] = []
        for await (const pair of store.entries()) result.push(pair)

        expect(result).toEqual([['a', 'A'], ['b', 'B'], ['c', 'C']])
        await store.close()
    })

    it('keys() and values() return correct sequences', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        await store.set('x', '1')
        await store.set('y', '2')

        const ks: string[] = []
        for await (const k of store.keys()) ks.push(k)

        const vs: string[] = []
        for await (const v of store.values()) vs.push(v)

        expect(ks).toEqual(['x', 'y'])
        expect(vs).toEqual(['1', '2'])
        await store.close()
    })

    it('range() with bounds filters correctly', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        // Insert keys: a, b, c, d, e (lexicographic order)
        for (const k of ['a', 'b', 'c', 'd', 'e']) await store.set(k, k.toUpperCase())

        const result: string[] = []
        for await (const [k] of store.range({ gte: 'b', lte: 'd' })) result.push(k)

        expect(result).toEqual(['b', 'c', 'd'])
        await store.close()
    })
})

// ── liveRatio ─────────────────────────────────────────────────────────────────

describe('NodeStore — liveRatio', () => {
    it('starts at 1 on a fresh store', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        expect(store.liveRatio).toBe(1)
        await store.close()
    })

    it('drops below 1 after a delete', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        await store.set('a', 'x'.repeat(500))
        await store.set('b', 'y'.repeat(500))
        await store.delete('a')
        expect(store.liveRatio).toBeLessThan(1)
        await store.close()
    })

    it('drops below 1 after an overwrite (old blob becomes dead)', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        await store.set('key', 'x'.repeat(500))
        await store.set('key', 'y'.repeat(500))
        // Both blobs are in the heap; old one is dead.
        expect(store.liveRatio).toBeLessThan(1)
        await store.close()
    })

    it('liveRatio is restored correctly across a reopen', async () => {
        const base   = track(tmpBase())
        const store1 = await NodeStore.open(strOpts(base))
        await store1.set('a', 'x'.repeat(500))
        await store1.set('b', 'y'.repeat(500))
        await store1.delete('a')
        const ratioBefore = store1.liveRatio
        await store1.close()

        const store2 = await NodeStore.open(strOpts(base))
        expect(store2.liveRatio).toBeCloseTo(ratioBefore, 5)
        await store2.close()
    })
})

// ── crash-ordering invariant ──────────────────────────────────────────────────

describe('NodeStore — crash-ordering invariant', () => {
    it('an orphan block appended without an index update is invisible after reopen', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        await store.set('real', 'real-value')

        // Simulate: data fsynced to heap, then process crashed before index.set().
        // Directly append a block to BlockStore without calling NodeStore.set().
        const blocks = (store as unknown as InternalStore)._blocks
        await blocks.append(ENC.encode('orphan-value'))
        await blocks.fsyncActive()
        // Intentionally omit: await store.set('orphan-key', 'orphan-value')

        await store.close()

        // After reopen the orphan block is in the heap but not in the index.
        const store2 = await NodeStore.open(strOpts(base))

        expect(await store2.get('real')).toBe('real-value')
        expect(await store2.get('orphan-key')).toBeUndefined()
        expect(store2.size).toBe(1)

        // The orphan inflates totalBytes → liveRatio < 1.
        expect(store2.liveRatio).toBeLessThan(1)

        await store2.close()
    })

    it('optimize() reclaims orphan blocks left by a simulated crash', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        await store.set('a', 'alpha')
        await store.set('b', 'beta')

        // Append an orphan without an index entry.
        const blocks = (store as unknown as InternalStore)._blocks
        await blocks.append(ENC.encode('orphan'))
        await blocks.fsyncActive()

        await store.close()

        const store2 = await NodeStore.open(strOpts(base))
        expect(store2.liveRatio).toBeLessThan(1)

        await store2.optimize()

        expect(store2.liveRatio).toBeCloseTo(1, 5)
        expect(await store2.get('a')).toBe('alpha')
        expect(await store2.get('b')).toBe('beta')
        await store2.close()
    })
})

// ── optimize / compaction ─────────────────────────────────────────────────────

describe('NodeStore — optimize (compaction)', () => {
    it('reclaims dead space after deletes and keeps remaining entries intact', async () => {
        const PAYLOAD = 'x'.repeat(1000)
        const base    = track(tmpBase())
        const store   = await NodeStore.open(strOpts(base))

        for (let i = 0; i < 10; i++) await store.set(`key-${i}`, PAYLOAD)
        for (let i = 0; i < 5; i++) await store.delete(`key-${i}`)

        expect(store.size).toBe(5)
        expect(store.liveRatio).toBeLessThan(1)

        await store.optimize()

        expect(store.size).toBe(5)
        expect(store.liveRatio).toBeCloseTo(1, 5)
        for (let i = 5; i < 10; i++) {
            expect(await store.get(`key-${i}`)).toBe(PAYLOAD)
        }
        await store.close()
    })

    it('survives a reopen after compaction', async () => {
        const base   = track(tmpBase())
        const store1 = await NodeStore.open(strOpts(base))
        for (let i = 0; i < 20; i++) await store1.set(`k${i}`, `v${i}`)
        for (let i = 0; i < 10; i++) await store1.delete(`k${i}`)

        await store1.optimize()
        await store1.close()

        const store2 = await NodeStore.open(strOpts(base))
        expect(store2.size).toBe(10)
        for (let i = 10; i < 20; i++) {
            expect(await store2.get(`k${i}`)).toBe(`v${i}`)
        }
        expect(store2.liveRatio).toBeCloseTo(1, 5)
        await store2.close()
    })

    it('optimize() on an empty store is a no-op', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        await expect(store.optimize()).resolves.toBeUndefined()
        expect(store.size).toBe(0)
        await store.close()
    })

    it('compaction produces entries in key order', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))

        // Insert in non-sorted order, then compact.
        await store.set('c', 'C')
        await store.set('a', 'A')
        await store.set('b', 'B')
        await store.delete('a')

        await store.optimize()

        const keys: string[] = []
        for await (const [k] of store.entries()) keys.push(k)
        expect(keys).toEqual(['b', 'c'])

        await store.close()
    })

    it('orphan segment left by a crashed compaction is cleaned up on reopen', async () => {
        // Arrange: a valid store with two entries.
        const base   = track(tmpBase())
        const store1 = await NodeStore.open(strOpts(base))
        await store1.set('a', 'alpha')
        await store1.set('b', 'beta')
        await store1.close()

        // Simulate a crashed compaction: segment 1 appears on disk but the
        // index superblock was never committed to reference it.
        const orphanStore = new BlockStore(base)
        await orphanStore.scanSegments()   // opens handles for existing files
        // Write some bytes at segment 1 offset 0 (simulates partial compaction write).
        await orphanStore.writeAt(1, 0, ENC.encode('orphan-compaction-data'))
        await orphanStore.fsyncSegment(1)
        await orphanStore.close()

        // Reopen NodeStore: segment 1 should be detected as unreferenced and deleted.
        const store2 = await NodeStore.open(strOpts(base))

        expect(store2.size).toBe(2)
        expect(await store2.get('a')).toBe('alpha')
        expect(await store2.get('b')).toBe('beta')

        // Only segment 0 remains; its bytes are all live → liveRatio ≈ 1.
        expect(store2.liveRatio).toBeCloseTo(1, 5)

        await store2.close()
    })
})

// ── flush ─────────────────────────────────────────────────────────────────────

describe('NodeStore — flush', () => {
    it('flush() does not throw and leaves data intact', async () => {
        const base  = track(tmpBase())
        const store = await NodeStore.open(strOpts(base))
        await store.set('k', 'v')
        await store.flush()
        expect(await store.get('k')).toBe('v')
        await store.close()
    })
})
