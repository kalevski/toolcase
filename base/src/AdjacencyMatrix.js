/**
* @typedef Matrix
* @type {Array<Array<boolean>>}
*/

class AdjacencyMatrix {

    /**
     * @private
     * @type {Map<string,Matrix>}
     */
    links = new Map()

    /**
     * @readonly
     * @type {Array<string>}
     */
    edges = []

    get labels() {
        let list = []
        for (let label of this.links.keys()) {
            list.push(label)
        }
        return list
    }

    /**
     * 
     * @param {string} key 
     * @returns {this}
     */
    addEdge(key) {
        let exist = this.edges.findIndex((value => value === key)) > -1
        if (exist) {
            throw new Error(`edge ${key} already exist`)
        }
        let index = this.edges.length
        this.edges.push(key)
        for (let link of this.links.keys()) {
            let matrix = this.links.get(link)
            for (let row of matrix) {
                row.push(false)
            }
            let edgeRow = Array.from({ length: index + 1 }, () => false)
            matrix.push(edgeRow)
        }
        return this
    }

    /**
     * 
     * @param {string} key 
     * @returns {this}
     */
    removeEdge(key) {
        let edgeIndex = this.edges.findIndex((value => value === key))
        if (edgeIndex === -1) {
            throw new Error(`edge ${key} does not exist`)
        }
        this.edges.splice(edgeIndex, 1)
        for (let link of this.links.keys()) {
            let matrix = this.links.get(link)
            matrix.splice(edgeIndex, 1)
            for (let row of matrix) {
                row.splice(edgeIndex, 1)
            }
        }
        return this
    }

    /**
     * 
     * @param {string} label 
     * @returns {this}
     */
    addLink(label) {
        if (this.links.has(label)) {
            throw new Error(`link ${label} already exist`)
        }
        let row = Array.from({ length: this.edges.length }, () => false)
        let matrix = Array.from({ length: this.edges.length }, () => Array.from(row))
        this.links.set(label, matrix)
        return this
    }

    /**
     * 
     * @param {string} label 
     * @returns {this}
     */
    removeLink(label) {
        if (!this.links.has(label)) {
            throw new Error(`link ${label} does not exist`)
        }
        this.links.delete(label)
        return this
    }

    /**
     * 
     * @param {string} label 
     * @param {string} edgeA 
     * @param {string} edgeB 
     * @returns {this}
     */
    link(label, edgeA, edgeB) {
        if (!this.links.has(label)) {
            throw new Error(`link ${label} does not exist`)
        }
        let indexA = this.edges.findIndex(value => value === edgeA)
        if (indexA === -1) {
            throw new Error(`edge ${edgeA} does not exist`)
        }
        let indexB = this.edges.findIndex(value => value === edgeB)
        if (indexB === -1) {
            throw new Error(`edge ${edgeB} does not exist`)
        }

        let matrix = this.links.get(label)
        matrix[indexA][indexB] = true
        return this
    }

    /**
     * 
     * @param {string} label 
     * @param {string} edgeA 
     * @param {string} edgeB 
     * @returns {this}
     */
    unlink(label, edgeA, edgeB) {
        if (!this.links.has(label)) {
            throw new Error(`link ${label} does not exist`)
        }
        let indexA = this.edges.findIndex(value => value === edgeA)
        if (indexA === -1) {
            throw new Error(`edge ${edgeA} does not exist`)
        }
        let indexB = this.edges.findIndex(value => value === edgeB)
        if (indexB === -1) {
            throw new Error(`edge ${edgeB} does not exist`)
        }
        let matrix = this.links.get(label)
        matrix[indexA][indexB] = false
        return this
    }

    /**
     * 
     * @param {string} label 
     * @param {string} edgeA 
     * @param {string} edgeB 
     * @returns {boolean}
     */
    hasLink(label, edgeA, edgeB) {
        if (!this.links.has(label)) {
            throw new Error(`link ${label} does not exist`)
        }
        let indexA = this.edges.findIndex(value => value === edgeA)
        if (indexA === -1) {
            throw new Error(`edge ${edgeA} does not exist`)
        }
        let indexB = this.edges.findIndex(value => value === edgeB)
        if (indexB === -1) {
            throw new Error(`edge ${edgeB} does not exist`)
        }
        let matrix = this.links.get(label)
        return matrix[indexA][indexB]
    }

    /**
     * 
     * @param {string} label 
     * @param {string} edge 
     * @returns {Array<string>}
     */
    getLinks(label, edge) {
        if (!this.links.has(label)) {
            throw new Error(`link ${label} does not exist`)
        }
        let index = this.edges.findIndex(value => value === edge)
        if (index === -1) {
            throw new Error(`edge ${edge} does not exist`)
        }
        let matrix = this.links.get(label)
        let links = []
        matrix[index].forEach((linked, index) => {
            if (linked) {
                links.push(this.edges[index])
            }
        })
        return links
    }

    /**
     * 
     * @param {string} edge 
     */
    getAllLinks(edge) {
        let links = []
        for (let label of this.labels) {
            links.push(...this.getLinks(label, edge))
        }
        return links
    }

    /**
     * 
     * @returns {this}
     */
    print() {
        console.log('Edges:', this.edges)
        for (let link of this.links.keys()) {
            let matrix = this.links.get(link)
            console.log('Label:', link)
            console.table(matrix)
        }
        return this
    }

    toJSON() {
        let output = {
            edges: this.edges,
            links: []
        }
        for(let label of this.links.keys()) {
            let linkOutput = {
                label: label,
                relations: []
            }
            let matrix = this.links.get(label) || null
            matrix.forEach((row, x) => {
                row.forEach((cell, y) => {
                    if (cell === true) {
                        linkOutput.relations.push([x, y])
                    }
                })
            })
            output.links.push(linkOutput)
        }
        return output
    }

}

AdjacencyMatrix.fromJSON = (jsonObject = {}) => {
    const { edges = [], links = [] } = jsonObject
    let matrix = new AdjacencyMatrix()
    edges.forEach(edge => matrix.addEdge(edge))
    for (let link of links) {
        const { label, relations = [] } = link
        matrix.addLink(label)
        relations.forEach(relation => {
            const [ indexA, indexB ] = relation
            matrix.link(label, edges[indexA], edges[indexB])
        })
    }
    return matrix
}

export default AdjacencyMatrix