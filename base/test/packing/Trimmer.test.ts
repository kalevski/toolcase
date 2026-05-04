import { describe, it, expect } from 'vitest'
import Trimmer from '../../src/packing/Trimmer'
import { PixelGrid } from '../../src/packing/types'

const makeGrid = (rows: string[]): PixelGrid => {
    const height = rows.length
    const width = rows[0]!.length
    return {
        width,
        height,
        alphaAt(x, y) {
            return rows[y]![x] === '#' ? 255 : 0
        }
    }
}

describe('Trimmer', () => {
    it('crops empty borders', () => {
        const pixels = makeGrid([
            '....',
            '.##.',
            '.##.',
            '....'
        ])
        const out = new Trimmer(0).trim({ id: 'a', width: 4, height: 4, pixels })
        expect(out.width).toBe(2)
        expect(out.height).toBe(2)
        expect(out.sourceWidth).toBe(4)
        expect(out.sourceHeight).toBe(4)
        expect(out.sourceOffsetX).toBe(1)
        expect(out.sourceOffsetY).toBe(1)
    })

    it('returns identity when sprite is fully opaque', () => {
        const pixels = makeGrid(['##', '##'])
        const out = new Trimmer(0).trim({ id: 'a', width: 2, height: 2, pixels })
        expect(out.width).toBe(2)
        expect(out.height).toBe(2)
        expect(out.sourceOffsetX).toBe(0)
        expect(out.sourceOffsetY).toBe(0)
    })

    it('reports zero size for fully transparent input', () => {
        const pixels = makeGrid(['..', '..'])
        const out = new Trimmer(0).trim({ id: 'a', width: 2, height: 2, pixels })
        expect(out.width).toBe(0)
        expect(out.height).toBe(0)
    })

    it('passthrough when alphaThreshold is -1', () => {
        const pixels = makeGrid(['..', '..'])
        const out = new Trimmer(-1).trim({ id: 'a', width: 2, height: 2, pixels })
        expect(out.width).toBe(2)
        expect(out.height).toBe(2)
    })

    it('passthrough when no pixels provided', () => {
        const out = new Trimmer(0).trim({ id: 'a', width: 8, height: 6 })
        expect(out.width).toBe(8)
        expect(out.height).toBe(6)
        expect(out.sourceOffsetX).toBe(0)
    })
})
