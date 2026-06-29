import type { StorageAdapter } from './types'

// Latin-1 encode: one byte becomes one char (code point 0-255).
// Avoids base64 bloat; every localStorage char is exactly one byte of page data.
function _bytesToLatin1(buf: Uint8Array): string {
    // Avoid spread-into-String.fromCharCode for large arrays (arg-count limit).
    let s = ''
    for (let i = 0; i < buf.length; i++) s += String.fromCharCode(buf[i])
    return s
}

function _latin1ToBytes(s: string): Uint8Array {
    const buf = new Uint8Array(s.length)
    for (let i = 0; i < s.length; i++) buf[i] = s.charCodeAt(i) & 0xff
    return buf
}

/**
 * Browser main-thread storage adapter for BPlusIndex backed by `localStorage`.
 *
 * Each page is stored under `<prefix>page:<pageId>` as a latin-1 string
 * (1 byte → 1 char), staying within the ~5 MB origin quota without base64
 * overhead.
 *
 * CONSTRAINTS
 * - Synchronous under the hood; single-tab only.
 * - `truncate` is intentionally omitted — localStorage provides no way to
 *   shrink the key namespace atomically.
 * - Requires `localStorage` to be available; throws on first I/O otherwise.
 *
 * @example
 * ```ts
 * const adapter = new LocalStorageAdapter('myapp:index:')
 * const idx = await BPlusIndex.open({ ...opts, adapter })
 * ```
 */
export class LocalStorageAdapter implements StorageAdapter {
    private readonly _prefix: string

    /**
     * @param prefix  Namespace prepended to every key written into localStorage.
     *                Default `'bplus:'`. Use a unique prefix per index to avoid
     *                collisions with other indexes or unrelated localStorage data.
     */
    constructor(prefix = 'bplus:') {
        this._prefix = prefix
    }

    private _key(pageId: number): string {
        return `${this._prefix}page:${pageId}`
    }

    private _storage(): Storage {
        const ls = (globalThis as any).localStorage as Storage | undefined
        if (!ls) {
            throw new Error(
                'LocalStorageAdapter requires localStorage. ' +
                'It must run in a browser main-thread context.'
            )
        }
        return ls
    }

    async read(pageId: number): Promise<Uint8Array | null> {
        const raw = this._storage().getItem(this._key(pageId))
        if (raw === null) return null
        return _latin1ToBytes(raw)
    }

    async write(pageId: number, data: Uint8Array): Promise<void> {
        this._storage().setItem(this._key(pageId), _bytesToLatin1(data))
    }

    // truncate is omitted per the adapter contract — localStorage cannot shrink.

    async flush(): Promise<void> { /* localStorage writes are synchronous */ }
    async close(): Promise<void> { /* no handle to release */ }
}
