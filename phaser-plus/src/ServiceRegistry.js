import { Game } from 'phaser'
import Service from './Service'

class ServiceRegistry {

    /**
     * @private
     * @type {Game}
     */
    game = null

    /**
     * @private
     * @type {Map<string,Service>}
     */
    services = new Map()

    /**
     * 
     * @param {Game} game 
     */
    constructor(game) {
        this.game = game
    }

    /**
     * 
     * @param {typeof Service} serviceClass 
     */
    resolve(serviceClass) {
        let key = this.getUniqueKey(serviceClass)
        if (this.services.has(key)) {
            return this.services.get(key)   
        }
        let service = new serviceClass(this.game, key)
        this.services.set(key, service)
        return service
    }

    dispose(serviceClass) {
        let key = this.getUniqueKey(serviceClass)
        let service = this.services.get(key) || null
        if (service === null) {
            return
        }
        service.onDispose()
        this.services.delete(key)
    }

    disposeAll() {
        this.services.forEach(service => service.onDispose())
        this.services.clear()
    }

    /**
     * 
     * @param {typeof Service} serviceClass 
     */
    getUniqueKey(serviceClass) {
        let key = null
        try {
            key = serviceClass.prototype.constructor.name || null
        } catch (error) {
            throw new Error(`provided serviceClass does not extend Service`)
        }
        return key
    }

}

export default ServiceRegistry