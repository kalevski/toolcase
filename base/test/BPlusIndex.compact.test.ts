import { describe, it, expect } from 'vitest'
import { BPlusIndex, MemoryAdapter } from '../src/BPlusIndex'

// ── helpers ──────────────────────────────────────────────────────────────────

function strIdx(adapter = new MemoryAdapter()) {
    return BPlusIndex.open<string, string>({
        adapter,
        ...BPlusIndex.keyPreset.string,
        serializeValue:   v => new TextEncoder().encode(v),
        deserializeValue: b => new TextDecoder().decode(b),
    })
}

function numIdx(adapter = new MemoryAdapter()) {
    return BPlusIndex.open<number, number>({
        adapter,
        ...BPlusIndex.keyPreset.number,
        serializeValue:   v => { const b = new Uint8Array(8); new DataView(b.buffer).setFloat64(0, v, true); return b },
        deserializeValue: b => new DataView(b.buffer, b.byteOffset).getFloat64(0, true),
    })
}

async function collectEntries<K, V>(idx: BPlusIndex<K, V>): Promise<[K, V][]> {
    const out: [K, V][] = []
    for await (const pair of idx.entries()) out.push(pair)
    return out
}

// ── stats ─────────────────────────────────────────────────────────────────────

describe('BPlusIndex — stats()', () => {
    it('fresh index: height=1, pageCount=3, freePages=0, fillFactor=1', async () => {
        const idx = await strIdx()
        const s = await idx.stats()
        expect(s.height).toBe(1)
        expect(s.pageCount).toBe(3)  // 2 superblocks + 1 root leaf
        expect(s.freePages).toBe(0)
        expect(s.fillFactor).toBe(1)
    })

    it('height increases when tree grows beyond a single leaf', async () => {
        // Insert enough entries to force at least one internal node level
        const idx = await strIdx()
        const N = 500
        for (let i = 0; i < N; i++) {
            await idx.set(`key-${String(i).padStart(5, '0')}`, `val-${i}`)
        }
        const s = await idx.stats()
        expect(s.height).toBeGreaterThanOrEqual(2)
    })

    it('freePages increases after delete-driven COW operations', async () => {
        const idx = await strIdx()
        for (let i = 0; i < 20; i++) await idx.set(`k${i}`, `v${i}`)
        const s0 = await idx.stats()
        // COW operations on insert create free pages; freePages should be > 0
        expect(s0.freePages).toBeGreaterThan(0)
    })

    it('fillFactor is between 0 and 1 after inserts with COW overhead', async () => {
        const idx = await strIdx()
        for (let i = 0; i < 50; i++) await idx.set(`k${i}`, `v${i}`)
        const s = await idx.stats()
        expect(s.fillFactor).toBeGreaterThan(0)
        expect(s.fillFactor).toBeLessThanOrEqual(1)
    })

    it('pageCount from stats matches structural expectation', async () => {
        const idx = await strIdx()
        await idx.set('a', '1')
        const s = await idx.stats()
        // pageCount is always at least 3 (2 superblocks + 1 root)
        expect(s.pageCount).toBeGreaterThanOrEqual(3)
    })
})

// ── compact ───────────────────────────────────────────────────────────────────

