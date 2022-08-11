import { Math } from 'phaser'
import GameObject from '../GameObject'
import Scene from '../Scene'
import Matrix2 from '../structs/Matrix2'

class GameObject2D extends GameObject {

    /** 
     * @readonly
     * @type {string}
     */
    key = null

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
        this.on(GameObject2D.Events.ADD_TO_WORLD, this.onAddToWorld, this)
        this.on(GameObject2D.Events.REMOVE_FROM_WORLD, this.onRemoveFromWorld, this)
        this.projection = projection
    }

    
    /** @protected */
    onCreate() {}

    /** @protected */
    onUpdate(time, delta) {}

    /** @protected */
    onDestroy() {}

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
     * @param {number} x 
     * @param {number} y 
     */
    contains(x, y) {
        return false
    }

    /** @private */
    onAddToWorld() {
        if(this.body !== null) {
            let isRemoved = this.body.removedFromWorld || false
            if (isRemoved) {
                this.scene.matter.world.add(this.body)
            }
        }
    }

    /** @private */
    onRemoveFromWorld() {
        this.scene.matter.world.remove(this.body, true)
        this.body.removedFromWorld = true
    }

}

/** @enum {string} */
GameObject2D.Events = {
    ADD_TO_WORLD: 'ADD_TO_WORLD_2D',
    REMOVE_FROM_WORLD: 'REMOVE_FROM_WORLD_2D'
}

export default GameObject2D