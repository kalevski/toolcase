// Unit coverage for the pure cron parser backing the reconcile ticker (§8). Pins
// the field grammar and the standard dom/dow OR semantics so a malformed env
// cron is caught, not silently ignored.

import { describe, it, expect } from 'vitest'
import { parseCron, InvalidCronError } from './cron'

// 2026-06-25 is a Thursday (getDay() === 4).
const THURS_1430 = new Date(2026, 5, 25, 14, 30, 0)

describe('parseCron', () => {
    it('matches a wildcard expression at any minute', () => {
        expect(parseCron('* * * * *').matches(THURS_1430)).toBe(true)
    })

    it('honours a step expression like the default */15', () => {
        const spec = parseCron('*/15 * * * *')
        expect(spec.matches(new Date(2026, 5, 25, 14, 30))).toBe(true) // 30 % 15 === 0
        expect(spec.matches(new Date(2026, 5, 25, 14, 31))).toBe(false)
        expect(spec.matches(new Date(2026, 5, 25, 14, 45))).toBe(true)
    })

    it('matches explicit minute/hour and a day-of-week field', () => {
        expect(parseCron('30 14 * * *').matches(THURS_1430)).toBe(true)
        expect(parseCron('30 14 * * 4').matches(THURS_1430)).toBe(true) // Thursday
        expect(parseCron('30 14 * * 1').matches(THURS_1430)).toBe(false) // Monday
    })

    it('throws InvalidCronError on the wrong field count and bad parts', () => {
        expect(() => parseCron('* * * *')).toThrow(InvalidCronError)
        expect(() => parseCron('99 * * * *')).toThrow(InvalidCronError)
        expect(() => parseCron('a * * * *')).toThrow(InvalidCronError)
    })
})
