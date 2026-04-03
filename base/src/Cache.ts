interface CachedEntry<T> {
    fetchedAt: number
    data: T | null
}

type FetchFn<T> = (...args: any[]) => T | Promise<T>

class Cache<T> {

    private entries: Map<string, CachedEntry<T>> = new Map()

    readonly fetchedAt: number = 0

    private ms: number = 0

    private fetchFn: FetchFn<T>

    constructor(fetchFn: FetchFn<T>, ms: number = 0) {
        if (typeof fetchFn !== 'function') {
            throw new Error(`fetchFn must be a function, ${fetchFn} provided`)
        }
        
        this.fetchFn = fetchFn
        this.setMS(ms)
    }

    async get(...args: any[]): Promise<T | null> {
        const currentTime = this.getTime()
        const hash = this.getHash(args)
        const entry = this.getEntry(hash)
        if (currentTime > entry.fetchedAt + this.ms) {
            entry.data = await this.fetchFn(...args)
            entry.fetchedAt = currentTime
        }
        return entry.data
    }

    setMS(ms: number = 0): void {
        if (typeof ms !== 'number') {
            throw new Error(`ms must be a number, ${ms} provided`)
        }
        this.ms = ms
    }

    invalidate(...args: any[]): void {
        const hash = this.getHash(args)
        this.entries.delete(hash)
    }

    private getTime(): number {
        return new Date().getTime()
    }

    private getHash(filter: any): string {
        const hash = JSON.stringify(filter)
        return hash
    }

    private getEntry(hash: string): CachedEntry<T> {
        let entry = this.entries.get(hash) || null
        if (entry === null) {
            entry = { data: null, fetchedAt: 0 }
            this.entries.set(hash, entry)
        }
        return entry
    }

}

export default Cache
