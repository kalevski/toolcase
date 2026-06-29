import type { StorageAdapter } from './types'

// Minimal subset of the OPFS FileSystemSyncAccessHandle API.
// The full DOM typings are intentionally excluded from this isomorphic package.
interface _SyncHandle {
    read(buffer: ArrayBufferView, options?: { at?: number }): number
    write(buffer: ArrayBufferView, options?: { at?: number }): number
    flush(): void
    getSize(): number
    truncate(size: number): void
    close(): void
}

async function _openSyncHandle(name: string): Promise<_SyncHandle> {
    // navigator.storage.getDirectory() is only present in browser/worker contexts.
    // Reading it lazily here (never at module load time) keeps Node.js builds safe.
    const nav = (globalThis as any).navigator
    if (typeof nav?.storage?.getDirectory !== 'function') {
        throw new Error(
            'OpfsAdapter requires the Origin Private File System API ' +
            '(navigator.storage.getDirectory). It must run inside a dedicated Web Worker.'
        )
    }
    const root = await (nav.storage.getDirectory() as Promise<any>)
    const fh = await root.getFileHandle(name, { create: true })
    return fh.createSyncAccessHandle() as _SyncHandle
}

/**
 * Browser Web Worker storage adapter for BPlusIndex backed by the Origin
 * Private File System (OPFS).
 *
 * CONSTRAINTS
 * - MUST run in a dedicated Web Worker. FileSystemSyncAccessHandle is only
 *   available in worker contexts; calling it on the main thread throws.
 * - OPFS acquires an exclusive lock on the file for the lifetime of the
 *   SyncAccessHandle, enforcing the single-writer guarantee required by
 *   BPlusIndex without any additional locking.
 *
 * PAGE LAYOUT
 * Page N is stored at byte offset N × pageSize — identical to FsAdapter.
 *
 * TREE-SHAKING
 * navigator.storage.getDirectory() is accessed lazily inside _openHandle().
 * The OPFS API is never referenced at module load time, so bundlers can
 * tree-shake this adapter out of non-browser builds when OpfsAdapter is never
 * instantiated.
 *
 * @example
 * ```ts
 * // Inside a dedicated Web Worker:
 * const adapter = new OpfsAdapter('myindex.idx')
 * const idx = await BPlusIndex.open({ ...opts, adapter })
 * ```
 */
export class OpfsAdapter implements StorageAdapter {
    private readonly _name: string
    private readonly _pageSize: number
    private _handle: _SyncHandle | null = null
    private _opening: Promise<_SyncHandle> | null = null

    /**
     * @param name      OPFS file name relative to the OPFS root directory.
     * @param pageSize  Must match the pageSize used when the index was first
     *                  created (default 4096, matching BPlusIndex's default).
     */
    constructor(name: string, pageSize = 4096) {
        this._name = name
        this._pageSize = pageSize
    }

    private _openHandle(): Promise<_SyncHandle> {
        if (this._handle !== null) return Promise.resolve(this._handle)
        if (this._opening !== null) return this._opening
        this._opening = (async () => {
            const handle = await _openSyncHandle(this._name)
            this._handle = handle
            this._opening = null
            return handle
        })()
        return this._opening
    }

    async read(pageId: number): Promise<Uint8Array | null> {
        const handle = await this._openHandle()
        const offset = pageId * this._pageSize
        if (offset >= handle.getSize()) return null
        const buf = new Uint8Array(this._pageSize)
        handle.read(buf, { at: offset })
        // Short reads (torn page at EOF) leave trailing bytes zeroed — the CRC
        // check inside BPlusIndex rejects such pages without further handling.
        return buf
    }

    async write(pageId: number, data: Uint8Array): Promise<void> {
        const handle = await this._openHandle()
        handle.write(data, { at: pageId * this._pageSize })
    }

    async truncate(pageCount: number): Promise<void> {
        const handle = await this._openHandle()
        handle.truncate(pageCount * this._pageSize)
    }

    async flush(): Promise<void> {
        if (this._handle !== null) this._handle.flush()
    }

    async close(): Promise<void> {
        if (this._handle !== null) {
            this._handle.close()
            this._handle = null
        }
    }
}
