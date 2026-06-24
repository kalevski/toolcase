import { describe, it, expect, afterEach } from 'vitest'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import { unlink, open as fsOpen } from 'node:fs/promises'
import { BPlusIndex, FsAdapter } from '../src/BPlusIndex'

// ── helpers ──────────────────────────────────────────────────────────────────

let _counter = 0
function tmpPath(): string {
    return join(tmpdir(), `bplus-fsadapter-test-${process.pid}-${++_counter}.idx`)
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

// ── basic read / write ────────────────────────────────────────────────────────

describe('FsAdapter — basic read / write', () => {
    it('creates the file on first write and reads back the same bytes', async () => {
        const path = track(tmpPath())
        const adapter = new FsAdapter(path)
        const data = new Uint8Array(4096)
        data[0] = 0xde; data[1] = 0xad; data[4095] = 0xff
        await adapter.write(0, data)
        const result = await adapter.read(0)
        expect(result).not.toBeNull()
        expect(result![0]).toBe(0xde)
        expect(result![1]).toBe(0xad)
        expect(result![4095]).toBe(0xff)
        await adapter.close()
    })

    it('positions writes correctly: page 2 is at offset 2 * pageSize', async () => {
        const path = track(tmpPath())
        const adapter = new FsAdapter(path, 512)
        const p0 = new Uint8Array(512).fill(0xaa)
        const p2 = new Uint8Array(512).fill(0xbb)
        await adapter.write(0, p0)
        await adapter.write(2, p2)
        const got = await adapter.read(2)
        expect(got).not.toBeNull()
        expect(got!.every(b => b === 0xbb)).toBe(true)
        await adapter.close()
    })
})

// ── past-EOF behaviour ────────────────────────────────────────────────────────

describe('FsAdapter — past-EOF reads', () => {
    it('returns null for a page wholly past EOF', async () => {
        const path = track(tmpPath())
        const adapter = new FsAdapter(path, 4096)
        // Write only page 0; page 5 is well past EOF
        const buf = new Uint8Array(4096).fill(1)
        await adapter.write(0, buf)
        expect(await adapter.read(5)).toBeNull()
        await adapter.close()
    })

    it('returns null on a brand-new empty file', async () => {
        const path = track(tmpPath())
        const adapter = new FsAdapter(path, 4096)
        expect(await adapter.read(0)).toBeNull()
        await adapter.close()
    })
})

// ── torn / partial-page reads ─────────────────────────────────────────────────

describe('FsAdapter — torn page (short tail read)', () => {
    it('returns a zero-filled buffer when the file is truncated mid-page', async () => {
        const PAGE_SIZE = 4096
        const path = track(tmpPath())

        // Write three pages of 0xff
        const adapter = new FsAdapter(path, PAGE_SIZE)
        const full = new Uint8Array(PAGE_SIZE).fill(0xff)
        await adapter.write(0, full)
        await adapter.write(1, full)
        await adapter.write(2, full)
        await adapter.close()

        // Simulate a torn write: truncate the file to 1.5 pages
        const fh = await fsOpen(path, 'r+')
        await fh.truncate(PAGE_SIZE + PAGE_SIZE / 2)
        await fh.close()

        const adapter2 = new FsAdapter(path, PAGE_SIZE)

        // Page 1: partially written — bytesRead < pageSize, trailing bytes must be zero
        const torn = await adapter2.read(1)
        expect(torn).not.toBeNull()
        const halfSize = PAGE_SIZE / 2
        // First half should contain the original 0xff bytes
        expect(torn![0]).toBe(0xff)
        expect(torn![halfSize - 1]).toBe(0xff)
        // Second half must be zero-filled (CRC will reject this page)
        expect(torn![halfSize]).toBe(0)
        expect(torn![PAGE_SIZE - 1]).toBe(0)

        // Page 2: wholly past EOF → null
        expect(await adapter2.read(2)).toBeNull()

        await adapter2.close()
    })
})

// ── truncate ─────────────────────────────────────────────────────────────────

describe('FsAdapter — truncate', () => {
    it('removes pages at or beyond pageCount', async () => {
        const path = track(tmpPath())
        const adapter = new FsAdapter(path, 4096)
        for (let i = 0; i < 5; i++) {
            await adapter.write(i, new Uint8Array(4096).fill(i))
        }
        await adapter.truncate(3)
        expect(await adapter.read(3)).toBeNull()
        expect(await adapter.read(4)).toBeNull()
        const still = await adapter.read(2)
        expect(still).not.toBeNull()
        expect(still![0]).toBe(2)
        await adapter.close()
    })
})

// ── reopen-after-write ────────────────────────────────────────────────────────

describe('FsAdapter + BPlusIndex — reopen after write', () => {
    it('persists all entries across close/reopen', async () => {
        const path = track(tmpPath())

        // First session: write entries
        const idx1 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new FsAdapter(path),
        })
        for (let i = 0; i < 50; i++) {
            await idx1.set(`key-${String(i).padStart(3, '0')}`, `value-${i}`)
        }
        expect(idx1.size).toBe(50)
        await idx1.close()

        // Second session: reopen and verify
        const idx2 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new FsAdapter(path),
        })
        expect(idx2.size).toBe(50)
        for (let i = 0; i < 50; i++) {
            expect(await idx2.get(`key-${String(i).padStart(3, '0')}`)).toBe(`value-${i}`)
        }
        await idx2.close()
    })

    it('handles updates and deletes across sessions', async () => {
        const path = track(tmpPath())

        const idx1 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new FsAdapter(path),
        })
        await idx1.set('a', 'first')
        await idx1.set('b', 'keep')
        await idx1.close()

        const idx2 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new FsAdapter(path),
        })
        await idx2.set('a', 'updated')
        await idx2.delete('b')
        await idx2.close()

        const idx3 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new FsAdapter(path),
        })
        expect(await idx3.get('a')).toBe('updated')
        expect(await idx3.has('b')).toBe(false)
        expect(idx3.size).toBe(1)
        await idx3.close()
    })
})

// ── flush / fsync ─────────────────────────────────────────────────────────────

describe('FsAdapter — flush', () => {
    it('flush() does not throw and leaves data intact', async () => {
        const path = track(tmpPath())
        const adapter = new FsAdapter(path, 4096)
        const buf = new Uint8Array(4096).fill(7)
        await adapter.write(0, buf)
        await adapter.flush()
        const got = await adapter.read(0)
        expect(got).not.toBeNull()
        expect(got![0]).toBe(7)
        await adapter.close()
    })
})
