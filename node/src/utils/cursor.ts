/**
 * Engine-neutral cursor codec for keyset pagination. Encodes a single cursor value (the value of
 * the ordering column for the last row of a page) into an opaque, type-tagged base64url string,
 * and decodes it back to the original primitive. Reusable by any `paginateCursor` implementation.
 */
export function encodeCursor(value: unknown): string {
    let kind: 's' | 'n' | 'b' | 'd' | 'g'
    let v: string
    if (value instanceof Date) {
        kind = 'd'
        v = value.toISOString()
    } else if (typeof value === 'bigint') {
        kind = 'g'
        v = value.toString()
    } else if (typeof value === 'number') {
        kind = 'n'
        v = String(value)
    } else if (typeof value === 'boolean') {
        kind = 'b'
        v = value ? '1' : '0'
    } else {
        kind = 's'
        v = String(value)
    }
    return Buffer.from(`${kind}:${v}`, 'utf8').toString('base64url')
}

export function decodeCursor(cursor: string): unknown {
    const decoded = Buffer.from(cursor, 'base64url').toString('utf8')
    const idx = decoded.indexOf(':')
    if (idx < 0) return decoded
    const kind = decoded.slice(0, idx)
    const v = decoded.slice(idx + 1)
    switch (kind) {
        case 'd': return new Date(v)
        case 'g': return BigInt(v)
        case 'n': return Number(v)
        case 'b': return v === '1'
        case 's': return v
        default: return v
    }
}
