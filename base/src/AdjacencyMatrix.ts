class AdjacencyMatrix<P = boolean, N = boolean> {

    private DEFAULT = {
        POSITIVE: null as unknown as P,
        NEGATIVE: null as unknown as N
    }

    readonly vertices: string[] = []

    private vertexIndices: Map<string, number> = new Map()

    private matrix: (P | N)[][] = []

    constructor(defaultPositive: P = true as unknown as P, defaultNegative: N = false as unknown as N) {
        this.DEFAULT.POSITIVE = defaultPositive
        this.DEFAULT.NEGATIVE = defaultNegative
    }

    addVertex(vertex: string): boolean {
        if (this.vertexIndices.has(vertex)) {
            return false
        }
        const index = this.vertices.length
        this.vertices.push(vertex)

        for (const row of this.matrix) {
            row.push(this.DEFAULT.NEGATIVE)
        }
        const vertexRow = Array.from({ length: index + 1 }, () => this.DEFAULT.NEGATIVE)
        this.matrix.push(vertexRow)
        this.cacheVertices()
        return true
    }

    removeVertex(vertex: string): boolean {
        if (!this.vertexIndices.has(vertex)) {
            return false
        }
        const index = this.vertexIndices.get(vertex)!
        this.vertices.splice(index, 1)
        this.matrix.splice(index, 1)
        for (const row of this.matrix) {
            row.splice(index, 1)
        }
        this.cacheVertices()
        return true
    }

    addEdge(vertexA: string, vertexB: string, value: P | any = this.DEFAULT.POSITIVE): boolean {
        if (!this.vertexIndices.has(vertexA) || !this.vertexIndices.has(vertexB)) {
            return false
        }
        const indexA = this.vertexIndices.get(vertexA)!
        const indexB = this.vertexIndices.get(vertexB)!
        this.matrix[indexA][indexB] = value
        return true
    }

    removeEdge(vertexA: string, vertexB: string): boolean {
        if (!this.vertexIndices.has(vertexA) || !this.vertexIndices.has(vertexB)) {
            return false
        }
        const indexA = this.vertexIndices.get(vertexA)!
        const indexB = this.vertexIndices.get(vertexB)!
        this.matrix[indexA][indexB] = this.DEFAULT.NEGATIVE
        return true
    }

    getEdge(vertexA: string, vertexB: string): P | N {
        if (!this.vertexIndices.has(vertexA) || !this.vertexIndices.has(vertexB)) {
            return this.DEFAULT.NEGATIVE
        }
        const indexA = this.vertexIndices.get(vertexA)!
        const indexB = this.vertexIndices.get(vertexB)!
        return this.matrix[indexA][indexB]
    }

    getEdges(vertex: string): string[] {
        if (!this.vertexIndices.has(vertex)) {
            return []
        }
        const edgeList: string[] = []
        const indexA = this.vertexIndices.get(vertex)!
        const vertexEdges = this.matrix[indexA]
        for (let index = 0; index < vertexEdges.length; index++) {
            if (vertexEdges[index] === this.DEFAULT.NEGATIVE) {
                continue
            }
            edgeList.push(this.vertices[index])
        }
        return edgeList
    }

    hasEdge(vertexA: string, vertexB: string): boolean {
        if (!this.vertexIndices.has(vertexA) || !this.vertexIndices.has(vertexB)) {
            return false
        }
        const indexA = this.vertexIndices.get(vertexA)!
        const indexB = this.vertexIndices.get(vertexB)!
        return this.matrix[indexA][indexB] !== this.DEFAULT.NEGATIVE
    }

    private cacheVertices(): void {
        this.vertexIndices.clear()
        for (let index = 0; index < this.vertices.length; index++) {
            this.vertexIndices.set(this.vertices[index], index)
        }
    }
}

export default AdjacencyMatrix
