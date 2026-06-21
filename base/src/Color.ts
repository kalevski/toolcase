type ColorType = 'white' | 'red' | 'pink' | 'purple' | 'deep_purple' | 'indigo' | 'blue' | 'light_blue' | 'cyan' | 'teal' | 'green' | 'light_green' | 'lime' | 'yellow' | 'amber' | 'orange' | 'deep_orange' | 'brown' | 'grey' | 'blue_grey' | 'black'

type WCAGReadability = {
    AA: boolean
    AAA: boolean
    AALarge: boolean
    AAALarge: boolean
}

function _srgbToLinear(c: number): number {
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)
}

function _parseHex(hex: string): [number, number, number] {
    const h = hex.charAt(0) === '#' ? hex.slice(1) : hex
    if (h.length === 3) {
        return [
            parseInt(h[0] + h[0], 16) / 255,
            parseInt(h[1] + h[1], 16) / 255,
            parseInt(h[2] + h[2], 16) / 255,
        ]
    }
    return [
        parseInt(h.slice(0, 2), 16) / 255,
        parseInt(h.slice(2, 4), 16) / 255,
        parseInt(h.slice(4, 6), 16) / 255,
    ]
}

const PALETTE: Record<string, string> = {
    RED: '#f44336',
    PINK: '#e91e63',
    PURPLE: '#9c27b0',
    DEEP_PURPLE: '#673ab7',
    INDIGO: '#3f51b5',
    BLUE: '#2196f3',
    LIGHT_BLUE: '#03a9f4',
    CYAN: '#00bcd4',
    TEAL: '#009688',
    GREEN: '#4caf50',
    LIGHT_GREEN: '#8bc34a',
    LIME: '#cddc39',
    YELLOW: '#ffeb3b',
    AMBER: '#ffc107',
    ORANGE: '#ff9800',
    DEEP_ORANGE: '#ff5722',
    BROWN: '#795548',
    GREY: '#9e9e9e',
    BLUE_GREY: '#607d8b',
    WHITE: '#ffffff',
    BLACK: '#000000',
}

const Color: Record<string, string | ((...args: any[]) => any)> & {
    getHex: (color: ColorType) => string | null
    toNumber: (color: ColorType) => number
    getRandomHex: () => string
    luminance: (hex: string) => number
    contrastRatio: (a: string, b: string) => number
    readableOn: (fg: string, bg: string) => WCAGReadability
} = {
    ...PALETTE,

    getHex: (color: ColorType): string | null => {
        const key = color.toUpperCase()
        return PALETTE[key] || null
    },

    toNumber: (color: ColorType): number => {
        const hex = Color.getHex(color)
        if (hex === null) {
            return 0
        }
        return parseInt(hex.split('#')[1], 16)
    },

    getRandomHex: (): string => {
        const keys = Object.keys(PALETTE)
        const index = Math.floor(Math.random() * keys.length)
        return PALETTE[keys[index]]
    },

    luminance: (hex: string): number => {
        const [r, g, b] = _parseHex(hex)
        return 0.2126 * _srgbToLinear(r) + 0.7152 * _srgbToLinear(g) + 0.0722 * _srgbToLinear(b)
    },

    contrastRatio: (a: string, b: string): number => {
        const l1 = Color.luminance(a)
        const l2 = Color.luminance(b)
        const lighter = Math.max(l1, l2)
        const darker = Math.min(l1, l2)
        return (lighter + 0.05) / (darker + 0.05)
    },

    readableOn: (fg: string, bg: string): WCAGReadability => {
        const ratio = Color.contrastRatio(fg, bg)
        return {
            AA: ratio >= 4.5,
            AAA: ratio >= 7.0,
            AALarge: ratio >= 3.0,
            AAALarge: ratio >= 4.5,
        }
    },
}

export default Color
