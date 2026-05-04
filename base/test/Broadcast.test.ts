import { describe, it, expect, vi } from 'vitest'
import Broadcast from '../src/Broadcast'

class Channel extends Broadcast {
    fire(event: string, ...args: any[]): boolean {
        return this.emit(event, ...args)
    }
}

describe('Broadcast', () => {
    it('exposes on/off/once/emit through subclass', () => {
        const ch = new Channel()
        const fn = vi.fn()
        ch.on('msg', fn)
        ch.fire('msg', 'hello')
        expect(fn).toHaveBeenCalledWith('hello')
    })

    it('once fires only once', () => {
        const ch = new Channel()
        const fn = vi.fn()
        ch.once('msg', fn)
        ch.fire('msg')
        ch.fire('msg')
        expect(fn).toHaveBeenCalledTimes(1)
    })

    it('off removes specific listener', () => {
        const ch = new Channel()
        const fn = vi.fn()
        ch.on('msg', fn)
        ch.off('msg', fn)
        ch.fire('msg')
        expect(fn).not.toHaveBeenCalled()
    })

    it('listenerCount tracks attached listeners', () => {
        const ch = new Channel()
        ch.on('msg', () => {})
        ch.on('msg', () => {})
        expect(ch.listenerCount('msg')).toBe(2)
    })

    it('removeAllListeners clears every event when no arg', () => {
        const ch = new Channel()
        ch.on('a', () => {})
        ch.on('b', () => {})
        ch.removeAllListeners()
        expect(ch.eventNames()).toEqual([])
    })

    it('emit is protected (not callable from outside)', () => {
        const ch = new Channel()
        expect((ch as any).emit).toBeTypeOf('function')
    })
})
