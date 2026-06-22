import { describe, it, expect } from 'vitest'
import formatNumber from '../src/formatNumber'

describe('formatNumber', () => {

    describe('non-compact (default)', () => {

        it('formats zero', () => {
            expect(formatNumber(0)).toBe('0')
        })

        it('returns 0 for NaN', () => {
            expect(formatNumber(NaN)).toBe('0')
        })

        it('returns 0 for Infinity', () => {
            expect(formatNumber(Infinity)).toBe('0')
        })

        it('formats numbers below 1000 without commas', () => {
            expect(formatNumber(999)).toBe('999')
            expect(formatNumber(42)).toBe('42')
        })

        it('inserts thousands separator', () => {
            expect(formatNumber(1000)).toBe('1,000')
            expect(formatNumber(1234567)).toBe('1,234,567')
        })

        it('preserves decimals', () => {
            expect(formatNumber(1234.56)).toBe('1,234.56')
        })

        it('handles negative numbers', () => {
            expect(formatNumber(-1234)).toBe('-1,234')
        })

    })

    describe('compact', () => {

        it('formats thousands with k suffix', () => {
            expect(formatNumber(1000, { compact: true })).toBe('1k')
            expect(formatNumber(1200, { compact: true })).toBe('1.2k')
            expect(formatNumber(999900, { compact: true })).toBe('999.9k')
        })

        it('formats millions with M suffix', () => {
            expect(formatNumber(1000000, { compact: true })).toBe('1M')
            expect(formatNumber(3400000, { compact: true })).toBe('3.4M')
        })

        it('formats billions with B suffix', () => {
            expect(formatNumber(1000000000, { compact: true })).toBe('1B')
            expect(formatNumber(2500000000, { compact: true })).toBe('2.5B')
        })

        it('passes through numbers below 1000', () => {
            expect(formatNumber(999, { compact: true })).toBe('999')
            expect(formatNumber(0, { compact: true })).toBe('0')
        })

        it('handles negative compact values', () => {
            expect(formatNumber(-1200, { compact: true })).toBe('-1.2k')
            expect(formatNumber(-3400000, { compact: true })).toBe('-3.4M')
        })

        it('drops trailing decimal zero', () => {
            expect(formatNumber(2000, { compact: true })).toBe('2k')
            expect(formatNumber(5000000, { compact: true })).toBe('5M')
        })

    })

})
