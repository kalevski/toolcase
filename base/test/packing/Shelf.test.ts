import { describe, it, expect } from 'vitest'
import Shelf from '../../src/packing/Shelf'

const opts = (overrides = {}) => ({
    maxWidth: 100,
    maxHeight: 100,
    allowRotation: false,
    padding: 0,
    extrude: 0,
    pot: 'none' as const,
    ...overrides
})

describe('Shelf', () => {
    it('places sprites left-to-right on a shelf', () => {
        const s = new Shelf(opts())
        s.reset()
        const a = s.insert({ width: 30, height: 20 })
        const b = s.insert({ width: 40, height: 20 })
        expect(a).toEqual({ x: 0, y: 0, width: 30, height: 20, rotated: false })
        expect(b).toEqual({ x: 30, y: 0, width: 40, height: 20, rotated: false })
    })

    it('opens a new shelf when row fills', () => {
        const s = new Shelf(opts({ maxWidth: 50, maxHeight: 100 }))
        s.reset()
        s.insert({ width: 30, height: 20 })
        const b = s.insert({ width: 30, height: 20 })
        expect(b).not.toBeNull()
        expect(b!.y).toBe(20)
        expect(b!.x).toBe(0)
    })

    it('returns null when no shelf fits', () => {
        const s = new Shelf(opts({ maxWidth: 50, maxHeight: 30 }))
        s.reset()
        s.insert({ width: 50, height: 30 })
        expect(s.insert({ width: 10, height: 10 })).toBeNull()
    })

    it('reports occupancy and usedBounds', () => {
        const s = new Shelf(opts())
        s.reset()
        s.insert({ width: 50, height: 50 })
        expect(s.occupancy()).toBeCloseTo(0.25)
        expect(s.usedBounds()).toEqual({ width: 50, height: 50 })
    })

    it('reset clears state', () => {
        const s = new Shelf(opts())
        s.reset()
        s.insert({ width: 10, height: 10 })
        s.reset()
        expect(s.occupancy()).toBe(0)
        expect(s.usedBounds()).toEqual({ width: 0, height: 0 })
    })

    it('best-fit chooses tightest shelf', () => {
        const s = new Shelf(opts({ maxWidth: 100, maxHeight: 200 })).setFit('best-fit')
        s.reset()
        s.insert({ width: 60, height: 50 })  // shelf 0 h=50, cursor=60
        s.insert({ width: 60, height: 30 })  // shelf 1 h=30, cursor=60 (60+60>100 forces new shelf)
        const r = s.insert({ width: 30, height: 25 })  // fits both; shelf 1 tighter
        expect(r!.y).toBe(50)
    })

    it('rotates when allowed and helpful', () => {
        const s = new Shelf(opts({ maxWidth: 100, maxHeight: 100, allowRotation: true }))
        s.reset()
        s.insert({ width: 100, height: 10 })  // first shelf height 10
        const r = s.insert({ width: 100, height: 8 })  // fits next shelf
        expect(r).not.toBeNull()
    })
})
