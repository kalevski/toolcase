import logging, { Logger } from '@toolcase/logging'
import ModuleRegistry from './ModuleRegistry'
import ServiceRegistry from './ServiceRegistry'

/**
 * @callback TriggerFn
 * @param {Object<string,any>} payload
 */

class GameState {

    /** @private */
    keyExp = new RegExp(/^[a-zA-Z]+$/)

    /**
     * @protected
     * @type {Object<string,any>}
     */
    state = {}

    /**
     * @protected
     * @type {ModuleRegistry}
     */
    modules = null

    /**
     * @protected
     * @type {ServiceRegistry}
     */
    services = null

    /**
     * @protected
     * @type {Logger}
     */
    logger = null

    /**
     * @private
     * @type {Map<string,TriggerFn>}
     */
    triggers = null

    /**
     * 
     * @param {ModuleRegistry} modules 
     * @param {ServiceRegistry} services 
     */
    constructor(modules, services, id) {
        this.modules = modules
        this.services = services
        this.logger = logging.getLogger(`state=${id}`)
        this.triggers = new Map()
    }

    /** @protected */
    onCreate() {}

    /**
     * @protected
     * @param {string} key 
     * @param {TriggerFn} triggerCallback 
     */
    register(id, triggerCallback) {
        if (!this.keyExp.test(id)) {
            throw new Error(`id=(${id}) is not valid trigger id`)
        }
        if (this.triggers.has(id)) {
            throw new Error(`trigger id=(${id}) is already registered`)
        }
        if (typeof triggerCallback !== 'function') {
            this.logger.error(`trigger id=(${id}) callback is not a function`)
            return this
        }
        this.triggers.set(id, triggerCallback.bind(this))
        return this
    }

}

export default GameState