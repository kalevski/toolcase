class AsyncQueue<T> {

    private readonly cap: number

    private readonly buf: T[]

    private readonly pullers: Array<{ resolve: (v: T) => void; reject: (e: Error) => void }>

    private readonly pushers: Array<() => void>

    private readonly drainers: Array<() => void>

    private isDone: boolean

    constructor(capacity: number = Infinity) {
        if (capacity !== Infinity && (!Number.isInteger(capacity) || capacity < 1)) {
            throw new Error('capacity must be a positive integer')
        }
        this.cap = capacity
        this.buf = []
        this.pullers = []
        this.pushers = []
        this.drainers = []
        this.isDone = false
    }

    get size(): number {
        return this.buf.length
    }

    get closed(): boolean {
        return this.isDone
    }

    push(item: T): Promise<void> {
        if (item === undefined) {
            throw new Error('item can not be undefined')
        }
        if (this.isDone) {
            throw new Error('queue is closed')
        }
        if (this.pullers.length > 0) {
            const { resolve } = this.pullers.shift()!
            resolve(item)
            return Promise.resolve()
        }
        if (this.buf.length < this.cap) {
            this.buf.push(item)
            return Promise.resolve()
        }
        return new Promise<void>((resolve, reject) => {
            this.pushers.push(() => {
                if (this.isDone) {
                    reject(new Error('queue is closed'))
                } else {
                    this.buf.push(item)
                    resolve()
                }
            })
        })
    }

    pull(): Promise<T> {
        if (this.buf.length > 0) {
            const item = this.buf.shift()!
            this.wakePusher()
            this.flushDrainers()
            return Promise.resolve(item)
        }
        if (this.isDone) {
            return Promise.reject(new Error('queue is closed'))
        }
        return new Promise<T>((resolve, reject) => {
            this.pullers.push({ resolve, reject })
        })
    }

    close(): void {
        if (this.isDone) {
            return
        }
        this.isDone = true
        const err = new Error('queue is closed')
        for (const { reject } of this.pullers) {
            reject(err)
        }
        this.pullers.length = 0
        for (const fn of this.pushers) {
            fn()
        }
        this.pushers.length = 0
        this.flushDrainers()
    }

    drain(): Promise<void> {
        if (this.buf.length === 0) {
            return Promise.resolve()
        }
        return new Promise<void>(resolve => {
            this.drainers.push(resolve)
        })
    }

    [Symbol.asyncIterator](): AsyncIterator<T> {
        return {
            next: async (): Promise<IteratorResult<T>> => {
                try {
                    const value = await this.pull()
                    return { value, done: false }
                } catch {
                    return { value: undefined as any, done: true }
                }
            }
        }
    }

    private wakePusher(): void {
        if (this.pushers.length > 0) {
            const fn = this.pushers.shift()!
            fn()
        }
    }

    private flushDrainers(): void {
        if (this.buf.length === 0) {
            for (const resolve of this.drainers) {
                resolve()
            }
            this.drainers.length = 0
        }
    }

}

export default AsyncQueue
