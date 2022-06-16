import { Logger } from '@toolcase/logging'
import Scene from '../Scene'
import GameFlow from './GameFlow'

class GameEvent {

    /**
     * @protected
     * @type {Scene}
     */
    scene = null

    /**
     * @protected
     * @type {GameFlow}
     */
    flow = null
 
    /**
     * @protected
     * @type {Logger}
     */
    logger = null

    /**
     * 
     * @param {Scene} scene
     * @param {GameFlow} flow 
     * @param {Logger} logger
     */
    constructor(scene, flow, logger) {
        this.scene = scene
        this.flow = flow
        this.logger = logger
    }

    /** @protected */
    onCreate() {}

    /** @protected */
    onFire() {}

}

export default GameEvent