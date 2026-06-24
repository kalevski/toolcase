import { describe, it, expect } from 'vitest'
import Deferred from '../../src/async/Deferred'

describe('Deferred', () => {

    it('resolve settles the promise with the given value', async () => {
        const d = new Deferred<number>()
        d.resolve(42)
        await expect(d.promise).resolves.toBe(42)
    })

    it('reject settles the promise with the given reason', async () => {
        const d = new Deferred<string>()
        d.reject(new Error('boom'))
        await expect(d.promise).rejects.toThrow('boom')
    })

    it('calling resolve multiple times only settles once', async () => {
        const d = new Deferred<number>()
        d.resolve(1)
        d.resolve(2)
        await expect(d.promise).resolves.toBe(1)
    })

    it('resolve after reject has no effect', async () => {
        const d = new Deferred<number>()
        d.reject(new Error('first'))
        d.resolve(99)
        await expect(d.promise).rejects.toThrow('first')
    })

    it('exposes promise as a readonly property', () => {
        const d = new Deferred<void>()
        expect(d.promise).toBeInstanceOf(Promise)
    })

})
