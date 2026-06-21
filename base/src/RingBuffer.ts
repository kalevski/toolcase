class RingBuffer<T> {

    private readonly buf: (T | undefined)[]

    private head: number = 0

    private count: number = 0

    readonly capacity: number

    constructor(capacity: number) {
        if (!Number.isInteger(capacity) || capacity < 1) {
            throw new Error('capacity must be a positive integer')
        }
        this.capacity = capacity
        this.buf = new Array(capacity)
    }

    get size(): number {
        return this.count
    }

    push(item: T): this {
        if (item === undefined) {
            throw new Error('item can not be undefined')
        }
        if (this.count < this.capacity) {
            this.buf[(this.head + this.count) % this.capacity] = item
            this.count++
        } else {
            this.buf[this.head] = item
            this.head = (this.head + 1) % this.capacity
        }
        return this
    }

    peek(): T | null {
        if (this.count === 0) return null
        return this.buf[this.head] as T
    }

    tail(n: number): T[] {
        const take = Math.min(Math.max(0, n), this.count)
        if (take === 0) return []
        const result: T[] = new Array(take)
        const start = (this.head + this.count - take) % this.capacity
        for (let i = 0; i < take; i++) {
            result[i] = this.buf[(start + i) % this.capacity] as T
        }
        return result
    }

    clear(): this {
        this.head = 0
        this.count = 0
        return this
    }

    [Symbol.iterator](): Iterator<T> {
        let i = 0
        const count = this.count
        const head = this.head
        const cap = this.capacity
        const buf = this.buf
        return {
            next(): IteratorResult<T> {
                if (i >= count) return { value: undefined as unknown as T, done: true }
                const value = buf[(head + i) % cap] as T
                i++
                return { value, done: false }
            }
        }
    }

}

export default RingBuffer
