import { describe, it, expect } from 'vitest'
import bufferToHex from '../src/bufferToHex'
import hexToBuffer from '../src/hexToBuffer'

describe('bufferToHex', () => {
    it('converts Uint8Array to hex string', () => {
        const buffer = new Uint8Array([0, 255, 16])
        expect(bufferToHex(buffer)).toBe('00ff10')
    })

    it('handles empty buffer', () => {
        expect(bufferToHex(new Uint8Array([]))).toBe('')
    })

    it('pads single-digit hex values', () => {
        expect(bufferToHex(new Uint8Array([1]))).toBe('01')
    })
})

describe('hexToBuffer', () => {
    it('converts hex string to Uint8Array', () => {
        const result = hexToBuffer('00ff10')
        expect(result).toEqual(new Uint8Array([0, 255, 16]))
    })

    it('handles single byte', () => {
        expect(hexToBuffer('ff')).toEqual(new Uint8Array([255]))
    })
})

describe('bufferToHex <-> hexToBuffer roundtrip', () => {
    it('roundtrips correctly', () => {
        const original = new Uint8Array([10, 20, 30, 40, 255])
        const hex = bufferToHex(original)
        const restored = hexToBuffer(hex)
        expect(restored).toEqual(original)
    })
})
