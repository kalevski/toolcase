import { describe, it, expect } from 'vitest'
import {
    polygonToMask,
    wandSelect,
    featherMask,
    combineSelection,
    rectToMask,
    maskEdges,
} from '../src/NormalMapGenerator/selection'

describe('rectToMask', () => {
    it('fills an inclusive pixel rectangle', () => {
        const m = rectToMask(1, 1, 2, 2, 4, 4)
        const on = [...m].map((v, i) => (v ? i : -1)).filter((i) => i >= 0)
        expect(on).toEqual([5, 6, 9, 10])
    })

    it('clamps and normalises swapped/out-of-bounds corners', () => {
        const m = rectToMask(2, 2, -5, -5, 4, 4)
        // From (0,0) to (2,2) inclusive → 9 pixels.
        expect([...m].filter(Boolean).length).toBe(9)
    })
})

describe('polygonToMask', () => {
    it('returns empty for fewer than 3 points', () => {
        const m = polygonToMask([[0, 0], [3, 0]], 4, 4)
        expect([...m].some(Boolean)).toBe(false)
    })

    it('fills a triangle interior', () => {
        const m = polygonToMask([[0, 0], [4, 0], [0, 4]], 4, 4)
        expect(m[0]).toBe(255) // top-left inside
        expect(m[3 * 4 + 3]).toBe(0) // bottom-right corner outside the diagonal
    })
})

describe('wandSelect', () => {
    const w = 4
    const h = 4
    // Left half normal A, right half normal B; uniform opaque alpha.
    const rgba = new Uint8ClampedArray(w * h * 4).fill(255)
    const normal = new Uint8ClampedArray(w * h * 4)
    for (let i = 0; i < w * h; i++) {
        const x = i % w
        const o = i * 4
        normal[o] = x < 2 ? 128 : 255 // differ in red channel
        normal[o + 1] = 128
        normal[o + 2] = 255
        normal[o + 3] = 255
    }

    it('floods only the contiguous matching region', () => {
        const m = wandSelect(rgba, normal, w, h, 0, 0, 0.05)
        // Left two columns selected, right two not.
        for (let y = 0; y < h; y++) {
            expect(m[y * w + 0]).toBe(255)
            expect(m[y * w + 1]).toBe(255)
            expect(m[y * w + 2]).toBe(0)
        }
    })

    it('selects everything with a high tolerance', () => {
        const m = wandSelect(rgba, normal, w, h, 0, 0, 1)
        expect([...m].every((v) => v === 255)).toBe(true)
    })
})

describe('combineSelection', () => {
    const a = new Uint8Array([0, 255, 0, 255])
    const b = new Uint8Array([255, 255, 0, 0])

    it('replace returns the new mask', () => {
        expect([...combineSelection(a, b, 'replace')!]).toEqual([255, 255, 0, 0])
    })

    it('add takes the per-pixel max', () => {
        expect([...combineSelection(a, b, 'add')!]).toEqual([255, 255, 0, 255])
    })

    it('subtract removes coverage', () => {
        expect([...combineSelection(a, b, 'subtract')!]).toEqual([0, 0, 0, 255])
    })

    it('returns null when the result is empty', () => {
        const empty = new Uint8Array([0, 0])
        expect(combineSelection(empty, new Uint8Array([0, 0]), 'replace')).toBeNull()
    })
})

describe('featherMask', () => {
    it('is a no-op for radius <= 0', () => {
        const m = new Uint8Array([0, 255, 0, 255])
        expect(featherMask(m, 2, 2, 0)).toBe(m)
    })

    it('softens a hard edge into intermediate values', () => {
        const w = 5
        const h = 1
        const m = new Uint8Array(w * h)
        m[2] = 255
        featherMask(m, w, h, 1)
        expect(m[2]).toBeLessThan(255)
        expect(m[1]).toBeGreaterThan(0)
        expect(m[3]).toBeGreaterThan(0)
    })
})

describe('maskEdges', () => {
    it('emits boundary segments around a filled block', () => {
        const m = rectToMask(1, 1, 2, 2, 4, 4)
        const seg = maskEdges(m, 4, 4)
        // A 2x2 block has a perimeter of 8 unit edges → 8 segments × 4 numbers.
        expect(seg.length).toBe(8 * 4)
    })

    it('returns nothing for an empty mask', () => {
        expect(maskEdges(new Uint8Array(16), 4, 4)).toEqual([])
    })
})
