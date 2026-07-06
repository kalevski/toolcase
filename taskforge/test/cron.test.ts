// Unit tests for the pure 5-field cron parser/matcher (server/domain/cron.ts).
// Pure domain — no DB, no timers; dates are constructed explicitly.

import { describe, it, expect } from 'vitest'
import { parseCron, minuteKey, InvalidCronError } from '../server/domain/cron'

// Local-time date helper: (y, m 1-12, d, hh, mm)
const at = (y: number, m: number, d: number, hh: number, mm: number) => new Date(y, m - 1, d, hh, mm)

describe('parseCron — shape validation', () => {
    it('rejects the wrong field count', () => {
        expect(() => parseCron('* * * *')).toThrow(InvalidCronError)
        expect(() => parseCron('* * * * * *')).toThrow(InvalidCronError)
        expect(() => parseCron('')).toThrow(InvalidCronError)
    })

    it('rejects garbage parts, bad steps and out-of-range values', () => {
        expect(() => parseCron('a * * * *')).toThrow(InvalidCronError)
        expect(() => parseCron('*/0 * * * *')).toThrow(InvalidCronError)
        expect(() => parseCron('60 * * * *')).toThrow(InvalidCronError)
        expect(() => parseCron('* 24 * * *')).toThrow(InvalidCronError)
        expect(() => parseCron('* * 32 * *')).toThrow(InvalidCronError)
        expect(() => parseCron('* * * 13 *')).toThrow(InvalidCronError)
        expect(() => parseCron('* * * * 8')).toThrow(InvalidCronError)
        expect(() => parseCron('5-2 * * * *')).toThrow(InvalidCronError)
    })
})

describe('parseCron — matching', () => {
    it('* * * * * matches any minute', () => {
        const spec = parseCron('* * * * *')
        expect(spec.matches(at(2026, 7, 6, 0, 0))).toBe(true)
        expect(spec.matches(at(2026, 7, 6, 23, 59))).toBe(true)
    })

    it('fixed minute+hour', () => {
        const spec = parseCron('30 2 * * *')
        expect(spec.matches(at(2026, 7, 6, 2, 30))).toBe(true)
        expect(spec.matches(at(2026, 7, 6, 2, 31))).toBe(false)
        expect(spec.matches(at(2026, 7, 6, 3, 30))).toBe(false)
    })

    it('lists, ranges and steps', () => {
        const spec = parseCron('0,30 9-17 * * *')
        expect(spec.matches(at(2026, 7, 6, 9, 0))).toBe(true)
        expect(spec.matches(at(2026, 7, 6, 17, 30))).toBe(true)
        expect(spec.matches(at(2026, 7, 6, 8, 30))).toBe(false)
        expect(spec.matches(at(2026, 7, 6, 9, 15))).toBe(false)

        const every15 = parseCron('*/15 * * * *')
        expect(every15.matches(at(2026, 7, 6, 1, 45))).toBe(true)
        expect(every15.matches(at(2026, 7, 6, 1, 50))).toBe(false)
    })

    it('dow 7 ≡ 0 (Sunday), including stepped ranges reaching 7', () => {
        const sunday = at(2026, 7, 5, 12, 0) // 2026-07-05 is a Sunday
        expect(parseCron('0 12 * * 0').matches(sunday)).toBe(true)
        expect(parseCron('0 12 * * 7').matches(sunday)).toBe(true)
        expect(parseCron('0 12 * * 0-7/2').matches(sunday)).toBe(true)
        expect(parseCron('0 12 * * 1').matches(sunday)).toBe(false)
    })

    it('standard dom/dow OR semantics when both are restricted', () => {
        // 2026-07-06 is a Monday (dow 1); dom is 6.
        const monday6th = at(2026, 7, 6, 0, 0)
        expect(parseCron('0 0 6 * 5').matches(monday6th)).toBe(true) // dom matches, dow doesn't
        expect(parseCron('0 0 10 * 1').matches(monday6th)).toBe(true) // dow matches, dom doesn't
        expect(parseCron('0 0 10 * 5').matches(monday6th)).toBe(false) // neither
        // dom restricted, dow * → dom decides
        expect(parseCron('0 0 10 * *').matches(monday6th)).toBe(false)
        // dow restricted, dom * → dow decides
        expect(parseCron('0 0 * * 1').matches(monday6th)).toBe(true)
    })

    it('month field', () => {
        const spec = parseCron('0 0 * 7 *')
        expect(spec.matches(at(2026, 7, 6, 0, 0))).toBe(true)
        expect(spec.matches(at(2026, 8, 6, 0, 0))).toBe(false)
    })
})

describe('minuteKey', () => {
    it('same minute → same key; next minute → different key', () => {
        const a = new Date('2026-07-06T10:15:01Z')
        const b = new Date('2026-07-06T10:15:59Z')
        const c = new Date('2026-07-06T10:16:00Z')
        expect(minuteKey(a)).toBe(minuteKey(b))
        expect(minuteKey(a)).not.toBe(minuteKey(c))
    })
})
