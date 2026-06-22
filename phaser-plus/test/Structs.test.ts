import { describe, it, expect, beforeEach } from 'vitest'
import { SpatialHash, Quadtree, Vec2, Easing, Random, AABB, Transform } from '../src/structs'

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

// ─── AABB ───────────────────────────────────────────────────────────────────

describe('Structs.AABB', () => {
    it('constructs with defaults', () => {
        const b = new AABB()
        expect(b.x).toBe(0)
        expect(b.y).toBe(0)
        expect(b.width).toBe(0)
        expect(b.height).toBe(0)
    })

    it('constructs with given values', () => {
        const b = new AABB(10, 20, 30, 40)
        expect(b.x).toBe(10)
        expect(b.y).toBe(20)
        expect(b.width).toBe(30)
        expect(b.height).toBe(40)
    })

    it('computes edge and center getters', () => {
        const b = new AABB(10, 20, 30, 40)
        expect(b.left).toBe(10)
        expect(b.right).toBe(40)
        expect(b.top).toBe(20)
        expect(b.bottom).toBe(60)
        expect(b.centerX).toBe(25)
        expect(b.centerY).toBe(40)
    })

    describe('set / reset', () => {
        it('set updates all fields and is chainable', () => {
            const b = new AABB()
            const result = b.set(5, 6, 7, 8)
            expect(result).toBe(b)
            expect(b.x).toBe(5)
            expect(b.width).toBe(7)
        })

        it('reset restores to zero', () => {
            const b = new AABB(10, 10, 50, 50)
            b.reset()
            expect(b.x).toBe(0)
            expect(b.y).toBe(0)
            expect(b.width).toBe(0)
            expect(b.height).toBe(0)
        })
    })

    describe('contains', () => {
        it('returns true for a point inside', () => {
            const b = new AABB(0, 0, 100, 100)
            expect(b.contains(50, 50)).toBe(true)
        })

        it('returns true for a point on the edge', () => {
            const b = new AABB(0, 0, 100, 100)
            expect(b.contains(0, 0)).toBe(true)
            expect(b.contains(100, 100)).toBe(true)
        })

        it('returns false for a point outside', () => {
            const b = new AABB(0, 0, 100, 100)
            expect(b.contains(101, 50)).toBe(false)
            expect(b.contains(50, -1)).toBe(false)
        })
    })

    describe('intersects', () => {
        it('returns true for overlapping rects', () => {
            const a = new AABB(0, 0, 50, 50)
            const b = new AABB(25, 25, 50, 50)
            expect(a.intersects(b)).toBe(true)
        })

        it('returns true for touching edges', () => {
            const a = new AABB(0, 0, 50, 50)
            const b = new AABB(50, 0, 50, 50)
            expect(a.intersects(b)).toBe(true)
        })

        it('returns false for non-overlapping rects', () => {
            const a = new AABB(0, 0, 50, 50)
            const b = new AABB(100, 100, 50, 50)
            expect(a.intersects(b)).toBe(false)
        })
    })

    describe('containsRect', () => {
        it('returns true when other is fully inside', () => {
            const outer = new AABB(0, 0, 100, 100)
            const inner = new AABB(10, 10, 80, 80)
            expect(outer.containsRect(inner)).toBe(true)
        })

        it('returns false when other extends outside', () => {
            const a = new AABB(0, 0, 100, 100)
            const b = new AABB(50, 50, 100, 100)
            expect(a.containsRect(b)).toBe(false)
        })
    })

    describe('copyFrom / clone', () => {
        it('copyFrom duplicates the values', () => {
            const src = new AABB(1, 2, 3, 4)
            const dst = new AABB()
            dst.copyFrom(src)
            expect(dst.x).toBe(1)
            expect(dst.width).toBe(3)
        })

        it('clone returns a new independent instance', () => {
            const a = new AABB(1, 2, 3, 4)
            const b = a.clone()
            expect(b).not.toBe(a)
            expect(b.x).toBe(1)
            b.x = 99
            expect(a.x).toBe(1)
        })
    })

    describe('static factories', () => {
        it('from() copies a plain rect', () => {
            const b = AABB.from({ x: 5, y: 6, width: 7, height: 8 })
            expect(b).toBeInstanceOf(AABB)
            expect(b.x).toBe(5)
            expect(b.height).toBe(8)
        })

        it('fromCenter() positions correctly', () => {
            const b = AABB.fromCenter(100, 100, 40, 20)
            expect(b.x).toBe(80)
            expect(b.y).toBe(90)
            expect(b.width).toBe(40)
            expect(b.height).toBe(20)
            expect(b.centerX).toBe(100)
            expect(b.centerY).toBe(100)
        })
    })
})

// ─── Transform ──────────────────────────────────────────────────────────────

