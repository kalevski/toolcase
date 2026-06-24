import { describe, it, expect } from 'vitest'
import { encodeCursor, decodeCursor } from '../src/utils/cursor'
import { ValidationError } from '../src/errors'

describe('cursor round-trips', () => {

    it('encodes and decodes a string', () => {
        const cursor = encodeCursor('hello')
        expect(decodeCursor(cursor)).toBe('hello')
    })

    it('encodes and decodes a number', () => {
        const cursor = encodeCursor(42.5)
        expect(decodeCursor(cursor)).toBe(42.5)
    })

    it('encodes and decodes a bigint', () => {
        const cursor = encodeCursor(9007199254740993n)
        expect(decodeCursor(cursor)).toBe(9007199254740993n)
    })

    it('encodes and decodes a Date', () => {
        const date = new Date('2024-01-15T12:00:00.000Z')
        const cursor = encodeCursor(date)
        const decoded = decodeCursor(cursor) as Date
        expect(decoded).toBeInstanceOf(Date)
        expect(decoded.toISOString()).toBe(date.toISOString())
    })

    it('encodes and decodes a boolean true', () => {
        expect(decodeCursor(encodeCursor(true))).toBe(true)
    })

    it('encodes and decodes a boolean false', () => {
        expect(decodeCursor(encodeCursor(false))).toBe(false)
    })
})

describe('decodeCursor rejects tampered input', () => {

    it('throws ValidationError for garbage input', () => {
        expect(() => decodeCursor('not-a-real-cursor!!!')).toThrow(ValidationError)
    })

    it('throws ValidationError for empty string', () => {
        expect(() => decodeCursor('')).toThrow(ValidationError)
    })

    it('throws ValidationError for a tampered bigint (g: branch)', () => {
        // base64url-encode a tampered "g:" payload
        const tampered = Buffer.from('g:not-a-bigint', 'utf8').toString('base64url')
        expect(() => decodeCursor(tampered)).toThrow(ValidationError)
    })

    it('throws ValidationError for a malformed date (d: branch)', () => {
        const tampered = Buffer.from('d:not-a-date', 'utf8').toString('base64url')
        expect(() => decodeCursor(tampered)).toThrow(ValidationError)
    })

    it('throws ValidationError for a non-finite number (n: branch)', () => {
        const tampered = Buffer.from('n:NaN', 'utf8').toString('base64url')
        expect(() => decodeCursor(tampered)).toThrow(ValidationError)
    })

    it('throws ValidationError for an unknown type tag', () => {
        const tampered = Buffer.from('z:something', 'utf8').toString('base64url')
        expect(() => decodeCursor(tampered)).toThrow(ValidationError)
    })

    it('throws ValidationError for payload with no colon', () => {
        const tampered = Buffer.from('nocursorformat', 'utf8').toString('base64url')
        expect(() => decodeCursor(tampered)).toThrow(ValidationError)
    })

    it('error message does not echo the raw cursor', () => {
        const raw = 'g:totally-tampered-value'
        const tampered = Buffer.from(raw, 'utf8').toString('base64url')
        let message = ''
        try {
            decodeCursor(tampered)
        } catch (e) {
            message = (e as Error).message
        }
        expect(message).not.toContain(raw)
        expect(message).not.toContain(tampered)
    })
})
