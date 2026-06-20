type PriorityFn<T> = (node: T) => number
type UniqueFn<T> = (node: T) => string

class PriorityQueue<T> {

    private values: T[] = []

    private hashMap: Map<string, number> = new Map()

    private priorityFn: PriorityFn<T>

    private uniqueFn: UniqueFn<T> | null = null

    constructor(priorityFn: PriorityFn<T>, uniqueFn: UniqueFn<T> | null = null) {
        if (typeof priorityFn !== 'function') {
            throw new Error('priorityFn is required')
        }
        this.priorityFn = priorityFn

        if (typeof uniqueFn !== 'function') {
            this.uniqueFn = null
        } else {
            this.uniqueFn = uniqueFn
        }
        
    }

    get length(): number {
        return this.values.length
    }

    enqueue(value: T): boolean {
        if (typeof value === 'undefined') {
            throw new Error('value can not be undefined')   
        }
        this.values.push(value)
        this.bubbleUp()
        if (this.uniqueFn !== null) {
            const key = this.uniqueFn(value)
            this.hashMap.set(key, (this.hashMap.get(key) ?? 0) + 1)
        }
        return true
    }

    dequeue(): T | null {
        if (this.values.length === 0) return null
        this.swap(0, this.values.length - 1)
        const node = this.values.pop() || null
        if (this.values.length > 1) {
            this.bubbleDown()
        }
        
        if (this.uniqueFn !== null && node !== null) {
            const key = this.uniqueFn(node)
            const next = (this.hashMap.get(key) ?? 0) - 1
            if (next <= 0) this.hashMap.delete(key)
            else this.hashMap.set(key, next)
        }
        return node
    }

    pop(): T | null {
        const node = this.values.pop() || null
        if (this.uniqueFn !== null && node !== null) {
            const key = this.uniqueFn(node)
            const next = (this.hashMap.get(key) ?? 0) - 1
            if (next <= 0) this.hashMap.delete(key)
            else this.hashMap.set(key, next)
        }
        return node
    }

    has(value: T): boolean | null {
        if (this.uniqueFn === null) {
            return null
        }
        return this.hashMap.has(this.uniqueFn(value))
    }

    private bubbleUp(): void {
        let index = this.values.length - 1
        while(index > 0) {
            const parentIndex = Math.floor((index - 1) / 2)
            if (this.getPriority(parentIndex) > this.getPriority(index)) {
                this.swap(index, parentIndex)
                index = parentIndex
            } else {
                break
            }
        }
    }

    private bubbleDown(): void {
        let parentIndex = 0
        const priority = this.getPriority(parentIndex)

        while(true) {
            
            let indexToSwap: number | null = null

            const leftIndex = (2 * parentIndex) + 1
            const rightIndex = (2 * parentIndex) + 2
            
            const leftChildPriority = this.getPriority(leftIndex)
            const rightChildPriority = this.getPriority(rightIndex)

            if (leftIndex < this.values.length && leftChildPriority <= priority) {
                indexToSwap = leftIndex
            }
            const conditionA = rightChildPriority < priority && indexToSwap === null
            const conditionB = rightChildPriority < leftChildPriority && indexToSwap !== null
            
            if (rightIndex < this.values.length && (conditionA || conditionB)) {
                indexToSwap = rightIndex
            }

            if (indexToSwap === null) {
                break
            }

            this.swap(parentIndex, indexToSwap)
            parentIndex = indexToSwap
        }
    }

    private swap(indexA: number, indexB: number): void {
        const temp = this.values[indexA]
        this.values[indexA] = this.values[indexB]
        this.values[indexB] = temp
    }

    private getPriority(index: number): number {
        const node = this.values[index] || null
        return node === null ? Number.MAX_SAFE_INTEGER : this.priorityFn(node)
    }

}

export default PriorityQueue
