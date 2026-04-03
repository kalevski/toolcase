import { describe, it, expect } from 'vitest'
import env from '../src/env.js'

describe('env', () => {
    it('reads an environment variable', () => {
        process.env.TEST_VAR = 'hello'
        expect(env('TEST_VAR')).toBe('hello')
        delete process.env.TEST_VAR
    })

    it('returns default when variable is not set', () => {
        expect(env('NONEXISTENT_VAR', 'fallback')).toBe('fallback')
    })

    it('returns empty string when variable is set to empty string', () => {
        process.env.EMPTY_VAR = ''
        expect(env('EMPTY_VAR', 'default')).toBe('')
        delete process.env.EMPTY_VAR
    })

    it('parses number type', () => {
        process.env.NUM_VAR = '42'
        expect(env('NUM_VAR', 0, 'number')).toBe(42)
        delete process.env.NUM_VAR
    })

    it('returns default for invalid number', () => {
        process.env.NUM_VAR = 'abc'
        expect(env('NUM_VAR', 99, 'number')).toBe(99)
        delete process.env.NUM_VAR
    })

    it('parses boolean type true', () => {
        process.env.BOOL_VAR = 'true'
        expect(env('BOOL_VAR', false, 'boolean')).toBe(true)
        delete process.env.BOOL_VAR
    })

    it('parses boolean type false', () => {
        process.env.BOOL_VAR = 'false'
        expect(env('BOOL_VAR', true, 'boolean')).toBe(false)
        delete process.env.BOOL_VAR
    })

    it('returns default for invalid boolean', () => {
        process.env.BOOL_VAR = 'maybe'
        expect(env('BOOL_VAR', true, 'boolean')).toBe(true)
        delete process.env.BOOL_VAR
    })
})
