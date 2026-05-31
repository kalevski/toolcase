import { describe, it, expect } from 'vitest'
import { parseSort } from '../../src/utils/parseSort'
import { ValidationError } from '../../src/errors'

interface Row {
    name: string
    createdAt: Date
    age: number
}

describe('parseSort', () => {

    it('returns undefined when sort absent', () => {
        expect(parseSort({})).toBeUndefined()
    })

    it('returns undefined when sort empty string', () => {
        expect(parseSort({ sort: '' })).toBeUndefined()
    })

    it('parses single asc', () => {
        expect(parseSort({ sort: 'name' })).toEqual([{ field: 'name', direction: 'asc' }])
    })

    it('parses leading - as desc', () => {
        expect(parseSort({ sort: '-createdAt' })).toEqual([{ field: 'createdAt', direction: 'desc' }])
    })

    it('parses leading + as asc', () => {
        expect(parseSort({ sort: '+name' })).toEqual([{ field: 'name', direction: 'asc' }])
    })

    it('parses csv list with mixed directions', () => {
        expect(parseSort({ sort: '-createdAt,name' })).toEqual([
            { field: 'createdAt', direction: 'desc' },
            { field: 'name', direction: 'asc' },
        ])
    })

    it('tolerates whitespace', () => {
        expect(parseSort({ sort: '  -createdAt , name  ' })).toEqual([
            { field: 'createdAt', direction: 'desc' },
            { field: 'name', direction: 'asc' },
        ])
    })

    it('skips empty tokens', () => {
        expect(parseSort({ sort: 'a,,b' })).toEqual([
            { field: 'a', direction: 'asc' },
            { field: 'b', direction: 'asc' },
        ])
    })

    it('throws on unknown field with allowedFields', () => {
        expect(() => parseSort<Row>({ sort: 'foo' }, { allowedFields: ['name'] })).toThrow(ValidationError)
    })

    it('accepts allowed field', () => {
        expect(parseSort<Row>({ sort: '-createdAt' }, { allowedFields: ['createdAt'] }))
            .toEqual([{ field: 'createdAt', direction: 'desc' }])
    })

    it('throws on non-string sort', () => {
        expect(() => parseSort({ sort: 123 })).toThrow(ValidationError)
    })
})
