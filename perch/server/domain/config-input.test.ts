import { describe, it, expect } from 'vitest'
import { isValidKey, isValidInstanceName, isValidTag, normalizeTags } from '@/server/domain/config-input'

describe('isValidKey', () => {
    it('accepts leading letter/underscore then alnum/underscore', () => {
        expect(isValidKey('FOO')).toBe(true)
        expect(isValidKey('_foo')).toBe(true)
        expect(isValidKey('FOO_BAR_123')).toBe(true)
    })

    it('rejects a leading digit, empty string, or embedded punctuation', () => {
        expect(isValidKey('1FOO')).toBe(false)
        expect(isValidKey('')).toBe(false)
        expect(isValidKey('FOO-BAR')).toBe(false)
        expect(isValidKey('FOO.BAR')).toBe(false)
    })
})

describe('isValidInstanceName', () => {
    it('accepts lowercase alnum + internal hyphens', () => {
        expect(isValidInstanceName('api-prod-1')).toBe(true)
        expect(isValidInstanceName('a')).toBe(true)
        expect(isValidInstanceName('a1')).toBe(true)
    })

    it('rejects uppercase, leading/trailing hyphen, and empty', () => {
        expect(isValidInstanceName('Api-Prod')).toBe(false)
        expect(isValidInstanceName('-api')).toBe(false)
        expect(isValidInstanceName('api-')).toBe(false)
        expect(isValidInstanceName('')).toBe(false)
    })
})

describe('isValidTag', () => {
    it('accepts lowercase alnum/hyphen/underscore up to 32 chars', () => {
        expect(isValidTag('api')).toBe(true)
        expect(isValidTag('production')).toBe(true)
        expect(isValidTag('a_b-1')).toBe(true)
    })

    it('rejects empty, a leading hyphen/underscore, uppercase, or over-length', () => {
        expect(isValidTag('')).toBe(false)
        expect(isValidTag('-api')).toBe(false)
        expect(isValidTag('_api')).toBe(false)
        expect(isValidTag('API')).toBe(false)
        expect(isValidTag('a'.repeat(33))).toBe(false)
        expect(isValidTag('a'.repeat(32))).toBe(true)
    })
})

describe('normalizeTags', () => {
    it('trims, drops empties, and dedupes', () => {
        const result = normalizeTags([' api ', 'api', 'production', ''])
        expect(result.ok).toBe(true)
        if (result.ok) expect(result.tags.sort()).toEqual(['api', 'production'])
    })

    it('treats a non-array as an empty tag set', () => {
        const result = normalizeTags(undefined)
        expect(result).toEqual({ ok: true, tags: [] })
    })

    it('rejects the first invalid entry', () => {
        const result = normalizeTags(['api', 'Bad Tag'])
        expect(result).toEqual({ ok: false, invalid: 'Bad Tag' })
    })

    it('rejects a non-string entry', () => {
        const result = normalizeTags(['api', 42])
        expect(result.ok).toBe(false)
    })
})
