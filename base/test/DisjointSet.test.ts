import { describe, it, expect } from 'vitest'
import DisjointSet from '../src/DisjointSet'

describe('DisjointSet', () => {

    it('starts with count 0', () => {
        const ds = new DisjointSet()
        expect(ds.count).toBe(0)
    })

    it('makeSet creates a singleton set', () => {
        const ds = new DisjointSet()
        ds.makeSet('a')
        expect(ds.count).toBe(1)
        expect(ds.find('a')).toBe('a')
    })

    it('makeSet is a no-op for an existing id', () => {
        const ds = new DisjointSet()
        ds.makeSet('a').makeSet('a')
        expect(ds.count).toBe(1)
    })

    it('makeSet is chainable', () => {
        const ds = new DisjointSet()
        const ref = ds.makeSet('a').makeSet('b')
        expect(ref).toBe(ds)
        expect(ds.count).toBe(2)
    })

    it('find returns null for unknown id', () => {
        const ds = new DisjointSet()
        expect(ds.find('x')).toBeNull()
    })

    it('find returns the id itself for a fresh singleton', () => {
        const ds = new DisjointSet()
        ds.makeSet('a')
        expect(ds.find('a')).toBe('a')
    })

    it('union merges two sets and returns true', () => {
        const ds = new DisjointSet()
        ds.makeSet('a').makeSet('b')
        expect(ds.union('a', 'b')).toBe(true)
        expect(ds.count).toBe(1)
    })

    it('union returns false when elements are already in the same set', () => {
        const ds = new DisjointSet()
        ds.makeSet('a').makeSet('b')
        ds.union('a', 'b')
        expect(ds.union('a', 'b')).toBe(false)
        expect(ds.count).toBe(1)
    })

    it('union returns false when either element is unknown', () => {
        const ds = new DisjointSet()
        ds.makeSet('a')
        expect(ds.union('a', 'z')).toBe(false)
        expect(ds.union('z', 'a')).toBe(false)
        expect(ds.count).toBe(1)
    })

    it('connected returns true for elements in the same set', () => {
        const ds = new DisjointSet()
        ds.makeSet('a').makeSet('b')
        ds.union('a', 'b')
        expect(ds.connected('a', 'b')).toBe(true)
    })

    it('connected returns false for elements in different sets', () => {
        const ds = new DisjointSet()
        ds.makeSet('a').makeSet('b')
        expect(ds.connected('a', 'b')).toBe(false)
    })

    it('connected returns false when either element is unknown', () => {
        const ds = new DisjointSet()
        ds.makeSet('a')
        expect(ds.connected('a', 'z')).toBe(false)
        expect(ds.connected('z', 'a')).toBe(false)
    })

    it('connected returns true for a singleton with itself', () => {
        const ds = new DisjointSet()
        ds.makeSet('a')
        expect(ds.connected('a', 'a')).toBe(true)
    })

    it('tracks count across multiple unions', () => {
        const ds = new DisjointSet()
        ds.makeSet('a').makeSet('b').makeSet('c').makeSet('d')
        expect(ds.count).toBe(4)
        ds.union('a', 'b')
        expect(ds.count).toBe(3)
        ds.union('c', 'd')
        expect(ds.count).toBe(2)
        ds.union('a', 'c')
        expect(ds.count).toBe(1)
    })

    it('transitively connects elements through chain of unions', () => {
        const ds = new DisjointSet()
        ds.makeSet('a').makeSet('b').makeSet('c')
        ds.union('a', 'b')
        ds.union('b', 'c')
        expect(ds.connected('a', 'c')).toBe(true)
    })

    it('find remains consistent after path compression', () => {
        const ds = new DisjointSet()
        ds.makeSet('a').makeSet('b').makeSet('c').makeSet('d')
        ds.union('a', 'b')
        ds.union('b', 'c')
        ds.union('c', 'd')
        const root = ds.find('a')
        expect(ds.find('b')).toBe(root)
        expect(ds.find('c')).toBe(root)
        expect(ds.find('d')).toBe(root)
    })

    it('handles many elements with multiple components', () => {
        const ds = new DisjointSet()
        for (let i = 0; i < 10; i++) {
            ds.makeSet(String(i))
        }
        ds.union('0', '1')
        ds.union('2', '3')
        ds.union('4', '5')
        ds.union('0', '2')
        // 10 singletons, 4 distinct-root unions → 6 components: {0,1,2,3},{4,5},{6},{7},{8},{9}
        expect(ds.count).toBe(6)
        expect(ds.connected('0', '3')).toBe(true)
        expect(ds.connected('0', '4')).toBe(false)
        expect(ds.connected('6', '7')).toBe(false)
    })

})
