import { describe, it, expect } from 'vitest'
import getNumberInRange from '../src/getNumberInRange.js'

describe('getNumberInRange', () => {
    it('returns a number value directly', () => {
        expect(getNumberInRange(5)).toBe(5)
    })

    it('parses a string to number', () => {
        expect(getNumberInRange('10')).toBe(10)
    })

    it('returns default for non-parseable string', () => {
        expect(getNumberInRange('abc', 42)).toBe(42)
    })

    it('returns default for NaN number', () => {
        expect(getNumberInRange(NaN, 7)).toBe(7)
    })

    it('returns default for unsupported types', () => {
        expect(getNumberInRange(undefined, 3)).toBe(3)
        expect(getNumberInRange(null, 3)).toBe(3)
        expect(getNumberInRange(true, 3)).toBe(3)
    })

    it('clamps to min', () => {
        expect(getNumberInRange(1, 0, 5, 10)).toBe(5)
    })

    it('clamps to max', () => {
        expect(getNumberInRange(100, 0, 0, 50)).toBe(50)
    })

    it('returns value within range', () => {
        expect(getNumberInRange(25, 0, 0, 50)).toBe(25)
    })

    it('uses default 0 when no default specified', () => {
        expect(getNumberInRange('abc')).toBe(0)
    })
})
