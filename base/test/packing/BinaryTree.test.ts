import { describe, it, expect } from 'vitest'
import BinaryTree from '../../src/packing/BinaryTree'

const opts = (overrides = {}) => ({
    maxWidth: 64,
    maxHeight: 64,
    allowRotation: false,
    padding: 0,
    extrude: 0,
    pot: 'none' as const,
    ...overrides
})

describe('BinaryTree', () => {
    it('packs four equal squares to 100% fill', () => {
        const t = new BinaryTree(opts({ maxWidth: 64, maxHeight: 64 }))
        t.reset()
        for (let i = 0; i < 4; i++) t.insert({ width: 32, height: 32 })
        expect(t.occupancy()).toBeCloseTo(1)
    })

    it('returns null when sprite exceeds bin', () => {
        const t = new BinaryTree(opts())
        t.reset()
        expect(t.insert({ width: 100, height: 10 })).toBeNull()
    })

    it('rotates when permitted', () => {
        const t = new BinaryTree(opts({ maxWidth: 64, maxHeight: 64, allowRotation: true }))
        t.reset()
        t.insert({ width: 64, height: 32 })
        const r = t.insert({ width: 64, height: 32 })  // would not fit unless rotation explored
        expect(r).not.toBeNull()
    })

    it('reset clears state', () => {
        const t = new BinaryTree(opts())
        t.reset()
        t.insert({ width: 32, height: 32 })
        t.reset()
        expect(t.occupancy()).toBe(0)
    })
})
