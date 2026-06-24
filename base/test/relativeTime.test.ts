import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import relativeTime from '../src/relativeTime'

const NOW = new Date('2024-06-15T12:00:00.000Z')

describe('relativeTime', () => {

    beforeEach(() => {
        vi.useFakeTimers()
        vi.setSystemTime(NOW)
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns "just now" when difference is under 1 second', () => {
        expect(relativeTime(new Date('2024-06-15T12:00:00.500Z'))).toBe('just now')
        expect(relativeTime(new Date('2024-06-15T11:59:59.800Z'))).toBe('just now')
    })

    it('formats past seconds', () => {
        expect(relativeTime(new Date('2024-06-15T11:59:50.000Z'))).toBe('10 seconds ago')
    })

    it('uses singular for 1 second', () => {
        expect(relativeTime(new Date('2024-06-15T11:59:59.000Z'))).toBe('1 second ago')
    })

    it('formats past minutes', () => {
        expect(relativeTime(new Date('2024-06-15T11:57:00.000Z'))).toBe('3 minutes ago')
    })

    it('uses singular for 1 minute', () => {
        expect(relativeTime(new Date('2024-06-15T11:59:00.000Z'))).toBe('1 minute ago')
    })

    it('formats past hours', () => {
        expect(relativeTime(new Date('2024-06-15T10:00:00.000Z'))).toBe('2 hours ago')
    })

    it('uses singular for 1 hour', () => {
        expect(relativeTime(new Date('2024-06-15T11:00:00.000Z'))).toBe('1 hour ago')
    })

    it('formats past days', () => {
        expect(relativeTime(new Date('2024-06-12T12:00:00.000Z'))).toBe('3 days ago')
    })

    it('uses singular for 1 day', () => {
        expect(relativeTime(new Date('2024-06-14T12:00:00.000Z'))).toBe('1 day ago')
    })

    it('formats future seconds', () => {
        expect(relativeTime(new Date('2024-06-15T12:00:30.000Z'))).toBe('in 30 seconds')
    })

    it('formats future minutes', () => {
        expect(relativeTime(new Date('2024-06-15T12:05:00.000Z'))).toBe('in 5 minutes')
    })

    it('formats future hours', () => {
        expect(relativeTime(new Date('2024-06-15T14:00:00.000Z'))).toBe('in 2 hours')
    })

    it('formats future days', () => {
        expect(relativeTime(new Date('2024-06-18T12:00:00.000Z'))).toBe('in 3 days')
    })

    it('accepts a numeric timestamp', () => {
        const ts = new Date('2024-06-15T11:57:00.000Z').getTime()
        expect(relativeTime(ts)).toBe('3 minutes ago')
    })

})
