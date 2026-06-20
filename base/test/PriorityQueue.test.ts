import { describe, it, expect } from 'vitest'
import PriorityQueue from '../src/PriorityQueue'

describe('PriorityQueue', () => {
    it('throws if priorityFn is not a function', () => {
        expect(() => new PriorityQueue(null)).toThrow('priorityFn is required')
    })

    it('enqueues and dequeues in priority order (min-heap)', () => {
        const pq = new PriorityQueue(n => n)
        pq.enqueue(5)
        pq.enqueue(1)
        pq.enqueue(3)
        expect(pq.dequeue()).toBe(1)
        expect(pq.dequeue()).toBe(3)
        expect(pq.dequeue()).toBe(5)
    })

    it('reports correct length', () => {
        const pq = new PriorityQueue(n => n)
        expect(pq.length).toBe(0)
        pq.enqueue(1)
        pq.enqueue(2)
        expect(pq.length).toBe(2)
        pq.dequeue()
        expect(pq.length).toBe(1)
    })

    it('dequeue returns null when empty and leaves no stray -1 key', () => {
        const pq = new PriorityQueue(n => n)
        expect(pq.dequeue()).toBeNull()
        expect((pq as any).values['-1']).toBeUndefined()
        expect(Object.prototype.hasOwnProperty.call((pq as any).values, '-1')).toBe(false)
    })

    it('pop removes last element', () => {
        const pq = new PriorityQueue(n => n)
        pq.enqueue(1)
        pq.enqueue(10)
        pq.enqueue(5)
        const popped = pq.pop()
        expect(pq.length).toBe(2)
        expect(typeof popped).toBe('number')
    })

    it('has() works with uniqueFn', () => {
        const pq = new PriorityQueue(n => n.priority, n => n.id)
        pq.enqueue({ id: 'a', priority: 1 })
        pq.enqueue({ id: 'b', priority: 2 })
        expect(pq.has({ id: 'a' })).toBe(true)
        expect(pq.has({ id: 'c' })).toBe(false)
    })

    it('has() remains true after dequeuing one of two duplicate-key items', () => {
        const pq = new PriorityQueue<{ id: string; priority: number }>(n => n.priority, n => n.id)
        const a1 = { id: 'dup', priority: 1 }
        const a2 = { id: 'dup', priority: 2 }
        pq.enqueue(a1)
        pq.enqueue(a2)
        pq.dequeue()
        expect(pq.has({ id: 'dup', priority: 0 })).toBe(true)
        pq.dequeue()
        expect(pq.has({ id: 'dup', priority: 0 })).toBe(false)
    })

    it('has() returns null without uniqueFn', () => {
        const pq = new PriorityQueue(n => n)
        pq.enqueue(1)
        expect(pq.has(1)).toBeNull()
    })

    it('throws on enqueue undefined', () => {
        const pq = new PriorityQueue(n => n)
        expect(() => pq.enqueue(undefined)).toThrow('value can not be undefined')
    })

    it('handles objects with priority', () => {
        const pq = new PriorityQueue(n => n.cost)
        pq.enqueue({ name: 'c', cost: 30 })
        pq.enqueue({ name: 'a', cost: 10 })
        pq.enqueue({ name: 'b', cost: 20 })
        expect(pq.dequeue().name).toBe('a')
        expect(pq.dequeue().name).toBe('b')
        expect(pq.dequeue().name).toBe('c')
    })
})
