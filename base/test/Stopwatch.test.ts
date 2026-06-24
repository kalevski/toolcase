import { describe, it, expect } from 'vitest'
import Stopwatch from '../src/Stopwatch'

describe('Stopwatch', () => {

    it('throws if now is not a function', () => {
        expect(() => new Stopwatch(null as any)).toThrow('now must be a function')
        expect(() => new Stopwatch(42 as any)).toThrow('now must be a function')
    })

    it('starts not running with zero elapsed', () => {
        const t = 0
        const sw = new Stopwatch(() => t)
        expect(sw.running).toBe(false)
        expect(sw.elapsed).toBe(0)
        expect(sw.laps).toEqual([])
    })

    it('reports elapsed while running', () => {
        let t = 0
        const sw = new Stopwatch(() => t)
        sw.start()
        t = 100
        expect(sw.elapsed).toBe(100)
        t = 250
        expect(sw.elapsed).toBe(250)
    })

    it('start is a no-op when already running', () => {
        let t = 0
        const sw = new Stopwatch(() => t)
        sw.start()
        t = 50
        sw.start()
        t = 100
        expect(sw.elapsed).toBe(100)
    })

    it('stop accumulates elapsed and clears running', () => {
        let t = 0
        const sw = new Stopwatch(() => t)
        sw.start()
        t = 200
        sw.stop()
        expect(sw.running).toBe(false)
        expect(sw.elapsed).toBe(200)
    })

    it('stop is a no-op when not running', () => {
        const t = 0
        const sw = new Stopwatch(() => t)
        sw.stop()
        expect(sw.elapsed).toBe(0)
    })

    it('elapsed does not tick while stopped', () => {
        let t = 0
        const sw = new Stopwatch(() => t)
        sw.start()
        t = 100
        sw.stop()
        t = 999
        expect(sw.elapsed).toBe(100)
    })

    it('pause then resume accumulates correctly', () => {
        let t = 0
        const sw = new Stopwatch(() => t)
        sw.start()
        t = 100
        sw.stop()
        t = 500
        sw.start()
        t = 600
        sw.stop()
        expect(sw.elapsed).toBe(200)
    })

    it('lap records interval since last lap', () => {
        let t = 0
        const sw = new Stopwatch(() => t)
        sw.start()
        t = 100
        const l1 = sw.lap()
        expect(l1).toBe(100)
        t = 250
        const l2 = sw.lap()
        expect(l2).toBe(150)
        expect(sw.laps).toEqual([100, 150])
    })

    it('lap works while stopped', () => {
        let t = 0
        const sw = new Stopwatch(() => t)
        sw.start()
        t = 80
        sw.stop()
        const l1 = sw.lap()
        expect(l1).toBe(80)
    })

    it('reset clears all state', () => {
        let t = 0
        const sw = new Stopwatch(() => t)
        sw.start()
        t = 200
        sw.lap()
        sw.reset()
        expect(sw.running).toBe(false)
        expect(sw.elapsed).toBe(0)
        expect(sw.laps).toEqual([])
    })

    it('can restart after reset', () => {
        let t = 0
        const sw = new Stopwatch(() => t)
        sw.start()
        t = 100
        sw.stop()
        sw.reset()
        t = 500
        sw.start()
        t = 600
        expect(sw.elapsed).toBe(100)
    })

    it('start, stop, reset all return this', () => {
        const t = 0
        const sw = new Stopwatch(() => t)
        expect(sw.start()).toBe(sw)
        expect(sw.stop()).toBe(sw)
        expect(sw.reset()).toBe(sw)
    })

})
