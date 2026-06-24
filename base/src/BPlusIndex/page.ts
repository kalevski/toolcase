import { crc32 } from './crc32'
import { readU16, writeU16, readU32, writeU32, readU48, writeU48, readU64, writeU64 } from './encode'
import {
    HEADER_SIZE, CRC_SIZE, FORMAT_VERSION,
    NULL_PAGE, OVERFLOW_FLAG,
    PAGE_TYPE_SUPERBLOCK, PAGE_TYPE_INTERNAL, PAGE_TYPE_LEAF,
    PAGE_TYPE_OVERFLOW, PAGE_TYPE_FREELIST,
    SuperblockData, InternalNode, LeafNode, LeafEntry,
} from './types'

const ENC = new TextEncoder()
const DEC = new TextDecoder()

// ── Header helpers ──────────────────────────────────────────────────────────

export function readHeader(buf: Uint8Array): { type: number; flags: number; pageSeq: number } | null {
    if (buf.length < HEADER_SIZE) return null
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    const storedCrc = readU32(view, 0)
    const computed   = crc32(buf, CRC_SIZE, buf.length - CRC_SIZE)
    if (storedCrc !== computed) return null
    return {
        type:   buf[4],
        flags:  buf[5],
        pageSeq: readU64(view, 6),
    }
}

function writeHeader(buf: Uint8Array, type: number, flags: number, pageSeq: number): DataView {
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    buf[4] = type
    buf[5] = flags
    writeU64(view, 6, pageSeq)
    // CRC is written last (covers bytes [4..end])
    const crcVal = crc32(buf, CRC_SIZE, buf.length - CRC_SIZE)
    writeU32(view, 0, crcVal)
    return view
}

// ── Superblock ───────────────────────────────────────────────────────────────

/*
  Superblock body (starting at offset HEADER_SIZE):
    formatVersion : uint16
    pageSize      : uint32
    order         : uint16
    rootPageId    : uint32
    pageCount     : uint32
    freeListHead  : uint32
    totalRecords  : uint48
    keyEncLen     : uint16
    keyEncoding   : utf8 bytes
*/

export function encodeSuperblock(buf: Uint8Array, sb: SuperblockData, pageSeq: number): void {
    buf.fill(0)
    const keyBytes = ENC.encode(sb.keyEncoding)
    let off = HEADER_SIZE
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    writeU16(view, off, FORMAT_VERSION);   off += 2
    writeU32(view, off, sb.pageSize);      off += 4
    writeU16(view, off, sb.order);         off += 2
    writeU32(view, off, sb.rootPageId);    off += 4
    writeU32(view, off, sb.pageCount);     off += 4
    writeU32(view, off, sb.freeListHeadPageId); off += 4
    writeU48(view, off, sb.totalRecordCount);   off += 6
    writeU16(view, off, keyBytes.length);  off += 2
    buf.set(keyBytes, off)
    writeHeader(buf, PAGE_TYPE_SUPERBLOCK, 0, pageSeq)
}

export function decodeSuperblock(buf: Uint8Array): (SuperblockData & { pageSeq: number }) | null {
    const hdr = readHeader(buf)
    if (!hdr || hdr.type !== PAGE_TYPE_SUPERBLOCK) return null
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    let off = HEADER_SIZE
    const formatVersion = readU16(view, off); off += 2
    if (formatVersion !== FORMAT_VERSION) return null
    const pageSize      = readU32(view, off); off += 4
    const order         = readU16(view, off); off += 2
    const rootPageId    = readU32(view, off); off += 4
    const pageCount     = readU32(view, off); off += 4
    const freeListHeadPageId = readU32(view, off); off += 4
    const totalRecordCount   = readU48(view, off); off += 6
    const keyEncLen          = readU16(view, off); off += 2
    const keyEncoding        = DEC.decode(buf.subarray(off, off + keyEncLen))
    return { formatVersion, pageSize, order, rootPageId, pageCount, freeListHeadPageId, totalRecordCount, keyEncoding, pageSeq: hdr.pageSeq }
}

