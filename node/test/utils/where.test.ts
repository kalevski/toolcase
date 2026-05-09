import { describe, it, expect } from 'vitest'
import { applyWhere } from '../../src/utils/where'

type Call = [string, string, unknown] | ['factory']

class MockQB {
    calls: Call[] = []
    where(a: string | ((eb: { lit: (v: unknown) => unknown }) => unknown), op?: string, value?: unknown): MockQB {
        if (typeof a === 'function') {
            this.calls.push(['factory'])
        } else {
            this.calls.push([a, op as string, value])
        }
        return this
    }
}

describe('applyWhere', () => {

    it('applies single eq via top-level scalar', () => {
        const qb = new MockQB()
        const [, empty] = applyWhere(qb, { email: 'a' })
        expect(qb.calls).toEqual([['email', '=', 'a']])
        expect(empty).toBe(false)
    })

    it('applies IN via top-level array', () => {
        const qb = new MockQB()
        applyWhere(qb, { id: [1, 2, 3] })
        expect(qb.calls).toEqual([['id', 'in', [1, 2, 3]]])
    })

    it('short-circuits on empty array', () => {
        const qb = new MockQB()
        const [, empty] = applyWhere(qb, { id: [] })
        expect(qb.calls).toEqual([['factory']])
        expect(empty).toBe(true)
    })

    it('applies single-op condition object', () => {
        const qb = new MockQB()
        applyWhere(qb, { age: { gte: 18 } })
        expect(qb.calls).toEqual([['age', '>=', 18]])
    })

    it('applies multi-op condition object — both ops applied', () => {
        const qb = new MockQB()
        applyWhere(qb, { age: { gte: 18, lt: 65 } })
        expect(qb.calls).toEqual([
            ['age', '>=', 18],
            ['age', '<', 65],
        ])
    })

    it('rejects empty {} as condition — treats as eq scalar', () => {
        const qb = new MockQB()
        applyWhere(qb, { foo: {} })
        expect(qb.calls).toEqual([['foo', '=', {}]])
    })

    it('rejects mixed op + non-op key — treats as eq scalar', () => {
        const qb = new MockQB()
        const obj = { gte: 18, foo: 1 }
        applyWhere(qb, { age: obj })
        expect(qb.calls).toEqual([['age', '=', obj]])
    })

    it('multi-op in [] short-circuits, other ops still apply', () => {
        const qb = new MockQB()
        const [, empty] = applyWhere(qb, { age: { in: [], gte: 18 } })
        expect(qb.calls).toEqual([
            ['factory'],
            ['age', '>=', 18],
        ])
        expect(empty).toBe(true)
    })

    it('null → IS NULL', () => {
        const qb = new MockQB()
        applyWhere(qb, { deletedAt: null })
        expect(qb.calls).toEqual([['deletedAt', 'is', null]])
    })

    it('isNotNull op', () => {
        const qb = new MockQB()
        applyWhere(qb, { deletedAt: { isNotNull: true } })
        expect(qb.calls).toEqual([['deletedAt', 'is not', null]])
    })
})
