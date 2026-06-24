import {
    StorageAdapter, BPlusIndexOptions, RangeOptions, BPlusIndexStats,
    SuperblockData, InternalNode, LeafNode, LeafEntry,
    HEADER_SIZE, CRC_SIZE, NULL_PAGE, SB_PAGE_A, SB_PAGE_B, FIRST_TREE_PAGE,
    PAGE_TYPE_INTERNAL, PAGE_TYPE_LEAF, PAGE_TYPE_OVERFLOW, OVERFLOW_FLAG,
} from './types'
import {
    encodeSuperblock, decodeSuperblock,
    encodeInternal, decodeInternal, internalByteSize,
    encodeLeaf, decodeLeaf, leafByteSize,
    encodeOverflow, decodeOverflow, overflowChunkSize,
    encodeFreelist, decodeFreelist, freelistCapacity,
} from './page'
import { readU16, readU32, writeU32, writeU64 } from './encode'
import { crc32 } from './crc32'

// ── constants ────────────────────────────────────────────────────────────────

const ENC = new TextEncoder()
const DEC = new TextDecoder()

function defaultOrder(pageSize: number): number {
    return Math.max(4, Math.floor((pageSize - HEADER_SIZE - 2) / 44))
}

// ── BPlusIndex ───────────────────────────────────────────────────────────────

export class BPlusIndex<K, V> {

    // ── static helpers ──────────────────────────────────────────────────────

    static comparators = {
        string:     (a: string,     b: string)     => a < b ? -1 : a > b ? 1 : 0,
        number:     (a: number,     b: number)     => a < b ? -1 : a > b ? 1 : 0,
        bigint:     (a: bigint,     b: bigint)     => a < b ? -1 : a > b ? 1 : 0,
        uint8Array: (a: Uint8Array, b: Uint8Array): number => {
            const len = Math.min(a.length, b.length)
            for (let i = 0; i < len; i++) if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1
            return a.length - b.length
        },
    }

    static serializers = {
        string: (k: string): Uint8Array => ENC.encode(k),
        number: (k: number): Uint8Array => {
            const buf = new Uint8Array(8)
            new DataView(buf.buffer).setFloat64(0, k, true)
            return buf
        },
        bigint: (k: bigint): Uint8Array => {
            const neg = k < 0n
            let v = neg ? -k - 1n : k
            const bytes: number[] = []
            while (v > 0n) { bytes.push(Number(v & 0xffn)); v >>= 8n }
            const out = new Uint8Array(3 + bytes.length)
            const view = new DataView(out.buffer)
            view.setUint16(0, bytes.length, true)
            out[2] = neg ? 1 : 0
            out.set(bytes, 3)
            return out
        },
        uint8Array: (k: Uint8Array): Uint8Array => {
            const out = new Uint8Array(2 + k.length)
            new DataView(out.buffer).setUint16(0, k.length, true)
            out.set(k, 2)
            return out
        },
    }

    static deserializers = {
        string:     (b: Uint8Array): string => DEC.decode(b),
        number:     (b: Uint8Array): number => {
            const v = new DataView(b.buffer, b.byteOffset, b.byteLength).getFloat64(0, true)
            return Object.is(v, -0) ? 0 : v   // normalize negative zero to +0
        },
        bigint:     (b: Uint8Array): bigint => {
            const view  = new DataView(b.buffer, b.byteOffset, b.byteLength)
            const magLen = view.getUint16(0, true)
            const neg   = b[2] !== 0
            let v = 0n
            for (let i = magLen - 1; i >= 0; i--) v = (v << 8n) | BigInt(b[3 + i])
            return neg ? -(v + 1n) : v
        },
        uint8Array: (b: Uint8Array): Uint8Array => {
            const len = new DataView(b.buffer, b.byteOffset).getUint16(0, true)
            return b.slice(2, 2 + len)
        },
    }

    static keyPreset = {
        string:     { compare: BPlusIndex.comparators.string,     serializeKey: BPlusIndex.serializers.string,     deserializeKey: BPlusIndex.deserializers.string,     keyEncoding: 'string' },
        number:     { compare: BPlusIndex.comparators.number,     serializeKey: BPlusIndex.serializers.number,     deserializeKey: BPlusIndex.deserializers.number,     keyEncoding: 'number' },
        bigint:     { compare: BPlusIndex.comparators.bigint,     serializeKey: BPlusIndex.serializers.bigint,     deserializeKey: BPlusIndex.deserializers.bigint,     keyEncoding: 'bigint' },
        uint8Array: { compare: BPlusIndex.comparators.uint8Array, serializeKey: BPlusIndex.serializers.uint8Array, deserializeKey: BPlusIndex.deserializers.uint8Array, keyEncoding: 'uint8Array' },
    }

    // ── static open ─────────────────────────────────────────────────────────

    static async open<K, V>(opts: BPlusIndexOptions<K, V>): Promise<BPlusIndex<K, V>> {
        const idx = new BPlusIndex<K, V>(opts)
        await idx._init()
        return idx
    }