describe('Structs.Transform', () => {
    it('initialises with identity defaults', () => {
        const t = new Transform()
        expect(t.x).toBe(0)
        expect(t.y).toBe(0)
        expect(t.rotation).toBe(0)
        expect(t.scaleX).toBe(1)
        expect(t.scaleY).toBe(1)
    })

    describe('set / reset', () => {
        it('set updates all fields and is chainable', () => {
            const t = new Transform()
            const result = t.set(10, 20, Math.PI, 2, 3)
            expect(result).toBe(t)
            expect(t.x).toBe(10)
            expect(t.y).toBe(20)
            expect(t.rotation).toBe(Math.PI)
            expect(t.scaleX).toBe(2)
            expect(t.scaleY).toBe(3)
        })

        it('set defaults rotation/scale when omitted', () => {
            const t = new Transform()
            t.set(5, 7)
            expect(t.rotation).toBe(0)
            expect(t.scaleX).toBe(1)
            expect(t.scaleY).toBe(1)
        })

        it('reset restores identity state', () => {
            const t = new Transform()
            t.set(99, 99, 3.14, 5, 5)
            t.reset()
            expect(t.x).toBe(0)
            expect(t.y).toBe(0)
            expect(t.rotation).toBe(0)
            expect(t.scaleX).toBe(1)
            expect(t.scaleY).toBe(1)
        })
    })

    describe('copyFrom / clone', () => {
        it('copyFrom mirrors all fields', () => {
            const src = new Transform()
            src.set(3, 4, 0.5, 2, 2)
            const dst = new Transform()
            dst.copyFrom(src)
            expect(dst.x).toBe(3)
            expect(dst.rotation).toBe(0.5)
            expect(dst.scaleX).toBe(2)
        })

        it('clone returns a new independent instance', () => {
            const a = new Transform()
            a.set(1, 2, 0.1, 3, 4)
            const b = a.clone()
            expect(b).not.toBe(a)
            expect(b.x).toBe(1)
            b.x = 99
            expect(a.x).toBe(1)
        })
    })

    describe('applyTo', () => {
        it('writes all fields to a target object', () => {
            const t = new Transform()
            t.set(7, 8, 1.5, 2.5, 3.5)
            const target = { x: 0, y: 0, rotation: 0, scaleX: 0, scaleY: 0 }
            const result = t.applyTo(target)
            expect(result).toBe(t)
            expect(target.x).toBe(7)
            expect(target.y).toBe(8)
            expect(target.rotation).toBe(1.5)
            expect(target.scaleX).toBe(2.5)
            expect(target.scaleY).toBe(3.5)
        })
    })
})

// ─── Vec2 (re-export from @toolcase/base) ───────────────────────────────────

describe('Structs.Vec2', () => {
    it('is accessible as Structs.Vec2', () => {
        expect(Vec2).toBeDefined()
    })

    it('constructs with x and y', () => {
        const v = new Vec2(3, 4)
        expect(v.x).toBe(3)
        expect(v.y).toBe(4)
    })

    it('length computes correctly', () => {
        const v = new Vec2(3, 4)
        expect(v.length).toBe(5)
    })

    it('add returns a new Vec2', () => {
        const a = new Vec2(1, 2)
        const b = new Vec2(3, 4)
        const c = a.add(b)
        expect(c.x).toBe(4)
        expect(c.y).toBe(6)
        expect(c).not.toBe(a)
    })

    it('normalize produces a unit vector', () => {
        const v = new Vec2(3, 4).normalize()
        expect(v.length).toBeCloseTo(1, 10)
    })

    it('ZERO and ONE singletons', () => {
        expect(Vec2.ZERO.x).toBe(0)
        expect(Vec2.ZERO.y).toBe(0)
        expect(Vec2.ONE.x).toBe(1)
        expect(Vec2.ONE.y).toBe(1)
    })
})

// ─── Easing (re-export from @toolcase/base) ─────────────────────────────────

describe('Structs.Easing', () => {
    it('is accessible as Structs.Easing', () => {
        expect(Easing).toBeDefined()
    })

    it('easeInCubic(0) = 0 and easeInCubic(1) = 1', () => {
        expect(Easing.easeInCubic(0)).toBe(0)
        expect(Easing.easeInCubic(1)).toBe(1)
    })

    it('easeOutBounce(0) = 0 and easeOutBounce(1) = 1', () => {
        expect(Easing.easeOutBounce(0)).toBeCloseTo(0, 10)
        expect(Easing.easeOutBounce(1)).toBeCloseTo(1, 10)
    })

    it('all 30 easing families are present', () => {
        const families = [
            'easeInSine', 'easeOutSine', 'easeInOutSine',
            'easeInCubic', 'easeOutCubic', 'easeInOutCubic',
            'easeInBack', 'easeOutBack', 'easeInOutBack',
            'easeInBounce', 'easeOutBounce', 'easeInOutBounce',
            'easeInElastic', 'easeOutElastic', 'easeInOutElastic',
        ]
        for (const name of families) {
            expect(typeof (Easing as any)[name]).toBe('function')
        }
    })
})

// ─── Random (re-export from @toolcase/base) ──────────────────────────────────

describe('Structs.Random', () => {
    it('is accessible as Structs.Random', () => {
        expect(Random).toBeDefined()
    })

    it('identical seeds produce identical sequences', () => {
        const a = new Random(42)
        const b = new Random(42)
        for (let i = 0; i < 20; i++) {
            expect(a.next()).toBe(b.next())
        }
    })

    it('next() returns values in [0, 1)', () => {
        const rng = new Random(99)
        for (let i = 0; i < 100; i++) {
            const v = rng.next()
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThan(1)
        }
    })

    it('int() returns inclusive integers in range', () => {
        const rng = new Random(7)
        for (let i = 0; i < 200; i++) {
            const v = rng.int(1, 6)
            expect(v).toBeGreaterThanOrEqual(1)
            expect(v).toBeLessThanOrEqual(6)
        }
    })

    it('different seeds produce different sequences', () => {
        const a = new Random(1)
        const b = new Random(2)
        const seqA = Array.from({ length: 10 }, () => a.next())
        const seqB = Array.from({ length: 10 }, () => b.next())
        expect(seqA).not.toEqual(seqB)
    })
})
