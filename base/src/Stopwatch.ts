type NowFn = () => number

class Stopwatch {

    private readonly clock: NowFn

    private startedAt: number | null = null

    private accumulatedMs: number = 0

    private lapTimes: number[] = []

    private lapStart: number = 0

    constructor(now: NowFn = () => Date.now()) {
        if (typeof now !== 'function') {
            throw new Error('now must be a function')
        }
        this.clock = now
    }

    get running(): boolean {
        return this.startedAt !== null
    }

    get elapsed(): number {
        if (this.startedAt === null) return this.accumulatedMs
        return this.accumulatedMs + (this.clock() - this.startedAt)
    }

    get laps(): readonly number[] {
        return this.lapTimes
    }

    start(): this {
        if (this.startedAt !== null) return this
        this.startedAt = this.clock()
        return this
    }

    stop(): this {
        if (this.startedAt === null) return this
        this.accumulatedMs += this.clock() - this.startedAt
        this.startedAt = null
        return this
    }

    lap(): number {
        const current = this.elapsed
        const lapTime = current - this.lapStart
        this.lapTimes.push(lapTime)
        this.lapStart = current
        return lapTime
    }

    reset(): this {
        this.startedAt = null
        this.accumulatedMs = 0
        this.lapTimes = []
        this.lapStart = 0
        return this
    }

}

export default Stopwatch