    /**
     * Build a balanced B+ tree bottom-up from pre-sorted, de-duplicated entries.
     * Throws if entries are out-of-order or contain duplicate keys.
     * Requires a fresh (empty) index — opens `opts` as a new file.
     */
    static async bulkLoad<K, V>(
        opts: BPlusIndexOptions<K, V>,
        entries: [K, V][],
    ): Promise<BPlusIndex<K, V>> {
        const idx = new BPlusIndex<K, V>(opts)
        await idx._init()

        if (idx._size !== 0 || idx.pageCount !== FIRST_TREE_PAGE + 1) {
            throw new Error('BPlusIndex.bulkLoad: index must be empty (use a fresh adapter)')
        }

        if (entries.length === 0) return idx

        // Validate sort order and uniqueness
        for (let i = 1; i < entries.length; i++) {
            const cmp = idx.compare(entries[i - 1][0], entries[i][0])
            if (cmp > 0) throw new Error(`BPlusIndex.bulkLoad: entries out of order at index ${i}`)
            if (cmp === 0) throw new Error(`BPlusIndex.bulkLoad: duplicate key at index ${i}`)
        }

        idx.writeSeq++
        const ovThresh = Math.floor(idx.overflowThreshold * idx.pageSize)
        // Fixed overhead per leaf page: header + keyCount(2) + prev(4) + next(4)
        const LEAF_FIXED = HEADER_SIZE + 10

        // ── Pass 1: group entries into leaf-sized batches ──────────────────
        type RawEntry = { keyRaw: Uint8Array; valueRaw: Uint8Array }
        const leafGroups: RawEntry[][] = []
        let currentGroup: RawEntry[] = []
        let currentSize = LEAF_FIXED

        for (const [k, v] of entries) {
            const keyRaw   = idx.serializeKey(k)
            const valueRaw = idx.serializeValue(v)
            const entrySize = 2 + keyRaw.length + (
                valueRaw.length > ovThresh ? (2 + 4 + 4) : (2 + valueRaw.length)
            )

            if (currentGroup.length > 0 && currentSize + entrySize > idx.pageSize) {
                leafGroups.push(currentGroup)
                currentGroup = []
                currentSize  = LEAF_FIXED
            }

            currentGroup.push({ keyRaw, valueRaw })
            currentSize += entrySize
        }
        if (currentGroup.length > 0) leafGroups.push(currentGroup)

        // ── Pass 2: allocate page IDs for all leaves ───────────────────────
        // Reuse the initial empty leaf page for leaf[0]; allocate fresh pages for the rest
        const leafPageIds: number[] = [FIRST_TREE_PAGE]
        for (let i = 1; i < leafGroups.length; i++) leafPageIds.push(idx.pageCount++)

        // ── Pass 3: write leaf pages ───────────────────────────────────────
        type PageInfo = { pageId: number; firstKeyRaw: Uint8Array; count: number }
        const leafInfos: PageInfo[] = []

        for (let i = 0; i < leafGroups.length; i++) {
            const group      = leafGroups[i]
            const pageId     = leafPageIds[i]
            const prevPageId = i === 0 ? NULL_PAGE : leafPageIds[i - 1]
            const nextPageId = i + 1 < leafPageIds.length ? leafPageIds[i + 1] : NULL_PAGE
            const leafEntries: LeafEntry[] = group.map(e => ({ ...e, overflowHead: 0 }))
            const leaf: LeafNode = { pageId, pageSeq: idx.writeSeq, prevPageId, nextPageId, entries: leafEntries }
            await idx._writeLeaf(leaf)  // handles overflow page allocation internally
            leafInfos.push({ pageId, firstKeyRaw: group[0].keyRaw, count: group.length })
        }

        // ── Pass 4: build internal node levels bottom-up ───────────────────
        let currentLevel: PageInfo[] = leafInfos

        while (currentLevel.length > 1) {
            const nextLevel: PageInfo[] = []
            let i = 0

            while (i < currentLevel.length) {
                const nodeChildren: PageInfo[] = []
                // Fixed internal node overhead: header + keyCount(2) + first child (10 bytes)
                let nodeSize = HEADER_SIZE + 2 + 10

                while (i < currentLevel.length) {
                    const child     = currentLevel[i]
                    const isFirst   = nodeChildren.length === 0
                    // Each non-first child adds: a separator key + a child slot
                    const addSize   = isFirst ? 0 : (2 + child.firstKeyRaw.length + 10)
                    if (!isFirst && nodeSize + addSize > idx.pageSize) break
                    nodeChildren.push(child)
                    if (!isFirst) nodeSize += addSize
                    i++
                }

                const keyRaws     = nodeChildren.slice(1).map(c => c.firstKeyRaw)
                const children    = nodeChildren.map(c => c.pageId)
                const childCounts = nodeChildren.map(c => c.count)
                const totalCount  = childCounts.reduce((a, b) => a + b, 0)
                const nodePageId  = idx.pageCount++
                const node: InternalNode = {
                    pageId: nodePageId, pageSeq: idx.writeSeq,
                    keyRaws, children, childCounts,
                }
                await idx._writeInternal(node)
                nextLevel.push({ pageId: nodePageId, firstKeyRaw: nodeChildren[0].firstKeyRaw, count: totalCount })
            }

            currentLevel = nextLevel
        }

        idx.rootPageId = currentLevel[0].pageId
        idx._size      = entries.length
        await idx._flushSuperblock()
        return idx
    }

    // ── private fields ──────────────────────────────────────────────────────

    private readonly adapter:          StorageAdapter
    private readonly compare:          (a: K, b: K) => number
    private readonly serializeKey:     (k: K) => Uint8Array
    private readonly deserializeKey:   (b: Uint8Array) => K
    private readonly serializeValue:   (v: V) => Uint8Array
    private readonly deserializeValue: (b: Uint8Array) => V
    private readonly keyEncoding:      string
    private readonly overflowThreshold: number

    private pageSize!:            number
    private order!:               number
    private rootPageId!:          number
    private pageCount!:           number
    private freeListHeadPageId!:  number
    private _size!:               number
    private writeSeq!:            number
    private activeSuperblockSlot!: number

    private constructor(opts: BPlusIndexOptions<K, V>) {
        this.adapter          = opts.adapter
        this.compare          = opts.compare
        this.serializeKey     = opts.serializeKey
        this.deserializeKey   = opts.deserializeKey
        this.serializeValue   = opts.serializeValue
        this.deserializeValue = opts.deserializeValue
        this.keyEncoding      = opts.keyEncoding ?? 'custom'
        this.overflowThreshold = opts.overflowThreshold ?? 0.25
    }

    get size(): number { return this._size }

    // ── lifecycle ───────────────────────────────────────────────────────────

    private async _init(): Promise<void> {
        const rawA = await this.adapter.read(SB_PAGE_A)
        const rawB = await this.adapter.read(SB_PAGE_B)
        const sbA  = rawA ? decodeSuperblock(rawA) : null
        const sbB  = rawB ? decodeSuperblock(rawB) : null

        if (!sbA && !sbB) {
            this.pageSize             = 4096
            this.order                = defaultOrder(this.pageSize)
            this.writeSeq             = 1
            this._size                = 0
            this.freeListHeadPageId   = NULL_PAGE
            this.pageCount            = FIRST_TREE_PAGE  // pages 0,1 = superblocks

            const rootId = await this._allocatePage()  // = FIRST_TREE_PAGE
            this.rootPageId = rootId
            const leaf: LeafNode = {
                pageId: rootId, pageSeq: this.writeSeq,
                prevPageId: NULL_PAGE, nextPageId: NULL_PAGE, entries: [],
            }
            await this._writeLeaf(leaf)
            await this._commitSuperblock(SB_PAGE_A)
            await this._commitSuperblock(SB_PAGE_B)
            this.activeSuperblockSlot = SB_PAGE_B
            return
        }

        let sb: SuperblockData & { pageSeq: number }
        if (sbA && sbB) {
            if (sbA.pageSeq >= sbB.pageSeq) {
                sb = sbA; this.activeSuperblockSlot = SB_PAGE_A
            } else {
                sb = sbB; this.activeSuperblockSlot = SB_PAGE_B
            }
        } else if (sbA) {
            sb = sbA; this.activeSuperblockSlot = SB_PAGE_A
        } else {
            sb = sbB!; this.activeSuperblockSlot = SB_PAGE_B
        }

        if (sb.keyEncoding !== this.keyEncoding) {
            throw new Error(
                `BPlusIndex: keyEncoding mismatch — file has "${sb.keyEncoding}", caller passed "${this.keyEncoding}"`
            )
        }
        this.pageSize            = sb.pageSize
        this.order               = sb.order
        this.rootPageId          = sb.rootPageId
        this.pageCount           = sb.pageCount
        this.freeListHeadPageId  = sb.freeListHeadPageId
        this._size               = sb.totalRecordCount
        this.writeSeq            = sb.pageSeq + 1
    }

