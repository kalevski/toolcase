import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BPlusIndex, OpfsAdapter } from '../src/BPlusIndex'

// ── Mock OPFS implementation ──────────────────────────────────────────────────
//
// The real FileSystemSyncAccessHandle is only available in browser Web Workers.
// These tests stub navigator.storage.getDirectory() with an in-memory
// implementation that faithfully reproduces the read/write/truncate/getSize
// semantics so the adapter logic can be exercised in a Node.js test environment.

// Persistent backing store for each file name.
// Lives outside createMockHandle() so data survives handle close/reopen.
const mockStorage = new Map<string, Uint8Array>()

function createMockHandle(name: string) {
    let closed = false

    const get = (): Uint8Array => mockStorage.get(name) ?? new Uint8Array(0)
    const set = (data: Uint8Array): void => { mockStorage.set(name, data) }

    return {
        read(buffer: ArrayBufferView, opts?: { at?: number }): number {
            if (closed) throw new Error('handle is closed')
            const at = opts?.at ?? 0
            const src = get()
            const dst = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
            const avail = Math.max(0, src.byteLength - at)
            const n = Math.min(dst.byteLength, avail)
            if (n > 0) dst.set(src.subarray(at, at + n))
            return n
        },
        write(buffer: ArrayBufferView, opts?: { at?: number }): number {
            if (closed) throw new Error('handle is closed')
            const at = opts?.at ?? 0
            const src2 = new Uint8Array(buffer.buffer, buffer.byteOffset, buffer.byteLength)
            const cur = get()
            const end = at + src2.byteLength
            const next = end > cur.byteLength
                ? (() => { const a = new Uint8Array(end); a.set(cur); return a })()
                : cur
            next.set(src2, at)
            set(next)
            return src2.byteLength
        },
        flush(): void { if (closed) throw new Error('handle is closed') },
        getSize(): number {
            if (closed) throw new Error('handle is closed')
            return get().byteLength
        },
        truncate(size: number): void {
            if (closed) throw new Error('handle is closed')
            const cur = get()
            const next = new Uint8Array(size)
            next.set(cur.subarray(0, Math.min(cur.byteLength, size)))
            set(next)
        },
        close(): void { closed = true },
    }
}

function installOpfsMock(): void {
    vi.stubGlobal('navigator', {
        storage: {
            getDirectory: vi.fn(async () => ({
                getFileHandle: vi.fn(async (name: string, opts?: { create?: boolean }) => {
                    if (!mockStorage.has(name)) {
                        if (opts?.create) mockStorage.set(name, new Uint8Array(0))
                        else throw new Error(`OPFS: file not found: ${name}`)
                    }
                    return {
                        createSyncAccessHandle: vi.fn(async () => createMockHandle(name)),
                    }
                }),
            })),
        },
    })
}

// ── fixture helpers ───────────────────────────────────────────────────────────

let _counter = 0
function opfsName(): string { return `bplus-opfs-test-${++_counter}.idx` }

const strOpts = {
    ...BPlusIndex.keyPreset.string,
    serializeValue:   (v: string) => new TextEncoder().encode(v),
    deserializeValue: (b: Uint8Array) => new TextDecoder().decode(b),
}

beforeEach(() => {
    mockStorage.clear()
    installOpfsMock()
})

afterEach(() => {
    vi.unstubAllGlobals()
})

// ── basic read / write ────────────────────────────────────────────────────────

