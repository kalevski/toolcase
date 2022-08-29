import { Logger } from '@toolcase/logging'
import { Time } from 'phaser'
import Scene from '../Scene'
import GameObject2D from './GameObject2D'
import Matrix2 from '../structs/Matrix2'
import GameObjectPool from '../structs/GameObjectPool'
import GameObject from '../GameObject'

class WorldObjects extends GameObject {

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
     * @type {Time.TimerEvent}
     */
    orderLoop = null

    /** @type {GameObjectPool<GameObject2D>} */
    pool = null

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
        this.pool = scene.pool
        this.orderLoop = this.scene.time.addEvent({
            delay: 100,
            callback: this.doUpdateOrder,
            callbackScope: this,
            loop: true
        })
    }

    register(key, gameObject2DClass) {
        this.pool.register(key, gameObject2DClass, this.createInstance)
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
        let object = this.pool.obtain(key)
        super.add(object)
        object.setTransform(x, y)
        return object
    }

    /**
     * 
     * @param {GameObject2D} gameObject 
     */
    remove(gameObject) {
        super.remove(gameObject)
        this.pool.release(gameObject)
        return this
    }

    /**
     * @private
     * @param {number} time 
     * @param {number} delta 
     */
    doUpdate(time, delta) {
        for (let gameObject of this.list) {
            if (gameObject instanceof GameObject) {
                gameObject.doUpdate(time, delta)
            }
        }
    }

    /** @private */
    doUpdateOrder() {
        this.list.sort(this.sortWoldObjects)
    }

    /**
     * TODO: make sort to work for all childs
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
    createInstance = (_, gameObjectClass, scene) => {
        let object = new gameObjectClass(scene, this.projection)
        return object
    }

}

export default WorldObjects