    private async _commitSuperblock(slot: number): Promise<void> {
        const buf = new Uint8Array(this.pageSize)
        encodeSuperblock(buf, {
            formatVersion: 1,
            pageSize:   this.pageSize,
            order:      this.order,
            rootPageId: this.rootPageId,
            pageCount:  this.pageCount,
            freeListHeadPageId: this.freeListHeadPageId,
            totalRecordCount:   this._size,
            keyEncoding: this.keyEncoding,
        }, this.writeSeq)
        await this.adapter.write(slot, buf)
    }

    private async _flushSuperblock(): Promise<void> {
        const stale = this.activeSuperblockSlot === SB_PAGE_A ? SB_PAGE_B : SB_PAGE_A
        await this._commitSuperblock(stale)
        this.activeSuperblockSlot = stale
    }

    async flush(): Promise<void> {
        await this.adapter.flush?.()
    }

    async close(): Promise<void> {
        await this.flush()
        await this.adapter.close?.()
    }

    // ── page allocation ─────────────────────────────────────────────────────

    private async _allocatePage(): Promise<number> {
        if (this.freeListHeadPageId !== NULL_PAGE) {
            const raw = await this.adapter.read(this.freeListHeadPageId)
            if (raw) {
                const fl = decodeFreelist(raw)
                if (fl && fl.ids.length > 0) {
                    const id = fl.ids.pop()!
                    if (fl.ids.length === 0) {
                        this.freeListHeadPageId = fl.nextPageId
                    } else {
                        const buf = new Uint8Array(this.pageSize)
                        encodeFreelist(buf, fl.nextPageId, fl.ids, this.writeSeq)
                        await this.adapter.write(this.freeListHeadPageId, buf)
                    }
                    return id
                }
            }
        }
        return this.pageCount++
    }

    private async _freePage(pageId: number): Promise<void> {
        if (pageId <= SB_PAGE_B) return  // never free superblock slots
        const cap = freelistCapacity(this.pageSize)
        if (this.freeListHeadPageId !== NULL_PAGE) {
            const raw = await this.adapter.read(this.freeListHeadPageId)
            if (raw) {
                const fl = decodeFreelist(raw)
                if (fl && fl.ids.length < cap) {
                    fl.ids.push(pageId)
                    const buf = new Uint8Array(this.pageSize)
                    encodeFreelist(buf, fl.nextPageId, fl.ids, this.writeSeq)
                    await this.adapter.write(this.freeListHeadPageId, buf)
                    return
                }
            }
        }
        const newFlId = this.pageCount++
        const buf = new Uint8Array(this.pageSize)
        encodeFreelist(buf, this.freeListHeadPageId, [pageId], this.writeSeq)
        await this.adapter.write(newFlId, buf)
        this.freeListHeadPageId = newFlId
    }

    // ── page I/O ────────────────────────────────────────────────────────────

    private async _readInternal(pageId: number): Promise<InternalNode> {
        const raw = await this.adapter.read(pageId)
        if (!raw) throw new Error(`BPlusIndex: missing page ${pageId}`)
        const node = decodeInternal(raw, pageId)
        if (!node) throw new Error(`BPlusIndex: corrupt internal node at page ${pageId}`)
        return node
    }

    private async _writeInternal(node: InternalNode): Promise<void> {
        const buf = new Uint8Array(this.pageSize)
        encodeInternal(buf, node)
        await this.adapter.write(node.pageId, buf)
    }

    private async _readLeaf(pageId: number): Promise<LeafNode> {
        const raw = await this.adapter.read(pageId)
        if (!raw) throw new Error(`BPlusIndex: missing leaf page ${pageId}`)
        const result = decodeLeaf(raw, pageId)
        if (!result) throw new Error(`BPlusIndex: corrupt leaf at page ${pageId}`)
        const { node, overflowRefs } = result
        for (const [idx, { headPageId, totalLen }] of overflowRefs) {
            node.entries[idx].valueRaw    = await this._readOverflow(headPageId, totalLen)
            node.entries[idx].overflowHead = headPageId
        }
        return node
    }

    /** Write a leaf. Allocates overflow pages for any entry that needs them (overflowHead === 0 and value too large). */
    private async _writeLeaf(node: LeafNode): Promise<void> {
        const ovThresh = Math.floor(this.overflowThreshold * this.pageSize)
        for (const e of node.entries) {
            if (e.overflowHead === 0 && e.valueRaw.length > ovThresh) {
                const pageIds    = await this._writeOverflow(e.valueRaw)
                e.overflowHead   = pageIds[0]
            }
        }
        const buf = new Uint8Array(this.pageSize)
        encodeLeaf(buf, node)
        await this.adapter.write(node.pageId, buf)
    }

    private async _readOverflow(headPageId: number, totalLen: number): Promise<Uint8Array> {
        const out = new Uint8Array(totalLen)
        let written = 0, pageId = headPageId
        while (pageId !== NULL_PAGE) {
            const raw = await this.adapter.read(pageId)
            if (!raw) break
            const ov = decodeOverflow(raw)
            if (!ov) break
            out.set(ov.chunk, written)
            written += ov.chunk.length
            pageId = ov.nextPageId
        }
        return out
    }

    private async _writeOverflow(value: Uint8Array): Promise<number[]> {
        const chunkSize = overflowChunkSize(this.pageSize)
        const chunks: Uint8Array[] = []
        for (let off = 0; off < value.length; off += chunkSize) {
            chunks.push(value.slice(off, Math.min(off + chunkSize, value.length)))
        }
        const pageIds: number[] = []
        for (const _ of chunks) pageIds.push(await this._allocatePage())
        for (let i = 0; i < chunks.length; i++) {
            const nextId = i + 1 < pageIds.length ? pageIds[i + 1] : NULL_PAGE
            const buf = new Uint8Array(this.pageSize)
            encodeOverflow(buf, nextId, chunks[i], this.writeSeq)
            await this.adapter.write(pageIds[i], buf)
        }
        return pageIds
    }

    private async _freeOverflowChain(headPageId: number): Promise<void> {
        let pageId = headPageId
        while (pageId !== NULL_PAGE) {
            const raw  = await this.adapter.read(pageId)
            const next = raw ? (decodeOverflow(raw)?.nextPageId ?? NULL_PAGE) : NULL_PAGE
            await this._freePage(pageId)
            pageId = next
        }
    }

    // ── key search ──────────────────────────────────────────────────────────

