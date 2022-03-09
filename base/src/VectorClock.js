class VectorClock {

    /**
     * @readonly
     * @type {string}
     */
    nodeId = null

    /**
     * @private
     * @type {Object.<string, number>}
     */
    data = {}

    /**
     * 
     * @param {string} nodeId 
     * @param {Object.<string, number>} data 
     */
    constructor(nodeId, data = {}) {
        this.nodeId = nodeId
        this.data = data
    }

    /**
     * 
     * @param {Object.<string, number>} object 
     */
    setClock(clock = {}) {
        this.data = clock
    }

    /**
     * 
     * @returns {Object.<string, number>}
     */
    getClock() {
        return { ...this.data }
    }

    /**
     * 
     * @param {number} version
     * @param {string} nodeId 
     */
    setVersion(version, nodeId = this.nodeId) {
        this.data[nodeId] = version
    }

    /**
     * 
     * @param {string} nodeId
     * @returns {number}
     */
    getVersion(nodeId = this.nodeId) {
        return this.data[nodeId] || 0
    }

    /**
     * 
     */
    increment() {
        this.data[this.nodeId] = this.getVersion(this.nodeId) + 1
    }

    /**
     * 
     * @param {VectorClock} vectorClock 
     */
    update(vectorClock) {
        const updated = {}
        for (let nodeId of VectorClock.getNodeIds(this, vectorClock)) {
            updated[nodeId] = Math.max(this.getVersion(nodeId), vectorClock.getVersion(nodeId))
        }
        this.data = updated
    }

    /**
     * 
     * @param {VectorClock} vectorClock 
     * @returns {boolean} 
     */
    isAfter(vectorClock) {
        return VectorClock.isAfter(this, vectorClock)
    }

    /**
     * 
     * @param {VectorClock} vectorClock
     * @returns {boolean} 
     */
    isConcurrent(vectorClock) {
        return VectorClock.isConcurrent(this, vectorClock)
    }

    /**
     * 
     * @param {VectorClock} vectorClock 
     */
    isBefore(vectorClock) {
        return VectorClock.isBefore(this, vectorClock)
    }
}

/**
 * 
 * @param {VectorClock} vectorClock1 
 * @param {VectorClock} vectorClock2
 * @returns {Array.<string>} 
 */
VectorClock.getNodeIds = (vectorClock1, vectorClock2) => {
    const map = { ...vectorClock1.getClock(), ...vectorClock2.getClock() }
    return Object.keys(map)
}

/**
 * 
 * @param {VectorClock} vectorClock1 
 * @param {VectorClock} vectorClock2
 * @returns {boolean} 
 */
VectorClock.isAfter = (vectorClock1, vectorClock2) => {
    let isAfter = true
    for (let nodeId of VectorClock.getNodeIds(vectorClock1, vectorClock2)) {
        if (vectorClock1.getVersion(nodeId) < vectorClock2.getVersion(nodeId)) {
            isAfter = false
        }
    }
    return isAfter
}

/**
 * 
 * @param {VectorClock} vectorClock1 
 * @param {VectorClock} vectorClock2 
 */
VectorClock.isConcurrent = (vectorClock1, vectorClock2) => {
    return !(VectorClock.isAfter(vectorClock1, vectorClock2) || VectorClock.isAfter(vectorClock2, vectorClock1))
}


/**
 * 
 * @param {VectorClock} vectorClock1 
 * @param {VectorClock} vectorClock2 
 */
VectorClock.isBefore = (vectorClock1, vectorClock2) => {
    return !VectorClock.isAfter(vectorClock1, vectorClock2) && !VectorClock.isConcurrent(vectorClock1, vectorClock2)
}

/**
 * 
 * @param {VectorClock} vectorClock1 
 * @param {VectorClock} vectorClock2
 * @returns {number} 
 */
VectorClock.compare = (vectorClock1, vectorClock2) => {
    if (VectorClock.isAfter(vectorClock1, vectorClock2)) {
        return 1
    } else if (VectorClock.isConcurrent(vectorClock1, vectorClock2)) {
        return 0
    } else {
        return -1
    }
}

export default VectorClock