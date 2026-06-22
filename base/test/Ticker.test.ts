import { describe, it, expect } from 'vitest'
import Ticker from '../src/Ticker'

describe('Ticker', () => {

    it('throws if step is negative', () => {
        expect(() => new Ticker(-1)).toThrow('step must be non-negative')
    })

    it('throws if fn is not a function in onTick', () => {
        const ticker = new Ticker()
        expect(() => ticker.onTick(null as any)).toThrow('fn must be a function')
    })

    it('throws if delta is negative', () => {
        const ticker = new Ticker()
        ticker.start()
        expect(() => ticker.tick(-1)).toThrow('delta must be non-negative')
    })

    it('starts not running with zero elapsed', () => {
        const ticker = new Ticker()
        expect(ticker.running).toBe(false)
        expect(ticker.elapsed).toBe(0)
    })

    it('tick is a no-op when not running', () => {
        const calls: number[] = []
        const ticker = new Ticker()
        ticker.onTick((d) => calls.push(d))
        ticker.tick(16)
        expect(calls).toHaveLength(0)
        expect(ticker.elapsed).toBe(0)
    })

    it('variable-step (step=0): fires callback once per tick with actual delta', () => {
        const calls: Array<[number, number]> = []
        const ticker = new Ticker(0)
        ticker.onTick((d, e) => calls.push([d, e]))
        ticker.start()
        ticker.tick(16)
        ticker.tick(33)
        ticker.tick(0)
        expect(calls).toEqual([[16, 16], [33, 49], [0, 49]])
    })

    it('fixed-step: fires callback per complete step', () => {
        const calls: number[] = []
        const ticker = new Ticker(10)
        ticker.onTick((d) => calls.push(d))
        ticker.start()
        ticker.tick(25)
        expect(calls).toEqual([10, 10])
    })

    it('fixed-step: accumulates remainder across ticks', () => {
        const calls: number[] = []
        const ticker = new Ticker(10)
        ticker.onTick((d) => calls.push(d))
        ticker.start()
        ticker.tick(8)
        expect(calls).toHaveLength(0)
        ticker.tick(5)
        expect(calls).toEqual([10])
        ticker.tick(7)
        expect(calls).toEqual([10, 10])
    })

    it('fixed-step: callback receives fixed step, not actual delta', () => {
        const deltas: number[] = []
        const ticker = new Ticker(16)
        ticker.onTick((d) => deltas.push(d))
        ticker.start()
        ticker.tick(50)
        expect(deltas).toEqual([16, 16, 16])
    })

    it('elapsed accumulates all driven time regardless of step mode', () => {
        const ticker = new Ticker(10)
        ticker.start()
        ticker.tick(100)
        ticker.tick(50)
        expect(ticker.elapsed).toBe(150)
    })

    it('offTick removes the callback', () => {
        const calls: number[] = []
        const fn = (d: number) => calls.push(d)
        const ticker = new Ticker()
        ticker.onTick(fn)
        ticker.start()
        ticker.tick(10)
        ticker.offTick(fn)
        ticker.tick(10)
        expect(calls).toHaveLength(1)
    })

    it('offTick is a no-op for unknown callback', () => {
        const ticker = new Ticker()
        expect(() => ticker.offTick(() => {})).not.toThrow()
    })

    it('start and stop toggle running', () => {
        const ticker = new Ticker()
        expect(ticker.running).toBe(false)
        ticker.start()
        expect(ticker.running).toBe(true)
        ticker.stop()
        expect(ticker.running).toBe(false)
    })

    it('stop prevents callbacks from firing', () => {
        const calls: number[] = []
        const ticker = new Ticker()
        ticker.onTick((d) => calls.push(d))
        ticker.start()
        ticker.tick(10)
        ticker.stop()
        ticker.tick(10)
        expect(calls).toHaveLength(1)
    })

    it('reset clears elapsed, stops, and resets accumulator', () => {
        const calls: number[] = []
        const ticker = new Ticker(10)
        ticker.onTick((d) => calls.push(d))
        ticker.start()
        ticker.tick(8)
        ticker.reset()
        expect(ticker.running).toBe(false)
        expect(ticker.elapsed).toBe(0)
        ticker.start()
        ticker.tick(8)
        expect(calls).toHaveLength(0)
    })

    it('reset does not clear listeners', () => {
        const calls: number[] = []
        const ticker = new Ticker()
        ticker.onTick((d) => calls.push(d))
        ticker.reset()
        ticker.start()
        ticker.tick(5)
        expect(calls).toHaveLength(1)
    })

    it('multiple listeners all fire per tick', () => {
        const a: number[] = []
        const b: number[] = []
        const ticker = new Ticker()
        ticker.onTick((d) => a.push(d))
        ticker.onTick((d) => b.push(d))
        ticker.start()
        ticker.tick(5)
        expect(a).toEqual([5])
        expect(b).toEqual([5])
    })

    it('onTick, offTick, start, stop, reset return this', () => {
        const fn = () => {}
        const ticker = new Ticker()
        expect(ticker.onTick(fn)).toBe(ticker)
        expect(ticker.offTick(fn)).toBe(ticker)
        expect(ticker.start()).toBe(ticker)
        expect(ticker.stop()).toBe(ticker)
        expect(ticker.reset()).toBe(ticker)
    })

})
