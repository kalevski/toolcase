class Semaphore {

    private permits: number

    private queue: Array<() => void>

    constructor(permits: number) {
        if (!Number.isInteger(permits) || permits < 1) {
            throw new Error('permits must be a positive integer')
        }
        this.permits = permits
        this.queue = []
    }

    get available(): number {
        return this.permits
    }

    acquire(): Promise<void> {
        if (this.permits > 0) {
            this.permits--
            return Promise.resolve()
        }
        return new Promise(resolve => {
            this.queue.push(resolve)
        })
    }

    release(): void {
        if (this.queue.length > 0) {
            const next = this.queue.shift()!
            next()
        } else {
            this.permits++
        }
    }

    async run<T>(fn: () => T | Promise<T>): Promise<T> {
        await this.acquire()
        try {
            return await Promise.resolve(fn())
        } finally {
            this.release()
        }
    }

}

export default Semaphore
