import { describe, it, expect } from 'vitest'
import Deque from '../src/Deque'

describe('Deque', () => {

    it('throws when pushing undefined via pushFront', () => {
        const d = new Deque<number>()
        expect(() => d.pushFront(undefined as any)).toThrow('item can not be undefined')
    })

    it('throws when pushing undefined via pushBack', () => {
        const d = new Deque<number>()
        expect(() => d.pushBack(undefined as any)).toThrow('item can not be undefined')
    })

    it('starts empty', () => {
        const d = new Deque<number>()
        expect(d.size).toBe(0)
        expect(d.isEmpty()).toBe(true)
        expect(d.peekFront()).toBeNull()
        expect(d.peekBack()).toBeNull()
        expect(d.popFront()).toBeNull()
        expect(d.popBack()).toBeNull()
    })

    it('pushBack and popFront yield FIFO order', () => {
        const d = new Deque<number>()
        d.pushBack(1).pushBack(2).pushBack(3)
        expect(d.popFront()).toBe(1)
        expect(d.popFront()).toBe(2)
        expect(d.popFront()).toBe(3)
        expect(d.popFront()).toBeNull()
    })

    it('pushFront and popFront yield LIFO order', () => {
        const d = new Deque<number>()
        d.pushFront(1).pushFront(2).pushFront(3)
        expect(d.popFront()).toBe(3)
        expect(d.popFront()).toBe(2)
        expect(d.popFront()).toBe(1)
    })

    it('pushBack and popBack yield LIFO order', () => {
        const d = new Deque<number>()
        d.pushBack(1).pushBack(2).pushBack(3)
        expect(d.popBack()).toBe(3)
        expect(d.popBack()).toBe(2)
        expect(d.popBack()).toBe(1)
    })

    it('pushFront prepends correctly', () => {
        const d = new Deque<number>()
        d.pushBack(2).pushBack(3).pushFront(1)
        expect([...d]).toEqual([1, 2, 3])
    })

    it('peekFront returns front without removing', () => {
        const d = new Deque<string>()
        d.pushBack('a').pushBack('b')
        expect(d.peekFront()).toBe('a')
        expect(d.size).toBe(2)
    })

    it('peekBack returns back without removing', () => {
        const d = new Deque<string>()
        d.pushBack('a').pushBack('b')
        expect(d.peekBack()).toBe('b')
        expect(d.size).toBe(2)
    })

    it('size tracks pushFront and pushBack correctly', () => {
        const d = new Deque<number>()
        d.pushFront(1)
        expect(d.size).toBe(1)
        d.pushBack(2)
        expect(d.size).toBe(2)
        d.popFront()
        expect(d.size).toBe(1)
        d.popBack()
        expect(d.size).toBe(0)
    })

    it('isEmpty reflects state', () => {
        const d = new Deque<number>()
        expect(d.isEmpty()).toBe(true)
        d.pushBack(1)
        expect(d.isEmpty()).toBe(false)
        d.popFront()
        expect(d.isEmpty()).toBe(true)
    })

    it('clear resets the deque', () => {
        const d = new Deque<number>()
        d.pushBack(1).pushFront(0).pushBack(2)
        d.clear()
        expect(d.size).toBe(0)
        expect(d.isEmpty()).toBe(true)
        expect(d.peekFront()).toBeNull()
        expect(d.peekBack()).toBeNull()
    })

    it('pushBack is chainable', () => {
        const d = new Deque<number>()
        const ref = d.pushBack(1).pushBack(2)
        expect(ref).toBe(d)
    })

    it('pushFront is chainable', () => {
        const d = new Deque<number>()
        const ref = d.pushFront(1).pushFront(2)
        expect(ref).toBe(d)
    })

    it('clear is chainable', () => {
        const d = new Deque<number>()
        d.pushBack(1)
        const ref = d.clear()
        expect(ref).toBe(d)
    })

    it('iterates front to back', () => {
        const d = new Deque<number>()
        d.pushBack(1).pushBack(2).pushBack(3)
        expect([...d]).toEqual([1, 2, 3])
    })

    it('iterator over empty deque yields nothing', () => {
        const d = new Deque<number>()
        expect([...d]).toEqual([])
    })

    it('single element: peekFront and peekBack agree', () => {
        const d = new Deque<number>()
        d.pushBack(42)
        expect(d.peekFront()).toBe(42)
        expect(d.peekBack()).toBe(42)
        d.popFront()
        expect(d.peekFront()).toBeNull()
        expect(d.peekBack()).toBeNull()
    })

    it('alternating push/pop at both ends maintains integrity', () => {
        const d = new Deque<number>()
        d.pushBack(2)
        d.pushFront(1)
        d.pushBack(3)
        expect([...d]).toEqual([1, 2, 3])
        expect(d.popBack()).toBe(3)
        expect(d.popFront()).toBe(1)
        expect(d.peekFront()).toBe(2)
        expect(d.peekBack()).toBe(2)
        expect(d.size).toBe(1)
    })

})
