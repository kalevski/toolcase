/**
 * Fixed-size (12-byte) pointer stored as a B+ tree leaf value.
 * segment(4) + offset(4) + length(4), all little-endian uint32.
 */
export interface BlockRef {
    segment: number
    offset:  number
    length:  number
}

export const BLOCK_REF_SIZE = 12

export function serializeBlockRef(ref: BlockRef): Uint8Array {
    const buf = new Uint8Array(BLOCK_REF_SIZE)
    const dv  = new DataView(buf.buffer)
    dv.setUint32(0, ref.segment, true)
    dv.setUint32(4, ref.offset,  true)
    dv.setUint32(8, ref.length,  true)
    return buf
}

export function deserializeBlockRef(buf: Uint8Array): BlockRef {
    const dv = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
    return {
        segment: dv.getUint32(0, true),
        offset:  dv.getUint32(4, true),
        length:  dv.getUint32(8, true),
    }
}
