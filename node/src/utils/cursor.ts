/**
 * Engine-neutral cursor codec for keyset pagination. Encodes a single cursor value (the value of
 * the ordering column for the last row of a page) into an opaque, type-tagged base64url string,
 * and decodes it back to the original primitive. Reusable by any `paginateCursor` implementation.
 *
 * Cursors are unsigned and not integrity-protected — they are opaque by convention only.
 * `decodeCursor` validates the payload and throws `ValidationError` on any malformed input
 * so callers surface a 400 rather than a 500.
 */

import { ValidationError } from '../errors'

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
    let decoded: string
    try {
        decoded = Buffer.from(cursor, 'base64url').toString('utf8')
        if (!decoded) throw new Error()
    } catch {
        throw new ValidationError('invalid cursor')
    }
    const idx = decoded.indexOf(':')
    if (idx < 0) throw new ValidationError('invalid cursor')
    const kind = decoded.slice(0, idx)
    const v = decoded.slice(idx + 1)
    switch (kind) {
        case 'd': {
            const d = new Date(v)
            if (Number.isNaN(d.getTime())) throw new ValidationError('invalid cursor')
            return d
        }
        case 'g': {
            try { return BigInt(v) } catch { throw new ValidationError('invalid cursor') }
        }
        case 'n': {
            const n = Number(v)
            if (!Number.isFinite(n)) throw new ValidationError('invalid cursor')
            return n
        }
        case 'b': return v === '1'
        case 's': return v
        default: throw new ValidationError('invalid cursor')
    }
}
