import { ObjectPool } from '@toolcase/base'
import logging from '@toolcase/logging'
import GameObject from '../GameObject'
import Scene from '../Scene'

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

    /** @private */
    logger = logging.getLogger('game object pool')

    /**
     * @type {Scene}
     */
    scene = null

    /**
     * @private
     * @type {Map<string,ObjectPool<T>>}
     */
    pools = new Map()

    /**
     * 
     * @param {Scene} scene 
     */
    constructor(scene) {
        this.scene = scene
    }

    get instances() {
        let instances = 0
        this.pools.forEach(pool => {
            instances += pool.instances
        })
        return instances
    }

    get keys() {
        return this.pools.keys()
    }

    /**
     * 
     * @param {string} key 
     * @param {typeof ObjectClass} gameObjectClass 
     * @param {InstanceFn} instanceFn
     */
    register(key, gameObjectClass, instanceFn = null) {
        if (this.pools.has(key)) {
            this.logger.error(`game object ${key} is already registered`)
            return this
        }
        if (instanceFn === null) {
            instanceFn = this.createInstance
        }
        let pool = new ObjectPool(gameObjectClass, null, gameObjectClass => instanceFn(key, gameObjectClass, this.scene))
        this.pools.set(key, pool)
        return this
    }

    /**
     * 
     * @param {string} key 
     * @returns {T}
     */
    obtain(key) {
        let pool = this.pools.get(key) || null
        if (pool === null) {
            this.logger.error(`game object ${key} is not registered`)
            return null
        }
        let object = pool.obtain()
        if (object.key === null) {
            object.key = key
            object.poolable = true
            this.scene.add.existing(object)
            object.onCreate()
        }
        return object 
    }

    /**
     * 
     * @param {T} gameObject 
     */
    release(gameObject) {
        if (gameObject.release !== null) {
            gameObject.release()
        } else {
            this.logger.warning('object is not created by the pool', gameObject)
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
     * @private
     * @type {InstanceFn}
     */
    createInstance(_, GameObjectClass, scene) {
        let object = new GameObjectClass(scene)
        return object
    }

}

export default GameObjectPool