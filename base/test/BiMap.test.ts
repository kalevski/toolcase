import { describe, it, expect } from 'vitest'
import BiMap from '../src/BiMap'

describe('BiMap', () => {

    it('starts empty', () => {
        const m = new BiMap<string, number>()
        expect(m.size).toBe(0)
        expect(m.has('a')).toBe(false)
        expect(m.hasValue(1)).toBe(false)
        expect(m.get('a')).toBeNull()
        expect(m.getKey(1)).toBeNull()
    })

    it('set stores a key-value pair', () => {
        const m = new BiMap<string, number>()
        m.set('a', 1)
        expect(m.size).toBe(1)
        expect(m.get('a')).toBe(1)
        expect(m.getKey(1)).toBe('a')
    })

    it('set is chainable', () => {
        const m = new BiMap<string, number>()
        const ref = m.set('a', 1).set('b', 2)
        expect(ref).toBe(m)
        expect(m.size).toBe(2)
    })

    it('set overwrites the old value when the same key is re-set', () => {
        const m = new BiMap<string, number>()
        m.set('a', 1)
        m.set('a', 2)
        expect(m.size).toBe(1)
        expect(m.get('a')).toBe(2)
        expect(m.getKey(2)).toBe('a')
        expect(m.getKey(1)).toBeNull()
        expect(m.hasValue(1)).toBe(false)
    })

    it('set removes the old key when a value is reassigned to a different key', () => {
        const m = new BiMap<string, number>()
        m.set('a', 1)
        m.set('b', 1)
        expect(m.size).toBe(1)
        expect(m.has('a')).toBe(false)
        expect(m.has('b')).toBe(true)
        expect(m.get('b')).toBe(1)
        expect(m.getKey(1)).toBe('b')
    })

    it('has returns true for an existing key', () => {
        const m = new BiMap<string, number>()
        m.set('x', 10)
        expect(m.has('x')).toBe(true)
        expect(m.has('y')).toBe(false)
    })

    it('hasValue returns true for an existing value', () => {
        const m = new BiMap<string, number>()
        m.set('x', 10)
        expect(m.hasValue(10)).toBe(true)
        expect(m.hasValue(99)).toBe(false)
    })

    it('get returns null for a missing key', () => {
        const m = new BiMap<string, number>()
        expect(m.get('missing')).toBeNull()
    })

    it('getKey returns null for a missing value', () => {
        const m = new BiMap<string, number>()
        expect(m.getKey(999)).toBeNull()
    })

    it('delete removes the pair and returns true', () => {
        const m = new BiMap<string, number>()
        m.set('a', 1)
        expect(m.delete('a')).toBe(true)
        expect(m.size).toBe(0)
        expect(m.has('a')).toBe(false)
        expect(m.hasValue(1)).toBe(false)
    })

    it('delete returns false for a missing key', () => {
        const m = new BiMap<string, number>()
        expect(m.delete('x')).toBe(false)
    })

    it('delete does not affect other pairs', () => {
        const m = new BiMap<string, number>()
        m.set('a', 1).set('b', 2).set('c', 3)
        m.delete('b')
        expect(m.size).toBe(2)
        expect(m.get('a')).toBe(1)
        expect(m.get('c')).toBe(3)
    })

    it('deleteByValue removes the pair and returns true', () => {
        const m = new BiMap<string, number>()
        m.set('a', 1)
        expect(m.deleteByValue(1)).toBe(true)
        expect(m.size).toBe(0)
        expect(m.has('a')).toBe(false)
        expect(m.hasValue(1)).toBe(false)
    })

    it('deleteByValue returns false for a missing value', () => {
        const m = new BiMap<string, number>()
        expect(m.deleteByValue(42)).toBe(false)
    })

    it('deleteByValue does not affect other pairs', () => {
        const m = new BiMap<string, number>()
        m.set('a', 1).set('b', 2).set('c', 3)
        m.deleteByValue(2)
        expect(m.size).toBe(2)
        expect(m.getKey(1)).toBe('a')
        expect(m.getKey(3)).toBe('c')
    })

    it('clear removes all pairs', () => {
        const m = new BiMap<string, number>()
        m.set('a', 1).set('b', 2)
        m.clear()
        expect(m.size).toBe(0)
        expect(m.has('a')).toBe(false)
        expect(m.hasValue(1)).toBe(false)
    })

    it('clear is chainable', () => {
        const m = new BiMap<string, number>()
        m.set('a', 1)
        const ref = m.clear()
        expect(ref).toBe(m)
    })

    it('clear allows re-use after wiping', () => {
        const m = new BiMap<string, number>()
        m.set('a', 1).clear().set('b', 2)
        expect(m.size).toBe(1)
        expect(m.get('b')).toBe(2)
        expect(m.has('a')).toBe(false)
    })

    it('Symbol.iterator yields [key, value] pairs', () => {
        const m = new BiMap<string, number>()
        m.set('a', 1).set('b', 2).set('c', 3)
        const entries = [...m]
        expect(entries.length).toBe(3)
        expect(entries).toContainEqual(['a', 1])
        expect(entries).toContainEqual(['b', 2])
        expect(entries).toContainEqual(['c', 3])
    })

    it('Symbol.iterator on empty map yields nothing', () => {
        const m = new BiMap<string, number>()
        expect([...m]).toEqual([])
    })

    it('enforces strict bijection across multiple sets', () => {
        const m = new BiMap<string, string>()
        m.set('alpha', 'one')
        m.set('beta', 'two')
        m.set('gamma', 'one')
        expect(m.size).toBe(2)
        expect(m.has('alpha')).toBe(false)
        expect(m.has('gamma')).toBe(true)
        expect(m.getKey('one')).toBe('gamma')
        expect(m.get('beta')).toBe('two')
    })

})
