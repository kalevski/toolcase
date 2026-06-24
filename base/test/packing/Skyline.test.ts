import { describe, it, expect } from 'vitest'
import Skyline from '../../src/packing/Skyline'

const opts = (overrides = {}) => ({
    maxWidth: 64,
    maxHeight: 64,
    allowRotation: false,
    pot: 'none' as const,
    ...overrides
})

describe('Skyline', () => {
    it('packs four 32x32 into 64x64 to 100%', () => {
        const s = new Skyline(opts())
        s.reset()
        for (let i = 0; i < 4; i++) s.insert({ width: 32, height: 32 })
        expect(s.occupancy()).toBeCloseTo(1)
    })

    it('returns null when no fit', () => {
        const s = new Skyline(opts({ maxWidth: 30, maxHeight: 30 }))
        s.reset()
        s.insert({ width: 30, height: 30 })
        expect(s.insert({ width: 1, height: 1 })).toBeNull()
    })

    it('places sprites at lowest skyline first', () => {
        const s = new Skyline(opts({ maxWidth: 100, maxHeight: 100 }))
        s.reset()
        const a = s.insert({ width: 50, height: 30 })
        const b = s.insert({ width: 50, height: 50 })
        expect(a!.y).toBe(0)
        expect(b!.y).toBe(0)
    })

    it('rotates when permitted', () => {
        const s = new Skyline(opts({ allowRotation: true }))
        s.reset()
        s.insert({ width: 64, height: 32 })
        const r = s.insert({ width: 64, height: 32 })
        expect(r).not.toBeNull()
    })

    it('min-waste heuristic produces valid layout', () => {
        const s = new Skyline(opts({ maxWidth: 100, maxHeight: 100 })).setHeuristic('min-waste')
        s.reset()
        const a = s.insert({ width: 60, height: 40 })
        const b = s.insert({ width: 30, height: 20 })
        expect(a).not.toBeNull()
        expect(b).not.toBeNull()
    })
})
