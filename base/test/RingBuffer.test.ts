import { describe, it, expect } from 'vitest'
import RingBuffer from '../src/RingBuffer'

describe('RingBuffer', () => {

    it('throws if capacity is not a positive integer', () => {
        expect(() => new RingBuffer(0)).toThrow('capacity must be a positive integer')
        expect(() => new RingBuffer(-1)).toThrow('capacity must be a positive integer')
        expect(() => new RingBuffer(1.5)).toThrow('capacity must be a positive integer')
        expect(() => new RingBuffer(NaN as any)).toThrow('capacity must be a positive integer')
    })

    it('exposes capacity and starts empty', () => {
        const rb = new RingBuffer<number>(4)
        expect(rb.capacity).toBe(4)
        expect(rb.size).toBe(0)
    })

    it('peek returns null when empty', () => {
        const rb = new RingBuffer<number>(3)
        expect(rb.peek()).toBeNull()
    })

    it('throws on push undefined', () => {
        const rb = new RingBuffer<number>(3)
        expect(() => rb.push(undefined as any)).toThrow('item can not be undefined')
    })

    it('tracks size up to capacity', () => {
        const rb = new RingBuffer<number>(3)
        rb.push(1)
        expect(rb.size).toBe(1)
        rb.push(2)
        rb.push(3)
        expect(rb.size).toBe(3)
        rb.push(4)
        expect(rb.size).toBe(3)
    })

    it('peek returns oldest item', () => {
        const rb = new RingBuffer<number>(3)
        rb.push(10)
        rb.push(20)
        expect(rb.peek()).toBe(10)
    })

    it('overwrites oldest on overflow and peek reflects new oldest', () => {
        const rb = new RingBuffer<number>(3)
        rb.push(1).push(2).push(3).push(4)
        expect(rb.size).toBe(3)
        expect(rb.peek()).toBe(2)
    })

    it('iterates in insertion order (oldest to newest)', () => {
        const rb = new RingBuffer<number>(4)
        rb.push(1).push(2).push(3)
        expect([...rb]).toEqual([1, 2, 3])
    })

    it('iterates correctly after overflow', () => {
        const rb = new RingBuffer<number>(3)
        rb.push(1).push(2).push(3).push(4).push(5)
        expect([...rb]).toEqual([3, 4, 5])
    })

    it('tail(n) returns last n items in insertion order', () => {
        const rb = new RingBuffer<number>(5)
        rb.push(1).push(2).push(3).push(4).push(5)
        expect(rb.tail(3)).toEqual([3, 4, 5])
        expect(rb.tail(5)).toEqual([1, 2, 3, 4, 5])
    })

    it('tail(n) returns all items when n exceeds size', () => {
        const rb = new RingBuffer<number>(4)
        rb.push(7).push(8)
        expect(rb.tail(10)).toEqual([7, 8])
    })

    it('tail(0) returns empty array', () => {
        const rb = new RingBuffer<number>(4)
        rb.push(1).push(2)
        expect(rb.tail(0)).toEqual([])
    })

    it('tail(n) works correctly after overflow', () => {
        const rb = new RingBuffer<string>(3)
        rb.push('a').push('b').push('c').push('d')
        expect(rb.tail(2)).toEqual(['c', 'd'])
        expect(rb.tail(3)).toEqual(['b', 'c', 'd'])
    })

    it('clear resets size and peek to null', () => {
        const rb = new RingBuffer<number>(3)
        rb.push(1).push(2)
        rb.clear()
        expect(rb.size).toBe(0)
        expect(rb.peek()).toBeNull()
        expect([...rb]).toEqual([])
    })

    it('can be reused after clear', () => {
        const rb = new RingBuffer<number>(3)
        rb.push(1).push(2).push(3)
        rb.clear()
        rb.push(4).push(5)
        expect([...rb]).toEqual([4, 5])
    })

    it('push is chainable', () => {
        const rb = new RingBuffer<number>(5)
        const ref = rb.push(1).push(2).push(3)
        expect(ref).toBe(rb)
    })

    it('handles capacity of 1', () => {
        const rb = new RingBuffer<number>(1)
        rb.push(10)
        expect(rb.peek()).toBe(10)
        rb.push(20)
        expect(rb.peek()).toBe(20)
        expect(rb.size).toBe(1)
        expect([...rb]).toEqual([20])
    })

    it('works with object types', () => {
        const rb = new RingBuffer<{ id: number }>(2)
        rb.push({ id: 1 }).push({ id: 2 }).push({ id: 3 })
        const items = [...rb]
        expect(items).toHaveLength(2)
        expect(items[0].id).toBe(2)
        expect(items[1].id).toBe(3)
    })

})
