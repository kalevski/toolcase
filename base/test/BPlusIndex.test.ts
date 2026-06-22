import { describe, it, expect, beforeEach } from 'vitest'
import { BPlusIndex, MemoryAdapter } from '../src/BPlusIndex'

// ── helpers ──────────────────────────────────────────────────────────────────

function strIdx() {
    return BPlusIndex.open<string, string>({
        adapter: new MemoryAdapter(),
        ...BPlusIndex.keyPreset.string,
        serializeValue:   v => new TextEncoder().encode(v),
        deserializeValue: b => new TextDecoder().decode(b),
    })
}

function numIdx() {
    return BPlusIndex.open<number, number>({
        adapter: new MemoryAdapter(),
        ...BPlusIndex.keyPreset.number,
        serializeValue:   v => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v, true); return b },
        deserializeValue: b => new DataView(b.buffer, b.byteOffset).getFloat64(0, true),
    })
}

async function collect<K, V>(gen: AsyncGenerator<[K, V]>): Promise<[K, V][]> {
    const out: [K, V][] = []
    for await (const item of gen) out.push(item)
    return out
}

// ── open + superblock bootstrap ──────────────────────────────────────────────

describe('BPlusIndex — open & bootstrap', () => {
    it('opens successfully on a fresh MemoryAdapter', async () => {
        const idx = await strIdx()
        expect(idx).toBeTruthy()
        expect(idx.size).toBe(0)
    })

    it('rejects keyEncoding mismatch on reopen', async () => {
        const adapter = new MemoryAdapter()
        await BPlusIndex.open({ adapter, ...BPlusIndex.keyPreset.string, serializeValue: v => new TextEncoder().encode(v as string), deserializeValue: b => new TextDecoder().decode(b) })
        await expect(BPlusIndex.open({
            adapter,
            ...BPlusIndex.keyPreset.number,
            serializeValue:   v => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v as number, true); return b },
            deserializeValue: b => new DataView(b.buffer, b.byteOffset).getFloat64(0, true),
        })).rejects.toThrow('keyEncoding mismatch')
    })
})

// ── set / get / has / size ───────────────────────────────────────────────────

describe('BPlusIndex — set / get / has / size', () => {
    it('set and get a single string key', async () => {
        const idx = await strIdx()
        await idx.set('hello', 'world')
        expect(await idx.get('hello')).toBe('world')
        expect(idx.size).toBe(1)
    })

    it('get returns undefined for missing key', async () => {
        const idx = await strIdx()
        expect(await idx.get('nope')).toBeUndefined()
    })

    it('has returns true/false correctly', async () => {
        const idx = await strIdx()
        await idx.set('a', 'A')
        expect(await idx.has('a')).toBe(true)
        expect(await idx.has('b')).toBe(false)
    })

    it('size tracks insertions', async () => {
        const idx = await strIdx()
        for (let i = 0; i < 10; i++) await idx.set(`k${i}`, `v${i}`)
        expect(idx.size).toBe(10)
    })

    it('updating an existing key does not grow size', async () => {
        const idx = await strIdx()
        await idx.set('x', 'first')
        await idx.set('x', 'second')
        expect(idx.size).toBe(1)
        expect(await idx.get('x')).toBe('second')
    })

    it('handles numeric keys', async () => {
        const idx = await numIdx()
        await idx.set(42, 100)
        await idx.set(-1, 200)
        expect(await idx.get(42)).toBe(100)
        expect(await idx.get(-1)).toBe(200)
    })
})

// ── delete ───────────────────────────────────────────────────────────────────

describe('BPlusIndex — delete', () => {
    it('delete returns true for existing key', async () => {
        const idx = await strIdx()
        await idx.set('a', 'A')
        expect(await idx.delete('a')).toBe(true)
        expect(idx.size).toBe(0)
        expect(await idx.get('a')).toBeUndefined()
    })

    it('delete returns false for missing key', async () => {
        const idx = await strIdx()
        expect(await idx.delete('nope')).toBe(false)
    })

    it('deletes do not affect other keys', async () => {
        const idx = await strIdx()
        await idx.set('a', '1')
        await idx.set('b', '2')
        await idx.set('c', '3')
        await idx.delete('b')
        expect(await idx.get('a')).toBe('1')
        expect(await idx.get('b')).toBeUndefined()
        expect(await idx.get('c')).toBe('3')
        expect(idx.size).toBe(2)
    })
})

// ── clear ─────────────────────────────────────────────────────────────────────

