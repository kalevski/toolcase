type DequeNode<T> = { value: T, prev: DequeNode<T> | null, next: DequeNode<T> | null }

class Deque<T> {

    private head: DequeNode<T> | null = null

    private tail: DequeNode<T> | null = null

    private count: number = 0

    get size(): number {
        return this.count
    }

    pushFront(item: T): this {
        if (item === undefined) {
            throw new Error('item can not be undefined')
        }
        const node: DequeNode<T> = { value: item, prev: null, next: this.head }
        if (this.head !== null) {
            this.head.prev = node
        } else {
            this.tail = node
        }
        this.head = node
        this.count++
        return this
    }

    pushBack(item: T): this {
        if (item === undefined) {
            throw new Error('item can not be undefined')
        }
        const node: DequeNode<T> = { value: item, prev: this.tail, next: null }
        if (this.tail !== null) {
            this.tail.next = node
        } else {
            this.head = node
        }
        this.tail = node
        this.count++
        return this
    }

    popFront(): T | null {
        if (this.head === null) return null
        const value = this.head.value
        this.head = this.head.next
        if (this.head !== null) {
            this.head.prev = null
        } else {
            this.tail = null
        }
        this.count--
        return value
    }

    popBack(): T | null {
        if (this.tail === null) return null
        const value = this.tail.value
        this.tail = this.tail.prev
        if (this.tail !== null) {
            this.tail.next = null
        } else {
            this.head = null
        }
        this.count--
        return value
    }

    peekFront(): T | null {
        return this.head === null ? null : this.head.value
    }

    peekBack(): T | null {
        return this.tail === null ? null : this.tail.value
    }

    isEmpty(): boolean {
        return this.count === 0
    }

    clear(): this {
        this.head = null
        this.tail = null
        this.count = 0
        return this
    }

    [Symbol.iterator](): Iterator<T> {
        let current = this.head
        return {
            next(): IteratorResult<T> {
                if (current === null) return { value: undefined as unknown as T, done: true }
                const value = current.value
                current = current.next
                return { value, done: false }
            }
        }
    }

}

export default Deque
