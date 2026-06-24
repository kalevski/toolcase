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

// ── rank ─────────────────────────────────────────────────────────────────────
// rank() uses childCounts on internal nodes — it never scans leaves linearly.

describe('BPlusIndex — rank', () => {
    it('rank of every element matches its 0-based sorted position', async () => {
        // Build a known dataset large enough to force multiple tree levels
        const N = 200
        const idx = await numIdx()
        for (let i = 0; i < N; i++) await idx.set(i, i * 10)
        for (let i = 0; i < N; i++) {
            expect(await idx.rank(i)).toBe(i)
        }
    })

    it('rank of a missing key is the insertion rank', async () => {
        const idx = await numIdx()
        for (const v of [10, 20, 30, 40, 50]) await idx.set(v, v)
        // Missing keys between existing ones
        expect(await idx.rank(0)).toBe(0)   // before all
        expect(await idx.rank(15)).toBe(1)  // between 10 and 20
        expect(await idx.rank(25)).toBe(2)  // between 20 and 30
        expect(await idx.rank(100)).toBe(5) // after all
    })

    it('rank on empty index is always 0', async () => {
        const idx = await numIdx()
        expect(await idx.rank(42)).toBe(0)
    })

    it('rank after deletions reflects actual entry count below key', async () => {
        const idx = await numIdx()
        for (let i = 0; i < 10; i++) await idx.set(i, i)
        await idx.delete(0)
        await idx.delete(1)
        // key 2 is now the 0-th element; rank(2) = 0
        expect(await idx.rank(2)).toBe(0)
        // rank(5) = 3 (keys 2, 3, 4 are less than 5)
        expect(await idx.rank(5)).toBe(3)
    })

    it('rank with string keys respects lexicographic order', async () => {
        const idx = await strIdx()
        for (const k of ['banana', 'cherry', 'apple', 'date', 'elderberry']) {
            await idx.set(k, k)
        }
        // Sorted: apple, banana, cherry, date, elderberry
        expect(await idx.rank('apple')).toBe(0)
        expect(await idx.rank('banana')).toBe(1)
        expect(await idx.rank('cherry')).toBe(2)
        expect(await idx.rank('date')).toBe(3)
        expect(await idx.rank('elderberry')).toBe(4)
    })
})

// ── nth ──────────────────────────────────────────────────────────────────────
// nth() navigates via childCounts without scanning — O(log n).

describe('BPlusIndex — nth', () => {
    it('nth returns the correct entry at every position in a known dataset', async () => {
        const N = 200
        const idx = await numIdx()
        for (let i = 0; i < N; i++) await idx.set(i, i * 10)
        for (let i = 0; i < N; i++) {
            const result = await idx.nth(i)
            expect(result).toEqual([i, i * 10])
        }
    })

    it('nth(0) returns the smallest key', async () => {
        const idx = await numIdx()
        for (const v of [30, 10, 20]) await idx.set(v, v)
        expect(await idx.nth(0)).toEqual([10, 10])
    })

    it('nth(size - 1) returns the largest key', async () => {
        const idx = await numIdx()
        for (const v of [30, 10, 20]) await idx.set(v, v)
        expect(await idx.nth(2)).toEqual([30, 30])
    })

    it('nth out of range returns undefined', async () => {
        const idx = await numIdx()
        await idx.set(1, 1)
        expect(await idx.nth(-1)).toBeUndefined()
        expect(await idx.nth(1)).toBeUndefined()
    })

    it('nth on empty index returns undefined', async () => {
        const idx = await numIdx()
        expect(await idx.nth(0)).toBeUndefined()
    })

    it('nth agrees with rank — nth(rank(k)) === k for all keys', async () => {
        const idx = await numIdx()
        const keys = [5, 2, 8, 1, 9, 3, 7, 4, 6, 0]
        for (const k of keys) await idx.set(k, k * 100)
        for (const k of keys) {
            const r = await idx.rank(k)
            const result = await idx.nth(r)
            expect(result?.[0]).toBe(k)
        }
    })
})

// ── count ────────────────────────────────────────────────────────────────────
// count() uses rank() under the hood — two tree descents, no leaf scanning.

