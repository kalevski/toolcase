import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import withTimeout from '../../src/async/withTimeout'
import retry from '../../src/retry'

describe('withTimeout', () => {

    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('throws synchronously when ms <= 0', () => {
        expect(() => withTimeout(() => Promise.resolve(), 0)).toThrow('ms must be greater than 0')
        expect(() => withTimeout(() => Promise.resolve(), -1)).toThrow('ms must be greater than 0')
    })

    it('resolves when fn settles before the timeout', async () => {
        const p = withTimeout(() => Promise.resolve(42), 100)
        await vi.runAllTimersAsync()
        await expect(p).resolves.toBe(42)
    })

    it('rejects with a timeout error when fn takes too long', async () => {
        const slow = () => new Promise<void>(resolve => setTimeout(resolve, 500))
        const p = withTimeout(slow, 100)
        const assertion = expect(p).rejects.toThrow('timed out after 100ms')
        await vi.advanceTimersByTimeAsync(200)
        await assertion
    })

    it('propagates fn rejection before timeout', async () => {
        const p = withTimeout(() => Promise.reject(new Error('nope')), 100)
        const assertion = expect(p).rejects.toThrow('nope')
        await vi.runAllTimersAsync()
        await assertion
    })

    it('composes with retry — retries on timeout', async () => {
        let calls = 0
        const p = retry(
            () => {
                calls++
                return withTimeout(
                    () => new Promise<string>(resolve => setTimeout(() => resolve('ok'), calls >= 2 ? 0 : 500)),
                    100
                )
            },
            { retries: 3, minTimeout: 1, factor: 1 }
        )
        await vi.runAllTimersAsync()
        await expect(p).resolves.toBe('ok')
        expect(calls).toBeGreaterThanOrEqual(2)
    })

    it('works with a synchronous fn', async () => {
        const p = withTimeout(() => 'sync', 100)
        await vi.runAllTimersAsync()
        await expect(p).resolves.toBe('sync')
    })

})
