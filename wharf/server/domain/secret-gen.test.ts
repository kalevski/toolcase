import { describe, it, expect } from 'vitest'
import {
    bytesNeeded,
    generateSecret,
    DEFAULT_PASSWORD_CHARSET,
    DEFAULT_TOKEN_CHARSET,
} from '@/server/domain/secret-gen'

// Fixed, deterministic byte array — every test below derives from this so that
// outputs are exactly reproducible (planning §8.2 keeps generation pure).
const BYTES = new Uint8Array([
    0x00, 0x01, 0x7f, 0x80, 0xff, 0x10, 0x20, 0x3a, 0x41, 0x5a, 0x61, 0x7a, 0x39, 0x2b, 0x2f, 0xab,
    0xcd, 0xef, 0x12, 0x34, 0x56, 0x78, 0x9a, 0xbc, 0xde, 0xf0, 0x0a, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f,
])

describe('bytesNeeded', () => {
    it('hex needs ceil(length/2)', () => {
        expect(bytesNeeded({ kind: 'hex', length: 16 })).toBe(8)
        expect(bytesNeeded({ kind: 'hex', length: 15 })).toBe(8)
    })

    it('base64 needs ceil(length*3/4)', () => {
        expect(bytesNeeded({ kind: 'base64', length: 16 })).toBe(12)
        expect(bytesNeeded({ kind: 'base64', length: 10 })).toBe(8)
    })

    it('password/token need one byte per char', () => {
        expect(bytesNeeded({ kind: 'password', length: 20 })).toBe(20)
        expect(bytesNeeded({ kind: 'token', length: 12 })).toBe(12)
    })
})

describe('generateSecret — hex', () => {
    it('produces exactly `length` lowercase hex chars matching the bytes', () => {
        const out = generateSecret(BYTES, { kind: 'hex', length: 16 })
        expect(out).toHaveLength(16)
        // First 8 bytes hex-encoded = first 16 hex chars.
        expect(out).toBe('00017f80ff10203a')
        expect(out).toMatch(/^[0-9a-f]+$/)
    })
})

describe('generateSecret — base64url', () => {
    it('produces exactly `length` url-safe base64 chars', () => {
        const out = generateSecret(BYTES, { kind: 'base64', length: 16 })
        expect(out).toHaveLength(16)
        // base64url alphabet only: A-Z a-z 0-9 - _ (no +, /, =).
        expect(out).toMatch(/^[A-Za-z0-9\-_]+$/)
    })
})

describe('generateSecret — token', () => {
    it('emits only charset chars at the exact length', () => {
        const out = generateSecret(BYTES, { kind: 'token', length: 24 })
        expect(out).toHaveLength(24)
        for (const ch of out) {
            expect(DEFAULT_TOKEN_CHARSET).toContain(ch)
        }
    })

    it('is deterministic for the same bytes', () => {
        const a = generateSecret(BYTES, { kind: 'token', length: 24 })
        const b = generateSecret(BYTES, { kind: 'token', length: 24 })
        expect(a).toBe(b)
        // Spot-check the mapping: byte[0]=0x00 → charset[0], byte[1]=0x01 → charset[1].
        expect(a[0]).toBe(DEFAULT_TOKEN_CHARSET[0])
        expect(a[1]).toBe(DEFAULT_TOKEN_CHARSET[1])
    })

    it('honours a custom charset', () => {
        const out = generateSecret(BYTES, { kind: 'token', length: 8, charset: 'ab' })
        expect(out).toHaveLength(8)
        expect(out).toMatch(/^[ab]+$/)
    })
})

describe('generateSecret — password', () => {
    it('produces exactly `length` chars from the default password charset', () => {
        const out = generateSecret(BYTES, { kind: 'password', length: 20 })
        expect(out).toHaveLength(20)
        for (const ch of out) {
            expect(DEFAULT_PASSWORD_CHARSET).toContain(ch)
        }
    })
})

describe('generateSecret — validation', () => {
    it('throws RangeError on insufficient entropy', () => {
        const tooFew = new Uint8Array(4)
        expect(() => generateSecret(tooFew, { kind: 'hex', length: 16 })).toThrow(RangeError)
        expect(() => generateSecret(tooFew, { kind: 'hex', length: 16 })).toThrow(
            /insufficient entropy/,
        )
    })

    it('throws RangeError when length <= 0', () => {
        expect(() => generateSecret(BYTES, { kind: 'hex', length: 0 })).toThrow(RangeError)
        expect(() => generateSecret(BYTES, { kind: 'token', length: -3 })).toThrow(RangeError)
    })

    it('throws RangeError when length is not an integer', () => {
        expect(() => generateSecret(BYTES, { kind: 'hex', length: 2.5 })).toThrow(RangeError)
    })
})
