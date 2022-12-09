import Matrix2 from '../structs/Matrix2'
import GameObject2D from './GameObject2D'

/**
 * @callback SortFn
 * @param {GameObject2D} objectA
 * @param {GameObject2D} objectB
 * @returns {number}
 */

class DepthOrder {

    /**
     * 
     * @param {Matrix2} projection 
     */
    setup(projection) {
        this.fn = this.normalSort
    }

    disable() {
        this.fn = this.disabledSort
    }

    set(inverseX = false, inverseY = false) {
        if (!inverseX && !inverseY) {
            this.fn = this.normalSort
        } else if (inverseX && !inverseY) {
            this.fn = this.inverseXSort
        } else if (!inverseX && inverseY) {
            this.fn = this.inverseYSort
        } else if (inverseX && inverseY) {
            this.fn = this.inverseSort
        }
    }

    /**
     * @private
     * @type {SortFn}
     */
    normalSort = (objectA, objectB) => {
        let orderY = objectA.pivot.y - objectB.pivot.y
        if (orderY !== 0) {
            return orderY
        }
        return objectA.pivot.x - objectB.pivot.x
    }

    /**
     * @private
     * @type {SortFn}
     */
    inverseXSort = (objectA, objectB) => {
        let orderY = objectA.pivot.y - objectB.pivot.y
        if (orderY !== 0) {
            return orderY
        }
        return objectB.pivot.x - objectA.pivot.x
    }

    /**
     * @private
     * @type {SortFn}
     */
    inverseYSort = (objectA, objectB) => {
        let orderY = objectB.pivot.y - objectA.pivot.y
        if (orderY !== 0) {
            return orderY
        }
        return objectA.pivot.x - objectB.pivot.x
    }

    /**
     * @private
     * @type {SortFn}
     */
    inverseSort = (objectA, objectB) => {
        let orderY = objectB.pivot.y - objectA.pivot.y
        if (orderY !== 0) {
            return orderY
        }
        return objectB.pivot.x - objectA.pivot.x
    }

    /**
     * @private
     * @type {SortFn}
     */
    disabledSort = () => {}

    /** @type {SortFn} */
    fn = (objectA, objectB) => {}

}

export default DepthOrder