describe('BPlusIndex — clear', () => {
    it('clear removes all entries', async () => {
        const idx = await strIdx()
        await idx.set('a', '1')
        await idx.set('b', '2')
        await idx.clear()
        expect(idx.size).toBe(0)
        expect(await idx.get('a')).toBeUndefined()
    })

    it('can set after clear', async () => {
        const idx = await strIdx()
        await idx.set('a', '1')
        await idx.clear()
        await idx.set('x', 'y')
        expect(idx.size).toBe(1)
        expect(await idx.get('x')).toBe('y')
    })
})

// ── range / entries / keys / values ──────────────────────────────────────────

describe('BPlusIndex — range / entries / keys / values', () => {
    async function populated(): Promise<BPlusIndex<string, string>> {
        const idx = await strIdx()
        for (const [k, v] of [['a','1'], ['b','2'], ['c','3'], ['d','4'], ['e','5']]) {
            await idx.set(k, v)
        }
        return idx
    }

    it('entries() returns all in ascending key order', async () => {
        const idx = await populated()
        const all = await collect(idx.entries())
        expect(all.map(([k]) => k)).toEqual(['a', 'b', 'c', 'd', 'e'])
        expect(all.map(([, v]) => v)).toEqual(['1', '2', '3', '4', '5'])
    })

    it('keys() returns all keys ascending', async () => {
        const idx = await populated()
        const ks: string[] = []
        for await (const k of idx.keys()) ks.push(k)
        expect(ks).toEqual(['a', 'b', 'c', 'd', 'e'])
    })

    it('values() returns all values ascending', async () => {
        const idx = await populated()
        const vs: string[] = []
        for await (const v of idx.values()) vs.push(v)
        expect(vs).toEqual(['1', '2', '3', '4', '5'])
    })

    it('range gte/lte', async () => {
        const idx = await populated()
        const all = await collect(idx.range({ gte: 'b', lte: 'd' }))
        expect(all.map(([k]) => k)).toEqual(['b', 'c', 'd'])
    })

    it('range gt/lt (exclusive)', async () => {
        const idx = await populated()
        const all = await collect(idx.range({ gt: 'a', lt: 'e' }))
        expect(all.map(([k]) => k)).toEqual(['b', 'c', 'd'])
    })

    it('range with limit', async () => {
        const idx = await populated()
        const all = await collect(idx.range({ limit: 2 }))
        expect(all.map(([k]) => k)).toEqual(['a', 'b'])
    })

    it('range reverse', async () => {
        const idx = await populated()
        const all = await collect(idx.range({ reverse: true }))
        expect(all.map(([k]) => k)).toEqual(['e', 'd', 'c', 'b', 'a'])
    })

    it('range reverse with limit', async () => {
        const idx = await populated()
        const all = await collect(idx.range({ reverse: true, limit: 3 }))
        expect(all.map(([k]) => k)).toEqual(['e', 'd', 'c'])
    })

    it('range on empty index returns nothing', async () => {
        const idx = await strIdx()
        const all = await collect(idx.range())
        expect(all).toEqual([])
    })
})

// ── many entries (triggers splits) ──────────────────────────────────────────

describe('BPlusIndex — many entries (splitting)', () => {
    it('inserts and retrieves 200 keys correctly', async () => {
        const idx = await strIdx()
        const N = 200
        for (let i = 0; i < N; i++) {
            await idx.set(`key-${String(i).padStart(4, '0')}`, `val-${i}`)
        }
        expect(idx.size).toBe(N)
        for (let i = 0; i < N; i++) {
            expect(await idx.get(`key-${String(i).padStart(4, '0')}`)).toBe(`val-${i}`)
        }
    })

    it('range scan returns all 200 keys in order', async () => {
        const idx = await strIdx()
        const N = 200
        for (let i = 0; i < N; i++) await idx.set(`key-${String(i).padStart(4, '0')}`, `val-${i}`)
        const all = await collect(idx.range())
        expect(all).toHaveLength(N)
        for (let i = 0; i < all.length - 1; i++) {
            expect(all[i][0] < all[i + 1][0]).toBe(true)
        }
    })

    it('inserts and deletes many keys, size stays consistent', async () => {
        const idx = await strIdx()
        const N = 100
        for (let i = 0; i < N; i++) await idx.set(`k${String(i).padStart(3, '0')}`, `v${i}`)
        for (let i = 0; i < N; i += 2) await idx.delete(`k${String(i).padStart(3, '0')}`)
        expect(idx.size).toBe(N / 2)
        for (let i = 1; i < N; i += 2) {
            expect(await idx.get(`k${String(i).padStart(3, '0')}`)).toBe(`v${i}`)
        }
    })
})

