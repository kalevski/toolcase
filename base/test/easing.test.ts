import { describe, it, expect } from 'vitest'
import Easing, {
    easeInSine, easeOutSine, easeInOutSine,
    easeInQuad, easeOutQuad, easeInOutQuad,
    easeInCubic, easeOutCubic, easeInOutCubic,
    easeInQuart, easeOutQuart, easeInOutQuart,
    easeInQuint, easeOutQuint, easeInOutQuint,
    easeInExpo, easeOutExpo, easeInOutExpo,
    easeInCirc, easeOutCirc, easeInOutCirc,
    easeInBack, easeOutBack, easeInOutBack,
    easeInElastic, easeOutElastic, easeInOutElastic,
    easeInBounce, easeOutBounce, easeInOutBounce,
    cubicBezier
} from '../src/easing'

const ALL_FUNS = [
    easeInSine, easeOutSine, easeInOutSine,
    easeInQuad, easeOutQuad, easeInOutQuad,
    easeInCubic, easeOutCubic, easeInOutCubic,
    easeInQuart, easeOutQuart, easeInOutQuart,
    easeInQuint, easeOutQuint, easeInOutQuint,
    easeInExpo, easeOutExpo, easeInOutExpo,
    easeInCirc, easeOutCirc, easeInOutCirc,
    easeInBack, easeOutBack, easeInOutBack,
    easeInElastic, easeOutElastic, easeInOutElastic,
    easeInBounce, easeOutBounce, easeInOutBounce,
]

describe('easing endpoints', () => {

    it('all functions map 0 → 0', () => {
        for (const fn of ALL_FUNS) {
            expect(fn(0)).toBeCloseTo(0, 9)
        }
    })

    it('all functions map 1 → 1', () => {
        for (const fn of ALL_FUNS) {
            expect(fn(1)).toBeCloseTo(1, 9)
        }
    })

})

describe('easeIn families', () => {

    it('easeInQuad matches t^2', () => {
        expect(easeInQuad(0.5)).toBeCloseTo(0.25, 9)
    })

    it('easeInCubic matches t^3', () => {
        expect(easeInCubic(0.5)).toBeCloseTo(0.125, 9)
    })

    it('easeInExpo is 0 at t=0 and 1 at t=1 (exact)', () => {
        expect(easeInExpo(0)).toBe(0)
        expect(easeInExpo(1)).toBe(1)
    })

    it('easeInElastic is 0 at t=0 and 1 at t=1 (exact)', () => {
        expect(easeInElastic(0)).toBe(0)
        expect(easeInElastic(1)).toBe(1)
    })

    it('easeInBounce midpoint is less than 0.5 (ease-in shape)', () => {
        expect(easeInBounce(0.5)).toBeLessThan(0.5)
    })

})

describe('easeOut families', () => {

    it('easeOutQuad midpoint is greater than 0.5 (ease-out shape)', () => {
        expect(easeOutQuad(0.5)).toBeGreaterThan(0.5)
    })

    it('easeOutExpo is 0 at t=0 and 1 at t=1 (exact)', () => {
        expect(easeOutExpo(0)).toBeCloseTo(0, 9)
        expect(easeOutExpo(1)).toBe(1)
    })

    it('easeOutBounce produces a bounce sequence', () => {
        const v1 = easeOutBounce(0.2)
        const v2 = easeOutBounce(0.5)
        const v3 = easeOutBounce(0.9)
        expect(v3).toBeGreaterThan(v2)
        expect(v2).toBeGreaterThan(v1)
    })

})

describe('easeInOut families', () => {

    it('easeInOutQuad is symmetric around 0.5', () => {
        expect(easeInOutQuad(0.5)).toBeCloseTo(0.5, 9)
    })

    it('easeInOutSine is symmetric around 0.5', () => {
        expect(easeInOutSine(0.5)).toBeCloseTo(0.5, 9)
    })

    it('easeInOutElastic is 0 at t=0 and 1 at t=1 (exact)', () => {
        expect(easeInOutElastic(0)).toBe(0)
        expect(easeInOutElastic(1)).toBe(1)
    })

    it('easeInOutBounce midpoint is 0.5', () => {
        expect(easeInOutBounce(0.5)).toBeCloseTo(0.5, 9)
    })

})

describe('cubicBezier', () => {

    it('maps 0 → 0 and 1 → 1 for any control points', () => {
        const ease = cubicBezier(0.25, 0.1, 0.25, 1)
        expect(ease(0)).toBe(0)
        expect(ease(1)).toBe(1)
    })

    it('linear case (0,0,1,1) approximates identity', () => {
        const linear = cubicBezier(0, 0, 1, 1)
        expect(linear(0.5)).toBeCloseTo(0.5, 4)
        expect(linear(0.25)).toBeCloseTo(0.25, 4)
        expect(linear(0.75)).toBeCloseTo(0.75, 4)
    })

    it('ease-in case produces values below linear at midpoint', () => {
        const easeIn = cubicBezier(0.42, 0, 1, 1)
        expect(easeIn(0.5)).toBeLessThan(0.5)
    })

    it('ease-out case produces values above linear at midpoint', () => {
        const easeOut = cubicBezier(0, 0, 0.58, 1)
        expect(easeOut(0.5)).toBeGreaterThan(0.5)
    })

    it('clamps inputs outside [0, 1]', () => {
        const fn = cubicBezier(0.25, 0.1, 0.25, 1)
        expect(fn(-0.5)).toBe(0)
        expect(fn(1.5)).toBe(1)
    })

})

describe('Easing namespace', () => {

    it('exports all 30 easing functions', () => {
        expect(typeof Easing.easeInSine).toBe('function')
        expect(typeof Easing.easeOutBounce).toBe('function')
        expect(typeof Easing.easeInOutElastic).toBe('function')
    })

    it('namespace functions match named exports', () => {
        expect(Easing.easeInQuad).toBe(easeInQuad)
        expect(Easing.cubicBezier).toBe(cubicBezier)
    })

})
