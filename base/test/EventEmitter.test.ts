import { describe, it, expect, vi } from 'vitest'
import EventEmitter from '../src/EventEmitter'

describe('EventEmitter', () => {
    it('emits to registered listeners with args', () => {
        const ee = new EventEmitter()
        const fn = vi.fn()
        ee.on('hit', fn)
        ee.emit('hit', 1, 2)
        expect(fn).toHaveBeenCalledWith(1, 2)
    })

    it('returns false when emitting unknown event', () => {
        const ee = new EventEmitter()
        expect(ee.emit('nope')).toBe(false)
    })

    it('once fires only once and removes itself', () => {
        const ee = new EventEmitter()
        const fn = vi.fn()
        ee.once('boot', fn)
        ee.emit('boot')
        ee.emit('boot')
        expect(fn).toHaveBeenCalledTimes(1)
        expect(ee.listenerCount('boot')).toBe(0)
    })

    it('binds context default to emitter', () => {
        const ee = new EventEmitter()
        const captured: any[] = []
        ee.on('x', function(this: any) { captured.push(this) })
        ee.emit('x')
        expect(captured[0]).toBe(ee)
    })

    it('binds custom context', () => {
        const ee = new EventEmitter()
        const ctx = { tag: 'custom' }
        const captured: any[] = []
        ee.on('x', function(this: any) { captured.push(this) }, ctx)
        ee.emit('x')
        expect(captured[0]).toBe(ctx)
    })

    it('off removes all listeners with matching fn when context omitted', () => {
        const ee = new EventEmitter()
        const fn = vi.fn()
        const a = { id: 'a' }
        const b = { id: 'b' }
        ee.on('e', fn, a)
        ee.on('e', fn, b)
        ee.off('e', fn)
        expect(ee.listenerCount('e')).toBe(0)
    })

    it('off removes only listeners with matching fn AND context when context provided', () => {
        const ee = new EventEmitter()
        const fn = vi.fn()
        const a = { id: 'a' }
        const b = { id: 'b' }
        ee.on('e', fn, a)
        ee.on('e', fn, b)
        ee.off('e', fn, a)
        expect(ee.listenerCount('e')).toBe(1)
        ee.emit('e')
        expect(fn).toHaveBeenCalledTimes(1)
        expect(fn.mock.instances[0]).toBe(b)
    })

    it('off without fn deletes the entire event', () => {
        const ee = new EventEmitter()
        ee.on('e', () => {})
        ee.on('e', () => {})
        ee.off('e')
        expect(ee.listenerCount('e')).toBe(0)
    })

    it('removeAllListeners clears all events when no arg', () => {
        const ee = new EventEmitter()
        ee.on('a', () => {})
        ee.on('b', () => {})
        ee.removeAllListeners()
        expect(ee.eventNames()).toEqual([])
    })

    it('eventNames lists unique events', () => {
        const ee = new EventEmitter()
        ee.on('a', () => {})
        ee.on('b', () => {})
        expect(ee.eventNames().sort()).toEqual(['a', 'b'])
    })

    it('multiple once listeners all fire once and leave listenerCount 0', () => {
        const ee = new EventEmitter()
        const calls: number[] = []
        ee.once('go', () => calls.push(1))
        ee.once('go', () => calls.push(2))
        ee.once('go', () => calls.push(3))
        ee.emit('go')
        expect(calls).toEqual([1, 2, 3])
        expect(ee.listenerCount('go')).toBe(0)
        ee.emit('go')
        expect(calls).toEqual([1, 2, 3])
    })

    it('emit snapshot prevents skipped listeners when off mid-emit', () => {
        const ee = new EventEmitter()
        const calls: string[] = []
        const second = () => calls.push('second')
        ee.on('e', () => {
            calls.push('first')
            ee.off('e', second)
        })
        ee.on('e', second)
        ee.emit('e')
        expect(calls).toEqual(['first', 'second'])
    })
})
