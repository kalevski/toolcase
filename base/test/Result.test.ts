import { describe, it, expect } from 'vitest'
import { ok, err } from '../src/Result'
import type { Result } from '../src/Result'

describe('Result — ok', () => {

    it('isOk returns true', () => {
        expect(ok(1).isOk()).toBe(true)
    })

    it('isErr returns false', () => {
        expect(ok(1).isErr()).toBe(false)
    })

    it('value is accessible', () => {
        expect(ok('hello').value).toBe('hello')
    })

    it('map transforms the value', () => {
        const r = ok(2).map(n => n * 3)
        expect(r.isOk()).toBe(true)
        expect(r.unwrap()).toBe(6)
    })

    it('mapErr is a no-op', () => {
        const r = ok<number, string>(5).mapErr(e => e.toUpperCase())
        expect(r.isOk()).toBe(true)
        expect(r.unwrap()).toBe(5)
    })

    it('andThen chains on success', () => {
        const r = ok<number, string>(3).andThen(n => ok(n + 1))
        expect(r.unwrap()).toBe(4)
    })

    it('andThen propagates err from the callback', () => {
        const r = ok<number, string>(3).andThen(() => err('oops'))
        expect(r.isErr()).toBe(true)
    })

    it('flatMap is an alias for andThen', () => {
        const r = ok<number, string>(3).flatMap(n => ok(n * 2))
        expect(r.unwrap()).toBe(6)
    })

    it('unwrap returns the value', () => {
        expect(ok(42).unwrap()).toBe(42)
    })

    it('unwrapErr throws', () => {
        expect(() => ok(1).unwrapErr()).toThrow('called unwrapErr on an Ok value')
    })

    it('unwrapOr returns the value, ignoring the default', () => {
        expect(ok(7).unwrapOr(99)).toBe(7)
    })

    it('type guard narrows to Ok in true branch', () => {
        const r: Result<number, string> = ok(10)
        if (r.isOk()) {
            expect(r.value).toBe(10)
        } else {
            throw new Error('should not reach err branch')
        }
    })

})

describe('Result — err', () => {

    it('isOk returns false', () => {
        expect(err('boom').isOk()).toBe(false)
    })

    it('isErr returns true', () => {
        expect(err('boom').isErr()).toBe(true)
    })

    it('error is accessible', () => {
        expect(err('oops').error).toBe('oops')
    })

    it('map is a no-op', () => {
        const r = err<number, string>('bad').map(n => n * 2)
        expect(r.isErr()).toBe(true)
        expect(r.unwrapErr()).toBe('bad')
    })

    it('mapErr transforms the error', () => {
        const r = err('bad').mapErr(e => e.length)
        expect(r.isErr()).toBe(true)
        expect(r.unwrapErr()).toBe(3)
    })

    it('andThen is a no-op', () => {
        const r = err<number, string>('bad').andThen(n => ok(n + 1))
        expect(r.isErr()).toBe(true)
        expect(r.unwrapErr()).toBe('bad')
    })

    it('flatMap is a no-op', () => {
        const r = err<number, string>('bad').flatMap(n => ok(n + 1))
        expect(r.isErr()).toBe(true)
    })

    it('unwrap throws', () => {
        expect(() => err('bad').unwrap()).toThrow('called unwrap on an Err value')
    })

    it('unwrapErr returns the error', () => {
        expect(err('fail').unwrapErr()).toBe('fail')
    })

    it('unwrapOr returns the default value', () => {
        expect(err<number, string>('bad').unwrapOr(0)).toBe(0)
    })

    it('type guard narrows to Err in true branch', () => {
        const r: Result<number, string> = err('fail')
        if (r.isErr()) {
            expect(r.error).toBe('fail')
        } else {
            throw new Error('should not reach ok branch')
        }
    })

})

describe('Result — chaining', () => {

    it('chains multiple andThen calls on ok', () => {
        const r = ok<number, string>(1)
            .andThen(n => ok(n + 1))
            .andThen(n => ok(n * 10))
        expect(r.unwrap()).toBe(20)
    })

    it('short-circuits on first err in chain', () => {
        const r = ok<number, string>(1)
            .andThen(() => err('step2 failed'))
            .andThen(n => ok(n * 10))
        expect(r.isErr()).toBe(true)
        expect(r.unwrapErr()).toBe('step2 failed')
    })

    it('maps ok through multiple transforms', () => {
        const r = ok<number, string>(4)
            .map(n => n * 2)
            .map(n => String(n))
        expect(r.unwrap()).toBe('8')
    })

})
