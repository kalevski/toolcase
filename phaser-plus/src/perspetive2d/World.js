import Scene from '../base/Scene'
import Layer from '../base/Layer'
import Matrix2 from '../structs/Matrix2'
import GameObject2D from './GameObject2D'
import DepthOrder from './DepthOrder'
import { Time } from 'phaser'
import PerspectiveGrid from './PerspectiveGrid'

class World extends Layer {

    /**
     * @private
     * @type {PerspectiveGrid}
     */
    grid = null

    gridUpdate = null

    /**
     * @private
     * @type {Matrix2}
     */
    _projection = Matrix2.create(50, 50)

    depth = new DepthOrder()

    /**
     * @private
     * @type {Time.TimerEvent}
     */
    orderLoop = null

    /** @protected */
    onCreate() {
        this.grid = new PerspectiveGrid(this.scene, 0, 0)
        this.scene.add.existing(this.grid)
        this.grid.onCreate()
        this.grid.setScrollFactor(0)
        this.grid.setVisible(false)

        super.onCreate()
        this.orderLoop = this.scene.time.addEvent({
            delay: 100,
            callback: () => this.container.list.sort(this.depth.fn),
            loop: true
        })
        this.onLayerUpdate()
    }

    /**
     * @protected
     * @param {number} time 
     * @param {number} delta 
     */
    onLayerUpdate(time, delta) {
        super.onLayerUpdate(time, delta)
        this.grid.cameraFilter = this.container.cameraFilter
        this.grid.move(this.camera)

        if (this.gridUpdate !== null) {
            this.grid.setVisible(this.gridUpdate)
            if (this.gridUpdate) {
                this.grid.setProjection(this._projection)
            }
            this.gridUpdate = null
        }

        if (typeof this.scene.matter !== 'undefined') {
            if (typeof this.scene.matter.world.debugGraphic !== 'undefined') {
                this.scene.matter.world.debugGraphic.cameraFilter = this.container.cameraFilter
            }
        }
    }

    /** @protected */
    onDestroy() {
        super.onDestroy()
        this.orderLoop.remove()
        this.orderLoop.destroy()
    }

    /**
     * 
     * @param {boolean} flag 
     */
    drawGrid(flag = true) {
        if (typeof flag !== 'boolean') {
            return this
        }
        this.gridUpdate = null
        if (this.grid.visible === flag) {
            return this
        }

        this.gridUpdate = flag
    }

    /**
     * 
     * @param {Matrix2} matrix 
     */
    set projection(matrix) {
        this._projection.set(matrix.v00, matrix.v01, matrix.v10, matrix.v11)
        this.depth.setup(this.projection)
        if (this.grid.visible) {
            this.gridUpdate = true
        }
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
        return object
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