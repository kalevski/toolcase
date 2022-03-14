import { Broadcast } from '@toolcase/base'
import Module from './Module'
import Scene from './Scene'

/**
 * @typedef Events
 * @type {('register'|'destroy')}
 */

/**
 * @callback EventListener
 * @param {Module} module
 */

/**
 * @extends Broadcast<Events,EventListener,any>
 */
class ModuleRegistry extends Broadcast {

    /**
     * @private
     * @type {Map<string, Module>}
     */
    modules = new Map()

    /**
     * @private
     * @type {Scene}
     */
    scene = null

    /**
     * 
     * @param {Scene} scene 
     */
    constructor(scene) {
        super()
        this.scene = scene
    }

    get keys() {
        let list = []
        for (let key of this.modules.keys()) {
            list.push(key)
        }
        return list
    }

    /**
     * 
     * @param {EachMapCallback<Module>} callbackFn 
     */
    forEach(callbackFn) {
        this.modules.forEach((entry, key) => callbackFn(key, entry))
    }

    /**
     * 
     * @param {string} key 
     * @param {typeof Module} moduleClass 
     * @param {Object<string,any>} options 
     */
    register(key, moduleClass, options = {}) {
        if (this.modules.has(key)) {
            throw new Error(`key ${key} is already in use by other module`)
        }
        let module = new moduleClass(this.scene, key, options)
        this.modules.set(key, module)
        this.emit('register', module)
        return module
    }

    /**
     * 
     * @param {string} key
     */
    get(key) {
        return this.modules.get(key) || null
    }

    /**
     * 
     * @param {string} key 
     */
    destroy(key) {
        let module = this.get(key)
        if (module !== null) {
            module.destroy(true)
        }
        this.modules.delete(key)
        this.emit('destroy', module)
        module.onDestroy()
    }

    destroyAll() {
        for (let key of this.keys) {
            this.destroy(key)
        }
    }
    
}

export default ModuleRegistry