describe('BPlusIndex — count', () => {
    async function populated200(): Promise<BPlusIndex<number, number>> {
        const idx = await numIdx()
        for (let i = 0; i < 200; i++) await idx.set(i, i)
        return idx
    }

    it('count() with no bounds equals size', async () => {
        const idx = await populated200()
        expect(await idx.count()).toBe(200)
    })

    it('count with gte/lte', async () => {
        const idx = await populated200()
        expect(await idx.count({ gte: 50, lte: 99 })).toBe(50)
        expect(await idx.count({ gte: 0,  lte: 199 })).toBe(200)
        expect(await idx.count({ gte: 100, lte: 100 })).toBe(1)
    })

    it('count with gt/lt', async () => {
        const idx = await populated200()
        expect(await idx.count({ gt: 49, lt: 100 })).toBe(50) // 50..99
        expect(await idx.count({ gt: 0,  lt: 199 })).toBe(198)
    })

    it('count with mixed gt/lte and gte/lt', async () => {
        const idx = await populated200()
        expect(await idx.count({ gte: 50, lt:  100 })).toBe(50)  // 50..99
        expect(await idx.count({ gt:  49, lte: 99  })).toBe(50)  // 50..99
    })

    it('count with missing boundary keys', async () => {
        const idx = await numIdx()
        // Only even numbers 0, 2, 4, ..., 18; values equal keys
        for (let i = 0; i < 10; i++) await idx.set(i * 2, i * 2)
        // Odd boundary keys that do not exist in the tree
        expect(await idx.count({ gte: 1, lte: 9  })).toBe(4)  // 2, 4, 6, 8
        expect(await idx.count({ gt:  1, lt:  9  })).toBe(4)  // 2, 4, 6, 8 (8 < 9)
        expect(await idx.count({ gte: 3, lt:  7  })).toBe(2)  // 4, 6
        expect(await idx.count({ gt:  3, lte: 7  })).toBe(2)  // 4, 6
    })

    it('count returns 0 for an inverted range', async () => {
        const idx = await populated200()
        expect(await idx.count({ gte: 100, lte: 50 })).toBe(0)
    })

    it('count returns 0 for exclusive range on single key', async () => {
        const idx = await numIdx()
        await idx.set(5, 5)
        expect(await idx.count({ gt: 5, lt: 5 })).toBe(0)
        expect(await idx.count({ gt: 5, lte: 5 })).toBe(0)
    })

    it('count on empty index is always 0', async () => {
        const idx = await numIdx()
        expect(await idx.count()).toBe(0)
        expect(await idx.count({ gte: 0 })).toBe(0)
    })
})

// ── first / last ─────────────────────────────────────────────────────────────

describe('BPlusIndex — first / last', () => {
    it('first returns the minimum key-value pair', async () => {
        const idx = await numIdx()
        for (const v of [30, 10, 20, 40]) await idx.set(v, v * 10)
        expect(await idx.first()).toEqual([10, 100])
    })

    it('last returns the maximum key-value pair', async () => {
        const idx = await numIdx()
        for (const v of [30, 10, 20, 40]) await idx.set(v, v * 10)
        expect(await idx.last()).toEqual([40, 400])
    })

    it('first === nth(0) and last === nth(size - 1)', async () => {
        const idx = await numIdx()
        const N = 100
        for (let i = 0; i < N; i++) await idx.set(i, i)
        const f = await idx.first()
        const l = await idx.last()
        expect(f).toEqual(await idx.nth(0))
        expect(l).toEqual(await idx.nth(N - 1))
    })

    it('first and last return undefined on empty index', async () => {
        const idx = await numIdx()
        expect(await idx.first()).toBeUndefined()
        expect(await idx.last()).toBeUndefined()
    })

    it('first and last still correct after deletions', async () => {
        const idx = await numIdx()
        for (let i = 0; i < 10; i++) await idx.set(i, i)
        await idx.delete(0)
        await idx.delete(9)
        expect((await idx.first())?.[0]).toBe(1)
        expect((await idx.last())?.[0]).toBe(8)
    })

    it('first and last work correctly after bulkLoad', async () => {
        const N = 300
        const entries: [number, number][] = []
        for (let i = 0; i < N; i++) entries.push([i, i])
        const opts = {
            adapter:          new MemoryAdapter(),
            ...BPlusIndex.keyPreset.number,
            serializeValue:   (v: number) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v, true); return b },
            deserializeValue: (b: Uint8Array) => new DataView(b.buffer, b.byteOffset).getFloat64(0, true),
        }
        const idx = await BPlusIndex.bulkLoad<number, number>(opts, entries)
        expect((await idx.first())?.[0]).toBe(0)
        expect((await idx.last())?.[0]).toBe(N - 1)
    })
})

// ── floor / ceil ─────────────────────────────────────────────────────────────

