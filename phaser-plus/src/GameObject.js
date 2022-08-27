import { Game } from 'phaser'
import { generateId } from '@toolcase/base'
import Scene from './Scene'
import Container from './Container'

class GameObject extends Container {

    /** @type {Scene} */
    scene = null

    /** @type {Game} */
    game = null

    /** 
     * @readonly
     * @type {string}
     */
    key = null

    /**
     * 
     * @param {Scene} scene 
     */
    constructor(scene) {
        super(scene)
        this.scene = scene
        this.game = this.scene.game
        this.name = generateId(16)
    }

    get id() {
        return this.name
    }

    /** @protected */
    onCreate() {}

    /**
     * @protected
     * @param {GameObjects.GameObject} parent 
     */
    onAdd(parent) {}

    onRemove() {}

    /** @protected */
    onUpdate(time, delta) {}

    /** @protected */
    onDestroy() {}

    /**
     * 
     * @param {number} x 
     * @param {number} y 
     */
    contains(x, y) {
        return false
    }

}

GameObject.Events = {
    ADD: 'GAMEOBJECT_ADD',
    REMOVE: 'GAMEOBJECT_REMOVE'
}

export default GameObject