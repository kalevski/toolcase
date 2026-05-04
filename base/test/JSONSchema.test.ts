import { describe, it, expect } from 'vitest'
import JSONSchema from '../src/JSONSchema'

describe('JSONSchema', () => {
    it('validates a string', () => {
        const schema = new JSONSchema({ type: 'string' })
        expect(() => schema.validate('hello')).not.toThrow()
        expect(() => schema.validate(123)).toThrow()
    })

    it('validates a number', () => {
        const schema = new JSONSchema({ type: 'number' })
        expect(() => schema.validate(42)).not.toThrow()
        expect(() => schema.validate('42')).toThrow()
    })

    it('validates a boolean', () => {
        const schema = new JSONSchema({ type: 'boolean' })
        expect(() => schema.validate(true)).not.toThrow()
        expect(() => schema.validate('true')).toThrow()
    })

    it('validates an object with properties', () => {
        const schema = new JSONSchema({
            type: 'object',
            properties: {
                name: { type: 'string', required: true },
                age: { type: 'number' }
            }
        })
        expect(() => schema.validate({ name: 'Alice', age: 30 })).not.toThrow()
        expect(() => schema.validate({ name: 'Alice' })).not.toThrow()
    })

    it('rejects null as object', () => {
        const schema = new JSONSchema({ type: 'object', properties: {} })
        expect(() => schema.validate(null)).toThrow('must be an object')
    })

    it('rejects array as object', () => {
        const schema = new JSONSchema({ type: 'object', properties: {} })
        expect(() => schema.validate([1, 2])).toThrow('must be an object')
    })

    it('validates arrays', () => {
        const schema = new JSONSchema({
            type: 'array',
            items: { type: 'number' }
        })
        expect(() => schema.validate([1, 2, 3])).not.toThrow()
        expect(() => schema.validate([1, 'two', 3])).toThrow()
    })

    it('validates email type', () => {
        const schema = new JSONSchema({ type: 'email' })
        expect(() => schema.validate('test@example.com')).not.toThrow()
        expect(() => schema.validate('invalid')).toThrow()
    })

    it('validates url type', () => {
        const schema = new JSONSchema({ type: 'url' })
        expect(() => schema.validate('https://example.com')).not.toThrow()
        expect(() => schema.validate('not-a-url')).toThrow()
    })

    it('strict mode rejects unexpected properties', () => {
        const schema = new JSONSchema({
            type: 'object',
            properties: {
                name: { type: 'string' }
            }
        })
        expect(() => schema.validate({ name: 'Alice', extra: true })).toThrow('is not expected')
    })

    it('flexible mode allows extra properties', () => {
        const schema = new JSONSchema({
            type: 'object',
            flexible: true,
            properties: {
                name: { type: 'string' }
            }
        })
        expect(() => schema.validate({ name: 'Alice', extra: true })).not.toThrow()
    })

    it('nested object error includes the full dotted path', () => {
        const schema = new JSONSchema({
            type: 'object',
            properties: {
                user: {
                    type: 'object',
                    properties: {
                        profile: {
                            type: 'object',
                            properties: {
                                age: { type: 'number' }
                            }
                        }
                    }
                }
            }
        })
        try {
            schema.validate({ user: { profile: { age: 'twenty' } } })
            expect.unreachable()
        } catch (e: any) {
            expect(e.message).toContain('user.profile.age')
            expect(e.message).toContain('must be a number')
        }
    })

    it('array item error includes the index path', () => {
        const schema = new JSONSchema({
            type: 'array',
            items: { type: 'number' }
        })
        try {
            schema.validate([1, 2, 'oops', 4])
            expect.unreachable()
        } catch (e: any) {
            expect(e.message).toContain('[2]')
            expect(e.message).toContain('must be a number')
        }
    })

    it('object containing array of objects threads dotted + index paths', () => {
        const schema = new JSONSchema({
            type: 'object',
            properties: {
                tags: {
                    type: 'array',
                    items: {
                        type: 'object',
                        properties: {
                            name: { type: 'string', required: true }
                        }
                    }
                }
            }
        })
        try {
            schema.validate({ tags: [{ name: 'a' }, { name: 42 }] })
            expect.unreachable()
        } catch (e: any) {
            expect(e.message).toContain('tags[1].name')
            expect(e.message).toContain('must be a string')
        }
    })

    it('strict mode error names the unexpected nested property by dotted path', () => {
        const schema = new JSONSchema({
            type: 'object',
            properties: {
                user: {
                    type: 'object',
                    properties: {
                        name: { type: 'string' }
                    }
                }
            }
        })
        try {
            schema.validate({ user: { name: 'a', oops: true } })
            expect.unreachable()
        } catch (e: any) {
            expect(e.message).toContain('user.oops')
            expect(e.message).toContain('is not expected')
        }
    })
})
