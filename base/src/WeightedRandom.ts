type WeightFn<T> = (item: T) => number
type RandomFn = () => number

class WeightedRandom<T> {

    private items: T[] = []

    private cumulative: number[] = []

    private total: number = 0

    private random: RandomFn

    constructor(items: Iterable<T>, weightFn: WeightFn<T>, random: RandomFn = Math.random) {
        if (typeof weightFn !== 'function') {
            throw new Error('weightFn is required')
        }
        if (typeof random !== 'function') {
            throw new Error('random must be a function')
        }
        this.random = random
        for (const item of items) {
            const weight = weightFn(item)
            if (typeof weight !== 'number' || !Number.isFinite(weight) || weight < 0) {
                throw new Error('weight must be a non-negative finite number')
            }
            if (weight === 0) {
                continue
            }
            this.total += weight
            this.items.push(item)
            this.cumulative.push(this.total)
        }
        if (this.items.length === 0) {
            throw new Error('at least one item with positive weight is required')
        }
    }

    get length(): number {
        return this.items.length
    }

    get totalWeight(): number {
        return this.total
    }

    pick(): T {
        const target = this.random() * this.total
        let lo = 0
        let hi = this.cumulative.length - 1
        while (lo < hi) {
            const mid = (lo + hi) >>> 1
            if (this.cumulative[mid] <= target) {
                lo = mid + 1
            } else {
                hi = mid
            }
        }
        return this.items[lo]
    }

    pickMany(count: number): T[] {
        if (!Number.isInteger(count) || count < 0) {
            throw new Error('count must be a non-negative integer')
        }
        const result: T[] = []
        for (let i = 0; i < count; i++) {
            result.push(this.pick())
        }
        return result
    }

    probabilityOf(predicate: (item: T) => boolean): number {
        if (typeof predicate !== 'function') {
            throw new Error('predicate is required')
        }
        let sum = 0
        for (let i = 0; i < this.items.length; i++) {
            if (predicate(this.items[i])) {
                const prev = i === 0 ? 0 : this.cumulative[i - 1]
                sum += this.cumulative[i] - prev
            }
        }
        return sum / this.total
    }

}

export default WeightedRandom
