import { Broadcast } from '@toolcase/base'
import Feature from '../Feature'
import Scene from '../Scene'

/**
 * @typedef Events
 * @type {('register'|'destroy')}
 */

/**
 * @callback EventListener
 * @param {Feature} feature
 */

/**
 * @extends Broadcast<Events,EventListener,any>
 */
class FeatureRegistry extends Broadcast {

    /**
     * @private
     * @type {Scene}
     */
    scene = null

    /**
     * @private
     * @type {Map<string,Feature>}
     */
    features = new Map()

    constructor(scene) {
        super()
        this.scene = scene
    }

    get keys() {
        return this.features.keys()
    }

    /**
     * 
     * @param {EachMapCallback<Feature>} callbackFn 
     */
    forEach(callbackFn) {
        this.features.forEach((entry, key) => callbackFn(key, entry))
    }

    /**
     * @param {string} key 
     * @param {typeof Feature} featureClass 
     * @param {Object<string,any>} options 
     * @returns {Feature}
     */
    register(key, featureClass, options = {}) {
        if (this.features.has(key)) {
            throw new Error(`key ${key} is already in use by other feature`)
        }
        if (typeof options !== 'object') {
            options = {}
        }
        let feature = new featureClass(this.scene, options, key)
        this.features.set(key, feature)
        this.emit('register', feature)
        return feature
    }

    /**
     * 
     * @param {string} key 
     */
    get(key) {
        return this.features.get(key) || null
    }

    /**
     * 
     * @param {string} key 
     */
    destroy(key) {
        let feature = this.get(key)
        if (feature === null) {
            return
        }
        feature.onDestroy()
        this.emit('destroy', feature)
        feature.destroy(true)
        this.features.delete(key)
    }

    destroyAll() {
        this.forEach(key => this.destroy(key))
    }

}

export default FeatureRegistry