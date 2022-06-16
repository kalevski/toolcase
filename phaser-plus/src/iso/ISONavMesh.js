import NavMesh from '../ai/NavMesh'
import ISOWorldObjects from './ISOWorldObjects'

class ISONavMesh extends NavMesh {

    /**
     * @private
     * @type {ISOWorldObjects}
     */
    objects = null

    /**
     * 
     * @param {ISOWorldObjects} objects 
     */
    constructor(objects) {
        this.objects = objects
    }

    isBlocked(x, y) {
        for (let gameObject of this.objects.list) {
            if (gameObject.contains(x, y)) {
                return true
            }
        }
    }

}

export default ISONavMesh