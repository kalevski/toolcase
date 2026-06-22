import { describe, it, expect, beforeEach } from 'vitest'
import { SpatialHash, Quadtree } from '../src/structs'

// ─── SpatialHash ────────────────────────────────────────────────────────────

describe('Structs.SpatialHash', () => {
    const CS = 100
    let hash: InstanceType<typeof SpatialHash<string>>

    beforeEach(() => {
        hash = new SpatialHash(CS)
    })

    it('starts empty', () => {
        expect(hash.size).toBe(0)
    })

    it('throws on non-positive cellSize', () => {
        expect(() => new SpatialHash(0)).toThrow()
        expect(() => new SpatialHash(-1)).toThrow()
    })

    describe('insert / remove', () => {
        it('inserts an item and increments size', () => {
            hash.insert('a', { x: 0, y: 0, width: 10, height: 10 })
            expect(hash.size).toBe(1)
        })

        it('ignores a duplicate insert', () => {
            const b = { x: 0, y: 0, width: 10, height: 10 }
            hash.insert('a', b)
            hash.insert('a', b)
            expect(hash.size).toBe(1)
        })

        it('removes an inserted item', () => {
            hash.insert('a', { x: 0, y: 0, width: 10, height: 10 })
            expect(hash.remove('a')).toBe(true)
            expect(hash.size).toBe(0)
        })

        it('returns false when removing an absent item', () => {
            expect(hash.remove('ghost')).toBe(false)
        })
    })

    describe('update', () => {
        it('moves an item to a new position', () => {
            hash.insert('a', { x: 0, y: 0, width: 10, height: 10 })
            hash.update('a', { x: 500, y: 500, width: 10, height: 10 })
            const near = hash.query({ x: 0, y: 0, width: 20, height: 20 })
            expect(near).toHaveLength(0)
            const far = hash.query({ x: 490, y: 490, width: 30, height: 30 })
            expect(far).toContain('a')
        })
    })

    describe('query', () => {
        it('returns overlapping items', () => {
            hash.insert('a', { x: 10, y: 10, width: 20, height: 20 })
            hash.insert('b', { x: 200, y: 200, width: 20, height: 20 })
            const result = hash.query({ x: 0, y: 0, width: 50, height: 50 })
            expect(result).toContain('a')
            expect(result).not.toContain('b')
        })

        it('returns no duplicates when item spans multiple cells', () => {
            // item spans > 1 cell (CS=100, item width=150)
            hash.insert('big', { x: 50, y: 50, width: 150, height: 10 })
            const result = hash.query({ x: 0, y: 0, width: 300, height: 100 })
            expect(result.filter(x => x === 'big')).toHaveLength(1)
        })

        it('returns empty array when nothing overlaps', () => {
            hash.insert('a', { x: 0, y: 0, width: 10, height: 10 })
            expect(hash.query({ x: 500, y: 500, width: 10, height: 10 })).toHaveLength(0)
        })
    })

    describe('nearest', () => {
        it('finds the closest item', () => {
            hash.insert('near', { x: 5, y: 5, width: 10, height: 10 })
            hash.insert('far', { x: 500, y: 500, width: 10, height: 10 })
            expect(hash.nearest({ x: 0, y: 0 })).toBe('near')
        })

        it('returns null when the hash is empty', () => {
            expect(hash.nearest({ x: 0, y: 0 })).toBeNull()
        })

        it('respects maxDist', () => {
            hash.insert('a', { x: 200, y: 200, width: 10, height: 10 })
            expect(hash.nearest({ x: 0, y: 0 }, 50)).toBeNull()
        })

        it('returns item at exact point (distance 0)', () => {
            hash.insert('here', { x: 0, y: 0, width: 50, height: 50 })
            expect(hash.nearest({ x: 25, y: 25 })).toBe('here')
        })
    })

    describe('clear', () => {
        it('removes all items', () => {
            hash.insert('a', { x: 0, y: 0, width: 10, height: 10 })
            hash.insert('b', { x: 50, y: 50, width: 10, height: 10 })
            hash.clear()
            expect(hash.size).toBe(0)
            expect(hash.query({ x: 0, y: 0, width: 200, height: 200 })).toHaveLength(0)
        })

        it('is chainable', () => {
            expect(hash.clear()).toBe(hash)
        })
    })
})

// ─── Quadtree ───────────────────────────────────────────────────────────────

