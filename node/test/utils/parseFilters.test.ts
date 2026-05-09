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

    it('returns {} on empty query', () => {
        expect(parseFilters({})).toEqual({})
    })

    it('emits eq for top-level scalar', () => {
        expect(parseFilters({ email: 'foo@bar.com' })).toEqual({ email: 'foo@bar.com' })
    })

    it('emits multiple eq for multiple keys', () => {
        expect(parseFilters({ email: 'a', status: 'active' })).toEqual({ email: 'a', status: 'active' })
    })

    it('emits IN for top-level array', () => {
        expect(parseFilters({ ids: ['1', '2'] })).toEqual({ ids: ['1', '2'] })
    })

    it('parses bracket op [gte] without coercion (no schema)', () => {
        const out = parseFilters({ age: { gte: '18' } })
        expect(out).toEqual({ age: { gte: '18' } })
    })

    it('parses [in] with csv split', () => {
        const out = parseFilters({ status: { in: 'active,pending' } })
        expect(out).toEqual({ status: { in: ['active', 'pending'] } })
    })

    it('parses [in] empty string → []', () => {
        const out = parseFilters({ status: { in: '' } })
        expect(out).toEqual({ status: { in: [] } })
    })

    it('parses [isNull] truthy → true', () => {
        expect(parseFilters({ deletedAt: { isNull: '1' } })).toEqual({ deletedAt: { isNull: true } })
        expect(parseFilters({ deletedAt: { isNull: 'true' } })).toEqual({ deletedAt: { isNull: true } })
    })

    it('drops [isNull] falsy', () => {
        expect(parseFilters({ deletedAt: { isNull: '0' } })).toEqual({})
        expect(parseFilters({ deletedAt: { isNull: 'false' } })).toEqual({})
    })

    it('preserves multi-op same field', () => {
        const out = parseFilters({ age: { gte: '18', lt: '65' } })
        expect(out).toEqual({ age: { gte: '18', lt: '65' } })
    })

    it('throws on unknown op', () => {
        expect(() => parseFilters({ age: { foo: '1' } })).toThrow(ValidationError)
    })

    it('throws when field not in allowedFields', () => {
        expect(() => parseFilters<Row>({ status: 'x' }, { allowedFields: ['email'] })).toThrow(ValidationError)
    })

    it('skips reserved keys', () => {
        expect(parseFilters({ offset: '0', limit: '25', sort: '-id', cursor: 'abc', email: 'x' })).toEqual({ email: 'x' })
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

    it('throws on bad integer coercion', () => {
        const schema: FieldSchema<Row> = { age: { type: 'integer' } }
        expect(() => parseFilters<Row>({ age: 'abc' }, { schema })).toThrow(ValidationError)
    })

    it('coerceFields option overrides schema', () => {
        const out = parseFilters<Row>({ age: { gte: '18' } }, { coerceFields: { age: 'integer' } })
        expect(out).toEqual({ age: { gte: 18 } })
    })

    it('drops empty bracket object', () => {
        const out = parseFilters({ foo: {} })
        expect(out).toEqual({})
    })

    it('coerces array elements for in op', () => {
        const schema: FieldSchema<Row> = { age: { type: 'integer' } }
        const out = parseFilters<Row>({ age: { in: '18,21,30' } }, { schema })
        expect(out).toEqual({ age: { in: [18, 21, 30] } })
    })
})
