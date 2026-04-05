import { describe, it, expect } from 'vitest'
import generateId from '../src/generateId'

describe('generateId', () => {
    it('generates an id with default length of 8', () => {
        const id = generateId()
        expect(id).toHaveLength(8)
    })

    it('generates an id with custom length', () => {
        const id = generateId(16)
        expect(id).toHaveLength(16)
    })

    it('generates hex characters only', () => {
        const id = generateId(32)
        expect(id).toMatch(/^[0-9a-f]+$/)
    })

    it('generates unique ids', () => {
        const ids = new Set(Array.from({ length: 100 }, () => generateId(16)))
        expect(ids.size).toBe(100)
    })

    it('handles odd lengths', () => {
        const id = generateId(5)
        expect(id).toHaveLength(5)
    })

    it('handles length of 1', () => {
        const id = generateId(1)
        expect(id).toHaveLength(1)
        expect(id).toMatch(/^[0-9a-f]$/)
    })
})
