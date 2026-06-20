interface CachedEntry<T> {
    fetchedAt: number
    data: T | null
}

type FetchFn<T> = (...args: any[]) => T | Promise<T>

class Cache<T> {

    private entries: Map<string, CachedEntry<T>> = new Map()

    private inflight: Map<string, Promise<T>> = new Map()

    private ms: number = 0

    private fetchFn: FetchFn<T>

    private maxEntries: number | undefined

    /**
     * @param fetchFn    - Function invoked to load data on a cache miss.
     * @param ms         - Time-to-live in milliseconds. `0` (default) or any value `≤ 0`
     *                     means entries never expire: once fetched, the cached value is
     *                     returned on every subsequent call until explicitly invalidated.
     *                     Positive values expire entries after the given number of
     *                     milliseconds.
     * @param maxEntries - Optional cap on stored entries; the least-recently-used entry
     *                     is evicted when the limit is exceeded.
     */
    constructor(fetchFn: FetchFn<T>, ms: number = 0, maxEntries?: number) {
        if (typeof fetchFn !== 'function') {
            throw new Error(`fetchFn must be a function, ${fetchFn} provided`)
        }

        this.fetchFn = fetchFn
        this.maxEntries = maxEntries
        this.setMS(ms)
    }

    async get(...args: any[]): Promise<T | null> {
        const hash = this.getHash(args)
        const entry = this.getEntry(hash)
        const needsFetch = entry.fetchedAt === 0 || (this.ms > 0 && this.getTime() > entry.fetchedAt + this.ms)
        if (!needsFetch) return entry.data
        let p = this.inflight.get(hash)
        if (!p) {
            p = Promise.resolve(this.fetchFn(...args))
            this.inflight.set(hash, p)
            p.finally(() => this.inflight.delete(hash))
        }
        entry.data = await p
        entry.fetchedAt = this.getTime()
        return entry.data
    }

    /**
     * Update the TTL. `ms ≤ 0` sets cache-forever mode; positive values set a
     * finite expiry window in milliseconds.
     */
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
        return Date.now()
    }

    private getHash(filter: any): string {
        const hash = JSON.stringify(filter)
        return hash
    }

    private getEntry(hash: string): CachedEntry<T> {
        let entry = this.entries.get(hash) || null
        if (entry === null) {
            if (this.maxEntries !== undefined && this.entries.size >= this.maxEntries) {
                const firstKey = this.entries.keys().next().value as string
                this.entries.delete(firstKey)
            }
            entry = { data: null, fetchedAt: 0 }
            this.entries.set(hash, entry)
        } else {
            // Move to end to mark as most-recently used
            this.entries.delete(hash)
            this.entries.set(hash, entry)
        }
        return entry
    }

}

export default Cache
