import { describe, it, expect } from 'vitest'
import MultiMap from '../src/MultiMap'

describe('MultiMap', () => {

    it('starts empty', () => {
        const m = new MultiMap<string, number>()
        expect(m.size).toBe(0)
        expect(m.has('a')).toBe(false)
        expect(m.get('a')).toBeUndefined()
    })

    it('set adds a value to a key', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1)
        expect(m.size).toBe(1)
        expect(m.has('a')).toBe(true)
        expect(m.get('a')).toEqual(new Set([1]))
    })

    it('set is chainable', () => {
        const m = new MultiMap<string, number>()
        const ref = m.set('a', 1).set('a', 2)
        expect(ref).toBe(m)
        expect(m.size).toBe(2)
    })

    it('set accumulates multiple values under the same key', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1).set('a', 2).set('a', 3)
        expect(m.size).toBe(3)
        expect(m.get('a')).toEqual(new Set([1, 2, 3]))
    })

    it('set is idempotent for duplicate key-value pairs', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1).set('a', 1)
        expect(m.size).toBe(1)
        expect(m.get('a')).toEqual(new Set([1]))
    })

    it('set handles multiple different keys', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1).set('b', 2).set('a', 3)
        expect(m.size).toBe(3)
        expect(m.get('a')).toEqual(new Set([1, 3]))
        expect(m.get('b')).toEqual(new Set([2]))
    })

    it('get returns undefined for a missing key', () => {
        const m = new MultiMap<string, number>()
        expect(m.get('missing')).toBeUndefined()
    })

    it('get returns a readonly-typed set', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1).set('a', 2)
        const bucket = m.get('a')
        expect(bucket).toBeInstanceOf(Set)
        expect(bucket?.size).toBe(2)
    })

    it('has(key) returns true when the key exists', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1)
        expect(m.has('a')).toBe(true)
        expect(m.has('b')).toBe(false)
    })

    it('has(key, value) returns true when the specific pair exists', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1).set('a', 2)
        expect(m.has('a', 1)).toBe(true)
        expect(m.has('a', 2)).toBe(true)
        expect(m.has('a', 3)).toBe(false)
    })

    it('has(key, value) returns false for missing key', () => {
        const m = new MultiMap<string, number>()
        expect(m.has('x', 99)).toBe(false)
    })

    it('delete(key) removes all values under a key', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1).set('a', 2).set('a', 3)
        expect(m.delete('a')).toBe(true)
        expect(m.size).toBe(0)
        expect(m.has('a')).toBe(false)
        expect(m.get('a')).toBeUndefined()
    })

    it('delete(key) returns false for a missing key', () => {
        const m = new MultiMap<string, number>()
        expect(m.delete('x')).toBe(false)
    })

    it('delete(key) does not affect other keys', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1).set('b', 2).set('b', 3)
        m.delete('a')
        expect(m.size).toBe(2)
        expect(m.get('b')).toEqual(new Set([2, 3]))
    })

    it('delete(key, value) removes only the specific value', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1).set('a', 2).set('a', 3)
        expect(m.delete('a', 2)).toBe(true)
        expect(m.size).toBe(2)
        expect(m.get('a')).toEqual(new Set([1, 3]))
    })

    it('delete(key, value) removes the key when the last value is deleted', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1)
        expect(m.delete('a', 1)).toBe(true)
        expect(m.size).toBe(0)
        expect(m.has('a')).toBe(false)
        expect(m.get('a')).toBeUndefined()
    })

    it('delete(key, value) returns false when value not in set', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1)
        expect(m.delete('a', 99)).toBe(false)
        expect(m.size).toBe(1)
    })

    it('delete(key, value) returns false for a missing key', () => {
        const m = new MultiMap<string, number>()
        expect(m.delete('x', 1)).toBe(false)
    })

    it('keys returns all keys', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1).set('b', 2).set('c', 3)
        expect([...m.keys()].sort()).toEqual(['a', 'b', 'c'])
    })

    it('keys is empty when map is empty', () => {
        const m = new MultiMap<string, number>()
        expect([...m.keys()]).toEqual([])
    })

    it('clear removes all entries', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1).set('b', 2)
        m.clear()
        expect(m.size).toBe(0)
        expect(m.has('a')).toBe(false)
        expect([...m.keys()]).toEqual([])
    })

    it('clear is chainable', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1)
        const ref = m.clear()
        expect(ref).toBe(m)
    })

    it('clear allows re-use after wiping', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1).clear().set('b', 2)
        expect(m.size).toBe(1)
        expect(m.has('a')).toBe(false)
        expect(m.get('b')).toEqual(new Set([2]))
    })

    it('Symbol.iterator yields [key, Set<V>] pairs', () => {
        const m = new MultiMap<string, number>()
        m.set('a', 1).set('a', 2).set('b', 3)
        const entries = [...m]
        expect(entries.length).toBe(2)
        const aEntry = entries.find(([k]) => k === 'a')
        const bEntry = entries.find(([k]) => k === 'b')
        expect(aEntry?.[1]).toEqual(new Set([1, 2]))
        expect(bEntry?.[1]).toEqual(new Set([3]))
    })

    it('Symbol.iterator on empty map yields nothing', () => {
        const m = new MultiMap<string, number>()
        expect([...m]).toEqual([])
    })

    it('size counts total values across all keys', () => {
        const m = new MultiMap<string, string>()
        m.set('fruit', 'apple').set('fruit', 'banana').set('veggie', 'carrot')
        expect(m.size).toBe(3)
        m.delete('fruit', 'apple')
        expect(m.size).toBe(2)
        m.delete('fruit')
        expect(m.size).toBe(1)
    })

})
