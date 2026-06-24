class BiMap<K, V> {

    private forward: Map<K, V> = new Map()

    private reverse: Map<V, K> = new Map()

    get size(): number {
        return this.forward.size
    }

    set(key: K, value: V): this {
        const existingKey = this.reverse.get(value)
        if (existingKey !== undefined && existingKey !== key) {
            this.forward.delete(existingKey)
        }
        const existingValue = this.forward.get(key)
        if (existingValue !== undefined && existingValue !== value) {
            this.reverse.delete(existingValue)
        }
        this.forward.set(key, value)
        this.reverse.set(value, key)
        return this
    }

    get(key: K): V | null {
        return this.forward.get(key) ?? null
    }

    getKey(value: V): K | null {
        return this.reverse.get(value) ?? null
    }

    has(key: K): boolean {
        return this.forward.has(key)
    }

    hasValue(value: V): boolean {
        return this.reverse.has(value)
    }

    delete(key: K): boolean {
        const value = this.forward.get(key)
        if (value === undefined) {
            return false
        }
        this.forward.delete(key)
        this.reverse.delete(value)
        return true
    }

    deleteByValue(value: V): boolean {
        const key = this.reverse.get(value)
        if (key === undefined) {
            return false
        }
        this.reverse.delete(value)
        this.forward.delete(key)
        return true
    }

    clear(): this {
        this.forward.clear()
        this.reverse.clear()
        return this
    }

    [Symbol.iterator](): Iterator<[K, V]> {
        return this.forward[Symbol.iterator]()
    }

}

export default BiMap
