import { describe, it, expect, vi } from 'vitest'
import Color from '../src/Color'

describe('Color', () => {
    it('exposes Material palette as uppercase keys', () => {
        expect(Color.RED).toBe('#f44336')
        expect(Color.BLUE).toBe('#2196f3')
    })

    it('getHex resolves lowercase color name', () => {
        expect(Color.getHex('red' as any)).toBe('#f44336')
    })

    it('getHex returns null for unknown color', () => {
        expect(Color.getHex('plaid' as any)).toBeNull()
    })

    it('toNumber converts hex to integer', () => {
        expect(Color.toNumber('red' as any)).toBe(0xf44336)
    })

    it('toNumber returns 0 for unknown color', () => {
        expect(Color.toNumber('plaid' as any)).toBe(0)
    })

    it('getRandomHex returns palette entry only', () => {
        const palette = [
            '#f44336','#e91e63','#9c27b0','#673ab7','#3f51b5','#2196f3',
            '#03a9f4','#00bcd4','#009688','#4caf50','#8bc34a','#cddc39',
            '#ffeb3b','#ffc107','#ff9800','#ff5722'
        ]
        for (let i = 0; i < 50; i++) {
            expect(palette).toContain(Color.getRandomHex())
        }
    })

    it('getRandomHex covers a range of indices', () => {
        const seen = new Set<string>()
        const stub = vi.spyOn(Math, 'random')
        try {
            for (let i = 0; i < 16; i++) {
                stub.mockReturnValueOnce(i / 16)
                seen.add(Color.getRandomHex())
            }
        } finally {
            stub.mockRestore()
        }
        expect(seen.size).toBeGreaterThan(1)
    })
})
