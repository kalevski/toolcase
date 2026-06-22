import { open as fsOpen, unlink, readdir } from 'node:fs/promises'
import { constants } from 'node:fs'
import { basename, dirname } from 'node:path'
import type { FileHandle } from 'node:fs/promises'
import type { BlockRef } from './BlockRef'

const O_FLAGS = constants.O_RDWR | constants.O_CREAT

/**
 * Append-mostly heap storage for NodeStore.
 *
 * Data is stored in segment files named `<base>.dat.N` (N = uint32 segment ID).
 * Only one segment is written to at any time (the "active" segment). Each
 * call to `append()` writes at the current end of the active segment and
 * returns a BlockRef that encodes which segment and byte range the block
 * occupies.
 *
 * On compaction a new segment is created; old segments are deleted after the
 * index is updated and flushed.  An unreferenced segment found at `open()` is
 * a crash-left orphan and is cleaned up automatically.
 */
export class BlockStore {
    private readonly _base: string
    private readonly _handles = new Map<number, FileHandle>()
    private _activeSegment = 0
    private _writeOffset   = 0

    constructor(basePath: string) {
        this._base = basePath
    }

    segmentPath(segId: number): string {
        return `${this._base}.dat.${segId}`
    }

    /** Scan the base directory and return every existing segment's file size. */
    async scanSegments(): Promise<Map<number, number>> {
        const dir  = dirname(this._base)
        const base = basename(this._base)
        const files = await readdir(dir).catch((): string[] => [])

        const sizes = new Map<number, number>()
        for (const f of files) {
            const m = f.match(/^(.+)\.dat\.(\d+)$/)
            if (m && m[1] === base) {
                const segId  = parseInt(m[2], 10)
                const handle = await this._getHandle(segId)
                const stat   = await handle.stat()
                sizes.set(segId, stat.size)
            }
        }
        return sizes
    }

    /** Set which segment to append to and its current EOF position. */
    setActive(segId: number, writeOffset: number): void {
        this._activeSegment = segId
        this._writeOffset   = writeOffset
    }

    get activeSegment(): number { return this._activeSegment }
    get activeOffset():  number { return this._writeOffset   }

    /** Return the segment ID that a new compaction should write to. */
    nextSegmentId(): number {
        return this._activeSegment + 1
    }

    private async _getHandle(segId: number): Promise<FileHandle> {
        const existing = this._handles.get(segId)
        if (existing !== undefined) return existing
        const handle = await fsOpen(this.segmentPath(segId), O_FLAGS)
        this._handles.set(segId, handle)
        return handle
    }

    /** Append `data` to the active segment and return its BlockRef. */
    async append(data: Uint8Array): Promise<BlockRef> {
        const handle = await this._getHandle(this._activeSegment)
        const offset = this._writeOffset
        await handle.write(data, 0, data.length, offset)
        this._writeOffset += data.length
        return { segment: this._activeSegment, offset, length: data.length }
    }

    /** fsync the active segment (durability before index update). */
    async fsyncActive(): Promise<void> {
        const h = this._handles.get(this._activeSegment)
        if (h !== undefined) await h.sync()
    }

    /** Read the block described by `ref`. */
    async read(ref: BlockRef): Promise<Uint8Array> {
        const handle = await this._getHandle(ref.segment)
        const buf    = new Uint8Array(ref.length)
        await handle.read(buf, 0, ref.length, ref.offset)
        return buf
    }

    /** Write `data` to `segId` at `offset` (used during compaction). */
    async writeAt(segId: number, offset: number, data: Uint8Array): Promise<void> {
        const handle = await this._getHandle(segId)
        await handle.write(data, 0, data.length, offset)
    }

    /** fsync a specific segment (e.g. the new compaction segment). */
    async fsyncSegment(segId: number): Promise<void> {
        const h = this._handles.get(segId)
        if (h !== undefined) await h.sync()
    }

    /** Close handle and delete the segment file. Errors on unlink are swallowed. */
    async deleteSegment(segId: number): Promise<void> {
        const h = this._handles.get(segId)
        if (h !== undefined) {
            await h.close()
            this._handles.delete(segId)
        }
        await unlink(this.segmentPath(segId)).catch(() => {})
    }

    async close(): Promise<void> {
        for (const [, h] of this._handles) await h.close()
        this._handles.clear()
    }
}