    /** Returns index in leaf entries, or bitwise-NOT of insert position. */
    private _bsearch(keyRaws: Uint8Array[], target: K): number {
        let lo = 0, hi = keyRaws.length - 1
        while (lo <= hi) {
            const mid = (lo + hi) >>> 1
            const cmp = this.compare(this.deserializeKey(keyRaws[mid]), target)
            if (cmp === 0) return mid
            if (cmp < 0) lo = mid + 1
            else hi = mid - 1
        }
        return ~lo
    }

    /**
     * Upper bound: first i where keyRaws[i] > target.
     * Used to route through internal nodes: children[upperBound(keys, k)] contains k.
     */
    private _upperBound(keyRaws: Uint8Array[], target: K): number {
        let lo = 0, hi = keyRaws.length
        while (lo < hi) {
            const mid = (lo + hi) >>> 1
            if (this.compare(this.deserializeKey(keyRaws[mid]), target) <= 0) lo = mid + 1
            else hi = mid
        }
        return lo
    }

    /** Lower bound: first i where keyRaws[i] >= target. Used for range start. */
    private _lowerBound(keyRaws: Uint8Array[], target: K): number {
        let lo = 0, hi = keyRaws.length
        while (lo < hi) {
            const mid = (lo + hi) >>> 1
            if (this.compare(this.deserializeKey(keyRaws[mid]), target) < 0) lo = mid + 1
            else hi = mid
        }
        return lo
    }

    // ── tree descent ────────────────────────────────────────────────────────

    private async _findLeaf(key: K): Promise<{ leaf: LeafNode; path: PathEntry[] }> {
        const path: PathEntry[] = []
        let pageId = this.rootPageId

        while (true) {
            const raw = await this.adapter.read(pageId)
            if (!raw) throw new Error(`BPlusIndex: missing page ${pageId}`)
            if (raw[4] === PAGE_TYPE_LEAF) {
                return { leaf: await this._readLeaf(pageId), path }
            }
            const node       = await this._readInternal(pageId)
            const childIndex = this._upperBound(node.keyRaws, key)
            path.push({ node, childIndex })
            pageId = node.children[childIndex]
        }
    }

    // ── get ─────────────────────────────────────────────────────────────────

    async get(key: K): Promise<V | undefined> {
        const { leaf } = await this._findLeaf(key)
        const idx = this._bsearch(leaf.entries.map(e => e.keyRaw), key)
        if (idx < 0) return undefined
        return this.deserializeValue(leaf.entries[idx].valueRaw)
    }

    async has(key: K): Promise<boolean> {
        return (await this.get(key)) !== undefined
    }

    // ── set ─────────────────────────────────────────────────────────────────

    async set(key: K, value: V): Promise<this> {
        await this._setOne(key, value)
        await this._flushSuperblock()
        return this
    }

    private async _setOne(key: K, value: V): Promise<void> {
        this.writeSeq++
        const keyRaw   = this.serializeKey(key)
        const valueRaw = this.serializeValue(value)

        const { leaf, path } = await this._findLeaf(key)
        const pos = this._bsearch(leaf.entries.map(e => e.keyRaw), key)

        let countDelta = 0
        if (pos >= 0) {
            // Update — free old overflow chain
            if (leaf.entries[pos].overflowHead !== 0) {
                await this._freeOverflowChain(leaf.entries[pos].overflowHead)
            }
            leaf.entries[pos] = { keyRaw, valueRaw, overflowHead: 0 }
        } else {
            leaf.entries.splice(~pos, 0, { keyRaw, valueRaw, overflowHead: 0 })
            this._size++
            countDelta = 1
        }
        leaf.pageSeq = this.writeSeq

        const ovThresh = Math.floor(this.overflowThreshold * this.pageSize)
        if (leafByteSize(leaf, ovThresh) > this.pageSize) {
            await this._splitLeaf(leaf, path)
        } else {
            await this._cowLeaf(leaf, path, countDelta)
        }
    }

    // ── setMany ──────────────────────────────────────────────────────────────

    async setMany(entries: [K, V][]): Promise<this> {
        if (entries.length === 0) return this
        // Stable sort by key; last-wins on duplicate keys
        const sorted = [...entries].sort((a, b) => this.compare(a[0], b[0]))
        const deduped: [K, V][] = []
        for (const pair of sorted) {
            if (deduped.length > 0 && this.compare(deduped[deduped.length - 1][0], pair[0]) === 0) {
                deduped[deduped.length - 1] = pair
            } else {
                deduped.push(pair)
            }
        }
        for (const [key, value] of deduped) await this._setOne(key, value)
        await this._flushSuperblock()
        return this
    }

    // ── getMany ──────────────────────────────────────────────────────────────

    async getMany(keys: K[]): Promise<(V | undefined)[]> {
        const results: (V | undefined)[] = new Array(keys.length)
        for (let i = 0; i < keys.length; i++) results[i] = await this.get(keys[i])
        return results
    }

    // ── copy-on-write leaf ──────────────────────────────────────────────────

    private async _cowLeaf(leaf: LeafNode, path: PathEntry[], countDelta: number): Promise<void> {
        const oldId = leaf.pageId
        const newId = await this._allocatePage()
        leaf.pageId = newId
        await this._writeLeaf(leaf)
        await this._freePage(oldId)

        if (path.length === 0) {
            this.rootPageId = newId
        } else {
            await this._updatePath(path, oldId, newId, countDelta)
        }
    }

    // ── split leaf ──────────────────────────────────────────────────────────

    private async _splitLeaf(leaf: LeafNode, path: PathEntry[]): Promise<void> {
        const mid = Math.ceil(leaf.entries.length / 2)
        const rightEntries = leaf.entries.splice(mid)  // leaf.entries now = left half

        const oldLeafId  = leaf.pageId
        const newLeftId  = await this._allocatePage()
        const newRightId = await this._allocatePage()

        leaf.pageId     = newLeftId
        leaf.pageSeq    = this.writeSeq
        // leaf.nextPageId remains the original; right leaf takes it over
        const origNext  = leaf.nextPageId
        leaf.nextPageId = newRightId

        const rightLeaf: LeafNode = {
            pageId:      newRightId, pageSeq: this.writeSeq,
            prevPageId:  newLeftId,
            nextPageId:  origNext,  // don't COW the next sibling — prevPageId there becomes stale but we use forward scan for reverse range
            entries:     rightEntries,
        }

        await this._writeLeaf(leaf)
        await this._writeLeaf(rightLeaf)
        await this._freePage(oldLeafId)

        const separatorRaw = rightEntries[0].keyRaw
        const leftCount    = leaf.entries.length
        const rightCount   = rightEntries.length

        if (path.length === 0) {
            const newRootId = await this._allocatePage()
            const newRoot: InternalNode = {
                pageId: newRootId, pageSeq: this.writeSeq,
                keyRaws:     [separatorRaw],
                children:    [newLeftId, newRightId],
                childCounts: [leftCount, rightCount],
            }
            await this._writeInternal(newRoot)
            this.rootPageId = newRootId
        } else {
            await this._insertIntoParent(path, newLeftId, newRightId, separatorRaw, oldLeafId, leftCount, rightCount)
        }
    }

