import { describe, it, expect } from 'vitest'
import potCeil from '../../src/packing/potCeil'

describe('potCeil', () => {
    it('returns 1 for values <= 1', () => {
        expect(potCeil(0)).toBe(1)
        expect(potCeil(1)).toBe(1)
        expect(potCeil(-5)).toBe(1)
    })

    it('returns same value when already POT', () => {
        expect(potCeil(64)).toBe(64)
        expect(potCeil(2048)).toBe(2048)
    })

    it('rounds up to next POT', () => {
        expect(potCeil(3)).toBe(4)
        expect(potCeil(5)).toBe(8)
        expect(potCeil(33)).toBe(64)
        expect(potCeil(1025)).toBe(2048)
    })
})
