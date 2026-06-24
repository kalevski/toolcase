import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import sleep from '../../src/async/sleep'

describe('sleep', () => {

    beforeEach(() => {
        vi.useFakeTimers()
    })

    afterEach(() => {
        vi.useRealTimers()
    })

    it('throws when ms is negative', () => {
        expect(() => sleep(-1)).toThrow('ms must be a non-negative number')
    })

    it('resolves after the given delay', async () => {
        let done = false
        sleep(200).then(() => { done = true })
        expect(done).toBe(false)
        await vi.advanceTimersByTimeAsync(200)
        expect(done).toBe(true)
    })

    it('resolves immediately for ms = 0', async () => {
        const p = sleep(0)
        await vi.runAllTimersAsync()
        await expect(p).resolves.toBeUndefined()
    })

    it('returns a Promise', () => {
        const p = sleep(10)
        expect(p).toBeInstanceOf(Promise)
        vi.runAllTimers()
    })

})
