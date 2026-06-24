import type { FileHandle } from 'node:fs/promises'
import type { StorageAdapter } from './types'

// Module-level cache so the dynamic import resolves only once per process.
// Both values are undefined until the first FsAdapter._open() call, which
// keeps node:fs out of browser bundle dependency graphs.
let _open: ((path: string, flags: number) => Promise<FileHandle>) | undefined
let _O_RDWR_CREAT: number | undefined

async function _requireOpen(): Promise<(path: string, flags: number) => Promise<FileHandle>> {
    if (_open) return _open
    const [fsp, fs] = await Promise.all([
        import('node:fs/promises'),
        import('node:fs'),
    ])
    _O_RDWR_CREAT = fs.constants.O_RDWR | fs.constants.O_CREAT
    _open = fsp.open
    return _open
}

/**
 * Single-file Node.js storage adapter for BPlusIndex.
 *
 * Stores page N at byte offset N * pageSize.  Opens the file with O_RDWR |
 * O_CREAT so it is created on first use and never truncated on open.
 *
 * The node:fs import is deferred inside _open() so browser bundlers can
 * tree-shake the dependency when FsAdapter is never instantiated.
 */
export class FsAdapter implements StorageAdapter {
    private readonly _path: string
    private readonly _pageSize: number
    private _handle: FileHandle | null = null
    // Shared promise so concurrent calls before the handle is ready resolve together
    private _opening: Promise<FileHandle> | null = null

    constructor(path: string, pageSize = 4096) {
        this._path = path
        this._pageSize = pageSize
    }

    private _openHandle(): Promise<FileHandle> {
        if (this._handle !== null) return Promise.resolve(this._handle)
        if (this._opening !== null) return this._opening
        this._opening = (async () => {
            const open = await _requireOpen()
            const handle = await open(this._path, _O_RDWR_CREAT!)
            this._handle = handle
            this._opening = null
            return handle
        })()
        return this._opening
    }

    async read(pageId: number): Promise<Uint8Array | null> {
        const handle   = await this._openHandle()
        const buf      = new Uint8Array(this._pageSize)
        const position = pageId * this._pageSize
        const { bytesRead } = await handle.read(buf, 0, this._pageSize, position)
        if (bytesRead === 0) return null
        // Short tail reads leave trailing bytes as zero — CRC check rejects torn pages
        return buf
    }

    async write(pageId: number, data: Uint8Array): Promise<void> {
        const handle = await this._openHandle()
        await handle.write(data, 0, data.length, pageId * this._pageSize)
    }

    async truncate(pageCount: number): Promise<void> {
        const handle = await this._openHandle()
        await handle.truncate(pageCount * this._pageSize)
    }

    async flush(): Promise<void> {
        if (this._handle !== null) await this._handle.sync()
    }

    async close(): Promise<void> {
        if (this._handle !== null) {
            await this._handle.close()
            this._handle = null
        }
    }
}
