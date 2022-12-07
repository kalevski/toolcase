import { ObjectPool } from '@toolcase/base'
import { Logger } from '@toolcase/logging'
import Scene from './Scene'

/**
 * @template T
 */
class GameObjectPool {

    /**
     * @callback InstanceFn
     * @param {string} key
     * @param {typeof GameObject} GameObjectClass
     * @param {Scene} scene
     * @returns {T}
     */

    /**
     * @callback ResetFn
     * @param {T} gameObject
     * @returns {void}
     */

    /**
     * @private
     * @type {Scene}
     */
    scene = null

    /**
     * @private
     * @type {Logger}
     */
    logger = null

    /**
     * @private
     * @type {Map<string,ObjectPool<T>>}
     */
    map = new Map()

    /**
     * @param {Scene} scene
     */
    constructor(scene) {
        this.scene = scene
        this.logger = scene.engine.getLogger('pool')
    }

    get keys() {
        let list = []
        this.map.forEach((_, key) => list.push(key))
        return list
    }

    /**
     * 
     * @param {string} key 
     * @param {typeof Object<T>} gameObjectClass 
     * @param {InstanceFn} [instanceFn] 
     */
    register(key, gameObjectClass, instanceFn = null, resetFn = null) {
        if (this.map.has(key)) {
            this.logger.error(`game object ${key} is already registered`)
            return this
        }

        if (instanceFn === null) {
            instanceFn = this.createInstance
        }
        
        let pool = new ObjectPool(gameObjectClass, resetFn, gameObjectClass => instanceFn(key, gameObjectClass, this.scene))
        this.map.set(key, pool)
        return this
    }

    /**
     * @template {T} O
     * @param {string} key 
     * @returns {O}
     */
    obtain(key) {
        let pool = this.map.get(key) || null
        if (pool === null) {
            this.logger.error(`game object ${key} is not registered`)
            return null
        }
        let object = pool.obtain()
        this.onObjectCreate(object)
        return object
    }

    /**
     * 
     * @param {T} object 
     */
    release(object) {
        if (typeof object.release === 'function') {
            object.release()
            this.scene.children.remove(object)
        } else {
            this.logger.warning('can not be released, the object is not created by the pool', gameObject)
        }
        return this
    }

    dispose() {
        this.pools.forEach(pool => {
            pool.dispose()
        })
        this.pools.clear()
    }

    /**
     * 
     * @param {string} key 
     * @param {new T} GameObjectClass 
     * @param {Scene} scene 
     * @returns {T}
     */
    createInstance(key, GameObjectClass, scene) {
        let object = new GameObjectClass(scene)
        return object
    }

    /**
     * @private
     * @param {T} object 
     */
    onObjectCreate(object) {
        if (typeof object.poolable === 'boolean') {
            return
        }
        object.poolable = true
        if (typeof object.onCreate === 'function') {
            object.onCreate()
        }
        this.scene.add.existing(object)
    }

    // resolve objects by class provided

}

export default GameObjectPool