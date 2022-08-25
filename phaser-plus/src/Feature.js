import { EventEmitter } from '@toolcase/base'
import logging, { Logger } from '@toolcase/logging'
import GameObject from './GameObject'
import Scene from './Scene'

/**
 * @callback ListenerFn
 * @param {Object<string,any>} payload
 */

class Feature extends GameObject {

    /** 
     * @readonly
     * @type {string}
     */
    key = null

    /**
     * @protected
     * @type {Object<string,any>}
     */
    options = null

    /**
     * @private
     */
    bindings = new EventEmitter()

    /**
     * @protected
     * @type {Logger}
     */
    logger = null

    /**
     * 
     * @param {Scene} scene 
     * @param {Object<string,any>} options 
     */
    constructor(scene, options = {}, key = null) {
        super(scene)
        this.options = options
        this.key = key
        this.logger = logging.getLogger(`feature=${key}`)
    }

    /** @protected */
    onCreate() {}

    /**
     * @protected
     * @param {number} time 
     * @param {number} delta 
     */
    onUpdate() {}

    /** @protected */
    onDestroy() {}

    /**
     * 
     * @param {string} eventName 
     * @param {ListenerFn} listener 
     * @param {any} context 
     */
    bind(eventName, listener, context) {
        this.bindings.addListener(eventName, listener, context)
        return this
    }

    /**
     * 
     * @param {string} eventName 
     * @param {ListenerFn} listener 
     * @param {any} context 
     */
    unbind(eventName, listener, context) {
        this.bindings.removeListener(eventName, listener, context)
        return this
    }

    /**
     * @protected
     * @param {string} eventName 
     * @param  {Object<string,any>} payload 
     */
    dispatch(eventName, payload) {
        if (this.bindings.listenerCount(eventName) === 0) {
            this.logger.warning(`event=(${eventName}) is not handled, payload=(${JSON.stringify(payload)})`)
        } else {
            this.bindings.emit(eventName, payload)
        }
    }
}

export default Feature