// ── Internal node ────────────────────────────────────────────────────────────

/*
  Internal node body:
    keyCount : uint16
    [keyLen(2) + keyBytes] * keyCount
    [childPageId(4) + childEntryCount(6)] * (keyCount + 1)
*/

export function encodeInternal(buf: Uint8Array, node: InternalNode): void {
    buf.fill(0)
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    let off = HEADER_SIZE
    writeU16(view, off, node.keyRaws.length); off += 2
    for (const kb of node.keyRaws) {
        writeU16(view, off, kb.length); off += 2
        buf.set(kb, off); off += kb.length
    }
    for (let i = 0; i < node.children.length; i++) {
        writeU32(view, off, node.children[i]); off += 4
        writeU48(view, off, node.childCounts[i]); off += 6
    }
    writeHeader(buf, PAGE_TYPE_INTERNAL, 0, node.pageSeq)
}

export function decodeInternal(buf: Uint8Array, pageId: number): InternalNode | null {
    const hdr = readHeader(buf)
    if (!hdr || hdr.type !== PAGE_TYPE_INTERNAL) return null
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    let off = HEADER_SIZE
    const keyCount = readU16(view, off); off += 2
    const keyRaws: Uint8Array[] = []
    for (let i = 0; i < keyCount; i++) {
        const len = readU16(view, off); off += 2
        keyRaws.push(buf.slice(off, off + len)); off += len
    }
    const children: number[] = []
    const childCounts: number[] = []
    for (let i = 0; i <= keyCount; i++) {
        children.push(readU32(view, off)); off += 4
        childCounts.push(readU48(view, off)); off += 6
    }
    return { pageId, pageSeq: hdr.pageSeq, keyRaws, children, childCounts }
}

export function internalByteSize(node: InternalNode): number {
    let size = HEADER_SIZE + 2
    for (const kb of node.keyRaws) size += 2 + kb.length
    size += node.children.length * 10
    return size
}

// ── Leaf node ────────────────────────────────────────────────────────────────

/*
  Leaf node body:
    keyCount      : uint16
    prevPageId    : uint32
    nextPageId    : uint32
    For each entry:
      keyLen(2) + keyBytes
      valueSpec: normal → len(2, bit15=0) + bytes
                 overflow → 0x8000(2) + overflowPageId(4) + totalLen(4)
*/

// encodeLeaf — overflow pages must already be written (overflowHead set on entries)
export function encodeLeaf(buf: Uint8Array, node: LeafNode): void {
    buf.fill(0)
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    let off = HEADER_SIZE
    writeU16(view, off, node.entries.length); off += 2
    writeU32(view, off, node.prevPageId);     off += 4
    writeU32(view, off, node.nextPageId);     off += 4
    for (const e of node.entries) {
        writeU16(view, off, e.keyRaw.length); off += 2
        buf.set(e.keyRaw, off); off += e.keyRaw.length
        if (e.overflowHead !== 0) {
            writeU16(view, off, OVERFLOW_FLAG);          off += 2
            writeU32(view, off, e.overflowHead);         off += 4
            writeU32(view, off, e.valueRaw.length);      off += 4
        } else {
            writeU16(view, off, e.valueRaw.length);      off += 2
            buf.set(e.valueRaw, off); off += e.valueRaw.length
        }
    }
    writeHeader(buf, PAGE_TYPE_LEAF, 0, node.pageSeq)
}

