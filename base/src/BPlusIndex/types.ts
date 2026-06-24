export interface StorageAdapter {
    read(pageId: number): Promise<Uint8Array | null>
    write(pageId: number, data: Uint8Array): Promise<void>
    truncate?(pageCount: number): Promise<void>
    flush?(): Promise<void>
    close?(): Promise<void>
}

export const PAGE_TYPE_SUPERBLOCK = 0
export const PAGE_TYPE_INTERNAL   = 1
export const PAGE_TYPE_LEAF       = 2
export const PAGE_TYPE_OVERFLOW   = 3
export const PAGE_TYPE_FREELIST   = 4

export const HEADER_SIZE      = 14   // crc32(4) + type(1) + flags(1) + pageSeq(8)
export const CRC_SIZE         = 4
export const FORMAT_VERSION   = 1
export const NULL_PAGE        = 0    // sentinel "no page"
// Superblock slots
export const SB_PAGE_A        = 0
export const SB_PAGE_B        = 1
// First tree page
export const FIRST_TREE_PAGE  = 2

// Inline value: high bit of the 2-byte length field is 0
// Overflow value: high bit is 1; followed by overflowPageId(4) + totalLen(4)
export const OVERFLOW_FLAG    = 0x8000

export interface SuperblockData {
    formatVersion: number
    pageSize: number
    order: number
    rootPageId: number
    pageCount: number
    freeListHeadPageId: number
    totalRecordCount: number
    keyEncoding: string
}

export interface InternalNode {
    pageId: number
    pageSeq: number
    keyRaws: Uint8Array[]      // serialized key bytes
    children: number[]         // pageId per child, length = keyRaws.length + 1
    childCounts: number[]      // entryCount per child, length = keyRaws.length + 1
}

export interface LeafEntry {
    keyRaw: Uint8Array
    valueRaw: Uint8Array   // fully reassembled value bytes
    overflowHead: number   // 0 = inline / new entry, non-zero = head of existing overflow chain
}

export interface LeafNode {
    pageId: number
    pageSeq: number
    prevPageId: number
    nextPageId: number
    entries: LeafEntry[]
}

export interface BPlusIndexOptions<K, V> {
    adapter: StorageAdapter
    pageSize?: number
    order?: number
    keyEncoding?: string
    compare: (a: K, b: K) => number
    serializeKey: (k: K) => Uint8Array
    deserializeKey: (b: Uint8Array) => K
    serializeValue: (v: V) => Uint8Array
    deserializeValue: (b: Uint8Array) => V
    overflowThreshold?: number
}

export interface RangeOptions<K> {
    gte?: K
    gt?: K
    lte?: K
    lt?: K
    reverse?: boolean
    limit?: number
}

export interface BPlusIndexStats {
    /** Number of levels in the tree (1 = root is a leaf). */
    height: number
    /** Total number of pages allocated (including the two superblock slots). */
    pageCount: number
    /** Number of page IDs stored across all free-list pages — pages available for reuse. */
    freePages: number
    /**
     * Fraction of non-superblock allocated pages that are live tree data.
     * 1.0 = no waste; 0.5 = half the file is free slots that compact() can reclaim.
     */
    fillFactor: number
}
