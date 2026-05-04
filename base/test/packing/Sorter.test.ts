import { describe, it, expect } from 'vitest'
import Sorter from '../../src/packing/Sorter'
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

describe('Sorter', () => {
    it('sorts by area descending', () => {
        const out = new Sorter('area-desc').sort([sprite('a', 10, 10), sprite('b', 30, 30), sprite('c', 20, 20)])
        expect(out.map(s => s.id)).toEqual(['b', 'c', 'a'])
    })

    it('sorts by max-side descending', () => {
        const out = new Sorter('max-side-desc').sort([sprite('a', 30, 5), sprite('b', 20, 20), sprite('c', 50, 1)])
        expect(out.map(s => s.id)).toEqual(['c', 'a', 'b'])
    })

    it('sorts by height descending', () => {
        const out = new Sorter('height-desc').sort([sprite('a', 10, 5), sprite('b', 1, 30), sprite('c', 5, 20)])
        expect(out.map(s => s.id)).toEqual(['b', 'c', 'a'])
    })

    it('sorts by width descending', () => {
        const out = new Sorter('width-desc').sort([sprite('a', 10, 5), sprite('b', 30, 1), sprite('c', 20, 5)])
        expect(out.map(s => s.id)).toEqual(['b', 'c', 'a'])
    })

    it('sorts by perimeter descending', () => {
        const out = new Sorter('perimeter-desc').sort([sprite('a', 10, 10), sprite('b', 5, 5), sprite('c', 30, 1)])
        expect(out.map(s => s.id)).toEqual(['c', 'a', 'b'])
    })

    it('does not mutate input', () => {
        const input = [sprite('a', 10, 10), sprite('b', 30, 30)]
        const original = input.slice()
        new Sorter('area-desc').sort(input)
        expect(input).toEqual(original)
    })
})
