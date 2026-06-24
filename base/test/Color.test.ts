import { describe, it, expect, vi } from 'vitest'
import Color from '../src/Color'

type ColorType = Parameters<typeof Color.getHex>[0]

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
            '#ffeb3b','#ffc107','#ff9800','#ff5722',
            '#795548','#9e9e9e','#607d8b','#ffffff','#000000',
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

    it('every ColorType member resolves via getHex and toNumber', () => {
        const allColors: ColorType[] = [
            'white', 'red', 'pink', 'purple', 'deep_purple', 'indigo', 'blue',
            'light_blue', 'cyan', 'teal', 'green', 'light_green', 'lime', 'yellow',
            'amber', 'orange', 'deep_orange', 'brown', 'grey', 'blue_grey', 'black',
        ]
        for (const c of allColors) {
            const hex = Color.getHex(c)
            expect(hex, `getHex(${c})`).not.toBeNull()
            expect(Color.toNumber(c), `toNumber(${c})`).toBe(parseInt(hex!.slice(1), 16))
        }
    })
})

describe('Color — WCAG contrast utilities', () => {
    describe('luminance', () => {
        it('white (#ffffff) has luminance 1', () => {
            expect(Color.luminance('#ffffff')).toBeCloseTo(1.0, 5)
        })

        it('black (#000000) has luminance 0', () => {
            expect(Color.luminance('#000000')).toBeCloseTo(0.0, 5)
        })

        it('mid-grey #767676 has luminance ~0.1812', () => {
            // WCAG reference: relative luminance of #767676 ≈ 0.1812
            // 118/255 = 0.46275 → linearized = ((0.46275 + 0.055) / 1.055)^2.4 ≈ 0.1812
            // (equal R, G, B channels, so luminance == the linearized channel value)
            expect(Color.luminance('#767676')).toBeCloseTo(0.1812, 3)
        })

        it('accepts 3-digit shorthand hex', () => {
            // #fff == #ffffff
            expect(Color.luminance('#fff')).toBeCloseTo(1.0, 5)
        })

        it('luminance is symmetric with channel order (all-grey)', () => {
            const l = Color.luminance('#595959')
            expect(l).toBeGreaterThan(0)
            expect(l).toBeLessThan(1)
        })
    })

    describe('contrastRatio', () => {
        it('white vs black = 21', () => {
            expect(Color.contrastRatio('#ffffff', '#000000')).toBeCloseTo(21.0, 5)
        })

        it('is commutative', () => {
            const ab = Color.contrastRatio('#2196f3', '#ffffff')
            const ba = Color.contrastRatio('#ffffff', '#2196f3')
            expect(ab).toBeCloseTo(ba, 10)
        })

        it('same color has contrast ratio 1', () => {
            expect(Color.contrastRatio('#4caf50', '#4caf50')).toBeCloseTo(1.0, 5)
        })

        it('#767676 vs white is ~4.54 (just above AA threshold)', () => {
            // Commonly cited WCAG boundary value
            expect(Color.contrastRatio('#767676', '#ffffff')).toBeCloseTo(4.54, 1)
        })

        it('#595959 vs white is ~7.0 (AAA threshold)', () => {
            // L(#595959) ≈ 0.10 → ratio = (1.05)/(0.15) ≈ 7.0
            expect(Color.contrastRatio('#595959', '#ffffff')).toBeCloseTo(7.0, 0)
        })
    })

    describe('readableOn', () => {
        it('black on white passes all WCAG levels', () => {
            const r = Color.readableOn('#000000', '#ffffff')
            expect(r.AA).toBe(true)
            expect(r.AAA).toBe(true)
            expect(r.AALarge).toBe(true)
            expect(r.AAALarge).toBe(true)
        })

        it('white on white fails all WCAG levels (ratio = 1)', () => {
            const r = Color.readableOn('#ffffff', '#ffffff')
            expect(r.AA).toBe(false)
            expect(r.AAA).toBe(false)
            expect(r.AALarge).toBe(false)
            expect(r.AAALarge).toBe(false)
        })

        it('#767676 on white passes AA but not AAA', () => {
            // contrast ~4.54 → AA pass (≥4.5), AAA fail (<7), large pass
            const r = Color.readableOn('#767676', '#ffffff')
            expect(r.AA).toBe(true)
            expect(r.AAA).toBe(false)
            expect(r.AALarge).toBe(true)
            expect(r.AAALarge).toBe(true)
        })

        it('#949494 on white passes only AALarge (contrast ~3.0)', () => {
            // L(#949494) ≈ 0.296 → ratio ≈ 3.04, passes AALarge (≥3.0) but not AA (≥4.5)
            const r = Color.readableOn('#949494', '#ffffff')
            expect(r.AA).toBe(false)
            expect(r.AAA).toBe(false)
            expect(r.AALarge).toBe(true)
            expect(r.AAALarge).toBe(false)
        })

        it('#595959 on white passes AA, AAA and all large levels', () => {
            // contrast ~7.0 → all levels pass
            const r = Color.readableOn('#595959', '#ffffff')
            expect(r.AA).toBe(true)
            expect(r.AAA).toBe(true)
            expect(r.AALarge).toBe(true)
            expect(r.AAALarge).toBe(true)
        })

        it('is symmetric — swapping fg/bg gives the same result', () => {
            const r1 = Color.readableOn('#2196f3', '#ffffff')
            const r2 = Color.readableOn('#ffffff', '#2196f3')
            expect(r1).toEqual(r2)
        })
    })
})
