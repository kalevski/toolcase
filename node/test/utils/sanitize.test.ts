import { describe, it, expect } from 'vitest'
import { createSanitizer } from '../../src/utils/sanitize'
import { traverseEntity } from '../../src/utils/sanitize/sanitize'
import { coerceNumber } from '../../src/utils/sanitize/visitors'

describe('coerceNumber visitor', () => {
    function applyCoerceNumber(value: unknown): unknown {
        const result = traverseEntity(coerceNumber, { val: {} }, { val: value }) as Record<string, unknown>
        return result.val
    }

    it('coerces plain integer string', () => {
        expect(applyCoerceNumber('42')).toBe(42)
    })

    it('coerces decimal string', () => {
        expect(applyCoerceNumber('3.14')).toBe(3.14)
    })

    it('coerces negative string', () => {
        expect(applyCoerceNumber('-7')).toBe(-7)
    })

    it('rejects hex string (0x3e8)', () => {
        expect(applyCoerceNumber('0x3e8')).toBe('0x3e8')
    })

    it('rejects scientific notation (1e2)', () => {
        expect(applyCoerceNumber('1e2')).toBe('1e2')
    })

    it('rejects scientific notation with explicit exponent (2.5E10)', () => {
        expect(applyCoerceNumber('2.5E10')).toBe('2.5E10')
    })

    it('leaves non-string values unchanged', () => {
        expect(applyCoerceNumber(99)).toBe(99)
        expect(applyCoerceNumber(null)).toBe(null)
    })

    it('leaves empty string unchanged', () => {
        expect(applyCoerceNumber('')).toBe('')
    })
})

interface Item {
    name: string
    value: number
}

const schema = {
    name: { type: 'string' as const },
    value: { type: 'number' as const },
}

describe('prototype pollution guard', () => {
    describe('createSanitizer — fastPath (no custom visitors)', () => {
        const sanitizer = createSanitizer<Item>(schema)

        it('input: drops __proto__ and does not pollute Object prototype', () => {
            const poisoned = JSON.parse('{"__proto__":{"isAdmin":true},"name":"x","value":1}') as Record<string, unknown>
            const out = sanitizer.input(poisoned) as Record<string, unknown>
            expect(Object.keys(out)).not.toContain('__proto__')
            expect(({} as Record<string, unknown>).isAdmin).toBeUndefined()
        })

        it('input: drops constructor key', () => {
            const poisoned = JSON.parse('{"constructor":{"prototype":{"isAdmin":true}},"name":"x","value":1}') as Record<string, unknown>
            const out = sanitizer.input(poisoned) as Record<string, unknown>
            expect(Object.keys(out)).not.toContain('constructor')
        })

        it('input: drops prototype key', () => {
            const poisoned = JSON.parse('{"prototype":{"isAdmin":true},"name":"x","value":1}') as Record<string, unknown>
            const out = sanitizer.input(poisoned) as Record<string, unknown>
            expect(Object.keys(out)).not.toContain('prototype')
        })

        it('output: drops __proto__ and does not pollute Object prototype', () => {
            const poisoned = JSON.parse('{"__proto__":{"isAdmin":true},"name":"x","value":1}') as Record<string, unknown>
            const out = sanitizer.output(poisoned) as Record<string, unknown>
            expect(Object.keys(out)).not.toContain('__proto__')
            expect(({} as Record<string, unknown>).isAdmin).toBeUndefined()
        })

        it('output: drops constructor key', () => {
            const poisoned = JSON.parse('{"constructor":{"prototype":{"isAdmin":true}},"name":"x","value":1}') as Record<string, unknown>
            const out = sanitizer.output(poisoned) as Record<string, unknown>
            expect(Object.keys(out)).not.toContain('constructor')
        })

        it('query: drops __proto__ and does not pollute Object prototype', () => {
            const poisoned = JSON.parse('{"__proto__":{"isAdmin":true},"name":"x"}') as Record<string, unknown>
            const out = sanitizer.query(poisoned) as Record<string, unknown>
            expect(Object.keys(out)).not.toContain('__proto__')
            expect(({} as Record<string, unknown>).isAdmin).toBeUndefined()
        })

        it('query: drops constructor key', () => {
            const poisoned = JSON.parse('{"constructor":{"prototype":{"isAdmin":true}},"name":"x"}') as Record<string, unknown>
            const out = sanitizer.query(poisoned) as Record<string, unknown>
            expect(Object.keys(out)).not.toContain('constructor')
        })
    })

    describe('traverseEntity', () => {
        it('drops __proto__ and does not pollute Object prototype', () => {
            const poisoned = JSON.parse('{"__proto__":{"isAdmin":true},"name":"x","value":1}') as Record<string, unknown>
            const out = traverseEntity((_ctx, _actions) => {}, schema, poisoned) as Record<string, unknown>
            expect(Object.keys(out)).not.toContain('__proto__')
            expect(({} as Record<string, unknown>).isAdmin).toBeUndefined()
        })

        it('drops constructor key', () => {
            const poisoned = JSON.parse('{"constructor":{"prototype":{"isAdmin":true}},"name":"x","value":1}') as Record<string, unknown>
            const out = traverseEntity((_ctx, _actions) => {}, schema, poisoned) as Record<string, unknown>
            expect(Object.keys(out)).not.toContain('constructor')
        })

        it('drops prototype key', () => {
            const poisoned = JSON.parse('{"prototype":{"isAdmin":true},"name":"x","value":1}') as Record<string, unknown>
            const out = traverseEntity((_ctx, _actions) => {}, schema, poisoned) as Record<string, unknown>
            expect(Object.keys(out)).not.toContain('prototype')
        })
    })
})
