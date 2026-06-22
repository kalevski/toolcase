import { describe, it, expect } from 'vitest'
import formatDuration from '../src/formatDuration'

describe('formatDuration', () => {

    it('returns 0ms for zero', () => {
        expect(formatDuration(0)).toBe('0ms')
    })

    it('returns 0ms for negative input', () => {
        expect(formatDuration(-500)).toBe('0ms')
    })

    it('returns 0ms for NaN', () => {
        expect(formatDuration(NaN)).toBe('0ms')
    })

    it('returns 0ms for Infinity', () => {
        expect(formatDuration(Infinity)).toBe('0ms')
    })

    it('formats sub-second durations', () => {
        expect(formatDuration(500)).toBe('500ms')
        expect(formatDuration(1)).toBe('1ms')
        expect(formatDuration(999)).toBe('999ms')
    })

    it('formats whole seconds', () => {
        expect(formatDuration(1000)).toBe('1s')
        expect(formatDuration(45000)).toBe('45s')
        expect(formatDuration(59000)).toBe('59s')
    })

    it('formats minutes only when no seconds remain', () => {
        expect(formatDuration(60000)).toBe('1m')
        expect(formatDuration(120000)).toBe('2m')
    })

    it('formats minutes and seconds', () => {
        expect(formatDuration(90000)).toBe('1m 30s')
        expect(formatDuration(3661000)).toBe('1h 1m')
    })

    it('formats hours only when no minutes remain', () => {
        expect(formatDuration(3600000)).toBe('1h')
        expect(formatDuration(7200000)).toBe('2h')
    })

    it('formats hours and minutes', () => {
        expect(formatDuration(5400000)).toBe('1h 30m')
    })

    it('formats whole days', () => {
        expect(formatDuration(86400000)).toBe('1d')
        expect(formatDuration(172800000)).toBe('2d')
    })

    it('formats days and hours', () => {
        expect(formatDuration(90000000)).toBe('1d 1h')
    })

    it('floors sub-millisecond values', () => {
        expect(formatDuration(999.9)).toBe('999ms')
    })

})
