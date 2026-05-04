import { describe, it, expect } from 'vitest'
import MultiPagePlanner from '../../src/packing/MultiPagePlanner'
import Shelf from '../../src/packing/Shelf'
import { PreparedSprite } from '../../src/packing/types'

const sprite = (id: string, w: number, h: number): PreparedSprite => ({
    id,
    width: w,
    height: h,
    sourceWidth: w,
    sourceHeight: h,
    sourceOffsetX: 0,
    sourceOffsetY: 0,
    rotated: false
})

const opts = (overrides = {}) => ({
    maxWidth: 64,
    maxHeight: 64,
    allowRotation: false,
    padding: 0,
    extrude: 0,
    pot: 'none' as const,
    ...overrides
})

describe('MultiPagePlanner', () => {
    it('packs all sprites into a single page when they fit', () => {
        const planner = new MultiPagePlanner(() => new Shelf(opts()), { padding: 0, extrude: 0 })
        const result = planner.pack([sprite('a', 32, 32), sprite('b', 32, 32)])
        expect(result.pages).toHaveLength(1)
        expect(result.unpacked).toHaveLength(0)
    })

    it('opens additional pages when sprites overflow', () => {
        const planner = new MultiPagePlanner(() => new Shelf(opts({ maxWidth: 32, maxHeight: 32 })), { padding: 0, extrude: 0 })
        const result = planner.pack([sprite('a', 32, 32), sprite('b', 32, 32), sprite('c', 32, 32)])
        expect(result.pages).toHaveLength(3)
        expect(result.unpacked).toHaveLength(0)
    })

    it('honors maxPages — overflow lands in unpacked', () => {
        const planner = new MultiPagePlanner(
            () => new Shelf(opts({ maxWidth: 32, maxHeight: 32 })),
            { padding: 0, extrude: 0 },
            { maxPages: 2 }
        )
        const result = planner.pack([sprite('a', 32, 32), sprite('b', 32, 32), sprite('c', 32, 32)])
        expect(result.pages).toHaveLength(2)
        expect(result.unpacked.map(s => s.id)).toEqual(['c'])
    })

    it('honors maxSinglePagePixels — refuses oversized pages', () => {
        const planner = new MultiPagePlanner(
            () => new Shelf(opts({ maxWidth: 256, maxHeight: 256 })),
            { padding: 0, extrude: 0 },
            { maxSinglePagePixels: 1024 }
        )
        const result = planner.pack([sprite('a', 16, 16)])
        expect(result.pages).toHaveLength(0)
        expect(result.unpacked).toHaveLength(1)
    })

    it('honors maxPagePixels — caps total pixel budget', () => {
        const planner = new MultiPagePlanner(
            () => new Shelf(opts({ maxWidth: 32, maxHeight: 32 })),
            { padding: 0, extrude: 0 },
            { maxPagePixels: 1024 }
        )
        const result = planner.pack([sprite('a', 32, 32), sprite('b', 32, 32)])
        expect(result.pages).toHaveLength(1)
        expect(result.unpacked).toHaveLength(1)
    })

    it('separates sprites by padding', () => {
        const planner = new MultiPagePlanner(
            () => new Shelf(opts({ maxWidth: 100, maxHeight: 100 })),
            { padding: 2, extrude: 0 }
        )
        const result = planner.pack([sprite('a', 10, 10), sprite('b', 10, 10)])
        expect(result.pages).toHaveLength(1)
        const [a, b] = result.pages[0]!.sprites
        expect(b!.rect.x - (a!.rect.x + a!.rect.width)).toBe(2)
    })

    it('offsets sprite by extrude inside its inflated rect', () => {
        const planner = new MultiPagePlanner(
            () => new Shelf(opts({ maxWidth: 100, maxHeight: 100 })),
            { padding: 0, extrude: 1 }
        )
        const result = planner.pack([sprite('a', 10, 10)])
        expect(result.pages[0]!.sprites[0]!.rect).toEqual({ x: 1, y: 1, width: 10, height: 10 })
    })
})
