import { describe, it, expect } from 'vitest'
import { parseFilters } from '../../src/utils/parseFilters'
import { FieldSchema } from '../../src/utils/sanitize'
import { ValidationError } from '../../src/errors'

interface Row {
    email: string
    age: number
    status: string
    deletedAt: Date | null
    isAdmin: boolean
    createdAt: Date
}

describe('parseFilters', () => {

    it('throws when neither allowedFields nor schema provided', () => {
        expect(() => parseFilters({ email: 'x' })).toThrow('parseFilters: pass allowedFields or schema; [] to allow none')
    })

    it('throws when neither allowedFields nor schema provided even on empty query', () => {
        expect(() => parseFilters({})).toThrow('parseFilters: pass allowedFields or schema; [] to allow none')
    })

    it('returns {} on empty query', () => {
        expect(parseFilters({}, { allowedFields: [] })).toEqual({})
    })

    it('emits eq for top-level scalar', () => {
        expect(parseFilters({ email: 'foo@bar.com' }, { allowedFields: ['email'] })).toEqual({ email: 'foo@bar.com' })
    })

    it('emits multiple eq for multiple keys', () => {
        expect(parseFilters({ email: 'a', status: 'active' }, { allowedFields: ['email', 'status'] })).toEqual({ email: 'a', status: 'active' })
    })

    it('emits IN for top-level array', () => {
        expect(parseFilters({ ids: ['1', '2'] }, { allowedFields: ['ids'] })).toEqual({ ids: ['1', '2'] })
    })

    it('parses bracket op [gte] without coercion (no schema)', () => {
        const out = parseFilters({ age: { gte: '18' } }, { allowedFields: ['age'] })
        expect(out).toEqual({ age: { gte: '18' } })
    })

    it('parses [in] with csv split', () => {
        const out = parseFilters({ status: { in: 'active,pending' } }, { allowedFields: ['status'] })
        expect(out).toEqual({ status: { in: ['active', 'pending'] } })
    })

    it('parses [in] empty string → []', () => {
        const out = parseFilters({ status: { in: '' } }, { allowedFields: ['status'] })
        expect(out).toEqual({ status: { in: [] } })
    })

    it('parses [isNull] truthy → true', () => {
        expect(parseFilters({ deletedAt: { isNull: '1' } }, { allowedFields: ['deletedAt'] })).toEqual({ deletedAt: { isNull: true } })
        expect(parseFilters({ deletedAt: { isNull: 'true' } }, { allowedFields: ['deletedAt'] })).toEqual({ deletedAt: { isNull: true } })
    })

    it('drops [isNull] falsy', () => {
        expect(parseFilters({ deletedAt: { isNull: '0' } }, { allowedFields: ['deletedAt'] })).toEqual({})
        expect(parseFilters({ deletedAt: { isNull: 'false' } }, { allowedFields: ['deletedAt'] })).toEqual({})
    })

    it('preserves multi-op same field', () => {
        const out = parseFilters({ age: { gte: '18', lt: '65' } }, { allowedFields: ['age'] })
        expect(out).toEqual({ age: { gte: '18', lt: '65' } })
    })

    it('throws on unknown op', () => {
        expect(() => parseFilters({ age: { foo: '1' } }, { allowedFields: ['age'] })).toThrow(ValidationError)
    })

    it('throws when field not in allowedFields', () => {
        expect(() => parseFilters<Row>({ status: 'x' }, { allowedFields: ['email'] })).toThrow(ValidationError)
    })

    it('throws when field not in schema-derived allowlist', () => {
        const schema: FieldSchema<Row> = { email: { type: 'string' } }
        expect(() => parseFilters<Row>({ status: 'x' }, { schema })).toThrow(ValidationError)
    })

    it('skips reserved keys', () => {
        expect(parseFilters({ offset: '0', limit: '25', sort: '-id', cursor: 'abc', email: 'x' }, { allowedFields: ['email'] })).toEqual({ email: 'x' })
    })

    it('coerces via schema FieldRule.type', () => {
        const schema: FieldSchema<Row> = {
            age: { type: 'integer' },
            isAdmin: { type: 'boolean' },
            createdAt: { type: 'date' },
        }
        const out = parseFilters<Row>({
            age: { gte: '18', lt: '65' },
            isAdmin: 'true',
            createdAt: { gt: '2024-01-01' },
        }, { schema })
        expect(out.age).toEqual({ gte: 18, lt: 65 })
        expect(out.isAdmin).toBe(true)
        expect(out.createdAt).toEqual({ gt: new Date('2024-01-01') })
    })

    it('schema keys act as allowlist when allowedFields absent', () => {
        const schema: FieldSchema<Row> = { age: { type: 'integer' }, email: { type: 'string' } }
        const out = parseFilters<Row>({ age: { gte: '18' }, email: 'x' }, { schema })
        expect(out.age).toEqual({ gte: 18 })
        expect(out.email).toBe('x')
    })

    it('throws on bad integer coercion', () => {
        const schema: FieldSchema<Row> = { age: { type: 'integer' } }
        expect(() => parseFilters<Row>({ age: 'abc' }, { schema })).toThrow(ValidationError)
    })

    it('coerceFields option overrides schema', () => {
        const schema: FieldSchema<Row> = { age: { type: 'number' } }
        const out = parseFilters<Row>({ age: { gte: '18' } }, { schema, coerceFields: { age: 'integer' } })
        expect(out).toEqual({ age: { gte: 18 } })
    })

    it('drops empty bracket object', () => {
        const out = parseFilters({ foo: {} }, { allowedFields: ['foo'] })
        expect(out).toEqual({})
    })

    it('coerces array elements for in op', () => {
        const schema: FieldSchema<Row> = { age: { type: 'integer' } }
        const out = parseFilters<Row>({ age: { in: '18,21,30' } }, { schema })
        expect(out).toEqual({ age: { in: [18, 21, 30] } })
    })
})
