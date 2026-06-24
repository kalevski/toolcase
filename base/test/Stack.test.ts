import { describe, it, expect } from 'vitest'
import Stack from '../src/Stack'

describe('Stack', () => {

    it('throws when pushing undefined', () => {
        const s = new Stack<number>()
        expect(() => s.push(undefined as any)).toThrow('item can not be undefined')
    })

    it('starts empty', () => {
        const s = new Stack<number>()
        expect(s.size).toBe(0)
        expect(s.isEmpty()).toBe(true)
        expect(s.peek()).toBeNull()
        expect(s.pop()).toBeNull()
    })

    it('push and pop in LIFO order', () => {
        const s = new Stack<number>()
        s.push(1).push(2).push(3)
        expect(s.size).toBe(3)
        expect(s.pop()).toBe(3)
        expect(s.pop()).toBe(2)
        expect(s.pop()).toBe(1)
        expect(s.pop()).toBeNull()
    })

    it('peek returns top without removing it', () => {
        const s = new Stack<string>()
        s.push('a').push('b')
        expect(s.peek()).toBe('b')
        expect(s.size).toBe(2)
    })

    it('isEmpty reflects state', () => {
        const s = new Stack<number>()
        expect(s.isEmpty()).toBe(true)
        s.push(1)
        expect(s.isEmpty()).toBe(false)
        s.pop()
        expect(s.isEmpty()).toBe(true)
    })

    it('clear resets the stack', () => {
        const s = new Stack<number>()
        s.push(1).push(2).push(3)
        s.clear()
        expect(s.size).toBe(0)
        expect(s.isEmpty()).toBe(true)
        expect(s.peek()).toBeNull()
    })

    it('push is chainable', () => {
        const s = new Stack<number>()
        const ref = s.push(1).push(2)
        expect(ref).toBe(s)
    })

    it('clear is chainable', () => {
        const s = new Stack<number>()
        s.push(1)
        const ref = s.clear()
        expect(ref).toBe(s)
    })

    it('iterates in insertion order (bottom to top)', () => {
        const s = new Stack<number>()
        s.push(1).push(2).push(3)
        expect([...s]).toEqual([1, 2, 3])
    })

    it('iterator over empty stack yields nothing', () => {
        const s = new Stack<number>()
        expect([...s]).toEqual([])
    })

    it('works with object values', () => {
        const s = new Stack<{ id: number }>()
        s.push({ id: 1 })
        s.push({ id: 2 })
        expect(s.peek()).toEqual({ id: 2 })
        expect(s.pop()).toEqual({ id: 2 })
        expect(s.size).toBe(1)
    })

})
