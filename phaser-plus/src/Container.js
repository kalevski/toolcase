import { Game } from 'phaser'
import Scene from './Scene'

class Container {

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

export default Container