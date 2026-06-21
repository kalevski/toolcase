import { describe, it, expect, vi } from 'vitest'
import env from '../src/env'

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

    it('warns when env value is present but unparseable as number', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        process.env.NUM_WARN = 'abc'
        env('NUM_WARN', 0, 'number')
        expect(warn).toHaveBeenCalledOnce()
        expect(warn.mock.calls[0][0]).toContain('NUM_WARN')
        delete process.env.NUM_WARN
        warn.mockRestore()
    })

    it('warns for leading-zero octal-like values (007)', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        process.env.NUM_007 = '007'
        env('NUM_007', 0, 'number')
        expect(warn).toHaveBeenCalledOnce()
        delete process.env.NUM_007
        warn.mockRestore()
    })

    it('warns for whitespace-padded values (" 42")', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        process.env.NUM_SPACE = ' 42'
        env('NUM_SPACE', 0, 'number')
        expect(warn).toHaveBeenCalledOnce()
        delete process.env.NUM_SPACE
        warn.mockRestore()
    })

    it('does not warn when env number value is missing', () => {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
        expect(env('TOTALLY_MISSING_NUM_VAR', 7, 'number')).toBe(7)
        expect(warn).not.toHaveBeenCalled()
        warn.mockRestore()
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
