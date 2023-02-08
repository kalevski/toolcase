
/**
 * @template P
 * @template N
 */
class AdjacencyMatrix {

    /** @private */
    DEFAULT = {
        /** @type {P} */
        POSITIVE: null,
        /** @type {N} */
        NEGATIVE: null
    }

    /**
     * @readonly
     * @type {Array<string>}
     */
    vertices = []

    /**
     * @private
     * @type {Map<string,number>}
     */
    vertexIndices = new Map()

    /**
     * @private
     * @type {Array<Array<P|N>>}
     */
    matrix = []

    /**
     * 
     * @param {P} defaultPositive 
     * @param {N} defaultNegative 
     */
    constructor(defaultPositive = true, defaultNegative = false) {
        this.DEFAULT.POSITIVE = defaultPositive
        this.DEFAULT.NEGATIVE = defaultNegative
    }

    /**
     * 
     * @param {string} vertex 
     */
    addVertex(vertex) {
        if (this.vertexIndices.has(vertex)) {
            return false
        }
        let index = this.vertices.length
        this.vertices.push(vertex)

        for (let row of this.matrix) {
            row.push(this.DEFAULT.NEGATIVE)
        }
        let vertexRow = Array.from({ length: index + 1 }, () => this.DEFAULT.NEGATIVE)
        this.matrix.push(vertexRow)
        this.cacheVertices()
        return true
    }

    /**
     * 
     * @param {string} vertex 
     */
    removeVertex(vertex) {
        if (!this.vertexIndices.has(vertex)) {
            return false
        }
        let index = this.vertexIndices.get(vertex)
        this.vertices.splice(index, 1)
        this.matrix.splice(index, 1)
        for (let row of this.matrix) {
            row.splice(index, 1)
        }
        this.cacheVertices()
        return true
    }

    /**
     * 
     * @param {string} vertexA 
     * @param {string} vertexB 
     * @param {P|any} [value] 
     */
    addEdge(vertexA, vertexB, value = this.DEFAULT.POSITIVE) {
        if (!this.vertexIndices.has(vertexA) || !this.vertexIndices.has(vertexB)) {
            return false
        }
        let indexA = this.vertexIndices.get(vertexA)
        let indexB = this.vertexIndices.get(vertexB)
        this.matrix[indexA][indexB] = value
        return true
    }

    /**
     * 
     * @param {string} vertexA 
     * @param {string} vertexB 
     */
    removeEdge(vertexA, vertexB) {
        if (!this.vertexIndices.has(vertexA) || !this.vertexIndices.has(vertexB)) {
            return false
        }
        let indexA = this.vertexIndices.get(vertexA)
        let indexB = this.vertexIndices.get(vertexB)
        this.matrix[indexA][indexB] = this.DEFAULT.NEGATIVE
        return true
    }

    /**
     * 
     * @param {string} vertexA 
     * @param {string} vertexB 
     * @returns {P|N|any}
     */
    getEdge(vertexA, vertexB) {
        if (!this.vertexIndices.has(vertexA) || !this.vertexIndices.has(vertexB)) {
            return this.DEFAULT.NEGATIVE
        }
        let indexA = this.vertexIndices.get(vertexA)
        let indexB = this.vertexIndices.get(vertexB)
        return this.matrix[indexA][indexB]
    }

    /**
     * 
     * @param {string} vertex 
     * @returns {Array<string>}
     */
    getEdges(vertex) {
        if (!this.vertexIndices.has(vertex)) {
            return []
        }
        let edgeList = []
        let indexA = this.vertexIndices.get(vertex)
        let vertexEdges = this.matrix[indexA]
        for (let index = 0; index < vertexEdges.length; index++) {
            if (vertexEdges[index] === this.DEFAULT.NEGATIVE) {
                continue
            }
            edgeList.push(this.vertices[index])
        }
        return edgeList
    }

    hasEdge(vertexA, vertexB) {
        if (!this.vertexIndices.has(vertexA) || !this.vertexIndices.has(vertexB)) {
            return false
        }
        let indexA = this.vertexIndices.get(vertexA)
        let indexB = this.vertexIndices.get(vertexB)
        return this.matrix[indexA][indexB] !== this.DEFAULT.NEGATIVE
    }

    /** @private */
    cacheVertices() {
        this.vertexIndices.clear()
        for (let index = 0; index < this.vertices.length; index++) {
            this.vertexIndices.set(this.vertices[index], index)
        }
    }
}

export default AdjacencyMatrix