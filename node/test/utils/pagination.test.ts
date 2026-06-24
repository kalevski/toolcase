import { describe, it, expect } from 'vitest'
import { normalizeOffsetLimit } from '../../src/utils/pagination'
import { ValidationError } from '../../src/errors'

describe('normalizeOffsetLimit', () => {
    describe('limit', () => {
        it('accepts plain decimal integer', () => {
            expect(normalizeOffsetLimit({ limit: 50 }).limit).toBe(50)
        })

        it('accepts string decimal integer', () => {
            expect(normalizeOffsetLimit({ limit: '20' as unknown as number }).limit).toBe(20)
        })

        it('rejects hex string in strict mode', () => {
            expect(() => normalizeOffsetLimit({ limit: '0x3e8' as unknown as number }, { strict: true })).toThrow(ValidationError)
        })

        it('rejects hex string in non-strict mode (returns default)', () => {
            expect(normalizeOffsetLimit({ limit: '0x3e8' as unknown as number }).limit).toBe(25)
        })

        it('rejects scientific notation in strict mode', () => {
            expect(() => normalizeOffsetLimit({ limit: '1e2' as unknown as number }, { strict: true })).toThrow(ValidationError)
        })

        it('rejects scientific notation in non-strict mode (returns default)', () => {
            expect(normalizeOffsetLimit({ limit: '1e2' as unknown as number }).limit).toBe(25)
        })

        it('clamps to maxLimit', () => {
            expect(normalizeOffsetLimit({ limit: 9999 }, { maxLimit: 100 }).limit).toBe(100)
        })

        it('rejects zero in strict mode', () => {
            expect(() => normalizeOffsetLimit({ limit: 0 }, { strict: true })).toThrow(ValidationError)
        })

        it('uses defaultLimit when limit absent', () => {
            expect(normalizeOffsetLimit({}, { defaultLimit: 10 }).limit).toBe(10)
        })

        it('rejects negative number in strict mode', () => {
            expect(() => normalizeOffsetLimit({ limit: -5 }, { strict: true })).toThrow(ValidationError)
        })
    })

    describe('offset', () => {
        it('accepts zero offset', () => {
            expect(normalizeOffsetLimit({ offset: 0 }).offset).toBe(0)
        })

        it('accepts string decimal offset', () => {
            expect(normalizeOffsetLimit({ offset: '100' as unknown as number }).offset).toBe(100)
        })

        it('rejects hex string offset in strict mode', () => {
            expect(() => normalizeOffsetLimit({ offset: '0x3e8' as unknown as number }, { strict: true })).toThrow(ValidationError)
        })

        it('rejects hex string offset in non-strict mode (returns 0)', () => {
            expect(normalizeOffsetLimit({ offset: '0x3e8' as unknown as number }).offset).toBe(0)
        })

        it('rejects scientific notation offset in strict mode', () => {
            expect(() => normalizeOffsetLimit({ offset: '1e2' as unknown as number }, { strict: true })).toThrow(ValidationError)
        })

        it('rejects scientific notation offset in non-strict mode (returns 0)', () => {
            expect(normalizeOffsetLimit({ offset: '1e2' as unknown as number }).offset).toBe(0)
        })

        it('caps offset at maxOffset', () => {
            expect(normalizeOffsetLimit({ offset: 5000 }, { maxOffset: 1000 }).offset).toBe(1000)
        })

        it('does not cap when maxOffset unset', () => {
            expect(normalizeOffsetLimit({ offset: 9999 }).offset).toBe(9999)
        })

        it('rejects negative offset in strict mode', () => {
            expect(() => normalizeOffsetLimit({ offset: -1 }, { strict: true })).toThrow(ValidationError)
        })

        it('rejects negative offset in non-strict mode (returns 0)', () => {
            expect(normalizeOffsetLimit({ offset: -1 }).offset).toBe(0)
        })
    })
})
