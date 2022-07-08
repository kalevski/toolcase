import { Math } from 'phaser'
import GameObject from '../GameObject'
import Scene from '../Scene'
import Matrix2 from '../structs/Matrix2'

class ISOGameObject extends GameObject {

    /** 
     * @readonly
     * @type {string}
     */
    key = null

    iso = new Math.Vector2(0, 0)

    offset = new Math.Vector2(0, 0)

    /**
     * @private
     * @type {Matrix2}
     */
    projection = null

    /**
     * 
     * @param {Scene} scene 
     */
    constructor(scene, projection) {
        super(scene)
        this.on(ISOGameObject.Events.ADD_TO_WORLD, this.onAddToWorld, this)
        this.on(ISOGameObject.Events.REMOVE_FROM_WORLD, this.onRemoveFromWorld, this)
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
    setISO(x, y) {
        this.projection.translate(x, y, this)
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
ISOGameObject.Events = {
    ADD_TO_ISO_WORLD: 'add_to_iso_world',
    REMOVE_FROM_ISO_WORLD: 'remove_from_iso_world'
}

export default ISOGameObject