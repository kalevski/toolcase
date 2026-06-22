// Low-level DataView helpers for the fixed-width integer types used in pages.

export function readU16(view: DataView, offset: number): number {
    return view.getUint16(offset, true)
}
export function writeU16(view: DataView, offset: number, v: number): void {
    view.setUint16(offset, v, true)
}

export function readU32(view: DataView, offset: number): number {
    return view.getUint32(offset, true)
}
export function writeU32(view: DataView, offset: number, v: number): void {
    view.setUint32(offset, v, true)
}

// uint48 — safe for JS numbers up to 2^48 (well within Number.MAX_SAFE_INTEGER = 2^53 - 1)
export function readU48(view: DataView, offset: number): number {
    const lo = view.getUint32(offset, true)
    const hi = view.getUint16(offset + 4, true)
    return lo + hi * 0x100000000
}
export function writeU48(view: DataView, offset: number, v: number): void {
    view.setUint32(offset, v >>> 0, true)
    view.setUint16(offset + 4, Math.floor(v / 0x100000000) & 0xffff, true)
}

// uint64 stored as two uint32s — we keep it as a JS number (safe up to 2^53)
export function readU64(view: DataView, offset: number): number {
    const lo = view.getUint32(offset, true)
    const hi = view.getUint32(offset + 4, true)
    return lo + hi * 0x100000000
}
export function writeU64(view: DataView, offset: number, v: number): void {
    view.setUint32(offset, v >>> 0, true)
    view.setUint32(offset + 4, Math.floor(v / 0x100000000) >>> 0, true)
}
