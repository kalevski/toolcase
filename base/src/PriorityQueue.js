
/**
 * @template T
 */
 class PriorityQueue {

    /**
     * @callback PriorityFn
     * @param {T} node
     * @returns {number}
     */

    /**
     * @callback UniqueFn
     * @param {T} node
     * @returns {string}
     */


    /**
     * @private
     * @type {Array<T>}
     */
    values = []

    /**
     * @private
     * @type {Map<string,string>}
     */
    hashMap = new Map()

    /**
     * @private
     * @type {PriorityFn}
     */
    priorityFn = null

    /**
     * @private
     * @type {UniqueFn}
     */
    uniqueFn = null

    /**
     * 
     * @param {PriorityFn} priorityFn
     * @param {UniqueFn} uniqueFn
     */
    constructor(priorityFn, uniqueFn = null) {
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

    get length() {
        return this.values.length
    }

    /**
     * 
     * @param {T} value 
     * @returns {boolean}
     */
    enqueue(value) {
        if (typeof value === 'undefined') {
            throw new Error('value can not be undefined')   
        }
        this.values.push(value)
        this.bubbleUp()
        if (this.uniqueFn !== null) {
            this.hashMap.set(this.uniqueFn(value), 0)
        }
        return true
    }

    dequeue() {
        this.swap(0, this.values.length - 1)
        let node = this.values.pop() || null
        if (this.values.length > 1) {
            this.bubbleDown()
        }
        
        if (this.uniqueFn !== null && node !== null) {
            this.hashMap.delete(this.uniqueFn(node))
        }
        return node
    }

    pop() {
        let node = this.values.pop() || null
        if (this.uniqueFn !== null && node !== null) {
            this.hashMap.delete(this.uniqueFn(node))
        }
        return node
    }

    /**
     * 
     * @param {T} value 
     */
    has(value) {
        if (this.uniqueFn === null) {
            return null
        }
        return this.hashMap.has(this.uniqueFn(value))
    }

    /** @private */
    bubbleUp() {
        let index = this.values.length - 1
        while(index > 0) {
            let parentIndex = Math.floor((index - 1) / 2)
            if (this.getPriority(parentIndex) > this.getPriority(index)) {
                this.swap(index, parentIndex)
                index = parentIndex
            } else {
                break
            }
        }
    }

    /** @private */
    bubbleDown() {
        let parentIndex = 0
        const priority = this.getPriority(parentIndex)

        while(true) {
            
            let indexToSwap = null

            let leftIndex = (2 * parentIndex) + 1
            let rightIndex = (2 * parentIndex) + 2
            
            const leftChildPriority = this.getPriority(leftIndex)
            const rightChildPriority = this.getPriority(rightIndex)

            if (leftIndex < this.values.length && leftChildPriority <= priority) {
                indexToSwap = leftIndex
            }
            let conditionA = rightChildPriority < priority && indexToSwap === null
            let conditionB = rightChildPriority < leftChildPriority && indexToSwap !== null
            
            if (rightIndex < this.values.length && (conditionA || conditionB)) {
                indexToSwap = rightIndex
            }

            if (indexToSwap === null) {
                break
            }

            this.swap(parentIndex, indexToSwap)
            parentIndex = indexToSwap
            // break
        }
    }

    /**
     * @private
     * @param {number} indexA 
     * @param {number} indexB 
     */
    swap(indexA, indexB) {
        let temp = this.values[indexA]
        this.values[indexA] = this.values[indexB]
        this.values[indexB] = temp
    }

    /**
     * @private
     * @param {number} index 
     * @returns {number}
     */
    getPriority(index) {
        let node = this.values[index] || null
        return node === null ? Number.MAX_SAFE_INTEGER : this.priorityFn(node)
    }

}

export default PriorityQueue