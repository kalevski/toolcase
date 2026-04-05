import { describe, it, expect } from 'vitest'
import State from '../src/State'

describe('State', () => {
    it('initializes with data', () => {
        const state = new State({ count: 0 })
        expect(state.get()).toEqual({ count: 0 })
    })

    it('initializes with empty object by default', () => {
        const state = new State()
        expect(state.get()).toEqual({})
    })

    it('throws on non-object constructor argument', () => {
        expect(() => new State('invalid')).toThrow()
    })

    it('throws on null constructor argument', () => {
        expect(() => new State(null)).toThrow()
    })

    it('sets data and merges', () => {
        const state = new State({ a: 1, b: 2 })
        state.set({ b: 3 })
        expect(state.get()).toEqual({ a: 1, b: 3 })
    })

    it('throws on null in set()', () => {
        const state = new State({ a: 1 })
        expect(() => state.set(null)).toThrow('must be a plain object')
    })

    it('throws on array in set()', () => {
        const state = new State({ a: 1 })
        expect(() => state.set([1, 2, 3])).toThrow('must be a plain object')
    })

    it('emits events on set', () => {
        const state = new State({ count: 0 })
        let emitted = false
        state.on('state.count', () => { emitted = true })
        state.set({ count: 1 })
        expect(emitted).toBe(true)
    })

    it('does not emit events when emit=false', () => {
        const state = new State({ count: 0 })
        let emitted = false
        state.on('state.count', () => { emitted = true })
        state.set({ count: 1 }, false)
        expect(emitted).toBe(false)
    })

    it('empty() resets state', () => {
        const state = new State({ a: 1, b: 2 })
        state.empty()
        expect(state.get()).toEqual({})
    })

    it('handles nested objects', () => {
        const state = new State({ user: { name: 'Alice', age: 30 } })
        state.set({ user: { age: 31 } })
        expect(state.get().user.age).toBe(31)
        expect(state.get().user.name).toBe('Alice')
    })
})
