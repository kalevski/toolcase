import { describe, it, expect } from 'vitest'
import BloomFilter from '../src/BloomFilter'

describe('BloomFilter', () => {

    it('throws if bitSize is not a positive integer', () => {
        expect(() => new BloomFilter(0, 3)).toThrow('bitSize must be a positive integer')
        expect(() => new BloomFilter(-1, 3)).toThrow('bitSize must be a positive integer')
        expect(() => new BloomFilter(1.5, 3)).toThrow('bitSize must be a positive integer')
    })

    it('throws if hashCount is not a positive integer', () => {
        expect(() => new BloomFilter(100, 0)).toThrow('hashCount must be a positive integer')
        expect(() => new BloomFilter(100, -1)).toThrow('hashCount must be a positive integer')
        expect(() => new BloomFilter(100, 1.5)).toThrow('hashCount must be a positive integer')
    })

    it('returns false for all queries on an empty filter', () => {
        const bf = new BloomFilter(1000, 3)
        expect(bf.has('hello')).toBe(false)
        expect(bf.has('')).toBe(false)
        expect(bf.has('x')).toBe(false)
    })

    it('add is chainable and returns the same instance', () => {
        const bf = new BloomFilter(1000, 3)
        const ref = bf.add('a').add('b')
        expect(ref).toBe(bf)
    })

    it('has returns true for every added item (no false negatives)', () => {
        const bf = new BloomFilter(1000, 3)
        bf.add('hello').add('world').add('foo').add('')
        expect(bf.has('hello')).toBe(true)
        expect(bf.has('world')).toBe(true)
        expect(bf.has('foo')).toBe(true)
        expect(bf.has('')).toBe(true)
    })

    it('guarantees no false negatives for a large item set', () => {
        const bf = new BloomFilter(10000, 7)
        const items = Array.from({ length: 500 }, (_, i) => `item-${i}`)
        for (const item of items) bf.add(item)
        for (const item of items) {
            expect(bf.has(item)).toBe(true)
        }
    })

    it('false-positive rate stays well below 5% for expected load', () => {
        // m=1000 bits, k=3 hash fns, n=100 items → expected FPR ≈ 1.7%
        const bf = new BloomFilter(1000, 3)
        for (let i = 0; i < 100; i++) bf.add(`added-${i}`)

        let falsePositives = 0
        const trials = 1000
        for (let i = 0; i < trials; i++) {
            if (bf.has(`probe-${i}`)) falsePositives++
        }
        expect(falsePositives / trials).toBeLessThan(0.05)
    })

    it('exposes bitSize as a readonly property', () => {
        const bf = new BloomFilter(512, 5)
        expect(bf.bitSize).toBe(512)
    })

    it('works correctly with a minimal 1-bit filter', () => {
        const bf = new BloomFilter(1, 1)
        bf.add('x')
        expect(bf.has('x')).toBe(true)
    })

    it('handles single-character items correctly', () => {
        const bf = new BloomFilter(256, 4)
        bf.add('a')
        expect(bf.has('a')).toBe(true)
        expect(bf.has('b')).toBe(false)
    })

    it('different items do not guarantee membership in each other', () => {
        const bf = new BloomFilter(100000, 10)
        bf.add('alpha')
        expect(bf.has('beta')).toBe(false)
        expect(bf.has('gamma')).toBe(false)
        expect(bf.has('delta')).toBe(false)
    })

})
