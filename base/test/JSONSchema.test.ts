import { describe, it, expect } from 'vitest'
import JSONSchema from '../src/JSONSchema'

describe('JSONSchema', () => {
    it('validates a string', () => {
        const schema = new JSONSchema({ type: 'string' })
        expect(schema.validate('hello')).toBe(true)
        expect(schema.getLatestError()).toBeNull()
        expect(schema.validate(123)).toBe(false)
        expect(schema.getLatestError()?.issues).toHaveLength(1)
    })

    it('validates a number', () => {
        const schema = new JSONSchema({ type: 'number' })
        expect(schema.validate(42)).toBe(true)
        expect(schema.validate('42')).toBe(false)
    })

    it('validates a boolean', () => {
        const schema = new JSONSchema({ type: 'boolean' })
        expect(schema.validate(true)).toBe(true)
        expect(schema.validate('true')).toBe(false)
    })

    it('validates an object with properties', () => {
        const schema = new JSONSchema({
            type: 'object',
            properties: {
                name: { type: 'string', required: true },
                age: { type: 'number' }
            }
        })
        expect(schema.validate({ name: 'Alice', age: 30 })).toBe(true)
        expect(schema.validate({ name: 'Alice' })).toBe(true)
    })

    it('rejects null as object', () => {
        const schema = new JSONSchema({ type: 'object', properties: {} })
        expect(schema.validate(null)).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toContain('must be an object')
    })

    it('rejects array as object', () => {
        const schema = new JSONSchema({ type: 'object', properties: {} })
        expect(schema.validate([1, 2])).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toContain('must be an object')
    })

    it('validates arrays', () => {
        const schema = new JSONSchema({
            type: 'array',
            items: { type: 'number' }
        })
        expect(schema.validate([1, 2, 3])).toBe(true)
        expect(schema.validate([1, 'two', 3])).toBe(false)
    })

    it('validates email type', () => {
        const schema = new JSONSchema({ type: 'email' })
        expect(schema.validate('test@example.com')).toBe(true)
        expect(schema.validate('invalid')).toBe(false)
    })

    it('validates url type', () => {
        const schema = new JSONSchema({ type: 'url' })
        expect(schema.validate('https://example.com')).toBe(true)
        expect(schema.validate('not-a-url')).toBe(false)
    })

    it('strict mode rejects unexpected properties', () => {
        const schema = new JSONSchema({
            type: 'object',
            properties: {
                name: { type: 'string' }
            }
        })
        expect(schema.validate({ name: 'Alice', extra: true })).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toContain('is not expected')
    })

    it('flexible mode allows extra properties', () => {
        const schema = new JSONSchema({
            type: 'object',
            flexible: true,
            properties: {
                name: { type: 'string' }
            }
        })
        expect(schema.validate({ name: 'Alice', extra: true })).toBe(true)
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
        expect(schema.validate({ user: { profile: { age: 'twenty' } } })).toBe(false)
        const issue = schema.getLatestError()?.issues[0]
        expect(issue?.path).toBe('user.profile.age')
        expect(issue?.message).toContain('user.profile.age')
        expect(issue?.message).toContain('must be a number')
    })

    it('array item error includes the index path', () => {
        const schema = new JSONSchema({
            type: 'array',
            items: { type: 'number' }
        })
        expect(schema.validate([1, 2, 'oops', 4])).toBe(false)
        const issue = schema.getLatestError()?.issues[0]
        expect(issue?.path).toBe('[2]')
        expect(issue?.message).toContain('[2]')
        expect(issue?.message).toContain('must be a number')
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
        expect(schema.validate({ tags: [{ name: 'a' }, { name: 42 }] })).toBe(false)
        const issue = schema.getLatestError()?.issues[0]
        expect(issue?.path).toBe('tags[1].name')
        expect(issue?.message).toContain('tags[1].name')
        expect(issue?.message).toContain('must be a string')
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
        expect(schema.validate({ user: { name: 'a', oops: true } })).toBe(false)
        const issue = schema.getLatestError()?.issues[0]
        expect(issue?.path).toBe('user.oops')
        expect(issue?.message).toContain('user.oops')
        expect(issue?.message).toContain('is not expected')
    })

    it('collects all issues in one validation pass', () => {
        const schema = new JSONSchema({
            type: 'object',
            properties: {
                name: { type: 'string', required: true },
                age: { type: 'number', required: true },
                email: { type: 'email' },
                tags: { type: 'array', items: { type: 'string' } }
            }
        })
        expect(schema.validate({ age: 'old', email: 'bad', tags: [1, 'ok', 2] })).toBe(false)
        const issues = schema.getLatestError()?.issues ?? []
        const paths = issues.map(i => i.path)
        expect(paths).toContain('name')
        expect(paths).toContain('age')
        expect(paths).toContain('email')
        expect(paths).toContain('tags[0]')
        expect(paths).toContain('tags[2]')
    })

    it('clears latest error after a successful validation', () => {
        const schema = new JSONSchema({ type: 'string' })
        schema.validate(123)
        expect(schema.getLatestError()).not.toBeNull()
        expect(schema.validate('ok')).toBe(true)
        expect(schema.getLatestError()).toBeNull()
    })

    it('USERNAME_REGEX rejects non-letter first char (H1)', () => {
        const schema = new JSONSchema({ type: 'username' })
        expect(schema.validate('[abcd')).toBe(false)
        expect(schema.validate('_abcd')).toBe(false)
        expect(schema.validate('Abcd')).toBe(true)
    })

    it('USERNAME_REGEX rejects punctuation in tail (H2)', () => {
        const schema = new JSONSchema({ type: 'username' })
        expect(schema.validate('aaa@@@')).toBe(false)
        expect(schema.validate('aaa<<<')).toBe(false)
        expect(schema.validate('aaa-_-')).toBe(true)
    })

    it('EMAIL_REGEX is anchored — no substring match (H3)', () => {
        const schema = new JSONSchema({ type: 'email' })
        expect(schema.validate(' not an email foo@bar.com leftover ')).toBe(false)
        expect(schema.validate('foo@bar.com')).toBe(true)
    })

    it('URL_REGEX is anchored — no substring match (H4)', () => {
        const schema = new JSONSchema({ type: 'url' })
        expect(schema.validate('garbage https://x.com garbage')).toBe(false)
        expect(schema.validate('https://x.com')).toBe(true)
    })

    it('null property schema does not masquerade as unknown (H5)', () => {
        const schema = new JSONSchema({
            type: 'object',
            properties: {
                name: null as any
            }
        })
        expect(() => schema.validate({ name: 'a' })).toThrow()
    })

    it('missing required property emits "is required" error (H6)', () => {
        const schema = new JSONSchema({
            type: 'object',
            properties: {
                name: { type: 'string', required: true }
            }
        })
        expect(schema.validate({})).toBe(false)
        const issue = schema.getLatestError()?.issues[0]
        expect(issue?.path).toBe('name')
        expect(issue?.message).toMatch(/name.*is required/)
    })

    it('rejects properties on primitive schema (M7)', () => {
        const schema = new JSONSchema({
            type: 'string',
            properties: { x: { type: 'number' } }
        } as any)
        expect(() => schema.validate('hi')).toThrow()
    })

    it('rejects items on object schema (M7)', () => {
        const schema = new JSONSchema({
            type: 'object',
            items: { type: 'number' }
        } as any)
        expect(() => schema.validate({})).toThrow()
    })

    it('top-level required reports issue on undefined (M8)', () => {
        const schema = new JSONSchema({ type: 'string', required: true })
        expect(schema.validate(undefined)).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toContain('is required')
    })

    it('top-level optional accepts undefined (M8)', () => {
        const schema = new JSONSchema({ type: 'string' })
        expect(schema.validate(undefined)).toBe(true)
    })

    it('register() works after construction for schema types (M9)', () => {
        const schema = new JSONSchema({ type: 'foo' as any })
        schema.register('foo', (_p, _s, data, issues) => {
            if (typeof data !== 'number') {
                issues.push({ path: '@', message: 'not a number' })
            }
        })
        expect(schema.validate(42)).toBe(true)
        expect(schema.validate('x')).toBe(false)
    })

    it('throwing custom validator is captured as an issue', () => {
        const schema = new JSONSchema({ type: 'foo' as any })
        schema.register('foo', () => {
            throw new Error('boom')
        })
        expect(schema.validate('anything')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toBe('boom')
    })

    it('schema is defensively cloned (L16)', () => {
        const raw: any = {
            type: 'object',
            properties: { name: { type: 'string' } }
        }
        const schema = new JSONSchema(raw)
        raw.properties.name.type = 'number'
        expect(schema.validate({ name: 'still-a-string' })).toBe(true)
    })

    it('password error reads "is too weak" (L12)', () => {
        const schema = new JSONSchema({ type: 'password' })
        expect(schema.validate('weak')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/too weak/)
    })

    it('url error reads "must be a valid URL" (L13)', () => {
        const schema = new JSONSchema({ type: 'url' })
        expect(schema.validate('not-a-url')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be a valid URL/)
    })

    it('validates integer type', () => {
        const schema = new JSONSchema({ type: 'integer' })
        expect(schema.validate(42)).toBe(true)
        expect(schema.validate(-7)).toBe(true)
        expect(schema.validate(0)).toBe(true)
        expect(schema.validate(3.14)).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be an integer/)
        expect(schema.validate('42')).toBe(false)
        expect(schema.validate(NaN)).toBe(false)
    })

    it('validates uuid type', () => {
        const schema = new JSONSchema({ type: 'uuid' })
        expect(schema.validate('550e8400-e29b-41d4-a716-446655440000')).toBe(true)
        expect(schema.validate('f47ac10b-58cc-4372-a567-0e02b2c3d479')).toBe(true)
        expect(schema.validate('not-a-uuid')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be a valid UUID/)
        expect(schema.validate('550e8400-e29b-41d4-a716-4466554400zz')).toBe(false)
    })

    it('UUIDv7 now validates (widened regex)', () => {
        const schema = new JSONSchema({ type: 'uuid' })
        expect(schema.validate('018fb2d0-58ce-7c93-9de1-a9b7d98b4e7b')).toBe(true)
        expect(schema.validate('00000000-0000-0000-0000-000000000000')).toBe(true)
    })

    it('validates date type (YYYY-MM-DD)', () => {
        const schema = new JSONSchema({ type: 'date' })
        expect(schema.validate('2026-05-04')).toBe(true)
        expect(schema.validate('2026-13-01')).toBe(false)
        expect(schema.validate('2026-05-32')).toBe(false)
        expect(schema.validate('05-04-2026')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be a valid ISO date/)
    })

    it('validates datetime type (ISO 8601)', () => {
        const schema = new JSONSchema({ type: 'datetime' })
        expect(schema.validate('2026-05-04T12:34:56Z')).toBe(true)
        expect(schema.validate('2026-05-04T12:34:56.789Z')).toBe(true)
        expect(schema.validate('2026-05-04T12:34:56+02:00')).toBe(true)
        expect(schema.validate('2026-05-04 12:34:56')).toBe(false)
        expect(schema.validate('2026-05-04T12:34:56')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be a valid ISO 8601 datetime/)
    })

    it('validates ipv4 type', () => {
        const schema = new JSONSchema({ type: 'ipv4' })
        expect(schema.validate('192.168.1.1')).toBe(true)
        expect(schema.validate('0.0.0.0')).toBe(true)
        expect(schema.validate('255.255.255.255')).toBe(true)
        expect(schema.validate('256.0.0.1')).toBe(false)
        expect(schema.validate('192.168.1')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be a valid IPv4/)
    })

    it('validates ipv6 type', () => {
        const schema = new JSONSchema({ type: 'ipv6' })
        expect(schema.validate('2001:0db8:85a3:0000:0000:8a2e:0370:7334')).toBe(true)
        expect(schema.validate('::1')).toBe(true)
        expect(schema.validate('fe80::1')).toBe(true)
        expect(schema.validate('192.168.1.1')).toBe(false)
        expect(schema.validate('not-ip')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be a valid IPv6/)
    })

    it('validates hex color type', () => {
        const schema = new JSONSchema({ type: 'hex' })
        expect(schema.validate('#fff')).toBe(true)
        expect(schema.validate('#FFFFFF')).toBe(true)
        expect(schema.validate('#a1b2c3d4')).toBe(true)
        expect(schema.validate('#abcd')).toBe(true)
        expect(schema.validate('fff')).toBe(false)
        expect(schema.validate('#xyz')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be a valid hex color/)
    })

    it('validates slug type', () => {
        const schema = new JSONSchema({ type: 'slug' })
        expect(schema.validate('hello-world')).toBe(true)
        expect(schema.validate('post-123')).toBe(true)
        expect(schema.validate('Hello-World')).toBe(false)
        expect(schema.validate('hello--world')).toBe(false)
        expect(schema.validate('-hello')).toBe(false)
        expect(schema.validate('hello-')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be a valid slug/)
    })

    it('validates semver type', () => {
        const schema = new JSONSchema({ type: 'semver' })
        expect(schema.validate('1.0.0')).toBe(true)
        expect(schema.validate('2.4.7-alpha.1')).toBe(true)
        expect(schema.validate('1.0.0+build.123')).toBe(true)
        expect(schema.validate('1.0.0-rc.1+exp.sha.5114f85')).toBe(true)
        expect(schema.validate('v1.0.0')).toBe(false)
        expect(schema.validate('1.0')).toBe(false)
        expect(schema.validate('01.0.0')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be a valid semver/)
    })

    it('validates base64 type', () => {
        const schema = new JSONSchema({ type: 'base64' })
        expect(schema.validate('SGVsbG8=')).toBe(true)
        expect(schema.validate('Zm9vYmFy')).toBe(true)
        expect(schema.validate('YQ==')).toBe(true)
        expect(schema.validate('not base64!')).toBe(false)
        expect(schema.validate('SGVsbG8')).toBe(false)
        expect(schema.validate('')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be a valid base64/)
    })

    it('password with ^&* specials now validates (widened regex)', () => {
        const schema = new JSONSchema({ type: 'password' })
        expect(schema.validate('Secret^1ab')).toBe(true)
        expect(schema.validate('Pass&word1')).toBe(true)
        expect(schema.validate('Abc*1defgh')).toBe(true)
        expect(schema.validate('weakpassword')).toBe(false)
    })

    it('minLength constraint on string', () => {
        const schema = new JSONSchema({ type: 'string', minLength: 5 })
        expect(schema.validate('hello')).toBe(true)
        expect(schema.validate('hi')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/at least 5 characters/)
    })

    it('maxLength constraint on string', () => {
        const schema = new JSONSchema({ type: 'string', maxLength: 5 })
        expect(schema.validate('hello')).toBe(true)
        expect(schema.validate('toolong')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/at most 5 characters/)
    })

    it('pattern constraint on string', () => {
        const schema = new JSONSchema({ type: 'string', pattern: '^[0-9]+$' })
        expect(schema.validate('12345')).toBe(true)
        expect(schema.validate('abc')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must match pattern/)
    })

    it('enum constraint on string', () => {
        const schema = new JSONSchema({ type: 'string', enum: ['a', 'b', 'c'] })
        expect(schema.validate('b')).toBe(true)
        expect(schema.validate('d')).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be one of/)
    })

    it('min constraint on number', () => {
        const schema = new JSONSchema({ type: 'number', min: 10 })
        expect(schema.validate(10)).toBe(true)
        expect(schema.validate(9.9)).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/>= 10/)
    })

    it('max constraint on number', () => {
        const schema = new JSONSchema({ type: 'number', max: 100 })
        expect(schema.validate(100)).toBe(true)
        expect(schema.validate(100.1)).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/<= 100/)
    })

    it('min/max constraints on integer', () => {
        const schema = new JSONSchema({ type: 'integer', min: 1, max: 10 })
        expect(schema.validate(5)).toBe(true)
        expect(schema.validate(0)).toBe(false)
        expect(schema.validate(11)).toBe(false)
    })

    it('enum constraint on number', () => {
        const schema = new JSONSchema({ type: 'number', enum: [1, 2, 3] })
        expect(schema.validate(2)).toBe(true)
        expect(schema.validate(4)).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/must be one of/)
    })

    it('minItems constraint on array', () => {
        const schema = new JSONSchema({ type: 'array', minItems: 2 })
        expect(schema.validate([1, 2])).toBe(true)
        expect(schema.validate([1])).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/at least 2 items/)
    })

    it('maxItems constraint on array', () => {
        const schema = new JSONSchema({ type: 'array', maxItems: 3 })
        expect(schema.validate([1, 2, 3])).toBe(true)
        expect(schema.validate([1, 2, 3, 4])).toBe(false)
        expect(schema.getLatestError()?.issues[0].message).toMatch(/at most 3 items/)
    })
})
