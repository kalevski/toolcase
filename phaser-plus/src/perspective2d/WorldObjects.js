import { ObjectPool } from '@toolcase/base'
import { Logger } from '@toolcase/logging'
import { GameObjects, Time } from 'phaser'
import Scene from '../Scene'
import GameObject2D from './GameObject2D'
import Matrix2 from '../structs/Matrix2'

class WorldObjects extends GameObjects.Container {

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
     * @type {Map<string,ObjectPool<GameObject2D>>}
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
     * @param {typeof GameObject2D} gameObjectClass 
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
     * @returns {GameObject2D}
     */
    add(key, x, y) {
        let pool = this.pool.get(key) || null
        if (pool === null) {
            this.logger.error(`game object ${key} does not exist!`)
            return null
        }
        let object = pool.obtain()
        object.key = key
        super.add(object)
        object.emit(GameObject2D.Events.ADD_TO_WORLD)
        object.setTransform(x, y)
        return object
    }

    /**
     * 
     * @param {GameObject2D} gameObject 
     */
    remove(gameObject) {
        super.remove(gameObject)
        this.scene.children.remove(gameObject)
        gameObject.emit(GameObject2D.Events.REMOVE_FROM_WORLD)
        gameObject.release()
    }

    
    /**
     * @private
     * @param {number} time 
     * @param {number} delta 
     */
    doUpdate(time, delta) {
        for (let gameObject of this.list) {
            this.projection.inverse.translate(gameObject.x, gameObject.y, gameObject.transform)
            gameObject.onUpdate(time, delta)
        }
    }

    /** @private */
    onDestroy() {
        // TODO: need implementation
    }

    /** @private */
    doUpdateOrder() {
        this.list.sort(this.sortWoldObjects)
    }

    /**
     * @private
     * @param {GameObject2D} objectA 
     * @param {GameObject2D} objectB 
     */
    sortWoldObjects(objectA, objectB) {
        let order = (objectA.transform.y + objectA.offset.y) - (objectB.transform.y + objectB.offset.y)
        if (order !== 0) {
            return order
        }
        return (objectA.transform.x + objectA.offset.x) - (objectB.transform.x + objectB.offset.x)
    }

    /**
     * @private
     * @param {typeof GameObject2D} gameObjectClass 
     * @returns {GameObject2D}
     */
    createInstance = (gameObjectClass) => {
        let object = new gameObjectClass(this.scene, this.projection)
        object.onCreate()
        return object
    }

}

export default WorldObjects