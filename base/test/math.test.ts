import { describe, it, expect } from 'vitest'
import { clamp, lerp, inverseLerp, mapRange, smoothstep, approximately } from '../src/math'

describe('clamp', () => {

    it('returns value when inside range', () => {
        expect(clamp(5, 0, 10)).toBe(5)
    })

    it('clamps to min when below', () => {
        expect(clamp(-5, 0, 10)).toBe(0)
    })

    it('clamps to max when above', () => {
        expect(clamp(15, 0, 10)).toBe(10)
    })

    it('returns min when value equals min', () => {
        expect(clamp(0, 0, 10)).toBe(0)
    })

    it('returns max when value equals max', () => {
        expect(clamp(10, 0, 10)).toBe(10)
    })

    it('works with negative ranges', () => {
        expect(clamp(-15, -10, -5)).toBe(-10)
        expect(clamp(0, -10, -5)).toBe(-5)
        expect(clamp(-8, -10, -5)).toBe(-8)
    })

    it('works with float values', () => {
        expect(clamp(0.5, 0, 1)).toBe(0.5)
        expect(clamp(1.5, 0, 1)).toBe(1)
        expect(clamp(-0.5, 0, 1)).toBe(0)
    })

})

describe('lerp', () => {

    it('returns a at t=0', () => {
        expect(lerp(10, 20, 0)).toBe(10)
    })

    it('returns b at t=1', () => {
        expect(lerp(10, 20, 1)).toBe(20)
    })

    it('returns midpoint at t=0.5', () => {
        expect(lerp(10, 20, 0.5)).toBe(15)
    })

    it('extrapolates below range when t<0', () => {
        expect(lerp(10, 20, -1)).toBe(0)
    })

    it('extrapolates above range when t>1', () => {
        expect(lerp(10, 20, 2)).toBe(30)
    })

    it('works when a equals b', () => {
        expect(lerp(5, 5, 0.5)).toBe(5)
    })

    it('works with negative values', () => {
        expect(lerp(-10, 10, 0.5)).toBe(0)
    })

})

describe('inverseLerp', () => {

    it('returns 0 when value equals a', () => {
        expect(inverseLerp(0, 10, 0)).toBe(0)
    })

    it('returns 1 when value equals b', () => {
        expect(inverseLerp(0, 10, 10)).toBe(1)
    })

    it('returns 0.5 for midpoint', () => {
        expect(inverseLerp(0, 10, 5)).toBe(0.5)
    })

    it('returns negative t when value is below a', () => {
        expect(inverseLerp(0, 10, -5)).toBe(-0.5)
    })

    it('returns t>1 when value is above b', () => {
        expect(inverseLerp(0, 10, 15)).toBe(1.5)
    })

    it('returns 0 when a equals b', () => {
        expect(inverseLerp(5, 5, 5)).toBe(0)
        expect(inverseLerp(5, 5, 99)).toBe(0)
    })

    it('works with negative ranges', () => {
        expect(inverseLerp(-10, 10, 0)).toBe(0.5)
    })

})

describe('mapRange', () => {

    it('maps a value from one range to another', () => {
        expect(mapRange(5, 0, 10, 0, 100)).toBe(50)
    })

    it('maps the minimum of the input range to the minimum of the output range', () => {
        expect(mapRange(0, 0, 10, 0, 100)).toBe(0)
    })

    it('maps the maximum of the input range to the maximum of the output range', () => {
        expect(mapRange(10, 0, 10, 0, 100)).toBe(100)
    })

    it('maps from small to large scale', () => {
        expect(mapRange(0.5, 0, 1, 0, 200)).toBe(100)
    })

    it('maps from large to small scale', () => {
        expect(mapRange(50, 0, 100, 0, 1)).toBe(0.5)
    })

    it('maps into a negative output range', () => {
        expect(mapRange(5, 0, 10, -100, 100)).toBe(0)
    })

    it('extrapolates when value is outside the input range', () => {
        expect(mapRange(15, 0, 10, 0, 100)).toBe(150)
    })

})

describe('smoothstep', () => {

    it('returns 0 when x <= edge0', () => {
        expect(smoothstep(0, 1, 0)).toBe(0)
        expect(smoothstep(0, 1, -1)).toBe(0)
    })

    it('returns 1 when x >= edge1', () => {
        expect(smoothstep(0, 1, 1)).toBe(1)
        expect(smoothstep(0, 1, 2)).toBe(1)
    })

    it('returns 0.5 at midpoint', () => {
        expect(smoothstep(0, 1, 0.5)).toBe(0.5)
    })

    it('returns value less than linear at t=0.25', () => {
        const s = smoothstep(0, 1, 0.25)
        expect(s).toBeCloseTo(0.15625, 5)
        expect(s).toBeLessThan(0.25)
    })

    it('returns value greater than linear at t=0.75', () => {
        const s = smoothstep(0, 1, 0.75)
        expect(s).toBeCloseTo(0.84375, 5)
        expect(s).toBeGreaterThan(0.75)
    })

    it('is symmetric around the midpoint', () => {
        expect(smoothstep(0, 1, 0.25)).toBeCloseTo(1 - smoothstep(0, 1, 0.75), 10)
    })

    it('works with arbitrary edge values', () => {
        expect(smoothstep(100, 200, 150)).toBe(0.5)
        expect(smoothstep(100, 200, 100)).toBe(0)
        expect(smoothstep(100, 200, 200)).toBe(1)
    })

})

describe('approximately', () => {

    it('returns true for equal values', () => {
        expect(approximately(1, 1)).toBe(true)
    })

    it('returns true when difference is within default epsilon', () => {
        expect(approximately(1, 1 + 1e-8)).toBe(true)
    })

    it('returns false when difference exceeds default epsilon', () => {
        expect(approximately(1, 1 + 1e-6)).toBe(false)
    })

    it('accepts a custom epsilon', () => {
        expect(approximately(1, 1.05, 0.1)).toBe(true)
        expect(approximately(1, 1.15, 0.1)).toBe(false)
    })

    it('is commutative', () => {
        expect(approximately(1.000000001, 1)).toBe(approximately(1, 1.000000001))
    })

    it('works with negative values', () => {
        expect(approximately(-1, -1)).toBe(true)
        expect(approximately(-1, -1 + 1e-8)).toBe(true)
    })

    it('returns false for clearly different values', () => {
        expect(approximately(0, 1)).toBe(false)
        expect(approximately(-1, 1)).toBe(false)
    })

})
