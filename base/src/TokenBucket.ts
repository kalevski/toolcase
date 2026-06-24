type NowFn = () => number

class TokenBucket {

    readonly capacity: number

    readonly refillRate: number

    private readonly clock: NowFn

    private current: number

    private lastRefill: number

    constructor(capacity: number, refillRate: number, now: NowFn = () => Date.now()) {
        if (!Number.isFinite(capacity) || capacity <= 0) {
            throw new Error('capacity must be a positive finite number')
        }
        if (!Number.isFinite(refillRate) || refillRate <= 0) {
            throw new Error('refillRate must be a positive finite number')
        }
        if (typeof now !== 'function') {
            throw new Error('now must be a function')
        }
        this.capacity = capacity
        this.refillRate = refillRate
        this.clock = now
        this.current = capacity
        this.lastRefill = now()
    }

    get tokens(): number {
        const elapsed = Math.max(0, this.clock() - this.lastRefill)
        return Math.min(this.capacity, this.current + elapsed * this.refillRate)
    }

    tryRemove(n: number = 1): boolean {
        if (n <= 0) {
            throw new Error('n must be positive')
        }
        this.doRefill()
        if (this.current < n) {
            return false
        }
        this.current -= n
        return true
    }

    take(n: number = 1): boolean {
        return this.tryRemove(n)
    }

    private doRefill(): void {
        const t = this.clock()
        const elapsed = t - this.lastRefill
        if (elapsed > 0) {
            this.current = Math.min(this.capacity, this.current + elapsed * this.refillRate)
            this.lastRefill = t
        }
    }

}

export default TokenBucket
