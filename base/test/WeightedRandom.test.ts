import { describe, it, expect } from 'vitest'
import WeightedRandom from '../src/WeightedRandom'

describe('WeightedRandom', () => {

    it('throws when weightFn is missing', () => {
        expect(() => new WeightedRandom(['a'], null as any)).toThrow('weightFn is required')
    })

    it('throws when random is not a function', () => {
        expect(() => new WeightedRandom(['a'], () => 1, null as any)).toThrow('random must be a function')
    })

    it('throws when no item has a positive weight', () => {
        expect(() => new WeightedRandom(['a', 'b'], () => 0)).toThrow('at least one item with positive weight is required')
    })

    it('throws on negative weights', () => {
        expect(() => new WeightedRandom(['a'], () => -1)).toThrow('weight must be a non-negative finite number')
    })

    it('throws on non-finite weights', () => {
        expect(() => new WeightedRandom(['a'], () => Infinity)).toThrow('weight must be a non-negative finite number')
        expect(() => new WeightedRandom(['a'], () => NaN)).toThrow('weight must be a non-negative finite number')
    })

    it('reports length and totalWeight excluding zero-weight items', () => {
        const wr = new WeightedRandom(
            [{ w: 3 }, { w: 0 }, { w: 7 }],
            (item) => item.w
        )
        expect(wr.length).toBe(2)
        expect(wr.totalWeight).toBe(10)
    })

    it('picks the only positive-weight item every time', () => {
        const wr = new WeightedRandom(
            [{ id: 'a', w: 0 }, { id: 'b', w: 5 }, { id: 'c', w: 0 }],
            (item) => item.w
        )
        for (let i = 0; i < 50; i++) {
            expect(wr.pick().id).toBe('b')
        }
    })

    it('selects deterministically with a fixed random source', () => {
        const samples = [0.0, 0.4, 0.6, 0.99]
        let cursor = 0
        const wr = new WeightedRandom(
            ['a', 'b'],
            (item) => item === 'a' ? 1 : 4,
            () => samples[cursor++]
        )
        expect(wr.pick()).toBe('a')
        expect(wr.pick()).toBe('b')
        expect(wr.pick()).toBe('b')
        expect(wr.pick()).toBe('b')
    })

    it('approximates the expected distribution over many samples', () => {
        let seed = 1
        const random = () => {
            seed = (seed * 1664525 + 1013904223) >>> 0
            return seed / 4294967296
        }
        const wr = new WeightedRandom(
            ['rare', 'common'],
            (item) => item === 'rare' ? 1 : 9,
            random
        )
        const counts: Record<string, number> = { rare: 0, common: 0 }
        const total = 20000
        for (let i = 0; i < total; i++) {
            counts[wr.pick()] += 1
        }
        expect(counts.rare / total).toBeGreaterThan(0.07)
        expect(counts.rare / total).toBeLessThan(0.13)
    })

    it('pickMany returns an array of the requested length', () => {
        const wr = new WeightedRandom(['a'], () => 1)
        expect(wr.pickMany(0)).toEqual([])
        expect(wr.pickMany(3)).toEqual(['a', 'a', 'a'])
    })

    it('pickMany throws on invalid count', () => {
        const wr = new WeightedRandom(['a'], () => 1)
        expect(() => wr.pickMany(-1)).toThrow('count must be a non-negative integer')
        expect(() => wr.pickMany(1.5)).toThrow('count must be a non-negative integer')
    })

    it('probabilityOf returns the share of total weight matching a predicate', () => {
        const wr = new WeightedRandom(
            [{ id: 'a', w: 1 }, { id: 'b', w: 2 }, { id: 'c', w: 7 }],
            (item) => item.w
        )
        expect(wr.probabilityOf((item) => item.id === 'a')).toBeCloseTo(0.1)
        expect(wr.probabilityOf((item) => item.id === 'b' || item.id === 'c')).toBeCloseTo(0.9)
        expect(wr.probabilityOf(() => true)).toBeCloseTo(1)
        expect(wr.probabilityOf(() => false)).toBeCloseTo(0)
    })

    it('probabilityOf throws when predicate missing', () => {
        const wr = new WeightedRandom(['a'], () => 1)
        expect(() => wr.probabilityOf(null as any)).toThrow('predicate is required')
    })

})
