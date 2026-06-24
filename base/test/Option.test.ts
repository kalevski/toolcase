import { describe, it, expect } from 'vitest'
import { some, none } from '../src/Option'
import type { Option } from '../src/Option'

describe('Option — some', () => {

    it('isSome returns true', () => {
        expect(some(1).isSome()).toBe(true)
    })

    it('isNone returns false', () => {
        expect(some(1).isNone()).toBe(false)
    })

    it('value is accessible', () => {
        expect(some('hello').value).toBe('hello')
    })

    it('map transforms the value', () => {
        const r = some(2).map(n => n * 3)
        expect(r.isSome()).toBe(true)
        expect(r.unwrap()).toBe(6)
    })

    it('andThen chains on value', () => {
        const r = some(3).andThen(n => some(n + 1))
        expect(r.isSome()).toBe(true)
        expect(r.unwrap()).toBe(4)
    })

    it('andThen can return none', () => {
        const r = some(3).andThen(() => none())
        expect(r.isNone()).toBe(true)
    })

    it('flatMap is an alias for andThen', () => {
        const r = some(3).flatMap(n => some(n * 2))
        expect(r.unwrap()).toBe(6)
    })

    it('unwrap returns the value', () => {
        expect(some(42).unwrap()).toBe(42)
    })

    it('unwrapOr returns the value, ignoring the default', () => {
        expect(some(7).unwrapOr(99)).toBe(7)
    })

    it('type guard narrows to Some in true branch', () => {
        const opt: Option<number> = some(10)
        if (opt.isSome()) {
            expect(opt.value).toBe(10)
        } else {
            throw new Error('should not reach none branch')
        }
    })

})

describe('Option — none', () => {

    it('isSome returns false', () => {
        expect(none().isSome()).toBe(false)
    })

    it('isNone returns true', () => {
        expect(none().isNone()).toBe(true)
    })

    it('map is a no-op', () => {
        const r = none().map(() => 42)
        expect(r.isNone()).toBe(true)
    })

    it('andThen is a no-op', () => {
        const r = none().andThen(() => some(1))
        expect(r.isNone()).toBe(true)
    })

    it('flatMap is a no-op', () => {
        const r = none().flatMap(() => some(1))
        expect(r.isNone()).toBe(true)
    })

    it('unwrap throws', () => {
        expect(() => none().unwrap()).toThrow('called unwrap on a None value')
    })

    it('unwrapOr returns the default value', () => {
        expect(none().unwrapOr(0)).toBe(0)
    })

    it('unwrapOr accepts any type as default', () => {
        expect(none().unwrapOr('fallback')).toBe('fallback')
    })

    it('none is a singleton', () => {
        expect(none()).toBe(none())
    })

    it('type guard narrows to None in true branch', () => {
        const opt: Option<number> = none()
        if (opt.isNone()) {
            expect(opt._tag).toBe('none')
        } else {
            throw new Error('should not reach some branch')
        }
    })

})

describe('Option — chaining', () => {

    it('chains multiple andThen on some', () => {
        const r = some(1)
            .andThen(n => some(n + 1))
            .andThen(n => some(n * 10))
        expect(r.unwrap()).toBe(20)
    })

    it('short-circuits at first none in chain', () => {
        const parseNum = (s: string): Option<number> => {
            const n = parseInt(s, 10)
            return isNaN(n) ? none() : some(n)
        }
        const r = some('not-a-number').andThen(parseNum).andThen(n => some(n * 10))
        expect(r.isNone()).toBe(true)
    })

    it('maps some through multiple transforms', () => {
        const r = some(4)
            .map(n => n * 2)
            .map(n => String(n))
        expect(r.unwrap()).toBe('8')
    })

})
