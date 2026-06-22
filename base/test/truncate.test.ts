import { describe, it, expect } from 'vitest'
import truncate from '../src/truncate'

describe('truncate', () => {

    it('returns input unchanged when at or under maxLength', () => {
        expect(truncate('hello', 5)).toBe('hello')
        expect(truncate('hi', 5)).toBe('hi')
    })

    it('truncates and appends default ellipsis', () => {
        expect(truncate('hello world', 8)).toBe('hello w…')
    })

    it('uses custom suffix', () => {
        expect(truncate('hello world', 8, '...')).toBe('hello...')
    })

    it('handles maxLength equal to suffix length', () => {
        expect(truncate('hello world', 3, '...')).toBe('...')
    })

    it('handles maxLength shorter than suffix', () => {
        expect(truncate('hello world', 2, '...')).toBe('..')
    })

    it('returns empty string when maxLength is 0 and suffix is empty', () => {
        expect(truncate('hello', 0, '')).toBe('')
    })

    it('returns full string when suffix is empty and input fits', () => {
        expect(truncate('hello', 5, '')).toBe('hello')
    })

    it('truncates without suffix when suffix is empty', () => {
        expect(truncate('hello world', 5, '')).toBe('hello')
    })

    it('handles empty input', () => {
        expect(truncate('', 5)).toBe('')
        expect(truncate('', 0)).toBe('')
    })

    it('truncates to exact boundary', () => {
        expect(truncate('abcdefgh', 5)).toBe('abcd…')
    })

})
