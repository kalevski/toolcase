import { GameObjects } from 'phaser'
import { generateId } from '@toolcase/base'
import Scene from './Scene'

class GameObject extends GameObjects.Container {

    /** @type {Scene} */
    scene = null

    /**
     * 
     * @param {Scene} scene 
     */
    constructor(scene) {
        super(scene)
        this.scene = scene
        this.name = generateId(20)
    }

    get id() {
        return this.name
    }

}

export default GameObject