describe('Structs.Quadtree', () => {
    const BOUNDS = { x: 0, y: 0, width: 1000, height: 1000 }
    let qt: InstanceType<typeof Quadtree<string>>

    beforeEach(() => {
        qt = new Quadtree(BOUNDS)
    })

    it('starts empty', () => {
        expect(qt.size).toBe(0)
    })

    it('throws when bounds is null/undefined', () => {
        expect(() => new Quadtree(null as any)).toThrow()
        expect(() => new Quadtree(undefined as any)).toThrow()
    })

    it('throws on invalid capacity', () => {
        expect(() => new Quadtree(BOUNDS, 0)).toThrow()
        expect(() => new Quadtree(BOUNDS, -1)).toThrow()
    })

    it('throws on negative maxDepth', () => {
        expect(() => new Quadtree(BOUNDS, 8, -1)).toThrow()
    })

    describe('insert / remove', () => {
        it('inserts an item and increments size', () => {
            const ok = qt.insert('a', { x: 10, y: 10, width: 10, height: 10 })
            expect(ok).toBe(true)
            expect(qt.size).toBe(1)
        })

        it('returns false for a duplicate insert', () => {
            const b = { x: 10, y: 10, width: 10, height: 10 }
            qt.insert('a', b)
            expect(qt.insert('a', b)).toBe(false)
            expect(qt.size).toBe(1)
        })

        it('returns false for an item outside the root bounds', () => {
            expect(qt.insert('out', { x: 2000, y: 2000, width: 10, height: 10 })).toBe(false)
        })

        it('removes an inserted item', () => {
            qt.insert('a', { x: 10, y: 10, width: 10, height: 10 })
            expect(qt.remove('a')).toBe(true)
            expect(qt.size).toBe(0)
        })

        it('returns false when removing an absent item', () => {
            expect(qt.remove('ghost')).toBe(false)
        })
    })

    describe('update', () => {
        it('moves an item to a new position', () => {
            qt.insert('a', { x: 0, y: 0, width: 10, height: 10 })
            qt.update('a', { x: 800, y: 800, width: 10, height: 10 })
            expect(qt.query({ x: 0, y: 0, width: 20, height: 20 })).not.toContain('a')
            expect(qt.query({ x: 790, y: 790, width: 30, height: 30 })).toContain('a')
        })
    })

    describe('query', () => {
        it('returns items within the query rect', () => {
            qt.insert('a', { x: 10, y: 10, width: 20, height: 20 })
            qt.insert('b', { x: 500, y: 500, width: 20, height: 20 })
            const result = qt.query({ x: 0, y: 0, width: 50, height: 50 })
            expect(result).toContain('a')
            expect(result).not.toContain('b')
        })

        it('triggers subdivision when capacity is exceeded', () => {
            const small = new Quadtree<string>(BOUNDS, 2)
            for (let i = 0; i < 5; i++) {
                small.insert(`item-${i}`, { x: i * 10, y: i * 10, width: 5, height: 5 })
            }
            expect(small.size).toBe(5)
            // all items still found in a full-bounds query
            const all = small.query(BOUNDS)
            expect(all).toHaveLength(5)
        })

        it('returns empty array when nothing overlaps', () => {
            qt.insert('a', { x: 0, y: 0, width: 10, height: 10 })
            expect(qt.query({ x: 800, y: 800, width: 10, height: 10 })).toHaveLength(0)
        })
    })

    describe('nearest', () => {
        it('finds the closest item', () => {
            qt.insert('near', { x: 5, y: 5, width: 10, height: 10 })
            qt.insert('far', { x: 900, y: 900, width: 10, height: 10 })
            expect(qt.nearest({ x: 0, y: 0 })).toBe('near')
        })

        it('returns null when empty', () => {
            expect(qt.nearest({ x: 0, y: 0 })).toBeNull()
        })

        it('respects maxDist', () => {
            qt.insert('a', { x: 500, y: 500, width: 10, height: 10 })
            expect(qt.nearest({ x: 0, y: 0 }, 10)).toBeNull()
        })

        it('returns item when point is inside its bounds (distance 0)', () => {
            qt.insert('here', { x: 0, y: 0, width: 100, height: 100 })
            expect(qt.nearest({ x: 50, y: 50 })).toBe('here')
        })
    })

    describe('clear', () => {
        it('removes all items and preserves root bounds', () => {
            qt.insert('a', { x: 10, y: 10, width: 10, height: 10 })
            qt.clear()
            expect(qt.size).toBe(0)
            expect(qt.query(BOUNDS)).toHaveLength(0)
            // can still insert after clear
            expect(qt.insert('b', { x: 50, y: 50, width: 10, height: 10 })).toBe(true)
        })

        it('is chainable', () => {
            expect(qt.clear()).toBe(qt)
        })
    })
})
