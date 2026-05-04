import { describe, it, expect, vi } from 'vitest'
import ObjectPool from '../src/ObjectPool'

class Particle {
    x: number = 0
    y: number = 0
    alive: boolean = true
}

describe('ObjectPool', () => {
    it('creates instance on demand when empty', () => {
        const pool = new ObjectPool(Particle)
        const p = pool.obtain()
        expect(p).toBeInstanceOf(Particle)
    })

    it('reuses released instance', () => {
        const pool = new ObjectPool(Particle)
        const a = pool.obtain()
        a.release()
        const b = pool.obtain()
        expect(b).toBe(a)
    })

    it('runs resetFn before returning to pool on release', () => {
        const reset = vi.fn((p: Particle) => { p.alive = false })
        const pool = new ObjectPool(Particle, reset)
        const p = pool.obtain()
        p.release()
        expect(reset).toHaveBeenCalledWith(p)
        expect(p.alive).toBe(false)
    })

    it('uses custom instanceFn when provided', () => {
        const factory = vi.fn((Cls: any) => {
            const inst = new Cls()
            inst.x = 99
            return inst
        })
        const pool = new ObjectPool(Particle, null, factory)
        const p = pool.obtain()
        expect(p.x).toBe(99)
        expect(factory).toHaveBeenCalled()
    })

    it('release auto-binds for chained calls', () => {
        const pool = new ObjectPool(Particle)
        const p = pool.obtain()
        expect(typeof p.release).toBe('function')
        expect(() => p.release()).not.toThrow()
    })

    it('throws if obtained class already defines release', () => {
        class Conflict { release = () => {} }
        const pool = new ObjectPool<any>(Conflict as any)
        expect(() => pool.obtain()).toThrow(/already has release function/)
    })

    it('dispose empties the pool', () => {
        const pool = new ObjectPool(Particle)
        const p = pool.obtain()
        p.release()
        pool.dispose()
        const next = pool.obtain()
        expect(next).not.toBe(p)
    })
})
