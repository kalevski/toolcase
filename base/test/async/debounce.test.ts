import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import debounce from '../../src/async/debounce'

describe('debounce', () => {

    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('throws when fn is not a function', () => {
        expect(() => debounce(null as any, 100)).toThrow('fn must be a function')
    })

    it('throws when ms is negative', () => {
        expect(() => debounce(() => {}, -1)).toThrow('ms must be a non-negative number')
    })

    it('calls fn once after the wait expires', () => {
        const fn = vi.fn()
        const d = debounce(fn, 100)
        d()
        d()
        d()
        expect(fn).not.toHaveBeenCalled()
        vi.advanceTimersByTime(100)
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('resets the timer on each call', () => {
        const fn = vi.fn()
        const d = debounce(fn, 100)
        d()
        vi.advanceTimersByTime(50)
        d()
        vi.advanceTimersByTime(50)
        expect(fn).not.toHaveBeenCalled()
        vi.advanceTimersByTime(50)
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('passes the most recent arguments to fn', () => {
        const fn = vi.fn()
        const d = debounce(fn, 100)
        d('a')
        d('b')
        d('c')
        vi.advanceTimersByTime(100)
        expect(fn).toHaveBeenCalledWith('c')
    })

    it('cancel() prevents the pending call', () => {
        const fn = vi.fn()
        const d = debounce(fn, 100)
        d()
        d.cancel()
        vi.advanceTimersByTime(200)
        expect(fn).not.toHaveBeenCalled()
    })

    it('cancel() is a no-op when nothing is pending', () => {
        const fn = vi.fn()
        const d = debounce(fn, 100)
        expect(() => d.cancel()).not.toThrow()
    })

    it('ms = 0 calls fn on the next tick', () => {
        const fn = vi.fn()
        const d = debounce(fn, 0)
        d()
        expect(fn).not.toHaveBeenCalled()
        vi.advanceTimersByTime(0)
        expect(fn).toHaveBeenCalledTimes(1)
    })

})
