type TickCallback = (delta: number, elapsed: number) => void

class Ticker {

    private readonly step: number

    private accumulator: number = 0

    private totalElapsed: number = 0

    private listeners: TickCallback[] = []

    private active: boolean = false

    constructor(step: number = 0) {
        if (step < 0) {
            throw new Error('step must be non-negative')
        }
        this.step = step
    }

    get running(): boolean {
        return this.active
    }

    get elapsed(): number {
        return this.totalElapsed
    }

    onTick(fn: TickCallback): this {
        if (typeof fn !== 'function') {
            throw new Error('fn must be a function')
        }
        this.listeners.push(fn)
        return this
    }

    offTick(fn: TickCallback): this {
        const idx = this.listeners.indexOf(fn)
        if (idx !== -1) this.listeners.splice(idx, 1)
        return this
    }

    tick(delta: number): void {
        if (!this.active) return
        if (delta < 0) {
            throw new Error('delta must be non-negative')
        }
        this.totalElapsed += delta
        if (this.step === 0) {
            for (const fn of this.listeners.slice()) {
                fn(delta, this.totalElapsed)
            }
        } else {
            this.accumulator += delta
            while (this.accumulator >= this.step) {
                this.accumulator -= this.step
                for (const fn of this.listeners.slice()) {
                    fn(this.step, this.totalElapsed)
                }
            }
        }
    }

    start(): this {
        this.active = true
        return this
    }

    stop(): this {
        this.active = false
        return this
    }

    reset(): this {
        this.active = false
        this.accumulator = 0
        this.totalElapsed = 0
        return this
    }

}

export default Ticker
