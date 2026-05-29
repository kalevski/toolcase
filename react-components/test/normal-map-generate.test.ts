import { describe, it, expect } from 'vitest'
import {
    toHeightmap,
    alphaToDistance,
    bevelHeightmap,
    blurHeightmap,
    buildHeightmap,
    normalsFromHeight,
    generateNormalMap,
} from '../src/NormalMapGenerator/generate'

const FLAT: [number, number, number] = [128, 128, 255]

/** Solid-alpha RGBA filled with one gray level. */
const solid = (w: number, h: number, level: number, alpha = 255): Uint8ClampedArray => {
    const out = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) {
        out[i * 4] = out[i * 4 + 1] = out[i * 4 + 2] = level
        out[i * 4 + 3] = alpha
    }
    return out
}

describe('toHeightmap', () => {
    it('returns all-zero when embossHeight is 0', () => {
        const h = toHeightmap(solid(2, 2, 200), 2, 2, 0)
        expect(Array.from(h)).toEqual([0, 0, 0, 0])
    })

    it('scales luminance by embossHeight', () => {
        // White → luminance 1 → height === embossHeight.
        const h = toHeightmap(solid(1, 1, 255), 1, 1, 3)
        expect(h[0]).toBeCloseTo(3, 5)
    })
})

describe('alphaToDistance', () => {
    it('marks transparent pixels as distance 0', () => {
        const rgba = solid(3, 3, 255)
        rgba[(1 * 3 + 1) * 4 + 3] = 0 // center transparent
        const dist = alphaToDistance(rgba, 3, 3, false)
        expect(dist[1 * 3 + 1]).toBe(0)
        // Orthogonal neighbour of the hole is 1 px away.
        expect(dist[1 * 3 + 0]).toBeCloseTo(1, 5)
    })

    it('treats the border as a transparent edge when not tiling', () => {
        const dist = alphaToDistance(solid(3, 3, 255), 3, 3, false)
        // Edge pixels are 1 px from the out-of-bounds transparent border; the
        // center is one further orthogonal step in.
        expect(dist[1 * 3 + 0]).toBeCloseTo(1, 5)
        expect(dist[1 * 3 + 1]).toBeCloseTo(2, 5)
    })
})

describe('bevelHeightmap', () => {
    it('returns zero when bevelWidth <= 0', () => {
        const dist = new Float32Array([0, 1, 2, 3])
        expect(Array.from(bevelHeightmap(dist, 2, 2, 0, 1, 'raised'))).toEqual([0, 0, 0, 0])
    })

    it('ramps clamped distance to bevelHeight and flips sign for recessed', () => {
        const dist = new Float32Array([0, 2, 4, 8])
        const raised = bevelHeightmap(dist, 2, 2, 4, 1, 'raised')
        expect(raised[0]).toBeCloseTo(0, 5)
        expect(raised[1]).toBeCloseTo(0.5, 5)
        expect(raised[2]).toBeCloseTo(1, 5)
        expect(raised[3]).toBeCloseTo(1, 5) // clamped at bevelWidth
        const recessed = bevelHeightmap(dist, 2, 2, 4, 1, 'recessed')
        expect(recessed[2]).toBeCloseTo(-1, 5)
    })
})

describe('blurHeightmap', () => {
    it('is a no-op for radius <= 0', () => {
        const h = new Float32Array([0, 4, 0, 4])
        expect(blurHeightmap(h, 2, 2, 0)).toBe(h)
    })

    it('averages a spike toward its neighbours', () => {
        const h = new Float32Array(25)
        h[12] = 25 // center of a 5x5
        blurHeightmap(h, 5, 5, 1)
        // Energy spreads but the total is preserved by a box blur over interior.
        expect(h[12]).toBeLessThan(25)
        expect(h[12]).toBeGreaterThan(0)
        expect(h[11]).toBeGreaterThan(0)
    })
})

describe('normalsFromHeight', () => {
    it('produces a flat up-normal (128,128,255) for a constant heightmap', () => {
        const w = 3
        const h = 3
        const rgba = solid(w, h, 255)
        const out = normalsFromHeight(new Float32Array(w * h), rgba, w, h, {
            strength: 2,
            invertX: false,
            invertY: false,
            flatColor: FLAT,
        })
        const o = (1 * w + 1) * 4
        expect(out[o]).toBe(128)
        expect(out[o + 1]).toBe(128)
        expect(out[o + 2]).toBe(255)
        expect(out[o + 3]).toBe(255)
    })

    it('writes flatColor with alpha 0 for transparent source pixels', () => {
        const w = 1
        const h = 1
        const rgba = solid(w, h, 255, 0)
        const out = normalsFromHeight(new Float32Array(1), rgba, w, h, {
            strength: 2,
            invertX: false,
            invertY: false,
            flatColor: [10, 20, 30],
        })
        expect(Array.from(out)).toEqual([10, 20, 30, 0])
    })

    it('invertX flips the red channel to the opposite side of 128', () => {
        const w = 3
        const h = 3
        const rgba = solid(w, h, 255)
        const height = new Float32Array(w * h)
        // A gentle horizontal gradient so dx is non-zero but the packed red
        // channel stays off the 0/255 clamp rails.
        for (let i = 0; i < w * h; i++) height[i] = (i % w) * 0.05
        const base = normalsFromHeight(height, rgba, w, h, { strength: 1, invertX: false, invertY: false, flatColor: FLAT })
        const inv = normalsFromHeight(height, rgba, w, h, { strength: 1, invertX: true, invertY: false, flatColor: FLAT })
        const o = (1 * w + 1) * 4
        expect(Math.sign(base[o] - 128)).toBe(-Math.sign(inv[o] - 128))
        expect(base[o]).not.toBe(128)
    })

    it('only recomputes the given rect', () => {
        const w = 4
        const h = 4
        const rgba = solid(w, h, 255)
        const height = new Float32Array(w * h)
        for (let i = 0; i < w * h; i++) height[i] = (i % w) * 3
        const out = new Uint8ClampedArray(w * h * 4) // all zero
        normalsFromHeight(height, rgba, w, h, { strength: 2, invertX: false, invertY: false, flatColor: FLAT }, out, {
            x0: 1,
            y0: 1,
            x1: 2,
            y1: 2,
        })
        // Outside the rect stays untouched.
        expect(out[0]).toBe(0)
        // Inside the rect is written.
        expect(out[(1 * w + 1) * 4 + 3]).toBe(255)
    })
})

describe('buildHeightmap + generateNormalMap', () => {
    it('generateNormalMap matches buildHeightmap → normalsFromHeight', () => {
        const w = 4
        const h = 4
        const rgba = solid(w, h, 180)
        rgba[(2 * w + 2) * 4 + 3] = 0 // a hole, to exercise the bevel path
        const opts = {
            strength: 2,
            embossHeight: 2,
            bevelWidth: 2,
            bevelHeight: 1,
            bevelDirection: 'raised' as const,
            tileMode: false,
            blur: 1,
            invertX: false,
            invertY: false,
            flatColor: FLAT,
        }
        const direct = generateNormalMap(rgba, w, h, opts)
        const base = buildHeightmap(rgba, w, h, opts)
        const composed = normalsFromHeight(base, rgba, w, h, opts)
        expect(Array.from(direct)).toEqual(Array.from(composed))
    })
})
