import { describe, it, expect } from 'vitest'
import Mutex from '../../src/async/Mutex'

describe('Mutex', () => {

    it('locked is false initially', () => {
        const m = new Mutex()
        expect(m.locked).toBe(false)
    })

    it('acquire returns a release function and sets locked', async () => {
        const m = new Mutex()
        const release = await m.acquire()
        expect(m.locked).toBe(true)
        expect(typeof release).toBe('function')
        release()
        expect(m.locked).toBe(false)
    })

    it('calling release twice is a no-op', async () => {
        const m = new Mutex()
        const release = await m.acquire()
        release()
        release()
        expect(m.locked).toBe(false)
    })

    it('second acquire blocks until first is released', async () => {
        const m = new Mutex()
        const release = await m.acquire()
        let secondAcquired = false
        const p = m.acquire().then(r => { secondAcquired = true; r() })
        expect(secondAcquired).toBe(false)
        release()
        await p
        expect(secondAcquired).toBe(true)
    })

    it('run() executes fn exclusively and returns its result', async () => {
        const m = new Mutex()
        const result = await m.run(() => 'ok')
        expect(result).toBe('ok')
    })

    it('run() releases even when fn throws', async () => {
        const m = new Mutex()
        await expect(m.run(() => { throw new Error('oops') })).rejects.toThrow('oops')
        expect(m.locked).toBe(false)
    })

})
