import { describe, it, expect } from 'vitest'
import LSystem from '../src/LSystem'

describe('LSystem', () => {
    it('initializes state to axiom and iteration to 0', () => {
        const ls = new LSystem({ axiom: 'A', rules: { A: 'AB' } })
        expect(ls.state).toBe('A')
        expect(ls.iteration).toBe(0)
    })

    it('rewrites state per rule on iterate', () => {
        const ls = new LSystem({ axiom: 'A', rules: { A: 'AB', B: 'A' } })
        expect(ls.iterate()).toBe('AB')
        expect(ls.iterate()).toBe('ABA')
        expect(ls.iterate()).toBe('ABAAB')
    })

    it('passes through chars without rules', () => {
        const ls = new LSystem({ axiom: 'F+F', rules: { F: 'F+F' } })
        expect(ls.iterate()).toBe('F+F+F+F')
    })

    it('increments iteration counter on each iterate', () => {
        const ls = new LSystem({ axiom: 'A', rules: { A: 'AB' } })
        ls.iterate()
        ls.iterate()
        expect(ls.iteration).toBe(2)
    })

    it('iterate returns the new state', () => {
        const ls = new LSystem({ axiom: 'X', rules: { X: 'XY' } })
        const out = ls.iterate()
        expect(out).toBe(ls.state)
    })
})