    // ── insert separator into parent (may propagate splits) ─────────────────

    private async _insertIntoParent(
        path: PathEntry[],
        leftId: number, rightId: number,
        separatorRaw: Uint8Array,
        _oldChildId: number,
        leftCount: number, rightCount: number,
    ): Promise<void> {
        const { node, childIndex } = path[path.length - 1]
        node.children[childIndex]    = leftId
        node.childCounts[childIndex] = leftCount
        node.keyRaws.splice(childIndex, 0, separatorRaw)
        node.children.splice(childIndex + 1, 0, rightId)
        node.childCounts.splice(childIndex + 1, 0, rightCount)

        const oldNodeId = node.pageId  // original page ID from _findLeaf
        const parentPath = path.slice(0, -1)

        if (internalByteSize(node) > this.pageSize) {
            // Split internal node — don't write yet; _splitInternal handles it
            node.pageSeq = this.writeSeq
            await this._splitInternal(node, oldNodeId, parentPath)
        } else {
            const newNodeId = await this._allocatePage()
            node.pageId  = newNodeId
            node.pageSeq = this.writeSeq
            await this._writeInternal(node)
            await this._freePage(oldNodeId)

            if (parentPath.length === 0) {
                this.rootPageId = newNodeId
            } else {
                await this._updatePath(parentPath, oldNodeId, newNodeId, 0)
            }
        }
    }

    // ── split internal node ─────────────────────────────────────────────────

    private async _splitInternal(
        node: InternalNode, oldNodeId: number, path: PathEntry[],
    ): Promise<void> {
        const mid    = Math.floor(node.keyRaws.length / 2)
        const pushUp = node.keyRaws[mid]

        // Right half: keys after mid, children after mid
        const rightKeys     = node.keyRaws.splice(mid + 1)
        node.keyRaws.splice(mid)  // remove pushed-up key from left
        const rightChildren = node.children.splice(mid + 1)
        const rightCounts   = node.childCounts.splice(mid + 1)

        const newLeftId  = await this._allocatePage()
        const newRightId = await this._allocatePage()

        node.pageId = newLeftId
        const rightNode: InternalNode = {
            pageId: newRightId, pageSeq: this.writeSeq,
            keyRaws: rightKeys, children: rightChildren, childCounts: rightCounts,
        }
        await this._writeInternal(node)
        await this._writeInternal(rightNode)
        await this._freePage(oldNodeId)

        const leftCount  = node.childCounts.reduce((a, b) => a + b, 0)
        const rightCount = rightCounts.reduce((a, b) => a + b, 0)

        if (path.length === 0) {
            const newRootId = await this._allocatePage()
            const newRoot: InternalNode = {
                pageId: newRootId, pageSeq: this.writeSeq,
                keyRaws:     [pushUp],
                children:    [newLeftId, newRightId],
                childCounts: [leftCount, rightCount],
            }
            await this._writeInternal(newRoot)
            this.rootPageId = newRootId
        } else {
            await this._insertIntoParent(path, newLeftId, newRightId, pushUp, oldNodeId, leftCount, rightCount)
        }
    }

    // ── update path after COW ───────────────────────────────────────────────

    private async _updatePath(
        path: PathEntry[], _oldChildId: number, newChildId: number, countDelta: number,
    ): Promise<void> {
        for (let i = path.length - 1; i >= 0; i--) {
            const { node, childIndex } = path[i]
            node.children[childIndex]    = newChildId
            node.childCounts[childIndex] += countDelta

            const oldId = node.pageId
            const newId = await this._allocatePage()
            node.pageId  = newId
            node.pageSeq = this.writeSeq
            await this._writeInternal(node)
            await this._freePage(oldId)

            newChildId = newId
            countDelta = 0
            if (i === 0) this.rootPageId = newId
        }
    }

    // ── delete ──────────────────────────────────────────────────────────────

    async delete(key: K): Promise<boolean> {
        const removed = await this._deleteOne(key)
        if (removed) await this._flushSuperblock()
        return removed
    }

    private async _deleteOne(key: K): Promise<boolean> {
        const { leaf, path } = await this._findLeaf(key)
        const idx = this._bsearch(leaf.entries.map(e => e.keyRaw), key)
        if (idx < 0) return false

        if (leaf.entries[idx].overflowHead !== 0) {
            await this._freeOverflowChain(leaf.entries[idx].overflowHead)
        }
        leaf.entries.splice(idx, 1)
        this._size--
        this.writeSeq++
        leaf.pageSeq = this.writeSeq

        // Always COW the leaf (even if now empty) and update the path.
        // Empty leaves are not removed — they stay in the tree but hold no entries.
        // This avoids the complex multi-pointer fixup required when removing a leaf.
        await this._cowLeaf(leaf, path, -1)
        return true
    }

    // ── deleteMany ───────────────────────────────────────────────────────────

    async deleteMany(keys: K[]): Promise<number> {
        if (keys.length === 0) return 0
        let count = 0
        for (const key of keys) if (await this._deleteOne(key)) count++
        if (count > 0) await this._flushSuperblock()
        return count
    }

    // ── clear ────────────────────────────────────────────────────────────────

    async clear(): Promise<void> {
        this.writeSeq++
        const rootId = FIRST_TREE_PAGE
        const leaf: LeafNode = {
            pageId: rootId, pageSeq: this.writeSeq,
            prevPageId: NULL_PAGE, nextPageId: NULL_PAGE, entries: [],
        }
        await this._writeLeaf(leaf)
        this.rootPageId         = rootId
        this.pageCount          = FIRST_TREE_PAGE + 1
        this.freeListHeadPageId = NULL_PAGE
        this._size              = 0
        await this._flushSuperblock()
    }

    // ── range / iteration ───────────────────────────────────────────────────