describe('OpfsAdapter — basic read / write', () => {
    it('creates the file on first write and reads back the same bytes', async () => {
        const adapter = new OpfsAdapter(opfsName())
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

    it('positions writes correctly: page 2 is at offset 2 × pageSize', async () => {
        const adapter = new OpfsAdapter(opfsName(), 512)
        const p0 = new Uint8Array(512).fill(0xaa)
        const p2 = new Uint8Array(512).fill(0xbb)
        await adapter.write(0, p0)
        await adapter.write(2, p2)
        const got = await adapter.read(2)
        expect(got).not.toBeNull()
        expect(got!.every(b => b === 0xbb)).toBe(true)
        await adapter.close()
    })

    it('independent pages do not overlap', async () => {
        const PAGE = 256
        const adapter = new OpfsAdapter(opfsName(), PAGE)
        for (let i = 0; i < 4; i++) {
            await adapter.write(i, new Uint8Array(PAGE).fill(i))
        }
        for (let i = 0; i < 4; i++) {
            const got = await adapter.read(i)
            expect(got).not.toBeNull()
            expect(got!.every(b => b === i)).toBe(true)
        }
        await adapter.close()
    })
})

// ── past-EOF behaviour ────────────────────────────────────────────────────────

describe('OpfsAdapter — past-EOF reads', () => {
    it('returns null for a page wholly past EOF', async () => {
        const adapter = new OpfsAdapter(opfsName())
        const buf = new Uint8Array(4096).fill(1)
        await adapter.write(0, buf)
        expect(await adapter.read(5)).toBeNull()
        await adapter.close()
    })

    it('returns null on a brand-new empty file', async () => {
        const adapter = new OpfsAdapter(opfsName())
        expect(await adapter.read(0)).toBeNull()
        await adapter.close()
    })
})

// ── torn / partial-page reads ─────────────────────────────────────────────────

describe('OpfsAdapter — torn page (short tail read)', () => {
    it('returns a zero-padded buffer when the file is truncated mid-page', async () => {
        const PAGE = 4096
        const name = opfsName()
        const adapter = new OpfsAdapter(name, PAGE)

        // Write three full pages of 0xff
        const full = new Uint8Array(PAGE).fill(0xff)
        await adapter.write(0, full)
        await adapter.write(1, full)
        await adapter.write(2, full)

        // Simulate a torn write by truncating the mock storage directly
        const raw = mockStorage.get(name)!
        const torn = raw.subarray(0, PAGE + PAGE / 2)
        mockStorage.set(name, new Uint8Array(torn))

        // Page 1: partially written — second half must be zero-filled
        const result = await adapter.read(1)
        expect(result).not.toBeNull()
        const half = PAGE / 2
        expect(result![0]).toBe(0xff)
        expect(result![half - 1]).toBe(0xff)
        expect(result![half]).toBe(0)
        expect(result![PAGE - 1]).toBe(0)

        // Page 2: wholly past EOF
        expect(await adapter.read(2)).toBeNull()

        await adapter.close()
    })
})

// ── truncate ─────────────────────────────────────────────────────────────────

describe('OpfsAdapter — truncate', () => {
    it('removes pages at or beyond pageCount', async () => {
        const adapter = new OpfsAdapter(opfsName(), 4096)
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

// ── flush ─────────────────────────────────────────────────────────────────────

describe('OpfsAdapter — flush', () => {
    it('flush() does not throw and leaves data intact', async () => {
        const adapter = new OpfsAdapter(opfsName())
        const buf = new Uint8Array(4096).fill(7)
        await adapter.write(0, buf)
        await adapter.flush()
        const got = await adapter.read(0)
        expect(got).not.toBeNull()
        expect(got![0]).toBe(7)
        await adapter.close()
    })

    it('flush() before any write is a no-op', async () => {
        const adapter = new OpfsAdapter(opfsName())
        await expect(adapter.flush()).resolves.toBeUndefined()
    })
})

// ── close / reopen ────────────────────────────────────────────────────────────

describe('OpfsAdapter — close and reopen', () => {
    it('data persists after close and reopen', async () => {
        const name = opfsName()
        const adapter1 = new OpfsAdapter(name)
        const buf = new Uint8Array(4096)
        buf[0] = 0x42
        await adapter1.write(0, buf)
        await adapter1.close()

        const adapter2 = new OpfsAdapter(name)
        const got = await adapter2.read(0)
        expect(got).not.toBeNull()
        expect(got![0]).toBe(0x42)
        await adapter2.close()
    })
})

// ── OPFS unavailable ──────────────────────────────────────────────────────────

describe('OpfsAdapter — OPFS unavailable', () => {
    it('throws a descriptive error when navigator.storage is absent', async () => {
        vi.unstubAllGlobals()
        // navigator is undefined in Node.js
        const adapter = new OpfsAdapter('test.idx')
        await expect(adapter.read(0)).rejects.toThrow(
            'OpfsAdapter requires the Origin Private File System API'
        )
    })
})

// ── BPlusIndex integration ────────────────────────────────────────────────────

describe('OpfsAdapter + BPlusIndex — reopen after write', () => {
    it('persists all entries across close/reopen', async () => {
        const name = opfsName()

        const idx1 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new OpfsAdapter(name),
        })
        for (let i = 0; i < 50; i++) {
            await idx1.set(`key-${String(i).padStart(3, '0')}`, `value-${i}`)
        }
        expect(idx1.size).toBe(50)
        await idx1.close()

        const idx2 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new OpfsAdapter(name),
        })
        expect(idx2.size).toBe(50)
        for (let i = 0; i < 50; i++) {
            expect(await idx2.get(`key-${String(i).padStart(3, '0')}`)).toBe(`value-${i}`)
        }
        await idx2.close()
    })

    it('handles updates and deletes across sessions', async () => {
        const name = opfsName()

        const idx1 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new OpfsAdapter(name),
        })
        await idx1.set('a', 'first')
        await idx1.set('b', 'keep')
        await idx1.close()

        const idx2 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new OpfsAdapter(name),
        })
        await idx2.set('a', 'updated')
        await idx2.delete('b')
        await idx2.close()

        const idx3 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new OpfsAdapter(name),
        })
        expect(await idx3.get('a')).toBe('updated')
        expect(await idx3.has('b')).toBe(false)
        expect(idx3.size).toBe(1)
        await idx3.close()
    })
})
