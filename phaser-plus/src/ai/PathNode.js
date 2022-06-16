class PathNode {

    /**
     * @readonly
     * @type {string}
     */
    id = null

    /**
     * @readonly
     * @type {number}
     */
    x = null

    /**
     * @readonly
     * @type {number}
     */
    y = null

    /**
     * @readonly
     */
    properties = {
        G: 0,
        H: 0,
        get F() {
            return this.G + this.H
        }
    }

    /**
     * @readonly
     * @type {PathNode}
     */
    parent = null

    /**
     * 
     * @param {number} x 
     * @param {number} y 
     */
    setTo(x, y) {
        this.x = x
        this.y = y
        this.id = `${x}:${y}`
    }

    /**
     * 
     * @param {PathNode} node 
     */
    equals(node) {
        return node.x === this.x && node.y === this.y
    }

}

export default PathNode