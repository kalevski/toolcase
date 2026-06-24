import { describe, it, expect } from 'vitest'
import Vec2 from '../src/Vec2'

describe('Vec2', () => {

    it('creates with x and y', () => {
        const v = new Vec2(3, 4)
        expect(v.x).toBe(3)
        expect(v.y).toBe(4)
    })

    it('defaults to (0, 0)', () => {
        const v = new Vec2()
        expect(v.x).toBe(0)
        expect(v.y).toBe(0)
    })

    it('ZERO static constant', () => {
        expect(Vec2.ZERO.x).toBe(0)
        expect(Vec2.ZERO.y).toBe(0)
    })

    it('ONE static constant', () => {
        expect(Vec2.ONE.x).toBe(1)
        expect(Vec2.ONE.y).toBe(1)
    })

    it('add returns new Vec2 and does not mutate', () => {
        const a = new Vec2(1, 2)
        const b = new Vec2(3, 4)
        const result = a.add(b)
        expect(result.x).toBe(4)
        expect(result.y).toBe(6)
        expect(result).not.toBe(a)
        expect(a.x).toBe(1)
        expect(a.y).toBe(2)
    })

    it('subtract returns new Vec2', () => {
        const a = new Vec2(5, 7)
        const b = new Vec2(2, 3)
        const result = a.subtract(b)
        expect(result.x).toBe(3)
        expect(result.y).toBe(4)
    })

    it('scale returns new Vec2', () => {
        const v = new Vec2(2, 3)
        const result = v.scale(2)
        expect(result.x).toBe(4)
        expect(result.y).toBe(6)
        expect(result).not.toBe(v)
    })

    it('scale by 0 returns zero vector', () => {
        const result = new Vec2(5, 10).scale(0)
        expect(result.x).toBe(0)
        expect(result.y).toBe(0)
    })

    it('scale by negative factor', () => {
        const result = new Vec2(3, -4).scale(-1)
        expect(result.x).toBe(-3)
        expect(result.y).toBe(4)
    })

    it('dot of perpendicular vectors is 0', () => {
        expect(new Vec2(1, 0).dot(new Vec2(0, 1))).toBe(0)
    })

    it('dot product value', () => {
        expect(new Vec2(2, 3).dot(new Vec2(4, 5))).toBe(23)
    })

    it('dot of parallel unit vectors is 1', () => {
        expect(new Vec2(1, 0).dot(new Vec2(1, 0))).toBe(1)
    })

    it('length of 3-4 vector is 5', () => {
        expect(new Vec2(3, 4).length).toBeCloseTo(5)
    })

    it('length of zero vector is 0', () => {
        expect(new Vec2(0, 0).length).toBe(0)
    })

    it('length of unit vector is 1', () => {
        expect(new Vec2(1, 0).length).toBe(1)
    })

    it('lengthSq avoids sqrt', () => {
        expect(new Vec2(3, 4).lengthSq).toBe(25)
    })

    it('normalize returns unit vector', () => {
        const n = new Vec2(3, 4).normalize()
        expect(n.length).toBeCloseTo(1)
        expect(n.x).toBeCloseTo(0.6)
        expect(n.y).toBeCloseTo(0.8)
    })

    it('normalize of zero vector returns ZERO singleton', () => {
        expect(new Vec2(0, 0).normalize()).toBe(Vec2.ZERO)
    })

    it('lerp at t=0 returns start', () => {
        const a = new Vec2(1, 2)
        const b = new Vec2(5, 6)
        const r = a.lerp(b, 0)
        expect(r.x).toBe(1)
        expect(r.y).toBe(2)
    })

    it('lerp at t=1 returns end', () => {
        const a = new Vec2(1, 2)
        const b = new Vec2(5, 6)
        const r = a.lerp(b, 1)
        expect(r.x).toBe(5)
        expect(r.y).toBe(6)
    })

    it('lerp at t=0.5 returns midpoint', () => {
        const a = new Vec2(0, 0)
        const b = new Vec2(10, 20)
        const mid = a.lerp(b, 0.5)
        expect(mid.x).toBe(5)
        expect(mid.y).toBe(10)
    })

    it('rotate 90° counter-clockwise', () => {
        const r = new Vec2(1, 0).rotate(Math.PI / 2)
        expect(r.x).toBeCloseTo(0)
        expect(r.y).toBeCloseTo(1)
    })

    it('rotate 180°', () => {
        const r = new Vec2(1, 0).rotate(Math.PI)
        expect(r.x).toBeCloseTo(-1)
        expect(r.y).toBeCloseTo(0)
    })

    it('rotate 360° returns original', () => {
        const v = new Vec2(3, 4)
        const r = v.rotate(2 * Math.PI)
        expect(r.x).toBeCloseTo(v.x)
        expect(r.y).toBeCloseTo(v.y)
    })

    it('negate flips both components', () => {
        const n = new Vec2(3, -4).negate()
        expect(n.x).toBe(-3)
        expect(n.y).toBe(4)
    })

    it('negate of zero is zero', () => {
        const n = new Vec2(0, 0).negate()
        expect(n.x).toBe(0)
        expect(n.y).toBe(0)
    })

    it('distanceTo computes Euclidean distance', () => {
        expect(new Vec2(0, 0).distanceTo(new Vec2(3, 4))).toBeCloseTo(5)
    })

    it('distanceTo self is 0', () => {
        const v = new Vec2(7, 13)
        expect(v.distanceTo(v)).toBe(0)
    })

    it('equals returns true for same components', () => {
        expect(new Vec2(1, 2).equals(new Vec2(1, 2))).toBe(true)
    })

    it('equals returns false for different components', () => {
        expect(new Vec2(1, 2).equals(new Vec2(1, 3))).toBe(false)
        expect(new Vec2(1, 2).equals(new Vec2(2, 2))).toBe(false)
    })

    it('toArray returns [x, y] tuple', () => {
        expect(new Vec2(3, 7).toArray()).toEqual([3, 7])
    })

    it('toString', () => {
        expect(new Vec2(1, 2).toString()).toBe('Vec2(1, 2)')
    })

})
