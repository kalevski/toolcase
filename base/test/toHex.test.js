import { describe, it, expect } from 'vitest'
import toHex from '../src/toHex.js'

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
})