    async * range(opts: RangeOptions<K> = {}): AsyncGenerator<[K, V]> {
        const { gte, gt, lte, lt, reverse = false, limit } = opts
        let yielded = 0

        if (!reverse) {
            // ── forward scan ────────────────────────────────────────────────
            const hasLower = gte !== undefined || gt !== undefined
            const lowerKey = gte ?? gt

            // Leaf IDs in ascending key order via authoritative tree descent;
            // the `nextPageId` sibling chain is not trustworthy after COW.
            const leafIds = await this._collectAllLeafIds()

            if (hasLower) {
                // Locate the leaf that should contain the lower bound, then scan
                // it and every subsequent leaf in order.
                const { leaf } = await this._findLeaf(lowerKey!)
                const startLeafIdx = leafIds.indexOf(leaf.pageId)
                const pos = this._lowerBound(leaf.entries.map(e => e.keyRaw), lowerKey!)
                let startEntry = pos
                if (gt !== undefined && startEntry < leaf.entries.length) {
                    if (this.compare(this.deserializeKey(leaf.entries[startEntry].keyRaw), gt) === 0) startEntry++
                }

                for (let li = Math.max(startLeafIdx, 0); li < leafIds.length; li++) {
                    const cur = li === startLeafIdx ? leaf : await this._readLeaf(leafIds[li])
                    const from = li === startLeafIdx ? startEntry : 0
                    for (let i = from; i < cur.entries.length; i++) {
                        const k = this.deserializeKey(cur.entries[i].keyRaw)
                        if (lte !== undefined && this.compare(k, lte) > 0) return
                        if (lt  !== undefined && this.compare(k, lt)  >= 0) return
                        yield [k, this.deserializeValue(cur.entries[i].valueRaw)]
                        if (++yielded === limit) return
                    }
                }
            } else {
                // Full scan in ascending leaf order
                for (const pageId of leafIds) {
                    const leaf = await this._readLeaf(pageId)
                    for (const e of leaf.entries) {
                        const k = this.deserializeKey(e.keyRaw)
                        if (lte !== undefined && this.compare(k, lte) > 0) return
                        if (lt  !== undefined && this.compare(k, lt)  >= 0) return
                        yield [k, this.deserializeValue(e.valueRaw)]
                        if (++yielded === limit) return
                    }
                }
            }
        } else {
            // ── reverse scan ─────────────────────────────────────────────────
            // Collect all leaf IDs via tree descent (avoids stale prev/next links)
            const leafIds = await this._collectAllLeafIds()
            for (let li = leafIds.length - 1; li >= 0; li--) {
                const leaf = await this._readLeaf(leafIds[li])
                for (let ei = leaf.entries.length - 1; ei >= 0; ei--) {
                    const k = this.deserializeKey(leaf.entries[ei].keyRaw)
                    if (lte !== undefined && this.compare(k, lte) > 0) continue
                    if (lt  !== undefined && this.compare(k, lt)  >= 0) continue
                    if (gte !== undefined && this.compare(k, gte) < 0) return
                    if (gt  !== undefined && this.compare(k, gt)  <= 0) return
                    yield [k, this.deserializeValue(leaf.entries[ei].valueRaw)]
                    if (++yielded === limit) return
                }
            }
        }
    }

