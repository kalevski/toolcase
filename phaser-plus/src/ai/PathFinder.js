import NavMesh from '@toolcase/phaser-plus/lib/ai/NavMesh'
import { Math } from 'phaser'
import FlowProcessor from '../flow/FlowProcessor'

class PathFinder extends FlowProcessor {

    /** @protected */
    onCreate() {}

    /** @protected */
    onUpdate() {}

    /** @protected */
    onDestroy() {}

    /**
     * 
     * @param {Math.Vector2} begin 
     * @param {Math.Vector2} goal 
     * @param {NavMesh} navMesh 
     */
    findPath(begin, goal, navMesh) {
        throw new Error('not implemented')
        // return path instance
    }

}

class NavMesh {

    /**
     * 
     * @param {number} x 
     * @param {number} y
     * @returns {boolean} 
     */
    isBlocked(x, y) {}

}

PathFinder.NavMesh = NavMesh

export default PathFinder