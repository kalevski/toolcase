import { describe, it, expect } from 'vitest'
import { slugify, uniqueSlug } from '@/server/domain/slug'

describe('slugify', () => {
    it('lowercases and hyphenates', () => {
        expect(slugify('My Cool Project')).toBe('my-cool-project')
    })
    it('collapses non-alphanumeric runs and trims', () => {
        expect(slugify('  Foo___Bar!! ')).toBe('foo-bar')
    })
    it('strips diacritics', () => {
        expect(slugify('Café Déjà')).toBe('cafe-deja')
    })
    it('falls back to "project" for empty results', () => {
        expect(slugify('!!!')).toBe('project')
    })
})

describe('uniqueSlug', () => {
    it('returns the base slug when free', () => {
        expect(uniqueSlug('Acme API', () => false)).toBe('acme-api')
    })
    it('appends a numeric suffix on collision', () => {
        const taken = new Set(['acme-api', 'acme-api-2'])
        expect(uniqueSlug('Acme API', (s) => taken.has(s))).toBe('acme-api-3')
    })
})
