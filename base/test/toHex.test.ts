import { describe, it, expect } from 'vitest'
import toHex from '../src/toHex'

describe('toHex', () => {
    it('converts number to hex with default 4 digits', () => {
        expect(toHex(255)).toBe('00ff')
    })

    it('pads with zeros', () => {
        expect(toHex(1)).toBe('0001')
    })

    it('converts with custom digit count', () => {
        expect(toHex(255, 2)).toBe('ff')
    })

    it('handles zero', () => {
        expect(toHex(0)).toBe('0000')
    })

    it('handles large numbers', () => {
        expect(toHex(65535, 4)).toBe('ffff')
    })

    it('does not throw when digits <= 0 and returns non-empty hex string', () => {
        expect(() => toHex(255, 0)).not.toThrow()
        expect(toHex(255, 0).length).toBeGreaterThan(0)
    })

    it('handles negative values without a minus sign', () => {
        const result = toHex(-1)
        expect(result).not.toContain('-')
        expect(result).toBe('ffff')
    })
})
