import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { BPlusIndex, LocalStorageAdapter } from '../src/BPlusIndex'

// ── localStorage shim ─────────────────────────────────────────────────────────
//
// Node.js has no localStorage. This shim faithfully reproduces the
// getItem / setItem / removeItem / clear contract so LocalStorageAdapter
// can be exercised without a browser.

function createLocalStorageShim(): Storage {
    const store = new Map<string, string>()
    return {
        get length() { return store.size },
        key(n: number): string | null {
            return [...store.keys()][n] ?? null
        },
        getItem(key: string): string | null {
            return store.has(key) ? store.get(key)! : null
        },
        setItem(key: string, value: string): void {
            store.set(key, value)
        },
        removeItem(key: string): void {
            store.delete(key)
        },
        clear(): void {
            store.clear()
        },
    } as Storage
}

function installLocalStorageShim(): Storage {
    const shim = createLocalStorageShim()
    vi.stubGlobal('localStorage', shim)
    return shim
}

// ── fixture helpers ───────────────────────────────────────────────────────────

let _counter = 0
function lsPrefix(): string { return `bplus-test-${++_counter}:` }

const strOpts = {
    ...BPlusIndex.keyPreset.string,
    serializeValue:   (v: string) => new TextEncoder().encode(v),
    deserializeValue: (b: Uint8Array) => new TextDecoder().decode(b),
}

beforeEach(() => {
    installLocalStorageShim()
})

afterEach(() => {
    vi.unstubAllGlobals()
})

// ── basic read / write ────────────────────────────────────────────────────────

describe('LocalStorageAdapter — basic read / write', () => {
    it('write then read returns the same bytes', async () => {
        const adapter = new LocalStorageAdapter(lsPrefix())
        const data = new Uint8Array(4096)
        data[0] = 0xde; data[1] = 0xad; data[4095] = 0xff
        await adapter.write(0, data)
        const result = await adapter.read(0)
        expect(result).not.toBeNull()
        expect(result![0]).toBe(0xde)
        expect(result![1]).toBe(0xad)
        expect(result![4095]).toBe(0xff)
    })

    it('multiple pages are stored independently', async () => {
        const PAGE = 256
        const adapter = new LocalStorageAdapter(lsPrefix())
        for (let i = 0; i < 4; i++) {
            await adapter.write(i, new Uint8Array(PAGE).fill(i))
        }
        for (let i = 0; i < 4; i++) {
            const got = await adapter.read(i)
            expect(got).not.toBeNull()
            expect(got!.every(b => b === i)).toBe(true)
        }
    })

    it('overwriting a page replaces the previous content', async () => {
        const adapter = new LocalStorageAdapter(lsPrefix())
        const first = new Uint8Array(4096).fill(0xaa)
        const second = new Uint8Array(4096).fill(0xbb)
        await adapter.write(0, first)
        await adapter.write(0, second)
        const got = await adapter.read(0)
        expect(got).not.toBeNull()
        expect(got![0]).toBe(0xbb)
    })

    it('preserves all 256 byte values round-trip (latin-1 encoding)', async () => {
        const adapter = new LocalStorageAdapter(lsPrefix())
        const data = new Uint8Array(256)
        for (let i = 0; i < 256; i++) data[i] = i
        await adapter.write(0, data)
        const got = await adapter.read(0)
        expect(got).not.toBeNull()
        for (let i = 0; i < 256; i++) {
            expect(got![i]).toBe(i)
        }
    })
})

// ── absent page ───────────────────────────────────────────────────────────────

describe('LocalStorageAdapter — absent page', () => {
    it('returns null for a page that was never written', async () => {
        const adapter = new LocalStorageAdapter(lsPrefix())
        expect(await adapter.read(0)).toBeNull()
        expect(await adapter.read(99)).toBeNull()
    })
})

// ── prefix isolation ──────────────────────────────────────────────────────────

describe('LocalStorageAdapter — prefix isolation', () => {
    it('two adapters with different prefixes do not share pages', async () => {
        const a = new LocalStorageAdapter('nsA:')
        const b = new LocalStorageAdapter('nsB:')
        await a.write(0, new Uint8Array(16).fill(0xaa))
        await b.write(0, new Uint8Array(16).fill(0xbb))
        const ra = await a.read(0)
        const rb = await b.read(0)
        expect(ra![0]).toBe(0xaa)
        expect(rb![0]).toBe(0xbb)
    })

    it('default prefix is "bplus:"', async () => {
        const shim = (globalThis as unknown as { localStorage: Storage }).localStorage
        const adapter = new LocalStorageAdapter()
        await adapter.write(5, new Uint8Array(4).fill(0x01))
        expect(shim.getItem('bplus:page:5')).not.toBeNull()
    })
})

// ── flush and close ───────────────────────────────────────────────────────────

describe('LocalStorageAdapter — flush / close', () => {
    it('flush() is a no-op and leaves data intact', async () => {
        const adapter = new LocalStorageAdapter(lsPrefix())
        await adapter.write(0, new Uint8Array(4096).fill(7))
        await adapter.flush()
        const got = await adapter.read(0)
        expect(got).not.toBeNull()
        expect(got![0]).toBe(7)
    })

    it('close() is a no-op and data is still readable', async () => {
        const adapter = new LocalStorageAdapter(lsPrefix())
        await adapter.write(0, new Uint8Array(4096).fill(3))
        await adapter.close()
        const got = await adapter.read(0)
        expect(got).not.toBeNull()
        expect(got![0]).toBe(3)
    })
})

// ── localStorage unavailable ──────────────────────────────────────────────────

describe('LocalStorageAdapter — localStorage unavailable', () => {
    it('throws a descriptive error when localStorage is absent', async () => {
        vi.unstubAllGlobals()
        const adapter = new LocalStorageAdapter('test:')
        await expect(adapter.read(0)).rejects.toThrow('LocalStorageAdapter requires localStorage')
    })
})

// ── BPlusIndex integration ────────────────────────────────────────────────────

describe('LocalStorageAdapter + BPlusIndex — persistence across instances', () => {
    it('persists entries after closing and reopening with the same shim', async () => {
        const prefix = lsPrefix()

        const idx1 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new LocalStorageAdapter(prefix),
        })
        for (let i = 0; i < 50; i++) {
            await idx1.set(`key-${String(i).padStart(3, '0')}`, `value-${i}`)
        }
        expect(idx1.size).toBe(50)
        await idx1.close()

        const idx2 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new LocalStorageAdapter(prefix),
        })
        expect(idx2.size).toBe(50)
        for (let i = 0; i < 50; i++) {
            expect(await idx2.get(`key-${String(i).padStart(3, '0')}`)).toBe(`value-${i}`)
        }
        await idx2.close()
    })

    it('handles updates and deletes across sessions', async () => {
        const prefix = lsPrefix()

        const idx1 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new LocalStorageAdapter(prefix),
        })
        await idx1.set('a', 'first')
        await idx1.set('b', 'keep')
        await idx1.close()

        const idx2 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new LocalStorageAdapter(prefix),
        })
        await idx2.set('a', 'updated')
        await idx2.delete('b')
        await idx2.close()

        const idx3 = await BPlusIndex.open<string, string>({
            ...strOpts,
            adapter: new LocalStorageAdapter(prefix),
        })
        expect(await idx3.get('a')).toBe('updated')
        expect(await idx3.has('b')).toBe(false)
        expect(idx3.size).toBe(1)
        await idx3.close()
    })
})
