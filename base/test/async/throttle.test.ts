import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import throttle from '../../src/async/throttle'

describe('throttle', () => {

    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('throws when fn is not a function', () => {
        expect(() => throttle(null as any, 100)).toThrow('fn must be a function')
    })

    it('throws when ms is negative', () => {
        expect(() => throttle(() => {}, -1)).toThrow('ms must be a non-negative number')
    })

    it('invokes fn immediately on first call', () => {
        const fn = vi.fn()
        const t = throttle(fn, 100)
        t('first')
        expect(fn).toHaveBeenCalledTimes(1)
        expect(fn).toHaveBeenCalledWith('first')
    })

    it('ignores calls within the wait window (no trailing)', () => {
        const fn = vi.fn()
        const t = throttle(fn, 100)
        t('a')
        vi.advanceTimersByTime(50)
        t('b')
        vi.advanceTimersByTime(10)
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('fires trailing call at end of window', () => {
        const fn = vi.fn()
        const t = throttle(fn, 100)
        t('first')
        vi.advanceTimersByTime(50)
        t('trailing')
        vi.advanceTimersByTime(100)
        expect(fn).toHaveBeenCalledTimes(2)
        expect(fn).toHaveBeenLastCalledWith('trailing')
    })

    it('fires again after the window expires', () => {
        const fn = vi.fn()
        const t = throttle(fn, 100)
        t()
        vi.advanceTimersByTime(100)
        t()
        expect(fn).toHaveBeenCalledTimes(2)
    })

    it('cancel() drops the pending trailing call', () => {
        const fn = vi.fn()
        const t = throttle(fn, 100)
        t('first')
        vi.advanceTimersByTime(50)
        t('trailing')
        t.cancel()
        vi.advanceTimersByTime(100)
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('cancel() is a no-op when nothing is pending', () => {
        const fn = vi.fn()
        const t = throttle(fn, 100)
        expect(() => t.cancel()).not.toThrow()
    })

})
