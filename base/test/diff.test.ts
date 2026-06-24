import { describe, it, expect } from 'vitest'
import diff from '../src/diff'
import patch from '../src/patch'

describe('diff', () => {

    it('returns null for identical plain objects', () => {
        expect(diff({ a: 1, b: 'x' }, { a: 1, b: 'x' })).toBeNull()
    })

    it('returns null for identical nested objects', () => {
        expect(diff({ a: { b: { c: 3 } } }, { a: { b: { c: 3 } } })).toBeNull()
    })

    it('returns null for identical arrays', () => {
        expect(diff([1, 2, 3], [1, 2, 3])).toBeNull()
    })

    it('returns null for empty objects', () => {
        expect(diff({}, {})).toBeNull()
    })

    it('returns null for empty arrays', () => {
        expect(diff([], [])).toBeNull()
    })

    it('records added keys', () => {
        const d = diff({ a: 1 }, { a: 1, b: 2 })
        expect(d).toEqual({ b: [2] })
    })

    it('records removed keys', () => {
        const d = diff({ a: 1, b: 2 }, { a: 1 })
        expect(d).toEqual({ b: [2, 0, 0] })
    })

    it('records replaced primitive values', () => {
        const d = diff({ a: 1 }, { a: 2 })
        expect(d).toEqual({ a: [1, 2] })
    })

    it('records replaced values when type changes', () => {
        const d = diff({ a: 1 }, { a: 'hello' })
        expect(d).toEqual({ a: [1, 'hello'] })
    })

    it('records nested object changes', () => {
        const d = diff({ outer: { inner: 1 } }, { outer: { inner: 2 } })
        expect(d).toEqual({ outer: { inner: [1, 2] } })
    })

    it('records deeply nested changes', () => {
        const a = { x: { y: { z: 0 } } }
        const b = { x: { y: { z: 99 } } }
        expect(diff(a, b)).toEqual({ x: { y: { z: [0, 99] } } })
    })

    it('only records changed keys in objects', () => {
        const d = diff({ a: 1, b: 2, c: 3 }, { a: 1, b: 99, c: 3 })
        expect(d).toEqual({ b: [2, 99] })
    })

    it('records array element addition', () => {
        const d = diff([1, 2], [1, 2, 3]) as any
        expect(d).not.toBeNull()
        expect(d._t).toBe('a')
        expect(d._l).toBe(3)
        expect(d['2']).toEqual([3])
    })

    it('records array element removal', () => {
        const d = diff([1, 2, 3], [1, 2]) as any
        expect(d).not.toBeNull()
        expect(d._t).toBe('a')
        expect(d._l).toBe(2)
        expect(d['2']).toEqual([3, 0, 0])
    })

    it('records array element replacement', () => {
        const d = diff([1, 2, 3], [1, 99, 3]) as any
        expect(d).not.toBeNull()
        expect(d['1']).toEqual([2, 99])
    })

    it('records nested object changes inside an array', () => {
        const a = [{ x: 1 }, { x: 2 }]
        const b = [{ x: 1 }, { x: 99 }]
        const d = diff(a, b) as any
        expect(d).not.toBeNull()
        expect(d['1']).toEqual({ x: [2, 99] })
    })

    it('returns null for type mismatch at root (object vs array)', () => {
        expect(diff({}, [])).toBeNull()
        expect(diff([], {})).toBeNull()
    })

})