describe('BPlusIndex — compact()', () => {
    it('compact() on a fresh empty index is a no-op (nothing to reclaim)', async () => {
        const idx = await strIdx()
        const statsBefore = await idx.stats()
        await idx.compact()
        const statsAfter = await idx.stats()
        expect(statsAfter.pageCount).toBe(statsBefore.pageCount)
        expect(statsAfter.freePages).toBe(0)
    })

    it('compact() reduces pageCount and sets freePages to 0', async () => {
        const idx = await strIdx()
        for (let i = 0; i < 50; i++) await idx.set(`k${i}`, `v${i}`)
        const before = await idx.stats()
        // COW operations will have created free pages
        expect(before.freePages).toBeGreaterThan(0)

        await idx.compact()

        const after = await idx.stats()
        expect(after.pageCount).toBeLessThan(before.pageCount)
        expect(after.freePages).toBe(0)
        expect(after.fillFactor).toBe(1)
    })

    it('post-compact reads match pre-compact data (partial delete)', async () => {
        const idx = await strIdx()
        const N = 100
        for (let i = 0; i < N; i++) await idx.set(`key-${String(i).padStart(4, '0')}`, `val-${i}`)
        // Delete even-indexed entries
        for (let i = 0; i < N; i += 2) await idx.delete(`key-${String(i).padStart(4, '0')}`)

        const preCompact = await collectEntries(idx)

        await idx.compact()

        const postCompact = await collectEntries(idx)
        expect(postCompact).toEqual(preCompact)
        expect(idx.size).toBe(N / 2)
    })

    it('post-compact size and individual lookups are correct', async () => {
        const idx = await strIdx()
        for (let i = 0; i < 60; i++) await idx.set(`item-${i}`, `data-${i}`)
        for (let i = 30; i < 60; i++) await idx.delete(`item-${i}`)

        await idx.compact()

        expect(idx.size).toBe(30)
        for (let i = 0; i < 30; i++) {
            expect(await idx.get(`item-${i}`)).toBe(`data-${i}`)
        }
        for (let i = 30; i < 60; i++) {
            expect(await idx.get(`item-${i}`)).toBeUndefined()
        }
    })

    it('compact() on a multi-level tree preserves all entries', async () => {
        const idx = await strIdx()
        const N = 400
        for (let i = 0; i < N; i++) {
            await idx.set(`key-${String(i).padStart(5, '0')}`, `val-${i}`)
        }
        const beforeStats = await idx.stats()
        expect(beforeStats.height).toBeGreaterThanOrEqual(2)

        const preCompact = await collectEntries(idx)

        await idx.compact()

        const postCompact = await collectEntries(idx)
        expect(postCompact).toEqual(preCompact)
        expect(idx.size).toBe(N)
    })

    it('compact() + reopen yields the same data', async () => {
        const adapter = new MemoryAdapter()
        const opts = {
            adapter,
            ...BPlusIndex.keyPreset.string,
            serializeValue:   (v: string) => new TextEncoder().encode(v),
            deserializeValue: (b: Uint8Array) => new TextDecoder().decode(b),
        }

        const idx1 = await BPlusIndex.open<string, string>(opts)
        for (let i = 0; i < 50; i++) await idx1.set(`k${i}`, `v${i}`)
        for (let i = 0; i < 25; i++) await idx1.delete(`k${i * 2}`)

        const preCompact = await collectEntries(idx1)
        await idx1.compact()
        await idx1.close()

        const idx2 = await BPlusIndex.open<string, string>(opts)
        expect(idx2.size).toBe(25)
        const afterReopen = await collectEntries(idx2)
        expect(afterReopen).toEqual(preCompact)
    })

    it('compact() preserves range scan order', async () => {
        const idx = await numIdx()
        const N = 200
        for (let i = 0; i < N; i++) await idx.set(i, i * 10)
        for (let i = 0; i < N; i += 3) await idx.delete(i)

        const before: number[] = []
        for await (const [k] of idx.range()) before.push(k)

        await idx.compact()

        const after: number[] = []
        for await (const [k] of idx.range()) after.push(k)

        expect(after).toEqual(before)
    })

    it('compact() twice in a row is idempotent', async () => {
        const idx = await strIdx()
        for (let i = 0; i < 40; i++) await idx.set(`k${i}`, `v${i}`)
        for (let i = 0; i < 20; i++) await idx.delete(`k${i}`)

        await idx.compact()
        const afterFirst = await idx.stats()

        await idx.compact()
        const afterSecond = await idx.stats()

        expect(afterSecond.pageCount).toBe(afterFirst.pageCount)
        expect(afterSecond.freePages).toBe(0)
    })

    it('compact() works correctly after bulkLoad', async () => {
        const N = 300
        const entries: [string, string][] = []
        for (let i = 0; i < N; i++) entries.push([`key-${String(i).padStart(5, '0')}`, `v${i}`])
        const idx = await BPlusIndex.bulkLoad({
            adapter: new MemoryAdapter(),
            ...BPlusIndex.keyPreset.string,
            serializeValue:   (v: string) => new TextEncoder().encode(v),
            deserializeValue: (b: Uint8Array) => new TextDecoder().decode(b),
        }, entries)

        // Delete a third of entries to create free pages
        for (let i = 0; i < N; i += 3) await idx.delete(`key-${String(i).padStart(5, '0')}`)

        const before = await collectEntries(idx)
        await idx.compact()
        const after = await collectEntries(idx)

        expect(after).toEqual(before)
        expect((await idx.stats()).freePages).toBe(0)
    })

    it('stats() after compact() reports correct height', async () => {
        const idx = await strIdx()
        const N = 400
        for (let i = 0; i < N; i++) {
            await idx.set(`key-${String(i).padStart(5, '0')}`, `val-${i}`)
        }

        const heightBefore = (await idx.stats()).height
        await idx.compact()
        const heightAfter = (await idx.stats()).height

        // Height should not change — compaction does not restructure the tree
        expect(heightAfter).toBe(heightBefore)
    })
})
