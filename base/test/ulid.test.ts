import { describe, it, expect, vi, afterEach } from 'vitest'
import ulid from '../src/ulid'

describe('ulid', () => {

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns a 26-character string', () => {
        expect(ulid()).toHaveLength(26)
    })

    it('uses only valid Crockford Base32 characters', () => {
        expect(ulid()).toMatch(/^[0123456789ABCDEFGHJKMNPQRSTVWXYZ]{26}$/)
    })

    it('generates unique ids', () => {
        const ids = new Set(Array.from({ length: 100 }, () => ulid()))
        expect(ids.size).toBe(100)
    })

    it('sorts lexicographically when timestamps are strictly increasing', () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000)
        const a = ulid()
        vi.setSystemTime(2_000)
        const b = ulid()
        vi.setSystemTime(3_000)
        const c = ulid()
        expect(a < b).toBe(true)
        expect(b < c).toBe(true)
    })

    it('is monotonic within the same millisecond', () => {
        vi.useFakeTimers()
        vi.setSystemTime(100_000_000)
        const ids = Array.from({ length: 200 }, () => ulid())
        for (let i = 1; i < ids.length; i++) {
            expect(ids[i - 1] < ids[i]).toBe(true)
        }
    })

    it('resets the random part when the millisecond advances', () => {
        vi.useFakeTimers()
        vi.setSystemTime(200_000_000)
        const a = ulid()
        vi.setSystemTime(200_000_001)
        const b = ulid()
        expect(a.slice(0, 10) < b.slice(0, 10)).toBe(true)
    })

    it('encodes increasing time in the first 10 characters', () => {
        vi.useFakeTimers()
        vi.setSystemTime(1_000_000)
        const early = ulid().slice(0, 10)
        vi.setSystemTime(2_000_000)
        const late = ulid().slice(0, 10)
        expect(early < late).toBe(true)
    })

})
