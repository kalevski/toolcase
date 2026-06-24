import { describe, it, expect } from 'vitest'
import Random from '../src/Random'

describe('Random', () => {

    it('throws when seed is not a finite number', () => {
        expect(() => new Random(NaN)).toThrow('seed must be a finite number')
        expect(() => new Random(Infinity)).toThrow('seed must be a finite number')
        expect(() => new Random('x' as any)).toThrow('seed must be a finite number')
    })

    it('next() returns values in [0, 1)', () => {
        const rng = new Random(42)
        for (let i = 0; i < 1000; i++) {
            const v = rng.next()
            expect(v).toBeGreaterThanOrEqual(0)
            expect(v).toBeLessThan(1)
        }
    })

    it('identical seeds produce identical sequences (reproducibility)', () => {
        const a = new Random(12345)
        const b = new Random(12345)
        for (let i = 0; i < 50; i++) {
            expect(a.next()).toBe(b.next())
        }
    })

    it('different seeds produce different sequences', () => {
        const a = new Random(1)
        const b = new Random(2)
        const aSeq = Array.from({ length: 10 }, () => a.next())
        const bSeq = Array.from({ length: 10 }, () => b.next())
        expect(aSeq).not.toEqual(bSeq)
    })

    it('int() returns inclusive integers within [min, max]', () => {
        const rng = new Random(99)
        for (let i = 0; i < 500; i++) {
            const v = rng.int(3, 7)
            expect(Number.isInteger(v)).toBe(true)
            expect(v).toBeGreaterThanOrEqual(3)
            expect(v).toBeLessThanOrEqual(7)
        }
    })

    it('int() produces all values in range', () => {
        const rng = new Random(7)
        const seen = new Set<number>()
        for (let i = 0; i < 10000; i++) {
            seen.add(rng.int(0, 4))
        }
        expect(seen).toEqual(new Set([0, 1, 2, 3, 4]))
    })

    it('int() works when min === max', () => {
        const rng = new Random(1)
        expect(rng.int(5, 5)).toBe(5)
    })

    it('int() throws when min or max are not integers', () => {
        const rng = new Random(1)
        expect(() => rng.int(1.5, 5)).toThrow('min and max must be integers')
        expect(() => rng.int(1, 5.5)).toThrow('min and max must be integers')
    })

    it('int() throws when min > max', () => {
        const rng = new Random(1)
        expect(() => rng.int(10, 5)).toThrow('min must be <= max')
    })

    it('float() returns value in [min, max)', () => {
        const rng = new Random(3)
        for (let i = 0; i < 500; i++) {
            const v = rng.float(1.5, 3.5)
            expect(v).toBeGreaterThanOrEqual(1.5)
            expect(v).toBeLessThan(3.5)
        }
    })

    it('float() throws on non-finite bounds', () => {
        const rng = new Random(1)
        expect(() => rng.float(Infinity, 5)).toThrow('min and max must be finite numbers')
        expect(() => rng.float(1, NaN)).toThrow('min and max must be finite numbers')
    })

    it('float() throws when min > max', () => {
        const rng = new Random(1)
        expect(() => rng.float(10, 5)).toThrow('min must be <= max')
    })

    it('bool() defaults to p=0.5 and returns booleans', () => {
        const rng = new Random(55)
        const results = Array.from({ length: 1000 }, () => rng.bool())
        expect(results.every((v) => typeof v === 'boolean')).toBe(true)
        const trueCount = results.filter(Boolean).length
        expect(trueCount).toBeGreaterThan(400)
        expect(trueCount).toBeLessThan(600)
    })

    it('bool(0) always returns false, bool(1) always returns true', () => {
        const rng = new Random(1)
        for (let i = 0; i < 20; i++) {
            expect(rng.bool(0)).toBe(false)
            expect(rng.bool(1)).toBe(true)
        }
    })

    it('bool() throws when p is out of [0, 1]', () => {
        const rng = new Random(1)
        expect(() => rng.bool(-0.1)).toThrow('p must be a number in [0, 1]')
        expect(() => rng.bool(1.1)).toThrow('p must be a number in [0, 1]')
        expect(() => rng.bool(NaN)).toThrow('p must be a number in [0, 1]')
    })

    it('pick() returns an element from the array', () => {
        const rng = new Random(8)
        const arr = ['a', 'b', 'c', 'd']
        for (let i = 0; i < 100; i++) {
            expect(arr).toContain(rng.pick(arr))
        }
    })

    it('pick() covers all elements over many draws', () => {
        const rng = new Random(21)
        const arr = [1, 2, 3, 4, 5]
        const seen = new Set<number>()
        for (let i = 0; i < 5000; i++) seen.add(rng.pick(arr))
        expect(seen).toEqual(new Set(arr))
    })

    it('pick() throws on empty array', () => {
        const rng = new Random(1)
        expect(() => rng.pick([])).toThrow('arr must be a non-empty array')
    })

    it('pick() throws on non-array', () => {
        const rng = new Random(1)
        expect(() => rng.pick(null as any)).toThrow('arr must be a non-empty array')
    })

    it('shuffle() returns a new array with the same elements', () => {
        const rng = new Random(99)
        const arr = [1, 2, 3, 4, 5]
        const result = rng.shuffle(arr)
        expect(result).not.toBe(arr)
        expect(result.sort()).toEqual([1, 2, 3, 4, 5])
    })

    it('shuffle() does not mutate the original array', () => {
        const rng = new Random(1)
        const arr = [10, 20, 30]
        rng.shuffle(arr)
        expect(arr).toEqual([10, 20, 30])
    })

    it('shuffle() returns empty array for empty input', () => {
        const rng = new Random(1)
        expect(rng.shuffle([])).toEqual([])
    })

    it('shuffle() throws on non-array', () => {
        const rng = new Random(1)
        expect(() => rng.shuffle(null as any)).toThrow('arr must be an array')
    })

    it('weighted() returns one of the items', () => {
        const rng = new Random(5)
        const entries = [
            { item: 'a', weight: 1 },
            { item: 'b', weight: 9 }
        ]
        for (let i = 0; i < 100; i++) {
            expect(['a', 'b']).toContain(rng.weighted(entries))
        }
    })

    it('weighted() respects distribution over many draws', () => {
        const rng = new Random(42)
        const entries = [
            { item: 'rare', weight: 1 },
            { item: 'common', weight: 9 }
        ]
        let rareCount = 0
        const total = 10000
        for (let i = 0; i < total; i++) {
            if (rng.weighted(entries) === 'rare') rareCount++
        }
        expect(rareCount / total).toBeGreaterThan(0.07)
        expect(rareCount / total).toBeLessThan(0.13)
    })

    it('weighted() is deterministic with the same seed', () => {
        const a = new Random(77)
        const b = new Random(77)
        const entries = [{ item: 'x', weight: 1 }, { item: 'y', weight: 2 }, { item: 'z', weight: 7 }]
        for (let i = 0; i < 30; i++) {
            expect(a.weighted(entries)).toBe(b.weighted(entries))
        }
    })

    it('weighted() throws on empty entries', () => {
        const rng = new Random(1)
        expect(() => rng.weighted([])).toThrow('entries must be a non-empty array')
    })

    it('weighted() throws when total weight is zero', () => {
        const rng = new Random(1)
        expect(() => rng.weighted([{ item: 'a', weight: 0 }])).toThrow('total weight must be greater than zero')
    })

    it('weighted() throws on negative or non-finite weight', () => {
        const rng = new Random(1)
        expect(() => rng.weighted([{ item: 'a', weight: -1 }])).toThrow('all weights must be non-negative finite numbers')
        expect(() => rng.weighted([{ item: 'a', weight: NaN }])).toThrow('all weights must be non-negative finite numbers')
        expect(() => rng.weighted([{ item: 'a', weight: Infinity }])).toThrow('all weights must be non-negative finite numbers')
    })

    it('is usable as RandomFn injectable for WeightedRandom', async () => {
        const { default: WeightedRandom } = await import('../src/WeightedRandom')
        const rng = new Random(1234)
        const wr = new WeightedRandom(['a', 'b'], (x) => x === 'a' ? 1 : 1, () => rng.next())
        const rng2 = new Random(1234)
        const wr2 = new WeightedRandom(['a', 'b'], (x) => x === 'a' ? 1 : 1, () => rng2.next())
        for (let i = 0; i < 20; i++) {
            expect(wr.pick()).toBe(wr2.pick())
        }
    })

})
