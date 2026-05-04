import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import retry from '../src/retry'

describe('retry', () => {
    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('returns value on first success', async () => {
        const fn = vi.fn().mockResolvedValue(42)
        await expect(retry(fn)).resolves.toBe(42)
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('retries up to N times then throws', async () => {
        const fn = vi.fn().mockRejectedValue(new Error('nope'))
        const promise = retry(fn, { retries: 2, minTimeout: 1, factor: 1 })
        const assertion = expect(promise).rejects.toThrow('nope')
        await vi.runAllTimersAsync()
        await assertion
        expect(fn).toHaveBeenCalledTimes(3)
    })

    it('clamps factor < 1 to 1 (constant backoff)', async () => {
        const delays: number[] = []
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

        const fn = vi.fn().mockRejectedValue(new Error('fail'))
        const promise = retry(fn, { retries: 3, minTimeout: 100, factor: 0.5 })
        promise.catch(() => {})

        await vi.runAllTimersAsync()
        await promise.catch(() => {})

        for (const call of setTimeoutSpy.mock.calls) {
            const ms = call[1]
            if (typeof ms === 'number') delays.push(ms)
        }

        const backoffDelays = delays.filter(d => d === 100)
        expect(backoffDelays.length).toBe(3)

        setTimeoutSpy.mockRestore()
    })

    it('throws when minTimeout > maxTimeout', async () => {
        await expect(
            retry(() => 1, { minTimeout: 1000, maxTimeout: 100 })
        ).rejects.toThrow(/minTimeout/)
    })

    it('caps backoff at maxTimeout', async () => {
        const setTimeoutSpy = vi.spyOn(global, 'setTimeout')

        const fn = vi.fn().mockRejectedValue(new Error('fail'))
        const promise = retry(fn, { retries: 3, minTimeout: 100, factor: 10, maxTimeout: 200 })
        promise.catch(() => {})

        await vi.runAllTimersAsync()
        await promise.catch(() => {})

        const delays: number[] = []
        for (const call of setTimeoutSpy.mock.calls) {
            const ms = call[1]
            if (typeof ms === 'number') delays.push(ms)
        }

        for (const d of delays) {
            expect(d).toBeLessThanOrEqual(200)
        }

        setTimeoutSpy.mockRestore()
    })
})
