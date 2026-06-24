class MultiMap<K, V> {

    private store: Map<K, Set<V>> = new Map()

    private total: number = 0

    get size(): number {
        return this.total
    }

    set(key: K, value: V): this {
        let bucket = this.store.get(key)
        if (bucket === undefined) {
            bucket = new Set()
            this.store.set(key, bucket)
        }
        if (!bucket.has(value)) {
            bucket.add(value)
            this.total++
        }
        return this
    }

    get(key: K): ReadonlySet<V> | undefined {
        return this.store.get(key)
    }

    has(key: K, value?: V): boolean {
        const bucket = this.store.get(key)
        if (bucket === undefined) {
            return false
        }
        if (value === undefined) {
            return true
        }
        return bucket.has(value)
    }

    delete(key: K, value?: V): boolean {
        const bucket = this.store.get(key)
        if (bucket === undefined) {
            return false
        }
        if (value === undefined) {
            this.total -= bucket.size
            this.store.delete(key)
            return true
        }
        if (!bucket.has(value)) {
            return false
        }
        bucket.delete(value)
        this.total--
        if (bucket.size === 0) {
            this.store.delete(key)
        }
        return true
    }

    keys(): IterableIterator<K> {
        return this.store.keys()
    }

    clear(): this {
        this.store.clear()
        this.total = 0
        return this
    }

    [Symbol.iterator](): Iterator<[K, ReadonlySet<V>]> {
        return this.store[Symbol.iterator]() as Iterator<[K, ReadonlySet<V>]>
    }

}

export default MultiMap
