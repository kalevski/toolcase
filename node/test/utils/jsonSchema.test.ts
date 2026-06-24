import { describe, it, expect } from 'vitest'
import { deriveJsonSchema } from '../../src/utils/sanitize/jsonSchema'
import { FieldSchema } from '../../src/utils/sanitize/types'

interface Order {
    tags: string[]
    meta: Record<string, unknown>
}

const schema: FieldSchema<Order> = {
    tags: {
        type: 'array',
        min: 1,
        max: 10,
        items: { type: 'string' },
    },
    meta: {
        type: 'object',
        fields: {
            label: { type: 'string' },
            count: { type: 'number' },
        },
    },
}

describe('deriveJsonSchema — array bounds', () => {
    it('maps min/max to minItems/maxItems in loose mode', () => {
        const result = deriveJsonSchema(schema, 'create')
        const tags = result.properties?.tags
        expect(tags?.minItems).toBe(1)
        expect(tags?.maxItems).toBe(10)
    })

    it('maps min/max to minItems/maxItems in strict mode', () => {
        const result = deriveJsonSchema(schema, 'create', { strict: true })
        const tags = result.properties?.tags
        expect(tags?.minItems).toBe(1)
        expect(tags?.maxItems).toBe(10)
    })
})

describe('deriveJsonSchema — nested object', () => {
    it('emits properties for nested object fields', () => {
        const result = deriveJsonSchema(schema, 'create')
        const meta = result.properties?.meta
        expect(meta?.properties).toBeDefined()
        expect(meta?.properties?.label).toEqual({ type: 'string' })
        expect(meta?.properties?.count).toEqual({ type: 'number' })
    })

    it('strict mode sets additionalProperties:false on nested object', () => {
        const result = deriveJsonSchema(schema, 'create', { strict: true })
        const meta = result.properties?.meta
        expect(meta?.additionalProperties).toBe(false)
    })

    it('loose mode does not set additionalProperties on nested object', () => {
        const result = deriveJsonSchema(schema, 'create')
        const meta = result.properties?.meta
        expect(meta?.additionalProperties).toBeUndefined()
    })

    it('strict mode also sets additionalProperties:false at root', () => {
        const result = deriveJsonSchema(schema, 'create', { strict: true })
        expect(result.additionalProperties).toBe(false)
    })
})