export function decodeLeaf(buf: Uint8Array, pageId: number): { node: LeafNode; overflowRefs: Map<number, { headPageId: number; totalLen: number }> } | null {
    const hdr = readHeader(buf)
    if (!hdr || hdr.type !== PAGE_TYPE_LEAF) return null
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    let off = HEADER_SIZE
    const keyCount   = readU16(view, off); off += 2
    const prevPageId = readU32(view, off); off += 4
    const nextPageId = readU32(view, off); off += 4
    const entries: LeafEntry[] = []
    const overflowRefs = new Map<number, { headPageId: number; totalLen: number }>()
    for (let i = 0; i < keyCount; i++) {
        const keyLen = readU16(view, off); off += 2
        const keyRaw = buf.slice(off, off + keyLen); off += keyLen
        const spec   = readU16(view, off); off += 2
        let valueRaw: Uint8Array
        let overflowHead = 0
        if (spec & OVERFLOW_FLAG) {
            const headPageId = readU32(view, off); off += 4
            const totalLen   = readU32(view, off); off += 4
            overflowRefs.set(i, { headPageId, totalLen })
            overflowHead = headPageId
            valueRaw = new Uint8Array(0) // filled later by _readLeaf
        } else {
            valueRaw = buf.slice(off, off + spec); off += spec
        }
        entries.push({ keyRaw, valueRaw, overflowHead })
    }
    return { node: { pageId, pageSeq: hdr.pageSeq, prevPageId, nextPageId, entries }, overflowRefs }
}

export function leafByteSize(node: LeafNode, ovThreshBytes: number): number {
    let size = HEADER_SIZE + 2 + 4 + 4  // header + keyCount + prev + next
    for (const e of node.entries) {
        size += 2 + e.keyRaw.length  // keyLen + keyBytes
        if (e.overflowHead !== 0 || e.valueRaw.length > ovThreshBytes) {
            size += 2 + 4 + 4  // OVERFLOW_FLAG + overflowPageId + totalLen
        } else {
            size += 2 + e.valueRaw.length  // len + bytes
        }
    }
    return size
}

// ── Overflow pages ────────────────────────────────────────────────────────────

/*
  Overflow body:
    nextOverflowPageId : uint32  (0 = end)
    chunkLen           : uint16
    chunkBytes         : Uint8Array(chunkLen)
*/

export function encodeOverflow(buf: Uint8Array, nextPageId: number, chunk: Uint8Array, pageSeq: number): void {
    buf.fill(0)
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    let off = HEADER_SIZE
    writeU32(view, off, nextPageId); off += 4
    writeU16(view, off, chunk.length); off += 2
    buf.set(chunk, off)
    writeHeader(buf, PAGE_TYPE_OVERFLOW, 0, pageSeq)
}

export function decodeOverflow(buf: Uint8Array): { nextPageId: number; chunk: Uint8Array } | null {
    const hdr = readHeader(buf)
    if (!hdr || hdr.type !== PAGE_TYPE_OVERFLOW) return null
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    let off = HEADER_SIZE
    const nextPageId = readU32(view, off); off += 4
    const chunkLen   = readU16(view, off); off += 2
    return { nextPageId, chunk: buf.slice(off, off + chunkLen) }
}

export function overflowChunkSize(pageSize: number): number {
    return pageSize - HEADER_SIZE - 4 - 2  // header + next(4) + chunkLen(2)
}

// ── Free-list pages ──────────────────────────────────────────────────────────

/*
  Free-list body:
    nextFreePageId : uint32  (0 = end)
    freeCount      : uint16
    freedPageIds   : uint32[] (freeCount entries)
*/

export function encodeFreelist(buf: Uint8Array, nextPageId: number, ids: number[], pageSeq: number): void {
    buf.fill(0)
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    let off = HEADER_SIZE
    writeU32(view, off, nextPageId); off += 4
    writeU16(view, off, ids.length); off += 2
    for (const id of ids) { writeU32(view, off, id); off += 4 }
    writeHeader(buf, PAGE_TYPE_FREELIST, 0, pageSeq)
}

export function decodeFreelist(buf: Uint8Array): { nextPageId: number; ids: number[] } | null {
    const hdr = readHeader(buf)
    if (!hdr || hdr.type !== PAGE_TYPE_FREELIST) return null
    const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    let off = HEADER_SIZE
    const nextPageId = readU32(view, off); off += 4
    const freeCount  = readU16(view, off); off += 2
    const ids: number[] = []
    for (let i = 0; i < freeCount; i++) { ids.push(readU32(view, off)); off += 4 }
    return { nextPageId, ids }
}

export function freelistCapacity(pageSize: number): number {
    return Math.floor((pageSize - HEADER_SIZE - 4 - 2) / 4)
}
