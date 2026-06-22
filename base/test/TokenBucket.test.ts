import { describe, it, expect } from 'vitest'
import TokenBucket from '../src/TokenBucket'

describe('TokenBucket', () => {

    it('throws if capacity is not a positive finite number', () => {
        expect(() => new TokenBucket(0, 1)).toThrow('capacity must be a positive finite number')
        expect(() => new TokenBucket(-5, 1)).toThrow('capacity must be a positive finite number')
        expect(() => new TokenBucket(Infinity, 1)).toThrow('capacity must be a positive finite number')
        expect(() => new TokenBucket(NaN, 1)).toThrow('capacity must be a positive finite number')
    })

    it('throws if refillRate is not a positive finite number', () => {
        expect(() => new TokenBucket(10, 0)).toThrow('refillRate must be a positive finite number')
        expect(() => new TokenBucket(10, -1)).toThrow('refillRate must be a positive finite number')
        expect(() => new TokenBucket(10, Infinity)).toThrow('refillRate must be a positive finite number')
        expect(() => new TokenBucket(10, NaN)).toThrow('refillRate must be a positive finite number')
    })

    it('throws if now is not a function', () => {
        expect(() => new TokenBucket(10, 1, null as any)).toThrow('now must be a function')
        expect(() => new TokenBucket(10, 1, 42 as any)).toThrow('now must be a function')
    })

    it('throws if n is not positive in tryRemove', () => {
        const bucket = new TokenBucket(10, 1)
        expect(() => bucket.tryRemove(0)).toThrow('n must be positive')
        expect(() => bucket.tryRemove(-1)).toThrow('n must be positive')
    })

    it('throws if n is not positive in take', () => {
        const bucket = new TokenBucket(10, 1)
        expect(() => bucket.take(0)).toThrow('n must be positive')
        expect(() => bucket.take(-1)).toThrow('n must be positive')
    })

    it('starts full at capacity', () => {
        let t = 0
        const bucket = new TokenBucket(10, 1, () => t)
        expect(bucket.tokens).toBe(10)
        expect(bucket.capacity).toBe(10)
        expect(bucket.refillRate).toBe(1)
    })

    it('removes tokens when sufficient', () => {
        let t = 0
        const bucket = new TokenBucket(10, 1, () => t)
        expect(bucket.tryRemove(3)).toBe(true)
        expect(bucket.tokens).toBe(7)
    })

    it('returns false when not enough tokens', () => {
        let t = 0
        const bucket = new TokenBucket(5, 1, () => t)
        expect(bucket.tryRemove(6)).toBe(false)
        expect(bucket.tokens).toBe(5)
    })

    it('refills tokens over time', () => {
        let t = 0
        const bucket = new TokenBucket(10, 1, () => t)
        bucket.tryRemove(10)
        expect(bucket.tokens).toBe(0)

        t = 5
        expect(bucket.tokens).toBe(5)

        t = 10
        expect(bucket.tokens).toBe(10)
    })

    it('does not exceed capacity when refilling', () => {
        let t = 0
        const bucket = new TokenBucket(10, 1, () => t)
        bucket.tryRemove(2)
        t = 1000
        expect(bucket.tokens).toBe(10)
    })

    it('refills lazily on tryRemove', () => {
        let t = 0
        const bucket = new TokenBucket(10, 2, () => t)
        bucket.tryRemove(10)

        t = 3
        expect(bucket.tryRemove(5)).toBe(true)
        expect(bucket.tokens).toBe(1)
    })

    it('take is an alias for tryRemove', () => {
        let t = 0
        const bucket = new TokenBucket(10, 1, () => t)
        expect(bucket.take(4)).toBe(true)
        expect(bucket.tokens).toBe(6)
        expect(bucket.take(7)).toBe(false)
        expect(bucket.tokens).toBe(6)
    })

    it('tryRemove defaults n to 1', () => {
        let t = 0
        const bucket = new TokenBucket(5, 1, () => t)
        expect(bucket.tryRemove()).toBe(true)
        expect(bucket.tokens).toBe(4)
    })

    it('take defaults n to 1', () => {
        let t = 0
        const bucket = new TokenBucket(5, 1, () => t)
        expect(bucket.take()).toBe(true)
        expect(bucket.tokens).toBe(4)
    })

    it('tokens getter does not mutate state', () => {
        let t = 0
        const bucket = new TokenBucket(10, 1, () => t)
        bucket.tryRemove(5)
        t = 3
        const a = bucket.tokens
        const b = bucket.tokens
        expect(a).toBe(b)
        expect(a).toBe(8)
    })

    it('handles fractional refill rates', () => {
        let t = 0
        const bucket = new TokenBucket(10, 0.5, () => t)
        bucket.tryRemove(10)
        t = 6
        expect(bucket.tokens).toBe(3)
        expect(bucket.tryRemove(3)).toBe(true)
        expect(bucket.tokens).toBe(0)
    })

    it('allows removing all tokens exactly', () => {
        let t = 0
        const bucket = new TokenBucket(7, 1, () => t)
        expect(bucket.tryRemove(7)).toBe(true)
        expect(bucket.tokens).toBe(0)
    })

})
