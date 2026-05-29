import { describe, it, expect } from 'vitest'
import { hexToRgb } from '../src/NormalMapGenerator/decode'

describe('hexToRgb', () => {
    it('parses 6-digit hex', () => {
        expect(hexToRgb('#8080ff')).toEqual([128, 128, 255])
        expect(hexToRgb('#000000')).toEqual([0, 0, 0])
        expect(hexToRgb('#ffffff')).toEqual([255, 255, 255])
    })

    it('expands 3-digit shorthand', () => {
        expect(hexToRgb('#08f')).toEqual([0, 136, 255])
        expect(hexToRgb('#fff')).toEqual([255, 255, 255])
    })

    it('tolerates a missing leading hash and whitespace', () => {
        expect(hexToRgb('8080ff')).toEqual([128, 128, 255])
        expect(hexToRgb('  #8080ff  ')).toEqual([128, 128, 255])
    })

    it('falls back to flat up-normal on invalid input', () => {
        expect(hexToRgb('#zzzzzz')).toEqual([128, 128, 255])
        expect(hexToRgb('nope')).toEqual([128, 128, 255])
    })
})
