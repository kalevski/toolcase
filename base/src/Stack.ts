class Stack<T> {

    private items: T[] = []

    get size(): number {
        return this.items.length
    }

    push(item: T): this {
        if (item === undefined) {
            throw new Error('item can not be undefined')
        }
        this.items.push(item)
        return this
    }

    pop(): T | null {
        return this.items.length === 0 ? null : (this.items.pop() as T)
    }

    peek(): T | null {
        return this.items.length === 0 ? null : this.items[this.items.length - 1]
    }

    isEmpty(): boolean {
        return this.items.length === 0
    }

    clear(): this {
        this.items = []
        return this
    }

    [Symbol.iterator](): Iterator<T> {
        const items = this.items
        const len = items.length
        let i = 0
        return {
            next(): IteratorResult<T> {
                if (i >= len) return { value: undefined as unknown as T, done: true }
                return { value: items[i++], done: false }
            }
        }
    }

}

export default Stack
