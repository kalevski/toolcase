import { describe, it, expect } from 'vitest'
import MaxRects from '../../src/packing/MaxRects'

const opts = (overrides = {}) => ({
    maxWidth: 64,
    maxHeight: 64,
    allowRotation: false,
    pot: 'none' as const,
    ...overrides
})

describe('MaxRects', () => {
    it('packs four 32x32 into 64x64 to 100%', () => {
        const m = new MaxRects(opts())
        m.reset()
        for (let i = 0; i < 4; i++) m.insert({ width: 32, height: 32 })
        expect(m.occupancy()).toBeCloseTo(1)
    })

    it('returns null when no fit', () => {
        const m = new MaxRects(opts({ maxWidth: 30, maxHeight: 30 }))
        m.reset()
        m.insert({ width: 30, height: 30 })
        expect(m.insert({ width: 1, height: 1 })).toBeNull()
    })

    it('all four heuristics produce valid layouts', () => {
        const heuristics = ['best-short-side-fit', 'best-long-side-fit', 'best-area-fit', 'bottom-left'] as const
        for (const h of heuristics) {
            const m = new MaxRects(opts()).setHeuristic(h)
            m.reset()
            for (let i = 0; i < 4; i++) m.insert({ width: 32, height: 32 })
            expect(m.occupancy()).toBeCloseTo(1)
        }
    })

    it('rotates when permitted', () => {
        const m = new MaxRects(opts({ allowRotation: true }))
        m.reset()
        m.insert({ width: 64, height: 32 })
        const r = m.insert({ width: 64, height: 32 })
        expect(r).not.toBeNull()
    })

    it('reset clears state', () => {
        const m = new MaxRects(opts())
        m.reset()
        m.insert({ width: 32, height: 32 })
        m.reset()
        expect(m.occupancy()).toBe(0)
        expect(m.usedBounds()).toEqual({ width: 0, height: 0 })
    })

    it('packs many small sprites with high fill', () => {
        const m = new MaxRects(opts({ maxWidth: 256, maxHeight: 256 }))
        m.reset()
        const sprites: { width: number, height: number }[] = []
        for (let i = 0; i < 10; i++) sprites.push({ width: 32, height: 32 })
        for (let i = 0; i < 6; i++) sprites.push({ width: 64, height: 64 })
        let placed = 0
        for (const s of sprites) {
            if (m.insert(s) !== null) placed++
        }
        expect(placed).toBe(sprites.length)
        expect(m.occupancy()).toBeGreaterThan(0.5)
    })
})
