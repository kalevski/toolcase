import NavMesh from '../ai/NavMesh'
import WorldObjects from './WorldObjects'

class WorldNavMesh extends NavMesh {

    /**
     * @private
     * @type {WorldObjects}
     */
    objects = null

    /**
     * 
     * @param {WorldObjects} objects 
     */
    constructor(objects) {
        super()
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

export default WorldNavMesh