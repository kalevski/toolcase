import logging, { Logger } from '@toolcase/logging'
import { Game } from 'phaser'
import Scene from './Scene'

class Service {

    /**
     * @protected
     * @type {Game}
     */
    game = null

    /**
     * @protected
     * @type {Logger}
     */
    logger = null

    /**
     * 
     * @param {Game} game 
     * @param {string} name 
     */
    constructor(game, name) {
        this.game = game
        this.logger = logging.getLogger(`service=${name}`)
        this.onInit(name)
    }

    /**
     * @protected
     * @param {string} name 
     */
    onInit(name) {}

    /** @protected */
    onDispose() {}

    /**
     * @type {Array<Scene>}
     */
    get scenes() {
        return this.game.scene.getScenes()
    }
}

export default Service