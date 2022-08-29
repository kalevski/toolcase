import { GameObjects, Math } from 'phaser'
import GameObject from '../GameObject'
import Scene from '../Scene'
import Matrix2 from '../structs/Matrix2'

class GameObject2D extends GameObject {

    transform = new Math.Vector2(0, 0)

    offset = new Math.Vector2(0, 0)

    /**
     * @private
     * @type {Matrix2}
     */
    projection = null

    /**
     * 
     * @param {Scene} scene 
     * @param {Matrix2} projection 
     */
    constructor(scene, projection) {
        super(scene)
        this.projection = projection
    }

    getProjection() {
        return this.projection
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

    doUpdate(time, delta) {
        super.doUpdate(time, delta)
        this.projection.inverse.translate(this.x, this.y, this.transform)
    }
}

export default GameObject2D