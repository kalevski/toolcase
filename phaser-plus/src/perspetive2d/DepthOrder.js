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
        console.log({
            v00: projection.v00,
            v01: projection.v01,
            v10: projection.v10,
            v11: projection.v11
        })
    }

    /** @type {SortFn} */
    fn = (objectA, objectB) => {}

}

export default DepthOrder