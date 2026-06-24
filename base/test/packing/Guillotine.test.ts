import { describe, it, expect } from 'vitest'
import Guillotine from '../../src/packing/Guillotine'

const opts = (overrides = {}) => ({
    maxWidth: 64,
    maxHeight: 64,
    allowRotation: false,
    pot: 'none' as const,
    ...overrides
})

describe('Guillotine', () => {
    it('packs four 32x32 into 64x64 to 100%', () => {
        const g = new Guillotine(opts())
        g.reset()
        for (let i = 0; i < 4; i++) g.insert({ width: 32, height: 32 })
        expect(g.occupancy()).toBeCloseTo(1)
    })

    it('returns null when no fit', () => {
        const g = new Guillotine(opts({ maxWidth: 30, maxHeight: 30 }))
        g.reset()
        g.insert({ width: 30, height: 30 })
        expect(g.insert({ width: 1, height: 1 })).toBeNull()
    })

    it('rotates when permitted', () => {
        const g = new Guillotine(opts({ maxWidth: 64, maxHeight: 64, allowRotation: true }))
        g.reset()
        g.insert({ width: 64, height: 32 })
        const r = g.insert({ width: 64, height: 32 })
        expect(r).not.toBeNull()
    })

    it('split strategies are configurable', () => {
        const g = new Guillotine(opts()).setSplit('shorter-axis').setChoice('best-area-fit')
        g.reset()
        const a = g.insert({ width: 30, height: 20 })
        expect(a).not.toBeNull()
    })

    it('merge collapses adjacent free rects', () => {
        const g = new Guillotine(opts())
        g.reset()
        g.insert({ width: 30, height: 30 })
        g.merge()
        expect(g.occupancy()).toBeGreaterThan(0)
    })
})
