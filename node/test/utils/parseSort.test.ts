import { describe, it, expect } from 'vitest'
import { parseSort } from '../../src/utils/parseSort'
import { ValidationError } from '../../src/errors'

interface Row {
    name: string
    createdAt: Date
    age: number
}

describe('parseSort', () => {

    it('throws when allowedFields not provided', () => {
        expect(() => parseSort({ sort: 'name' })).toThrow('parseSort: pass allowedFields; [] to allow none')
    })

    it('throws when allowedFields not provided even with no sort in query', () => {
        expect(() => parseSort({})).toThrow('parseSort: pass allowedFields; [] to allow none')
    })

    it('returns undefined when sort absent', () => {
        expect(parseSort({}, { allowedFields: [] })).toBeUndefined()
    })

    it('returns undefined when sort empty string', () => {
        expect(parseSort({ sort: '' }, { allowedFields: [] })).toBeUndefined()
    })

    it('parses single asc', () => {
        expect(parseSort({ sort: 'name' }, { allowedFields: ['name'] })).toEqual([{ field: 'name', direction: 'asc' }])
    })

    it('parses leading - as desc', () => {
        expect(parseSort({ sort: '-createdAt' }, { allowedFields: ['createdAt'] })).toEqual([{ field: 'createdAt', direction: 'desc' }])
    })

    it('parses leading + as asc', () => {
        expect(parseSort({ sort: '+name' }, { allowedFields: ['name'] })).toEqual([{ field: 'name', direction: 'asc' }])
    })

    it('parses csv list with mixed directions', () => {
        expect(parseSort({ sort: '-createdAt,name' }, { allowedFields: ['createdAt', 'name'] })).toEqual([
            { field: 'createdAt', direction: 'desc' },
            { field: 'name', direction: 'asc' },
        ])
    })

    it('tolerates whitespace', () => {
        expect(parseSort({ sort: '  -createdAt , name  ' }, { allowedFields: ['createdAt', 'name'] })).toEqual([
            { field: 'createdAt', direction: 'desc' },
            { field: 'name', direction: 'asc' },
        ])
    })

    it('skips empty tokens', () => {
        expect(parseSort({ sort: 'a,,b' }, { allowedFields: ['a', 'b'] })).toEqual([
            { field: 'a', direction: 'asc' },
            { field: 'b', direction: 'asc' },
        ])
    })

    it('throws on unknown field with allowedFields', () => {
        expect(() => parseSort<Row>({ sort: 'foo' }, { allowedFields: ['name'] })).toThrow(ValidationError)
    })

    it('throws ValidationError for any field when allowedFields is empty', () => {
        expect(() => parseSort({ sort: 'name' }, { allowedFields: [] })).toThrow(ValidationError)
    })

    it('accepts allowed field', () => {
        expect(parseSort<Row>({ sort: '-createdAt' }, { allowedFields: ['createdAt'] }))
            .toEqual([{ field: 'createdAt', direction: 'desc' }])
    })

    it('throws on non-string sort', () => {
        expect(() => parseSort({ sort: 123 }, { allowedFields: [] })).toThrow(ValidationError)
    })
})
