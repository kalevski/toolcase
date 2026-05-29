import { describe, it, expect } from 'vitest'
import { pack, unpack, lerp3, applyBrush, STRUCTURE_TILES } from '../src/NormalMapGenerator/brush'
import type { NormalBrush } from '../src/NormalMapGenerator/types'

const FLAT: [number, number, number] = [128, 128, 255]

describe('pack / unpack', () => {
    it('round-trips the flat up-normal', () => {
        const [x, y, z] = unpack(128, 128, 255)
        expect(x).toBeCloseTo(0, 1)
        expect(y).toBeCloseTo(0, 1)
        expect(z).toBeCloseTo(1, 5)
        const [r, g, b] = pack([0, 0, 1])
        expect([Math.round(r), Math.round(g), Math.round(b)]).toEqual([128, 128, 255])
    })

    it('renormalises before packing', () => {
        const [r, g, b] = pack([0, 0, 5]) // non-unit input
        expect([Math.round(r), Math.round(g), Math.round(b)]).toEqual([128, 128, 255])
    })
})

describe('lerp3', () => {
    it('interpolates component-wise', () => {
        expect(lerp3([0, 0, 0], [10, 20, 30], 0.5)).toEqual([5, 10, 15])
        expect(lerp3([1, 2, 3], [4, 5, 6], 0)).toEqual([1, 2, 3])
    })
})

describe('STRUCTURE_TILES', () => {
    it('bakes a 32x32 normal tile per pattern with unit-length normals', () => {
        for (const key of ['reptile', 'furry', 'cracked'] as const) {
            const tile = STRUCTURE_TILES[key]
            expect(tile.w).toBe(32)
            expect(tile.h).toBe(32)
            expect(tile.normals.length).toBe(32 * 32 * 3)
            const len = Math.hypot(tile.normals[0], tile.normals[1], tile.normals[2])
            expect(len).toBeCloseTo(1, 5)
        }
    })
})

describe('applyBrush', () => {
    const setup = (w = 8, h = 8) => {
        const working = new Uint8ClampedArray(w * h * 4)
        const source = new Uint8ClampedArray(w * h * 4)
        for (let i = 0; i < w * h; i++) {
            // flat up-normal working, opaque source
            working[i * 4] = 128
            working[i * 4 + 1] = 128
            working[i * 4 + 2] = 255
            working[i * 4 + 3] = 255
            source[i * 4 + 3] = 255
        }
        const auto = working.slice()
        return { w, h, working, source, auto }
    }

    const genOpts = { strength: 2, invertX: false, invertY: false, flatColor: FLAT }

    it('direction brush rotates the normal toward its target at the center', () => {
        const { w, h, working, source, auto } = setup()
        const brush: NormalBrush = { mode: 'direction', size: 3, hardness: 1, strength: 1, direction: [1, 0, 0] }
        applyBrush({
            working,
            source,
            auto,
            w,
            h,
            cx: 4,
            cy: 4,
            brush,
            maskToAlpha: true,
            combinedHeight: new Float32Array(w * h),
            heightDelta: new Float32Array(w * h),
            genOpts,
        })
        const o = (4 * w + 4) * 4
        // Red channel pushed toward +X (255).
        expect(working[o]).toBeGreaterThan(200)
    })

    it('respects maskToAlpha — transparent source pixels are untouched', () => {
        const { w, h, working, source, auto } = setup()
        source[(4 * w + 4) * 4 + 3] = 0 // hole at center
        const before = working.slice()
        const brush: NormalBrush = { mode: 'direction', size: 3, hardness: 1, strength: 1, direction: [1, 0, 0] }
        applyBrush({
            working,
            source,
            auto,
            w,
            h,
            cx: 4,
            cy: 4,
            brush,
            maskToAlpha: true,
            combinedHeight: new Float32Array(w * h),
            heightDelta: new Float32Array(w * h),
            genOpts,
        })
        const o = (4 * w + 4) * 4
        expect(working[o]).toBe(before[o])
    })

    it('height brush accumulates into the height buffers', () => {
        const { w, h, working, source, auto } = setup()
        const combinedHeight = new Float32Array(w * h)
        const heightDelta = new Float32Array(w * h)
        const brush: NormalBrush = { mode: 'height', size: 3, hardness: 1, strength: 1, heightSign: 1 }
        applyBrush({
            working,
            source,
            auto,
            w,
            h,
            cx: 4,
            cy: 4,
            brush,
            maskToAlpha: true,
            combinedHeight,
            heightDelta,
            genOpts,
        })
        const i = 4 * w + 4
        expect(heightDelta[i]).toBeGreaterThan(0)
        expect(combinedHeight[i]).toBeCloseTo(heightDelta[i], 5)
    })

    it('selection mask of 0 blocks paint', () => {
        const { w, h, working, source, auto } = setup()
        const selection = new Uint8Array(w * h) // all zero → nothing paintable
        const before = working.slice()
        const brush: NormalBrush = { mode: 'direction', size: 3, hardness: 1, strength: 1, direction: [1, 0, 0] }
        applyBrush({
            working,
            source,
            auto,
            w,
            h,
            cx: 4,
            cy: 4,
            brush,
            maskToAlpha: true,
            combinedHeight: new Float32Array(w * h),
            heightDelta: new Float32Array(w * h),
            genOpts,
            selection,
        })
        expect(Array.from(working)).toEqual(Array.from(before))
    })

    it('erase to auto restores the auto-generated normal', () => {
        const { w, h, working, source } = setup()
        // Make auto distinct from the current working buffer.
        const auto = working.slice()
        for (let i = 0; i < w * h; i++) auto[i * 4] = 200
        // Dirty the working center.
        working[(4 * w + 4) * 4] = 10
        const brush: NormalBrush = { mode: 'erase', size: 3, hardness: 1, strength: 1, eraseTarget: 'auto' }
        applyBrush({
            working,
            source,
            auto,
            w,
            h,
            cx: 4,
            cy: 4,
            brush,
            maskToAlpha: true,
            combinedHeight: new Float32Array(w * h),
            heightDelta: new Float32Array(w * h),
            genOpts,
        })
        const o = (4 * w + 4) * 4
        // Pulled back toward auto's red (200), away from 10.
        expect(working[o]).toBeGreaterThan(100)
    })
})
