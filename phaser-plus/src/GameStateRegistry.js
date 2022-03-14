import { Broadcast } from '@toolcase/base'
import logging from '@toolcase/logging'
import GameState from './GameState'
import ModuleRegistry from './ModuleRegistry'
import ServiceRegistry from './ServiceRegistry'

/**
 * @typedef Events
 * @type {('invoke')}
 */

/**
 * @callback EventListener
 * @param {Object<string,any>} payload
 */


/**
 * @extends {Broadcast<Events,EventListener,any>}
 */
class GameStateRegistry extends Broadcast {

    /** @private */
    triggerExp = new RegExp(/^[a-zA-Z]+(\.{1}[a-zA-Z]+)?$/)

    /** @private */
    idExp = new RegExp(/^[a-zA-Z]+$/)

    /**
     * @private
     * @type {Map<string,GameState>}
     */
    states = new Map()

    /**
     * @private
     * @type {ModuleRegistry}
     */
    modules = null

    /**
     * @private
     * @type {ServiceRegistry}
     */
    services = null

    logger = logging.getLogger('game state')

    /**
     * 
     * @param {ModuleRegistry} modules 
     * @param {ServiceRegistry} services 
     */
    constructor(modules, services) {
        super()
        this.modules = modules
        this.services = services
    }

    /**
     * 
     * @param {string} id 
     * @param {typeof GameState} gameStateClass 
     */
    use(id, gameStateClass) {
        let isValid = this.idExp.test(id)
        if (!isValid) {
            throw new Error(`id=(${id}) is not valid state id`)
        }
        if (this.states.has(id)) {
            throw new Error(`state id=(${id}) already exist`)
        }
        let state = new gameStateClass(this.modules, this.services, id)
        state.onCreate()
        this.states.set(id, state)
    }

    /**
     * 
     * @param {string} trigger 
     * @param {Object<string,any>} payload 
     */
    invoke(trigger, payload = {}) {
        let isValid = this.triggerExp.test(trigger)
        if (!isValid && typeof trigger !== 'string') {
            throw new Error(`trigger=(${trigger}) is not valid`)
        }
        let [ id, triggerId ] = trigger.split('.')
        let state = this.states.get(id) || null
        if (state === null) {
            throw new Error(`state id=(${id}) does not exist`)
        }
        let triggerFn = state.triggers.get(triggerId) || null
        if (triggerFn === null) {
            this.logger.warning(`state=(${id}) trigger=(${triggerId}) is not registered`)
            return null
        }
        return triggerFn(payload)
    }

    /**
     * @param {string} id
     */
    get(id) {
        let stateObj = this.states.get(id) || null
        return stateObj !== null ? stateObj.state : null
    }
}

export default GameStateRegistry