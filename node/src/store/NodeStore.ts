import { BPlusIndex, FsAdapter } from '@toolcase/base'
import type { RangeOptions } from '@toolcase/base'
import { BlockStore } from './BlockStore'
import type { BlockRef } from './BlockRef'
import { serializeBlockRef, deserializeBlockRef } from './BlockRef'

export interface NodeStoreOptions<K, V> {
    /** Base path: index → `<path>.idx`, data → `<path>.dat.N`. */
    path:             string
    compare:          (a: K, b: K) => number
    serializeKey:     (k: K) => Uint8Array
    deserializeKey:   (b: Uint8Array) => K
    serializeValue:   (v: V) => Uint8Array
    deserializeValue: (b: Uint8Array) => V
    /** Passed to BPlusIndex for keyEncoding guard. */
    keyEncoding?: string
    /** B+ tree page size in bytes (default 4096). */
    pageSize?: number
}

/**
 * Two-file persistent record store.
 *
 * The B+ index (`<path>.idx`) stores fixed-size BlockRefs keyed by K.
 * The data heap (`<path>.dat.N`) stores serialised values as raw byte blobs.
 *
 * Write ordering (crash safety):
 *   1. Append blob to `.dat.N` then fsync.
 *   2. Update the index entry then flush (superblock commit).
 * A crash between steps leaves at most a harmless orphan block in the heap;
 * the index stays consistent and omits the orphan on the next open().
 *
 * Deletes remove only the index entry; the dead block remains in the heap
 * until the next `optimize()` call reclaims it.
 *
 * `optimize()` copies all live blocks to a fresh segment in key order,
 * atomically updates the index, then deletes old segments.
 */
export class NodeStore<K, V> {

    static async open<K, V>(opts: NodeStoreOptions<K, V>): Promise<NodeStore<K, V>> {
        const s = new NodeStore<K, V>(opts)
        await s._init()
        return s
    }

    private readonly _opts: NodeStoreOptions<K, V>
    private _index!:  BPlusIndex<K, BlockRef>
    private _blocks!: BlockStore
    private _liveBytes  = 0
    private _totalBytes = 0

    private constructor(opts: NodeStoreOptions<K, V>) {
        this._opts = opts
    }

    private async _init(): Promise<void> {
        const { path, compare, serializeKey, deserializeKey, keyEncoding, pageSize } = this._opts

        this._blocks = new BlockStore(path)
        const segmentSizes = await this._blocks.scanSegments()

        this._index = await BPlusIndex.open<K, BlockRef>({
            adapter:          new FsAdapter(`${path}.idx`, pageSize),
            compare,
            serializeKey,
            deserializeKey,
            serializeValue:   serializeBlockRef,
            deserializeValue: deserializeBlockRef,
            keyEncoding,
        })

        // Scan the index to find which segments are live and compute liveBytes.
        const referencedSegments = new Set<number>()
        let liveBytes = 0
        for await (const [, ref] of this._index.entries()) {
            referencedSegments.add(ref.segment)
            liveBytes += ref.length
        }
        this._liveBytes = liveBytes

        // Remove orphan segment files (left by a crashed compaction).
        let totalBytes = 0
        for (const [segId, size] of segmentSizes) {
            if (referencedSegments.has(segId)) {
                totalBytes += size
            } else {
                await this._blocks.deleteSegment(segId)
            }
        }
        this._totalBytes = totalBytes

        // Set the active segment: largest one referenced by the index, or 0.
        const maxRef = referencedSegments.size > 0
            ? Math.max(...referencedSegments)
            : 0
        const activeOffset = referencedSegments.has(maxRef)
            ? (segmentSizes.get(maxRef) ?? 0)
            : 0
        this._blocks.setActive(maxRef, activeOffset)
    }

    // ── public accessors ────────────────────────────────────────────────────

    /** Number of live entries. */
    get size(): number { return this._index.size }

    /**
     * Fraction of heap bytes that are referenced by a live index entry.
     * `1.0` means no dead space; `0.0` means everything is dead.
     * Returns `1.0` when the heap is empty.
     */
    get liveRatio(): number {
        return this._totalBytes === 0 ? 1 : this._liveBytes / this._totalBytes
    }

