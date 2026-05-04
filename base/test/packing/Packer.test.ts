import { describe, it, expect } from 'vitest'
import Packer from '../../src/packing/Packer'
import { PackerOptions, Sprite } from '../../src/packing/types'

const baseOpts = (overrides: Partial<PackerOptions> = {}): PackerOptions => ({
    algorithm: 'max-rects',
    maxWidth: 128,
    maxHeight: 128,
    allowRotation: false,
    padding: 0,
    extrude: 0,
    pot: 'none',
    sort: 'max-side-desc',
    trim: false,
    alphaThreshold: 0,
    budget: {},
    ...overrides
})

const sprite = (id: string, w: number, h: number): Sprite => ({ id, width: w, height: h })

describe('Packer', () => {
    it('packs sprites with default options into single page', () => {
        const packer = new Packer(baseOpts())
        const result = packer.pack([sprite('a', 32, 32), sprite('b', 32, 32), sprite('c', 32, 32), sprite('d', 32, 32)])
        expect(result.pages).toHaveLength(1)
        expect(result.unpacked).toHaveLength(0)
        expect(result.pages[0]!.sprites).toHaveLength(4)
    })

    it('applies POT page rounding', () => {
        const packer = new Packer(baseOpts({ pot: 'page' }))
        const result = packer.pack([sprite('a', 30, 20)])
        const page = result.pages[0]!
        expect(page.width).toBe(32)
        expect(page.height).toBe(32)
    })

    it('applies POT square rounding', () => {
        const packer = new Packer(baseOpts({ pot: 'square' }))
        const result = packer.pack([sprite('a', 30, 20)])
        const page = result.pages[0]!
        expect(page.width).toBe(32)
        expect(page.height).toBe(32)
    })

    it('opens multiple pages on overflow', () => {
        const packer = new Packer(baseOpts({ maxWidth: 32, maxHeight: 32 }))
        const result = packer.pack([sprite('a', 32, 32), sprite('b', 32, 32)])
        expect(result.pages).toHaveLength(2)
    })

    it('budget caps the page count', () => {
        const packer = new Packer(baseOpts({ maxWidth: 32, maxHeight: 32, budget: { maxPages: 1 } }))
        const result = packer.pack([sprite('a', 32, 32), sprite('b', 32, 32)])
        expect(result.pages).toHaveLength(1)
        expect(result.unpacked).toHaveLength(1)
    })

    it('every algorithm packs four 32x32 into 64x64', () => {
        const algorithms = ['max-rects', 'guillotine', 'shelf', 'skyline', 'binary-tree'] as const
        for (const algorithm of algorithms) {
            const packer = new Packer(baseOpts({ algorithm, maxWidth: 64, maxHeight: 64 }))
            const result = packer.pack([
                sprite('a', 32, 32), sprite('b', 32, 32),
                sprite('c', 32, 32), sprite('d', 32, 32)
            ])
            expect(result.pages, algorithm).toHaveLength(1)
            expect(result.pages[0]!.sprites, algorithm).toHaveLength(4)
        }
    })

    it('rotation enables tighter packing', () => {
        const packer = new Packer(baseOpts({ algorithm: 'max-rects', maxWidth: 64, maxHeight: 64, allowRotation: true }))
        const result = packer.pack([sprite('a', 64, 32), sprite('b', 64, 32)])
        expect(result.pages).toHaveLength(1)
    })

    it('reports occupancy after POT finalization', () => {
        const packer = new Packer(baseOpts({ pot: 'page' }))
        const result = packer.pack([sprite('a', 30, 30)])
        expect(result.pages[0]!.occupancy).toBeCloseTo(900 / (32 * 32))
    })

    it('passthrough sort=none does not reorder', () => {
        const packer = new Packer(baseOpts({ sort: 'none' }))
        const result = packer.pack([sprite('a', 10, 10), sprite('b', 80, 80), sprite('c', 20, 20)])
        const ids = result.pages[0]!.sprites.map(s => s.id)
        expect(ids).toEqual(['a', 'b', 'c'])
    })

    it('trim crops transparent borders before packing', () => {
        const grid = {
            width: 6,
            height: 6,
            alphaAt(x: number, y: number) {
                return (x === 2 || x === 3) && (y === 2 || y === 3) ? 255 : 0
            }
        }
        const packer = new Packer(baseOpts({ trim: true }))
        const result = packer.pack([{ id: 'a', width: 6, height: 6, pixels: grid }])
        const placed = result.pages[0]!.sprites[0]!
        expect(placed.rect.width).toBe(2)
        expect(placed.rect.height).toBe(2)
        expect(placed.sourceOffsetX).toBe(2)
        expect(placed.sourceOffsetY).toBe(2)
    })
})
