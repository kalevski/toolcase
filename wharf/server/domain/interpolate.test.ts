import { describe, it, expect } from 'vitest'
import {
    interpolateAll,
    interpolateValue,
    InterpolationCycleError,
} from '@/server/domain/interpolate'

describe('interpolateValue', () => {
    it('substitutes a single reference', () => {
        expect(interpolateValue('host=${HOST}', (k) => (k === 'HOST' ? 'db' : undefined))).toBe(
            'host=db',
        )
    })

    it('resolves an unknown key to empty string', () => {
        expect(interpolateValue('x=${NOPE}', () => undefined)).toBe('x=')
    })

    it('escapes $$ to a literal $ and protects from reference parsing', () => {
        expect(interpolateValue('cost=$$5', () => undefined)).toBe('cost=$5')
        // `$${X}` must stay literal `${X}`, not interpolate X.
        expect(interpolateValue('$${X}', () => 'WRONG')).toBe('${X}')
    })

    it('passes a value with no references through unchanged', () => {
        expect(interpolateValue('plain-value', () => 'WRONG')).toBe('plain-value')
    })

    it('does not corrupt a value that contains the old sentinel substring (wharf D2)', () => {
        // The previous implementation split/joined on ` __WHARF_DOLLAR__ `; a real
        // value containing it round-tripped into a `$`. The single-pass regex never
        // touches it.
        expect(interpolateValue(' __WHARF_DOLLAR__ ', () => undefined)).toBe(
            ' __WHARF_DOLLAR__ ',
        )
    })

    it('collapses consecutive $$ escapes independently', () => {
        expect(interpolateValue('$$$$', () => undefined)).toBe('$$')
        expect(interpolateValue('a$$b$$c', () => undefined)).toBe('a$b$c')
    })
})

describe('interpolateAll', () => {
    it('does basic substitution against other values', () => {
        const out = interpolateAll({ HOST: 'db', URL: 'pg://${HOST}:5432' })
        expect(out).toEqual({ HOST: 'db', URL: 'pg://db:5432' })
    })

    it('resolves chained A -> B -> C', () => {
        const out = interpolateAll({ A: '${B}', B: '${C}', C: 'leaf' })
        expect(out).toEqual({ A: 'leaf', B: 'leaf', C: 'leaf' })
    })

    it('handles $$ escape', () => {
        const out = interpolateAll({ PRICE: '$$100', REF: '${PRICE}' })
        expect(out).toEqual({ PRICE: '$100', REF: '$100' })
    })

    it('resolves an unknown reference to empty string', () => {
        const out = interpolateAll({ A: 'before-${MISSING}-after' })
        expect(out).toEqual({ A: 'before--after' })
    })

    it('passes already-final strings (no ${}) through unchanged', () => {
        const out = interpolateAll({ SECRET: '<hidden:DB_PASS>', PLAIN: 'value' })
        expect(out).toEqual({ SECRET: '<hidden:DB_PASS>', PLAIN: 'value' })
    })

    it('throws InterpolationCycleError on A -> B -> A', () => {
        let thrown: unknown
        try {
            interpolateAll({ A: '${B}', B: '${A}' })
        } catch (err) {
            thrown = err
        }
        expect(thrown).toBeInstanceOf(InterpolationCycleError)
        expect((thrown as InterpolationCycleError).key).toMatch(/^[AB]$/)
    })

    it('throws InterpolationCycleError naming the self-referencing key', () => {
        let thrown: unknown
        try {
            interpolateAll({ SELF: '${SELF}' })
        } catch (err) {
            thrown = err
        }
        expect(thrown).toBeInstanceOf(InterpolationCycleError)
        expect((thrown as InterpolationCycleError).key).toBe('SELF')
    })
})
