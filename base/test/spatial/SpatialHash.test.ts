import { describe, it, expect } from 'vitest'
import SpatialHash from '../../src/spatial/SpatialHash'

describe('SpatialHash', () => {

    it('throws if cellSize is not a positive finite number', () => {
        expect(() => new SpatialHash(0)).toThrow('cellSize must be a positive finite number')
        expect(() => new SpatialHash(-1)).toThrow('cellSize must be a positive finite number')
        expect(() => new SpatialHash(Infinity)).toThrow('cellSize must be a positive finite number')
        expect(() => new SpatialHash(NaN)).toThrow('cellSize must be a positive finite number')
    })

    it('starts empty', () => {
        const sh = new SpatialHash<string>(10)
        expect(sh.size).toBe(0)
    })

    it('inserts and tracks size', () => {
        const sh = new SpatialHash<string>(10)
        sh.insert('a', { x: 0, y: 0, width: 5, height: 5 })
        expect(sh.size).toBe(1)
        sh.insert('b', { x: 15, y: 15, width: 5, height: 5 })
        expect(sh.size).toBe(2)
    })

    it('throws if item is undefined', () => {
        const sh = new SpatialHash<string>(10)
        expect(() => sh.insert(undefined as any, { x: 0, y: 0, width: 1, height: 1 })).toThrow('item can not be undefined')
    })

    it('ignores duplicate inserts', () => {
        const sh = new SpatialHash<string>(10)
        sh.insert('a', { x: 0, y: 0, width: 5, height: 5 })
        sh.insert('a', { x: 0, y: 0, width: 5, height: 5 })
        expect(sh.size).toBe(1)
    })

    it('removes an item and returns true', () => {
        const sh = new SpatialHash<string>(10)
        sh.insert('a', { x: 0, y: 0, width: 5, height: 5 })
        expect(sh.remove('a')).toBe(true)
        expect(sh.size).toBe(0)
    })

    it('returns false when removing non-existent item', () => {
        const sh = new SpatialHash<string>(10)
        expect(sh.remove('x')).toBe(false)
    })

    it('queries items overlapping a rect', () => {
        const sh = new SpatialHash<string>(10)
        sh.insert('a', { x: 0, y: 0, width: 5, height: 5 })
        sh.insert('b', { x: 20, y: 20, width: 5, height: 5 })
        const result = sh.query({ x: 0, y: 0, width: 10, height: 10 })
        expect(result).toContain('a')
        expect(result).not.toContain('b')
    })

    it('query returns no duplicates for items spanning multiple cells', () => {
        const sh = new SpatialHash<string>(10)
        sh.insert('big', { x: 0, y: 0, width: 25, height: 25 })
        const result = sh.query({ x: 0, y: 0, width: 30, height: 30 })
        expect(result.filter(x => x === 'big').length).toBe(1)
    })

    it('query excludes items that share a cell but do not overlap the rect', () => {
        const sh = new SpatialHash<string>(100)
        sh.insert('a', { x: 0, y: 0, width: 10, height: 10 })
        sh.insert('b', { x: 50, y: 50, width: 10, height: 10 })
        const result = sh.query({ x: 0, y: 0, width: 10, height: 10 })
        expect(result).toContain('a')
        expect(result).not.toContain('b')
    })

    it('query returns empty when nothing overlaps', () => {
        const sh = new SpatialHash<string>(10)
        sh.insert('a', { x: 100, y: 100, width: 5, height: 5 })
        expect(sh.query({ x: 0, y: 0, width: 5, height: 5 })).toEqual([])
    })

    it('updates item position', () => {
        const sh = new SpatialHash<string>(10)
        sh.insert('a', { x: 0, y: 0, width: 5, height: 5 })
        sh.update('a', { x: 50, y: 50, width: 5, height: 5 })
        expect(sh.query({ x: 0, y: 0, width: 10, height: 10 })).toEqual([])
        expect(sh.query({ x: 45, y: 45, width: 15, height: 15 })).toContain('a')
        expect(sh.size).toBe(1)
    })

    it('finds the nearest item', () => {
        const sh = new SpatialHash<string>(10)
        sh.insert('near', { x: 5, y: 5, width: 2, height: 2 })
        sh.insert('far', { x: 90, y: 90, width: 2, height: 2 })
        expect(sh.nearest({ x: 0, y: 0 })).toBe('near')
    })

    it('nearest respects maxDist', () => {
        const sh = new SpatialHash<string>(10)
        sh.insert('far', { x: 100, y: 100, width: 2, height: 2 })
        expect(sh.nearest({ x: 0, y: 0 }, 5)).toBeNull()
    })

    it('nearest returns null when empty', () => {
        const sh = new SpatialHash<string>(10)
        expect(sh.nearest({ x: 0, y: 0 })).toBeNull()
    })

    it('nearest returns item when point is inside bounds (distance 0)', () => {
        const sh = new SpatialHash<string>(10)
        sh.insert('wrap', { x: 0, y: 0, width: 50, height: 50 })
        expect(sh.nearest({ x: 25, y: 25 })).toBe('wrap')
    })

    it('clears all items', () => {
        const sh = new SpatialHash<string>(10)
        sh.insert('a', { x: 0, y: 0, width: 5, height: 5 })
        sh.clear()
        expect(sh.size).toBe(0)
        expect(sh.query({ x: 0, y: 0, width: 100, height: 100 })).toEqual([])
    })

    it('clear is chainable', () => {
        const sh = new SpatialHash<string>(10)
        expect(sh.clear()).toBe(sh)
    })

})
