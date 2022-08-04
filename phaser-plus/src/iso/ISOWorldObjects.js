import { ObjectPool } from '@toolcase/base'
import { Logger } from '@toolcase/logging'
import { GameObjects, Time } from 'phaser'
import Scene from '../Scene'
import ISOGameObject from './ISOGameObject'
import Matrix2 from '../structs/Matrix2'

/** @extends {any} */
class ISOWorldObjects extends GameObjects.Container {

    /**
     * @private
     * @type {Matrix2}
     */
    projection = null

    /**
     * @private
     * @type {Logger}
     */
    logger = null

    /**
     * @private
     * @type {Map<string,ObjectPool<ISOGameObject>>}
     */
    pool = new Map()

    /**
     * @private
     * @type {Time.TimerEvent}
     */
    orderLoop = null

    /**
     * 
     * @param {Scene} scene 
     * @param {Matrix2} projection 
     * @param {Logger} logger
     */
    constructor(scene, projection, logger) {
        super(scene)
        this.projection = projection
        this.logger = logger
        this.orderLoop = this.scene.time.addEvent({
            delay: 100,
            callback: this.doUpdateOrder,
            callbackScope: this,
            loop: true
        })
    }

    /**
     * 
     * @param {string} key 
     * @param {typeof ISOGameObject} gameObjectClass 
     */
    register(key, gameObjectClass, resetFn) {
        if (this.pool.has(key)) {
            this.logger.error(`iso game object ${key} is already registered!`)
            return this
        }
        this.pool.set(key, new ObjectPool(gameObjectClass, resetFn, this.createInstance))
        return this
    }

    /**
     * 
     * @param {string} key 
     * @param {number} x 
     * @param {number} y 
     * @returns {ISOGameObject}
     */
    add(key, x, y) {
        let pool = this.pool.get(key) || null
        if (pool === null) {
            this.logger.error(`iso game object ${key} does not exist!`)
            return null
        }
        let object = pool.obtain()
        object.key = key
        super.add(object)
        object.emit(ISOGameObject.Events.ADD_TO_ISO_WORLD)
        object.setISO(x, y)
        return object
    }

    /**
     * 
     * @param {ISOGameObject} gameObject 
     */
    remove(gameObject) {
        super.remove(gameObject)
        this.scene.children.remove(gameObject)
        gameObject.emit(ISOGameObject.Events.REMOVE_FROM_ISO_WORLD)
        gameObject.release()
    }

    
    /**
     * @private
     * @param {number} time 
     * @param {number} delta 
     */
    doUpdate(time, delta) {
        for (let gameObject of this.list) {
            this.projection.inverse.translate(gameObject.x, gameObject.y, gameObject.iso)
            gameObject.onUpdate(time, delta)
        }
    }

    /** @private */
    onDestroy() {
        // TODO: need implementation
    }

    /** @private */
    doUpdateOrder() {
        this.list.sort((a, b) => {
            let order = (a.iso.y + a.offset.y) - (b.iso.y + b.offset.y)
            if (order !== 0) {
                return order
            }
            return (a.iso.x + a.offset.x) - (b.iso.x + b.offset.x)
        })
    }

    /**
     * @private
     * @param {typeof ISOGameObject} gameObjectClass 
     */
    createInstance = (gameObjectClass) => {
        let object = new gameObjectClass(this.scene, this.projection)
        object.onCreate()
        return object
    }

}

export default ISOWorldObjects