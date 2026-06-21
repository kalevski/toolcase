import { describe, it, expect } from 'vitest'
import { KeyBuilder, KV_KEY_SEPARATOR } from '../../src/kv/keys'

function makeBuilder(namespace = 'ns') {
    return new KeyBuilder(namespace, KV_KEY_SEPARATOR)
}

describe('KeyBuilder.build — separator escaping', () => {

    it('encodes the separator in a single part', () => {
        const kb = makeBuilder('user')
        const key = kb.build('a:b')
        expect(key).toBe('user:a%3Ab')
    })

    it('build("user","a:b") and build("user:a","b") produce distinct keys', () => {
        const kb = new KeyBuilder('', KV_KEY_SEPARATOR)
        const k1 = kb.build('user', 'a:b')
        const k2 = kb.build('user:a', 'b')
        expect(k1).not.toBe(k2)
    })

    it('plain parts without the separator pass through unchanged', () => {
        const kb = makeBuilder('ns')
        expect(kb.build('foo', 'bar')).toBe('ns:foo:bar')
    })

    it('encodes the separator in multiple parts independently', () => {
        const kb = makeBuilder('ns')
        expect(kb.build('a:b', 'c:d')).toBe('ns:a%3Ab:c%3Ad')
    })

    it('numeric parts pass through unchanged', () => {
        const kb = makeBuilder('ns')
        expect(kb.build(42)).toBe('ns:42')
    })

    it('encodes separator when namespace is empty — single part', () => {
        const kb = new KeyBuilder('', KV_KEY_SEPARATOR)
        expect(kb.build('a:b')).toBe('a%3Ab')
    })

})

describe('KeyBuilder.scope — separator escaping', () => {

    it('encodes the separator in the namespace segment', () => {
        const kb = makeBuilder('root')
        const scoped = kb.scope('a:b')
        expect(scoped.namespace).toBe('root:a%3Ab')
    })

    it('scoped builders keep the same separator', () => {
        const kb = makeBuilder('root')
        const scoped = kb.scope('sub')
        expect(scoped.separator).toBe(KV_KEY_SEPARATOR)
    })

})

describe('KeyBuilder.stripNamespace', () => {

    it('strips a plain namespace prefix', () => {
        const kb = makeBuilder('ns')
        expect(kb.stripNamespace('ns:foo')).toBe('foo')
    })

    it('returns the value unchanged when it does not start with the prefix', () => {
        const kb = makeBuilder('ns')
        expect(kb.stripNamespace('other:foo')).toBe('other:foo')
    })

})