describe('patch', () => {

    it('returns target unchanged when delta is null', () => {
        const obj = { a: 1 }
        expect(patch(obj, null)).toBe(obj)
    })

    it('applies added key', () => {
        const result = patch({ a: 1 }, { b: [2] })
        expect(result).toEqual({ a: 1, b: 2 })
    })

    it('applies removed key', () => {
        const result = patch({ a: 1, b: 2 }, { b: [2, 0, 0] })
        expect(result).toEqual({ a: 1 })
    })

    it('applies replaced primitive value', () => {
        const result = patch({ a: 1 }, { a: [1, 99] })
        expect(result).toEqual({ a: 99 })
    })

    it('applies nested object delta', () => {
        const result = patch({ outer: { inner: 1 } }, { outer: { inner: [1, 2] } })
        expect(result).toEqual({ outer: { inner: 2 } })
    })

    it('applies array element addition', () => {
        const result = patch([1, 2], { _t: 'a', _l: 3, '2': [3] })
        expect(result).toEqual([1, 2, 3])
    })

    it('applies array element removal', () => {
        const result = patch([1, 2, 3], { _t: 'a', _l: 2, '2': [3, 0, 0] })
        expect(result).toEqual([1, 2])
    })

    it('applies array element replacement', () => {
        const result = patch([1, 2, 3], { _t: 'a', _l: 3, '1': [2, 99] })
        expect(result).toEqual([1, 99, 3])
    })

    it('applies nested object delta inside array', () => {
        const result = patch([{ x: 1 }, { x: 2 }], { _t: 'a', _l: 2, '1': { x: [2, 99] } })
        expect(result).toEqual([{ x: 1 }, { x: 99 }])
    })

    it('does not mutate the original target object', () => {
        const original = { a: 1, b: 2 }
        patch(original, { b: [2, 99] })
        expect(original.b).toBe(2)
    })

    it('does not mutate the original target array', () => {
        const original = [1, 2, 3]
        patch(original, { _t: 'a', _l: 3, '1': [2, 99] })
        expect(original[1]).toBe(2)
    })

})

describe('diff + patch round-trip', () => {

    function roundTrip(a: unknown, b: unknown): unknown {
        return patch(a, diff(a, b))
    }

    it('round-trips added key', () => {
        const a = { x: 1 }
        const b = { x: 1, y: 2 }
        expect(roundTrip(a, b)).toEqual(b)
    })

    it('round-trips removed key', () => {
        const a = { x: 1, y: 2 }
        const b = { x: 1 }
        expect(roundTrip(a, b)).toEqual(b)
    })

    it('round-trips primitive replacement', () => {
        const a = { x: 1 }
        const b = { x: 99 }
        expect(roundTrip(a, b)).toEqual(b)
    })

    it('round-trips deeply nested change', () => {
        const a = { level1: { level2: { value: 'old' } } }
        const b = { level1: { level2: { value: 'new' } } }
        expect(roundTrip(a, b)).toEqual(b)
    })

    it('round-trips multiple simultaneous changes', () => {
        const a = { a: 1, b: 2, c: { d: 3 } }
        const b = { a: 10, c: { d: 99 }, e: 'added' }
        expect(roundTrip(a, b)).toEqual(b)
    })

    it('round-trips array element addition', () => {
        const a = [1, 2]
        const b = [1, 2, 3, 4]
        expect(roundTrip(a, b)).toEqual(b)
    })

    it('round-trips array element removal', () => {
        const a = [1, 2, 3, 4]
        const b = [1, 2]
        expect(roundTrip(a, b)).toEqual(b)
    })

    it('round-trips array element replacement', () => {
        const a = [1, 2, 3]
        const b = [1, 99, 3]
        expect(roundTrip(a, b)).toEqual(b)
    })

    it('round-trips array of objects', () => {
        const a = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Bob' }]
        const b = [{ id: 1, name: 'Alice' }, { id: 2, name: 'Robert' }]
        expect(roundTrip(a, b)).toEqual(b)
    })

    it('round-trips objects containing arrays', () => {
        const a = { items: [1, 2, 3], label: 'x' }
        const b = { items: [1, 99, 3], label: 'y' }
        expect(roundTrip(a, b)).toEqual(b)
    })

    it('round-trips null field values', () => {
        const a = { x: null }
        const b = { x: 42 }
        expect(roundTrip(a, b)).toEqual(b)
    })

    it('round-trips equal inputs (null delta, returns original)', () => {
        const a = { x: 1, y: [1, 2, 3] }
        expect(roundTrip(a, a)).toBe(a)
    })

})