// ── persistence across reopen ────────────────────────────────────────────────

describe('BPlusIndex — persistence (reopen)', () => {
    it('survives close and reopen with data intact', async () => {
        const adapter = new MemoryAdapter()
        const enc = (v: string) => new TextEncoder().encode(v)
        const dec = (b: Uint8Array) => new TextDecoder().decode(b)
        const openOpts = {
            adapter,
            ...BPlusIndex.keyPreset.string,
            serializeValue: enc, deserializeValue: dec,
        }
        const idx1 = await BPlusIndex.open<string, string>(openOpts)
        await idx1.set('foo', 'bar')
        await idx1.set('baz', 'qux')
        await idx1.close()

        const idx2 = await BPlusIndex.open<string, string>(openOpts)
        expect(idx2.size).toBe(2)
        expect(await idx2.get('foo')).toBe('bar')
        expect(await idx2.get('baz')).toBe('qux')
    })
})

// ── helpers: comparators / serializers ──────────────────────────────────────

describe('BPlusIndex — comparators / serializers round-trip', () => {
    it('string round-trips', () => {
        const s = 'hello world 🎉'
        const b = BPlusIndex.serializers.string(s)
        expect(BPlusIndex.deserializers.string(b)).toBe(s)
    })

    it('number round-trips', () => {
        for (const n of [0, -1, 1.5, Math.PI, Number.MAX_SAFE_INTEGER, -0]) {
            const b = BPlusIndex.serializers.number(n)
            expect(BPlusIndex.deserializers.number(b)).toBe(n === -0 ? 0 : n)
        }
    })

    it('bigint round-trips', () => {
        for (const n of [0n, 1n, -1n, 12345678901234567890n, -9999999n]) {
            const b = BPlusIndex.serializers.bigint(n)
            expect(BPlusIndex.deserializers.bigint(b)).toBe(n)
        }
    })

    it('uint8Array round-trips', () => {
        const a = new Uint8Array([1, 2, 3, 4, 5])
        const b = BPlusIndex.serializers.uint8Array(a)
        expect(BPlusIndex.deserializers.uint8Array(b)).toEqual(a)
    })

    it('string comparator orders correctly', () => {
        const cmp = BPlusIndex.comparators.string
        expect(cmp('a', 'b')).toBeLessThan(0)
        expect(cmp('b', 'a')).toBeGreaterThan(0)
        expect(cmp('x', 'x')).toBe(0)
    })

    it('number comparator orders correctly', () => {
        const cmp = BPlusIndex.comparators.number
        expect(cmp(-1, 0)).toBeLessThan(0)
        expect(cmp(10, 5)).toBeGreaterThan(0)
        expect(cmp(3, 3)).toBe(0)
    })
})

// ── keyPreset ────────────────────────────────────────────────────────────────

describe('BPlusIndex — keyPreset', () => {
    it('keyPreset.string sets keyEncoding automatically', () => {
        expect(BPlusIndex.keyPreset.string.keyEncoding).toBe('string')
    })

    it('keyPreset.number sets keyEncoding automatically', () => {
        expect(BPlusIndex.keyPreset.number.keyEncoding).toBe('number')
    })
})

// ── flush / close ─────────────────────────────────────────────────────────────

describe('BPlusIndex — flush / close', () => {
    it('flush resolves without error', async () => {
        const idx = await strIdx()
        await idx.set('a', 'b')
        await expect(idx.flush()).resolves.toBeUndefined()
    })

    it('close resolves without error', async () => {
        const idx = await strIdx()
        await idx.set('a', 'b')
        await expect(idx.close()).resolves.toBeUndefined()
    })
})

// ── setMany ───────────────────────────────────────────────────────────────────

