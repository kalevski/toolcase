class Random {

    private state: number

    constructor(seed: number) {
        if (typeof seed !== 'number' || !Number.isFinite(seed)) {
            throw new Error('seed must be a finite number')
        }
        this.state = seed >>> 0
    }

    next(): number {
        this.state = (this.state + 0x6D2B79F5) >>> 0
        let t = this.state
        t = Math.imul(t ^ (t >>> 15), t | 1)
        t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296
    }

    int(min: number, max: number): number {
        if (!Number.isInteger(min) || !Number.isInteger(max)) {
            throw new Error('min and max must be integers')
        }
        if (min > max) {
            throw new Error('min must be <= max')
        }
        return Math.floor(this.next() * (max - min + 1)) + min
    }

    float(min: number, max: number): number {
        if (!Number.isFinite(min) || !Number.isFinite(max)) {
            throw new Error('min and max must be finite numbers')
        }
        if (min > max) {
            throw new Error('min must be <= max')
        }
        return this.next() * (max - min) + min
    }

    bool(p: number = 0.5): boolean {
        if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) {
            throw new Error('p must be a number in [0, 1]')
        }
        return this.next() < p
    }

    pick<T>(arr: T[]): T {
        if (!Array.isArray(arr) || arr.length === 0) {
            throw new Error('arr must be a non-empty array')
        }
        return arr[Math.floor(this.next() * arr.length)]
    }

    shuffle<T>(arr: T[]): T[] {
        if (!Array.isArray(arr)) {
            throw new Error('arr must be an array')
        }
        const result = arr.slice()
        for (let i = result.length - 1; i > 0; i--) {
            const j = Math.floor(this.next() * (i + 1))
            const tmp = result[i]
            result[i] = result[j]
            result[j] = tmp
        }
        return result
    }

    weighted<T>(entries: Array<{ item: T, weight: number }>): T {
        if (!Array.isArray(entries) || entries.length === 0) {
            throw new Error('entries must be a non-empty array')
        }
        let total = 0
        for (const entry of entries) {
            if (typeof entry.weight !== 'number' || !Number.isFinite(entry.weight) || entry.weight < 0) {
                throw new Error('all weights must be non-negative finite numbers')
            }
            total += entry.weight
        }
        if (total <= 0) {
            throw new Error('total weight must be greater than zero')
        }
        const target = this.next() * total
        let acc = 0
        for (const entry of entries) {
            acc += entry.weight
            if (target < acc) {
                return entry.item
            }
        }
        return entries[entries.length - 1].item
    }

}

export default Random
