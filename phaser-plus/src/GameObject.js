import { Game, GameObjects } from 'phaser'
import { generateId } from '@toolcase/base'
import Scene from './Scene'

class GameObject extends GameObjects.Container {

    /** @type {Scene} */
    scene = null

    /** @type {Game} */
    game = null

    /**
     * 
     * @param {Scene} scene 
     */
    constructor(scene) {
        super(scene)
        this.scene = scene
        this.game = this.scene.game
        this.name = generateId(20)
    }

    get id() {
        return this.name
    }

}

export default GameObject