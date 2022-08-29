import { generateId } from '@toolcase/base'
import { Game, GameObjects } from 'phaser'
import Scene from './Scene'

class Container extends GameObjects.Container {

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

}

export default Container