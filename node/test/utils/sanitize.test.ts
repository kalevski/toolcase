import { describe, it, expect } from 'vitest'
import { createSanitizer } from '../../src/utils/sanitize'
import { traverseEntity } from '../../src/utils/sanitize/sanitize'

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
