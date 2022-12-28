import Scene from '../base/Scene'
import Event from './Event'

/**
 * @typedef EventNames
 * @type {'done'|'progress'}
 */

/**
 * @callback ListenerFn
 * @param {Job} job
 * @returns {void}
 */

class Job extends Event {

    /**
     * @protected
     * @type {any}
     */
    payload = null

    /**
     * 
     * @param {Scene} scene 
     * @param {any} payload 
     */
    constructor(scene, payload) {
        super(scene)
        this.payload = payload
    }

    get type() {
        return 'job'
    }

    /**
     * @protected
     * @param {number} time 
     * @returns {boolean} 
     */
    onUpdate(time) {}

    /**
     * @protected
     */
    onComplete() {}

    /**
     * @protected
     */
    onTerminate() {}

    /** @private */
    onFire() {}

    /** @private */
    onDestroy() {}
    
}

export default Job