describe('BPlusIndex — setMany', () => {
    it('inserts multiple entries in one call', async () => {
        const idx = await strIdx()
        await idx.setMany([['b', '2'], ['a', '1'], ['c', '3']])
        expect(idx.size).toBe(3)
        expect(await idx.get('a')).toBe('1')
        expect(await idx.get('b')).toBe('2')
        expect(await idx.get('c')).toBe('3')
    })

    it('last-wins on duplicate keys in the same call', async () => {
        const idx = await strIdx()
        await idx.setMany([['a', 'first'], ['b', 'b'], ['a', 'last']])
        expect(idx.size).toBe(2)
        expect(await idx.get('a')).toBe('last')
    })

    it('updates existing keys from a prior set', async () => {
        const idx = await strIdx()
        await idx.set('x', 'old')
        await idx.setMany([['x', 'new'], ['y', 'y']])
        expect(idx.size).toBe(2)
        expect(await idx.get('x')).toBe('new')
    })

    it('setMany on empty list is a no-op', async () => {
        const idx = await strIdx()
        await idx.set('a', '1')
        await idx.setMany([])
        expect(idx.size).toBe(1)
    })

    it('handles many entries that trigger splits', async () => {
        const idx = await strIdx()
        const N = 200
        const pairs: [string, string][] = []
        for (let i = 0; i < N; i++) pairs.push([`key-${String(i).padStart(4, '0')}`, `v${i}`])
        await idx.setMany(pairs)
        expect(idx.size).toBe(N)
        const all = await collect(idx.entries())
        expect(all).toHaveLength(N)
        // Verify ascending order
        for (let i = 0; i < all.length - 1; i++) expect(all[i][0] < all[i + 1][0]).toBe(true)
    })

    it('survives reopen after setMany', async () => {
        const adapter = new MemoryAdapter()
        const opts = {
            adapter,
            ...BPlusIndex.keyPreset.string,
            serializeValue:   (v: string) => new TextEncoder().encode(v),
            deserializeValue: (b: Uint8Array) => new TextDecoder().decode(b),
        }
        const idx1 = await BPlusIndex.open<string, string>(opts)
        await idx1.setMany([['a', '1'], ['b', '2']])
        await idx1.close()
        const idx2 = await BPlusIndex.open<string, string>(opts)
        expect(idx2.size).toBe(2)
        expect(await idx2.get('a')).toBe('1')
        expect(await idx2.get('b')).toBe('2')
    })
})

// ── getMany ───────────────────────────────────────────────────────────────────

describe('BPlusIndex — getMany', () => {
    it('returns values aligned to input key order', async () => {
        const idx = await strIdx()
        await idx.setMany([['a', '1'], ['b', '2'], ['c', '3']])
        const results = await idx.getMany(['c', 'a', 'b'])
        expect(results).toEqual(['3', '1', '2'])
    })

    it('returns undefined for missing keys', async () => {
        const idx = await strIdx()
        await idx.set('a', '1')
        const results = await idx.getMany(['a', 'z', 'b'])
        expect(results).toEqual(['1', undefined, undefined])
    })

    it('returns empty array for empty key list', async () => {
        const idx = await strIdx()
        expect(await idx.getMany([])).toEqual([])
    })

    it('handles duplicate keys in the input list', async () => {
        const idx = await strIdx()
        await idx.set('a', '1')
        const results = await idx.getMany(['a', 'a'])
        expect(results).toEqual(['1', '1'])
    })
})

// ── deleteMany ────────────────────────────────────────────────────────────────

describe('BPlusIndex — deleteMany', () => {
    it('removes multiple keys and returns count', async () => {
        const idx = await strIdx()
        await idx.setMany([['a', '1'], ['b', '2'], ['c', '3']])
        const count = await idx.deleteMany(['a', 'c'])
        expect(count).toBe(2)
        expect(idx.size).toBe(1)
        expect(await idx.get('a')).toBeUndefined()
        expect(await idx.get('b')).toBe('2')
        expect(await idx.get('c')).toBeUndefined()
    })

    it('skips missing keys and returns only removed count', async () => {
        const idx = await strIdx()
        await idx.set('a', '1')
        const count = await idx.deleteMany(['a', 'nope', 'x'])
        expect(count).toBe(1)
        expect(idx.size).toBe(0)
    })

    it('returns 0 for empty key list', async () => {
        const idx = await strIdx()
        await idx.set('a', '1')
        expect(await idx.deleteMany([])).toBe(0)
        expect(idx.size).toBe(1)
    })

    it('returns 0 when no keys match', async () => {
        const idx = await strIdx()
        expect(await idx.deleteMany(['x', 'y'])).toBe(0)
    })

    it('survives reopen after deleteMany', async () => {
        const adapter = new MemoryAdapter()
        const opts = {
            adapter,
            ...BPlusIndex.keyPreset.string,
            serializeValue:   (v: string) => new TextEncoder().encode(v),
            deserializeValue: (b: Uint8Array) => new TextDecoder().decode(b),
        }
        const idx1 = await BPlusIndex.open<string, string>(opts)
        await idx1.setMany([['a', '1'], ['b', '2'], ['c', '3']])
        await idx1.deleteMany(['a', 'c'])
        await idx1.close()
        const idx2 = await BPlusIndex.open<string, string>(opts)
        expect(idx2.size).toBe(1)
        expect(await idx2.get('b')).toBe('2')
    })
})

