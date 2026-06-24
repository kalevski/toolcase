import { describe, it, expect } from 'vitest'
import Quadtree from '../../src/spatial/Quadtree'

const ROOT = { x: 0, y: 0, width: 100, height: 100 }

describe('Quadtree', () => {

    it('throws if bounds is invalid', () => {
        expect(() => new Quadtree(null as any)).toThrow('bounds is required')
        expect(() => new Quadtree(undefined as any)).toThrow('bounds is required')
    })

    it('throws if capacity is invalid', () => {
        expect(() => new Quadtree(ROOT, 0)).toThrow('capacity must be a positive integer')
        expect(() => new Quadtree(ROOT, -1)).toThrow('capacity must be a positive integer')
        expect(() => new Quadtree(ROOT, Infinity)).toThrow('capacity must be a positive integer')
    })

    it('throws if maxDepth is invalid', () => {
        expect(() => new Quadtree(ROOT, 4, -1)).toThrow('maxDepth must be a non-negative integer')
        expect(() => new Quadtree(ROOT, 4, NaN)).toThrow('maxDepth must be a non-negative integer')
    })

    it('starts empty', () => {
        const qt = new Quadtree<string>(ROOT)
        expect(qt.size).toBe(0)
    })

    it('inserts and tracks size', () => {
        const qt = new Quadtree<string>(ROOT)
        expect(qt.insert('a', { x: 10, y: 10, width: 5, height: 5 })).toBe(true)
        expect(qt.size).toBe(1)
    })

    it('throws if item is undefined', () => {
        const qt = new Quadtree<string>(ROOT)
        expect(() => qt.insert(undefined as any, { x: 0, y: 0, width: 1, height: 1 })).toThrow('item can not be undefined')
    })

    it('returns false for items outside tree bounds', () => {
        const qt = new Quadtree<string>(ROOT)
        expect(qt.insert('out', { x: 200, y: 200, width: 5, height: 5 })).toBe(false)
        expect(qt.size).toBe(0)
    })

    it('ignores duplicate inserts', () => {
        const qt = new Quadtree<string>(ROOT)
        qt.insert('a', { x: 10, y: 10, width: 5, height: 5 })
        expect(qt.insert('a', { x: 10, y: 10, width: 5, height: 5 })).toBe(false)
        expect(qt.size).toBe(1)
    })

    it('removes an item and returns true', () => {
        const qt = new Quadtree<string>(ROOT)
        qt.insert('a', { x: 10, y: 10, width: 5, height: 5 })
        expect(qt.remove('a')).toBe(true)
        expect(qt.size).toBe(0)
    })

    it('returns false when removing non-existent item', () => {
        const qt = new Quadtree<string>(ROOT)
        expect(qt.remove('x')).toBe(false)
    })

    it('queries items overlapping a rect', () => {
        const qt = new Quadtree<string>(ROOT)
        qt.insert('a', { x: 10, y: 10, width: 5, height: 5 })
        qt.insert('b', { x: 80, y: 80, width: 5, height: 5 })
        const result = qt.query({ x: 0, y: 0, width: 30, height: 30 })
        expect(result).toContain('a')
        expect(result).not.toContain('b')
    })

    it('query returns empty when nothing overlaps', () => {
        const qt = new Quadtree<string>(ROOT)
        qt.insert('a', { x: 50, y: 50, width: 5, height: 5 })
        expect(qt.query({ x: 0, y: 0, width: 5, height: 5 })).toEqual([])
    })

    it('subdivides and all items remain findable after overflow', () => {
        const qt = new Quadtree<string>(ROOT, 2)
        for (let i = 0; i < 10; i++) {
            qt.insert(`item${i}`, { x: i * 8, y: 0, width: 4, height: 4 })
        }
        expect(qt.size).toBe(10)
        const all = qt.query({ x: 0, y: 0, width: 100, height: 100 })
        expect(all.length).toBe(10)
    })

    it('items spanning multiple quadrants are still returned by query', () => {
        const qt = new Quadtree<string>(ROOT, 1)
        qt.insert('a', { x: 45, y: 45, width: 10, height: 10 })
        qt.insert('b', { x: 10, y: 10, width: 5, height: 5 })
        const result = qt.query({ x: 40, y: 40, width: 20, height: 20 })
        expect(result).toContain('a')
    })

    it('updates item position', () => {
        const qt = new Quadtree<string>(ROOT)
        qt.insert('a', { x: 5, y: 5, width: 5, height: 5 })
        qt.update('a', { x: 80, y: 80, width: 5, height: 5 })
        expect(qt.query({ x: 0, y: 0, width: 20, height: 20 })).toEqual([])
        expect(qt.query({ x: 75, y: 75, width: 20, height: 20 })).toContain('a')
        expect(qt.size).toBe(1)
    })

    it('finds the nearest item', () => {
        const qt = new Quadtree<string>(ROOT)
        qt.insert('near', { x: 5, y: 5, width: 2, height: 2 })
        qt.insert('far', { x: 80, y: 80, width: 2, height: 2 })
        expect(qt.nearest({ x: 0, y: 0 })).toBe('near')
    })

    it('nearest respects maxDist', () => {
        const qt = new Quadtree<string>(ROOT)
        qt.insert('far', { x: 80, y: 80, width: 5, height: 5 })
        expect(qt.nearest({ x: 0, y: 0 }, 5)).toBeNull()
    })

    it('nearest returns null when empty', () => {
        const qt = new Quadtree<string>(ROOT)
        expect(qt.nearest({ x: 50, y: 50 })).toBeNull()
    })

    it('nearest returns item when point is inside bounds (distance 0)', () => {
        const qt = new Quadtree<string>(ROOT)
        qt.insert('wrap', { x: 20, y: 20, width: 60, height: 60 })
        expect(qt.nearest({ x: 50, y: 50 })).toBe('wrap')
    })

    it('clears all items', () => {
        const qt = new Quadtree<string>(ROOT)
        qt.insert('a', { x: 10, y: 10, width: 5, height: 5 })
        qt.clear()
        expect(qt.size).toBe(0)
        expect(qt.query({ x: 0, y: 0, width: 100, height: 100 })).toEqual([])
    })

    it('clear is chainable', () => {
        const qt = new Quadtree<string>(ROOT)
        expect(qt.clear()).toBe(qt)
    })

    it('allows maxDepth 0 (no subdivision)', () => {
        const qt = new Quadtree<string>(ROOT, 2, 0)
        for (let i = 0; i < 5; i++) {
            qt.insert(`item${i}`, { x: i * 10, y: 0, width: 5, height: 5 })
        }
        expect(qt.size).toBe(5)
        expect(qt.query({ x: 0, y: 0, width: 100, height: 100 }).length).toBe(5)
    })

})
