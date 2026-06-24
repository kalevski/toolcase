import { describe, it, expect } from 'vitest'
import Trie from '../src/Trie'

describe('Trie', () => {

    it('starts empty', () => {
        const t = new Trie()
        expect(t.size).toBe(0)
        expect(t.has('a')).toBe(false)
        expect(t.startsWith('')).toEqual([])
    })

    it('insert adds a word and has returns true', () => {
        const t = new Trie()
        t.insert('hello')
        expect(t.has('hello')).toBe(true)
        expect(t.size).toBe(1)
    })

    it('insert is chainable', () => {
        const t = new Trie()
        const ref = t.insert('a').insert('b')
        expect(ref).toBe(t)
        expect(t.size).toBe(2)
    })

    it('insert is idempotent for duplicate words', () => {
        const t = new Trie()
        t.insert('word').insert('word')
        expect(t.size).toBe(1)
        expect(t.has('word')).toBe(true)
    })

    it('has returns false for a prefix that is not a terminal word', () => {
        const t = new Trie()
        t.insert('apple')
        expect(t.has('app')).toBe(false)
        expect(t.has('appl')).toBe(false)
        expect(t.has('')).toBe(false)
    })

    it('has returns false for a word not in the trie', () => {
        const t = new Trie()
        t.insert('cat')
        expect(t.has('dog')).toBe(false)
        expect(t.has('cats')).toBe(false)
    })

    it('has returns true for the empty string when it was inserted', () => {
        const t = new Trie()
        t.insert('')
        expect(t.has('')).toBe(true)
        expect(t.size).toBe(1)
    })

    it('delete removes a word and returns true', () => {
        const t = new Trie()
        t.insert('apple')
        expect(t.delete('apple')).toBe(true)
        expect(t.has('apple')).toBe(false)
        expect(t.size).toBe(0)
    })

    it('delete returns false for a word not in the trie', () => {
        const t = new Trie()
        t.insert('apple')
        expect(t.delete('app')).toBe(false)
        expect(t.delete('apples')).toBe(false)
        expect(t.delete('orange')).toBe(false)
        expect(t.size).toBe(1)
    })

    it('delete does not affect words sharing a prefix', () => {
        const t = new Trie()
        t.insert('app').insert('apple').insert('application')
        t.delete('app')
        expect(t.has('app')).toBe(false)
        expect(t.has('apple')).toBe(true)
        expect(t.has('application')).toBe(true)
        expect(t.size).toBe(2)
    })

    it('delete prunes unused nodes after removing a leaf word', () => {
        const t = new Trie()
        t.insert('abc')
        t.delete('abc')
        expect(t.startsWith('a')).toEqual([])
        expect(t.size).toBe(0)
    })

    it('delete of the empty string works correctly', () => {
        const t = new Trie()
        t.insert('')
        expect(t.delete('')).toBe(true)
        expect(t.has('')).toBe(false)
        expect(t.size).toBe(0)
    })

    it('startsWith returns all words with the given prefix', () => {
        const t = new Trie()
        t.insert('apple').insert('app').insert('application').insert('apt').insert('banana')
        const result = t.startsWith('app')
        expect(result.sort()).toEqual(['app', 'apple', 'application'])
    })

    it('startsWith with empty prefix returns all inserted words', () => {
        const t = new Trie()
        t.insert('cat').insert('car').insert('dog')
        const result = t.startsWith('')
        expect(result.sort()).toEqual(['car', 'cat', 'dog'])
    })

    it('startsWith returns empty array for non-existent prefix', () => {
        const t = new Trie()
        t.insert('hello')
        expect(t.startsWith('xyz')).toEqual([])
        expect(t.startsWith('hellox')).toEqual([])
    })

    it('startsWith returns the prefix word itself when it is terminal', () => {
        const t = new Trie()
        t.insert('do').insert('dog').insert('dogs')
        const result = t.startsWith('do')
        expect(result.sort()).toEqual(['do', 'dog', 'dogs'])
    })

    it('size increments with unique inserts and decrements with deletes', () => {
        const t = new Trie()
        t.insert('a').insert('b').insert('c')
        expect(t.size).toBe(3)
        t.delete('b')
        expect(t.size).toBe(2)
        t.delete('b')
        expect(t.size).toBe(2)
    })

    it('clear resets the trie', () => {
        const t = new Trie()
        t.insert('hello').insert('world')
        t.clear()
        expect(t.size).toBe(0)
        expect(t.has('hello')).toBe(false)
        expect(t.startsWith('h')).toEqual([])
    })

    it('clear is chainable', () => {
        const t = new Trie()
        t.insert('a')
        const ref = t.clear()
        expect(ref).toBe(t)
    })

    it('clear allows re-use after wiping', () => {
        const t = new Trie()
        t.insert('one').clear().insert('two')
        expect(t.has('one')).toBe(false)
        expect(t.has('two')).toBe(true)
        expect(t.size).toBe(1)
    })

    it('handles words that are prefixes of each other', () => {
        const t = new Trie()
        t.insert('a').insert('ab').insert('abc')
        expect(t.has('a')).toBe(true)
        expect(t.has('ab')).toBe(true)
        expect(t.has('abc')).toBe(true)
        t.delete('ab')
        expect(t.has('a')).toBe(true)
        expect(t.has('ab')).toBe(false)
        expect(t.has('abc')).toBe(true)
    })

    it('handles many distinct words', () => {
        const t = new Trie()
        const words = ['cat', 'car', 'card', 'care', 'careful', 'carefully',
            'cars', 'cart', 'cartoon', 'case']
        for (const w of words) t.insert(w)
        expect(t.size).toBe(words.length)
        for (const w of words) expect(t.has(w)).toBe(true)
        const carPrefixed = t.startsWith('car').sort()
        expect(carPrefixed).toEqual(['car', 'card', 'care', 'careful', 'carefully', 'cars', 'cart', 'cartoon'])
    })

})