// ── bulkLoad ──────────────────────────────────────────────────────────────────

describe('BPlusIndex — bulkLoad', () => {
    function bulkStrOpts(adapter = new MemoryAdapter()) {
        return {
            adapter,
            ...BPlusIndex.keyPreset.string,
            serializeValue:   (v: string) => new TextEncoder().encode(v),
            deserializeValue: (b: Uint8Array) => new TextDecoder().decode(b),
        }
    }

    it('builds a readable index from a small sorted list', async () => {
        const entries: [string, string][] = [['a', '1'], ['b', '2'], ['c', '3']]
        const idx = await BPlusIndex.bulkLoad(bulkStrOpts(), entries)
        expect(idx.size).toBe(3)
        expect(await idx.get('a')).toBe('1')
        expect(await idx.get('b')).toBe('2')
        expect(await idx.get('c')).toBe('3')
    })

    it('full forward scan returns all entries in order', async () => {
        const N = 300
        const entries: [string, string][] = []
        for (let i = 0; i < N; i++) entries.push([`key-${String(i).padStart(4, '0')}`, `v${i}`])
        const idx = await BPlusIndex.bulkLoad(bulkStrOpts(), entries)
        expect(idx.size).toBe(N)
        const all = await collect(idx.entries())
        expect(all).toHaveLength(N)
        for (let i = 0; i < all.length; i++) expect(all[i][0]).toBe(entries[i][0])
    })

    it('supports get/has/range/delete after bulkLoad', async () => {
        const entries: [string, string][] = [['a', '1'], ['b', '2'], ['c', '3'], ['d', '4']]
        const idx = await BPlusIndex.bulkLoad(bulkStrOpts(), entries)
        expect(await idx.has('c')).toBe(true)
        expect(await idx.has('z')).toBe(false)
        const rangeResult = await collect(idx.range({ gte: 'b', lte: 'c' }))
        expect(rangeResult.map(([k]) => k)).toEqual(['b', 'c'])
        expect(await idx.delete('b')).toBe(true)
        expect(idx.size).toBe(3)
    })

    it('returns an empty index when entries array is empty', async () => {
        const idx = await BPlusIndex.bulkLoad(bulkStrOpts(), [])
        expect(idx.size).toBe(0)
        expect(await collect(idx.entries())).toEqual([])
    })

    it('survives close and reopen with data intact', async () => {
        const adapter = new MemoryAdapter()
        const opts = bulkStrOpts(adapter)
        const entries: [string, string][] = [['foo', 'bar'], ['zoo', 'zap']]
        const idx1 = await BPlusIndex.bulkLoad(opts, entries)
        await idx1.close()
        const idx2 = await BPlusIndex.open<string, string>(opts)
        expect(idx2.size).toBe(2)
        expect(await idx2.get('foo')).toBe('bar')
        expect(await idx2.get('zoo')).toBe('zap')
    })

    it('throws on out-of-order entries', async () => {
        const entries: [string, string][] = [['b', '2'], ['a', '1']]
        await expect(BPlusIndex.bulkLoad(bulkStrOpts(), entries))
            .rejects.toThrow('out of order')
    })

    it('throws on duplicate keys', async () => {
        const entries: [string, string][] = [['a', '1'], ['a', '2']]
        await expect(BPlusIndex.bulkLoad(bulkStrOpts(), entries))
            .rejects.toThrow('duplicate key')
    })

    it('throws when the index is not empty', async () => {
        const opts = bulkStrOpts()
        const existing = await BPlusIndex.open<string, string>(opts)
        await existing.set('x', 'y')
        await existing.close()
        await expect(BPlusIndex.bulkLoad(opts, [['a', '1']]))
            .rejects.toThrow('must be empty')
    })

    it('produces correct results with numeric keys', async () => {
        const entries: [number, number][] = []
        for (let i = 0; i < 50; i++) entries.push([i, i * 10])
        const numOpts = {
            adapter:          new MemoryAdapter(),
            ...BPlusIndex.keyPreset.number,
            serializeValue:   (v: number) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v, true); return b },
            deserializeValue: (b: Uint8Array) => new DataView(b.buffer, b.byteOffset).getFloat64(0, true),
        }
        const idx = await BPlusIndex.bulkLoad<number, number>(numOpts, entries)
        expect(idx.size).toBe(50)
        expect(await idx.get(25)).toBe(250)
        expect(await idx.get(0)).toBe(0)
        expect(await idx.get(49)).toBe(490)
    })
})
