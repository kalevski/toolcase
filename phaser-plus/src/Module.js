import { EventEmitter } from '@toolcase/base'
import logging, { Logger } from '@toolcase/logging'
import BaseGameObject from './BaseGameObject'
import Scene from './Scene'

/**
 * @callback ListenerFn
 * @param {Object<string,any>} payload
 */

class Module extends BaseGameObject {

    /**
     * @readonly
     * @type {string}
     */
    key = null

    /**
     * @readonly
     * @type {Object<string,any>}
     */
    options = null

    /**
     * @protected
     * @type {Logger}
     */
    logger = null

    /** @private */
    bindings = new EventEmitter()

    /**
     * 
     * @param {Scene} scene 
     * @param {string} key 
     * @param {Object<string,any>} options 
     */
    constructor(scene, key, options) {
        super(scene, 0, 0)
        this.key = key
        this.options = options
        this.logger = logging.getLogger(`module=${key}`)
    }

    /** @protected */
    onCreate() {}

    /**
     * @protected
     * @param {number} time 
     * @param {number} delta 
     */
    onUpdate(time, delta) {}

    /** @protected */
    onDestroy() {}

    /**
     * 
     * @param {string} event 
     * @param {ListenerFn} listener 
     * @param {any} context 
     */
    bind(event, listener, context) {
        this.bindings.addListener(event, listener, context)
        return this
    }

    /**
     * 
     * @param {string} event 
     * @param {ListenerFn} listener 
     * @param {any} context 
     */
    unbind(event, listener, context) {
        this.bindings.removeListener(event, listener, context)
        return this
    }

    /**
     * @protected
     * @param {string} event 
     * @param {Object<string,any>} payload 
     */
    dispatch(event, payload = null) {
        this.logger.verbose(`dispatch event=(${event}) payload=(${JSON.stringify(payload)})`)
        if (this.bindings.listenerCount(event) === 0) {
            this.logger.warning(`event=(${event}) is not handled, payload=(${JSON.stringify(payload)})`)
        } else {
            this.bindings.emit(event, payload)
        }
        return this
    }

}

export default Module