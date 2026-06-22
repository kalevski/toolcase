import { describe, it, expect } from 'vitest'
import slugify from '../src/slugify'

describe('slugify', () => {

    it('lowercases and trims input', () => {
        expect(slugify('  Hello World  ')).toBe('hello-world')
    })

    it('replaces spaces with hyphens', () => {
        expect(slugify('hello world')).toBe('hello-world')
    })

    it('collapses multiple whitespace and hyphens', () => {
        expect(slugify('hello  --  world')).toBe('hello-world')
    })

    it('strips non-alphanumeric characters', () => {
        expect(slugify('Hello, World!')).toBe('hello-world')
    })

    it('strips diacritics', () => {
        expect(slugify('héllo wörld')).toBe('hello-world')
        expect(slugify('café')).toBe('cafe')
        expect(slugify('naïve')).toBe('naive')
    })

    it('removes leading and trailing hyphens', () => {
        expect(slugify('--hello--')).toBe('hello')
        expect(slugify('!hello!')).toBe('hello')
    })

    it('returns empty string for input with no alphanumeric content', () => {
        expect(slugify('!!!---')).toBe('')
        expect(slugify('')).toBe('')
    })

    it('handles already-valid slugs unchanged', () => {
        expect(slugify('hello-world')).toBe('hello-world')
        expect(slugify('my-slug-123')).toBe('my-slug-123')
    })

    it('handles underscores like hyphens', () => {
        expect(slugify('hello_world')).toBe('hello-world')
    })

    it('handles numeric-only input', () => {
        expect(slugify('12345')).toBe('12345')
    })

})