    // ── CRUD ────────────────────────────────────────────────────────────────

    async get(key: K): Promise<V | undefined> {
        const ref = await this._index.get(key)
        if (ref === undefined) return undefined
        const data = await this._blocks.read(ref)
        return this._opts.deserializeValue(data)
    }

    /**
     * Write `value` under `key`.
     *
     * Crash-safe ordering: the blob is fsynced to the heap before the index
     * entry is updated, so a crash leaves at most a harmless orphan block.
     */
    async set(key: K, value: V): Promise<void> {
        const data   = this._opts.serializeValue(value)
        const oldRef = await this._index.get(key)

        // Step 1: append data + fsync.
        const ref = await this._blocks.append(data)
        await this._blocks.fsyncActive()

        // Step 2: update index (BPlusIndex.set commits the superblock).
        await this._index.set(key, ref)

        // Update metrics.
        if (oldRef !== undefined) this._liveBytes -= oldRef.length
        this._liveBytes  += data.length
        this._totalBytes += data.length
    }

    /** Remove `key`.  The block remains in the heap until `optimize()`. */
    async delete(key: K): Promise<boolean> {
        const ref = await this._index.get(key)
        if (ref === undefined) return false
        const removed = await this._index.delete(key)
        if (removed) this._liveBytes -= ref.length
        return removed
    }

    // ── compaction ───────────────────────────────────────────────────────────

    /**
     * Rewrite the heap in key order, reclaiming dead blocks.
     *
     * Protocol (crash-safe):
     *   1. Copy all live blocks to a new segment file in key order.
     *   2. fsync the new segment.
     *   3. Atomically update the index via setMany (single superblock commit).
     *   4. Delete old segments (now unreferenced).
     *
     * If a crash occurs before step 3 the new segment is an orphan and is
     * cleaned up on the next `open()`.  If a crash occurs after step 3 but
     * before step 4, old segments are cleaned up on the next `open()`.
     */
    async optimize(): Promise<void> {
        if (this._index.size === 0) return

        const oldSegId = this._blocks.activeSegment
        const newSegId = this._blocks.nextSegmentId()

        const newEntries: [K, BlockRef][] = []
        let newOffset = 0

        // Step 1: copy live blocks to new segment in key order.
        for await (const [key, ref] of this._index.entries()) {
            const data = await this._blocks.read(ref)
            await this._blocks.writeAt(newSegId, newOffset, data)
            newEntries.push([key, { segment: newSegId, offset: newOffset, length: data.length }])
            newOffset += data.length
        }

        // Step 2: fsync new segment before touching the index.
        await this._blocks.fsyncSegment(newSegId)

        // Step 3: update all index entries in one atomic setMany.
        await this._index.setMany(newEntries)

        // Step 4: activate new segment, then delete all old ones.
        this._blocks.setActive(newSegId, newOffset)

        for (let i = oldSegId; i >= 0; i--) {
            await this._blocks.deleteSegment(i)
        }

        // Update metrics: after compaction the heap contains only live bytes.
        this._liveBytes  = newOffset
        this._totalBytes = newOffset
    }

    // ── lifecycle ────────────────────────────────────────────────────────────

    /** fsync both the data heap and the index. */
    async flush(): Promise<void> {
        await this._blocks.fsyncActive()
        await this._index.flush()
    }

    async close(): Promise<void> {
        await this._blocks.close()
        await this._index.close()
    }

    // ── iteration ────────────────────────────────────────────────────────────

    async * range(opts: RangeOptions<K> = {}): AsyncGenerator<[K, V]> {
        for await (const [key, ref] of this._index.range(opts)) {
            const data = await this._blocks.read(ref)
            yield [key, this._opts.deserializeValue(data)]
        }
    }

    async * entries(): AsyncGenerator<[K, V]> {
        yield * this.range()
    }

    async * keys(): AsyncGenerator<K> {
        for await (const [k] of this.range()) yield k
    }

    async * values(): AsyncGenerator<V> {
        for await (const [, v] of this.range()) yield v
    }
}