describe('BPlusIndex — floor / ceil', () => {
    async function evenKeys(): Promise<BPlusIndex<number, number>> {
        // Insert even numbers: 0, 2, 4, ..., 198
        const idx = await numIdx()
        for (let i = 0; i < 100; i++) await idx.set(i * 2, i * 2)
        return idx
    }

    it('floor returns exact match when key exists', async () => {
        const idx = await evenKeys()
        expect(await idx.floor(10)).toEqual([10, 10])
        expect(await idx.floor(100)).toEqual([100, 100])
    })

    it('floor returns the nearest key below when key is missing', async () => {
        const idx = await evenKeys()
        expect(await idx.floor(11)).toEqual([10, 10])
        expect(await idx.floor(1)).toEqual([0, 0])
        expect(await idx.floor(199)).toEqual([198, 198])
    })

    it('floor returns undefined when target is below all keys', async () => {
        const idx = await evenKeys()
        // All keys are >= 0; querying below 0 → undefined
        const idx2 = await numIdx()
        for (const v of [5, 10, 15]) await idx2.set(v, v)
        expect(await idx2.floor(4)).toBeUndefined()
        expect(await idx2.floor(3)).toBeUndefined()
    })

    it('floor on empty index returns undefined', async () => {
        const idx = await numIdx()
        expect(await idx.floor(5)).toBeUndefined()
    })

    it('ceil returns exact match when key exists', async () => {
        const idx = await evenKeys()
        expect(await idx.ceil(10)).toEqual([10, 10])
        expect(await idx.ceil(0)).toEqual([0, 0])
    })

    it('ceil returns the nearest key above when key is missing', async () => {
        const idx = await evenKeys()
        expect(await idx.ceil(1)).toEqual([2, 2])
        expect(await idx.ceil(99)).toEqual([100, 100])
        expect(await idx.ceil(197)).toEqual([198, 198])
    })

    it('ceil returns undefined when target is above all keys', async () => {
        const idx = await numIdx()
        for (const v of [5, 10, 15]) await idx.set(v, v)
        expect(await idx.ceil(16)).toBeUndefined()
        expect(await idx.ceil(100)).toBeUndefined()
    })

    it('ceil on empty index returns undefined', async () => {
        const idx = await numIdx()
        expect(await idx.ceil(5)).toBeUndefined()
    })

    it('floor and ceil are consistent: ceil(x) >= x >= floor(x)', async () => {
        const idx = await evenKeys()
        for (const probe of [1, 3, 7, 11, 99, 101, 149, 197]) {
            const f = await idx.floor(probe)
            const c = await idx.ceil(probe)
            expect(f).toBeDefined()
            expect(c).toBeDefined()
            expect(f![0]).toBeLessThanOrEqual(probe)
            expect(c![0]).toBeGreaterThanOrEqual(probe)
        }
    })

    it('floor and ceil work across leaf boundaries (large dataset)', async () => {
        // 300 entries ensures multiple levels; query keys that cross leaf boundaries
        const N = 300
        const entries: [number, number][] = []
        for (let i = 0; i < N; i++) entries.push([i * 3, i * 3]) // 0, 3, 6, ..., 897
        const opts = {
            adapter:          new MemoryAdapter(),
            ...BPlusIndex.keyPreset.number,
            serializeValue:   (v: number) => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v, true); return b },
            deserializeValue: (b: Uint8Array) => new DataView(b.buffer, b.byteOffset).getFloat64(0, true),
        }
        const idx = await BPlusIndex.bulkLoad<number, number>(opts, entries)

        // floor(1) → 0; ceil(1) → 3
        expect(await idx.floor(1)).toEqual([0, 0])
        expect(await idx.ceil(1)).toEqual([3, 3])
        // floor(4) → 3; ceil(4) → 6
        expect(await idx.floor(4)).toEqual([3, 3])
        expect(await idx.ceil(4)).toEqual([6, 6])
        // boundaries
        expect(await idx.floor(0)).toEqual([0, 0])
        expect(await idx.ceil(0)).toEqual([0, 0])
        expect(await idx.floor(897)).toEqual([897, 897])
        expect(await idx.ceil(897)).toEqual([897, 897])
        expect(await idx.floor(900)).toEqual([897, 897])
        expect(await idx.ceil(-1)).toEqual([0, 0])
    })

    it('floor and ceil work correctly after deletions', async () => {
        const idx = await numIdx()
        for (let i = 0; i < 20; i++) await idx.set(i, i)
        // Delete keys 5..9 to create a gap
        for (let i = 5; i <= 9; i++) await idx.delete(i)
        expect(await idx.floor(7)).toEqual([4, 4])
        expect(await idx.ceil(7)).toEqual([10, 10])
    })
})
