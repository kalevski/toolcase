import Scene from '../base/Scene'
import Layer from '../base/Layer'
import Matrix2 from '../structs/Matrix2'
import GameObject2D from './GameObject2D'
import DepthOrder from './DepthOrder'
import { Time } from 'phaser'

class World extends Layer {

    /**
     * @private
     * @type {Matrix2}
     */
    _projection = Matrix2.create(32, 32, 0, 0)

    /** @private */
    order = new DepthOrder()

    /**
     * @private
     * @type {Time.TimerEvent}
     */
    orderLoop = null

    /** @protected */
    onCreate() {
        super.onCreate()
        this.orderLoop = this.scene.time.addEvent({
            delay: 100,
            callback: () => this.container.list.sort(this.order.fn),
            loop: true
        })
    }

    /**
     * @protected
     * @param {number} time 
     * @param {number} delta 
     */
    onUpdate(time, delta) {
        super.onUpdate(time, delta)
    }

    /** @protected */
    onDestroy() {
        super.onDestroy()
    }

    /**
     * 
     * @param {Matrix2} matrix 
     */
    set projection(matrix) {
        this._projection.set(matrix.v00, matrix.v01, matrix.v10, matrix.v11)
        this.order.setup(matrix)
        return this._projection
    }

    get projection() {
        return this._projection
    }

    /**
     * @param {string} key 
     * @param {new GameObject2D} gameObjectClass 
     */
    register(key, gameObjectClass) {
        this.scene.pool.register(key, gameObjectClass, this.createInstanceFn)
        return this
    }

    /**
     * @template {GameObject2D} T
     * @param {string} key 
     * @param {number} x 
     * @param {number} y 
     * @returns {T}
     */
    add(key, x, y) {
        /** @type {GameObject2D} */
        let object = this.scene.pool.obtain(key)
        if (object === null) {
            return null
        }
        this.container.add(object)
        object.setTransform(x, y)
    }

    /**
     * @template {GameObject2D} T
     * @param {T} gameObject 
     */
    remove(gameObject) {
        this.container.remove(gameObject)
        this.scene.pool.release(gameObject)
        return this
    }

    removeAll() {
        return this.container.removeAll()
    }

    /**
     * @private
     * @param {string} _ 
     * @param {new GameObject2D} gameObjectClass 
     * @param {Scene} scene 
     */
    createInstanceFn = (_, gameObjectClass, scene) => {
        let object = new gameObjectClass(scene, this)
        return object
    }

}

export default World