    /**
     * Gather every leaf page ID in ascending key order by descending the tree
     * via internal-node children (which are kept authoritative on every COW
     * split/update).  The leaf `nextPageId` sibling chain is NOT used: a leaf
     * that is copied or split is relocated to a fresh page and freed, but its
     * left sibling's `nextPageId` is intentionally not rewritten (see
     * `_splitLeaf`), so that chain can dangle to a freed/reused page.
     */
    private async _collectAllLeafIds(): Promise<number[]> {
        const ids: number[] = []

        const descend = async (pageId: number): Promise<void> => {
            const raw = await this.adapter.read(pageId)
            if (!raw) throw new Error(`BPlusIndex: missing page ${pageId}`)
            if (raw[4] === PAGE_TYPE_LEAF) {
                ids.push(pageId)
                return
            }
            const node = await this._readInternal(pageId)
            for (const childId of node.children) await descend(childId)
        }

        await descend(this.rootPageId)
        return ids
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

    // ── rank / count / nth ───────────────────────────────────────────────────

    /**
     * O(log n) — descend the tree accumulating `childCounts` of skipped
     * left-sibling subtrees; returns the 0-based rank (number of entries
     * strictly less than `key`) and whether `key` itself exists.
     */
    private async _rankOf(key: K): Promise<{ rank: number; exists: boolean }> {
        let accumulated = 0
        let pageId = this.rootPageId

        while (true) {
            const raw = await this.adapter.read(pageId)
            if (!raw) throw new Error(`BPlusIndex: missing page ${pageId}`)
            if (raw[4] === PAGE_TYPE_LEAF) break
            const node  = await this._readInternal(pageId)
            const i     = this._upperBound(node.keyRaws, key)
            for (let j = 0; j < i; j++) accumulated += node.childCounts[j]
            pageId = node.children[i]
        }

        const leaf    = await this._readLeaf(pageId)
        const keyRaws = leaf.entries.map(e => e.keyRaw)
        const pos     = this._bsearch(keyRaws, key)

        if (pos >= 0) return { rank: accumulated + pos, exists: true }
        return { rank: accumulated + (~pos), exists: false }
    }

    /**
     * O(log n) — 0-based position of `key` in sorted order (= number of
     * entries strictly less than `key`).  Returns the insertion rank even
     * when `key` is absent.
     */
    async rank(key: K): Promise<number> {
        const { rank } = await this._rankOf(key)
        return rank
    }

    /**
     * O(log n) — entry at 0-based index `i` in sorted order; `undefined`
     * when `i` is out of range.  Uses `childCounts` to pick the right child
     * at every internal node without scanning.
     */
    async nth(i: number): Promise<[K, V] | undefined> {
        if (i < 0 || i >= this._size) return undefined

        let remaining = i
        let pageId    = this.rootPageId

        while (true) {
            const raw = await this.adapter.read(pageId)
            if (!raw) throw new Error(`BPlusIndex: missing page ${pageId}`)
            if (raw[4] === PAGE_TYPE_LEAF) break
            const node = await this._readInternal(pageId)
            for (let j = 0; j < node.children.length; j++) {
                if (remaining < node.childCounts[j]) {
                    pageId = node.children[j]
                    break
                }
                remaining -= node.childCounts[j]
            }
        }

        const leaf  = await this._readLeaf(pageId)
        const entry = leaf.entries[remaining]
        if (!entry) return undefined
        return [this.deserializeKey(entry.keyRaw), this.deserializeValue(entry.valueRaw)]
    }

    /**
     * O(log n) — count of entries within the given range bounds.  When no
     * bounds are provided, returns `this.size` without any page I/O.
     */
    async count(opts: RangeOptions<K> = {}): Promise<number> {
        const { gte, gt, lte, lt } = opts

        if (gte === undefined && gt === undefined && lte === undefined && lt === undefined) {
            return this._size
        }

        // start = exclusive-lower insertion rank (first index in range)
        let start = 0
        if (gte !== undefined) {
            const { rank } = await this._rankOf(gte)
            start = rank
        } else if (gt !== undefined) {
            const { rank, exists } = await this._rankOf(gt)
            start = exists ? rank + 1 : rank
        }

        // end = exclusive-upper insertion rank (first index past the range)
        let end = this._size
        if (lte !== undefined) {
            const { rank, exists } = await this._rankOf(lte)
            end = exists ? rank + 1 : rank
        } else if (lt !== undefined) {
            const { rank } = await this._rankOf(lt)
            end = rank
        }

        return Math.max(0, end - start)
    }

    // ── endpoint helpers ─────────────────────────────────────────────────────

    /** Descend to the rightmost non-empty leaf and return its last entry. */
    private async _rightmostEntry(startPageId: number): Promise<[K, V] | undefined> {
        let pageId = startPageId
        while (true) {
            const raw = await this.adapter.read(pageId)
            if (!raw) return undefined
            if (raw[4] === PAGE_TYPE_LEAF) {
                const leaf = await this._readLeaf(pageId)
                if (leaf.entries.length === 0) return undefined
                const e = leaf.entries[leaf.entries.length - 1]
                return [this.deserializeKey(e.keyRaw), this.deserializeValue(e.valueRaw)]
            }
            const node = await this._readInternal(pageId)
            let next = -1
            for (let j = node.children.length - 1; j >= 0; j--) {
                if (node.childCounts[j] > 0) { next = node.children[j]; break }
            }
            if (next < 0) return undefined
            pageId = next
        }
    }

    /** Descend to the leftmost non-empty leaf and return its first entry. */
    private async _leftmostEntry(startPageId: number): Promise<[K, V] | undefined> {
        let pageId = startPageId
        while (true) {
            const raw = await this.adapter.read(pageId)
            if (!raw) return undefined
            if (raw[4] === PAGE_TYPE_LEAF) {
                const leaf = await this._readLeaf(pageId)
                if (leaf.entries.length === 0) return undefined
                const e = leaf.entries[0]
                return [this.deserializeKey(e.keyRaw), this.deserializeValue(e.valueRaw)]
            }
            const node = await this._readInternal(pageId)
            let next = -1
            for (let j = 0; j < node.children.length; j++) {
                if (node.childCounts[j] > 0) { next = node.children[j]; break }
            }
            if (next < 0) return undefined
            pageId = next
        }
    }

    // ── endpoint queries ─────────────────────────────────────────────────────

    /** O(log n) — smallest [key, value] in the index; `undefined` if empty. */
    async first(): Promise<[K, V] | undefined> {
        if (this._size === 0) return undefined
        return this._leftmostEntry(this.rootPageId)
    }

    /** O(log n) — largest [key, value] in the index; `undefined` if empty. */
    async last(): Promise<[K, V] | undefined> {
        if (this._size === 0) return undefined
        return this._rightmostEntry(this.rootPageId)
    }

    /**
     * O(log n) — largest [key, value] whose key ≤ `target`; `undefined` if
     * no such entry exists.  Uses the descent path to avoid stale prevPageId
     * links left by copy-on-write splits.
     */
    async floor(target: K): Promise<[K, V] | undefined> {
        const path: PathEntry[] = []
        let pageId = this.rootPageId

        while (true) {
            const raw = await this.adapter.read(pageId)
            if (!raw) throw new Error(`BPlusIndex: missing page ${pageId}`)
            if (raw[4] === PAGE_TYPE_LEAF) break
            const node = await this._readInternal(pageId)
            const i    = this._upperBound(node.keyRaws, target)
            path.push({ node, childIndex: i })
            pageId = node.children[i]
        }

        const leaf    = await this._readLeaf(pageId)
        const keyRaws = leaf.entries.map(e => e.keyRaw)
        const pos     = this._bsearch(keyRaws, target)

        if (pos >= 0) {
            const e = leaf.entries[pos]
            return [this.deserializeKey(e.keyRaw), this.deserializeValue(e.valueRaw)]
        }

        const insertPos = ~pos
        if (insertPos > 0) {
            const e = leaf.entries[insertPos - 1]
            return [this.deserializeKey(e.keyRaw), this.deserializeValue(e.valueRaw)]
        }

        // All entries in this leaf are > target (or leaf is empty).
        // Walk back up the path to find the nearest left-sibling subtree.
        for (let i = path.length - 1; i >= 0; i--) {
            const { node, childIndex } = path[i]
            for (let j = childIndex - 1; j >= 0; j--) {
                if (node.childCounts[j] === 0) continue
                return this._rightmostEntry(node.children[j])
            }
        }

        return undefined
    }

    /**
     * O(log n) — smallest [key, value] whose key ≥ `target`; `undefined` if
     * no such entry exists.  Uses the descent path to avoid stale nextPageId
     * dependencies when the current leaf is fully to the left of the target.
     */
    async ceil(target: K): Promise<[K, V] | undefined> {
        const path: PathEntry[] = []
        let pageId = this.rootPageId

        while (true) {
            const raw = await this.adapter.read(pageId)
            if (!raw) throw new Error(`BPlusIndex: missing page ${pageId}`)
            if (raw[4] === PAGE_TYPE_LEAF) break
            const node = await this._readInternal(pageId)
            const i    = this._upperBound(node.keyRaws, target)
            path.push({ node, childIndex: i })
            pageId = node.children[i]
        }

        const leaf    = await this._readLeaf(pageId)
        const keyRaws = leaf.entries.map(e => e.keyRaw)
        const pos     = this._bsearch(keyRaws, target)

        if (pos >= 0) {
            const e = leaf.entries[pos]
            return [this.deserializeKey(e.keyRaw), this.deserializeValue(e.valueRaw)]
        }

        const insertPos = ~pos
        if (insertPos < leaf.entries.length) {
            const e = leaf.entries[insertPos]
            return [this.deserializeKey(e.keyRaw), this.deserializeValue(e.valueRaw)]
        }

        // All entries in this leaf are < target (or leaf is empty).
        // Walk back up the path to find the nearest right-sibling subtree.
        for (let i = path.length - 1; i >= 0; i--) {
            const { node, childIndex } = path[i]
            for (let j = childIndex + 1; j < node.children.length; j++) {
                if (node.childCounts[j] === 0) continue
                return this._leftmostEntry(node.children[j])
            }
        }

        return undefined
    }

    // ── stats ────────────────────────────────────────────────────────────────

    async stats(): Promise<BPlusIndexStats> {
        // Measure tree height by descending the leftmost path
        let height = 0
        let pageId = this.rootPageId
        while (true) {
            const raw = await this.adapter.read(pageId)
            height++
            if (!raw || raw[4] === PAGE_TYPE_LEAF) break
            const node = decodeInternal(raw, pageId)
            if (!node) break
            pageId = node.children[0]
        }

        // Count free page IDs stored across all free-list pages
        let freePages = 0
        let flId = this.freeListHeadPageId
        while (flId !== NULL_PAGE) {
            const raw = await this.adapter.read(flId)
            if (!raw) break
            const fl = decodeFreelist(raw)
            if (!fl) break
            freePages += fl.ids.length
            flId = fl.nextPageId
        }

        const allocated = this.pageCount - FIRST_TREE_PAGE
        const fillFactor = allocated > 0 ? (allocated - freePages) / allocated : 1

        return { height, pageCount: this.pageCount, freePages, fillFactor }
    }

    // ── compact ──────────────────────────────────────────────────────────────

    /**
     * Pack all live tree pages to the front of the file, then truncate the
     * tail.  After returning:
     *   - `freeListHeadPageId` is `NULL_PAGE` (the free list is gone)
     *   - `pageCount` equals `FIRST_TREE_PAGE + livePageCount`
     *   - the backing adapter is truncated if it supports `truncate()`
     *   - the new layout is committed via the dual-superblock flip so a crash
     *     mid-compact leaves the old superblock intact and consistent
     *
     * Must be called exclusively — no concurrent reads, writes, or open
     * iterators.  Outstanding in-memory page IDs are invalidated; callers
     * should re-open or discard any held references after `compact()` returns.
     */
    async compact(): Promise<void> {
        // 1. Collect every live tree page (DFS from root + overflow chains)
        const liveIds = await this._collectCompactLiveIds()
        const newPageCount = FIRST_TREE_PAGE + liveIds.length

        // Nothing to do when the file is already fully packed
        if (newPageCount >= this.pageCount) return

        this.writeSeq++

        // 2. Assign new sequential IDs packed from FIRST_TREE_PAGE
        liveIds.sort((a, b) => a - b)
        const remap = new Map<number, number>()
        for (let i = 0; i < liveIds.length; i++) remap.set(liveIds[i], FIRST_TREE_PAGE + i)

        // 3. Read all live pages into memory before any writes to avoid
        //    overwriting a live page before it is moved
        const contents = new Map<number, Uint8Array>()
        for (const id of liveIds) {
            const raw = await this.adapter.read(id)
            if (raw) contents.set(id, raw)
        }

        // 4. Re-encode each page with remapped page-ID references and write
        //    to its new position
        for (const oldId of liveIds) {
            const raw = contents.get(oldId)
            if (!raw) continue
            const newId = remap.get(oldId)!
            await this.adapter.write(newId, this._compactRemapPage(raw, remap))
        }

        // 5. Update in-memory state
        this.rootPageId         = remap.get(this.rootPageId)!
        this.pageCount          = newPageCount
        this.freeListHeadPageId = NULL_PAGE

        // 6. Atomic superblock flip — crash-safe: old slot still valid until here
        await this._flushSuperblock()

        // 7. Shrink the backing store (optional — not all adapters support it)
        await this.adapter.truncate?.(this.pageCount)
    }

    private async _collectCompactLiveIds(): Promise<number[]> {
        const visited = new Set<number>()
        const ids: number[] = []

        const walkPage = async (pageId: number): Promise<void> => {
            if (pageId === NULL_PAGE || visited.has(pageId)) return
            visited.add(pageId)
            const raw = await this.adapter.read(pageId)
            if (!raw) return
            ids.push(pageId)

            if (raw[4] === PAGE_TYPE_INTERNAL) {
                const node = decodeInternal(raw, pageId)
                if (!node) return
                for (const childId of node.children) await walkPage(childId)
            } else if (raw[4] === PAGE_TYPE_LEAF) {
                const result = decodeLeaf(raw, pageId)
                if (!result) return
                for (const [, { headPageId }] of result.overflowRefs) {
                    let ovId = headPageId
                    while (ovId !== NULL_PAGE && !visited.has(ovId)) {
                        visited.add(ovId)
                        ids.push(ovId)
                        const ovRaw = await this.adapter.read(ovId)
                        if (!ovRaw) break
                        const ov = decodeOverflow(ovRaw)
                        if (!ov) break
                        ovId = ov.nextPageId
                    }
                }
            }
        }

        await walkPage(this.rootPageId)
        return ids
    }

    /**
     * Patch all page-ID references inside `raw` according to `remap`, update
     * the page's `pageSeq` to the current `writeSeq`, recompute the CRC, and
     * return the modified copy.  Operates in-place on a copy of the raw bytes
     * to avoid decoding + re-encoding (which would lose the overflow totalLen
     * stored in leaf entries whose value data lives in overflow chains).
     */
    private _compactRemapPage(raw: Uint8Array, remap: Map<number, number>): Uint8Array {
        const buf  = new Uint8Array(raw)  // copy — do not mutate the original
        const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
        const type = raw[4]
        const r    = (id: number): number => id === NULL_PAGE ? NULL_PAGE : (remap.get(id) ?? id)

        // Update the stored sequence number
        writeU64(view, 6, this.writeSeq)

        if (type === PAGE_TYPE_INTERNAL) {
            // Layout: HEADER | keyCount(2) | [keyLen(2)+keyBytes]×n | [childId(4)+childCount(6)]×(n+1)
            const keyCount = readU16(view, HEADER_SIZE)
            let off = HEADER_SIZE + 2
            for (let i = 0; i < keyCount; i++) {
                const kLen = readU16(view, off); off += 2 + kLen
            }
            for (let i = 0; i <= keyCount; i++) {
                writeU32(view, off, r(readU32(view, off)))
                off += 10  // childPageId(4) + childEntryCount(6)
            }
        } else if (type === PAGE_TYPE_LEAF) {
            // Layout: HEADER | keyCount(2) | prevPageId(4) | nextPageId(4) | entries…
            writeU32(view, HEADER_SIZE + 2, r(readU32(view, HEADER_SIZE + 2)))  // prevPageId
            writeU32(view, HEADER_SIZE + 6, r(readU32(view, HEADER_SIZE + 6)))  // nextPageId
            const keyCount = readU16(view, HEADER_SIZE)
            let off = HEADER_SIZE + 10  // keyCount(2) + prev(4) + next(4)
            for (let i = 0; i < keyCount; i++) {
                const kLen = readU16(view, off); off += 2 + kLen
                const spec = readU16(view, off); off += 2
                if (spec & OVERFLOW_FLAG) {
                    writeU32(view, off, r(readU32(view, off)))  // overflowPageId
                    off += 8  // overflowPageId(4) + totalLen(4)
                } else {
                    off += spec  // skip inline value bytes
                }
            }
        } else if (type === PAGE_TYPE_OVERFLOW) {
            // Layout: HEADER | nextPageId(4) | chunkLen(2) | chunk…
            writeU32(view, HEADER_SIZE, r(readU32(view, HEADER_SIZE)))
        }

        // Recompute CRC (covers bytes CRC_SIZE..end)
        writeU32(view, 0, crc32(buf, CRC_SIZE, buf.length - CRC_SIZE))

        return buf
    }
}

interface PathEntry {
    node:       InternalNode
    childIndex: number
}
