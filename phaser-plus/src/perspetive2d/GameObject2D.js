import { Math } from 'phaser'
import GameObject from '../base/GameObject'
import Scene from '../base/Scene'
import World from './World'

class GameObject2D extends GameObject {

    /**
     * @private
     * @type {World}
     */
    world = null

    transform = new Math.Vector2(0, 0)

    /**
     * 
     * @param {Scene} scene 
     * @param {World} world 
     */
    constructor(scene, world) {
        super(scene, 0, 0)
        this.world = world
    }

    get projection() {
        return this.world.projection
    }

    /**
     * 
     * @param {number} x 
     * @param {number} y 
     */
    setTransform(x, y) {
        this.projection.translate(x, y, this)
        this.transform.set(x, y)
    }

    /**
     * 
     * @param {number} time 
     * @param {number} delta 
     */
    doUpdate(time, delta) {
        super.doUpdate(time, delta)
        this.projection.inverse.translate(this.x, this.y, this.transform)
    }

}

export default GameObject2D