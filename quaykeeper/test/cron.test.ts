import { describe, it, expect } from 'vitest'
import { InvalidCronError, nextRun, parseCron } from '@/server/domain/cron'

describe('parseCron', () => {
    it('rejects an expression without 5 fields', () => {
        expect(() => parseCron('* * * *')).toThrow(InvalidCronError)
        expect(() => parseCron('* * * * * *')).toThrow(InvalidCronError)
    })

    it('matches a specific minute/hour', () => {
        const spec = parseCron('30 3 * * *')
        expect(spec.matches(new Date('2026-07-06T03:30:00'))).toBe(true)
        expect(spec.matches(new Date('2026-07-06T03:31:00'))).toBe(false)
        expect(spec.matches(new Date('2026-07-06T04:30:00'))).toBe(false)
    })

    it('honours step syntax', () => {
        const spec = parseCron('*/15 * * * *')
        expect(spec.matches(new Date('2026-07-06T10:00:00'))).toBe(true)
        expect(spec.matches(new Date('2026-07-06T10:15:00'))).toBe(true)
        expect(spec.matches(new Date('2026-07-06T10:07:00'))).toBe(false)
    })

    it('treats dom+dow as an OR when both are restricted', () => {
        // Fire on the 1st OR on Sundays.
        const spec = parseCron('0 0 1 * 0')
        expect(spec.matches(new Date('2026-07-01T00:00:00'))).toBe(true) // the 1st (a Wednesday)
        // 2026-07-05 is a Sunday.
        expect(spec.matches(new Date('2026-07-05T00:00:00'))).toBe(true)
        expect(spec.matches(new Date('2026-07-07T00:00:00'))).toBe(false)
    })
})

describe('nextRun', () => {
    it('returns the next matching minute strictly after `from`', () => {
        const spec = parseCron('0 3 * * *') // daily 03:00
        const from = new Date('2026-07-06T03:00:30') // already inside the 03:00 minute
        const next = nextRun(spec, from)
        expect(next?.toISOString()).toBe(new Date('2026-07-07T03:00:00').toISOString())
    })

    it('finds a match later the same day', () => {
        const spec = parseCron('*/15 * * * *')
        const next = nextRun(spec, new Date('2026-07-06T10:02:00'))
        expect(next?.toISOString()).toBe(new Date('2026-07-06T10:15:00').toISOString())
    })

    it('zeroes seconds/millis on the returned Date', () => {
        const spec = parseCron('* * * * *') // every minute
        const next = nextRun(spec, new Date('2026-07-06T10:02:37.500'))
        expect(next?.getSeconds()).toBe(0)
        expect(next?.getMilliseconds()).toBe(0)
        expect(next?.toISOString()).toBe(new Date('2026-07-06T10:03:00').toISOString())
    })

    it('returns null when nothing fires within the horizon', () => {
        const spec = parseCron('0 0 30 2 *') // Feb 30 — never
        expect(nextRun(spec, new Date('2026-07-06T00:00:00'))).toBeNull()
    })
})
